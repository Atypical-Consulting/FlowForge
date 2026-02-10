//! GitHub API rate limit checking.
//!
//! Fetches rate limit information from the GitHub API
//! using the authenticated user's token from the keychain.

use super::error::GitHubError;
use super::token;
use super::types::RateLimitInfo;

/// Internal deserialization structs for the GitHub rate limit API response.
#[derive(serde::Deserialize)]
struct RateLimitResponse {
    resources: RateLimitResources,
}

#[derive(serde::Deserialize)]
struct RateLimitResources {
    core: RateLimitData,
}

#[derive(serde::Deserialize)]
struct RateLimitData {
    limit: u32,
    remaining: u32,
    reset: u32,
    used: u32,
}

/// Check the current GitHub API rate limit for the authenticated user.
///
/// Retrieves the token from the keychain and queries the GitHub
/// rate limit endpoint to return current usage information.
#[tauri::command]
#[specta::specta]
pub async fn github_check_rate_limit() -> Result<RateLimitInfo, GitHubError> {
    let access_token = token::get_token().await?;
    let client = reqwest::Client::new();

    let resp = client
        .get("https://api.github.com/rate_limit")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "FlowForge-Desktop")
        .header("Accept", "application/vnd.github+json")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(format!("Rate limit check failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(GitHubError::OAuthFailed(format!(
            "Rate limit API returned {}",
            resp.status()
        )));
    }

    let data: RateLimitResponse = resp
        .json()
        .await
        .map_err(|e| GitHubError::Internal(format!("Failed to parse rate limit: {}", e)))?;

    Ok(RateLimitInfo {
        limit: data.resources.core.limit,
        remaining: data.resources.core.remaining,
        reset: data.resources.core.reset,
        used: data.resources.core.used,
    })
}
