//! Gitflow initialization command.
//!
//! This module handles initializing Gitflow on a repository:
//! - Creates develop branch if it doesn't exist
//! - Stores configuration in .git/config for git-flow CLI compatibility
//! - Validates branch names before storing
//! - Switches to develop with a *safe* checkout (local changes are never discarded)

use git2::{Branch, Repository};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::git::repository::RepositoryState;
use crate::gitflow::checkout::checkout_branch_safe;
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
    /// Whether HEAD was moved to the develop branch (false if it was already
    /// checked out, in which case the working tree was not touched)
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

/// Initialize Gitflow on an already-open repository.
///
/// This is the synchronous core of [`init_gitflow`], separated so it can be
/// unit-tested against a temporary repository without Tauri state.
///
/// 1. Validates branch names and prefixes
/// 2. Verifies the main branch exists
/// 3. Creates the develop branch from main if it doesn't exist
/// 4. Switches to the develop branch with a *safe* checkout: if develop is
///    already checked out nothing is touched, and if switching would overwrite
///    uncommitted changes the switch is refused with
///    [`GitflowError::CheckoutWouldOverwriteChanges`]. Local work is never
///    discarded.
/// 5. Stores configuration in .git/config for git-flow CLI compatibility
/// 6. Optionally pushes a newly-created develop to origin (best-effort)
pub fn init_gitflow_in_repo(
    repo: &Repository,
    config: &GitflowConfig,
    push_develop: bool,
) -> Result<GitflowInitResult, GitflowError> {
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
    let develop_created = match repo.find_branch(&config.develop_branch, git2::BranchType::Local)
    {
        Ok(_) => {
            // Develop exists - check if there's a different develop branch configured
            if let Some(existing_config) = get_gitflow_config(repo)
                && existing_config.develop_branch != config.develop_branch
            {
                return Err(GitflowError::Git(format!(
                    "Gitflow already initialized with develop branch '{}', cannot change to '{}'",
                    existing_config.develop_branch, config.develop_branch
                )));
            }
            false // Branch exists, not created
        }
        Err(_) => {
            // Develop doesn't exist - create it from main branch HEAD
            let main_branch = repo.find_branch(&config.main_branch, git2::BranchType::Local)?;
            let main_commit = main_branch.get().peel_to_commit()?;
            repo.branch(&config.develop_branch, &main_commit, false)?;
            true // Branch was created
        }
    };

    // 3. Switch to develop BEFORE writing config, so a refused checkout (local
    //    changes would be overwritten) leaves the repository untouched and the
    //    user can simply retry after committing or stashing.
    //
    //    `checkout_branch_safe` is a no-op when develop is already checked out
    //    and never forces the working tree.
    let switched_to_develop = checkout_branch_safe(repo, &config.develop_branch)?;

    // 4. Store config in .git/config
    store_gitflow_config(repo, config)?;

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
        switched_to_develop,
    })
}

/// Initialize Gitflow on the currently open repository.
///
/// See [`init_gitflow_in_repo`] for the exact steps. Never discards local
/// changes: the switch to develop is a safe checkout.
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
        init_gitflow_in_repo(&repo, &config, push_develop)
    })
    .await
    .map_err(|e| GitflowError::Git(format!("Task error: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gitflow::test_support::{
        checkout, commit_file, create_and_checkout, current_branch, init_repo,
        modification_state, read_file, stage_file, write_file,
    };

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

    // ------------------------------------------------------------------
    // Regression tests: init must never discard local changes.
    // ------------------------------------------------------------------

    /// Reproduces the reported data-loss scenario: repo already on `develop`
    /// with a staged modification, an unstaged modification and an untracked
    /// file. Initializing Gitflow must keep every one of them.
    #[test]
    fn init_on_existing_checked_out_develop_keeps_staged_and_unstaged_changes() {
        let (_dir, repo) = init_repo();
        commit_file(&repo, "src_index.ts", "export const a = 1;\n", "add index");
        create_and_checkout(&repo, "develop");
        assert_eq!(current_branch(&repo), "develop");

        // Staged modification ...
        write_file(&repo, "src_index.ts", "export const a = 1;\n// second change\n");
        stage_file(&repo, "src_index.ts");
        // ... plus an unstaged modification on top of it ...
        write_file(
            &repo,
            "src_index.ts",
            "export const a = 1;\n// second change\n// third (unstaged)\n",
        );
        // ... and an untracked file.
        write_file(&repo, "notes.txt", "scratch\n");

        let result = init_gitflow_in_repo(&repo, &GitflowConfig::default(), true).unwrap();
        assert!(!result.develop_created);
        assert!(
            !result.switched_to_develop,
            "develop was already checked out; HEAD must not be touched"
        );

        assert_eq!(current_branch(&repo), "develop");
        assert_eq!(
            read_file(&repo, "src_index.ts"),
            "export const a = 1;\n// second change\n// third (unstaged)\n",
            "working tree content was discarded"
        );
        let (staged, unstaged) = modification_state(&repo, "src_index.ts");
        assert!(staged, "staged modification was discarded");
        assert!(unstaged, "unstaged modification was discarded");
        assert_eq!(read_file(&repo, "notes.txt"), "scratch\n");

        // Config was still written.
        let cfg = get_gitflow_config(&repo).expect("gitflow config stored");
        assert_eq!(cfg.develop_branch, "develop");
        assert_eq!(cfg.main_branch, "main");
    }

    /// On `main` with a dirty tree: creating develop from main and switching to
    /// it must carry the local changes over (same tree, nothing to overwrite).
    #[test]
    fn init_from_main_creates_develop_and_carries_local_changes_over() {
        let (_dir, repo) = init_repo();
        commit_file(&repo, "a.txt", "a\n", "add a");
        write_file(&repo, "a.txt", "a\nlocal\n");
        stage_file(&repo, "a.txt");
        write_file(&repo, "b.txt", "untracked\n");

        let result = init_gitflow_in_repo(&repo, &GitflowConfig::default(), false).unwrap();
        assert!(result.develop_created);
        assert!(result.switched_to_develop);
        assert_eq!(current_branch(&repo), "develop");
        assert_eq!(read_file(&repo, "a.txt"), "a\nlocal\n");
        assert!(modification_state(&repo, "a.txt").0, "staged change lost");
        assert_eq!(read_file(&repo, "b.txt"), "untracked\n");
    }

    /// On `main` with a local change that conflicts with an existing, diverged
    /// `develop`: init must refuse to switch, leave everything untouched, and
    /// NOT write the config (so the user can retry after committing/stashing).
    #[test]
    fn init_refuses_to_overwrite_conflicting_local_changes() {
        let (_dir, repo) = init_repo();
        commit_file(&repo, "a.txt", "main\n", "add a on main");
        create_and_checkout(&repo, "develop");
        commit_file(&repo, "a.txt", "develop\n", "change a on develop");
        checkout(&repo, "main");
        write_file(&repo, "a.txt", "main\nlocal work\n");

        let err = init_gitflow_in_repo(&repo, &GitflowConfig::default(), false).unwrap_err();
        assert!(
            matches!(err, GitflowError::CheckoutWouldOverwriteChanges(ref b) if b == "develop"),
            "expected CheckoutWouldOverwriteChanges, got {err:?}"
        );
        assert_eq!(current_branch(&repo), "main");
        assert_eq!(read_file(&repo, "a.txt"), "main\nlocal work\n");
        assert!(
            get_gitflow_config(&repo).is_none(),
            "config must not be written when init is refused"
        );
    }
}
