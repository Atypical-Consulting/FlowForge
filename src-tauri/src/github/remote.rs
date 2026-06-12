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

    // Match the host case-insensitively while preserving the original case
    // of the owner/repo path. We locate the prefix on the lowercased copy and
    // then slice the same byte range from the original `url`.
    const PREFIXES: [&str; 4] = [
        "https://github.com/",
        "http://github.com/",
        "ssh://git@github.com/",
        "git@github.com:",
    ];

    let path = PREFIXES
        .iter()
        .find_map(|prefix| normalized.strip_prefix(prefix).map(|_| &url[prefix.len()..]))?;

    // Trim a trailing slash first (covers `.../repo.git/`), then remove
    // exactly one `.git` suffix (strip_suffix avoids trim_end_matches'
    // repeated-pattern removal on names like `repo.git.git`).
    let clean = path.trim_end_matches('/');
    let clean = clean.strip_suffix(".git").unwrap_or(clean);
    let (owner, repo) = clean.split_once('/')?;

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

        for name in remotes.iter().filter_map(|n| n.ok().flatten()) {
            if let Ok(remote) = repo.find_remote(name)
                && let Ok(url) = remote.url()
                    && let Some((owner, repo_name)) = parse_github_url(url) {
                        github_remotes.push(GitHubRemoteInfo {
                            remote_name: name.to_string(),
                            owner,
                            repo: repo_name,
                            url: url.to_string(),
                        });
                    }
        }

        Ok(github_remotes)
    })
    .await
    .map_err(|e| GitHubError::Internal(format!("Task join error: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::parse_github_url;

    #[test]
    fn parses_common_formats() {
        let expected = Some(("owner".to_string(), "repo".to_string()));
        assert_eq!(parse_github_url("https://github.com/owner/repo.git"), expected);
        assert_eq!(parse_github_url("https://github.com/owner/repo"), expected);
        assert_eq!(parse_github_url("http://github.com/owner/repo.git"), expected);
        assert_eq!(parse_github_url("ssh://git@github.com/owner/repo.git"), expected);
        assert_eq!(parse_github_url("git@github.com:owner/repo.git"), expected);
    }

    #[test]
    fn host_is_case_insensitive_but_path_preserves_case() {
        let expected = Some(("Owner".to_string(), "Repo".to_string()));
        assert_eq!(parse_github_url("https://GITHUB.COM/Owner/Repo.git"), expected);
        assert_eq!(parse_github_url("https://Github.com/Owner/Repo.git"), expected);
        assert_eq!(parse_github_url("git@Github.com:Owner/Repo.git"), expected);
        assert_eq!(parse_github_url("SSH://git@GitHub.com/Owner/Repo.git"), expected);
    }

    #[test]
    fn handles_trailing_slash() {
        let expected = Some(("owner".to_string(), "repo".to_string()));
        assert_eq!(parse_github_url("https://github.com/owner/repo.git/"), expected);
        assert_eq!(parse_github_url("https://github.com/owner/repo/"), expected);
    }

    #[test]
    fn strips_only_one_git_suffix() {
        assert_eq!(
            parse_github_url("https://github.com/owner/repo.git.git"),
            Some(("owner".to_string(), "repo.git".to_string()))
        );
    }

    #[test]
    fn rejects_non_github_and_malformed() {
        assert_eq!(parse_github_url("https://gitlab.com/owner/repo.git"), None);
        assert_eq!(parse_github_url("https://github.com/owner"), None);
        assert_eq!(parse_github_url("https://github.com//repo.git"), None);
    }
}
