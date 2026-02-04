use serde::{Deserialize, Serialize};
use specta::Type;
use std::cell::RefCell;
use std::collections::HashMap;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Summary of a commit for list display.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitSummary {
    pub oid: String,
    pub short_oid: String,
    pub message_subject: String,
    pub author_name: String,
    pub author_email: String,
    /// Unix timestamp in milliseconds (safe for JS Number up to year 275760)
    pub timestamp_ms: f64,
}

/// A file changed in a commit.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileChanged {
    pub path: String,
    pub status: String,
    pub additions: i32,
    pub deletions: i32,
}

/// Full details of a commit.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetails {
    pub oid: String,
    pub short_oid: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    /// Unix timestamp in milliseconds (safe for JS Number)
    pub author_timestamp_ms: f64,
    pub committer_name: String,
    pub committer_email: String,
    /// Unix timestamp in milliseconds (safe for JS Number)
    pub committer_timestamp_ms: f64,
    pub parent_oids: Vec<String>,
    pub files_changed: Vec<FileChanged>,
}

/// Get paginated commit history.
///
/// Returns commits starting from HEAD, sorted by time.
/// Use skip and limit for pagination.
#[tauri::command]
#[specta::specta]
pub async fn get_commit_history(
    skip: u32,
    limit: u32,
    state: State<'_, RepositoryState>,
) -> Result<Vec<CommitSummary>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Handle empty repo
        match repo.head() {
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                return Ok(vec![]);
            }
            Err(e) => return Err(e.into()),
            Ok(_) => {}
        }

        let mut revwalk = repo.revwalk()?;
        revwalk.push_head()?;
        revwalk.set_sorting(git2::Sort::TIME)?;

        let commits: Vec<CommitSummary> = revwalk
            .skip(skip as usize)
            .take(limit as usize)
            .filter_map(|oid| oid.ok())
            .filter_map(|oid| {
                let commit = repo.find_commit(oid).ok()?;
                let author = commit.author();

                Some(CommitSummary {
                    oid: oid.to_string(),
                    short_oid: format!("{:.7}", oid),
                    message_subject: commit.summary().unwrap_or("").to_string(),
                    author_name: author.name().unwrap_or("Unknown").to_string(),
                    author_email: author.email().unwrap_or("").to_string(),
                    timestamp_ms: (author.when().seconds() as f64) * 1000.0,
                })
            })
            .collect();

        Ok(commits)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Get full details of a specific commit.
#[tauri::command]
#[specta::specta]
pub async fn get_commit_details(
    oid: String,
    state: State<'_, RepositoryState>,
) -> Result<CommitDetails, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let commit_oid = git2::Oid::from_str(&oid)
            .map_err(|e| GitError::OperationFailed(format!("Invalid OID: {}", e)))?;

        let commit = repo.find_commit(commit_oid)?;
        let author = commit.author();
        let committer = commit.committer();

        // Get parent OIDs
        let parent_oids: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();

        // Get files changed by diffing against first parent (or empty tree)
        let commit_tree = commit.tree()?;
        let parent_tree = if commit.parent_count() > 0 {
            Some(commit.parent(0)?.tree()?)
        } else {
            None
        };

        let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)?;

        // Use RefCell to allow interior mutability for the closures
        let files_changed: RefCell<Vec<FileChanged>> = RefCell::new(Vec::new());
        let stats_map: RefCell<HashMap<String, (i32, i32)>> = RefCell::new(HashMap::new());

        // First pass: collect file list and initialize stats
        diff.foreach(
            &mut |delta, _| {
                let path = delta
                    .new_file()
                    .path()
                    .or_else(|| delta.old_file().path())
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                let status = match delta.status() {
                    git2::Delta::Added => "added",
                    git2::Delta::Deleted => "deleted",
                    git2::Delta::Modified => "modified",
                    git2::Delta::Renamed => "renamed",
                    git2::Delta::Copied => "copied",
                    _ => "modified",
                };

                files_changed.borrow_mut().push(FileChanged {
                    path: path.clone(),
                    status: status.to_string(),
                    additions: 0,
                    deletions: 0,
                });

                stats_map.borrow_mut().insert(path, (0, 0));
                true
            },
            None,
            None,
            Some(&mut |delta, _hunk, line| {
                let path = delta
                    .new_file()
                    .path()
                    .or_else(|| delta.old_file().path())
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                if let Some(stats) = stats_map.borrow_mut().get_mut(&path) {
                    match line.origin() {
                        '+' => stats.0 += 1,
                        '-' => stats.1 += 1,
                        _ => {}
                    }
                }
                true
            }),
        )?;

        // Apply stats to files_changed
        let stats = stats_map.into_inner();
        let mut files = files_changed.into_inner();
        for file in &mut files {
            if let Some((additions, deletions)) = stats.get(&file.path) {
                file.additions = *additions;
                file.deletions = *deletions;
            }
        }

        Ok(CommitDetails {
            oid: commit_oid.to_string(),
            short_oid: format!("{:.7}", commit_oid),
            message: commit.message().unwrap_or("").to_string(),
            author_name: author.name().unwrap_or("Unknown").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            author_timestamp_ms: (author.when().seconds() as f64) * 1000.0,
            committer_name: committer.name().unwrap_or("Unknown").to_string(),
            committer_email: committer.email().unwrap_or("").to_string(),
            committer_timestamp_ms: (committer.when().seconds() as f64) * 1000.0,
            parent_oids,
            files_changed: files,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Search commits by message text.
/// Returns up to `limit` commits whose message contains `query` (case-insensitive).
#[tauri::command]
#[specta::specta]
pub async fn search_commits(
    query: String,
    limit: u32,
    state: State<'_, RepositoryState>,
) -> Result<Vec<CommitSummary>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    let query_lower = query.to_lowercase();

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Handle empty repo
        match repo.head() {
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                return Ok(vec![]);
            }
            Err(e) => return Err(e.into()),
            Ok(_) => {}
        }

        let mut revwalk = repo.revwalk()?;
        revwalk.push_head()?;
        revwalk.set_sorting(git2::Sort::TIME)?;

        let mut results = Vec::new();

        for oid_result in revwalk {
            if results.len() >= limit as usize {
                break;
            }

            let oid = match oid_result {
                Ok(o) => o,
                Err(_) => continue,
            };

            let commit = match repo.find_commit(oid) {
                Ok(c) => c,
                Err(_) => continue,
            };

            // Check if message contains query (case-insensitive)
            let message = commit.message().unwrap_or("");
            if message.to_lowercase().contains(&query_lower) {
                let author = commit.author();
                results.push(CommitSummary {
                    oid: oid.to_string(),
                    short_oid: format!("{:.7}", oid),
                    message_subject: commit.summary().unwrap_or("").to_string(),
                    author_name: author.name().unwrap_or("Unknown").to_string(),
                    author_email: author.email().unwrap_or("").to_string(),
                    timestamp_ms: (author.when().seconds() as f64) * 1000.0,
                });
            }
        }

        Ok(results)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
