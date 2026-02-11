# XState Architecture Analysis: Extensibility Integration

## Executive Summary

FlowForge already has a sophisticated extension system (ExtensionHost, ExtensionAPI, registries) and a single XState machine (navigation). This analysis examines how to integrate additional XState machines into the architecture so they remain **extensible**, **composable**, and **consistent** with the existing extension contract.

The key insight: XState machines should be **first-class extension citizens** -- discoverable via a registry, extensible via provided guards/actions/services, and integrated with the existing event bus for cross-cutting communication.

---

## 1. Current Architecture Map

### Layers and Ownership

```
+---------------------------------------------------------------------+
|                         React Components                             |
|  useSelector(actor, selector)  |  useGitOpsStore()  |  useQuery()   |
+---------------------------------------------------------------------+
        |                              |                       |
+----------------+  +----------------------------------+  +-----------+
| XState Actors  |  |       Zustand Stores             |  | RQ Cache  |
| (navigation)   |  | git-ops | ui-state | preferences |  | queries   |
+----------------+  +----------------------------------+  +-----------+
        |                              |                       |
+---------------------------------------------------------------------+
|                     Extension System                                 |
|  ExtensionHost  |  ExtensionAPI  |  Registries  |  Event Buses      |
+---------------------------------------------------------------------+
        |                              |                       |
+---------------------------------------------------------------------+
|                     Tauri Backend (IPC)                               |
|                     commands.*  |  Channel<T>                        |
+---------------------------------------------------------------------+
```

### Registry Inventory

| Registry | Zustand Store | Key Type | Extension API Method |
|----------|--------------|----------|---------------------|
| BladeRegistry | `bladeRegistry` (Map) | blade type string | `api.registerBlade()` |
| CommandRegistry | `useCommandRegistry` | command ID | `api.registerCommand()` |
| ToolbarRegistry | `useToolbarRegistry` | action ID | `api.contributeToolbar()` |
| ContextMenuRegistry | `useContextMenuRegistry` | item ID | `api.contributeContextMenu()` |
| SidebarPanelRegistry | `useSidebarPanelRegistry` | panel ID | `api.contributeSidebarPanel()` |
| StatusBarRegistry | `useStatusBarRegistry` | item ID | `api.contributeStatusBar()` |
| PreviewRegistry | `usePreviewRegistry` | preview type | (core only) |
| **MachineRegistry** | **(proposed)** | machine ID | **`api.registerMachine()`** |

### Event Systems

```
GitHookBus                          ExtensionEventBus
  onWill(op, handler)                 on(event, handler)
  onDid(op, handler)                  emit(event, payload)
  emitWill(op, ctx) -> cancel?        removeAllForSource(src)
  emitDid(op, ctx)
  removeBySource(src)
```

Both buses support **source-based cleanup** (critical for extension deactivation).

---

## 2. Current XState Usage: Navigation Machine

The navigation machine (`src/machines/navigation/`) is the only XState usage and provides an excellent reference pattern:

### Architecture Pattern

```
navigationMachine.ts    -- Machine definition (setup + createMachine)
types.ts                -- Context/event type definitions
guards.ts               -- Guard implementations (separate file)
actions.ts              -- Action implementations
selectors.ts            -- Snapshot selector functions
context.tsx             -- Module-level singleton actor + React context
inspector.ts            -- DevTools integration
index.ts                -- Public API barrel export
```

### Key Observations

1. **Module-level singleton**: Actor created at import time, lives outside React lifecycle
2. **React context provider**: Wraps the singleton for component tree access
3. **`setup()` pattern**: Uses XState v5 `setup()` for type-safe guards/actions
4. **Selectors**: Pure functions operating on `SnapshotFrom<typeof machine>`
5. **Extension integration**: ExtensionAPI subscribes to actor via `onDidNavigate()` -- direct actor subscription, not event bus
6. **No Zustand coupling**: Navigation state lives entirely in XState, not mirrored in a store

---

## 3. Proposed Machine Registry

### Design Rationale

The existing registries follow a clear pattern:
- Zustand store with `Map<id, config>`
- `register()` / `unregister()` / `unregisterBySource()` methods
- ExtensionAPI wraps with namespacing + cleanup tracking

A **MachineRegistry** follows the same pattern but for XState actor references.

### Machine Registry Implementation

```typescript
// src/lib/machineRegistry.ts

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { AnyActorRef, AnyStateMachine, SnapshotFrom } from "xstate";

export interface MachineRegistryEntry {
  id: string;
  actor: AnyActorRef;
  machine: AnyStateMachine;
  source: string;               // "core" | "ext:{extensionId}"
  category: string;             // "workflow" | "dialog" | "process"
  description?: string;
  /** Extension points this machine exposes */
  extensionPoints?: MachineExtensionPoint[];
}

export interface MachineExtensionPoint {
  type: "guard" | "action" | "actor";
  name: string;
  description: string;
}

interface MachineRegistryState {
  machines: Map<string, MachineRegistryEntry>;
  register: (entry: MachineRegistryEntry) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;
  get: (id: string) => MachineRegistryEntry | undefined;
  getAll: () => MachineRegistryEntry[];
  getByCategory: (category: string) => MachineRegistryEntry[];
}
```

### ExtensionAPI Surface

```typescript
// Addition to ExtensionAPI class

registerMachine(config: ExtensionMachineConfig): void {
  const namespacedId = `ext:${this.extensionId}:${config.id}`;
  const actor = createActor(config.machine, config.actorOptions);
  actor.start();

  useMachineRegistry.getState().register({
    id: namespacedId,
    actor,
    machine: config.machine,
    source: `ext:${this.extensionId}`,
    category: config.category ?? "workflow",
    description: config.description,
    extensionPoints: config.extensionPoints,
  });

  this.registeredMachines.push({ id: namespacedId, actor });
}

// Cleanup stops all registered actors
cleanup(): void {
  // ... existing cleanup ...
  for (const { id, actor } of this.registeredMachines) {
    actor.stop();
    useMachineRegistry.getState().unregister(id);
  }
  this.registeredMachines = [];
}
```

---

## 4. Machine-Extension Boundary Model

### Who Owns What?

```
+---------------------------+----------------------------+
|       Core Machines       |   Extension Contributions  |
+---------------------------+----------------------------+
| Machine definition        | Additional guards          |
| State topology            | Additional actions         |
| Core transitions          | Invoked actors/services    |
| Context shape             | Event listeners (onDid)    |
| Default guards/actions    | UI for machine states      |
+---------------------------+----------------------------+
```

### Extensibility via `machine.provide()`

XState v5's `setup().createMachine()` pattern already supports extensibility through `machine.provide()`:

```typescript
// Core defines the machine with extension points
const mergeMachine = setup({
  types: { /* ... */ },
  guards: {
    // Default implementations that extensions can override
    shouldAutoResolve: () => false,
    isConflictBlocking: ({ context }) => context.conflicts.length > 0,
  },
  actions: {
    onConflictDetected: () => { /* default: no-op */ },
    onMergeComplete: () => { /* default: no-op */ },
  },
  actors: {
    // Extension-provided resolution strategy
    conflictResolver: fromPromise(async () => { /* default: manual */ }),
  },
}).createMachine({ /* state topology */ });

// Extension provides overrides at activation time
const customizedMachine = mergeMachine.provide({
  guards: {
    shouldAutoResolve: ({ context }) => {
      // Extension: auto-resolve if all conflicts are in lockfiles
      return context.conflicts.every(f => f.endsWith(".lock"));
    },
  },
  actions: {
    onConflictDetected: ({ context }) => {
      // Extension: emit event for other extensions
      extensionEventBus.emit("ext:merge-tools:conflict-detected", {
        conflicts: context.conflicts,
      });
    },
  },
});
```

### Extension Point Declaration

Core machines declare their extension points as part of their registry entry:

```typescript
// Core registration
useMachineRegistry.getState().register({
  id: "core:merge",
  machine: mergeMachine,
  actor: mergeActor,
  source: "core",
  category: "workflow",
  extensionPoints: [
    { type: "guard", name: "shouldAutoResolve",
      description: "Override to enable auto-resolution for certain conflict patterns" },
    { type: "action", name: "onConflictDetected",
      description: "Side effect when conflicts are first detected" },
    { type: "actor", name: "conflictResolver",
      description: "Custom conflict resolution strategy" },
  ],
});
```

Extensions can then query available extension points:

```typescript
// In extension onActivate
const mergeEntry = useMachineRegistry.getState().get("core:merge");
if (mergeEntry?.extensionPoints?.some(ep => ep.name === "shouldAutoResolve")) {
  // Provide override via machine.provide()
}
```

---

## 5. Actor Model for Cross-Extension Communication

### Pattern: Machines as Event Sources

XState actors are natural event emitters. Rather than duplicating events through the ExtensionEventBus, machines can be the **source of truth** for domain events:

```
Machine State Change
        |
        v
  Actor Subscription (navigation pattern)
        |
        +---> GitHookBus.emitDid()     (for git-aware extensions)
        +---> ExtensionEventBus.emit()  (for general extensions)
        +---> React re-render           (via useSelector)
```

### Cross-Machine Communication via Actor System

XState v5's actor model supports spawning child actors and inter-actor messaging:

```
                  +-------------------+
                  |  App-Level Actor  |
                  |  System (root)    |
                  +-------------------+
                  /         |          \
    +------------+  +-------------+  +-----------+
    | Navigation |  | Merge       |  | Gitflow   |
    | Actor      |  | Actor       |  | Actor     |
    +------------+  +-------------+  +-----------+
                          |
                    +------------+
                    | Conflict   |
                    | Resolver   |
                    | (spawned)  |
                    +------------+
```

However, **a flat actor topology is simpler** for FlowForge's use case. Machines communicate through:

1. **Event bus** (loose coupling, existing pattern)
2. **Zustand store subscriptions** (for data dependencies)
3. **Direct actor references** (via MachineRegistry, for tightly coupled workflows)

### Recommended Communication Matrix

| From \ To | Same Machine | Sibling Machine | Extension | React Component |
|-----------|-------------|-----------------|-----------|-----------------|
| State change | Internal transition | EventBus / store | EventBus | useSelector |
| Trigger action | send() | EventBus | EventBus | callback prop |
| Read data | context | Zustand store | Zustand store | useSelector |
| Invoke service | invoke/spawn | -- | machine.provide() | -- |

---

## 6. Zustand <-> XState Coexistence

### Decision Framework: What Stays in Zustand vs. Moves to XState

```
                    Zustand                         XState
                    -------                         ------
    Simple data     branchList, tagList              --
    Key-value       preferences, settings            --
    UI toggles      commandPaletteOpen               --
    Queues          toastQueue                       --

    Multi-step      --                              merge workflow
    Sequential      --                              gitflow operations
    Cancelable      --                              clone progress
    Guarded         --                              commit+push flow

    HYBRID          repoStatus (data in Zustand,    navigation (pure XState)
                    refresh orchestration in XState)
```

### Integration Pattern: Actor Reference in Zustand

The navigation machine already demonstrates the pattern: actor is a **module-level singleton**, accessed via `getNavigationActor()`. No Zustand involvement.

For workflow machines that need to expose state alongside Zustand data, two patterns work:

**Pattern A: Parallel Access (Recommended)**

```typescript
// Machine is a module-level singleton (like navigation)
const mergeActor = createActor(mergeMachine).start();
export function getMergeActor() { return mergeActor; }

// React component reads from both
function MergePanel() {
  const branches = useGitOpsStore(s => s.branchList);     // Zustand
  const mergeState = useSelector(mergeActor, s => s.value); // XState
  const conflicts = useSelector(mergeActor, s => s.context.conflicts);
}
```

**Pattern B: Actor Reference in Store (Alternative)**

```typescript
// Zustand slice holds actor ref
interface BranchSlice {
  // ... existing data fields ...
  mergeActor: ActorRefFrom<typeof mergeMachine>;
}
```

**Recommendation**: Pattern A (parallel access). It avoids circular dependencies between stores and machines, and follows the established navigation pattern.

### What Stays in the BranchSlice

```
STAYS IN ZUSTAND (data containers):
  branchList, branchAllList, branchIsLoading, branchError
  loadBranches(), loadAllBranches(), createBranch(), deleteBranch()
  checkoutBranch(), checkoutRemoteBranch()

MOVES TO XSTATE (workflow orchestration):
  branchMergeInProgress, branchLastMergeResult  -> merge machine context
  mergeBranch(), abortMerge()                   -> merge machine events
  clearBranchMergeResult()                      -> merge machine reset
```

---

## 7. React Query Interaction

### Current Pattern

React Query manages server-state caching. Zustand slices call `queryClient.invalidateQueries()` after mutations. The commit hook (`useCommitExecution`) uses `useMutation` directly.

### XState Integration with React Query

Machines should **orchestrate** query invalidation, not replace React Query:

```typescript
const mergeMachine = setup({
  actors: {
    executeMerge: fromPromise(async ({ input }) => {
      return commands.mergeBranch(input.sourceBranch);
    }),
    refreshCaches: fromPromise(async () => {
      // Parallel invalidation
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stagingStatus"] }),
        queryClient.invalidateQueries({ queryKey: ["commitHistory"] }),
      ]);
    }),
  },
}).createMachine({
  // ... after successful merge ...
  success: {
    invoke: { src: "refreshCaches", onDone: "idle" },
  },
});
```

### Key Principle

- **React Query**: Owns the cache. Handles refetching, stale-while-revalidate, polling.
- **XState**: Orchestrates when invalidation happens as part of a workflow.
- **Zustand**: Holds non-cacheable UI state and data loaded via Tauri commands (not HTTP).

---

## 8. Machine Composition Patterns

### Parallel States for Extension-Contributed Substates

A machine can define parallel regions where extensions contribute behavior:

```typescript
const gitflowMachine = setup({ /* ... */ }).createMachine({
  id: "gitflow",
  type: "parallel",
  states: {
    // Core workflow state
    workflow: {
      initial: "idle",
      states: {
        idle: { /* ... */ },
        starting: { /* ... */ },
        active: { /* ... */ },
        finishing: { /* ... */ },
      },
    },
    // Extension-contributed parallel region
    validation: {
      initial: "idle",
      states: {
        idle: {},
        checking: {
          // Extensions provide the validation actor
          invoke: { src: "extensionValidator" },
        },
        passed: {},
        failed: {},
      },
    },
  },
});
```

### Machine Spawning from Extensions

Extensions can spawn child actors within a core machine's context:

```typescript
// Core machine definition
const mergeMachine = setup({
  actors: {
    // Extension provides this
    conflictVisualizer: fromPromise(async () => { /* no-op default */ }),
  },
}).createMachine({ /* ... */ });

// Extension overrides at activation
api.provideMachineOverrides("core:merge", {
  actors: {
    conflictVisualizer: fromObservable(({ input }) => {
      // Extension-specific conflict visualization logic
      return conflictStream(input.conflicts);
    }),
  },
});
```

---

## 9. Type Contracts Between Machines and Extensions

### Event Type Safety

XState v5's `setup()` provides compile-time type safety for events:

```typescript
// Core defines the event contract
export type MergeEvent =
  | { type: "START_MERGE"; sourceBranch: string; targetBranch: string }
  | { type: "ABORT" }
  | { type: "RESOLVE_CONFLICTS" }
  | { type: "RETRY" }
  // Extension events use a discriminated union
  | { type: `ext.${string}`; payload: unknown };

// Extensions send type-safe events
mergeActor.send({ type: "START_MERGE", sourceBranch: "feature/x", targetBranch: "main" });
```

### Guard Contracts

```typescript
// Core exports guard interface
export interface MergeGuardOverrides {
  shouldAutoResolve?: (context: MergeContext) => boolean;
  isConflictBlocking?: (context: MergeContext) => boolean;
  canRetry?: (context: MergeContext) => boolean;
}

// Extension provides type-safe overrides
const overrides: MergeGuardOverrides = {
  shouldAutoResolve: (ctx) => ctx.conflicts.every(isAutoResolvable),
};
```

### Service/Actor Contracts

```typescript
// Core defines input/output types for invocable actors
export interface ConflictResolverInput {
  conflicts: string[];
  strategy: "manual" | "theirs" | "ours";
}

export interface ConflictResolverOutput {
  resolved: string[];
  remaining: string[];
}
```

---

## 10. GitHookBus Integration with Machines

### Current Flow (Zustand)

```
User Action -> Store Method -> Tauri Command -> gitHookBus.emitDid()
                                             -> gitHookBus.emitWill() (pre-check)
```

### Proposed Flow (XState)

```
User Action -> actor.send(event)
                    |
                    v
            Machine Guard (will-check)
                    |
                    v
            invoke: Tauri Command
                    |
                    v
            Machine Action -> gitHookBus.emitDid()
                           -> extensionEventBus.emit()
```

### Machine Actions as Hook Emission Points

```typescript
const mergeMachine = setup({
  actions: {
    emitMergeStarted: ({ context }) => {
      gitHookBus.emitDid("merge", { branchName: context.sourceBranch });
    },
    emitMergeCompleted: ({ context }) => {
      extensionEventBus.emit("core:merge:completed", {
        sourceBranch: context.sourceBranch,
        hadConflicts: context.conflicts.length > 0,
      });
    },
  },
  actors: {
    checkWillMerge: fromPromise(async ({ input }) => {
      const result = await gitHookBus.emitWill("merge", {
        branchName: input.sourceBranch,
      });
      if (result.cancel) throw new Error(result.reason ?? "Cancelled by extension");
    }),
  },
}).createMachine({
  states: {
    idle: {
      on: { START_MERGE: "willCheck" },
    },
    willCheck: {
      invoke: {
        src: "checkWillMerge",
        input: ({ event }) => ({ sourceBranch: event.sourceBranch }),
        onDone: "merging",
        onError: "cancelled",
      },
    },
    merging: {
      entry: "emitMergeStarted",
      invoke: { src: "executeMerge", /* ... */ },
    },
  },
});
```

---

## 11. Concrete Recommendations

### 11.1 Create MachineRegistry (Priority: Foundation)

Follow the same Zustand-based registry pattern as CommandRegistry. Register core machines at app boot, extension machines during activation.

**Files to create:**
- `src/lib/machineRegistry.ts` -- Registry store
- `src/lib/machineRegistry.test.ts` -- Tests

### 11.2 Adopt Navigation Machine Conventions (Priority: Convention)

Standardize the directory structure for all machines:

```
src/machines/{name}/
  {name}Machine.ts        -- Machine definition
  types.ts                -- Context, events, input types
  guards.ts               -- Guard implementations
  actions.ts              -- Action implementations (side effects)
  actors.ts               -- Invoked services/actors
  selectors.ts            -- Snapshot selectors
  context.tsx             -- Module-level singleton + React context
  hooks.ts                -- Custom React hooks (useSelector wrappers)
  index.ts                -- Public API
  {name}Machine.test.ts   -- Tests
```

### 11.3 Machine Lifecycle Tied to Extension Lifecycle (Priority: Critical)

- **Core machines**: Created at app boot, never stopped
- **Extension machines**: Created during `onActivate`, stopped during `cleanup()`
- Actor stop must clean up:
  - GitHookBus subscriptions
  - ExtensionEventBus subscriptions
  - Zustand store subscriptions
  - Spawned child actors

### 11.4 Incremental Migration Path (Priority: Pragmatic)

Do not rewrite everything at once. Migrate one workflow at a time:

```
Phase 1: Merge Machine
  - Extract branchMergeInProgress/branchLastMergeResult from BranchSlice
  - Create src/machines/merge/
  - Keep data (branchList) in Zustand
  - Components use useSelector(mergeActor) for merge state

Phase 2: Gitflow Machine
  - Extract sequential async chains from gitflow.slice.ts
  - Model feature/release/hotfix as parallel states
  - Zustand keeps gitflowStatus data

Phase 3: Clone Machine
  - Extract clone progress tracking
  - Add cancellation support via machine stop
  - Integrate Tauri Channel as invoked observable

Phase 4: Commit+Push Machine
  - Unify useCommitExecution hook into a machine
  - Will-hooks become machine guards
  - Toast callbacks become state transitions
```

### 11.5 ExtensionAPI Additions

```typescript
// New methods on ExtensionAPI:

registerMachine(config: ExtensionMachineConfig): void
  // Register and start an actor, tracked for cleanup

provideMachineOverrides(machineId: string, overrides: MachineProvideConfig): void
  // Provide guards/actions/actors to a core machine

onMachineTransition(machineId: string, handler: TransitionHandler): () => void
  // Subscribe to state changes on any registered machine

getMachineActor(machineId: string): AnyActorRef | undefined
  // Get a reference to a registered machine's actor
```

### 11.6 DevTools Integration

XState Inspector is already set up (`src/machines/navigation/inspector.ts`). All new machines should use the same inspector instance:

```typescript
// inspector.ts is shared
import { getInspector } from "../navigation/inspector";

const actor = createActor(mergeMachine, {
  inspect: getInspector(),
});
```

---

## 12. Anti-Patterns to Avoid

### 12.1 Monolithic Machine

Do NOT create a single "app machine" that manages all workflows. Each workflow should be an independent machine with clear boundaries.

### 12.2 Zustand Mirror

Do NOT mirror XState context into Zustand for component access. Use `useSelector(actor, selector)` directly.

### 12.3 Event Bus Duplication

Do NOT emit the same event through both GitHookBus and machine transitions. The machine IS the source of truth; hook bus emissions are side effects of machine actions.

### 12.4 Over-Abstraction of Machine Registry

Keep the registry simple. It is a Map of actor references, not a dependency injection container. Extensions query it for specific machines by ID, not by capability matching.

### 12.5 Premature Parallelism

Not every machine needs parallel states for extensions. Start simple (flat state topology) and add parallel regions only when a real extension needs to contribute a concurrent concern.

---

## 13. Open Questions

1. **Machine hot-reload**: Should extension-provided machine overrides (via `provide()`) be re-applied when an extension is deactivated and re-activated? Current navigation machine does not support this.

2. **Machine persistence**: Should machine state survive page reloads? The navigation machine currently resets to initial state. For long-running workflows (clone), persistence via `@xstate/persistence` may be valuable.

3. **Machine-to-machine dependencies**: If the merge machine needs to know whether a gitflow operation is active (to prevent conflicts), should it query the gitflow machine's actor directly, or subscribe via the event bus? Direct actor reference is type-safe but creates coupling.

4. **Testing strategy**: The navigation machine tests use `machine.provide()` to override side effects. This pattern should be documented as the standard for all machine tests.

---

## 14. Summary: Architecture Decision Record

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Machine location | `src/machines/{name}/` | Follows navigation pattern |
| Actor lifecycle | Module-level singletons (core), extension-managed (ext) | Survives React re-renders |
| Registry | Zustand-based MachineRegistry | Consistent with existing registries |
| Extension integration | `machine.provide()` for overrides | XState v5 native, type-safe |
| Cross-machine communication | Event bus (loose), Zustand (data), direct ref (tight) | Graduated coupling |
| Zustand coexistence | Data stays in Zustand, workflows move to XState | Clear separation of concerns |
| React Query interaction | Machines orchestrate invalidation | RQ owns cache, XState owns timing |
| DevTools | Shared inspector instance | Single pane of glass |
| Migration strategy | One machine at a time, merge first | Lowest risk, highest value |
