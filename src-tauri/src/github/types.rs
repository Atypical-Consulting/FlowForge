use serde::{Deserialize, Serialize};
use specta::Type;

/// Response from GitHub's device code endpoint.
/// Returned to the frontend so it can display the user_code
/// and verification_uri to the user.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u32,
    pub interval: u32,
}

/// Result of an authentication check or successful auth flow.
/// NEVER contains the actual token -- only metadata about the
/// authenticated user. The token stays in Rust/keychain.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AuthResult {
    pub authenticated: bool,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub scopes: Vec<String>,
}

/// Internal struct for deserializing GitHub /user API response.
/// Not exposed to the frontend (no Type derive).
#[derive(Debug, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub avatar_url: String,
    pub name: Option<String>,
}

/// Rate limit information from the GitHub API.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitInfo {
    pub limit: u32,
    pub remaining: u32,
    pub reset: u32,
    pub used: u32,
}

/// Information about a detected GitHub remote in the current repository.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRemoteInfo {
    pub remote_name: String,
    pub owner: String,
    pub repo: String,
    pub url: String,
}
