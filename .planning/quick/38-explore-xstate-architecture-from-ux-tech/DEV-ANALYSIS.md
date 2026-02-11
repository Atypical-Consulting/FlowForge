# Expert Developer Analysis: XState Implementation in FlowForge

## 1. Current XState Usage Deep-Dive

### Navigation Machine (`src/machines/navigation/navigationMachine.ts`)

FlowForge already uses XState v5.26.0 with the `setup()` API for blade navigation. This machine is the reference implementation for all future machines.

**Architecture pattern established:**

```
navigationMachine.ts  → Machine definition (setup + createMachine)
context.tsx           → Module-level singleton actor + React context provider
selectors.ts          → Typed selector functions for useSelector
types.ts              → NavigationContext, NavigationEvent, TypedBlade
inspector.ts          → Dev-mode @statelyai/inspect integration
```

**Key observations from the existing machine:**

1. **Module-level singleton** (`context.tsx:9`): The actor is created outside React lifecycle, surviving StrictMode double-mounts. This pattern should be used for all workflow machines.

2. **Guards use `setup()` named guards** with `and()`, `not()` combinators — clean, testable, extensible.

3. **Actions use `assign()` with inline logic** — no external side effects except `toast` calls.

4. **React integration** via `useSelector` from `@xstate/react` (v6.0.0) — components subscribe to derived state through typed selectors.

5. **No `invoke` usage yet** — the navigation machine is purely synchronous. The workflow machines will introduce async `invoke` patterns.

### React Hook Layer (`src/hooks/useBladeNavigation.ts`)

The `useBladeNavigation` hook wraps `useSelector` + `actorRef.send()` into a domain-specific API. This pattern should be replicated:

```typescript
// Pattern: Machine-specific hook
function useMergeWorkflow() {
  const actorRef = useMergeActorRef();
  const state = useSelector(actorRef, selectMergeState);
  const conflicts = useSelector(actorRef, selectConflicts);

  return {
    state,
    conflicts,
    startMerge: (source: string) => actorRef.send({ type: "START_MERGE", sourceBranch: source }),
    abort: () => actorRef.send({ type: "ABORT" }),
    // ...
  };
}
```

---

## 2. Tauri IPC as XState Services

### Current IPC Pattern

All Tauri calls follow a consistent result pattern via auto-generated bindings:

```typescript
// src/bindings.ts (auto-generated)
const result = await commands.mergeBranch(sourceBranch);
// result: { status: "ok", data: MergeResult } | { status: "error", error: ... }
```

### Wrapping `invoke()` as Machine Actors

XState v5 `setup()` allows declaring `actors` that can be invoked by state nodes. Here is how to wrap Tauri IPC calls:

```typescript
import { setup, assign, fromPromise } from "xstate";
import { commands } from "../../bindings";
import type { MergeResult } from "../../bindings";
import { getErrorMessage } from "../../lib/errors";

// --- Actor definitions ---

const executeMerge = fromPromise<MergeResult, { sourceBranch: string }>(
  async ({ input }) => {
    const result = await commands.mergeBranch(input.sourceBranch);
    if (result.status === "error") {
      throw new Error(getErrorMessage(result.error));
    }
    return result.data;
  }
);

const abortMergeActor = fromPromise<void, void>(async () => {
  const result = await commands.abortMerge();
  if (result.status === "error") {
    throw new Error(getErrorMessage(result.error));
  }
});

// --- Machine definition ---

const mergeMachine = setup({
  types: {
    context: {} as {
      sourceBranch: string | null;
      conflicts: string[];
      error: string | null;
      mergeResult: MergeResult | null;
    },
    events: {} as
      | { type: "START_MERGE"; sourceBranch: string }
      | { type: "ABORT" }
      | { type: "RESOLVE_CONFLICT"; file: string }
      | { type: "RETRY" },
  },
  actors: {
    executeMerge,
    abortMerge: abortMergeActor,
  },
  guards: {
    hasConflicts: ({ event }) => {
      if (event.type !== "xstate.done.actor.executeMerge") return false;
      return (event.output as MergeResult).hasConflicts;
    },
  },
  actions: {
    setSourceBranch: assign(({ event }) => {
      if (event.type !== "START_MERGE") return {};
      return { sourceBranch: event.sourceBranch, error: null };
    }),
    setMergeResult: assign(({ event }) => {
      if (event.type !== "xstate.done.actor.executeMerge") return {};
      const result = event.output as MergeResult;
      return {
        mergeResult: result,
        conflicts: result.conflictedFiles ?? [],
      };
    }),
    clearState: assign({
      sourceBranch: null,
      conflicts: [],
      error: null,
      mergeResult: null,
    }),
    setError: assign(({ event }) => ({
      error: (event as any).error?.message ?? "Unknown error",
    })),
  },
}).createMachine({
  id: "merge",
  initial: "idle",
  context: {
    sourceBranch: null,
    conflicts: [],
    error: null,
    mergeResult: null,
  },
  states: {
    idle: {
      on: {
        START_MERGE: {
          target: "merging",
          actions: "setSourceBranch",
        },
      },
    },
    merging: {
      invoke: {
        id: "executeMerge",
        src: "executeMerge",
        input: ({ context }) => ({ sourceBranch: context.sourceBranch! }),
        onDone: [
          {
            guard: "hasConflicts",
            target: "conflicted",
            actions: "setMergeResult",
          },
          {
            target: "idle",
            actions: ["setMergeResult", "clearState"],
          },
        ],
        onError: {
          target: "error",
          actions: "setError",
        },
      },
    },
    conflicted: {
      on: {
        ABORT: "aborting",
      },
    },
    aborting: {
      invoke: {
        src: "abortMerge",
        onDone: {
          target: "idle",
          actions: "clearState",
        },
        onError: {
          target: "error",
          actions: "setError",
        },
      },
    },
    error: {
      on: {
        RETRY: "merging",
        ABORT: {
          target: "idle",
          actions: "clearState",
        },
      },
    },
  },
});
```

**Key design decisions:**

1. `fromPromise` wraps each Tauri IPC call — the result pattern (`status === "ok"/"error"`) is translated to promise resolution/rejection.
2. `input` on `invoke` passes context values to actors without closures.
3. Guards on `onDone` use discriminated transitions (conflicts vs. clean merge).

---

## 3. Channel Streaming as XState Actors

### Current Channel Pattern

Clone and sync operations use `Channel<T>` from `@tauri-apps/api/core`. The channel is created inline, assigned an `onmessage` handler, and passed to an IPC call. There is no cleanup or cancellation.

**Current pattern from `CloneForm.tsx`:**

```typescript
const channel = new Channel<CloneProgressType>();
channel.onmessage = (event) => {
  updateProgress(event);
};
const result = await commands.cloneRepository(url, destination, channel);
```

### XState Observable Actor Pattern

XState v5 provides `fromObservable` and `fromCallback` for streaming data sources. `fromCallback` is the best fit for Tauri channels because it provides a `sendBack` function for emitting events to the parent machine and a cleanup function:

```typescript
import { fromCallback, setup, assign } from "xstate";
import { Channel } from "@tauri-apps/api/core";
import type { CloneProgress, SyncProgress } from "../../bindings";
import { commands } from "../../bindings";

// --- Callback actor for clone with channel streaming ---

type CloneInput = { url: string; destination: string };
type CloneCallbackEvent =
  | { type: "PROGRESS"; progress: CloneProgress }
  | { type: "COMPLETE"; path: string }
  | { type: "ERROR"; message: string };

const cloneWithProgress = fromCallback<CloneCallbackEvent, CloneInput>(
  ({ input, sendBack }) => {
    const channel = new Channel<CloneProgress>();
    let cancelled = false;

    channel.onmessage = (event) => {
      if (!cancelled) {
        sendBack({ type: "PROGRESS", progress: event });
      }
    };

    commands
      .cloneRepository(input.url, input.destination, channel)
      .then((result) => {
        if (cancelled) return;
        if (result.status === "ok") {
          sendBack({ type: "COMPLETE", path: result.data });
        } else {
          const msg =
            typeof result.error === "object" && "message" in result.error
              ? String(result.error.message)
              : "Clone failed";
          sendBack({ type: "ERROR", message: msg });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          sendBack({ type: "ERROR", message: String(err) });
        }
      });

    // Cleanup function — called when machine leaves the invoking state
    return () => {
      cancelled = true;
      // Channel cleanup happens naturally — no more messages processed
    };
  }
);

// --- Clone machine ---

const cloneMachine = setup({
  types: {
    context: {} as {
      url: string;
      destination: string;
      progress: CloneProgress | null;
      clonedPath: string | null;
      error: string | null;
    },
    events: {} as
      | { type: "START_CLONE"; url: string; destination: string }
      | { type: "CANCEL" }
      | { type: "RESET" },
  },
  actors: {
    cloneWithProgress,
  },
  actions: {
    setInputs: assign(({ event }) => {
      if (event.type !== "START_CLONE") return {};
      return {
        url: event.url,
        destination: event.destination,
        error: null,
        progress: null,
      };
    }),
    updateProgress: assign(({ event }) => {
      if (event.type !== "PROGRESS") return {};
      return { progress: (event as any).progress };
    }),
    setComplete: assign(({ event }) => {
      if (event.type !== "COMPLETE") return {};
      return { clonedPath: (event as any).path };
    }),
    setError: assign(({ event }) => {
      if (event.type !== "ERROR") return {};
      return { error: (event as any).message };
    }),
    clearState: assign({
      url: "",
      destination: "",
      progress: null,
      clonedPath: null,
      error: null,
    }),
  },
}).createMachine({
  id: "clone",
  initial: "idle",
  context: {
    url: "",
    destination: "",
    progress: null,
    clonedPath: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        START_CLONE: {
          target: "cloning",
          actions: "setInputs",
        },
      },
    },
    cloning: {
      invoke: {
        src: "cloneWithProgress",
        input: ({ context }) => ({
          url: context.url,
          destination: context.destination,
        }),
      },
      on: {
        PROGRESS: { actions: "updateProgress" },
        COMPLETE: { target: "complete", actions: "setComplete" },
        ERROR: { target: "error", actions: "setError" },
        CANCEL: { target: "idle", actions: "clearState" },
      },
    },
    complete: {
      on: { RESET: { target: "idle", actions: "clearState" } },
    },
    error: {
      on: {
        START_CLONE: { target: "cloning", actions: "setInputs" },
        RESET: { target: "idle", actions: "clearState" },
      },
    },
  },
});
```

**Benefits over current approach:**

1. **Automatic cleanup**: Leaving the `cloning` state (via CANCEL or error) calls the cleanup function, setting `cancelled = true`. No leaked channel listeners.
2. **Cancellation**: A simple `CANCEL` event transitions out, triggering cleanup.
3. **Type-safe progress events**: `sendBack` emits typed events to the machine.
4. **Same pattern for push/pull/fetch**: Replace `cloneWithProgress` with `pushWithProgress`, etc.

---

## 4. React Integration Patterns

### Coexistence: Zustand + XState

The recommended approach is **Zustand holds actor references, components use `useSelector`**:

```typescript
// src/stores/domain/git-ops/merge-actor.ts
import { createActor, type ActorRefFrom } from "xstate";
import { mergeMachine } from "../../machines/merge/mergeMachine";

export type MergeActorRef = ActorRefFrom<typeof mergeMachine>;

// Module-level singleton — same pattern as navigation actor
let _mergeActor: MergeActorRef | null = null;

export function getMergeActor(): MergeActorRef {
  if (!_mergeActor) {
    _mergeActor = createActor(mergeMachine);
    _mergeActor.start();
  }
  return _mergeActor;
}

/** Reset actor (e.g., when repository changes) */
export function resetMergeActor(): void {
  _mergeActor?.stop();
  _mergeActor = createActor(mergeMachine);
  _mergeActor.start();
}
```

### Component Integration

Components use the same `useSelector` pattern as navigation:

```typescript
// src/hooks/useMergeWorkflow.ts
import { useSelector } from "@xstate/react";
import { getMergeActor } from "../stores/domain/git-ops/merge-actor";
import {
  selectMergeState,
  selectConflicts,
  selectMergeError,
  selectIsMerging,
} from "../machines/merge/selectors";

export function useMergeWorkflow() {
  const actorRef = getMergeActor();
  const state = useSelector(actorRef, selectMergeState);
  const conflicts = useSelector(actorRef, selectConflicts);
  const error = useSelector(actorRef, selectMergeError);
  const isMerging = useSelector(actorRef, selectIsMerging);

  return {
    state,
    conflicts,
    error,
    isMerging,
    startMerge: (sourceBranch: string) =>
      actorRef.send({ type: "START_MERGE", sourceBranch }),
    abort: () => actorRef.send({ type: "ABORT" }),
    retry: () => actorRef.send({ type: "RETRY" }),
  };
}
```

### Selector Pattern

Typed selectors using `SnapshotFrom`:

```typescript
// src/machines/merge/selectors.ts
import type { SnapshotFrom } from "xstate";
import type { mergeMachine } from "./mergeMachine";

type MergeSnapshot = SnapshotFrom<typeof mergeMachine>;

export const selectMergeState = (snap: MergeSnapshot) => snap.value;
export const selectConflicts = (snap: MergeSnapshot) => snap.context.conflicts;
export const selectMergeError = (snap: MergeSnapshot) => snap.context.error;
export const selectIsMerging = (snap: MergeSnapshot) => snap.matches("merging");
export const selectIsConflicted = (snap: MergeSnapshot) => snap.matches("conflicted");
export const selectSourceBranch = (snap: MergeSnapshot) => snap.context.sourceBranch;
```

### Migration Path: Branch Slice Boolean Flags to XState

**Before (Zustand boolean flags):**

```typescript
// Current: branches.slice.ts
branchMergeInProgress: boolean;      // Is merge running?
branchLastMergeResult: MergeResult | null; // What was the result?
// Problem: these two booleans can be in 4 states, but only 3 are valid
```

**After (XState state value):**

```typescript
// XState state.value tells you exactly where you are:
// "idle" | "merging" | "conflicted" | "aborting" | "error"
// No impossible combinations. state.context.mergeResult is only
// meaningful in "conflicted" state — the machine enforces this.
```

**Incremental migration strategy:**

1. Create the merge machine alongside the existing Zustand slice.
2. Wire the machine's state transitions to update the Zustand slice via `actor.subscribe()`:

```typescript
const mergeActor = getMergeActor();
mergeActor.subscribe((snapshot) => {
  // Bridge: keep Zustand slice in sync for components not yet migrated
  const store = useGitOpsStore.getState();
  store._syncMergeState({
    branchMergeInProgress: snapshot.matches("merging") || snapshot.matches("conflicted"),
    branchLastMergeResult: snapshot.context.mergeResult,
  });
});
```

3. Migrate components one by one from `useGitOpsStore` to `useMergeWorkflow`.
4. Once all consumers use the hook, remove the bridge and the Zustand slice fields.

---

## 5. Extensibility: Machine Registry & Extension Contributions

### Machine Registry

A `MachineRegistry` parallels the existing `CommandRegistry` pattern:

```typescript
// src/lib/machineRegistry.ts
import { createActor, type AnyActorRef, type AnyStateMachine } from "xstate";

export interface MachineRegistration {
  id: string;
  machine: AnyStateMachine;
  actor: AnyActorRef;
  source: string; // "core" | "ext:{extensionId}"
}

class MachineRegistry {
  private machines = new Map<string, MachineRegistration>();

  register(id: string, machine: AnyStateMachine, source = "core"): AnyActorRef {
    if (this.machines.has(id)) {
      console.warn(`[MachineRegistry] Machine "${id}" already registered`);
      return this.machines.get(id)!.actor;
    }

    const actor = createActor(machine);
    actor.start();

    this.machines.set(id, { id, machine, actor, source });
    return actor;
  }

  get(id: string): MachineRegistration | undefined {
    return this.machines.get(id);
  }

  getActor(id: string): AnyActorRef | undefined {
    return this.machines.get(id)?.actor;
  }

  unregister(id: string): void {
    const reg = this.machines.get(id);
    if (reg) {
      reg.actor.stop();
      this.machines.delete(id);
    }
  }

  unregisterBySource(source: string): void {
    for (const [id, reg] of this.machines) {
      if (reg.source === source) {
        reg.actor.stop();
        this.machines.delete(id);
      }
    }
  }

  /** List all registered machine IDs */
  list(): string[] {
    return Array.from(this.machines.keys());
  }
}

export const machineRegistry = new MachineRegistry();
```

### Extension API Surface

Add machine contribution methods to `ExtensionAPI`:

```typescript
// Addition to ExtensionAPI.ts

export interface ExtensionMachineConfig {
  /** Unique machine ID (will be namespaced as ext:{extensionId}:{id}) */
  id: string;
  /** The XState machine definition */
  machine: AnyStateMachine;
}

// Inside class ExtensionAPI:
class ExtensionAPI {
  private registeredMachines: string[] = [];

  /**
   * Register an XState machine with automatic namespacing.
   * The machine becomes accessible via machineRegistry.get("ext:{extensionId}:{id}").
   * The actor is automatically started and stopped on deactivation.
   */
  registerMachine(config: ExtensionMachineConfig): AnyActorRef {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    const actor = machineRegistry.register(
      namespacedId,
      config.machine,
      `ext:${this.extensionId}`
    );
    this.registeredMachines.push(namespacedId);
    return actor;
  }

  // In cleanup():
  // machineRegistry.unregisterBySource(`ext:${this.extensionId}`);
}
```

### Extension Contributing Guards/Actions to Core Machines

The most powerful extensibility pattern: extensions contribute guards, actions, or services to core machines via `machine.provide()`:

```typescript
// --- Type-safe contribution contracts ---

// src/machines/merge/contributions.ts

/** Events that extensions can hook into */
export type MergeExtensionEvent =
  | { type: "ext:WILL_MERGE"; sourceBranch: string }
  | { type: "ext:DID_MERGE"; result: MergeResult }
  | { type: "ext:WILL_ABORT" };

/** Guard contributions an extension can provide */
export interface MergeGuardContribution {
  /** Return false to block the merge from starting */
  canStartMerge?: (context: MergeContext) => boolean;
}

/** Action contributions an extension can provide */
export interface MergeActionContribution {
  /** Called after merge completes successfully */
  onMergeComplete?: (context: MergeContext) => void;
  /** Called when conflicts are detected */
  onConflictsDetected?: (context: MergeContext) => void;
}

// --- Registration via ExtensionAPI ---

export interface MergeContribution {
  guards?: MergeGuardContribution;
  actions?: MergeActionContribution;
}

// In ExtensionAPI:
contributeMergeHooks(contribution: MergeContribution): void {
  // Store contributions for machine.provide() at composition time
  mergeContributions.add({
    source: `ext:${this.extensionId}`,
    ...contribution,
  });
}
```

### Composing Machine from Extension Contributions

```typescript
// src/machines/merge/composeMergeMachine.ts

import { mergeMachine } from "./mergeMachine";
import { mergeContributions } from "./contributions";

/**
 * Compose the merge machine with all registered extension contributions.
 * Called once at startup after all extensions activate, or when extensions change.
 */
export function composeMergeMachine() {
  const contributions = mergeContributions.getAll();

  // Build composite guards from all extension contributions
  const compositeGuards: Record<string, (...args: any[]) => boolean> = {};
  const compositeActions: Record<string, (...args: any[]) => void> = {};

  for (const contrib of contributions) {
    if (contrib.guards?.canStartMerge) {
      const originalGuard = contrib.guards.canStartMerge;
      compositeGuards[`ext:${contrib.source}:canStartMerge`] = ({ context }) =>
        originalGuard(context);
    }
    if (contrib.actions?.onMergeComplete) {
      const originalAction = contrib.actions.onMergeComplete;
      compositeActions[`ext:${contrib.source}:onMergeComplete`] = ({ context }) =>
        originalAction(context);
    }
  }

  // Use machine.provide() to overlay extension contributions
  return mergeMachine.provide({
    guards: compositeGuards,
    actions: compositeActions,
  });
}
```

### Concrete Extension Example: CI Status Check Before Merge

```typescript
// extensions/ci-guard/index.ts
import type { ExtensionAPI } from "../ExtensionAPI";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Register a machine that tracks CI status
  const ciMachine = setup({
    types: {
      context: {} as { lastCheckStatus: "pass" | "fail" | "pending" | null },
      events: {} as
        | { type: "CHECK_COMPLETE"; status: "pass" | "fail" }
        | { type: "RESET" },
    },
  }).createMachine({
    id: "ci-status",
    initial: "idle",
    context: { lastCheckStatus: null },
    states: {
      idle: {
        on: {
          CHECK_COMPLETE: {
            actions: assign(({ event }) => ({
              lastCheckStatus: event.status,
            })),
          },
        },
      },
    },
  });

  const ciActor = api.registerMachine({ id: "ci-status", machine: ciMachine });

  // Hook into merge workflow via gitHookBus
  api.onWillGit("merge", async (ctx) => {
    const ciState = ciActor.getSnapshot().context.lastCheckStatus;
    if (ciState === "fail") {
      return {
        cancel: true,
        reason: "CI checks are failing. Merge blocked.",
      };
    }
    return {};
  });

  // Register command to check CI status
  api.registerCommand({
    id: "check-ci",
    title: "Check CI Status",
    category: "Repository",
    action: async () => {
      // Simulate CI check
      ciActor.send({ type: "CHECK_COMPLETE", status: "pass" });
    },
  });
}
```

---

## 6. Gitflow Operations Machine

The most impactful migration after merge. Current `finishFeature`/`finishRelease` run 3-4 sequential async calls with no atomicity.

```typescript
import { setup, assign, fromPromise } from "xstate";
import { commands } from "../../bindings";
import { getErrorMessage } from "../../lib/errors";

type GitflowOp = "feature" | "release" | "hotfix";
type GitflowPhase = "start" | "finish";

interface GitflowContext {
  operation: GitflowOp | null;
  phase: GitflowPhase | null;
  name: string | null;
  tagMessage: string | null;
  error: string | null;
  refreshErrors: string[];
}

// Each step is a separate actor for fine-grained error handling

const executeGitflowOp = fromPromise<string, {
  operation: GitflowOp;
  phase: GitflowPhase;
  name: string | null;
  tagMessage: string | null;
}>(async ({ input }) => {
  const { operation, phase, name, tagMessage } = input;

  if (phase === "start") {
    const fn = operation === "feature" ? commands.startFeature
      : operation === "release" ? commands.startRelease
      : commands.startHotfix;
    const result = await fn(name!);
    if (result.status === "error") throw new Error(getErrorMessage(result.error));
    return result.data;
  }

  // finish phase
  if (operation === "feature") {
    const result = await commands.finishFeature();
    if (result.status === "error") throw new Error(getErrorMessage(result.error));
    return result.data;
  }
  const fn = operation === "release" ? commands.finishRelease : commands.finishHotfix;
  const result = await fn(tagMessage ?? null);
  if (result.status === "error") throw new Error(getErrorMessage(result.error));
  return result.data;
});

const refreshAll = fromPromise<void, void>(async () => {
  // Parallel refresh — errors collected, not thrown
  const results = await Promise.allSettled([
    commands.getGitflowStatus(),
    commands.listBranches(),
    commands.getRepoStatus(),
  ]);

  const errors = results
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason?.message ?? "Refresh failed");

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
});

const gitflowMachine = setup({
  types: {
    context: {} as GitflowContext,
    events: {} as
      | { type: "START"; operation: GitflowOp; name: string }
      | { type: "FINISH"; operation: GitflowOp; tagMessage?: string }
      | { type: "ABORT" }
      | { type: "RETRY_REFRESH" }
      | { type: "DISMISS_ERROR" },
  },
  actors: { executeGitflowOp, refreshAll },
  guards: {},
  actions: {
    setStart: assign(({ event }) => {
      if (event.type !== "START") return {};
      return {
        operation: event.operation,
        phase: "start" as const,
        name: event.name,
        tagMessage: null,
        error: null,
        refreshErrors: [],
      };
    }),
    setFinish: assign(({ event }) => {
      if (event.type !== "FINISH") return {};
      return {
        operation: event.operation,
        phase: "finish" as const,
        tagMessage: event.tagMessage ?? null,
        error: null,
        refreshErrors: [],
      };
    }),
    setError: assign(({ event }) => ({
      error: (event as any).error?.message ?? "Unknown error",
    })),
    setRefreshError: assign(({ event }) => ({
      refreshErrors: [(event as any).error?.message ?? "Refresh failed"],
    })),
    clearState: assign({
      operation: null,
      phase: null,
      name: null,
      tagMessage: null,
      error: null,
      refreshErrors: [],
    }),
  },
}).createMachine({
  id: "gitflow",
  initial: "idle",
  context: {
    operation: null,
    phase: null,
    name: null,
    tagMessage: null,
    error: null,
    refreshErrors: [],
  },
  states: {
    idle: {
      on: {
        START: { target: "executing", actions: "setStart" },
        FINISH: { target: "executing", actions: "setFinish" },
      },
    },
    executing: {
      invoke: {
        src: "executeGitflowOp",
        input: ({ context }) => ({
          operation: context.operation!,
          phase: context.phase!,
          name: context.name,
          tagMessage: context.tagMessage,
        }),
        onDone: "refreshing",
        onError: { target: "error", actions: "setError" },
      },
    },
    refreshing: {
      invoke: {
        src: "refreshAll",
        onDone: { target: "idle", actions: "clearState" },
        onError: { target: "stale", actions: "setRefreshError" },
      },
    },
    stale: {
      // Operation succeeded but refresh failed — data may be stale
      on: {
        RETRY_REFRESH: "refreshing",
        DISMISS_ERROR: { target: "idle", actions: "clearState" },
      },
    },
    error: {
      on: {
        DISMISS_ERROR: { target: "idle", actions: "clearState" },
      },
    },
  },
});
```

**Key improvement**: The `stale` state explicitly tells the user "your operation succeeded but the view might be outdated — click Refresh." This eliminates the silent partial-update bugs in the current implementation.

---

## 7. Commit + Push Orchestration Machine

Unifies `useCommitExecution`, git hook bus validation, and toast retry logic:

```typescript
const commitPushMachine = setup({
  types: {
    context: {} as {
      message: string;
      amend: boolean;
      error: string | null;
      hookRejection: string | null;
    },
    events: {} as
      | { type: "COMMIT"; message: string; amend?: boolean }
      | { type: "COMMIT_AND_PUSH"; message: string; amend?: boolean }
      | { type: "PUSH" }
      | { type: "RETRY_PUSH" }
      | { type: "DISMISS" },
  },
  actors: {
    validateHooks: fromPromise<void, { message: string }>(async ({ input }) => {
      const result = await gitHookBus.emitWill("commit", {
        commitMessage: input.message,
      });
      if (result.cancel) {
        throw new Error(result.reason ?? "Commit cancelled by extension");
      }
    }),
    executeCommit: fromPromise<void, { message: string; amend: boolean }>(
      async ({ input }) => {
        const result = await commands.createCommit(input.message, input.amend);
        if (result.status === "error") {
          throw new Error(getErrorMessage(result.error));
        }
      }
    ),
    executePush: fromPromise<void, void>(async () => {
      const channel = new Channel<SyncProgress>();
      const result = await commands.pushToRemote("origin", channel);
      if (result.status === "error") {
        throw new Error(getErrorMessage(result.error));
      }
    }),
  },
}).createMachine({
  id: "commitPush",
  initial: "idle",
  context: { message: "", amend: false, error: null, hookRejection: null },
  states: {
    idle: {
      on: {
        COMMIT: {
          target: "validatingHooks",
          actions: assign(({ event }) => ({
            message: event.message,
            amend: event.amend ?? false,
            error: null,
            hookRejection: null,
          })),
        },
        COMMIT_AND_PUSH: {
          target: "validatingHooks",
          actions: assign(({ event }) => ({
            message: event.message,
            amend: event.amend ?? false,
            error: null,
            hookRejection: null,
            // Tag this flow to continue to push after commit
          })),
        },
        PUSH: "pushing",
      },
    },
    validatingHooks: {
      invoke: {
        src: "validateHooks",
        input: ({ context }) => ({ message: context.message }),
        onDone: "committing",
        onError: {
          target: "hookRejected",
          actions: assign(({ event }) => ({
            hookRejection: (event as any).error?.message,
          })),
        },
      },
    },
    hookRejected: {
      on: { DISMISS: { target: "idle" } },
    },
    committing: {
      invoke: {
        src: "executeCommit",
        input: ({ context }) => ({
          message: context.message,
          amend: context.amend,
        }),
        onDone: "committed",
        onError: {
          target: "error",
          actions: assign(({ event }) => ({
            error: (event as any).error?.message,
          })),
        },
      },
    },
    committed: {
      // Auto-transition: check if we should push
      always: [
        // If commit-and-push flow, continue to pushing
        // (would need a flag in context, simplified here)
      ],
      on: {
        PUSH: "pushing",
        DISMISS: { target: "idle" },
      },
    },
    pushing: {
      invoke: {
        src: "executePush",
        onDone: { target: "idle" },
        onError: {
          target: "pushError",
          actions: assign(({ event }) => ({
            error: (event as any).error?.message,
          })),
        },
      },
    },
    pushError: {
      on: {
        RETRY_PUSH: "pushing",
        DISMISS: { target: "idle" },
      },
    },
    error: {
      on: { DISMISS: { target: "idle" } },
    },
  },
});
```

---

## 8. Tailwind v4 State-Driven CSS Classes

### `data-[state]` Attribute Pattern

XState machine states can drive Tailwind styling via data attributes:

```typescript
// Component rendering merge state
function MergeBanner() {
  const { state } = useMergeWorkflow();

  return (
    <div data-state={state} className={cn(
      "px-3 py-2 rounded-md text-sm transition-colors",
      // Tailwind v4 data attribute selectors
      "data-[state=idle]:hidden",
      "data-[state=merging]:bg-ctp-blue/10 data-[state=merging]:text-ctp-blue",
      "data-[state=conflicted]:bg-ctp-yellow/10 data-[state=conflicted]:text-ctp-yellow",
      "data-[state=error]:bg-ctp-red/10 data-[state=error]:text-ctp-red",
      "data-[state=aborting]:bg-ctp-overlay0/10 data-[state=aborting]:text-ctp-overlay1",
    )}>
      {state === "merging" && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
      {state === "conflicted" && <AlertTriangle className="w-4 h-4 inline mr-2" />}
      {/* ... */}
    </div>
  );
}
```

### Custom Animation Registration

Following the established pattern in `src/index.css`:

```css
@theme {
  /* Existing */
  --animate-dirty-pulse: dirty-pulse 2s ease-in-out infinite;
  --animate-gentle-pulse: gentle-pulse 3s ease-in-out infinite;

  /* New: state-aware animations */
  --animate-merge-pulse: merge-pulse 1.5s ease-in-out infinite;
  --animate-conflict-flash: conflict-flash 0.6s ease-in-out;
}

@keyframes merge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes conflict-flash {
  0%, 100% { background-color: transparent; }
  50% { background-color: var(--catppuccin-color-yellow); opacity: 0.1; }
}
```

Usage:

```html
<div data-state={state} className="
  data-[state=merging]:motion-safe:animate-merge-pulse
  data-[state=conflicted]:motion-safe:animate-conflict-flash
">
```

---

## 9. Type Safety Architecture

### Event Contracts

All machines should export their event types for consumers:

```typescript
// src/machines/merge/types.ts

export type MergeState = "idle" | "merging" | "conflicted" | "aborting" | "error";

export type MergeEvent =
  | { type: "START_MERGE"; sourceBranch: string }
  | { type: "ABORT" }
  | { type: "RESOLVE_CONFLICT"; file: string }
  | { type: "RETRY" };

export interface MergeContext {
  sourceBranch: string | null;
  conflicts: string[];
  error: string | null;
  mergeResult: MergeResult | null;
}

// Re-export machine snapshot type for selectors
export type { SnapshotFrom } from "xstate";
```

### Type-Safe Actor References

```typescript
// Strongly-typed actor ref from machine definition
import type { ActorRefFrom } from "xstate";
import { mergeMachine } from "./mergeMachine";

export type MergeActorRef = ActorRefFrom<typeof mergeMachine>;

// Components can only send valid events:
function MergeButton({ actorRef }: { actorRef: MergeActorRef }) {
  // TypeScript error if event shape is wrong:
  actorRef.send({ type: "START_MERGE", sourceBranch: "feature/x" }); // OK
  actorRef.send({ type: "INVALID" }); // Compile error
}
```

### Type-Safe Extension Contribution Contracts

```typescript
// Extension event contracts between machines
export interface MachineEventContract<TEvent> {
  /** Machine ID this contract belongs to */
  machineId: string;
  /** Validate an event matches the contract */
  validate: (event: unknown) => event is TEvent;
}

// Extension sends event to core machine
function sendToMachine<TEvent>(
  machineId: string,
  event: TEvent,
  contract: MachineEventContract<TEvent>
): void {
  if (!contract.validate(event)) {
    console.error(`Invalid event for machine "${machineId}"`);
    return;
  }
  const actor = machineRegistry.getActor(machineId);
  actor?.send(event as any);
}
```

---

## 10. File Structure Recommendation

```
src/machines/
  navigation/
    navigationMachine.ts     ← existing
    context.tsx              ← existing
    selectors.ts             ← existing
    types.ts                 ← existing
    inspector.ts             ← existing
  merge/
    mergeMachine.ts          ← new: machine definition
    mergeActors.ts           ← new: fromPromise/fromCallback actors
    selectors.ts             ← new: typed selectors
    types.ts                 ← new: context/event/state types
    contributions.ts         ← new: extension contribution contracts
    composeMachine.ts        ← new: machine.provide() composition
  gitflow/
    gitflowMachine.ts
    gitflowActors.ts
    selectors.ts
    types.ts
  clone/
    cloneMachine.ts
    cloneActors.ts           ← fromCallback with Channel streaming
    selectors.ts
    types.ts
  commit/
    commitPushMachine.ts
    commitActors.ts
    selectors.ts
    types.ts
src/lib/
  machineRegistry.ts         ← new: parallel to commandRegistry
src/hooks/
  useMergeWorkflow.ts        ← new: wraps useSelector for merge
  useGitflowWorkflow.ts      ← new: wraps useSelector for gitflow
  useCloneWorkflow.ts        ← new: wraps useSelector for clone
  useCommitWorkflow.ts       ← new: replaces useCommitExecution
```

---

## 11. Migration Recommendations

### Priority 1: Merge Workflow (Week 1)

- Create `src/machines/merge/` with full machine definition
- Wire `fromPromise` actors to `commands.mergeBranch` and `commands.abortMerge`
- Create `useMergeWorkflow` hook
- Bridge to Zustand slice via `actor.subscribe()` for backward compatibility
- Migrate MergeDialog and MergeBanner components
- Remove `branchMergeInProgress` and `branchLastMergeResult` from branch slice

### Priority 2: Gitflow Operations (Week 2)

- Create `src/machines/gitflow/` with multi-step orchestration
- Add `stale` state for partial refresh failures
- Use `refreshAll` actor for parallel refresh
- Migrate all gitflow components

### Priority 3: Clone Progress (Week 3)

- Create `src/machines/clone/` with `fromCallback` channel actor
- Add CANCEL event and cleanup
- Replace CloneForm's inline mutation logic
- Delete clone.slice.ts entirely

### Priority 4: Commit+Push (Week 4)

- Create `src/machines/commit/` unifying hook validation + mutation + retry
- Replace `useCommitExecution` hook
- Remove toast callback retry pattern (now a state transition)

### Priority 5: Machine Registry + Extension API (Week 5)

- Create `src/lib/machineRegistry.ts`
- Add `registerMachine` to ExtensionAPI
- Add contribution contracts for merge/gitflow machines
- Update extension cleanup to unregister machines

---

## 12. Testing Patterns

### Machine Unit Tests

Following the existing `navigationMachine.test.ts` pattern:

```typescript
import { createActor } from "xstate";
import { mergeMachine } from "./mergeMachine";

describe("mergeMachine", () => {
  it("transitions from idle to merging on START_MERGE", () => {
    const actor = createActor(
      mergeMachine.provide({
        actors: {
          // Override actors with test implementations
          executeMerge: fromPromise(async () => ({
            hasConflicts: false,
            conflictedFiles: [],
          })),
        },
      })
    );
    actor.start();

    actor.send({ type: "START_MERGE", sourceBranch: "feature/x" });
    expect(actor.getSnapshot().value).toBe("merging");
    expect(actor.getSnapshot().context.sourceBranch).toBe("feature/x");
  });

  it("enters conflicted state when merge has conflicts", async () => {
    const actor = createActor(
      mergeMachine.provide({
        actors: {
          executeMerge: fromPromise(async () => ({
            hasConflicts: true,
            conflictedFiles: ["file.ts"],
          })),
        },
      })
    );
    actor.start();
    actor.send({ type: "START_MERGE", sourceBranch: "feature/x" });

    // Wait for invoke to complete
    await new Promise((r) => setTimeout(r, 0));
    expect(actor.getSnapshot().value).toBe("conflicted");
    expect(actor.getSnapshot().context.conflicts).toEqual(["file.ts"]);
  });

  it("prevents impossible states", () => {
    const actor = createActor(mergeMachine);
    actor.start();

    // Cannot abort from idle — event is simply ignored
    actor.send({ type: "ABORT" });
    expect(actor.getSnapshot().value).toBe("idle");
  });
});
```

### `machine.provide()` for Test Overrides

The `provide()` method is critical for testing — it replaces real Tauri IPC calls with synchronous test implementations, the same way the navigation machine's actions can be overridden.

---

## 13. Dev Tooling

### Stately Inspector Integration

The existing `inspector.ts` pattern extends to all machines:

```typescript
// src/machines/inspectorSetup.ts
import { getInspector } from "./navigation/inspector";

export async function createInspectedActor(machine: AnyStateMachine) {
  const inspect = await getInspector();
  return createActor(machine, { inspect });
}
```

This opens the Stately Inspector in a browser tab showing all machines, their current states, and event history — invaluable for debugging multi-machine interactions.

---

## Summary

| Aspect | Current Pattern | XState Pattern | Migration Effort |
|--------|----------------|---------------|-----------------|
| Merge state | 2 booleans | Single `state.value` | Low — isolated |
| Gitflow ops | Sequential awaits | Orchestrator with `stale` state | Medium |
| Clone progress | Inline Channel | `fromCallback` with cleanup | Low |
| Commit+Push | Hook + toast retry | Machine with `hookRejected` state | Medium |
| Extension machines | N/A | MachineRegistry + API | Medium |
| CSS state styling | N/A | `data-[state]` attributes | Low — additive |
| Testing | Zustand mocks | `machine.provide()` overrides | Simplifies tests |

The hybrid architecture (Zustand for data, XState for workflows) is the right call. The navigation machine proves the pattern works. The `fromPromise` and `fromCallback` actor patterns map cleanly onto Tauri's IPC and Channel APIs. The extension contribution model (`machine.provide()` + `MachineRegistry`) parallels the established `CommandRegistry` pattern and fits naturally into `ExtensionAPI.cleanup()`.
