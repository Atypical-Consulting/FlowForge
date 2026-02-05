//! Gitflow initialization command.
//!
//! This module handles initializing Gitflow on a repository:
//! - Creates develop branch if it doesn't exist
//! - Stores configuration in .git/config for git-flow CLI compatibility
//! - Validates branch names before storing

use git2::{Branch, Repository};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::git::repository::RepositoryState;
use crate::gitflow::error::GitflowError;

/// Configuration for Gitflow initialization.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitflowConfig {
    /// Main/production branch name (e.g., "main" or "master")
    pub main_branch: String,
    /// Development branch name (e.g., "develop")
    pub develop_branch: String,
    /// Prefix for feature branches (e.g., "feature/")
    pub feature_prefix: String,
    /// Prefix for release branches (e.g., "release/")
    pub release_prefix: String,
    /// Prefix for hotfix branches (e.g., "hotfix/")
    pub hotfix_prefix: String,
}

impl Default for GitflowConfig {
    fn default() -> Self {
        Self {
            main_branch: "main".to_string(),
            develop_branch: "develop".to_string(),
            feature_prefix: "feature/".to_string(),
            release_prefix: "release/".to_string(),
            hotfix_prefix: "hotfix/".to_string(),
        }
    }
}

/// Result of Gitflow initialization.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitflowInitResult {
    /// Whether the develop branch was created (false if it already existed)
    pub develop_created: bool,
    /// Whether we switched to the develop branch
    pub switched_to_develop: bool,
}

/// Read existing Gitflow configuration from repository.
///
/// Returns None if Gitflow is not configured.
pub fn get_gitflow_config(repo: &Repository) -> Option<GitflowConfig> {
    let config = repo.config().ok()?;

    // Check if gitflow.branch.main exists - if not, Gitflow is not configured
    let main_branch = config.get_string("gitflow.branch.main").ok()?;

    // Read all config values, using defaults for missing optional values
    Some(GitflowConfig {
        main_branch,
        develop_branch: config
            .get_string("gitflow.branch.develop")
            .unwrap_or_else(|_| "develop".to_string()),
        feature_prefix: config
            .get_string("gitflow.prefix.feature")
            .unwrap_or_else(|_| "feature/".to_string()),
        release_prefix: config
            .get_string("gitflow.prefix.release")
            .unwrap_or_else(|_| "release/".to_string()),
        hotfix_prefix: config
            .get_string("gitflow.prefix.hotfix")
            .unwrap_or_else(|_| "hotfix/".to_string()),
    })
}

/// Validate that a branch name is valid for git.
fn validate_branch_name(name: &str) -> Result<(), GitflowError> {
    if name.is_empty() {
        return Err(GitflowError::InvalidBranchName(
            "Branch name cannot be empty".to_string(),
        ));
    }

    if !Branch::name_is_valid(name).unwrap_or(false) {
        return Err(GitflowError::InvalidBranchName(format!(
            "Invalid branch name: {}",
            name
        )));
    }

    Ok(())
}

/// Validate that a prefix is valid (should end with /).
fn validate_prefix(prefix: &str, prefix_name: &str) -> Result<(), GitflowError> {
    if prefix.is_empty() {
        return Err(GitflowError::InvalidBranchName(format!(
            "{} prefix cannot be empty",
            prefix_name
        )));
    }

    if !prefix.ends_with('/') {
        return Err(GitflowError::InvalidBranchName(format!(
            "{} prefix must end with /",
            prefix_name
        )));
    }

    Ok(())
}

/// Store Gitflow configuration in .git/config.
fn store_gitflow_config(repo: &Repository, config: &GitflowConfig) -> Result<(), GitflowError> {
    let mut git_config = repo.config()?;

    // Store branch names
    git_config.set_str("gitflow.branch.main", &config.main_branch)?;
    git_config.set_str("gitflow.branch.develop", &config.develop_branch)?;

    // Store prefixes
    git_config.set_str("gitflow.prefix.feature", &config.feature_prefix)?;
    git_config.set_str("gitflow.prefix.release", &config.release_prefix)?;
    git_config.set_str("gitflow.prefix.hotfix", &config.hotfix_prefix)?;

    // Add support and versiontag for full git-flow CLI compatibility
    git_config.set_str("gitflow.prefix.support", "support/")?;
    git_config.set_str("gitflow.prefix.versiontag", "")?;

    Ok(())
}

/// Initialize Gitflow on a repository.
///
/// This command:
/// 1. Verifies the main branch exists
/// 2. Creates the develop branch if it doesn't exist
/// 3. Stores configuration in .git/config for git-flow CLI compatibility
/// 4. Checks out the develop branch
/// 5. Optionally pushes develop to origin
#[tauri::command]
#[specta::specta]
pub async fn init_gitflow(
    config: GitflowConfig,
    push_develop: bool,
    state: State<'_, RepositoryState>,
) -> Result<GitflowInitResult, GitflowError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or(GitflowError::Git("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = Repository::open(&repo_path)?;

        // Validate all branch names and prefixes
        validate_branch_name(&config.main_branch)?;
        validate_branch_name(&config.develop_branch)?;
        validate_prefix(&config.feature_prefix, "Feature")?;
        validate_prefix(&config.release_prefix, "Release")?;
        validate_prefix(&config.hotfix_prefix, "Hotfix")?;

        // 1. Verify main branch exists
        if repo
            .find_branch(&config.main_branch, git2::BranchType::Local)
            .is_err()
        {
            return Err(GitflowError::BranchNotFound(config.main_branch.clone()));
        }

        // 2. Check if develop branch exists
        let develop_created =
            match repo.find_branch(&config.develop_branch, git2::BranchType::Local) {
                Ok(_) => {
                    // Develop exists - check if there's a different develop branch configured
                    if let Some(existing_config) = get_gitflow_config(&repo) {
                        if existing_config.develop_branch != config.develop_branch {
                            return Err(GitflowError::Git(format!(
                            "Gitflow already initialized with develop branch '{}', cannot change to '{}'",
                            existing_config.develop_branch,
                            config.develop_branch
                        )));
                        }
                    }
                    false // Branch exists, not created
                }
                Err(_) => {
                    // Develop doesn't exist - create it from main branch HEAD
                    let main_branch =
                        repo.find_branch(&config.main_branch, git2::BranchType::Local)?;
                    let main_commit = main_branch.get().peel_to_commit()?;
                    repo.branch(&config.develop_branch, &main_commit, false)?;
                    true // Branch was created
                }
            };

        // 3. Store config in .git/config
        store_gitflow_config(&repo, &config)?;

        // 4. Checkout develop branch
        let refname = format!("refs/heads/{}", config.develop_branch);
        repo.set_head(&refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;

        // 5. Optionally push develop to origin (fail silently if no remote)
        if push_develop && develop_created {
            // Try to push, but don't fail if it doesn't work
            // This is best-effort - user can push manually if needed
            if let Ok(mut remote) = repo.find_remote("origin") {
                let refspec = format!(
                    "refs/heads/{}:refs/heads/{}",
                    config.develop_branch, config.develop_branch
                );
                // Ignore push errors - remote might not exist or be accessible
                let _ = remote.push(&[&refspec], None);
            }
        }

        Ok(GitflowInitResult {
            develop_created,
            switched_to_develop: true,
        })
    })
    .await
    .map_err(|e| GitflowError::Git(format!("Task error: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = GitflowConfig::default();
        assert_eq!(config.main_branch, "main");
        assert_eq!(config.develop_branch, "develop");
        assert_eq!(config.feature_prefix, "feature/");
        assert_eq!(config.release_prefix, "release/");
        assert_eq!(config.hotfix_prefix, "hotfix/");
    }

    #[test]
    fn test_validate_branch_name_empty() {
        assert!(validate_branch_name("").is_err());
    }

    #[test]
    fn test_validate_branch_name_valid() {
        assert!(validate_branch_name("main").is_ok());
        assert!(validate_branch_name("develop").is_ok());
        assert!(validate_branch_name("my-branch").is_ok());
    }

    #[test]
    fn test_validate_prefix_empty() {
        assert!(validate_prefix("", "Feature").is_err());
    }

    #[test]
    fn test_validate_prefix_no_slash() {
        assert!(validate_prefix("feature", "Feature").is_err());
    }

    #[test]
    fn test_validate_prefix_valid() {
        assert!(validate_prefix("feature/", "Feature").is_ok());
        assert!(validate_prefix("release/", "Release").is_ok());
    }
}
