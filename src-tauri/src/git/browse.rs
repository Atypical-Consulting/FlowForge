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

/// List files and directories at a given path within the repository at HEAD.
///
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

        // Get the tree at HEAD
        let tree = match repo.head() {
            Ok(head) => head.peel_to_tree().map_err(GitError::from)?,
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // Empty repo — no files
                return Ok(Vec::new());
            }
            Err(e) => return Err(GitError::from(e)),
        };

        // Navigate to the requested path within the tree
        let target_tree = if path.is_empty() {
            tree
        } else {
            let entry = tree
                .get_path(std::path::Path::new(&path))
                .map_err(|_| GitError::PathNotFound(path.clone()))?;
            let obj = entry
                .to_object(&repo)
                .map_err(|e| GitError::OperationFailed(format!("Failed to resolve path: {}", e)))?;
            obj.into_tree()
                .map_err(|_| GitError::OperationFailed(format!("Path is not a directory: {}", path)))?
        };

        let mut dirs = Vec::new();
        let mut files = Vec::new();

        for entry in target_tree.iter() {
            let name = entry.name().unwrap_or("").to_string();
            let entry_path = if path.is_empty() {
                name.clone()
            } else {
                format!("{}/{}", path, name)
            };

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

        // Sort: dirs first alphabetically, then files alphabetically
        dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        dirs.append(&mut files);

        Ok(dirs)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Read file content from the repository at HEAD.
///
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

        let tree = match repo.head() {
            Ok(head) => head.peel_to_tree().map_err(GitError::from)?,
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                return Err(GitError::EmptyRepository);
            }
            Err(e) => return Err(GitError::from(e)),
        };

        let entry = tree
            .get_path(std::path::Path::new(&file_path))
            .map_err(|_| GitError::PathNotFound(file_path.clone()))?;

        let obj = entry
            .to_object(&repo)
            .map_err(|e| GitError::OperationFailed(format!("Failed to resolve file: {}", e)))?;

        let blob = obj
            .as_blob()
            .ok_or_else(|| GitError::OperationFailed(format!("Path is not a file: {}", file_path)))?;

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
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
