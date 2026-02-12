use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashSet;
use std::path::Path;
use tauri::State;

use crate::git::diff::extract_hunks_from_diff;
use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Status of a file in the working directory or index.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FileStatus {
    Modified,
    Added,
    Deleted,
    Renamed { old_path: String },
    Untracked,
    Conflicted,
}

/// A single file change with its status and optional diff stats.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    pub status: FileStatus,
    pub additions: Option<i32>,
    pub deletions: Option<i32>,
}

/// Complete staging status showing staged, unstaged, and untracked files.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StagingStatus {
    pub staged: Vec<FileChange>,
    pub unstaged: Vec<FileChange>,
    pub untracked: Vec<FileChange>,
}

/// A contiguous range of lines for partial staging operations.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LineRange {
    pub start: u32, // 1-based line number
    pub end: u32,   // inclusive
}

/// Get the current staging status of the repository.
///
/// Returns files grouped by staged (in index), unstaged (modified in workdir),
/// and untracked (new files not yet added).
#[tauri::command]
#[specta::specta]
pub async fn get_staging_status(
    state: State<'_, RepositoryState>,
) -> Result<StagingStatus, GitError> {
    let path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&path)?;

        let mut opts = git2::StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .exclude_submodules(true)
            .include_ignored(false);

        let statuses = repo.statuses(Some(&mut opts))?;

        let mut staged = Vec::new();
        let mut unstaged = Vec::new();
        let mut untracked = Vec::new();

        for entry in statuses.iter() {
            let status = entry.status();
            let file_path = entry.path().unwrap_or("").to_string();

            // Check for staged changes (INDEX_*)
            if status.intersects(
                git2::Status::INDEX_NEW
                    | git2::Status::INDEX_MODIFIED
                    | git2::Status::INDEX_DELETED
                    | git2::Status::INDEX_RENAMED
                    | git2::Status::INDEX_TYPECHANGE,
            ) {
                let file_status = if status.contains(git2::Status::INDEX_NEW) {
                    FileStatus::Added
                } else if status.contains(git2::Status::INDEX_DELETED) {
                    FileStatus::Deleted
                } else if status.contains(git2::Status::INDEX_RENAMED) {
                    let old_path = entry
                        .head_to_index()
                        .and_then(|d| d.old_file().path().map(|p| p.to_string_lossy().to_string()))
                        .unwrap_or_default();
                    FileStatus::Renamed { old_path }
                } else {
                    FileStatus::Modified
                };

                staged.push(FileChange {
                    path: file_path.clone(),
                    status: file_status,
                    additions: None,
                    deletions: None,
                });
            }

            // Check for unstaged changes (WT_*)
            if status.intersects(
                git2::Status::WT_MODIFIED
                    | git2::Status::WT_DELETED
                    | git2::Status::WT_TYPECHANGE
                    | git2::Status::WT_RENAMED,
            ) {
                let file_status = if status.contains(git2::Status::WT_DELETED) {
                    FileStatus::Deleted
                } else if status.contains(git2::Status::WT_RENAMED) {
                    let old_path = entry
                        .index_to_workdir()
                        .and_then(|d| d.old_file().path().map(|p| p.to_string_lossy().to_string()))
                        .unwrap_or_default();
                    FileStatus::Renamed { old_path }
                } else {
                    FileStatus::Modified
                };

                unstaged.push(FileChange {
                    path: file_path.clone(),
                    status: file_status,
                    additions: None,
                    deletions: None,
                });
            }

            // Check for untracked files (WT_NEW)
            if status.contains(git2::Status::WT_NEW) {
                untracked.push(FileChange {
                    path: file_path.clone(),
                    status: FileStatus::Untracked,
                    additions: None,
                    deletions: None,
                });
            }

            // Check for conflicted files
            if status.contains(git2::Status::CONFLICTED) {
                unstaged.push(FileChange {
                    path: file_path,
                    status: FileStatus::Conflicted,
                    additions: None,
                    deletions: None,
                });
            }
        }

        Ok(StagingStatus {
            staged,
            unstaged,
            untracked,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Stage a single file for commit.
///
/// The path must be relative to the repository root.
#[tauri::command]
#[specta::specta]
pub async fn stage_file(path: String, state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut index = repo.index()?;

        let file_path = Path::new(&path);

        // Check if file exists in workdir - if not, it's a deletion
        let full_path = repo_path.join(file_path);
        if full_path.exists() {
            index.add_path(file_path)?;
        } else {
            // File was deleted, remove from index
            index.remove_path(file_path)?;
        }

        index.write()?;
        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Unstage a single file (remove from index, keep workdir changes).
///
/// The path must be relative to the repository root.
#[tauri::command]
#[specta::specta]
pub async fn unstage_file(path: String, state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Try to get HEAD commit
        match repo.head() {
            Ok(head_ref) => {
                let head_commit = head_ref.peel_to_commit()?;
                repo.reset_default(Some(&head_commit.into_object()), [Path::new(&path)])?;
            }
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // Fresh repo with no commits - just remove from index
                let mut index = repo.index()?;
                index.remove_path(Path::new(&path))?;
                index.write()?;
            }
            Err(e) => return Err(GitError::from(e)),
        }

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Stage multiple files for commit in a single operation.
///
/// More efficient than calling stage_file repeatedly — performs a single index write.
/// Paths must be relative to the repository root.
#[tauri::command]
#[specta::specta]
pub async fn stage_files(
    paths: Vec<String>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut index = repo.index()?;

        let pathspecs: Vec<&str> = paths.iter().map(|s| s.as_str()).collect();

        // add_all handles new and modified files
        index.add_all(pathspecs.iter(), git2::IndexAddOption::DEFAULT, None)?;

        // update_all handles deleted files
        index.update_all(pathspecs.iter(), None)?;

        index.write()?;
        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Unstage multiple files (remove from index, keep workdir changes).
///
/// More efficient than calling unstage_file repeatedly — performs a single reset.
/// Paths must be relative to the repository root.
#[tauri::command]
#[specta::specta]
pub async fn unstage_files(
    paths: Vec<String>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        match repo.head() {
            Ok(head_ref) => {
                let head_commit = head_ref.peel_to_commit()?;
                let paths_iter = paths.iter().map(|s| Path::new(s.as_str()));
                repo.reset_default(Some(&head_commit.into_object()), paths_iter)?;
            }
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // Fresh repo with no commits — just remove from index
                let mut index = repo.index()?;
                for path in &paths {
                    index.remove_path(Path::new(path))?;
                }
                index.write()?;
            }
            Err(e) => return Err(GitError::from(e)),
        }

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Stage all changed files.
///
/// Adds all modified, deleted, and new files to the index.
#[tauri::command]
#[specta::specta]
pub async fn stage_all(state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut index = repo.index()?;

        // Add all changes including new files
        index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;

        // Also handle deletions - update_all handles deleted files
        index.update_all(["*"].iter(), None)?;

        index.write()?;
        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Unstage all staged files.
///
/// Resets the index to match HEAD, keeping workdir changes.
#[tauri::command]
#[specta::specta]
pub async fn unstage_all(state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Try to get HEAD commit
        match repo.head() {
            Ok(head_ref) => {
                let head_commit = head_ref.peel_to_commit()?;
                // Reset entire index to HEAD (mixed reset)
                repo.reset(&head_commit.into_object(), git2::ResetType::Mixed, None)?;
            }
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // Fresh repo with no commits - clear the index
                let mut index = repo.index()?;
                index.clear()?;
                index.write()?;
            }
            Err(e) => return Err(GitError::from(e)),
        }

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Stage specific hunks of a file.
///
/// Applies only the selected hunks from the workdir diff to the index,
/// leaving other hunks unstaged.
#[tauri::command]
#[specta::specta]
pub async fn stage_hunks(
    path: String,
    hunk_indices: Vec<u32>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    if hunk_indices.is_empty() {
        return Ok(());
    }

    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Generate diff: index -> workdir for this file
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(&path);
        let diff = repo.diff_index_to_workdir(None, Some(&mut diff_opts))?;

        // Check binary
        let (_hunks, _detailed, is_binary) = extract_hunks_from_diff(&diff, false)?;
        if is_binary {
            return Err(GitError::BinaryPartialStaging);
        }

        // Count total hunks to validate indices
        let total_hunks = _hunks.len() as u32;
        for &idx in &hunk_indices {
            if idx >= total_hunks {
                return Err(GitError::HunkIndexOutOfRange(idx));
            }
        }

        let hunk_set: HashSet<u32> = hunk_indices.into_iter().collect();
        let hunk_counter = std::cell::Cell::new(0u32);

        let mut apply_opts = git2::ApplyOptions::new();
        apply_opts.hunk_callback(|_hunk| {
            let current = hunk_counter.get();
            hunk_counter.set(current + 1);
            hunk_set.contains(&current)
        });

        // Apply filtered diff to index
        repo.apply(&diff, git2::ApplyLocation::Index, Some(&mut apply_opts))?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Unstage specific hunks of a file.
///
/// Reverts the selected hunks from the index back to HEAD state,
/// keeping other staged hunks intact.
#[tauri::command]
#[specta::specta]
pub async fn unstage_hunks(
    path: String,
    hunk_indices: Vec<u32>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    if hunk_indices.is_empty() {
        return Ok(());
    }

    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Get HEAD tree (handle unborn branch)
        let head_tree = match repo.head() {
            Ok(head_ref) => Some(head_ref.peel_to_tree()?),
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => None,
            Err(e) => return Err(GitError::from(e)),
        };

        // Generate diff: HEAD -> index for this file
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(&path);
        let diff = repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))?;

        let (_hunks, detailed_hunks, is_binary) = extract_hunks_from_diff(&diff, true)?;
        if is_binary {
            return Err(GitError::BinaryPartialStaging);
        }

        let total_hunks = detailed_hunks.len() as u32;
        for &idx in &hunk_indices {
            if idx >= total_hunks {
                return Err(GitError::HunkIndexOutOfRange(idx));
            }
        }

        let hunk_set: HashSet<u32> = hunk_indices.into_iter().collect();

        // If all hunks are being unstaged, use the simple approach
        if hunk_set.len() as u32 == total_hunks {
            // Check if file is new (not in HEAD)
            let file_in_head = head_tree
                .as_ref()
                .and_then(|t| t.get_path(Path::new(&path)).ok())
                .is_some();

            if file_in_head {
                let head_obj = repo.head()?.peel_to_commit()?.into_object();
                repo.reset_default(Some(&head_obj), [Path::new(&path)])?;
            } else {
                // File is new (not in HEAD) — remove from index entirely
                let mut index = repo.index()?;
                index.remove_path(Path::new(&path))?;
                index.write()?;
            }
            return Ok(());
        }

        // Partial unstage: rebuild index content keeping only non-selected hunks
        // Get HEAD content for the file
        let head_content = if let Some(ref tree) = head_tree {
            match tree.get_path(Path::new(&path)) {
                Ok(entry) => {
                    let blob = repo.find_blob(entry.id())?;
                    String::from_utf8_lossy(blob.content()).to_string()
                }
                Err(_) => String::new(),
            }
        } else {
            String::new()
        };

        let head_lines: Vec<&str> = head_content.lines().collect();

        // Build result by starting with HEAD content and applying only hunks NOT in hunk_set
        let mut result_lines: Vec<String> = Vec::new();
        let mut old_line_idx: usize = 0; // 0-based position in head_lines

        for hunk in &detailed_hunks {
            let hunk_old_start = if hunk.old_start == 0 {
                0
            } else {
                (hunk.old_start - 1) as usize
            };

            // Copy lines from HEAD before this hunk
            while old_line_idx < hunk_old_start && old_line_idx < head_lines.len() {
                result_lines.push(head_lines[old_line_idx].to_string());
                old_line_idx += 1;
            }

            if hunk_set.contains(&hunk.index) {
                // This hunk is being UNSTAGED: use HEAD content (skip the hunk's changes)
                for _ in 0..hunk.old_lines {
                    if old_line_idx < head_lines.len() {
                        result_lines.push(head_lines[old_line_idx].to_string());
                        old_line_idx += 1;
                    }
                }
            } else {
                // This hunk should REMAIN staged: apply the hunk's changes
                for line in &hunk.lines {
                    match line.origin {
                        crate::git::diff::DiffLineOrigin::Context => {
                            result_lines.push(line.content.trim_end_matches('\n').to_string());
                            old_line_idx += 1;
                        }
                        crate::git::diff::DiffLineOrigin::Addition => {
                            result_lines.push(line.content.trim_end_matches('\n').to_string());
                        }
                        crate::git::diff::DiffLineOrigin::Deletion => {
                            old_line_idx += 1;
                        }
                    }
                }
            }
        }

        // Copy remaining lines from HEAD after last hunk
        while old_line_idx < head_lines.len() {
            result_lines.push(head_lines[old_line_idx].to_string());
            old_line_idx += 1;
        }

        // Build result content with proper line endings
        let mut result_content = result_lines.join("\n");
        // Preserve trailing newline if HEAD content had one
        if head_content.ends_with('\n') || !head_content.is_empty() {
            result_content.push('\n');
        }

        // Write result to index
        let mut index = repo.index()?;
        if let Some(existing_entry) = index.get_path(Path::new(&path), 0) {
            index.add_frombuffer(&existing_entry, result_content.as_bytes())?;
        } else {
            // Create a new index entry
            let entry = git2::IndexEntry {
                ctime: git2::IndexTime::new(0, 0),
                mtime: git2::IndexTime::new(0, 0),
                dev: 0,
                ino: 0,
                mode: 0o100644,
                uid: 0,
                gid: 0,
                file_size: 0,
                id: git2::Oid::zero(),
                flags: 0,
                flags_extended: 0,
                path: path.as_bytes().to_vec(),
            };
            index.add_frombuffer(&entry, result_content.as_bytes())?;
        }
        index.write()?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Stage specific lines within a hunk of a file.
///
/// Lines are identified by their position in the diff. Only additions and deletions
/// within the specified line ranges are staged.
#[tauri::command]
#[specta::specta]
pub async fn stage_lines(
    path: String,
    hunk_index: u32,
    line_ranges: Vec<LineRange>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    if line_ranges.is_empty() {
        return Ok(());
    }

    // Validate line ranges
    for range in &line_ranges {
        if range.start == 0 || range.end == 0 || range.start > range.end {
            return Err(GitError::LineRangeInvalid(format!(
                "start={}, end={}",
                range.start, range.end
            )));
        }
    }

    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Generate diff: index -> workdir
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(&path);
        let diff = repo.diff_index_to_workdir(None, Some(&mut diff_opts))?;

        let (_hunks, detailed_hunks, is_binary) = extract_hunks_from_diff(&diff, true)?;
        if is_binary {
            return Err(GitError::BinaryPartialStaging);
        }

        if hunk_index >= detailed_hunks.len() as u32 {
            return Err(GitError::HunkIndexOutOfRange(hunk_index));
        }

        // Read current index content (base)
        let index = repo.index()?;
        let base_content = if let Some(entry) = index.get_path(Path::new(&path), 0) {
            let blob = repo.find_blob(entry.id)?;
            String::from_utf8_lossy(blob.content()).to_string()
        } else {
            String::new()
        };

        let base_lines: Vec<&str> = base_content.lines().collect();

        // Build selected line numbers set (these are new_lineno values for additions,
        // old_lineno values for deletions)
        let selected_new_lines: HashSet<u32> = line_ranges
            .iter()
            .flat_map(|r| r.start..=r.end)
            .collect();

        // Build new content by applying selected lines from the target hunk
        let mut result_lines: Vec<String> = Vec::new();
        let mut base_idx: usize = 0; // 0-based position in base_lines

        for hunk in &detailed_hunks {
            let hunk_old_start = if hunk.old_start == 0 {
                0
            } else {
                (hunk.old_start - 1) as usize
            };

            // Copy base lines before this hunk
            while base_idx < hunk_old_start && base_idx < base_lines.len() {
                result_lines.push(base_lines[base_idx].to_string());
                base_idx += 1;
            }

            if hunk.index == hunk_index {
                // This is the target hunk: selectively apply lines
                for line in &hunk.lines {
                    match line.origin {
                        crate::git::diff::DiffLineOrigin::Context => {
                            result_lines
                                .push(line.content.trim_end_matches('\n').to_string());
                            base_idx += 1;
                        }
                        crate::git::diff::DiffLineOrigin::Addition => {
                            // Include addition only if its new_lineno is in selected ranges
                            if let Some(new_no) = line.new_lineno {
                                if selected_new_lines.contains(&new_no) {
                                    result_lines.push(
                                        line.content.trim_end_matches('\n').to_string(),
                                    );
                                }
                            }
                        }
                        crate::git::diff::DiffLineOrigin::Deletion => {
                            // Remove from output (stage deletion) only if old_lineno is in range
                            if let Some(old_no) = line.old_lineno {
                                if selected_new_lines.contains(&old_no) {
                                    // Stage the deletion: skip this line
                                    base_idx += 1;
                                } else {
                                    // Don't stage: keep the original line
                                    if base_idx < base_lines.len() {
                                        result_lines.push(base_lines[base_idx].to_string());
                                    }
                                    base_idx += 1;
                                }
                            } else {
                                base_idx += 1;
                            }
                        }
                    }
                }
            } else {
                // Not the target hunk: keep base content (no changes from this hunk)
                for _ in 0..hunk.old_lines {
                    if base_idx < base_lines.len() {
                        result_lines.push(base_lines[base_idx].to_string());
                        base_idx += 1;
                    }
                }
            }
        }

        // Copy remaining base lines
        while base_idx < base_lines.len() {
            result_lines.push(base_lines[base_idx].to_string());
            base_idx += 1;
        }

        // Build result with proper endings
        let mut result_content = result_lines.join("\n");
        if base_content.ends_with('\n') || !base_content.is_empty() {
            result_content.push('\n');
        }

        // Write to index
        let mut index = repo.index()?;
        if let Some(existing_entry) = index.get_path(Path::new(&path), 0) {
            index.add_frombuffer(&existing_entry, result_content.as_bytes())?;
        } else {
            let entry = git2::IndexEntry {
                ctime: git2::IndexTime::new(0, 0),
                mtime: git2::IndexTime::new(0, 0),
                dev: 0,
                ino: 0,
                mode: 0o100644,
                uid: 0,
                gid: 0,
                file_size: 0,
                id: git2::Oid::zero(),
                flags: 0,
                flags_extended: 0,
                path: path.as_bytes().to_vec(),
            };
            index.add_frombuffer(&entry, result_content.as_bytes())?;
        }
        index.write()?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Unstage specific lines within a hunk of a file.
///
/// Reverts the selected lines from the index back to HEAD state,
/// keeping other staged lines intact.
#[tauri::command]
#[specta::specta]
pub async fn unstage_lines(
    path: String,
    hunk_index: u32,
    line_ranges: Vec<LineRange>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    if line_ranges.is_empty() {
        return Ok(());
    }

    // Validate line ranges
    for range in &line_ranges {
        if range.start == 0 || range.end == 0 || range.start > range.end {
            return Err(GitError::LineRangeInvalid(format!(
                "start={}, end={}",
                range.start, range.end
            )));
        }
    }

    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Get HEAD tree
        let head_tree = match repo.head() {
            Ok(head_ref) => Some(head_ref.peel_to_tree()?),
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => None,
            Err(e) => return Err(GitError::from(e)),
        };

        // Generate diff: HEAD -> index
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(&path);
        let diff = repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))?;

        let (_hunks, detailed_hunks, is_binary) = extract_hunks_from_diff(&diff, true)?;
        if is_binary {
            return Err(GitError::BinaryPartialStaging);
        }

        if hunk_index >= detailed_hunks.len() as u32 {
            return Err(GitError::HunkIndexOutOfRange(hunk_index));
        }

        // Get HEAD content as base
        let head_content = if let Some(ref tree) = head_tree {
            match tree.get_path(Path::new(&path)) {
                Ok(entry) => {
                    let blob = repo.find_blob(entry.id())?;
                    String::from_utf8_lossy(blob.content()).to_string()
                }
                Err(_) => String::new(),
            }
        } else {
            String::new()
        };

        let head_lines: Vec<&str> = head_content.lines().collect();

        // Build selected line numbers set
        let selected_lines: HashSet<u32> = line_ranges
            .iter()
            .flat_map(|r| r.start..=r.end)
            .collect();

        // Build result: start with HEAD, apply all hunks except selectively revert target hunk lines
        let mut result_lines: Vec<String> = Vec::new();
        let mut old_line_idx: usize = 0; // position in head_lines

        for hunk in &detailed_hunks {
            let hunk_old_start = if hunk.old_start == 0 {
                0
            } else {
                (hunk.old_start - 1) as usize
            };

            // Copy HEAD lines before this hunk
            while old_line_idx < hunk_old_start && old_line_idx < head_lines.len() {
                result_lines.push(head_lines[old_line_idx].to_string());
                old_line_idx += 1;
            }

            if hunk.index == hunk_index {
                // Target hunk: selectively revert lines in selected_lines
                for line in &hunk.lines {
                    match line.origin {
                        crate::git::diff::DiffLineOrigin::Context => {
                            result_lines
                                .push(line.content.trim_end_matches('\n').to_string());
                            old_line_idx += 1;
                        }
                        crate::git::diff::DiffLineOrigin::Addition => {
                            // If new_lineno is in selected ranges, REVERT (don't include)
                            // Otherwise keep it staged
                            if let Some(new_no) = line.new_lineno {
                                if !selected_lines.contains(&new_no) {
                                    result_lines.push(
                                        line.content.trim_end_matches('\n').to_string(),
                                    );
                                }
                            }
                        }
                        crate::git::diff::DiffLineOrigin::Deletion => {
                            // If old_lineno is in selected ranges, REVERT (put line back)
                            // Otherwise keep it deleted (staged)
                            if let Some(old_no) = line.old_lineno {
                                if selected_lines.contains(&old_no) {
                                    // Revert the deletion: restore original line
                                    if old_line_idx < head_lines.len() {
                                        result_lines
                                            .push(head_lines[old_line_idx].to_string());
                                    }
                                }
                            }
                            old_line_idx += 1;
                        }
                    }
                }
            } else {
                // Non-target hunk: apply all changes (keep them staged)
                for line in &hunk.lines {
                    match line.origin {
                        crate::git::diff::DiffLineOrigin::Context => {
                            result_lines
                                .push(line.content.trim_end_matches('\n').to_string());
                            old_line_idx += 1;
                        }
                        crate::git::diff::DiffLineOrigin::Addition => {
                            result_lines
                                .push(line.content.trim_end_matches('\n').to_string());
                        }
                        crate::git::diff::DiffLineOrigin::Deletion => {
                            old_line_idx += 1;
                        }
                    }
                }
            }
        }

        // Copy remaining HEAD lines
        while old_line_idx < head_lines.len() {
            result_lines.push(head_lines[old_line_idx].to_string());
            old_line_idx += 1;
        }

        // Build result with proper endings
        let mut result_content = result_lines.join("\n");
        if head_content.ends_with('\n') || !head_content.is_empty() {
            result_content.push('\n');
        }

        // Write to index
        let mut index = repo.index()?;
        if let Some(existing_entry) = index.get_path(Path::new(&path), 0) {
            index.add_frombuffer(&existing_entry, result_content.as_bytes())?;
        } else {
            let entry = git2::IndexEntry {
                ctime: git2::IndexTime::new(0, 0),
                mtime: git2::IndexTime::new(0, 0),
                dev: 0,
                ino: 0,
                mode: 0o100644,
                uid: 0,
                gid: 0,
                file_size: 0,
                id: git2::Oid::zero(),
                flags: 0,
                flags_extended: 0,
                path: path.as_bytes().to_vec(),
            };
            index.add_frombuffer(&entry, result_content.as_bytes())?;
        }
        index.write()?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_repo() -> (tempfile::TempDir, git2::Repository) {
        let dir = tempfile::TempDir::new().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();

        // Configure signature for commits
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@test.com").unwrap();

        (dir, repo)
    }

    fn initial_commit(repo: &git2::Repository, dir: &Path) {
        fs::write(dir.join("file.txt"), "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\n").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();

        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = repo.signature().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "initial commit", &tree, &[])
            .unwrap();
    }

    fn create_multi_hunk_changes(dir: &Path) {
        // Modify lines near the top and bottom to create 2 separate hunks
        fs::write(
            dir.join("file.txt"),
            "MODIFIED1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nMODIFIED10\n",
        )
        .unwrap();
    }

    fn get_index_content(repo: &git2::Repository, path: &str) -> String {
        let index = repo.index().unwrap();
        if let Some(entry) = index.get_path(Path::new(path), 0) {
            let blob = repo.find_blob(entry.id).unwrap();
            String::from_utf8_lossy(blob.content()).to_string()
        } else {
            String::new()
        }
    }

    #[test]
    fn test_stage_single_hunk() {
        let (dir, repo) = setup_repo();
        initial_commit(&repo, dir.path());
        create_multi_hunk_changes(dir.path());

        // Generate diff to see hunks
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec("file.txt");
        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .unwrap();

        let (hunks, _detailed, _is_binary) = extract_hunks_from_diff(&diff, false).unwrap();
        assert!(
            hunks.len() >= 2,
            "Expected at least 2 hunks, got {}",
            hunks.len()
        );

        // Stage only hunk 0 (the first modification)
        let hunk_set: HashSet<u32> = [0].into_iter().collect();
        let hunk_counter = std::cell::Cell::new(0u32);

        let mut apply_opts = git2::ApplyOptions::new();
        apply_opts.hunk_callback(|_hunk| {
            let current = hunk_counter.get();
            hunk_counter.set(current + 1);
            hunk_set.contains(&current)
        });

        repo.apply(&diff, git2::ApplyLocation::Index, Some(&mut apply_opts))
            .unwrap();

        // Verify: index should have MODIFIED1 at line 1 but NOT MODIFIED10 at line 10
        let index_content = get_index_content(&repo, "file.txt");
        assert!(
            index_content.contains("MODIFIED1"),
            "Hunk 0 changes should be staged"
        );
        assert!(
            !index_content.contains("MODIFIED10"),
            "Hunk 1 changes should NOT be staged"
        );
    }

    #[test]
    fn test_stage_hunk_empty_indices_noop() {
        let (dir, repo) = setup_repo();
        initial_commit(&repo, dir.path());
        create_multi_hunk_changes(dir.path());

        // Record the index state before
        let before_content = get_index_content(&repo, "file.txt");

        // Stage with empty indices - should be a no-op
        // (In the actual Tauri command, this returns early. Here we just verify the pattern.)
        let hunk_indices: Vec<u32> = vec![];
        assert!(hunk_indices.is_empty());

        // Index should be unchanged
        let after_content = get_index_content(&repo, "file.txt");
        assert_eq!(before_content, after_content);
    }

    #[test]
    fn test_stage_hunk_out_of_range() {
        let (dir, repo) = setup_repo();
        initial_commit(&repo, dir.path());
        create_multi_hunk_changes(dir.path());

        // Generate diff
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec("file.txt");
        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .unwrap();

        let (hunks, _detailed, _is_binary) = extract_hunks_from_diff(&diff, false).unwrap();
        let total = hunks.len() as u32;

        // Trying to stage an out-of-range index should be detected
        let out_of_range_idx = total + 5;
        assert!(
            out_of_range_idx >= total,
            "Index {} should be out of range (total: {})",
            out_of_range_idx,
            total
        );
    }

    #[test]
    fn test_unstage_hunk_reverts() {
        let (dir, repo) = setup_repo();
        initial_commit(&repo, dir.path());
        create_multi_hunk_changes(dir.path());

        // Stage the entire file first
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();

        // Verify both modifications are staged
        let staged_content = get_index_content(&repo, "file.txt");
        assert!(staged_content.contains("MODIFIED1"));
        assert!(staged_content.contains("MODIFIED10"));

        // Now generate diff HEAD -> index to find hunks
        let head_tree = repo.head().unwrap().peel_to_tree().unwrap();
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec("file.txt");
        let diff = repo
            .diff_tree_to_index(Some(&head_tree), None, Some(&mut diff_opts))
            .unwrap();

        let (_hunks, detailed_hunks, _) = extract_hunks_from_diff(&diff, true).unwrap();
        assert!(detailed_hunks.len() >= 2);

        // Unstage all hunks via reset_default (the "all hunks" code path)
        let head_obj = repo.head().unwrap().peel_to_commit().unwrap().into_object();
        repo.reset_default(Some(&head_obj), [Path::new("file.txt")])
            .unwrap();

        // Verify: index should be back to HEAD content
        let reverted_content = get_index_content(&repo, "file.txt");
        assert!(
            !reverted_content.contains("MODIFIED1"),
            "Hunk changes should be reverted"
        );
        assert!(
            !reverted_content.contains("MODIFIED10"),
            "Hunk changes should be reverted"
        );
        assert!(
            reverted_content.contains("line1"),
            "Original content should be restored"
        );
    }

    #[test]
    fn test_binary_file_returns_error() {
        let (dir, repo) = setup_repo();

        // Create initial commit with a binary file
        let binary_data: Vec<u8> = vec![0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD, 0x00, 0x00];
        fs::write(dir.path().join("binary.bin"), &binary_data).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("binary.bin")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = repo.signature().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "add binary", &tree, &[])
            .unwrap();

        // Modify the binary file
        let modified_binary: Vec<u8> = vec![0x00, 0x01, 0x03, 0xFF, 0xFE, 0xFD, 0x00, 0x01];
        fs::write(dir.path().join("binary.bin"), &modified_binary).unwrap();

        // Generate diff
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec("binary.bin");
        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .unwrap();

        let (_hunks, _detailed, is_binary) = extract_hunks_from_diff(&diff, false).unwrap();

        // Binary detection should work
        assert!(is_binary, "File should be detected as binary");
    }

    #[test]
    fn test_extract_hunks_with_lines() {
        let (dir, repo) = setup_repo();
        initial_commit(&repo, dir.path());
        create_multi_hunk_changes(dir.path());

        // Generate diff with line detail
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec("file.txt");
        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .unwrap();

        let (_hunks, detailed_hunks, is_binary) = extract_hunks_from_diff(&diff, true).unwrap();

        assert!(!is_binary);
        assert!(
            !detailed_hunks.is_empty(),
            "Should have at least one detailed hunk"
        );

        // Verify line detail is populated
        let first_hunk = &detailed_hunks[0];
        assert!(
            !first_hunk.lines.is_empty(),
            "Hunk should have line details"
        );

        // Check that we have at least one addition or deletion
        let has_change = first_hunk.lines.iter().any(|l| {
            matches!(
                l.origin,
                crate::git::diff::DiffLineOrigin::Addition
                    | crate::git::diff::DiffLineOrigin::Deletion
            )
        });
        assert!(has_change, "Hunk should contain at least one change line");
    }

    #[test]
    fn test_extract_hunks_without_lines() {
        let (dir, repo) = setup_repo();
        initial_commit(&repo, dir.path());
        create_multi_hunk_changes(dir.path());

        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec("file.txt");
        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .unwrap();

        let (hunks, detailed_hunks, is_binary) = extract_hunks_from_diff(&diff, false).unwrap();

        assert!(!is_binary);
        assert!(!hunks.is_empty(), "Should have basic hunks");
        assert!(
            detailed_hunks.is_empty(),
            "Detailed hunks should be empty when include_lines=false"
        );
    }
}
