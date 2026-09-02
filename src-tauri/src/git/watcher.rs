use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

use crate::git::error::GitError;

/// Delay used to coalesce bursts of filesystem events into a single batch (PERF-05).
pub const DEBOUNCE_DELAY: Duration = Duration::from_millis(500);

/// Global watcher state - one watcher per app instance
pub struct WatcherState {
    watcher: Option<RepositoryWatcher>,
    watched_path: Option<PathBuf>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            watcher: None,
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

/// Decide whether an event kind describes an actual change to the file system.
///
/// `notify`'s inotify backend subscribes to `IN_OPEN` / `IN_CLOSE`, so every
/// read of `.git/HEAD` or `.git/refs/**` performed by libgit2 (branch listing,
/// status polling, ...) surfaces as `EventKind::Access`. Forwarding those would
/// make the frontend refresh, which reads the refs again, which emits another
/// event: a self-sustaining loop. Only creates, modifies (data, metadata and
/// renames) and removes are real changes.
///
/// `Any` and `Other` are kept: backends use them when they cannot classify an
/// event (and inotify reports a queue overflow as `Other` + rescan), so the
/// only safe assumption is that something changed.
pub fn is_change_event(kind: &EventKind) -> bool {
    match kind {
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => true,
        EventKind::Any | EventKind::Other => true,
        EventKind::Access(_) => false,
    }
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

/// Extract the paths of a raw `notify` event that should reach the frontend.
///
/// Combines [`is_change_event`] and [`is_relevant_path`]. When the backend
/// signals that events were lost (`Flag::Rescan`, e.g. an inotify queue
/// overflow) the event carries no paths, so the watched root is reported
/// instead: the frontend must assume anything may have changed.
pub fn relevant_paths(event: &Event, root: &Path) -> Vec<PathBuf> {
    if !is_change_event(&event.kind) {
        return Vec::new();
    }

    if event.need_rescan() {
        return vec![root.to_path_buf()];
    }

    event
        .paths
        .iter()
        .filter(|path| is_relevant_path(path))
        .cloned()
        .collect()
}

/// Callback receiving one coalesced batch of changed paths.
type BatchSink = Box<dyn Fn(Vec<PathBuf>) + Send + 'static>;

/// Recursive filesystem watcher that filters raw `notify` events and delivers
/// the relevant paths in debounced batches.
///
/// Independent of Tauri so it can be exercised in tests: the sink is an
/// arbitrary callback.
pub struct RepositoryWatcher {
    // Dropping the watcher drops its event handler and therefore the sender
    // side of the channel, which terminates the debounce thread.
    watcher: RecommendedWatcher,
}

impl RepositoryWatcher {
    pub fn new(
        root: PathBuf,
        delay: Duration,
        sink: impl Fn(Vec<PathBuf>) + Send + 'static,
    ) -> Result<Self, notify::Error> {
        let (tx, rx) = mpsc::channel::<PathBuf>();
        let sink: BatchSink = Box::new(sink);

        thread::Builder::new()
            .name("repository-watcher-debounce".into())
            .spawn(move || run_debounce_loop(rx, delay, sink))
            .map_err(|e| notify::Error::generic(&e.to_string()))?;

        let handler_root = root.clone();
        let mut watcher = RecommendedWatcher::new(
            move |result: Result<Event, notify::Error>| match result {
                Ok(event) => forward_event(&tx, &event, &handler_root),
                Err(e) => eprintln!("Watcher error: {:?}", e),
            },
            Config::default(),
        )?;

        watcher.watch(&root, RecursiveMode::Recursive)?;

        Ok(Self { watcher })
    }

    pub fn unwatch(&mut self, root: &Path) -> Result<(), notify::Error> {
        self.watcher.unwatch(root)
    }
}

fn forward_event(tx: &Sender<PathBuf>, event: &Event, root: &Path) {
    for path in relevant_paths(event, root) {
        // A send error only means the debounce thread is gone (shutdown).
        if tx.send(path).is_err() {
            return;
        }
    }
}

/// Collect paths for `delay` after the first one arrives, then deliver the
/// deduplicated batch. Exits when the sender side is dropped.
fn run_debounce_loop(rx: Receiver<PathBuf>, delay: Duration, sink: BatchSink) {
    while let Ok(first) = rx.recv() {
        let mut batch = BTreeSet::new();
        batch.insert(first);

        let deadline = Instant::now() + delay;
        loop {
            let now = Instant::now();
            if now >= deadline {
                break;
            }
            match rx.recv_timeout(deadline - now) {
                Ok(path) => {
                    batch.insert(path);
                }
                Err(RecvTimeoutError::Timeout) => break,
                // Watcher stopped: the repository is being closed, drop the batch.
                Err(RecvTimeoutError::Disconnected) => return,
            }
        }

        sink(batch.into_iter().collect());
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

    let watcher = RepositoryWatcher::new(repo_path.clone(), DEBOUNCE_DELAY, move |paths| {
        let paths = paths
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();
        // Emit event to frontend
        let _ = app_handle.emit("repository-changed", FileChangeEvent { paths });
    })
    .map_err(|e| GitError::Internal(format!("Failed to watch path: {}", e)))?;

    state.watcher = Some(watcher);
    state.watched_path = Some(repo_path);

    Ok(())
}

/// Stop watching the current repository.
pub fn stop_watching(state: &mut WatcherState) {
    if let (Some(mut watcher), Some(path)) = (state.watcher.take(), state.watched_path.take()) {
        let _ = watcher.unwatch(&path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{
        AccessKind, AccessMode, CreateKind, DataChange, MetadataKind, ModifyKind, RemoveKind,
        RenameMode,
    };

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

    #[test]
    fn access_events_are_not_changes() {
        // What libgit2 produces when it merely reads HEAD / refs
        assert!(!is_change_event(&EventKind::Access(AccessKind::Open(
            AccessMode::Any
        ))));
        assert!(!is_change_event(&EventKind::Access(AccessKind::Open(
            AccessMode::Read
        ))));
        assert!(!is_change_event(&EventKind::Access(AccessKind::Close(
            AccessMode::Read
        ))));
        assert!(!is_change_event(&EventKind::Access(AccessKind::Read)));
        // CLOSE_WRITE always follows a MODIFY, so it adds nothing
        assert!(!is_change_event(&EventKind::Access(AccessKind::Close(
            AccessMode::Write
        ))));
        assert!(!is_change_event(&EventKind::Access(AccessKind::Any)));
    }

    #[test]
    fn create_modify_remove_events_are_changes() {
        assert!(is_change_event(&EventKind::Create(CreateKind::File)));
        assert!(is_change_event(&EventKind::Create(CreateKind::Folder)));
        assert!(is_change_event(&EventKind::Create(CreateKind::Any)));
        assert!(is_change_event(&EventKind::Modify(ModifyKind::Data(
            DataChange::Any
        ))));
        assert!(is_change_event(&EventKind::Modify(ModifyKind::Metadata(
            MetadataKind::Any
        ))));
        assert!(is_change_event(&EventKind::Modify(ModifyKind::Name(
            RenameMode::From
        ))));
        assert!(is_change_event(&EventKind::Modify(ModifyKind::Name(
            RenameMode::To
        ))));
        assert!(is_change_event(&EventKind::Modify(ModifyKind::Any)));
        assert!(is_change_event(&EventKind::Remove(RemoveKind::File)));
        assert!(is_change_event(&EventKind::Remove(RemoveKind::Any)));
    }

    #[test]
    fn unclassified_events_are_treated_as_changes() {
        assert!(is_change_event(&EventKind::Any));
        assert!(is_change_event(&EventKind::Other));
    }

    #[test]
    fn relevant_paths_drops_access_events_even_on_relevant_paths() {
        let event = Event::new(EventKind::Access(AccessKind::Open(AccessMode::Any)))
            .add_path(p("/repo/.git/HEAD"))
            .add_path(p("/repo/src/main.rs"));
        assert!(relevant_paths(&event, &p("/repo")).is_empty());
    }

    #[test]
    fn relevant_paths_applies_path_filter_to_change_events() {
        let event = Event::new(EventKind::Modify(ModifyKind::Data(DataChange::Any)))
            .add_path(p("/repo/.git/HEAD"))
            .add_path(p("/repo/.git/index"))
            .add_path(p("/repo/src/main.rs"));
        assert_eq!(
            relevant_paths(&event, &p("/repo")),
            vec![p("/repo/.git/HEAD"), p("/repo/src/main.rs")]
        );
    }

    #[test]
    fn rescan_reports_the_watched_root() {
        // inotify queue overflow: kind Other, no paths, rescan flag
        let event = Event::new(EventKind::Other).set_flag(notify::event::Flag::Rescan);
        assert_eq!(relevant_paths(&event, &p("/repo")), vec![p("/repo")]);
    }

    #[test]
    fn debounce_loop_coalesces_a_burst_and_deduplicates() {
        let (tx, rx) = mpsc::channel();
        let (out_tx, out_rx) = mpsc::channel();
        let handle = thread::spawn(move || {
            run_debounce_loop(
                rx,
                Duration::from_millis(50),
                Box::new(move |batch| {
                    let _ = out_tx.send(batch);
                }),
            )
        });

        // A commit touches these within a few milliseconds
        tx.send(p("/repo/.git/refs/heads/main")).unwrap();
        tx.send(p("/repo/.git/HEAD")).unwrap();
        tx.send(p("/repo/.git/refs/heads/main")).unwrap();

        let batch = out_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("one batch should be delivered");
        assert_eq!(batch, vec![p("/repo/.git/HEAD"), p("/repo/.git/refs/heads/main")]);
        assert!(
            out_rx.recv_timeout(Duration::from_millis(150)).is_err(),
            "a single burst must produce a single batch"
        );

        drop(tx);
        handle.join().unwrap();
    }

    // Integration tests against the real backend. They rely on the platform
    // watcher reporting a read-open as `Access` (inotify on Linux) and are
    // timing sensitive by nature, so the debounce delay is kept short.
    mod integration {
        use super::*;

        const DELAY: Duration = Duration::from_millis(100);

        fn watch(root: &Path) -> (RepositoryWatcher, Receiver<Vec<PathBuf>>) {
            let (tx, rx) = mpsc::channel();
            let watcher = RepositoryWatcher::new(root.to_path_buf(), DELAY, move |batch| {
                let _ = tx.send(batch);
            })
            .expect("watcher should start");
            // Let the backend settle before producing events
            thread::sleep(Duration::from_millis(100));
            (watcher, rx)
        }

        fn assert_quiet(rx: &Receiver<Vec<PathBuf>>, what: &str) {
            match rx.recv_timeout(DELAY * 4) {
                Ok(batch) => panic!("{what} must not emit, but got {batch:?}"),
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => panic!("watcher died"),
            }
        }

        fn next_batch(rx: &Receiver<Vec<PathBuf>>) -> Vec<PathBuf> {
            rx.recv_timeout(Duration::from_secs(3))
                .expect("a batch should be delivered")
        }

        #[test]
        fn reading_a_file_does_not_emit_but_writing_does() {
            let dir = tempfile::tempdir().unwrap();
            let file = dir.path().join("tracked.txt");
            std::fs::write(&file, "initial").unwrap();

            let (_watcher, rx) = watch(dir.path());

            // Read-open, like libgit2 reading HEAD / refs
            let _ = std::fs::read(&file).unwrap();
            assert_quiet(&rx, "a read");

            std::fs::write(&file, "changed").unwrap();
            let batch = next_batch(&rx);
            assert!(
                batch.iter().any(|p| p.ends_with("tracked.txt")),
                "unexpected batch {batch:?}"
            );
        }

        #[test]
        fn git_ref_reads_are_ignored_and_a_commit_yields_one_batch() {
            let dir = tempfile::tempdir().unwrap();
            let git = dir.path().join(".git");
            std::fs::create_dir_all(git.join("refs/heads")).unwrap();
            std::fs::write(git.join("HEAD"), "ref: refs/heads/main\n").unwrap();
            std::fs::write(git.join("refs/heads/main"), "aaaa\n").unwrap();
            std::fs::write(git.join("index"), "index").unwrap();

            let (_watcher, rx) = watch(dir.path());

            // Status polling / branch listing only read the refs
            for _ in 0..20 {
                let _ = std::fs::read(git.join("HEAD")).unwrap();
                let _ = std::fs::read(git.join("refs/heads/main")).unwrap();
            }
            assert_quiet(&rx, "reading HEAD and refs");

            // Internal bookkeeping is filtered by path
            std::fs::write(git.join("index"), "index2").unwrap();
            assert_quiet(&rx, "an index write");

            // A commit rewrites the branch ref, the index and (on checkout) HEAD
            std::fs::write(git.join("refs/heads/main"), "bbbb\n").unwrap();
            std::fs::write(git.join("index"), "index3").unwrap();
            std::fs::write(git.join("HEAD"), "ref: refs/heads/main\n").unwrap();

            let batch = next_batch(&rx);
            assert!(batch.iter().any(|p| p.ends_with(".git/HEAD")), "{batch:?}");
            assert!(
                batch.iter().any(|p| p.ends_with(".git/refs/heads/main")),
                "{batch:?}"
            );
            assert!(
                !batch.iter().any(|p| p.ends_with(".git/index")),
                "{batch:?}"
            );
            assert_quiet(&rx, "the same commit");
        }

        #[test]
        fn stopping_the_watcher_silences_it() {
            let dir = tempfile::tempdir().unwrap();
            let file = dir.path().join("tracked.txt");

            let (mut watcher, rx) = watch(dir.path());
            watcher.unwatch(dir.path()).unwrap();
            drop(watcher);

            std::fs::write(&file, "after stop").unwrap();
            if let Ok(batch) = rx.recv_timeout(DELAY * 4) {
                panic!("stopped watcher emitted {batch:?}");
            }
        }
    }
}
