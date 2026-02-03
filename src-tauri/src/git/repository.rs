use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::git::error::GitError;

/// Repository status information sent to frontend.
///
/// This is a lightweight summary - we don't send raw git2 objects
/// across the IPC boundary.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatus {
    /// Current branch name (or short commit hash if detached)
    pub branch_name: String,
    /// Whether the working directory has uncommitted changes
    pub is_dirty: bool,
    /// Absolute path to the repository root
    pub repo_path: String,
    /// Repository display name (folder name)
    pub repo_name: String,
}

/// Application state holding the current repository path.
///
/// CRITICAL: We store the PATH, not the Repository object.
/// git2::Repository cannot be safely shared across threads.
/// Instead, we open a fresh Repository handle for each operation
/// inside spawn_blocking. See PITFALLS.md #3.
pub struct RepositoryState {
    current_path: Arc<Mutex<Option<PathBuf>>>,
}

impl RepositoryState {
    pub fn new() -> Self {
        Self {
            current_path: Arc::new(Mutex::new(None)),
        }
    }

    /// Open repository at path and validate it's a git repo.
    ///
    /// This validates the path, stores it, and returns initial status.
    pub async fn open(&self, path: PathBuf) -> Result<RepoStatus, GitError> {
        // First validate it's a git repository (in blocking task)
        let path_for_validation = path.clone();
        tokio::task::spawn_blocking(move || {
            git2::Repository::open(&path_for_validation).map_err(|e| {
                if e.code() == git2::ErrorCode::NotFound {
                    GitError::NotARepository(path_for_validation.display().to_string())
                } else {
                    GitError::from(e)
                }
            })
        })
        .await
        .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))??;

        // Store the validated path
        {
            let mut current = self.current_path.lock().await;
            *current = Some(path.clone());
        }

        // Return initial status
        self.get_status_internal(&path).await
    }

    /// Get status of current repository.
    pub async fn get_status(&self) -> Result<RepoStatus, GitError> {
        let path = {
            let current = self.current_path.lock().await;
            current
                .clone()
                .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?
        };

        self.get_status_internal(&path).await
    }

    /// Internal status fetch - always runs in spawn_blocking.
    async fn get_status_internal(&self, path: &PathBuf) -> Result<RepoStatus, GitError> {
        let path = path.clone();

        tokio::task::spawn_blocking(move || {
            let repo = git2::Repository::open(&path)?;

            // Get current branch name
            let branch_name = match repo.head() {
                Ok(head) => {
                    if head.is_branch() {
                        head.shorthand().unwrap_or("HEAD").to_string()
                    } else {
                        // Detached HEAD - show short commit hash
                        head.peel_to_commit()
                            .map(|c| format!("{:.7}", c.id()))
                            .unwrap_or_else(|_| "HEAD".to_string())
                    }
                }
                Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                    // Fresh repo with no commits - get default branch name
                    "main".to_string()
                }
                Err(e) => return Err(GitError::from(e)),
            };

            // Check if working directory is dirty
            // Use fast options - don't recurse into untracked directories deeply
            let mut opts = git2::StatusOptions::new();
            opts.include_untracked(true)
                .recurse_untracked_dirs(false)
                .exclude_submodules(true);

            let statuses = repo.statuses(Some(&mut opts))?;
            let is_dirty = !statuses.is_empty();

            // Extract repo name from path
            let repo_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            Ok(RepoStatus {
                branch_name,
                is_dirty,
                repo_path: path.display().to_string(),
                repo_name,
            })
        })
        .await
        .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
    }

    /// Check if a repository is currently open.
    pub async fn is_open(&self) -> bool {
        self.current_path.lock().await.is_some()
    }

    /// Get the current repository path.
    pub async fn get_path(&self) -> Option<PathBuf> {
        self.current_path.lock().await.clone()
    }

    /// Close the current repository.
    pub async fn close(&self) {
        let mut current = self.current_path.lock().await;
        *current = None;
    }
}

impl Default for RepositoryState {
    fn default() -> Self {
        Self::new()
    }
}
