# FlowForge Critical Pitfalls

> **Research Dimension**: Pitfalls  
> **Project**: FlowForge — AI-native Git client (Tauri + Rust + React)  
> **Target Constraints**: <50MB binary, <200MB memory, <100ms common operations  
> **Last Updated**: 2026-02-03

---

## Executive Summary

24 domain-specific pitfalls identified across 7 categories. The most critical must be addressed in Phase 1 to avoid architectural debt.

---

## Critical Pitfalls (Phase 1)

### 1. IPC Serialization Bottleneck

**Problem**: Tauri's default JSON serialization becomes a bottleneck for Git data. A 10MB diff takes 5ms on macOS but 200ms on Windows.

**Warning Signs**:
- UI freezes during large diffs
- Clone progress updates lag
- Status refresh takes >100ms

**Prevention**:
- Paginate everything (commits, files, diffs)
- Keep bulk data in Rust, send summaries to frontend
- Use Channels for streaming, not single large payloads
- Treat WebView as display-only, not data storage

**Phase**: Address in Phase 1 (Foundation)

---

### 2. Blocking the Async Runtime

**Problem**: git2-rs is synchronous. Calling it directly on Tokio's async runtime blocks all other tasks.

**Warning Signs**:
- UI freezes during Git operations
- File watcher events delayed
- Commands queue up

**Prevention**:
```rust
// WRONG - blocks runtime
#[tauri::command]
async fn get_status(repo: State<'_, Repo>) -> Result<Status, Error> {
    repo.statuses(None)?  // Blocks!
}

// CORRECT - spawn blocking task
#[tauri::command]
async fn get_status(repo: State<'_, Repo>) -> Result<Status, Error> {
    let repo = repo.clone();
    tokio::task::spawn_blocking(move || {
        repo.statuses(None)
    }).await?
}
```

**Phase**: Address in Phase 1 (Foundation)

---

### 3. libgit2 Thread Safety

**Problem**: git2 Repository objects cannot be shared across threads. Attempting to do so causes undefined behavior or panics.

**Warning Signs**:
- Random panics in Git operations
- Data corruption
- Segfaults

**Prevention**:
- One Repository handle per thread
- Use `Arc<Mutex<Repository>>` for shared access
- Never share git2 objects (Commit, Tree, etc.) across threads
- Clone Repository for parallel operations

**Phase**: Address in Phase 1 (Foundation)

---

### 4. Cross-Platform WebView Differences

**Problem**: Windows (WebView2), macOS (WKWebView), and Linux (WebKitGTK) behave differently in subtle ways.

**Warning Signs**:
- Works on Mac, broken on Windows
- CSS rendering differences
- IPC performance varies 10-40x between platforms

**Prevention**:
- CI builds and tests on all three platforms from day one
- Test IPC performance on each platform
- Avoid platform-specific CSS features
- Document known platform quirks

**Phase**: Address in Phase 1 (Foundation)

---

## High Priority Pitfalls (Phases 2-4)

### 5. Memory Leaks from git2

**Problem**: Long-lived Repository handles accumulate file descriptors and memory. libgit2 caches aggressively.

**Warning Signs**:
- Memory grows over time
- "Too many open files" errors
- Slow performance after extended use

**Prevention**:
- Open Repository per-operation OR with explicit lifecycle
- Call `Repository::cleanup_state()` periodically
- Monitor file descriptor count in development
- Consider re-opening repo after N operations

**Phase**: Address in Phase 2 (Core Git)

---

### 6. File Watching Platform Limits

**Problem**: Each platform has different limits and behaviors:
- Linux inotify: Default 8,192 watches (configurable)
- macOS kqueue: Opens file descriptor per file (~256 default)
- Windows: Can only watch directories, not individual files

**Warning Signs**:
- "No space left on device" (Linux inotify exhausted)
- Watch silently fails on large repos
- Events missing on Windows

**Prevention**:
- Use notify-rs (handles cross-platform)
- Watch directories, not files
- Watch `.git/` directory specifically, not entire worktree
- Implement polling fallback for network filesystems
- Debounce events (Git operations generate hundreds)

**Phase**: Address in Phase 3 (Real-Time Updates)

---

### 7. Large Repository History Loading

**Problem**: 100K+ commits cannot be loaded at once. `git log --graph` takes 2.8+ seconds even on moderate repos.

**Warning Signs**:
- UI freezes when opening large repos
- Memory spikes to gigabytes
- Topology view never loads

**Prevention**:
- Virtual scrolling in commit list (only render visible)
- Incremental loading (load 100 at a time)
- Use git commit-graph for faster traversal
- Defer graph layout calculation
- Cache commit metadata

**Phase**: Address in Phase 4 (Branch Operations) and Phase 8 (Topology)

---

### 8. Gitflow Double-Merge Enforcement

**Problem**: Release and hotfix branches must merge to BOTH main AND develop. Easy to forget one.

**Warning Signs**:
- main and develop diverge unexpectedly
- Features missing from develop after release
- Merge conflicts accumulate

**Prevention**:
- State machine tracks pending merges
- Block branch deletion until both merges complete
- UI shows merge checklist for release/hotfix finish
- Implement as transaction (rollback if either fails)

**Phase**: Address in Phase 5 (Gitflow State Machine)

---

### 9. DAG Layout Complexity

**Problem**: Naive graph layout algorithms are O(n²) or worse. Real repos have thousands of nodes.

**Warning Signs**:
- Topology view takes seconds to render
- Layout "jumps" as commits load
- High CPU during scrolling

**Prevention**:
- Use swimlane algorithm (O(n))
- Virtualize rendering (only visible nodes)
- Cluster old commits
- Pre-compute layout in Rust, send positions to frontend
- Limit visible history (show last 1000, load more on demand)

**Phase**: Address in Phase 8 (Topology)

---

## Medium Priority Pitfalls

### 10. Linux WebKitGTK Version Hell

**Problem**: Ubuntu 20.04, 22.04, and 24.04 ship different WebKitGTK versions. They're not compatible.

**Prevention**:
- Target minimum WebKitGTK version explicitly
- Test on multiple Ubuntu versions in CI
- Document system requirements
- Consider AppImage for better isolation

**Phase**: Address throughout development

---

### 11. Event Storms from File Watching

**Problem**: A single `git checkout` generates hundreds of file events. Processing each individually overwhelms the UI.

**Prevention**:
```rust
// Debounce events - only process after 100ms of quiet
let debouncer = new_debouncer(Duration::from_millis(100), move |events| {
    // Batch process
})?;
```

**Phase**: Address in Phase 3 (Real-Time Updates)

---

### 12. Atomic File Update Blindness

**Problem**: Many editors (vim, VSCode) save files atomically via rename. If you're watching the original file, you miss the update.

**Prevention**:
- Watch directories, not files
- Use notify-rs which handles this
- Re-establish watches after rename events

**Phase**: Address in Phase 3 (Real-Time Updates)

---

### 13. Gitflow is Polarizing

**Problem**: Gitflow has critics. Some teams prefer GitHub Flow or trunk-based development. The original gitflow repo was archived October 2025.

**Prevention**:
- Position Gitflow as primary but not exclusive
- Design state machine to support multiple workflows
- Consider GitHub Flow support in v2
- Don't force Gitflow on repos that don't use it

**Phase**: Design consideration throughout

---

### 14. Merge Conflict During Multi-Step Operations

**Problem**: Gitflow "finish release" involves multiple merges. A conflict in the first breaks the flow.

**Prevention**:
- Check for potential conflicts before starting
- Make operations transactional (complete or rollback)
- Save state to allow resuming after conflict resolution
- Clear UI for "operation in progress" state

**Phase**: Address in Phase 5 (Gitflow State Machine)

---

### 15. Stale Branch Detection False Positives

**Problem**: A branch may be "old" but actively worked on in a worktree.

**Prevention**:
- Cross-reference worktree status
- Use last commit date, not creation date
- Allow user to mark branches as "active"
- Don't auto-delete, only suggest

**Phase**: Address in Phase 7 (Worktrees) and future "branch health" feature

---

## Performance Pitfalls

### 16. Status on Large Worktrees

**Problem**: `git status` touches every file in the worktree. On repos with 50K+ files, this takes seconds.

**Prevention**:
- Use libgit2's `StatusOptions::include_untracked(false)` for quick checks
- Cache status, invalidate on file change
- Show "checking..." state, don't block UI
- Respect `.gitignore` strictly

**Phase**: Address in Phase 2 (Core Git)

---

### 17. Diff Memory Explosion

**Problem**: Loading both sides of a large diff into memory for comparison can use gigabytes.

**Prevention**:
- Stream diffs line-by-line
- Limit diff display size (offer "show full" option)
- Use libgit2's delta compression when available
- Paginate hunks

**Phase**: Address in Phase 2 (Core Git)

---

### 18. Commit Message Scope Inference Failures

**Problem**: Rule-based scope inference from file paths fails for:
- Monorepos with complex structures
- Files that moved
- Cross-cutting changes

**Prevention**:
- Use most common directory as scope
- Allow manual override (always)
- Learn from previous commits in same paths
- Don't over-engineer v1 - 80% accuracy is fine

**Phase**: Address in Phase 6 (Conventional Commits)

---

## Security Pitfalls

### 19. Credential Exposure

**Problem**: Git credentials (tokens, passwords) can leak through logs, error messages, or IPC.

**Prevention**:
- Never log URLs with credentials
- Sanitize error messages before sending to frontend
- Use OS keychain (macOS Keychain, Windows Credential Manager)
- Never store credentials in config files

**Phase**: Address throughout development

---

### 20. Path Traversal in Worktree Operations

**Problem**: User-controlled paths in worktree creation could escape intended directories.

**Prevention**:
- Validate all paths on backend
- Canonicalize paths before operations
- Reject paths with `..` components
- Use allowlist of permitted parent directories

**Phase**: Address in Phase 7 (Worktrees)

---

## UX Pitfalls

### 21. Topology Overload

**Problem**: Showing all branches, all commits, all information overwhelms users.

**Prevention**:
- Default to collapsed/filtered view
- Hide old/merged branches by default
- Progressive disclosure
- Quick filters (this week, this month, this branch)

**Phase**: Address in Phase 8 (Topology)

---

### 22. Conventional Commit Rigidity

**Problem**: Strict validation frustrates users who are learning or have edge cases.

**Prevention**:
- Warnings, not errors (allow non-conventional commits)
- Helpful error messages ("Did you mean `feat:` instead of `feature:`?")
- Quick-fix suggestions
- Optional strict mode

**Phase**: Address in Phase 6 (Conventional Commits)

---

### 23. Worktree Path Confusion

**Problem**: Users forget which worktree they're in, make changes in wrong location.

**Prevention**:
- Clear visual indicator of current worktree
- Show worktree path prominently
- Different window title per worktree
- Quick switcher

**Phase**: Address in Phase 7 (Worktrees)

---

### 24. Lost Work During Destructive Operations

**Problem**: Branch deletion, stash drop, reset can lose work permanently.

**Prevention**:
- Reflog integration (allow recovery)
- Confirmation dialogs for destructive operations
- Show what will be lost before proceeding
- Undo where possible

**Phase**: Address throughout development

---

## Phase-Mapped Summary

| Phase | Critical Pitfalls |
|-------|-------------------|
| 1 (Foundation) | IPC serialization, spawn_blocking, thread safety, cross-platform CI |
| 2 (Core Git) | Memory leaks, status performance, diff memory |
| 3 (Real-Time) | File watching limits, event storms, atomic updates |
| 4 (Branches) | History loading |
| 5 (Gitflow) | Double-merge enforcement, conflict handling |
| 6 (Commits) | Scope inference, validation UX |
| 7 (Worktrees) | Path validation, context clarity |
| 8 (Topology) | DAG layout, visual overload |

---

## Quality Gate Verification

- [x] Pitfalls are specific to Tauri + Git GUI + libgit2 domain
- [x] Prevention strategies are actionable
- [x] Phase mapping included for roadmap integration

---

## Sources

- [Tauri IPC Performance Discussion](https://github.com/tauri-apps/tauri/discussions/7146)
- [libgit2 Threading Documentation](https://github.com/libgit2/libgit2/blob/main/docs/threading.md)
- [notify-rs Documentation](https://docs.rs/notify/latest/notify/)
- [Git Performance Best Practices](https://www.git-tower.com/blog/git-performance)
- [Tauri WebView Versions](https://v2.tauri.app/reference/webview-versions/)
