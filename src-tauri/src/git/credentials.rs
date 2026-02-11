//! Shared credential handling for git operations.
//!
//! Provides a credential callback that tries multiple authentication methods:
//! SSH agent, git2 credential helper, and a `git credential fill` subprocess fallback.

use std::io::Write;
use std::process::{Command, Stdio};

/// Create credential callback for git operations (push, pull, fetch, clone).
///
/// Tries in order:
/// 1. SSH agent (for SSH URLs)
/// 2. git2 built-in credential helper
/// 3. `git credential fill` subprocess (works with osxkeychain, gh, etc.)
/// 4. Default credentials (for local operations)
pub fn create_credentials_callback(
) -> impl FnMut(&str, Option<&str>, git2::CredentialType) -> Result<git2::Cred, git2::Error> {
    let mut tried_ssh_key = false;
    let mut tried_cred_helper = false;
    let mut tried_git_credential = false;

    move |url: &str, username: Option<&str>, allowed_types: git2::CredentialType| {
        // Try SSH agent first for SSH URLs
        if allowed_types.contains(git2::CredentialType::SSH_KEY) && !tried_ssh_key {
            tried_ssh_key = true;
            let user = username.unwrap_or("git");
            if let Ok(cred) = git2::Cred::ssh_key_from_agent(user) {
                return Ok(cred);
            }
        }

        // Try credential helper from git config
        if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) && !tried_cred_helper {
            tried_cred_helper = true;
            if let Ok(cfg) = git2::Config::open_default() {
                if let Ok(cred) = git2::Cred::credential_helper(&cfg, url, username) {
                    return Ok(cred);
                }
            }
        }

        // Fallback: shell out to `git credential fill`
        // This works with all credential helpers (osxkeychain, gh auth, credential-store, etc.)
        if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT)
            && !tried_git_credential
        {
            tried_git_credential = true;
            if let Some((user, pass)) = git_credential_fill(url) {
                return git2::Cred::userpass_plaintext(&user, &pass);
            }
        }

        // Try default credentials (for local operations)
        if allowed_types.contains(git2::CredentialType::DEFAULT) {
            return git2::Cred::default();
        }

        Err(git2::Error::from_str("no authentication method available"))
    }
}

/// Shell out to `git credential fill` to obtain credentials.
///
/// This invokes git's own credential subsystem which respects all configured
/// credential helpers (osxkeychain, gh auth git-credential, credential-store, etc.).
/// This is more reliable than git2's built-in credential_helper, especially
/// inside sandboxed apps (like Tauri) where the environment may differ from a terminal.
fn git_credential_fill(url: &str) -> Option<(String, String)> {
    // Parse protocol and host from the URL
    // Expected format: https://github.com/... or git@github.com:...
    let (protocol, host) = parse_url_parts(url)?;

    let input = format!("protocol={}\nhost={}\n\n", protocol, host);

    let mut child = Command::new("git")
        .args(["credential", "fill"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;

    // Write the credential request to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input.as_bytes()).ok()?;
    }

    let output = child.wait_with_output().ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8(output.stdout).ok()?;
    parse_credential_output(&stdout)
}

/// Parse protocol and host from a URL string.
fn parse_url_parts(url: &str) -> Option<(&str, &str)> {
    // Handle https://host/... or http://host/...
    if let Some(rest) = url.strip_prefix("https://") {
        let host = rest.split('/').next()?;
        Some(("https", host))
    } else if let Some(rest) = url.strip_prefix("http://") {
        let host = rest.split('/').next()?;
        Some(("http", host))
    } else {
        None
    }
}

/// Parse username and password from `git credential fill` output.
fn parse_credential_output(output: &str) -> Option<(String, String)> {
    let mut username = None;
    let mut password = None;

    for line in output.lines() {
        if let Some(val) = line.strip_prefix("username=") {
            username = Some(val.to_string());
        } else if let Some(val) = line.strip_prefix("password=") {
            password = Some(val.to_string());
        }
    }

    match (username, password) {
        (Some(u), Some(p)) => Some((u, p)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_url_parts_https() {
        assert_eq!(
            parse_url_parts("https://github.com/user/repo.git"),
            Some(("https", "github.com"))
        );
    }

    #[test]
    fn test_parse_url_parts_http() {
        assert_eq!(
            parse_url_parts("http://gitlab.com/user/repo"),
            Some(("http", "gitlab.com"))
        );
    }

    #[test]
    fn test_parse_url_parts_ssh_returns_none() {
        assert_eq!(parse_url_parts("git@github.com:user/repo.git"), None);
    }

    #[test]
    fn test_parse_credential_output() {
        let output = "protocol=https\nhost=github.com\nusername=user\npassword=token123\n";
        assert_eq!(
            parse_credential_output(output),
            Some(("user".to_string(), "token123".to_string()))
        );
    }

    #[test]
    fn test_parse_credential_output_missing_password() {
        let output = "protocol=https\nhost=github.com\nusername=user\n";
        assert_eq!(parse_credential_output(output), None);
    }
}
