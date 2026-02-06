---
phase: 16-quick-fixes-visual-polish
plan: 02
status: complete
started: 2026-02-06
completed: 2026-02-06
key-files:
  created: []
  modified:
    - src-tauri/src/git/tag.rs
    - src/bindings.ts
commits:
  - hash: 3eaace9
    message: "feat(16-02): add created_at_ms to TagInfo and sort tags by date descending"
  - hash: 74fb2a3
    message: "chore(16-02): regenerate TypeScript bindings with createdAtMs field"
---

## Summary

Added timestamp to TagInfo and sorted tags by most recent first.

## What Was Built

### Task 1: Add created_at_ms and sort by date
- Added `created_at_ms: f64` field to `TagInfo` struct
- Annotated tags: uses tagger signature time, falls back to target commit time
- Lightweight tags: uses commit time
- Sort changed from alphabetical (`a.name.cmp(&b.name)`) to descending by timestamp (`b.created_at_ms.partial_cmp(&a.created_at_ms)`)
- Both `list_tags` and `create_tag` functions populate the new field

### Task 2: Regenerate TypeScript bindings
- `cargo build` triggered specta to regenerate `src/bindings.ts`
- `TagInfo` type now includes `createdAtMs: number`
- No frontend sorting changes needed — backend returns tags pre-sorted

## Deviations

None.

## Self-Check: PASSED
- `cargo check` compiles with no errors
- `createdAtMs: number` present in bindings.ts TagInfo type
- Tags sorted descending by timestamp in list_tags
