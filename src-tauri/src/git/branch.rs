use std::collections::HashSet;
use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;
use specta_typescript::Number;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// How many commits a local branch is ahead/behind its upstream.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AheadBehind {
    /// Commits on local not yet on upstream
    pub ahead: u32,
    /// Commits on upstream not yet on local
    pub behind: u32,
}

/// Information about a branch (local or remote).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    /// Branch name (e.g., "main", "feature/login", "origin/feature/x")
    pub name: String,
    /// True if this is the currently checked out branch
    pub is_head: bool,
    /// Short OID of the branch tip commit (7 chars)
    pub last_commit_oid: String,
    /// Summary line of the tip commit
    pub last_commit_message: String,
    /// Whether branch is merged into HEAD (None if IS head)
    pub is_merged: Option<bool>,
    /// True for remote tracking branches, false for local
    pub is_remote: bool,
    /// Remote name (e.g., "origin") for remote branches, None for local
    pub remote_name: Option<String>,
}

/// List all local branches of the repository at `repo_path`.
///
/// Opens a fresh repository handle, so the result always reflects the refs
/// currently on disk — including branches created or checked out after the
/// repository was opened, whether by the app (gitflow start) or externally.
pub fn list_local_branches(repo_path: &Path) -> Result<Vec<BranchInfo>, GitError> {
    let repo = git2::Repository::open(repo_path)?;

    // Get HEAD commit for merge check
    let head_commit = match repo.head() {
        Ok(head) => Some(head.peel_to_commit()?),
        Err(e) if e.code() == git2::ErrorCode::UnbornBranch => None,
        Err(e) => return Err(e.into()),
    };

    let mut branches = Vec::new();

    for branch_result in repo.branches(Some(git2::BranchType::Local))? {
        let (branch, _branch_type) = branch_result?;

        let name = branch
            .name()?
            .ok_or_else(|| GitError::OperationFailed("Invalid branch name".to_string()))?
            .to_string();

        let is_head = branch.is_head();

        let commit = branch.get().peel_to_commit()?;
        let last_commit_oid = format!("{:.7}", commit.id());
        let last_commit_message = commit.summary().ok().flatten().unwrap_or("").to_string();

        let is_merged = if is_head {
            None
        } else if let Some(ref head) = head_commit {
            let merge_base = repo.merge_base(head.id(), commit.id())?;
            Some(merge_base == commit.id())
        } else {
            Some(false)
        };

        branches.push(BranchInfo {
            name,
            is_head,
            last_commit_oid,
            last_commit_message,
            is_merged,
            is_remote: false,
            remote_name: None,
        });
    }

    // Sort: current branch first, then alphabetically
    branches.sort_by(|a, b| {
        if a.is_head != b.is_head {
            b.is_head.cmp(&a.is_head)
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(branches)
}

/// List all local branches in the repository.
#[tauri::command]
#[specta::specta]
pub async fn list_branches(state: State<'_, RepositoryState>) -> Result<Vec<BranchInfo>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || list_local_branches(&repo_path))
        .await
        .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Update the index and working tree to `target` with a *safe* checkout.
///
/// Local modifications that do not overlap with the differences between the
/// current HEAD tree and `target` are carried over (`git checkout` semantics).
/// Any file whose local changes would have to be overwritten aborts the whole
/// checkout with [`GitError::CheckoutWouldOverwrite`] listing those paths, and
/// nothing is modified.
pub(crate) fn checkout_tree_safe(
    repo: &git2::Repository,
    target: &git2::Object<'_>,
) -> Result<(), GitError> {
    let conflicts = std::cell::RefCell::new(Vec::<String>::new());

    let result = {
        let mut opts = git2::build::CheckoutBuilder::new();
        opts.safe()
            .notify_on(git2::CheckoutNotificationType::CONFLICT)
            .notify(|_, path, _, _, _| {
                if let Some(path) = path {
                    conflicts.borrow_mut().push(path.display().to_string());
                }
                true
            });
        repo.checkout_tree(target, Some(&mut opts))
    };

    match result {
        Ok(()) => Ok(()),
        Err(e) if e.code() == git2::ErrorCode::Conflict => {
            let mut paths = conflicts.into_inner();
            paths.sort();
            paths.dedup();
            if paths.is_empty() {
                Err(GitError::CheckoutWouldOverwrite(e.message().to_string()))
            } else {
                Err(GitError::CheckoutWouldOverwrite(paths.join(", ")))
            }
        }
        Err(e) => Err(GitError::from(e)),
    }
}

/// Switch HEAD to the local branch `branch_name` (`git checkout <branch>`).
///
/// The index and working tree are brought to the branch tip with a safe
/// [`checkout_tree_safe`] *before* HEAD is moved. libgit2 uses the current
/// HEAD tree as the checkout baseline: if HEAD were moved first, the files of
/// the previous branch would look like local edits of the new branch and a
/// safe checkout would leave them in place, turning the switch into a
/// `git reset --soft` with a pile of staged changes on the wrong branch.
/// Doing the checkout first also means a refused switch leaves HEAD, index and
/// working tree exactly as they were.
pub(crate) fn switch_to_local_branch(
    repo: &git2::Repository,
    branch_name: &str,
) -> Result<(), GitError> {
    let branch = repo
        .find_branch(branch_name, git2::BranchType::Local)
        .map_err(|_| GitError::BranchNotFound(branch_name.to_string()))?;
    let commit = branch.get().peel_to_commit()?;

    // Working tree and index first; only move HEAD once that succeeded.
    checkout_tree_safe(repo, commit.as_object())?;
    repo.set_head(&format!("refs/heads/{}", branch_name))?;
    Ok(())
}

/// Create a new branch from HEAD.
#[tauri::command]
#[specta::specta]
pub async fn create_branch(
    name: String,
    checkout: bool,
    state: State<'_, RepositoryState>,
) -> Result<BranchInfo, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Validate branch name
        if !git2::Branch::name_is_valid(&name)? {
            return Err(GitError::InvalidBranchName(name));
        }

        // Check if branch already exists
        if repo.find_branch(&name, git2::BranchType::Local).is_ok() {
            return Err(GitError::BranchAlreadyExists(name));
        }

        // Get HEAD commit
        let head_commit = repo.head()?.peel_to_commit()?;

        // Create branch
        let branch = repo.branch(&name, &head_commit, false)?;

        // Optionally checkout the new branch
        if checkout {
            switch_to_local_branch(&repo, &name)?;
        }

        let commit = branch.get().peel_to_commit()?;

        Ok(BranchInfo {
            name: name.clone(),
            is_head: checkout,
            last_commit_oid: format!("{:.7}", commit.id()),
            last_commit_message: commit.summary().ok().flatten().unwrap_or("").to_string(),
            is_merged: if checkout { None } else { Some(true) },
            is_remote: false,
            remote_name: None,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Switch to an existing branch.
#[tauri::command]
#[specta::specta]
pub async fn checkout_branch(
    branch_name: String,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        switch_to_local_branch(&repo, &branch_name)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Delete a local branch.
#[tauri::command]
#[specta::specta]
pub async fn delete_branch(
    branch_name: String,
    force: bool,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let mut branch = repo
            .find_branch(&branch_name, git2::BranchType::Local)
            .map_err(|_| GitError::BranchNotFound(branch_name.clone()))?;

        if branch.is_head() {
            return Err(GitError::CannotDeleteCurrentBranch);
        }

        if !force {
            let head_commit = repo.head()?.peel_to_commit()?;
            let branch_commit = branch.get().peel_to_commit()?;
            let merge_base = repo.merge_base(head_commit.id(), branch_commit.id())?;

            if merge_base != branch_commit.id() {
                return Err(GitError::BranchNotMerged(branch_name));
            }
        }

        branch.delete()?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// List all branches (local and optionally remote) in the repository.
#[tauri::command]
#[specta::specta]
pub async fn list_all_branches(
    include_remote: bool,
    state: State<'_, RepositoryState>,
) -> Result<Vec<BranchInfo>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let head_commit = match repo.head() {
            Ok(head) => Some(head.peel_to_commit()?),
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => None,
            Err(e) => return Err(e.into()),
        };

        let mut branches = Vec::new();

        // Always include local branches
        for branch_result in repo.branches(Some(git2::BranchType::Local))? {
            let (branch, _branch_type) = branch_result?;

            let name = branch
                .name()?
                .ok_or_else(|| GitError::OperationFailed("Invalid branch name".to_string()))?
                .to_string();

            let is_head = branch.is_head();

            let commit = branch.get().peel_to_commit()?;
            let last_commit_oid = format!("{:.7}", commit.id());
            let last_commit_message = commit.summary().ok().flatten().unwrap_or("").to_string();

            let is_merged = if is_head {
                None
            } else if let Some(ref head) = head_commit {
                let merge_base = repo.merge_base(head.id(), commit.id())?;
                Some(merge_base == commit.id())
            } else {
                Some(false)
            };

            branches.push(BranchInfo {
                name,
                is_head,
                last_commit_oid,
                last_commit_message,
                is_merged,
                is_remote: false,
                remote_name: None,
            });
        }

        // Optionally include remote branches
        if include_remote {
            for branch_result in repo.branches(Some(git2::BranchType::Remote))? {
                let (branch, _branch_type) = branch_result?;

                let name = match branch.name()? {
                    Some(n) => n.to_string(),
                    None => continue,
                };

                // Skip HEAD references (e.g., "origin/HEAD")
                if name.ends_with("/HEAD") {
                    continue;
                }

                let remote_name = name.split('/').next().map(|s| s.to_string());

                let commit = match branch.get().peel_to_commit() {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                let last_commit_oid = format!("{:.7}", commit.id());
                let last_commit_message = commit.summary().ok().flatten().unwrap_or("").to_string();

                let is_merged = if let Some(ref head) = head_commit {
                    match repo.merge_base(head.id(), commit.id()) {
                        Ok(merge_base) => Some(merge_base == commit.id()),
                        Err(_) => Some(false),
                    }
                } else {
                    Some(false)
                };

                branches.push(BranchInfo {
                    name,
                    is_head: false,
                    last_commit_oid,
                    last_commit_message,
                    is_merged,
                    is_remote: true,
                    remote_name,
                });
            }
        }

        // Sort: local HEAD first, then local alphabetically, then remote alphabetically
        branches.sort_by(|a, b| {
            if a.is_head != b.is_head {
                return b.is_head.cmp(&a.is_head);
            }
            if a.is_remote != b.is_remote {
                return a.is_remote.cmp(&b.is_remote);
            }
            a.name.cmp(&b.name)
        });

        Ok(branches)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Checkout a remote branch by creating a local tracking branch.
#[tauri::command]
#[specta::specta]
pub async fn checkout_remote_branch(
    remote_branch: String,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Parse local name from remote branch (e.g., "origin/feature/x" -> "feature/x")
        let local_name = remote_branch
            .split_once('/')
            .map(|(_, rest)| rest.to_string())
            .ok_or_else(|| {
                GitError::InvalidBranchName(format!(
                    "Invalid remote branch format: {}",
                    remote_branch
                ))
            })?;

        // Check if a local branch with that name already exists
        if repo
            .find_branch(&local_name, git2::BranchType::Local)
            .is_ok()
        {
            return switch_to_local_branch(&repo, &local_name);
        }

        // Find the remote reference
        let remote_ref = repo
            .find_branch(&remote_branch, git2::BranchType::Remote)
            .map_err(|_| GitError::BranchNotFound(remote_branch.clone()))?;

        let commit = remote_ref.get().peel_to_commit()?;

        // Create a local branch from that commit
        let mut local_branch = repo.branch(&local_name, &commit, false)?;

        // Set the upstream tracking
        local_branch.set_upstream(Some(&remote_branch))?;

        // Checkout the new local branch
        switch_to_local_branch(&repo, &local_name)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// A recently checked-out branch extracted from the reflog.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecentCheckout {
    /// Branch name (bare, without refs/heads/ prefix)
    pub name: String,
    /// Unix timestamp in milliseconds when the checkout occurred
    #[specta(type = Number)]
    pub last_checkout_ms: f64,
}

/// Result of deleting a single branch in a batch operation.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BranchDeleteResult {
    /// Branch name that was targeted
    pub name: String,
    /// Whether the branch was successfully deleted
    pub deleted: bool,
    /// Error message if deletion failed
    pub error: Option<String>,
}

/// Result of a batch branch deletion operation.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BatchDeleteResult {
    /// Per-branch results
    pub results: Vec<BranchDeleteResult>,
    /// Count of successfully deleted branches
    pub total_deleted: u32,
    /// Count of branches that failed to delete
    pub total_failed: u32,
}

/// Get recently checked-out branches from the HEAD reflog.
#[tauri::command]
#[specta::specta]
pub async fn get_recent_checkouts(
    limit: Option<u32>,
    state: State<'_, RepositoryState>,
) -> Result<Vec<RecentCheckout>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;
    let max = limit.unwrap_or(10) as usize;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let reflog = repo
            .reflog("HEAD")
            .map_err(|e| GitError::OperationFailed(e.message().to_string()))?;

        let mut seen = HashSet::new();
        let mut recent = Vec::new();

        for entry in reflog.iter() {
            let msg = entry.message().ok().flatten().unwrap_or("");
            if let Some(branch_name) = msg
                .strip_prefix("checkout: moving from ")
                .and_then(|rest| rest.rsplit(" to ").next())
            {
                // Skip detached HEAD entries (40-char hex hashes)
                if branch_name.len() == 40 && branch_name.chars().all(|c| c.is_ascii_hexdigit()) {
                    continue;
                }

                if seen.insert(branch_name.to_string()) {
                    let timestamp_secs = entry.committer().when().seconds();
                    recent.push(RecentCheckout {
                        name: branch_name.to_string(),
                        last_checkout_ms: (timestamp_secs as f64) * 1000.0,
                    });
                    if recent.len() >= max {
                        break;
                    }
                }
            }
        }

        Ok(recent)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Delete multiple local branches in a single batch operation.
#[tauri::command]
#[specta::specta]
pub async fn batch_delete_branches(
    branch_names: Vec<String>,
    force: bool,
    state: State<'_, RepositoryState>,
) -> Result<BatchDeleteResult, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let head_commit = match repo.head() {
            Ok(head) => Some(head.peel_to_commit()?),
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => None,
            Err(e) => return Err(e.into()),
        };

        let mut results = Vec::with_capacity(branch_names.len());
        let mut total_deleted = 0u32;
        let mut total_failed = 0u32;

        for name in &branch_names {
            let result: Result<(), String> = (|| {
                let mut branch = repo
                    .find_branch(name, git2::BranchType::Local)
                    .map_err(|_| format!("Branch '{}' not found", name))?;

                if branch.is_head() {
                    return Err("Cannot delete the current branch".to_string());
                }

                if !force
                    && let Some(ref head) = head_commit {
                        let branch_commit = branch
                            .get()
                            .peel_to_commit()
                            .map_err(|e| e.message().to_string())?;
                        let merge_base = repo
                            .merge_base(head.id(), branch_commit.id())
                            .map_err(|e| e.message().to_string())?;
                        if merge_base != branch_commit.id() {
                            return Err(format!("Branch '{}' is not fully merged", name));
                        }
                    }

                branch.delete().map_err(|e| e.message().to_string())?;
                Ok(())
            })();

            match result {
                Ok(()) => {
                    total_deleted += 1;
                    results.push(BranchDeleteResult {
                        name: name.clone(),
                        deleted: true,
                        error: None,
                    });
                }
                Err(e) => {
                    total_failed += 1;
                    results.push(BranchDeleteResult {
                        name: name.clone(),
                        deleted: false,
                        error: Some(e),
                    });
                }
            }
        }

        Ok(BatchDeleteResult {
            results,
            total_deleted,
            total_failed,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Get ahead/behind counts for a local branch relative to its upstream.
///
/// Returns `{ ahead: 0, behind: 0 }` when the branch has no upstream tracking branch.
#[tauri::command]
#[specta::specta]
pub async fn get_branch_ahead_behind(
    branch_name: String,
    state: State<'_, RepositoryState>,
) -> Result<AheadBehind, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let local_branch = repo
            .find_branch(&branch_name, git2::BranchType::Local)
            .map_err(|_| GitError::BranchNotFound(branch_name.clone()))?;

        let local_oid = local_branch
            .get()
            .peel_to_commit()
            .map(|c| c.id())
            .map_err(|e| GitError::OperationFailed(e.message().to_string()))?;

        // Try to get the upstream; if none exists, return 0/0
        let upstream = match local_branch.upstream() {
            Ok(up) => up,
            Err(_) => return Ok(AheadBehind { ahead: 0, behind: 0 }),
        };

        let upstream_oid = upstream
            .get()
            .peel_to_commit()
            .map(|c| c.id())
            .map_err(|e| GitError::OperationFailed(e.message().to_string()))?;

        let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;

        Ok(AheadBehind {
            ahead: ahead as u32,
            behind: behind as u32,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gitflow::test_support::{
        commit_file, create_and_checkout, current_branch, init_repo, read_file, write_file,
    };

    /// `main` has `shared.txt` + `readme.txt`; `feature` (one commit ahead) has
    /// a different `readme.txt`, an extra `pay.ts`, and the same `shared.txt`.
    /// Returns the repo with `feature` checked out and a clean tree.
    fn two_branch_repo() -> (tempfile::TempDir, git2::Repository) {
        let (dir, repo) = init_repo();
        commit_file(&repo, "shared.txt", "shared\n", "add shared");
        commit_file(&repo, "readme.txt", "main readme\n", "add readme");
        create_and_checkout(&repo, "feature");
        commit_file(&repo, "readme.txt", "feature readme\n", "feature readme");
        commit_file(&repo, "pay.ts", "export const pay = 1;\n", "feature work");
        assert_eq!(current_branch(&repo), "feature");
        assert_eq!(status_paths(&repo), Vec::new(), "fixture must start clean");
        (dir, repo)
    }

    fn status_paths(repo: &git2::Repository) -> Vec<(String, git2::Status)> {
        let mut opts = git2::StatusOptions::new();
        opts.include_untracked(true).include_ignored(false);
        repo.statuses(Some(&mut opts))
            .unwrap()
            .iter()
            .map(|s| (s.path().unwrap().to_string(), s.status()))
            .collect()
    }

    #[test]
    fn checkout_on_clean_tree_updates_worktree_and_index() {
        let (_dir, repo) = two_branch_repo();

        switch_to_local_branch(&repo, "main").unwrap();

        assert_eq!(current_branch(&repo), "main");
        assert_eq!(read_file(&repo, "readme.txt"), "main readme\n");
        assert!(
            !repo.workdir().unwrap().join("pay.ts").exists(),
            "file only on feature must be removed from the working tree"
        );
        // Index must match main's tree too, i.e. no staged changes.
        assert_eq!(
            status_paths(&repo),
            Vec::new(),
            "git status must be clean after switching branches"
        );

        // And back again.
        switch_to_local_branch(&repo, "feature").unwrap();
        assert_eq!(current_branch(&repo), "feature");
        assert_eq!(read_file(&repo, "readme.txt"), "feature readme\n");
        assert_eq!(read_file(&repo, "pay.ts"), "export const pay = 1;\n");
        assert_eq!(status_paths(&repo), Vec::new());
    }

    #[test]
    fn checkout_with_conflicting_modification_is_refused_and_touches_nothing() {
        let (_dir, repo) = two_branch_repo();
        write_file(&repo, "readme.txt", "local edit\n");
        let before = status_paths(&repo);

        let err = switch_to_local_branch(&repo, "main").unwrap_err();

        match err {
            GitError::CheckoutWouldOverwrite(paths) => {
                assert!(paths.contains("readme.txt"), "got: {paths}")
            }
            other => panic!("expected CheckoutWouldOverwrite, got {other:?}"),
        }
        assert_eq!(current_branch(&repo), "feature", "HEAD must not move");
        assert_eq!(read_file(&repo, "readme.txt"), "local edit\n");
        assert_eq!(read_file(&repo, "pay.ts"), "export const pay = 1;\n");
        assert_eq!(status_paths(&repo), before, "index/worktree must be untouched");
    }

    #[test]
    fn checkout_keeps_non_conflicting_untracked_file() {
        let (_dir, repo) = two_branch_repo();
        write_file(&repo, "notes.txt", "scratch\n");

        switch_to_local_branch(&repo, "main").unwrap();

        assert_eq!(current_branch(&repo), "main");
        assert_eq!(read_file(&repo, "notes.txt"), "scratch\n");
        assert_eq!(read_file(&repo, "readme.txt"), "main readme\n");
        assert_eq!(
            status_paths(&repo),
            vec![("notes.txt".to_string(), git2::Status::WT_NEW)]
        );
    }

    #[test]
    fn checkout_carries_over_non_conflicting_tracked_modification() {
        let (_dir, repo) = two_branch_repo();
        // `shared.txt` is identical on both branches, so an edit to it does
        // not conflict with the switch and must be preserved (git semantics).
        write_file(&repo, "shared.txt", "edited\n");

        switch_to_local_branch(&repo, "main").unwrap();

        assert_eq!(current_branch(&repo), "main");
        assert_eq!(read_file(&repo, "shared.txt"), "edited\n");
        assert_eq!(read_file(&repo, "readme.txt"), "main readme\n");
        assert_eq!(
            status_paths(&repo),
            vec![("shared.txt".to_string(), git2::Status::WT_MODIFIED)]
        );
    }

    #[test]
    fn checkout_unknown_branch_is_branch_not_found() {
        let (_dir, repo) = two_branch_repo();
        assert!(matches!(
            switch_to_local_branch(&repo, "nope"),
            Err(GitError::BranchNotFound(n)) if n == "nope"
        ));
        assert_eq!(current_branch(&repo), "feature");
    }

    #[test]
    fn list_local_branches_reflects_branch_created_and_checked_out_after_listing() {
        let (dir, repo) = init_repo();

        // Baseline listing, as done right after the repository is opened.
        let before = list_local_branches(dir.path()).unwrap();
        assert_eq!(before.len(), 1);
        assert_eq!(before[0].name, "main");
        assert!(before[0].is_head);

        // Simulate a gitflow `start feature` (or an external `git checkout -b`)
        // happening after the first listing: new branch + HEAD moved to it.
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("feature/payments", &head, false).unwrap();
        repo.set_head("refs/heads/feature/payments").unwrap();

        // A new listing must see the new branch and mark it as HEAD.
        let after = list_local_branches(dir.path()).unwrap();
        let names: Vec<&str> = after.iter().map(|b| b.name.as_str()).collect();
        assert_eq!(names, vec!["feature/payments", "main"], "HEAD sorts first");
        assert!(after[0].is_head, "feature/payments is the current branch");
        assert!(!after[1].is_head, "main is no longer HEAD");
        assert_eq!(after[0].is_merged, None, "HEAD branch has no merged flag");
        assert_eq!(after[1].is_merged, Some(true));
    }
}
