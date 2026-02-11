# XState Architecture Suggestions

## Overview

Analysis of FlowForge's current state management architecture with recommendations for adopting XState to improve workflow orchestration, eliminate impossible states, and handle complex async operations.

## Current State Management Landscape

| Layer | Tech | Role |
|-------|------|------|
| UI State | Zustand ^5 | Global stores (3 domain stores + toast) |
| Async Queries | React Query ^5 | Server-side cache |
| Navigation FSM | XState ^5.26.0 | Blade stack + dirty state (only XState usage) |
| Async Runtime | @tauri-apps/api ^2 | Tauri IPC, Channel streaming |
| Event Bus | Custom GitHookBus | Extension hooks + validation |
| Registry | Custom CommandRegistry | Dynamic command management |

## Hybrid Architecture Target

```
Zustand stores  →  Data containers (lists, metadata, preferences)
XState machines →  Workflow orchestration (multi-step operations with clear states)
React Query     →  Cache layer for read-heavy server state
```

Integration point: Zustand slices hold XState actor references, React components subscribe via hooks:

```typescript
// In a Zustand slice
mergeActor: createActor(mergeMachine).start(),

// In a component
const mergeState = useSelector(store.mergeActor, (s) => s.value);
const conflicts = useSelector(store.mergeActor, (s) => s.context.conflicts);
```

---

## Suggestion 1: Merge Workflow Machine (Highest Impact)

### Current Problem

Merge state is tracked with loose booleans (`branchMergeInProgress`, `branchLastMergeResult`). Two separate signals for one concern — merge ongoing vs. conflict state. Race condition possible if user creates a branch while merge is in progress.

### Proposed State Machine

```
idle → merging → success | conflicted
conflicted → resolving → committed | aborted
aborted → idle
```

### Benefits

- Eliminates impossible states (e.g., "merge in progress" + "no merge result" + "has conflicts" all being independent booleans)
- A single `state.value` tells you exactly where you are
- Conflict resolution becomes a first-class state, not an inferred condition

### Implementation Sketch

```typescript
import { setup, assign } from "xstate";

const mergeMachine = setup({
  types: {
    context: {} as {
      sourceBranch: string | null;
      targetBranch: string | null;
      conflicts: string[];
      error: string | null;
    },
    events: {} as
      | { type: "START_MERGE"; sourceBranch: string; targetBranch: string }
      | { type: "ABORT" }
      | { type: "RESOLVE_CONFLICTS" }
      | { type: "RETRY" },
  },
}).createMachine({
  id: "merge",
  initial: "idle",
  context: {
    sourceBranch: null,
    targetBranch: null,
    conflicts: [],
    error: null,
  },
  states: {
    idle: {
      on: { START_MERGE: { target: "merging", actions: assign(/* ... */) } },
    },
    merging: {
      invoke: {
        src: "executeMerge",
        onDone: [
          { guard: "hasConflicts", target: "conflicted", actions: assign(/* ... */) },
          { target: "idle", actions: assign(/* ... */) },
        ],
        onError: { target: "error", actions: assign(/* ... */) },
      },
    },
    conflicted: {
      on: {
        RESOLVE_CONFLICTS: "resolving",
        ABORT: "aborting",
      },
    },
    resolving: {
      on: { COMMIT: "idle", ABORT: "aborting" },
    },
    aborting: {
      invoke: {
        src: "abortMerge",
        onDone: "idle",
        onError: "error",
      },
    },
    error: {
      on: { RETRY: "merging", ABORT: "idle" },
    },
  },
});
```

---

## Suggestion 2: Gitflow Operation Orchestrator (High Impact)

### Current Problem

`finishFeature`/`finishRelease` flows run 3-4 sequential async calls. If `loadBranches()` fails after the feature is finished, the app is in a half-updated state. No rollback mechanism. Pattern:

```typescript
finishFeature: async () => {
  const result = await commands.finishFeature();
  if (result.status === "ok") {
    await get().refreshGitflow();   // Step 2
    await get().loadBranches();     // Step 3 - if this fails, stale data
    await get().refreshRepoStatus(); // Step 4
    return true;
  }
  await get().refreshGitflow(); // Only gitflow refreshed on error
  return false;
}
```

### Proposed State Machine

```
idle → starting → active → finishing → refreshing{branches, status, gitflow} → idle
                                      ↘ error → refreshing → error.visible
```

### Benefits

- Model each step as a state with `invoke` for the async call
- On partial failure, enter `stale` state showing a "Refresh" action
- Prevent concurrent operations (e.g., starting a release while a feature is finishing)
- Compound `refreshing` state can run parallel refreshes and wait for all

---

## Suggestion 3: Clone Progress with Cancellation (Medium Impact)

### Current Problem

Clone flow (`startClone → updateCloneProgress → finishClone`) has no cancel path. The Tauri Channel stays open if the component unmounts. No abort mechanism.

### Proposed State Machine

```
idle → connecting → receiving → resolving → checkout → complete
  ↑                                                       ↓
  ←←←←←←←←←←← cancelled ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

### Benefits

- `invoke` for the Tauri channel with proper cleanup on exit
- `onDone`/`onError` transitions
- A `CANCEL` event that tears down the channel cleanly from any active state
- Progress events modeled as `assign` actions on context
- Component unmount triggers machine stop, which cleans up the channel

---

## Suggestion 4: Commit + Push Orchestration (Medium Impact)

### Current Problem

Spread across `useCommitExecution` with React Query mutations + toast actions + hook bus. Multiple async transitions with partial error handling. Retry logic lives in toast callbacks.

### Proposed State Machine

```
idle → validating(will-hooks) → committing → committed → pushing → pushed
                               ↘ hook-cancelled           ↘ push-error → retry?
```

### Benefits

- Unify hook validation, mutation, and retry logic in one place
- Prevent double-commits
- Push retry becomes a state transition, not a toast callback
- Clear visibility into where in the flow the user is

---

## Suggestion 5: Form Dialog State (Lower Priority, High Polish)

### Current Problem

Dialogs (CreateBranchDialog, MergeDialog, etc.) each manage their own `useState` for validation/submission. Inconsistent loading/error UX.

### Proposed Reusable Machine

```
idle → validating → submitting → success | error
error → editing → validating
```

### Benefits

- Prevents double-submits
- Handles optimistic UI rollback
- Consistent loading/error UX across all dialogs
- Reusable pattern: parameterize with validation fn + submit fn

---

## What NOT to Move to XState

| Concern | Current Approach | Reason to Keep |
|---------|-----------------|----------------|
| Toast store | Zustand | Simple queue, no workflow |
| Preferences store | Zustand | Pure key-value persistence |
| Command palette | Zustand slice | Mostly UI state, index clamping is fine |
| Staging file selection | Zustand slice | Simple set operations |
| Repository data lists | Zustand slices | Data containers, not workflows |

---

## Recommended Migration Order

| Priority | Machine | Rationale |
|----------|---------|-----------|
| 1 | Merge workflow | Most painful, most isolated, clearest win |
| 2 | Gitflow operations | High complexity, sequential async chains |
| 3 | Clone progress | Adds cancellation, good XState `invoke` pattern |
| 4 | Commit+Push flow | Unifies scattered logic |
| 5 | Dialog forms | Polish, reusable pattern |

---

## Pain Points Summary

| Concern | Current Approach | Pain Point | XState Fit |
|---------|------------------|-----------|-----------|
| Repository State | Zustand slice | None | No |
| Branch Operations | Zustand slice + hooks | Cascade updates | High |
| Merge Workflow | Boolean flags | Conflict state tracking | Very High |
| Gitflow Operations | Zustand slice | Multi-step atomicity | Very High |
| Clone Progress | Zustand slice + Channel | No cancellation | Medium |
| Form Dialogs | React useState + slice | Error recovery | Medium |
| Blade Navigation | XState | Works well | Already using |
| Command Palette | Zustand slice | Index bounds | Low |
| Stash Operations | Zustand slice | Conflict handling | Medium |
| Toast Notifications | Zustand store | None | No |
