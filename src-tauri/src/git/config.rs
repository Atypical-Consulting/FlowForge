//! Git global configuration access.
//!
//! Provides read/write access to the user's global git configuration
//! (user.name, user.email, init.defaultBranch).

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::git::error::GitError;

/// Snapshot of relevant global git configuration values.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitGlobalConfig {
    /// user.name from global config, or None if unset.
    pub user_name: Option<String>,
    /// user.email from global config, or None if unset.
    pub user_email: Option<String>,
    /// init.defaultBranch from global config, or None if unset.
    pub default_branch: Option<String>,
}

/// Read the user's global git configuration.
///
/// Returns None for any value that is not set. Never errors —
/// if the config file cannot be opened, all fields are None.
#[tauri::command]
#[specta::specta]
pub async fn get_git_global_config() -> Result<GitGlobalConfig, GitError> {
    tokio::task::spawn_blocking(|| {
        let cfg = match git2::Config::open_default() {
            Ok(c) => c,
            Err(_) => {
                return Ok(GitGlobalConfig {
                    user_name: None,
                    user_email: None,
                    default_branch: None,
                });
            }
        };

        let user_name = cfg.get_string("user.name").ok();
        let user_email = cfg.get_string("user.email").ok();
        let default_branch = cfg.get_string("init.defaultBranch").ok();

        Ok(GitGlobalConfig {
            user_name,
            user_email,
            default_branch,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Set a value in the user's global git configuration.
///
/// # Arguments
/// * `key` - The config key (e.g. "user.name", "user.email", "init.defaultBranch")
/// * `value` - The value to set
#[tauri::command]
#[specta::specta]
pub async fn set_git_global_config(key: String, value: String) -> Result<(), GitError> {
    tokio::task::spawn_blocking(move || {
        let mut cfg = git2::Config::open_default()
            .map_err(|e| GitError::OperationFailed(format!("Failed to open git config: {}", e)))?;

        let mut global = cfg
            .open_level(git2::ConfigLevel::Global)
            .map_err(|e| GitError::OperationFailed(format!("Failed to open global config: {}", e)))?;

        global
            .set_str(&key, &value)
            .map_err(|e| GitError::OperationFailed(format!("Failed to set config {}: {}", key, e)))?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
