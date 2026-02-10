//! OAuth Device Flow authentication for GitHub.
//!
//! Implements the two-step device flow:
//! 1. Request device/user codes from GitHub
//! 2. Frontend polls for authorization status
//!
//! The frontend controls the polling loop via setTimeout.
//! Each poll is a single Tauri command invocation.

use std::time::Duration;

use super::error::GitHubError;
use super::token;
use super::types::{AuthResult, DeviceFlowResponse};

const GITHUB_DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";

// TODO: Replace with your registered GitHub OAuth App client_id.
// This is a public identifier (not a secret) and is safe to embed in source.
// Register at: https://github.com/settings/developers -> OAuth Apps -> New OAuth App
const GITHUB_CLIENT_ID: &str = "Ov23liXXXXXXXXXXXXXX";

/// Internal deserialization struct for the GitHub token endpoint response.
#[derive(Debug, serde::Deserialize)]
struct GitHubTokenResponse {
    access_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    error: Option<String>,
}

/// Initiate the GitHub OAuth Device Flow.
///
/// Returns device_code, user_code, and verification_uri for the frontend
/// to display to the user. The user visits the URI and enters the code.
#[tauri::command]
#[specta::specta]
pub async fn github_start_device_flow(
    scopes: Vec<String>,
) -> Result<DeviceFlowResponse, GitHubError> {
    let client = reqwest::Client::new();
    let scope_string = scopes.join(" ");

    let resp = client
        .post(GITHUB_DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("scope", scope_string.as_str()),
        ])
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(GitHubError::OAuthFailed(format!(
            "Device code request failed: {}",
            body
        )));
    }

    let data: DeviceFlowResponse = resp
        .json()
        .await
        .map_err(|e| GitHubError::OAuthFailed(format!("Failed to parse response: {}", e)))?;

    Ok(data)
}

/// Poll GitHub for authorization status (single attempt).
///
/// This is NOT a loop -- the frontend controls polling via setTimeout
/// and calls this command once per interval. This avoids long-running
/// Tauri commands and gives the frontend full control over the UX.
///
/// Returns `AuthResult` on success or specific error variants that
/// the frontend uses for control flow:
/// - `AuthorizationPending`: user hasn't authorized yet, keep polling
/// - `SlowDown`: increase polling interval by 5 seconds
/// - `ExpiredToken`: device code expired, need to restart flow
/// - `AccessDenied`: user denied authorization
#[tauri::command]
#[specta::specta]
pub async fn github_poll_auth(
    device_code: String,
    interval: u32,
) -> Result<AuthResult, GitHubError> {
    let client = reqwest::Client::new();

    let resp = client
        .post(GITHUB_ACCESS_TOKEN_URL)
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("device_code", device_code.as_str()),
            (
                "grant_type",
                "urn:ietf:params:oauth:grant-type:device_code",
            ),
        ])
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    let data: GitHubTokenResponse = resp
        .json()
        .await
        .map_err(|e| GitHubError::OAuthFailed(format!("Failed to parse response: {}", e)))?;

    // Check for error responses (control flow for polling)
    if let Some(error) = &data.error {
        return match error.as_str() {
            "authorization_pending" => Err(GitHubError::AuthorizationPending),
            "slow_down" => Err(GitHubError::SlowDown),
            "expired_token" => Err(GitHubError::ExpiredToken),
            "access_denied" => Err(GitHubError::AccessDenied),
            other => Err(GitHubError::OAuthFailed(other.to_string())),
        };
    }

    // Success -- store token in keychain (NEVER return it to frontend)
    if let Some(access_token) = &data.access_token {
        token::store_token(access_token).await?;

        // Fetch user info to return username/avatar
        let user = token::fetch_github_user(&client, access_token).await?;

        // GitHub returns scopes as comma-separated, not space-separated
        let scopes = data
            .scope
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        return Ok(AuthResult {
            authenticated: true,
            username: Some(user.login),
            avatar_url: Some(user.avatar_url),
            scopes,
        });
    }

    Err(GitHubError::OAuthFailed(
        "No access token in response".to_string(),
    ))
}
