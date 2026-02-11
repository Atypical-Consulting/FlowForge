---
type: quick
task_id: 39
description: full XState integration - navigation machine + extension lifecycle state machines from quick-38 research
context_target: 30%
---

# Quick Task 39: Full XState Integration - Navigation Machine + Extension Lifecycle State Machines

## Objective

Integrate XState state machines for Git workflows (merge, gitflow operations) following the architecture and patterns validated in quick-38 research. Create MachineRegistry (Zustand-based, parallel to CommandRegistry), add ExtensionAPI methods for machine registration, and extract merge + gitflow workflows from Zustand slices into proper state machines with extension hooks.

**Why:** The research shows XState provides superior error recovery, cancellation, and extensibility compared to boolean flags in Zustand. The navigation machine validates the pattern works. This task builds the foundation for workflow state machines that extensions can observe and contribute to.

## Context

Research from quick-38:
- @.planning/quick/38-explore-xstate-architecture-from-ux-tech/ARCH-ANALYSIS.md - MachineRegistry design, extension boundary model
- @.planning/quick/38-explore-xstate-architecture-from-ux-tech/DEV-ANALYSIS.md - Full machine implementations with fromPromise/fromCallback patterns
- @.planning/quick/38-explore-xstate-architecture-from-ux-tech/UX-ANALYSIS.md - UX pain points per machine

Reference pattern:
- @src/machines/navigation/ - Established directory structure and patterns

Existing registries:
- @src/lib/commandRegistry.ts - Zustand-based registry pattern to follow
- @src/lib/bladeRegistry.ts - Another registry example

Current workflow code:
- @src/stores/domain/git-ops/branches.slice.ts - Merge workflow (branchMergeInProgress, branchLastMergeResult)
- @src/extensions/gitflow/stores/gitflow.slice.ts - Gitflow operations (finishFeature, finishRelease, finishHotfix)

Extension system:
- @src/extensions/ExtensionAPI.ts - Add registerMachine and related methods
- @src/lib/gitHookBus.ts - Hook bus for git operations

## Tasks

<task type="auto">
  <name>Task 1: MachineRegistry + ExtensionAPI Integration</name>
  <files>
    src/lib/machineRegistry.ts
    src/lib/machineRegistry.test.ts
    src/extensions/ExtensionAPI.ts
  </files>
  <action>
Create MachineRegistry following the Zustand pattern from commandRegistry.ts:

1. Create src/lib/machineRegistry.ts:
   - Zustand store with Map<string, MachineRegistryEntry>
   - MachineRegistryEntry: { id, actor, machine, source, category, extensionPoints? }
   - Methods: register, unregister, unregisterBySource, get, getActor, getAll, getByCategory
   - Use devtools middleware for debugging
   - Export useMachineRegistry hook

2. Add to ExtensionAPI.ts (preserve all existing methods):
   - Add private field: registeredMachines: Array<{ id: string; actor: AnyActorRef }>
   - Add registerMachine(config: { id: string; machine: AnyStateMachine; category?: string }): AnyActorRef
     - Namespace as ext:{extensionId}:{id}
     - Create actor, start it, register with useMachineRegistry
     - Track in registeredMachines for cleanup
   - Add getMachineActor(machineId: string): AnyActorRef | undefined
     - Query useMachineRegistry.getState().getActor(machineId)
   - Add onMachineTransition(machineId: string, handler: (snapshot: any) => void): () => void
     - Subscribe to actor, return unsubscribe function
   - Update cleanup() to stop all registered machines:
     - Call actor.stop() for each registered machine
     - Call useMachineRegistry.getState().unregisterBySource(ext:{extensionId})

3. Create src/lib/machineRegistry.test.ts:
   - Test register/unregister/unregisterBySource
   - Test actor lifecycle (start on register, stop on unregister)
   - Test namespacing and source tracking
   - Use vitest mocks for XState actors
  </action>
  <verify>
npm test -- machineRegistry.test.ts passes
npm run typecheck shows no errors in machineRegistry.ts or ExtensionAPI.ts
  </verify>
  <done>
MachineRegistry exists as Zustand store, ExtensionAPI has machine registration methods, tests pass, no type errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Merge Workflow Machine</name>
  <files>
    src/machines/merge/mergeMachine.ts
    src/machines/merge/types.ts
    src/machines/merge/selectors.ts
    src/machines/merge/actors.ts
    src/machines/merge/index.ts
    src/hooks/useMergeWorkflow.ts
    src/stores/domain/git-ops/branches.slice.ts
  </files>
  <action>
Extract merge workflow from branches.slice.ts into a proper XState machine following navigation machine structure:

1. Create src/machines/merge/ directory with files:

   types.ts:
   - MergeContext: { sourceBranch: string | null; conflicts: string[]; error: string | null; mergeResult: MergeResult | null }
   - MergeEvent: START_MERGE | ABORT | RETRY
   - Export SnapshotFrom type

   actors.ts:
   - executeMerge = fromPromise wrapping commands.mergeBranch (handle result.status ok/error)
   - abortMerge = fromPromise wrapping commands.abortMerge
   - Use getErrorMessage from lib/errors for error handling

   mergeMachine.ts:
   - setup() with types, actors, guards (hasConflicts checks event.output.hasConflicts), actions (setSourceBranch, setMergeResult, setError, clearState)
   - States: idle -> merging -> (conflicted | idle) -> aborting -> idle, error state with RETRY
   - Invoke executeMerge in merging state, handle onDone with guard for conflicts vs success
   - Invoke abortMerge in aborting state

   selectors.ts:
   - selectMergeState, selectConflicts, selectMergeError, selectIsMerging, selectIsConflicted, selectSourceBranch
   - Use SnapshotFrom<typeof mergeMachine> pattern from navigation

   index.ts:
   - Export all public APIs (machine, types, selectors)

2. Create src/hooks/useMergeWorkflow.ts:
   - Module-level singleton: getMergeActor() creates and starts actor on first call (like navigation pattern)
   - Hook returns: { state, conflicts, error, isMerging, startMerge, abort, retry }
   - Use useSelector for reactive state
   - Wrap actorRef.send() in callback functions

3. Update src/stores/domain/git-ops/branches.slice.ts:
   - KEEP: branchList, branchAllList, branchIsLoading, branchError, loadBranches, loadAllBranches, createBranch, checkoutBranch, checkoutRemoteBranch, deleteBranch
   - REMOVE: branchMergeInProgress, branchLastMergeResult, mergeBranch, abortMerge, clearBranchMergeResult (moved to machine)
   - Add comment: "// Merge workflow moved to src/machines/merge/"
  </action>
  <verify>
npm run typecheck passes
npm test shows no broken tests (update any tests referencing removed merge fields)
Merge machine exports are accessible: import { mergeMachine } from "src/machines/merge"
Hook exports work: import { useMergeWorkflow } from "src/hooks/useMergeWorkflow"
  </verify>
  <done>
Merge machine exists in src/machines/merge/ with full structure, useMergeWorkflow hook provides reactive API, branches.slice.ts no longer has merge-specific state
  </done>
</task>

<task type="auto">
  <name>Task 3: Gitflow Operations Machine</name>
  <files>
    src/machines/gitflow/gitflowMachine.ts
    src/machines/gitflow/types.ts
    src/machines/gitflow/selectors.ts
    src/machines/gitflow/actors.ts
    src/machines/gitflow/index.ts
    src/hooks/useGitflowWorkflow.ts
    src/extensions/gitflow/stores/gitflow.slice.ts
  </files>
  <action>
Extract gitflow operations from gitflow.slice.ts into orchestration machine following DEV-ANALYSIS.md pattern:

1. Create src/machines/gitflow/ directory with files:

   types.ts:
   - GitflowOp: "feature" | "release" | "hotfix"
   - GitflowPhase: "start" | "finish"
   - GitflowContext: { operation: GitflowOp | null; phase: GitflowPhase | null; name: string | null; tagMessage: string | null; error: string | null; refreshErrors: string[] }
   - GitflowEvent: START | FINISH | RETRY_REFRESH | DISMISS_ERROR

   actors.ts:
   - executeGitflowOp = fromPromise accepting { operation, phase, name, tagMessage }, dispatches to correct commands.* function
   - refreshAll = fromPromise running parallel Promise.allSettled for getGitflowStatus, listBranches, getRepoStatus, collect errors without throwing

   gitflowMachine.ts:
   - setup() with context, events, actors, actions (setStart, setFinish, setError, setRefreshError, clearState)
   - States: idle -> executing -> refreshing -> (idle | stale), error state with DISMISS_ERROR
   - stale state: operation succeeded but refresh failed, show RETRY_REFRESH and DISMISS_ERROR events
   - Key improvement: explicit stale state tells user "operation worked but view may be outdated"

   selectors.ts:
   - selectGitflowState, selectOperation, selectPhase, selectError, selectRefreshErrors, selectIsExecuting, selectIsStale

   index.ts:
   - Export all public APIs

2. Create src/hooks/useGitflowWorkflow.ts:
   - Module-level singleton: getGitflowActor()
   - Hook returns: { state, operation, phase, error, refreshErrors, isExecuting, isStale, startOperation, finishOperation, retryRefresh, dismiss }
   - Use useSelector pattern

3. Update src/extensions/gitflow/stores/gitflow.slice.ts:
   - KEEP: gitflowStatus, gitflowIsLoading, gitflowError, refreshGitflow (data fetching)
   - REMOVE: startFeature, startRelease, startHotfix, finishFeature, finishRelease, finishHotfix (moved to machine)
   - Add comment: "// Gitflow operations moved to src/machines/gitflow/"
  </action>
  <verify>
npm run typecheck passes
npm test shows no broken tests
Gitflow machine exports are accessible
Hook exports work: import { useGitflowWorkflow } from "src/hooks/useGitflowWorkflow"
  </verify>
  <done>
Gitflow machine exists in src/machines/gitflow/ with orchestration for start/finish operations and explicit stale state for partial refresh failures, gitflow.slice.ts retains only data fetching
  </done>
</task>

## Verification

After all tasks complete:

1. MachineRegistry is a Zustand store following commandRegistry pattern
2. ExtensionAPI has registerMachine, getMachineActor, onMachineTransition methods
3. Extension cleanup stops registered machines and cleans up registry
4. Merge machine in src/machines/merge/ follows navigation directory structure
5. Gitflow machine in src/machines/gitflow/ follows same structure
6. Both machines use module-level singleton actors via getter functions
7. React hooks (useMergeWorkflow, useGitflowWorkflow) wrap useSelector for ergonomic component access
8. Zustand slices retain data fetching, remove workflow orchestration
9. All tests pass, no type errors

## Success Criteria

- [ ] useMachineRegistry Zustand store exists and follows commandRegistry pattern
- [ ] ExtensionAPI can register machines, get actors, subscribe to transitions
- [ ] Merge machine has idle -> merging -> (conflicted | idle) -> aborting flow
- [ ] Gitflow machine has idle -> executing -> refreshing -> (idle | stale) flow with explicit partial-failure state
- [ ] Both machines use fromPromise actors wrapping Tauri commands
- [ ] React hooks provide ergonomic component APIs with useSelector
- [ ] Zustand slices cleaned of workflow booleans (branchMergeInProgress, gitflowIsLoading for operations)
- [ ] Tests pass, type checking passes, no runtime errors

## Notes

- This is a large task (3 tasks) but necessary foundation for Phase 46 topology extraction and extension-aware workflows
- Clone and commit+push machines deferred to future quick tasks (lower priority per UX analysis)
- Focus is on infrastructure (registry, API) and two highest-value machines (merge, gitflow)
- No UI changes in this task - components will be migrated in follow-up tasks
- Following navigation machine patterns religiously: module-level singletons, typed selectors, setup() API
