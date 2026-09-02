//! Remote operations: push, pull, fetch with progress streaming.
//!
//! Uses Tauri Channels for real-time progress events.
//!
//! The Tauri commands are thin wrappers around `push_branch`, `fetch_remote`
//! and `pull_branch`, which operate on an open `git2::Repository` and report
//! progress through a `ProgressSink`. Keeping the core logic free of Tauri
//! types lets it be exercised directly in unit tests against local repos.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tauri::State;

use crate::git::credentials::create_credentials_callback;
use crate::git::error::GitError;
use crate::git::RepositoryState;

/// Progress events for remote sync operations.
/// Uses tagged enum serialization for frontend type safety.
#[derive(Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum SyncProgress {
    Started {
        operation: String,
    },
    Counting {
        current: u32,
        total: u32,
    },
    Compressing {
        current: u32,
        total: u32,
    },
    Transferring {
        current: u32,
        total: u32,
        bytes: u32,
    },
    Resolving {
        current: u32,
        total: u32,
    },
    Finished {
        operation: String,
    },
    Error {
        message: String,
    },
}

/// Result of a sync operation (push/pull/fetch).
///
/// Every field is derived from what the operation actually did, so the
/// frontend can build self-contained feedback ("Pushed feature/x to origin,
/// 3 commits") without relying on possibly-stale UI state.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub message: String,
    /// Number of commits sent (push) or received (fetch/pull).
    pub commits_transferred: u32,
    /// Name of the remote the operation targeted.
    pub remote: String,
    /// Local branch involved (`None` for fetch, which touches no local branch).
    pub branch: Option<String>,
    /// Remote-tracking refs created or updated by a fetch/pull.
    pub updated_refs: u32,
    /// True when there was nothing to transfer.
    pub up_to_date: bool,
    /// True when this push configured `<remote>/<branch>` as the upstream
    /// of the local branch (first push of a branch).
    pub upstream_set: bool,
}

/// Information about a configured remote.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
}

/// Receiver for progress events. A Tauri `Channel` in production, a no-op
/// closure in tests.
pub type ProgressSink = Arc<dyn Fn(SyncProgress) + Send + Sync>;

fn channel_sink(channel: Channel<SyncProgress>) -> ProgressSink {
    Arc::new(move |event| {
        let _ = channel.send(event);
    })
}

/// Helper to get repository path or return error.
async fn get_repo_path(state: &State<'_, RepositoryState>) -> Result<PathBuf, GitError> {
    state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))
}

/// Map a libgit2 transport error to the closest typed `GitError`.
fn map_transport_error(e: git2::Error) -> GitError {
    let message = e.message().to_string();
    let lower = message.to_lowercase();
    match e.class() {
        git2::ErrorClass::Net => GitError::NetworkError(message),
        git2::ErrorClass::Ssh => GitError::AuthenticationFailed(message),
        _ if lower.contains("auth") || lower.contains("credential") => {
            GitError::AuthenticationFailed(message)
        }
        _ => GitError::OperationFailed(message),
    }
}

/// Current branch name and tip, refusing detached HEAD.
fn current_branch(repo: &git2::Repository, verb: &str) -> Result<(String, git2::Oid), GitError> {
    let head = repo.head()?;
    if !head.is_branch() {
        return Err(GitError::OperationFailed(format!(
            "Cannot {}: HEAD is detached. Check out a branch first.",
            verb
        )));
    }
    let name = head
        .shorthand()
        .map_err(|_| GitError::OperationFailed("Cannot determine current branch".to_string()))?
        .to_string();
    let oid = head
        .target()
        .ok_or_else(|| GitError::OperationFailed("Current branch has no commits".to_string()))?;
    Ok((name, oid))
}

/// Tips of every `refs/remotes/<remote>/*` ref.
fn remote_tracking_tips(repo: &git2::Repository, remote_name: &str) -> Vec<git2::Oid> {
    let glob = format!("refs/remotes/{}/*", remote_name);
    repo.references_glob(&glob)
        .map(|refs| {
            refs.filter_map(|r| r.ok())
                .filter_map(|r| r.target())
                .collect()
        })
        .unwrap_or_default()
}

/// Count commits reachable from `tips` but not from any of `hidden`.
fn count_new_commits(
    repo: &git2::Repository,
    tips: &[git2::Oid],
    hidden: &[git2::Oid],
) -> Result<u32, GitError> {
    if tips.is_empty() {
        return Ok(0);
    }
    let mut walk = repo.revwalk()?;
    for tip in tips {
        walk.push(*tip)?;
    }
    for oid in hidden {
        // A hidden oid may not exist locally (e.g. a stale tracking ref);
        // that is harmless for the count, so ignore it.
        let _ = walk.hide(*oid);
    }
    Ok(walk.count() as u32)
}

/// Push the current branch to `remote_name`.
///
/// Reports the number of commits sent (ahead count before the push), sets the
/// upstream on the first push of a branch, and surfaces server-side
/// rejections (non-fast-forward, hooks) as `GitError::PushRejected`.
pub fn push_branch(
    repo: &git2::Repository,
    remote_name: &str,
    progress: ProgressSink,
) -> Result<SyncResult, GitError> {
    let mut remote_obj = repo
        .find_remote(remote_name)
        .map_err(|_| GitError::RemoteNotFound(remote_name.to_string()))?;

    let (branch_name, local_oid) = current_branch(repo, "push")?;
    let tracking_name = format!("{}/{}", remote_name, branch_name);

    let mut branch = repo.find_branch(&branch_name, git2::BranchType::Local)?;
    let has_upstream = branch.upstream().is_ok();

    let remote_oid = repo
        .find_reference(&format!("refs/remotes/{}", tracking_name))
        .ok()
        .and_then(|r| r.target());

    // Work out what we are about to send before touching the network.
    let commits_to_push = match remote_oid {
        Some(remote_oid) => {
            let (ahead, behind) = repo.graph_ahead_behind(local_oid, remote_oid)?;
            if behind > 0 {
                return Err(GitError::PushRejected(format!(
                    "{} has {} commit{} not present on {}",
                    tracking_name,
                    behind,
                    if behind == 1 { "" } else { "s" },
                    branch_name
                )));
            }
            ahead as u32
        }
        None => count_new_commits(
            repo,
            &[local_oid],
            &remote_tracking_tips(repo, remote_name),
        )?,
    };

    if has_upstream && remote_oid == Some(local_oid) {
        return Ok(SyncResult {
            success: true,
            message: format!(
                "Nothing to push: {} is up to date with {}",
                branch_name, tracking_name
            ),
            commits_transferred: 0,
            remote: remote_name.to_string(),
            branch: Some(branch_name),
            updated_refs: 0,
            up_to_date: true,
            upstream_set: false,
        });
    }

    let refspec = format!("refs/heads/{0}:refs/heads/{0}", branch_name);
    let rejection: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));

    let mut callbacks = git2::RemoteCallbacks::new();

    let progress_pack = progress.clone();
    callbacks.pack_progress(move |stage, current, total| match stage {
        git2::PackBuilderStage::AddingObjects => progress_pack(SyncProgress::Counting {
            current: current as u32,
            total: total as u32,
        }),
        git2::PackBuilderStage::Deltafication => progress_pack(SyncProgress::Compressing {
            current: current as u32,
            total: total as u32,
        }),
    });

    let rejection_sink = rejection.clone();
    callbacks.push_update_reference(move |_refname, status| {
        if let Some(status) = status {
            if let Ok(mut slot) = rejection_sink.lock() {
                *slot = Some(status.to_string());
            }
        }
        Ok(())
    });

    callbacks.credentials(create_credentials_callback());

    let mut opts = git2::PushOptions::new();
    opts.remote_callbacks(callbacks);

    remote_obj.push(&[&refspec], Some(&mut opts)).map_err(|e| {
        let lower = e.message().to_lowercase();
        if lower.contains("rejected")
            || lower.contains("non-fast-forward")
            || lower.contains("not present locally")
        {
            GitError::PushRejected(format!("{}: {}", tracking_name, e.message()))
        } else {
            map_transport_error(e)
        }
    })?;

    if let Some(status) = rejection.lock().ok().and_then(|slot| slot.clone()) {
        return Err(GitError::PushRejected(format!("{}: {}", tracking_name, status)));
    }

    let mut upstream_set = false;
    if !has_upstream && branch.set_upstream(Some(&tracking_name)).is_ok() {
        upstream_set = true;
    }

    Ok(SyncResult {
        success: true,
        message: format!("Pushed {} to {}", branch_name, remote_name),
        commits_transferred: commits_to_push,
        remote: remote_name.to_string(),
        branch: Some(branch_name),
        updated_refs: 0,
        up_to_date: false,
        upstream_set,
    })
}

/// Fetch every branch from `remote_name` without merging.
///
/// Reports how many remote-tracking refs changed and how many commits were
/// new to this repository.
pub fn fetch_remote(
    repo: &git2::Repository,
    remote_name: &str,
    progress: ProgressSink,
) -> Result<SyncResult, GitError> {
    let mut remote_obj = repo
        .find_remote(remote_name)
        .map_err(|_| GitError::RemoteNotFound(remote_name.to_string()))?;

    let tips_before = remote_tracking_tips(repo, remote_name);
    let updates: Arc<Mutex<Vec<(git2::Oid, git2::Oid)>>> = Arc::new(Mutex::new(Vec::new()));

    let mut callbacks = git2::RemoteCallbacks::new();

    let progress_transfer = progress.clone();
    callbacks.transfer_progress(move |stats| {
        progress_transfer(SyncProgress::Transferring {
            current: stats.received_objects() as u32,
            total: stats.total_objects() as u32,
            bytes: stats.received_bytes() as u32,
        });
        true
    });

    let updates_sink = updates.clone();
    callbacks.update_tips(move |refname, old, new| {
        if refname.starts_with("refs/remotes/") {
            if let Ok(mut list) = updates_sink.lock() {
                list.push((old, new));
            }
        }
        true
    });

    callbacks.credentials(create_credentials_callback());

    let mut opts = git2::FetchOptions::new();
    opts.remote_callbacks(callbacks);

    // Fetch all branches (empty refspec = default)
    remote_obj
        .fetch(&[] as &[&str], Some(&mut opts), None)
        .map_err(map_transport_error)?;

    let updates = updates.lock().map(|u| u.clone()).unwrap_or_default();
    let updated_refs = updates.iter().filter(|(_, new)| !new.is_zero()).count() as u32;
    let new_tips: Vec<git2::Oid> = updates
        .iter()
        .map(|(_, new)| *new)
        .filter(|oid| !oid.is_zero())
        .collect();
    let new_commits = count_new_commits(repo, &new_tips, &tips_before)?;

    Ok(SyncResult {
        success: true,
        message: if updated_refs == 0 {
            format!("Fetched {}: already up to date", remote_name)
        } else {
            format!("Fetched {}", remote_name)
        },
        commits_transferred: new_commits,
        remote: remote_name.to_string(),
        branch: None,
        updated_refs,
        up_to_date: updated_refs == 0,
        upstream_set: false,
    })
}

/// Fetch from `remote_name` and merge `<remote>/<branch>` into the current
/// branch. Fast-forward merges are preferred; a clean non-fast-forward merge
/// is left staged for the user to review and commit.
pub fn pull_branch(
    repo: &git2::Repository,
    remote_name: &str,
    progress: ProgressSink,
) -> Result<SyncResult, GitError> {
    let (branch_name, local_oid) = current_branch(repo, "pull")?;

    // Step 1: Fetch
    let fetched = fetch_remote(repo, remote_name, progress)?;

    // Step 2: Find the remote tracking branch
    let tracking_name = format!("{}/{}", remote_name, branch_name);
    let fetch_head = repo
        .find_reference(&format!("refs/remotes/{}", tracking_name))
        .map_err(|_| {
            GitError::OperationFailed(format!(
                "No tracking branch found for {}",
                tracking_name
            ))
        })?;

    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;

    let base = |success: bool, message: String, commits: u32, up_to_date: bool| SyncResult {
        success,
        message,
        commits_transferred: commits,
        remote: remote_name.to_string(),
        branch: Some(branch_name.clone()),
        updated_refs: fetched.updated_refs,
        up_to_date,
        upstream_set: false,
    };

    // Step 3: Merge analysis
    let (analysis, _preference) = repo.merge_analysis(&[&fetch_commit])?;

    if analysis.is_up_to_date() {
        return Ok(base(true, "Already up to date".to_string(), 0, true));
    }

    // Commits on the remote branch that are not yet on the local one.
    let (_, incoming) = repo.graph_ahead_behind(local_oid, fetch_commit.id())?;
    let incoming = incoming as u32;

    if analysis.is_fast_forward() {
        // Refuse to fast-forward if the working tree has local modifications
        // that a forced checkout would silently overwrite (matches
        // `git pull --ff-only` semantics). Ignored and untracked files are
        // not affected by the checkout, so exclude them from the check.
        let mut status_opts = git2::StatusOptions::new();
        status_opts
            .include_ignored(false)
            .include_untracked(false)
            .exclude_submodules(true);
        let statuses = repo.statuses(Some(&mut status_opts))?;
        if !statuses.is_empty() {
            return Err(GitError::OperationFailed(
                "Local changes would be overwritten by pull. Commit or stash them first."
                    .to_string(),
            ));
        }

        // Fast-forward: just update HEAD
        let refname = format!("refs/heads/{}", branch_name);
        let mut reference = repo.find_reference(&refname)?;
        reference.set_target(fetch_commit.id(), "pull: fast-forward")?;
        repo.set_head(&refname)?;
        // Use a safe checkout (not force) so git2 refuses to clobber any
        // file it cannot reconcile rather than discarding local work.
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().safe()))?;

        return Ok(base(
            true,
            format!("Fast-forwarded {} to {}", branch_name, tracking_name),
            incoming,
            false,
        ));
    }

    if analysis.is_normal() {
        // Normal merge required - attempt it
        repo.merge(&[&fetch_commit], None, None)?;

        // Check for conflicts
        let index = repo.index()?;
        if index.has_conflicts() {
            // Abort the merge so the repository isn't left stuck in a
            // MERGING state with a conflicted index. This mirrors the
            // gitflow merge path and avoids subsequent operations behaving
            // as if a merge were mid-flight.
            repo.cleanup_state()?;
            repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
            return Ok(base(
                false,
                "Merge conflicts detected. Pull aborted; resolve manually or use a merge tool."
                    .to_string(),
                0,
                false,
            ));
        }

        // No conflicts - but we don't auto-commit
        // User should review and commit the merge
        return Ok(base(
            true,
            "Merged successfully. Please review and commit the merge.".to_string(),
            incoming,
            false,
        ));
    }

    // Unborn or other edge case
    Err(GitError::OperationFailed(
        "Cannot merge: unhandled merge scenario".to_string(),
    ))
}

/// List all configured remotes for the current repository.
#[tauri::command]
#[specta::specta]
pub async fn get_remotes(state: State<'_, RepositoryState>) -> Result<Vec<RemoteInfo>, GitError> {
    let repo_path = get_repo_path(&state).await?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let remotes = repo.remotes()?;

        let mut result = Vec::new();
        for name in remotes.iter().filter_map(|n| n.ok().flatten()) {
            if let Ok(remote) = repo.find_remote(name) {
                result.push(RemoteInfo {
                    name: name.to_string(),
                    url: remote.url().unwrap_or("").to_string(),
                });
            }
        }

        Ok(result)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Run one of the sync helpers on the open repository with progress
/// bracketing (`Started` / `Finished`).
async fn run_sync(
    operation: &'static str,
    remote: String,
    on_progress: Channel<SyncProgress>,
    state: State<'_, RepositoryState>,
    op: fn(&git2::Repository, &str, ProgressSink) -> Result<SyncResult, GitError>,
) -> Result<SyncResult, GitError> {
    let repo_path = get_repo_path(&state).await?;

    on_progress
        .send(SyncProgress::Started {
            operation: operation.to_string(),
        })
        .ok();

    let sink = channel_sink(on_progress.clone());
    let result = tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        op(&repo, &remote, sink)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))??;

    on_progress
        .send(SyncProgress::Finished {
            operation: operation.to_string(),
        })
        .ok();

    Ok(result)
}

/// Fetch from a remote without merging.
///
/// Downloads objects and refs from the remote but does not modify
/// the working directory or current branch.
#[tauri::command]
#[specta::specta]
pub async fn fetch_from_remote(
    remote: String,
    on_progress: Channel<SyncProgress>,
    state: State<'_, RepositoryState>,
) -> Result<SyncResult, GitError> {
    run_sync("fetch", remote, on_progress, state, fetch_remote).await
}

/// Push current branch to a remote.
///
/// Sends local commits to the remote repository.
#[tauri::command]
#[specta::specta]
pub async fn push_to_remote(
    remote: String,
    on_progress: Channel<SyncProgress>,
    state: State<'_, RepositoryState>,
) -> Result<SyncResult, GitError> {
    run_sync("push", remote, on_progress, state, push_branch).await
}

/// Pull from a remote (fetch + merge).
///
/// Downloads objects from the remote and merges the tracking branch
/// into the current branch. Fast-forward merges are preferred.
#[tauri::command]
#[specta::specta]
pub async fn pull_from_remote(
    remote: String,
    on_progress: Channel<SyncProgress>,
    state: State<'_, RepositoryState>,
) -> Result<SyncResult, GitError> {
    run_sync("pull", remote, on_progress, state, pull_branch).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    fn noop_sink() -> ProgressSink {
        Arc::new(|_| {})
    }

    fn signature() -> git2::Signature<'static> {
        git2::Signature::now("Test", "test@example.com").unwrap()
    }

    /// Create a commit touching `file` on the current branch of `repo`.
    fn commit_file(repo: &git2::Repository, file: &str, content: &str) -> git2::Oid {
        let workdir = repo.workdir().unwrap();
        fs::write(workdir.join(file), content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new(file)).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent.iter().collect();
        let sig = signature();
        repo.commit(Some("HEAD"), &sig, &sig, &format!("add {}", file), &tree, &parents)
            .unwrap()
    }

    /// A bare "server" repo plus a working clone with `origin` pointing at it.
    /// The clone starts with one pushed commit on `main`.
    struct Fixture {
        _dir: tempfile::TempDir,
        bare: PathBuf,
        work: git2::Repository,
    }

    fn fixture() -> Fixture {
        let dir = tempfile::TempDir::new().unwrap();
        let bare = dir.path().join("server.git");
        let server = git2::Repository::init_bare(&bare).unwrap();
        // Clones resolve the remote HEAD, so point it at the branch we push.
        server.set_head("refs/heads/main").unwrap();

        let work_path = dir.path().join("work");
        let mut init_opts = git2::RepositoryInitOptions::new();
        init_opts.initial_head("main");
        let work = git2::Repository::init_opts(&work_path, &init_opts).unwrap();
        work.remote("origin", bare.to_str().unwrap()).unwrap();
        commit_file(&work, "a.txt", "a");

        // Seed the remote so later tests start from a synced state.
        let result = push_branch(&work, "origin", noop_sink()).unwrap();
        assert!(result.success);

        Fixture {
            _dir: dir,
            bare,
            work,
        }
    }

    /// A second clone of the fixture's bare repo, used to simulate another
    /// contributor pushing to the server.
    fn other_clone(fx: &Fixture) -> git2::Repository {
        let path = fx._dir.path().join("other");
        git2::Repository::clone(fx.bare.to_str().unwrap(), &path).unwrap()
    }

    #[test]
    fn first_push_sets_upstream_and_counts_commits() {
        let dir = tempfile::TempDir::new().unwrap();
        let bare = dir.path().join("server.git");
        git2::Repository::init_bare(&bare).unwrap();
        let mut init_opts = git2::RepositoryInitOptions::new();
        init_opts.initial_head("feature/payments");
        let work = git2::Repository::init_opts(dir.path().join("work"), &init_opts).unwrap();
        work.remote("origin", bare.to_str().unwrap()).unwrap();
        commit_file(&work, "a.txt", "a");
        commit_file(&work, "b.txt", "b");

        let result = push_branch(&work, "origin", noop_sink()).unwrap();

        assert!(result.success);
        assert_eq!(result.remote, "origin");
        assert_eq!(result.branch.as_deref(), Some("feature/payments"));
        assert_eq!(result.commits_transferred, 2);
        assert!(result.upstream_set);
        assert!(!result.up_to_date);

        let branch = work
            .find_branch("feature/payments", git2::BranchType::Local)
            .unwrap();
        assert_eq!(
            branch.upstream().unwrap().name().unwrap(),
            Some("origin/feature/payments")
        );
    }

    #[test]
    fn push_with_nothing_to_send_reports_up_to_date() {
        let fx = fixture();

        let result = push_branch(&fx.work, "origin", noop_sink()).unwrap();

        assert!(result.success);
        assert!(result.up_to_date);
        assert_eq!(result.commits_transferred, 0);
        assert!(!result.upstream_set);
        assert_eq!(result.branch.as_deref(), Some("main"));
        assert!(result.message.contains("Nothing to push"));
    }

    #[test]
    fn push_reports_ahead_count() {
        let fx = fixture();
        commit_file(&fx.work, "b.txt", "b");
        commit_file(&fx.work, "c.txt", "c");
        commit_file(&fx.work, "d.txt", "d");

        let result = push_branch(&fx.work, "origin", noop_sink()).unwrap();

        assert_eq!(result.commits_transferred, 3);
        assert!(!result.up_to_date);
        assert!(!result.upstream_set);
    }

    #[test]
    fn push_behind_remote_is_rejected() {
        let fx = fixture();
        let other = other_clone(&fx);
        commit_file(&other, "remote.txt", "r");
        push_branch(&other, "origin", noop_sink()).unwrap();

        // Learn about the remote commit without merging it, then diverge.
        fetch_remote(&fx.work, "origin", noop_sink()).unwrap();
        commit_file(&fx.work, "local.txt", "l");

        let err = push_branch(&fx.work, "origin", noop_sink()).unwrap_err();
        match err {
            GitError::PushRejected(msg) => assert!(msg.contains("origin/main"), "{}", msg),
            other => panic!("expected PushRejected, got {:?}", other),
        }
    }

    #[test]
    fn push_to_unknown_remote_fails() {
        let fx = fixture();
        let err = push_branch(&fx.work, "nope", noop_sink()).unwrap_err();
        assert!(matches!(err, GitError::RemoteNotFound(_)));
    }

    #[test]
    fn fetch_up_to_date_reports_nothing_new() {
        let fx = fixture();

        let result = fetch_remote(&fx.work, "origin", noop_sink()).unwrap();

        assert!(result.success);
        assert!(result.up_to_date);
        assert_eq!(result.updated_refs, 0);
        assert_eq!(result.commits_transferred, 0);
        assert_eq!(result.branch, None);
        assert_eq!(result.remote, "origin");
    }

    #[test]
    fn fetch_counts_new_commits_and_updated_refs() {
        let fx = fixture();
        let other = other_clone(&fx);
        commit_file(&other, "one.txt", "1");
        commit_file(&other, "two.txt", "2");
        push_branch(&other, "origin", noop_sink()).unwrap();

        let result = fetch_remote(&fx.work, "origin", noop_sink()).unwrap();

        assert!(!result.up_to_date);
        assert_eq!(result.updated_refs, 1);
        assert_eq!(result.commits_transferred, 2);
    }

    #[test]
    fn pull_already_up_to_date() {
        let fx = fixture();

        let result = pull_branch(&fx.work, "origin", noop_sink()).unwrap();

        assert!(result.success);
        assert!(result.up_to_date);
        assert_eq!(result.commits_transferred, 0);
        assert_eq!(result.branch.as_deref(), Some("main"));
    }

    #[test]
    fn pull_fast_forward_counts_incoming_commits() {
        let fx = fixture();
        let other = other_clone(&fx);
        commit_file(&other, "one.txt", "1");
        commit_file(&other, "two.txt", "2");
        let expected_tip = commit_file(&other, "three.txt", "3");
        push_branch(&other, "origin", noop_sink()).unwrap();

        let result = pull_branch(&fx.work, "origin", noop_sink()).unwrap();

        assert!(result.success);
        assert!(!result.up_to_date);
        assert_eq!(result.commits_transferred, 3);
        assert_eq!(result.updated_refs, 1);
        assert_eq!(fx.work.head().unwrap().target().unwrap(), expected_tip);
    }
}
