use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{DebouncedEvent, Debouncer, new_debouncer};
use std::path::PathBuf;
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
                let paths: Vec<String> = events
                    .iter()
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
