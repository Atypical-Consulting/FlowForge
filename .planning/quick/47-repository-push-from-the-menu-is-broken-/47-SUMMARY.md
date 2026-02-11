# Quick Task 47: Fix push/pull/fetch sync commands

## Problem

Two issues:
1. All sync operations showed a success toast even when the operation failed — the TypeScript callers ignored the `Result<SyncResult, GitError>` return value
2. HTTPS authentication failed inside the Tauri app because `git2`'s built-in `credential_helper` doesn't work reliably in sandboxed app environments

## Root Cause

**Issue 1 (Frontend):** The `pushToRemote`, `pullFromRemote`, and `fetchFromRemote` Tauri commands return a discriminated union (`{ status: "ok" }` / `{ status: "error" }`). All callers discarded the return value and unconditionally showed `toast.success(...)`. The `catch` blocks only caught runtime exceptions, not git-level errors.

**Issue 2 (Backend):** The `create_credentials_callback` in Rust tried `git2::Cred::credential_helper` for HTTPS, but this fails inside Tauri apps where the environment differs from a terminal. The `osxkeychain` helper wasn't being invoked properly.

## Fix

### Frontend — Result handling (commit `5107abd`)

All 7 call sites now properly unwrap the Result:
1. **`src/core/commands/sync.ts`** — 3 commands: check `status === "error"` and `data.success === false`
2. **`src/core/commands/toolbar-actions.ts`** — 3 toolbar actions: same fix, plus `gitHookBus.emitDid()` gated behind success
3. **`src/core/hooks/useCommitExecution.ts`** — 1 push mutation: `onSuccess` checks Result before proceeding

### Backend — Credential fallback (commit `cb4e170`)

1. Created shared `src-tauri/src/git/credentials.rs` module (was duplicated in `remote.rs` and `clone.rs`)
2. Added `git credential fill` subprocess fallback that works with all credential helpers (osxkeychain, gh auth, credential-store)
3. Authentication now tries: SSH agent → git2 credential helper → `git credential fill` subprocess → default

## Files Changed

| File | Change |
|------|--------|
| `src/core/commands/sync.ts` | Added Result unwrapping to push/pull/fetch commands |
| `src/core/commands/toolbar-actions.ts` | Added Result unwrapping to toolbar push/pull/fetch actions |
| `src/core/hooks/useCommitExecution.ts` | Added Result unwrapping to push mutation onSuccess |
| `src-tauri/src/git/credentials.rs` | New shared credential module with `git credential fill` fallback |
| `src-tauri/src/git/remote.rs` | Use shared credentials, remove duplicate |
| `src-tauri/src/git/clone.rs` | Use shared credentials, remove duplicate |
| `src-tauri/src/git/mod.rs` | Register credentials module |

## Commits

- `5107abd` — fix(quick-47): handle Result wrapper in push/pull/fetch sync commands
- `cb4e170` — fix(quick-47): add git credential fill fallback for HTTPS auth in Tauri
