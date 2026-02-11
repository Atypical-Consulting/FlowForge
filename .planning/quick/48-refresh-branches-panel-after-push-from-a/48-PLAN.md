# Quick Task 48: Refresh branches panel after push from app menu

## Problem

When a branch is pushed via the app menu (toolbar action or SyncButtons), the branches panel does not refresh. The `gitHookBus.emitDid("push")` event fires but nothing listens for it to reload branch data.

Additionally, `SyncButtons.tsx` push/fetch/pull mutations don't emit gitHookBus events at all, so even if a listener existed, pushes from SyncButtons would be missed.

## Plan

### Task 1: Add gitHookBus listener in BranchList to refresh on push/fetch/pull

**File:** `src/core/components/branches/BranchList.tsx`

Add a `useEffect` that subscribes to `gitHookBus.onDid()` for `push`, `fetch`, and `pull` operations. On any of these events, call `loadBranches()` and `loadAllBranches(true)` to refresh the branch list.

### Task 2: Add gitHookBus.emitDid() calls to SyncButtons mutations

**File:** `src/core/components/sync/SyncButtons.tsx`

Add `gitHookBus.emitDid("push")`, `gitHookBus.emitDid("pull")`, and `gitHookBus.emitDid("fetch")` to the respective mutation `onSuccess` handlers, matching the pattern in `toolbar-actions.ts`.

## Files Changed

1. `src/core/components/branches/BranchList.tsx` - Add gitHookBus listener effect
2. `src/core/components/sync/SyncButtons.tsx` - Add gitHookBus event emissions
