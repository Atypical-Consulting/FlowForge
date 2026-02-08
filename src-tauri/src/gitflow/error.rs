//! Gitflow-specific error types.

use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

/// Gitflow operation errors that serialize across the IPC boundary.
#[derive(Debug, Error, Serialize, Deserialize, Type, Clone)]
#[serde(tag = "type", content = "data")]
pub enum GitflowError {
    /// Wrong branch context for the requested operation
    #[error("Invalid context: expected {expected}, got {actual}")]
    InvalidContext { expected: String, actual: String },

    /// Operation requires being on a feature branch
    #[error("Not on a feature branch")]
    NotOnFeatureBranch,

    /// Operation requires being on a release branch
    #[error("Not on a release branch")]
    NotOnReleaseBranch,

    /// Operation requires being on a hotfix branch
    #[error("Not on a hotfix branch")]
    NotOnHotfixBranch,

    /// A release is already in progress
    #[error("Release already in progress: {0}")]
    ReleaseInProgress(String),

    /// A hotfix is already in progress
    #[error("Hotfix already in progress: {0}")]
    HotfixInProgress(String),

    /// Merge conflicts encountered during finish operation
    #[error("Merge conflict detected")]
    MergeConflict,

    /// Working directory has uncommitted changes
    #[error("Working directory has uncommitted changes — commit or stash before proceeding")]
    DirtyWorkingTree,

    /// Repository has no commits yet
    #[error("Repository has no commits (unborn HEAD)")]
    UnbornHead,

    /// Specified branch was not found
    #[error("Branch not found: {0}")]
    BranchNotFound(String),

    /// Branch already exists
    #[error("Branch already exists: {0}")]
    BranchExists(String),

    /// Repository is not configured for Gitflow (missing main or develop)
    #[error("Not a Gitflow repository: missing main or develop branch")]
    NotGitflowRepo,

    /// Invalid branch name for Gitflow
    #[error("Invalid branch name: {0}")]
    InvalidBranchName(String),

    /// Wrapped git2 error
    #[error("Git error: {0}")]
    Git(String),
}

impl From<git2::Error> for GitflowError {
    fn from(err: git2::Error) -> Self {
        GitflowError::Git(err.message().to_string())
    }
}
