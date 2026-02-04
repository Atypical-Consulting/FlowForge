//! Remote operations: push, pull, fetch with progress streaming.
//!
//! Uses Tauri Channels for real-time progress events.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use tauri::ipc::Channel;
use tauri::State;

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
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub message: String,
    pub commits_transferred: u32,
}

/// Information about a configured remote.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
}

/// Helper to get repository path or return error.
async fn get_repo_path(state: &State<'_, RepositoryState>) -> Result<PathBuf, GitError> {
    state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))
}

/// Create credential callback for git operations.
/// Tries SSH agent first, then credential helper from git config.
fn create_credentials_callback(
) -> impl FnMut(&str, Option<&str>, git2::CredentialType) -> Result<git2::Cred, git2::Error> {
    let mut tried_ssh_key = false;
    let mut tried_cred_helper = false;

    move |url: &str, username: Option<&str>, allowed_types: git2::CredentialType| {
        // Try SSH agent first for SSH URLs
        if allowed_types.contains(git2::CredentialType::SSH_KEY) && !tried_ssh_key {
            tried_ssh_key = true;
            let user = username.unwrap_or("git");
            if let Ok(cred) = git2::Cred::ssh_key_from_agent(user) {
                return Ok(cred);
            }
        }

        // Try credential helper for HTTPS
        if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) && !tried_cred_helper {
            tried_cred_helper = true;
            if let Ok(cfg) = git2::Config::open_default() {
                if let Ok(cred) = git2::Cred::credential_helper(&cfg, url, username) {
                    return Ok(cred);
                }
            }
        }

        // Try default credentials (for local operations)
        if allowed_types.contains(git2::CredentialType::DEFAULT) {
            return git2::Cred::default();
        }

        Err(git2::Error::from_str("no authentication method available"))
    }
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
        for name in remotes.iter().flatten() {
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
    let repo_path = get_repo_path(&state).await?;

    on_progress
        .send(SyncProgress::Started {
            operation: "fetch".to_string(),
        })
        .ok();

    let remote_name = remote.clone();
    let progress_channel = on_progress.clone();
    let result = tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let mut remote_obj = repo
            .find_remote(&remote_name)
            .map_err(|_| GitError::RemoteNotFound(remote_name.clone()))?;

        let mut callbacks = git2::RemoteCallbacks::new();

        // Transfer progress
        let progress_transfer = progress_channel.clone();
        callbacks.transfer_progress(move |stats| {
            let _ = progress_transfer.send(SyncProgress::Transferring {
                current: stats.received_objects() as u32,
                total: stats.total_objects() as u32,
                bytes: stats.received_bytes() as u32,
            });
            true
        });

        // Credentials
        callbacks.credentials(create_credentials_callback());

        let mut opts = git2::FetchOptions::new();
        opts.remote_callbacks(callbacks);

        // Fetch all branches (empty refspec = default)
        remote_obj
            .fetch(&[] as &[&str], Some(&mut opts), None)
            .map_err(|e| {
                if e.class() == git2::ErrorClass::Net {
                    GitError::NetworkError(e.message().to_string())
                } else if e.class() == git2::ErrorClass::Ssh {
                    GitError::AuthenticationFailed(e.message().to_string())
                } else {
                    GitError::OperationFailed(e.message().to_string())
                }
            })?;

        let stats = remote_obj.stats();
        Ok::<_, GitError>(SyncResult {
            success: true,
            message: format!("Fetched from {}", remote_name),
            commits_transferred: stats.received_objects() as u32,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))??;

    on_progress
        .send(SyncProgress::Finished {
            operation: "fetch".to_string(),
        })
        .ok();

    Ok(result)
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
    let repo_path = get_repo_path(&state).await?;

    on_progress
        .send(SyncProgress::Started {
            operation: "push".to_string(),
        })
        .ok();

    let remote_name = remote.clone();
    let progress_channel = on_progress.clone();
    let result = tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let mut remote_obj = repo
            .find_remote(&remote_name)
            .map_err(|_| GitError::RemoteNotFound(remote_name.clone()))?;

        // Get current branch name
        let head = repo.head()?;
        let branch_name = head.shorthand().ok_or_else(|| {
            GitError::OperationFailed("Cannot determine current branch".to_string())
        })?;

        // Build refspec for current branch
        let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

        let mut callbacks = git2::RemoteCallbacks::new();

        // Pack progress
        let progress_pack = progress_channel.clone();
        callbacks.pack_progress(move |stage, current, total| match stage {
            git2::PackBuilderStage::AddingObjects => {
                let _ = progress_pack.send(SyncProgress::Counting {
                    current: current as u32,
                    total: total as u32,
                });
            }
            git2::PackBuilderStage::Deltafication => {
                let _ = progress_pack.send(SyncProgress::Compressing {
                    current: current as u32,
                    total: total as u32,
                });
            }
        });

        // Credentials
        callbacks.credentials(create_credentials_callback());

        let mut opts = git2::PushOptions::new();
        opts.remote_callbacks(callbacks);

        remote_obj.push(&[&refspec], Some(&mut opts)).map_err(|e| {
            if e.class() == git2::ErrorClass::Net {
                GitError::NetworkError(e.message().to_string())
            } else if e.class() == git2::ErrorClass::Ssh {
                GitError::AuthenticationFailed(e.message().to_string())
            } else if e.message().contains("rejected") {
                GitError::PushRejected(e.message().to_string())
            } else {
                GitError::OperationFailed(e.message().to_string())
            }
        })?;

        Ok::<_, GitError>(SyncResult {
            success: true,
            message: format!("Pushed {} to {}", branch_name, remote_name),
            commits_transferred: 0,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))??;

    on_progress
        .send(SyncProgress::Finished {
            operation: "push".to_string(),
        })
        .ok();

    Ok(result)
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
    let repo_path = get_repo_path(&state).await?;

    on_progress
        .send(SyncProgress::Started {
            operation: "pull".to_string(),
        })
        .ok();

    let remote_name = remote.clone();
    let progress_channel = on_progress.clone();
    let result = tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Get current branch name
        let head = repo.head()?;
        let branch_name = head
            .shorthand()
            .ok_or_else(|| {
                GitError::OperationFailed("Cannot determine current branch".to_string())
            })?
            .to_string();

        // Step 1: Fetch
        {
            let mut remote_obj = repo
                .find_remote(&remote_name)
                .map_err(|_| GitError::RemoteNotFound(remote_name.clone()))?;

            let mut callbacks = git2::RemoteCallbacks::new();

            let progress_transfer = progress_channel.clone();
            callbacks.transfer_progress(move |stats| {
                let _ = progress_transfer.send(SyncProgress::Transferring {
                    current: stats.received_objects() as u32,
                    total: stats.total_objects() as u32,
                    bytes: stats.received_bytes() as u32,
                });
                true
            });

            callbacks.credentials(create_credentials_callback());

            let mut opts = git2::FetchOptions::new();
            opts.remote_callbacks(callbacks);

            remote_obj
                .fetch(&[] as &[&str], Some(&mut opts), None)
                .map_err(|e| {
                    if e.class() == git2::ErrorClass::Net {
                        GitError::NetworkError(e.message().to_string())
                    } else if e.class() == git2::ErrorClass::Ssh {
                        GitError::AuthenticationFailed(e.message().to_string())
                    } else {
                        GitError::OperationFailed(e.message().to_string())
                    }
                })?;
        }

        // Step 2: Find the remote tracking branch
        let remote_branch = format!("{}/{}", remote_name, branch_name);
        let fetch_head = repo
            .find_reference(&format!("refs/remotes/{}", remote_branch))
            .map_err(|_| {
                GitError::OperationFailed(format!("No tracking branch found for {}", remote_branch))
            })?;

        let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;

        // Step 3: Merge analysis
        let (analysis, _preference) = repo.merge_analysis(&[&fetch_commit])?;

        if analysis.is_up_to_date() {
            return Ok(SyncResult {
                success: true,
                message: "Already up to date".to_string(),
                commits_transferred: 0,
            });
        }

        if analysis.is_fast_forward() {
            // Fast-forward: just update HEAD
            let refname = format!("refs/heads/{}", branch_name);
            let mut reference = repo.find_reference(&refname)?;
            reference.set_target(fetch_commit.id(), "pull: fast-forward")?;
            repo.set_head(&refname)?;
            repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;

            return Ok(SyncResult {
                success: true,
                message: format!("Fast-forwarded {} to {}", branch_name, remote_name),
                commits_transferred: 1,
            });
        }

        if analysis.is_normal() {
            // Normal merge required - attempt it
            repo.merge(&[&fetch_commit], None, None)?;

            // Check for conflicts
            let index = repo.index()?;
            if index.has_conflicts() {
                return Ok(SyncResult {
                    success: false,
                    message:
                        "Merge conflicts detected. Please resolve conflicts and commit manually."
                            .to_string(),
                    commits_transferred: 0,
                });
            }

            // No conflicts - but we don't auto-commit
            // User should review and commit the merge
            return Ok(SyncResult {
                success: true,
                message: "Merged successfully. Please review and commit the merge.".to_string(),
                commits_transferred: 1,
            });
        }

        // Unborn or other edge case
        Err(GitError::OperationFailed(
            "Cannot merge: unhandled merge scenario".to_string(),
        ))
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))??;

    on_progress
        .send(SyncProgress::Finished {
            operation: "pull".to_string(),
        })
        .ok();

    Ok(result)
}
