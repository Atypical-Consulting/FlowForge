//! Branch information for pre-filling the Create PR form.
//!
//! Provides a Tauri command that reads the current branch,
//! detects the default base branch, generates a suggested title,
//! and collects commit messages ahead of the base.

use super::error::GitHubError;
use super::types::BranchInfoForPr;
use crate::git::RepositoryState;
use tauri::State;

/// Get branch information for pre-filling the Create PR form.
///
/// Reads the current branch, detects the default base (main/master),
/// generates a title from the branch name, and collects commit
/// messages ahead of the base branch.
#[tauri::command]
#[specta::specta]
pub async fn github_get_branch_info_for_pr(
    state: State<'_, RepositoryState>,
) -> Result<BranchInfoForPr, GitHubError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitHubError::Internal("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)
            .map_err(|e| GitHubError::Internal(format!("Failed to open repository: {}", e)))?;

        // Get current branch name
        let head = repo
            .head()
            .map_err(|e| GitHubError::Internal(format!("Failed to get HEAD: {}", e)))?;
        let current_branch = head
            .shorthand()
            .unwrap_or("HEAD")
            .to_string();

        // Detect default base branch (check for origin/main, then origin/master)
        let default_base = if repo
            .find_reference("refs/remotes/origin/main")
            .is_ok()
        {
            "main".to_string()
        } else if repo
            .find_reference("refs/remotes/origin/master")
            .is_ok()
        {
            "master".to_string()
        } else {
            "main".to_string()
        };

        // Generate suggested title from branch name
        let suggested_title = branch_name_to_title(&current_branch);

        // Collect commit messages ahead of base
        let commit_messages = collect_commits_ahead(&repo, &default_base).unwrap_or_default();

        Ok(BranchInfoForPr {
            current_branch,
            default_base,
            suggested_title,
            commit_messages,
        })
    })
    .await
    .map_err(|e| GitHubError::Internal(format!("Task join error: {}", e)))?
}

/// Convert a branch name like "feature/add-dark-mode" to "Add dark mode".
fn branch_name_to_title(branch: &str) -> String {
    // Strip common prefixes
    let stripped = branch
        .strip_prefix("feature/")
        .or_else(|| branch.strip_prefix("fix/"))
        .or_else(|| branch.strip_prefix("hotfix/"))
        .or_else(|| branch.strip_prefix("bugfix/"))
        .or_else(|| branch.strip_prefix("release/"))
        .or_else(|| branch.strip_prefix("chore/"))
        .unwrap_or(branch);

    // Replace separators with spaces and capitalize first letter
    let title: String = stripped
        .replace('-', " ")
        .replace('_', " ");

    let mut chars = title.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => {
            let upper: String = first.to_uppercase().collect();
            upper + chars.as_str()
        }
    }
}

/// Collect commit summaries from HEAD back to the merge-base with origin/{base}.
fn collect_commits_ahead(
    repo: &git2::Repository,
    default_base: &str,
) -> Result<Vec<String>, git2::Error> {
    let head_oid = repo.head()?.target().ok_or_else(|| {
        git2::Error::from_str("HEAD is not a direct reference")
    })?;

    let base_ref_name = format!("refs/remotes/origin/{}", default_base);
    let base_ref = match repo.find_reference(&base_ref_name) {
        Ok(r) => r,
        Err(_) => return Ok(vec![]), // No remote base to compare against
    };
    let base_oid = base_ref.target().ok_or_else(|| {
        git2::Error::from_str("Base reference is not a direct reference")
    })?;

    let merge_base = match repo.merge_base(head_oid, base_oid) {
        Ok(mb) => mb,
        Err(_) => return Ok(vec![]), // No common ancestor
    };

    let mut revwalk = repo.revwalk()?;
    revwalk.push(head_oid)?;
    revwalk.set_sorting(git2::Sort::TOPOLOGICAL)?;

    let mut messages = Vec::new();
    for oid_result in revwalk {
        let oid = oid_result?;
        if oid == merge_base {
            break;
        }
        if let Ok(commit) = repo.find_commit(oid) {
            if let Some(summary) = commit.summary() {
                messages.push(summary.to_string());
            }
        }
    }

    Ok(messages)
}
