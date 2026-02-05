//! Gitflow workflow commands for Tauri IPC.

use git2::BranchType;
use serde::Serialize;
use specta::Type;
use tauri::State;

use crate::git::repository::RepositoryState;
use crate::gitflow::error::GitflowError;
use crate::gitflow::machine::GitflowState;
use crate::gitflow::merge::merge_no_ff;
use crate::gitflow::policy::{
    is_develop_branch, is_main_branch, is_valid_feature_name, is_valid_version,
};
use crate::gitflow::state::{get_current_branch_name, GitflowContext};

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

        // Checkout new branch
        let refname = format!("refs/heads/{}", branch_name);
        repo.set_head(&refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;

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

        // Must be on feature branch
        let current = get_current_branch_name(&repo)?
            .ok_or(GitflowError::Git("HEAD is detached".to_string()))?;

        let _feature_name = current
            .strip_prefix("feature/")
            .ok_or(GitflowError::NotOnFeatureBranch)?;

        // Merge to develop with --no-ff
        let message = format!("Merge branch '{}' into develop", current);
        merge_no_ff(&repo, &current, "develop", &message)?;

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
            if let Some(name) = branch.name()? {
                if name.starts_with("release/") {
                    return Err(GitflowError::ReleaseInProgress(name.to_string()));
                }
            }
        }

        let branch_name = format!("release/{}", version);

        // Check branch doesn't exist
        if repo.find_branch(&branch_name, BranchType::Local).is_ok() {
            return Err(GitflowError::BranchExists(branch_name));
        }

        // Create and checkout
        let head_commit = repo.head()?.peel_to_commit()?;
        repo.branch(&branch_name, &head_commit, false)?;
        let refname = format!("refs/heads/{}", branch_name);
        repo.set_head(&refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;

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

        // Must be on release branch
        let current = get_current_branch_name(&repo)?
            .ok_or(GitflowError::Git("HEAD is detached".to_string()))?;

        let version = current
            .strip_prefix("release/")
            .ok_or(GitflowError::NotOnReleaseBranch)?
            .to_string();

        // 1. Merge to main with --no-ff
        let main_branch = if repo.find_branch("main", BranchType::Local).is_ok() {
            "main"
        } else {
            "master"
        };
        let main_msg = format!("Merge branch '{}' into {}", current, main_branch);
        merge_no_ff(&repo, &current, main_branch, &main_msg)?;

        // 2. Create tag on main (we're now on main after merge)
        let tag_name = format!("v{}", version);
        let msg = tag_message.unwrap_or_else(|| format!("Release {}", version));
        let head_commit = repo.head()?.peel_to_commit()?;
        let sig = repo.signature()?;
        repo.tag(&tag_name, head_commit.as_object(), &sig, &msg, false)?;

        // 3. Merge to develop with --no-ff
        let develop_msg = format!("Merge branch '{}' into develop", current);
        merge_no_ff(&repo, &current, "develop", &develop_msg)?;

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
            if let Some(bname) = branch.name()? {
                if bname.starts_with("hotfix/") {
                    return Err(GitflowError::HotfixInProgress(bname.to_string()));
                }
            }
        }

        let branch_name = format!("hotfix/{}", name);

        if repo.find_branch(&branch_name, BranchType::Local).is_ok() {
            return Err(GitflowError::BranchExists(branch_name));
        }

        let head_commit = repo.head()?.peel_to_commit()?;
        repo.branch(&branch_name, &head_commit, false)?;
        let refname = format!("refs/heads/{}", branch_name);
        repo.set_head(&refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;

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

        let current = get_current_branch_name(&repo)?
            .ok_or(GitflowError::Git("HEAD is detached".to_string()))?;

        let hotfix_name = current
            .strip_prefix("hotfix/")
            .ok_or(GitflowError::NotOnHotfixBranch)?
            .to_string();

        // 1. Merge to main
        let main_branch = if repo.find_branch("main", BranchType::Local).is_ok() {
            "main"
        } else {
            "master"
        };
        let main_msg = format!("Merge branch '{}' into {}", current, main_branch);
        merge_no_ff(&repo, &current, main_branch, &main_msg)?;

        // 2. Create tag on main
        let tag_name = format!("hotfix-{}", hotfix_name);
        let msg = tag_message.unwrap_or_else(|| format!("Hotfix {}", hotfix_name));
        let head_commit = repo.head()?.peel_to_commit()?;
        let sig = repo.signature()?;
        repo.tag(&tag_name, head_commit.as_object(), &sig, &msg, false)?;

        // 3. Merge to develop
        let develop_msg = format!("Merge branch '{}' into develop", current);
        merge_no_ff(&repo, &current, "develop", &develop_msg)?;

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
        let ctx = GitflowContext::from_repo(&repo)?;

        let (branch_to_delete, target_branch) = match &ctx.state {
            GitflowState::Feature { .. } => (ctx.current_branch.clone(), "develop"),
            GitflowState::Release { .. } => (ctx.current_branch.clone(), "develop"),
            GitflowState::Hotfix { .. } => {
                let main = if repo.find_branch("main", BranchType::Local).is_ok() {
                    "main"
                } else {
                    "master"
                };
                (ctx.current_branch.clone(), main)
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
