//! Git clone operations with progress tracking.
//!
//! Provides repository cloning functionality with real-time progress events
//! sent via Tauri Channels for UI feedback.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::{Path, PathBuf};
use tauri::ipc::Channel;

use crate::git::credentials::create_credentials_callback;
use crate::git::error::GitError;

/// Progress events for clone operations.
///
/// Uses tagged enum serialization for frontend type safety.
#[derive(Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum CloneProgress {
    /// Clone operation started
    Started { url: String },
    /// Receiving objects from remote
    Receiving {
        received: u32,
        total: u32,
        bytes: u32,
    },
    /// Resolving deltas
    Resolving { current: u32, total: u32 },
    /// Checking out files
    Checkout {
        current: u32,
        total: u32,
        path: String,
    },
    /// Clone completed successfully
    Finished { path: String },
}

/// Extract repository name from a Git URL.
///
/// Supports both HTTPS and SSH URL formats:
/// - `https://github.com/user/repo.git` -> `repo`
/// - `git@github.com:user/repo.git` -> `repo`
/// - `https://github.com/user/repo` -> `repo`
fn extract_repo_name(url: &str) -> Option<String> {
    let url = url.trim();

    // Handle SSH format: git@host:user/repo.git
    let path_part = if url.contains('@') && url.contains(':') && !url.contains("://") {
        // SSH format
        url.split(':').last()?
    } else {
        // HTTPS or other URL formats
        url.split('/').last()?
    };

    // Get the repo name (last segment) and strip .git suffix
    let repo_name = path_part
        .split('/')
        .last()
        .unwrap_or(path_part)
        .trim_end_matches(".git");

    if repo_name.is_empty() {
        None
    } else {
        Some(repo_name.to_string())
    }
}

/// Clone a Git repository with progress tracking.
///
/// Clones a repository from a URL to a local destination path,
/// sending progress events through the provided channel.
///
/// # Arguments
/// * `url` - The repository URL (HTTPS or SSH)
/// * `destination` - Local path where the repository will be cloned
/// * `on_progress` - Channel for sending progress events
///
/// # Returns
/// The path to the cloned repository on success
#[tauri::command]
#[specta::specta]
pub async fn clone_repository(
    url: String,
    destination: String,
    on_progress: Channel<CloneProgress>,
) -> Result<String, GitError> {
    // Validate destination is not empty
    if destination.trim().is_empty() {
        return Err(GitError::InvalidPath(
            "Destination path cannot be empty".to_string(),
        ));
    }

    // Validate URL has extractable repo name
    if extract_repo_name(&url).is_none() {
        return Err(GitError::InvalidUrl(url));
    }

    let dest_path = PathBuf::from(&destination);

    // Check if destination exists and is non-empty
    if dest_path.exists() {
        if dest_path.is_dir() {
            let is_empty = dest_path
                .read_dir()
                .map(|mut d| d.next().is_none())
                .unwrap_or(false);

            if !is_empty {
                return Err(GitError::PathExists(destination));
            }
        } else {
            // Destination exists but is a file
            return Err(GitError::PathExists(destination));
        }
    } else {
        // Create parent directories if they don't exist
        if let Some(parent) = dest_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    GitError::OperationFailed(format!("Failed to create parent directories: {}", e))
                })?;
            }
        }
    }

    // Send started event
    on_progress
        .send(CloneProgress::Started { url: url.clone() })
        .ok();

    let url_clone = url.clone();
    let destination_clone = destination.clone();
    let progress_channel = on_progress.clone();

    let result = tokio::task::spawn_blocking(move || {
        let mut callbacks = git2::RemoteCallbacks::new();

        // Transfer progress callback for receiving/resolving phases
        let progress_transfer = progress_channel.clone();
        callbacks.transfer_progress(move |stats| {
            let received = stats.received_objects() as u32;
            let total = stats.total_objects() as u32;
            let indexed = stats.indexed_deltas() as u32;
            let total_deltas = stats.total_deltas() as u32;

            if total_deltas > 0 && indexed > 0 {
                // We're in the resolving deltas phase
                let _ = progress_transfer.send(CloneProgress::Resolving {
                    current: indexed,
                    total: total_deltas,
                });
            } else {
                // We're in the receiving objects phase
                let _ = progress_transfer.send(CloneProgress::Receiving {
                    received,
                    total,
                    bytes: stats.received_bytes() as u32,
                });
            }
            true
        });

        // Set up credentials callback for authentication
        callbacks.credentials(create_credentials_callback());

        // Configure fetch options with our callbacks
        let mut fetch_options = git2::FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        // Configure checkout with progress callback
        let mut checkout_builder = git2::build::CheckoutBuilder::new();
        let progress_checkout = progress_channel.clone();

        checkout_builder.progress(move |path, current, total| {
            let path_str = path
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            let _ = progress_checkout.send(CloneProgress::Checkout {
                current: current as u32,
                total: total as u32,
                path: path_str,
            });
        });

        // Build and execute clone
        let mut builder = git2::build::RepoBuilder::new();
        builder.fetch_options(fetch_options);
        builder.with_checkout(checkout_builder);

        let dest_path = Path::new(&destination_clone);
        builder
            .clone(&url_clone, dest_path)
            .map_err(|e| GitError::CloneFailed(e.message().to_string()))?;

        Ok::<_, GitError>(destination_clone)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))??;

    // Send finished event
    on_progress
        .send(CloneProgress::Finished {
            path: result.clone(),
        })
        .ok();

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_repo_name_https() {
        assert_eq!(
            extract_repo_name("https://github.com/user/repo.git"),
            Some("repo".to_string())
        );
        assert_eq!(
            extract_repo_name("https://github.com/user/repo"),
            Some("repo".to_string())
        );
        assert_eq!(
            extract_repo_name("https://gitlab.com/group/subgroup/repo.git"),
            Some("repo".to_string())
        );
    }

    #[test]
    fn test_extract_repo_name_ssh() {
        assert_eq!(
            extract_repo_name("git@github.com:user/repo.git"),
            Some("repo".to_string())
        );
        assert_eq!(
            extract_repo_name("git@gitlab.com:user/repo"),
            Some("repo".to_string())
        );
    }

    #[test]
    fn test_extract_repo_name_invalid() {
        assert_eq!(extract_repo_name(""), None);
        assert_eq!(extract_repo_name(".git"), None);
    }
}
