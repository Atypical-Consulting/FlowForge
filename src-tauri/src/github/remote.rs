//! GitHub remote URL detection and parsing.
//!
//! Detects GitHub remotes in the current repository by parsing
//! git remote URLs in both HTTPS and SSH formats.

use tauri::State;

use crate::git::RepositoryState;

use super::error::GitHubError;
use super::types::GitHubRemoteInfo;

/// Parse a git remote URL to extract GitHub owner and repo.
///
/// Handles the following formats:
/// - HTTPS: `https://github.com/owner/repo.git`
/// - HTTP: `http://github.com/owner/repo.git`
/// - SSH (git@): `git@github.com:owner/repo.git`
/// - SSH (protocol): `ssh://git@github.com/owner/repo.git`
///
/// Case-insensitive check for "github.com" but preserves
/// original case in owner/repo names.
pub fn parse_github_url(url: &str) -> Option<(String, String)> {
    let normalized = url.to_lowercase();
    if !normalized.contains("github.com") {
        return None;
    }

    let path = url
        .strip_prefix("https://github.com/")
        .or_else(|| url.strip_prefix("https://GitHub.com/"))
        .or_else(|| url.strip_prefix("http://github.com/"))
        .or_else(|| url.strip_prefix("http://GitHub.com/"))
        .or_else(|| url.strip_prefix("ssh://git@github.com/"))
        .or_else(|| url.strip_prefix("ssh://git@GitHub.com/"))
        .or_else(|| url.strip_prefix("git@github.com:"))
        .or_else(|| url.strip_prefix("git@GitHub.com:"))?;

    let clean = path.trim_end_matches(".git").trim_end_matches('/');
    let mut parts = clean.splitn(2, '/');
    let owner = parts.next()?;
    let repo = parts.next()?;

    if owner.is_empty() || repo.is_empty() {
        return None;
    }

    Some((owner.to_string(), repo.to_string()))
}

/// Detect all GitHub remotes in the currently open repository.
///
/// Opens the git repository from RepositoryState (same pattern as
/// existing git commands) and iterates all remotes, parsing each
/// URL to find GitHub repositories.
#[tauri::command]
#[specta::specta]
pub async fn github_detect_remotes(
    state: State<'_, RepositoryState>,
) -> Result<Vec<GitHubRemoteInfo>, GitHubError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitHubError::Internal("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)
            .map_err(|e| GitHubError::Internal(format!("Failed to open repo: {}", e)))?;

        let remotes = repo
            .remotes()
            .map_err(|e| GitHubError::Internal(format!("Failed to list remotes: {}", e)))?;

        let mut github_remotes = Vec::new();

        for name in remotes.iter().flatten() {
            if let Ok(remote) = repo.find_remote(name) {
                if let Some(url) = remote.url() {
                    if let Some((owner, repo_name)) = parse_github_url(url) {
                        github_remotes.push(GitHubRemoteInfo {
                            remote_name: name.to_string(),
                            owner,
                            repo: repo_name,
                            url: url.to_string(),
                        });
                    }
                }
            }
        }

        Ok(github_remotes)
    })
    .await
    .map_err(|e| GitHubError::Internal(format!("Task join error: {}", e)))?
}
