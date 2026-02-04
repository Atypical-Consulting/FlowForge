use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Information about a local branch.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    /// Branch name (e.g., "main", "feature/login")
    pub name: String,
    /// True if this is the currently checked out branch
    pub is_head: bool,
    /// Short OID of the branch tip commit (7 chars)
    pub last_commit_oid: String,
    /// Summary line of the tip commit
    pub last_commit_message: String,
    /// Whether branch is merged into HEAD (None if IS head)
    pub is_merged: Option<bool>,
}

/// List all local branches in the repository.
#[tauri::command]
#[specta::specta]
pub async fn list_branches(state: State<'_, RepositoryState>) -> Result<Vec<BranchInfo>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

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
            let last_commit_message = commit.summary().unwrap_or("").to_string();

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
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
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
            repo.set_head(&format!("refs/heads/{}", name))?;
            repo.checkout_head(Some(git2::build::CheckoutBuilder::new().safe()))?;
        }

        let commit = branch.get().peel_to_commit()?;

        Ok(BranchInfo {
            name: name.clone(),
            is_head: checkout,
            last_commit_oid: format!("{:.7}", commit.id()),
            last_commit_message: commit.summary().unwrap_or("").to_string(),
            is_merged: if checkout { None } else { Some(true) },
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

        // Check if branch exists
        repo.find_branch(&branch_name, git2::BranchType::Local)
            .map_err(|_| GitError::BranchNotFound(branch_name.clone()))?;

        // Two-step checkout process
        repo.set_head(&format!("refs/heads/{}", branch_name))?;

        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().safe()))
            .map_err(|e| {
                if e.message().contains("conflict") || e.message().contains("overwrite") {
                    GitError::DirtyWorkingDirectory
                } else {
                    GitError::from(e)
                }
            })?;

        Ok(())
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
