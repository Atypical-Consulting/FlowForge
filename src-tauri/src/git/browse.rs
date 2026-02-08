use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use super::error::GitError;
use super::repository::RepositoryState;

/// A single entry in a repository directory listing.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u32,
}

/// File content read from the repository at HEAD.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoFileContent {
    pub content: String,
    pub is_binary: bool,
    pub size: u32,
}

/// List files and directories at a given path within the repository.
///
/// Merges entries from the HEAD tree and the working directory so that
/// uncommitted/untracked files are also visible in the browser.
/// Pass an empty string for `path` to list the root directory.
/// Returns directories first, then files, both sorted alphabetically.
#[tauri::command]
#[specta::specta]
pub async fn list_repo_files(
    path: String,
    state: State<'_, RepositoryState>,
) -> Result<Vec<RepoFileEntry>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let mut known_names = std::collections::HashSet::new();
        let mut dirs = Vec::new();
        let mut files = Vec::new();

        // 1. Collect entries from HEAD tree (if it exists)
        if let Ok(head) = repo.head() {
            if let Ok(root_tree) = head.peel_to_tree() {
                let target_tree_opt = if path.is_empty() {
                    Some(root_tree)
                } else {
                    root_tree
                        .get_path(std::path::Path::new(&path))
                        .ok()
                        .and_then(|e| e.to_object(&repo).ok())
                        .and_then(|o| o.into_tree().ok())
                };

                if let Some(target_tree) = target_tree_opt {
                    for entry in target_tree.iter() {
                        let name = entry.name().unwrap_or("").to_string();
                        if name.is_empty() { continue; }
                        let entry_path = if path.is_empty() {
                            name.clone()
                        } else {
                            format!("{}/{}", path, name)
                        };

                        known_names.insert(name.clone());

                        match entry.kind() {
                            Some(git2::ObjectType::Tree) => {
                                dirs.push(RepoFileEntry {
                                    name,
                                    path: entry_path,
                                    is_dir: true,
                                    size: 0,
                                });
                            }
                            Some(git2::ObjectType::Blob) => {
                                let size = entry
                                    .to_object(&repo)
                                    .ok()
                                    .and_then(|o| o.as_blob().map(|b| b.size() as u32))
                                    .unwrap_or(0);

                                files.push(RepoFileEntry {
                                    name,
                                    path: entry_path,
                                    is_dir: false,
                                    size,
                                });
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        // 2. Merge in working-directory entries not already in the tree
        if let Some(workdir) = repo.workdir() {
            let dir_to_scan = if path.is_empty() {
                workdir.to_path_buf()
            } else {
                workdir.join(&path)
            };

            if dir_to_scan.is_dir() {
                if let Ok(read_dir) = std::fs::read_dir(&dir_to_scan) {
                    for dir_entry in read_dir.flatten() {
                        let name = dir_entry.file_name().to_string_lossy().into_owned();
                        // Skip hidden files/dirs (like .git) and already-known entries
                        if name.starts_with('.') || known_names.contains(&name) {
                            continue;
                        }
                        let entry_path = if path.is_empty() {
                            name.clone()
                        } else {
                            format!("{}/{}", path, name)
                        };
                        let is_dir = dir_entry.file_type().map_or(false, |t| t.is_dir());
                        let size = if is_dir {
                            0
                        } else {
                            dir_entry.metadata().map_or(0, |m| m.len() as u32)
                        };

                        if is_dir {
                            dirs.push(RepoFileEntry { name, path: entry_path, is_dir: true, size: 0 });
                        } else {
                            files.push(RepoFileEntry { name, path: entry_path, is_dir: false, size });
                        }
                    }
                }
            }
        }

        // Sort: dirs first alphabetically, then files alphabetically
        dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        dirs.append(&mut files);

        Ok(dirs)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Read file content from the repository at HEAD, with working-directory fallback.
///
/// First tries the git HEAD tree. If the file is not found there (e.g. uncommitted),
/// falls back to reading from the working directory on disk.
/// Binary files are returned as base64-encoded content.
/// Text files are returned as UTF-8 strings.
#[tauri::command]
#[specta::specta]
pub async fn read_repo_file(
    file_path: String,
    state: State<'_, RepositoryState>,
) -> Result<RepoFileContent, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Try reading from HEAD tree first
        if let Ok(result) = read_from_head(&repo, &file_path) {
            return Ok(result);
        }

        // Fallback: read from working directory on disk
        read_from_workdir(&repo, &file_path)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Read a file from the HEAD tree.
fn read_from_head(repo: &git2::Repository, file_path: &str) -> Result<RepoFileContent, GitError> {
    let tree = match repo.head() {
        Ok(head) => head.peel_to_tree().map_err(GitError::from)?,
        Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
            return Err(GitError::EmptyRepository);
        }
        Err(e) => return Err(GitError::from(e)),
    };

    let entry = tree
        .get_path(std::path::Path::new(file_path))
        .map_err(|_| GitError::PathNotFound(file_path.to_string()))?;

    let obj = entry
        .to_object(repo)
        .map_err(|e| GitError::OperationFailed(format!("Failed to resolve file: {}", e)))?;

    let blob = obj
        .as_blob()
        .ok_or_else(|| GitError::OperationFailed(format!("Path is not a file: {}", file_path)))?;

    blob_to_content(blob)
}

/// Read a file from the working directory on disk.
fn read_from_workdir(repo: &git2::Repository, file_path: &str) -> Result<RepoFileContent, GitError> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| GitError::OperationFailed("Bare repository has no working directory".to_string()))?;

    let full_path = workdir.join(file_path);
    let data = std::fs::read(&full_path)
        .map_err(|_| GitError::PathNotFound(file_path.to_string()))?;

    let size = data.len() as u32;

    // Binary detection: check first 8000 bytes for null byte
    let check_len = data.len().min(8000);
    let is_binary = data[..check_len].contains(&0);

    let content = if is_binary {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.encode(&data)
    } else {
        String::from_utf8_lossy(&data).into_owned()
    };

    Ok(RepoFileContent {
        content,
        is_binary,
        size,
    })
}

/// Convert a git blob to RepoFileContent.
fn blob_to_content(blob: &git2::Blob<'_>) -> Result<RepoFileContent, GitError> {
    let size = blob.size() as u32;
    let data = blob.content();

    // Binary detection: check first 8000 bytes for null byte
    let check_len = data.len().min(8000);
    let is_binary = data[..check_len].contains(&0);

    let content = if is_binary {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.encode(data)
    } else {
        String::from_utf8_lossy(data).into_owned()
    };

    Ok(RepoFileContent {
        content,
        is_binary,
        size,
    })
}
