# Phase 30: Store Consolidation & Tech Debt - Architecture Research

**Researched:** 2026-02-09
**Domain:** Zustand store consolidation, domain-driven state architecture, dead code elimination
**Confidence:** HIGH (verified via Context7, codebase analysis, official Zustand docs)
**Role:** Technical Architect

## Summary

FlowForge currently has **21 shared Zustand stores** in `src/stores/` plus **2 blade-local stores** (`init-repo/store.ts`, `changelog/store.ts`), totaling 23 store files. All use Zustand v5 with `create()`. The project also uses XState v5 for navigation FSM and @tanstack/react-query v5 for server state. The stores share common patterns (isLoading/error/clearError, async actions wrapping Tauri commands) but are completely independent singletons with no reset coordination.

The primary architectural challenge is consolidating 21+ stores into ~5 domain-grouped stores using Zustand's official **slices pattern** while preserving: (a) selective re-render optimization, (b) middleware compatibility (devtools), (c) a robust reset mechanism for `closeRepository()`, and (d) extensibility for future blades. The XState navigation FSM already handles blade stack state correctly -- the consolidation must not duplicate that responsibility but must coordinate resets with it.

**Primary recommendation:** Use Zustand's **slices pattern** with `StateCreator` generics to compose domain stores. Implement a **store registry with `resetAllStores()`** pattern from official docs. Keep blade-local stores (changelog, init-repo, conventional) as independent stores that self-register for reset. Do NOT merge everything into one mega-store -- 5 domain stores is the right granularity.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5 (v5.0.x) | Client state management | Already in use, slices pattern is official |
| xstate | ^5.26.0 | Navigation FSM | Already in use, manages blade stack |
| @tanstack/react-query | ^5 | Server state (async data) | Already in use for staging/commit queries |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand/middleware (devtools) | ^5 | Redux DevTools integration | Applied at consolidated store level |
| @tauri-apps/plugin-store | existing | Persistent key-value storage | Settings, preferences, navigation state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Slices pattern | Jotai atoms | Would require full rewrite; Zustand slices is incremental migration |
| Manual reset registry | zustand-reset middleware | Third-party, not well-maintained, slices-incompatible |
| Single mega-store | Multiple domain stores | Single store causes unnecessary re-renders, harder to reason about |

## Architecture Patterns

### Current Store Inventory & Proposed Domain Grouping

#### Current 21 Shared Stores (in `src/stores/`)

| # | Store | State Shape | Persistence | Dependencies | Proposed Domain |
|---|-------|-------------|-------------|--------------|-----------------|
| 1 | `repository` | status, isLoading, error | None | commands | **GitOps** |
| 2 | `branches` | branches[], allBranches[], mergeResult | None | commands | **GitOps** |
| 3 | `tags` | tags[] | None | commands | **GitOps** |
| 4 | `stash` | stashes[] | None | commands | **GitOps** |
| 5 | `worktrees` | worktrees[] | None | commands, repository | **GitOps** |
| 6 | `gitflow` | status, flow actions | None | commands, branches, repository | **GitOps** |
| 7 | `undo` | undoInfo | None | commands | **GitOps** |
| 8 | `topology` | nodes[], edges[], pagination | None | commands | **GitOps** |
| 9 | `staging` | selectedFile, viewMode, scroll | None | None | **UI State** |
| 10 | `blades` | activeProcess, bladeStack (DEPRECATED) | None | None | **REMOVE** (migrated to XState) |
| 11 | `bladeTypes` | Type definitions only | N/A | N/A | **Keep as types** |
| 12 | `commandPalette` | isOpen, query, selectedIndex | None | None | **UI State** |
| 13 | `clone` | isCloning, progress, error | None | None | **UI State** |
| 14 | `conventional` | form state, suggestions, validation | None | commands | **Blade-local** (move to blade dir) |
| 15 | `navigation` | dropdowns, pinned repos, recent branches | Tauri store | getStore() | **Preferences** |
| 16 | `branchMetadata` | pinned branches, recent, scope pref | Tauri store | getStore() | **Preferences** |
| 17 | `settings` | general, git, integrations | Tauri store | getStore() | **Preferences** |
| 18 | `theme` | theme, resolvedTheme | Tauri store + localStorage | getStore() | **Preferences** |
| 19 | `reviewChecklist` | customItems per flow type | Tauri store | getStore() | **Preferences** |
| 20 | `toast` | toasts[] | None | None | **Infrastructure** |
| 21 | `blades.test.ts` | Test file | N/A | N/A | N/A |

#### 2 Blade-Local Stores
| Store | Location | Proposed |
|-------|----------|----------|
| `init-repo/store.ts` | `src/blades/init-repo/` | Keep as blade-local, register for reset |
| `changelog/store.ts` | `src/blades/changelog/` | Keep as blade-local, register for reset |

### Proposed 5 Domain Stores

```
src/stores/
  git-ops.ts          # repository + branches + tags + stash + worktrees + gitflow + undo + topology
  ui-state.ts         # staging + commandPalette + clone
  preferences.ts      # navigation + branchMetadata + settings + theme + reviewChecklist
  toast.ts            # toast (kept separate - infrastructure, no reset needed)
  index.ts            # re-exports + resetAllStores()

src/blades/
  conventional-commit/store.ts  # Move from src/stores/conventional.ts
  changelog/store.ts            # Already blade-local
  init-repo/store.ts            # Already blade-local
```

**Rationale for each domain:**

1. **GitOps Store** (~8 slices): All git data that loads from Tauri commands and resets when repository closes. These stores share the `isLoading/error/clearError` pattern and all call `commands.*`. They naturally group because gitflow already cross-references branches and repository.

2. **UI State Store** (~3 slices): Ephemeral UI state that resets when repository closes. No persistence, no Tauri commands -- purely client-side view state.

3. **Preferences Store** (~5 slices): Persisted via Tauri plugin-store. Does NOT reset on closeRepository (user preferences survive across repos). Has `init*()` methods that load from disk.

4. **Toast Store** (standalone): Infrastructure concern. Should NOT reset on closeRepository. Stays independent because it is imported by non-React code (command registry, XState machine).

5. **Blade-Local Stores** (independent): `conventional`, `changelog`, `init-repo` -- each resets when its blade unmounts. Self-register for global reset via registry.

### Pattern 1: Slices Pattern with TypeScript (Official Zustand v5)

**What:** Each domain store is composed from typed slice creators using `StateCreator` generics.
**When to use:** Consolidating multiple stores into one while maintaining code organization.
**Confidence:** HIGH (Context7-verified, official Zustand docs)

```typescript
// Source: Context7 /pmndrs/zustand - slices pattern + devtools
import { create, type StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

// -- Slice Types --
interface RepositorySlice {
  repoStatus: RepoStatus | null;
  repoIsLoading: boolean;
  repoError: string | null;
  openRepository: (path: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  closeRepository: () => Promise<void>;
  clearRepoError: () => void;
}

interface BranchSlice {
  branches: BranchInfo[];
  allBranches: BranchInfo[];
  branchIsLoading: boolean;
  branchError: string | null;
  loadBranches: () => Promise<void>;
  // ... more actions
}

// -- Full Store Type --
type GitOpsStore = RepositorySlice & BranchSlice & TagSlice & StashSlice
  & WorktreeSlice & GitflowSlice & UndoSlice & TopologySlice;

// -- Slice Creators --
const createRepositorySlice: StateCreator<
  GitOpsStore,
  [["zustand/devtools", never]],
  [],
  RepositorySlice
> = (set, get) => ({
  repoStatus: null,
  repoIsLoading: false,
  repoError: null,

  openRepository: async (path) => {
    set({ repoIsLoading: true, repoError: null }, undefined, "gitOps:repo/open");
    try {
      const result = await commands.openRepository(path);
      if (result.status === "ok") {
        set({ repoStatus: result.data, repoIsLoading: false }, undefined, "gitOps:repo/openSuccess");
      } else {
        const msg = getErrorMessage(result.error);
        set({ repoError: msg, repoIsLoading: false, repoStatus: null }, undefined, "gitOps:repo/openFailed");
        throw new Error(msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!get().repoError) {
        set({ repoError: msg, repoIsLoading: false, repoStatus: null });
      }
      throw e;
    }
  },

  refreshStatus: async () => { /* ... */ },
  closeRepository: async () => { /* ... */ },
  clearRepoError: () => set({ repoError: null }),
});

const createBranchSlice: StateCreator<
  GitOpsStore,
  [["zustand/devtools", never]],
  [],
  BranchSlice
> = (set, get) => ({
  branches: [],
  allBranches: [],
  branchIsLoading: false,
  branchError: null,
  loadBranches: async () => {
    set({ branchIsLoading: true, branchError: null }, undefined, "gitOps:branch/load");
    const result = await commands.listBranches();
    if (result.status === "ok") {
      set({ branches: result.data, branchIsLoading: false }, undefined, "gitOps:branch/loadSuccess");
    } else {
      set({ branchError: getErrorMessage(result.error), branchIsLoading: false });
    }
  },
});

// -- Compose Store --
export const useGitOpsStore = create<GitOpsStore>()(
  devtools(
    (...args) => ({
      ...createRepositorySlice(...args),
      ...createBranchSlice(...args),
      ...createTagSlice(...args),
      ...createStashSlice(...args),
      ...createWorktreeSlice(...args),
      ...createGitflowSlice(...args),
      ...createUndoSlice(...args),
      ...createTopologySlice(...args),
    }),
    { name: "git-ops", enabled: import.meta.env.DEV },
  ),
);
```

### Pattern 2: Store Reset Registry (Official Zustand Pattern)

**What:** A registry that tracks all stores and resets them atomically when `closeRepository()` is called.
**When to use:** Ensuring no stale state survives a repository switch.
**Confidence:** HIGH (Context7-verified, from official `how-to-reset-state` guide)

```typescript
// Source: Context7 /pmndrs/zustand - reset multiple stores at once
// src/stores/registry.ts

import { create as actualCreate, type StateCreator } from "zustand";

// Registry of reset functions
const storeResetFns = new Set<() => void>();

/**
 * Resets ALL registered stores to their initial state.
 * Called by closeRepository() and navigation FSM reset.
 */
export function resetAllStores(): void {
  storeResetFns.forEach((resetFn) => resetFn());
}

/**
 * Register a store for automatic reset.
 * Call this for any store that should clear on closeRepository().
 */
export function registerStoreForReset(store: { setState: Function; getInitialState: () => any }): void {
  storeResetFns.add(() => {
    store.setState(store.getInitialState(), true);
  });
}

/**
 * Factory: creates a Zustand store that auto-registers for reset.
 * Use for domain stores (gitOps, uiState) that must clear on repo close.
 *
 * NOTE: Do NOT use for preferences/toast -- those survive repo switches.
 */
export const createResettable = (<T>() => {
  return (stateCreator: StateCreator<T>) => {
    const store = actualCreate(stateCreator);
    storeResetFns.add(() => {
      store.setState(store.getInitialState(), true);
    });
    return store;
  };
}) as typeof actualCreate;
```

**Integration with closeRepository():**

```typescript
// In the repository slice of gitOpsStore:
closeRepository: async () => {
  try {
    await commands.closeRepository();
  } catch (e) {
    toast.error("Failed to close repository");
  }
  // 1. Reset ALL resettable stores (gitOps, uiState, blade-local)
  resetAllStores();
  // 2. Reset XState navigation FSM
  getNavigationActor().send({ type: "RESET_STACK" });
  // 3. Invalidate all TanStack queries
  queryClient.invalidateQueries();
},
```

### Pattern 3: Selective Subscriptions with Consolidated Stores

**What:** Using selectors to prevent unnecessary re-renders when stores are consolidated.
**When to use:** Always, with consolidated stores -- components should select only what they need.
**Confidence:** HIGH

```typescript
// CORRECT: Component subscribes to only the branch slice
function BranchList() {
  const branches = useGitOpsStore((s) => s.branches);
  const isLoading = useGitOpsStore((s) => s.branchIsLoading);
  // This component does NOT re-render when topology or stash changes
}

// ALSO CORRECT: Custom hook that creates a stable selector
function useBranches() {
  return useGitOpsStore(
    useShallow((s) => ({
      branches: s.branches,
      isLoading: s.branchIsLoading,
      error: s.branchError,
    })),
  );
}

// ANTI-PATTERN: Destructuring entire store causes re-render on ANY change
function BadComponent() {
  const store = useGitOpsStore(); // Re-renders on every state change!
}
```

### Pattern 4: Naming Convention for Consolidated Slices

**What:** Prefixed state keys to avoid collisions when merging slices.
**When to use:** When multiple slices have similar field names (isLoading, error).

**Problem:** 7 of 8 gitOps slices have `isLoading` and `error` fields. Flat merging causes collisions.

**Strategy:** Prefix with domain abbreviation:

```typescript
// Option A: Prefixed keys (recommended for gitOps - too many collisions)
interface BranchSlice {
  branchList: BranchInfo[];        // was: branches
  branchIsLoading: boolean;        // was: isLoading
  branchError: string | null;      // was: error
}

// Option B: Nested namespace (alternative - more complex selectors)
interface GitOpsStore {
  branch: { list: BranchInfo[]; isLoading: boolean; error: string | null };
  tag: { list: TagInfo[]; isLoading: boolean; error: string | null };
}
// Selector: useGitOpsStore(s => s.branch.isLoading)
```

**Recommendation:** Use **Option A (prefixed keys)** for the gitOps store. It is flatter, works better with Zustand devtools (each key visible at top level), and selectors are simpler. The 8-slice gitOps store has enough collision risk to warrant prefixes. The smaller uiState and preferences stores may not need prefixes.

### Pattern 5: Blade-Local Store Factory

**What:** A factory function for creating blade-scoped stores with auto-reset registration.
**When to use:** New blades that need local state.

```typescript
// src/stores/createBladeStore.ts
import { create, type StateCreator } from "zustand";
import { devtools } from "zustand/middleware";
import { registerStoreForReset } from "./registry";

/**
 * Create a blade-local store that auto-registers for global reset.
 * Blade stores are independent (not part of domain stores) because they
 * are feature-scoped and may be loaded lazily.
 */
export function createBladeStore<T>(
  name: string,
  stateCreator: StateCreator<T, [["zustand/devtools", never]]>,
) {
  const store = create<T>()(
    devtools(stateCreator, { name, enabled: import.meta.env.DEV }),
  );
  registerStoreForReset(store);
  return store;
}

// Usage in a blade:
// src/blades/changelog/store.ts
export const useChangelogStore = createBladeStore("changelog", (set, get) => ({
  fromRef: "",
  toRef: "HEAD",
  // ... rest of state
}));
```

### Recommended Project Structure

```
src/stores/
  domain/
    git-ops/
      index.ts               # Composed store + re-exports
      repository.slice.ts    # RepositorySlice
      branches.slice.ts      # BranchSlice
      tags.slice.ts          # TagSlice
      stash.slice.ts         # StashSlice
      worktrees.slice.ts     # WorktreeSlice
      gitflow.slice.ts       # GitflowSlice
      undo.slice.ts          # UndoSlice
      topology.slice.ts      # TopologySlice
    ui-state/
      index.ts               # Composed store
      staging.slice.ts       # StagingSlice
      command-palette.slice.ts
      clone.slice.ts
    preferences/
      index.ts               # Composed store
      navigation.slice.ts
      branch-metadata.slice.ts
      settings.slice.ts
      theme.slice.ts
      review-checklist.slice.ts
  toast.ts                   # Standalone (infrastructure)
  registry.ts                # Reset registry + createResettable
  createBladeStore.ts        # Factory for blade-local stores
  index.ts                   # Re-exports all domain stores
```

### Anti-Patterns to Avoid

- **Cross-store `getState()` calls inside slice creators:** The gitflow store currently calls `useBranchStore.getState().loadBranches()` and `useRepositoryStore.getState().refreshStatus()`. After consolidation into the same gitOps store, these become `get().loadBranches()` and `get().refreshStatus()` -- a natural improvement. Cross-domain calls (e.g., gitOps calling toast) should use the standalone `toast.*` helpers, not `useToastStore.getState()`.

- **Merging preferences into gitOps:** Preferences persist across repo switches. Mixing them with gitOps (which resets) creates partial-reset bugs. Keep them in separate stores.

- **Using `useShallow` everywhere:** Only use `useShallow` when selecting multiple fields as an object. Single primitive selectors (`s => s.branches`) do not need it -- Zustand v5 already uses `Object.is` for equality.

- **Circular slice dependencies:** If slice A's action needs to call slice B's action, use `get()` inside the action (they share the same store instance). Do NOT import the store inside its own slice file.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Store reset coordination | Manual reset in each store | `resetAllStores()` registry pattern | Official Zustand pattern; ensures new stores auto-participate |
| Slices composition | Custom merge utilities | `StateCreator` generics + spread | Official TypeScript-safe approach from Zustand docs |
| DevTools with slices | Per-slice devtools wrapping | Single `devtools()` wrapping all slices | Official recommendation; one DevTools connection per store |
| Persistent state | Custom localStorage sync | Tauri plugin-store (already used) | Already integrated; handles IPC correctly |
| Error toasts | Per-store toast logic | Centralized `toast.*` helpers | Already exists; prevents duplication |

**Key insight:** Zustand's slices pattern is the officially recommended way to compose stores. The TypeScript generics are complex (`StateCreator<FullStore, [middlewares], [], SliceType>`) but once set up, they provide full type safety across slices. Do not try to invent a different composition mechanism.

## Common Pitfalls

### Pitfall 1: Naming Collisions in Merged Slices
**What goes wrong:** Multiple slices define `isLoading`, `error`, `clearError`. Merging via spread means last-defined wins.
**Why it happens:** Each current store independently uses the same field names.
**How to avoid:** Prefix all slice state keys with a domain abbreviation: `branchIsLoading`, `tagError`, `stashClearError`. Actions can keep short names if unique across the store.
**Warning signs:** DevTools shows fewer state keys than expected after merge.

### Pitfall 2: Partial Reset on Repository Close
**What goes wrong:** Some stores reset, others retain stale data. User sees stale branches from previous repo.
**Why it happens:** `closeRepository()` only clears its own store. No coordination mechanism exists today.
**How to avoid:** Use the `resetAllStores()` registry. Every domain store (gitOps, uiState) and blade-local store self-registers. Preferences store does NOT register (intentional).
**Warning signs:** Opening repo B shows branches from repo A.

### Pitfall 3: Giant Re-Renders from Consolidated Store
**What goes wrong:** Component subscribes to `useGitOpsStore()` without a selector. Every topology node update triggers branch list re-render.
**Why it happens:** Without a selector, Zustand returns the entire store object, which changes on any mutation.
**How to avoid:** Always use a selector: `useGitOpsStore(s => s.branches)`. Add an ESLint rule or code review checklist item. Consider `eslint-plugin-zustand` if available.
**Warning signs:** Performance degradation after consolidation; React DevTools Profiler shows unnecessary renders.

### Pitfall 4: Middleware Type Inference with Slices
**What goes wrong:** TypeScript errors like "Type 'StateCreator<...>' is not assignable to parameter of type 'StateCreator<...>'" when adding devtools to a slices store.
**Why it happens:** Each slice's `StateCreator` must declare the middleware tuple in its generic: `[["zustand/devtools", never]]`.
**How to avoid:** Use the exact generic signature from official docs. Define a `type Middleware = [["zustand/devtools", never]]` alias and reuse it.
**Warning signs:** Red squiggles on slice spreads inside `devtools()`.

### Pitfall 5: Breaking Imports During Migration
**What goes wrong:** Hundreds of imports like `import { useBranchStore } from "../stores/branches"` break after consolidation.
**Why it happens:** Store files are renamed/removed.
**How to avoid:** Use a **re-export barrel** strategy. Keep `src/stores/branches.ts` as a re-export:
```typescript
// src/stores/branches.ts (migration shim)
export { useGitOpsStore as useBranchStore } from "./domain/git-ops";
// Or create a custom hook that selects the branch slice:
export function useBranchStore() {
  return useGitOpsStore(useShallow(s => ({
    branches: s.branchList,
    // ... map old names to new names
  })));
}
```
**Warning signs:** Hundreds of TypeScript errors after renaming files.

### Pitfall 6: Losing `getInitialState()` with Middleware
**What goes wrong:** `store.getInitialState()` returns undefined or wrong shape after wrapping with devtools.
**Why it happens:** Some middleware wrappers may not properly forward `getInitialState()`.
**How to avoid:** Verify after setup that `useGitOpsStore.getInitialState()` returns all slice initial states. Zustand v5 with devtools should work correctly, but test explicitly.
**Warning signs:** `resetAllStores()` sets state to undefined.

## Code Examples

### Example 1: Complete GitOps Store Composition

```typescript
// src/stores/domain/git-ops/index.ts
import { create, type StateCreator } from "zustand";
import { devtools } from "zustand/middleware";
import { registerStoreForReset } from "../../registry";
import { createRepositorySlice, type RepositorySlice } from "./repository.slice";
import { createBranchSlice, type BranchSlice } from "./branches.slice";
import { createTagSlice, type TagSlice } from "./tags.slice";
import { createStashSlice, type StashSlice } from "./stash.slice";
import { createWorktreeSlice, type WorktreeSlice } from "./worktrees.slice";
import { createGitflowSlice, type GitflowSlice } from "./gitflow.slice";
import { createUndoSlice, type UndoSlice } from "./undo.slice";
import { createTopologySlice, type TopologySlice } from "./topology.slice";

export type GitOpsStore = RepositorySlice & BranchSlice & TagSlice & StashSlice
  & WorktreeSlice & GitflowSlice & UndoSlice & TopologySlice;

// Middleware tuple type alias -- reuse across all slices
export type GitOpsMiddleware = [["zustand/devtools", never]];

export const useGitOpsStore = create<GitOpsStore>()(
  devtools(
    (...args) => ({
      ...createRepositorySlice(...args),
      ...createBranchSlice(...args),
      ...createTagSlice(...args),
      ...createStashSlice(...args),
      ...createWorktreeSlice(...args),
      ...createGitflowSlice(...args),
      ...createUndoSlice(...args),
      ...createTopologySlice(...args),
    }),
    { name: "git-ops", enabled: import.meta.env.DEV },
  ),
);

// Auto-register for global reset
registerStoreForReset(useGitOpsStore);
```

### Example 2: Slice File Template

```typescript
// src/stores/domain/git-ops/branches.slice.ts
import type { StateCreator } from "zustand";
import type { BranchInfo, MergeResult } from "../../../bindings";
import { commands } from "../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import type { GitOpsStore, GitOpsMiddleware } from "./index";

export interface BranchSlice {
  branchList: BranchInfo[];
  branchAllList: BranchInfo[];
  branchIsLoading: boolean;
  branchError: string | null;
  branchMergeInProgress: boolean;
  branchLastMergeResult: MergeResult | null;

  loadBranches: () => Promise<void>;
  loadAllBranches: (includeRemote: boolean) => Promise<void>;
  createBranch: (name: string, checkout: boolean) => Promise<BranchInfo | null>;
  checkoutBranch: (name: string) => Promise<boolean>;
  // ... more actions
  clearBranchError: () => void;
}

export const createBranchSlice: StateCreator<
  GitOpsStore,
  GitOpsMiddleware,
  [],
  BranchSlice
> = (set, get) => ({
  branchList: [],
  branchAllList: [],
  branchIsLoading: false,
  branchError: null,
  branchMergeInProgress: false,
  branchLastMergeResult: null,

  loadBranches: async () => {
    set({ branchIsLoading: true, branchError: null }, undefined, "gitOps:branch/load");
    const result = await commands.listBranches();
    if (result.status === "ok") {
      set({ branchList: result.data, branchIsLoading: false }, undefined, "gitOps:branch/loadOk");
    } else {
      set({ branchError: getErrorMessage(result.error), branchIsLoading: false });
    }
  },

  loadAllBranches: async (includeRemote) => {
    set({ branchIsLoading: true, branchError: null });
    const result = await commands.listAllBranches(includeRemote);
    if (result.status === "ok") {
      set({ branchAllList: result.data, branchIsLoading: false });
    } else {
      set({ branchError: getErrorMessage(result.error), branchIsLoading: false });
    }
  },

  createBranch: async (name, checkout) => {
    set({ branchIsLoading: true, branchError: null });
    const result = await commands.createBranch(name, checkout);
    if (result.status === "ok") {
      await get().loadBranches();  // Cross-slice call via get()
      return result.data;
    }
    set({ branchError: getErrorMessage(result.error), branchIsLoading: false });
    return null;
  },

  checkoutBranch: async (name) => {
    set({ branchIsLoading: true, branchError: null });
    const result = await commands.checkoutBranch(name);
    if (result.status === "ok") {
      await get().loadBranches();
      return true;
    }
    set({ branchError: getErrorMessage(result.error), branchIsLoading: false });
    return false;
  },

  clearBranchError: () => set({ branchError: null }),
});
```

### Example 3: Store Reset Integration

```typescript
// src/stores/registry.ts
const storeResetFns = new Set<() => void>();

export function resetAllStores(): void {
  storeResetFns.forEach((fn) => fn());
}

export function registerStoreForReset(
  store: { setState: (state: any, replace?: boolean) => void; getInitialState: () => any },
): void {
  storeResetFns.add(() => {
    store.setState(store.getInitialState(), true);
  });
}

// In closeRepository (gitOps repository slice):
closeRepository: async () => {
  try {
    await commands.closeRepository();
  } catch (e) {
    toast.error(`Failed to close repository: ${e instanceof Error ? e.message : String(e)}`);
  }
  // Reset all resettable stores atomically
  resetAllStores();
  // Reset XState navigation FSM
  getNavigationActor().send({ type: "RESET_STACK" });
},
```

### Example 4: Error-to-Toast Propagation Pattern

```typescript
// Replace console.error in stores with toast notifications.
// Before (current):
console.error("Failed to persist pinned repos:", e);

// After (recommended):
import { toast } from "../toast";

// For user-facing operations:
toast.error(`Failed to save pinned repos: ${e instanceof Error ? e.message : "Unknown error"}`);

// For background operations (don't spam user):
if (import.meta.env.DEV) console.warn("Failed to persist:", e);
// Only toast for operations the user explicitly triggered.
```

### Example 5: Migration Shim for Backward Compatibility

```typescript
// src/stores/branches.ts (migration shim - keep during transition)
// This file preserves the old import path while delegating to the new store.

import { useGitOpsStore } from "./domain/git-ops";
import { useShallow } from "zustand/shallow";

/**
 * @deprecated Import from `../stores/domain/git-ops` directly.
 * This shim exists for backward compatibility during Phase 30 migration.
 */
export function useBranchStore() {
  return useGitOpsStore(
    useShallow((s) => ({
      branches: s.branchList,
      allBranches: s.branchAllList,
      isLoading: s.branchIsLoading,
      error: s.branchError,
      mergeInProgress: s.branchMergeInProgress,
      lastMergeResult: s.branchLastMergeResult,
      loadBranches: s.loadBranches,
      loadAllBranches: s.loadAllBranches,
      createBranch: s.createBranch,
      checkoutBranch: s.checkoutBranch,
      checkoutRemoteBranch: s.checkoutRemoteBranch,
      deleteBranch: s.deleteBranch,
      mergeBranch: s.mergeBranch,
      abortMerge: s.abortMerge,
      clearError: s.clearBranchError,
      clearMergeResult: s.clearBranchMergeResult,
    })),
  );
}
```

## Store Reset Architecture

### Reset Scope Classification

| Store | Reset on closeRepository? | Reason |
|-------|--------------------------|--------|
| GitOps (all slices) | YES | Data belongs to the closed repo |
| UI State (staging, cmdPalette, clone) | YES | View state is repo-scoped |
| Preferences (settings, theme, nav, metadata, checklist) | NO | User prefs survive repo switches |
| Toast | NO | Toasts auto-dismiss; clearing is jarring |
| Blade-local (conventional, changelog, init-repo) | YES | Form data is repo-scoped |
| XState Navigation FSM | YES (via RESET_STACK event) | Blade stack must clear |
| TanStack Query cache | YES (via invalidateQueries) | Cached server data is repo-scoped |

### Reset Sequence (ordered)

1. Call `commands.closeRepository()` (Tauri backend cleanup)
2. Call `resetAllStores()` (atomically resets gitOps + uiState + blade stores)
3. Send `RESET_STACK` to XState navigation actor (clears blade stack)
4. Call `queryClient.invalidateQueries()` (clears TanStack cache)
5. Set `repoStatus: null` in gitOps (triggers WelcomeView render)

### Ensuring Future Stores Auto-Participate

The `registerStoreForReset()` function ensures any new store that calls it will automatically be included in `resetAllStores()`. The `createBladeStore()` factory auto-registers. This means:

- Adding a new blade store via `createBladeStore()`: automatically resets
- Adding a new domain slice to gitOps: automatically resets (gitOps is registered)
- Adding a new preferences slice: NOT reset (preferences store is NOT registered) -- correct behavior
- A developer who forgets to register: their store will retain stale data -- add a CI lint or doc check

## Dead Code Elimination

### Confirmed Orphaned Code

| Item | Location | Evidence | Safe to Remove? |
|------|----------|----------|-----------------|
| `AnimatedList` / `AnimatedListItem` | `src/components/animations/AnimatedList.tsx` | Zero imports outside its own file + barrel export | YES -- no consumers found |
| `FadeIn` | `src/components/animations/FadeIn.tsx` | Zero imports outside its own file + barrel export | YES -- no consumers found |
| `CollapsibleSidebar` | `src/components/layout/CollapsibleSidebar.tsx` | Zero imports outside its own file + barrel export | YES -- no consumers found |
| `viewer3d-test.html` | `public/debug/viewer3d-test.html` | Debug page, not referenced in app code | YES -- remove from public/ |
| `greet` mock | `src/test-utils/mocks/tauri-commands.ts:236` | Only in mock file; no actual `greet` command used | YES -- remove mock entry |
| `getMergeStatus` mock | `src/test-utils/mocks/tauri-commands.ts:324` | Only in mock file; no actual `getMergeStatus` command used | YES -- remove mock entry |
| `useBladeStore` (deprecated) | `src/stores/blades.ts` | Marked `@deprecated`, replaced by XState FSM | VERIFY -- check if any non-migrated consumers remain |
| `animations/index.ts` barrel | `src/components/animations/index.ts` | Exports orphaned components | YES -- remove if components removed |
| `layout/index.ts` barrel | `src/components/layout/index.ts` | May export CollapsibleSidebar | VERIFY -- check other layout exports |

### Verification Steps Before Removal

1. **Static analysis:** `grep -r "AnimatedList\|FadeIn\|CollapsibleSidebar" src/ --include="*.tsx" --include="*.ts"` -- confirm zero imports
2. **Dynamic imports check:** Search for `import()` or `React.lazy()` referencing these components
3. **Bundle analysis:** Run `npx vite-bundle-visualizer` before and after removal to confirm size reduction
4. **Test suite:** Run full test suite after removal to catch indirect dependencies

### `useBladeStore` Deprecation Path

The legacy `useBladeStore` in `src/stores/blades.ts` is marked `@deprecated` with migration notes pointing to XState FSM. Current consumers (found via grep):

- `src/stores/blades.test.ts` -- test file for the deprecated store itself
- No other `.tsx` or `.ts` files import it besides tests

**Recommendation:** Remove `src/stores/blades.ts` and its test file. The XState navigation machine fully replaces it. The `bladeTypes.ts` file should be kept (it defines `BladePropsMap` and `TypedBlade`) but moved to `src/machines/navigation/types.ts` if not already re-exported there.

## Error Propagation Architecture

### Current State: 28 `console.error()` Calls in Stores

Every store swallows errors with `console.error()`. Users never see these failures. This is the inventory:

| Store | console.error count | User-triggered? |
|-------|-------------------|-----------------|
| `conventional` | 5 | Mixed (some auto-fetch, some user action) |
| `branchMetadata` | 5 | Yes (pin/unpin/visit) |
| `navigation` | 5 | Yes (pin/unpin repos) |
| `reviewChecklist` | 3 | Yes (update/reset) |
| `settings` | 2 | Yes (update setting) |
| `theme` | 2 | Yes (change theme) |
| `undo` | 2 | Mixed |
| `repository` | 2 | Yes (refresh, close) |

### Recommended Error Strategy

**Tier 1 -- User-triggered operations (toast.error):**
Errors from actions the user explicitly triggered (checkout branch, save stash, update setting, pin repo). These MUST surface as toast notifications.

```typescript
// In a slice action:
checkoutBranch: async (name) => {
  set({ branchIsLoading: true, branchError: null });
  const result = await commands.checkoutBranch(name);
  if (result.status === "ok") {
    await get().loadBranches();
    return true;
  }
  const msg = getErrorMessage(result.error);
  set({ branchError: msg, branchIsLoading: false });
  toast.error(`Failed to checkout branch: ${msg}`);
  return false;
},
```

**Tier 2 -- Background operations (DEV console only):**
Errors from auto-refresh, auto-fetch, or background sync. These should NOT spam the user but should log in development.

```typescript
// In a background action:
refreshStatus: async () => {
  try {
    const result = await commands.getRepositoryStatus();
    if (result.status === "ok") {
      set({ repoStatus: result.data });
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("Background refresh failed:", e);
    // No toast -- this was not user-triggered
  }
},
```

**Tier 3 -- Persistence failures (toast.warning):**
Errors saving to Tauri plugin-store. The operation succeeded in memory but failed to persist. Use `toast.warning` (not error) since the app still works.

```typescript
// In a persistence action:
try {
  const store = await getStore();
  await store.set("settings", newSettings);
  await store.save();
} catch (e) {
  toast.warning("Settings saved temporarily but failed to persist to disk");
}
set({ settings: newSettings }); // Still update in-memory state
```

## Migration Strategy

### Phase 30 Task Ordering (Recommended)

1. **Create store registry** (`registry.ts`, `createBladeStore.ts`) -- foundation, no breaking changes
2. **Create domain store shells** (empty `git-ops/index.ts`, `ui-state/index.ts`, `preferences/index.ts`) with slice type stubs
3. **Migrate one slice at a time** (start with `tags` -- smallest, no cross-dependencies):
   a. Create `tags.slice.ts` with prefixed keys
   b. Wire it into `git-ops/index.ts`
   c. Create migration shim in `src/stores/tags.ts`
   d. Verify all consumers still work
   e. Update consumers to use new import (optional, can defer)
4. **Migrate remaining gitOps slices** in dependency order: repository -> branches -> stash -> worktrees -> topology -> undo -> gitflow (last, it depends on branches + repository)
5. **Migrate uiState slices**: staging, commandPalette, clone
6. **Migrate preferences slices**: settings, theme, navigation, branchMetadata, reviewChecklist
7. **Wire closeRepository reset**: integrate `resetAllStores()` + XState reset + TanStack invalidation
8. **Move conventional store** to blade-local, use `createBladeStore()`
9. **Remove deprecated code**: `useBladeStore`, orphaned components, `viewer3d-test.html`, stale mocks
10. **Replace console.error with toast** (tier 1/2/3 classification)
11. **Remove migration shims** (update all imports to point to domain stores)

### Risk Mitigation

- **Migration shims** prevent big-bang import changes. Each store can be migrated independently.
- **Run tests after each slice migration** to catch regressions immediately.
- **Keep old store files as re-export shims** until all consumers are updated.
- **DevTools naming** (`gitOps:branch/load`) makes it easy to trace which slice triggered a state change.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Many small stores | Slices pattern (domain stores) | Zustand v4+ (stable in v5) | Better organization, middleware sharing |
| `create((set) => ...)` | `create<T>()(devtools(...))` | Zustand v4 | TypeScript inference for middleware |
| Manual reset per store | `store.getInitialState()` + registry | Zustand v4.4+ | Reliable, official reset mechanism |
| `useStore()` (full state) | `useStore(selector)` + `useShallow` | Zustand v5 | Required for perf with larger stores |
| `shallow` import from zustand | `useShallow` from `zustand/shallow` | Zustand v5 | Hook-based API replaces standalone function |

**Deprecated/outdated in Zustand v5:**
- `shallow` comparator (use `useShallow` hook instead)
- `create` without `()()` double-call (required for middleware TypeScript inference)
- `combine()` middleware (replaced by slices pattern for better types)

## Open Questions

1. **Should gitflow remain in gitOps or become its own store?**
   - What we know: Gitflow has heavy cross-dependencies (calls branches + repository). Consolidating removes `getState()` anti-pattern.
   - What's unclear: GitOps store with 8 slices is large. Gitflow could be a 6th standalone store.
   - Recommendation: Keep in gitOps. The cross-slice `get()` calls justify co-location. 8 slices is manageable with the file-per-slice structure.

2. **Should `conventional` store become blade-local or stay shared?**
   - What we know: It is only used by the conventional-commit blade. It has no cross-store dependencies.
   - What's unclear: Other blades might want to reference commit types.
   - Recommendation: Move to blade-local. Export only the type constants (`COMMIT_TYPES`, `COMMIT_TYPE_LABELS`) from a shared location.

3. **Naming prefix depth for gitOps slices?**
   - What we know: Need prefixes to avoid collisions across 8 slices.
   - What's unclear: How verbose? `branchIsLoading` vs `branchLoading` vs `isBranchLoading`?
   - Recommendation: Use `{domain}{Property}` pattern: `branchIsLoading`, `tagError`, `stashList`. Keep it consistent.

4. **Query client access in store reset?**
   - What we know: `queryClient.invalidateQueries()` must be called on close. Currently accessed via React context.
   - What's unclear: How to access `queryClient` from the store (non-React context)?
   - Recommendation: Accept `queryClient` as a parameter to `closeRepository()`, or store a reference at app init (similar to `getNavigationActor()` pattern).

## Sources

### Primary (HIGH confidence)
- Context7 `/pmndrs/zustand` (v5.0.8) -- Slices pattern, TypeScript generics, devtools middleware, reset state guide
- Context7 `/websites/zustand_pmnd_rs` -- Persist middleware with slices, devtools configuration
- Codebase analysis: All 23 store files read and analyzed

### Secondary (MEDIUM confidence)
- Zustand v5 migration notes (from Context7 docs) -- `useShallow` hook, `()()` pattern

### Tertiary (LOW confidence)
- None -- all findings verified via Context7 or direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Zustand v5 already in use, slices pattern is official
- Architecture: HIGH -- Verified via Context7, patterns match existing codebase style
- Pitfalls: HIGH -- Derived from actual codebase analysis (naming collisions, reset gaps)
- Dead code: HIGH -- Verified via grep (zero imports for orphaned components)
- Migration strategy: MEDIUM -- Strategy is sound but execution complexity is untested

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (Zustand v5 is stable; patterns unlikely to change)
