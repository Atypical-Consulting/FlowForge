use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

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

    let mut is_binary = false;
    let mut hunks = Vec::new();

    // Check if file is binary
    diff.foreach(
        &mut |delta, _| {
            if delta.flags().is_binary() {
                is_binary = true;
            }
            true
        },
        None,
        Some(&mut |_delta, hunk| {
            hunks.push(DiffHunk {
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

    let mut is_binary = false;
    let mut hunks = Vec::new();

    // Check if file is binary
    diff.foreach(
        &mut |delta, _| {
            if delta.flags().is_binary() {
                is_binary = true;
            }
            true
        },
        None,
        Some(&mut |_delta, hunk| {
            hunks.push(DiffHunk {
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

        let mut is_binary = false;
        let mut hunks = Vec::new();

        diff.foreach(
            &mut |delta, _| {
                if delta.flags().is_binary() {
                    is_binary = true;
                }
                true
            },
            None,
            Some(&mut |_delta, hunk| {
                hunks.push(DiffHunk {
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
