# Quick Task 39: Full XState Integration — Summary

## What was done

Extracted merge and gitflow workflows from Zustand boolean flags into proper XState v5 state machines, created a MachineRegistry, and extended ExtensionAPI with machine lifecycle management.

### Task 1: MachineRegistry + ExtensionAPI Integration

- **Created** `src/lib/machineRegistry.ts` — Zustand-based registry (Map<string, MachineRegistryEntry>) with register/unregister/unregisterBySource/get/getActor/getAll/getByCategory. Follows commandRegistry pattern with DevTools middleware.
- **Created** `src/lib/machineRegistry.test.ts` — 7 tests covering all operations.
- **Updated** `src/extensions/ExtensionAPI.ts` — Added `registerMachine()`, `getMachineActor()`, `onMachineTransition()` methods with automatic cleanup on extension deactivation.

### Task 2: Merge Workflow Machine

- **Created** `src/machines/merge/` — Full XState machine with states: idle → merging → (conflicted | idle) → aborting → idle, error with RETRY.
- **Created** `src/hooks/useMergeWorkflow.ts` — React hook wrapping useSelector for reactive component access.
- **Updated** `src/stores/domain/git-ops/branches.slice.ts` — Removed branchMergeInProgress, branchLastMergeResult, mergeBranch, abortMerge, clearBranchMergeResult.
- **Updated** `src/components/branches/BranchList.tsx` and `MergeDialog.tsx` — Migrated to useMergeWorkflow.

### Task 3: Gitflow Operations Machine

- **Created** `src/machines/gitflow/` — States: idle → executing → refreshing → (idle | stale), aborting, error. Novel `stale` state for "operation succeeded but refresh failed".
- **Created** `src/hooks/useGitflowWorkflow.ts` — React hook with startOperation, finishOperation, abortGitflow, retryRefresh, dismiss.
- **Updated** `src/stores/domain/git-ops/gitflow.slice.ts` — Removed 7 operation methods, kept data fetching (refreshGitflow, initGitflow, clearGitflowError).
- **Updated** `StartFlowDialog.tsx`, `FinishFlowDialog.tsx`, `GitflowPanel.tsx` — Migrated to useGitflowWorkflow.

## Key patterns established

- **Module-level singleton actors** (outside React lifecycle, survives StrictMode)
- **Parameterized guards** for type-safe event.output access in onDone handlers
- **Inline assign()** in onDone/onError for correct XState v5 typing
- **Hybrid architecture**: Zustand for data containers, XState for workflow orchestration

## Metrics

- Files created: 16
- Files modified: 8
- Lines added: ~1,132
- Lines removed: ~225
- Tests: 240 pass (+ 7 new machineRegistry tests)
- Type check: clean

## Commit

- `400a749` feat(quick-39): add MachineRegistry, merge machine, and gitflow machine with XState
