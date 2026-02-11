# Technology Stack

**Project:** FlowForge v1.7.0 -- Extract Topology, Worktrees, Init Repo into Extensions + Registry Zustand Migration
**Researched:** 2026-02-11
**Scope:** Stack additions/changes needed for NEW feature extractions and tech debt cleanup ONLY

## Executive Summary

This milestone requires **zero new dependencies**. The existing stack (Zustand 5.0.11, React 19, TypeScript 5.9, ExtensionAPI facade with coreOverride pattern) already provides every capability needed. The work is purely architectural: moving code from core modules into the `src/extensions/` directory structure, wiring them through the existing ExtensionAPI facade, and converting two plain-Map registries (commandRegistry, previewRegistry) into Zustand stores to match the pattern established by the other five registries.

## Recommended Stack

### No New Dependencies Required

The entire milestone is achievable with the current dependency set. Here is why:

| Capability Needed | Already Provided By | Version |
|---|---|---|
| Extension lifecycle (activate/deactivate) | ExtensionHost Zustand store | Zustand 5.0.11 |
| Blade registration with coreOverride | ExtensionAPI.registerBlade() | In-house |
| Sidebar panel contribution | ExtensionAPI.contributeSidebarPanel() | In-house |
| Command registration | ExtensionAPI.registerCommand() | In-house |
| Toolbar contribution | ExtensionAPI.contributeToolbar() | In-house |
| Reactive Zustand store pattern | create() + devtools() middleware | Zustand 5.0.11 |
| Backward-compatible function exports | Established pattern in bladeRegistry.ts | In-house |
| Lazy component loading | React.lazy() | React 19.2.4 |
| Topology graph layout | layoutUtils.ts (custom SVG) | In-house |
| Worktree Tauri commands | commands.listWorktrees/createWorktree/deleteWorktree | Tauri v2 bindings |
| Init repo Tauri commands | commands.getGitignoreTemplate/initRepository | Tauri v2 bindings |

### Core Framework (Unchanged)

| Technology | Version | Purpose | Status |
|---|---|---|---|
| React | ^19.2.4 | UI framework | Keep as-is |
| TypeScript | ^5.9.3 | Type safety | Keep as-is |
| Zustand | ^5 (5.0.11 installed) | State management + registry stores | Key for registry migration |
| Tauri v2 | ^2 | Desktop runtime + git commands | Keep as-is |
| Tailwind v4 | ^4 | Styling | Keep as-is |

### Registry Stores (Migration Targets)

These two registries need migration from plain Maps to Zustand stores. No new libraries needed -- the pattern is already proven by five existing Zustand-backed registries.

| Registry | Current Pattern | Target Pattern | Reference Implementation |
|---|---|---|---|
| commandRegistry | Plain `Map<string, Command>` + exported functions | Zustand `create()` + `devtools()` + backward-compat function exports | `bladeRegistry.ts` (identical shape) |
| previewRegistry | Plain `PreviewRegistration[]` + exported functions | Zustand `create()` + `devtools()` + backward-compat function exports | `contextMenuRegistry.ts` (similar sorted-list shape) |

**Already Zustand-backed (no changes needed):**

| Registry | Store Hook | File |
|---|---|---|
| BladeRegistry | `useBladeRegistry` | `src/lib/bladeRegistry.ts` |
| ToolbarRegistry | `useToolbarRegistry` | `src/lib/toolbarRegistry.ts` |
| ContextMenuRegistry | `useContextMenuRegistry` | `src/lib/contextMenuRegistry.ts` |
| SidebarPanelRegistry | `useSidebarPanelRegistry` | `src/lib/sidebarPanelRegistry.ts` |
| StatusBarRegistry | `useStatusBarRegistry` | `src/lib/statusBarRegistry.ts` |

## Detailed Migration Plan: commandRegistry

### Current Implementation (src/lib/commandRegistry.ts)

```typescript
// Plain Map -- not reactive
const commands = new Map<string, Command>();

export function registerCommand(cmd: Command): void {
  commands.set(cmd.id, cmd);
}

export function getCommands(): Command[] {
  return Array.from(commands.values());
}
// ... 7 more exported functions
```

**Problem:** The CommandPalette reads commands via `getEnabledCommands()` inside a `useMemo` keyed on `isOpen`. This means commands registered after the palette first opens are invisible until it re-opens. Extension-contributed commands show up only on the second open. Moving to a Zustand store with reactive subscription fixes this.

### Target Implementation Pattern

Follow the exact pattern from `bladeRegistry.ts`:

1. **Zustand store** with `create()` + `devtools()` middleware
2. **Store state** holds `commands: Map<string, Command>` (immutable updates via `new Map()`)
3. **Computed getters** as store methods (e.g., `getEnabledCommands`, `getOrderedCategories`)
4. **Backward-compatible function exports** that delegate to `useCommandRegistry.getState()`
5. **Hook export** `useCommandRegistry` for components needing reactive subscriptions

**Consumer impact (25+ files):** Zero breaking changes. All existing imports of `registerCommand`, `getCommands`, `getEnabledCommands`, `getOrderedCategories`, `getCommandById`, `executeCommand`, `unregisterCommand`, `unregisterCommandsBySource` continue working unchanged via backward-compat function exports.

**CommandPalette improvement:** Replace `useMemo(() => getEnabledCommands(), [isOpen])` with `useCommandRegistry((s) => s.commands)` + derived memo. Commands become reactive -- new extension commands appear instantly.

### Files Affected

| File | Change Type |
|---|---|
| `src/lib/commandRegistry.ts` | Rewrite to Zustand store + backward-compat exports |
| `src/components/command-palette/CommandPalette.tsx` | Subscribe to store hook for reactivity |
| `src/extensions/ExtensionAPI.ts` | No change (already uses `registerCommand`/`unregisterCommand` functions) |
| `src/commands/*.ts` (8 files) | No change (all use `registerCommand()` function) |
| `src/blades/extension-detail/ExtensionDetailBlade.tsx` | No change (uses `getCommands()` function) |
| `src/lib/fuzzySearch.ts` | No change (imports `Command` type only) |

## Detailed Migration Plan: previewRegistry

### Current Implementation (src/lib/previewRegistry.ts)

```typescript
// Plain sorted array -- not reactive
const registry: PreviewRegistration[] = [];

export function registerPreview(config: PreviewRegistration): void {
  registry.push(config);
  registry.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
```

**Problem:** Non-reactive, no devtools visibility, no source tracking for extension cleanup.

### Target Implementation Pattern

1. **Zustand store** with `create()` + `devtools()` middleware
2. **Store state** holds `previews: Map<string, PreviewRegistration>` (keyed by `key` field)
3. **`getPreviewForFile` as store method** -- iterates priority-sorted entries, returns first match
4. **Add `source` field** to `PreviewRegistration` for extension cleanup
5. **Add `unregisterBySource`** method for extension deactivation
6. **Backward-compatible function exports** for `registerPreview()` and `getPreviewForFile()`

### Files Affected

| File | Change Type |
|---|---|
| `src/lib/previewRegistry.ts` | Rewrite to Zustand store + backward-compat exports |
| `src/blades/staging-changes/components/previewRegistrations.ts` | No change (uses `registerPreview()` function) |
| `src/blades/staging-changes/components/StagingDiffPreview.tsx` | No change (uses `getPreviewForFile()` function) |

## Extension Extraction: What Moves Where

### Topology Graph Extension

**Current locations -> Extension directory:**

| Source | Destination | Notes |
|---|---|---|
| `src/blades/topology-graph/TopologyRootBlade.tsx` | `src/extensions/topology-graph/blades/TopologyRootBlade.tsx` | Component moves |
| `src/blades/topology-graph/components/*` (6 files) | `src/extensions/topology-graph/components/*` | All subcomponents |
| `src/blades/topology-graph/registration.ts` | DELETED | Replaced by extension activate |
| `src/hooks/useCommitGraph.ts` | `src/extensions/topology-graph/hooks/useCommitGraph.ts` | Hook moves with extension |
| `src/stores/domain/git-ops/topology.slice.ts` | **Stays in GitOpsStore** | See "Slice Coupling" below |

**New files to create:**

| File | Purpose |
|---|---|
| `src/extensions/topology-graph/index.ts` | `onActivate`/`onDeactivate` with `coreOverride: true` |

**Registration pattern (follows gitflow/content-viewers):**

```typescript
// src/extensions/topology-graph/index.ts
import { lazy } from "react";
import type { ExtensionAPI } from "../ExtensionAPI";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const TopologyRootBlade = lazy(() =>
    import("./blades/TopologyRootBlade").then(m => ({ default: m.TopologyRootBlade }))
  );

  api.registerBlade({
    type: "topology-graph",
    title: "Topology",
    component: TopologyRootBlade,
    lazy: true,
    wrapInPanel: false,
    showBack: false,
    coreOverride: true,
  });
}

export function onDeactivate(): void {}
```

**Critical dependency: Navigation machine.** `src/machines/navigation/actions.ts` hardcodes `"topology-graph"` as the root blade for the "topology" process. With `coreOverride: true`, the blade type name stays `"topology-graph"` (not `"ext:topology-graph:topology-graph"`), so the navigation machine continues to work unchanged.

### Worktree Management Extension

**Current locations -> Extension directory:**

| Source | Destination | Notes |
|---|---|---|
| `src/components/worktree/WorktreePanel.tsx` | `src/extensions/worktree-management/components/WorktreePanel.tsx` | Component moves |
| `src/components/worktree/WorktreeItem.tsx` | `src/extensions/worktree-management/components/WorktreeItem.tsx` | Component moves |
| `src/components/worktree/CreateWorktreeDialog.tsx` | `src/extensions/worktree-management/components/CreateWorktreeDialog.tsx` | Component moves |
| `src/components/worktree/DeleteWorktreeDialog.tsx` | `src/extensions/worktree-management/components/DeleteWorktreeDialog.tsx` | Component moves |
| `src/components/worktree/index.ts` | DELETED | Replaced by extension activate |
| `src/stores/domain/git-ops/worktrees.slice.ts` | **Stays in GitOpsStore** | See "Slice Coupling" below |

**New files to create:**

| File | Purpose |
|---|---|
| `src/extensions/worktree-management/index.ts` | `onActivate`/`onDeactivate` |

**Registration pattern:** Worktrees currently render as a hardcoded sidebar section in `RepositoryView.tsx` (lines 188-209). The extension should use `api.contributeSidebarPanel()` to register it dynamically, matching how the Gitflow extension contributes its panel. The panel component must be self-contained, handling its own Create/Delete dialogs internally (not relying on RepositoryView state).

**Critical dependency: RepositoryView.tsx.** The hardcoded `<details>` block with `<WorktreePanel>`, `<CreateWorktreeDialog>`, and `<DeleteWorktreeDialog>` must be removed. Dialog state (`showWorktreeDialog`, `worktreeToDelete`) currently lives in RepositoryView -- this state must move into the extension's self-contained panel component.

**Command palette:** The `commandRegistry.ts` already defines `CoreCommandCategory` including `"Worktrees"`. The extension should register worktree commands via `api.registerCommand()` with category `"Worktrees"`.

### Init Repo Extension

**Current locations -> Extension directory:**

| Source | Destination | Notes |
|---|---|---|
| `src/blades/init-repo/InitRepoBlade.tsx` | `src/extensions/init-repo/blades/InitRepoBlade.tsx` | Component moves |
| `src/blades/init-repo/components/*` (6 files) | `src/extensions/init-repo/components/*` | All subcomponents |
| `src/blades/init-repo/store.ts` | `src/extensions/init-repo/store.ts` | Self-contained blade store moves |
| `src/blades/init-repo/registration.ts` | DELETED | Replaced by extension activate |

**New files to create:**

| File | Purpose |
|---|---|
| `src/extensions/init-repo/index.ts` | `onActivate`/`onDeactivate` with `coreOverride: true` |

**Critical dependency: WelcomeView.tsx.** Currently imports `InitRepoBlade` directly from `src/blades/init-repo` (line 11). After extraction, two options exist:

| Option | Approach | Tradeoff |
|---|---|---|
| **A: Re-export from extension path** | WelcomeView imports from `src/extensions/init-repo/blades/InitRepoBlade` | Simple, acceptable coupling for built-in extension |
| **B: Dynamic blade lookup** | WelcomeView calls `openBlade("init-repo", { directoryPath })` | Architecturally cleaner but requires blade navigation in welcome context |

**Recommendation: Option A** because WelcomeView renders InitRepoBlade inline (not as a blade in the stack). The welcome screen has no blade navigation context. Option B would require significant refactoring of the welcome flow.

## Slice Coupling Analysis

### Topology Slice -- Keep in GitOpsStore

The `topologySlice` lives inside `GitOpsStore` as a combined Zustand slice. It calls `commands.getCommitGraph()` (Tauri binding) -- no coupling to other slices.

**Why keep it in GitOpsStore:**
- Store reset via `registerStoreForReset(useGitOpsStore)` resets topology state on repo close
- Extracting into standalone store requires new reset registration, new devtools naming -- churn with no user benefit
- Precedent: the gitflow extension already imports `useGitOpsStore` from core for its slice data
- The extension components import `useGitOpsStore` to read topology state -- same pattern as gitflow

### Worktree Slice -- Keep in GitOpsStore

The worktree slice calls Tauri bindings and one cross-slice method (`get().openRepository()`) for `switchToWorktree`.

**Why keep it in GitOpsStore:**
- `switchToWorktree` calls `openRepository()` from the repository slice -- this cross-slice dependency requires the combined store
- Same reset pattern reasoning as topology
- Extension components import `useGitOpsStore` to read worktree state

### Init Repo Store -- Move with Extension

The init-repo blade uses `createBladeStore("init-repo", ...)` -- completely self-contained, not part of GitOpsStore. Zero coupling to any other slice.

**Action:** Move `store.ts` into `src/extensions/init-repo/store.ts`. No coupling concerns.

## BladePropsMap and _discovery.ts Updates

### BladePropsMap (src/stores/bladeTypes.ts)

The `BladePropsMap` interface includes `"topology-graph"` and `"init-repo"`. With `coreOverride: true`, these blade type strings are preserved.

**Action:** Keep entries in BladePropsMap. They provide type checking for `openBlade()` calls. Extensions that use coreOverride intentionally preserve core blade type names.

### _discovery.ts (src/blades/_discovery.ts)

The blade discovery module uses `import.meta.glob("./*/registration.{ts,tsx}")` to scan for registrations. The `EXPECTED_TYPES` array includes `"topology-graph"` and `"init-repo"`.

**Action:**
1. Remove `"topology-graph"` and `"init-repo"` from the `EXPECTED_TYPES` array
2. Delete `src/blades/topology-graph/registration.ts` and `src/blades/init-repo/registration.ts`
3. Delete the now-empty blade directories (or keep as empty marker if preferred)

## ExtensionAPI Surface Area

### Existing Methods Sufficient for Extractions

| Method | Used By | Purpose |
|---|---|---|
| `registerBlade({ coreOverride: true })` | topology-graph, init-repo | Replace core blade registrations |
| `contributeSidebarPanel()` | worktree-management | Replace hardcoded sidebar section |
| `registerCommand()` | all three extensions | Command palette entries |
| `contributeToolbar()` | topology-graph (optional) | Toolbar button for topology view |
| `onDispose()` | worktree-management | Cleanup dialog state |

### New Method: registerPreview (Future-Proofing)

Once previewRegistry becomes a Zustand store with source tracking, adding `registerPreview()` to ExtensionAPI completes the registry API surface. This is not strictly required for v1.7.0 extractions but should be done alongside the previewRegistry migration for consistency.

```typescript
// Addition to ExtensionAPI.ts
registerPreview(config: ExtensionPreviewConfig): void {
  const namespacedKey = `ext:${this.extensionId}:${config.key}`;
  usePreviewRegistry.getState().register({
    ...config,
    key: namespacedKey,
    source: `ext:${this.extensionId}`,
  });
  this.registeredPreviews.push(namespacedKey);
}
```

### ExtensionAPI cleanup() -- Already Handles All Registries

The `cleanup()` method in ExtensionAPI already calls `unregisterBySource` on all Zustand-backed registries. After migrating commandRegistry and previewRegistry to Zustand stores, their cleanup must be added to this method:

```typescript
// Add to cleanup() in ExtensionAPI.ts
useCommandRegistry.getState().unregisterBySource(`ext:${this.extensionId}`);
usePreviewRegistry.getState().unregisterBySource(`ext:${this.extensionId}`);
```

## App.tsx Registration Updates

Three new `registerBuiltIn()` calls need adding to `src/App.tsx` (following the pattern of the existing four):

```typescript
// After existing registerBuiltIn calls (lines 62-93)
registerBuiltIn({
  id: "topology-graph",
  name: "Topology Graph",
  version: "1.0.0",
  activate: topologyActivate,
  deactivate: topologyDeactivate,
});

registerBuiltIn({
  id: "worktree-management",
  name: "Worktree Management",
  version: "1.0.0",
  activate: worktreeActivate,
  deactivate: worktreeDeactivate,
});

registerBuiltIn({
  id: "init-repo",
  name: "Init Repository",
  version: "1.0.0",
  activate: initRepoActivate,
  deactivate: initRepoDeactivate,
});
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Registry reactivity | Zustand store migration | RxJS / EventEmitter | Zustand is already used for 5 other registries; adding RxJS introduces a new paradigm |
| Registry reactivity | Zustand store migration | React context + useReducer | Cannot be used outside React components; registries are imported by non-component code |
| Topology slice location | Keep in GitOpsStore | Standalone Zustand store | Larger refactor, breaks `registerStoreForReset` pattern, no user benefit |
| Worktree dialog handling | Self-contained in extension panel | Portal dialogs from RepositoryView | Extension must be self-contained for toggle-ability |
| Init repo in WelcomeView | Import from extension path | Dynamic blade navigation | WelcomeView renders InitRepoBlade inline before any repo is open; blade navigation requires a repo context |
| ViewerRegistry migration | Migrate to Zustand with others | Leave as-is | ViewerRegistry (`src/components/viewers/ViewerRegistry.ts`) is similar to previewRegistry (plain array); consistency argues for migrating all non-Zustand registries at once |

## What NOT to Add

| Technology | Why Not |
|---|---|
| **No new npm packages** | Everything needed is in the current deps |
| **No event emitter library** | Zustand subscriptions provide reactivity |
| **No state machine for extension lifecycle** | Extension lifecycle is simple activate/deactivate; XState would be overengineering |
| **No plugin architecture overhaul** | The current ExtensionHost + ExtensionAPI pattern is proven with 4 extensions |
| **No separate stores for topology/worktree state** | Slice coupling with GitOpsStore is manageable; extraction adds complexity without benefit |

## ViewerRegistry: Also Migrate?

The `ViewerRegistry` (`src/components/viewers/ViewerRegistry.ts`) has the same plain-array pattern as previewRegistry. It should be evaluated for Zustand migration alongside previewRegistry for consistency. However, it has only 2 consumers and no extension integration, so it could be deferred if scope needs trimming.

**Recommendation:** Include ViewerRegistry migration in this milestone since the pattern is identical and the effort is minimal (< 30 min). This achieves "all registries are Zustand stores" completion.

## Verification Notes

| Claim | Source | Confidence |
|---|---|---|
| Zustand 5.0.11 installed | `node_modules/zustand/package.json` | HIGH |
| bladeRegistry Zustand pattern works | `src/lib/bladeRegistry.ts` -- 26 consumers, backward-compat exports | HIGH |
| coreOverride preserves blade type name | `ExtensionAPI.registerBlade()` lines 164-166 | HIGH |
| Navigation machine hardcodes topology-graph | `src/machines/navigation/actions.ts` line 13 | HIGH |
| commandRegistry has 25+ consumer call sites | grep count across src/ | HIGH |
| previewRegistry has 3 consumer files | grep count across src/ | HIGH |
| RepositoryView hardcodes worktree section | `src/components/RepositoryView.tsx` lines 188-209 | HIGH |
| WelcomeView imports InitRepoBlade directly | `src/components/WelcomeView.tsx` line 11 | HIGH |
| Init repo store uses createBladeStore (self-contained) | `src/blades/init-repo/store.ts` line 1 | HIGH |
| Topology/worktree slices are in combined GitOpsStore | `src/stores/domain/git-ops/index.ts` lines 11-12, 18-19 | HIGH |
| Worktree slice has cross-slice dependency on openRepository | `src/stores/domain/git-ops/worktrees.slice.ts` line 76 | HIGH |

## Installation

```bash
# No new packages to install.
# The milestone is a pure refactoring of existing code.
```

## Sources

All findings are from direct codebase inspection (HIGH confidence):
- `src/lib/bladeRegistry.ts` -- Zustand registry store pattern reference
- `src/lib/commandRegistry.ts` -- Migration target (plain Map, 110 lines)
- `src/lib/previewRegistry.ts` -- Migration target (plain array, 31 lines)
- `src/lib/contextMenuRegistry.ts` -- Zustand registry pattern reference (Map-based)
- `src/lib/toolbarRegistry.ts` -- Zustand registry pattern reference
- `src/lib/sidebarPanelRegistry.ts` -- Zustand registry pattern reference
- `src/lib/statusBarRegistry.ts` -- Zustand registry pattern reference
- `src/components/viewers/ViewerRegistry.ts` -- Additional plain-array registry
- `src/extensions/ExtensionAPI.ts` -- Extension facade with coreOverride (449 lines)
- `src/extensions/ExtensionHost.ts` -- Extension lifecycle management (407 lines)
- `src/extensions/gitflow/index.ts` -- Reference coreOverride extension pattern
- `src/extensions/content-viewers/index.ts` -- Reference coreOverride extension pattern
- `src/extensions/conventional-commits/index.ts` -- Reference coreOverride extension pattern
- `src/blades/topology-graph/` -- Extraction source (6 component files + registration)
- `src/blades/topology-graph/components/TopologyPanel.tsx` -- Primary topology component
- `src/hooks/useCommitGraph.ts` -- Topology hook to move with extension
- `src/components/worktree/` -- Extraction source (4 component files + index)
- `src/blades/init-repo/` -- Extraction source (7 files + registration + store)
- `src/blades/init-repo/store.ts` -- Self-contained createBladeStore (131 lines)
- `src/stores/domain/git-ops/index.ts` -- Combined store with topology + worktree slices
- `src/stores/domain/git-ops/topology.slice.ts` -- Topology state (103 lines)
- `src/stores/domain/git-ops/worktrees.slice.ts` -- Worktree state with openRepository cross-slice dep
- `src/machines/navigation/actions.ts` -- Hardcoded topology-graph root blade
- `src/components/RepositoryView.tsx` -- Hardcoded worktree sidebar section (243 lines)
- `src/components/WelcomeView.tsx` -- Direct InitRepoBlade import
- `src/blades/_discovery.ts` -- Blade glob-based registration + EXPECTED_TYPES check
- `src/stores/bladeTypes.ts` -- BladePropsMap with topology-graph + init-repo entries
- `src/App.tsx` -- Built-in extension registration point (4 existing, 3 to add)
- `src/components/command-palette/CommandPalette.tsx` -- commandRegistry consumer (reactive fix target)
