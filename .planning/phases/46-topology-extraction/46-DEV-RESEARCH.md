# Phase 46: Topology Extraction - Expert Developer Research

**Researched:** 2026-02-11
**Domain:** Extension architecture, React component refactoring, Tauri integration, Tailwind v4
**Confidence:** HIGH
**Perspective:** Expert Developer (Tauri, Rust, React, Tailwind v4)

## Summary

The topology graph is currently hardcoded across multiple core locations: a blade registration in `src/core/blades/topology-graph/`, a Zustand slice in `src/core/stores/domain/git-ops/topology.slice.ts`, a custom hook in `src/core/hooks/useCommitGraph.ts`, keyboard shortcuts in `useKeyboardShortcuts.ts`, navigation commands in `src/core/commands/navigation.ts`, file watcher auto-refresh logic in `App.tsx`, the `ProcessNavigation` component, the `rootBladeForProcess()` action helper, settings default tab options, and the `BladePropsMap` type registry. Extracting this to a toggleable extension requires moving components, contributing the blade via `api.registerBlade()` with `coreOverride: true`, contributing the keyboard shortcut as a command, making the ProcessNavigation dynamically respond to blade registry state (already partially done), and replacing the hardcoded file watcher topology refresh with an extension-scoped mechanism.

The codebase has 12 existing built-in extensions with well-established patterns. The topology extension will be the 13th. The convention is: `manifest.json` + `index.ts` entry point with `onActivate`/`onDeactivate` + `components/` + `blades/` + optional `hooks/`, `lib/`, `store.ts`. The init-repo extension establishes the `coreOverride` blade pattern. The worktrees extension establishes the sidebar panel + CustomEvent pattern. Both provide strong precedents.

**Primary recommendation:** Extract topology as a built-in extension using `coreOverride: true` for the blade, move the topology slice/hook into the extension, contribute Cmd+2 as a command, hook into the `repository-changed` event via `api.onDispose()` pattern, and create a `SimpleCommitList` fallback component in core that the navigation machine uses when the `topology-graph` blade is unregistered.

---

## Extension File Structure

### Established Convention (HIGH confidence)

Every existing extension follows this structure, documented in extension READMEs:

```
extension-name/
├── README.md          # Extension documentation
├── manifest.json      # Extension metadata (id, name, version, apiVersion, contributes)
├── index.ts           # Entry point (onActivate / onDeactivate)
├── blades/            # Blade components (lazy-loaded)
├── components/        # Shared UI components
├── hooks/             # React hooks
├── lib/               # Utility functions
├── store.ts           # Zustand stores (if needed)
└── types.ts           # Extension-specific types
```

### Proposed Topology Extension Structure

```
src/extensions/topology/
├── README.md
├── manifest.json
├── index.ts                              # onActivate / onDeactivate
├── blades/
│   └── TopologyRootBlade.tsx             # Moved from core (lazy-loaded)
├── components/
│   ├── TopologyPanel.tsx                 # SVG graph renderer
│   ├── TopologyEmptyState.tsx            # Empty state with "Go to Changes" CTA
│   ├── CommitBadge.tsx                   # Individual commit badge in graph
│   ├── LaneHeader.tsx                    # Branch lane header strip
│   ├── LaneBackground.tsx                # SVG lane background
│   └── index.ts                          # Barrel export
├── hooks/
│   └── useCommitGraph.ts                 # Moved from core/hooks/
├── lib/
│   └── layoutUtils.ts                    # Graph layout computation
└── store.ts                              # Topology slice (extracted from GitOps)
```

### Manifest Design

```json
{
  "id": "topology",
  "name": "Topology Graph",
  "version": "1.0.0",
  "description": "Commit graph visualization with branch lane layout and history view.",
  "apiVersion": "1",
  "main": "index.ts",
  "contributes": {
    "blades": [
      { "type": "topology-graph", "title": "Topology", "singleton": true }
    ],
    "commands": [
      { "id": "show-topology", "title": "Show History", "category": "Navigation" },
      { "id": "open-commit-details", "title": "Open Commit Details", "category": "Navigation" }
    ],
    "toolbar": null
  },
  "permissions": null,
  "trustLevel": "built-in"
}
```

---

## Component Decomposition

### What Moves to the Extension (HIGH confidence)

| Current Location | Destination | Notes |
|------------------|-------------|-------|
| `src/core/blades/topology-graph/TopologyRootBlade.tsx` | `src/extensions/topology/blades/TopologyRootBlade.tsx` | Lazy-loaded via `React.lazy()` |
| `src/core/blades/topology-graph/components/TopologyPanel.tsx` | `src/extensions/topology/components/TopologyPanel.tsx` | Main graph renderer |
| `src/core/blades/topology-graph/components/TopologyEmptyState.tsx` | `src/extensions/topology/components/TopologyEmptyState.tsx` | Empty state |
| `src/core/blades/topology-graph/components/CommitBadge.tsx` | `src/extensions/topology/components/CommitBadge.tsx` | Commit badge |
| `src/core/blades/topology-graph/components/LaneHeader.tsx` | `src/extensions/topology/components/LaneHeader.tsx` | Lane header |
| `src/core/blades/topology-graph/components/LaneBackground.tsx` | `src/extensions/topology/components/LaneBackground.tsx` | Lane SVG background |
| `src/core/blades/topology-graph/components/layoutUtils.ts` | `src/extensions/topology/lib/layoutUtils.ts` | Layout computation |
| `src/core/hooks/useCommitGraph.ts` | `src/extensions/topology/hooks/useCommitGraph.ts` | Graph data hook |
| `src/core/stores/domain/git-ops/topology.slice.ts` | `src/extensions/topology/store.ts` | Standalone Zustand store |
| `src/core/blades/topology-graph/registration.ts` | **DELETED** | Replaced by `api.registerBlade()` |
| `src/core/blades/topology-graph/index.ts` | **DELETED** | No longer needed |
| `src/core/blades/topology-graph/TopologyRootBlade.test.tsx` | `src/extensions/topology/__tests__/TopologyRootBlade.test.tsx` | Test file |

### What Stays in Core (HIGH confidence)

| Item | Location | Reason |
|------|----------|--------|
| `CommitHistory` component | `src/core/components/commit/CommitHistory.tsx` | Used as the **fallback** when topology is disabled; also used within the topology blade's "History" tab |
| `branchClassifier.ts` | `src/core/lib/branchClassifier.ts` | Shared utility used by multiple features (branches panel, etc.) |
| `ProcessNavigation` component | `src/core/blades/_shared/ProcessNavigation.tsx` | Core navigation UI; already dynamically checks blade registry |
| `BladePropsMap` type | `src/core/stores/bladeTypes.ts` | Must keep `"topology-graph"` entry for type safety with `coreOverride` |
| `rootBladeForProcess()` | `src/core/machines/navigation/actions.ts` | Needs modification: return fallback blade when topology is disabled |
| `navigationMachine` | `src/core/machines/navigation/navigationMachine.ts` | Core infrastructure |

### Cross-Extension Dependency: CommitBadge imports from conventional-commits

**Current:** `CommitBadge.tsx` imports `COMMIT_TYPE_THEME` from `src/extensions/conventional-commits/lib/commit-type-theme.ts` and `parseConventionalMessage` (via `layoutUtils.ts`) from `src/extensions/conventional-commits/lib/conventional-utils.ts`.

**Also:** `CommitTypeIcon` in core imports `parseConventionalType` from topology's `layoutUtils.ts`.

**Strategy:** Keep `parseConventionalType` in `layoutUtils.ts` within the topology extension. For `CommitTypeIcon` in core, it currently imports from `../../blades/topology-graph/components/layoutUtils`. After extraction, this import breaks. Two options:

1. **Move `parseConventionalType` to `branchClassifier.ts`** (in core/lib/) since it's really a classification utility, not topology-specific. Then both core `CommitTypeIcon` and the topology extension import from the same core location. (RECOMMENDED)
2. Make `CommitTypeIcon` import directly from the conventional-commits extension's `conventional-utils.ts`.

Option 1 is cleaner because it avoids core depending on an extension. The function is trivial -- it delegates to `parseConventionalMessage` from conventional-commits. Move the `parseConventionalMessage` delegation to core lib.

**Resolution:** Move `parseConventionalType()` to `src/core/lib/commitClassifier.ts` (new small file). Update imports in both `CommitTypeIcon` (core) and `CommitBadge` (topology extension).

---

## Tauri/Rust Integration

### Topology Tauri Commands (HIGH confidence)

The topology uses exactly one Tauri command: `commands.getCommitGraph(limit, offset)`.

- **Rust location:** `src-tauri/src/git/graph.rs`
- **Rust function:** `get_commit_graph(limit: u32, offset: u32) -> CommitGraph`
- **TypeScript binding:** Auto-generated in `src/bindings.ts` (via `specta`)
- **Types:** `GraphNode`, `GraphEdge`, `CommitGraph`, `BranchType` -- all generated from Rust

**No Rust changes needed.** The Tauri commands remain in the Rust crate. The TypeScript extension imports from `../../bindings` just like other extensions do (e.g., `src/extensions/init-repo/index.ts` imports `commands` from `../../bindings`).

### File Watcher Integration (HIGH confidence)

**Rust side:** `src-tauri/src/git/watcher.rs` uses `notify` + `notify_debouncer_mini` to watch the repo directory recursively. Emits `"repository-changed"` events to the Tauri frontend with 500ms debounce.

**Frontend side (current in App.tsx, lines 262-289):**
```typescript
listen<{ paths: string[] }>("repository-changed", (event) => {
  // ...invalidate queries...
  // Auto-refresh topology if it has been loaded
  const topologyState = useTopologyStore.getState();
  if (topologyState.nodes.length > 0) {
    topologyState.loadGraph();
  }
});
```

**Problem:** This directly references `useTopologyStore` from core. When topology becomes an extension, this code must be removed from `App.tsx`.

**Solution:** The topology extension registers a `repository-changed` listener in its `onActivate()`:

```typescript
// In topology extension's onActivate:
const unlisten = await listen<{ paths: string[] }>("repository-changed", () => {
  const state = useTopologyStore.getState();
  if (state.nodes.length > 0) {
    state.loadGraph();
  }
});
api.onDispose(() => { unlisten.then(fn => fn()); });
```

This is the same `listen()` from `@tauri-apps/api/event` that `App.tsx` uses. When the extension is deactivated, the `onDispose` callback cleans up the listener. This satisfies TOPO-02 (file watcher auto-refresh triggers topology reload only when topology extension is active).

---

## Tailwind v4 Styling Strategy

### Current Topology CSS Usage (HIGH confidence)

The topology components use standard Catppuccin theme tokens via Tailwind v4 utility classes:

**Color tokens used:**
- `bg-ctp-mantle`, `bg-ctp-crust`, `bg-ctp-base`, `bg-ctp-surface0`, `bg-ctp-surface1`
- `text-ctp-text`, `text-ctp-subtext0`, `text-ctp-subtext1`, `text-ctp-overlay0`, `text-ctp-overlay1`
- `text-ctp-red`, `text-ctp-blue`
- `border-ctp-surface0`
- `ring-ctp-blue`, `ring-offset-ctp-base`

**SVG colors (hex):** Defined in `branchClassifier.ts` as `BRANCH_HEX_COLORS` -- Catppuccin Mocha hex values (`#89b4fa`, `#a6e3a1`, etc.). These are NOT Tailwind classes but raw hex for SVG fill/stroke.

**Badge styles:** `BRANCH_BADGE_STYLES` from `branchClassifier.ts` -- composite Tailwind class strings like `"border-ctp-blue bg-ctp-blue/10 hover:bg-ctp-blue/20"`.

### Strategy: No special handling needed

All styling uses the global Catppuccin theme tokens that are defined in the main `@theme {}` block. Moving components to the extension directory does not affect Tailwind class resolution because:

1. Tailwind v4 scans all `.tsx` files in `src/` (the content paths include `src/**/*.tsx`)
2. The `--ctp-*` custom properties are global CSS variables
3. The hex colors for SVG are hardcoded constants, not CSS classes

**No extension-scoped CSS files needed.** No theme token changes. No Tailwind configuration changes.

---

## Fallback Commit List Design

### Requirement (from TOPO-01)

When the topology extension is disabled, the app must show a "simple commit list fallback" instead of crashing. The topology process tab should also be hidden.

### Design: Core `SimpleCommitList` Component (HIGH confidence)

The existing `CommitHistory` component at `src/core/components/commit/CommitHistory.tsx` is already in core and provides a virtualized, searchable commit list. It's currently used as the "History" sub-tab within `TopologyRootBlade`.

**Two approaches:**

**Option A: Reuse `CommitHistory` directly as the fallback blade component.**
- Create a thin wrapper `CommitListFallbackBlade` in core that renders `CommitHistory` with `onCommitSelect` wired to `openBlade("commit-details", { oid })`.
- Register this as a core blade registration (always available).
- `rootBladeForProcess("topology")` returns this blade type when `topology-graph` is not in the blade registry.

**Option B: The navigation machine never switches to `topology` when extension is disabled.**
- The `ProcessNavigation` component already hides the topology tab when `topology-graph` blade is not registered (line 25: `blades.has("topology-graph")`).
- The `SWITCH_PROCESS` event for `topology` should be intercepted and redirected to `staging`.

**Recommended: Combine both approaches.**

1. `ProcessNavigation` already hides the topology tab (DONE -- already implemented).
2. `ProcessNavigation` already auto-falls back to staging when topology tab disappears mid-session (lines 29-33: `useEffect` switches to staging if `activeProcess === "topology"` and blade is not registered).
3. The `rootBladeForProcess()` function in `actions.ts` should check the blade registry and fall back:

```typescript
export function rootBladeForProcess(process: ProcessType): TypedBlade {
  if (process === "staging") {
    return { id: "root", type: "staging-changes", title: "Changes", props: {} };
  }
  // Topology: check if blade is registered
  const hasTopology = useBladeRegistry.getState().blades.has("topology-graph");
  if (hasTopology) {
    return { id: "root", type: "topology-graph", title: "Topology", props: {} };
  }
  // Fallback: simple commit list
  return { id: "root", type: "commit-list-fallback", title: "History", props: {} };
}
```

4. Create a minimal `CommitListFallbackBlade` in `src/core/blades/commit-list-fallback/`:

```typescript
// CommitListFallbackBlade.tsx
export function CommitListFallbackBlade() {
  const { openBlade } = useBladeNavigation();
  return <CommitHistory onCommitSelect={(oid) => openBlade("commit-details", { oid })} />;
}
```

5. Register it via `src/core/blades/commit-list-fallback/registration.ts` (core, always available).

This ensures:
- If topology is enabled: `rootBladeForProcess("topology")` returns `topology-graph` blade.
- If topology is disabled: falls back to `commit-list-fallback` blade showing `CommitHistory`.
- `ProcessNavigation` hides the "Topology" tab but could optionally show a "History" tab pointing to the fallback. OR, the topology tab simply disappears and the fallback is only reachable via settings default tab.

### Settings Default Tab Fallback (TOPO-04)

The `GeneralSettings` component shows "Topology" as a default tab option. When topology is disabled:
- The tab option should be hidden or disabled in settings.
- If the stored `defaultTab` is `"topology"`, `App.tsx` init code must fall back to `"changes"`.

Current code in `App.tsx`:
```typescript
if (defaultTab === "topology" || defaultTab === "history") {
  getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
}
```

This should be guarded:
```typescript
if ((defaultTab === "topology" || defaultTab === "history") && blades.has("topology-graph")) {
  getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
}
```

---

## Event System Usage

### CustomEvent Pattern (established in Phase 44) (HIGH confidence)

The worktrees extension uses `document.dispatchEvent(new CustomEvent("worktree:open-create-dialog"))` for cross-component communication. The topology extension should use the same pattern if needed.

### ExtensionEventBus Pattern

The `extensionEventBus` at `src/extensions/extensionEventBus.ts` provides pub/sub for inter-extension communication. Events are namespaced as `ext:{extensionId}:{event}`.

### Topology Events Needed

The topology extension does not need to communicate with other extensions. Its primary events are:

1. **File watcher refresh** -- handled via Tauri `listen("repository-changed", ...)` within the extension.
2. **Commit selection** -- internal to the topology blade, uses `openBlade("commit-details", { oid })`.
3. **Keyboard shortcut Cmd+2** -- contributed as a command, triggers `SWITCH_PROCESS`.

No CustomEvent dispatching is needed for topology itself. The `TopologyEmptyState` component dispatches `SWITCH_PROCESS` to the navigation actor directly, which is fine since it imports from core.

---

## Extension Lifecycle

### Activation (HIGH confidence)

The `onActivate(api: ExtensionAPI)` function should:

1. **Register the topology-graph blade** with `coreOverride: true`:
   ```typescript
   const TopologyRootBlade = lazy(() => import("./blades/TopologyRootBlade").then(m => ({ default: m.TopologyRootBlade })));
   api.registerBlade({
     type: "topology-graph",
     title: "Topology",
     component: TopologyRootBlade,
     singleton: true,
     lazy: true,
     wrapInPanel: false,
     showBack: false,
     coreOverride: true,
   });
   ```

2. **Register "Show History" command** (replacing the hardcoded one in `src/core/commands/navigation.ts`):
   ```typescript
   api.registerCommand({
     id: "show-topology",
     title: "Show History",
     description: "Switch to the topology (history) view",
     category: "Navigation",
     shortcut: "mod+2",
     icon: History,
     action: () => {
       getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
     },
     enabled: () => !!useRepositoryStore.getState().repoStatus,
   });
   ```

3. **Register "Open Commit Details" command** (for Enter key on selected commit):
   ```typescript
   api.registerCommand({
     id: "open-commit-details",
     title: "Open Commit Details",
     description: "Open details for the selected commit in the topology view",
     category: "Navigation",
     icon: GitCommit,
     action: () => {
       const ctx = getNavigationActor().getSnapshot().context;
       const topologyStore = useTopologyStore.getState();
       if (ctx.activeProcess === "topology" && topologyStore.topologySelectedCommit) {
         openBlade("commit-details", { oid: topologyStore.topologySelectedCommit });
       }
     },
     enabled: () => {
       const ctx = getNavigationActor().getSnapshot().context;
       return ctx.activeProcess === "topology" && !!useTopologyStore.getState().topologySelectedCommit;
     },
   });
   ```

4. **Register file watcher listener** for auto-refresh:
   ```typescript
   const unlistenPromise = listen<{ paths: string[] }>("repository-changed", () => {
     const state = useTopologyStore.getState();
     if (state.nodes.length > 0) {
       state.loadGraph();
     }
   });
   api.onDispose(() => { unlistenPromise.then(fn => fn()); });
   ```

5. **Register cleanup for topology store**:
   ```typescript
   api.onDispose(() => { useTopologyStore.getState().resetTopology(); });
   ```

### Deactivation (HIGH confidence)

The `onDeactivate()` function should:
- Call `resetTopology()` on the store to clear cached graph data.
- The `api.cleanup()` method (called by ExtensionHost) automatically:
  - Unregisters the `topology-graph` blade (triggers `ProcessNavigation` to auto-switch away).
  - Unregisters the commands (removes shortcut contribution).
  - Runs disposables (stops the file watcher listener).

```typescript
export function onDeactivate(): void {
  useTopologyStore.getState().resetTopology();
}
```

### Graceful Degradation Flow

When topology is deactivated:
1. `api.cleanup()` unregisters `topology-graph` blade from `useBladeRegistry`.
2. `ProcessNavigation` component's `useMemo` recomputes `visibleProcesses` -- topology tab disappears.
3. `ProcessNavigation`'s `useEffect` detects `activeProcess === "topology"` with unregistered blade -- sends `SWITCH_PROCESS` to `staging`.
4. Navigation machine resets blade stack to `rootBladeForProcess("staging")`.
5. Cmd+2 shortcut no longer exists in command registry -- keypress does nothing.
6. File watcher no longer triggers topology refresh (listener disposed).
7. Settings "default tab" topology option should be hidden (or at startup, guarded).

---

## Code Movement Plan

### Phase 1: Create extension skeleton

1. Create `src/extensions/topology/manifest.json`
2. Create `src/extensions/topology/index.ts` (onActivate/onDeactivate)

### Phase 2: Extract topology store

1. Create `src/extensions/topology/store.ts` -- standalone Zustand store (NOT a slice of GitOpsStore).
   - Copy `TopologySlice` interface and `createTopologySlice` logic.
   - Convert from StateCreator slice pattern to standalone `create()` store.
   - Import `commands` from `../../bindings`.
2. Remove `topology.slice.ts` from `src/core/stores/domain/git-ops/`.
3. Remove `TopologySlice` from `GitOpsStore` type union in `src/core/stores/domain/git-ops/index.ts`.
4. Remove `createTopologySlice` from the `create()` spread in `index.ts`.

### Phase 3: Move components

1. Move entire `src/core/blades/topology-graph/components/` directory to `src/extensions/topology/components/`.
2. Move `TopologyRootBlade.tsx` to `src/extensions/topology/blades/TopologyRootBlade.tsx`.
3. Move `useCommitGraph.ts` to `src/extensions/topology/hooks/useCommitGraph.ts`.
4. Move `layoutUtils.ts` to `src/extensions/topology/lib/layoutUtils.ts`.
5. Delete `src/core/blades/topology-graph/` directory entirely (registration.ts, index.ts, all contents).
6. Move `TopologyRootBlade.test.tsx` to `src/extensions/topology/__tests__/`.

### Phase 4: Fix cross-dependencies

1. Extract `parseConventionalType()` from `layoutUtils.ts` to `src/core/lib/commitClassifier.ts`.
2. Update `CommitTypeIcon` import from `../../blades/topology-graph/components/layoutUtils` to `../../lib/commitClassifier`.
3. Update `layoutUtils.ts` in topology extension to import `parseConventionalMessage` directly from conventional-commits extension (acceptable: extension-to-extension dependency).

### Phase 5: Create fallback

1. Create `src/core/blades/commit-list-fallback/CommitListFallbackBlade.tsx`.
2. Create `src/core/blades/commit-list-fallback/registration.ts`.
3. Add `"commit-list-fallback"` to `BladePropsMap` in `bladeTypes.ts`.
4. Add to `_discovery.ts` EXPECTED_TYPES array.

### Phase 6: Wire up extension

1. Update `rootBladeForProcess()` in `actions.ts` to check blade registry.
2. Remove "show-history" command from `src/core/commands/navigation.ts` (contributed by extension now).
3. Remove topology keyboard shortcuts from `useKeyboardShortcuts.ts` (Cmd+2, Enter for commit details).
4. Remove topology file watcher code from `App.tsx`.
5. Remove topology store imports from `App.tsx` and `useKeyboardShortcuts.ts`.
6. Register the topology extension in `App.tsx` registerBuiltIn block.
7. Guard settings default tab init code in `App.tsx`.

### Phase 7: Update settings

1. Update `GeneralSettings.tsx` to dynamically show/hide "Topology" option based on blade registry.
2. Guard the `App.tsx` init code that sends `SWITCH_PROCESS` for topology default tab.

---

## Import Path Strategy

### Current Import Patterns

Topology components currently import from core using relative paths like:
- `../../lib/utils` (cn utility)
- `../../hooks/useBladeNavigation`
- `../../../bindings` (Tauri commands)
- `../../../machines/navigation/context`

### After Move: Import Adjustments

From `src/extensions/topology/`, imports become:
- `../../core/lib/utils` (cn)
- `../../core/hooks/useBladeNavigation`
- `../../bindings` (Tauri commands -- same level as core)
- `../../core/machines/navigation/context`
- `../../core/stores/domain/git-ops` (for repoStatus only, NOT topology slice)
- `../../core/lib/bladeOpener`
- `../../core/lib/contextMenuRegistry`

The topology store becomes a local import:
- `../store` (from within the extension)

### Key Import Changes Table

| Component | Old Import | New Import |
|-----------|-----------|------------|
| TopologyPanel | `../../../hooks/useCommitGraph` | `../hooks/useCommitGraph` |
| TopologyPanel | `../../../lib/branchClassifier` | `../../../core/lib/branchClassifier` |
| CommitBadge | `../../../../bindings` | `../../../bindings` |
| CommitBadge | `../../../../extensions/conventional-commits/...` | `../../conventional-commits/...` |
| layoutUtils | `../../../../bindings` | `../../../bindings` |
| layoutUtils | `../../../lib/branchClassifier` | `../../../core/lib/branchClassifier` |
| useCommitGraph | `../stores/domain/git-ops` | `../store` (local topology store) |
| TopologyEmptyState | `../../../machines/navigation/context` | `../../../core/machines/navigation/context` |

---

## Extensibility Enforcement Patterns

### Pattern 1: Blade Registry Guard (Already Implemented)

`ProcessNavigation.tsx` line 25:
```typescript
const visibleProcesses = useMemo(
  () => ALL_PROCESSES.filter((p) => p.id === "staging" || blades.has("topology-graph")),
  [blades],
);
```

This is reactive -- when `topology-graph` is unregistered, the tab disappears immediately. **No changes needed.**

### Pattern 2: Navigation Auto-Fallback (Already Implemented)

`ProcessNavigation.tsx` lines 29-33:
```typescript
useEffect(() => {
  if (activeProcess === "topology" && !blades.has("topology-graph")) {
    actorRef.send({ type: "SWITCH_PROCESS", process: "staging" });
  }
}, [activeProcess, blades, actorRef]);
```

This catches the case where topology is the active process when it gets deactivated. **No changes needed.**

### Pattern 3: rootBladeForProcess Registry Check (NEW)

The `rootBladeForProcess()` function must check the blade registry before returning `topology-graph`. This prevents crashes if `SWITCH_PROCESS` somehow fires for topology when the blade is unregistered.

```typescript
import { useBladeRegistry } from "../../lib/bladeRegistry";

export function rootBladeForProcess(process: ProcessType): TypedBlade {
  if (process === "staging") {
    return { id: "root", type: "staging-changes", title: "Changes", props: {} as Record<string, never> };
  }
  if (useBladeRegistry.getState().blades.has("topology-graph")) {
    return { id: "root", type: "topology-graph", title: "Topology", props: {} as Record<string, never> };
  }
  return { id: "root", type: "commit-list-fallback", title: "History", props: {} as Record<string, never> };
}
```

### Pattern 4: Command Contribution Instead of Hardcoding

Currently `useKeyboardShortcuts.ts` hardcodes `mod+2` for topology and `enter` for opening commit details. These must be REMOVED from core and contributed via `api.registerCommand()` in the extension. When the extension is disabled, the commands are automatically unregistered.

**Important:** The command palette shortcut system already supports this -- `registerCommand` with a `shortcut` field makes it available via keyboard. The `useHotkeys` calls in core must be removed for topology-specific shortcuts.

### Pattern 5: Settings Guard

The `GeneralSettings` component should read from `useBladeRegistry` to conditionally show the "Topology" tab option:

```typescript
const blades = useBladeRegistry((s) => s.blades);
const topologyAvailable = blades.has("topology-graph");

const tabOptions = [
  { value: "changes", label: "Changes" },
  { value: "history", label: "History" },
  ...(topologyAvailable ? [{ value: "topology", label: "Topology" }] : []),
];
```

### Pattern 6: No Direct Imports from Extension to Core

After extraction, NO core file should import from `src/extensions/topology/`. This is the fundamental extensibility contract. Currently:
- `CommitTypeIcon` imports `parseConventionalType` from topology's `layoutUtils.ts` -- **must be moved to core** (Phase 4 above).
- No other core files import topology internals.

### Pattern 7: _discovery.ts Expected Types Update

Remove `"topology-graph"` from the `EXPECTED_TYPES` array in `_discovery.ts` since it's no longer a core blade registration. Add `"commit-list-fallback"` instead.

---

## Standard Stack

### Core (used by this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | Component framework | Project standard |
| Zustand | 4.x | State management | Project standard, used by all stores |
| react-hotkeys-hook | 4.x | Keyboard shortcuts | Project standard |
| @tauri-apps/api | 2.x | Tauri event system | File watcher events |
| lucide-react | latest | Icons | Project standard |
| framer-motion | latest | Animations | Blade transitions |

### No New Dependencies

This phase requires zero new npm packages. Everything uses the existing project stack.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Extension lifecycle | Custom activation/cleanup | `ExtensionAPI.cleanup()` | Handles all registry unregistrations atomically |
| Event cleanup | Manual listener tracking | `api.onDispose()` | Automatic LIFO cleanup on deactivation |
| Blade registration | Direct `registerBlade()` | `api.registerBlade({ coreOverride: true })` | Namespacing + automatic cleanup |
| Command registration | `useHotkeys()` in core | `api.registerCommand({ shortcut })` | Auto-unregister on deactivation |
| Settings persistence | Manual localStorage | `api.settings` (ExtensionSettings) | Namespaced, isolated per extension |

---

## Common Pitfalls

### Pitfall 1: Topology Store as GitOps Slice vs Standalone Store

**What goes wrong:** If the topology store remains a slice of `GitOpsStore`, deactivating the extension can't clean up the slice without affecting other git operations.

**Why it happens:** Zustand slices are composed at store creation time -- you can't remove a slice at runtime.

**How to avoid:** Extract `topology.slice.ts` into a standalone `create()` store in `src/extensions/topology/store.ts`. The extension owns its own store lifecycle.

**Warning signs:** If `useGitOpsStore` still has topology-related selectors after extraction, the separation is incomplete.

### Pitfall 2: Core Importing from Extension

**What goes wrong:** If `CommitTypeIcon` continues to import `parseConventionalType` from the (now moved) topology extension path, the build breaks when the extension directory changes.

**Why it happens:** The import was established when topology was in core.

**How to avoid:** Extract `parseConventionalType` to a new core utility file BEFORE moving topology files.

**Warning signs:** Any `import ... from "../../extensions/topology/..."` in a `src/core/` file.

### Pitfall 3: Navigation Machine Crash on Missing Blade

**What goes wrong:** `rootBladeForProcess("topology")` returns `{ type: "topology-graph" }` but the blade is not registered, causing `BladeRenderer` to render nothing or crash.

**Why it happens:** The function assumes topology-graph is always available.

**How to avoid:** Add blade registry check in `rootBladeForProcess()` with fallback.

**Warning signs:** White screen when switching to topology process with extension disabled.

### Pitfall 4: File Watcher Refresh After Extension Disabled

**What goes wrong:** The `App.tsx` file watcher listener calls `useTopologyStore.getState().loadGraph()` even after topology is disabled, potentially causing errors or wasted network calls.

**Why it happens:** The listener in `App.tsx` is not extension-aware.

**How to avoid:** Move the topology refresh listener INTO the extension's `onActivate` and clean it up via `onDispose`.

**Warning signs:** Console errors about topology store after disabling the extension.

### Pitfall 5: Keyboard Shortcut Leaks

**What goes wrong:** `Cmd+2` still switches to topology after extension is disabled because `useKeyboardShortcuts.ts` hardcodes it.

**Why it happens:** The shortcut is in core, not contributed by the extension.

**How to avoid:** Remove the `Cmd+2` and `Enter` (commit details) shortcuts from `useKeyboardShortcuts.ts`. Contribute them as extension commands instead.

**Warning signs:** Topology tab reappears briefly when pressing Cmd+2 with extension disabled.

### Pitfall 6: Settings Default Tab "topology" With Extension Disabled

**What goes wrong:** User has `defaultTab: "topology"` in settings, disables topology extension, reopens app -- tries to switch to topology on startup.

**Why it happens:** Settings are persisted independently of extension state.

**How to avoid:** Guard the startup `SWITCH_PROCESS` call with a blade registry check.

**Warning signs:** Blank main panel on app startup with topology disabled.

---

## Code Examples

### Extension Entry Point (`index.ts`)

```typescript
import { lazy } from "react";
import { History, Network, GitCommit } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import type { ExtensionAPI } from "../ExtensionAPI";
import { openBlade } from "../../core/lib/bladeOpener";
import { getNavigationActor } from "../../core/machines/navigation/context";
import { useGitOpsStore as useRepositoryStore } from "../../core/stores/domain/git-ops";
import { useTopologyStore } from "./store";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const TopologyRootBlade = lazy(() =>
    import("./blades/TopologyRootBlade").then((m) => ({
      default: m.TopologyRootBlade,
    }))
  );

  api.registerBlade({
    type: "topology-graph",
    title: "Topology",
    component: TopologyRootBlade,
    singleton: true,
    lazy: true,
    wrapInPanel: false,
    showBack: false,
    coreOverride: true,
  });

  api.registerCommand({
    id: "show-topology",
    title: "Show History",
    description: "Switch to the topology (history) view",
    category: "Navigation",
    shortcut: "mod+2",
    icon: History,
    keywords: ["topology", "history", "graph", "commits"],
    action: () => {
      getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
    },
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });

  api.registerCommand({
    id: "open-selected-commit",
    title: "Open Selected Commit",
    description: "Open details for the selected commit in topology view",
    category: "Navigation",
    icon: GitCommit,
    action: () => {
      const ctx = getNavigationActor().getSnapshot().context;
      const selected = useTopologyStore.getState().topologySelectedCommit;
      if (ctx.activeProcess === "topology" && selected && ctx.bladeStack.length === 1) {
        openBlade("commit-details", { oid: selected });
      }
    },
    enabled: () => !!useTopologyStore.getState().topologySelectedCommit,
  });

  // File watcher: auto-refresh topology when repo changes
  const unlistenPromise = listen<{ paths: string[] }>("repository-changed", () => {
    const state = useTopologyStore.getState();
    if (state.nodes.length > 0) {
      state.loadGraph();
    }
  });

  api.onDispose(() => {
    unlistenPromise.then((fn) => fn());
  });

  api.onDispose(() => {
    useTopologyStore.getState().resetTopology();
  });
}

export function onDeactivate(): void {
  useTopologyStore.getState().resetTopology();
}
```

### Standalone Topology Store (`store.ts`)

```typescript
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { commands, type GraphNode, type GraphEdge } from "../../bindings";
import { getErrorMessage } from "../../core/lib/errors";

const INITIAL_LIMIT = 100;
const LOAD_MORE_AMOUNT = 50;

export interface TopologyState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  topologySelectedCommit: string | null;
  topologyIsLoading: boolean;
  topologyError: string | null;
  topologyHasMore: boolean;
  topologyLastRefresh: number;
  topologyCurrentOffset: number;
  loadGraph: () => Promise<void>;
  loadMore: () => Promise<void>;
  selectCommit: (oid: string | null) => void;
  resetTopology: () => void;
  clearTopologyError: () => void;
}

export const useTopologyStore = create<TopologyState>()(
  devtools(
    (set, get) => ({
      nodes: [],
      edges: [],
      topologySelectedCommit: null,
      topologyIsLoading: false,
      topologyError: null,
      topologyHasMore: true,
      topologyLastRefresh: 0,
      topologyCurrentOffset: 0,

      loadGraph: async () => {
        set({ topologyIsLoading: true, topologyError: null }, false, "topology/load");
        try {
          const result = await commands.getCommitGraph(INITIAL_LIMIT, 0);
          if (result.status === "ok") {
            set({
              nodes: result.data.nodes,
              edges: result.data.edges,
              topologyIsLoading: false,
              topologyHasMore: result.data.nodes.length === INITIAL_LIMIT,
              topologyCurrentOffset: result.data.nodes.length,
              topologyLastRefresh: Date.now(),
            }, false, "topology/loadOk");
          } else {
            set({ topologyError: getErrorMessage(result.error), topologyIsLoading: false });
          }
        } catch (e) {
          set({ topologyError: String(e), topologyIsLoading: false });
        }
      },

      loadMore: async () => {
        const { topologyCurrentOffset, nodes, edges, topologyIsLoading, topologyHasMore } = get();
        if (topologyIsLoading || !topologyHasMore) return;
        set({ topologyIsLoading: true }, false, "topology/loadMore");
        try {
          const result = await commands.getCommitGraph(LOAD_MORE_AMOUNT, topologyCurrentOffset);
          if (result.status === "ok") {
            set({
              nodes: [...nodes, ...result.data.nodes],
              edges: [...edges, ...result.data.edges],
              topologyIsLoading: false,
              topologyHasMore: result.data.nodes.length === LOAD_MORE_AMOUNT,
              topologyCurrentOffset: topologyCurrentOffset + result.data.nodes.length,
            }, false, "topology/loadMoreOk");
          } else {
            set({ topologyError: getErrorMessage(result.error), topologyIsLoading: false });
          }
        } catch (e) {
          set({ topologyError: String(e), topologyIsLoading: false });
        }
      },

      selectCommit: (oid) => set({ topologySelectedCommit: oid }, false, "topology/selectCommit"),

      resetTopology: () => set({
        nodes: [], edges: [],
        topologySelectedCommit: null,
        topologyIsLoading: false,
        topologyError: null,
        topologyHasMore: true,
        topologyLastRefresh: 0,
        topologyCurrentOffset: 0,
      }, false, "topology/reset"),

      clearTopologyError: () => set({ topologyError: null }, false, "topology/clearError"),
    }),
    { name: "topology-store", enabled: import.meta.env.DEV },
  ),
);
```

### Fallback Blade (`CommitListFallbackBlade.tsx`)

```typescript
import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { CommitHistory } from "../../components/commit/CommitHistory";

export function CommitListFallbackBlade() {
  const { openBlade } = useBladeNavigation();
  return (
    <CommitHistory
      onCommitSelect={(oid) => openBlade("commit-details", { oid })}
    />
  );
}
```

### Updated rootBladeForProcess (`actions.ts`)

```typescript
import { useBladeRegistry } from "../../lib/bladeRegistry";
import type { ProcessType, TypedBlade } from "./types";

export function rootBladeForProcess(process: ProcessType): TypedBlade {
  if (process === "staging") {
    return {
      id: "root",
      type: "staging-changes",
      title: "Changes",
      props: {} as Record<string, never>,
    };
  }
  // Check if topology-graph blade is registered (extension active)
  if (useBladeRegistry.getState().blades.has("topology-graph")) {
    return {
      id: "root",
      type: "topology-graph",
      title: "Topology",
      props: {} as Record<string, never>,
    };
  }
  // Fallback: simple commit list
  return {
    id: "root",
    type: "commit-list-fallback",
    title: "History",
    props: {} as Record<string, never>,
  };
}
```

---

## Open Questions

### 1. Extension Count for TOPO-09

**What we know:** The requirement says "Extension Manager shows 7 independently toggleable built-in extensions." Currently there are 12 built-in extensions registered in App.tsx. Adding topology makes 13.

**What's unclear:** Does "7" refer to a subset (perhaps the non-viewer extensions)? Or was this written before the viewer extensions were added?

**Recommendation:** Treat "7" as a minimum or outdated count. The actual count will be 13 (12 existing + topology). The requirement likely means "all built-in extensions are independently toggleable" which is already the case.

### 2. Enter Key Shortcut for Commit Details

**What we know:** `useKeyboardShortcuts.ts` has an `enter` shortcut that opens commit details for the selected topology commit. This shortcut is topology-specific.

**What's unclear:** Should this be a contributed command with `shortcut: "enter"`, or handled internally within the TopologyRootBlade component?

**Recommendation:** Handle `enter` internally within TopologyRootBlade using `useHotkeys` locally, since it only applies when the topology view is active and a commit is selected. This avoids a global command that might conflict with other Enter uses. The extension's `onActivate` should NOT register this as a global command.

### 3. "history" vs "topology" Default Tab

**What we know:** Settings has three options: "changes", "history", "topology". The `App.tsx` init code treats both "history" and "topology" as switching to the topology process.

**What's unclear:** After extraction, should "history" map to the fallback commit list and "topology" map to the full graph? Or should both require the extension?

**Recommendation:** Both "history" and "topology" should map to the topology process. If the extension is disabled, fall back to "changes" for both. Simplify to two options in settings: "Changes" and "History/Topology" (or just "Changes" and "History").

---

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All files listed in Component Decomposition table
- `src/extensions/ExtensionAPI.ts` -- complete extension API surface
- `src/extensions/ExtensionHost.ts` -- extension lifecycle management
- `src/extensions/worktrees/index.tsx` -- sidebar panel extension pattern
- `src/extensions/init-repo/index.ts` -- coreOverride blade extension pattern
- `src/extensions/gitflow/index.ts` -- blade + command + toolbar extension pattern
- `src/extensions/github/index.ts` -- complex extension with store subscriptions and cleanup
- `src/core/blades/_shared/ProcessNavigation.tsx` -- dynamic process tab visibility
- `src/core/machines/navigation/actions.ts` -- rootBladeForProcess logic
- `src-tauri/src/git/watcher.rs` -- file watcher Rust implementation
- `src-tauri/src/git/graph.rs` -- commit graph Rust types and commands

### Secondary (MEDIUM confidence)
- Extension README convention docs (worktrees/README.md, init-repo/README.md)

## Metadata

**Confidence breakdown:**
- Extension file structure: HIGH -- follows 12 existing extensions' patterns
- Component decomposition: HIGH -- all files identified and traced
- Tauri integration: HIGH -- single command, well-understood watcher pattern
- Tailwind strategy: HIGH -- no special handling needed
- Fallback design: HIGH -- ProcessNavigation already handles graceful degradation
- Code movement plan: HIGH -- every file's origin and destination mapped
- Extensibility enforcement: HIGH -- patterns already established in codebase

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable patterns, no external dependencies changing)
