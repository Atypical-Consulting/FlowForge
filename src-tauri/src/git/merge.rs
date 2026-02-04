use git2::BranchType;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

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

        // Find source branch and get its commit
        let branch = repo
            .find_branch(&source_branch, BranchType::Local)
            .map_err(|_| GitError::BranchNotFound(source_branch.clone()))?;
        let source_commit = branch.get().peel_to_commit()?;

        // Get annotated commit for merge analysis
        let annotated = repo.find_annotated_commit(source_commit.id())?;

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

        // Handle fast-forward
        if analysis.is_fast_forward() {
            let head = repo.head()?;
            let refname = head
                .name()
                .ok_or_else(|| GitError::Internal("HEAD has no name".to_string()))?;

            // Update reference to point to source commit
            repo.reference(
                refname,
                source_commit.id(),
                true,
                &format!("merge {}: fast-forward", source_branch),
            )?;

            // Update working directory
            repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;

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
            let mut conflicted_files = Vec::new();
            for conflict in index.conflicts()? {
                if let Ok(conflict) = conflict {
                    if let Some(ancestor) = conflict.ancestor {
                        if let Some(path) = std::str::from_utf8(&ancestor.path).ok() {
                            conflicted_files.push(path.to_string());
                        }
                    } else if let Some(our) = conflict.our {
                        if let Some(path) = std::str::from_utf8(&our.path).ok() {
                            conflicted_files.push(path.to_string());
                        }
                    } else if let Some(their) = conflict.their {
                        if let Some(path) = std::str::from_utf8(&their.path).ok() {
                            conflicted_files.push(path.to_string());
                        }
                    }
                }
            }

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
        let head_commit = repo.head()?.peel_to_commit()?;
        let mut index = repo.index()?;
        let tree_oid = index.write_tree()?;
        let tree = repo.find_tree(tree_oid)?;

        let sig = repo.signature().map_err(|e| {
            GitError::SignatureError(format!(
                "Could not determine commit author. Please configure git: {}",
                e.message()
            ))
        })?;

        let message = format!("Merge branch '{}'", source_branch);
        let merge_commit_oid = repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &message,
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
                if let Ok(conflict) = conflict {
                    if let Some(our) = conflict.our {
                        if let Some(path) = std::str::from_utf8(&our.path).ok() {
                            conflicted_files.push(path.to_string());
                        }
                    }
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

        // Clean up merge state
        repo.cleanup_state()?;

        // Reset to HEAD (force to discard merge changes)
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
