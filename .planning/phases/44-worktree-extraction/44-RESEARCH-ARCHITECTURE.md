# Phase 44: Worktree Extraction - Architecture Research

**Researched:** 2026-02-11
**Domain:** Extension extraction, sidebar panel contribution, dialog management, store slice boundaries, extensibility enforcement
**Confidence:** HIGH

## Summary

Phase 44 extracts the Worktree management feature from a hardcoded core sidebar section in `RepositoryView.tsx` into a toggleable built-in extension. The Worktree surface area is narrower than previous extractions (Phases 38-40): it has no blades, no toolbar actions, and no command palette entries to migrate. It consists solely of (1) a hardcoded sidebar `<details>` block in RepositoryView.tsx, (2) an inline `WorktreePanel` component, (3) two dialog components (`CreateWorktreeDialog`, `DeleteWorktreeDialog`), and (4) the `worktrees.slice.ts` data slice in GitOpsStore. There are no core commands registered under the "Worktrees" category.

The extraction follows the proven pattern from Phases 38-40: create `src/extensions/worktree/index.ts` with `onActivate`/`onDeactivate`, register via `registerBuiltIn()` in App.tsx, contribute the sidebar panel via `api.contributeSidebarPanel()`, and register commands via `api.registerCommand()`. The unique challenge for this phase is the **dialog management pattern** -- the Create and Delete dialogs are currently managed by `useState` hooks in `RepositoryView.tsx` and triggered by UI interactions within the sidebar panel. The extension must self-contain this dialog state.

**Primary recommendation:** Keep the `worktrees.slice.ts` inside GitOpsStore (same decision as Phase 40 for gitflow). The extension contributes UI surfaces only -- a sidebar panel (with embedded dialog management) and command palette entries. The data slice stays because (1) `switchToWorktree` calls `get().openRepository(path)` which is a cross-slice call to RepositorySlice, and (2) the slice is pure Rust-command delegation with no frontend caching.

---

## 1. Current Extension Architecture

### How Extensions Work Today

The FlowForge extension system (Phase 37) is built on three pillars:

**ExtensionHost** (`src/extensions/ExtensionHost.ts`) -- A Zustand store managing extension lifecycle:
- `registerBuiltIn(config)` -- Registers a bundled extension, creates a synthetic manifest, activates immediately
- `activateExtension(id)` -- Creates an `ExtensionAPI` instance, calls the extension's `activate(api)` function
- `deactivateExtension(id)` -- Calls `onDeactivate()`, then `api.cleanup()` to remove all registrations
- Persists disabled extension IDs to `tauri-plugin-store` for cross-session persistence

**ExtensionAPI** (`src/extensions/ExtensionAPI.ts`) -- Per-extension facade providing:
- `registerBlade(config)` -- Register blade types (auto-namespaced as `ext:{id}:{type}`)
- `registerCommand(config)` -- Register command palette entries (auto-namespaced)
- `contributeToolbar(config)` -- Register toolbar actions (auto-namespaced)
- `contributeContextMenu(config)` -- Register context menu items (auto-namespaced)
- `contributeSidebarPanel(config)` -- Register sidebar panels (auto-namespaced, priority clamped to 1-69)
- `contributeStatusBar(config)` -- Register status bar items (auto-namespaced)
- `onDidGit(operation, handler)` / `onWillGit(operation, handler)` -- Git hook subscriptions
- `onDidNavigate(handler)` -- Blade navigation event subscription
- `onDispose(disposable)` -- Custom cleanup callbacks (LIFO execution)
- `cleanup()` -- Atomic removal of ALL registrations across all registries

**Registry System** -- Zustand stores powering dynamic UI:
- `useSidebarPanelRegistry` (`src/lib/sidebarPanelRegistry.ts`) -- Panels sorted by priority (descending), filtered by `when()` predicate, rendered via `DynamicSidebarPanels` in RepositoryView
- `useCommandRegistry` (`src/lib/commandRegistry.ts`) -- Commands with source tracking and `unregisterBySource()`
- `useToolbarRegistry`, `useContextMenuRegistry`, `useStatusBarRegistry` -- Same pattern

### Registration Flow

```
App.tsx useEffect
  -> registerBuiltIn({ id, name, version, activate, deactivate })
  -> ExtensionHost creates ExtensionAPI(id)
  -> Calls activate(api)
  -> Extension calls api.contributeSidebarPanel(), api.registerCommand(), etc.
  -> Registries receive entries, Zustand triggers re-renders
  -> UI components read from registries and render dynamically
```

### Deactivation Flow

```
ExtensionHost.deactivateExtension(id)
  -> Calls module.onDeactivate() (custom cleanup)
  -> Calls api.cleanup() which:
     1. Unregisters all blades (by type name)
     2. Unregisters all commands (by ID)
     3. Unregisters toolbar by source
     4. Unregisters context menus by source
     5. Unregisters sidebar panels by source
     6. Unregisters status bar items by source
     7. Removes extension event bus subscriptions
     8. Removes navigation subscriptions
     9. Removes git hook subscriptions
    10. Runs disposables in reverse order (LIFO)
    11. Resets all tracking arrays
```

### Current Built-In Extensions

| Extension | ID | Phase | UI Contributions |
|-----------|-----|-------|------------------|
| Content Viewers | `content-viewers` | 38 | 3 blade types (viewer-markdown, viewer-code, viewer-3d) |
| Conventional Commits | `conventional-commits` | 39 | 2 blades, 1 toolbar, 2 commands, 1 dispose |
| Gitflow | `gitflow` | 40 | 1 sidebar panel, 1 blade, 1 toolbar, 1 command |
| GitHub | `github` | 37 | 7 blades, 5 commands, 4 toolbar, store subscriptions |

---

## 2. Previous Extraction Patterns

### Phase 38: Content Viewers

**Scope:** 3 blade types (markdown, code, 3D)
**Pattern:** Extension registers blade types with `coreOverride: true` using lazy imports. Core `_discovery.ts` EXPECTED_TYPES updated. File dispatch overlay introduced.
**Key learning:** Components stayed in `src/blades/viewer-{type}/` -- only the `registration.ts` files were deleted. Extension lazy-imports existing component files.

### Phase 39: Conventional Commits

**Scope:** 2 blades, 1 toolbar, 2 commands, commit form contribution
**Pattern:** Extension registers blades, commands, toolbar. `onDispose()` used to reset CC store on disable. Store (`conventional.ts`) stays in core; extension contributes UI.
**Key learning:** Core utility modules (`conventional-utils.ts`, `commit-type-theme.ts`) stayed in core because topology graph and other core features depend on them.

### Phase 40: Gitflow (Most Relevant to Phase 44)

**Scope:** 1 sidebar panel, 1 blade, 1 toolbar, 1 command
**Pattern:** Extension uses `api.contributeSidebarPanel()` to replace hardcoded `<details>` block in RepositoryView.tsx. Blade registered with `coreOverride: true`. Store slice (`gitflow.slice.ts`) stayed in GitOpsStore due to cross-slice calls.
**Key learning:**
1. `contributeSidebarPanel()` is the proven pattern for replacing hardcoded sidebar sections
2. `DynamicSidebarPanels` renders extension panels with `<details>`, icon, title, badge, and renderAction -- same visual pattern as hardcoded sections
3. Store slices with cross-slice dependencies stay in GitOpsStore
4. Components stay in their current locations; extension lazy-imports them
5. Dialog state management is self-contained within the panel component (GitflowPanel manages its own dialogs via `useState`)

### Common Pattern Across All Extractions

```typescript
// src/extensions/{name}/index.ts
export async function onActivate(api: ExtensionAPI): Promise<void> {
  // 1. Lazy imports for components
  // 2. api.registerBlade() for blade types
  // 3. api.contributeSidebarPanel() for sidebar panels
  // 4. api.contributeToolbar() for toolbar actions
  // 5. api.registerCommand() for command palette entries
  // 6. api.onDispose() for custom cleanup
}

export function onDeactivate(): void {
  // Custom cleanup (optional) -- api.cleanup() handles registrations
}
```

---

## 3. Sidebar Panel Contribution

### Existing API

`api.contributeSidebarPanel()` already exists and is proven (used by Gitflow in Phase 40):

```typescript
interface ExtensionSidebarPanelConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  component: ComponentType<any>;
  priority?: number;        // clamped to 1-69 (70-100 reserved for core)
  when?: () => boolean;     // visibility predicate
  defaultOpen?: boolean;    // <details open> state
  renderAction?: () => ReactNode;  // e.g., "+" button in summary
}
```

The `DynamicSidebarPanels` component in RepositoryView.tsx renders registered panels:

```tsx
{visiblePanels.map((panel) => (
  <details key={panel.id} open={panel.defaultOpen} className="...">
    <summary className="...">
      <panel.icon className="w-4 h-4" />
      <span className="font-semibold text-sm flex-1">{panel.title}</span>
      {panel.badge && ...}
      {panel.renderAction?.()}
    </summary>
    <ExtensionPanelErrorBoundary>
      <panel.component />
    </ExtensionPanelErrorBoundary>
  </details>
))}
```

### What Needs to Happen for Worktree

The Worktree sidebar section is currently hardcoded at lines 188-210 of RepositoryView.tsx:

```tsx
{/* Worktrees section */}
<details className="border-b border-ctp-surface0">
  <summary className="...">
    <FolderGit2 className="w-4 h-4" />
    <span className="font-semibold text-sm flex-1">Worktrees</span>
    <button type="button" onClick={() => setShowWorktreeDialog(true)} ...>
      <Plus className="w-3.5 h-3.5" />
    </button>
  </summary>
  <WorktreePanel onOpenDeleteDialog={(name) => setWorktreeToDelete(name)} />
</details>
```

**Challenge:** The "+" button and the delete dialog state (`worktreeToDelete`) are managed by RepositoryView's `useState` hooks. These must move INTO the worktree panel component when extracted to an extension.

**Solution:** The `renderAction` prop on `SidebarPanelConfig` supports the "+" button. But the real challenge is that `CreateWorktreeDialog` and `DeleteWorktreeDialog` are rendered at the RepositoryView root level (outside the sidebar details block) as portal-like elements. In the extension model, these dialogs must be rendered by the panel component itself.

The GitflowPanel component already demonstrates this pattern -- it manages `showStartDialog`, `showFinishDialog`, and `showInitDialog` via internal `useState`, and renders `<StartFlowDialog>`, `<FinishFlowDialog>`, `<InitGitflowDialog>` directly inside itself.

**Recommended approach:**
1. Create a new `WorktreeSidebarPanel` wrapper component that:
   - Renders `WorktreePanel` for the list content
   - Manages `showCreateDialog` and `worktreeToDelete` state internally
   - Renders `CreateWorktreeDialog` and `DeleteWorktreeDialog` internally
2. Register this wrapper via `api.contributeSidebarPanel()` with `renderAction` providing the "+" button
3. The `renderAction` callback triggers the create dialog via a shared ref or state mechanism within the wrapper

**Important:** The `renderAction` runs inside the `<summary>` (outside the component). To communicate between the `renderAction` callback and the component, options include:
- **Option A: DOM event** -- `renderAction` dispatches a custom DOM event, component listens for it
- **Option B: Shared external state** -- A module-level signal (e.g., a Zustand atom or simple ref) that both `renderAction` and the component read/write
- **Option C: Integrated wrapper** -- Make the `renderAction` unnecessary by placing the "+" button inside the component's content area instead

**Recommendation: Option A (DOM event).** This is the simplest, follows existing patterns (RepositoryView uses `document.dispatchEvent(new CustomEvent("create-branch-dialog"))` for the branch create dialog), and requires no new infrastructure.

```typescript
api.contributeSidebarPanel({
  id: "worktree-panel",
  title: "Worktrees",
  icon: FolderGit2,
  component: WorktreeSidebarPanel,
  priority: 55,
  defaultOpen: false,
  renderAction: () =>
    createElement("button", {
      type: "button",
      className: "p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text",
      title: "Create new worktree",
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("create-worktree-dialog"));
      },
    }, createElement(Plus, { className: "w-3.5 h-3.5" })),
  badge: () => {
    const count = useGitOpsStore.getState().worktreeList.length;
    return count > 1 ? count : null;  // Only show badge when there are additional worktrees
  },
});
```

---

## 4. Data Layer Boundaries

### WorktreeSlice Design

`worktrees.slice.ts` (83 lines) is a Zustand slice inside GitOpsStore:

**State:**
- `worktreeList: WorktreeInfo[]` -- List of all worktrees
- `worktreeIsLoading: boolean` -- Loading indicator
- `worktreeError: string | null` -- Error message
- `worktreeSelected: string | null` -- Currently selected worktree name

**Actions:**
- `loadWorktrees()` -- Calls `commands.listWorktrees()` (Rust backend)
- `createWorktree(options)` -- Calls `commands.createWorktree(options)`, then `get().loadWorktrees()`
- `deleteWorktree(name, force, deleteBranch)` -- Calls `commands.deleteWorktree(...)`, then `get().loadWorktrees()`
- `selectWorktree(name)` -- Sets selected worktree
- `openInExplorer(path)` -- Calls `revealItemInDir` from Tauri plugin
- `switchToWorktree(path)` -- Calls `get().openRepository(path)` **[CROSS-SLICE CALL]**
- `clearWorktreeError()` -- Clears error

### Cross-Slice Dependencies

| Method | Cross-Slice Call | Target Slice |
|--------|-----------------|--------------|
| `switchToWorktree` | `get().openRepository(path)` | RepositorySlice |
| `createWorktree` | `get().loadWorktrees()` | Same slice (self-call) |
| `deleteWorktree` | `get().loadWorktrees()` | Same slice (self-call) |

The `switchToWorktree` method calls `get().openRepository(path)` from RepositorySlice. This is a direct cross-slice call that works because both slices are composed in the same GitOpsStore. Extracting the slice to a standalone store would require an event bus or direct import of the repository store -- unnecessary complexity.

### ADR: Keep WorktreeSlice in GitOpsStore

**Decision:** Keep `worktrees.slice.ts` inside GitOpsStore.

**Rationale:**
1. **Cross-slice dependency:** `switchToWorktree` calls `get().openRepository(path)` from RepositorySlice. Extracting would require a bus/bridge pattern.
2. **Backend delegation:** All slice actions are pure Rust command calls (`commands.listWorktrees()`, `commands.createWorktree()`, `commands.deleteWorktree()`). No frontend caching or computation.
3. **Precedent:** Phase 40 kept `gitflow.slice.ts` in GitOpsStore for identical reasons (cross-slice calls to `loadBranches()` and `refreshRepoStatus()`). Phase 39 kept `conventional.ts` store in core.
4. **Consumer isolation:** Only 3 component files consume the worktree slice (`WorktreePanel.tsx`, `CreateWorktreeDialog.tsx`, `DeleteWorktreeDialog.tsx`). These all become extension-owned components. No core file outside `worktrees.slice.ts` itself reads worktree state.
5. **Simplicity:** The slice is 83 lines. Extracting it adds complexity with zero user benefit.

### Consumer Analysis

Files that import worktree-related state from GitOpsStore:

| File | Import | Usage |
|------|--------|-------|
| `WorktreePanel.tsx` | `useGitOpsStore` | Reads all worktree state + actions |
| `CreateWorktreeDialog.tsx` | `useGitOpsStore` | `createWorktree`, `worktreeIsLoading`, `worktreeError`, `clearWorktreeError` |
| `CreateWorktreeDialog.tsx` | `useGitOpsStore` | `branchList`, `loadBranches` (cross-concern: branch data for branch picker) |
| `DeleteWorktreeDialog.tsx` | `useGitOpsStore` | `worktreeList`, `deleteWorktree`, `worktreeIsLoading`, `worktreeError`, `clearWorktreeError` |
| `DeleteWorktreeDialog.tsx` | `useGitOpsStore` | `branchList` (cross-concern: branch merge status check) |
| `RepositoryView.tsx` | None | Does NOT read worktree state; only renders WorktreePanel and dialogs |

**Key insight:** All worktree state consumers are worktree components. No core component reads from the worktree slice. This means disabling the extension has zero impact on core functionality.

---

## 5. Lifecycle Management

### Enable Flow

```
App.tsx useEffect -> registerBuiltIn({ id: "worktree", ... })
  -> ExtensionHost creates ExtensionAPI("worktree")
  -> onActivate(api):
       api.contributeSidebarPanel({ ... WorktreeSidebarPanel ... })
       api.registerCommand({ id: "create-worktree", ... })
       api.registerCommand({ id: "list-worktrees", ... })
  -> SidebarPanelRegistry receives entry
  -> DynamicSidebarPanels re-renders with Worktree panel visible
  -> CommandPalette shows worktree commands
```

### Disable Flow

```
ExtensionHost.deactivateExtension("worktree")
  -> onDeactivate() called (no custom cleanup needed)
  -> api.cleanup():
       sidebarPanelRegistry.unregisterBySource("ext:worktree")
       commandRegistry.unregisterBySource("ext:worktree")
  -> SidebarPanelRegistry triggers re-render
  -> DynamicSidebarPanels re-renders WITHOUT Worktree panel
  -> CommandPalette no longer shows worktree commands
  -> WorktreeSlice data remains in GitOpsStore (inert but harmless)
```

### Re-enable Flow

```
ExtensionHost.activateExtension("worktree")
  -> builtInConfigs.get("worktree") returns stored config
  -> New ExtensionAPI("worktree") instance created
  -> config.activate(api) called
  -> All registrations recreated
  -> Panel reappears; data still in GitOpsStore (instant display)
```

### Cleanup Guarantees

The `ExtensionAPI.cleanup()` method handles all deregistration atomically:
1. Sidebar panels removed via `useSidebarPanelRegistry.getState().unregisterBySource("ext:worktree")`
2. Commands removed via `unregisterCommand()` for each tracked command ID
3. All tracking arrays reset to empty

**No custom `onDeactivate()` logic is needed.** Unlike GitHub (which needs polling cancellation) or Conventional Commits (which needs store reset), the Worktree extension has no side effects beyond registrations.

### Worktree Data After Disable

When the extension is disabled, the `worktreeList`, `worktreeIsLoading`, etc. state in GitOpsStore persists but is never displayed because no component renders it. This is harmless -- the data is inert. On re-enable, the panel immediately has data to display without waiting for a fresh `loadWorktrees()` call.

---

## 6. Extensibility Enforcement Recommendations

### Architectural Boundaries

To enforce that worktree UI cannot leak back into core code, the following boundaries must be established:

#### 6.1. No Worktree JSX in RepositoryView.tsx

**Rule:** After extraction, `RepositoryView.tsx` must not contain ANY worktree-related imports or JSX.

**What to remove:**
- Lines 1-7: `FolderGit2` from lucide-react imports (verify not used elsewhere -- it is NOT)
- Line 19-22: `import { CreateWorktreeDialog, DeleteWorktreeDialog, WorktreePanel } from "./worktree"`
- Line 98: `const [showWorktreeDialog, setShowWorktreeDialog] = useState(false)`
- Line 99: `const [worktreeToDelete, setWorktreeToDelete] = useState<string | null>(null)`
- Lines 188-210: The entire Worktrees `<details>` block
- Lines 231-239: `CreateWorktreeDialog` and `DeleteWorktreeDialog` render elements

**Verification:** `grep -r "worktree\|Worktree\|FolderGit2" src/components/RepositoryView.tsx` should return zero matches after extraction.

#### 6.2. Core Command Registry Has No Worktree Commands

Currently there are zero worktree commands in the core command registry (`src/commands/` directory). The "Worktrees" category exists in `commandRegistry.ts`'s `CoreCommandCategory` type, but no commands are registered under it. This is the CORRECT state -- the extension will register commands under the "Worktrees" category.

**Rule:** No worktree commands should ever be added to `src/commands/*.ts` files.

#### 6.3. Core Toolbar Has No Worktree Actions

Currently there are zero worktree toolbar actions in `src/commands/toolbar-actions.ts`. This is correct.

**Rule:** No worktree toolbar actions should ever be added to core toolbar-actions.ts.

#### 6.4. Data Layer Boundary

**Rule:** `worktrees.slice.ts` stays in GitOpsStore as the data provider. The extension contributes UI that READS from this slice. The slice itself is data infrastructure, not UI.

**Rationale:** The data layer (list, create, delete, switch worktrees) is a core git capability. The UI layer (sidebar panel, dialogs, command palette entries) is the extension's contribution. This separation means a future alternative UI (e.g., a worktree blade, a status bar widget, a different sidebar layout) could be built by a different extension using the same data slice.

#### 6.5. Component Location

**Recommendation:** Move worktree components from `src/components/worktree/` to `src/extensions/worktree/components/`.

Unlike Phases 38-40 where components stayed in their original locations (because they were large, complex, or shared), the worktree components are:
- Small (4 files, ~400 lines total)
- Used exclusively by the worktree feature (no cross-component dependencies)
- Not lazy-loaded blade components (they are inline sidebar components)

Moving them establishes a cleaner boundary and follows the GitHub extension pattern (`src/extensions/github/components/` and `src/extensions/github/blades/`).

**Counter-argument:** For consistency with Phases 38-40, components could stay in `src/components/worktree/`. The extension would lazy-import them. Either approach works; moving is preferred for stricter isolation.

**Final recommendation:** Move components to `src/extensions/worktree/components/` for the strongest extensibility boundary.

---

## 7. Extension Entry Point Design

### Proposed Structure

```
src/extensions/worktree/
  index.ts                               -- onActivate/onDeactivate (~80 lines)
  components/
    WorktreeSidebarPanel.tsx             -- Wrapper: panel + dialog state management
    WorktreePanel.tsx                    -- Worktree list (moved from src/components/worktree/)
    WorktreeItem.tsx                     -- Single worktree row (moved)
    CreateWorktreeDialog.tsx             -- Create dialog (moved)
    DeleteWorktreeDialog.tsx             -- Delete dialog (moved)
    index.ts                            -- Barrel export
```

### onActivate Implementation

```typescript
// src/extensions/worktree/index.ts
import { createElement } from "react";
import { FolderGit2, Plus } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { useGitOpsStore } from "../../stores/domain/git-ops";
import { WorktreeSidebarPanel } from "./components";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Contribute sidebar panel
  api.contributeSidebarPanel({
    id: "worktree-panel",
    title: "Worktrees",
    icon: FolderGit2,
    component: WorktreeSidebarPanel,
    priority: 55,
    defaultOpen: false,
    renderAction: () =>
      createElement("button", {
        type: "button",
        className: "p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text",
        title: "Create new worktree",
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent("create-worktree-dialog"));
        },
      }, createElement(Plus, { className: "w-3.5 h-3.5" })),
    badge: () => {
      const count = useGitOpsStore.getState().worktreeList.length;
      return count > 1 ? count : null;
    },
  });

  // Register command palette entries
  api.registerCommand({
    id: "create-worktree",
    title: "Create Worktree",
    description: "Create a new git worktree",
    category: "Worktrees",
    icon: FolderGit2,
    keywords: ["worktree", "new", "add", "create"],
    action: () => {
      document.dispatchEvent(new CustomEvent("create-worktree-dialog"));
    },
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });

  api.registerCommand({
    id: "refresh-worktrees",
    title: "Refresh Worktrees",
    description: "Reload the worktree list",
    category: "Worktrees",
    keywords: ["worktree", "refresh", "reload"],
    action: () => {
      useGitOpsStore.getState().loadWorktrees();
    },
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
```

### WorktreeSidebarPanel Component

```typescript
// src/extensions/worktree/components/WorktreeSidebarPanel.tsx
import { useEffect, useState } from "react";
import { WorktreePanel } from "./WorktreePanel";
import { CreateWorktreeDialog } from "./CreateWorktreeDialog";
import { DeleteWorktreeDialog } from "./DeleteWorktreeDialog";

export function WorktreeSidebarPanel() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [worktreeToDelete, setWorktreeToDelete] = useState<string | null>(null);

  // Listen for create-worktree-dialog event (from renderAction button + command palette)
  useEffect(() => {
    const handler = () => setShowCreateDialog(true);
    document.addEventListener("create-worktree-dialog", handler);
    return () => document.removeEventListener("create-worktree-dialog", handler);
  }, []);

  return (
    <>
      <WorktreePanel
        onOpenDeleteDialog={(name) => setWorktreeToDelete(name)}
      />
      <CreateWorktreeDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
      <DeleteWorktreeDialog
        worktreeName={worktreeToDelete}
        onOpenChange={(open) => !open && setWorktreeToDelete(null)}
      />
    </>
  );
}
```

---

## 8. File Inventory

### Files to CREATE

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `src/extensions/worktree/index.ts` | ~60 | Extension entry point with onActivate/onDeactivate |
| `src/extensions/worktree/components/WorktreeSidebarPanel.tsx` | ~35 | Wrapper: panel + dialog state management |
| `src/extensions/worktree/components/index.ts` | ~5 | Barrel export |

### Files to MOVE

| From | To | Why |
|------|----|-----|
| `src/components/worktree/WorktreePanel.tsx` | `src/extensions/worktree/components/WorktreePanel.tsx` | Extension-owned component |
| `src/components/worktree/WorktreeItem.tsx` | `src/extensions/worktree/components/WorktreeItem.tsx` | Extension-owned component |
| `src/components/worktree/CreateWorktreeDialog.tsx` | `src/extensions/worktree/components/CreateWorktreeDialog.tsx` | Extension-owned component |
| `src/components/worktree/DeleteWorktreeDialog.tsx` | `src/extensions/worktree/components/DeleteWorktreeDialog.tsx` | Extension-owned component |

### Files to MODIFY

| File | Change | Impact |
|------|--------|--------|
| `src/components/RepositoryView.tsx` | Remove all worktree imports, state, JSX, and dialog elements | ~50 lines removed |
| `src/App.tsx` | Add `registerBuiltIn` call for "worktree" extension | ~10 lines added |

### Files to DELETE

| File | Reason |
|------|--------|
| `src/components/worktree/index.ts` | Barrel export for moved components; replaced by extension barrel |

### Files that STAY UNCHANGED

| File | Why |
|------|-----|
| `src/stores/domain/git-ops/worktrees.slice.ts` | Data slice stays in GitOpsStore (ADR above) |
| `src/stores/domain/git-ops/index.ts` | WorktreeSlice remains composed in GitOpsStore |
| `src/lib/commandRegistry.ts` | "Worktrees" category already exists in CoreCommandCategory |
| `src/blades/_discovery.ts` | No worktree blade types to remove |
| `src/commands/*.ts` | No worktree commands exist in core commands |
| `src/commands/toolbar-actions.ts` | No worktree toolbar actions exist |

---

## 9. Risks and Technical Debt Considerations

### Risk 1: Dialog Portal Rendering (MEDIUM)

**What goes wrong:** `CreateWorktreeDialog` and `DeleteWorktreeDialog` use `<Dialog>` from `src/components/ui/dialog.tsx` (likely Radix-based). When rendered inside a `<details>` block that is collapsed, the dialog may not portal correctly to the document root.

**Why it matters:** Currently the dialogs are rendered at the RepositoryView root level (outside the `<details>` block). After extraction, they render inside the panel component (inside `<details>`).

**Mitigation:** Radix Dialog uses `React.createPortal` to render to `document.body` by default. The dialog will portal correctly regardless of where it is declared in the React tree. The GitflowPanel already demonstrates this -- its `InitGitflowDialog`, `StartFlowDialog`, and `FinishFlowDialog` are rendered inside the panel component inside `<details>`, and they work correctly.

**Confidence:** HIGH -- GitflowPanel proves the pattern works.

### Risk 2: DynamicSidebarPanels Missing Suspense (LOW)

**What goes wrong:** If the extension uses `React.lazy()` for the panel component, `DynamicSidebarPanels` lacks a `<Suspense>` boundary and React throws.

**Mitigation:** Do NOT use `React.lazy()` for the sidebar panel component. Import `WorktreeSidebarPanel` directly (not lazily) in the extension entry point. The component is small (~35 lines) and always rendered when the panel is visible. This follows the Gitflow extension pattern exactly (GitflowPanel is imported directly, not via `React.lazy()`).

**Confidence:** HIGH -- direct import avoids the issue entirely.

### Risk 3: Sidebar Panel Ordering (LOW)

**What goes wrong:** The Worktree panel currently appears between Tags and the extension-contributed DynamicSidebarPanels section. After extraction, it will appear within DynamicSidebarPanels, potentially changing its visual position relative to core sections (Branches, Stashes, Tags).

**Why it matters:** Users may notice the worktree panel moved from its current position.

**Mitigation:** Set priority to 55 (below Gitflow's 65 but above other potential extensions). The ordering within DynamicSidebarPanels is: Gitflow (65) > Worktree (55) > other extensions. This keeps Worktree in a natural position. The exact visual position change (from between Tags and Gitflow to the DynamicSidebarPanels section) is acceptable because:
1. The section content is identical
2. The `<details>` styling is identical
3. Extension panels appearing after core panels is the established convention

**Confidence:** HIGH -- visual change is minor and consistent with extension architecture.

### Risk 4: import path updates in moved components (MEDIUM)

**What goes wrong:** When moving `WorktreePanel.tsx`, `CreateWorktreeDialog.tsx`, `DeleteWorktreeDialog.tsx`, and `WorktreeItem.tsx` from `src/components/worktree/` to `src/extensions/worktree/components/`, relative import paths break.

**Current imports in moved files:**
- `../../stores/domain/git-ops` -> becomes `../../../stores/domain/git-ops`
- `../../bindings` -> becomes `../../../bindings`
- `../../lib/utils` -> becomes `../../../lib/utils`
- `../ui/button` -> becomes `../../../components/ui/button`
- `../ui/dialog` -> becomes `../../../components/ui/dialog`
- `../ui/input` -> becomes `../../../components/ui/input` (if exists, or `../../../components/ui/Input`)
- `./WorktreeItem` -> stays `./WorktreeItem` (sibling)

**Mitigation:** Update all relative imports in moved files. This is mechanical and low-risk. TypeScript compiler will catch any missed updates.

**Confidence:** HIGH -- TypeScript enforces correctness.

### Risk 5: Test file references (LOW)

**What goes wrong:** The `git-ops.test.ts` file and `test-utils/mocks/tauri-commands.ts` reference worktree types/commands. These test the data layer (slice), not the UI components, so they are unaffected by the extraction.

**Mitigation:** No action needed. The worktree slice stays in GitOpsStore.

### Technical Debt

1. **Core sidebar sections still hardcoded:** After this extraction, Branches, Stashes, and Tags remain hardcoded in RepositoryView.tsx. A future phase could extract these as well, leaving RepositoryView with only the resizable layout and `DynamicSidebarPanels`. This is out of scope for Phase 44.

2. **DOM events for dialog triggering:** The pattern of using `document.dispatchEvent(new CustomEvent("create-worktree-dialog"))` for cross-boundary communication (renderAction -> component) is pragmatic but not type-safe. A future improvement could introduce a typed event channel or use the extension event bus. This is acceptable technical debt.

3. **"Worktrees" category in CoreCommandCategory:** The `CoreCommandCategory` type in `commandRegistry.ts` includes `"Worktrees"`. After extraction, worktree commands are extension-contributed. The category should arguably be extension-contributed as well (it would appear as an extension category instead of a core one). However, keeping it in `CoreCommandCategory` ensures proper canonical ordering and is harmless. No change needed.

---

## 10. Graceful Degradation

### When Worktree Extension is Disabled

| UI Surface | Expected Behavior | Mechanism |
|-----------|-------------------|-----------|
| Sidebar panel | Worktrees section disappears | `sidebarPanelRegistry.unregisterBySource("ext:worktree")` |
| Command palette | "Create Worktree" and "Refresh Worktrees" commands disappear | `unregisterCommand()` per tracked ID |
| Worktree data | Stays in GitOpsStore but never displayed | No component renders it |
| Branch list | Fully functional (no worktree dependency) | Core feature |
| Commit, push, pull | Fully functional | No worktree dependency |
| Other extensions | Fully functional (no cross-extension dependency) | Independent |

### When Extension is Re-enabled

| Behavior | Detail |
|----------|--------|
| Panel reappears | `contributeSidebarPanel()` re-registers; DynamicSidebarPanels re-renders |
| Data available immediately | `worktreeList` persists in GitOpsStore from previous activation |
| Commands reappear | `registerCommand()` re-registers both commands |
| No page reload needed | All driven by Zustand store subscriptions |

---

## 11. Comparison with Phase 40 (Gitflow) Extraction

The Worktree extraction is structurally identical to Phase 40 (Gitflow) with these differences:

| Aspect | Gitflow (Phase 40) | Worktree (Phase 44) |
|--------|--------------------|--------------------|
| Sidebar panel | Yes (`contributeSidebarPanel`) | Yes (`contributeSidebarPanel`) |
| Blade types | 1 (`gitflow-cheatsheet`) | 0 (no worktree blades) |
| Toolbar actions | 1 (`gitflow-guide`) | 0 (none needed) |
| Command palette | 1 (`open-gitflow-cheatsheet`) | 2 (`create-worktree`, `refresh-worktrees`) |
| Dialog management | Internal to GitflowPanel | Internal to WorktreeSidebarPanel wrapper |
| Store slice | `gitflow.slice.ts` stays in GitOpsStore | `worktrees.slice.ts` stays in GitOpsStore |
| Cross-slice deps | `loadBranches()`, `refreshRepoStatus()` | `openRepository()` |
| Component move | Stayed in `src/components/gitflow/` | Move to `src/extensions/worktree/components/` |
| Core registrations to remove | 1 blade reg, 1 toolbar, 1 command | 0 (none exist in core) |
| `_discovery.ts` update | Remove `gitflow-cheatsheet` | No change needed |

**Key simplification:** Phase 44 has NO core registrations to remove. There are no worktree blades, no worktree toolbar actions, and no worktree commands in the core `src/commands/` directory. The extraction is purely: remove hardcoded JSX from RepositoryView.tsx, create extension entry point, move components.

---

## 12. Implementation Sequence

### Step 1: Create Extension Structure (~30 min)

1. Create `src/extensions/worktree/index.ts` with `onActivate`/`onDeactivate`
2. Create `src/extensions/worktree/components/WorktreeSidebarPanel.tsx`
3. Create `src/extensions/worktree/components/index.ts`

### Step 2: Move Components (~20 min)

1. Move `WorktreePanel.tsx`, `WorktreeItem.tsx`, `CreateWorktreeDialog.tsx`, `DeleteWorktreeDialog.tsx` to `src/extensions/worktree/components/`
2. Update all relative import paths in moved files
3. Delete `src/components/worktree/index.ts` (old barrel)
4. Delete or empty `src/components/worktree/` directory

### Step 3: Clean RepositoryView.tsx (~10 min)

1. Remove `FolderGit2` from lucide-react imports
2. Remove worktree component imports
3. Remove `showWorktreeDialog` and `worktreeToDelete` useState hooks
4. Remove the Worktrees `<details>` block (lines 188-210)
5. Remove `CreateWorktreeDialog` and `DeleteWorktreeDialog` render elements (lines 231-239)

### Step 4: Register in App.tsx (~5 min)

1. Add import: `import { onActivate as worktreeActivate, onDeactivate as worktreeDeactivate } from "./extensions/worktree"`
2. Add `registerBuiltIn` call for "worktree" extension

### Step 5: Verify (~15 min)

1. Extension active: Worktree panel visible in sidebar, create/delete dialogs functional
2. Extension disabled: Worktree panel disappears, no errors in console
3. Extension re-enabled: Panel reappears with data intact
4. TypeScript: `npx tsc --noEmit` passes
5. No worktree JSX in RepositoryView.tsx: `grep -r "worktree\|Worktree" src/components/RepositoryView.tsx` returns empty

---

## Sources

### Primary (HIGH confidence) -- Codebase Analysis

- `src/extensions/ExtensionAPI.ts` (448 lines) -- Full extension API surface including `contributeSidebarPanel()`
- `src/extensions/ExtensionHost.ts` (406 lines) -- Extension lifecycle, `registerBuiltIn()`, activate/deactivate
- `src/extensions/extensionTypes.ts` (32 lines) -- `BuiltInExtensionConfig`, `ExtensionInfo` types
- `src/extensions/gitflow/index.ts` (66 lines) -- Phase 40 reference pattern (sidebar panel contribution)
- `src/extensions/conventional-commits/index.ts` (84 lines) -- Phase 39 reference pattern
- `src/extensions/content-viewers/index.ts` (54 lines) -- Phase 38 reference pattern
- `src/extensions/github/index.ts` (322 lines) -- Largest extension reference (store subscriptions, eager imports)
- `src/lib/sidebarPanelRegistry.ts` (93 lines) -- Registry API: register, unregister, unregisterBySource, getVisiblePanels
- `src/lib/commandRegistry.ts` (178 lines) -- Command registry with "Worktrees" category
- `src/components/RepositoryView.tsx` (242 lines) -- Current hardcoded worktree sidebar section (lines 188-210, 231-239)
- `src/components/worktree/WorktreePanel.tsx` (69 lines) -- Worktree list panel
- `src/components/worktree/WorktreeItem.tsx` (139 lines) -- Single worktree row
- `src/components/worktree/CreateWorktreeDialog.tsx` (193 lines) -- Create worktree dialog
- `src/components/worktree/DeleteWorktreeDialog.tsx` (152 lines) -- Delete worktree dialog
- `src/stores/domain/git-ops/worktrees.slice.ts` (83 lines) -- Worktree data slice with cross-slice `openRepository()` call
- `src/stores/domain/git-ops/index.ts` (51 lines) -- GitOpsStore composition including WorktreeSlice
- `src/App.tsx` (160 lines) -- Extension registration in useEffect
- `src/blades/_discovery.ts` (38 lines) -- EXPECTED_TYPES (no worktree types)
- `src/commands/toolbar-actions.ts` (325 lines) -- Core toolbar actions (no worktree actions)
- `src/commands/repository.ts` (62 lines) -- Core commands (no worktree commands)

### Architecture Research (HIGH confidence)

- `.planning/phases/38-content-viewer-extraction/38-RESEARCH-ARCHITECTURE.md` -- Phase 38 extraction patterns, lazy loading, fallback design
- `.planning/phases/39-conventional-commits-extraction/39-RESEARCH-ARCHITECTURE.md` -- Phase 39 extraction patterns, store boundary decisions
- `.planning/phases/40-gitflow-extraction/40-RESEARCH-ARCHITECTURE.md` -- Phase 40 extraction patterns (most relevant), ADR-1 store decision, ADR-4 sidebar contribution

---

## Metadata

**Confidence breakdown:**
- Extension architecture: HIGH -- thoroughly documented in ExtensionAPI.ts, proven across 4 existing extensions
- Sidebar contribution: HIGH -- `contributeSidebarPanel()` is proven (Gitflow Phase 40)
- Store boundary (ADR): HIGH -- identical reasoning to Phase 40, cross-slice dependency verified
- Dialog management: HIGH -- GitflowPanel proves dialogs work inside extension panel components
- Component move: HIGH -- GitHub extension proves `extensions/{name}/components/` pattern
- Lifecycle cleanup: HIGH -- `ExtensionAPI.cleanup()` is exhaustively tested
- Graceful degradation: HIGH -- no core features depend on worktree UI

**Research date:** 2026-02-11
**Valid until:** 2026-03-13 (30 days -- stable patterns, no external dependency changes expected)
