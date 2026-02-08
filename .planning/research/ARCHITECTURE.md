# Architecture Patterns

**Domain:** Frontend architecture improvements for Tauri + React desktop Git client
**Researched:** 2026-02-08
**Overall confidence:** HIGH

---

## Current Architecture Snapshot

Before prescribing changes, here is what exists today:

### File Structure (Layer-Based)

```
src/
  App.tsx                          # Root: theme/settings/nav init, repo-open guard
  main.tsx                         # React entry point
  bindings.ts                      # Tauri-specta auto-generated IPC types (~50k)
  stores/                          # 21 Zustand stores (flat, one-file-per-store)
    blades.ts                      # Blade stack FSM (pushBlade/popBlade/setProcess)
    bladeTypes.ts                  # BladePropsMap + TypedBlade discriminated union
    repository.ts                  # Open/close/refresh repo
    navigation.ts                  # Pinned repos, recent branches (persisted)
    branches.ts, branchMetadata.ts # Branch CRUD + metadata persistence
    staging.ts                     # Selected file, view mode
    conventional.ts                # Commit form state + validation
    gitflow.ts                     # GitFlow operations (cross-store: branches, repo)
    topology.ts                    # Graph data + pagination
    settings.ts, theme.ts          # Persisted settings/theme
    toast.ts                       # Global toast notifications
    commandPalette.ts              # Cmd-K overlay state
    clone.ts, stash.ts, tags.ts, undo.ts, worktrees.ts
    changelogStore.ts, reviewChecklist.ts
  components/
    blades/                        # Blade infrastructure + 15 blade components
      registrations/               # Auto-discovered via import.meta.glob
    branches/, commit/, gitflow/, staging/, topology/  # Feature-area components
    navigation/, settings/, ui/, layout/               # Shared/structural components
    ...
  hooks/                           # 10 shared hooks
  lib/                             # 23 utility/registry files
    bladeRegistry.ts               # Map<BladeType, BladeRegistration>
    bladeOpener.ts                 # Non-React blade opener (command palette)
    store.ts                       # Tauri plugin-store singleton
    ...
  commands/                        # 6 command registration files
```

### Store Dependency Graph (Cross-Store Calls)

```
gitflow.ts -----> branches.ts (loadBranches)
           -----> repository.ts (refreshStatus)

worktrees.ts ---> repository.ts (openRepository)

App.tsx ----------> theme.ts (initTheme)
             ----> settings.ts (initSettings)
             ----> navigation.ts (initNavigation)
             ----> branchMetadata.ts (initMetadata)
             ----> reviewChecklist.ts (initChecklist)
             ----> undo.ts (loadUndoInfo)
             ----> topology.ts (loadGraph on file-watcher event)

Header.tsx ------> repository, branches, stash, tags, undo,
                   blades, navigation, commandPalette, toast
```

### Blade System Architecture

```
BladePropsMap (bladeTypes.ts)    <-- Single source of truth for blade types
  |
  v
BladeRegistration (bladeRegistry.ts)  <-- Runtime Map<BladeType, config>
  |
  v
registrations/ (auto-glob)      <-- Each file calls registerBlade()
  |
  v
BladeRenderer                   <-- Looks up registration, renders component
  |
  v
BladeContainer                  <-- Reads bladeStack from useBladeStore
  |                                  AnimatePresence for transitions
  v
BladeStrip                      <-- Collapsed previous blades in stack
```

**Key insight:** The blade system already has a natural "module" shape -- each blade has a component, a registration, and often co-located sub-components. The registry pattern means blades are loosely coupled: they register themselves at import time and are resolved by type string.

---

## Recommended Architecture

### 1. Blade-Centric Module Structure

Move from layer-based to feature-based organization where each blade becomes a self-contained module. Shared infrastructure stays in a `shared/` layer. This is NOT a full rewrite -- it is a controlled migration that moves files while preserving all import paths via re-exports during transition.

#### Target Structure

```
src/
  app/
    App.tsx
    main.tsx
    providers.tsx                     # QueryClientProvider, future XState provider

  blades/                             # One directory per blade module
    staging-changes/
      StagingChangesBlade.tsx         # Main blade component
      StagingPanel.tsx                # Sub-components (moved from components/staging/)
      FileItem.tsx
      FileList.tsx
      FileTreeView.tsx
      InlineDiffViewer.tsx
      DiffPreviewHeader.tsx
      ...
      staging.store.ts                # Co-located store (was stores/staging.ts)
      useStagingKeyboard.ts           # Co-located hook
      registration.ts                 # registerBlade() call
      index.ts                        # Public API barrel

    topology-graph/
      TopologyRootBlade.tsx
      TopologyPanel.tsx
      LaneHeader.tsx, CommitBadge.tsx, LaneBackground.tsx
      layoutUtils.ts
      topology.store.ts               # Was stores/topology.ts
      registration.ts
      index.ts

    commit-details/
      CommitDetailsBlade.tsx
      CommitHistory.tsx
      CommitSearch.tsx
      CommitDetails.tsx               # Sub-component
      registration.ts
      index.ts

    diff/
      DiffBlade.tsx
      registration.ts
      index.ts

    repo-browser/
      RepoBrowserBlade.tsx
      FileTreeBlade.tsx
      registration.ts
      index.ts

    settings/
      SettingsBlade.tsx
      GeneralSettings.tsx
      GitSettings.tsx
      AppearanceSettings.tsx
      IntegrationsSettings.tsx
      ReviewSettings.tsx
      SettingsField.tsx
      settings.store.ts               # Was stores/settings.ts
      registration.ts
      index.ts

    changelog/
      ChangelogBlade.tsx
      ChangelogPreview.tsx
      changelog.store.ts
      registration.ts
      index.ts

    gitflow-cheatsheet/
      GitflowCheatsheetBlade.tsx
      registration.ts
      index.ts

    viewer-code/
      ViewerCodeBlade.tsx
      registration.ts
      index.ts

    viewer-image/
      ViewerImageBlade.tsx
      registration.ts
      index.ts

    viewer-markdown/
      ViewerMarkdownBlade.tsx
      registration.ts
      index.ts

    viewer-3d/
      Viewer3dBlade.tsx
      registration.ts
      index.ts

    viewer-nupkg/
      ViewerNupkgBlade.tsx
      NugetPackageViewer.tsx
      registration.ts
      index.ts

  features/                           # Non-blade feature modules
    commit-form/
      CommitForm.tsx
      ConventionalCommitForm.tsx
      TypeSelector.tsx
      ScopeAutocomplete.tsx
      CharacterProgress.tsx
      BreakingChangeSection.tsx
      ValidationErrors.tsx
      conventional.store.ts
      useConventionalCommit.ts
      index.ts

    branches/
      BranchList.tsx
      BranchItem.tsx
      BranchScopeSelector.tsx
      BranchBulkActions.tsx
      BulkDeleteDialog.tsx
      CreateBranchDialog.tsx
      MergeDialog.tsx
      branches.store.ts
      branchMetadata.store.ts
      useBranches.ts
      useBranchScopes.ts
      useBulkSelect.ts
      index.ts

    gitflow/
      GitflowPanel.tsx
      GitflowActionCards.tsx
      GitflowDiagram.tsx
      GitflowBranchReference.tsx
      InitGitflowDialog.tsx
      StartFlowDialog.tsx
      FinishFlowDialog.tsx
      ReviewChecklist.tsx
      gitflow.store.ts
      reviewChecklist.store.ts
      index.ts

    stash/
      StashList.tsx, StashItem.tsx, StashDialog.tsx
      stash.store.ts
      index.ts

    tags/
      TagList.tsx, TagItem.tsx, CreateTagDialog.tsx
      tags.store.ts
      index.ts

    worktrees/
      WorktreePanel.tsx, WorktreeItem.tsx
      CreateWorktreeDialog.tsx, DeleteWorktreeDialog.tsx
      worktrees.store.ts
      index.ts

    clone/
      CloneForm.tsx, CloneProgress.tsx
      clone.store.ts
      index.ts

    navigation/
      BranchSwitcher.tsx, BranchSwitcherItem.tsx
      RepoSwitcher.tsx, RepoSwitcherItem.tsx
      SwitcherSearch.tsx
      navigation.store.ts
      index.ts

    welcome/
      WelcomeView.tsx
      RecentRepos.tsx
      AnimatedGradientBg.tsx
      GitInitBanner.tsx
      index.ts

  shared/                             # Cross-cutting shared code
    ui/                               # Primitives (button, input, dialog, etc.)
      button.tsx
      input.tsx
      dialog.tsx
      Toast.tsx, ToastContainer.tsx
      EmptyState.tsx, Skeleton.tsx
      ShortcutTooltip.tsx
      ThemeToggle.tsx

    layout/
      ResizablePanelLayout.tsx
      SplitPaneLayout.tsx
      CollapsibleSidebar.tsx
      Header.tsx
      RepositoryView.tsx

    blade-system/                     # Blade infrastructure (shared)
      BladeContainer.tsx
      BladePanel.tsx
      BladeStrip.tsx
      BladeRenderer.tsx
      BladeErrorBoundary.tsx
      BladeLoadingFallback.tsx
      BladeContentEmpty.tsx
      BladeContentError.tsx
      BladeContentLoading.tsx
      BladeToolbar.tsx
      BladeBreadcrumb.tsx
      ProcessNavigation.tsx

    lib/
      bladeRegistry.ts
      bladeOpener.ts
      bladeUtils.tsx
      fileDispatch.ts
      fileTypeUtils.ts
      errors.ts
      utils.ts
      store.ts                        # Tauri plugin-store singleton
      platform.ts
      animations.ts
      fuzzySearch.ts
      commandRegistry.ts
      ...

    stores/                           # Truly global stores only
      repository.store.ts             # Open/close repo -- global
      theme.store.ts                  # Theme -- global
      toast.store.ts                  # Toast -- global
      commandPalette.store.ts         # Cmd-K -- global
      undo.store.ts                   # Undo -- global

    hooks/
      useKeyboardShortcuts.ts
      useRecentRepos.ts
      useRepoFile.ts
      useBladeNavigation.ts
      useCommitGraph.ts

    icons/
      CommitTypeIcon.tsx
      FileTypeIcon.tsx

    markdown/
      MarkdownRenderer.tsx
      markdownComponents.tsx
      ...

    animations/
      AnimatedList.tsx
      FadeIn.tsx

    types/
      ...

  machines/                           # XState navigation FSM (NEW)
    navigation.machine.ts
    navigation.types.ts
    navigation.actions.ts
    navigation.guards.ts
    useNavigationMachine.ts
    navigationActor.ts
    navigation.persistence.ts
    index.ts

  commands/                           # Command registrations (kept as-is)
    index.ts
    branches.ts, navigation.ts, repository.ts, settings.ts, sync.ts

  bindings.ts                         # Auto-generated (stays at root)
  index.css
  vite-env.d.ts
```

#### Import Boundary Rules

```
shared/       --> can import from: shared/ only
blades/X/     --> can import from: shared/, blades/X/ only (not other blades)
features/X/   --> can import from: shared/, features/X/ only (not other features)
machines/     --> can import from: shared/ only
app/          --> can import from: anything
commands/     --> can import from: shared/, blades/, features/
```

Cross-feature communication goes through shared stores or events, never direct imports between feature modules.

#### Migration Strategy

**Phase 1:** Create the directory structure and move files one blade/feature at a time. Add re-export shims at old paths so nothing breaks:

```typescript
// src/stores/staging.ts (old location -- re-export shim)
export { useStagingStore } from "../blades/staging-changes/staging.store";
```

**Phase 2:** Update all consumers to use new import paths. Remove shims.

**Phase 3:** Add ESLint `import/no-restricted-paths` to enforce boundaries.

**Confidence:** HIGH -- This pattern is proven in bulletproof-react and widely adopted for React apps of this size. The blade registry already provides natural module boundaries.

---

### 2. XState Navigation FSM

#### Why XState for Navigation

The current blade navigation is a hand-rolled stack machine in `useBladeStore` with `pushBlade`, `popBlade`, `setProcess`, etc. This works but:

1. **No explicit state transitions** -- any code can call any action at any time
2. **No guard conditions** -- no validation that transitions are legal
3. **No visualization** -- state flow is implicit in imperative code
4. **No persistence API** -- would need manual serialization

XState makes the navigation state machine explicit, type-safe, and persistable.

#### Recommended: XState v5 (5.26.0) + @xstate/react (6.0.0)

```bash
npm install xstate @xstate/react
```

**Confidence:** HIGH -- XState v5 is stable (released Dec 2023, latest 5.26.0 as of Feb 2026). The `setup()` API provides excellent TypeScript inference. `@xstate/react` 6.0.0 is the current stable React binding.

#### Navigation Machine Design

```typescript
// src/machines/navigation.types.ts
import type { BladeType, BladePropsMap, TypedBlade } from "../shared/blade-system/bladeTypes";

export type ProcessType = "staging" | "topology";

export type NavigationContext = {
  activeProcess: ProcessType;
  bladeStack: TypedBlade[];
};

export type NavigationEvent =
  | { type: "SWITCH_PROCESS"; process: ProcessType }
  | { type: "PUSH_BLADE"; bladeType: BladeType; title: string; props: BladePropsMap[BladeType] }
  | { type: "POP_BLADE" }
  | { type: "POP_TO_INDEX"; index: number }
  | { type: "REPLACE_BLADE"; bladeType: BladeType; title: string; props: BladePropsMap[BladeType] }
  | { type: "RESET_STACK" }
  | { type: "OPEN_REPO" }
  | { type: "CLOSE_REPO" };
```

```typescript
// src/machines/navigation.machine.ts
import { setup, assign } from "xstate";
import type { NavigationContext, NavigationEvent, ProcessType } from "./navigation.types";
import type { TypedBlade } from "../shared/blade-system/bladeTypes";

function rootBladeForProcess(process: ProcessType): TypedBlade {
  if (process === "staging") {
    return {
      id: "root",
      type: "staging-changes",
      title: "Changes",
      props: {} as Record<string, never>,
    };
  }
  return {
    id: "root",
    type: "topology-graph",
    title: "Topology",
    props: {} as Record<string, never>,
  };
}

export const navigationMachine = setup({
  types: {
    context: {} as NavigationContext,
    events: {} as NavigationEvent,
  },
  actions: {
    pushBlade: assign({
      bladeStack: ({ context, event }) => {
        if (event.type !== "PUSH_BLADE") return context.bladeStack;
        return [
          ...context.bladeStack,
          {
            id: crypto.randomUUID(),
            type: event.bladeType,
            title: event.title,
            props: event.props,
          } as TypedBlade,
        ];
      },
    }),
    popBlade: assign({
      bladeStack: ({ context }) =>
        context.bladeStack.length > 1
          ? context.bladeStack.slice(0, -1)
          : context.bladeStack,
    }),
    popToIndex: assign({
      bladeStack: ({ context, event }) => {
        if (event.type !== "POP_TO_INDEX") return context.bladeStack;
        return context.bladeStack.slice(0, event.index + 1);
      },
    }),
    replaceBlade: assign({
      bladeStack: ({ context, event }) => {
        if (event.type !== "REPLACE_BLADE") return context.bladeStack;
        return [
          ...context.bladeStack.slice(0, -1),
          {
            id: crypto.randomUUID(),
            type: event.bladeType,
            title: event.title,
            props: event.props,
          } as TypedBlade,
        ];
      },
    }),
    resetStack: assign({
      bladeStack: ({ context }) => [rootBladeForProcess(context.activeProcess)],
    }),
    switchProcess: assign(({ event }) => {
      if (event.type !== "SWITCH_PROCESS") return {};
      return {
        activeProcess: event.process,
        bladeStack: [rootBladeForProcess(event.process)],
      };
    }),
  },
  guards: {
    canPop: ({ context }) => context.bladeStack.length > 1,
    isValidIndex: ({ context, event }) => {
      if (event.type !== "POP_TO_INDEX") return false;
      return event.index >= 0 && event.index < context.bladeStack.length;
    },
  },
}).createMachine({
  id: "navigation",
  initial: "welcome",
  context: {
    activeProcess: "staging",
    bladeStack: [rootBladeForProcess("staging")],
  },
  states: {
    welcome: {
      on: {
        OPEN_REPO: { target: "repository" },
      },
    },
    repository: {
      on: {
        CLOSE_REPO: { target: "welcome", actions: "resetStack" },
        PUSH_BLADE: { actions: "pushBlade" },
        POP_BLADE: { guard: "canPop", actions: "popBlade" },
        POP_TO_INDEX: { guard: "isValidIndex", actions: "popToIndex" },
        REPLACE_BLADE: { actions: "replaceBlade" },
        RESET_STACK: { actions: "resetStack" },
        SWITCH_PROCESS: { actions: "switchProcess" },
      },
    },
  },
});
```

**Confidence:** HIGH for the machine definition pattern (verified via official XState v5 `setup()` docs). The `assign()` API with context/event destructuring is the canonical v5 pattern.

#### XState + React Integration Pattern

**Recommended approach:** Use `createActorContext` from `@xstate/react` to provide the navigation machine globally. This avoids prop-drilling and gives every component access to the actor via React context.

Do NOT use the `zustand-middleware-xstate` package -- it is unmaintained and designed for XState v4. Instead, use the official `@xstate/react` hooks.

```typescript
// src/machines/useNavigationMachine.ts
import { createActorContext } from "@xstate/react";
import { navigationMachine } from "./navigation.machine";

export const NavigationMachineContext = createActorContext(navigationMachine);

// Selectors for common state reads (avoid re-rendering on unrelated changes)
export const selectActiveProcess = (snapshot: any) =>
  snapshot.context.activeProcess;

export const selectBladeStack = (snapshot: any) =>
  snapshot.context.bladeStack;

export const selectActiveBlade = (snapshot: any) => {
  const stack = snapshot.context.bladeStack;
  return stack[stack.length - 1];
};

export const selectIsWelcome = (snapshot: any) =>
  snapshot.matches("welcome");

export const selectIsRepository = (snapshot: any) =>
  snapshot.matches("repository");
```

**Confidence:** HIGH for `createActorContext` API (verified via official `@xstate/react` docs, returns Provider + useSelector + useActorRef).

#### Persistence via Tauri Plugin-Store

XState v5 supports `actor.getPersistedSnapshot()` and `createActor(machine, { snapshot })` for persistence. Integrate with the existing Tauri `plugin-store`:

```typescript
// src/machines/navigation.persistence.ts
import { getStore } from "../shared/lib/store";

const NAV_SNAPSHOT_KEY = "nav-machine-snapshot";

export async function persistNavigationSnapshot(
  snapshot: unknown,
): Promise<void> {
  try {
    const store = await getStore();
    await store.set(NAV_SNAPSHOT_KEY, JSON.stringify(snapshot));
    await store.save();
  } catch (e) {
    console.error("Failed to persist navigation snapshot:", e);
  }
}

export async function loadNavigationSnapshot(): Promise<unknown | undefined> {
  try {
    const store = await getStore();
    const raw = await store.get<string>(NAV_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch (e) {
    console.error("Failed to load navigation snapshot:", e);
    return undefined;
  }
}
```

In the provider, subscribe to snapshot changes and persist:

```typescript
// In app/providers.tsx
import { useEffect, useState } from "react";
import {
  NavigationMachineContext,
} from "../machines/useNavigationMachine";
import {
  loadNavigationSnapshot,
  persistNavigationSnapshot,
} from "../machines/navigation.persistence";

export function NavigationProvider({
  children,
}: { children: React.ReactNode }) {
  const [restoredSnapshot, setRestoredSnapshot] = useState<unknown>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadNavigationSnapshot().then((snap) => {
      setRestoredSnapshot(snap);
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  return (
    <NavigationMachineContext.Provider
      options={
        restoredSnapshot ? { snapshot: restoredSnapshot } : undefined
      }
    >
      <PersistenceSubscriber />
      {children}
    </NavigationMachineContext.Provider>
  );
}

function PersistenceSubscriber() {
  const actorRef = NavigationMachineContext.useActorRef();

  useEffect(() => {
    const sub = actorRef.subscribe(() => {
      persistNavigationSnapshot(actorRef.getPersistedSnapshot());
    });
    return () => sub.unsubscribe();
  }, [actorRef]);

  return null;
}
```

**Confidence:** HIGH for XState persistence API (`getPersistedSnapshot` + `createActor` with `snapshot` option -- verified via official docs). MEDIUM for the exact `createActorContext.Provider` options prop shape -- verify at implementation time with `@xstate/react` 6.0.0 source or docs.

**Important caveats from XState docs:**
- "Actions from machine actors will not be re-executed, because they are assumed to have been already executed." This means entry actions on the restored state will NOT fire -- which is correct for navigation (we don't want to re-push blades on restore).
- If `restoredSnapshot` is `undefined`, the actor starts at the initial state, which is the correct fallback.

#### Non-React Access (Command Palette, Keyboard Shortcuts)

For code outside the React component tree that needs to trigger navigation:

```typescript
// src/machines/navigationActor.ts
import type { ActorRefFrom } from "xstate";
import type { navigationMachine } from "./navigation.machine";

let _actorRef: ActorRefFrom<typeof navigationMachine> | null = null;

export function setNavigationActorRef(
  ref: ActorRefFrom<typeof navigationMachine>,
) {
  _actorRef = ref;
}

export function getNavigationActorRef() {
  if (!_actorRef) throw new Error("Navigation actor not initialized");
  return _actorRef;
}
```

This mirrors the existing `bladeOpener.ts` pattern which calls `useBladeStore.getState()` for non-React contexts. The `PersistenceSubscriber` component (or the Provider itself) calls `setNavigationActorRef(actorRef)` on mount.

---

### 3. Zustand Store Consolidation

#### Current State: 21 Stores

| Store | Category | Persistence | Cross-Store Deps |
|-------|----------|-------------|------------------|
| `blades` | Navigation | No | None (replaced by XState) |
| `bladeTypes` | Types only | N/A | N/A |
| `repository` | Global | No | None |
| `navigation` | Global | Tauri store | None |
| `branches` | Feature | No | None |
| `branchMetadata` | Feature | Tauri store | None |
| `staging` | Feature | No | None |
| `conventional` | Feature | No | None |
| `gitflow` | Feature | No | branches, repository |
| `topology` | Feature | No | None |
| `settings` | Global | Tauri store | None |
| `theme` | Global | Tauri store + localStorage | None |
| `toast` | Global | No | None |
| `commandPalette` | Global | No | None |
| `clone` | Feature | No | None |
| `stash` | Feature | No | None |
| `tags` | Feature | No | None |
| `undo` | Global | No | None |
| `worktrees` | Feature | No | repository |
| `changelogStore` | Feature | No | None |
| `reviewChecklist` | Feature | Tauri store | None |

#### Consolidation Strategy: Keep Separate Stores, Co-locate

**Recommendation: Do NOT merge stores into slices.** The Zustand maintainers (TkDodo, dai-shi) explicitly recommend multiple separate stores over the slices pattern when stores are independent. From Zustand discussion #2496: multiple stores are marginally more performant than slices, and the stores in FlowForge are almost entirely independent (only `gitflow` and `worktrees` have cross-store deps).

Merging them into slices would:
- Add coupling where none exists
- Make the combined store harder to tree-shake
- Complicate the persistence story (different stores persist differently via Tauri plugin-store)
- Create a single mega-store file that is harder to navigate

**Instead, co-locate stores with their feature modules:**

| Store | New Location |
|-------|-------------|
| `blades.ts` | **REMOVED** -- replaced by XState navigation machine |
| `bladeTypes.ts` | `shared/blade-system/bladeTypes.ts` |
| `repository.ts` | `shared/stores/repository.store.ts` |
| `navigation.ts` | `features/navigation/navigation.store.ts` |
| `branches.ts` | `features/branches/branches.store.ts` |
| `branchMetadata.ts` | `features/branches/branchMetadata.store.ts` |
| `staging.ts` | `blades/staging-changes/staging.store.ts` |
| `conventional.ts` | `features/commit-form/conventional.store.ts` |
| `gitflow.ts` | `features/gitflow/gitflow.store.ts` |
| `topology.ts` | `blades/topology-graph/topology.store.ts` |
| `settings.ts` | `blades/settings/settings.store.ts` |
| `theme.ts` | `shared/stores/theme.store.ts` |
| `toast.ts` | `shared/stores/toast.store.ts` |
| `commandPalette.ts` | `shared/stores/commandPalette.store.ts` |
| `clone.ts` | `features/clone/clone.store.ts` |
| `stash.ts` | `features/stash/stash.store.ts` |
| `tags.ts` | `features/tags/tags.store.ts` |
| `undo.ts` | `shared/stores/undo.store.ts` |
| `worktrees.ts` | `features/worktrees/worktrees.store.ts` |
| `changelogStore.ts` | `blades/changelog/changelog.store.ts` |
| `reviewChecklist.ts` | `features/gitflow/reviewChecklist.store.ts` |

**Confidence:** HIGH -- Zustand docs and community consensus strongly favor separate stores for independent state.

#### Store Naming Convention

Rename all stores to `{feature}.store.ts` for consistency:
- `changelogStore.ts` becomes `changelog.store.ts`
- `conventional.ts` becomes `conventional.store.ts`
- etc.

This makes auto-import and file search more predictable.

#### Cross-Store Dependencies: Keep Imperative, Add Type Safety

The `gitflow.store.ts` pattern of calling `useBranchStore.getState().loadBranches()` is the recommended Zustand pattern for cross-store communication. This should remain as-is but be formalized:

```typescript
// features/gitflow/gitflow.store.ts
import { useBranchStore } from "../branches/branches.store";
import { useRepositoryStore } from "../../shared/stores/repository.store";

// Cross-module import is explicit and trackable
```

This is a "features imports shared" pattern -- `gitflow` importing from `branches` is technically a cross-feature import. Since both are sidebar features with tightly coupled operations, this is acceptable. The alternative (routing through shared stores or events) would add complexity for no benefit.

**However:** if more cross-feature imports emerge, extract the shared operations to `shared/stores/` or use an event bus pattern.

---

### 4. App Initialization Flow (Revised)

#### Current Init (App.tsx)

```
App mount --> initTheme() + initSettings() + initNavigation() + initMetadata() + initChecklist()
             Repo-change listener --> invalidate queries + loadUndoInfo + loadGraph
             status ? <RepositoryView /> : <WelcomeView />
```

#### Proposed Init (with XState)

```
main.tsx
  |
  v
NavigationProvider (loads persisted snapshot, creates actor)
  |
  v
App.tsx
  |-- initTheme(), initSettings(), initMetadata(), initChecklist()
  |-- XState navigation machine handles welcome/repo transitions
  |
  v
On OPEN_REPO event:
  machine transitions "welcome" --> "repository"
  Repo-change listener starts

On CLOSE_REPO event:
  machine transitions "repository" --> "welcome"
  Blade stack resets via exit action
```

The key change is that `status ? <RepositoryView /> : <WelcomeView />` becomes derived from the navigation machine state:

```typescript
function App() {
  const isWelcome = NavigationMachineContext.useSelector(selectIsWelcome);
  // ...
  return (
    <main>
      {isWelcome ? <WelcomeView /> : <RepositoryView />}
    </main>
  );
}
```

The `useRepositoryStore.status` still exists for repository data (branch name, path, etc.) but no longer drives the top-level view toggle. The machine owns the "which view" decision; the store owns "what repo data."

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `NavigationMachineContext.Provider` | Owns navigation FSM, blade stack, process mode | All blade/feature modules via context |
| `BladeContainer` | Reads blade stack, renders active blade + strips | Navigation machine (read), BladeRenderer |
| `BladeRenderer` | Resolves blade type to registered component | BladeRegistry (read) |
| `BladeRegistry` | Maps blade type strings to component configs | Registration files (write at init) |
| `Header` | App chrome, repo/branch switcher, toolbar | Navigation machine (send), global stores |
| `RepositoryView` | Layout: sidebar + blade area | Feature modules, BladeContainer |
| `WelcomeView` | Repo open/clone/init | Navigation machine (OPEN_REPO), repository store |
| Feature stores | Domain-specific state + IPC calls | Tauri bindings, other stores via getState() |
| Global stores | Cross-cutting state (toast, theme, undo) | Consumed everywhere |

---

## Data Flow

### Blade Navigation Flow (After XState)

```
User clicks "View Diff"
  |
  v
Component calls actorRef.send({ type: "PUSH_BLADE", bladeType: "diff", ... })
  |
  v
XState machine (in "repository" state) executes "pushBlade" action
  |
  v
Machine context updated: bladeStack = [...stack, newBlade]
  |
  v
PersistenceSubscriber saves snapshot to Tauri store
  |
  v
BladeContainer re-renders via useSelector(selectBladeStack)
  |
  v
BladeRenderer resolves "diff" -> DiffBlade component from registry
  |
  v
DiffBlade mounts, fetches data via Tauri IPC
```

### Store Persistence Flow (Unchanged)

```
Store action modifies state
  |
  v
Store calls getStore() -> Tauri plugin-store singleton
  |
  v
store.set("key", value) + store.save()
  |
  v
Persisted to flowforge-settings.json on disk
  |
  v
On next app launch: initXxx() loads from store, sets Zustand state
```

### Cross-Store Communication Flow (Unchanged)

```
GitFlow "Finish Feature"
  |
  v
gitflow.store.ts finishFeature()
  |
  v
commands.finishFeature() (Tauri IPC)
  |
  v
On success: gitflow.refresh()
  |
  v
useBranchStore.getState().loadBranches()   <-- cross-store call
useRepositoryStore.getState().refreshStatus()
```

---

## Patterns to Follow

### Pattern 1: Blade Module Self-Registration

**What:** Each blade module has a `registration.ts` that calls `registerBlade()` and is auto-discovered via `import.meta.glob`.

**When:** Every blade module, always.

**Example:**

```typescript
// src/blades/staging-changes/registration.ts
import { registerBlade } from "../../shared/lib/bladeRegistry";
import { StagingChangesBlade } from "./StagingChangesBlade";

registerBlade({
  type: "staging-changes",
  defaultTitle: "Changes",
  component: StagingChangesBlade,
  wrapInPanel: false,
  showBack: false,
});
```

The auto-glob in a dedicated init file discovers registrations:

```typescript
// src/blades/registrations.ts (replaces components/blades/registrations/index.ts)
const modules = import.meta.glob("./*/registration.{ts,tsx}", { eager: true });

// Dev-mode exhaustiveness check (carry over from existing)
if (import.meta.env.DEV && Object.keys(modules).length === 0) {
  console.error("[BladeRegistry] No registration modules found");
}
```

### Pattern 2: Feature Module Public API via index.ts

**What:** Each feature/blade module exports only its public API through `index.ts`. Internal components are NOT exported.

**When:** Every feature module.

**Example:**

```typescript
// src/features/branches/index.ts
export { BranchList } from "./BranchList";
export { CreateBranchDialog } from "./CreateBranchDialog";
export { MergeDialog } from "./MergeDialog";
export { useBranchStore } from "./branches.store";
export { useBranchMetadataStore } from "./branchMetadata.store";
```

Internal components like `BranchItem.tsx`, `BranchScopeSelector.tsx` are NOT exported -- they are implementation details.

**Note on barrel files:** The bulletproof-react docs warn that barrel files can hurt Vite tree-shaking. In this case, since these are feature modules with a small public API (not libraries), the risk is minimal. The barrel file serves as a documentation of the module's public surface. If build performance becomes a concern, switch to direct imports.

### Pattern 3: XState Event Dispatch from Non-React Code

**What:** Use a global actor ref for command palette, keyboard shortcuts, and other non-React contexts.

**When:** Any code outside the React component tree needs to trigger navigation.

**Example:**

```typescript
// src/commands/navigation.ts
import { getNavigationActorRef } from "../machines/navigationActor";

export function openSettingsBlade() {
  getNavigationActorRef().send({
    type: "PUSH_BLADE",
    bladeType: "settings",
    title: "Settings",
    props: {} as Record<string, never>,
  });
}
```

### Pattern 4: Selective Re-rendering with useSelector

**What:** Use `NavigationMachineContext.useSelector` with specific selectors instead of subscribing to entire snapshots.

**When:** Every component consuming navigation machine state.

**Example:**

```typescript
// Only re-renders when activeProcess changes
const activeProcess = NavigationMachineContext.useSelector(selectActiveProcess);

// Only re-renders when the active blade changes
const activeBlade = NavigationMachineContext.useSelector(selectActiveBlade);
```

This is equivalent to how Zustand selectors work: `useBladeStore((s) => s.activeProcess)`. The mental model is the same.

### Pattern 5: Compatibility Shim for Gradual Migration

**What:** Provide a Zustand-API-compatible wrapper around the XState machine during migration.

**When:** During the transition period when some code still uses `useBladeStore`.

**Example:**

```typescript
// src/shared/hooks/useBladeStore.ts (compatibility shim)
import {
  NavigationMachineContext,
  selectBladeStack,
  selectActiveProcess,
} from "../../machines/useNavigationMachine";

/** @deprecated Migrate to NavigationMachineContext.useSelector/useActorRef */
export function useBladeStore() {
  const actorRef = NavigationMachineContext.useActorRef();
  const bladeStack = NavigationMachineContext.useSelector(selectBladeStack);
  const activeProcess = NavigationMachineContext.useSelector(selectActiveProcess);

  return {
    bladeStack,
    activeProcess,
    pushBlade: <K extends BladeType>(blade: {
      type: K;
      title: string;
      props: BladePropsMap[K];
    }) =>
      actorRef.send({
        type: "PUSH_BLADE",
        bladeType: blade.type,
        title: blade.title,
        props: blade.props,
      }),
    popBlade: () => actorRef.send({ type: "POP_BLADE" }),
    popToIndex: (index: number) =>
      actorRef.send({ type: "POP_TO_INDEX", index }),
    replaceBlade: <K extends BladeType>(blade: {
      type: K;
      title: string;
      props: BladePropsMap[K];
    }) =>
      actorRef.send({
        type: "REPLACE_BLADE",
        bladeType: blade.type,
        title: blade.title,
        props: blade.props,
      }),
    resetStack: () => actorRef.send({ type: "RESET_STACK" }),
    setProcess: (process: ProcessType) =>
      actorRef.send({ type: "SWITCH_PROCESS", process }),
  };
}
```

This allows migrating consumers one at a time rather than all at once.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Dual State Ownership (XState + Zustand for Same Data)

**What:** Having both an XState machine AND a Zustand store managing the blade stack, with sync logic between them.

**Why bad:** Two sources of truth for the same state leads to sync bugs, race conditions, and confusion about which is authoritative. Defeats the purpose of using XState.

**Instead:** XState owns the blade stack completely. Remove `useBladeStore` (the Zustand store). Provide the compatibility shim (Pattern 5) during migration, then remove it. The shim wraps XState, it does not duplicate state.

### Anti-Pattern 2: Zustand Store Slices for Independent State

**What:** Merging independent stores (e.g., branches + tags + stash) into a single combined store using Zustand's slices pattern.

**Why bad:** Adds coupling between unrelated features, makes it harder to co-locate stores with their modules, and provides no real performance benefit for independent state. Persistence becomes awkward when different slices have different persistence strategies.

**Instead:** Keep separate Zustand stores. Co-locate them with their feature module. Use cross-store `getState()` calls when needed.

### Anti-Pattern 3: Deep Module Cross-Imports

**What:** A blade module importing components or stores from another blade module directly.

**Why bad:** Creates hidden coupling, circular dependency risks, and makes it impossible to move/refactor modules independently.

**Instead:** Extract shared code to `shared/`. If two blades need to communicate, route through the navigation machine (events) or shared stores.

### Anti-Pattern 4: Barrel Re-exports of Internal Implementation

**What:** Having `index.ts` files that re-export every internal file from a module.

**Why bad:** Vite cannot tree-shake barrel re-exports efficiently, leading to larger bundles and slower HMR. Also makes it unclear what the module's public API actually is.

**Instead:** Export only the public API. Internal components import directly from their file path within the module.

### Anti-Pattern 5: Persisting Navigation on Every Blade Push

**What:** Writing to the Tauri store on every single navigation event (push, pop, switch process).

**Why bad:** Disk I/O on every click. The Tauri plugin-store writes to a JSON file. High-frequency writes cause jank and wear.

**Instead:** Debounce persistence. Subscribe to the actor snapshot and debounce writes to ~1 second. Or only persist on app blur/close using the Tauri window event:

```typescript
import { listen } from "@tauri-apps/api/event";

listen("tauri://blur", () => {
  persistNavigationSnapshot(actorRef.getPersistedSnapshot());
});
```

---

## Scalability Considerations

| Concern | Current (~30 files per layer) | At 20+ Blade Modules | At 50+ Modules |
|---------|-------------------------------|----------------------|----------------|
| File discovery | Flat dirs, easy to find | Blade-centric modules with predictable internal structure | Same pattern scales |
| Registration | Auto-glob in registrations/ | Auto-glob in blades/*/registration.ts | Same pattern scales |
| Bundle size | All blades eagerly loaded | Keep eager for now | Introduce `React.lazy()` per blade via `lazy: true` in registration |
| State management | 21 stores, mostly independent | Co-located stores, same count minus blades store | Consider XState for complex multi-step flows (e.g., init repo wizard) |
| Navigation depth | Stack rarely > 3 deep | Guard max depth in machine if needed | Same |
| HMR speed | Fast with Vite | Module-scoped HMR (only changed blade reloads) | Same |
| Import analysis | Flat makes all imports look similar | Module boundaries make cross-cuts visible | ESLint rules enforce boundaries |

---

## Integration Points Summary (New vs Modified)

### New Files

| File | Purpose |
|------|---------|
| `src/machines/navigation.machine.ts` | XState navigation FSM definition |
| `src/machines/navigation.types.ts` | TypeScript types for machine context/events |
| `src/machines/navigation.actions.ts` | Named actions (optional, can inline in machine) |
| `src/machines/navigation.guards.ts` | Guard conditions (optional, can inline in machine) |
| `src/machines/useNavigationMachine.ts` | `createActorContext` + selectors |
| `src/machines/navigationActor.ts` | Global actor ref for non-React code |
| `src/machines/navigation.persistence.ts` | Tauri store persistence bridge |
| `src/machines/index.ts` | Public API |
| `src/app/providers.tsx` | `NavigationProvider` wrapper |
| `src/blades/registrations.ts` | Auto-glob for blade-centric registrations |

### Modified Files (Critical Path)

| File | Change | Reason |
|------|--------|--------|
| `src/App.tsx` | Wrap with `NavigationProvider`, replace `status` guard with machine state | XState controls welcome/repo transition |
| `src/components/blades/BladeContainer.tsx` | Read from `NavigationMachineContext.useSelector` instead of `useBladeStore` | XState owns blade stack |
| `src/components/blades/ProcessNavigation.tsx` | Send `SWITCH_PROCESS` to machine instead of `useBladeStore.setProcess` | XState owns process mode |
| `src/hooks/useBladeNavigation.ts` | Send events to machine instead of calling store methods | XState owns navigation |
| `src/lib/bladeOpener.ts` | Use `getNavigationActorRef().send()` instead of `useBladeStore.getState()` | Non-React XState access |
| `src/components/Header.tsx` | Use machine selectors for process state | Read from XState |

### Removed After XState Migration

| File | Replaced By |
|------|-------------|
| `src/stores/blades.ts` | `src/machines/navigation.machine.ts` |

### Files Moved During Restructure (No Logic Change)

Every file under `src/components/` and `src/stores/` moves to its blade/feature module. Logic stays the same; only import paths change. Re-export shims ensure no breakage during migration.

---

## Recommended Build Order (Dependency-Aware)

### Phase 1: XState Navigation Machine (No File Moves)

1. Install `xstate@5` + `@xstate/react@6`
2. Create `src/machines/` with navigation machine definition
3. Create `NavigationProvider` with persistence
4. Wire into `App.tsx` alongside existing `useBladeStore` (compatibility shim)
5. Migrate `BladeContainer`, `ProcessNavigation`, `useBladeNavigation`, `bladeOpener` to XState
6. Run all existing flows manually to verify behavior parity
7. Remove `useBladeStore` (the Zustand store, not the compatibility shim)
8. Remove compatibility shim once all consumers are migrated

**Rationale:** XState is the riskiest change (new dependency, new paradigm). Do it first while the file structure is familiar. Easier to debug issues when you know exactly what moved.

### Phase 2: Blade-Centric File Restructure

1. Create `src/blades/`, `src/features/`, `src/shared/` directories
2. Move shared infrastructure (`shared/ui/`, `shared/blade-system/`, `shared/lib/`, `shared/stores/`)
3. Move blade modules one at a time (start with leaf blades like viewers that have few sub-components)
4. Move feature modules
5. Update auto-glob path for registrations
6. Add re-export shims at old paths, then remove as consumers update

**Rationale:** File moves are mechanical and low-risk. Doing this after XState means the blade store is already gone, reducing cross-cutting changes.

### Phase 3: Store Co-location + Naming

1. Rename all store files to `{feature}.store.ts`
2. Move stores to their feature/blade modules
3. Update all imports (search-and-replace with TypeScript path resolution)
4. Add ESLint `import/no-restricted-paths` to enforce module boundaries

**Rationale:** This is the final cleanup pass. By this point the module structure is established and stores naturally slot into their modules.

---

## Sources

- [XState v5 Persistence API](https://stately.ai/docs/persistence) -- HIGH confidence
- [XState v5 setup() function](https://stately.ai/docs/setup) -- HIGH confidence
- [@xstate/react hooks API](https://stately.ai/docs/xstate-react) -- HIGH confidence
- [XState npm (v5.26.0)](https://www.npmjs.com/package/xstate) -- HIGH confidence
- [@xstate/react npm (v6.0.0)](https://www.npmjs.com/package/@xstate/react) -- HIGH confidence
- [Zustand Slices Pattern docs](https://zustand.docs.pmnd.rs/guides/slices-pattern) -- HIGH confidence
- [Zustand Discussion #2496: When to use multiple stores vs slices](https://github.com/pmndrs/zustand/discussions/2496) -- HIGH confidence
- [Bulletproof React Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) -- HIGH confidence
- [XState Global State with React](https://stately.ai/blog/2024-02-12-xstate-react-global-state) -- MEDIUM confidence
- [zustand-middleware-xstate](https://github.com/biowaffeln/zustand-middleware-xstate) -- MEDIUM confidence (unmaintained, XState v4 only -- noted as anti-pattern)
- [State Management Trends in React 2025](https://makersden.io/blog/react-state-management-in-2025) -- MEDIUM confidence
- [React Folder Structure 2025](https://www.robinwieruch.de/react-folder-structure/) -- MEDIUM confidence
