# Phase 30: Store Consolidation & Tech Debt - Implementation Research

**Researched:** 2026-02-09
**Domain:** Zustand store architecture, Tauri v2 command cleanup, dead code removal, Tailwind v4 UI components
**Confidence:** HIGH
**Researcher:** Expert Developer (Tauri, Rust, React, Tailwind v4)

## Summary

This phase addresses two interleaved concerns: (1) consolidating 21 individual Zustand stores into approximately 5 domain-grouped stores using the official slices pattern, and (2) resolving 9 accumulated tech debt items ranging from orphaned Rust commands to missing empty state UI.

The codebase is in good shape after Phase 29's blade-centric restructuring. Stores already follow consistent patterns (create with optional devtools, `commands` from bindings, `getErrorMessage` for error handling). The consolidation can leverage Zustand's documented `StateCreator` slices pattern with `devtools` middleware wrapping at the store level. The existing `__mocks__/zustand.ts` auto-reset mock is compatible with sliced stores since it intercepts `create()` regardless of internal structure.

**Primary recommendation:** Consolidate stores into 5 domain stores (`useGitStore`, `useUIStore`, `useWorkflowStore`, `usePreferencesStore`, `useSessionStore`) using Zustand's `StateCreator` slices pattern. Fix the `closeRepository` stale blade bug by adding `RESET_STACK` to the close handler. Remove orphaned code on both Rust and TS sides.

---

## 1. Current Store Inventory (21 stores)

### Store Files with Line Counts

| Store File | Lines | Domain | Has Persist? | Inter-store Deps |
|---|---|---|---|---|
| `conventional.ts` | 242 | Workflow | No | None (uses `commands`) |
| `gitflow.ts` | 154 | Workflow | No | `branches`, `repository` |
| `navigation.ts` | 146 | Preferences | Yes (Tauri Store) | None |
| `branchMetadata.ts` | 133 | Preferences | Yes (Tauri Store) | None |
| `branches.ts` | 130 | Git Ops | No | None (uses `commands`) |
| `topology.ts` | 104 | Git Ops | No | None (uses `commands`) |
| `blades.ts` | 104 | UI/Nav (DEPRECATED) | No | None |
| `reviewChecklist.ts` | 103 | Workflow/Prefs | Yes (Tauri Store) | None |
| `settings.ts` | 101 | Preferences | Yes (Tauri Store) | None |
| `worktrees.ts` | 84 | Git Ops | No | `repository` (lazy import) |
| `stash.ts` | 82 | Git Ops | No | None (uses `commands`) |
| `theme.ts` | 80 | Preferences | Yes (Tauri Store) | None |
| `toast.ts` | 77 | UI | No | None |
| `repository.ts` | 68 | Git Ops | No | None (uses `commands`) |
| `undo.ts` | 54 | Git Ops | No | None (uses `commands`) |
| `bladeTypes.ts` | 43 | Types only | N/A | None |
| `clone.ts` | 39 | Git Ops | No | None |
| `tags.ts` | 38 | Git Ops | No | None (uses `commands`) |
| `staging.ts` | 37 | UI State | No | None |
| `commandPalette.ts` | 29 | UI | No | None |

### Current Inter-Store Dependencies (Direct `getState()` calls)

```
gitflow.ts -> useBranchStore.getState().loadBranches()
gitflow.ts -> useRepositoryStore.getState().refreshStatus()
worktrees.ts -> useRepositoryStore.getState().openRepository() (lazy import)
Header.tsx -> getNavigationActor().send() (XState, not Zustand)
```

These cross-store calls via `getState()` will become internal slice calls after consolidation.

---

## 2. Proposed Domain Store Grouping

### Group 1: `useGitStore` (Git Operations)
**Slices:** repository, branches, tags, stash, topology, undo, worktrees, clone
**Current files:** repository.ts, branches.ts, tags.ts, stash.ts, topology.ts, undo.ts, worktrees.ts, clone.ts
**Total lines:** ~680
**Rationale:** All call Tauri `commands.*` for git operations. Gitflow cross-store deps (branch reload after feature/release) become internal calls.

### Group 2: `useWorkflowStore` (Git Workflow)
**Slices:** gitflow, conventional, reviewChecklist
**Current files:** gitflow.ts, conventional.ts, reviewChecklist.ts
**Total lines:** ~500
**Rationale:** Domain-adjacent to git but semantically about workflow automation. Gitflow needs branch/repo access via `get()` across the bound store OR continues using `useGitStore.getState()`.

**Design decision needed:** Should gitflow stay in `useGitStore` (simplifies its branch/repo access) or in `useWorkflowStore` (cleaner domain separation)?

**Recommendation:** Keep gitflow in `useGitStore` since every gitflow action calls branch reload and repo refresh. This makes the cross-slice access natural via `get()`.

### Group 3: `useUIStore` (Ephemeral UI State)
**Slices:** toast, commandPalette, staging (file selection + view mode)
**Current files:** toast.ts, commandPalette.ts, staging.ts
**Total lines:** ~140
**Rationale:** Pure ephemeral UI state, no persistence, no Tauri commands.

### Group 4: `usePreferencesStore` (Persisted User Preferences)
**Slices:** settings, theme, navigation (pinned repos, recent branches), branchMetadata
**Current files:** settings.ts, theme.ts, navigation.ts, branchMetadata.ts
**Total lines:** ~460
**Rationale:** All use Tauri `@tauri-apps/plugin-store` for persistence. Can share a single `getStore()` call pattern.

### Group 5: `useSessionStore` or kept as-is
**Note:** The `blades.ts` store is already deprecated in favor of the XState navigation machine. It should be removed, not consolidated.

### Final Count: ~4-5 stores (down from 21)

| New Store | Slices | Approx Lines |
|---|---|---|
| `useGitStore` | repository, branches, tags, stash, topology, undo, worktrees, clone, gitflow | ~830 |
| `useWorkflowStore` | conventional, reviewChecklist | ~345 |
| `useUIStore` | toast, commandPalette, staging | ~140 |
| `usePreferencesStore` | settings, theme, navigation, branchMetadata | ~460 |
| *(remove)* `useBladeStore` | deprecated, XState replaces it | -104 |

---

## 3. Zustand v5 Slices Pattern (from Context7 - HIGH confidence)

### Core Pattern

```typescript
import { create, StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';

// -- Slice interface --
interface RepositorySlice {
  status: RepoStatus | null;
  isLoading: boolean;
  error: string | null;
  openRepository: (path: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  closeRepository: () => Promise<void>;
  clearError: () => void;
}

// -- Slice creator --
// Generic args: <BoundStore, MiddlewareStack, [], ThisSlice>
const createRepositorySlice: StateCreator<
  GitStore,                              // full bound store type
  [['zustand/devtools', never]],         // middleware stack
  [],
  RepositorySlice                        // this slice's shape
> = (set, get) => ({
  status: null,
  isLoading: false,
  error: null,
  openRepository: async (path) => {
    set({ isLoading: true, error: null }, undefined, 'git:repo/openRepository');
    // ...
  },
  refreshStatus: async () => { /* ... */ },
  closeRepository: async () => { /* ... */ },
  clearError: () => set({ error: null }, undefined, 'git:repo/clearError'),
});

// -- Bound store --
type GitStore = RepositorySlice & BranchSlice & TagSlice & /* ... */;

const useGitStore = create<GitStore>()(
  devtools(
    (...args) => ({
      ...createRepositorySlice(...args),
      ...createBranchSlice(...args),
      ...createTagSlice(...args),
    }),
    { name: 'GitStore', enabled: import.meta.env.DEV },
  ),
);
```

### Key TypeScript Patterns

1. **Slice `StateCreator` signature with devtools:**
   ```typescript
   const createMySlice: StateCreator<
     BoundStoreType,                        // union of all slices
     [['zustand/devtools', never]],         // middleware array
     [],                                     // no extra middleware
     MySliceType                             // just this slice
   > = (set, get) => ({ ... });
   ```

2. **Cross-slice access via `get()`:**
   ```typescript
   // Inside gitflow slice, accessing branch slice:
   startFeature: async (name) => {
     const result = await commands.startFeature(name);
     if (result.status === 'ok') {
       await get().loadBranches();     // from branch slice
       await get().refreshStatus();    // from repository slice
     }
   },
   ```

3. **Named actions for DevTools:**
   ```typescript
   set(
     (state) => ({ bears: state.bears + 1 }),
     undefined,                    // don't replace (partial update)
     'git:branch/loadBranches',    // action name in DevTools
   );
   ```

### useShallow for Render Optimization

The project already uses `useShallow` in `src/hooks/useConventionalCommit.ts`. This pattern should be applied consistently when selecting multiple properties from consolidated stores:

```typescript
import { useShallow } from 'zustand/react/shallow';

// Good: only re-renders when these specific values change
const { branches, isLoading, error } = useGitStore(
  useShallow((s) => ({
    branches: s.branches,
    isLoading: s.branchesLoading,  // renamed to avoid collision
    error: s.branchError,
  })),
);

// Also good: single primitive selector (no useShallow needed)
const repoPath = useGitStore((s) => s.status?.repoPath);
```

**CRITICAL: Naming collisions.** Multiple slices have `isLoading` and `error` fields. During consolidation, prefix with domain:
- `repoIsLoading`, `repoError`
- `branchIsLoading`, `branchError`
- `stashIsLoading`, `stashError`

OR keep the slice structure flat but rename:
- `repositoryLoading`, `branchesLoading`, `stashesLoading`
- `repositoryError`, `branchesError`, `stashesError`

---

## 4. Tauri/Rust Cleanup (HIGH confidence)

### 4.1 `greet` Command (ORPHANED)

**Location:** `/Users/phmatray/Repositories/github-phm/FlowForge/src-tauri/src/lib.rs` lines 48-52

```rust
#[tauri::command]
#[specta::specta]
async fn greet(name: String) -> String {
    format!("Hello, {}! Welcome to FlowForge.", name)
}
```

- Registered in `collect_commands!` at line 57
- Only TS reference: mock in `src/test-utils/mocks/tauri-commands.ts:236`
- **Action:** Remove the function, remove from `collect_commands!`, remove from test mock

### 4.2 `getMergeStatus` Command (NOT ORPHANED)

- **Defined in Rust:** `src-tauri/src/git/merge.rs` (imported at lib.rs line 29)
- **Registered:** line 110 of lib.rs
- **TS usage:** Only in test mock (`tauri-commands.ts:324`) but this is auto-generated by specta
- **Action:** Keep - it's a valid Tauri command used by the merge flow. The mock is correct. The `get_merge_status` Rust function is used by the frontend via auto-generated `commands.getMergeStatus()`.

### 4.3 No Other Rust Cleanup Needed

All other Tauri commands in `lib.rs` are actively used. The command registration is comprehensive and matches the auto-generated TypeScript bindings.

---

## 5. Orphaned v1.0 Frontend Code (HIGH confidence)

### 5.1 `CollapsibleSidebar`
- **Location:** `src/components/layout/CollapsibleSidebar.tsx` (64 lines)
- **Exported from:** `src/components/layout/index.ts` line 7
- **Used by:** NOTHING. Only self-references and its barrel export.
- **Action:** Delete file, remove from barrel export.

### 5.2 `AnimatedList` / `AnimatedListItem`
- **Location:** `src/components/animations/AnimatedList.tsx` (52 lines)
- **Exported from:** `src/components/animations/index.ts`
- **Used by:** NOTHING. Only self-references and barrel export.
- **Action:** Delete file, remove from barrel export.

### 5.3 `FadeIn`
- **Location:** `src/components/animations/FadeIn.tsx` (35 lines)
- **Exported from:** `src/components/animations/index.ts`
- **Used by:** NOTHING. Only self-references and barrel export.
- **Action:** Delete file, remove from barrel export. Check if `src/lib/animations.ts` exports (`fadeIn`, `fadeInUp`, `fadeInScale`, `staggerContainer`, `staggerItem`) are used elsewhere before removing them.

### 5.4 `viewer3d-test.html`
- **Location:** `public/debug/viewer3d-test.html`
- **Also in:** `dist/debug/viewer3d-test.html` (build artifact)
- **Used by:** Nothing - standalone debug page
- **Action:** Delete `public/debug/viewer3d-test.html`. The `dist/` copy is a build artifact.

### 5.5 Deprecated `useBladeStore`
- **Location:** `src/stores/blades.ts` (104 lines)
- **Used by:** `src/stores/blades.test.ts` only (tests the deprecated store)
- **Marked:** `@deprecated` at line 1
- **XState replacement:** `src/machines/navigation/navigationMachine.ts` is the active implementation
- **Action:** Delete `blades.ts` and `blades.test.ts`. Keep `bladeTypes.ts` (it defines `BladePropsMap`, `BladeType`, `TypedBlade` used everywhere).

---

## 6. Bug Fix: Stale Blade Stack on Repository Close (HIGH confidence)

### Root Cause

In `src/components/Header.tsx` line 97-99:
```typescript
const handleClose = async () => {
  await closeRepository();  // sets status = null
  // MISSING: getNavigationActor().send({ type: "RESET_STACK" });
};
```

Compare with `handleRepoSwitch` (line 132) which DOES reset:
```typescript
await openRepository(path);
getNavigationActor().send({ type: "RESET_STACK" });
```

### Fix

```typescript
const handleClose = async () => {
  await closeRepository();
  getNavigationActor().send({ type: "RESET_STACK" });
};
```

This ensures the blade stack returns to the root blade when closing a repository. When a new repo is opened, it starts fresh.

### Additional Stores to Reset on Close

Several stores hold repo-specific data that should reset:
- `useTopologyStore.getState().reset()` - commit graph data
- `useStagingStore` - selected file, scroll positions
- `useConventionalStore.getState().reset()` - commit form state

The `closeRepository` action in the repository store could orchestrate this, or a new `resetAllRepoState()` helper could be created.

---

## 7. Topology Empty State (HIGH confidence)

### Current State
`src/blades/topology-graph/components/TopologyPanel.tsx` line 92-98:
```typescript
if (nodes.length === 0) {
  return (
    <div className="flex items-center justify-center h-full bg-ctp-mantle text-ctp-overlay0">
      <p>No commits to display</p>
    </div>
  );
}
```

### Required Change
Replace plain text with an illustrated empty state. Tailwind v4 + Catppuccin pattern:

```tsx
import { GitCommitHorizontal } from "lucide-react";

if (nodes.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-ctp-mantle gap-4 p-8">
      <div className="w-16 h-16 rounded-full bg-ctp-surface0 flex items-center justify-center">
        <GitCommitHorizontal className="w-8 h-8 text-ctp-overlay0" />
      </div>
      <div className="text-center max-w-xs">
        <h3 className="text-sm font-medium text-ctp-subtext1">No commits yet</h3>
        <p className="text-xs text-ctp-overlay0 mt-1">
          This repository has no commits. Create your first commit to see the topology graph.
        </p>
      </div>
    </div>
  );
}
```

This follows the Catppuccin color hierarchy: `ctp-overlay0` for subtle text, `ctp-subtext1` for headings, `ctp-surface0` for container backgrounds.

---

## 8. Gitflow Cheatsheet in Command Palette

### Current State
- Cheatsheet blade type exists: `"gitflow-cheatsheet"` in `BladePropsMap`
- Header button exists (line 300-306 of Header.tsx) to open it
- **NOT registered** in command palette (checked all files in `src/commands/`)
- Command palette categories include "Navigation" and "Settings" but no workflow category

### Fix
Add to `src/commands/repository.ts` (or create `src/commands/workflow.ts`):

```typescript
import { GitBranch } from "lucide-react";

registerCommand({
  id: "gitflow-cheatsheet",
  title: "Gitflow Cheatsheet",
  description: "Open the Gitflow workflow guide",
  category: "Navigation",  // or add new "Workflow" category
  icon: GitBranch,
  action: () => {
    openBlade("gitflow-cheatsheet", {} as Record<string, never>);
  },
  enabled: () => !!useRepositoryStore.getState().status,
});
```

---

## 9. `defaultTab` Setting Wiring

### Current State
- Setting exists: `src/stores/settings.ts` - `general.defaultTab: "changes" | "history" | "topology"`
- UI to change it exists: `src/blades/settings/components/GeneralSettings.tsx` line 28
- **NOT wired** to blade initialization - the navigation machine always starts with `"staging"` process and `rootBladeForProcess("staging")`.

### Implementation Strategy
The `defaultTab` should influence the initial process when a repository is opened:

```typescript
// In the repo open handler or App.tsx:
const { defaultTab } = useSettingsStore.getState().settings.general;
const process = defaultTab === "topology" ? "topology" : "staging";
getNavigationActor().send({ type: "SWITCH_PROCESS", process });
```

Note: "history" is a sub-view within the topology blade, not a separate process. So `defaultTab: "history"` should still set process to `"topology"` but could pass a hint.

---

## 10. Review Store Errors as Toasts

### Current State
All review checklist store errors are `console.error` only (3 locations in `reviewChecklist.ts` lines 66, 85, 98). Same pattern across ALL stores - 26 total `console.error` calls in `src/stores/`.

### Fix Pattern
Replace `console.error` with `toast.error`:

```typescript
import { toast } from "./toast";  // or from sibling slice in consolidated store

// Before:
} catch (e) {
  console.error("Failed to persist review checklist:", e);
}

// After:
} catch (e) {
  toast.error("Failed to save review checklist");
  console.error("Failed to persist review checklist:", e);  // keep for debugging
}
```

**Scope decision:** The success criteria says "review store errors surface as user-facing toasts." This is specifically about reviewChecklist.ts. But the pattern should be applied selectively - not every `console.error` warrants a toast (e.g., initialization failures on app load should not toast spam).

---

## 11. Tailwind v4 / Catppuccin Patterns

### Theme Configuration
**Location:** `src/index.css`

```css
@import "tailwindcss";
@import "@catppuccin/tailwindcss/mocha.css";

@theme {
    --font-sans: "Geist Variable", system-ui, ...;
    --font-mono: "JetBrains Mono Variable", ui-monospace, ...;
    --animate-dirty-pulse: dirty-pulse 2s ease-in-out infinite;
    --animate-gentle-pulse: gentle-pulse 3s ease-in-out infinite;
}
```

### Color Token Usage
The project uses `ctp-*` prefix classes (shorthand for catppuccin):
- **Backgrounds:** `bg-ctp-base`, `bg-ctp-mantle`, `bg-ctp-crust`, `bg-ctp-surface0`, `bg-ctp-surface1`
- **Text:** `text-ctp-text`, `text-ctp-subtext0`, `text-ctp-subtext1`, `text-ctp-overlay0`, `text-ctp-overlay1`
- **Accent:** `text-ctp-blue`, `text-ctp-red`, `text-ctp-green`, `text-ctp-yellow`
- **Borders:** `border-ctp-surface0`, `border-ctp-surface1`

### CSS Variables
For custom CSS (React Flow overrides), variables use `--catppuccin-color-*` prefix:
```css
background: var(--catppuccin-color-mantle);
border: 1px solid var(--catppuccin-color-surface0);
```

### Toast Component Pattern
`src/components/ui/ToastContainer.tsx` uses:
- `AnimatePresence mode="popLayout"` from framer-motion
- Fixed positioning: `fixed bottom-4 right-4 z-50`
- Max 3 visible toasts: `toasts.slice(-3)`
- Auto-dismiss with configurable duration per type

### Empty State Pattern
Based on existing patterns in the codebase (TopologyPanel, etc.):
```tsx
<div className="flex flex-col items-center justify-center h-full bg-ctp-mantle gap-4 p-8">
  <div className="w-16 h-16 rounded-full bg-ctp-surface0 flex items-center justify-center">
    <IconComponent className="w-8 h-8 text-ctp-overlay0" />
  </div>
  <div className="text-center max-w-xs">
    <h3 className="text-sm font-medium text-ctp-subtext1">Title</h3>
    <p className="text-xs text-ctp-overlay0 mt-1">Description</p>
  </div>
</div>
```

---

## 12. XState Navigation Machine Integration

### Current Architecture
- **Machine:** `src/machines/navigation/navigationMachine.ts` (300 lines, XState v5)
- **Context Provider:** `src/machines/navigation/context.tsx` - module-level singleton actor
- **Hook:** `src/hooks/useBladeNavigation.ts` - React hook wrapping actor selectors
- **Non-React access:** `getNavigationActor()` for command palette, keyboard shortcuts

### `RESET_STACK` Behavior
```typescript
resetStack: assign(({ context }) => ({
  bladeStack: [rootBladeForProcess(context.activeProcess)],
  dirtyBladeIds: {} as Record<string, true>,
  lastAction: "reset" as const,
})),
```
- Resets to root blade for current process
- Clears all dirty blade markers
- If dirty blades exist, goes through `confirmingDiscard` state first

### Integration Point for Store Resets
When `closeRepository()` fires, the sequence should be:
1. `await commands.closeRepository()` (Rust side cleanup)
2. `set({ status: null, error: null })` (repo store state)
3. `getNavigationActor().send({ type: "RESET_STACK" })` (blade navigation)
4. Reset dependent stores (topology, staging, conventional, etc.)

This could be orchestrated in the `closeRepository` action of the consolidated store, or in the `handleClose` callback in Header.tsx.

---

## 13. Bundle Analysis & Dead Code Verification

### Current Build Pipeline
- **Bundler:** Vite 7.3.1 (via `@tauri-apps/cli`)
- **Config:** `vite.config.ts` - no bundle analysis plugins currently

### Recommended Verification Approach

1. **Install `rollup-plugin-visualizer`:**
   ```bash
   npm install -D rollup-plugin-visualizer
   ```

2. **Add to vite.config.ts (conditionally):**
   ```typescript
   import { visualizer } from "rollup-plugin-visualizer";

   // In plugins array:
   process.env.ANALYZE && visualizer({ open: true, gzipSize: true }),
   ```

3. **Verify viewer3d-test.html exclusion:**
   Files in `public/` are copied to `dist/` verbatim by Vite. Deleting `public/debug/viewer3d-test.html` is sufficient. Verify with:
   ```bash
   ANALYZE=1 npm run build && ls dist/debug/
   ```

4. **Tree-shaking verification:**
   After removing `CollapsibleSidebar`, `AnimatedList`, `FadeIn`, and `greet`:
   - Check that barrel exports (`index.ts`) no longer reference them
   - Vite's tree-shaking will eliminate unused exports, but barrel files that import then re-export can prevent it
   - Remove imports from barrel files, don't just remove the component files

---

## 14. Testing Impact

### Current Test Infrastructure
- **Test runner:** Vitest 3.2.4 with jsdom
- **Setup:** `src/test-utils/setup.ts`
- **Zustand mock:** `__mocks__/zustand.ts` - auto-reset between tests
- **Store tests:** `blades.test.ts`, `repository.test.ts`, `toast.test.ts`
- **Blade smoke tests:** 12 test files in `src/blades/*/`
- **Navigation machine test:** `navigationMachine.test.ts`

### Auto-Reset Mock Compatibility with Sliced Stores

The existing `__mocks__/zustand.ts` intercepts `create()` and `createStore()`. Since consolidated stores still call `create<BoundType>()(...)`, the mock works unchanged. The `getInitialState()` call captures the full merged state from all slices.

**Verified pattern from Zustand docs (Context7):**
```typescript
// __mocks__/zustand.ts intercepts this:
const useGitStore = create<GitStore>()(
  devtools((...args) => ({
    ...createRepositorySlice(...args),
    ...createBranchSlice(...args),
  }))
);
// The mock's createUncurried receives the final stateCreator
// (after devtools middleware unwrapping by the actual Zustand create)
// and captures initialState of the combined store.
```

**IMPORTANT CAVEAT:** The mock currently handles the curried form:
```typescript
export const create = <T>(stateCreator?: StateCreator<T>) => {
  if (typeof stateCreator === "function") {
    return createUncurried(stateCreator);
  }
  return createUncurried;  // returns curried form
};
```

When using `create<GitStore>()(devtools(...))`, Zustand calls `create()` with no args (returns curried fn), then the curried fn receives the devtools-wrapped stateCreator. The existing mock handles this correctly because:
1. `create<GitStore>()` - no stateCreator arg, returns `createUncurried` function
2. `createUncurried(devtools(...))` - receives the devtools stateCreator, creates store

**No mock changes needed.** This was verified against the Zustand testing docs from Context7.

### Tests That Need Updates

1. **`src/stores/blades.test.ts`** - DELETE (store being removed)
2. **`src/stores/repository.test.ts`** - UPDATE import path from `./repository` to new consolidated path
3. **`src/stores/toast.test.ts`** - UPDATE import path
4. **Blade smoke tests** - May need import path updates if stores move
5. **`src/test-utils/mocks/tauri-commands.ts`** - Remove `greet` mock (line 236)

### Testing Consolidated Stores

Individual slices can still be tested by importing the consolidated store and calling specific actions:

```typescript
import { useGitStore } from "./git";

describe("repository slice", () => {
  it("opens repository", async () => {
    await useGitStore.getState().openRepository("/test");
    expect(useGitStore.getState().repoStatus).toBeDefined();
  });
});
```

The auto-reset mock resets ALL state in the consolidated store between tests, which is correct behavior.

---

## 15. Common Pitfalls

### Pitfall 1: Naming Collisions in Consolidated Stores
**What goes wrong:** Multiple slices have `isLoading`, `error`, `clearError`. Merging them creates a single `isLoading` that overwrites others.
**How to avoid:** Prefix all state and actions with the slice domain: `repoIsLoading`, `branchIsLoading`, `repoError`, `branchError`, `clearRepoError`, `clearBranchError`.
**Warning signs:** TypeScript will NOT catch this - later slice values silently overwrite earlier ones in the spread.

### Pitfall 2: Circular Imports with Consolidated Stores
**What goes wrong:** If `useGitStore` is in `src/stores/git.ts` and component A imports from it, but git.ts also imports types from component A.
**How to avoid:** Keep all types in separate `types.ts` files. Store files import types, not components.

### Pitfall 3: Persist Middleware on Large Stores
**What goes wrong:** Applying `persist` to the entire `usePreferencesStore` persists ALL state including ephemeral UI state.
**How to avoid:** Use `partialize` option to select only specific fields for persistence:
```typescript
persist(
  (...args) => ({ ...settingsSlice(...args), ...themeSlice(...args) }),
  {
    name: 'preferences',
    partialize: (state) => ({
      settings: state.settings,
      theme: state.theme,
      pinnedRepoPaths: state.pinnedRepoPaths,
    }),
  },
)
```
**Note:** The current project uses Tauri's `@tauri-apps/plugin-store` for persistence, NOT Zustand's persist middleware. Each store manually calls `getStore().set()` and `store.save()`. This pattern should be preserved during consolidation.

### Pitfall 4: Breaking the Auto-Reset Mock with Middleware
**What goes wrong:** When `devtools` middleware wraps the store creator, the mock's `getInitialState()` may return a different shape.
**How to avoid:** The existing mock already handles this correctly for the `devtools` middleware used in `blades.ts`. Test after consolidation to verify.

### Pitfall 5: Stale Closures in Cross-Slice Access
**What goes wrong:** A slice action captures `get` at creation time but the store hasn't finished initializing all slices.
**How to avoid:** Always call `get()` inside the action body, never destructure eagerly. This is already the pattern used in the codebase.

---

## 16. Migration Strategy

### Recommended Order

1. **Remove orphaned code first** (low risk, no behavioral change)
   - Delete `greet` from Rust + TS mock
   - Delete `CollapsibleSidebar`, `AnimatedList`, `FadeIn`
   - Delete `viewer3d-test.html`
   - Delete deprecated `useBladeStore` + its test

2. **Fix bugs** (targeted, verifiable)
   - Add `RESET_STACK` to `handleClose`
   - Add topology empty state illustration
   - Add gitflow cheatsheet to command palette
   - Wire `defaultTab` setting
   - Add toast surfacing for review store errors

3. **Consolidate stores** (highest risk, most impactful)
   - Create slice creator files in new structure
   - Build consolidated stores
   - Update all import paths
   - Update tests
   - Remove old store files

### File Structure Post-Consolidation

```
src/stores/
  git/
    index.ts              # create<GitStore>()(devtools(...))
    types.ts              # GitStore type, slice interfaces
    repositorySlice.ts
    branchSlice.ts
    tagSlice.ts
    stashSlice.ts
    topologySlice.ts
    undoSlice.ts
    worktreeSlice.ts
    cloneSlice.ts
    gitflowSlice.ts
  workflow/
    index.ts
    types.ts
    conventionalSlice.ts
    reviewChecklistSlice.ts
  ui/
    index.ts
    types.ts
    toastSlice.ts
    commandPaletteSlice.ts
    stagingSlice.ts
  preferences/
    index.ts
    types.ts
    settingsSlice.ts
    themeSlice.ts
    navigationSlice.ts
    branchMetadataSlice.ts
  bladeTypes.ts           # kept as-is (types only, widely imported)
```

---

## 17. Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Store slicing | Custom merge logic | Zustand `StateCreator` slices pattern | Type-safe, documented, tested |
| Render optimization | Custom `React.memo` wrappers | `useShallow` from `zustand/react/shallow` | Built-in shallow comparison |
| DevTools integration | Custom logging middleware | `devtools` from `zustand/middleware` | Redux DevTools compatible |
| Toast notifications | Custom event bus | Existing `toast.*` helpers from `toast.ts` | Already integrated |
| Bundle analysis | Manual inspection | `rollup-plugin-visualizer` | Visual treemap of bundle |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/pmndrs/zustand` - Slices pattern, TypeScript generics, devtools with slices, persist middleware, useShallow, testing auto-reset mock
- Codebase direct reading - All 21 store files, lib.rs, navigation machine, tests, CSS theme

### Secondary (MEDIUM confidence)
- Zustand v5 package.json version: `^5` (latest stable)
- XState v5 package.json version: `^5.26.0`

## Metadata

**Confidence breakdown:**
- Store consolidation pattern: HIGH - verified via Context7 Zustand docs, matches existing codebase patterns
- Orphaned code identification: HIGH - grep/glob verified zero usage beyond self-references
- Stale blade bug: HIGH - code comparison of handleClose vs handleRepoSwitch is definitive
- Testing impact: HIGH - existing mock pattern verified compatible with sliced stores
- Tailwind/Catppuccin patterns: HIGH - read directly from codebase CSS and component files

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable patterns, no breaking changes expected)
