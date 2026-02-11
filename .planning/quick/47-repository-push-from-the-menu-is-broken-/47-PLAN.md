---
phase: quick-47
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/commands/sync.ts
  - src/core/commands/toolbar-actions.ts
  - src/core/hooks/useCommitExecution.ts
autonomous: true
must_haves:
  truths:
    - "Push/pull/fetch show error toast when the Tauri command returns Result with status error"
    - "Push/pull/fetch show error toast when SyncResult.success is false"
    - "Push/pull/fetch only show success toast when both Result.status is ok AND SyncResult.success is true"
    - "gitHookBus.emitDid only fires on actual success, not on every call"
  artifacts:
    - path: "src/core/commands/sync.ts"
      provides: "Command palette push/pull/fetch with proper Result handling"
      contains: "result.status"
    - path: "src/core/commands/toolbar-actions.ts"
      provides: "Toolbar push/pull/fetch with proper Result handling"
      contains: "result.status"
    - path: "src/core/hooks/useCommitExecution.ts"
      provides: "Commit push mutation with proper Result handling"
      contains: "result.status"
  key_links:
    - from: "src/core/commands/sync.ts"
      to: "src/core/lib/errors.ts"
      via: "getErrorMessage import"
      pattern: "getErrorMessage"
    - from: "src/core/commands/toolbar-actions.ts"
      to: "src/core/lib/errors.ts"
      via: "getErrorMessage import"
      pattern: "getErrorMessage"
---

<objective>
Fix push/pull/fetch operations that silently succeed even when the underlying git operation fails.

Purpose: The Tauri bindings return `Result<SyncResult, GitError>` but all three callers (command palette commands, toolbar actions, commit hook push mutation) ignore the Result wrapper and unconditionally show a success toast. Git errors are returned as `{ status: "error" }` values, NOT thrown as exceptions, so the catch blocks never fire for actual git failures.

Output: All sync operations properly check `result.status` and `result.data.success` before showing success/error toasts.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/core/commands/sync.ts
@src/core/commands/toolbar-actions.ts
@src/core/hooks/useCommitExecution.ts
@src/core/lib/errors.ts
@src/bindings.ts (lines 314-341 for sync command signatures, line 1684 for GitError, line 2145 for SyncResult, lines 2332-2334 for Result type)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix Result handling in command palette sync commands and toolbar actions</name>
  <files>src/core/commands/sync.ts, src/core/commands/toolbar-actions.ts</files>
  <action>
Both files have the same bug: `await tauriCommands.pushToRemote(...)` returns `Result<SyncResult, GitError>` but the return value is discarded, and `toast.success(...)` fires unconditionally.

**In `src/core/commands/sync.ts`:**

1. Add import: `import { getErrorMessage } from "../lib/errors";`
2. For each of the three commands (push at line 22, pull at line 41, fetch at line 60), apply the same fix pattern:

```typescript
// BEFORE (broken):
const channel = new Channel<SyncProgress>();
await tauriCommands.pushToRemote("origin", channel);
toast.success("Pushed to origin");

// AFTER (fixed):
const channel = new Channel<SyncProgress>();
const result = await tauriCommands.pushToRemote("origin", channel);
if (result.status === "error") {
  toast.error(`Push failed: ${getErrorMessage(result.error)}`);
  return;
}
if (!result.data.success) {
  toast.error(`Push failed: ${result.data.message}`);
  return;
}
toast.success("Pushed to origin");
```

Apply the same pattern for pull ("Pull failed") and fetch ("Fetch failed"), adjusting the label and function call accordingly.

**In `src/core/commands/toolbar-actions.ts`:**

1. Add import: `import { getErrorMessage } from "../lib/errors";`
2. For each of the three toolbar actions (tb:fetch at line 185, tb:pull at line 210, tb:push at line 235), apply the same fix pattern. In these actions, the `gitHookBus.emitDid(...)` call must ALSO be gated behind the success check (only emit on actual success).

```typescript
// BEFORE (broken - tb:push example):
const channel = new Channel<SyncProgress>();
await tauriCommands.pushToRemote("origin", channel);
gitHookBus.emitDid("push");
toast.success("Pushed to origin");

// AFTER (fixed):
const channel = new Channel<SyncProgress>();
const result = await tauriCommands.pushToRemote("origin", channel);
if (result.status === "error") {
  toast.error(`Push failed: ${getErrorMessage(result.error)}`);
  return;
}
if (!result.data.success) {
  toast.error(`Push failed: ${result.data.message}`);
  return;
}
gitHookBus.emitDid("push");
toast.success("Pushed to origin");
```

Apply the same pattern for tb:pull and tb:fetch.

Keep the existing try/catch blocks -- they still guard against unexpected runtime errors (network failures, Tauri IPC errors). The Result checks handle git-level errors within the try block.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` to confirm no new type errors (ignore pre-existing bindings.ts error TS2440). Verify that `result.status` checks exist in all 6 locations by searching: `grep -n "result.status" src/core/commands/sync.ts src/core/commands/toolbar-actions.ts`
  </verify>
  <done>
All 6 sync command call sites (3 in sync.ts, 3 in toolbar-actions.ts) capture the Result, check `result.status === "error"` and `result.data.success === false`, and only show success toast + emit gitHookBus events on actual success.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix Result handling in useCommitExecution push mutation</name>
  <files>src/core/hooks/useCommitExecution.ts</files>
  <action>
The `pushMutation` in `useCommitExecution` uses react-query's `useMutation`, which has a different control flow. The `mutationFn` returns the Result directly, and `onSuccess` fires whenever the Promise resolves (which includes `{ status: "error" }` results since they are NOT thrown).

1. Add import: `import { getErrorMessage } from "../lib/errors";`
2. Modify the `pushMutation` to check the Result in `onSuccess`:

```typescript
const pushMutation = useMutation({
  mutationFn: () => {
    const channel = new Channel<SyncProgress>();
    return commands.pushToRemote("origin", channel);
  },
  onSuccess: (result) => {
    // Result<SyncResult, GitError> - errors come as values, not exceptions
    if (result.status === "error") {
      toast.error(`Push failed: ${getErrorMessage(result.error)}`);
      options?.onPushError?.(result.error);
      return;
    }
    if (!result.data.success) {
      toast.error(`Push failed: ${result.data.message}`);
      options?.onPushError?.(new Error(result.data.message));
      return;
    }
    toast.success("Pushed to origin");
    queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
    gitHookBus.emitDid("push");
    options?.onPushSuccess?.();
  },
  onError: (error) => {
    toast.error(`Push failed: ${String(error)}`, {
      label: "Retry",
      onClick: () => pushMutation.mutate(),
    });
    options?.onPushError?.(error);
  },
});
```

Key changes:
- `onSuccess` receives `result` parameter (typed as the return of mutationFn, which is `Result<SyncResult, GitError>`)
- Check `result.status === "error"` first, show error toast + call onPushError
- Check `result.data.success === false` next
- Only on full success: show success toast, invalidate queries, emit hook, call callback
- `onError` remains for unexpected runtime/IPC errors
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` to confirm no new type errors. Verify Result check exists: `grep -n "result.status" src/core/hooks/useCommitExecution.ts`
  </verify>
  <done>
The push mutation in useCommitExecution properly handles Result-wrapped errors: git failures show error toasts and trigger onPushError, while only true successes show the success toast, invalidate queries, and emit gitHookBus events.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` -- no new type errors
2. `grep -rn "result.status" src/core/commands/sync.ts src/core/commands/toolbar-actions.ts src/core/hooks/useCommitExecution.ts` -- 7 occurrences total (3 sync.ts + 3 toolbar-actions.ts + 1 useCommitExecution.ts)
3. `grep -rn "getErrorMessage" src/core/commands/sync.ts src/core/commands/toolbar-actions.ts src/core/hooks/useCommitExecution.ts` -- import and usage in all 3 files
4. No occurrence of bare `toast.success("Pushed to origin")` / `toast.success("Pulled from origin")` / `toast.success("Fetched from origin")` without a preceding `result.status` guard
</verification>

<success_criteria>
- All 7 sync call sites (3 in sync.ts, 3 in toolbar-actions.ts, 1 in useCommitExecution.ts) properly unwrap Result<SyncResult, GitError>
- Error results show error toasts with human-readable messages via getErrorMessage()
- SyncResult.success === false shows error toast with the result message
- Success toasts and gitHookBus events only fire on genuine success
- TypeScript compiles cleanly (excluding pre-existing bindings.ts TS2440)
</success_criteria>

<output>
After completion, create `.planning/quick/47-repository-push-from-the-menu-is-broken-/47-SUMMARY.md`
</output>
