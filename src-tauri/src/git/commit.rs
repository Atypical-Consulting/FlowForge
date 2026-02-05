use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Information about a created commit.
///
/// Returned after successful commit creation to confirm
/// the commit was made and provide its identifiers.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    /// Full commit OID (40 hex characters)
    pub oid: String,
    /// Short commit OID (7 characters)
    pub short_oid: String,
    /// Commit message
    pub message: String,
}

/// Last commit message with subject and body parsed separately.
///
/// Used for amend commit pre-fill functionality.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LastCommitMessage {
    /// First line of the commit message
    pub subject: String,
    /// Everything after the first blank line (if exists)
    pub body: Option<String>,
    /// Full commit message
    pub full_message: String,
}

/// Get the last commit message for amend pre-fill.
///
/// Returns the HEAD commit's message parsed into subject and body components.
#[tauri::command]
#[specta::specta]
pub async fn get_last_commit_message(
    state: State<'_, RepositoryState>,
) -> Result<LastCommitMessage, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Get HEAD commit
        let head = repo
            .head()
            .map_err(|_| GitError::EmptyRepository)?;
        let commit = head
            .peel_to_commit()
            .map_err(|_| GitError::EmptyRepository)?;

        let full_message = commit.message().unwrap_or("").to_string();

        // Parse message into subject and body
        let (subject, body) = parse_commit_message(&full_message);

        Ok(LastCommitMessage {
            subject,
            body,
            full_message,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Parse a commit message into subject and body.
///
/// Subject is the first line (before first newline).
/// Body is everything after the first blank line, trimmed.
fn parse_commit_message(message: &str) -> (String, Option<String>) {
    let lines: Vec<&str> = message.lines().collect();

    if lines.is_empty() {
        return (String::new(), None);
    }

    let subject = lines[0].to_string();

    // Find the body (after first blank line)
    let mut body_start = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if line.trim().is_empty() {
            // Found blank line, body starts after this
            if i + 1 < lines.len() {
                body_start = Some(i + 1);
            }
            break;
        }
    }

    let body = body_start.map(|start| {
        lines[start..]
            .join("\n")
            .trim()
            .to_string()
    }).filter(|b| !b.is_empty());

    (subject, body)
}

/// Create a new commit from staged changes.
///
/// Creates a commit with the given message from the current index (staged changes).
/// If `amend` is true, replaces the last commit instead of creating a new one.
///
/// # Errors
/// - `NoStagedChanges` if index is empty (nothing staged)
/// - `SignatureError` if git config lacks user.name/email
/// - Various git2 errors for other failures
#[tauri::command]
#[specta::specta]
pub async fn create_commit(
    message: String,
    amend: bool,
    state: State<'_, RepositoryState>,
) -> Result<CommitInfo, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Get signature from git config
        let sig = repo.signature().map_err(|e| {
            GitError::SignatureError(format!(
                "Could not determine commit author. Please configure git: {}",
                e.message()
            ))
        })?;

        // Get the index and write tree
        let mut index = repo.index()?;
        let tree_oid = index.write_tree()?;
        let tree = repo.find_tree(tree_oid)?;

        // Check if there are staged changes by comparing tree to HEAD
        let has_staged_changes = if amend {
            // For amend, compare new tree to parent's tree (if exists)
            match repo.head() {
                Ok(head) => {
                    let head_commit = head.peel_to_commit()?;
                    if head_commit.parent_count() > 0 {
                        let parent = head_commit.parent(0)?;
                        tree_oid != parent.tree_id()
                    } else {
                        // First commit being amended - always allow
                        true
                    }
                }
                Err(_) => true, // No HEAD, allow commit
            }
        } else {
            // For normal commit, compare tree to HEAD tree
            match repo.head() {
                Ok(head) => {
                    let head_commit = head.peel_to_commit()?;
                    tree_oid != head_commit.tree_id()
                }
                Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                    // First commit - check if tree has any entries
                    tree.len() > 0
                }
                Err(e) => return Err(e.into()),
            }
        };

        if !has_staged_changes {
            return Err(GitError::NoStagedChanges);
        }

        let oid = if amend {
            // Amend: reuse parent's parents
            let head = repo.head()?.peel_to_commit()?;
            let parents: Vec<git2::Commit> = head.parents().collect();
            let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

            repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &parent_refs)?
        } else {
            // Normal commit: HEAD is parent (if exists)
            match repo.head() {
                Ok(head) => {
                    let parent = head.peel_to_commit()?;
                    repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent])?
                }
                Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                    // First commit - no parent
                    repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[])?
                }
                Err(e) => return Err(e.into()),
            }
        };

        Ok(CommitInfo {
            oid: oid.to_string(),
            short_oid: format!("{:.7}", oid),
            message,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
