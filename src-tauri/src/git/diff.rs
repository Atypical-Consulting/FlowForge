use base64::Engine as _;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Origin type of a diff line.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DiffLineOrigin {
    Context,
    Addition,
    Deletion,
}

/// A single line in a diff hunk with origin and line numbers.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub origin: DiffLineOrigin,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
    pub content: String,
}

/// Enhanced diff hunk with per-line detail for interactive staging.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunkDetail {
    pub index: u32,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header: String,
    pub lines: Vec<DiffLine>,
}

/// A single diff hunk with line range information.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header: String,
}

/// Complete file diff with old/new content for Monaco DiffEditor.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub old_content: String,
    pub new_content: String,
    pub hunks: Vec<DiffHunk>,
    pub is_binary: bool,
    pub language: String,
}

/// Extract hunks (and optionally per-line detail) from a git2::Diff.
///
/// When `include_lines` is false, returns empty `DiffHunkDetail` vec (backward compat).
/// When true, populates per-line data using the line callback of `diff.foreach()`.
pub fn extract_hunks_from_diff(
    diff: &git2::Diff,
    include_lines: bool,
) -> Result<(Vec<DiffHunk>, Vec<DiffHunkDetail>, bool), GitError> {
    use std::cell::RefCell;

    let is_binary = RefCell::new(false);
    let hunks = RefCell::new(Vec::new());
    let detailed_hunks: RefCell<Vec<DiffHunkDetail>> = RefCell::new(Vec::new());
    let hunk_index = RefCell::new(0u32);

    if include_lines {
        diff.foreach(
            &mut |delta, _| {
                if delta.flags().is_binary() {
                    *is_binary.borrow_mut() = true;
                }
                true
            },
            None,
            Some(&mut |_delta, hunk| {
                hunks.borrow_mut().push(DiffHunk {
                    old_start: hunk.old_start(),
                    old_lines: hunk.old_lines(),
                    new_start: hunk.new_start(),
                    new_lines: hunk.new_lines(),
                    header: String::from_utf8_lossy(hunk.header()).to_string(),
                });
                let idx = *hunk_index.borrow();
                detailed_hunks.borrow_mut().push(DiffHunkDetail {
                    index: idx,
                    old_start: hunk.old_start(),
                    old_lines: hunk.old_lines(),
                    new_start: hunk.new_start(),
                    new_lines: hunk.new_lines(),
                    header: String::from_utf8_lossy(hunk.header()).to_string(),
                    lines: Vec::new(),
                });
                *hunk_index.borrow_mut() = idx + 1;
                true
            }),
            Some(&mut |_delta, _hunk, line| {
                if let Some(detail) = detailed_hunks.borrow_mut().last_mut() {
                    detail.lines.push(DiffLine {
                        origin: match line.origin() {
                            '+' => DiffLineOrigin::Addition,
                            '-' => DiffLineOrigin::Deletion,
                            _ => DiffLineOrigin::Context,
                        },
                        old_lineno: line.old_lineno(),
                        new_lineno: line.new_lineno(),
                        content: String::from_utf8_lossy(line.content()).to_string(),
                    });
                }
                true
            }),
        )?;
    } else {
        diff.foreach(
            &mut |delta, _| {
                if delta.flags().is_binary() {
                    *is_binary.borrow_mut() = true;
                }
                true
            },
            None,
            Some(&mut |_delta, hunk| {
                hunks.borrow_mut().push(DiffHunk {
                    old_start: hunk.old_start(),
                    old_lines: hunk.old_lines(),
                    new_start: hunk.new_start(),
                    new_lines: hunk.new_lines(),
                    header: String::from_utf8_lossy(hunk.header()).to_string(),
                });
                true
            }),
            None,
        )?;
    }

    Ok((
        hunks.into_inner(),
        detailed_hunks.into_inner(),
        is_binary.into_inner(),
    ))
}

/// Detect Monaco language ID from file extension.
fn detect_language(path: &str) -> String {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    match ext.to_lowercase().as_str() {
        "rs" => "rust",
        "ts" => "typescript",
        "tsx" => "typescriptreact",
        "js" => "javascript",
        "jsx" => "javascriptreact",
        "json" => "json",
        "md" => "markdown",
        "html" => "html",
        "css" => "css",
        "scss" => "scss",
        "less" => "less",
        "py" => "python",
        "go" => "go",
        "java" => "java",
        "c" | "h" => "c",
        "cpp" | "hpp" | "cc" | "cxx" => "cpp",
        "cs" => "csharp",
        "razor" | "cshtml" => "razor",
        "rb" => "ruby",
        "php" => "php",
        "swift" => "swift",
        "kt" | "kts" => "kotlin",
        "scala" => "scala",
        "sql" => "sql",
        "sh" | "bash" => "shell",
        "ps1" => "powershell",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "xml" => "xml",
        "svg" => "xml",
        "vue" => "vue",
        "svelte" => "svelte",
        "graphql" | "gql" => "graphql",
        "dockerfile" => "dockerfile",
        "makefile" => "makefile",
        _ => "plaintext",
    }
    .to_string()
}

/// Get the diff for a specific file.
///
/// If `staged` is true, shows diff between HEAD and index.
/// If `staged` is false, shows diff between index and workdir.
#[tauri::command]
#[specta::specta]
pub async fn get_file_diff(
    path: String,
    staged: bool,
    context_lines: u32,
    state: State<'_, RepositoryState>,
) -> Result<FileDiff, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    let file_path = path.clone();
    let language = detect_language(&path);

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.context_lines(context_lines).pathspec(&file_path);

        let (old_content, new_content, hunks, is_binary) = if staged {
            // Staged diff: HEAD -> index
            get_staged_diff(&repo, &file_path, &mut diff_opts)?
        } else {
            // Unstaged diff: index -> workdir
            get_unstaged_diff(&repo, &file_path, &mut diff_opts, &repo_path)?
        };

        Ok(FileDiff {
            path: file_path,
            old_content,
            new_content,
            hunks,
            is_binary,
            language,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Get per-line diff detail for a specific file.
///
/// Returns enhanced hunk data with individual line information for interactive staging.
#[tauri::command]
#[specta::specta]
pub async fn get_file_diff_hunks(
    path: String,
    staged: bool,
    state: State<'_, RepositoryState>,
) -> Result<Vec<DiffHunkDetail>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    let file_path = path.clone();

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(&file_path);

        let diff = if staged {
            // Staged diff: HEAD -> index
            let head_tree = match repo.head() {
                Ok(head_ref) => Some(head_ref.peel_to_tree()?),
                Err(e) if e.code() == git2::ErrorCode::UnbornBranch => None,
                Err(e) => return Err(GitError::from(e)),
            };
            repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))?
        } else {
            // Unstaged diff: index -> workdir
            repo.diff_index_to_workdir(None, Some(&mut diff_opts))?
        };

        let (_hunks, detailed_hunks, is_binary) = extract_hunks_from_diff(&diff, true)?;

        // For binary files, return empty vec
        if is_binary {
            return Ok(Vec::new());
        }

        Ok(detailed_hunks)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Get diff for staged changes (HEAD -> index).
fn get_staged_diff(
    repo: &git2::Repository,
    file_path: &str,
    diff_opts: &mut git2::DiffOptions,
) -> Result<(String, String, Vec<DiffHunk>, bool), GitError> {
    // Get HEAD tree (may not exist for fresh repos)
    let head_tree = match repo.head() {
        Ok(head_ref) => Some(head_ref.peel_to_tree()?),
        Err(e) if e.code() == git2::ErrorCode::UnbornBranch => None,
        Err(e) => return Err(GitError::from(e)),
    };

    let diff = repo.diff_tree_to_index(head_tree.as_ref(), None, Some(diff_opts))?;

    let (hunks, _detailed, is_binary) = extract_hunks_from_diff(&diff, false)?;

    if is_binary {
        return Ok((String::new(), String::new(), hunks, true));
    }

    // Get old content from HEAD
    let old_content = if let Some(ref tree) = head_tree {
        get_blob_content(repo, tree, file_path)?
    } else {
        String::new()
    };

    // Get new content from index
    let index = repo.index()?;
    let new_content = if let Some(entry) = index.get_path(Path::new(file_path), 0) {
        let blob = repo.find_blob(entry.id)?;
        if blob.is_binary() {
            return Ok((String::new(), String::new(), hunks, true));
        }
        String::from_utf8_lossy(blob.content()).to_string()
    } else {
        String::new()
    };

    Ok((old_content, new_content, hunks, false))
}

/// Get diff for unstaged changes (index -> workdir).
fn get_unstaged_diff(
    repo: &git2::Repository,
    file_path: &str,
    diff_opts: &mut git2::DiffOptions,
    repo_path: &std::path::Path,
) -> Result<(String, String, Vec<DiffHunk>, bool), GitError> {
    let diff = repo.diff_index_to_workdir(None, Some(diff_opts))?;

    let (hunks, _detailed, is_binary) = extract_hunks_from_diff(&diff, false)?;

    if is_binary {
        return Ok((String::new(), String::new(), hunks, true));
    }

    // Get old content from index
    let index = repo.index()?;
    let old_content = if let Some(entry) = index.get_path(Path::new(file_path), 0) {
        let blob = repo.find_blob(entry.id)?;
        if blob.is_binary() {
            return Ok((String::new(), String::new(), hunks, true));
        }
        String::from_utf8_lossy(blob.content()).to_string()
    } else {
        String::new()
    };

    // Get new content from workdir
    let workdir_file = repo_path.join(file_path);
    let new_content = if workdir_file.exists() {
        std::fs::read_to_string(&workdir_file)
            .map_err(|e| GitError::Internal(format!("Failed to read file: {}", e)))?
    } else {
        String::new()
    };

    Ok((old_content, new_content, hunks, false))
}

/// Get the diff for a specific file at a given commit.
///
/// Shows the changes introduced by the commit (parent -> commit).
#[tauri::command]
#[specta::specta]
pub async fn get_commit_file_diff(
    oid: String,
    path: String,
    context_lines: u32,
    state: State<'_, RepositoryState>,
) -> Result<FileDiff, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    let file_path = path.clone();
    let language = detect_language(&path);

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let commit_oid = git2::Oid::from_str(&oid)
            .map_err(|e| GitError::OperationFailed(format!("Invalid OID '{}': {}", oid, e)))?;
        let commit = repo.find_commit(commit_oid)?;
        let commit_tree = commit.tree()?;

        let parent_tree = if commit.parent_count() > 0 {
            Some(commit.parent(0)?.tree()?)
        } else {
            None
        };

        // Get old content from parent tree
        let old_content = if let Some(ref tree) = parent_tree {
            get_blob_content(&repo, tree, &file_path)?
        } else {
            String::new()
        };

        // Get new content from commit tree
        let new_content = get_blob_content(&repo, &commit_tree, &file_path)?;

        // Generate hunks
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.context_lines(context_lines).pathspec(&file_path);

        let diff = repo.diff_tree_to_tree(
            parent_tree.as_ref(),
            Some(&commit_tree),
            Some(&mut diff_opts),
        )?;

        let (hunks, _detailed, is_binary) = extract_hunks_from_diff(&diff, false)?;

        if is_binary {
            return Ok(FileDiff {
                path: file_path,
                old_content: String::new(),
                new_content: String::new(),
                hunks,
                is_binary: true,
                language,
            });
        }

        Ok(FileDiff {
            path: file_path,
            old_content,
            new_content,
            hunks,
            is_binary,
            language,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Get a file's binary content as a base64 data URI from the working tree.
///
/// Returns a data URI like `data:image/png;base64,...` for use in `<img>` tags.
#[tauri::command]
#[specta::specta]
pub async fn get_file_base64(
    file_path: String,
    state: State<'_, RepositoryState>,
) -> Result<String, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    let abs_path = repo_path.join(&file_path);
    let data = tokio::fs::read(&abs_path)
        .await
        .map_err(|e| GitError::OperationFailed(format!("Failed to read file: {}", e)))?;

    let mime = mime_from_extension(&file_path);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}

/// Get a file's binary content as a base64 data URI from a specific commit.
///
/// Extracts the blob from the commit's tree and returns it as a data URI.
#[tauri::command]
#[specta::specta]
pub async fn get_commit_file_base64(
    oid: String,
    file_path: String,
    state: State<'_, RepositoryState>,
) -> Result<String, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let commit_oid = git2::Oid::from_str(&oid)
            .map_err(|e| GitError::OperationFailed(format!("Invalid OID: {}", e)))?;
        let commit = repo.find_commit(commit_oid)?;
        let tree = commit.tree()?;

        let entry = tree
            .get_path(Path::new(&file_path))
            .map_err(|_| GitError::NotFound(format!("File not found in commit: {}", file_path)))?;
        let blob = repo.find_blob(entry.id())?;

        let mime = mime_from_extension(&file_path);
        let b64 = base64::engine::general_purpose::STANDARD.encode(blob.content());
        Ok(format!("data:{};base64,{}", mime, b64))
    })
    .await
    .map_err(|e| GitError::OperationFailed(format!("Task join error: {}", e)))?
}

/// Guess MIME type from file extension.
fn mime_from_extension(path: &str) -> &'static str {
    let lower = path.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".ico") {
        "image/x-icon"
    } else if lower.ends_with(".bmp") {
        "image/bmp"
    } else {
        "application/octet-stream"
    }
}

/// Get blob content from a tree by path.
fn get_blob_content(
    repo: &git2::Repository,
    tree: &git2::Tree,
    path: &str,
) -> Result<String, GitError> {
    match tree.get_path(Path::new(path)) {
        Ok(entry) => {
            let blob = repo.find_blob(entry.id())?;
            if blob.is_binary() {
                Ok(String::new())
            } else {
                Ok(String::from_utf8_lossy(blob.content()).to_string())
            }
        }
        Err(e) if e.code() == git2::ErrorCode::NotFound => Ok(String::new()),
        Err(e) => Err(GitError::from(e)),
    }
}
