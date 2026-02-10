# Phase 40: Gitflow Extraction - Architecture Research

**Researched:** 2026-02-10
**Domain:** Extension extraction, store decoupling, sidebar contribution, UI registration migration
**Confidence:** HIGH

## Summary

Phase 40 extracts Gitflow from a hardcoded core feature into a toggleable built-in extension. The Gitflow surface area spans 5 layers: sidebar panel (RepositoryView.tsx), components (7 files in `components/gitflow/`), blade (gitflow-cheatsheet), store slice (gitflow.slice.ts in GitOpsStore), and registrations (toolbar, command, blade). The proven extraction pattern from Phase 38-39 (content-viewers, conventional-commits) provides the template: create `src/extensions/gitflow/index.ts` with `onActivate`/`onDeactivate`, use `registerBuiltIn()` in App.tsx, and migrate all registrations to `ExtensionAPI` calls. The unique challenge is the Gitflow slice's cross-slice dependency on `loadBranches()` and `refreshRepoStatus()` within GitOpsStore, and the hardcoded GitflowPanel in RepositoryView.tsx.

**Primary recommendation:** Keep the gitflow.slice.ts inside GitOpsStore (Option A). The extension contributes UI surfaces only -- sidebar panel, blade, toolbar, command -- using the existing slice through the `useGitflowStore` shim. The slice stays because (1) it already calls Rust directly with no frontend caching (GFEX-06 compliance), (2) extracting it creates a cross-store coordination problem that `gitHookBus` can solve but introduces unnecessary complexity, and (3) Phase 39 proved that keeping `conventional-utils.ts` in core while the extension contributes UI is the correct boundary.

---

## Architecture Decision Records

### ADR-1: Store Architecture -- Keep Slice in GitOpsStore

**Status:** RECOMMENDED

**Context:** The `gitflow.slice.ts` (155 lines) is a Zustand slice inside GitOpsStore. It calls 8 Rust backend commands directly through the `commands` binding. After each mutation (startFeature, finishFeature, etc.), it calls three store methods:
- `get().refreshGitflow()` -- same slice (always works)
- `get().loadBranches()` -- cross-slice call to BranchSlice
- `get().refreshRepoStatus()` -- cross-slice call to RepositorySlice

Three options were evaluated:

**Option A: Keep slice in GitOpsStore (RECOMMENDED)**
- Extension wraps existing slice via `useGitflowStore` shim (already exists at `src/stores/gitflow.ts`)
- Cross-slice calls continue to work via `get()` since all slices are in the same store
- Extension contributes UI surfaces only: sidebar panel, blade, toolbar, command
- Components stay in `src/components/gitflow/`, blade stays in `src/blades/gitflow-cheatsheet/`
- No store migration needed
- Follows GFEX-06: "Gitflow extension state always defers to Rust backend"

**Option B: Extract to standalone store**
- Extension creates its own Zustand store calling Rust commands directly
- Cross-slice calls (`loadBranches`, `refreshRepoStatus`) require an event bridge:
  - Gitflow store emits `gitHookBus.emitDid("branch-create")` after operations
  - Core BranchSlice subscribes to bus events to auto-refresh
- GitflowSlice removed from GitOpsStore type union
- Adds complexity: bus subscriptions, timing concerns, duplicate patterns
- Risk: split-brain between extension store and GitOpsStore (Pitfall #1 from v1.6.0-PITFALLS.md)

**Option C: GitHookBus integration (replaces cross-slice calls)**
- Gitflow slice stays in GitOpsStore but uses `gitHookBus.emitDid()` instead of `get().loadBranches()`
- BranchSlice/RepositorySlice listen to bus events
- Partial decoupling: slice still in GitOpsStore but communicates indirectly
- Unnecessary indirection -- the current direct calls work correctly

**Decision:** Option A. Rationale:
1. **Minimal risk.** No store migration means no split-brain risk, no circular import risk, no bus timing issues.
2. **Precedent.** Phase 39 kept `conventional-utils.ts` and the conventional store in core. The CC extension only contributes UI registrations. Gitflow follows the same pattern.
3. **GFEX-06 compliance.** The slice already defers entirely to Rust backend -- `get().refreshGitflow()` calls `commands.getGitflowStatus()` every time. No frontend state caching.
4. **Simplicity.** The `useGitflowStore` shim (`stores/gitflow.ts`) already re-exports `useGitOpsStore`. Components keep importing from `../../stores/gitflow` with zero changes.
5. **Future extraction possible.** If a future phase demands full store extraction, Option B can be done then. The UI contribution pattern from Option A is the same regardless.

**Confidence:** HIGH -- based on direct codebase analysis and Phase 38-39 proven patterns.

---

### ADR-2: branchClassifier.ts Stays in Core

**Status:** CONFIRMED

**Context:** `branchClassifier.ts` (112 lines) exports `classifyBranch()`, `GitflowBranchType`, `EnrichedBranch`, and 5 color maps (BRANCH_TYPE_COLORS, BRANCH_TYPE_TW, BRANCH_HEX_COLORS, BRANCH_BADGE_STYLES, BRANCH_RING_COLORS).

**Consumer analysis (source files only):**

| Consumer | Location | Type | Import Usage |
|----------|----------|------|-------------|
| `useBranches.ts` | `src/hooks/` | **Core** | `classifyBranch`, `EnrichedBranch` |
| `BranchTypeBadge.tsx` | `src/components/branches/` | **Core** | `classifyBranch`, `BRANCH_BADGE_STYLES`, `GitflowBranchType` |
| `BranchItem.tsx` | `src/components/branches/` | **Core** | `EnrichedBranch` (type only) |
| `BulkDeleteDialog.tsx` | `src/components/branches/` | **Core** | `EnrichedBranch` (type only) |
| `branchScopes.ts` | `src/lib/` | **Core** | `EnrichedBranch` (type only) |
| `TopologyPanel.tsx` | `src/blades/topology-graph/` | **Core** | `classifyBranch`, `GitflowBranchType` |
| `layoutUtils.ts` | `src/blades/topology-graph/` | **Core** | `BRANCH_HEX_COLORS`, `BRANCH_BADGE_STYLES`, `BRANCH_RING_COLORS` |
| `LaneBackground.tsx` | `src/blades/topology-graph/` | **Core** | (via layoutUtils re-export) |
| `CommitBadge.tsx` | `src/blades/topology-graph/` | **Core** | (via layoutUtils re-export) |
| `LaneHeader.tsx` | `src/blades/topology-graph/` | **Core** | (via layoutUtils re-export) |
| `GitflowDiagram.tsx` | `src/components/gitflow/` | **Gitflow** | `GitflowBranchType`, `BRANCH_TYPE_COLORS` |
| `GitflowActionCards.tsx` | `src/components/gitflow/` | **Gitflow** | `GitflowBranchType`, `BRANCH_TYPE_COLORS` |
| `GitflowBranchReference.tsx` | `src/components/gitflow/` | **Gitflow** | `GitflowBranchType`, `BRANCH_TYPE_COLORS` |
| `GitflowCheatsheetBlade.tsx` | `src/blades/gitflow-cheatsheet/` | **Gitflow** | `classifyBranch`, `BRANCH_TYPE_COLORS`, `GitflowBranchType` |

**Core consumers: 10 files.** Gitflow-only consumers: 4 files.

**Decision:** `branchClassifier.ts` MUST stay in `src/lib/branchClassifier.ts`. It is a read-side classification utility with broad core usage (topology, branch list, badges). Moving it to the extension would break 10+ core files. This matches Phase 39's pattern where `conventional-utils.ts` stayed in core.

**Consequence for branch coloring:** Branch classification and color-coding are always available, even when the Gitflow extension is disabled. This is correct behavior -- a branch named `feature/foo` should still get purple coloring regardless of whether Gitflow workflow operations are enabled. The extension contributes the *workflow* (start/finish/init dialogs), not the *classification*.

**Confidence:** HIGH -- direct consumer count from codebase grep.

---

### ADR-3: Components Stay in Place, Only Registrations Move

**Status:** RECOMMENDED

**Context:** The Gitflow UI consists of:
- 7 components in `src/components/gitflow/` (GitflowPanel, InitGitflowDialog, StartFlowDialog, FinishFlowDialog, GitflowDiagram, GitflowActionCards, GitflowBranchReference)
- 1 blade in `src/blades/gitflow-cheatsheet/` (GitflowCheatsheetBlade + registration.ts)
- 1 review-checklist component (ReviewChecklist.tsx, uses `useReviewChecklistStore` from core)

**Options evaluated:**
1. **Move components to `src/extensions/gitflow/components/`**: Requires updating all relative imports. Creates a different import convention from Phase 38-39 extensions (CC and content-viewers kept components in their original locations).
2. **Keep components in place, only move registrations**: Extension entry point uses lazy imports to reference existing component files. Follows Phase 38-39 proven pattern exactly.

**Decision:** Option 2 -- keep components in place. The extension entry point (`src/extensions/gitflow/index.ts`) registers UI surfaces through `ExtensionAPI` using lazy imports to existing component locations. This is the exact pattern used by both `conventional-commits/index.ts` and `content-viewers/index.ts`.

**Confidence:** HIGH -- follows proven Phase 38-39 pattern.

---

### ADR-4: Sidebar Contribution Strategy

**Status:** RECOMMENDED

**Context:** The Gitflow panel is currently hardcoded in `RepositoryView.tsx` at lines 181-188 as a `<details>` block that directly renders `<GitflowPanel />`. The SidebarPanelRegistry (built in Phase 37) provides `api.contributeSidebarPanel()` and `DynamicSidebarPanels` already renders extension-contributed panels at the bottom of the sidebar.

**Challenge:** The Gitflow `<details>` block is positioned between Tags and Worktrees. Moving it to `DynamicSidebarPanels` (which renders after Worktrees) changes its position. However, this is acceptable because:
1. The sidebar ordering was never a user-configurable property
2. Extension panels appearing after core panels is the expected convention
3. Priority-based sorting within `DynamicSidebarPanels` provides ordering control

**Decision:**
1. Remove the hardcoded `<details>` block for Gitflow from `RepositoryView.tsx` (lines 181-188)
2. Remove the `GitflowPanel` import from `RepositoryView.tsx`
3. Extension's `onActivate()` calls `api.contributeSidebarPanel()` with `GitflowPanel` component
4. Priority set to 60 (will appear before other extension panels, after core sections)

**Important nuance:** `DynamicSidebarPanels` already wraps each panel in a `<details>` with the summary/icon pattern. The `GitflowPanel` component currently renders its own content without a `<details>` wrapper (the wrapper is in RepositoryView.tsx). So the migration is clean -- the registry provides the wrapper, GitflowPanel provides the content.

**Confidence:** HIGH -- infrastructure already exists and is tested with extension panels.

---

## Extension Entry Point Design

### Pattern (Following Phase 38-39)

```
src/extensions/gitflow/
  index.ts              -- onActivate/onDeactivate (NEW, ~60 lines)
```

The entry point will:
1. Lazy-import GitflowPanel and GitflowCheatsheetBlade
2. Register 1 sidebar panel via `api.contributeSidebarPanel()`
3. Register 1 blade via `api.registerBlade()` with `coreOverride: true`
4. Register 1 toolbar action via `api.contributeToolbar()`
5. Register 1 command via `api.registerCommand()`

### onActivate Implementation Pattern

```typescript
import { lazy } from "react";
import { GitBranch, GitMerge } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { openBlade } from "../../lib/bladeOpener";
import { useRepositoryStore } from "../../stores/repository";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component imports
  const GitflowPanel = lazy(() =>
    import("../../components/gitflow/GitflowPanel").then((m) => ({
      default: m.GitflowPanel,
    }))
  );
  const GitflowCheatsheetBlade = lazy(() =>
    import("../../blades/gitflow-cheatsheet/GitflowCheatsheetBlade").then((m) => ({
      default: m.GitflowCheatsheetBlade,
    }))
  );

  // Sidebar panel contribution
  api.contributeSidebarPanel({
    id: "gitflow",
    title: "Gitflow",
    icon: GitMerge,
    component: GitflowPanel,
    priority: 60,
    when: () => !!useRepositoryStore.getState().repoStatus,
  });

  // Blade registration (coreOverride to keep "gitflow-cheatsheet" type name)
  api.registerBlade({
    type: "gitflow-cheatsheet",
    title: "Gitflow Guide",
    component: GitflowCheatsheetBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
  });

  // Toolbar action
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

  // Command palette entry
  api.registerCommand({
    id: "open-gitflow-cheatsheet",
    title: "Gitflow Cheatsheet",
    description: "Open the Gitflow workflow guide",
    category: "Navigation",
    icon: GitBranch,
    action: () => {
      openBlade("gitflow-cheatsheet", {} as Record<string, never>);
    },
    enabled: () => !!useRepositoryStore.getState().repoStatus,
    keywords: ["gitflow", "workflow", "guide", "branching", "reference", "cheatsheet"],
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
```

---

## Registration Migration Plan

### 1. Blade: `gitflow-cheatsheet`

**Current:** `src/blades/gitflow-cheatsheet/registration.ts` -- eagerly imported by `_discovery.ts` via `import.meta.glob`

**Migration:**
- Extension's `onActivate()` calls `api.registerBlade()` with `coreOverride: true` (preserves "gitflow-cheatsheet" type name, no "ext:gitflow:" prefix)
- Delete `src/blades/gitflow-cheatsheet/registration.ts`
- Keep `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.tsx` in place (lazy-imported by extension)
- Update `_discovery.ts` EXPECTED_TYPES: remove `"gitflow-cheatsheet"` from the list

**Confidence:** HIGH -- exact same pattern as Phase 39 (conventional-commit blade).

### 2. Sidebar: Hardcoded GitflowPanel

**Current:** `src/components/RepositoryView.tsx` lines 181-188 -- hardcoded `<details>` block

**Migration:**
- Extension's `onActivate()` calls `api.contributeSidebarPanel()` with `GitflowPanel` component
- Remove the `<details>` block from RepositoryView.tsx (lines 181-188)
- Remove `import { GitflowPanel } from "./gitflow"` from RepositoryView.tsx
- Remove `GitMerge` from lucide imports if no longer needed by RepositoryView.tsx

**Confidence:** HIGH -- `DynamicSidebarPanels` already renders extension panels with the same visual pattern.

### 3. Toolbar: `tb:gitflow-guide`

**Current:** `src/commands/toolbar-actions.ts` lines 255-266 -- registered in coreActions array

**Migration:**
- Extension's `onActivate()` calls `api.contributeToolbar()` with equivalent config
- Remove the `tb:gitflow-guide` entry from `coreActions` array in toolbar-actions.ts

**Confidence:** HIGH -- toolbar contribution via ExtensionAPI is proven (GitHub, CC extensions).

### 4. Command: `open-gitflow-cheatsheet`

**Current:** `src/commands/navigation.ts` lines 19-30 -- registered via `registerCommand()`

**Migration:**
- Extension's `onActivate()` calls `api.registerCommand()` with equivalent config
- Remove the `open-gitflow-cheatsheet` registration from navigation.ts
- Note: The command ID will become `ext:gitflow:open-gitflow-cheatsheet` (namespaced). Update any direct references if they exist. Current codebase does NOT reference the command by ID programmatically, only through the command palette.

**Confidence:** HIGH -- command registration via ExtensionAPI is proven.

---

## Circular Import Analysis and Prevention

### Current Import Graph

```
src/App.tsx
  -> src/extensions/conventional-commits/index.ts (already proven safe)
  -> src/extensions/content-viewers/index.ts (already proven safe)
  -> src/extensions/github/index.ts (already proven safe)
  -> (NEW) src/extensions/gitflow/index.ts

src/extensions/gitflow/index.ts
  -> src/extensions/ExtensionAPI.ts (safe -- API facade)
  -> src/lib/bladeOpener.ts (safe -- utility)
  -> src/stores/repository.ts (safe -- read-only .getState() usage)
  -> src/components/gitflow/GitflowPanel.tsx (lazy import -- safe)
  -> src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.tsx (lazy import -- safe)

src/components/gitflow/GitflowPanel.tsx
  -> src/stores/gitflow.ts (safe -- re-export shim)
  -> src/stores/branches.ts (safe)
  -> src/hooks/useBladeNavigation.ts (safe)

src/stores/gitflow.ts
  -> src/stores/domain/git-ops/index.ts (safe -- one-hop re-export)
```

### Risk Assessment

**No circular import risk identified.** The extension entry point uses:
- Lazy dynamic imports for components (not in the static import graph)
- `useRepositoryStore` for `when()` conditions (same pattern as all other extensions)
- `openBlade()` utility for actions (same pattern as CC extension)

The extension does NOT import `useGitOpsStore` directly. It does not import `gitflow.slice.ts`. Components that need gitflow state continue to import from `src/stores/gitflow.ts` (the shim), which is a simple re-export of `useGitOpsStore`.

**Prevention measures:**
1. Extension entry point should NOT import from `src/stores/domain/git-ops/` directly
2. Use `src/stores/gitflow.ts` shim for any gitflow state access (existing pattern)
3. Run `npx madge --circular src/extensions/gitflow/` after implementation to verify

**Confidence:** HIGH -- import graph traced manually through codebase.

---

## Cross-Extension Dependency Analysis

### Gitflow Extension Dependencies on Other Extensions

| Extension | Dependency | Type |
|-----------|-----------|------|
| Conventional Commits | None | No interaction. CC's `onWillCommit` hook is independent. |
| Content Viewers | None | No interaction. Viewers are file-type based. |
| GitHub | None | PR creation from feature branches is GitHub's concern, not Gitflow's. |

### Other Extensions' Dependencies on Gitflow

| Consumer | Dependency | Impact of Disabling Gitflow |
|----------|-----------|---------------------------|
| BranchList.tsx (core) | `useGitflowStore((s) => s.gitflowStatus)` for protected branches | Returns `null` when gitflow slice has no status. `getProtectedBranches(null)` already handles this -- falls back to protecting main/master/develop only. **No impact.** |
| branchClassifier.ts (core) | None | Stays in core. Branch classification works regardless of extension state. |

**Key insight:** The Gitflow extension has NO dependencies on other extensions and NO other extensions depend on Gitflow. The only cross-cutting concern is `BranchList.tsx` reading `gitflowStatus` for protected branch computation, which is handled by the GitOpsStore slice (staying in core per ADR-1).

**Confidence:** HIGH -- exhaustive grep of all gitflow-related imports.

---

## Core Consumer Impact: BranchList.tsx

`BranchList.tsx` (lines 49-53) reads `gitflowStatus` from `useGitflowStore` to compute protected branches. Since we keep the slice in GitOpsStore (ADR-1), this continues to work with zero changes. The `getProtectedBranches()` function in `bulkBranchOps.ts` already handles `null` status gracefully.

If the slice were extracted (Option B), `BranchList.tsx` would need to check if the Gitflow extension is active and fall back to default protection. This is an additional reason to prefer Option A.

---

## File Inventory

### Files to CREATE

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `src/extensions/gitflow/index.ts` | ~60 | Extension entry point with onActivate/onDeactivate |

### Files to MODIFY

| File | Change | Impact |
|------|--------|--------|
| `src/App.tsx` | Add `registerBuiltIn` call for "gitflow" extension (import onActivate/onDeactivate, add config block) | ~10 lines added |
| `src/components/RepositoryView.tsx` | Remove hardcoded Gitflow `<details>` block (lines 181-188), remove GitflowPanel import, remove GitMerge icon import | ~10 lines removed |
| `src/commands/toolbar-actions.ts` | Remove `tb:gitflow-guide` entry from coreActions array (lines 255-266) | ~12 lines removed |
| `src/commands/navigation.ts` | Remove `open-gitflow-cheatsheet` registration (lines 19-30) | ~12 lines removed |
| `src/blades/_discovery.ts` | Remove `"gitflow-cheatsheet"` from EXPECTED_TYPES array | 1 line changed |

### Files to DELETE

| File | Reason |
|------|--------|
| `src/blades/gitflow-cheatsheet/registration.ts` | Blade registration moves to extension onActivate |

### Files that STAY UNCHANGED

| File | Why |
|------|-----|
| `src/stores/domain/git-ops/gitflow.slice.ts` | Slice stays in GitOpsStore (ADR-1) |
| `src/stores/domain/git-ops/index.ts` | GitflowSlice remains composed |
| `src/stores/gitflow.ts` | Re-export shim continues to work (mark as doubly-deprecated with "use GitOpsStore directly") |
| `src/components/gitflow/GitflowPanel.tsx` | Component stays in place (ADR-3) |
| `src/components/gitflow/InitGitflowDialog.tsx` | Component stays in place |
| `src/components/gitflow/StartFlowDialog.tsx` | Component stays in place |
| `src/components/gitflow/FinishFlowDialog.tsx` | Component stays in place |
| `src/components/gitflow/GitflowDiagram.tsx` | Component stays in place |
| `src/components/gitflow/GitflowActionCards.tsx` | Component stays in place |
| `src/components/gitflow/GitflowBranchReference.tsx` | Component stays in place |
| `src/components/gitflow/ReviewChecklist.tsx` | Component stays in place |
| `src/components/gitflow/index.ts` | Barrel export stays |
| `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.tsx` | Blade component stays in place |
| `src/lib/branchClassifier.ts` | Core utility stays in core (ADR-2) |
| `src/lib/bulkBranchOps.ts` | Core utility, handles null gitflowStatus |

---

## Standard Stack

### Core (No New Dependencies)

| Library | Version | Purpose | Already In Use |
|---------|---------|---------|----------------|
| Zustand | existing | State management (GitOpsStore, ExtensionHost) | Yes |
| React (lazy) | existing | Code-split component loading for extension | Yes |
| lucide-react | existing | Icons for sidebar panel, toolbar, command | Yes |

### Supporting

| Module | Location | Purpose |
|--------|----------|---------|
| `ExtensionAPI` | `src/extensions/ExtensionAPI.ts` | Registration facade for sidebar, blade, toolbar, command |
| `ExtensionHost` | `src/extensions/ExtensionHost.ts` | `registerBuiltIn()` lifecycle management |
| `SidebarPanelRegistry` | `src/lib/sidebarPanelRegistry.ts` | Dynamic sidebar panel contribution |
| `gitHookBus` | `src/lib/gitHookBus.ts` | Event bus for post-git-operation hooks (available but NOT needed for this extraction) |

---

## Architecture Patterns

### Recommended Project Structure

```
src/extensions/gitflow/
  index.ts                    -- onActivate/onDeactivate (~60 lines)

src/components/gitflow/       -- STAYS IN PLACE (7 components)
  GitflowPanel.tsx
  InitGitflowDialog.tsx
  StartFlowDialog.tsx
  FinishFlowDialog.tsx
  GitflowDiagram.tsx
  GitflowActionCards.tsx
  GitflowBranchReference.tsx
  ReviewChecklist.tsx
  index.ts

src/blades/gitflow-cheatsheet/ -- STAYS IN PLACE (minus registration.ts)
  GitflowCheatsheetBlade.tsx
  GitflowCheatsheetBlade.test.tsx

src/stores/domain/git-ops/    -- UNCHANGED
  gitflow.slice.ts            -- Slice stays in GitOpsStore

src/lib/
  branchClassifier.ts         -- STAYS IN CORE (ADR-2)
```

### Pattern: Built-In Extension with Core Store Access

**What:** Extension contributes UI surfaces (sidebar, blade, toolbar, command) while the business logic (store, slice) stays in core.

**When to use:** When the feature's state is tightly integrated with other core slices (cross-slice calls) and the feature's classification/utility code is used broadly by non-extension core components.

**Example:** This phase. The gitflow.slice.ts stays in GitOpsStore because it calls `get().loadBranches()` and `get().refreshRepoStatus()` after operations. The extension only controls *where and whether* the UI appears.

**Precedent:** Phase 39 -- conventional-utils.ts stayed in core; extension contributed blade and command registrations.

### Anti-Patterns to Avoid

- **Moving the store into the extension when cross-slice calls exist:** Creates split-brain risk and requires bus-based coordination that adds complexity with no user benefit.
- **Creating adapter/bridge files to decouple imports:** Built-in extensions can and should import core modules directly. The GitHub extension imports from `../../stores/repository`, `../../lib/bladeOpener`, etc. This is the established pattern.
- **Conditional rendering instead of registry-based rendering:** Do NOT add `{gitflowEnabled && <GitflowPanel />}` in RepositoryView.tsx. Use the SidebarPanelRegistry contribution pattern instead. This scales to third-party extensions.
- **Moving branchClassifier.ts to the extension:** 10+ core files import from it. It is a classification utility, not a workflow tool.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar panel visibility | Manual conditional rendering | `api.contributeSidebarPanel()` with `when()` | Registry handles show/hide, cleanup on deactivation |
| Blade lifecycle | Direct `registerBlade()` calls | `api.registerBlade()` with `coreOverride: true` | Auto-namespaced, auto-cleanup on deactivation |
| Command cleanup | Manual `unregisterCommand()` | `api.registerCommand()` | ExtensionAPI tracks and cleans up all registrations |
| Toolbar cleanup | Manual toolbar state management | `api.contributeToolbar()` | Same as above |

---

## Common Pitfalls

### Pitfall 1: Sidebar Panel Renders Without Suspense Boundary

**What goes wrong:** The extension lazy-imports `GitflowPanel` via `React.lazy()`. When `DynamicSidebarPanels` renders it, React throws because there is no `<Suspense>` boundary wrapping the lazy component.

**Why it happens:** `DynamicSidebarPanels` in RepositoryView.tsx wraps panels in `ExtensionPanelErrorBoundary` (error boundary) but NOT in `<Suspense>`. Lazy components require Suspense.

**How to avoid:** Either (a) add `<Suspense fallback={...}>` inside `ExtensionPanelErrorBoundary`, or (b) do NOT use `React.lazy()` for the sidebar panel component -- use a regular import since GitflowPanel is small and always visible. The GitHub extension uses `await import()` with module-level caching (not React.lazy) for this reason.

**Recommendation:** Use `await import()` in `ensureComponents()` pattern (like GitHub extension), not `React.lazy()`, for the sidebar panel component. Use `React.lazy()` only for the blade component (which is rendered inside BladeContainer which already has Suspense).

### Pitfall 2: Command ID Namespace Mismatch

**What goes wrong:** The current `open-gitflow-cheatsheet` command is registered as a bare ID. After migration to `api.registerCommand()`, it becomes `ext:gitflow:open-gitflow-cheatsheet`. If any code references the old ID directly, it breaks.

**How to avoid:** Check for programmatic command references. Current codebase: `grep -r "open-gitflow-cheatsheet" src/` shows only `navigation.ts` (the registration, being removed) and the GitflowPanel button which uses `openBlade("gitflow-cheatsheet", ...)` (blade opening, not command invocation). No direct command ID references exist. The blade type uses `coreOverride: true` so it stays as `"gitflow-cheatsheet"`.

**Warning signs:** Any `executeCommand("open-gitflow-cheatsheet")` calls in the codebase.

### Pitfall 3: _discovery.ts EXPECTED_TYPES Not Updated

**What goes wrong:** After removing `registration.ts` for gitflow-cheatsheet, the dev-mode exhaustiveness check in `_discovery.ts` warns about the missing type on every page load.

**How to avoid:** Remove `"gitflow-cheatsheet"` from the `EXPECTED_TYPES` array. This is a 1-line change.

### Pitfall 4: RepositoryView.tsx Still Imports GitflowPanel

**What goes wrong:** After removing the `<GitflowPanel />` JSX, the developer forgets to remove the import statement. Tree shaking may or may not eliminate it -- but the import creates an unnecessary dependency from core on gitflow components.

**How to avoid:** Remove the `import { GitflowPanel } from "./gitflow"` line AND the `GitMerge` import from lucide-react (verify it's not used elsewhere in the file first -- it is NOT used elsewhere; Branches uses `GitBranch`, not `GitMerge`).

---

## Code Examples

### App.tsx Extension Registration (Verified Pattern from Existing Code)

```typescript
// In App.tsx, add alongside existing registerBuiltIn calls:
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

Source: Existing pattern in `src/App.tsx` lines 61-83.

### Sidebar Panel Contribution (Verified API from ExtensionAPI.ts)

```typescript
api.contributeSidebarPanel({
  id: "gitflow",
  title: "Gitflow",
  icon: GitMerge,
  component: GitflowPanel,
  priority: 60,
  when: () => !!useRepositoryStore.getState().repoStatus,
});
```

Source: `ExtensionAPI.ts` lines 206-216, `sidebarPanelRegistry.ts` interface.

---

## Graceful Degradation Verification

When the Gitflow extension is disabled:

| UI Surface | Expected Behavior | Mechanism |
|-----------|-------------------|-----------|
| Sidebar panel | Gitflow section disappears | `sidebarPanelRegistry.unregisterBySource()` in `ExtensionAPI.cleanup()` |
| Toolbar button | "Gitflow Guide" button disappears | `toolbarRegistry.unregisterBySource()` in `ExtensionAPI.cleanup()` |
| Command palette | "Gitflow Cheatsheet" command disappears | `unregisterCommand()` in `ExtensionAPI.cleanup()` |
| Gitflow cheatsheet blade | Cannot be opened (blade type unregistered) | `unregisterBlade()` in `ExtensionAPI.cleanup()` |
| Branch coloring | Still works (blue for main, green for develop, etc.) | `branchClassifier.ts` stays in core |
| Protected branches | Still works (main/master/develop always protected) | `getProtectedBranches(null)` handles null status |
| Branch list | Fully functional without gitflow status display | `useGitflowStore` returns null for gitflowStatus |
| Commit, push, pull | Fully functional | No gitflow dependency |

---

## Open Questions

### 1. Should `stores/gitflow.ts` Shim Be Updated?

**What we know:** The shim is already marked `@deprecated`. After extraction, the extension components still import from it.
**What's unclear:** Should the deprecation note be updated to reflect the new architecture?
**Recommendation:** Update the `@deprecated` comment to say "Import from stores/domain/git-ops directly for store access. Gitflow UI is contributed by the gitflow extension." But do NOT remove the shim -- components still use it.

### 2. Extension Manager Count

**What we know:** Success criteria says "Extension Manager shows 4 independently toggleable extensions". Currently there are 3 built-in extensions (content-viewers, conventional-commits, github). Adding gitflow makes 4.
**What's unclear:** Is this the exact expected count? Are there other extensions being added in parallel phases?
**Recommendation:** Verify Extension Manager UI shows all 4 with enable/disable toggles after implementation.

### 3. Sidebar Panel `defaultOpen` State

**What we know:** The current hardcoded Gitflow `<details>` block does NOT have the `open` attribute, meaning it renders collapsed by default.
**What's unclear:** Should the extension-contributed panel match this behavior?
**Recommendation:** Set `defaultOpen: false` in the sidebar panel contribution to match current behavior.

---

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/extensions/ExtensionAPI.ts` (341 lines) -- all contribution methods verified
- Codebase analysis: `src/extensions/ExtensionHost.ts` (403 lines) -- registerBuiltIn lifecycle verified
- Codebase analysis: `src/extensions/conventional-commits/index.ts` (79 lines) -- Phase 39 reference pattern
- Codebase analysis: `src/extensions/content-viewers/index.ts` (55 lines) -- Phase 38 reference pattern
- Codebase analysis: `src/extensions/github/index.ts` (323 lines) -- largest extension reference pattern
- Codebase analysis: `src/stores/domain/git-ops/gitflow.slice.ts` (155 lines) -- cross-slice calls identified
- Codebase analysis: `src/components/RepositoryView.tsx` (244 lines) -- hardcoded sidebar structure
- Codebase analysis: `src/lib/sidebarPanelRegistry.ts` (93 lines) -- contribution API verified
- Codebase analysis: `src/lib/gitHookBus.ts` (162 lines) -- event bus capabilities verified
- Codebase analysis: `src/blades/_discovery.ts` (39 lines) -- EXPECTED_TYPES list identified

### Secondary (MEDIUM confidence)
- `.planning/research/v1.6.0-ARCHITECTURE.md` -- Gitflow extraction strategy (written pre-Phase 37, some details outdated but overall direction confirmed)
- `.planning/research/v1.6.0-PITFALLS.md` -- 16 pitfalls catalogued, several directly applicable
- `.planning/research/v1.6.0-FEATURES.md` -- Feature landscape and dependency chain

---

## Metadata

**Confidence breakdown:**
- Store architecture (ADR-1): HIGH -- based on direct code analysis of cross-slice calls and Phase 39 precedent
- branchClassifier boundary (ADR-2): HIGH -- 10 core consumers identified via exhaustive grep
- Component placement (ADR-3): HIGH -- follows Phase 38-39 established pattern
- Sidebar contribution (ADR-4): HIGH -- infrastructure already built and tested in Phase 37
- Registration migration: HIGH -- each registration has a proven ExtensionAPI equivalent
- Circular import analysis: HIGH -- full import graph traced manually
- Pitfalls: HIGH -- informed by v1.6.0-PITFALLS.md and Phase 38-39 experience

**Research date:** 2026-02-10
**Valid until:** 2026-03-12 (30 days -- stable patterns, no external dependency changes expected)
