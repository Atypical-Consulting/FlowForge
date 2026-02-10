# Phase 40: Gitflow Extraction - UX Research

**Researched:** 2026-02-10
**Domain:** UX flows, graceful degradation, sidebar panel migration, status bar, context menu, extension manager integration
**Confidence:** HIGH
**Researcher:** UX & Graceful Degradation Specialist

---

## 1. Executive Summary

Phase 40 extracts the Gitflow subsystem from FlowForge core into a toggleable built-in extension. The Gitflow subsystem currently spans **15+ files** across sidebar panels, blades, cheatsheet components, toolbar actions, command palette entries, and store slices. The extraction must preserve the existing Gitflow UX while ensuring that when the extension is disabled, users retain a fully functional plain Git client -- branches still list, topology graph still renders with color-coding, and all core Git operations work without Gitflow-specific affordances.

**Critical architectural insight:** The `branchClassifier.ts` utility and its color/style maps (`BRANCH_TYPE_COLORS`, `BRANCH_BADGE_STYLES`, `BRANCH_HEX_COLORS`, `BRANCH_RING_COLORS`) are used by **core UI** (BranchTypeBadge in BranchItem, topology graph's CommitBadge/LaneBackground/LaneHeader, useBranches hook). These MUST stay in core. The Rust backend also provides a `BranchType` enum in `bindings.ts` that mirrors the same classification. Branch coloring is a core Git visualization feature, not a Gitflow-exclusive feature.

**What actually moves to the extension:** The Gitflow sidebar panel (start/finish flows, init dialog), the Gitflow cheatsheet blade, toolbar "Gitflow Guide" button, command palette "open-gitflow-cheatsheet" entry, and the review checklist integration for finish-flow dialogs. These are all Gitflow workflow automation features, not branch visualization features.

**Primary recommendation:** Create `src/extensions/gitflow/index.ts` as a built-in extension. Remove the hardcoded `<details>` section for Gitflow in RepositoryView.tsx. Register the Gitflow sidebar panel via `api.contributeSidebarPanel()` in the extension's `onActivate`. Register the cheatsheet blade, toolbar action, and command palette entry via ExtensionAPI. Follow the proven Phase 38/39 pattern: components stay in place, only registrations move.

---

## 2. Current Gitflow UX Inventory

### 2.1 Complete File Inventory

**Sidebar Panel:**
| File | Purpose | Lines |
|------|---------|-------|
| `src/components/gitflow/GitflowPanel.tsx` | Main sidebar panel (status, start/finish buttons, init prompt) | 229 |
| `src/components/gitflow/StartFlowDialog.tsx` | Dialog for starting feature/release/hotfix | 131 |
| `src/components/gitflow/FinishFlowDialog.tsx` | Dialog for finishing flows with review checklist | 153 |
| `src/components/gitflow/InitGitflowDialog.tsx` | Dialog for initializing Gitflow config | 261 |
| `src/components/gitflow/ReviewChecklist.tsx` | Pre-merge review checklist in finish dialog | 76 |
| `src/components/gitflow/index.ts` | Barrel export | 3 |

**Cheatsheet Blade:**
| File | Purpose | Lines |
|------|---------|-------|
| `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.tsx` | Full cheatsheet blade (diagram, actions, reference) | 81 |
| `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.test.tsx` | Tests | -- |
| `src/blades/gitflow-cheatsheet/registration.ts` | Core blade registration (type: "gitflow-cheatsheet") | 16 |
| `src/components/gitflow/GitflowDiagram.tsx` | SVG branch flow diagram | ~150 |
| `src/components/gitflow/GitflowActionCards.tsx` | Context-aware action cards per branch type | ~90 |
| `src/components/gitflow/GitflowBranchReference.tsx` | Branch type reference table | ~90 |

**Stores:**
| File | Purpose | Lines |
|------|---------|-------|
| `src/stores/gitflow.ts` | Shim re-exporting from git-ops store | 5 |
| `src/stores/domain/git-ops/gitflow.slice.ts` | Gitflow slice (status, init, start/finish flows, abort) | ~200 |
| `src/stores/reviewChecklist.ts` | Shim re-exporting from preferences store | 6 |
| `src/stores/domain/preferences/review-checklist.slice.ts` | Review checklist slice (items, persist, reset) | 129 |

**Commands/Toolbar:**
| File | Reference | Purpose |
|------|-----------|---------|
| `src/commands/toolbar-actions.ts:255-266` | `tb:gitflow-guide` | Gitflow Guide toolbar button (views group, priority 50) |
| `src/commands/navigation.ts:19-30` | `open-gitflow-cheatsheet` | Gitflow Cheatsheet command palette entry |

**Integration Points in Core:**
| File | Reference | Purpose |
|------|-----------|---------|
| `src/components/RepositoryView.tsx:181-188` | Hardcoded `<details>` section | Gitflow panel in sidebar |
| `src/blades/_discovery.ts:20` | `"gitflow-cheatsheet"` in EXPECTED_TYPES | Registration check |
| `src/components/branches/BranchList.tsx:49` | `useGitflowStore((s) => s.gitflowStatus)` | Protected branch detection |
| `src/lib/bulkBranchOps.ts:26` | `gitflowStatus?.context?.isInitialized` | Protected branch set |
| `src/App.tsx:58` | `initChecklist()` | Review checklist initialization |

**Branch Classification (CORE -- does NOT move):**
| File | Purpose | Used By |
|------|---------|---------|
| `src/lib/branchClassifier.ts` | Branch type classification + color maps | BranchTypeBadge, topology graph, useBranches, GitflowCheatsheetBlade |
| `src/components/branches/BranchTypeBadge.tsx` | Colored branch type badge | BranchItem (used for ALL branches) |
| `src/hooks/useBranches.ts` | Enriches all branches with `classifyBranch()` | BranchList |
| `src/blades/topology-graph/components/layoutUtils.ts` | Re-exports BRANCH_HEX_COLORS, BRANCH_BADGE_STYLES, BRANCH_RING_COLORS | CommitBadge, LaneBackground, LaneHeader |
| `src/blades/topology-graph/components/CommitBadge.tsx` | Uses BRANCH_BADGE_STYLES, BRANCH_RING_COLORS for commit node styling | TopologyGraph |
| `src/blades/topology-graph/components/LaneBackground.tsx` | Uses BRANCH_HEX_COLORS for lane shading | TopologyGraph |
| `src/blades/topology-graph/components/LaneHeader.tsx` | Uses BRANCH_BADGE_STYLES for lane name pills | TopologyGraph |
| Rust backend (`bindings.ts:1297`) | `BranchType` enum mirroring GitflowBranchType | GraphNode.branchType |

### 2.2 Dependency Graph

```
RepositoryView.tsx (SIDEBAR)
  |-- [hardcoded <details>] --> <GitflowPanel />
  |                               |-- useGitflowStore (git-ops slice)
  |                               |-- useBladeNavigation (opens cheatsheet)
  |                               |-- useBranchStore (branch change detection)
  |                               |-- <StartFlowDialog> --> useGitflowStore
  |                               |-- <FinishFlowDialog> --> useGitflowStore + <ReviewChecklist>
  |                               |-- <InitGitflowDialog> --> useGitflowStore
  |
  |-- [hardcoded <DynamicSidebarPanels />] --> renders from SidebarPanelRegistry

GitflowCheatsheetBlade.tsx (BLADE)
  |-- useGitflowStore (current branch)
  |-- useRepositoryStore (fallback branch name)
  |-- classifyBranch() from branchClassifier (CORE)
  |-- BRANCH_TYPE_COLORS from branchClassifier (CORE)
  |-- <GitflowDiagram>         (uses branchClassifier CORE)
  |-- <GitflowActionCards>     (uses branchClassifier CORE)
  |-- <GitflowBranchReference> (uses branchClassifier CORE)

toolbar-actions.ts
  |-- tb:gitflow-guide (views group, priority 50, source "core")

navigation.ts (commands)
  |-- open-gitflow-cheatsheet (Navigation category)

branchClassifier.ts (CORE -- widely shared)
  |-- classifyBranch() --> useBranches.ts, BranchTypeBadge.tsx, GitflowCheatsheetBlade.tsx
  |-- BRANCH_TYPE_COLORS --> GitflowDiagram, GitflowCheatsheetBlade, GitflowBranchReference
  |-- BRANCH_HEX_COLORS --> topology LaneBackground, layoutUtils
  |-- BRANCH_BADGE_STYLES --> topology CommitBadge, LaneHeader, BranchTypeBadge
  |-- BRANCH_RING_COLORS --> topology CommitBadge
  |-- BRANCH_TYPE_TW --> (available but not directly consumed currently)
  |-- EnrichedBranch type --> BranchItem, useBranches
```

### 2.3 Core vs. Gitflow-Only Boundaries

**Core (MUST remain -- used by non-Gitflow features):**
- `branchClassifier.ts` -- ALL exports (classifyBranch, color maps, types, EnrichedBranch)
- `BranchTypeBadge.tsx` -- rendered in BranchItem for every branch
- `useBranches.ts` -- enriches branches with classifyBranch() for BranchList
- Topology graph components (CommitBadge, LaneBackground, LaneHeader, layoutUtils)
- `BranchList.tsx` -- uses gitflowStatus for protected branch detection (see section 6.3)
- `bulkBranchOps.ts` -- uses gitflowStatus for protected branch set
- Gitflow store slice in git-ops -- accessed by both extension and core (BranchList)
- Review checklist slice in preferences -- used by settings UI and finish dialog

**Gitflow-only (moves to extension registration):**
- GitflowPanel sidebar section (currently hardcoded in RepositoryView)
- StartFlowDialog, FinishFlowDialog, InitGitflowDialog
- ReviewChecklist component (only used in FinishFlowDialog)
- GitflowCheatsheetBlade + registration
- GitflowDiagram, GitflowActionCards, GitflowBranchReference (only used in cheatsheet)
- `tb:gitflow-guide` toolbar action
- `open-gitflow-cheatsheet` command palette entry

---

## 3. Degradation Scenarios

### 3.1 Scenario Matrix: Gitflow Extension Disabled

| Feature | Extension Active | Extension Disabled | Rationale |
|---------|-----------------|-------------------|-----------|
| Gitflow sidebar panel | Visible in sidebar (4th section) | **Gone from sidebar** | Panel contributed via SidebarPanelRegistry; unregistered on deactivate |
| Start Feature/Release/Hotfix | Available via sidebar buttons | **Unavailable** | Part of GitflowPanel |
| Finish Feature/Release/Hotfix | Available via sidebar buttons | **Unavailable** | Part of GitflowPanel |
| Init Gitflow | Available via sidebar prompt | **Unavailable** | Part of GitflowPanel |
| Gitflow Cheatsheet blade | Can be opened | **Cannot be opened; shows fallback if already open** | Blade registration removed |
| Gitflow Guide toolbar button | Visible in views group | **Hidden** | Toolbar action unregistered |
| Gitflow Cheatsheet command | Available in palette | **Hidden from palette** | Command unregistered |
| Review checklist in finish dialog | Shown before finishing | **Unavailable (whole dialog gone)** | Part of finish flow |
| **Branch color-coding (BranchTypeBadge)** | Shows colored type badges | **Still shows colored type badges** | Core feature -- branchClassifier stays |
| **Topology graph lane coloring** | Shows Gitflow-colored lanes | **Still shows Gitflow-colored lanes** | Core feature -- layoutUtils stays |
| **Branch classification in branch list** | Branches enriched with classifyBranch() | **Still enriched with classifyBranch()** | Core feature -- useBranches stays |
| **Protected branch detection** | Uses gitflowStatus | **Still works (gitflowStatus is null when not initialized, handled gracefully)** | bulkBranchOps handles null |
| Branch operations (create, delete, checkout, merge) | Work | **Work (unchanged)** | Core Git operations |
| Commit workflow | Works | **Works (unchanged)** | Not affected by Gitflow |

### 3.2 Sidebar Layout Changes

**Current sidebar layout (top to bottom):**
```
+------------------------+
| Branches         [+]   |  <- Core (hardcoded)
+------------------------+
| Stashes          [+]   |  <- Core (hardcoded)
+------------------------+
| Tags             [+]   |  <- Core (hardcoded)
+------------------------+
| Gitflow                |  <- HARDCODED -- must migrate
+------------------------+
| Worktrees        [+]   |  <- Core (hardcoded)
+------------------------+
| <DynamicSidebarPanels> |  <- Extension-contributed
+------------------------+
| [Commit Form]          |  <- Core (fixed at bottom)
+------------------------+
```

**After extraction (Gitflow enabled):**
```
+------------------------+
| Branches         [+]   |  <- Core (hardcoded)
+------------------------+
| Stashes          [+]   |  <- Core (hardcoded)
+------------------------+
| Tags             [+]   |  <- Core (hardcoded)
+------------------------+
| Worktrees        [+]   |  <- Core (hardcoded)
+------------------------+
| Gitflow                |  <- Contributed via SidebarPanelRegistry (priority 65)
+------------------------+
| <Other Extensions>     |  <- Other extension panels (lower priority)
+------------------------+
| [Commit Form]          |  <- Core (fixed at bottom)
+------------------------+
```

**After extraction (Gitflow disabled):**
```
+------------------------+
| Branches         [+]   |  <- Core (hardcoded)
+------------------------+
| Stashes          [+]   |  <- Core (hardcoded)
+------------------------+
| Tags             [+]   |  <- Core (hardcoded)
+------------------------+
| Worktrees        [+]   |  <- Core (hardcoded)
+------------------------+
| <Other Extensions>     |  <- Other extension panels
+------------------------+
| [Commit Form]          |  <- Core (fixed at bottom)
+------------------------+
```

**Visual difference:** The only change is the absence of the "Gitflow" section. The sidebar is cleaner but no gaps or layout shifts occur because `DynamicSidebarPanels` is a contiguous block that simply renders fewer items.

### 3.3 Already-Open Cheatsheet Blade When Extension is Disabled

If the user has the Gitflow Cheatsheet blade open and then disables the Gitflow extension:

1. Extension deactivation calls `api.cleanup()` which unregisters blade types
2. The blade instance remains on the navigation stack
3. `BladeRenderer` attempts to look up the blade type, finds no registration
4. **Expected behavior:** Shows graceful fallback (same pattern as Phase 38/39): "This feature requires the Gitflow extension" with "Enable in Extension Manager" button
5. User can navigate back naturally; stale blade is removed from stack

### 3.4 Protected Branch Detection Without Gitflow Extension

`BranchList.tsx` (line 49) reads `useGitflowStore((s) => s.gitflowStatus)` to compute protected branches. When Gitflow extension is disabled:

- The `gitflowStatus` in the git-ops store is populated by calling `commands.getGitflowStatus()` from Rust. This happens on branch change via `GitflowPanel`'s `useEffect`.
- **If the extension is disabled, nobody calls `refreshGitflow()`**, so `gitflowStatus` remains its last-known value or `null`.
- `getProtectedBranches(null)` already handles this: it returns `Set(["main", "master", "develop"])` as the baseline protected set.
- **No change needed.** The protected branch logic degrades gracefully -- it just loses the Gitflow-initialized extra protections.

### 3.5 Review Checklist Settings Without Gitflow Extension

The `ReviewSettings` component at `src/blades/settings/components/ReviewSettings.tsx` allows users to customize the review checklist. When Gitflow extension is disabled:

- The settings page still shows the "Review Checklist" section (it's part of settings, not the extension)
- Users can still customize items, but they won't see them used until they re-enable Gitflow
- **Recommendation:** Gate the Review Checklist settings section on Gitflow extension status. Show a muted message: "Enable the Gitflow extension to use review checklists." This provides clarity about why the settings exist.
- **Alternative (simpler):** Leave settings always visible. Users may configure them in advance, which is benign.
- **Decision:** Use the simpler approach. Settings are preferences; they should be configurable regardless of extension state.

---

## 4. Sidebar Panel Migration Strategy

### 4.1 Current Architecture (Hardcoded)

The Gitflow panel is currently a hardcoded `<details>` section at `RepositoryView.tsx:181-188`:

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

### 4.2 Target Architecture (Registry-Based)

Move the Gitflow panel to the SidebarPanelRegistry via the extension's `onActivate`:

```typescript
api.contributeSidebarPanel({
  id: "gitflow-panel",
  title: "Gitflow",
  icon: GitMerge,  // from lucide-react
  component: GitflowPanel,
  priority: 65,    // Just below core panels (70-100), above other extensions (1-64)
  when: () => !!useRepositoryStore.getState().repoStatus,
  defaultOpen: false,
});
```

### 4.3 Priority Value Analysis

The `DynamicSidebarPanels` component renders panels sorted by priority descending. Extension priorities are clamped to 1-69 (70-100 reserved for core).

**Current visual order (top to bottom):**
1. Branches (hardcoded)
2. Stashes (hardcoded)
3. Tags (hardcoded)
4. **Gitflow** (hardcoded -- between Tags and Worktrees)
5. Worktrees (hardcoded)
6. DynamicSidebarPanels (extension panels)

**After migration:** Gitflow moves from hardcoded position to `DynamicSidebarPanels`. Since all hardcoded panels render before `DynamicSidebarPanels` in the DOM, Gitflow will appear AFTER Worktrees regardless of priority value.

**This is acceptable.** The position shift from "between Tags and Worktrees" to "after Worktrees" is minor. The panel content is the same; only the position changes slightly. Users who had Gitflow between Tags and Worktrees will now see it directly after Worktrees.

**Priority 65** is recommended because:
- It's the highest extension priority (max 69, but 65 leaves room for future priority adjustments)
- It ensures Gitflow appears FIRST among extension-contributed panels
- Other extensions (GitHub, etc.) that contribute sidebar panels will appear below Gitflow

### 4.4 DynamicSidebarPanels Integration

`DynamicSidebarPanels` (RepositoryView.tsx:53-84) already handles everything needed:
- `<details>` wrapper with configurable `open` state
- `<summary>` with icon, title, and optional action button
- `<ExtensionPanelErrorBoundary>` wrapping the component
- Priority-based sorting
- `when()` condition for conditional visibility

The GitflowPanel component itself doesn't need changes -- it already renders its own content inside a `<div>`. The `DynamicSidebarPanels` wrapper provides the `<details>/<summary>` chrome.

### 4.5 What to Remove from RepositoryView.tsx

Remove lines 181-188 (the hardcoded Gitflow `<details>` section). Also remove the `GitflowPanel` import at line 16 and the `GitMerge` icon import at line 5 (if no longer used elsewhere in the file).

---

## 5. Status Bar Widget Design

### 5.1 What Gitflow State Should Show in the Status Bar

The status bar (rendered by `src/components/ui/StatusBar.tsx`) uses `useStatusBarRegistry` to display items. The Gitflow extension should contribute a status bar widget showing the current flow state.

**Proposed widget states:**

| Condition | Display | Color | Click Action |
|-----------|---------|-------|--------------|
| Gitflow not initialized | `Gitflow: Not Init` | ctp-overlay0 (muted) | Open Gitflow panel |
| On main, no active flow | `main` with type badge | ctp-blue | Open Gitflow cheatsheet |
| On develop, no active flow | `develop` with type badge | ctp-green | Open Gitflow cheatsheet |
| Active feature flow | `feature/login` | ctp-mauve | Open Gitflow panel (shows finish options) |
| Active release flow | `release/1.0.0` | ctp-peach | Open Gitflow panel |
| Active hotfix flow | `hotfix/fix-crash` | ctp-red | Open Gitflow panel |

**Implementation:**

```typescript
api.contributeStatusBar({
  id: "gitflow-status",
  alignment: "left",
  priority: 60,
  when: () => !!useRepositoryStore.getState().repoStatus,
  renderCustom: () => createElement(GitflowStatusWidget),
  tooltip: "Gitflow status",
  execute: () => {
    // Click to open gitflow cheatsheet or panel
    openBlade("gitflow-cheatsheet", {});
  },
});
```

The `GitflowStatusWidget` component reads from `useGitflowStore` and renders:
- A small colored dot (matching branch type color)
- The flow type label (e.g., "feature" or "release")
- The flow name (truncated)

**Recommendation for Phase 40:** Include the status bar widget as a **stretch goal**. The core extraction (sidebar panel, blade, toolbar, commands) should be completed first. The status bar widget is additive and can be shipped as a follow-up.

---

## 6. Context Menu Integration

### 6.1 Current Context Menu Architecture

The `contextMenuRegistry.ts` supports registering context menu items scoped to specific locations (file-tree, branch-list, commit-list, etc.). Each item has:
- `location: ContextMenuLocation` -- where it appears
- `when?: (ctx) => boolean` -- conditional visibility
- `execute: (ctx) => void` -- action handler

### 6.2 Proposed Gitflow Context Menu Contributions

**Location: `branch-list`** (right-click on a branch in the sidebar)

| Item | When Condition | Action |
|------|---------------|--------|
| Start Feature from here | On develop branch, no active feature | Open StartFlowDialog("feature") |
| Start Release from here | On develop branch, no active release | Open StartFlowDialog("release") |
| Start Hotfix from here | On main/master branch, no active hotfix | Open StartFlowDialog("hotfix") |
| Finish Current Flow | Active flow exists, on the active flow branch | Open FinishFlowDialog(activeFlowType) |

**Implementation:**

```typescript
api.contributeContextMenu({
  id: "start-feature",
  label: "Start Gitflow Feature",
  icon: Play,
  location: "branch-list",
  group: "gitflow",
  priority: 50,
  when: (ctx) => {
    const status = useGitflowStore.getState().gitflowStatus;
    return status?.canStartFeature === true && ctx.branchName === "develop";
  },
  execute: () => {
    document.dispatchEvent(new CustomEvent("gitflow-start-feature"));
  },
});
```

**Recommendation for Phase 40:** Include context menu contributions as a **stretch goal** alongside the status bar widget. The core extraction should be prioritized.

---

## 7. Extension Manager Integration

### 7.1 How Gitflow Appears in Extension Manager

The Extension Manager blade (`src/blades/extension-manager/ExtensionManagerBlade.tsx`) separates extensions into "Built-in" and "Installed" sections. Each built-in extension shows:
- Name, version, "Built-in" badge
- Description
- Toggle switch (activate/deactivate)

**Gitflow should appear as:**
```
+-------------------------------------------+
| Gitflow Workflow                    v1.0.0 |
| Built-in                                   |
| Gitflow branching model with sidebar,      |
| cheatsheet, and merge flows                |
|                                    [ON/OFF] |
+-------------------------------------------+
```

### 7.2 Registration in App.tsx

Following the established pattern from Phase 38/39, add to `App.tsx`:

```typescript
import {
  onActivate as gitflowActivate,
  onDeactivate as gitflowDeactivate,
} from "./extensions/gitflow";

// In useEffect:
registerBuiltIn({
  id: "gitflow",
  name: "Gitflow Workflow",
  version: "1.0.0",
  activate: gitflowActivate,
  deactivate: gitflowDeactivate,
});
```

### 7.3 Extension Manager After Phase 40

After Phase 40, the Extension Manager will show **four** independently toggleable built-in extensions:

1. **Content Viewers** (Phase 38) -- Markdown, code, 3D model viewers
2. **Conventional Commits** (Phase 39) -- CC form, changelog
3. **GitHub Integration** (pre-existing) -- GitHub auth, PRs, issues
4. **Gitflow Workflow** (Phase 40) -- sidebar panel, cheatsheet, merge flows

Each can be toggled independently. Disabling one does not affect the others.

---

## 8. What Stays in Core vs. Moves to Extension

### 8.1 Core (Always Available)

| Item | Reason |
|------|--------|
| `branchClassifier.ts` (all exports) | Used by BranchTypeBadge, topology graph, useBranches |
| `BranchTypeBadge.tsx` | Renders in BranchItem for ALL branches |
| `useBranches.ts` | Enriches all branches with classifyBranch() |
| Topology graph components (CommitBadge, LaneBackground, LaneHeader, layoutUtils) | Core visualization |
| `Rust BranchType` enum in bindings | Backend classification |
| `gitflow.slice.ts` in git-ops store | Accessed by BranchList for protected branches |
| `review-checklist.slice.ts` in preferences store | Settings page always available |
| `bulkBranchOps.ts` | Protected branch logic handles null gitflowStatus |
| `ReviewSettings.tsx` in settings blade | Preference configuration |
| All branch operations (create, delete, checkout, merge) | Core Git functionality |
| `DynamicSidebarPanels` + `ExtensionPanelErrorBoundary` | Extension panel infrastructure |

### 8.2 Extension (Removed When Disabled)

| Item | Extraction Method |
|------|-------------------|
| `GitflowPanel.tsx` + child dialogs | Component stays in place; registered via `api.contributeSidebarPanel()` |
| `StartFlowDialog.tsx` | Imported by GitflowPanel (stays in place, becomes unreachable when panel is gone) |
| `FinishFlowDialog.tsx` | Imported by GitflowPanel |
| `InitGitflowDialog.tsx` | Imported by GitflowPanel |
| `ReviewChecklist.tsx` | Imported by FinishFlowDialog |
| `GitflowCheatsheetBlade.tsx` + registration | Registration moves to extension `onActivate` with `coreOverride: true` |
| `GitflowDiagram.tsx` | Imported by cheatsheet blade (stays in place, unreachable when blade is gone) |
| `GitflowActionCards.tsx` | Imported by cheatsheet blade |
| `GitflowBranchReference.tsx` | Imported by cheatsheet blade |
| `tb:gitflow-guide` toolbar action | Contributed via `api.contributeToolbar()` |
| `open-gitflow-cheatsheet` command | Contributed via `api.registerCommand()` |

### 8.3 Nuanced Items

**gitflow.slice.ts (stays in core, partially consumed by extension):**
The gitflow slice contains `refreshGitflow()`, `initGitflow()`, `startFeature()`, `finishRelease()`, etc. These are consumed by:
1. `GitflowPanel.tsx` -- extension-contributed (calls refreshGitflow, start/finish actions)
2. `BranchList.tsx` -- core (reads gitflowStatus for protected branches)
3. `GitflowCheatsheetBlade.tsx` -- extension-contributed (reads currentBranch)

The slice MUST stay in the git-ops store because `BranchList.tsx` is core. The extension merely uses the store; it does not own it.

**ReviewChecklist component vs. store:**
- `ReviewChecklist.tsx` (component) -- only used in `FinishFlowDialog.tsx`, which is Gitflow-only. This effectively moves with the extension.
- `review-checklist.slice.ts` (store) -- stays in preferences store. The settings page always shows checklist configuration.

**refreshGitflow() calls:**
Currently, `GitflowPanel.tsx` calls `refreshGitflow()` in a `useEffect` on branch changes. When the extension is disabled, nobody calls `refreshGitflow()`, so `gitflowStatus` becomes stale. This is acceptable because:
1. `getProtectedBranches(null)` handles null status gracefully
2. No other core code depends on fresh gitflowStatus
3. When the extension is re-enabled, `GitflowPanel` re-renders and calls refreshGitflow()

---

## 9. File Inventory: Create, Modify, Delete

### 9.1 Files to Create

| File | Purpose | UX Rationale |
|------|---------|--------------|
| `src/extensions/gitflow/index.ts` | Extension entry point (onActivate, onDeactivate) | Follows Phase 38/39 pattern for built-in extension registration |

### 9.2 Files to Modify

| File | Change | UX Rationale |
|------|--------|--------------|
| `src/components/RepositoryView.tsx` | Remove hardcoded Gitflow `<details>` section (lines 181-188), remove GitflowPanel import, remove GitMerge icon import | Gitflow panel moves to registry-based rendering via DynamicSidebarPanels |
| `src/commands/toolbar-actions.ts` | Remove `tb:gitflow-guide` entry (lines 255-266) | Toolbar action contributed by extension instead |
| `src/commands/navigation.ts` | Remove `open-gitflow-cheatsheet` command registration (lines 19-30) | Command contributed by extension instead |
| `src/blades/_discovery.ts` | Remove `"gitflow-cheatsheet"` from EXPECTED_TYPES array | Blade type now contributed by extension, not core |
| `src/App.tsx` | Add `registerBuiltIn()` call for gitflow extension; import onActivate/onDeactivate | Follows established pattern from other built-in extensions |
| `src/blades/settings/components/ReviewSettings.tsx` | (Optional) Add note about Gitflow extension dependency | Helps users understand the connection between settings and extension |

### 9.3 Files to Delete

| File | Reason |
|------|--------|
| `src/blades/gitflow-cheatsheet/registration.ts` | Side-effect registration replaced by extension onActivate |

### 9.4 Files That Stay Unchanged

| File | Reason |
|------|--------|
| `src/components/gitflow/GitflowPanel.tsx` | Component stays in place; now rendered via registry |
| `src/components/gitflow/StartFlowDialog.tsx` | Component stays in place |
| `src/components/gitflow/FinishFlowDialog.tsx` | Component stays in place |
| `src/components/gitflow/InitGitflowDialog.tsx` | Component stays in place |
| `src/components/gitflow/ReviewChecklist.tsx` | Component stays in place |
| `src/components/gitflow/GitflowDiagram.tsx` | Component stays in place |
| `src/components/gitflow/GitflowActionCards.tsx` | Component stays in place |
| `src/components/gitflow/GitflowBranchReference.tsx` | Component stays in place |
| `src/components/gitflow/index.ts` | Barrel export stays |
| `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.tsx` | Component stays; registration moves |
| `src/lib/branchClassifier.ts` | Core utility -- widely used |
| `src/components/branches/BranchTypeBadge.tsx` | Core component |
| `src/hooks/useBranches.ts` | Core hook |
| `src/stores/gitflow.ts` | Store shim stays |
| `src/stores/domain/git-ops/gitflow.slice.ts` | Store slice stays in core |
| `src/stores/reviewChecklist.ts` | Store shim stays |
| `src/stores/domain/preferences/review-checklist.slice.ts` | Store slice stays in core |
| `src/lib/bulkBranchOps.ts` | Core utility |
| `src/components/branches/BranchList.tsx` | Core component |
| All topology graph components | Core visualization |

---

## 10. Extension onActivate Design

### 10.1 Proposed Implementation

```typescript
// src/extensions/gitflow/index.ts
import { lazy } from "react";
import { GitBranch, GitMerge } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { openBlade } from "../../lib/bladeOpener";
import { useRepositoryStore } from "../../stores/repository";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component imports
  const GitflowCheatsheetBlade = lazy(() =>
    import("../../blades/gitflow-cheatsheet/GitflowCheatsheetBlade").then((m) => ({
      default: m.GitflowCheatsheetBlade,
    }))
  );

  // Import GitflowPanel synchronously for sidebar (it's small and always needed)
  const { GitflowPanel } = await import("../../components/gitflow/GitflowPanel");

  // Register cheatsheet blade with coreOverride to preserve existing type name
  api.registerBlade({
    type: "gitflow-cheatsheet",
    title: "Gitflow Guide",
    component: GitflowCheatsheetBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
  });

  // Contribute sidebar panel
  api.contributeSidebarPanel({
    id: "gitflow-panel",
    title: "Gitflow",
    icon: GitMerge,
    component: GitflowPanel,
    priority: 65,
    when: () => !!useRepositoryStore.getState().repoStatus,
    defaultOpen: false,
  });

  // Contribute toolbar action
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

  // Register command palette entry
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
  // (sidebar panel, blade, toolbar, command are all auto-cleaned)
}
```

### 10.2 Key Design Decisions

1. **coreOverride: true** for the blade -- preserves the `"gitflow-cheatsheet"` type name so existing references in navigation guards and blade type definitions don't break.

2. **Priority 65** for sidebar panel -- highest allowed extension priority (clamped to max 69), ensuring Gitflow appears first among extension panels.

3. **Synchronous GitflowPanel import** -- the sidebar panel component is small and always visible when the extension is active. Unlike blade components which can be lazy-loaded, the sidebar panel needs to be immediately available for rendering.

4. **No custom deactivate logic** -- all registrations (sidebar panel, blade, toolbar, commands) are tracked by ExtensionAPI and auto-cleaned via `api.cleanup()`.

---

## 11. Transition Experience

### 11.1 Extension Enable Transition (disabled -> active)

1. User opens Extension Manager blade
2. User toggles ON the "Gitflow Workflow" extension
3. `activateExtension("gitflow")` runs
4. Extension's `onActivate(api)` registers:
   - Gitflow sidebar panel via SidebarPanelRegistry
   - Gitflow cheatsheet blade type (with coreOverride)
   - Toolbar action for Gitflow Guide
   - Command palette entry for cheatsheet
5. Toast: "Gitflow Workflow enabled"
6. Sidebar re-renders: Gitflow panel appears below Worktrees
7. Toolbar re-renders: Gitflow Guide button appears in views group
8. No blades auto-open -- user must explicitly interact

**Key UX principle:** Enabling the extension makes Gitflow features available but does NOT force the user into Gitflow mode. If Gitflow is not initialized in the repo, the panel shows "Gitflow not initialized" with an init button.

### 11.2 Extension Disable Transition (active -> disabled)

1. User opens Extension Manager blade
2. User toggles OFF the "Gitflow Workflow" extension
3. `deactivateExtension("gitflow")` runs
4. `api.cleanup()` unregisters all contributions
5. Toast: "Gitflow Workflow disabled"
6. Sidebar re-renders: Gitflow panel disappears
7. Toolbar re-renders: Gitflow Guide button disappears
8. Any open Gitflow Cheatsheet blade shows graceful fallback
9. Branch list, topology graph, branch coloring all continue working normally

**Key UX principle:** Disabling the extension never breaks core Git functionality. Branches still display with type badges, the topology graph still shows colored lanes, and all Git operations work identically.

### 11.3 Mid-Operation Disable Scenario

If the user has an active Gitflow flow (e.g., currently on `feature/login`) and disables the extension:

1. The sidebar panel disappears (no "Finish Feature" button)
2. The branch still exists and is checked out
3. The user can still commit, push, and manually merge via core Git operations
4. If the extension is re-enabled, GitflowPanel refreshes and shows the active flow again

**This is acceptable.** The user is consciously disabling the extension. They can still manage their branches manually. No data is lost.

---

## 12. Risk Matrix for UX Regressions

### 12.1 High Risk

| Risk | Impact | Mitigation | Confidence |
|------|--------|------------|------------|
| Branch coloring disappears when extension is disabled | Users lose critical visual distinction in branch list and topology graph | **branchClassifier stays in core** -- this risk is mitigated by design | HIGH |
| Protected branch detection fails without gitflow extension | Users could accidentally delete main/develop in bulk delete | **bulkBranchOps handles null gitflowStatus** -- baseline set always includes main/master/develop | HIGH |
| Sidebar panel renders in wrong position | Gitflow panel appears at unexpected location in sidebar | Priority 65 ensures first-among-extensions; position after Worktrees is a minor, acceptable shift | HIGH |

### 12.2 Medium Risk

| Risk | Impact | Mitigation | Confidence |
|------|--------|------------|------------|
| GitflowPanel re-renders excessively via registry | Performance degradation in sidebar | `DynamicSidebarPanels` uses `useMemo` with `visibilityTick` -- only re-renders on registry changes | MEDIUM |
| Extension activation race at startup | Gitflow panel briefly missing on first render | `registerBuiltIn()` activates synchronously in the same microtask; should be fast enough | MEDIUM |
| `gitflowStatus` becomes stale when extension is disabled | BranchList's protected branch set misses custom Gitflow names | Only matters if user had custom branch names (not main/master/develop); baseline set is always present | MEDIUM |
| Cheatsheet blade shows stale data after extension re-enable | User sees old branch info in cheatsheet | Cheatsheet reads from stores reactively; `useGitflowStore` and `useRepositoryStore` are live | HIGH |

### 12.3 Low Risk

| Risk | Impact | Mitigation | Confidence |
|------|--------|------------|------------|
| `ExtensionPanelErrorBoundary` catches GitflowPanel errors | Panel shows error message instead of Gitflow UI | This is by design -- error boundary protects the rest of the sidebar | HIGH |
| Review checklist settings visible but unused when extension disabled | User confusion about orphaned settings | Minor -- settings clearly labeled "Review Checklist" with "Gitflow" context | LOW |
| Keyboard shortcuts for Gitflow commands disappear when disabled | User muscle memory broken | Gitflow commands don't have keyboard shortcuts currently (command palette + toolbar only) | HIGH |
| HMR issues during development | `_discovery.ts` warns about missing "gitflow-cheatsheet" registration | Remove from EXPECTED_TYPES list since it's now extension-contributed | HIGH |

---

## 13. Common Pitfalls

### Pitfall 1: Moving branchClassifier to Extension

**What goes wrong:** If branchClassifier.ts is moved into the Gitflow extension, all core components that import it break (BranchTypeBadge, topology graph, useBranches).

**Why it happens:** Natural assumption that "Gitflow = branch classification" but classification is actually a core visualization feature.

**How to avoid:** branchClassifier.ts MUST remain in `src/lib/`. The types, colors, and classification function are shared infrastructure. The extension uses them but does not own them.

### Pitfall 2: Extension Priority Clamping Surprise

**What goes wrong:** Sidebar panel priority set to 70+ gets clamped to 69 silently. Panel appears at wrong position relative to other extensions.

**Why it happens:** `ExtensionAPI.contributeSidebarPanel()` clamps priority to 1-69 range.

**How to avoid:** Use explicit priority 65. Document the reasoning in comments.

### Pitfall 3: Forgetting to Remove Hardcoded Sidebar Section

**What goes wrong:** After creating the extension, the Gitflow panel appears TWICE in the sidebar -- once hardcoded, once from the registry.

**Why it happens:** Developer creates the extension registration but forgets to remove the hardcoded `<details>` section from RepositoryView.tsx.

**How to avoid:** The plan must explicitly include removing lines 181-188 from RepositoryView.tsx as a step that is verified before moving on.

### Pitfall 4: Blade Type Name Collision

**What goes wrong:** If `coreOverride: true` is forgotten, the blade type becomes `ext:gitflow:gitflow-cheatsheet` instead of `gitflow-cheatsheet`. All existing references break.

**Why it happens:** Default ExtensionAPI behavior namespaces blade types with `ext:{id}:` prefix.

**How to avoid:** Use `coreOverride: true` in the blade registration, same as Phase 38/39.

### Pitfall 5: Not Removing Core Toolbar and Command Registrations

**What goes wrong:** After creating extension-contributed toolbar and command, the originals in `toolbar-actions.ts` and `navigation.ts` still exist. User sees duplicate entries.

**Why it happens:** Extension adds new entries but old side-effect registrations still run at startup.

**How to avoid:** The plan must explicitly include removing `tb:gitflow-guide` from toolbar-actions.ts and `open-gitflow-cheatsheet` from navigation.ts.

### Pitfall 6: BranchList Dependency on gitflowStatus

**What goes wrong:** Someone removes the gitflow store slice from git-ops thinking it belongs to the extension. BranchList breaks because it can't read gitflowStatus.

**Why it happens:** The store slice serves both core (BranchList) and extension (GitflowPanel) consumers.

**How to avoid:** Document clearly that gitflow.slice.ts stays in the git-ops store. The extension consumes the store; it does not own it.

---

## 14. Accessibility Considerations

### 14.1 Sidebar Panel Transition

When the Gitflow panel appears/disappears due to extension toggle:
- The `DynamicSidebarPanels` component conditionally renders panels
- No `aria-live` region is needed for extension panel appearance (it's a deliberate settings change, not content change)
- The `<details>/<summary>` pattern in DynamicSidebarPanels is natively accessible

### 14.2 GitflowPanel Accessibility

The current GitflowPanel has:
- `<button>` elements with `title` attributes for start/finish actions
- `disabled` state with `cursor-not-allowed` and opacity change
- Clear visual grouping with `<h4>` headings ("Start", "Finish")

**Gaps:**
- Start/Finish buttons lack `aria-disabled` (only use `disabled` attribute, which is sufficient for `<button>`)
- No `aria-label` on the GitflowPanel `<details>` (provided by `<summary>` text content)
- The active flow indicator uses color alone (mauve background) -- but also includes text label ("feature", "release", etc.), so it's accessible

### 14.3 Keyboard Navigation

When Gitflow panel is contributed via registry:
- Tab order follows DOM order (after Worktrees, before other extension panels)
- `<details>` is natively focusable and toggleable via Enter/Space
- No custom keyboard shortcuts are registered for Gitflow actions (all accessible via command palette)

---

## 15. Open Questions

### Q1: Should the Gitflow store slice move to the extension?

**Current:** gitflow.slice.ts is part of the git-ops unified store.
**Analysis:** BranchList.tsx (core) reads `gitflowStatus` for protected branch detection. If the slice moves, BranchList needs a different way to get this info.
**Recommendation:** Keep the slice in core. The cost of moving it (breaking BranchList, needing a new protected-branch API) outweighs the benefit. The slice is lightweight and self-contained.

### Q2: Should the Gitflow panel have a renderAction for the "Guide" button?

**Current:** GitflowPanel has a "Gitflow Guide" link at the bottom of its content.
**Alternative:** Use `renderAction` on the sidebar panel config to add a small book icon in the summary header.
**Recommendation:** Add renderAction with a BookOpen icon that opens the cheatsheet. This follows the pattern of Branches having a "+" action button. The in-panel link can also stay for redundancy.

### Q3: Should we gate reviewChecklist initialization on extension status?

**Current:** `App.tsx` always calls `initChecklist()` at startup.
**Analysis:** The checklist store data is benign when Gitflow is disabled. It's just persisted preferences.
**Recommendation:** Keep initChecklist() unconditional. The data is tiny and harmless. Users who configure checklists before enabling Gitflow won't lose their settings.

### Q4: Should context menu items be part of MVP or stretch?

**Analysis:** Context menu items for "Start Feature from this branch" add valuable UX but are not part of the core extraction requirements (GFEX-01 through GFEX-06).
**Recommendation:** Mark as stretch goal. Focus on the five success criteria first: sidebar panel, cheatsheet blade, branch classification, disable = all gone, Extension Manager shows four extensions.

---

## 16. Sources

### Primary (HIGH confidence -- direct code analysis)

- `src/components/RepositoryView.tsx:181-188` -- hardcoded Gitflow sidebar section
- `src/components/RepositoryView.tsx:53-84` -- DynamicSidebarPanels component
- `src/components/gitflow/GitflowPanel.tsx` -- sidebar panel content
- `src/components/gitflow/StartFlowDialog.tsx` -- start flow dialog
- `src/components/gitflow/FinishFlowDialog.tsx` -- finish flow dialog with review checklist
- `src/components/gitflow/InitGitflowDialog.tsx` -- init Gitflow dialog
- `src/components/gitflow/ReviewChecklist.tsx` -- review checklist component
- `src/components/gitflow/GitflowDiagram.tsx` -- SVG diagram
- `src/components/gitflow/GitflowActionCards.tsx` -- action cards
- `src/components/gitflow/GitflowBranchReference.tsx` -- branch reference
- `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.tsx` -- cheatsheet blade
- `src/blades/gitflow-cheatsheet/registration.ts` -- current blade registration
- `src/lib/branchClassifier.ts` -- branch classification + color maps (CORE)
- `src/components/branches/BranchTypeBadge.tsx` -- branch type badge (CORE)
- `src/components/branches/BranchItem.tsx` -- branch item with badge (CORE)
- `src/hooks/useBranches.ts` -- branch enrichment with classifyBranch (CORE)
- `src/blades/topology-graph/components/layoutUtils.ts` -- topology graph color imports (CORE)
- `src/blades/topology-graph/components/CommitBadge.tsx` -- commit badge styling (CORE)
- `src/blades/topology-graph/components/LaneBackground.tsx` -- lane background coloring (CORE)
- `src/blades/topology-graph/components/LaneHeader.tsx` -- lane header styling (CORE)
- `src/commands/toolbar-actions.ts:255-266` -- tb:gitflow-guide toolbar action
- `src/commands/navigation.ts:19-30` -- open-gitflow-cheatsheet command
- `src/stores/gitflow.ts` -- store shim
- `src/stores/domain/git-ops/gitflow.slice.ts` -- gitflow store slice
- `src/stores/reviewChecklist.ts` -- review checklist store shim
- `src/stores/domain/preferences/review-checklist.slice.ts` -- review checklist slice
- `src/lib/bulkBranchOps.ts` -- protected branch detection
- `src/components/branches/BranchList.tsx` -- BranchList gitflowStatus usage
- `src/extensions/ExtensionAPI.ts` -- contributeSidebarPanel, contributeToolbar, registerBlade
- `src/extensions/ExtensionHost.ts` -- registerBuiltIn, activation lifecycle
- `src/extensions/extensionTypes.ts` -- BuiltInExtensionConfig
- `src/lib/sidebarPanelRegistry.ts` -- SidebarPanelConfig, priority system
- `src/lib/statusBarRegistry.ts` -- StatusBarItem, alignment, priority
- `src/lib/contextMenuRegistry.ts` -- ContextMenuItem, locations
- `src/lib/toolbarRegistry.ts` -- ToolbarAction, groups
- `src/blades/_discovery.ts` -- EXPECTED_TYPES exhaustiveness check
- `src/blades/extension-manager/ExtensionManagerBlade.tsx` -- Extension Manager UI
- `src/blades/extension-manager/components/ExtensionCard.tsx` -- Extension toggle card
- `src/components/ui/StatusBar.tsx` -- Status bar renderer
- `src/App.tsx` -- Extension registration, initChecklist
- `src/blades/settings/components/ReviewSettings.tsx` -- Review checklist settings

### Secondary (MEDIUM confidence -- pattern extrapolation)

- `src/extensions/content-viewers/index.ts` -- Phase 38 extraction pattern (coreOverride, lazy components)
- `src/extensions/conventional-commits/index.ts` -- Phase 39 extraction pattern (toolbar, commands, blade)
- `src/extensions/github/index.ts` -- GitHub extension pattern (toolbar, commands, sidebar, store watchers)
- `.planning/phases/39-conventional-commits-extraction/39-RESEARCH-UX.md` -- Phase 39 UX patterns

---

## Metadata

**Confidence breakdown:**
- Current Gitflow UX inventory: HIGH -- exhaustive code analysis of all files
- Core vs. extension boundary: HIGH -- verified all consumers of branchClassifier and gitflowStatus
- Graceful degradation design: HIGH -- null/absent handling verified in code
- Sidebar panel migration: HIGH -- SidebarPanelRegistry API matches requirements exactly
- Extension Manager integration: HIGH -- follows proven Phase 38/39 registerBuiltIn pattern
- Status bar widget: MEDIUM -- design proposal, not yet validated
- Context menu integration: MEDIUM -- design proposal, not yet validated
- Accessibility: MEDIUM -- static code analysis, no runtime testing
- Risk matrix: HIGH -- based on direct dependency analysis

**Research date:** 2026-02-10
**Valid until:** 2026-03-12 (stable internal architecture)
