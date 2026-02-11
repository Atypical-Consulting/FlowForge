# Quick Task 47: Fix push/pull/fetch sync commands

## Problem

All sync operations (push, pull, fetch) in the Repository menu, toolbar, and commit hook showed a success toast even when the operation failed. The Tauri bindings return `Result<SyncResult, GitError>` where errors are returned as `{ status: "error" }` values — NOT thrown as exceptions. All callers discarded the Result and unconditionally showed `toast.success(...)`.

## Root Cause

The `pushToRemote`, `pullFromRemote`, and `fetchFromRemote` Tauri commands return a discriminated union:
- `{ status: "ok", data: SyncResult }` on success
- `{ status: "error", error: GitError }` on failure

The callers used `await` without capturing the return value, so errors were silently ignored and the catch blocks (designed for runtime exceptions) never fired for git-level errors.

## Fix

All 7 call sites now properly unwrap the Result:

1. **`src/core/commands/sync.ts`** — 3 commands (push, pull, fetch): capture result, check `status === "error"` and `data.success === false`, show error toasts with `getErrorMessage()`
2. **`src/core/commands/toolbar-actions.ts`** — 3 toolbar actions (tb:fetch, tb:pull, tb:push): same fix, plus `gitHookBus.emitDid()` now only fires on genuine success
3. **`src/core/hooks/useCommitExecution.ts`** — 1 push mutation: `onSuccess` callback now checks the Result before showing success toast / invalidating queries / emitting hooks

## Files Changed

| File | Change |
|------|--------|
| `src/core/commands/sync.ts` | Added Result unwrapping to push/pull/fetch commands |
| `src/core/commands/toolbar-actions.ts` | Added Result unwrapping to toolbar push/pull/fetch actions |
| `src/core/hooks/useCommitExecution.ts` | Added Result unwrapping to push mutation onSuccess |

## Commit

`5107abd` — fix(quick-47): handle Result wrapper in push/pull/fetch sync commands
