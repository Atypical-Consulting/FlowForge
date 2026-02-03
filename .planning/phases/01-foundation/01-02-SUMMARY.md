# Plan 01-02 Summary: Git Service Layer with spawn_blocking Pattern

## Status: Complete

## What Was Built

Created the Git service layer with thread-safe repository management and non-blocking operations. All git2 calls are wrapped in `spawn_blocking` to prevent UI freezes. The repository state stores paths (not Repository objects) for thread safety.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create Git Error Types | 2b0b472 | src-tauri/src/git/mod.rs, src-tauri/src/git/error.rs |
| 2 | Create Repository State Management | cdaa3f3 | src-tauri/src/git/repository.rs |
| 3 | Create Tauri Commands for Git Operations | 486e1d5 | src-tauri/src/git/commands.rs |

## Key Deliverables

- **GitError enum** with thiserror + serde + specta derives for typed IPC errors
- **RepositoryState** storing PathBuf (not Repository) for thread safety
- **RepoStatus struct** with camelCase serialization for TypeScript
- **Four Tauri commands**: openRepository, getRepositoryStatus, isGitRepository, closeRepository
- **spawn_blocking** wrapping ALL git2 operations

## Technical Decisions

1. **Store PATH not Repository** (per PITFALLS.md #3): git2::Repository is not Send/Sync, so we store PathBuf and open fresh handles per operation
2. **tokio::sync::Mutex** for async-friendly locking (not std::sync::Mutex)
3. **Fast status options**: `recurse_untracked_dirs(false)` and `exclude_submodules(true)` for performance
4. **Discriminated union errors**: `#[serde(tag = "type", content = "message")]` for TypeScript type narrowing

## Verification

- [x] `cargo check` passes without errors
- [x] `cargo build` succeeds
- [x] src/bindings.ts contains all four git command functions
- [x] src/bindings.ts contains RepoStatus type with camelCase fields
- [x] src/bindings.ts contains GitError discriminated union type
- [x] All git2 calls wrapped in spawn_blocking (grep verified)
- [x] No git2::Repository stored directly in shared state

## Generated TypeScript Types

```typescript
export type RepoStatus = {
  branchName: string;
  isDirty: boolean;
  repoPath: string;
  repoName: string;
}

export type GitError = 
  | { type: "NotFound"; message: string }
  | { type: "NotARepository"; message: string }
  | { type: "EmptyRepository" }
  | { type: "StatusError"; message: string }
  | { type: "OperationFailed"; message: string }
  | { type: "PathNotFound"; message: string }
  | { type: "Internal"; message: string }
```

## Files Modified

```
src-tauri/Cargo.toml (git2 = "0.20" added)
src-tauri/src/lib.rs (git module imported, commands registered)
src-tauri/src/git/mod.rs
src-tauri/src/git/error.rs
src-tauri/src/git/repository.rs
src-tauri/src/git/commands.rs
```

## Patterns Implemented

### spawn_blocking for All Git Operations
```rust
tokio::task::spawn_blocking(move || {
    let repo = git2::Repository::open(&path)?;
    // ... git operations
})
.await
.map_err(|e| GitError::Internal(...))?
```

### Path Storage Pattern
```rust
pub struct RepositoryState {
    current_path: Arc<Mutex<Option<PathBuf>>>,  // PATH, not Repository
}
```

---
*Completed: 2026-02-03*
