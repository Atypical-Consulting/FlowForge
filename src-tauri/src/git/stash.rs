use git2::StashFlags;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// A stash entry representing saved work.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StashEntry {
    /// 0-based index for stash operations
    pub index: usize,
    /// Stash message
    pub message: String,
    /// Commit OID of the stash
    pub oid: String,
}

/// List all stash entries in the repository.
#[tauri::command]
#[specta::specta]
pub async fn list_stashes(state: State<'_, RepositoryState>) -> Result<Vec<StashEntry>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let mut repo = git2::Repository::open(&repo_path)?;

        let mut stashes = Vec::new();

        repo.stash_foreach(|index, message, oid| {
            stashes.push(StashEntry {
                index,
                message: message.to_string(),
                oid: oid.to_string(),
            });
            true
        })?;

        Ok(stashes)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Save current changes to stash.
#[tauri::command]
#[specta::specta]
pub async fn stash_save(
    message: Option<String>,
    include_untracked: bool,
    state: State<'_, RepositoryState>,
) -> Result<String, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let mut repo = git2::Repository::open(&repo_path)?;

        let signature = repo.signature().map_err(|e| {
            GitError::SignatureError(format!(
                "Could not determine stash author. Please configure git: {}",
                e.message()
            ))
        })?;

        let flags = if include_untracked {
            StashFlags::INCLUDE_UNTRACKED
        } else {
            StashFlags::DEFAULT
        };

        let oid = repo
            .stash_save(&signature, message.as_deref().unwrap_or("WIP"), Some(flags))
            .map_err(|e| {
                if e.message().contains("no local changes to save") {
                    GitError::NothingToStash
                } else {
                    GitError::from(e)
                }
            })?;

        Ok(oid.to_string())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Apply a stash by index without removing it.
#[tauri::command]
#[specta::specta]
pub async fn stash_apply(index: usize, state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let mut repo = git2::Repository::open(&repo_path)?;

        repo.stash_apply(index, None).map_err(|e| {
            if e.message().contains("does not exist") {
                GitError::StashNotFound(index)
            } else {
                GitError::from(e)
            }
        })?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Apply a stash by index and remove it from the stash list.
#[tauri::command]
#[specta::specta]
pub async fn stash_pop(index: usize, state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let mut repo = git2::Repository::open(&repo_path)?;

        repo.stash_pop(index, None).map_err(|e| {
            if e.message().contains("does not exist") {
                GitError::StashNotFound(index)
            } else {
                GitError::from(e)
            }
        })?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Drop a stash by index without applying it.
#[tauri::command]
#[specta::specta]
pub async fn stash_drop(index: usize, state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let mut repo = git2::Repository::open(&repo_path)?;

        repo.stash_drop(index).map_err(|e| {
            if e.message().contains("does not exist") {
                GitError::StashNotFound(index)
            } else {
                GitError::from(e)
            }
        })?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
