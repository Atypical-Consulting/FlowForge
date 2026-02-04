use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;

use crate::git::error::GitError;

/// Status of a worktree's working directory.
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum WorktreeStatus {
    /// No uncommitted changes
    Clean,
    /// Has uncommitted changes
    Dirty,
    /// Has unresolved merge conflicts
    Conflicts,
    /// Worktree is invalid or corrupted
    Invalid,
}

/// Information about a git worktree.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    /// Worktree name (for linked worktrees) or "main" for the main worktree
    pub name: String,
    /// Absolute path to the worktree directory
    pub path: String,
    /// Branch checked out in this worktree (None if detached HEAD)
    pub branch: Option<String>,
    /// Current status of the worktree
    pub status: WorktreeStatus,
    /// True if this is the main worktree (not a linked worktree)
    pub is_main: bool,
    /// True if the worktree is locked
    pub is_locked: bool,
}

/// Options for creating a new worktree.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorktreeOptions {
    /// Name for the worktree
    pub name: String,
    /// Path where the worktree will be created
    pub path: String,
    /// Branch to checkout (None for detached HEAD at current commit)
    pub branch: Option<String>,
    /// If true and branch is Some, create a new branch with that name
    pub create_branch: bool,
}

/// Get the status of a repository's working directory.
fn get_worktree_status(repo: &git2::Repository) -> WorktreeStatus {
    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(false)
        .exclude_submodules(true);

    match repo.statuses(Some(&mut opts)) {
        Ok(statuses) => {
            let has_conflicts = statuses
                .iter()
                .any(|entry| entry.status().contains(git2::Status::CONFLICTED));

            if has_conflicts {
                WorktreeStatus::Conflicts
            } else if statuses.is_empty() {
                WorktreeStatus::Clean
            } else {
                WorktreeStatus::Dirty
            }
        }
        Err(_) => WorktreeStatus::Invalid,
    }
}

/// Get information about the main worktree (the repository itself).
fn get_main_worktree_info(repo: &git2::Repository) -> Result<WorktreeInfo, GitError> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| GitError::OperationFailed("Repository is bare".to_string()))?;

    let branch = match repo.head() {
        Ok(head) => head.shorthand().map(String::from),
        Err(e) if e.code() == git2::ErrorCode::UnbornBranch => Some("main".to_string()),
        Err(_) => None,
    };

    let status = get_worktree_status(repo);

    Ok(WorktreeInfo {
        name: "main".to_string(),
        path: workdir.display().to_string(),
        branch,
        status,
        is_main: true,
        is_locked: false,
    })
}

/// Get information about a linked worktree.
fn get_worktree_info(
    _main_repo: &git2::Repository,
    worktree: &git2::Worktree,
) -> Result<WorktreeInfo, GitError> {
    let name = worktree
        .name()
        .ok_or_else(|| GitError::OperationFailed("Worktree has no name".to_string()))?
        .to_string();

    let path = worktree.path().display().to_string();

    // Check if worktree is valid
    if worktree.validate().is_err() {
        return Ok(WorktreeInfo {
            name,
            path,
            branch: None,
            status: WorktreeStatus::Invalid,
            is_main: false,
            is_locked: matches!(
                worktree.is_locked(),
                Ok(git2::WorktreeLockStatus::Locked(_))
            ),
        });
    }

    // Open the worktree as a repository to get branch and status
    let wt_repo = git2::Repository::open(worktree.path())?;

    let branch = match wt_repo.head() {
        Ok(head) => head.shorthand().map(String::from),
        Err(e) if e.code() == git2::ErrorCode::UnbornBranch => Some("main".to_string()),
        Err(_) => None,
    };

    let status = get_worktree_status(&wt_repo);

    Ok(WorktreeInfo {
        name,
        path,
        branch,
        status,
        is_main: false,
        is_locked: matches!(
            worktree.is_locked(),
            Ok(git2::WorktreeLockStatus::Locked(_))
        ),
    })
}

/// List all worktrees for a repository.
///
/// Returns the main worktree first, followed by any linked worktrees.
pub fn list_worktrees_internal(repo_path: &Path) -> Result<Vec<WorktreeInfo>, GitError> {
    let repo = git2::Repository::open(repo_path)?;
    let mut worktrees = Vec::new();

    // Add main worktree first
    worktrees.push(get_main_worktree_info(&repo)?);

    // Add linked worktrees
    if let Ok(wt_names) = repo.worktrees() {
        for name in wt_names.iter().flatten() {
            if let Ok(wt) = repo.find_worktree(name) {
                if let Ok(info) = get_worktree_info(&repo, &wt) {
                    worktrees.push(info);
                }
            }
        }
    }

    Ok(worktrees)
}

/// Create a new worktree.
///
/// If `options.create_branch` is true and `options.branch` is Some,
/// creates a new branch from HEAD before creating the worktree.
pub fn create_worktree_internal(
    repo_path: &Path,
    options: CreateWorktreeOptions,
) -> Result<WorktreeInfo, GitError> {
    let repo = git2::Repository::open(repo_path)?;

    // Resolve or create branch reference
    let reference = if let Some(ref branch_name) = options.branch {
        if options.create_branch {
            // Create new branch from HEAD
            let head_commit = repo.head()?.peel_to_commit()?;
            repo.branch(branch_name, &head_commit, false)?;
        }
        Some(
            repo.find_branch(branch_name, git2::BranchType::Local)?
                .into_reference(),
        )
    } else {
        None
    };

    // Create worktree
    let worktree_path = Path::new(&options.path);
    let worktree = if let Some(ref r) = reference {
        let mut add_opts = git2::WorktreeAddOptions::new();
        add_opts.reference(Some(r));
        repo.worktree(&options.name, worktree_path, Some(&add_opts))?
    } else {
        repo.worktree(&options.name, worktree_path, None)?
    };

    get_worktree_info(&repo, &worktree)
}

/// Delete a worktree.
///
/// If `force` is true, delete even if the worktree has uncommitted changes.
/// If `delete_branch` is true, also delete the branch checked out in the worktree.
pub fn delete_worktree_internal(
    repo_path: &Path,
    name: &str,
    force: bool,
    delete_branch: bool,
) -> Result<(), GitError> {
    let repo = git2::Repository::open(repo_path)?;
    let worktree = repo.find_worktree(name)?;

    // Get branch name before deletion if we need to delete it
    let branch_to_delete = if delete_branch {
        if let Ok(wt_repo) = git2::Repository::open(worktree.path()) {
            wt_repo
                .head()
                .ok()
                .and_then(|h| h.shorthand().map(String::from))
        } else {
            None
        }
    } else {
        None
    };

    // Check if worktree is dirty (unless forcing)
    if !force {
        if let Ok(wt_repo) = git2::Repository::open(worktree.path()) {
            let status = get_worktree_status(&wt_repo);
            if status == WorktreeStatus::Dirty || status == WorktreeStatus::Conflicts {
                return Err(GitError::DirtyWorkingDirectory);
            }
        }
    }

    // Prune worktree
    let mut prune_opts = git2::WorktreePruneOptions::new();
    if force {
        prune_opts.valid(true).working_tree(true);
    }

    worktree.prune(Some(&mut prune_opts))?;

    // Delete branch if requested
    if let Some(branch_name) = branch_to_delete {
        if let Ok(mut branch) = repo.find_branch(&branch_name, git2::BranchType::Local) {
            // Silent fail is OK, branch might not be merged or might be checked out elsewhere
            let _ = branch.delete();
        }
    }

    Ok(())
}
