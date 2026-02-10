---
phase: 36
plan: 01
status: complete
started: 2026-02-10
completed: 2026-02-10
duration: 8min
---

## Summary

Extended the Rust backend with GitHub write operations and extension lifecycle commands.

## What Was Built

**GitHub HTTP client extensions** — Added `github_post` and `github_put` authenticated helpers in client.rs with 30-second timeout for write operations. Added write-specific status code handling (405→MergeNotAllowed, 409→HeadChanged, 422→ValidationFailed).

**PR write commands** — `github_merge_pull_request` (PUT to merge endpoint with strategy selection) and `github_create_pull_request` (POST to create new PRs with draft support). Both use internal request body types and return typed IPC results.

**Branch info for PR pre-fill** — `github_get_branch_info_for_pr` reads git2 repository state to detect current branch, default base (main/master), generate suggested title from branch name, and collect commit messages ahead of base via revwalk.

**Extension install lifecycle** — Four new commands: `extension_fetch_manifest` (clone git repo, read manifest), `extension_install` (move from temp to extensions dir), `extension_uninstall` (remove extension dir), `extension_cancel_install` (cleanup temp on cancel).

## Key Files

### key-files.created
- src-tauri/src/github/branch_info.rs — PR pre-fill via git2 operations
- src-tauri/src/extensions/install.rs — Extension install/uninstall lifecycle

### key-files.modified
- src-tauri/src/github/client.rs — POST/PUT helpers with write status handling
- src-tauri/src/github/error.rs — 3 new write-specific error variants
- src-tauri/src/github/types.rs — Write request bodies and IPC result types
- src-tauri/src/github/pulls.rs — Merge and create PR Tauri commands
- src-tauri/src/github/mod.rs — Module re-exports for new commands
- src-tauri/src/extensions/mod.rs — Install module registration
- src-tauri/src/lib.rs — 7 new commands in collect_commands![]
- src/bindings.ts — Auto-generated TypeScript bindings for all commands

## Decisions

- Used 30s timeout for POST/PUT (vs 15s for GET) since write ops may take longer
- `branch_name_to_title` strips 6 common prefixes, replaces separators, capitalizes
- Extension install uses `rename` first (same filesystem), falls back to recursive copy
- `ExtensionFetchResult` carries both manifest JSON and temp path for two-step install flow
- Branch info uses `spawn_blocking` for synchronous git2 operations (matches existing pattern)

## Self-Check: PASSED
- [x] Rust compiles without errors
- [x] All 7 new Tauri commands registered
- [x] TypeScript bindings auto-generated for all commands and types
- [x] Write-specific error variants in GitHubError
- [x] POST/PUT helpers follow existing GET pattern
