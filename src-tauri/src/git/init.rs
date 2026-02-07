//! Git repository initialization.
//!
//! Provides git init functionality with configurable default branch name.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;

use crate::git::error::GitError;

/// Result of a successful git init operation.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct InitResult {
    /// Absolute path to the initialized repository.
    pub repo_path: String,
    /// Name of the initial branch (e.g. "main").
    pub initial_branch: String,
}

/// Initialize a new Git repository at the specified path.
///
/// Validates the path exists and is a directory that is not already a git repository,
/// then creates a new repository with an optional default branch name.
///
/// # Arguments
/// * `path` - Directory where the repository will be initialized
/// * `default_branch` - Optional initial branch name (defaults to "main")
#[tauri::command]
#[specta::specta]
pub async fn git_init(
    path: String,
    default_branch: Option<String>,
) -> Result<InitResult, GitError> {
    let path_buf = PathBuf::from(&path);

    // Validate path exists
    if !path_buf.exists() {
        return Err(GitError::PathNotFound(path_buf.display().to_string()));
    }

    // Validate path is a directory
    if !path_buf.is_dir() {
        return Err(GitError::InvalidPath(format!(
            "Path is not a directory: {}",
            path_buf.display()
        )));
    }

    // Check if already a git repository
    if path_buf.join(".git").exists() {
        return Err(GitError::PathExists(format!(
            "Already a git repository: {}",
            path_buf.display()
        )));
    }

    let branch = default_branch.unwrap_or_else(|| "main".to_string());
    let branch_clone = branch.clone();

    let repo_path = tokio::task::spawn_blocking(move || {
        let mut opts = git2::RepositoryInitOptions::new();
        opts.initial_head(&branch_clone);

        git2::Repository::init_opts(&path_buf, &opts)
            .map_err(|e| GitError::OperationFailed(format!("Failed to initialize repository: {}", e)))?;

        Ok::<_, GitError>(path)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))??;

    Ok(InitResult {
        repo_path,
        initial_branch: branch,
    })
}
