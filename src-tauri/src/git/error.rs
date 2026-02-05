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

    // Commit errors
    #[error("No staged changes to commit")]
    NoStagedChanges,

    #[error("Could not determine commit author: {0}")]
    SignatureError(String),

    // Remote errors
    #[error("Remote not found: {0}")]
    RemoteNotFound(String),

    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Push rejected: {0}")]
    PushRejected(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    // Branch errors
    #[error("Branch not found: {0}")]
    BranchNotFound(String),

    #[error("Cannot delete the currently checked out branch")]
    CannotDeleteCurrentBranch,

    #[error("Branch has unmerged commits: {0}")]
    BranchNotMerged(String),

    #[error("Invalid branch name: {0}")]
    InvalidBranchName(String),

    #[error("Branch already exists: {0}")]
    BranchAlreadyExists(String),

    #[error("Cannot checkout with uncommitted changes")]
    DirtyWorkingDirectory,

    // Stash errors
    #[error("Stash not found at index {0}")]
    StashNotFound(u32),

    #[error("No local changes to stash")]
    NothingToStash,

    // Tag errors
    #[error("Tag already exists: {0}")]
    TagAlreadyExists(String),

    #[error("Tag not found: {0}")]
    TagNotFound(String),

    // Merge errors
    #[error("No merge in progress")]
    NoMergeInProgress,

    // Clone errors
    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("Path already exists: {0}")]
    PathExists(String),

    #[error("Clone failed: {0}")]
    CloneFailed(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),
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
