# Phase 46: Topology Extraction - Technical Architecture Research

**Researched:** 2026-02-11
**Domain:** Extension architecture, blade registry, XState navigation, file watcher lifecycle
**Confidence:** HIGH
**Perspective:** Technical Architecture

## Summary

The Topology graph is currently a core blade registered via `src/core/blades/topology-graph/registration.ts` with a static `registerBlade()` call. It consists of 7 files in `src/core/blades/topology-graph/`, plus a data slice in the GitOpsStore, a `useCommitGraph` hook, and keyboard shortcuts hard-wired in `useKeyboardShortcuts.ts` and `src/core/commands/navigation.ts`. The file watcher auto-refresh logic lives in `App.tsx` lines 275-282, directly referencing the topology store.

Extracting topology into a toggleable built-in extension follows well-established patterns from Phase 44 (worktrees: sidebar panel pattern) and Phase 45 (init-repo: `coreOverride` blade registration + command contribution). Phase 43's infrastructure (blade registry Zustand migration, `ProcessNavigation` visibility hook) was specifically designed for this extraction. The `ProcessNavigation` component already checks `blades.has("topology-graph")` to hide the topology tab dynamically, and already falls back to staging when topology is deactivated.

**Primary recommendation:** Create `src/extensions/topology/index.ts` with `onActivate`/`onDeactivate` functions. Use `api.registerBlade({ coreOverride: true })` for the topology-graph blade type, `api.registerCommand()` for the Show History command and Enter shortcut, and `api.onDispose()` for the file watcher cleanup. Keep topology data slice in GitOpsStore. Register as 13th built-in extension in App.tsx (bringing total from 12 to 13; Extension Manager should show 7 independently-toggleable ones per spec).

---

## Current Code Inventory

### Topology Files (to be moved to extension)

| File | Purpose | Lines | Dependencies |
|------|---------|-------|-------------|
| `src/core/blades/topology-graph/TopologyRootBlade.tsx` | Root blade with graph/history sub-tabs | 55 | TopologyPanel, CommitHistory, useBladeNavigation |
| `src/core/blades/topology-graph/registration.ts` | Static core blade registration | 10 | registerBlade, TopologyRootBlade |
| `src/core/blades/topology-graph/index.ts` | Re-export barrel | 1 | TopologyRootBlade |
| `src/core/blades/topology-graph/components/TopologyPanel.tsx` | SVG graph renderer | 188 | useCommitGraph, layoutUtils, CommitBadge, TopologyEmptyState, LaneHeader |
| `src/core/blades/topology-graph/components/TopologyEmptyState.tsx` | Empty state with "Go to Changes" CTA | 46 | getNavigationActor |
| `src/core/blades/topology-graph/components/CommitBadge.tsx` | Individual commit node badge | 67 | GraphNode (bindings), conventional-commits/commit-type-theme, contextMenuRegistry, layoutUtils |
| `src/core/blades/topology-graph/components/LaneHeader.tsx` | Branch lane header strip | 49 | BranchType (bindings), layoutUtils |
| `src/core/blades/topology-graph/components/LaneBackground.tsx` | Lane background rects | 32 | BranchType (bindings), layoutUtils |
| `src/core/blades/topology-graph/components/layoutUtils.ts` | Layout computation + constants | 186 | GraphEdge/GraphNode (bindings), branchClassifier, conventional-utils |
| `src/core/blades/topology-graph/TopologyRootBlade.test.tsx` | Unit test | 43 | render test-utils |

### Supporting Code (stays in core)

| File | Purpose | Stays Because |
|------|---------|---------------|
| `src/core/stores/domain/git-ops/topology.slice.ts` | Zustand data slice (TOPO-08) | Data layer stability |
| `src/core/hooks/useCommitGraph.ts` | Hook wrapping topology slice | Used by TopologyPanel |
| `src/core/components/commit/CommitHistory.tsx` | Commit list component | Potential fallback blade content |
| `src/core/lib/branchClassifier.ts` | Branch classification | Shared utility |
| `src/core/components/icons/CommitTypeIcon.tsx` | Commit type icons | Shared utility |

### Cross-cutting References (must be refactored)

| Location | What References Topology | Required Change |
|----------|-------------------------|-----------------|
| `src/App.tsx:275-282` | File watcher auto-refresh topology | Move into extension lifecycle |
| `src/App.tsx:137-139` | Settings defaultTab topology switch | Add guard for extension availability |
| `src/core/hooks/useKeyboardShortcuts.ts:252-262` | `mod+2` shortcut for topology | Move to extension command |
| `src/core/hooks/useKeyboardShortcuts.ts:289-303` | `Enter` for selected commit details | Move to extension command |
| `src/core/commands/navigation.ts:33-44` | "show-history" command | Move to extension command |
| `src/core/blades/_discovery.ts:17` | "topology-graph" in EXPECTED_TYPES | Remove from core expectations |
| `src/core/stores/bladeTypes.ts:16` | "topology-graph" in BladePropsMap | Keep (type-safe navigation needs it) |
| `src/core/machines/navigation/types.ts:5` | ProcessType includes "topology" | Keep (process type union stays) |
| `src/core/machines/navigation/actions.ts:12-17` | rootBladeForProcess("topology") | Keep (navigation machine needs it) |
| `src/core/blades/_shared/ProcessNavigation.tsx` | Topology tab visibility logic | Already handles dynamic visibility |
| `src/core/blades/settings/components/GeneralSettings.tsx` | defaultTab topology option | Filter options based on extension availability |

---

## Extension Pattern Analysis

### Existing Built-In Extensions (12 currently)

```
1.  viewer-code        - Code Viewer
2.  viewer-markdown    - Markdown Viewer
3.  viewer-3d          - 3D Model Viewer
4.  conventional-commits - Conventional Commits
5.  gitflow            - Gitflow
6.  worktrees          - Worktrees
7.  init-repo          - Init Repository
8.  github             - GitHub Integration
9.  viewer-image       - Image Viewer
10. viewer-nupkg       - NuGet Package Viewer
11. viewer-plaintext   - Plain Text Viewer
12. welcome-screen     - Welcome Screen
```

Adding topology makes 13 built-in extensions. The spec says "Extension Manager shows 7 independently toggleable built-in extensions" -- this likely refers to the functional/feature extensions (not viewer extensions): conventional-commits, gitflow, worktrees, init-repo, github, welcome-screen, and **topology** (7 total).

### Pattern Comparison

| Aspect | init-repo (Phase 45) | worktrees (Phase 44) | topology (Phase 46) |
|--------|---------------------|---------------------|---------------------|
| Registration | `registerBlade({ coreOverride: true })` | `contributeSidebarPanel()` | `registerBlade({ coreOverride: true })` |
| Blade type | "init-repo" | N/A (sidebar panel) | "topology-graph" |
| Commands | 1 command | 2 commands | 2-3 commands |
| State | Own store + `onDispose` reset | Uses GitOpsStore directly | Uses GitOpsStore topology slice |
| Lifecycle | Lazy load blade | Immediate panel | Lazy load blade + file watcher hook |
| Fallback | WelcomeFallback in App.tsx | Panel disappears | Process tab hides, simple commit list |

### Key Difference: Topology Has Process-Level Integration

Unlike init-repo (which is a pushable blade) or worktrees (which is a sidebar panel), topology is a **process** -- it owns an entire navigation tab and serves as a root blade. This means:

1. The `ProcessNavigation` component must react to blade registry changes (already done in Phase 43)
2. The navigation machine's `rootBladeForProcess("topology")` must still work
3. Disabling topology while user is on topology must gracefully switch to staging (already done in Phase 43)

---

## Process Navigation Architecture

### Current Implementation (`ProcessNavigation.tsx`)

```typescript
const ALL_PROCESSES = [
  { id: "staging" as ProcessType, label: "Staging", icon: Files },
  { id: "topology" as ProcessType, label: "Topology", icon: Network },
];

// Dynamic visibility: hide topology tab if blade type unregistered
const visibleProcesses = useMemo(
  () => ALL_PROCESSES.filter((p) => p.id === "staging" || blades.has("topology-graph")),
  [blades],
);

// Auto-fallback: switch to staging if topology blade disappears
useEffect(() => {
  if (activeProcess === "topology" && !blades.has("topology-graph")) {
    actorRef.send({ type: "SWITCH_PROCESS", process: "staging" });
  }
}, [activeProcess, blades, actorRef]);
```

**Confidence: HIGH** -- This is already implemented and tested from Phase 43. The topology extraction merely needs to trigger blade unregistration on deactivation, and ProcessNavigation handles the rest automatically.

### Navigation Machine Integration

The navigation machine (`navigationMachine.ts`) hardcodes `ProcessType = "staging" | "topology"` and `rootBladeForProcess()`. These must remain in core because:

1. The machine must know how to create root blades for each process
2. The type union is used throughout the machine's guards and actions
3. If topology extension is disabled, the machine still needs the type for serialization safety

**Decision:** Keep `ProcessType`, `rootBladeForProcess`, and `SWITCH_PROCESS` handling in core. The extension only controls whether the blade type is **registered** (renderable), not whether the process type exists.

### Fallback Blade Strategy (TOPO-03)

When topology extension is disabled, `rootBladeForProcess("topology")` still returns `{ type: "topology-graph", ... }`. The `BladeRenderer` will look up this type in the blade registry and find nothing. Two approaches:

**Option A: Register a simple fallback blade in core** (recommended)
- Core always registers a minimal "topology-graph" blade showing CommitHistory
- Extension overrides it with `coreOverride: true` to show the full topology graph
- When extension deactivated, cleanup removes the override, core fallback remains

**Option B: BladeRenderer handles missing registration**
- BladeRenderer renders a generic "Extension disabled" message for unknown types
- ProcessNavigation hides the tab, so users rarely see it

**Recommendation: Option A** -- matches the WelcomeScreen pattern where App.tsx has a `WelcomeFallback` and the extension provides the rich version. For topology, the "core" registration is a simple `CommitHistory` list, and the extension upgrades it to the full graph.

Wait -- re-reading the `coreOverride` pattern more carefully: when the extension registers with `coreOverride: true`, it uses the raw type "topology-graph" without namespace prefix. When deactivated, `api.cleanup()` calls `unregisterBlade("topology-graph")`, which removes it entirely. There is no layered fallback.

**Revised approach for TOPO-03:**
1. Remove `topology-graph` from `_discovery.ts` EXPECTED_TYPES (no longer a core blade)
2. Remove `src/core/blades/topology-graph/registration.ts` (no longer eagerly registered)
3. The topology extension registers `topology-graph` with `coreOverride: true`
4. When extension disabled, ProcessNavigation hides the tab (Phase 43 logic)
5. If user navigates to topology via settings defaultTab while extension is off, fall back to "changes" (TOPO-07)
6. The simple commit list fallback is a separate blade registered conditionally or via a core registration

Actually, the cleanest approach: **Create a minimal fallback component inline in the extension activation.** When topology is active, register the full TopologyRootBlade. When deactivated, the blade unregisters, ProcessNavigation hides the tab. The "simple commit list fallback" (TOPO-03) could be registered as a separate core blade that renders when the main topology blade is missing. OR, keep a thin core registration that shows CommitHistory, and the extension overrides it.

**Final recommendation:** Register a minimal fallback `topology-graph` blade in core (in `_discovery.ts` or a new minimal registration file) that renders `CommitHistory`. The extension then re-registers `topology-graph` with `coreOverride: true` to replace it with the full graph. On deactivation, `unregisterBlade("topology-graph")` fires, but we need to restore the fallback. This is problematic because `cleanup()` just deletes.

**Simplest correct approach:**
1. Do NOT register topology-graph in core
2. Extension registers it with `coreOverride: true`
3. When disabled, blade is unregistered, ProcessNavigation hides the tab
4. The "simple commit list fallback" is for users who want commit history without the graph -- they can still access CommitHistory through the History sub-tab or through the topology blade itself
5. For the requirement "renders a simple commit list fallback instead of crashing": ensure BladeRenderer does not crash on unregistered types. Add a safe fallback render in BladeRenderer.

---

## File Watcher Migration (TOPO-05)

### Current Location: `App.tsx` lines 261-289

```typescript
useEffect(() => {
  if (!status) return;
  const unlisten = listen<{ paths: string[] }>(
    "repository-changed",
    (event) => {
      // ... other refresh logic ...

      // Auto-refresh topology if it has been loaded
      const topologyState = useTopologyStore.getState();
      if (topologyState.nodes.length > 0) {
        topologyState.loadGraph();
      }
    },
  );
  return () => { unlisten.then((fn) => fn()); };
}, [status, queryClient, loadUndoInfo]);
```

### Migration Strategy

The topology auto-refresh portion (lines 279-282) must move into the extension's activation lifecycle. Two approaches:

**Approach A: Use `api.onDispose()` with manual Tauri event listener**
```typescript
// In onActivate:
const unlisten = await listen("repository-changed", () => {
  const state = useGitOpsStore.getState();
  if (state.nodes.length > 0) {
    state.loadGraph();
  }
});
api.onDispose(() => unlisten());
```

**Approach B: Use `api.onDidGit()` for post-git operations**
The extension API has `onDidGit` which hooks into the git hook bus. However, file watcher events come from Tauri's filesystem watcher, not from git operations performed within the app. External changes (e.g., user running `git commit` in terminal) trigger the file watcher. So `onDidGit` is insufficient.

**Recommendation: Approach A** -- Direct Tauri event listener registration with `api.onDispose()` cleanup. This is clean, self-contained, and properly scoped to the extension lifecycle.

### Remaining App.tsx File Watcher

After extracting the topology refresh, the App.tsx file watcher still handles:
- `queryClient.invalidateQueries(["stagingStatus"])`
- `queryClient.invalidateQueries(["commitHistory"])`
- `queryClient.invalidateQueries(["repositoryStatus"])`
- `loadUndoInfo()`

These are core concerns and remain in App.tsx.

---

## State Management Strategy (TOPO-08)

### Decision: Topology Data Stays in GitOpsStore

The `TopologySlice` in `src/core/stores/domain/git-ops/topology.slice.ts` must remain in the GitOpsStore. Reasons:

1. **Data layer stability** -- Other slices or future features may reference topology data
2. **Store reset integration** -- `registerStoreForReset(useGitOpsStore)` resets all slices on repo close
3. **Cross-concern access** -- The file watcher (even in extension) needs `useGitOpsStore.getState()`

### Extension-Store Interaction Pattern

The extension interacts with the core store via direct import:
```typescript
import { useGitOpsStore } from "../../core/stores/domain/git-ops";
```

This is the same pattern used by:
- Worktrees extension: `useGitOpsStore.getState().loadWorktrees()`
- Worktrees extension: `useGitOpsStore.getState().worktreeList.length`

The extension does NOT own any state -- it only orchestrates UI registration and lifecycle hooks that trigger store actions.

### useCommitGraph Hook

`src/core/hooks/useCommitGraph.ts` wraps the topology slice with React lifecycle (auto-load on repo open, reset on unmount). This hook stays in core alongside the slice. The extension's TopologyPanel component imports it from core.

---

## Blade Registration (TOPO-02)

### Pattern: `coreOverride: true`

```typescript
// In extension onActivate:
api.registerBlade({
  type: "topology-graph",
  title: "Topology",
  component: TopologyRootBlade,  // or lazy(() => import(...))
  wrapInPanel: false,
  showBack: false,
  coreOverride: true,  // registers as "topology-graph" not "ext:topology:topology-graph"
});
```

This is identical to how `init-repo` and `welcome-screen` register their blades.

### Lazy Loading Consideration

Init-repo and welcome-screen use `lazy()`:
```typescript
const InitRepoBlade = lazy(() => import("./blades/InitRepoBlade").then(m => ({ default: m.InitRepoBlade })));
```

For topology, lazy loading is beneficial because:
1. The topology graph has significant component weight (SVG rendering, layout computation)
2. Users may never navigate to topology in a session
3. Aligns with existing patterns

**Recommendation:** Use lazy loading for the TopologyRootBlade component.

---

## Command/Shortcut Migration (TOPO-06)

### Current Shortcuts

| Shortcut | Location | Command ID | Action |
|----------|----------|-----------|--------|
| `mod+2` | `useKeyboardShortcuts.ts:252-262` | hardcoded | `SWITCH_PROCESS topology` |
| `Enter` | `useKeyboardShortcuts.ts:289-303` | hardcoded | Open commit details from topology |
| N/A | `navigation.ts:33-44` | `show-history` | `SWITCH_PROCESS topology` |

### Migration Plan

**Remove from core:**
1. Remove `mod+2` shortcut from `useKeyboardShortcuts.ts`
2. Remove `Enter` topology commit shortcut from `useKeyboardShortcuts.ts`
3. Remove `show-history` command from `navigation.ts`

**Add to extension:**
```typescript
api.registerCommand({
  id: "show-history",
  title: "Show History",
  description: "Switch to the topology (history) view",
  category: "Navigation",
  shortcut: "mod+2",
  icon: History,
  action: () => {
    getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
  },
  enabled: () => !!useGitOpsStore.getState().repoStatus,
});

api.registerCommand({
  id: "open-selected-commit",
  title: "Open Selected Commit",
  description: "Open details for the selected commit in topology view",
  category: "Navigation",
  shortcut: "enter",
  action: () => {
    const ctx = getNavigationActor().getSnapshot().context;
    const selected = useGitOpsStore.getState().topologySelectedCommit;
    if (ctx.activeProcess === "topology" && selected && ctx.bladeStack.length === 1) {
      openBlade("commit-details", { oid: selected });
    }
  },
  enabled: () => !!useGitOpsStore.getState().repoStatus,
});
```

**Important note on shortcuts:** The `registerCommand` API stores `shortcut` as metadata for display in the command palette. The actual keyboard binding is done via `react-hotkeys-hook` in `useKeyboardShortcuts.ts`. The ExtensionAPI does NOT currently have a `registerKeybinding()` method.

**Problem:** There is no mechanism in ExtensionAPI to register actual keyboard shortcuts. The `shortcut` field on commands is display-only. The actual `useHotkeys()` calls are hardcoded.

**Solutions:**
1. **Quick fix:** Keep the keyboard shortcut bindings in `useKeyboardShortcuts.ts` but make them conditional on blade registry (`blades.has("topology-graph")`). The command registration moves to the extension for command palette visibility.
2. **Proper fix:** Add `api.registerKeybinding()` to ExtensionAPI that internally calls `useHotkeys` with cleanup on deactivation.

**Recommendation:** Solution 1 for this phase (quick fix). Shortcut bindings check blade registry before executing. Commands move to extension for palette integration. A future phase can add proper keybinding contribution.

Actually, wait -- let me re-examine. Looking at `useKeyboardShortcuts.ts`, the `Enter` shortcut already checks `ctx.activeProcess === "topology"`. If the topology blade is unregistered, ProcessNavigation switches away from topology. So the shortcut effectively becomes a no-op when topology is disabled. The `mod+2` shortcut would still try to switch to topology, but ProcessNavigation would immediately switch back to staging.

**Revised recommendation:** For `mod+2`, make it conditional: only send SWITCH_PROCESS if `useBladeRegistry.getState().blades.has("topology-graph")`. For `Enter`, it's already safe. Move the `show-history` command from `navigation.ts` to the extension so it disappears from the command palette when disabled.

---

## Settings Degradation (TOPO-07)

### Current Settings Behavior

`GeneralSettings.tsx` shows three options: "Changes", "History", "Topology". These map to the `defaultTab` setting.

`App.tsx` reads the setting on init:
```typescript
initSettings().then(() => {
  const defaultTab = settings.general.defaultTab;
  if (defaultTab === "topology" || defaultTab === "history") {
    getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
  }
});
```

### Degradation Strategy

When topology extension is disabled:

1. **Settings UI:** Filter `tabOptions` in `GeneralSettings.tsx` to exclude "history" and "topology" when `!blades.has("topology-graph")`
2. **Startup fallback:** In `App.tsx` init, check if topology blade is registered before switching. If not, fall back to "changes" (staging)
3. **Persisted setting:** Keep the user's "topology" preference in storage. If they re-enable topology, their preference is restored. Only the runtime behavior degrades gracefully.

```typescript
// In App.tsx init:
if ((defaultTab === "topology" || defaultTab === "history") &&
    useBladeRegistry.getState().blades.has("topology-graph")) {
  getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
}
```

**Timing concern:** Built-in extensions are registered in the same `useEffect` as `initSettings()`. The `registerBuiltIn` calls are synchronous within the effect, but the actual activation is async. So at the time `initSettings().then(...)` runs, the topology extension may not have finished activating yet.

**Fix:** Check blade registry availability in a delayed manner, or move the default tab switch to after all built-in extensions have been registered. Alternatively, the extension itself can read the setting and switch process on activation.

**Recommendation:** Move the defaultTab -> topology switch into the topology extension's `onActivate`. The extension reads the setting and sends SWITCH_PROCESS if appropriate. This is self-contained and avoids timing issues.

---

## Dependency Analysis

### What Imports Topology Components (Inbound)

| Consumer | Import | Impact of Moving |
|----------|--------|-----------------|
| `topology-graph/registration.ts` | TopologyRootBlade | Deleted (replaced by extension) |
| `topology-graph/TopologyRootBlade.tsx` | TopologyPanel | Internal move |
| `CommitTypeIcon.tsx` | `parseConventionalType` from layoutUtils | **CROSS-MODULE DEPENDENCY** |
| `_discovery.ts` | Expects "topology-graph" | Remove from EXPECTED_TYPES |

### Critical Cross-Module Dependency: CommitTypeIcon -> layoutUtils

`src/core/components/icons/CommitTypeIcon.tsx` imports `parseConventionalType` from `src/core/blades/topology-graph/components/layoutUtils.ts`. This is a **leaky abstraction** -- a core icon component depends on a topology layout utility.

**Fix:** Extract `parseConventionalType` to a shared location before moving topology files. It's a one-liner that calls `parseConventionalMessage` from `conventional-commits`:

```typescript
export function parseConventionalType(message: string): string | null {
  const parsed = parseConventionalMessage(message);
  return parsed ? parsed.commitType : null;
}
```

**Move to:** `src/core/lib/conventionalParsing.ts` or keep in `conventional-commits/lib/conventional-utils.ts` (it already lives there as `parseConventionalMessage`). CommitTypeIcon should import directly from conventional-commits lib.

### What Topology Imports (Outbound)

| Module | Import | Available in Extension? |
|--------|--------|----------------------|
| `lucide-react` | Icons | Yes (npm) |
| `../../lib/utils` (cn) | Class utility | Yes (core) |
| `../../hooks/useBladeNavigation` | Blade navigation | Yes (core) |
| `../../components/commit/CommitHistory` | Commit list | Yes (core) |
| `../../../hooks/useCommitGraph` | Graph data hook | Yes (core) |
| `../../../lib/branchClassifier` | Branch types | Yes (core) |
| `../../../../bindings` | Tauri bindings | Yes (core) |
| `../../../../extensions/conventional-commits/lib/*` | Commit parsing | Yes (extension, but tightly coupled) |
| `../../../machines/navigation/context` | Navigation actor | Yes (core) |
| `../../../lib/contextMenuRegistry` | Context menus | Yes (core) |

All outbound dependencies are either npm packages or core modules accessible from the extensions directory. No circular dependency risk.

### Topology-to-ConventionalCommits Coupling

`layoutUtils.ts` and `CommitBadge.tsx` import from `conventional-commits/lib/`:
- `parseConventionalMessage` (for type parsing)
- `COMMIT_TYPE_THEME` (for icon theming)

This creates a dependency between two extensions. If both are built-in, this is acceptable since they're bundled together. If conventional-commits is disabled, the imports still work (the module is always available in the bundle). The function will return `null` for non-conventional messages, which is the expected fallback.

---

## File Structure Plan

### New Extension Location

```
src/extensions/topology/
  index.ts                  # onActivate / onDeactivate
  components/               # Moved from core/blades/topology-graph/
    TopologyRootBlade.tsx
    TopologyPanel.tsx
    TopologyEmptyState.tsx
    CommitBadge.tsx
    LaneHeader.tsx
    LaneBackground.tsx
    layoutUtils.ts
```

### Files Remaining in Core

```
src/core/stores/domain/git-ops/topology.slice.ts   # Data layer (TOPO-08)
src/core/hooks/useCommitGraph.ts                     # Hook wrapping slice
src/core/components/commit/CommitHistory.tsx          # Shared commit list
src/core/blades/_shared/ProcessNavigation.tsx         # Dynamic tab visibility
src/core/machines/navigation/types.ts                 # ProcessType union
src/core/machines/navigation/actions.ts               # rootBladeForProcess()
```

### Files Modified in Core

```
src/App.tsx                                          # Add registerBuiltIn, remove topology file watcher
src/core/blades/_discovery.ts                        # Remove "topology-graph" from EXPECTED_TYPES
src/core/hooks/useKeyboardShortcuts.ts               # Conditionalize mod+2, remove Enter topology shortcut
src/core/commands/navigation.ts                      # Remove "show-history" command
src/core/blades/settings/components/GeneralSettings.tsx  # Filter topology option when disabled
src/core/components/icons/CommitTypeIcon.tsx          # Fix parseConventionalType import path
```

---

## Risk Assessment

### High Risk

1. **Timing of blade registration vs. defaultTab init**: The settings init and extension activation run concurrently in the same useEffect. The topology extension must be active before the defaultTab check runs, or the tab switch will fail silently.
   - **Mitigation:** Move defaultTab topology handling into the extension's onActivate.

2. **parseConventionalType cross-dependency**: CommitTypeIcon in core imports from topology layoutUtils. Must be resolved before moving files.
   - **Mitigation:** Extract to shared location first, update imports, then move topology.

### Medium Risk

3. **Keyboard shortcut registration gap**: ExtensionAPI has no keybinding contribution mechanism. Shortcuts for topology must either stay in core (conditionalized) or use a workaround.
   - **Mitigation:** Conditionalize existing shortcuts in useKeyboardShortcuts.ts to check blade registry.

4. **Test file migration**: `TopologyRootBlade.test.tsx` imports from relative paths that will change.
   - **Mitigation:** Update import paths after move.

5. **Extension Manager "7 toggleable" count**: Currently 12 built-in extensions. Adding topology makes 13. The "7 independently toggleable" requirement suggests some extensions are not user-toggleable (viewers, welcome-screen). The Extension Manager UI may need to distinguish these.
   - **Mitigation:** Clarify which 7 are the "independently toggleable" ones in the plan.

### Low Risk

6. **ProcessNavigation already handles dynamic visibility**: Phase 43 infrastructure is proven.
7. **File watcher migration is straightforward**: Direct Tauri event listener with onDispose cleanup.
8. **BladePropsMap type stays in core**: No type-system breakage.

---

## Architecture Patterns

### Extension Activation Pattern (for topology)

```typescript
// src/extensions/topology/index.ts
import { lazy } from "react";
import { listen } from "@tauri-apps/api/event";
import { History, Network } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { getNavigationActor } from "../../core/machines/navigation/context";
import { useGitOpsStore } from "../../core/stores/domain/git-ops";
import { openBlade } from "../../core/lib/bladeOpener";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // 1. Register blade with coreOverride
  const TopologyRootBlade = lazy(() =>
    import("./components/TopologyRootBlade").then(m => ({ default: m.TopologyRootBlade }))
  );

  api.registerBlade({
    type: "topology-graph",
    title: "Topology",
    component: TopologyRootBlade,
    wrapInPanel: false,
    showBack: false,
    coreOverride: true,
  });

  // 2. Register commands (replaces core navigation.ts entry)
  api.registerCommand({
    id: "show-history",
    title: "Show History",
    description: "Switch to the topology (history) view",
    category: "Navigation",
    shortcut: "mod+2",
    icon: History,
    action: () => {
      getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
    },
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });

  // 3. File watcher auto-refresh (moved from App.tsx)
  const unlisten = await listen<{ paths: string[] }>("repository-changed", () => {
    const state = useGitOpsStore.getState();
    if (state.nodes.length > 0) {
      state.loadGraph();
    }
  });
  api.onDispose(() => unlisten());

  // 4. Apply defaultTab setting on activation
  // (moved from App.tsx initSettings handler)
  const { getStore } = await import("../../core/lib/store");
  const store = await getStore();
  const settings = await store.get<{ general?: { defaultTab?: string } }>("settings");
  const defaultTab = settings?.general?.defaultTab;
  if (defaultTab === "topology" || defaultTab === "history") {
    getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
  }
}

export function onDeactivate(): void {
  // api.cleanup() handles all unregistrations + disposables
}
```

### Fallback Pattern for Disabled Extension

When topology extension is disabled:
1. ProcessNavigation hides topology tab (Phase 43)
2. If user was on topology, auto-switch to staging (Phase 43)
3. Settings UI hides topology/history options
4. `mod+2` shortcut is a no-op (command unregistered, or conditionalized)
5. File watcher does not refresh topology (listener disposed)
6. BladeRenderer gracefully handles missing registration (show empty state or auto-pop)

---

## Common Pitfalls

### Pitfall 1: Double File Watcher Registration
**What goes wrong:** If the extension registers its own Tauri event listener but the old App.tsx code still has the topology refresh, topology gets refreshed twice on every file change.
**Prevention:** Remove the topology-specific lines from App.tsx file watcher when adding the extension's listener.

### Pitfall 2: Lazy Import Path Breakage
**What goes wrong:** Moving files from `core/blades/topology-graph/` to `extensions/topology/components/` changes relative import paths for things like `../../lib/utils` and `../../hooks/useCommitGraph`.
**Prevention:** Update all relative imports after the move. Consider using path aliases.

### Pitfall 3: Extension Activation Order
**What goes wrong:** If topology extension activates before settings are loaded, the defaultTab check in onActivate reads stale/default settings.
**Prevention:** Read settings from Tauri store directly (not from Zustand state) in the extension's onActivate.

### Pitfall 4: Test Import Path Updates
**What goes wrong:** Tests reference old file paths and break.
**Prevention:** Update test file imports and mock paths after move.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Process tab visibility | Custom show/hide logic | Phase 43's `blades.has("topology-graph")` in ProcessNavigation | Already tested, works with blade registry |
| Blade fallback rendering | Custom error boundary per blade | BladeRenderer's existing Suspense/error handling | Centralized, consistent |
| Extension lifecycle cleanup | Manual tracking of registrations | `api.cleanup()` + `api.onDispose()` | ExtensionAPI handles all cleanup atomically |
| Keyboard shortcut scoping | Custom hook per extension | Conditionalize in existing `useKeyboardShortcuts` | Less fragmentation, predictable shortcut order |

---

## Open Questions

1. **Which 7 extensions are "independently toggleable"?**
   - What we know: There are 12 built-in extensions currently. Adding topology makes 13. The spec says "7 independently toggleable."
   - What's unclear: Are viewer extensions toggleable? Is welcome-screen toggleable?
   - Recommendation: Assume the 7 are: conventional-commits, gitflow, worktrees, init-repo, github, welcome-screen, topology. Viewer extensions are not independently toggleable (they're always active).

2. **Should `BladePropsMap` keep "topology-graph"?**
   - What we know: It provides type-safe blade navigation. Removing it would break `openBlade("topology-graph", {})` type checking.
   - Recommendation: Keep it. It's a type-level concern, not a runtime registration.

3. **How to handle `Enter` shortcut for topology commit details?**
   - What we know: Currently in `useKeyboardShortcuts.ts`. Checks activeProcess === "topology".
   - Recommendation: Keep in core, conditionalize on blade registry. It's naturally safe because if topology is disabled, user can't be on topology process.

---

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct reading of all referenced files in the FlowForge repository
- `src/extensions/ExtensionAPI.ts` -- Extension API facade (registerBlade, registerCommand, onDispose, coreOverride)
- `src/extensions/ExtensionHost.ts` -- Extension host store (registerBuiltIn, activation/deactivation lifecycle)
- `src/core/blades/_shared/ProcessNavigation.tsx` -- Phase 43 dynamic visibility implementation
- `src/extensions/init-repo/index.ts` -- Phase 45 coreOverride blade registration pattern
- `src/extensions/worktrees/index.tsx` -- Phase 44 sidebar panel + command contribution pattern

### Metadata

**Confidence breakdown:**
- Extension pattern: HIGH -- Direct codebase analysis of 3 prior extraction phases
- Navigation architecture: HIGH -- Direct analysis of XState machine and ProcessNavigation
- File watcher migration: HIGH -- Clear Tauri event listener pattern with onDispose
- State management: HIGH -- TOPO-08 explicitly mandates keeping topology in GitOpsStore
- Settings degradation: MEDIUM -- Timing of extension activation vs. settings init needs validation
- Keyboard shortcuts: MEDIUM -- No extension keybinding API; workaround needed

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable internal architecture)
