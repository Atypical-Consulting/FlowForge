---
phase: 36
plan: 03
status: complete
started: 2026-02-10
completed: 2026-02-10
duration: 6min
---

## Summary

Wired all Phase 36 components into the existing UI: merge button in PR detail, CreatePR registration, Extension Manager command, and extension persistence.

## What Was Built

**Merge button in PR detail** — Added merge button visible only for open, non-draft PRs. Clicking opens MergeConfirmDialog with strategy selector, commit message, and head SHA for conflict detection. Auto-closes on merge success via useEffect on `mergeMutation.isSuccess`.

**CreatePR blade registration** — Lazy-loaded CreatePullRequestBlade in GitHub extension `ensureComponents()`. Registered as `ext:github:create-pr` blade (singleton, panel with back). Added command (`create-pull-request`) and toolbar action (priority 55, views group) with remote detection guard.

**Extension Manager command** — Created `src/commands/extensions.ts` with `open-extension-manager` command in Settings category (Puzzle icon). Registered in command barrel import.

**Extension enable/disable persistence** — Added `persistDisabledExtensions` and `loadDisabledExtensions` helpers using `getStore()` from tauri-plugin-store. Modified `activateAll` to check persisted disabled list and set `disabled` status instead of activating. Modified `deactivateExtension` to persist after disabling. Modified `activateExtension` to accept `disabled`/`deactivated` status for re-enabling. Added `disabled` status to `ExtensionStatus` type.

## Key Files

### key-files.created
- src/commands/extensions.ts — Extension Manager command palette entry

### key-files.modified
- src/extensions/github/blades/PullRequestDetailBlade.tsx — Merge button + MergeConfirmDialog
- src/extensions/github/index.ts — CreatePR blade, command, and toolbar registration
- src/extensions/ExtensionHost.ts — Enable/disable persistence via tauri-plugin-store
- src/extensions/extensionTypes.ts — Added "disabled" to ExtensionStatus
- src/commands/index.ts — Barrel import for extensions command

## Decisions

- Merge button placed inline in PR header (not renderTrailing) for maximum visibility
- `disabled` status is distinct from `deactivated` — `disabled` = user-intentional, persisted; `deactivated` = runtime cleanup
- Persistence saves disabled IDs (not enabled) — simpler and forward-compatible with new extensions
- CreatePR toolbar action shows only when authenticated + remotes detected + branch present

## Self-Check: PASSED
- [x] TypeScript compiles with no errors
- [x] Rust compiles with no errors
- [x] Merge button rendered for open non-draft PRs
- [x] CreatePR blade accessible from command palette and toolbar
- [x] Extension Manager accessible from command palette
- [x] Extension state persists via tauri-plugin-store
