# Quick Task 025: Fix TAURI_CHANNEL CI pipeline failure

## Result: COMPLETE

**Commit:** c6bafb2

## Problem

CI pipeline failed on all 3 platforms (macOS, Windows, Linux) with:
```
src/bindings.ts(1540,2): error TS2440: Import declaration conflicts with local declaration of 'TAURI_CHANNEL'.
```

## Root Cause

`tauri-specta` auto-generates both:
1. `export type TAURI_CHANNEL<TSend> = null` (line 1378) — a placeholder type
2. `Channel as TAURI_CHANNEL` (line 1540) — the real import

These conflict because TypeScript doesn't allow a local type and an import with the same name.

## Fix

1. **Immediate:** Removed the duplicate `export type TAURI_CHANNEL<TSend> = null` line from `src/bindings.ts`
2. **Permanent:** Added a post-export fixup in `src-tauri/src/lib.rs` that strips the duplicate type every time bindings are regenerated (only runs in debug builds)
3. **Tag:** Deleted old v1.1.0 tag (local + remote), recreated on fixed commit, pushed to trigger new CI run

## Verification

- `npx tsc --noEmit` passes cleanly
- `cargo check` passes
- `grep "export type TAURI_CHANNEL" src/bindings.ts` returns no matches
