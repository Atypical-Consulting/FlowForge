---
phase: 49-inline-conflict-resolution
plan: 01
subsystem: api
tags: [rust, git2, tauri, specta, conflict-resolution]

requires:
  - phase: 48-diff-viewer-foundations
    provides: Monaco pattern improvements and editor disposal patterns
provides:
  - Three Tauri commands for conflict resolution (list, read, resolve)
  - ConflictContent type with ours/theirs/base content and branch labels
  - FileNotConflicted error variant for conflict-specific errors
affects: [49-02, 49-03]

tech-stack:
  added: []
  patterns: [git2 index stages for clean conflict content extraction]

key-files:
  created:
    - src-tauri/src/git/conflict.rs
  modified:
    - src-tauri/src/git/error.rs
    - src-tauri/src/git/mod.rs
    - src-tauri/src/lib.rs
    - src/bindings.ts

key-decisions:
  - "Use git2 index stages (1=ancestor, 2=ours, 3=theirs) for clean content without conflict markers"
  - "Resolve MERGE_HEAD to branch name by scanning local branches for matching OID"

patterns-established:
  - "Conflict command pattern: spawn_blocking with Path::new for conflict_get"

duration: 5min
completed: 2026-02-12
---

# Plan 49-01: Rust Conflict Backend Summary

**Three Tauri commands (list/read/resolve) using git2 index stages for clean conflict content extraction**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `list_conflict_files` reads all conflicted paths from git2 index with our/their/ancestor fallback
- `get_conflict_content` extracts clean ours/theirs/base content from index blobs plus branch labels
- `resolve_conflict_file` writes resolved content, stages via index.add_path, clears conflict entry
- TypeScript bindings auto-generated with ConflictContent type

## Task Commits

1. **Task 1+2: Create conflict.rs + register module** - `fc2a2bd` (feat)

## Files Created/Modified
- `src-tauri/src/git/conflict.rs` - Three specta-tagged Tauri commands for conflict resolution
- `src-tauri/src/git/error.rs` - Added FileNotConflicted error variant
- `src-tauri/src/git/mod.rs` - Registered conflict module
- `src-tauri/src/lib.rs` - Registered three commands in collect_commands!
- `src/bindings.ts` - Auto-generated TypeScript bindings

## Decisions Made
- Used `Path::new(&path)` for `conflict_get` calls (git2 API requires `&Path`, not `&str`)
- Resolved MERGE_HEAD to branch name by scanning local branches for matching OID with graceful fallback

## Deviations from Plan
None - plan executed as specified with one compilation fix (Path type).

## Issues Encountered
- `conflict_get` requires `&Path` not `&String` — fixed with `Path::new(&path)`

## Next Phase Readiness
- All three Tauri commands compile and generate TypeScript bindings
- Frontend can now call listConflictFiles, getConflictContent, resolveConflictFile
- Ready for Plan 49-02 (extension infrastructure)

---
*Phase: 49-inline-conflict-resolution*
*Completed: 2026-02-12*
