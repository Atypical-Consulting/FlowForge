use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Information about what can be undone
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UndoInfo {
    /// Whether undo is available
    pub can_undo: bool,
    /// Description of what will be undone
    pub description: Option<String>,
    /// The reflog entry message
    pub reflog_message: Option<String>,
    /// The commit OID to revert to
    pub target_oid: Option<String>,
}

/// Get information about what can be undone.
/// Looks at HEAD reflog to find the previous state.
#[tauri::command]
#[specta::specta]
pub async fn get_undo_info(state: State<'_, RepositoryState>) -> Result<UndoInfo, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Get HEAD reflog
        let reflog = match repo.reflog("HEAD") {
            Ok(r) => r,
            Err(_) => {
                return Ok(UndoInfo {
                    can_undo: false,
                    description: None,
                    reflog_message: None,
                    target_oid: None,
                });
            }
        };

        // Need at least 2 entries to undo (current + previous)
        if reflog.len() < 2 {
            return Ok(UndoInfo {
                can_undo: false,
                description: None,
                reflog_message: None,
                target_oid: None,
            });
        }

        // Entry 0 is current state, entry 1 is previous state
        let current = reflog.get(0);
        let previous = reflog.get(1);

        match (current, previous) {
            (Some(curr), Some(prev)) => {
                let curr_msg = curr.message().unwrap_or("").to_string();
                let prev_oid = prev.id_new().to_string();

                // Parse the reflog message to create a human-readable description
                let description = parse_undo_description(&curr_msg);

                Ok(UndoInfo {
                    can_undo: true,
                    description: Some(description),
                    reflog_message: Some(curr_msg),
                    target_oid: Some(prev_oid),
                })
            }
            _ => Ok(UndoInfo {
                can_undo: false,
                description: None,
                reflog_message: None,
                target_oid: None,
            }),
        }
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Undo the last operation by resetting HEAD to the previous reflog entry.
#[tauri::command]
#[specta::specta]
pub async fn undo_last_operation(state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Get the target from reflog
        let reflog = repo.reflog("HEAD")?;

        if reflog.len() < 2 {
            return Err(GitError::OperationFailed("Nothing to undo".to_string()));
        }

        let previous = reflog.get(1).ok_or_else(|| {
            GitError::OperationFailed("Could not find previous state".to_string())
        })?;

        let target_oid = previous.id_new();
        let target_commit = repo.find_commit(target_oid)?;

        // Reset to the previous state (mixed reset - keeps working directory changes)
        repo.reset(target_commit.as_object(), git2::ResetType::Mixed, None)?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Parse reflog message into human-readable description
fn parse_undo_description(msg: &str) -> String {
    if msg.starts_with("commit:") {
        format!("Undo commit: {}", msg.trim_start_matches("commit:").trim())
    } else if msg.starts_with("commit (amend):") {
        "Undo amend commit".to_string()
    } else if msg.starts_with("reset:") {
        "Undo reset".to_string()
    } else if msg.starts_with("checkout:") {
        "Undo checkout".to_string()
    } else if msg.starts_with("merge") {
        "Undo merge".to_string()
    } else if msg.starts_with("rebase") {
        "Undo rebase".to_string()
    } else if msg.starts_with("pull:") {
        "Undo pull".to_string()
    } else {
        format!("Undo: {}", msg)
    }
}
