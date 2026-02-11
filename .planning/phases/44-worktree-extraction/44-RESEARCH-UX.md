# Phase 44: Worktree Extraction - UX Research

**Researched:** 2026-02-11
**Domain:** UX flows, sidebar panel migration, dialog management, graceful degradation, extension contribution patterns
**Confidence:** HIGH
**Researcher:** UX & Extensibility Specialist

---

## 1. Current State Analysis

### 1.1 Where Worktree UI Lives Today

The worktree feature currently lives as **hardcoded JSX** in the RepositoryView sidebar, with four dedicated component files:

| File | Purpose | Lines |
|------|---------|-------|
| `src/components/worktree/WorktreePanel.tsx` | Main sidebar panel (list worktrees, loading/error/empty states) | 69 |
| `src/components/worktree/WorktreeItem.tsx` | Individual worktree row with actions (switch, explore, delete) | 139 |
| `src/components/worktree/CreateWorktreeDialog.tsx` | Modal dialog for creating a new worktree (name, path, branch selection) | 193 |
| `src/components/worktree/DeleteWorktreeDialog.tsx` | Modal dialog for deleting a worktree (force delete, branch delete options) | 152 |
| `src/components/worktree/index.ts` | Barrel export (4 components) | 4 |

**Data layer:**
| File | Purpose |
|------|---------|
| `src/stores/domain/git-ops/worktrees.slice.ts` | Zustand slice: list, create, delete, select, openInExplorer, switchToWorktree | 83 lines |
| `src/stores/domain/git-ops/index.ts` | Aggregates WorktreeSlice into the unified GitOpsStore | -- |

### 1.2 Hardcoded Integration in RepositoryView

The worktree section is embedded directly in `src/components/RepositoryView.tsx` at lines 188-210:

```tsx
{/* Worktrees section */}
<details className="border-b border-ctp-surface0">
  <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 ...">
    <FolderGit2 className="w-4 h-4" />
    <span className="font-semibold text-sm flex-1">Worktrees</span>
    <button type="button" onClick={(e) => { e.preventDefault(); setShowWorktreeDialog(true); }}
      className="p-1 hover:bg-ctp-surface1 rounded ..." title="Create new worktree">
      <Plus className="w-3.5 h-3.5" />
    </button>
  </summary>
  <WorktreePanel onOpenDeleteDialog={(name) => setWorktreeToDelete(name)} />
</details>
```

Additionally, RepositoryView renders the dialog components at the bottom (lines 232-239):

```tsx
<CreateWorktreeDialog open={showWorktreeDialog} onOpenChange={setShowWorktreeDialog} />
<DeleteWorktreeDialog worktreeName={worktreeToDelete}
  onOpenChange={(open) => !open && setWorktreeToDelete(null)} />
```

### 1.3 Current RepositoryView State Dependencies

RepositoryView manages two pieces of state for worktrees:
- `showWorktreeDialog: boolean` -- controls CreateWorktreeDialog visibility
- `worktreeToDelete: string | null` -- controls DeleteWorktreeDialog (name of worktree to delete, or null)

These are currently passed as props:
- `WorktreePanel` receives `onOpenDeleteDialog` callback
- `CreateWorktreeDialog` receives `open` and `onOpenChange`
- `DeleteWorktreeDialog` receives `worktreeName` and `onOpenChange`

### 1.4 Dependency Graph

```
RepositoryView.tsx (SIDEBAR)
  |-- [hardcoded <details>] --> <WorktreePanel>
  |                               |-- useGitOpsStore (worktree slice)
  |                               |-- <WorktreeItem> (per worktree)
  |                               |     |-- select, openInExplorer, switchTo, delete callbacks
  |                               |-- onOpenDeleteDialog callback --> RepositoryView state
  |
  |-- [hardcoded dialogs]
  |     |-- <CreateWorktreeDialog>
  |     |     |-- useGitOpsStore (branch + worktree slices)
  |     |     |-- @tauri-apps/plugin-dialog (directory picker)
  |     |     |-- UI components (Dialog, Input, Button)
  |     |
  |     |-- <DeleteWorktreeDialog>
  |           |-- useGitOpsStore (branch + worktree slices)
  |           |-- UI components (Dialog, Button)
  |
  |-- [hardcoded <DynamicSidebarPanels />] --> renders from SidebarPanelRegistry
```

### 1.5 No Existing Command Palette or Toolbar Entries

Unlike Gitflow (which had a toolbar button and command palette entry), the worktree feature currently has **zero** command palette entries and **zero** toolbar actions. The only access point is the sidebar panel. The `CommandCategory` type in `src/lib/commandRegistry.ts` already includes `"Worktrees"` as a valid category, but no commands use it.

### 1.6 Current Sidebar Layout

```
+------------------------+
| Branches         [+]   |  <- Core (hardcoded)
+------------------------+
| Stashes          [+]   |  <- Core (hardcoded)
+------------------------+
| Tags             [+]   |  <- Core (hardcoded)
+------------------------+
| Worktrees        [+]   |  <- HARDCODED -- must migrate
+------------------------+
| <DynamicSidebarPanels> |  <- Extension-contributed (Gitflow, etc.)
+------------------------+
| [Commit Form]          |  <- Core (fixed at bottom)
+------------------------+
```

---

## 2. Extension Contribution Patterns

### 2.1 Established Patterns from Existing Extensions

FlowForge has **four** built-in extensions already extracted, providing well-tested contribution patterns:

#### Pattern A: Gitflow Extension (closest analog to worktree extraction)

File: `src/extensions/gitflow/index.ts`

The Gitflow extension is the **best reference** because it contributes a sidebar panel with embedded dialogs:

```typescript
api.contributeSidebarPanel({
  id: "gitflow-panel",
  title: "Gitflow",
  icon: GitMerge,
  component: GitflowPanel,
  priority: 65,
  defaultOpen: false,
});
```

Key insight: `GitflowPanel` manages its own dialog state internally (StartFlowDialog, FinishFlowDialog, InitGitflowDialog). The dialogs are rendered inside the panel component itself, **not** lifted to RepositoryView. This is the pattern the worktree extraction should follow.

#### Pattern B: GitHub Extension (most comprehensive)

File: `src/extensions/github/index.ts`

The GitHub extension demonstrates the full ExtensionAPI surface: blades, commands, toolbar, and store watchers. It also shows proper cleanup in `onDeactivate()`.

#### Pattern C: Content Viewers / Conventional Commits (blade-only)

These extensions contribute blade types and toolbar actions but no sidebar panels. Less relevant for worktree extraction.

### 2.2 Sidebar Panel Registry API

File: `src/lib/sidebarPanelRegistry.ts`

The `SidebarPanelConfig` interface supports:

```typescript
interface SidebarPanelConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  component: ComponentType<any>;
  priority: number;          // Extension range: 1-69 (70-100 reserved for core)
  when?: () => boolean;      // Conditional visibility
  defaultOpen?: boolean;     // Initial <details> state
  source?: string;           // Auto-set by ExtensionAPI (ext:{id})
  renderAction?: () => ReactNode;  // Action button in <summary> header
  badge?: () => number | string | null;  // Badge count in header
}
```

The `renderAction` property is critical for the worktree panel because the current hardcoded sidebar section includes a "+" button in the `<summary>` that triggers CreateWorktreeDialog. This button must be contributed via `renderAction`.

### 2.3 ExtensionAPI Cleanup Lifecycle

The `ExtensionAPI.cleanup()` method (called during deactivation) handles:
1. Unregistering all blades
2. Unregistering all commands
3. Unregistering toolbar actions (by source)
4. Unregistering context menu items (by source)
5. **Unregistering sidebar panels (by source)** -- calls `useSidebarPanelRegistry.getState().unregisterBySource()`
6. Unregistering status bar items
7. Removing event bus listeners
8. Removing navigation subscriptions
9. Removing git hook subscriptions
10. Running disposables in reverse order (LIFO)

This means all worktree UI contributions will be atomically cleaned up when the extension is disabled. No manual cleanup needed.

### 2.4 DynamicSidebarPanels Rendering

File: `src/components/RepositoryView.tsx`, lines 51-91

The existing `DynamicSidebarPanels` component renders extension-contributed panels with:
- `<details>` wrapper with `open={panel.defaultOpen}`
- `<summary>` with icon, title, optional badge, and optional action button (`renderAction`)
- `<ExtensionPanelErrorBoundary>` for crash isolation
- Priority-based sorting (descending, then alphabetic tiebreak)

This infrastructure is ready to host the worktree panel without modification.

---

## 3. UX Recommendations

### 3.1 Sidebar Panel Contribution Design

**Recommended `contributeSidebarPanel` configuration:**

```typescript
api.contributeSidebarPanel({
  id: "worktree-panel",
  title: "Worktrees",
  icon: FolderGit2,
  component: WorktreeExtensionPanel,  // Wrapper that owns dialog state
  priority: 69,   // Highest extension priority -- worktrees are core-adjacent
  defaultOpen: false,
  renderAction: () => (
    <button type="button"
      onClick={(e) => { e.preventDefault(); /* open create dialog */ }}
      className="p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text"
      title="Create new worktree">
      <Plus className="w-3.5 h-3.5" />
    </button>
  ),
  badge: () => {
    const count = useGitOpsStore.getState().worktreeList.length;
    return count > 1 ? count : null;  // Only show badge if multiple worktrees
  },
});
```

**Priority rationale:** Priority 69 (the maximum for extensions, since ExtensionAPI clamps to 1-69) ensures the worktree panel appears FIRST among extension-contributed panels. This is appropriate because worktrees are a core-adjacent Git feature that users expect to see near Branches/Stash/Tags. In the current layout, worktrees appear right after Tags; after extraction, they will appear right after Tags but in the DynamicSidebarPanels section (still visually adjacent).

### 3.2 Dialog State Management: Self-Contained Panel Component

**Critical design decision:** The worktree panel component must manage its own dialog state.

**Current problem:** RepositoryView owns `showWorktreeDialog` and `worktreeToDelete` state, and passes them as props. This creates a coupling where RepositoryView needs to know about worktree dialogs.

**Recommended solution:** Create a new wrapper component `WorktreeExtensionPanel` that encapsulates:
1. The existing `WorktreePanel` for the list UI
2. Internal state for `showCreateDialog` and `worktreeToDelete`
3. `CreateWorktreeDialog` and `DeleteWorktreeDialog` rendered inside the component

This follows the **Gitflow pattern** where `GitflowPanel` manages its own `showStartDialog`, `showFinishDialog`, and `showInitDialog` state internally, rendering the dialogs within the panel component tree.

```typescript
// src/extensions/worktree/components/WorktreeExtensionPanel.tsx
function WorktreeExtensionPanel() {
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  return (
    <>
      <WorktreePanel onOpenDeleteDialog={setDeleteTarget} />
      <CreateWorktreeDialog open={showCreate} onOpenChange={setShowCreate} />
      <DeleteWorktreeDialog worktreeName={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)} />
    </>
  );
}
```

**Why this is better than the current approach:**
- RepositoryView no longer needs to know about worktree dialogs
- Dialog state is co-located with the feature that uses it
- When the extension is disabled, all dialog state is destroyed along with the component
- No orphaned dialog state left in RepositoryView

### 3.3 The renderAction Challenge: Cross-Component Communication

The "+" button in the sidebar header needs to open `CreateWorktreeDialog`, but `renderAction` is rendered in the `<summary>` of the `<details>` element (in `DynamicSidebarPanels`), while the dialog lives inside the panel component.

**Recommended approach: Use a shared ref or event pattern.**

Option A: **Module-level event emitter** (simplest, follows Gitflow's document event pattern):

```typescript
// WorktreeExtensionPanel listens for the event
useEffect(() => {
  const handler = () => setShowCreate(true);
  document.addEventListener("worktree-create-dialog", handler);
  return () => document.removeEventListener("worktree-create-dialog", handler);
}, []);

// renderAction dispatches the event
renderAction: () => (
  <button onClick={(e) => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent("worktree-create-dialog"));
  }} title="Create new worktree" className="...">
    <Plus className="w-3.5 h-3.5" />
  </button>
)
```

Option B: **Zustand micro-store** (more React-idiomatic but heavier):

Create a tiny Zustand store that tracks `showCreateDialog: boolean` with `open()` / `close()` methods. Both `renderAction` and `WorktreeExtensionPanel` subscribe to it.

**Recommendation:** Use Option A (DOM event). It matches the existing pattern in RepositoryView where `create-branch-dialog` events are dispatched from the command palette (line 102-106). This is a proven pattern in the codebase.

### 3.4 Command Palette and Toolbar Contributions

The worktree feature currently has **no** command palette entries. The extraction is an opportunity to add discoverability:

**Recommended commands:**

```typescript
api.registerCommand({
  id: "create-worktree",
  title: "Create Worktree",
  description: "Create a new Git worktree",
  category: "Worktrees",
  icon: FolderGit2,
  keywords: ["worktree", "create", "new", "workspace"],
  action: () => document.dispatchEvent(new CustomEvent("worktree-create-dialog")),
  enabled: () => !!useGitOpsStore.getState().repoStatus,
});

api.registerCommand({
  id: "list-worktrees",
  title: "List Worktrees",
  description: "View all Git worktrees for this repository",
  category: "Worktrees",
  icon: FolderGit2,
  keywords: ["worktree", "list", "workspace"],
  action: () => { /* scroll sidebar to worktree panel, or open the details element */ },
  enabled: () => !!useGitOpsStore.getState().repoStatus,
});
```

**Toolbar action is optional.** Unlike Gitflow (which has a toolbar button for the cheatsheet), worktrees are primarily a sidebar panel feature. A toolbar button is not needed unless usage data suggests users want quicker access.

### 3.5 Graceful Degradation When Extension is Disabled

#### Scenario Matrix

| Feature | Extension Active | Extension Disabled | Rationale |
|---------|-----------------|-------------------|-----------|
| Worktree sidebar panel | Visible in sidebar with [+] action | **Gone from sidebar** | Panel unregistered via cleanup |
| Create Worktree dialog | Accessible via [+] button and command palette | **Unavailable** | Dialog lives inside extension panel |
| Delete Worktree dialog | Accessible via worktree item delete button | **Unavailable** | Dialog lives inside extension panel |
| Worktree list in sidebar | Shows all worktrees with status | **Gone** | Panel content removed |
| Switch to worktree | Available via sidebar item | **Unavailable via UI** | No sidebar panel |
| Open worktree in explorer | Available via sidebar item | **Unavailable via UI** | No sidebar panel |
| "Create Worktree" command | Available in palette | **Hidden from palette** | Command unregistered |
| Worktree data in store | Present (GitOpsStore slice) | **Still present** | Data slice stays in core |
| Branches, Stash, Tags | Fully functional | **Fully functional** | Core features unaffected |
| Commit workflow | Works | **Works** | Not affected |

#### Key Degradation Guarantee

Disabling the worktree extension:
1. Removes ALL worktree UI (sidebar panel, dialogs, command palette entries)
2. Does NOT affect any core Git operations
3. Does NOT remove worktree data from the store (the `worktrees.slice.ts` remains in GitOpsStore)
4. Does NOT leave orphaned state in RepositoryView (since dialog state moves into the extension panel)

#### Mid-Session Disable Scenario

If a user is looking at the worktree panel and disables the extension:
1. `deactivateExtension("worktree")` runs
2. `api.cleanup()` unregisters the sidebar panel from the registry
3. `DynamicSidebarPanels` re-renders and the worktree panel disappears
4. If CreateWorktreeDialog or DeleteWorktreeDialog was open, the dialog component is unmounted (React cleanup handles this)
5. Toast: "Worktree Management disabled"
6. The `worktreeList` data in the store persists but is not displayed

**This is a clean degradation.** No error states, no layout shifts beyond the expected panel removal, no orphaned dialogs.

### 3.6 Sidebar Layout After Extraction

**Worktree extension enabled:**
```
+------------------------+
| Branches         [+]   |  <- Core (hardcoded)
+------------------------+
| Stashes          [+]   |  <- Core (hardcoded)
+------------------------+
| Tags             [+]   |  <- Core (hardcoded)
+------------------------+
| Worktrees        [+]   |  <- Extension-contributed (priority 69)
+------------------------+
| Gitflow                |  <- Extension-contributed (priority 65)
+------------------------+
| <Other Extensions>     |  <- Other extension panels
+------------------------+
| [Commit Form]          |  <- Core (fixed at bottom)
+------------------------+
```

**Worktree extension disabled:**
```
+------------------------+
| Branches         [+]   |  <- Core (hardcoded)
+------------------------+
| Stashes          [+]   |  <- Core (hardcoded)
+------------------------+
| Tags             [+]   |  <- Core (hardcoded)
+------------------------+
| Gitflow                |  <- Extension-contributed (priority 65)
+------------------------+
| <Other Extensions>     |  <- Other extension panels
+------------------------+
| [Commit Form]          |  <- Core (fixed at bottom)
+------------------------+
```

**Visual impact:** The worktree panel disappears, and the first extension panel (Gitflow) moves up to directly follow Tags. This is clean and expected behavior. The position shift from "hardcoded between Tags and DynamicSidebarPanels" to "first in DynamicSidebarPanels" is minimal because priority 69 ensures worktrees appear before all other extension panels.

---

## 4. Extensibility Patterns

### 4.1 Extension Entry Point Design

Following the established pattern, the worktree extension entry point should be:

```typescript
// src/extensions/worktree/index.ts
import { createElement, useState } from "react";
import { FolderGit2, Plus } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { useGitOpsStore } from "../../stores/domain/git-ops";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Import components (small enough for synchronous import)
  const { WorktreePanel } = await import("../../components/worktree/WorktreePanel");
  const { CreateWorktreeDialog } = await import("../../components/worktree/CreateWorktreeDialog");
  const { DeleteWorktreeDialog } = await import("../../components/worktree/DeleteWorktreeDialog");

  // Create wrapper component that owns dialog state
  function WorktreeExtensionPanel() {
    const [showCreate, setShowCreate] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    // Listen for create dialog event (from renderAction button or command palette)
    // ... useEffect with event listener ...

    return createElement('div', null,
      createElement(WorktreePanel, { onOpenDeleteDialog: setDeleteTarget }),
      createElement(CreateWorktreeDialog, { open: showCreate, onOpenChange: setShowCreate }),
      createElement(DeleteWorktreeDialog, {
        worktreeName: deleteTarget,
        onOpenChange: (open: boolean) => !open && setDeleteTarget(null),
      }),
    );
  }

  // Contribute sidebar panel
  api.contributeSidebarPanel({
    id: "worktree-panel",
    title: "Worktrees",
    icon: FolderGit2,
    component: WorktreeExtensionPanel,
    priority: 69,
    defaultOpen: false,
    renderAction: () => createElement('button', {
      type: 'button',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("worktree-create-dialog"));
      },
      className: "p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text",
      title: "Create new worktree",
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
    description: "Create a new Git worktree",
    category: "Worktrees",
    icon: FolderGit2,
    keywords: ["worktree", "create", "new", "workspace", "working tree"],
    action: () => document.dispatchEvent(new CustomEvent("worktree-create-dialog")),
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all unregistrations
}
```

### 4.2 Registration in App.tsx

Following the established pattern:

```typescript
import {
  onActivate as worktreeActivate,
  onDeactivate as worktreeDeactivate,
} from "./extensions/worktree";

// In useEffect:
registerBuiltIn({
  id: "worktree",
  name: "Worktree Management",
  version: "1.0.0",
  activate: worktreeActivate,
  deactivate: worktreeDeactivate,
});
```

### 4.3 File Structure Recommendation

The extension files should follow the established pattern where the entry point lives in `src/extensions/worktree/` but existing components can stay in place:

**New files:**
| File | Purpose |
|------|---------|
| `src/extensions/worktree/index.ts` | Extension entry point (onActivate, onDeactivate) |
| `src/extensions/worktree/components/WorktreeExtensionPanel.tsx` | Wrapper component owning dialog state |

**Alternative:** Define `WorktreeExtensionPanel` inline in the entry point `index.ts` using `createElement`. This avoids creating a new file but makes the entry point longer. The Gitflow extension demonstrates that importing existing components and registering them via the API is sufficient -- the component files themselves do NOT need to move into the extension directory.

**Preferred approach:** Create a dedicated `WorktreeExtensionPanel.tsx` file under `src/extensions/worktree/components/` for readability, following the Gitflow pattern where `GitflowPanel.tsx` is a standalone component file.

### 4.4 Data Slice Architecture: Stays in Core

The `worktrees.slice.ts` MUST remain in the `GitOpsStore` for these reasons:

1. **No core consumers currently exist** (unlike Gitflow where BranchList reads gitflowStatus), BUT the data slice is part of the unified git-ops store and removing it would require a store restructure
2. **Store rehydration:** The extension activation lifecycle (register -> discovered -> activating -> active) means the worktree data might be needed before the extension activates
3. **Future-proofing:** Other extensions or core features might want to read worktree state (e.g., a branch checkout command that warns "this branch has an active worktree")
4. **Consistency:** All other data slices (branches, tags, stash, gitflow, topology, undo) stay in core even when their UI is extension-contributed

The extension **consumes** the store data via `useGitOpsStore`; it does not **own** the store slice.

### 4.5 What to Remove from Core

**Files to modify:**

| File | Change |
|------|--------|
| `src/components/RepositoryView.tsx` | Remove hardcoded worktree `<details>` section (lines 188-210), remove `CreateWorktreeDialog` and `DeleteWorktreeDialog` renders (lines 232-239), remove `showWorktreeDialog` and `worktreeToDelete` state (lines 98-99), remove worktree imports (lines 19-22), remove `FolderGit2` and `Plus` icon imports if no longer used |
| `src/App.tsx` | Add `registerBuiltIn()` call for worktree extension |

**Files to create:**

| File | Purpose |
|------|---------|
| `src/extensions/worktree/index.ts` | Extension entry point |
| `src/extensions/worktree/components/WorktreeExtensionPanel.tsx` | Panel wrapper with dialog state |

**Files that stay unchanged:**

| File | Reason |
|------|--------|
| `src/components/worktree/WorktreePanel.tsx` | Component stays; rendered via extension panel wrapper |
| `src/components/worktree/WorktreeItem.tsx` | Component stays; imported by WorktreePanel |
| `src/components/worktree/CreateWorktreeDialog.tsx` | Component stays; rendered inside extension panel |
| `src/components/worktree/DeleteWorktreeDialog.tsx` | Component stays; rendered inside extension panel |
| `src/components/worktree/index.ts` | Barrel export stays |
| `src/stores/domain/git-ops/worktrees.slice.ts` | Data slice stays in core |
| `src/stores/domain/git-ops/index.ts` | WorktreeSlice remains part of GitOpsStore |

**No files to delete.** The component files are reused by the extension; only their registration point changes.

---

## 5. Risk Areas

### 5.1 High Risk

| Risk | Impact | Mitigation | Confidence |
|------|--------|------------|------------|
| Dialog state orphaning | If dialog state stays in RepositoryView after extraction, opening the create dialog could fail silently | Move ALL dialog state into WorktreeExtensionPanel; verify RepositoryView has zero worktree references after extraction | HIGH |
| Duplicate sidebar panel | If hardcoded `<details>` is not removed, worktree panel appears twice | Explicit verification step: search for `FolderGit2` and `WorktreePanel` in RepositoryView after extraction | HIGH |
| `Plus` and `FolderGit2` imports left in RepositoryView | Lint warnings about unused imports; builds still pass but messy | Remove from RepositoryView import statements; verify with IDE or ESLint | HIGH |

### 5.2 Medium Risk

| Risk | Impact | Mitigation | Confidence |
|------|--------|------------|------------|
| renderAction `<button>` click does not reach WorktreeExtensionPanel | "+" button in sidebar header does nothing; create dialog never opens | Use DOM CustomEvent pattern (proven in codebase) with `worktree-create-dialog` event; add integration test | MEDIUM |
| Priority 69 appears above Gitflow (priority 65) but that was previously below Gitflow in DOM order | Users see different ordering: Worktrees before Gitflow instead of after | Both are in DynamicSidebarPanels now; Worktrees at 69 > Gitflow at 65 means Worktrees appears first. This is actually the correct order (Worktrees is a more fundamental Git feature than Gitflow) | HIGH |
| WorktreePanel `onOpenDeleteDialog` prop coupling | WorktreePanel expects a callback prop; the new wrapper must provide it | WorktreeExtensionPanel passes `setDeleteTarget` directly as the callback; existing interface unchanged | HIGH |
| Extension activation race at startup | Worktree panel briefly missing on first render | `registerBuiltIn()` activates immediately; since worktree components are small, import completes fast. Acceptable micro-delay (same as Gitflow panel) | MEDIUM |

### 5.3 Low Risk

| Risk | Impact | Mitigation | Confidence |
|------|--------|------------|------------|
| Stale worktree data when extension is re-enabled | User sees old worktree list briefly | WorktreePanel already calls `loadWorktrees()` in a useEffect on mount; data refreshes automatically when extension is re-enabled | HIGH |
| Badge showing stale count | Badge function reads from store outside React lifecycle | Badge function uses `getState()` which is always current; `DynamicSidebarPanels` re-renders on registry changes via `visibilityTick` | MEDIUM |
| ExtensionPanelErrorBoundary catches WorktreePanel crash | Panel shows error message instead of worktree list | This is by design -- error boundary protects the sidebar. The error message is clear and actionable | HIGH |
| `@tauri-apps/plugin-dialog` import in CreateWorktreeDialog | Dynamic import still works within extension panel context | Tauri plugins are app-global; no sandboxing concerns for built-in extensions | HIGH |

### 5.4 Common Pitfalls to Avoid

#### Pitfall 1: Not Moving Dialog Renders Out of RepositoryView

**What goes wrong:** Developer creates the extension sidebar panel but leaves `<CreateWorktreeDialog>` and `<DeleteWorktreeDialog>` renders in RepositoryView. The dialogs work when triggered from the panel, but the state (`showWorktreeDialog`, `worktreeToDelete`) is orphaned in RepositoryView.

**How to avoid:** The extraction must move ALL worktree JSX out of RepositoryView, including the dialog renders at lines 232-239 and the state declarations at lines 98-99.

#### Pitfall 2: Forgetting the renderAction Button

**What goes wrong:** The worktree panel appears in the sidebar but without the "+" create button in the header. Users lose the primary way to create worktrees.

**How to avoid:** Include `renderAction` in the `contributeSidebarPanel` config. Test that the button appears in the `<summary>` section.

#### Pitfall 3: Extension Priority Too Low

**What goes wrong:** Worktree panel appears after Gitflow and other extension panels, making it hard to find.

**How to avoid:** Use priority 69 (maximum for extensions). This ensures worktrees appear first among extension-contributed panels, preserving their position adjacent to core Git panels.

#### Pitfall 4: Breaking the Create Dialog Event Chain

**What goes wrong:** The `renderAction` button dispatches a CustomEvent, but the `WorktreeExtensionPanel` doesn't listen for it, or the event name doesn't match.

**How to avoid:** Use a constant for the event name (e.g., `WORKTREE_CREATE_EVENT = "worktree-create-dialog"`) shared between the renderAction and the panel component.

#### Pitfall 5: Not Verifying RepositoryView Has Zero Worktree References

**What goes wrong:** After extraction, RepositoryView still imports from `./worktree` or references worktree state, causing type errors or unused code.

**How to avoid:** After extraction, grep RepositoryView.tsx for `worktree`, `Worktree`, `FolderGit2`, and verify zero results. Also verify the file still compiles cleanly.

---

## 6. Comparison with Other Extensible Git GUIs

### 6.1 VS Code Source Control View

VS Code's SCM (Source Control Management) view uses a contribution-based model:
- Extensions register `SourceControlProvider` instances
- Each provider contributes its own "groups" (staged, unstaged, etc.)
- The SCM sidebar renders all registered providers
- Disabling a Git extension removes the SCM panel entirely

**Relevant lesson:** VS Code does NOT hardcode any Git UI. Even the basic Git panel is contributed by the built-in Git extension (`vscode.git`). This is the direction FlowForge should head -- and this phase moves worktrees in that direction.

### 6.2 GitKraken Worktree Panel

GitKraken shows worktrees as a sidebar section similar to FlowForge's current hardcoded approach. It is NOT extension-contributed. Worktrees are always visible when the feature is available.

**Relevant lesson:** GitKraken does not support disabling worktree features independently. FlowForge's extension approach is more flexible.

### 6.3 Pattern Best Practice: Extension-Contributed UI Should Feel Native

The key UX principle from VS Code's extension model: **contributed UI should be indistinguishable from built-in UI.** The `DynamicSidebarPanels` component in FlowForge already achieves this because:

1. It uses the same `<details>/<summary>` HTML pattern as hardcoded panels
2. It applies the same CSS classes (border, hover, backdrop blur)
3. It renders `panel.icon` and `panel.title` in the same layout
4. It supports `renderAction` for action buttons (matching the hardcoded "+" buttons)
5. It wraps content in `ExtensionPanelErrorBoundary` (which is invisible unless an error occurs)

The only visual difference is ordering: hardcoded panels always appear before dynamic panels. Using priority 69 minimizes this gap by placing worktrees at the top of the dynamic section.

---

## 7. Accessibility Considerations

### 7.1 Sidebar Panel Transition

When the worktree panel appears or disappears:
- The `DynamicSidebarPanels` component conditionally renders panels
- No `aria-live` region is needed (this is a deliberate user-initiated settings change)
- The `<details>/<summary>` pattern is natively accessible
- Screen readers will announce the summary text when the panel is focused

### 7.2 Current Worktree Panel Accessibility

The existing components have:
- Semantic `<button>` elements with `title` attributes for all actions (switch, explore, delete)
- `onClick` and `onKeyDown` handlers on WorktreeItem (supports Enter and Space)
- Status indicators use both color AND text labels (`statusLabels` map)
- Disabled states use `disabled` attribute on `<button>` elements

**Gaps:**
- WorktreeItem uses `div` with `onClick`/`onKeyDown` instead of `<button>` for the row -- should have `role="button"` and `tabIndex={0}` (it has `cursor-pointer` CSS but missing ARIA role)
- Status dot uses color only (the dot itself has a `title` for tooltip, which provides text equivalent, but is not announced by screen readers on focus)

These are pre-existing accessibility issues that should be noted but are not caused by the extraction. They can be addressed as a follow-up.

### 7.3 Keyboard Navigation

After extraction:
- Tab order follows DOM order: after core panels, the worktree `<details>` is focusable
- `<details>` is natively toggleable via Enter/Space
- The "+" button in `renderAction` is a standard `<button>`, natively keyboard-accessible
- Command palette entries provide keyboard-first access to create worktree

---

## 8. Extension Manager Integration

### 8.1 How Worktree Appears in Extension Manager

After extraction, the Extension Manager blade will show **five** built-in extensions:

```
Built-in (5)
+-------------------------------------------+
| Content Viewers                     v1.0.0 |
| Built-in                           [ON/OFF] |
+-------------------------------------------+
| Conventional Commits                v1.0.0 |
| Built-in                           [ON/OFF] |
+-------------------------------------------+
| Gitflow                            v1.0.0 |
| Built-in                           [ON/OFF] |
+-------------------------------------------+
| GitHub Integration                  v1.0.0 |
| Built-in                           [ON/OFF] |
+-------------------------------------------+
| Worktree Management                v1.0.0 |
| Built-in                           [ON/OFF] |
+-------------------------------------------+
```

Each extension can be independently toggled. The toggle switch calls `activateExtension` / `deactivateExtension` which triggers the extension lifecycle (including sidebar panel registration/unregistration).

### 8.2 Re-Activation Behavior

When a user re-enables the worktree extension:
1. `activateExtension("worktree")` runs
2. `onActivate(api)` registers the sidebar panel, command palette entries
3. `WorktreeExtensionPanel` mounts and `WorktreePanel`'s `useEffect` calls `loadWorktrees()`
4. Worktree data refreshes from the Rust backend
5. Panel appears in the sidebar with fresh data

The store data (`worktreeList`) may be stale from the previous session, but the `useEffect` in `WorktreePanel` immediately triggers a refresh. Users see "Loading worktrees..." briefly, then the current list.

---

## 9. Summary of Recommendations

1. **Create `src/extensions/worktree/index.ts`** as the extension entry point, following the Gitflow pattern
2. **Create `WorktreeExtensionPanel`** wrapper component that encapsulates dialog state (move dialog state OUT of RepositoryView)
3. **Use `contributeSidebarPanel` with priority 69** to ensure worktrees appear first among extension panels
4. **Use `renderAction`** to provide the "+" create button in the sidebar header
5. **Use DOM CustomEvent pattern** (`worktree-create-dialog`) for communication between `renderAction` and the panel component
6. **Add command palette entries** for "Create Worktree" (new discoverability)
7. **Keep `worktrees.slice.ts` in core** GitOpsStore
8. **Remove ALL worktree JSX from RepositoryView** (hardcoded panel, dialogs, state, imports)
9. **Register via `registerBuiltIn` in App.tsx** following established pattern
10. **Verify zero worktree references remain in RepositoryView** after extraction

---

## 10. Sources

### Primary (HIGH confidence -- direct code analysis)

- `src/components/RepositoryView.tsx:188-210` -- hardcoded Worktree sidebar section
- `src/components/RepositoryView.tsx:232-239` -- hardcoded Worktree dialog renders
- `src/components/RepositoryView.tsx:98-99` -- worktree dialog state declarations
- `src/components/RepositoryView.tsx:51-91` -- DynamicSidebarPanels component
- `src/components/worktree/WorktreePanel.tsx` -- sidebar panel content (69 lines)
- `src/components/worktree/WorktreeItem.tsx` -- worktree row component (139 lines)
- `src/components/worktree/CreateWorktreeDialog.tsx` -- create dialog (193 lines)
- `src/components/worktree/DeleteWorktreeDialog.tsx` -- delete dialog (152 lines)
- `src/components/worktree/index.ts` -- barrel export
- `src/stores/domain/git-ops/worktrees.slice.ts` -- data slice (83 lines)
- `src/stores/domain/git-ops/index.ts` -- GitOpsStore composition including WorktreeSlice
- `src/extensions/ExtensionAPI.ts` -- contributeSidebarPanel, registerCommand, cleanup lifecycle
- `src/extensions/ExtensionHost.ts` -- registerBuiltIn, activation/deactivation lifecycle
- `src/extensions/extensionTypes.ts` -- BuiltInExtensionConfig, ExtensionStatus
- `src/lib/sidebarPanelRegistry.ts` -- SidebarPanelConfig, priority system, unregisterBySource
- `src/lib/commandRegistry.ts` -- CommandCategory includes "Worktrees"
- `src/App.tsx` -- Built-in extension registration pattern (4 existing extensions)
- `src/blades/_discovery.ts` -- EXPECTED_TYPES (no worktree blade types registered)

### Secondary (HIGH confidence -- established patterns)

- `src/extensions/gitflow/index.ts` -- Gitflow extension pattern (closest analog: sidebar panel + dialogs)
- `src/extensions/gitflow/components/GitflowPanel.tsx` -- Self-contained panel with dialog state management
- `src/extensions/github/index.ts` -- GitHub extension pattern (comprehensive API usage)
- `src/extensions/conventional-commits/index.ts` -- Conventional Commits pattern (blade + toolbar + commands)
- `src/extensions/content-viewers/index.ts` -- Content Viewers pattern (blade-only with coreOverride)
- `src/blades/extension-manager/ExtensionManagerBlade.tsx` -- Extension Manager UI
- `src/blades/extension-manager/components/ExtensionCard.tsx` -- Extension toggle card with ToggleSwitch
- `.planning/phases/40-gitflow-extraction/40-RESEARCH-UX.md` -- Phase 40 UX patterns (reference)

---

## Metadata

**Confidence breakdown:**
- Current worktree UI inventory: HIGH -- exhaustive code analysis of all files
- Extension contribution patterns: HIGH -- verified against 4 existing built-in extensions
- Sidebar panel migration: HIGH -- SidebarPanelRegistry API matches requirements exactly
- Dialog state management: HIGH -- follows proven Gitflow self-contained panel pattern
- Graceful degradation: HIGH -- cleanup lifecycle verified in ExtensionAPI source
- Command palette additions: HIGH -- "Worktrees" category already exists
- Risk analysis: HIGH -- based on direct dependency analysis
- Accessibility: MEDIUM -- static code analysis, no runtime testing

**Research date:** 2026-02-11
**Valid until:** 2026-03-13 (stable internal architecture)
