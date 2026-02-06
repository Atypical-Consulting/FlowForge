---
phase: 17-hierarchical-view-commit-enhancements
plan: 02
status: complete
started: 2026-02-06
completed: 2026-02-06
key-files:
  created: []
  modified:
    - src-tauri/src/git/staging.rs
    - src-tauri/src/lib.rs
    - src/bindings.ts
    - src/components/staging/FileTreeView.tsx
    - src/components/staging/FileItem.tsx
    - src/components/staging/StagingPanel.tsx
commits:
  - hash: 2d90c88
    message: "feat(17-02): add batch stage_files and unstage_files Rust commands"
  - hash: b93f457
    message: "feat(17-02): add folder stage/unstage buttons and fix tree icon spacing to 16px step"
---

# Plan 17-02 Summary: Batch Staging + Folder Stage/Unstage + Icon Spacing

## What was built

**Rust backend**: Two new Tauri commands `stage_files` and `unstage_files` that batch-stage/unstage multiple files in a single index write operation. Uses `add_all` + `update_all` for correct handling of new, modified, deleted, and renamed files. Handles unborn branch edge case for unstaging.

**Folder staging UI**: Directory nodes in the hierarchical file tree now have stage/unstage buttons that appear on hover. Clicking stages or unstages all files within that folder via the batch command, triggering a single query invalidation (no N-refetch storm). Buttons have proper ARIA labels and keyboard accessibility.

**Icon spacing**: Changed tree indent step from 12px to 16px (matches VSCode convention). Added fixed-width `w-4` containers for chevron and icon columns. FileItem gets a chevron spacer in tree mode so file icons align with folder icons at all depths.

## Key decisions

- Used `index.add_all()` + `update_all()` pattern (per tech expert) instead of looping `add_path()` — handles all edge cases correctly including deletions and renames
- Kept folder buttons hover-only with `opacity-0 group-hover:opacity-100` — consistent with existing per-file button pattern in FileItem
- Did NOT update FileTreeBlade.tsx indent — that component uses a structurally different tree (`<details>` elements) with flat 12px per level, not the same tree system
- Folder row changed from `<button>` to `<div role="button">` to allow nested stage button without nesting `<button>` in `<button>`

## Metrics

- **Rust**: +75 lines (two new commands)
- **TypeScript**: +87 lines (folder staging, indent fixes, callback wiring)
- **Batch efficiency**: Single `index.write()` regardless of file count

## Self-Check: PASSED

- [x] Clicking stage on a folder in "Changes" stages all files within
- [x] Clicking unstage on a folder in "Staged Changes" unstages all files within
- [x] Clicking stage on a folder in "Untracked Files" stages all untracked files within
- [x] Batch operations trigger single query invalidation
- [x] Icon widths uniform (w-4 containers) at every nesting depth
- [x] Icon-to-text spacing consistent between folder rows and file rows
- [x] Indent guides use 16px step
- [x] TypeScript compilation passes
- [x] Frontend build succeeds
- [x] Rust compilation passes
