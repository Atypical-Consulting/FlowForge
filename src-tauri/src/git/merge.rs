use git2::BranchType;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::git::commit::conflicted_paths;
use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Result of merge analysis.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum MergeAnalysisResult {
    /// Already merged, nothing to do
    UpToDate,
    /// Can fast-forward without merge commit
    FastForward,
    /// Requires merge commit
    Normal,
    /// HEAD doesn't exist yet
    Unborn,
}

/// Result of a merge operation.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MergeResult {
    /// Whether the merge was successful
    pub success: bool,
    /// Analysis result (what type of merge was performed)
    pub analysis: MergeAnalysisResult,
    /// OID of merge commit (if created)
    pub commit_oid: Option<String>,
    /// True if fast-forward was used
    pub fast_forwarded: bool,
    /// True if conflicts remain
    pub has_conflicts: bool,
    /// List of conflicted file paths
    pub conflicted_files: Vec<String>,
}

/// Status of an in-progress merge.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MergeStatus {
    /// Whether a merge is currently in progress
    pub in_progress: bool,
    /// List of conflicted file paths
    pub conflicted_files: Vec<String>,
}

/// Subject line `git merge` would use for merging `source_ref` (a full
/// reference name, e.g. `refs/heads/topic`) into `target_branch`.
///
/// Mirrors `git fmt-merge-msg`: local branches become `branch 'x'`,
/// remote-tracking branches `remote-tracking branch 'origin/x'`, tags
/// `tag 'x'` and anything else `commit '<oid>'`. Like git (default
/// `merge.suppressDest=master`), ` into <branch>` is omitted only when the
/// target branch is `master`.
pub(crate) fn merge_commit_subject(
    source_ref: &str,
    source_oid: git2::Oid,
    target_branch: &str,
) -> String {
    let source = if let Some(name) = source_ref.strip_prefix("refs/heads/") {
        format!("branch '{name}'")
    } else if let Some(name) = source_ref.strip_prefix("refs/remotes/") {
        format!("remote-tracking branch '{name}'")
    } else if let Some(name) = source_ref.strip_prefix("refs/tags/") {
        format!("tag '{name}'")
    } else {
        format!("commit '{source_oid}'")
    };
    if target_branch == "master" {
        format!("Merge {source}")
    } else {
        format!("Merge {source} into {target_branch}")
    }
}

/// Full `.git/MERGE_MSG` contents git prepares when a merge stops on
/// conflicts: the subject, a blank line, then a `# Conflicts:` comment block
/// listing each conflicted path on a `#\t<path>` line.
pub(crate) fn merge_message_with_conflicts(subject: &str, conflicted_files: &[String]) -> String {
    let mut msg = format!("{subject}\n");
    if !conflicted_files.is_empty() {
        msg.push_str("\n# Conflicts:\n");
        for path in conflicted_files {
            msg.push_str(&format!("#\t{path}\n"));
        }
    }
    msg
}

/// Resolve `name` as a local branch, falling back to a remote-tracking branch
/// (`origin/topic`) so both can be merged.
fn find_source_branch<'r>(
    repo: &'r git2::Repository,
    name: &str,
) -> Result<git2::Branch<'r>, GitError> {
    repo.find_branch(name, BranchType::Local)
        .or_else(|_| repo.find_branch(name, BranchType::Remote))
        .map_err(|_| GitError::BranchNotFound(name.to_string()))
}

/// Synchronous core of [`merge_branch`], operating on an open repository.
pub(crate) fn merge_branch_in_repo(
    repo: &git2::Repository,
    source_branch: &str,
) -> Result<MergeResult, GitError> {
    // Find source branch and get its commit
    let branch = find_source_branch(repo, source_branch)?;
    let source_commit = branch.get().peel_to_commit()?;
    let source_ref = branch.get().name()?.to_string();

    // Build the annotated commit from the *reference* (not the oid) so libgit2
    // records the branch name in the merge state, exactly like `git merge x`.
    let annotated = repo.reference_to_annotated_commit(branch.get())?;

    // Run merge analysis
    let (analysis, _preference) = repo.merge_analysis(&[&annotated])?;

    // Handle up-to-date case
    if analysis.is_up_to_date() {
        return Ok(MergeResult {
            success: true,
            analysis: MergeAnalysisResult::UpToDate,
            commit_oid: None,
            fast_forwarded: false,
            has_conflicts: false,
            conflicted_files: vec![],
        });
    }

    // Handle unborn HEAD
    if analysis.is_unborn() {
        return Ok(MergeResult {
            success: false,
            analysis: MergeAnalysisResult::Unborn,
            commit_oid: None,
            fast_forwarded: false,
            has_conflicts: false,
            conflicted_files: vec![],
        });
    }

    let head = repo.head()?;
    let target_branch = head.shorthand().unwrap_or("HEAD").to_string();
    let subject = merge_commit_subject(&source_ref, source_commit.id(), &target_branch);

    // Handle fast-forward
    if analysis.is_fast_forward() {
        let refname = head.name()?;

        // Update the working directory first using a SAFE checkout so that
        // uncommitted local changes are not silently discarded. A safe
        // checkout fails (rather than overwriting) if the FF target would
        // clobber dirty files, matching `git merge`'s refusal to fast-forward
        // over local changes. Doing this before moving the ref also ensures
        // HEAD is not left advanced on a dirty working tree.
        let target_tree = source_commit.tree()?;
        repo.checkout_tree(
            target_tree.as_object(),
            Some(git2::build::CheckoutBuilder::new().safe()),
        )
        .map_err(|e| {
            if e.message().contains("conflict") || e.message().contains("overwrite") {
                GitError::DirtyWorkingDirectory
            } else {
                GitError::from(e)
            }
        })?;

        // Update reference to point to source commit
        repo.reference(
            refname,
            source_commit.id(),
            true,
            &format!("merge {}: fast-forward", source_branch),
        )?;

        return Ok(MergeResult {
            success: true,
            analysis: MergeAnalysisResult::FastForward,
            commit_oid: Some(source_commit.id().to_string()),
            fast_forwarded: true,
            has_conflicts: false,
            conflicted_files: vec![],
        });
    }

    // Normal merge
    repo.merge(&[&annotated], None, None)?;

    // Check for conflicts
    let index = repo.index()?;
    if index.has_conflicts() {
        let conflicted_files = conflicted_paths(&index)?;

        // libgit2 writes MERGE_MSG as "Merge branch 'x'" without git's
        // " into <target>" part; rewrite it the way git does so the commit
        // form prefill and the eventual merge commit read like git's.
        std::fs::write(
            repo.path().join("MERGE_MSG"),
            merge_message_with_conflicts(&subject, &conflicted_files),
        )
        .map_err(|e| GitError::Internal(format!("could not write MERGE_MSG: {e}")))?;

        return Ok(MergeResult {
            success: false,
            analysis: MergeAnalysisResult::Normal,
            commit_oid: None,
            fast_forwarded: false,
            has_conflicts: true,
            conflicted_files,
        });
    }

    // No conflicts - create merge commit
    let head_commit = head.peel_to_commit()?;
    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;

    let sig = repo.signature().map_err(|e| {
        GitError::SignatureError(format!(
            "Could not determine commit author. Please configure git: {}",
            e.message()
        ))
    })?;

    let merge_commit_oid = repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &subject,
        &tree,
        &[&head_commit, &source_commit],
    )?;

    // Clean up merge state
    repo.cleanup_state()?;

    Ok(MergeResult {
        success: true,
        analysis: MergeAnalysisResult::Normal,
        commit_oid: Some(merge_commit_oid.to_string()),
        fast_forwarded: false,
        has_conflicts: false,
        conflicted_files: vec![],
    })
}

/// Merge a source branch into the current branch.
#[tauri::command]
#[specta::specta]
pub async fn merge_branch(
    source_branch: String,
    state: State<'_, RepositoryState>,
) -> Result<MergeResult, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        merge_branch_in_repo(&repo, &source_branch)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Get the status of an in-progress merge.
#[tauri::command]
#[specta::specta]
pub async fn get_merge_status(state: State<'_, RepositoryState>) -> Result<MergeStatus, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let in_progress = repo.state() == git2::RepositoryState::Merge;

        let mut conflicted_files = Vec::new();
        if in_progress {
            let index = repo.index()?;
            for conflict in index.conflicts()? {
                if let Ok(conflict) = conflict
                    && let Some(our) = conflict.our
                        && let Ok(path) = std::str::from_utf8(&our.path) {
                            conflicted_files.push(path.to_string());
                        }
            }
        }

        Ok(MergeStatus {
            in_progress,
            conflicted_files,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Abort an in-progress merge.
#[tauri::command]
#[specta::specta]
pub async fn abort_merge(state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Check if merge is in progress
        if repo.state() != git2::RepositoryState::Merge {
            return Err(GitError::NoMergeInProgress);
        }

        // Hard-reset to HEAD to restore both the index and working tree,
        // discarding merge-produced staged changes and conflict-stage entries.
        // A force checkout_head alone does not reset the index, so leftover
        // staged/conflict entries would remain. This matches `git merge --abort`.
        let head_commit = repo.head()?.peel_to_commit()?;
        repo.reset(head_commit.as_object(), git2::ResetType::Hard, None)?;

        // Clean up merge state (MERGE_HEAD, MERGE_MSG, etc.)
        repo.cleanup_state()?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gitflow::test_support::{checkout, commit_file, create_and_checkout, init_repo};

    /// `main` and `topic` both edit `shared.txt` (conflict) on top of a shared base.
    fn diverge_with_conflict(repo: &git2::Repository) {
        commit_file(repo, "shared.txt", "base\n", "base");
        create_and_checkout(repo, "topic");
        commit_file(repo, "shared.txt", "topic\n", "topic edit");
        checkout(repo, "main");
        commit_file(repo, "shared.txt", "main\n", "main edit");
    }

    /// `main` and `topic` touch different files, so they merge cleanly.
    fn diverge_cleanly(repo: &git2::Repository) {
        create_and_checkout(repo, "topic");
        commit_file(repo, "topic.txt", "topic\n", "topic edit");
        checkout(repo, "main");
        commit_file(repo, "main.txt", "main\n", "main edit");
    }

    fn merge_msg(repo: &git2::Repository) -> String {
        std::fs::read_to_string(repo.path().join("MERGE_MSG")).unwrap()
    }

    fn merge_commit<'r>(repo: &'r git2::Repository, result: &MergeResult) -> git2::Commit<'r> {
        let oid = git2::Oid::from_str(result.commit_oid.as_deref().unwrap()).unwrap();
        repo.find_commit(oid).unwrap()
    }

    #[test]
    fn conflicted_merge_writes_git_style_merge_msg_with_conflicts_block() {
        let (_dir, repo) = init_repo();
        diverge_with_conflict(&repo);

        let result = merge_branch_in_repo(&repo, "topic").unwrap();

        assert!(result.has_conflicts);
        assert_eq!(result.conflicted_files, vec!["shared.txt".to_string()]);
        assert_eq!(repo.state(), git2::RepositoryState::Merge);
        assert_eq!(
            merge_msg(&repo),
            "Merge branch 'topic' into main\n\n# Conflicts:\n#\tshared.txt\n"
        );
        assert_eq!(
            crate::git::repository::merge_message(&repo).as_deref(),
            Some("Merge branch 'topic' into main\n\n# Conflicts:\n#\tshared.txt")
        );
    }

    #[test]
    fn clean_merge_commits_with_git_style_subject() {
        let (_dir, repo) = init_repo();
        diverge_cleanly(&repo);

        let result = merge_branch_in_repo(&repo, "topic").unwrap();

        assert!(result.success);
        assert!(!result.fast_forwarded);
        let commit = merge_commit(&repo, &result);
        assert_eq!(commit.message().unwrap(), "Merge branch 'topic' into main");
        assert_eq!(commit.parent_count(), 2);
        assert_eq!(repo.state(), git2::RepositoryState::Clean);
        assert!(!repo.path().join("MERGE_MSG").exists());
    }

    #[test]
    fn merge_into_master_omits_the_into_part_like_git() {
        // git's default `merge.suppressDest=master` drops " into master".
        let (_dir, repo) = init_repo();
        diverge_cleanly(&repo);
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("master", &head, false).unwrap();
        checkout(&repo, "master");

        let result = merge_branch_in_repo(&repo, "topic").unwrap();

        assert_eq!(
            merge_commit(&repo, &result).message().unwrap(),
            "Merge branch 'topic'"
        );
    }

    #[test]
    fn remote_tracking_source_uses_git_wording() {
        let (_dir, repo) = init_repo();
        diverge_cleanly(&repo);
        // Turn `topic` into a remote-tracking branch `origin/topic`.
        let topic_oid = repo.refname_to_id("refs/heads/topic").unwrap();
        repo.reference("refs/remotes/origin/topic", topic_oid, false, "fake fetch")
            .unwrap();
        repo.find_branch("topic", BranchType::Local)
            .unwrap()
            .delete()
            .unwrap();

        let result = merge_branch_in_repo(&repo, "origin/topic").unwrap();

        assert_eq!(
            merge_commit(&repo, &result).message().unwrap(),
            "Merge remote-tracking branch 'origin/topic' into main"
        );
    }

    #[test]
    fn unknown_branch_is_reported() {
        let (_dir, repo) = init_repo();
        let err = merge_branch_in_repo(&repo, "nope").unwrap_err();
        assert!(
            matches!(err, GitError::BranchNotFound(ref b) if b == "nope"),
            "got {err:?}"
        );
    }

    #[test]
    fn merge_commit_subject_covers_tags_and_bare_commits() {
        let oid = git2::Oid::from_str("585521ce585521ce585521ce585521ce585521ce").unwrap();
        assert_eq!(
            merge_commit_subject("refs/tags/v1", oid, "develop"),
            "Merge tag 'v1' into develop"
        );
        assert_eq!(
            merge_commit_subject("HEAD", oid, "develop"),
            format!("Merge commit '{oid}' into develop")
        );
        assert_eq!(
            merge_message_with_conflicts("Merge branch 'a' into b", &[]),
            "Merge branch 'a' into b\n"
        );
    }
}
