use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Content from all three sides of a merge conflict.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictContent {
    /// Path of the conflicted file (relative to repo root)
    pub path: String,
    /// Content from the "ours" side (current branch / HEAD)
    pub ours: Option<String>,
    /// Content from the "theirs" side (incoming branch)
    pub theirs: Option<String>,
    /// Content from the common ancestor (base)
    pub base: Option<String>,
    /// Label for the "ours" side (e.g., "main" or "HEAD")
    pub ours_name: String,
    /// Label for the "theirs" side (e.g., "feature/xyz")
    pub theirs_name: String,
}

/// List all conflicted file paths from the git index.
///
/// Returns an empty Vec if no conflicts exist (not an error).
#[tauri::command]
#[specta::specta]
pub async fn list_conflict_files(
    state: State<'_, RepositoryState>,
) -> Result<Vec<String>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let index = repo.index()?;

        let mut paths = Vec::new();
        for conflict in index.conflicts()? {
            if let Ok(conflict) = conflict {
                // Prefer our path, then their, then ancestor
                let path = conflict
                    .our
                    .as_ref()
                    .or(conflict.their.as_ref())
                    .or(conflict.ancestor.as_ref())
                    .and_then(|entry| std::str::from_utf8(&entry.path).ok())
                    .map(|s| s.to_string());

                if let Some(p) = path {
                    paths.push(p);
                }
            }
        }

        Ok(paths)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Read ours/theirs/base content for a specific conflicted file from index stages.
///
/// Uses git2 index stages (1=ancestor, 2=ours, 3=theirs) to read clean content
/// without conflict markers. Returns NotFound if the file is not in the conflict list.
#[tauri::command]
#[specta::specta]
pub async fn get_conflict_content(
    path: String,
    state: State<'_, RepositoryState>,
) -> Result<ConflictContent, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let index = repo.index()?;

        // Get conflict entry for this specific path
        let conflict = index
            .conflict_get(Path::new(&path))
            .map_err(|_| GitError::FileNotConflicted(path.clone()))?;

        // Read blob content for each side that exists
        let read_blob = |entry: &Option<git2::IndexEntry>| -> Option<String> {
            entry.as_ref().and_then(|e| {
                repo.find_blob(e.id)
                    .ok()
                    .map(|blob| String::from_utf8_lossy(blob.content()).to_string())
            })
        };

        let ours = read_blob(&conflict.our);
        let theirs = read_blob(&conflict.their);
        let base = read_blob(&conflict.ancestor);

        // Determine branch names
        let ours_name = repo
            .head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()))
            .unwrap_or_else(|| "HEAD".to_string());

        let theirs_name = {
            let merge_head_path = repo.path().join("MERGE_HEAD");
            if merge_head_path.exists() {
                // Try to resolve MERGE_HEAD to a branch name
                std::fs::read_to_string(&merge_head_path)
                    .ok()
                    .and_then(|oid_str| {
                        let oid_str = oid_str.trim();
                        git2::Oid::from_str(oid_str).ok().and_then(|oid| {
                            // Check all branches to find one pointing to this commit
                            repo.branches(Some(git2::BranchType::Local))
                                .ok()
                                .and_then(|mut branches| {
                                    branches.find_map(|b| {
                                        b.ok().and_then(|(branch, _)| {
                                            branch.get().target().and_then(|target| {
                                                if target == oid {
                                                    branch.name().ok().flatten().map(|n| n.to_string())
                                                } else {
                                                    None
                                                }
                                            })
                                        })
                                    })
                                })
                        })
                    })
                    .unwrap_or_else(|| "MERGE_HEAD".to_string())
            } else {
                "MERGE_HEAD".to_string()
            }
        };

        // Verify at least one side has content
        if ours.is_none() && theirs.is_none() && base.is_none() {
            return Err(GitError::FileNotConflicted(path));
        }

        Ok(ConflictContent {
            path,
            ours,
            theirs,
            base,
            ours_name,
            theirs_name,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Write resolved content to a conflicted file, stage it, and clear the conflict.
///
/// Writes the resolved content to the working directory file, then stages it
/// via `index.add_path()` which automatically clears the conflict entry.
#[tauri::command]
#[specta::specta]
pub async fn resolve_conflict_file(
    path: String,
    content: String,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Verify a merge is in progress
        if repo.state() != git2::RepositoryState::Merge {
            return Err(GitError::NoMergeInProgress);
        }

        // Verify the file is actually conflicted
        let index = repo.index()?;
        index
            .conflict_get(Path::new(&path))
            .map_err(|_| GitError::FileNotConflicted(path.clone()))?;
        drop(index);

        // Write resolved content to the working directory file
        let file_path = repo_path.join(&path);
        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                GitError::OperationFailed(format!("Failed to create directories: {}", e))
            })?;
        }
        std::fs::write(&file_path, &content).map_err(|e| {
            GitError::OperationFailed(format!("Failed to write resolved file: {}", e))
        })?;

        // Stage the file — this clears the conflict entry from the index
        let mut index = repo.index()?;
        index.add_path(Path::new(&path))?;
        index.write()?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
