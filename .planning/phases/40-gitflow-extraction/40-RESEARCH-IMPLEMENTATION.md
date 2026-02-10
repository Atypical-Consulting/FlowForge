# Phase 40: Gitflow Extraction - Implementation Research

**Researched:** 2026-02-10
**Domain:** Extension system extraction (frontend-only refactor)
**Confidence:** HIGH
**Perspective:** Expert Developer (Tauri v2, Rust, React, TypeScript, Tailwind v4)

## Summary

Gitflow extraction follows the proven pattern established by Phase 38 (content-viewers) and Phase 39 (conventional-commits). The hardcoded Gitflow sidebar panel in `RepositoryView.tsx` (lines 181-188) and the standalone blade registration in `src/blades/gitflow-cheatsheet/registration.ts` are replaced by a single extension entry point at `src/extensions/gitflow/index.ts`. This extension registers one blade type (`gitflow-cheatsheet`), one sidebar panel (`GitflowPanel`), one toolbar action (`tb:gitflow-guide`), and one command (`open-gitflow-cheatsheet`) through the `ExtensionAPI` facade.

The extraction is **frontend-only**. All Rust backend commands (`getGitflowStatus`, `initGitflow`, `startFeature`, etc.) remain untouched. The `gitflow.slice.ts` stays inside the `GitOpsStore` because it has cross-slice dependencies on `loadBranches` and `refreshRepoStatus`. The `branchClassifier.ts` stays in core because it is consumed by multiple non-Gitflow components (TopologyPanel, BranchItem, LaneBackground, etc.).

**Primary recommendation:** Follow the CC extension pattern exactly -- `onActivate` registers blade + sidebar panel + toolbar + command via `api.*` methods, `onDeactivate` is a no-op, and the `ExtensionAPI.cleanup()` method handles all teardown atomically.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (lazy) | 19.x | Lazy blade component loading | Code-splitting for extension blades |
| Zustand | 5.x | Extension host store, sidebar panel registry | Already used for all registries |
| lucide-react | 0.x | Icons for toolbar/sidebar/command | Project-wide icon library |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 3.x | Extension lifecycle tests | Test activation/deactivation/cleanup |

### Alternatives Considered

None -- this follows an established extraction pattern with zero new dependencies.

## Architecture Patterns

### Extension Entry Point Structure

```
src/extensions/gitflow/
  index.ts           # onActivate + onDeactivate (NEW)
```

All existing component files stay in place:
```
src/blades/gitflow-cheatsheet/
  GitflowCheatsheetBlade.tsx    # Stays (component code unchanged)
  GitflowCheatsheetBlade.test.tsx # Stays (test unchanged)
  registration.ts               # DELETE (replaced by extension registration)
  index.ts                      # DELETE (empty barrel)

src/components/gitflow/
  GitflowPanel.tsx              # Stays (component code unchanged)
  GitflowActionCards.tsx        # Stays
  GitflowBranchReference.tsx    # Stays
  GitflowDiagram.tsx            # Stays
  FinishFlowDialog.tsx          # Stays
  InitGitflowDialog.tsx         # Stays
  ReviewChecklist.tsx            # Stays
  StartFlowDialog.tsx           # Stays
  index.ts                      # Stays (barrel unchanged)
```

### Pattern: Built-in Extension Registration

Source: Phase 39 conventional-commits extraction (proven pattern)

```typescript
// In App.tsx
import { onActivate as gitflowActivate, onDeactivate as gitflowDeactivate } from "./extensions/gitflow";

// Inside useEffect:
registerBuiltIn({
  id: "gitflow",
  name: "Gitflow Workflow",
  version: "1.0.0",
  activate: gitflowActivate,
  deactivate: gitflowDeactivate,
});
```

### Anti-Patterns to Avoid

- **Moving component files into extensions folder:** The GitHub extension moved its blades there because they are GitHub-only. Gitflow components are consumed by non-extension code (`BranchList.tsx` uses `useGitflowStore` for protected branches). Keep components in their current locations.
- **Removing the `useGitflowStore` shim:** While deprecated, it is imported by 5 files across the codebase. Removing it is a separate cleanup task, not part of extraction.
- **Removing `gitflow-cheatsheet` from BladePropsMap:** The type must remain in `bladeTypes.ts` because `openBlade("gitflow-cheatsheet", ...)` is called from `GitflowPanel.tsx` line 206 and needs compile-time type safety.

## Code Examples

### 1. Extension Entry Point (`src/extensions/gitflow/index.ts`)

```typescript
import { lazy } from "react";
import { GitBranch, GitMerge } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { openBlade } from "../../lib/bladeOpener";
import { useRepositoryStore } from "../../stores/repository";
import { GitflowPanel } from "../../components/gitflow";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy blade import -- loaded on first render, not during activation
  const GitflowCheatsheetBlade = lazy(() =>
    import("../../blades/gitflow-cheatsheet/GitflowCheatsheetBlade").then((m) => ({
      default: m.GitflowCheatsheetBlade,
    }))
  );

  // Register blade type (coreOverride: blade type stays as "gitflow-cheatsheet")
  api.registerBlade({
    type: "gitflow-cheatsheet",
    title: "Gitflow Guide",
    component: GitflowCheatsheetBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
  });

  // Register sidebar panel (replaces hardcoded <details> in RepositoryView)
  api.contributeSidebarPanel({
    id: "gitflow",
    title: "Gitflow",
    icon: GitMerge,
    component: GitflowPanel,
    priority: 65,       // High within extension range (1-69), appears near top
    defaultOpen: false,  // Matches current <details> behavior (no `open` attribute)
    when: () => !!useRepositoryStore.getState().repoStatus,
  });

  // Register toolbar action (replaces tb:gitflow-guide in toolbar-actions.ts)
  api.contributeToolbar({
    id: "gitflow-guide",
    label: "Gitflow Guide",
    icon: GitBranch,
    group: "views",
    priority: 50,
    when: () => !!useRepositoryStore.getState().repoStatus,
    execute: () => {
      openBlade("gitflow-cheatsheet", {} as Record<string, never>);
    },
  });

  // Register command palette entry (replaces open-gitflow-cheatsheet in navigation.ts)
  api.registerCommand({
    id: "open-gitflow-cheatsheet",
    title: "Gitflow Cheatsheet",
    description: "Open the Gitflow workflow guide",
    category: "Navigation",
    icon: GitBranch,
    keywords: ["gitflow", "workflow", "guide", "branching", "reference", "cheatsheet"],
    action: () => {
      openBlade("gitflow-cheatsheet", {} as Record<string, never>);
    },
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all unregistrations
}
```

### 2. RepositoryView.tsx Changes

**REMOVE** the Gitflow hardcoded section (lines 16, 181-188). The sidebar panel registered by the extension will appear in `<DynamicSidebarPanels />` at line 215.

**Before (lines 181-188):**
```tsx
{/* Gitflow section */}
<details className="border-b border-ctp-surface0">
  <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 z-10 bg-ctp-base/70 backdrop-blur-lg border-b border-ctp-surface0/50">
    <GitMerge className="w-4 h-4" />
    <span className="font-semibold text-sm flex-1">Gitflow</span>
  </summary>
  <GitflowPanel />
</details>
```

**After:** Section deleted entirely.

Also remove the now-unused imports:
- `GitMerge` from lucide-react (ONLY if no other usage in this file -- check: it is not used elsewhere in RepositoryView.tsx)
- `GitflowPanel` from `"./gitflow"`

### 3. App.tsx Changes

**ADD** the gitflow extension import and registration alongside existing built-in extensions.

```typescript
// Add import (line ~28, after github import):
import { onActivate as gitflowActivate, onDeactivate as gitflowDeactivate } from "./extensions/gitflow";

// Add registration (after github registerBuiltIn, ~line 83):
registerBuiltIn({
  id: "gitflow",
  name: "Gitflow Workflow",
  version: "1.0.0",
  activate: gitflowActivate,
  deactivate: gitflowDeactivate,
});
```

### 4. `src/blades/_discovery.ts` Changes

**REMOVE** `"gitflow-cheatsheet"` from the `EXPECTED_TYPES` array (line 20). The extension now registers this blade type, so the discovery exhaustiveness check should no longer expect it from core registrations.

**Before (line 17-21):**
```typescript
const EXPECTED_TYPES: string[] = [
  "staging-changes", "topology-graph", "commit-details", "diff",
  "viewer-nupkg", "viewer-image", "viewer-plaintext", "repo-browser", "settings",
  "gitflow-cheatsheet", "init-repo", "extension-manager",
];
```

**After:**
```typescript
const EXPECTED_TYPES: string[] = [
  "staging-changes", "topology-graph", "commit-details", "diff",
  "viewer-nupkg", "viewer-image", "viewer-plaintext", "repo-browser", "settings",
  "init-repo", "extension-manager",
];
```

### 5. `src/commands/navigation.ts` Changes

**REMOVE** the `open-gitflow-cheatsheet` command registration (lines 19-30). The extension registers this command via `api.registerCommand()`.

**Before (lines 19-30):**
```typescript
registerCommand({
  id: "open-gitflow-cheatsheet",
  title: "Gitflow Cheatsheet",
  description: "Open the Gitflow workflow guide",
  category: "Navigation",
  icon: GitBranch,
  keywords: ["gitflow", "workflow", "guide", "branching", "reference", "cheatsheet"],
  action: () => {
    openBlade("gitflow-cheatsheet", {} as Record<string, never>);
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});
```

**After:** Only the `command-palette` registration remains. Remove the `GitBranch` import and the `openBlade` import if they become unused. Also remove the `useRepositoryStore` import if unused.

Resulting file:
```typescript
import { Search } from "lucide-react";
import { registerCommand } from "../lib/commandRegistry";
import { useCommandPaletteStore } from "../stores/commandPalette";

registerCommand({
  id: "command-palette",
  title: "Command Palette",
  description: "Open the command palette",
  category: "Navigation",
  shortcut: "mod+k",
  icon: Search,
  action: () => {
    useCommandPaletteStore.getState().togglePalette();
  },
});
```

### 6. `src/commands/toolbar-actions.ts` Changes

**REMOVE** the `tb:gitflow-guide` toolbar action (lines 256-266) from the `coreActions` array.

**Before (lines 256-266):**
```typescript
{
  id: "tb:gitflow-guide",
  label: "Gitflow Guide",
  icon: GitBranch,
  group: "views",
  priority: 50,
  source: "core",
  when: whenRepoOpen,
  execute: () => {
    openBlade("gitflow-cheatsheet", {} as Record<string, never>);
  },
},
```

**After:** Remove this entire object from the array. The `GitBranch` import can be removed if no other action references it (check: it is NOT used elsewhere in this file -- the only other icon imports are ArrowDown, ArrowUp, CloudDownload, FolderOpen, FolderTree, GitFork, Palette, RefreshCw, Search, Settings, Undo2, X). So **remove `GitBranch` from the import**.

### 7. `src/blades/gitflow-cheatsheet/registration.ts` -- DELETE

This file is entirely replaced by the extension entry point. Delete it.

### 8. `src/blades/gitflow-cheatsheet/index.ts` -- DELETE

Empty barrel file. No consumers. Delete it.

## File-by-File Change Inventory

| File | Action | Details |
|------|--------|---------|
| `src/extensions/gitflow/index.ts` | **CREATE** | Extension entry point (onActivate/onDeactivate) |
| `src/extensions/__tests__/gitflow.test.ts` | **CREATE** | Extension lifecycle tests |
| `src/blades/gitflow-cheatsheet/registration.ts` | **DELETE** | Replaced by extension registration |
| `src/blades/gitflow-cheatsheet/index.ts` | **DELETE** | Empty barrel, no consumers |
| `src/App.tsx` | **MODIFY** | Add gitflow import + registerBuiltIn call |
| `src/components/RepositoryView.tsx` | **MODIFY** | Remove Gitflow hardcoded section (lines 181-188) + unused imports |
| `src/blades/_discovery.ts` | **MODIFY** | Remove "gitflow-cheatsheet" from EXPECTED_TYPES |
| `src/commands/navigation.ts` | **MODIFY** | Remove open-gitflow-cheatsheet command + unused imports |
| `src/commands/toolbar-actions.ts` | **MODIFY** | Remove tb:gitflow-guide action + GitBranch import |

### Files That Stay Unchanged

| File | Reason |
|------|--------|
| `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.tsx` | Component code unchanged |
| `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.test.tsx` | Test still valid |
| `src/components/gitflow/GitflowPanel.tsx` | Component code unchanged |
| `src/components/gitflow/GitflowActionCards.tsx` | Component code unchanged |
| `src/components/gitflow/GitflowBranchReference.tsx` | Component code unchanged |
| `src/components/gitflow/GitflowDiagram.tsx` | Component code unchanged |
| `src/components/gitflow/FinishFlowDialog.tsx` | Component code unchanged |
| `src/components/gitflow/InitGitflowDialog.tsx` | Component code unchanged |
| `src/components/gitflow/StartFlowDialog.tsx` | Component code unchanged |
| `src/components/gitflow/ReviewChecklist.tsx` | Component code unchanged |
| `src/components/gitflow/index.ts` | Barrel unchanged |
| `src/stores/gitflow.ts` | Shim stays (5 consumers) |
| `src/stores/domain/git-ops/gitflow.slice.ts` | Slice stays in GitOpsStore |
| `src/lib/branchClassifier.ts` | Core utility (12 consumers) |
| `src/stores/bladeTypes.ts` | "gitflow-cheatsheet" entry stays for type safety |
| `src/machines/navigation/guards.ts` | "gitflow-cheatsheet" in SINGLETON_TYPES stays (registration now comes from extension, but singleton guard remains valid) |

## Rust Backend Impact Analysis

**Impact: NONE**

All Rust commands invoked by the gitflow slice are unchanged:
- `commands.getGitflowStatus()` -- called by `gitflow.slice.ts`
- `commands.initGitflow(config, pushDevelop)` -- called by `gitflow.slice.ts`
- `commands.startFeature(name)` -- called by `gitflow.slice.ts`
- `commands.finishFeature()` -- called by `gitflow.slice.ts`
- `commands.startRelease(version)` -- called by `gitflow.slice.ts`
- `commands.finishRelease(tagMessage)` -- called by `gitflow.slice.ts`
- `commands.startHotfix(name)` -- called by `gitflow.slice.ts`
- `commands.finishHotfix(tagMessage)` -- called by `gitflow.slice.ts`
- `commands.abortGitflow()` -- called by `gitflow.slice.ts`

The `gitflow.slice.ts` remains inside `GitOpsStore` and continues to call these Rust commands directly. No Rust source changes required.

## TypeScript Type Changes

### `BladePropsMap` in `src/stores/bladeTypes.ts`

The `"gitflow-cheatsheet": Record<string, never>` entry **MUST remain**. It is referenced by:
1. `GitflowPanel.tsx` line 206: `openBlade("gitflow-cheatsheet", {} as Record<string, never>)`
2. The navigation machine guards reference it as a singleton type
3. The `openBlade` function in `bladeOpener.ts` needs the generic constraint for type safety

This matches the Phase 39 pattern where `"conventional-commit"` and `"changelog"` entries stayed in `BladePropsMap` after extraction.

### `SINGLETON_TYPES` in `src/machines/navigation/guards.ts`

The `"gitflow-cheatsheet"` entry **stays**. The singleton guard fires when `PUSH_BLADE` events occur, regardless of whether the blade type was registered by core or an extension. The blade registration (which carries `singleton: true`) and the guard set are complementary -- both must remain.

### `navigationMachine.test.ts`

The test at line 15 registers `"gitflow-cheatsheet"` as a singleton blade type in `beforeEach`. This test **stays unchanged** because it tests the navigation machine's singleton guard, which still needs to know about this blade type.

### Command ID Namespacing

The extension command will be registered as `ext:gitflow:open-gitflow-cheatsheet` (auto-namespaced by `ExtensionAPI.registerCommand()`). The core command was registered as bare `open-gitflow-cheatsheet`. Since command IDs are only looked up by the command palette (which iterates all registered commands), this namespace change has **no breaking effect**. Users never type command IDs directly.

Similarly, the toolbar action becomes `ext:gitflow:gitflow-guide` instead of `tb:gitflow-guide`. Toolbar actions are also iterated, never referenced by ID from user code.

### Sidebar Panel ID

The sidebar panel will be registered as `ext:gitflow:gitflow` (auto-namespaced). The `DynamicSidebarPanels` component iterates `getVisiblePanels()` which returns all panels regardless of ID format. No breaking change.

## Testing Strategy

### 1. Extension Lifecycle Test (`src/extensions/__tests__/gitflow.test.ts`)

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../lib/bladeRegistry";
import { useSidebarPanelRegistry } from "../../lib/sidebarPanelRegistry";
import { onActivate, onDeactivate } from "../gitflow";

describe("gitflow extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("gitflow");
  });

  it("registers gitflow-cheatsheet blade type on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("gitflow-cheatsheet")).toBeDefined();

    api.cleanup();
  });

  it("registers blade type without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    // Should NOT be namespaced
    expect(getBladeRegistration("ext:gitflow:gitflow-cheatsheet")).toBeUndefined();

    api.cleanup();
  });

  it("marks blade as lazy and singleton", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("gitflow-cheatsheet");
    expect(reg?.lazy).toBe(true);
    expect(reg?.singleton).toBe(true);

    api.cleanup();
  });

  it("tracks source as ext:gitflow for cleanup", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("gitflow-cheatsheet");
    expect(reg?.source).toBe("ext:gitflow");

    api.cleanup();
  });

  it("registers a sidebar panel for GitflowPanel", async () => {
    await onActivate(api);

    const panels = useSidebarPanelRegistry.getState().panels;
    expect(panels.has("ext:gitflow:gitflow")).toBe(true);

    const panel = panels.get("ext:gitflow:gitflow");
    expect(panel?.title).toBe("Gitflow");
    expect(panel?.priority).toBeGreaterThanOrEqual(1);
    expect(panel?.priority).toBeLessThanOrEqual(69);

    api.cleanup();
  });

  it("unregisters all registrations on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("gitflow-cheatsheet")).toBeUndefined();
    expect(useSidebarPanelRegistry.getState().panels.has("ext:gitflow:gitflow")).toBe(false);
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });

  it("can re-activate after deactivation (built-in extension pattern)", async () => {
    await onActivate(api);
    api.cleanup();

    // Re-activate with fresh API
    const api2 = new ExtensionAPI("gitflow");
    await onActivate(api2);

    expect(getBladeRegistration("gitflow-cheatsheet")).toBeDefined();
    expect(useSidebarPanelRegistry.getState().panels.has("ext:gitflow:gitflow")).toBe(true);

    api2.cleanup();
  });
});
```

### 2. Existing Tests (Stay Unchanged)

- `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.test.tsx` -- Tests the component rendering, unrelated to registration source
- `src/machines/navigation/navigationMachine.test.ts` -- Tests singleton guard, which still works regardless of registration source

### 3. Manual Verification Checklist

- [ ] Open a repository: Gitflow section appears in left sidebar (via DynamicSidebarPanels, not hardcoded)
- [ ] Click "Gitflow Guide" in toolbar: opens gitflow-cheatsheet blade
- [ ] Search "Gitflow" in command palette: "Gitflow Cheatsheet" command appears
- [ ] Click "Gitflow Guide" button inside GitflowPanel: opens gitflow-cheatsheet blade
- [ ] Disable "Gitflow Workflow" extension in Extension Manager: Gitflow sidebar panel disappears, toolbar button disappears, command disappears
- [ ] Re-enable extension: everything reappears
- [ ] Initialize Gitflow flow: start feature, finish feature -- all work correctly
- [ ] Close repository, reopen: Gitflow panel reappears

## Build/Vite Impact Analysis

### Code Splitting

The `GitflowCheatsheetBlade` is wrapped in `lazy()` inside the extension entry point, preserving the existing code-splitting behavior. The chunk boundary remains the same -- `GitflowCheatsheetBlade.tsx` is dynamically imported on first blade render.

### HMR (Hot Module Replacement)

The extension entry point file (`src/extensions/gitflow/index.ts`) does not need special HMR handling. When the file changes during development:
1. Vite invalidates the module
2. App.tsx re-renders (since it imports from the extension)
3. The `useEffect` that calls `registerBuiltIn` re-runs
4. The ExtensionHost deactivates and re-activates the extension

The deleted `registration.ts` had HMR handled through `_discovery.ts`'s `import.meta.hot.dispose()` / `import.meta.hot.accept()`. Since the extension system manages activation/deactivation, this is no longer needed.

### Bundle Size

No new dependencies. The extension entry point adds ~30 lines of registration code. Net change is slightly negative (removing registration.ts + removing from toolbar-actions.ts and navigation.ts is more code than the new entry point).

### Vite Glob Import

`_discovery.ts` uses `import.meta.glob(["./*/registration.{ts,tsx}"])`. After deleting `src/blades/gitflow-cheatsheet/registration.ts`, Vite's glob will simply find one fewer file. No code change needed for the glob pattern itself.

## Sidebar Panel Ordering

The hardcoded RepositoryView sidebar has this order:
1. Branches (hardcoded, `open`)
2. Stashes (hardcoded)
3. Tags (hardcoded)
4. **Gitflow** (hardcoded, being extracted)
5. Worktrees (hardcoded)
6. `<DynamicSidebarPanels />` (extension-contributed panels)

After extraction, the Gitflow panel moves from position 4 (hardcoded) to inside `<DynamicSidebarPanels />`. This means it will render **below** the hardcoded Worktrees section instead of above it.

**Risk assessment:** LOW. The position change is cosmetically minor and the panel is collapsed by default. Users who rely on the exact panel ordering may notice.

**Mitigation options:**
1. Accept the position change (simplest, recommended)
2. Set priority to 69 (maximum extension priority) to ensure it appears first among extension panels
3. Future: Extract Worktrees to an extension too, then all panels can be ordered by priority

**Recommended:** Set priority to 65 and accept the position change. This is consistent with the extension architecture's design intent.

## Risk Matrix

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Sidebar panel position change (below Worktrees instead of above) | LOW | CERTAIN | Accept -- minor cosmetic change; set priority=65 for first-among-extensions |
| Command palette command ID changes from `open-gitflow-cheatsheet` to `ext:gitflow:open-gitflow-cheatsheet` | LOW | CERTAIN | No user-facing impact -- command palette iterates all commands, keyboard shortcuts are unaffected |
| Toolbar action ID changes from `tb:gitflow-guide` to `ext:gitflow:gitflow-guide` | LOW | CERTAIN | No user-facing impact -- toolbar iterates all actions |
| `BranchList.tsx` still imports `useGitflowStore` for protected branches | NONE | N/A | Not affected -- the store and slice remain in core |
| Extension disabled accidentally hides Gitflow sidebar | MEDIUM | LOW | Built-in extensions are active by default; disabled state persists via tauri-plugin-store so intentional |
| `deactivateAll()` skips built-in extensions | NONE | N/A | By design -- `ExtensionHost.deactivateAll()` only deactivates non-built-in extensions. Built-in extensions persist through repo switches |
| Singleton guard in navigation machine might fail if blade not registered | LOW | LOW | Singleton guard checks `SINGLETON_TYPES` set (hardcoded), not the blade registry. Guard works regardless of registration source |
| Registration.ts deletion breaks Vite glob import | NONE | N/A | `import.meta.glob` dynamically discovers files -- removing one file is handled automatically |
| Test in `navigationMachine.test.ts` fails because "gitflow-cheatsheet" not in registry | LOW | LOW | Test registers its own mock blades in `beforeEach` -- independent of extension system |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Extension registration | Custom registration hooks | `ExtensionAPI` facade methods | Handles namespacing, cleanup, error boundary automatically |
| Sidebar panel rendering | Inline JSX in extension | `contributeSidebarPanel()` + `DynamicSidebarPanels` | Already handles visibility, priority sorting, error boundaries |
| Extension state persistence | Custom localStorage | `ExtensionHost` built-in persistence via tauri-plugin-store | Handles enable/disable state across sessions |

## Common Pitfalls

### Pitfall 1: Forgetting to Remove Hardcoded Sidebar Section

**What goes wrong:** If the hardcoded `<details>` block for Gitflow stays in RepositoryView.tsx AND the extension registers a sidebar panel, users see TWO Gitflow panels.
**Why it happens:** Extraction requires both "add new" and "remove old" steps.
**How to avoid:** The RepositoryView.tsx modification (delete lines 181-188) must happen in the SAME task as the extension creation.
**Warning signs:** Two "Gitflow" sections visible in the sidebar during testing.

### Pitfall 2: Incorrect Priority Clamping

**What goes wrong:** Setting sidebar panel priority > 69 causes it to be clamped silently to 69.
**Why it happens:** `ExtensionAPI.contributeSidebarPanel()` clamps priority to 1-69 range (70-100 reserved for core).
**How to avoid:** Use priority 65 (safely within range, high enough to appear near the top of extension panels).
**Warning signs:** Panel appears in unexpected order.

### Pitfall 3: Missing `GitflowPanel` Import in Extension

**What goes wrong:** Using `lazy(() => import("...GitflowPanel"))` for the sidebar panel causes it to not render until the first time the section is expanded, which is wrong behavior for a sidebar panel (it should be eager).
**Why it happens:** Confusing blade registration (lazy is fine) with sidebar panel registration (should be eager).
**How to avoid:** Import `GitflowPanel` eagerly in the extension entry point. Only the `GitflowCheatsheetBlade` needs lazy loading (it is a blade, not a sidebar panel).
**Warning signs:** Sidebar panel shows empty/loading state on first expand.

### Pitfall 4: Breaking the `useGitflowStore` Import Chain

**What goes wrong:** Renaming or removing `src/stores/gitflow.ts` shim breaks 5 component files.
**Why it happens:** Over-aggressive cleanup during extraction.
**How to avoid:** The shim (`useGitflowStore = useGitOpsStore`) stays in place. Shim removal is a separate cleanup task.
**Warning signs:** TypeScript compilation errors in BranchList.tsx, GitflowPanel.tsx, etc.

### Pitfall 5: Removing `gitflow-cheatsheet` from `BladePropsMap`

**What goes wrong:** TypeScript errors in `GitflowPanel.tsx` line 206 and anywhere `openBlade("gitflow-cheatsheet", ...)` is called.
**Why it happens:** Thinking that moving registration to extension means the type should be removed from core types.
**How to avoid:** Core type definitions are about compile-time safety. They are independent of runtime registration source. The entry stays.
**Warning signs:** `TS2345: Argument of type '"gitflow-cheatsheet"' is not assignable to parameter of type 'CoreBladeType'`.

## Open Questions

### 1. Should `useGitflowStore` Shim Be Removed in This Phase?

- **What we know:** The shim at `src/stores/gitflow.ts` is deprecated. It re-exports `useGitOpsStore`. Five files import it.
- **What's unclear:** Whether removing it now is safe or if it should be a separate task.
- **Recommendation:** Do NOT remove the shim in Phase 40. It is out of scope for extraction. Create a follow-up task to update all consumers to import from `useGitOpsStore` directly. This matches Phase 39 where `conventional-utils.ts` stayed in core.

### 2. Should the Gitflow Panel Have a `when()` Guard Based on Gitflow Initialization Status?

- **What we know:** Currently the hardcoded panel always shows. When Gitflow is not initialized, `GitflowPanel` displays an "Initialize Gitflow" prompt.
- **What's unclear:** Whether the extension should hide the sidebar panel entirely when Gitflow is not initialized.
- **Recommendation:** Keep the current behavior -- always show the panel (gated only on `repoStatus` being present). The panel's internal UI handles the uninitialized state gracefully. Hiding it entirely would remove the discovery path for users who haven't initialized Gitflow yet.

### 3. Should the Status Bar Show an Active Flow Indicator?

- **What we know:** The `GitflowPanel` already shows an active flow indicator inline. The extension API supports `contributeStatusBar()`.
- **What's unclear:** Whether a status bar indicator adds value or is redundant.
- **Recommendation:** Defer status bar contribution to a future enhancement. Phase 40 focuses on extraction, not new features.

## Sources

### Primary (HIGH confidence)

- **Codebase analysis:** Direct inspection of all files listed in the File-by-File Change Inventory
- **Phase 39 pattern:** `src/extensions/conventional-commits/index.ts` (proven extraction pattern, 79 lines)
- **ExtensionAPI.ts:** `contributeSidebarPanel()` method with priority clamping (lines 206-216)
- **ExtensionHost.ts:** `registerBuiltIn()` and `deactivateAll()` behavior (lines 304-328, 321-328)
- **Phase 39 tests:** `src/extensions/__tests__/conventional-commits.test.ts` (lifecycle test pattern)

### Secondary (MEDIUM confidence)

- **Phase 39 research:** `.planning/phases/39-conventional-commits-extraction/39-RESEARCH-IMPLEMENTATION.md` (architectural decisions)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries, follows proven pattern
- Architecture: HIGH -- Direct codebase analysis, pattern established by 3 prior extractions
- Pitfalls: HIGH -- Each pitfall identified from actual code analysis, not hypothetical
- Testing: HIGH -- Test pattern directly adapted from existing tests

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable -- codebase patterns well-established)
