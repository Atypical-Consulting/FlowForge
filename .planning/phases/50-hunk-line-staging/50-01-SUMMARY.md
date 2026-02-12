# Plan 50-01 Summary: Rust Backend for Hunk & Line Staging

**Status:** COMPLETE
**Date:** 2026-02-12
**Commits:**
- `feat(phase-50): add enhanced diff types and get_file_diff_hunks command`
- `feat(phase-50): implement hunk and line staging commands with tests`

## What Was Done

### Task 1: Enhanced Diff Types and get_file_diff_hunks Command

**Files modified:**
- `src-tauri/src/git/diff.rs` - Added 3 new types, 1 new command, 1 shared helper
- `src-tauri/src/git/error.rs` - Added 3 new error variants

**New types:**
- `DiffLineOrigin` - Enum: Context, Addition, Deletion
- `DiffLine` - Per-line diff data with origin, old_lineno, new_lineno, content
- `DiffHunkDetail` - Enhanced hunk with index and Vec<DiffLine>

**New helper:**
- `extract_hunks_from_diff(diff, include_lines)` - Consolidates duplicated `diff.foreach()` logic from `get_staged_diff` and `get_unstaged_diff`. Uses `RefCell` for interior mutability to satisfy the borrow checker with concurrent closures.

**New command:**
- `get_file_diff_hunks(path, staged, state)` -> `Vec<DiffHunkDetail>` - Returns per-line diff detail for interactive staging UI

**New error variants:**
- `HunkIndexOutOfRange(u32)`
- `LineRangeInvalid(String)`
- `BinaryPartialStaging`

### Task 2: Hunk and Line Staging Commands with Tests

**Files modified:**
- `src-tauri/src/git/staging.rs` - Added 4 new commands, 1 new type, 7 unit tests
- `src-tauri/src/lib.rs` - Registered 5 new commands
- `src-tauri/Cargo.toml` - Added tempfile dev-dependency

**New type:**
- `LineRange { start: u32, end: u32 }` - 1-based inclusive line range for partial staging

**New commands:**
1. `stage_hunks(path, hunk_indices, state)` - Uses `Repository::apply()` with `ApplyLocation::Index` and `hunk_callback` to selectively apply hunks. Validates indices, checks binary.
2. `unstage_hunks(path, hunk_indices, state)` - Rebuilds index content from HEAD + selected hunks. Fast path: if all hunks unstaged, uses `reset_default`. Handles unborn branch.
3. `stage_lines(path, hunk_index, line_ranges, state)` - Manual content construction using `index.add_frombuffer()`. Selectively applies additions/deletions within a single hunk.
4. `unstage_lines(path, hunk_index, line_ranges, state)` - Reverse of stage_lines: reverts selected lines back to HEAD state while preserving other staged changes.

**Unit tests (7 tests):**
1. `test_stage_single_hunk` - Stages hunk 0, verifies hunk 1 not staged
2. `test_stage_hunk_empty_indices_noop` - Empty indices don't modify index
3. `test_stage_hunk_out_of_range` - Out-of-range index detection
4. `test_unstage_hunk_reverts` - Full stage then unstage restores HEAD content
5. `test_binary_file_returns_error` - Binary file detection works
6. `test_extract_hunks_with_lines` - Detailed hunks have per-line data
7. `test_extract_hunks_without_lines` - include_lines=false returns empty detail

## Verification

- `cargo check` passes (0 errors, only pre-existing github module warnings)
- `cargo test` passes (74 tests: 67 existing + 7 new)
- All 5 new commands registered in `collect_commands![]`
- TypeScript bindings will be auto-generated when `cargo tauri dev` runs (runtime export)

## Architecture Decisions

1. **RefCell for extract_hunks_from_diff**: The `diff.foreach()` API takes multiple closures that need mutable access to shared state. Used `RefCell` for interior mutability since closures run synchronously within a single thread.

2. **Hybrid staging approach**: `Repository::apply()` with `hunk_callback` for hunk-level staging (idiomatic git2). Manual `index.add_frombuffer()` for line-level staging (required for sub-hunk granularity).

3. **Unstage fast path**: When all hunks are being unstaged, skip manual content reconstruction and use `reset_default` (same pattern as existing `unstage_file`).

4. **Binary safety**: All partial staging commands check for binary files early and return `BinaryPartialStaging` error.

## Key Links

- `staging.rs` -> `diff.rs` via `use crate::git::diff::extract_hunks_from_diff`
- `lib.rs` imports: `stage_hunks`, `unstage_hunks`, `stage_lines`, `unstage_lines` from staging, `get_file_diff_hunks` from diff
