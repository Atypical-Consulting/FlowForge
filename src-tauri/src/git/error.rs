use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

/// Git operation errors that serialize across the IPC boundary.
///
/// These errors are sent to the frontend as typed objects,
/// allowing proper error handling in TypeScript.
#[derive(Debug, Error, Serialize, Deserialize, Type, Clone)]
#[serde(tag = "type", content = "message")]
pub enum GitError {
    #[error("Repository not found: {0}")]
    NotFound(String),

    #[error("Not a Git repository: {0}")]
    NotARepository(String),

    #[error("Repository has no commits yet")]
    EmptyRepository,

    #[error("Failed to get repository status: {0}")]
    StatusError(String),

    #[error("Git operation failed: {0}")]
    OperationFailed(String),

    #[error("Path does not exist: {0}")]
    PathNotFound(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<git2::Error> for GitError {
    fn from(err: git2::Error) -> Self {
        match err.code() {
            git2::ErrorCode::NotFound => GitError::NotFound(err.message().to_string()),
            git2::ErrorCode::InvalidSpec => GitError::NotARepository(err.message().to_string()),
            _ => GitError::OperationFailed(err.message().to_string()),
        }
    }
}
