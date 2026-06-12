//! Gitflow workflow commands for Tauri IPC.

use git2::BranchType;
use serde::Serialize;
use specta::Type;
use tauri::State;

use crate::git::repository::RepositoryState;
use crate::gitflow::error::GitflowError;
use crate::gitflow::init::get_gitflow_config;
use crate::gitflow::machine::GitflowState;
use crate::gitflow::merge::merge_no_ff;
use crate::gitflow::policy::{
    is_develop_branch, is_main_branch, is_valid_feature_name, is_valid_version,
};
use crate::gitflow::state::{get_current_branch_name, GitflowContext};

/// Resolve the configured develop branch name for this repository.
///
/// Prefers the name stored in `.git/config` (gitflow.branch.develop); falls back
/// to whichever of `develop`/`development` actually exists, defaulting to `develop`.
fn resolve_develop_branch(repo: &git2::Repository) -> String {
    if let Some(config) = get_gitflow_config(repo)
        && repo
            .find_branch(&config.develop_branch, BranchType::Local)
            .is_ok()
    {
        return config.develop_branch;
    }
    if repo.find_branch("development", BranchType::Local).is_ok()
        && repo.find_branch("develop", BranchType::Local).is_err()
    {
        return "development".to_string();
    }
    "develop".to_string()
}

/// Resolve the configured main branch name for this repository.
///
/// Prefers the name stored in `.git/config` (gitflow.branch.main); falls back to
/// whichever of `main`/`master` actually exists, defaulting to `main`.
fn resolve_main_branch(repo: &git2::Repository) -> String {
    if let Some(config) = get_gitflow_config(repo)
        && repo
            .find_branch(&config.main_branch, BranchType::Local)
            .is_ok()
    {
        return config.main_branch;
    }
    if repo.find_branch("main", BranchType::Local).is_ok() {
        "main".to_string()
    } else {
        "master".to_string()
    }
}

/// Check whether merging `source` into `target` would produce conflicts, without
/// mutating the repository (no checkout, no index changes, no commits).
///
/// Used to detect a doomed develop merge before performing irreversible main/tag
/// mutations in the finish flows.
fn merge_would_conflict(
    repo: &git2::Repository,
    source_branch: &str,
    target_branch: &str,
) -> Result<bool, GitflowError> {
    let source = repo
        .find_branch(source_branch, BranchType::Local)?
        .get()
        .peel_to_commit()?;
    let target = repo
        .find_branch(target_branch, BranchType::Local)?
        .get()
        .peel_to_commit()?;

    // merge_commits performs an in-memory three-way merge and returns the
    // resulting index without touching the working tree or HEAD.
    let merged_index = repo.merge_commits(&target, &source, None)?;
    Ok(merged_index.has_conflicts())
}

/// Best-effort rollback of a finish flow that already advanced `main` and created
/// `tag_name` but then failed merging into develop. Resets the main branch ref
/// back to `pre_merge` and deletes the freshly-created tag so the repository is
/// not left in a half-finished state. Errors are ignored: a failed rollback is no
/// worse than the partial state it is trying to undo.
fn rollback_main_and_tag(
    repo: &git2::Repository,
    main_branch: &str,
    pre_merge: git2::Oid,
    tag_name: &str,
) {
    if let Ok(commit) = repo.find_commit(pre_merge) {
        let refname = format!("refs/heads/{}", main_branch);
        let _ = repo.reference(
            &refname,
            pre_merge,
            true,
            "gitflow finish rollback: undo main merge",
        );
        // Ensure the working tree/HEAD reflect the rewound main branch.
        if repo
            .head()
            .ok()
            .and_then(|h| h.shorthand().ok().map(|s| s == main_branch))
            .unwrap_or(false)
        {
            let _ = repo.reset(commit.as_object(), git2::ResetType::Hard, None);
        }
    }
    let _ = repo.tag_delete(tag_name);
}

/// Check if the working directory is clean (no uncommitted changes).
/// Returns Ok(()) if clean, Err(DirtyWorkingTree) if dirty.
fn ensure_clean_working_tree(repo: &git2::Repository) -> Result<(), GitflowError> {
    let statuses = repo.statuses(Some(
        git2::StatusOptions::new()
            .include_untracked(false)
            .include_ignored(false),
    ))?;
    if !statuses.is_empty() {
        return Err(GitflowError::DirtyWorkingTree);
    }
    Ok(())
}

// ============================================================================
// Feature Flow Commands
// ============================================================================

/// Start a new feature branch from develop.
#[tauri::command]
#[specta::specta]
pub async fn start_feature(
    name: String,
    state: State<'_, RepositoryState>,
) -> Result<String, GitflowError> {
    if !is_valid_feature_name(&name) {
        return Err(GitflowError::InvalidBranchName(name));
    }

    let repo_path = state
        .get_path()
        .await
        .ok_or(GitflowError::Git("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Must be on develop
        let current = get_current_branch_name(&repo)?
            .ok_or(GitflowError::Git("HEAD is detached".to_string()))?;

        if !is_develop_branch(&current) {
            return Err(GitflowError::InvalidContext {
                expected: "develop".to_string(),
                actual: current,
            });
        }

        let branch_name = format!("feature/{}", name);

        // Check branch doesn't exist
        if repo.find_branch(&branch_name, BranchType::Local).is_ok() {
            return Err(GitflowError::BranchExists(branch_name));
        }

        // Create branch from HEAD
        let head_commit = repo.head()?.peel_to_commit()?;
        repo.branch(&branch_name, &head_commit, false)?;

        // Checkout new branch (safe checkout preserves uncommitted changes)
        let refname = format!("refs/heads/{}", branch_name);
        repo.set_head(&refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().safe()))?;

        Ok(branch_name)
    })
    .await
    .map_err(|e| GitflowError::Git(format!("Task error: {}", e)))?
}

/// Finish the current feature branch, merging to develop.
#[tauri::command]
#[specta::specta]
pub async fn finish_feature(state: State<'_, RepositoryState>) -> Result<(), GitflowError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or(GitflowError::Git("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        ensure_clean_working_tree(&repo)?;

        // Must be on feature branch
        let current = get_current_branch_name(&repo)?
            .ok_or(GitflowError::Git("HEAD is detached".to_string()))?;

        let _feature_name = current
            .strip_prefix("feature/")
            .ok_or(GitflowError::NotOnFeatureBranch)?;

        // Merge to develop with --no-ff
        let develop_branch = resolve_develop_branch(&repo);
        let message = format!("Merge branch '{}' into {}", current, develop_branch);
        merge_no_ff(&repo, &current, &develop_branch, &message)?;

        // Delete feature branch (we're now on develop after merge)
        let mut branch = repo.find_branch(&current, BranchType::Local)?;
        branch.delete()?;

        Ok(())
    })
    .await
    .map_err(|e| GitflowError::Git(format!("Task error: {}", e)))?
}

// ============================================================================
// Release Flow Commands
// ============================================================================

/// Start a new release branch from develop.
#[tauri::command]
#[specta::specta]
pub async fn start_release(
    version: String,
    state: State<'_, RepositoryState>,
) -> Result<String, GitflowError> {
    if !is_valid_version(&version) {
        return Err(GitflowError::InvalidBranchName(format!(
            "Invalid version: {}",
            version
        )));
    }

    let repo_path = state
        .get_path()
        .await
        .ok_or(GitflowError::Git("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Must be on develop
        let current = get_current_branch_name(&repo)?
            .ok_or(GitflowError::Git("HEAD is detached".to_string()))?;

        if !is_develop_branch(&current) {
            return Err(GitflowError::InvalidContext {
                expected: "develop".to_string(),
                actual: current,
            });
        }

        // Check no active release
        for branch in repo.branches(Some(BranchType::Local))? {
            let (branch, _) = branch?;
            if let Some(name) = branch.name()?
                && name.starts_with("release/") {
                    return Err(GitflowError::ReleaseInProgress(name.to_string()));
                }
        }

        let branch_name = format!("release/{}", version);

        // Check branch doesn't exist
        if repo.find_branch(&branch_name, BranchType::Local).is_ok() {
            return Err(GitflowError::BranchExists(branch_name));
        }

        // Create and checkout (safe checkout preserves uncommitted changes)
        let head_commit = repo.head()?.peel_to_commit()?;
        repo.branch(&branch_name, &head_commit, false)?;
        let refname = format!("refs/heads/{}", branch_name);
        repo.set_head(&refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().safe()))?;

        Ok(branch_name)
    })
    .await
    .map_err(|e| GitflowError::Git(format!("Task error: {}", e)))?
}

/// Finish the current release branch.
/// Merges to main AND develop, creates version tag, deletes branch.
#[tauri::command]
#[specta::specta]
pub async fn finish_release(
    tag_message: Option<String>,
    state: State<'_, RepositoryState>,
) -> Result<String, GitflowError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or(GitflowError::Git("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        ensure_clean_working_tree(&repo)?;

        // Must be on release branch
        let current = get_current_branch_name(&repo)?
            .ok_or(GitflowError::Git("HEAD is detached".to_string()))?;

        let version = current
            .strip_prefix("release/")
            .ok_or(GitflowError::NotOnReleaseBranch)?
            .to_string();

        let main_branch = resolve_main_branch(&repo);
        let develop_branch = resolve_develop_branch(&repo);

        // 0. Pre-flight: detect a doomed develop merge BEFORE making any
        // irreversible mutation to main or creating the tag. Without this, a
        // conflicting develop merge would leave main advanced and tagged but
        // develop un-merged and the release branch undeleted, with no way to
        // retry through the UI.
        if merge_would_conflict(&repo, &current, &develop_branch)? {
            return Err(GitflowError::MergeConflict);
        }

        // 1. Merge to main with --no-ff
        let main_msg = format!("Merge branch '{}' into {}", current, main_branch);
        let main_pre_merge = repo
            .find_branch(&main_branch, BranchType::Local)?
            .get()
            .peel_to_commit()?
            .id();
        merge_no_ff(&repo, &current, &main_branch, &main_msg)?;

        // 2. Create tag on main (we're now on main after merge)
        let tag_name = format!("v{}", version);
        let msg = tag_message.unwrap_or_else(|| format!("Release {}", version));
        let head_commit = repo.head()?.peel_to_commit()?;
        let sig = repo.signature()?;
        repo.tag(&tag_name, head_commit.as_object(), &sig, &msg, false)?;

        // 3. Merge to develop with --no-ff. The pre-flight check above makes a
        // conflict here unlikely, but if anything still fails we roll back the
        // main merge and tag so the repo is never left half-finished.
        let develop_msg = format!("Merge branch '{}' into {}", current, develop_branch);
        if let Err(e) = merge_no_ff(&repo, &current, &develop_branch, &develop_msg) {
            rollback_main_and_tag(&repo, &main_branch, main_pre_merge, &tag_name);
            return Err(e);
        }

        // 4. Delete release branch (we're on develop now)
        let mut branch = repo.find_branch(&current, BranchType::Local)?;
        branch.delete()?;

        Ok(tag_name)
    })
    .await
    .map_err(|e| GitflowError::Git(format!("Task error: {}", e)))?
}

// ============================================================================
// Hotfix Flow Commands
// ============================================================================

/// Start a new hotfix branch from main.
#[tauri::command]
#[specta::specta]
pub async fn start_hotfix(
    name: String,
    state: State<'_, RepositoryState>,
) -> Result<String, GitflowError> {
    if !is_valid_feature_name(&name) {
        return Err(GitflowError::InvalidBranchName(name));
    }

    let repo_path = state
        .get_path()
        .await
        .ok_or(GitflowError::Git("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Must be on main/master
        let current = get_current_branch_name(&repo)?
            .ok_or(GitflowError::Git("HEAD is detached".to_string()))?;

        if !is_main_branch(&current) {
            return Err(GitflowError::InvalidContext {
                expected: "main".to_string(),
                actual: current,
            });
        }

        // Check no active hotfix
        for branch in repo.branches(Some(BranchType::Local))? {
            let (branch, _) = branch?;
            if let Some(bname) = branch.name()?
                && bname.starts_with("hotfix/") {
                    return Err(GitflowError::HotfixInProgress(bname.to_string()));
                }
        }

        let branch_name = format!("hotfix/{}", name);

        if repo.find_branch(&branch_name, BranchType::Local).is_ok() {
            return Err(GitflowError::BranchExists(branch_name));
        }

        // Safe checkout preserves uncommitted changes
        let head_commit = repo.head()?.peel_to_commit()?;
        repo.branch(&branch_name, &head_commit, false)?;
        let refname = format!("refs/heads/{}", branch_name);
        repo.set_head(&refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().safe()))?;

        Ok(branch_name)
    })
    .await
    .map_err(|e| GitflowError::Git(format!("Task error: {}", e)))?
}

/// Finish the current hotfix branch.
/// Merges to main AND develop, creates tag, deletes branch.
#[tauri::command]
#[specta::specta]
pub async fn finish_hotfix(
    tag_message: Option<String>,
    state: State<'_, RepositoryState>,
) -> Result<String, GitflowError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or(GitflowError::Git("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        ensure_clean_working_tree(&repo)?;

        let current = get_current_branch_name(&repo)?
            .ok_or(GitflowError::Git("HEAD is detached".to_string()))?;

        let hotfix_name = current
            .strip_prefix("hotfix/")
            .ok_or(GitflowError::NotOnHotfixBranch)?
            .to_string();

        let main_branch = resolve_main_branch(&repo);
        let develop_branch = resolve_develop_branch(&repo);

        // 0. Pre-flight: detect a doomed develop merge BEFORE making any
        // irreversible mutation to main or creating the tag.
        if merge_would_conflict(&repo, &current, &develop_branch)? {
            return Err(GitflowError::MergeConflict);
        }

        // 1. Merge to main
        let main_msg = format!("Merge branch '{}' into {}", current, main_branch);
        let main_pre_merge = repo
            .find_branch(&main_branch, BranchType::Local)?
            .get()
            .peel_to_commit()?
            .id();
        merge_no_ff(&repo, &current, &main_branch, &main_msg)?;

        // 2. Create tag on main
        let tag_name = format!("hotfix-{}", hotfix_name);
        let msg = tag_message.unwrap_or_else(|| format!("Hotfix {}", hotfix_name));
        let head_commit = repo.head()?.peel_to_commit()?;
        let sig = repo.signature()?;
        repo.tag(&tag_name, head_commit.as_object(), &sig, &msg, false)?;

        // 3. Merge to develop. Roll back the main merge and tag if this fails so
        // the repo is never left half-finished.
        let develop_msg = format!("Merge branch '{}' into {}", current, develop_branch);
        if let Err(e) = merge_no_ff(&repo, &current, &develop_branch, &develop_msg) {
            rollback_main_and_tag(&repo, &main_branch, main_pre_merge, &tag_name);
            return Err(e);
        }

        // 4. Delete hotfix branch
        let mut branch = repo.find_branch(&current, BranchType::Local)?;
        branch.delete()?;

        Ok(tag_name)
    })
    .await
    .map_err(|e| GitflowError::Git(format!("Task error: {}", e)))?
}

// ============================================================================
// Status and Control Commands
// ============================================================================

/// Flow type for active workflow.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum FlowType {
    Feature,
    Release,
    Hotfix,
}

/// Information about active Gitflow workflow.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ActiveFlow {
    pub flow_type: FlowType,
    pub name: String,
    pub source_branch: String,
}

/// Status of Gitflow operations for UI consumption.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitflowStatus {
    pub current_branch: String,
    pub is_gitflow_ready: bool,
    pub can_start_feature: bool,
    pub can_finish_feature: bool,
    pub can_start_release: bool,
    pub can_finish_release: bool,
    pub can_start_hotfix: bool,
    pub can_finish_hotfix: bool,
    pub can_abort: bool,
    pub active_flow: Option<ActiveFlow>,
    /// Context about the repository's Gitflow state
    pub context: GitflowContext,
}

/// Get current Gitflow status for UI.
#[tauri::command]
#[specta::specta]
pub async fn get_gitflow_status(
    state: State<'_, RepositoryState>,
) -> Result<GitflowStatus, GitflowError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or(GitflowError::Git("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let ctx = GitflowContext::from_repo(&repo)?;

        let active_flow = match &ctx.state {
            GitflowState::Feature { name } => Some(ActiveFlow {
                flow_type: FlowType::Feature,
                name: name.clone(),
                source_branch: "develop".to_string(),
            }),
            GitflowState::Release { version } => Some(ActiveFlow {
                flow_type: FlowType::Release,
                name: version.clone(),
                source_branch: "develop".to_string(),
            }),
            GitflowState::Hotfix { name } => Some(ActiveFlow {
                flow_type: FlowType::Hotfix,
                name: name.clone(),
                source_branch: "main".to_string(),
            }),
            GitflowState::Idle => None,
        };

        // Check for existing release/hotfix branches (even if not on them)
        let has_active_release = repo
            .branches(Some(BranchType::Local))?
            .filter_map(|b| b.ok())
            .any(|(b, _)| {
                b.name()
                    .ok()
                    .flatten()
                    .map(|n| n.starts_with("release/"))
                    .unwrap_or(false)
            });
        let has_active_hotfix = repo
            .branches(Some(BranchType::Local))?
            .filter_map(|b| b.ok())
            .any(|(b, _)| {
                b.name()
                    .ok()
                    .flatten()
                    .map(|n| n.starts_with("hotfix/"))
                    .unwrap_or(false)
            });

        Ok(GitflowStatus {
            current_branch: ctx.current_branch.clone(),
            is_gitflow_ready: ctx.is_gitflow_ready(),
            can_start_feature: ctx.is_gitflow_ready() && ctx.on_develop(),
            can_finish_feature: matches!(ctx.state, GitflowState::Feature { .. }),
            can_start_release: ctx.is_gitflow_ready() && ctx.on_develop() && !has_active_release,
            can_finish_release: matches!(ctx.state, GitflowState::Release { .. }),
            can_start_hotfix: ctx.is_gitflow_ready() && ctx.on_main() && !has_active_hotfix,
            can_finish_hotfix: matches!(ctx.state, GitflowState::Hotfix { .. }),
            can_abort: !matches!(ctx.state, GitflowState::Idle),
            active_flow,
            context: ctx,
        })
    })
    .await
    .map_err(|e| GitflowError::Git(format!("Task error: {}", e)))?
}

/// Abort current Gitflow operation, returning to source branch.
#[tauri::command]
#[specta::specta]
pub async fn abort_gitflow(state: State<'_, RepositoryState>) -> Result<(), GitflowError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or(GitflowError::Git("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        ensure_clean_working_tree(&repo)?;
        let ctx = GitflowContext::from_repo(&repo)?;

        let (branch_to_delete, target_branch) = match &ctx.state {
            GitflowState::Feature { .. } => {
                (ctx.current_branch.clone(), resolve_develop_branch(&repo))
            }
            GitflowState::Release { .. } => {
                (ctx.current_branch.clone(), resolve_develop_branch(&repo))
            }
            GitflowState::Hotfix { .. } => {
                (ctx.current_branch.clone(), resolve_main_branch(&repo))
            }
            GitflowState::Idle => {
                return Err(GitflowError::Git("No active Gitflow operation".to_string()))
            }
        };

        // Checkout target branch
        let refname = format!("refs/heads/{}", target_branch);
        repo.set_head(&refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;

        // Delete the workflow branch
        let mut branch = repo.find_branch(&branch_to_delete, BranchType::Local)?;
        branch.delete()?;

        Ok(())
    })
    .await
    .map_err(|e| GitflowError::Git(format!("Task error: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Repository;
    use tempfile::TempDir;

    /// Create a fresh repository with an initial commit on `main` and a deterministic
    /// signature so commits/merges succeed without relying on a global git config.
    fn init_repo() -> (TempDir, Repository) {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
        {
            let mut cfg = repo.config().unwrap();
            cfg.set_str("user.name", "Test").unwrap();
            cfg.set_str("user.email", "test@example.com").unwrap();
        }
        // Point HEAD at an unborn `main` so the initial commit lands on `main`
        // regardless of the system's configured default branch name.
        repo.set_head("refs/heads/main").unwrap();
        let sig = repo.signature().unwrap();
        let tree_oid = {
            let mut index = repo.index().unwrap();
            index.write_tree().unwrap()
        };
        {
            let tree = repo.find_tree(tree_oid).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "initial", &tree, &[])
                .unwrap();
        }
        (dir, repo)
    }

    /// Add and commit a file with the given contents on the current HEAD.
    fn commit_file(repo: &Repository, name: &str, contents: &str, msg: &str) -> git2::Oid {
        let workdir = repo.workdir().unwrap().to_path_buf();
        std::fs::write(workdir.join(name), contents).unwrap();
        let sig = repo.signature().unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new(name)).unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &[&parent])
            .unwrap()
    }

    fn checkout(repo: &Repository, branch: &str) {
        repo.set_head(&format!("refs/heads/{}", branch)).unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
            .unwrap();
    }

    #[test]
    fn resolve_develop_falls_back_to_develop_by_default() {
        let (_dir, repo) = init_repo();
        // No develop branch yet -> default name "develop".
        assert_eq!(resolve_develop_branch(&repo), "develop");
    }

    #[test]
    fn resolve_develop_detects_development_branch() {
        let (_dir, repo) = init_repo();
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("development", &head, false).unwrap();
        // Only "development" exists -> it should be resolved.
        assert_eq!(resolve_develop_branch(&repo), "development");
    }

    #[test]
    fn resolve_develop_honors_configured_name() {
        let (_dir, repo) = init_repo();
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("development", &head, false).unwrap();
        {
            let mut cfg = repo.config().unwrap();
            cfg.set_str("gitflow.branch.main", "main").unwrap();
            cfg.set_str("gitflow.branch.develop", "development").unwrap();
        }
        assert_eq!(resolve_develop_branch(&repo), "development");
    }

    #[test]
    fn resolve_main_detects_master() {
        let (_dir, repo) = init_repo();
        // Rename main -> master so only master exists.
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("master", &head, false).unwrap();
        repo.set_head("refs/heads/master").unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
            .unwrap();
        repo.find_branch("main", BranchType::Local)
            .unwrap()
            .delete()
            .unwrap();
        assert_eq!(resolve_main_branch(&repo), "master");
    }

    #[test]
    fn merge_would_conflict_detects_conflict() {
        let (_dir, repo) = init_repo();
        // Create develop from main.
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("develop", &head, false).unwrap();

        // Diverge develop: edit shared.txt one way.
        checkout(&repo, "develop");
        commit_file(&repo, "shared.txt", "from develop\n", "develop edit");

        // Diverge main into a feature branch: edit shared.txt the other way.
        checkout(&repo, "main");
        repo.branch("feature/x", &repo.head().unwrap().peel_to_commit().unwrap(), false)
            .unwrap();
        checkout(&repo, "feature/x");
        commit_file(&repo, "shared.txt", "from feature\n", "feature edit");

        // Merging feature into develop must conflict, and the check must NOT
        // mutate the repo (we should still be on feature/x with a clean tree).
        let conflict = merge_would_conflict(&repo, "feature/x", "develop").unwrap();
        assert!(conflict, "expected conflicting merge to be detected");
        assert_eq!(
            repo.head().unwrap().shorthand().unwrap(),
            "feature/x",
            "dry-run merge must not move HEAD"
        );
        assert!(
            !repo.index().unwrap().has_conflicts(),
            "dry-run merge must not leave the on-disk index in a conflicted state"
        );
    }

    #[test]
    fn merge_would_conflict_clean_merge_returns_false() {
        let (_dir, repo) = init_repo();
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("develop", &head, false).unwrap();

        // Feature edits a different file than develop -> no conflict.
        checkout(&repo, "develop");
        commit_file(&repo, "dev_only.txt", "dev\n", "develop edit");

        checkout(&repo, "main");
        repo.branch("feature/y", &repo.head().unwrap().peel_to_commit().unwrap(), false)
            .unwrap();
        checkout(&repo, "feature/y");
        commit_file(&repo, "feat_only.txt", "feat\n", "feature edit");

        assert!(!merge_would_conflict(&repo, "feature/y", "develop").unwrap());
    }
}
