# Phase 26: XState Navigation FSM - Architecture Research

**Researched:** 2026-02-08
**Domain:** XState v5 finite state machine design for blade navigation
**Confidence:** HIGH

## Summary

This phase replaces the current imperative Zustand blade store (`src/stores/blades.ts`) with an XState v5 finite state machine that governs all blade navigation. The existing store uses `pushBlade/popBlade/replaceBlade/resetStack/setProcess` as bare Zustand actions with no transition validation, no dirty-form guards, no stack-depth enforcement, and no formal state model. XState v5 provides the `setup().createMachine()` API with full TypeScript type safety, named guards, named actions, the `createActorContext` React integration, and the `@statelyai/inspect` browser inspector -- all of which are already installed in the project (`xstate@5.26.0`, `@xstate/react@6.0.0`).

The machine should use a **flat FSM with guarded self-transitions** (not a hierarchical statechart) because the blade stack is a *data structure in context*, not a set of discrete named states. The FSM states represent the *navigation mode* (idle vs navigating vs confirming-discard), while the blade stack lives in `context.bladeStack`. Guards enforce invariants (singleton, max depth, dirty-form), and actions mutate context atomically. A thin Zustand compatibility layer exposes `.getState()` for non-React consumers (keyboard shortcuts, command palette, bladeOpener) during migration.

**Primary recommendation:** Use a flat XState v5 machine with `setup()` types, named guards/actions, `createActorContext` for React, and a `getNavigationActor()` escape hatch for imperative access. Migrate consumers file-by-file behind the same `useBladeNavigation()` hook API.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| xstate | 5.26.0 | FSM engine, guards, actions, context | Already installed; official state machine library for TS/JS |
| @xstate/react | 6.0.0 | React integration (createActorContext, useSelector, useActorRef) | Already installed; official React bindings |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @statelyai/inspect | ~0.4.0 | Browser inspector for dev mode (NAV-08) | Dev-only; visualize FSM state in Stately Inspector |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| createActorContext | useActorRef + manual Context | More control but more boilerplate; createActorContext is simpler |
| Flat FSM | Hierarchical statechart | Statechart better if blade states were discrete; but stack is data in context |
| XState entirely | Zustand + finite-state enum | Loses formal guards, inspector, transition validation |

**Installation:**
```bash
npm install @statelyai/inspect
# xstate and @xstate/react already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  machines/
    navigation/
      navigationMachine.ts      # Machine definition (setup + createMachine)
      navigationMachine.test.ts  # Pure machine tests (no DOM)
      types.ts                   # NavigationContext, NavigationEvent, BladeEntry types
      guards.ts                  # Named guard implementations
      actions.ts                 # Named action implementations (assign helpers)
      selectors.ts              # Snapshot selectors (bladeStack, activeBlade, etc.)
      context.ts                # createActorContext + provider + hooks
      inspector.ts              # Dev-mode inspector setup
      index.ts                  # Public API barrel export
  hooks/
    useBladeNavigation.ts       # PRESERVED API - delegates to FSM actor
  lib/
    bladeOpener.ts              # PRESERVED API - uses getNavigationActor()
  stores/
    blades.ts                   # DEPRECATED - replaced by machine, kept as thin redirect during migration
    bladeTypes.ts               # PRESERVED - TypedBlade, BladePropsMap, BladeType
```

### Pattern 1: Flat FSM with Guarded Self-Transitions

**What:** A machine with a small set of named states (`idle`, `navigating`, `confirmingDiscard`) where blade stack operations are self-transitions on the `navigating` state guarded by invariant checks.

**When to use:** When the interesting state is *data in context* (the blade stack) rather than discrete named states. The FSM states model the *navigation mode*, not each individual blade.

**Why this over hierarchical statechart:** The blade stack can have N items of M types. Modeling each combination as a statechart state would be combinatorially explosive. Instead, the stack is an array in context, and guards validate transitions.

```typescript
// Source: XState v5 setup() pattern from https://stately.ai/docs/machines
import { setup, assign } from 'xstate';
import type { TypedBlade, BladeType, BladePropsMap } from '../stores/bladeTypes';

// --- types.ts ---
export type ProcessType = 'staging' | 'topology';

export interface NavigationContext {
  activeProcess: ProcessType;
  bladeStack: TypedBlade[];
  dirtyBladeIds: Set<string>;   // NAV-03: track blades with unsaved changes
  maxStackDepth: number;         // NAV-06: configurable limit
}

export type NavigationEvent =
  | { type: 'PUSH_BLADE'; bladeType: BladeType; title: string; props: BladePropsMap[BladeType] }
  | { type: 'POP_BLADE' }
  | { type: 'POP_TO_INDEX'; index: number }
  | { type: 'REPLACE_BLADE'; bladeType: BladeType; title: string; props: BladePropsMap[BladeType] }
  | { type: 'RESET_STACK' }
  | { type: 'SWITCH_PROCESS'; process: ProcessType }
  | { type: 'MARK_DIRTY'; bladeId: string }
  | { type: 'MARK_CLEAN'; bladeId: string }
  | { type: 'CONFIRM_DISCARD' }
  | { type: 'CANCEL_DISCARD' };
```

### Pattern 2: Named Guards for Invariant Enforcement

**What:** Guards are pure functions registered in `setup({ guards: {...} })` that return boolean. They enforce singleton, max-depth, dirty-form, and root-blade invariants.

**When to use:** Every transition that modifies the blade stack.

```typescript
// Source: XState v5 guards from https://stately.ai/docs/guards
// --- guards.ts ---
export const navigationGuards = {
  /** NAV-05: Prevent duplicate singleton blades */
  isNotSingleton: ({ context, event }: { context: NavigationContext; event: any }) => {
    const SINGLETON_TYPES: BladeType[] = ['settings', 'changelog', 'gitflow-cheatsheet'];
    if (!SINGLETON_TYPES.includes(event.bladeType)) return true;
    return !context.bladeStack.some((b) => b.type === event.bladeType);
  },

  /** NAV-06: Enforce max stack depth */
  isUnderMaxDepth: ({ context }: { context: NavigationContext }) => {
    return context.bladeStack.length < context.maxStackDepth;
  },

  /** Root blade protection: never pop the last blade */
  hasMultipleBlades: ({ context }: { context: NavigationContext }) => {
    return context.bladeStack.length > 1;
  },

  /** NAV-03: Check if any blade has unsaved changes */
  hasNoDirtyBlades: ({ context }: { context: NavigationContext }) => {
    return context.dirtyBladeIds.size === 0;
  },

  /** NAV-03: Check if the top blade specifically is dirty */
  isTopBladeDirty: ({ context }: { context: NavigationContext }) => {
    const topBlade = context.bladeStack[context.bladeStack.length - 1];
    return topBlade ? context.dirtyBladeIds.has(topBlade.id) : false;
  },

  /** Valid popToIndex range */
  isValidIndex: ({ context, event }: { context: NavigationContext; event: any }) => {
    return event.index >= 0 && event.index < context.bladeStack.length;
  },
};
```

### Pattern 3: Named Actions with assign()

**What:** Actions are registered in `setup({ actions: {...} })` and use `assign()` for context mutations. They are pure and testable.

```typescript
// Source: XState v5 actions from https://stately.ai/docs/machines
// --- actions.ts ---
import { assign } from 'xstate';

function rootBladeForProcess(process: ProcessType): TypedBlade {
  if (process === 'staging') {
    return { id: 'root', type: 'staging-changes', title: 'Changes', props: {} as Record<string, never> };
  }
  return { id: 'root', type: 'topology-graph', title: 'Topology', props: {} as Record<string, never> };
}

export const navigationActions = {
  pushBlade: assign({
    bladeStack: ({ context, event }) => [
      ...context.bladeStack,
      { id: crypto.randomUUID(), type: event.bladeType, title: event.title, props: event.props } as TypedBlade,
    ],
  }),

  popBlade: assign({
    bladeStack: ({ context }) => context.bladeStack.slice(0, -1),
    dirtyBladeIds: ({ context }) => {
      const newSet = new Set(context.dirtyBladeIds);
      const topBlade = context.bladeStack[context.bladeStack.length - 1];
      if (topBlade) newSet.delete(topBlade.id);
      return newSet;
    },
  }),

  popToIndex: assign({
    bladeStack: ({ context, event }) => context.bladeStack.slice(0, event.index + 1),
    dirtyBladeIds: ({ context, event }) => {
      const kept = new Set(context.bladeStack.slice(0, event.index + 1).map(b => b.id));
      const newSet = new Set<string>();
      for (const id of context.dirtyBladeIds) {
        if (kept.has(id)) newSet.add(id);
      }
      return newSet;
    },
  }),

  replaceBlade: assign({
    bladeStack: ({ context, event }) => [
      ...context.bladeStack.slice(0, -1),
      { id: crypto.randomUUID(), type: event.bladeType, title: event.title, props: event.props } as TypedBlade,
    ],
  }),

  resetStack: assign({
    bladeStack: ({ context }) => [rootBladeForProcess(context.activeProcess)],
    dirtyBladeIds: () => new Set<string>(),
  }),

  switchProcess: assign({
    activeProcess: ({ event }) => event.process,
    bladeStack: ({ event }) => [rootBladeForProcess(event.process)],
    dirtyBladeIds: () => new Set<string>(),
  }),

  markDirty: assign({
    dirtyBladeIds: ({ context, event }) => {
      const newSet = new Set(context.dirtyBladeIds);
      newSet.add(event.bladeId);
      return newSet;
    },
  }),

  markClean: assign({
    dirtyBladeIds: ({ context, event }) => {
      const newSet = new Set(context.dirtyBladeIds);
      newSet.delete(event.bladeId);
      return newSet;
    },
  }),
};
```

### Pattern 4: The Complete Machine Definition

**What:** The assembled machine using `setup().createMachine()` with three states: `navigating` (normal), `confirmingDiscard` (dirty-form dialog), and an implicit handling of process switching as a guarded atomic reset.

```typescript
// --- navigationMachine.ts ---
import { setup, assign } from 'xstate';
import { navigationGuards } from './guards';
import { navigationActions } from './actions';
import type { NavigationContext, NavigationEvent } from './types';

const MAX_STACK_DEPTH = 20;

export const navigationMachineSetup = setup({
  types: {
    context: {} as NavigationContext,
    events: {} as NavigationEvent,
  },
  guards: navigationGuards,
  actions: navigationActions,
});

export const navigationMachine = navigationMachineSetup.createMachine({
  id: 'bladeNavigation',
  initial: 'navigating',
  context: {
    activeProcess: 'staging',
    bladeStack: [{ id: 'root', type: 'staging-changes', title: 'Changes', props: {} }],
    dirtyBladeIds: new Set<string>(),
    maxStackDepth: MAX_STACK_DEPTH,
  },
  states: {
    navigating: {
      on: {
        PUSH_BLADE: [
          {
            // If top blade is dirty, go to confirmation first
            guard: 'isTopBladeDirty',
            target: 'confirmingDiscard',
            // Store the pending event for replay after confirmation
            // (handled via a pendingEvent context field, or re-send)
          },
          {
            // Normal push: must pass singleton + depth guards
            guard: { type: 'and', guards: ['isNotSingleton', 'isUnderMaxDepth'] },
            actions: 'pushBlade',
          },
        ],
        POP_BLADE: [
          {
            guard: 'isTopBladeDirty',
            target: 'confirmingDiscard',
          },
          {
            guard: 'hasMultipleBlades',
            actions: 'popBlade',
          },
        ],
        POP_TO_INDEX: {
          guard: 'isValidIndex',
          actions: 'popToIndex',
        },
        REPLACE_BLADE: {
          actions: 'replaceBlade',
        },
        RESET_STACK: {
          // NAV-04: Atomic reset
          actions: 'resetStack',
        },
        SWITCH_PROCESS: {
          // NAV-04: Atomic process switch with stack reset
          actions: 'switchProcess',
        },
        MARK_DIRTY: {
          actions: 'markDirty',
        },
        MARK_CLEAN: {
          actions: 'markClean',
        },
      },
    },
    confirmingDiscard: {
      // NAV-03: User sees "unsaved changes" dialog
      on: {
        CONFIRM_DISCARD: {
          target: 'navigating',
          actions: ['markClean', 'popBlade'], // or the pending action
        },
        CANCEL_DISCARD: {
          target: 'navigating',
          // No action -- stay on current blade
        },
      },
    },
  },
});
```

### Pattern 5: createActorContext for React Integration

**What:** `createActorContext` creates a React Context that provides the actor to all descendants. Components use `useSelector` for rendering and `useActorRef` for sending events.

```typescript
// Source: https://stately.ai/docs/xstate-react createActorContext
// --- context.ts ---
import { createActorContext } from '@xstate/react';
import { createActor } from 'xstate';
import { navigationMachine } from './navigationMachine';

// React context for components
export const NavigationMachineContext = createActorContext(navigationMachine);

// --- For non-React access (NAV-07) ---
let _actorRef: ReturnType<typeof createActor<typeof navigationMachine>> | null = null;

export function getNavigationActor() {
  if (!_actorRef) {
    throw new Error('Navigation actor not initialized. Wrap app in NavigationMachineContext.Provider.');
  }
  return _actorRef;
}

export function setNavigationActor(ref: typeof _actorRef) {
  _actorRef = ref;
}
```

```typescript
// --- selectors.ts ---
import type { SnapshotFrom } from 'xstate';
import type { navigationMachine } from './navigationMachine';

type NavSnapshot = SnapshotFrom<typeof navigationMachine>;

export const selectBladeStack = (snap: NavSnapshot) => snap.context.bladeStack;
export const selectActiveBlade = (snap: NavSnapshot) =>
  snap.context.bladeStack[snap.context.bladeStack.length - 1];
export const selectActiveProcess = (snap: NavSnapshot) => snap.context.activeProcess;
export const selectIsConfirmingDiscard = (snap: NavSnapshot) =>
  snap.value === 'confirmingDiscard';
export const selectStackDepth = (snap: NavSnapshot) => snap.context.bladeStack.length;
export const selectIsDirty = (snap: NavSnapshot) => snap.context.dirtyBladeIds.size > 0;
```

### Pattern 6: Non-React Access (NAV-07)

**What:** Keyboard shortcuts (`useKeyboardShortcuts`), the command palette, and `bladeOpener.ts` need to send events to the FSM without being inside a React component tree (or at least without using hooks at the call site).

**Solution:** Store the actor ref in a module-level variable, set it during provider initialization.

```typescript
// --- In App.tsx or root provider ---
import { NavigationMachineContext, setNavigationActor } from './machines/navigation/context';

function NavigationProvider({ children }: { children: React.ReactNode }) {
  const actorRef = NavigationMachineContext.useActorRef();

  // Store ref for non-React access
  React.useEffect(() => {
    setNavigationActor(actorRef);
    return () => setNavigationActor(null);
  }, [actorRef]);

  return <>{children}</>;
}

export function App() {
  return (
    <NavigationMachineContext.Provider>
      <NavigationProvider>
        {/* ... app content ... */}
      </NavigationProvider>
    </NavigationMachineContext.Provider>
  );
}
```

```typescript
// --- Updated bladeOpener.ts ---
import { getNavigationActor } from '../machines/navigation/context';

export function openBlade<K extends BladeType>(
  type: K,
  props: BladePropsMap[K],
  title?: string,
): void {
  const reg = getBladeRegistration(type);
  const resolvedTitle = title ?? (typeof reg?.defaultTitle === 'function'
    ? reg.defaultTitle(props as any)
    : reg?.defaultTitle ?? type);

  getNavigationActor().send({
    type: 'PUSH_BLADE',
    bladeType: type,
    title: resolvedTitle,
    props,
  });
}
```

### Pattern 7: Dev-Mode Inspector (NAV-08)

**What:** The `@statelyai/inspect` package provides `createBrowserInspector()` which opens a Stately Inspector panel that visualizes the FSM state, events, and transitions in real time.

```typescript
// Source: https://stately.ai/docs/inspector
// --- inspector.ts ---
let inspectorInstance: { inspect: (...args: any[]) => void } | null = null;

export async function getInspector() {
  if (!import.meta.env.DEV) return undefined;

  if (!inspectorInstance) {
    const { createBrowserInspector } = await import('@statelyai/inspect');
    inspectorInstance = createBrowserInspector({
      // Optionally embed in iframe instead of popup
      // iframe: document.getElementById('xstate-inspector') as HTMLIFrameElement,
      filter: (inspEvent) => {
        // Filter out high-frequency events if needed
        if (inspEvent.type === '@xstate.event') {
          return inspEvent.event.type !== 'MARK_DIRTY'; // too noisy
        }
        return true;
      },
    });
  }
  return inspectorInstance.inspect;
}
```

```typescript
// Usage in provider (dev mode only):
import { createActor } from 'xstate';
import { getInspector } from './inspector';

// In an async init or useEffect:
const inspect = await getInspector();
const actor = createActor(navigationMachine, { inspect });
actor.start();
```

### Anti-Patterns to Avoid

- **Modeling each blade type as a state node:** This creates N state nodes per blade type, which is combinatorially explosive. The blade stack is *data in context*, not a state hierarchy.
- **Using `useActor()` in components:** `useActor` re-renders on EVERY snapshot change. Use `useSelector` with selectors for surgical re-renders.
- **Storing the actor in Zustand:** The actor IS the store. Don't wrap an actor in another store. Use `createActorContext` or a module-level ref.
- **Inline guard functions in machine definition:** These can't be overridden with `.provide()` for testing. Always use named guards registered in `setup()`.
- **Using `machine.transition()` directly:** Deprecated internal API in v5. Use `createActor` + `getSnapshot()` for tests, or `getNextSnapshot()` for pure transition testing.
- **XState HMR for machine definitions:** Creates ghost states. Out of scope per requirements doc.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine engine | Custom reducer with switch/case | `xstate` setup().createMachine() | Guards, actions, inspector, formal model |
| React state bridge | Manual context + subscription | `@xstate/react` createActorContext | Handles lifecycle, selectors, re-render optimization |
| Visual state debugger | Custom dev panel | `@statelyai/inspect` createBrowserInspector() | State diagrams + sequence diagrams for free |
| Guard combinators | Custom AND/OR logic | `and()`, `or()`, `not()` from xstate | Type-safe, composable, visible in inspector |
| Conditional action dispatch | if/else in actions | `enqueueActions` with `check()` | Keeps actions pure, integrates with guard system |
| Dirty form tracking | Per-component state | XState context `dirtyBladeIds` Set | Single source of truth, guard-enforced |

**Key insight:** The entire point of XState is that the machine definition IS the specification. Hand-rolling navigation logic means you lose the formal model, the inspector, and the guard system.

## Common Pitfalls

### Pitfall 1: Re-renders from `useActor` Instead of `useSelector`
**What goes wrong:** Using `useActor(machine)` or `NavigationMachineContext.useActor()` causes the component to re-render on every state transition, even if the relevant data hasn't changed.
**Why it happens:** `useActor` subscribes to the entire snapshot.
**How to avoid:** Always use `NavigationMachineContext.useSelector(selectBladeStack)` with specific selectors. Create a selector per consumed value.
**Warning signs:** Components re-render when unrelated events are sent.

### Pitfall 2: Set/Map in Context Breaks Reference Equality
**What goes wrong:** `dirtyBladeIds: Set<string>` creates a new Set on every assign, causing useSelector to always detect a change.
**Why it happens:** XState uses reference equality by default for snapshot comparison.
**How to avoid:** Use the `compare` parameter in `useSelector`: `useSelector(selectIsDirty, (a, b) => a === b)` where the selector returns a primitive. Or convert Set to a sorted string key for comparison. Alternatively, use a plain `Record<string, true>` instead of Set for simpler equality checks.
**Warning signs:** Dirty-state-related components re-render when they shouldn't.

### Pitfall 3: Sending Events to a Stopped Actor
**What goes wrong:** Non-React code (`bladeOpener.ts`) sends events after the actor is stopped (e.g., during HMR or unmount).
**Why it happens:** Module-level actor ref becomes stale.
**How to avoid:** The `setNavigationActor(null)` cleanup in the provider effect. Guard `getNavigationActor()` with a null check and meaningful error.
**Warning signs:** Console warnings about sending events to stopped actors.

### Pitfall 4: Dirty Guard Blocking Destructive Navigation Permanently
**What goes wrong:** Process switch (SWITCH_PROCESS) gets blocked by dirty guard, leaving user stuck.
**Why it happens:** Applying the same dirty-check guard to process switching as to blade popping.
**How to avoid:** SWITCH_PROCESS and RESET_STACK should bypass dirty guards or always go through `confirmingDiscard`. Decide on policy: atomic resets force-clear dirty state (recommended), or always confirm first.
**Warning signs:** Users can't switch processes when a form is dirty.

### Pitfall 5: TypeScript `as` Casts in Event Payloads
**What goes wrong:** The PUSH_BLADE event needs `props: BladePropsMap[BladeType]` but the discriminated union makes this hard to type generically in the event definition.
**Why it happens:** XState events are a flat union; you can't express "if bladeType is X then props is Y" in the event type.
**How to avoid:** Accept `props: BladePropsMap[BladeType]` as the union type in the event, and rely on the `openBlade<K>` helper function to enforce the correlation at the call site. The machine itself treats props as opaque data.
**Warning signs:** Type errors when sending PUSH_BLADE events with specific props.

### Pitfall 6: Inspector Popup Blocked by Browser
**What goes wrong:** `createBrowserInspector()` opens a popup that modern browsers block by default.
**Why it happens:** Popup is not triggered by a user gesture.
**How to avoid:** Use the `iframe` option to embed the inspector in a dev-mode panel within the app, or instruct developers to allow popups for localhost.
**Warning signs:** Inspector never appears; no console error.

## Code Examples

### Example 1: Pure Machine Testing (No DOM)

```typescript
// Source: https://stately.ai/docs/testing
// --- navigationMachine.test.ts ---
import { createActor } from 'xstate';
import { describe, it, expect } from 'vitest';
import { navigationMachine } from './navigationMachine';

describe('navigationMachine', () => {
  function createTestActor() {
    const actor = createActor(navigationMachine);
    actor.start();
    return actor;
  }

  it('starts in navigating state with staging root blade', () => {
    const actor = createTestActor();
    const snap = actor.getSnapshot();

    expect(snap.value).toBe('navigating');
    expect(snap.context.activeProcess).toBe('staging');
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.bladeStack[0].type).toBe('staging-changes');

    actor.stop();
  });

  it('PUSH_BLADE adds blade to stack', () => {
    const actor = createTestActor();

    actor.send({
      type: 'PUSH_BLADE',
      bladeType: 'settings',
      title: 'Settings',
      props: {} as Record<string, never>,
    });

    const snap = actor.getSnapshot();
    expect(snap.context.bladeStack).toHaveLength(2);
    expect(snap.context.bladeStack[1].type).toBe('settings');

    actor.stop();
  });

  it('blocks singleton duplicate push', () => {
    const actor = createTestActor();

    actor.send({
      type: 'PUSH_BLADE',
      bladeType: 'settings',
      title: 'Settings',
      props: {} as Record<string, never>,
    });
    actor.send({
      type: 'PUSH_BLADE',
      bladeType: 'settings',
      title: 'Settings',
      props: {} as Record<string, never>,
    });

    expect(actor.getSnapshot().context.bladeStack).toHaveLength(2); // Not 3

    actor.stop();
  });

  it('POP_BLADE does not remove root blade', () => {
    const actor = createTestActor();
    actor.send({ type: 'POP_BLADE' });

    expect(actor.getSnapshot().context.bladeStack).toHaveLength(1);

    actor.stop();
  });

  it('SWITCH_PROCESS atomically resets stack', () => {
    const actor = createTestActor();

    actor.send({
      type: 'PUSH_BLADE',
      bladeType: 'commit-details',
      title: 'Commit',
      props: { oid: 'abc123' },
    });
    actor.send({ type: 'SWITCH_PROCESS', process: 'topology' });

    const snap = actor.getSnapshot();
    expect(snap.context.activeProcess).toBe('topology');
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.bladeStack[0].type).toBe('topology-graph');

    actor.stop();
  });

  it('dirty blade triggers confirmingDiscard on POP_BLADE', () => {
    const actor = createTestActor();

    actor.send({
      type: 'PUSH_BLADE',
      bladeType: 'diff',
      title: 'Diff',
      props: { source: { mode: 'staging', filePath: 'test.ts', staged: false } },
    });

    const bladeId = actor.getSnapshot().context.bladeStack[1].id;
    actor.send({ type: 'MARK_DIRTY', bladeId });
    actor.send({ type: 'POP_BLADE' });

    expect(actor.getSnapshot().value).toBe('confirmingDiscard');

    actor.stop();
  });

  it('CONFIRM_DISCARD pops and returns to navigating', () => {
    const actor = createTestActor();

    actor.send({
      type: 'PUSH_BLADE',
      bladeType: 'diff',
      title: 'Diff',
      props: { source: { mode: 'staging', filePath: 'test.ts', staged: false } },
    });

    const bladeId = actor.getSnapshot().context.bladeStack[1].id;
    actor.send({ type: 'MARK_DIRTY', bladeId });
    actor.send({ type: 'POP_BLADE' });
    actor.send({ type: 'CONFIRM_DISCARD' });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe('navigating');
    expect(snap.context.bladeStack).toHaveLength(1);

    actor.stop();
  });

  it('enforces max stack depth', () => {
    const actor = createActor(
      navigationMachine.provide({}), // can customize via input in future
    );
    actor.start();

    // Push up to max depth
    for (let i = 0; i < 25; i++) {
      actor.send({
        type: 'PUSH_BLADE',
        bladeType: 'diff',
        title: `Diff ${i}`,
        props: { source: { mode: 'staging', filePath: `file${i}.ts`, staged: false } },
      });
    }

    // Should be capped at maxStackDepth
    expect(actor.getSnapshot().context.bladeStack.length).toBeLessThanOrEqual(20);

    actor.stop();
  });
});
```

### Example 2: Testing with machine.provide() for Mocking

```typescript
// Source: XState v5 provide pattern from https://stately.ai/docs/machines
import { createActor } from 'xstate';
import { navigationMachine } from './navigationMachine';

it('can mock a guard for testing', () => {
  // Override the singleton guard to always allow
  const testMachine = navigationMachine.provide({
    guards: {
      isNotSingleton: () => true,
    },
  });

  const actor = createActor(testMachine);
  actor.start();

  actor.send({
    type: 'PUSH_BLADE',
    bladeType: 'settings',
    title: 'Settings',
    props: {} as Record<string, never>,
  });
  actor.send({
    type: 'PUSH_BLADE',
    bladeType: 'settings',
    title: 'Settings',
    props: {} as Record<string, never>,
  });

  // Guard overridden: duplicate allowed
  expect(actor.getSnapshot().context.bladeStack).toHaveLength(3);

  actor.stop();
});
```

### Example 3: React Component Consuming FSM

```typescript
// Using createActorContext selectors
import { NavigationMachineContext } from '../machines/navigation/context';
import { selectBladeStack, selectActiveBlade } from '../machines/navigation/selectors';

function BladeContainer() {
  const bladeStack = NavigationMachineContext.useSelector(selectBladeStack);
  const activeBlade = NavigationMachineContext.useSelector(selectActiveBlade);
  const actorRef = NavigationMachineContext.useActorRef();

  return (
    <div className="flex h-full overflow-hidden">
      {bladeStack.slice(0, -1).map((blade, index) => (
        <BladeStrip
          key={blade.id}
          title={blade.title}
          onExpand={() => actorRef.send({ type: 'POP_TO_INDEX', index })}
        />
      ))}
      <BladeRenderer
        blade={activeBlade}
        goBack={() => actorRef.send({ type: 'POP_BLADE' })}
      />
    </div>
  );
}
```

### Example 4: Combined Guard with and()/or()

```typescript
// Source: https://stately.ai/docs/guards and(), or() combinators
import { and, not } from 'xstate';

// In machine definition:
on: {
  PUSH_BLADE: {
    guard: and(['isNotSingleton', 'isUnderMaxDepth', not('isTopBladeDirty')]),
    actions: 'pushBlade',
  },
}
```

### Example 5: enqueueActions for Complex Conditional Logic

```typescript
// Source: https://stately.ai/docs/actions enqueueActions
import { enqueueActions } from 'xstate';

// When PUSH_BLADE needs conditional behavior:
const conditionalPush = enqueueActions(({ context, event, enqueue, check }) => {
  // Always resolve the title
  enqueue({ type: 'resolveBladeTitleFromRegistry' });

  // If we're at max depth, pop the top first to make room
  if (check('isAtMaxDepth')) {
    enqueue('popBlade');
  }

  enqueue('pushBlade');
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createMachine()` with inline types | `setup().createMachine()` | XState 5.0 (Dec 2023) | Full TypeScript inference, named guards/actions |
| `machine.withConfig()` | `machine.provide()` | XState 5.0 | Clearer API, same capability |
| `machine.transition()` | `getNextSnapshot()` (soon: `transition()`) | XState 5.0 | Pure transition testing without actor |
| `pure()` / `choose()` | `enqueueActions()` | XState 5.0 | Unified conditional action API |
| `@xstate/inspect` (v4) | `@statelyai/inspect` (v5) | Jan 2024 | New package, createBrowserInspector() |
| Typegen CLI | Setup types in `setup()` | XState 5.0 | No codegen needed; types inferred from setup |
| `useInterpret()` | `useActorRef()` | @xstate/react 4.0 | Renamed for actor model clarity |
| `useMachine()` for state | `useSelector()` for granular reads | @xstate/react 4.0+ | Better render performance |

**Deprecated/outdated:**
- `createMachine()` without `setup()`: Still works but loses TypeScript inference for guards/actions
- `@xstate/inspect`: v4 only; use `@statelyai/inspect` for v5
- Typegen / `@xstate/cli`: Not needed in v5; `setup()` provides types
- `useMachine()`: Still works but causes unnecessary re-renders vs `useSelector()`

## Integration & Migration Strategy

### Phase 1: Create Machine + Tests (no UI changes)
1. Create `src/machines/navigation/` directory structure
2. Define types, guards, actions, machine
3. Write comprehensive pure machine tests
4. Verify all existing blade store behaviors are covered

### Phase 2: Wire Machine to React via createActorContext
1. Create `NavigationMachineContext` with `createActorContext`
2. Add provider to app root
3. Store actor ref for non-React access
4. Set up dev-mode inspector (conditional import)

### Phase 3: Migrate Consumers One-by-One
**Key insight:** Keep `useBladeNavigation()` hook as the public API, change its internals.

```typescript
// BEFORE (current):
export function useBladeNavigation() {
  const store = useBladeStore();
  // ... returns { openBlade, goBack, goToRoot, ...store }
}

// AFTER (FSM-backed, same API):
export function useBladeNavigation() {
  const actorRef = NavigationMachineContext.useActorRef();
  const bladeStack = NavigationMachineContext.useSelector(selectBladeStack);
  const activeProcess = NavigationMachineContext.useSelector(selectActiveProcess);

  function openBlade<K extends BladeType>(type: K, props: BladePropsMap[K], title?: string) {
    const reg = getBladeRegistration(type);
    const resolvedTitle = title ?? (typeof reg?.defaultTitle === 'function'
      ? reg.defaultTitle(props as any)
      : reg?.defaultTitle ?? type);

    actorRef.send({ type: 'PUSH_BLADE', bladeType: type, title: resolvedTitle, props });
  }

  return {
    openBlade,
    goBack: () => actorRef.send({ type: 'POP_BLADE' }),
    goToRoot: () => actorRef.send({ type: 'RESET_STACK' }),
    bladeStack,
    activeProcess,
    setProcess: (p: ProcessType) => actorRef.send({ type: 'SWITCH_PROCESS', process: p }),
    popToIndex: (i: number) => actorRef.send({ type: 'POP_TO_INDEX', index: i }),
    popBlade: () => actorRef.send({ type: 'POP_BLADE' }),
    resetStack: () => actorRef.send({ type: 'RESET_STACK' }),
    replaceBlade: (blade: any) => actorRef.send({ type: 'REPLACE_BLADE', ...blade }),
    // New FSM capabilities:
    markDirty: (bladeId: string) => actorRef.send({ type: 'MARK_DIRTY', bladeId }),
    markClean: (bladeId: string) => actorRef.send({ type: 'MARK_CLEAN', bladeId }),
  };
}
```

### Consumer Migration Checklist

| Consumer File | Access Pattern | Migration |
|--------------|----------------|-----------|
| `src/hooks/useBladeNavigation.ts` | `useBladeStore()` hook | Rewrite internals to use NavigationMachineContext |
| `src/lib/bladeOpener.ts` | `useBladeStore.getState()` | Use `getNavigationActor().send()` |
| `src/hooks/useKeyboardShortcuts.ts` | `useBladeStore.getState()` | Use `getNavigationActor()` |
| `src/components/blades/BladeContainer.tsx` | `useBladeStore()` | Use NavigationMachineContext.useSelector |
| `src/components/blades/ProcessNavigation.tsx` | `useBladeStore()` | Use NavigationMachineContext.useSelector + useActorRef |
| `src/components/blades/BladeBreadcrumb.tsx` | `useBladeStore()` | Use NavigationMachineContext.useSelector |
| `src/components/blades/DiffBlade.tsx` | `useBladeStore()` | Use NavigationMachineContext.useSelector |
| `src/components/blades/RepoBrowserBlade.tsx` | `useBladeStore()` | Use NavigationMachineContext.useSelector |
| `src/components/markdown/MarkdownLink.tsx` | `useBladeStore()` | Use useBladeNavigation() hook |
| `src/components/Header.tsx` | `useBladeStore.getState().resetStack()` | Use `getNavigationActor().send({ type: 'RESET_STACK' })` |
| `src/components/gitflow/GitflowPanel.tsx` | `useBladeStore()` | Use useBladeNavigation() hook |
| `src/stores/blades.test.ts` | `useBladeStore.getState()` | Rewrite as pure machine tests |

### Phase 4: Remove Old Zustand Store
1. Delete `src/stores/blades.ts` (or keep as deprecated redirect)
2. Update `src/stores/bladeTypes.ts` -- KEEP (types are shared)
3. Remove old tests, verify new tests pass
4. Clean up imports across codebase

## TypeScript Integration Details

### Full Type Safety with setup()

XState v5 `setup()` provides complete type inference without typegen. The key pattern:

```typescript
const machineSetup = setup({
  types: {
    context: {} as NavigationContext,
    events: {} as NavigationEvent,
  },
  guards: {
    // Guard implementations are type-checked against context + events
    isNotSingleton: ({ context, event }) => { /* ... */ },
  },
  actions: {
    // Action implementations are type-checked
    pushBlade: assign({ /* ... */ }),
  },
});

// Machine created from setup inherits all types
const machine = machineSetup.createMachine({ /* ... */ });

// SnapshotFrom<typeof machine> gives fully typed snapshots
type NavSnapshot = SnapshotFrom<typeof machine>;

// ActorRefFrom<typeof machine> gives fully typed actor ref
type NavActorRef = ActorRefFrom<typeof machine>;
```

### Event Type Narrowing

For the PUSH_BLADE event with discriminated props, the pragmatic approach:

```typescript
// The event union:
type NavigationEvent =
  | { type: 'PUSH_BLADE'; bladeType: BladeType; title: string; props: BladePropsMap[BladeType] }
  // ...

// The helper function enforces the correlation:
function openBlade<K extends BladeType>(type: K, props: BladePropsMap[K], title?: string) {
  actorRef.send({
    type: 'PUSH_BLADE',
    bladeType: type,
    title: resolvedTitle,
    props: props as BladePropsMap[BladeType], // safe: K extends BladeType
  });
}
```

The machine itself does not need to discriminate the props type -- it stores them opaquely in the TypedBlade. The `BladeRenderer` handles the per-type rendering.

## Open Questions

1. **Pending event in confirmingDiscard**
   - What we know: When a dirty guard fires, the user needs to confirm discard before the original action (push/pop) completes.
   - What's unclear: Should the pending event be stored in context, or should the confirm/cancel events carry the original action type?
   - Recommendation: Store `pendingEvent` in context. On CONFIRM_DISCARD, replay the pending event. Simpler than parameterized confirm events. Implement in Phase 26 tasks.

2. **Max stack depth policy**
   - What we know: NAV-06 requires a max stack depth limit.
   - What's unclear: Should hitting the limit silently fail (guard blocks), or should it auto-remove the oldest non-root blade?
   - Recommendation: Guard blocks with a toast notification. Simpler, more predictable. The limit (20) is generous enough that users won't normally hit it.

3. **Dirty form registration mechanism**
   - What we know: Blades need to call MARK_DIRTY / MARK_CLEAN when forms change.
   - What's unclear: Should this be a hook (`useDirtyForm(bladeId)`) or manual event sending?
   - Recommendation: Provide a `useBladeFormGuard(bladeId)` hook that returns `{ markDirty, markClean, isDirty }` and automatically calls MARK_CLEAN on unmount.

4. **Set vs Record for dirtyBladeIds**
   - What we know: Set<string> creates new references on every assign.
   - What's unclear: Whether this causes real performance issues with useSelector.
   - Recommendation: Start with `Record<string, true>` (plain object) instead of Set. Simpler equality semantics, and selectors that derive booleans work cleanly.

## Sources

### Primary (HIGH confidence)
- `/websites/stately_ai` (Context7) - setup(), createMachine, guards, actions, createActorContext, useSelector, useActorRef, TypeScript types
- [Stately XState Testing Docs](https://stately.ai/docs/testing) - createActor, getSnapshot, testing patterns
- [Stately Inspector Docs](https://stately.ai/docs/inspector) - createBrowserInspector, filter, iframe options
- [Stately Inspection API Docs](https://stately.ai/docs/inspection) - inspect option, event types (@xstate.actor, @xstate.event, @xstate.snapshot)
- [Stately Guards Docs](https://stately.ai/docs/guards) - and(), or(), not(), parameterized guards, TypeScript typing
- [Stately Migration Docs](https://stately.ai/docs/migration) - getNextSnapshot, enqueueActions, machine.provide()

### Secondary (MEDIUM confidence)
- [XState v5 Blog Announcement](https://stately.ai/blog/2023-12-01-xstate-v5) - setup() API, actor model changes
- [@statelyai/inspect npm](https://www.npmjs.com/package/@statelyai/inspect) - Version ~0.4.0, package details
- [Stately Developer Tools](https://stately.ai/docs/developer-tools) - Confirmed v4 devtools don't work with v5; @statelyai/inspect is the replacement

### Tertiary (LOW confidence)
- None - all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - xstate@5.26.0 and @xstate/react@6.0.0 already installed; APIs verified via Context7
- Architecture: HIGH - flat FSM with context-based stack is well-documented XState pattern; guards/actions verified
- Pitfalls: HIGH - Set reference equality, useActor re-renders, popup blocking verified via official docs
- Migration strategy: MEDIUM - specific consumer list verified via codebase grep; migration order is recommendation
- Inspector setup: MEDIUM - @statelyai/inspect API verified but v5 inspector ecosystem is still maturing

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - XState v5 API is stable)
