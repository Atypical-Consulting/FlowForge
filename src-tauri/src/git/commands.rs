use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::{RepoStatus, RepositoryState};
use crate::git::watcher::{WatcherState, start_watching, stop_watching};

/// Quick health check result for a repository.
/// Used by the welcome screen to show status dots without affecting the active repo.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoHealth {
    pub status: String,
    pub branch_name: String,
    pub ahead: u32,
    pub behind: u32,
    pub is_dirty: bool,
}

/// Open a Git repository at the specified path.
///
/// Validates the path exists and is a git repository,
/// then stores it as the current active repository.
/// Also starts a file watcher to detect external changes.
#[tauri::command]
#[specta::specta]
pub async fn open_repository(
    path: String,
    state: State<'_, RepositoryState>,
    watcher_state: State<'_, Mutex<WatcherState>>,
    app_handle: tauri::AppHandle,
) -> Result<RepoStatus, GitError> {
    let path_buf = PathBuf::from(&path);

    // Validate path exists
    if !path_buf.exists() {
        return Err(GitError::PathNotFound(path_buf.display().to_string()));
    }

    // Open and validate the repository
    let status = state.open(path_buf.clone()).await?;

    // Start watching after successful open
    if let Ok(mut watcher) = watcher_state.lock() {
        let _ = start_watching(&mut watcher, path_buf, app_handle);
    }

    Ok(status)
}

/// Get the current repository status.
///
/// Returns branch name and dirty status for the currently open repository.
#[tauri::command]
#[specta::specta]
pub async fn get_repository_status(
    state: State<'_, RepositoryState>,
) -> Result<RepoStatus, GitError> {
    state.get_status().await
}

/// Check if a path is a valid Git repository.
///
/// Used for drag-drop validation before attempting to open.
#[tauri::command]
#[specta::specta]
pub async fn is_git_repository(path: String) -> Result<bool, GitError> {
    let path = PathBuf::from(path);

    if !path.exists() {
        return Ok(false);
    }

    tokio::task::spawn_blocking(move || match git2::Repository::open(&path) {
        Ok(_) => Ok(true),
        Err(e) if e.code() == git2::ErrorCode::NotFound => Ok(false),
        Err(_) => Ok(false), // Any other error means it's not a valid repo
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Close the current repository.
///
/// Stops the file watcher and clears the stored repository path.
#[tauri::command]
#[specta::specta]
pub async fn close_repository(
    state: State<'_, RepositoryState>,
    watcher_state: State<'_, Mutex<WatcherState>>,
) -> Result<(), GitError> {
    // Stop watcher first
    if let Ok(mut watcher) = watcher_state.lock() {
        stop_watching(&mut watcher);
    }

    state.close().await;
    Ok(())
}

/// Quick health check for a repository by path.
/// Opens a temporary repo handle — does NOT affect the active repository.
/// Returns status (clean/dirty/ahead/behind/diverged/unknown), branch name, and ahead/behind counts.
#[tauri::command]
#[specta::specta]
pub async fn get_repo_health_quick(path: String) -> Result<RepoHealth, GitError> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err(GitError::PathNotFound(path.display().to_string()));
    }

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&path)?;

        // Get current branch name
        let head = match repo.head() {
            Ok(h) => h,
            Err(_) => {
                return Ok(RepoHealth {
                    status: "unknown".to_string(),
                    branch_name: String::new(),
                    ahead: 0,
                    behind: 0,
                    is_dirty: false,
                });
            }
        };
        let branch_name = head.shorthand().unwrap_or("HEAD").to_string();

        // Check dirty status
        let mut opts = git2::StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(false);
        let statuses = repo.statuses(Some(&mut opts))?;
        let is_dirty = !statuses.is_empty();

        // Check ahead/behind (if upstream exists)
        let (ahead, behind) =
            match repo.find_branch(&branch_name, git2::BranchType::Local) {
                Ok(local_branch) => {
                    let local_oid = match local_branch.get().peel_to_commit() {
                        Ok(c) => c.id(),
                        Err(_) => {
                            return Ok(RepoHealth {
                                status: if is_dirty { "dirty" } else { "clean" }.to_string(),
                                branch_name,
                                ahead: 0,
                                behind: 0,
                                is_dirty,
                            });
                        }
                    };
                    match local_branch.upstream() {
                        Ok(upstream) => {
                            let upstream_oid = match upstream.get().peel_to_commit() {
                                Ok(c) => c.id(),
                                Err(_) => {
                                    return Ok(RepoHealth {
                                        status: if is_dirty { "dirty" } else { "clean" }
                                            .to_string(),
                                        branch_name,
                                        ahead: 0,
                                        behind: 0,
                                        is_dirty,
                                    });
                                }
                            };
                            let (a, b) = repo.graph_ahead_behind(local_oid, upstream_oid)?;
                            (a as u32, b as u32)
                        }
                        Err(_) => (0, 0), // No upstream
                    }
                }
                Err(_) => (0, 0),
            };

        // Determine status string
        let status = if ahead > 0 && behind > 0 {
            "diverged"
        } else if ahead > 0 {
            "ahead"
        } else if behind > 0 {
            "behind"
        } else if is_dirty {
            "dirty"
        } else {
            "clean"
        };

        Ok(RepoHealth {
            status: status.to_string(),
            branch_name,
            ahead,
            behind,
            is_dirty,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Open the user's configured terminal at the given path.
/// Spawns the terminal application with platform-specific handling.
#[tauri::command]
#[specta::specta]
pub async fn open_in_terminal(path: String, terminal: String) -> Result<(), GitError> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(GitError::PathNotFound(path_buf.display().to_string()));
    }

    let path_str = path_buf.display().to_string();

    tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        {
            let app_name = match terminal.as_str() {
                "terminal" => "Terminal",
                "iterm2" => "iTerm",
                "warp" => "Warp",
                "alacritty" => "Alacritty",
                "kitty" => "kitty",
                "hyper" => "Hyper",
                other => other,
            };
            std::process::Command::new("open")
                .args(["-a", app_name, &path_str])
                .spawn()
                .map_err(|e| {
                    GitError::OperationFailed(format!(
                        "Failed to open terminal '{}': {}",
                        app_name, e
                    ))
                })?;
        }

        #[cfg(target_os = "windows")]
        {
            match terminal.as_str() {
                "wt" => {
                    std::process::Command::new("wt")
                        .args(["-d", &path_str])
                        .spawn()
                        .map_err(|e| {
                            GitError::OperationFailed(format!(
                                "Failed to open Windows Terminal: {}",
                                e
                            ))
                        })?;
                }
                "powershell" => {
                    std::process::Command::new("powershell")
                        .args([
                            "-NoExit",
                            "-Command",
                            &format!("Set-Location '{}'", path_str),
                        ])
                        .spawn()
                        .map_err(|e| {
                            GitError::OperationFailed(format!(
                                "Failed to open PowerShell: {}",
                                e
                            ))
                        })?;
                }
                "cmd" => {
                    std::process::Command::new("cmd")
                        .args(["/k", &format!("cd /d {}", path_str)])
                        .spawn()
                        .map_err(|e| {
                            GitError::OperationFailed(format!("Failed to open cmd: {}", e))
                        })?;
                }
                other => {
                    std::process::Command::new("cmd")
                        .args(["/c", "start", other, &path_str])
                        .spawn()
                        .map_err(|e| {
                            GitError::OperationFailed(format!(
                                "Failed to open '{}': {}",
                                other, e
                            ))
                        })?;
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            match terminal.as_str() {
                "gnome-terminal" => {
                    std::process::Command::new("gnome-terminal")
                        .args(["--working-directory", &path_str])
                        .spawn()
                        .map_err(|e| {
                            GitError::OperationFailed(format!(
                                "Failed to open gnome-terminal: {}",
                                e
                            ))
                        })?;
                }
                other => {
                    std::process::Command::new(other)
                        .current_dir(&path_str)
                        .spawn()
                        .map_err(|e| {
                            GitError::OperationFailed(format!(
                                "Failed to open '{}': {}",
                                other, e
                            ))
                        })?;
                }
            }
        }

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
