# Quick Task 014: Fix Errors and Warnings

## Task Description

Fix all TypeScript and Rust compiler errors and warnings in the codebase.

## Tasks

### Task 1: Fix TypeScript Error (TS2440)

**Problem:** `src/bindings.ts:1390` - Import declaration conflicts with local declaration of 'TAURI_CHANNEL'

**Solution:** Remove the conflicting `export type TAURI_CHANNEL<TSend> = null;` line that clashes with the import statement.

### Task 2: Fix Rust Unused Import Warnings (19 warnings)

**Problem:** 19 unused import warnings in `git/mod.rs` and `gitflow/mod.rs`

**Solution:** Use `cargo fix --lib -p flowforge --allow-dirty` to automatically remove unused imports.

### Task 3: Fix Rust Dead Code Warnings (5 warnings)

**Problem:** Dead code warnings for:
- `find_previous_tag` function in changelog.rs
- `is_open` method in repository.rs
- `GitflowEvent` enum in machine.rs
- `GitflowMachine` struct in machine.rs
- Associated items in GitflowMachine impl

**Solution:** Add `#[allow(dead_code)]` annotations to suppress warnings for code intended for future use.

## Constraints

- Preserve all functionality
- Don't delete code that may be used in the future
- Ensure both TypeScript and Rust compile cleanly
