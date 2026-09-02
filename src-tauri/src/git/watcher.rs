use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{DebouncedEvent, Debouncer, new_debouncer};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::git::error::GitError;

/// Global watcher state - one watcher per app instance
pub struct WatcherState {
    debouncer: Option<Debouncer<RecommendedWatcher>>,
    watched_path: Option<PathBuf>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            debouncer: None,
            watched_path: None,
        }
    }
}

impl Default for WatcherState {
    fn default() -> Self {
        Self::new()
    }
}

/// Event emitted when repository files change
#[derive(Clone, serde::Serialize)]
pub struct FileChangeEvent {
    pub paths: Vec<String>,
}

/// Decide whether a changed path should be forwarded to the frontend.
///
/// Working-tree paths are always relevant. Inside `.git`, most writes are
/// internal bookkeeping produced by the app's own operations (index updates,
/// reflogs, objects, lock files) and would emit spurious `repository-changed`
/// events, so they are dropped. The exceptions are the files that carry a
/// branch switch, creation or deletion — `HEAD`, `packed-refs` and anything
/// under `refs/` — which the UI must pick up even when the change happened
/// outside the app (e.g. `git checkout` from a terminal).
pub fn is_relevant_path(path: &Path) -> bool {
    let components: Vec<&std::ffi::OsStr> = path.components().map(|c| c.as_os_str()).collect();

    let Some(git_idx) = components.iter().position(|c| *c == ".git") else {
        // Working tree file
        return true;
    };

    let inside_git = &components[git_idx + 1..];
    let Some(first) = inside_git.first() else {
        // The `.git` directory itself
        return false;
    };

    // Lock files are transient (`HEAD.lock`, `refs/heads/x.lock`, ...)
    if inside_git
        .last()
        .and_then(|c| c.to_str())
        .is_some_and(|name| name.ends_with(".lock"))
    {
        return false;
    }

    match first.to_str() {
        Some("HEAD") | Some("packed-refs") => inside_git.len() == 1,
        Some("refs") => true,
        _ => false,
    }
}

/// Start watching a repository directory for changes.
/// Debounces events with 500ms delay as per PERF-05.
pub fn start_watching(
    state: &mut WatcherState,
    repo_path: PathBuf,
    app_handle: AppHandle,
) -> Result<(), GitError> {
    // Stop any existing watcher first
    stop_watching(state);

    let app_handle_clone = app_handle.clone();

    // Create debouncer with 500ms delay
    let debouncer = new_debouncer(
        Duration::from_millis(500),
        move |result: Result<Vec<DebouncedEvent>, notify::Error>| match result {
            Ok(events) => {
                // Keep working-tree changes plus HEAD/ref changes under `.git`;
                // drop the rest of the internal git writes (see `is_relevant_path`).
                let paths: Vec<String> = events
                    .iter()
                    .filter(|e| is_relevant_path(&e.path))
                    .map(|e| e.path.to_string_lossy().to_string())
                    .collect();

                if !paths.is_empty() {
                    // Emit event to frontend
                    let _ = app_handle_clone.emit("repository-changed", FileChangeEvent { paths });
                }
            }
            Err(e) => {
                eprintln!("Watcher error: {:?}", e);
            }
        },
    )
    .map_err(|e| GitError::Internal(format!("Failed to create watcher: {}", e)))?;

    // Get mutable reference to debouncer's watcher
    let mut debouncer = debouncer;

    // Watch the repository directory recursively
    debouncer
        .watcher()
        .watch(&repo_path, RecursiveMode::Recursive)
        .map_err(|e| GitError::Internal(format!("Failed to watch path: {}", e)))?;

    state.debouncer = Some(debouncer);
    state.watched_path = Some(repo_path);

    Ok(())
}

/// Stop watching the current repository.
pub fn stop_watching(state: &mut WatcherState) {
    if let (Some(mut debouncer), Some(path)) = (state.debouncer.take(), state.watched_path.take()) {
        let _ = debouncer.watcher().unwatch(&path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(s: &str) -> PathBuf {
        PathBuf::from(s)
    }

    #[test]
    fn working_tree_paths_are_relevant() {
        assert!(is_relevant_path(&p("/repo/src/main.rs")));
        assert!(is_relevant_path(&p("/repo/README.md")));
        // A directory merely named like git metadata is still working tree
        assert!(is_relevant_path(&p("/repo/docs/.gitignore")));
    }

    #[test]
    fn head_and_refs_changes_are_relevant() {
        // External `git checkout` / gitflow start rewrite HEAD
        assert!(is_relevant_path(&p("/repo/.git/HEAD")));
        // Branch create/delete/update
        assert!(is_relevant_path(&p("/repo/.git/refs/heads/feature/payments")));
        assert!(is_relevant_path(&p("/repo/.git/refs/heads/develop")));
        // Fetch, tags, stash
        assert!(is_relevant_path(&p("/repo/.git/refs/remotes/origin/main")));
        assert!(is_relevant_path(&p("/repo/.git/refs/tags/v1.0.0")));
        assert!(is_relevant_path(&p("/repo/.git/refs/stash")));
        // `git pack-refs` / gc rewrite packed-refs
        assert!(is_relevant_path(&p("/repo/.git/packed-refs")));
    }

    #[test]
    fn internal_git_writes_are_ignored() {
        assert!(!is_relevant_path(&p("/repo/.git")));
        assert!(!is_relevant_path(&p("/repo/.git/index")));
        assert!(!is_relevant_path(&p("/repo/.git/logs/HEAD")));
        assert!(!is_relevant_path(&p("/repo/.git/logs/refs/heads/main")));
        assert!(!is_relevant_path(&p("/repo/.git/objects/ab/cdef")));
        assert!(!is_relevant_path(&p("/repo/.git/ORIG_HEAD")));
        assert!(!is_relevant_path(&p("/repo/.git/FETCH_HEAD")));
        assert!(!is_relevant_path(&p("/repo/.git/config")));
    }

    #[test]
    fn lock_files_are_ignored() {
        assert!(!is_relevant_path(&p("/repo/.git/HEAD.lock")));
        assert!(!is_relevant_path(&p("/repo/.git/refs/heads/main.lock")));
        assert!(!is_relevant_path(&p("/repo/.git/packed-refs.lock")));
    }
}
