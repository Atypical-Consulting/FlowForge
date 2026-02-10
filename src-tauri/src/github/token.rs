//! Keychain token storage for GitHub OAuth tokens.
//!
//! Uses the `keyring` crate for cross-platform OS keychain access:
//! - macOS: Keychain
//! - Windows: Credential Manager
//! - Linux: Secret Service (D-Bus)
//!
//! All keyring operations are blocking and run via `spawn_blocking`.
//! The token NEVER leaves Rust -- the frontend only sees AuthResult.

use std::time::Duration;

use super::error::GitHubError;
use super::types::{AuthResult, GitHubUser};

const KEYCHAIN_SERVICE: &str = "com.flowforge.desktop.github";
const KEYCHAIN_USER: &str = "github-oauth-token";

/// Store an OAuth token in the OS keychain.
pub async fn store_token(token: &str) -> Result<(), GitHubError> {
    let token = token.to_string();
    tokio::task::spawn_blocking(move || {
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER)
            .map_err(|e| GitHubError::KeychainError(format!("Failed to create entry: {}", e)))?;
        entry
            .set_password(&token)
            .map_err(|e| GitHubError::KeychainError(format!("Failed to store token: {}", e)))?;
        Ok(())
    })
    .await
    .map_err(|e| GitHubError::Internal(format!("Task join error: {}", e)))?
}

/// Retrieve the OAuth token from the OS keychain.
/// Returns `GitHubError::NotAuthenticated` if no token is stored.
pub async fn get_token() -> Result<String, GitHubError> {
    tokio::task::spawn_blocking(|| {
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER)
            .map_err(|e| GitHubError::KeychainError(format!("Failed to create entry: {}", e)))?;
        entry.get_password().map_err(|e| match e {
            keyring::Error::NoEntry => GitHubError::NotAuthenticated,
            other => GitHubError::KeychainError(format!("Failed to get token: {}", other)),
        })
    })
    .await
    .map_err(|e| GitHubError::Internal(format!("Task join error: {}", e)))?
}

/// Delete the OAuth token from the OS keychain.
/// Treats `NoEntry` as success (already deleted).
pub async fn delete_token() -> Result<(), GitHubError> {
    tokio::task::spawn_blocking(|| {
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER)
            .map_err(|e| GitHubError::KeychainError(format!("Failed to create entry: {}", e)))?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
            Err(e) => Err(GitHubError::KeychainError(format!(
                "Failed to delete token: {}",
                e
            ))),
        }
    })
    .await
    .map_err(|e| GitHubError::Internal(format!("Task join error: {}", e)))?
}

/// Fetch the authenticated GitHub user's info from the API.
/// Used to validate tokens and retrieve username/avatar.
pub async fn fetch_github_user(
    client: &reqwest::Client,
    token: &str,
) -> Result<GitHubUser, GitHubError> {
    let resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "FlowForge-Desktop")
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    if !resp.status().is_success() {
        return Err(GitHubError::OAuthFailed(format!(
            "GitHub API returned {}",
            resp.status()
        )));
    }

    resp.json::<GitHubUser>()
        .await
        .map_err(|e| GitHubError::OAuthFailed(format!("Failed to parse user info: {}", e)))
}

/// Check if the user is authenticated and return their info.
/// Validates the stored token against the GitHub API.
/// If the token is invalid, auto-deletes it from the keychain.
#[tauri::command]
#[specta::specta]
pub async fn github_get_auth_status() -> Result<AuthResult, GitHubError> {
    let token = match get_token().await {
        Ok(t) => t,
        Err(GitHubError::NotAuthenticated) => {
            return Ok(AuthResult {
                authenticated: false,
                username: None,
                avatar_url: None,
                scopes: vec![],
            });
        }
        Err(e) => return Err(e),
    };

    // Validate token by calling GitHub API
    let client = reqwest::Client::new();
    match fetch_github_user(&client, &token).await {
        Ok(user) => Ok(AuthResult {
            authenticated: true,
            username: Some(user.login),
            avatar_url: Some(user.avatar_url),
            scopes: vec![], // Scopes not available from /user endpoint
        }),
        Err(_) => {
            // Token is invalid -- clean up and report not authenticated
            let _ = delete_token().await;
            Ok(AuthResult {
                authenticated: false,
                username: None,
                avatar_url: None,
                scopes: vec![],
            })
        }
    }
}

/// Sign out by deleting the token from the OS keychain.
#[tauri::command]
#[specta::specta]
pub async fn github_sign_out() -> Result<(), GitHubError> {
    delete_token().await
}
