use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::{RepoStatus, RepositoryState};
use crate::git::watcher::{WatcherState, start_watching, stop_watching};

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
