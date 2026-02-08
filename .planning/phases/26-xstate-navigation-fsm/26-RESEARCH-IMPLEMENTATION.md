# Phase 26: XState Navigation FSM - Implementation Research

**Researched:** 2026-02-08
**Domain:** XState v5 finite state machine for blade navigation + extensibility refactoring
**Confidence:** HIGH

## Summary

The FlowForge blade navigation system currently lives in a Zustand store (`useBladeStore`) with 6 imperative operations (`pushBlade`, `popBlade`, `popToIndex`, `replaceBlade`, `resetStack`, `setProcess`) scattered across 12 consumer files with 33 total `useBladeStore` references. There is no guard logic for data-loss prevention, no transition validation, and no observability beyond Zustand devtools. The existing architecture is well-factored (blade registry, typed props map, singleton guards in `bladeOpener.ts`) but the navigation logic itself is purely imperative -- a blade can be pushed from anywhere without constraint.

XState v5.26.0 and @xstate/react v6.0.0 are **already installed** in the project (`package.json`). A proof-of-concept machine already exists in `src/lib/xstate-example.test.ts` from Phase 25. The migration path is clear: replace the imperative store operations with a single XState machine that owns the `bladeStack` and `activeProcess` state, then expose a thin React hook (`useNavigationMachine`) that components consume instead of `useBladeStore`.

The extensibility refactoring goal -- "adding a new blade type should be a single-directory operation" -- is mostly achieved today via the blade registry pattern but breaks down at the **navigation layer** (the `SINGLETON_TYPES` array is duplicated in 2 files, the `rootBladeForProcess` function hardcodes process roots, and `BladePropsMap` in `bladeTypes.ts` must be manually extended). The FSM provides the right abstraction to centralize these policies as composable guards and declarative transition rules.

**Primary recommendation:** Introduce an XState v5 navigation machine that wraps (not replaces) the existing blade registry, exposing the same API surface through event-driven transitions with guards. Use `useActorRef` + `useSelector` for performance-optimal React integration. Migrate consumers file-by-file behind a compatibility shim.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| xstate | 5.26.0 | Navigation FSM definition, guards, actions | Already installed; industry-standard statechart library |
| @xstate/react | 6.0.0 | React hooks (`useActorRef`, `useSelector`) | Already installed; official React binding |
| zustand | 5.x | Remains for all other stores (21 stores) | Not being replaced, only blade store changes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | 12.31.0 | Blade transition animations | Already used in BladeContainer; FSM state drives animation variants |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| XState machine | Zustand middleware for guards | XState gives visual debugging, formal guards, and statechart guarantees; middleware approach lacks observability |
| useActorRef+useSelector | useMachine | useMachine causes full re-render on every transition; useActorRef+useSelector is surgically precise |

**Installation:** No installation needed -- both packages are already in `package.json` and `node_modules`.

## Current Codebase Analysis

### 1. Blade Store API (`src/stores/blades.ts`)

The store exposes 6 operations + 2 state fields:

| Operation | Signature | Usage Count | Files |
|-----------|-----------|-------------|-------|
| `pushBlade` | `<K extends BladeType>(blade: { type: K; title: string; props: BladePropsMap[K] }) => void` | 11 | 5 files |
| `popBlade` | `() => void` | 3 | 2 files |
| `popToIndex` | `(index: number) => void` | 2 | 1 file |
| `replaceBlade` | `<K extends BladeType>(blade: { type: K; title: string; props: BladePropsMap[K] }) => void` | 7 | 4 files |
| `resetStack` | `() => void` | 1 | 1 file |
| `setProcess` | `(process: ProcessType) => void` | 1 (+ tests) | 1 file |
| `activeProcess` | `ProcessType` (read) | 2 | 2 files |
| `bladeStack` | `TypedBlade[]` (read) | implicit via hook | many files |

**Key insight:** `pushBlade` is the most-used operation (11 callsites). The `replaceBlade` pattern (7 callsites) is used for in-place navigation (repo browser directory changes, markdown link following, staging diff file navigation).

### 2. Blade Type System (`src/stores/bladeTypes.ts`)

```
BladePropsMap interface → 13 blade types
BladeType = keyof BladePropsMap
TypedBlade = discriminated union via mapped type
```

**Current blade types (13):**
- Root blades: `staging-changes`, `topology-graph`
- Detail blades: `commit-details`, `diff`
- Viewer blades: `viewer-nupkg`, `viewer-image`, `viewer-markdown`, `viewer-3d`, `viewer-code`
- Navigation: `repo-browser`
- Utility: `settings`, `changelog`, `gitflow-cheatsheet`

**Extensibility concern:** Adding a new blade type requires editing `BladePropsMap` interface (step 1 of the documented 4-step process). This is acceptable for TypeScript type safety but means the type file is a coordination point.

### 3. Blade Registration Pattern (`src/lib/bladeRegistry.ts` + `src/components/blades/registrations/`)

Registration is **already extensible** via file-based auto-discovery:
- `registrations/index.ts` uses `import.meta.glob(["./*.{ts,tsx}", "!./index.ts"], { eager: true })`
- Each registration file calls `registerBlade()` at module level
- Dev-mode exhaustiveness check warns if types lack registrations
- HMR support with `clearRegistry()` on dispose

**This is the model to follow for FSM extensibility.**

### 4. Consumer Migration Surface

**Files that directly call blade store operations:**

| File | Operations Used | Migration Complexity |
|------|-----------------|---------------------|
| `src/hooks/useBladeNavigation.ts` | pushBlade, popBlade, resetStack | HIGH - Primary abstraction layer, 83 lines |
| `src/lib/bladeOpener.ts` | pushBlade (via getState) | MEDIUM - Non-React context bridge |
| `src/hooks/useKeyboardShortcuts.ts` | popBlade, activeProcess | LOW - 4 references |
| `src/components/blades/BladeContainer.tsx` | bladeStack, popToIndex, popBlade | MEDIUM - Renders the blade stack |
| `src/components/blades/ProcessNavigation.tsx` | activeProcess, setProcess | LOW - 2 references |
| `src/components/Header.tsx` | resetStack, openBlade | LOW - 2 references |
| `src/components/blades/RepoBrowserBlade.tsx` | pushBlade, replaceBlade | MEDIUM - 6 direct store calls |
| `src/components/blades/BladeBreadcrumb.tsx` | popToIndex, replaceBlade | MEDIUM - 6 direct store calls |
| `src/components/blades/DiffBlade.tsx` | replaceBlade | LOW - 1 reference |
| `src/components/markdown/MarkdownLink.tsx` | replaceBlade, pushBlade | LOW - 2 references |
| `src/components/blades/TopologyRootBlade.tsx` | via useBladeNavigation | NONE - Uses hook |
| `src/components/blades/CommitDetailsBlade.tsx` | via useBladeNavigation | NONE - Uses hook |
| `src/components/gitflow/GitflowPanel.tsx` | via useBladeNavigation | NONE - Uses hook |

**Total files requiring changes: 10** (excluding those that only use `useBladeNavigation` hook, which wraps the store).

### 5. Dirty Form Detection -- Current State

**No formal dirty-form tracking exists.** Current data-loss-adjacent patterns:

| Location | Pattern | Risk |
|----------|---------|------|
| `CommitForm.tsx` | `message` state in `useState`, `window.confirm()` for amend | Commit message lost if blade navigates away |
| `ConventionalCommitForm.tsx` | Form fields in local state | Form data lost on navigation |
| `Header.tsx` / `BranchSwitcher.tsx` | `status?.isDirty` check before branch switch, offers stash | Only for branch switching, not blade navigation |
| Settings panels | Settings persisted immediately on change (Zustand stores) | No risk -- instant persistence |

**Conclusion:** The commit form textarea is the only meaningful dirty-form concern for blade navigation. The FSM should provide a `canNavigateAway` guard that checks for unsaved commit messages.

### 6. Process Switching (`src/stores/blades.ts` + `src/components/blades/ProcessNavigation.tsx`)

Process switching (`staging` <-> `topology`) currently:
1. Calls `setProcess(process)` on the store
2. Store sets `activeProcess` and resets `bladeStack` to `[rootBladeForProcess(process)]`
3. `rootBladeForProcess()` is hardcoded with a switch on `"staging"` vs `"topology"`

**FSM modeling:** Process switching should be a top-level event (`SWITCH_PROCESS`) with a guard for dirty-form checking. The root blade per process is a natural part of the machine context.

### 7. Tailwind v4 Animations (`src/index.css` + `src/lib/animations.ts`)

**Existing custom animations in `@theme` block:**
- `--animate-dirty-pulse` (2s ease-in-out infinite)
- `--animate-gentle-pulse` (3s ease-in-out infinite)

**Existing framer-motion variants in `src/lib/animations.ts`:**
- `bladeSlideIn` -- exactly what BladeContainer uses (x: 40 -> 0)
- `fadeIn`, `fadeInUp`, `fadeInScale`, `slideInLeft`, `tabContent`, `staggerContainer`

**For FSM transitions:** The existing `bladeSlideIn` variant in `src/lib/animations.ts` is already used. The FSM can drive animation direction (push = slide-in-from-right, pop = slide-in-from-left) by setting context that BladeContainer reads. No new CSS animations needed; framer-motion handles this.

### 8. Existing XState Integration

The project already has:
- `xstate@5.26.0` in `node_modules` (2.5MB on disk, tree-shakeable)
- `@xstate/react@6.0.0` in `node_modules` (88KB on disk)
- A proof-of-concept test: `src/lib/xstate-example.test.ts` that demonstrates `setup()`, `createMachine()`, guards, `assign()`, and `createActor()`

## Architecture Patterns

### Recommended Project Structure

```
src/
├── machines/
│   ├── navigation/
│   │   ├── navigationMachine.ts       # XState machine definition
│   │   ├── navigationMachine.test.ts  # Pure machine tests (no React)
│   │   ├── guards.ts                  # Composable guard functions
│   │   ├── actions.ts                 # Assign actions
│   │   ├── types.ts                   # Context, events, type helpers
│   │   └── index.ts                   # Public API barrel
│   └── index.ts
├── hooks/
│   ├── useNavigationMachine.ts        # React hook (replaces useBladeNavigation)
│   └── useNavigationActor.tsx         # React context provider for actor ref
├── stores/
│   ├── blades.ts                      # DEPRECATED → thin wrapper over machine
│   └── bladeTypes.ts                  # KEPT as-is (type definitions)
├── lib/
│   ├── bladeRegistry.ts              # KEPT as-is
│   ├── bladeOpener.ts                # MIGRATED to send events to actor
│   └── bladeUtils.tsx                # KEPT as-is
└── components/blades/
    ├── registrations/                # KEPT as-is (auto-discovery)
    ├── BladeContainer.tsx            # MIGRATED to read from actor
    └── ...
```

### Pattern 1: XState v5 Navigation Machine with `setup()`

**What:** Define the navigation FSM using XState v5's `setup()` API for maximum type safety.
**When to use:** This is the core machine definition.

```typescript
// src/machines/navigation/types.ts
import type { BladeType, BladePropsMap, TypedBlade } from "../../stores/bladeTypes";

export type ProcessType = "staging" | "topology";

export type NavigationContext = {
  activeProcess: ProcessType;
  bladeStack: TypedBlade[];
  /** Direction of last transition for animation */
  transitionDirection: "forward" | "backward" | "none";
  /** Pending navigation blocked by dirty guard */
  pendingNavigation: NavigationEvent | null;
};

export type NavigationEvent =
  | { type: "PUSH_BLADE"; bladeType: BladeType; title: string; props: BladePropsMap[BladeType] }
  | { type: "POP_BLADE" }
  | { type: "POP_TO_INDEX"; index: number }
  | { type: "REPLACE_BLADE"; bladeType: BladeType; title: string; props: BladePropsMap[BladeType] }
  | { type: "RESET_STACK" }
  | { type: "SWITCH_PROCESS"; process: ProcessType }
  | { type: "CONFIRM_NAVIGATION" }
  | { type: "CANCEL_NAVIGATION" };
```

```typescript
// src/machines/navigation/guards.ts
import type { NavigationContext, NavigationEvent } from "./types";

/** Guard: blade stack has more than 1 blade */
export const hasMultipleBlades = ({ context }: { context: NavigationContext }) =>
  context.bladeStack.length > 1;

/** Guard: target index is valid */
export const isValidIndex = (
  { context }: { context: NavigationContext },
  params: { index: number },
) => params.index >= 0 && params.index < context.bladeStack.length;

/** Guard: blade type is not already in stack (for singletons) */
export const isNotDuplicate = (
  { context }: { context: NavigationContext },
  params: { bladeType: string; singletonTypes: string[] },
) => {
  if (!params.singletonTypes.includes(params.bladeType)) return true;
  return !context.bladeStack.some((b) => b.type === params.bladeType);
};

/**
 * Composable dirty-form guard.
 * Returns true if navigation is safe (no dirty forms).
 * This is the extension point for form-aware blades.
 */
export const canNavigateAway = ({ context }: { context: NavigationContext }) => {
  // Phase 26 MVP: always allow (no dirty tracking yet)
  // Extension point: check a dirtyForms set in context
  return true;
};
```

```typescript
// src/machines/navigation/navigationMachine.ts
import { setup, assign } from "xstate";
import type { NavigationContext, NavigationEvent } from "./types";
import * as guards from "./guards";

function rootBladeForProcess(process: "staging" | "topology") {
  return process === "staging"
    ? { id: "root", type: "staging-changes" as const, title: "Changes", props: {} as Record<string, never> }
    : { id: "root", type: "topology-graph" as const, title: "Topology", props: {} as Record<string, never> };
}

export const navigationMachine = setup({
  types: {
    context: {} as NavigationContext,
    events: {} as NavigationEvent,
  },
  guards: {
    hasMultipleBlades: guards.hasMultipleBlades,
    canNavigateAway: guards.canNavigateAway,
    isNotDuplicate: ({ context, event }) => {
      if (event.type !== "PUSH_BLADE") return true;
      const singletonTypes = ["settings", "changelog", "gitflow-cheatsheet"];
      return guards.isNotDuplicate({ context }, {
        bladeType: event.bladeType,
        singletonTypes,
      });
    },
  },
  actions: {
    pushBlade: assign(({ context, event }) => {
      if (event.type !== "PUSH_BLADE") return {};
      return {
        bladeStack: [
          ...context.bladeStack,
          { id: crypto.randomUUID(), type: event.bladeType, title: event.title, props: event.props },
        ],
        transitionDirection: "forward" as const,
      };
    }),
    popBlade: assign(({ context }) => ({
      bladeStack: context.bladeStack.slice(0, -1),
      transitionDirection: "backward" as const,
    })),
    popToIndex: assign(({ context, event }) => {
      if (event.type !== "POP_TO_INDEX") return {};
      return {
        bladeStack: context.bladeStack.slice(0, event.index + 1),
        transitionDirection: "backward" as const,
      };
    }),
    replaceBlade: assign(({ context, event }) => {
      if (event.type !== "REPLACE_BLADE") return {};
      return {
        bladeStack: [
          ...context.bladeStack.slice(0, -1),
          { id: crypto.randomUUID(), type: event.bladeType, title: event.title, props: event.props },
        ],
        transitionDirection: "none" as const,
      };
    }),
    resetStack: assign(({ context }) => ({
      bladeStack: [rootBladeForProcess(context.activeProcess)],
      transitionDirection: "backward" as const,
    })),
    switchProcess: assign(({ event }) => {
      if (event.type !== "SWITCH_PROCESS") return {};
      return {
        activeProcess: event.process,
        bladeStack: [rootBladeForProcess(event.process)],
        transitionDirection: "none" as const,
      };
    }),
  },
}).createMachine({
  id: "navigation",
  initial: "idle",
  context: {
    activeProcess: "staging",
    bladeStack: [rootBladeForProcess("staging")],
    transitionDirection: "none",
    pendingNavigation: null,
  },
  states: {
    idle: {
      on: {
        PUSH_BLADE: {
          guard: "isNotDuplicate",
          actions: "pushBlade",
        },
        POP_BLADE: {
          guard: "hasMultipleBlades",
          actions: "popBlade",
        },
        POP_TO_INDEX: {
          actions: "popToIndex",
        },
        REPLACE_BLADE: {
          actions: "replaceBlade",
        },
        RESET_STACK: {
          actions: "resetStack",
        },
        SWITCH_PROCESS: {
          actions: "switchProcess",
        },
      },
    },
    // Future: confirmingNavigation state for dirty-form dialog
  },
});
```

### Pattern 2: React Integration with `useActorRef` + `useSelector`

**What:** Performance-optimal React hook that minimizes re-renders.
**When to use:** Every component that needs blade navigation state.

```typescript
// src/hooks/useNavigationActor.tsx
import { createContext, useContext, useRef, type ReactNode } from "react";
import { useActorRef } from "@xstate/react";
import type { ActorRefFrom } from "xstate";
import { navigationMachine } from "../machines/navigation/navigationMachine";

type NavigationActorRef = ActorRefFrom<typeof navigationMachine>;

const NavigationContext = createContext<NavigationActorRef | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const actorRef = useActorRef(navigationMachine);
  return (
    <NavigationContext.Provider value={actorRef}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigationActorRef(): NavigationActorRef {
  const ref = useContext(NavigationContext);
  if (!ref) throw new Error("useNavigationActorRef must be within NavigationProvider");
  return ref;
}
```

```typescript
// src/hooks/useNavigationMachine.ts
import { useSelector } from "@xstate/react";
import { useNavigationActorRef } from "./useNavigationActor";
import type { BladeType, BladePropsMap } from "../stores/bladeTypes";
import { getBladeRegistration } from "../lib/bladeRegistry";

// External selectors for minimal re-renders
const selectBladeStack = (snap: any) => snap.context.bladeStack;
const selectActiveProcess = (snap: any) => snap.context.activeProcess;
const selectTransitionDirection = (snap: any) => snap.context.transitionDirection;

export function useNavigationMachine() {
  const actorRef = useNavigationActorRef();
  const bladeStack = useSelector(actorRef, selectBladeStack);
  const activeProcess = useSelector(actorRef, selectActiveProcess);
  const transitionDirection = useSelector(actorRef, selectTransitionDirection);

  function openBlade<K extends BladeType>(type: K, props: BladePropsMap[K], title?: string) {
    const reg = getBladeRegistration(type);
    const resolvedTitle = title ??
      (typeof reg?.defaultTitle === "function"
        ? reg.defaultTitle(props as any)
        : reg?.defaultTitle ?? type);
    actorRef.send({ type: "PUSH_BLADE", bladeType: type, title: resolvedTitle, props });
  }

  return {
    bladeStack,
    activeProcess,
    transitionDirection,
    openBlade,
    popBlade: () => actorRef.send({ type: "POP_BLADE" }),
    popToIndex: (index: number) => actorRef.send({ type: "POP_TO_INDEX", index }),
    replaceBlade: <K extends BladeType>(type: K, title: string, props: BladePropsMap[K]) =>
      actorRef.send({ type: "REPLACE_BLADE", bladeType: type, title, props }),
    resetStack: () => actorRef.send({ type: "RESET_STACK" }),
    switchProcess: (process: "staging" | "topology") =>
      actorRef.send({ type: "SWITCH_PROCESS", process }),
    actorRef, // Escape hatch for advanced use
  };
}
```

### Pattern 3: Non-React Context Bridge (Command Palette, Keyboard Shortcuts)

**What:** Accessing the FSM actor from outside React components.
**When to use:** Command palette actions, keyboard shortcuts, `bladeOpener.ts`.

```typescript
// src/machines/navigation/index.ts
import { createActor } from "xstate";
import { navigationMachine } from "./navigationMachine";

// Singleton actor for non-React access
let _actor: ReturnType<typeof createActor<typeof navigationMachine>> | null = null;

export function getNavigationActor() {
  if (!_actor) {
    _actor = createActor(navigationMachine);
    _actor.start();
  }
  return _actor;
}

// In React: pass this actor to the provider instead of creating a new one
export { navigationMachine } from "./navigationMachine";
```

### Pattern 4: Extensibility -- Adding a New Blade Type

**What:** The complete checklist for adding a blade type after the FSM refactoring.
**When to use:** Every time a new blade type is introduced.

Steps after FSM refactoring (single-directory operation where possible):

1. **Add to `BladePropsMap`** in `src/stores/bladeTypes.ts` (one line)
2. **Create component** in `src/components/blades/YourBlade.tsx`
3. **Create registration** in `src/components/blades/registrations/your-type.ts` (calls `registerBlade()`)
4. **If file-type-based:** add mapping in `src/lib/fileDispatch.ts`

Steps that are **NOT** needed (improvement over current):
- No need to edit the FSM machine (transitions are generic over `BladeType`)
- No need to update singleton lists (move to registration metadata)
- No need to edit the dev exhaustiveness check (already auto-discovered)

**Key extensibility improvement -- move singleton policy to registration:**

```typescript
// Enhanced BladeRegistration interface
export interface BladeRegistration<TProps = Record<string, never>> {
  type: BladeType;
  defaultTitle: string | ((props: TProps) => string);
  component: ComponentType<TProps> | LazyExoticComponent<ComponentType<TProps>>;
  lazy?: boolean;
  wrapInPanel?: boolean;
  showBack?: boolean;
  renderTitleContent?: (props: TProps) => ReactNode;
  renderTrailing?: (props: TProps, ctx: BladeRenderContext) => ReactNode;
  /** If true, only one instance can exist in the blade stack */
  singleton?: boolean;           // NEW
  /** Category for the FSM guards */
  category?: "root" | "detail" | "viewer" | "utility";  // NEW
}
```

Then the FSM guard reads from the registry:
```typescript
isNotDuplicate: ({ context, event }) => {
  if (event.type !== "PUSH_BLADE") return true;
  const reg = getBladeRegistration(event.bladeType);
  if (!reg?.singleton) return true;
  return !context.bladeStack.some((b) => b.type === event.bladeType);
},
```

### Anti-Patterns to Avoid

- **Direct store mutation from components:** After FSM migration, no component should call `useBladeStore().pushBlade()` directly. All navigation must go through events.
- **Putting blade component logic in the machine:** The machine manages navigation state, not blade UI state. Blade-specific state (scroll position, form values) stays in component state or dedicated stores.
- **Over-modeling with substates:** Start with a flat `idle` state. Only add `confirmingNavigation` when dirty-form tracking is actually implemented.
- **Coupling animation to FSM states:** Animation direction (`transitionDirection` in context) is a derived value that BladeContainer reads. Don't make animation states in the FSM.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine logic | Custom guard/transition system | XState v5 `setup()` | Formal verification, visual debugging, ecosystem tooling |
| React re-render optimization | Manual subscription management | `useSelector` from `@xstate/react` | Handles comparison, unsubscription, concurrent mode |
| Form dirty tracking | Custom event system | XState context + guard composition | Guards are declarative and testable in isolation |
| Animation orchestration | Custom animation state | framer-motion `AnimatePresence` + FSM `transitionDirection` | Already working in BladeContainer |

**Key insight:** The existing Zustand blade store is essentially a hand-rolled FSM without guards. XState gives us the guards, observability, and formal transition rules for free.

## Common Pitfalls

### Pitfall 1: Full Re-renders from Context Changes
**What goes wrong:** Using `useMachine()` causes the component to re-render on every state transition, even if the component only cares about `bladeStack`.
**Why it happens:** `useMachine()` returns the full snapshot, triggering re-renders on any context change.
**How to avoid:** Use `useActorRef()` to get a stable ref, then `useSelector()` to subscribe to specific slices. Define selectors outside components.
**Warning signs:** Excessive re-renders in React DevTools when navigating between blades.

### Pitfall 2: Zustand/XState State Synchronization
**What goes wrong:** During migration, some components read from Zustand while others read from XState, causing stale data.
**Why it happens:** Partial migration where both systems own blade state.
**How to avoid:** In the migration phase, make Zustand a read-only mirror of XState context. The XState machine is the single source of truth. Zustand store subscribes to the actor and syncs.
**Warning signs:** Blade stack appears different in different components.

### Pitfall 3: Non-React Code Losing Actor Reference
**What goes wrong:** `bladeOpener.ts` and command palette actions can't send events because they don't have React context.
**Why it happens:** Actor is created inside React via `useActorRef`, but imperative code runs outside.
**How to avoid:** Use a singleton actor pattern (create once, share via module export). Pass the same actor to the React provider.
**Warning signs:** `openBlade()` calls from keyboard shortcuts silently fail.

### Pitfall 4: Event Type Narrowing in Actions
**What goes wrong:** TypeScript complains about event properties inside `assign()` actions because event type is a union.
**Why it happens:** XState v5 passes the full event union to every action.
**How to avoid:** Use conditional checks (`if (event.type !== "PUSH_BLADE") return {}`) or define actions inline on specific transitions rather than in `setup()`.
**Warning signs:** TypeScript errors like "Property 'bladeType' does not exist on type 'NavigationEvent'".

### Pitfall 5: Duplicate SINGLETON_TYPES Arrays
**What goes wrong:** The `SINGLETON_TYPES` array exists in both `bladeOpener.ts` and `useBladeNavigation.ts`. Adding a new singleton blade requires updating both.
**Why it happens:** Historical duplication before the registry pattern was added.
**How to avoid:** Move singleton designation to the blade registration (`singleton: true` flag) and have the FSM guard read from the registry.
**Warning signs:** A singleton blade opens twice because one callsite wasn't updated.

## Code Examples

### Machine Testing (Pure, No React)

```typescript
// Based on existing pattern in src/lib/xstate-example.test.ts
import { createActor } from "xstate";
import { navigationMachine } from "./navigationMachine";

describe("navigationMachine", () => {
  it("blocks POP_BLADE when only root blade exists", () => {
    const actor = createActor(navigationMachine);
    actor.start();

    actor.send({ type: "POP_BLADE" });
    expect(actor.getSnapshot().context.bladeStack).toHaveLength(1);

    actor.stop();
  });

  it("enforces singleton guard", () => {
    const actor = createActor(navigationMachine);
    actor.start();

    actor.send({ type: "PUSH_BLADE", bladeType: "settings", title: "Settings", props: {} });
    actor.send({ type: "PUSH_BLADE", bladeType: "settings", title: "Settings", props: {} });

    // Only one settings blade
    const settingsCount = actor.getSnapshot().context.bladeStack
      .filter(b => b.type === "settings").length;
    expect(settingsCount).toBe(1);

    actor.stop();
  });

  it("sets transitionDirection on push/pop", () => {
    const actor = createActor(navigationMachine);
    actor.start();

    actor.send({ type: "PUSH_BLADE", bladeType: "commit-details", title: "Commit", props: { oid: "abc" } });
    expect(actor.getSnapshot().context.transitionDirection).toBe("forward");

    actor.send({ type: "POP_BLADE" });
    expect(actor.getSnapshot().context.transitionDirection).toBe("backward");

    actor.stop();
  });
});
```

### React Component Integration

```typescript
// Migrated BladeContainer.tsx
import { AnimatePresence, motion } from "framer-motion";
import { useNavigationMachine } from "../../hooks/useNavigationMachine";
import { BladeRenderer } from "./BladeRenderer";
import { BladeStrip } from "./BladeStrip";
import { bladeSlideIn } from "../../lib/animations";

export function BladeContainer() {
  const { bladeStack, popToIndex, popBlade, transitionDirection } = useNavigationMachine();
  const activeBlade = bladeStack[bladeStack.length - 1];

  // Derive animation direction from FSM context
  const slideVariants = {
    forward: { initial: { x: 40, opacity: 0 }, exit: { x: -40, opacity: 0 } },
    backward: { initial: { x: -40, opacity: 0 }, exit: { x: 40, opacity: 0 } },
    none: { initial: { opacity: 0 }, exit: { opacity: 0 } },
  };

  const direction = slideVariants[transitionDirection] || slideVariants.forward;

  return (
    <div className="flex h-full overflow-hidden">
      <div aria-live="polite" className="sr-only">{activeBlade.title}</div>
      {bladeStack.slice(0, -1).map((blade, index) => (
        <BladeStrip key={blade.id} title={blade.title} onExpand={() => popToIndex(index)} />
      ))}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeBlade.id}
          initial={direction.initial}
          animate={{ x: 0, opacity: 1 }}
          exit={direction.exit}
          transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
          className="flex-1 min-w-0"
        >
          <BladeRenderer blade={activeBlade} goBack={popBlade} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

## Performance Considerations

### XState Bundle Impact
- `xstate@5.26.0`: Already installed. Tree-shakeable. Core functions (`setup`, `assign`, `createActor`) are ~15KB gzipped.
- `@xstate/react@6.0.0`: Already installed. ~3KB gzipped.
- **Net new bundle cost: 0 bytes** (already in dependency tree).

### Re-render Analysis

| Approach | Re-renders per Navigation |
|----------|---------------------------|
| Current (Zustand `useBladeStore()`) | Every component that calls `useBladeStore()` re-renders on any store change |
| `useMachine()` (BAD) | Every component using the hook re-renders on any context change |
| `useActorRef()` + `useSelector()` (RECOMMENDED) | Only components whose selected slice changed re-render |

**Specific selectors to define:**
- `selectBladeStack` -- BladeContainer, BladeStrip
- `selectActiveBlade` -- BladeRenderer (derived: `stack[stack.length - 1]`)
- `selectActiveProcess` -- ProcessNavigation
- `selectTransitionDirection` -- BladeContainer (animation)
- `selectStackLength` -- keyboard shortcuts (for `length > 1` check)

### Memory
- One actor instance (singleton), lives for app lifetime
- Context holds `bladeStack` array (typically 1-5 items) -- negligible
- No event history stored (XState v5 actors don't retain history by default)

## Package/Bundling Analysis

| Package | Status | Disk Size | Gzipped | Vite Compatible |
|---------|--------|-----------|---------|-----------------|
| xstate@5.26.0 | Already installed | 2.5MB (full) | ~15KB (tree-shaken) | Yes, ESM native |
| @xstate/react@6.0.0 | Already installed | 88KB (full) | ~3KB (tree-shaken) | Yes, ESM native |

**Vite/Tauri concerns:** None. XState is pure JavaScript with no native dependencies. It works in any JS runtime. No special Vite plugins needed. The existing `vite.config.ts` requires no changes.

**No `optimizeDeps.include` needed** (unlike `dagre-d3-es` which is explicitly included) -- XState already ships proper ESM.

## Migration Strategy

### Phase 1: Create Machine + Provider (No Consumer Changes)
1. Create `src/machines/navigation/` directory with machine, guards, actions, types
2. Create `NavigationProvider` component
3. Wire provider into App component
4. Write comprehensive machine tests
5. **Zustand store remains fully functional** -- zero consumer impact

### Phase 2: Create Compatibility Bridge
1. Make `useBladeStore` a thin wrapper that reads from XState actor and sends events
2. All existing consumers work without changes
3. Verify all existing tests pass

### Phase 3: Migrate Consumers (File-by-File)
1. Start with `useBladeNavigation.ts` (highest impact, central abstraction)
2. Then `BladeContainer.tsx` (rendering)
3. Then individual components (RepoBrowserBlade, BladeBreadcrumb, etc.)
4. Then `bladeOpener.ts` (non-React bridge)
5. Then keyboard shortcuts

### Phase 4: Extensibility Refactoring
1. Add `singleton` and `category` fields to `BladeRegistration`
2. Move singleton list from code to registration metadata
3. Update dev-mode exhaustiveness check
4. Document the "add a new blade type" workflow

### Phase 5: Dirty-Form Guard (Future)
1. Add `dirtyForms: Set<string>` to machine context
2. Add `MARK_DIRTY` / `MARK_CLEAN` events
3. Add `confirmingNavigation` state with dialog
4. Wire commit form to send dirty/clean events

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Consumer migration breaks existing behavior | MEDIUM | HIGH | Compatibility bridge (Phase 2) ensures zero-breakage migration |
| Performance regression from XState overhead | LOW | MEDIUM | useSelector pattern is more precise than current Zustand; likely improves perf |
| Non-React callsites can't access actor | MEDIUM | HIGH | Singleton actor pattern with module-level export |
| XState v5 breaking changes | LOW | LOW | Already on v5.26.0 (stable); pinned in package.json |
| Dirty-form guard complexity | MEDIUM | MEDIUM | Defer to Phase 5; MVP FSM works without it |
| Developer learning curve (XState unfamiliarity) | MEDIUM | LOW | Machine is one file; consumers use a familiar hook API |
| Zustand/XState state split confusion during migration | MEDIUM | MEDIUM | Clear migration phases; bridge ensures single source of truth |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| XState v4 `Machine()` | XState v5 `setup().createMachine()` | v5.0.0 (Dec 2023) | `setup()` provides type-safe actions/guards; `Machine` is removed |
| `useMachine()` for React | `useActorRef()` + `useSelector()` | @xstate/react v4+ | Eliminates unnecessary re-renders |
| `interpret()` for actors | `createActor()` | v5.0.0 (Dec 2023) | `interpret` removed in v5 |
| `context` as static value | `context` can be a function | v5.0.0 | Allows dynamic initial context |

**Deprecated/outdated:**
- `Machine()` function: Replaced by `setup().createMachine()` in v5
- `interpret()`: Replaced by `createActor()` in v5
- `@xstate/react` `useMachine` internals: Now an alias for `useActor`; prefer `useActorRef + useSelector` for perf

## Open Questions

1. **Should the Zustand blade store be fully removed or kept as a compatibility layer?**
   - What we know: 33 references across 12 files. A bridge pattern avoids a big-bang migration.
   - What's unclear: Whether the compatibility bridge should be permanent or temporary.
   - Recommendation: Temporary. Phase 3 migrates all consumers, then the bridge can be removed. Keep `bladeTypes.ts` permanently (it's just types).

2. **Should the FSM handle the "file dispatch" logic (determining blade type from file extension)?**
   - What we know: `fileDispatch.ts` maps extensions to blade types. It's called in `useBladeNavigation.ts` and `RepoBrowserBlade.tsx`.
   - What's unclear: Whether this belongs in the FSM or stays as a utility.
   - Recommendation: Keep `fileDispatch.ts` as a utility. The FSM should be agnostic to how blade types are determined -- it just receives `PUSH_BLADE` events with a type already resolved.

3. **How to handle the `popToIndex + replaceBlade` atomic operation in BladeBreadcrumb?**
   - What we know: `BladeBreadcrumb.tsx` calls `store.popToIndex(i)` then `store.replaceBlade(...)` sequentially. In Zustand this works because both are synchronous mutations.
   - What's unclear: In XState, two sequential `send()` calls are processed synchronously in the same microtask, so this should work. But a single `NAVIGATE_TO_PATH` event would be cleaner.
   - Recommendation: Add a `NAVIGATE_BREADCRUMB` compound event that atomically pops to index and replaces, keeping the FSM in a consistent state.

4. **Should the FSM manage the `CommitForm` dirty state?**
   - What we know: The commit form uses local `useState` for the message. There's no global dirty tracking.
   - What's unclear: Whether to move commit form state into XState context or keep it local with a guard callback.
   - Recommendation: Keep commit form state local. Add a `registerDirtyForm(id)` / `unregisterDirtyForm(id)` API that the form calls. The FSM guard checks if any forms are registered. This keeps form state decoupled from navigation state.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/stately_ai` -- XState v5 `setup()`, guards, actions, `useActorRef`, `useSelector` documentation
- Codebase analysis: Direct reading of 30+ source files in `/Users/phmatray/Repositories/github-phm/FlowForge/src/`
- `package.json` -- Confirmed xstate@5.26.0 and @xstate/react@6.0.0 already installed
- `node_modules/xstate/package.json` -- Confirmed actual installed version 5.26.0

### Secondary (MEDIUM confidence)
- XState v5 migration patterns from Context7 official docs
- Framer-motion + XState integration patterns (derived from existing codebase patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- XState is already installed and a PoC test exists
- Architecture: HIGH -- Thorough codebase analysis with exact file paths and callsite counts
- Pitfalls: HIGH -- Based on Context7 docs and known React performance patterns
- Migration strategy: MEDIUM -- Phased approach is sound but exact migration effort depends on edge cases in BladeBreadcrumb and RepoBrowserBlade
- Extensibility: HIGH -- Clear path from current registry pattern to enhanced registration with FSM guards

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days -- XState v5 is stable)
