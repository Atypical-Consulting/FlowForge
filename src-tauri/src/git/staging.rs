use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Status of a file in the working directory or index.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FileStatus {
    Modified,
    Added,
    Deleted,
    Renamed { old_path: String },
    Untracked,
    Conflicted,
}

/// A single file change with its status and optional diff stats.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    pub status: FileStatus,
    pub additions: Option<i32>,
    pub deletions: Option<i32>,
}

/// Complete staging status showing staged, unstaged, and untracked files.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StagingStatus {
    pub staged: Vec<FileChange>,
    pub unstaged: Vec<FileChange>,
    pub untracked: Vec<FileChange>,
}

/// Get the current staging status of the repository.
///
/// Returns files grouped by staged (in index), unstaged (modified in workdir),
/// and untracked (new files not yet added).
#[tauri::command]
#[specta::specta]
pub async fn get_staging_status(
    state: State<'_, RepositoryState>,
) -> Result<StagingStatus, GitError> {
    let path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&path)?;

        let mut opts = git2::StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .exclude_submodules(true)
            .include_ignored(false);

        let statuses = repo.statuses(Some(&mut opts))?;

        let mut staged = Vec::new();
        let mut unstaged = Vec::new();
        let mut untracked = Vec::new();

        for entry in statuses.iter() {
            let status = entry.status();
            let file_path = entry.path().unwrap_or("").to_string();

            // Check for staged changes (INDEX_*)
            if status.intersects(
                git2::Status::INDEX_NEW
                    | git2::Status::INDEX_MODIFIED
                    | git2::Status::INDEX_DELETED
                    | git2::Status::INDEX_RENAMED
                    | git2::Status::INDEX_TYPECHANGE,
            ) {
                let file_status = if status.contains(git2::Status::INDEX_NEW) {
                    FileStatus::Added
                } else if status.contains(git2::Status::INDEX_DELETED) {
                    FileStatus::Deleted
                } else if status.contains(git2::Status::INDEX_RENAMED) {
                    let old_path = entry
                        .head_to_index()
                        .and_then(|d| d.old_file().path().map(|p| p.to_string_lossy().to_string()))
                        .unwrap_or_default();
                    FileStatus::Renamed { old_path }
                } else {
                    FileStatus::Modified
                };

                staged.push(FileChange {
                    path: file_path.clone(),
                    status: file_status,
                    additions: None,
                    deletions: None,
                });
            }

            // Check for unstaged changes (WT_*)
            if status.intersects(
                git2::Status::WT_MODIFIED
                    | git2::Status::WT_DELETED
                    | git2::Status::WT_TYPECHANGE
                    | git2::Status::WT_RENAMED,
            ) {
                let file_status = if status.contains(git2::Status::WT_DELETED) {
                    FileStatus::Deleted
                } else if status.contains(git2::Status::WT_RENAMED) {
                    let old_path = entry
                        .index_to_workdir()
                        .and_then(|d| d.old_file().path().map(|p| p.to_string_lossy().to_string()))
                        .unwrap_or_default();
                    FileStatus::Renamed { old_path }
                } else {
                    FileStatus::Modified
                };

                unstaged.push(FileChange {
                    path: file_path.clone(),
                    status: file_status,
                    additions: None,
                    deletions: None,
                });
            }

            // Check for untracked files (WT_NEW)
            if status.contains(git2::Status::WT_NEW) {
                untracked.push(FileChange {
                    path: file_path.clone(),
                    status: FileStatus::Untracked,
                    additions: None,
                    deletions: None,
                });
            }

            // Check for conflicted files
            if status.contains(git2::Status::CONFLICTED) {
                unstaged.push(FileChange {
                    path: file_path,
                    status: FileStatus::Conflicted,
                    additions: None,
                    deletions: None,
                });
            }
        }

        Ok(StagingStatus {
            staged,
            unstaged,
            untracked,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Stage a single file for commit.
///
/// The path must be relative to the repository root.
#[tauri::command]
#[specta::specta]
pub async fn stage_file(path: String, state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut index = repo.index()?;

        let file_path = Path::new(&path);

        // Check if file exists in workdir - if not, it's a deletion
        let full_path = repo_path.join(file_path);
        if full_path.exists() {
            index.add_path(file_path)?;
        } else {
            // File was deleted, remove from index
            index.remove_path(file_path)?;
        }

        index.write()?;
        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Unstage a single file (remove from index, keep workdir changes).
///
/// The path must be relative to the repository root.
#[tauri::command]
#[specta::specta]
pub async fn unstage_file(path: String, state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Try to get HEAD commit
        match repo.head() {
            Ok(head_ref) => {
                let head_commit = head_ref.peel_to_commit()?;
                repo.reset_default(Some(&head_commit.into_object()), [Path::new(&path)])?;
            }
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // Fresh repo with no commits - just remove from index
                let mut index = repo.index()?;
                index.remove_path(Path::new(&path))?;
                index.write()?;
            }
            Err(e) => return Err(GitError::from(e)),
        }

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Stage multiple files for commit in a single operation.
///
/// More efficient than calling stage_file repeatedly — performs a single index write.
/// Paths must be relative to the repository root.
#[tauri::command]
#[specta::specta]
pub async fn stage_files(
    paths: Vec<String>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut index = repo.index()?;

        let pathspecs: Vec<&str> = paths.iter().map(|s| s.as_str()).collect();

        // add_all handles new and modified files
        index.add_all(pathspecs.iter(), git2::IndexAddOption::DEFAULT, None)?;

        // update_all handles deleted files
        index.update_all(pathspecs.iter(), None)?;

        index.write()?;
        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Unstage multiple files (remove from index, keep workdir changes).
///
/// More efficient than calling unstage_file repeatedly — performs a single reset.
/// Paths must be relative to the repository root.
#[tauri::command]
#[specta::specta]
pub async fn unstage_files(
    paths: Vec<String>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        match repo.head() {
            Ok(head_ref) => {
                let head_commit = head_ref.peel_to_commit()?;
                let paths_iter = paths.iter().map(|s| Path::new(s.as_str()));
                repo.reset_default(Some(&head_commit.into_object()), paths_iter)?;
            }
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // Fresh repo with no commits — just remove from index
                let mut index = repo.index()?;
                for path in &paths {
                    index.remove_path(Path::new(path))?;
                }
                index.write()?;
            }
            Err(e) => return Err(GitError::from(e)),
        }

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Stage all changed files.
///
/// Adds all modified, deleted, and new files to the index.
#[tauri::command]
#[specta::specta]
pub async fn stage_all(state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut index = repo.index()?;

        // Add all changes including new files
        index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;

        // Also handle deletions - update_all handles deleted files
        index.update_all(["*"].iter(), None)?;

        index.write()?;
        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Unstage all staged files.
///
/// Resets the index to match HEAD, keeping workdir changes.
#[tauri::command]
#[specta::specta]
pub async fn unstage_all(state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Try to get HEAD commit
        match repo.head() {
            Ok(head_ref) => {
                let head_commit = head_ref.peel_to_commit()?;
                // Reset entire index to HEAD (mixed reset)
                repo.reset(&head_commit.into_object(), git2::ResetType::Mixed, None)?;
            }
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // Fresh repo with no commits - clear the index
                let mut index = repo.index()?;
                index.clear()?;
                index.write()?;
            }
            Err(e) => return Err(GitError::from(e)),
        }

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
