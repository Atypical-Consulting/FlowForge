# Quick Task 48: Refresh branches panel after push from app menu

## What Changed

### BranchList.tsx
- Added `gitHookBus` import
- Added `useEffect` that subscribes to `push`, `fetch`, and `pull` events via `gitHookBus.onDid()`
- On any of these events, calls `loadBranches()` and `loadAllBranches(true)` to refresh the branch list
- Properly cleans up subscriptions on unmount

### SyncButtons.tsx
- Added `gitHookBus` import
- Added `gitHookBus.emitDid("push")` to push mutation's `onSuccess`
- Added `gitHookBus.emitDid("pull")` to pull mutation's `onSuccess`
- Added `gitHookBus.emitDid("fetch")` to fetch mutation's `onSuccess`
- This ensures SyncButtons are consistent with toolbar-actions.ts which already emitted these events

## Why

The branch list only loaded on component mount. After a push/fetch/pull operation, remote tracking info could change but the panel never refreshed. Now any push/fetch/pull from any source (toolbar menu, SyncButtons, or commit form) triggers a branch list refresh via the gitHookBus event system.

### BranchItem.tsx (AheadBehindBadge)
- Added `gitHookBus` import
- Added a `tick` state + `useEffect` that subscribes to `push`, `fetch`, `pull` events
- When any fires, increments `tick` which triggers the data-fetching `useEffect` to re-run
- This clears the stale "↑2" ahead indicator after a successful push

## Commits
- `a474c3a` - fix(quick-48): refresh branches panel after push/fetch/pull operations
- `38b47a7` - fix(quick-48): refresh ahead/behind badges after push/fetch/pull
