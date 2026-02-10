use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

/// GitHub operation errors that serialize across the IPC boundary.
///
/// These errors are sent to the frontend as typed objects,
/// allowing proper error handling in TypeScript. The frontend
/// checks `err.type` to decide control flow (e.g., continue polling
/// on `AuthorizationPending`, increase interval on `SlowDown`).
#[derive(Debug, Error, Serialize, Deserialize, Type, Clone)]
#[serde(tag = "type", content = "message")]
pub enum GitHubError {
    #[error("OAuth flow failed: {0}")]
    OAuthFailed(String),

    #[error("Authorization pending")]
    AuthorizationPending,

    #[error("Authorization denied by user")]
    AccessDenied,

    #[error("Device code expired")]
    ExpiredToken,

    #[error("Rate limited, slow down")]
    SlowDown,

    #[error("Keychain error: {0}")]
    KeychainError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Not authenticated")]
    NotAuthenticated,

    #[error("Rate limit exceeded: {0}")]
    RateLimitExceeded(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Operation cancelled")]
    Cancelled,
}
