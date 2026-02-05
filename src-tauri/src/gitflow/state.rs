//! State reconstruction and context utilities.

use git2::Repository;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::gitflow::error::GitflowError;
use crate::gitflow::init::get_gitflow_config;
use crate::gitflow::machine::GitflowState;
use crate::gitflow::policy::{is_develop_branch, is_main_branch, parse_branch_type, BranchType};

/// Context about the repository's Gitflow state.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitflowContext {
    /// Current Gitflow state derived from branch name
    pub state: GitflowState,
    /// Current branch name
    pub current_branch: String,
    /// Whether the repository has a main/master branch
    pub has_main: bool,
    /// Whether the repository has a develop branch
    pub has_develop: bool,
    /// Whether the repository has Gitflow initialized (config in .git/config)
    pub is_initialized: bool,
}

impl GitflowContext {
    /// Build context from a git2 Repository.
    pub fn from_repo(repo: &Repository) -> Result<Self, GitflowError> {
        let current_branch = get_current_branch_name(repo)?.unwrap_or_default();

        let state = if current_branch.is_empty() {
            GitflowState::Idle
        } else {
            reconstruct_state(&current_branch)
        };

        let has_main = check_branch_exists(repo, "main") || check_branch_exists(repo, "master");
        let has_develop =
            check_branch_exists(repo, "develop") || check_branch_exists(repo, "development");
        let is_initialized = get_gitflow_config(repo).is_some();

        Ok(GitflowContext {
            state,
            current_branch,
            has_main,
            has_develop,
            is_initialized,
        })
    }

    /// Check if the repository is configured for Gitflow.
    ///
    /// A Gitflow repository must have both main AND develop branches.
    pub fn is_gitflow_ready(&self) -> bool {
        self.has_main && self.has_develop
    }

    /// Check if currently on the main branch.
    pub fn on_main(&self) -> bool {
        is_main_branch(&self.current_branch)
    }

    /// Check if currently on the develop branch.
    pub fn on_develop(&self) -> bool {
        is_develop_branch(&self.current_branch)
    }
}

/// Reconstruct Gitflow state from a branch name.
///
/// This derives the workflow state based on branch naming conventions.
pub fn reconstruct_state(branch_name: &str) -> GitflowState {
    match parse_branch_type(branch_name) {
        BranchType::Feature(name) => GitflowState::Feature { name },
        BranchType::Release(version) => GitflowState::Release { version },
        BranchType::Hotfix(name) => GitflowState::Hotfix { name },
        // Main, Develop, and Other all map to Idle
        BranchType::Main | BranchType::Develop | BranchType::Other(_) => GitflowState::Idle,
    }
}

/// Get the current branch name from a repository.
///
/// Returns None if HEAD is detached or unborn.
pub fn get_current_branch_name(repo: &Repository) -> Result<Option<String>, GitflowError> {
    match repo.head() {
        Ok(head) => {
            if head.is_branch() {
                Ok(head.shorthand().map(|s| s.to_string()))
            } else {
                // Detached HEAD
                Ok(None)
            }
        }
        Err(e) if e.code() == git2::ErrorCode::UnbornBranch => Ok(None),
        Err(e) => Err(GitflowError::from(e)),
    }
}

/// Check if a branch exists in the repository.
fn check_branch_exists(repo: &Repository, name: &str) -> bool {
    repo.find_branch(name, git2::BranchType::Local).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reconstruct_state_main() {
        assert_eq!(reconstruct_state("main"), GitflowState::Idle);
        assert_eq!(reconstruct_state("master"), GitflowState::Idle);
    }

    #[test]
    fn test_reconstruct_state_develop() {
        assert_eq!(reconstruct_state("develop"), GitflowState::Idle);
    }

    #[test]
    fn test_reconstruct_state_feature() {
        assert_eq!(
            reconstruct_state("feature/login"),
            GitflowState::Feature {
                name: "login".to_string()
            }
        );
    }

    #[test]
    fn test_reconstruct_state_release() {
        assert_eq!(
            reconstruct_state("release/1.0.0"),
            GitflowState::Release {
                version: "1.0.0".to_string()
            }
        );
    }

    #[test]
    fn test_reconstruct_state_hotfix() {
        assert_eq!(
            reconstruct_state("hotfix/urgent-fix"),
            GitflowState::Hotfix {
                name: "urgent-fix".to_string()
            }
        );
    }

    #[test]
    fn test_reconstruct_state_other() {
        assert_eq!(reconstruct_state("experimental/test"), GitflowState::Idle);
    }
}
