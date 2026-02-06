---
phase: quick
plan: 025
type: execute
---

# Quick Task 025: Fix TAURI_CHANNEL CI pipeline failure

## Tasks

### Task 1: Remove duplicate TAURI_CHANNEL type from bindings.ts
- Remove `export type TAURI_CHANNEL<TSend> = null` which conflicts with `Channel as TAURI_CHANNEL` import

### Task 2: Add post-export fixup in lib.rs
- After `builder.export()`, strip the duplicate type automatically so future regenerations are clean

### Task 3: Delete and recreate v1.1.0 tag
- Delete old tag (local + remote), recreate on fixed commit, push to trigger CI
