# Phase 37: Extension Platform Foundation -- Implementation Research

**Researched:** 2026-02-10
**Phase scope:** PLAT-01 through PLAT-06
**Plans:** 37-01 (registries), 37-02 (UI surfaces), 37-03 (ExtensionAPI expansion + onDispose)
**Codebase snapshot:** ~45,227 LOC (34,152 TypeScript + 11,075 Rust), 137 existing tests

---

## 1. Summary of Implementation Approach

Phase 37 introduces four new registries (ContextMenu, SidebarPanel, StatusBar, GitHookBus), three new UI components (ContextMenu, dynamic sidebar, StatusBar), and expands ExtensionAPI with six new methods plus the `onDispose()` lifecycle pattern. The existing codebase provides a proven template in `toolbarRegistry.ts` (Zustand store pattern) and `github/index.ts` (built-in extension reference). The implementation follows a strict order: registries first, then UI surfaces, then API expansion -- because UI surfaces consume registries, and the API delegates to registries.

**Key insight:** The codebase has zero right-click handling today. No `onContextMenu` event listeners exist in any `.tsx` file. This means context menu is a clean addition with no conflict. The sidebar is hardcoded in `RepositoryView.tsx` with five `<details>` sections. The status bar does not exist -- a new component slots between `<main>` and `<ToastContainer>` in `App.tsx`.

**Implementation strategy:** Each registry is a standalone Zustand store with devtools middleware, following the exact `toolbarRegistry.ts` pattern. UI components are pure renderers that subscribe to registry state. ExtensionAPI gains six new methods that namespace IDs, delegate to registries, and track registrations for `cleanup()`. The `onDispose()` pattern adds a `Disposable` tracking list to ExtensionAPI.

---

## 2. Existing Extension System Analysis

### 2.1 Architecture Overview

The extension system has three layers:

| Layer | File | Role |
|-------|------|------|
| **Lifecycle** | `src/extensions/ExtensionHost.ts` | Zustand store managing discovery, activation, deactivation of extensions |
| **Facade** | `src/extensions/ExtensionAPI.ts` | Per-extension API instance with namespacing and cleanup tracking |
| **Types** | `src/extensions/extensionTypes.ts` | `ExtensionInfo`, `ExtensionStatus`, `BuiltInExtensionConfig` |

### 2.2 Current ExtensionAPI Surface

```
src/extensions/ExtensionAPI.ts (135 lines)
```

The `ExtensionAPI` class has three registration methods and one cleanup method:

```typescript
class ExtensionAPI {
  registerBlade(config: ExtensionBladeConfig): void;     // -> bladeRegistry
  registerCommand(config: ExtensionCommandConfig): void;  // -> commandRegistry
  contributeToolbar(config: ExtensionToolbarConfig): void; // -> toolbarRegistry
  cleanup(): void;                                         // Atomic removal of all registrations
}
```

**Namespacing pattern:** Every registration ID is prefixed with `ext:{extensionId}:`. This is automatic and consistent across all three registries.

**Cleanup pattern:** `cleanup()` iterates three private arrays (`registeredBlades`, `registeredCommands`, `registeredToolbarActions`) and unregisters each. This pattern extends naturally to new registries.

### 2.3 Registry Patterns in Use

Three registries exist, with two different patterns:

| Registry | File | Storage | Pattern |
|----------|------|---------|---------|
| **BladeRegistry** | `src/lib/bladeRegistry.ts` | Module-level `Map<string, BladeRegistration>` | Plain module with imperative functions |
| **CommandRegistry** | `src/lib/commandRegistry.ts` | Module-level `Map<string, Command>` | Plain module with imperative functions |
| **ToolbarRegistry** | `src/lib/toolbarRegistry.ts` | Zustand store with `Map<string, ToolbarAction>` | Reactive store with `devtools` middleware |

**The ToolbarRegistry is the template for new registries** because:
- It uses Zustand, so UI components reactively re-render when registrations change
- It has `register`, `unregister`, `unregisterBySource`, and a filtered accessor (`getGrouped`)
- It uses `devtools` middleware for debugging
- It creates new `Map` instances on mutation for Zustand reactivity
- It has a `visibilityTick` counter for forcing re-evaluation of `when()` conditions

### 2.4 GitHub Extension as Reference Implementation

```
src/extensions/github/index.ts (322 lines)
```

This is the only existing built-in extension and demonstrates the canonical patterns:

1. **Lazy component loading:** `ensureComponents()` uses dynamic `import()` to load components on demand, avoiding circular dependencies and enabling code splitting
2. **Store subscription:** Module-level `unsubRepoWatch` and `unsubGitHubWatch` unsubscribe functions, created in `onActivate`, cleaned up in `onDeactivate`
3. **Standalone store:** `githubStore.ts` is a Zustand store independent of the core `GitOpsStore`
4. **Custom toolbar rendering:** Uses `renderCustom` on toolbar actions to inject `<GitHubStatusButton />`
5. **Deactivation:** `onDeactivate()` cancels polling, clears React Query cache, unsubscribes from store watchers

**Key gap:** The GitHub extension manages its own cleanup imperatively in `onDeactivate()`. There is no `onDispose()` pattern -- the extension must manually track every subscription and timer. Phase 37's `onDispose()` addresses this.

### 2.5 ExtensionHost Lifecycle

```
src/extensions/ExtensionHost.ts (403 lines)
```

Lifecycle states: `discovered -> activating -> active -> deactivated/disabled/error`

**Activation flow:**
1. `ExtensionHost.registerBuiltIn(config)` creates `ExtensionInfo` with `builtIn: true`
2. Creates `new ExtensionAPI(id)` facade
3. Calls `config.activate(api)` -- extension registers blades/commands/toolbar
4. On success: stores API facade and module reference
5. On failure: calls `api.cleanup()` for partial rollback

**Deactivation flow:**
1. Calls `module.onDeactivate()` if it exists
2. Calls `api.cleanup()` to remove all registrations
3. Deletes API and module references from module-level Maps

**Registration in App.tsx:**
```typescript
// src/App.tsx line 57-63
registerBuiltIn({
  id: "github",
  name: "GitHub Integration",
  version: "1.0.0",
  activate: githubActivate,
  deactivate: githubDeactivate,
});
```

### 2.6 Gaps to Address in Phase 37

| Gap | Current State | Target State |
|-----|---------------|--------------|
| No context menu system | Zero `onContextMenu` handlers in codebase | Extensions contribute items by location |
| Hardcoded sidebar | `RepositoryView.tsx` has 5 inline `<details>` sections | Registry-based dynamic rendering |
| No status bar | No bottom bar component | Extensions contribute widgets |
| No git operation events | Git ops are fire-and-forget in store slices | Pub/sub bus for pre/post events |
| Manual cleanup | Extensions manually track unsubscribe functions | `onDispose()` disposable pattern |
| 3 registration methods | Blade, command, toolbar only | +6: context menu, sidebar, status bar, git hook, viewer, file dispatch |

---

## 3. Current UI Structure Analysis

### 3.1 Application Layout

```
src/App.tsx (128 lines)
```

```
<div className="flex flex-col h-screen bg-ctp-base text-ctp-text font-sans">
  <Header />                          // Toolbar, repo/branch switcher
  <main className="flex-1 min-h-0 overflow-hidden">
    {status ? <RepositoryView /> : <WelcomeView />}
  </main>
  <ToastContainer />                  // Fixed position toasts
  <CommandPalette />                   // Modal overlay
</div>
```

**Status bar insertion point:** Between `<main>` and `<ToastContainer />`. The flexbox column layout means inserting a `<StatusBar />` as a sibling of `<main>` will naturally place it at the bottom without affecting the existing layout.

### 3.2 Header / Toolbar

```
src/components/Header.tsx (174 lines)
```

The header is a fixed 56px (`h-14`) sticky top bar containing:
- FlowForge branding
- RepoSwitcher + BranchSwitcher (when repo open)
- ProcessNavigation tabs
- `<Toolbar />` on the right side

The toolbar reads from `toolbarRegistry` and renders actions grouped by `ToolbarGroup`.

### 3.3 Sidebar (RepositoryView)

```
src/components/RepositoryView.tsx (179 lines)
```

The sidebar is the left panel of a horizontal `ResizablePanelLayout`:

```tsx
<ResizablePanelLayout autoSaveId="repo-layout" direction="horizontal">
  <ResizablePanel id="sidebar" defaultSize={20} minSize={15} maxSize={30}>
    <div className="h-full border-r border-ctp-surface0 bg-ctp-base flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {/* 5 hardcoded <details> sections: */}
        <details open>Branches</details>
        <details>Stashes</details>
        <details>Tags</details>
        <details>Gitflow</details>    {/* <- Will be contributed by extension */}
        <details>Worktrees</details>
      </div>
      <div className="shrink-0 border-t border-ctp-surface0">
        <CommitForm />                 {/* Fixed bottom */}
      </div>
    </div>
  </ResizablePanel>
  <ResizeHandle />
  <ResizablePanel id="blades" defaultSize={80}>
    <BladeContainer />
  </ResizablePanel>
</ResizablePanelLayout>
```

**Sidebar section pattern:** Each section uses `<details>` with a sticky `<summary>` containing an icon, title, and optional action button. The summary has consistent styling:

```
className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2
           select-none sticky top-0 z-10 bg-ctp-base/70 backdrop-blur-lg
           border-b border-ctp-surface0/50"
```

**Refactoring strategy:** The five sections can be split into "core sections" (Branches, Stashes, Tags, Worktrees) that remain hardcoded, and "extension sections" (Gitflow, and future additions) rendered from the SidebarPanelRegistry. During Phase 37, we keep all five sections as-is but add a dynamic rendering zone between them. In Phase 40 (Gitflow extraction), the Gitflow `<details>` block moves to the dynamic zone via the registry.

### 3.4 Tailwind v4 Theme Setup

```
src/index.css (110 lines)
```

Uses `@import "tailwindcss"` + `@import "@catppuccin/tailwindcss/mocha.css"` with a `@theme {}` block for custom properties. Color tokens are `--ctp-*` (e.g., `bg-ctp-base`, `text-ctp-text`, `border-ctp-surface0`). Custom animations use `--animate-{name}` registration.

**For new components:** Use `bg-ctp-mantle` for the status bar background (consistent with the header's `bg-ctp-mantle/80`), `border-ctp-surface0` for dividers, and `text-ctp-subtext0` for secondary text.

---

## 4. ContextMenu Implementation

### 4.1 Current State

No right-click handling exists anywhere in the codebase. `onContextMenu` does not appear in any `.tsx` file. This is a completely clean slate.

### 4.2 Registry Design

Follow the ToolbarRegistry pattern exactly:

```
NEW FILE: src/lib/contextMenuRegistry.ts
```

```typescript
import type { LucideIcon } from "lucide-react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type ContextMenuLocation =
  | "file-tree"
  | "branch-list"
  | "commit-list"
  | "stash-list"
  | "tag-list"
  | "diff-hunk"
  | "blade-tab";

export interface ContextMenuContext {
  location: ContextMenuLocation;
  branchName?: string;
  filePath?: string;
  commitOid?: string;
  stashIndex?: number;
  tagName?: string;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  location: ContextMenuLocation;
  group?: string;
  priority?: number;
  when?: (context: ContextMenuContext) => boolean;
  execute: (context: ContextMenuContext) => void | Promise<void>;
  source?: string;
}

export interface ContextMenuRegistryState {
  items: Map<string, ContextMenuItem>;
  register: (item: ContextMenuItem) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;
  getItemsForLocation: (
    location: ContextMenuLocation,
    context: ContextMenuContext,
  ) => ContextMenuItem[];
}
```

**Key design decisions:**
- `when()` receives a `ContextMenuContext` (unlike toolbar's `when()` which is parameter-less) because context menu visibility depends on what was right-clicked
- `execute()` also receives the context for the same reason
- `group` enables separator dividers between groups (e.g., "navigation" group, then separator, then "gitflow" group)
- `priority` sorts items within a group (higher = higher in menu)

### 4.3 UI Component Design

```
NEW FILE: src/components/ui/ContextMenu.tsx
```

**Approach:** Portal-based popover rendered at mouse coordinates. Use React's `createPortal` to render outside the component tree (avoids overflow:hidden clipping).

```typescript
interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}
```

**Event handling pattern for list components:**

```typescript
// In BranchItem.tsx (and similar components):
<div
  onContextMenu={(e) => {
    e.preventDefault();
    const items = useContextMenuRegistry.getState()
      .getItemsForLocation("branch-list", { location: "branch-list", branchName: branch.name });
    if (items.length > 0) {
      showContextMenu({ x: e.clientX, y: e.clientY }, items);
    }
  }}
>
```

**State management for context menu visibility:**

Option A: Zustand store for menu state (position + items + visible flag)
Option B: React context + useState in a provider

**Recommendation: Option A (Zustand store)** because:
- The context menu can be triggered from any component in the tree
- A store avoids prop drilling or context nesting
- Consistent with other UI state management in the codebase
- Can be combined into the ContextMenuRegistry store itself

```typescript
// Extended ContextMenuRegistryState:
interface ContextMenuRegistryState {
  // ... registry methods above ...
  activeMenu: {
    items: ContextMenuItem[];
    position: { x: number; y: number };
    context: ContextMenuContext;
  } | null;
  showMenu: (position: { x: number; y: number }, location: ContextMenuLocation, context: ContextMenuContext) => void;
  hideMenu: () => void;
}
```

### 4.4 Keyboard and Accessibility

- Context menu closes on `Escape`, click outside, or item selection
- Arrow keys navigate items
- `Enter` / `Space` trigger selected item
- Focus trapping within the menu
- `aria-role="menu"` and `aria-role="menuitem"` for screen readers

### 4.5 Integration Points

Components that need `onContextMenu` handlers:

| Component | File | Location | Context Fields |
|-----------|------|----------|----------------|
| `BranchItem` | `src/components/branches/BranchItem.tsx` | `branch-list` | `branchName` |
| File list items | `src/blades/staging-changes/` components | `file-tree` | `filePath` |
| Commit list items | `src/components/commit/CommitHistory.tsx` | `commit-list` | `commitOid` |
| Stash entries | `src/components/stash/StashList.tsx` | `stash-list` | `stashIndex` |
| Tag entries | `src/components/tags/TagList.tsx` | `tag-list` | `tagName` |

**Phase 37 scope:** Create the registry + UI component + wire `BranchItem` as the first integration point (proves the pattern). Other integration points can be wired incrementally in subsequent phases.

---

## 5. Sidebar Panel Registry Implementation

### 5.1 Registry Design

```
NEW FILE: src/lib/sidebarPanelRegistry.ts
```

```typescript
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface SidebarPanelConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  component: ComponentType<any>;
  priority: number;        // Higher = renders higher in sidebar
  when?: () => boolean;
  defaultOpen?: boolean;
  source?: string;
  /** Optional action button in the summary (like the "+" buttons on core sections) */
  renderAction?: () => React.ReactNode;
}

export interface SidebarPanelRegistryState {
  panels: Map<string, SidebarPanelConfig>;
  visibilityTick: number;
  register: (panel: SidebarPanelConfig) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;
  refreshVisibility: () => void;
  getVisiblePanels: () => SidebarPanelConfig[];
}
```

### 5.2 Refactoring RepositoryView.tsx

**Phase 37 approach (backward compatible):**

The five hardcoded sections remain in `RepositoryView.tsx` for Phase 37. We add a dynamic rendering zone that reads from the `SidebarPanelRegistry` and renders extension-contributed panels. This is the safest approach because:

1. Core sections (Branches, Stashes, Tags, Worktrees) have complex state management (dialogs, bulk selection, etc.) that would be premature to refactor
2. Only Gitflow (Phase 40) needs to move to the registry initially
3. We can validate the pattern with a test extension panel before touching core sections

**Implementation:**

```typescript
// In RepositoryView.tsx, after the Worktrees section:
function DynamicSidebarPanels() {
  const panels = useSidebarPanelRegistry((s) => s.panels);
  const visibilityTick = useSidebarPanelRegistry((s) => s.visibilityTick);
  const repoStatus = useRepositoryStore((s) => s.repoStatus);

  const visiblePanels = useMemo(() => {
    return useSidebarPanelRegistry.getState().getVisiblePanels();
  }, [panels, visibilityTick, repoStatus]);

  return (
    <>
      {visiblePanels.map((panel) => (
        <details key={panel.id} open={panel.defaultOpen} className="border-b border-ctp-surface0">
          <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 z-10 bg-ctp-base/70 backdrop-blur-lg border-b border-ctp-surface0/50">
            <panel.icon className="w-4 h-4" />
            <span className="font-semibold text-sm flex-1">{panel.title}</span>
            {panel.renderAction?.()}
          </summary>
          <ErrorBoundary fallback={<ExtensionPanelError panelId={panel.id} />}>
            <panel.component />
          </ErrorBoundary>
        </details>
      ))}
    </>
  );
}
```

**Error boundary:** Extension-contributed panels are wrapped in `ErrorBoundary` to prevent extension crashes from breaking the sidebar.

### 5.3 Insertion Order

Extension panels render AFTER core sections, sorted by `priority` (descending). In Phase 40, when Gitflow moves to the registry, it will get `priority: 40` to maintain its position between Tags (`<details>` index 3) and Worktrees (`<details>` index 4).

**Future consideration:** In a later phase, core sections could also be registered in the SidebarPanelRegistry with high priorities (Branches: 100, Stashes: 90, Tags: 80, Worktrees: 60). This would make the entire sidebar dynamic. But this is NOT in Phase 37 scope.

---

## 6. Status Bar Implementation

### 6.1 Registry Design

```
NEW FILE: src/lib/statusBarRegistry.ts
```

```typescript
import type { ReactNode } from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type StatusBarAlignment = "left" | "right";

export interface StatusBarItem {
  id: string;
  alignment: StatusBarAlignment;
  priority: number;           // Higher = closer to respective edge
  renderCustom: () => ReactNode;
  when?: () => boolean;
  execute?: () => void | Promise<void>;  // Click handler
  tooltip?: string;
  source?: string;
}

export interface StatusBarRegistryState {
  items: Map<string, StatusBarItem>;
  visibilityTick: number;
  register: (item: StatusBarItem) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;
  refreshVisibility: () => void;
  getLeftItems: () => StatusBarItem[];
  getRightItems: () => StatusBarItem[];
}
```

### 6.2 StatusBar Component

```
NEW FILE: src/components/ui/StatusBar.tsx
```

**Layout:** Fixed height bar at the bottom of the application window. Uses flexbox with `justify-between` for left/right zones.

```typescript
export function StatusBar() {
  const items = useStatusBarRegistry((s) => s.items);
  const visibilityTick = useStatusBarRegistry((s) => s.visibilityTick);
  const repoStatus = useRepositoryStore((s) => s.repoStatus);

  const leftItems = useMemo(
    () => useStatusBarRegistry.getState().getLeftItems(),
    [items, visibilityTick, repoStatus],
  );
  const rightItems = useMemo(
    () => useStatusBarRegistry.getState().getRightItems(),
    [items, visibilityTick, repoStatus],
  );

  if (leftItems.length === 0 && rightItems.length === 0) return null;

  return (
    <footer
      role="status"
      aria-label="Status bar"
      className="flex items-center justify-between h-6 px-3 text-xs
                 bg-ctp-mantle border-t border-ctp-surface0 select-none"
    >
      <div className="flex items-center gap-2">
        {leftItems.map((item) => (
          <StatusBarWidget key={item.id} item={item} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        {rightItems.map((item) => (
          <StatusBarWidget key={item.id} item={item} />
        ))}
      </div>
    </footer>
  );
}

function StatusBarWidget({ item }: { item: StatusBarItem }) {
  const content = item.renderCustom();
  if (item.execute) {
    return (
      <button
        type="button"
        onClick={() => item.execute?.()}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded
                   text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0
                   transition-colors cursor-pointer"
        title={item.tooltip}
      >
        {content}
      </button>
    );
  }
  return (
    <span
      className="flex items-center gap-1 px-1.5 py-0.5 text-ctp-subtext0"
      title={item.tooltip}
    >
      {content}
    </span>
  );
}
```

### 6.3 Layout Integration in App.tsx

```typescript
// App.tsx - insert StatusBar between main and ToastContainer:
<div className="flex flex-col h-screen bg-ctp-base text-ctp-text font-sans">
  <Header />
  <main className="flex-1 min-h-0 overflow-hidden">
    {status ? <RepositoryView /> : <WelcomeView />}
  </main>
  <StatusBar />          {/* NEW */}
  <ToastContainer />
  <CommandPalette />
</div>
```

The `h-6` (24px) status bar is a flex child. When no items are registered (status bar returns `null`), the layout is unchanged. When items exist, `<main>` shrinks by 24px due to `flex-1 min-h-0`.

### 6.4 Tailwind v4 Styling Notes

- Background: `bg-ctp-mantle` matches header's `bg-ctp-mantle/80` (solid for status bar since it is smaller)
- Border: `border-t border-ctp-surface0` consistent with sidebar and header borders
- Text: `text-ctp-subtext0` for secondary information, `text-ctp-text` on hover
- Height: `h-6` (24px) is compact -- VS Code uses ~22px, JetBrains uses ~20px
- No custom animations needed for Phase 37; status bar is static content

---

## 7. GitHookBus Implementation

### 7.1 Where Git Operations Currently Happen

Git operations are invoked in three places:

| Location | Operations | Pattern |
|----------|-----------|---------|
| `src/stores/domain/git-ops/*.slice.ts` | commit (via useCommitExecution hook), branch CRUD, merge, stash, tags | Zustand slice calls `commands.*` from Rust bindings |
| `src/hooks/useCommitExecution.ts` | `createCommit`, `pushToRemote` | React Query `useMutation` wrapping `commands.*` |
| `src/hooks/useKeyboardShortcuts.ts` | push, pull, fetch, stage all | React Query `useMutation` wrapping `commands.*` |
| `src/commands/toolbar-actions.ts` | fetch, pull, push | Inline async in toolbar action `execute()` |
| `src/commands/sync.ts` | push, pull, fetch, stage all | `registerCommand` with inline async `action()` |

**Problem:** Git operations are scattered across 5 locations with duplicated push/pull/fetch logic (toolbar-actions.ts AND sync.ts AND useKeyboardShortcuts.ts all have their own push mutation). The GitHookBus needs to emit events from ALL these locations.

### 7.2 GitHookBus Design

```
NEW FILE: src/lib/gitHookBus.ts
```

```typescript
export type GitHookPhase = "before" | "after";

export type GitOperation =
  | "commit"
  | "push"
  | "pull"
  | "fetch"
  | "branch-create"
  | "branch-delete"
  | "branch-checkout"
  | "merge"
  | "stash-save"
  | "stash-apply"
  | "stash-pop"
  | "stash-drop"
  | "tag-create"
  | "tag-delete"
  | "stage"
  | "unstage";

export interface GitHookContext {
  operation: GitOperation;
  phase: GitHookPhase;
  branchName?: string;
  commitOid?: string;
  commitMessage?: string;
  remoteName?: string;
  tagName?: string;
  error?: string;  // Present on "after" phase when operation failed
}

type GitHookHandler = (ctx: GitHookContext) => void | Promise<void>;

class GitHookBusImpl {
  private listeners = new Map<string, Set<GitHookHandler>>();

  on(operation: GitOperation, phase: GitHookPhase, handler: GitHookHandler): () => void {
    const key = `${phase}:${operation}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(handler);
    };
  }

  async emit(
    phase: GitHookPhase,
    operation: GitOperation,
    partial?: Partial<Omit<GitHookContext, "operation" | "phase">>,
  ): Promise<void> {
    const key = `${phase}:${operation}`;
    const ctx: GitHookContext = { operation, phase, ...partial };

    const handlers = this.listeners.get(key);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        await handler(ctx);
      } catch (e) {
        console.error(`GitHookBus error [${key}]:`, e);
        // Errors in hook handlers are logged but do not interrupt the bus
      }
    }
  }

  /** Remove all listeners matching a specific source pattern (for cleanup). */
  removeAllForPrefix(prefix: string): void {
    // Not needed if ExtensionAPI tracks unsubscribe functions
    // Included for defensive programming
  }
}

export const gitHookBus = new GitHookBusImpl();
```

### 7.3 Emission Points

**Phase 37 scope:** Wire `emit()` calls into the most impactful operations. Focus on the operations that Phases 38-40 need.

**Critical emission points for Phase 37:**

| Operation | File | Emission Point |
|-----------|------|----------------|
| `commit` | `src/hooks/useCommitExecution.ts` | In `commitMutation.onSuccess` |
| `push` | `src/hooks/useCommitExecution.ts` | In `pushMutation.onSuccess` |
| `push` | `src/commands/toolbar-actions.ts` | After successful `pushToRemote` |
| `pull` | `src/commands/toolbar-actions.ts` | After successful `pullFromRemote` |
| `fetch` | `src/commands/toolbar-actions.ts` | After successful `fetchFromRemote` |
| `branch-create` | `src/stores/domain/git-ops/branches.slice.ts` | After `createBranch` success |
| `branch-delete` | `src/stores/domain/git-ops/branches.slice.ts` | After `deleteBranch` success |
| `branch-checkout` | `src/stores/domain/git-ops/branches.slice.ts` | After `checkoutBranch` success |
| `merge` | `src/stores/domain/git-ops/branches.slice.ts` | After `mergeBranch` success |

**Example emission in useCommitExecution.ts:**

```typescript
import { gitHookBus } from "../lib/gitHookBus";

const commitMutation = useMutation({
  mutationFn: ({ message, amend }: { message: string; amend: boolean }) =>
    commands.createCommit(message, amend),
  onSuccess: (_data, { message: commitMessage }) => {
    // Existing logic...
    queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    queryClient.invalidateQueries({ queryKey: ["commitHistory"] });

    // NEW: Emit git hook event
    gitHookBus.emit("after", "commit", { commitMessage });

    options?.onCommitSuccess?.(commitMessage);
  },
});
```

### 7.4 Before-Phase Hooks (Tap-Only in v1.6.0)

Per the requirements, v1.6.0 implements tap-only (read-only) hooks -- `before` hooks are notification-only and cannot cancel operations. The `onWillCommit` interceptor pattern (message modification, cancellation) is deferred to a later version. This simplifies implementation: `before` and `after` hooks have the same signature and semantics.

**Rationale from REQUIREMENTS.md:** "Intercepting git hooks (blocking) -- Tap-only (read-only) hooks in v1.6; intercepting hooks add ordering/reentrancy complexity"

### 7.5 Duplicate Operation Consolidation (Optional Follow-Up)

The push/pull/fetch operations are currently duplicated across toolbar-actions.ts, sync.ts, and useKeyboardShortcuts.ts. A follow-up task (not blocking Phase 37) could consolidate these into shared helper functions that always emit GitHookBus events. For Phase 37, we add `emit()` calls to the most critical paths (toolbar-actions.ts and useCommitExecution.ts).

---

## 8. onDispose and Lifecycle Implementation

### 8.1 Current Deactivation Pattern

The GitHub extension demonstrates the current pattern:

```typescript
// src/extensions/github/index.ts
let unsubRepoWatch: (() => void) | null = null;
let unsubGitHubWatch: (() => void) | null = null;

export function onDeactivate(): void {
  cancelGitHubPolling();
  queryClient.removeQueries({ queryKey: ["ext:github"] });
  if (unsubRepoWatch) { unsubRepoWatch(); unsubRepoWatch = null; }
  if (unsubGitHubWatch) { unsubGitHubWatch(); unsubGitHubWatch = null; }
  // ...more manual cleanup...
}
```

**Problems:**
1. Every subscription requires a module-level variable
2. Cleanup is error-prone (easy to forget an unsubscribe)
3. No way to register cleanup from within deeply nested helpers
4. Extension authors must manually coordinate `onActivate` and `onDeactivate`

### 8.2 onDispose Pattern Design

Add a `Disposable` concept to `ExtensionAPI`:

```typescript
// In ExtensionAPI.ts:
export type Disposable = { dispose: () => void } | (() => void);

export class ExtensionAPI {
  // ... existing fields ...
  private disposables: Disposable[] = [];

  /**
   * Register a cleanup callback that fires during deactivation.
   * Accepts either a function or an object with a dispose() method.
   * Returns a Disposable for manual early disposal.
   */
  onDispose(disposable: Disposable): Disposable {
    this.disposables.push(disposable);
    return {
      dispose: () => {
        const index = this.disposables.indexOf(disposable);
        if (index >= 0) {
          this.disposables.splice(index, 1);
          // Execute the disposal immediately
          if (typeof disposable === "function") {
            disposable();
          } else {
            disposable.dispose();
          }
        }
      },
    };
  }

  cleanup(): void {
    // Existing cleanup for blades, commands, toolbar...

    // NEW: Execute all disposables in reverse registration order
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      const d = this.disposables[i];
      try {
        if (typeof d === "function") {
          d();
        } else {
          d.dispose();
        }
      } catch (e) {
        console.error(`Dispose error in ext:${this.extensionId}:`, e);
      }
    }
    this.disposables = [];
  }
}
```

### 8.3 Usage Pattern in Extensions

```typescript
// In an extension's onActivate:
export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Store subscriptions are auto-cleaned
  const unsub = useRepositoryStore.subscribe((state) => { /* ... */ });
  api.onDispose(unsub);

  // Timers are auto-cleaned
  const interval = setInterval(() => { /* polling */ }, 30000);
  api.onDispose(() => clearInterval(interval));

  // Git hook subscriptions are auto-cleaned
  const unhookCommit = gitHookBus.on("commit", "after", (ctx) => { /* ... */ });
  api.onDispose(unhookCommit);

  // Event listeners are auto-cleaned
  const handler = () => { /* ... */ };
  document.addEventListener("custom-event", handler);
  api.onDispose(() => document.removeEventListener("custom-event", handler));
}

// No onDeactivate needed! All cleanup is automatic.
export function onDeactivate(): void {
  // Can still be used for non-registration cleanup (e.g., flushing data)
  // But subscriptions/timers/hooks are handled by onDispose
}
```

### 8.4 Interaction with ExtensionHost

The `cleanup()` method is already called in `ExtensionHost.deactivateExtension()` at line 284-288. Since `onDispose` disposables are executed inside `cleanup()`, no changes to `ExtensionHost` are needed. The deactivation flow becomes:

1. `ExtensionHost.deactivateExtension(id)` calls `module.onDeactivate()` (if present)
2. Then calls `api.cleanup()` which:
   - Unregisters blades, commands, toolbar actions
   - Unregisters context menus, sidebar panels, status bar items, git hooks (NEW)
   - Executes all `onDispose` disposables in reverse order (NEW)
3. Removes API and module references

---

## 9. File Change Map

### 9.1 New Files to Create

| File | Purpose | Lines (est.) |
|------|---------|-------------|
| `src/lib/contextMenuRegistry.ts` | Context menu item registry (Zustand store) | ~100 |
| `src/lib/sidebarPanelRegistry.ts` | Sidebar panel registry (Zustand store) | ~80 |
| `src/lib/statusBarRegistry.ts` | Status bar item registry (Zustand store) | ~90 |
| `src/lib/gitHookBus.ts` | Git operation event bus | ~70 |
| `src/components/ui/ContextMenu.tsx` | Context menu popover component | ~120 |
| `src/components/ui/StatusBar.tsx` | Status bar component | ~80 |

**Total new files:** 6
**Total estimated new lines:** ~540

### 9.2 Files to Modify

| File | Change Description | Risk |
|------|--------------------|------|
| `src/extensions/ExtensionAPI.ts` | Add 6 new registration methods, `onDispose()`, update `cleanup()` to cover new registries + disposables | Medium -- core API expansion |
| `src/App.tsx` | Insert `<StatusBar />` between `<main>` and `<ToastContainer />`, import StatusBar | Low -- single JSX insertion |
| `src/components/RepositoryView.tsx` | Add `<DynamicSidebarPanels />` component after the Worktrees section | Low -- additive change |
| `src/hooks/useCommitExecution.ts` | Add `gitHookBus.emit("after", "commit", ...)` in commit/push onSuccess | Low -- single line additions |
| `src/commands/toolbar-actions.ts` | Add `gitHookBus.emit()` calls after push/pull/fetch operations | Low -- single line additions |
| `src/stores/domain/git-ops/branches.slice.ts` | Add `gitHookBus.emit()` after branch create/delete/checkout/merge | Low -- single line additions |
| `src/components/branches/BranchItem.tsx` | Add `onContextMenu` handler as first integration point | Low -- additive |

**Total files modified:** 7

### 9.3 Files NOT Modified (Staying As-Is)

| File | Reason |
|------|--------|
| `src/extensions/ExtensionHost.ts` | `cleanup()` is already called during deactivation; no changes needed |
| `src/extensions/extensionTypes.ts` | Types are sufficient |
| `src/extensions/extensionManifest.ts` | Manifest types generated from Rust; no frontend changes |
| `src/extensions/github/*` | Reference extension stays as-is; will adopt `onDispose` optionally |
| `src/lib/bladeRegistry.ts` | No changes needed |
| `src/lib/commandRegistry.ts` | No changes needed |
| `src/lib/toolbarRegistry.ts` | No changes needed |

### 9.4 Files to Delete

None in Phase 37. Deletions happen in Phases 38-40 (extraction phases).

---

## 10. Risk Assessment and Mitigation

### 10.1 Risk Matrix

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| **Context menu portal clipping** | Medium | Low | Use `createPortal(menu, document.body)` to render outside component tree |
| **Status bar disrupts existing layout** | Medium | Low | Returns `null` when empty; `flex-1 min-h-0` on main already handles shrinking |
| **GitHookBus handlers slow down git ops** | High | Low | Handlers run asynchronously (fire-and-forget) and errors are caught per-handler |
| **Circular dependency from new registries** | High | Medium | Registries are in `src/lib/` with zero component imports; components import registries, never the reverse |
| **Extension cleanup race condition** | Medium | Low | `cleanup()` runs synchronously for unregistration; `onDispose` disposables execute in reverse order |
| **Sidebar panel error crashes sidebar** | High | Low | Wrap extension panels in `ErrorBoundary` |
| **Breaking change to ExtensionAPI** | High | Low | All new methods are additive; no existing method signatures change |
| **Test regression from RepositoryView change** | Medium | Medium | The change is additive (appending dynamic panels); existing sections unchanged |

### 10.2 Circular Dependency Prevention

The import graph must be strictly layered:

```
Layer 0: src/lib/*Registry.ts, src/lib/gitHookBus.ts
  - Import: zustand, lucide-react types only
  - Never import from src/components/, src/extensions/, src/stores/

Layer 1: src/extensions/ExtensionAPI.ts
  - Imports: Layer 0 registries
  - Never imports from src/components/

Layer 2: src/components/ui/StatusBar.tsx, src/components/ui/ContextMenu.tsx
  - Imports: Layer 0 registries (for reading state)
  - Never imports from src/extensions/

Layer 3: src/extensions/github/index.ts (and future extensions)
  - Imports: Layer 1 (ExtensionAPI), Layer 0 (registries for direct store access)
```

**Rule:** Registries never import React components. Components never import ExtensionAPI. Extensions import ExtensionAPI and optionally read registries directly.

### 10.3 Backward Compatibility

All Phase 37 changes are additive:

1. **ExtensionAPI:** New methods added; no existing methods changed
2. **RepositoryView:** Existing sections stay; new `DynamicSidebarPanels` appended
3. **App.tsx:** New `<StatusBar />` inserted; existing elements unchanged
4. **GitHookBus:** New emissions added to existing functions; existing behavior unchanged
5. **GitHub extension:** Continues working without changes; can optionally adopt `onDispose` later

---

## 11. Testing Strategy

### 11.1 Existing Test Landscape

```
137 existing tests (Vitest + jsdom)
```

Key test patterns from existing tests:

- `src/stores/registry.test.ts` -- Tests for `resetAllStores` / `registerStoreForReset`
- `src/stores/domain/git-ops/git-ops.test.ts` -- Store slice tests
- `src/stores/createBladeStore.test.ts` -- Blade store factory tests
- `src/stores/toast.test.ts` -- Simple Zustand store tests

### 11.2 New Tests for Phase 37

| Test File | What It Tests | Est. Tests |
|-----------|---------------|-----------|
| `src/lib/contextMenuRegistry.test.ts` | Register, unregister, unregisterBySource, getItemsForLocation with when() filtering, priority sorting | 8 |
| `src/lib/sidebarPanelRegistry.test.ts` | Register, unregister, unregisterBySource, getVisiblePanels, priority sorting | 6 |
| `src/lib/statusBarRegistry.test.ts` | Register, unregister, unregisterBySource, getLeftItems, getRightItems, priority sorting | 7 |
| `src/lib/gitHookBus.test.ts` | on/emit, unsubscribe, error isolation, async handlers | 8 |
| `src/extensions/ExtensionAPI.test.ts` | New methods delegate correctly, onDispose lifecycle, cleanup covers all registries | 10 |

**Estimated new tests:** ~39

### 11.3 Test Patterns

**Registry tests follow the existing `registry.test.ts` pattern:**

```typescript
import { create } from "zustand";
import { useContextMenuRegistry } from "./contextMenuRegistry";

describe("ContextMenuRegistry", () => {
  beforeEach(() => {
    // Reset registry between tests
    useContextMenuRegistry.setState({ items: new Map() });
  });

  it("registers and retrieves items by location", () => {
    useContextMenuRegistry.getState().register({
      id: "test-item",
      label: "Test",
      location: "branch-list",
      execute: vi.fn(),
    });

    const items = useContextMenuRegistry.getState()
      .getItemsForLocation("branch-list", { location: "branch-list", branchName: "main" });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("test-item");
  });

  it("filters by when() condition", () => {
    useContextMenuRegistry.getState().register({
      id: "conditional",
      label: "Only on develop",
      location: "branch-list",
      when: (ctx) => ctx.branchName === "develop",
      execute: vi.fn(),
    });

    const onMain = useContextMenuRegistry.getState()
      .getItemsForLocation("branch-list", { location: "branch-list", branchName: "main" });
    expect(onMain).toHaveLength(0);

    const onDevelop = useContextMenuRegistry.getState()
      .getItemsForLocation("branch-list", { location: "branch-list", branchName: "develop" });
    expect(onDevelop).toHaveLength(1);
  });
});
```

**GitHookBus tests:**

```typescript
import { gitHookBus } from "./gitHookBus";

describe("GitHookBus", () => {
  it("emits to registered listeners", async () => {
    const handler = vi.fn();
    gitHookBus.on("commit", "after", handler);

    await gitHookBus.emit("after", "commit", { commitMessage: "test" });

    expect(handler).toHaveBeenCalledWith({
      operation: "commit",
      phase: "after",
      commitMessage: "test",
    });
  });

  it("unsubscribe function removes listener", async () => {
    const handler = vi.fn();
    const unsub = gitHookBus.on("commit", "after", handler);
    unsub();

    await gitHookBus.emit("after", "commit");
    expect(handler).not.toHaveBeenCalled();
  });

  it("isolates errors in handlers", async () => {
    const errorHandler = vi.fn(() => { throw new Error("boom"); });
    const successHandler = vi.fn();

    gitHookBus.on("push", "after", errorHandler);
    gitHookBus.on("push", "after", successHandler);

    await gitHookBus.emit("after", "push");

    expect(errorHandler).toHaveBeenCalled();
    expect(successHandler).toHaveBeenCalled(); // Not blocked by error
  });
});
```

**ExtensionAPI onDispose tests:**

```typescript
import { ExtensionAPI } from "./ExtensionAPI";

describe("ExtensionAPI.onDispose", () => {
  it("executes disposables on cleanup in reverse order", () => {
    const api = new ExtensionAPI("test");
    const order: number[] = [];

    api.onDispose(() => order.push(1));
    api.onDispose(() => order.push(2));
    api.onDispose(() => order.push(3));

    api.cleanup();
    expect(order).toEqual([3, 2, 1]); // Reverse order
  });

  it("continues cleanup after disposable error", () => {
    const api = new ExtensionAPI("test");
    const fn1 = vi.fn();
    const fn2 = vi.fn(() => { throw new Error("oops"); });
    const fn3 = vi.fn();

    api.onDispose(fn3); // Will execute third (reverse: first)
    api.onDispose(fn2); // Will throw
    api.onDispose(fn1); // Will execute first (reverse: third)

    api.cleanup();
    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
    expect(fn3).toHaveBeenCalled();
  });
});
```

### 11.4 Mock Considerations

- **Zustand stores in tests:** Use the auto-reset mock from `__mocks__/zustand.ts` (already configured per project memory)
- **No Tauri mocking needed:** Phase 37 does not add new Tauri IPC calls
- **No jsdom issues:** All new code is state management and rendering logic; no DOM-specific APIs beyond standard events

---

## 12. Specific Code Patterns and Examples for FlowForge

### 12.1 Complete ContextMenuRegistry Implementation

```typescript
// src/lib/contextMenuRegistry.ts
import type { LucideIcon } from "lucide-react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type ContextMenuLocation =
  | "file-tree"
  | "branch-list"
  | "commit-list"
  | "stash-list"
  | "tag-list"
  | "diff-hunk"
  | "blade-tab";

export interface ContextMenuContext {
  location: ContextMenuLocation;
  branchName?: string;
  filePath?: string;
  commitOid?: string;
  stashIndex?: number;
  tagName?: string;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  location: ContextMenuLocation;
  group?: string;
  priority?: number;
  when?: (context: ContextMenuContext) => boolean;
  execute: (context: ContextMenuContext) => void | Promise<void>;
  source?: string;
}

export interface ContextMenuRegistryState {
  items: Map<string, ContextMenuItem>;

  // Active menu state (for rendering)
  activeMenu: {
    items: ContextMenuItem[];
    position: { x: number; y: number };
    context: ContextMenuContext;
  } | null;

  // Registry mutations
  register: (item: ContextMenuItem) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;

  // Query
  getItemsForLocation: (
    location: ContextMenuLocation,
    context: ContextMenuContext,
  ) => ContextMenuItem[];

  // Menu visibility
  showMenu: (
    position: { x: number; y: number },
    location: ContextMenuLocation,
    context: ContextMenuContext,
  ) => void;
  hideMenu: () => void;
}

export const useContextMenuRegistry = create<ContextMenuRegistryState>()(
  devtools(
    (set, get) => ({
      items: new Map<string, ContextMenuItem>(),
      activeMenu: null,

      register: (item) => {
        const next = new Map(get().items);
        next.set(item.id, item);
        set({ items: next }, false, "context-menu-registry/register");
      },

      unregister: (id) => {
        const next = new Map(get().items);
        next.delete(id);
        set({ items: next }, false, "context-menu-registry/unregister");
      },

      unregisterBySource: (source) => {
        const next = new Map(get().items);
        for (const [id, item] of next) {
          if (item.source === source) {
            next.delete(id);
          }
        }
        set({ items: next }, false, "context-menu-registry/unregisterBySource");
      },

      getItemsForLocation: (location, context) => {
        const { items } = get();
        const matching: ContextMenuItem[] = [];

        for (const item of items.values()) {
          if (item.location !== location) continue;
          if (item.when && !item.when(context)) continue;
          matching.push(item);
        }

        // Sort by group (alphabetical), then by priority (descending) within group
        matching.sort((a, b) => {
          const groupA = a.group ?? "";
          const groupB = b.group ?? "";
          if (groupA !== groupB) return groupA.localeCompare(groupB);
          return (b.priority ?? 0) - (a.priority ?? 0);
        });

        return matching;
      },

      showMenu: (position, location, context) => {
        const items = get().getItemsForLocation(location, context);
        if (items.length === 0) return;
        set(
          { activeMenu: { items, position, context } },
          false,
          "context-menu-registry/showMenu",
        );
      },

      hideMenu: () => {
        set({ activeMenu: null }, false, "context-menu-registry/hideMenu");
      },
    }),
    { name: "context-menu-registry", enabled: import.meta.env.DEV },
  ),
);
```

### 12.2 ExtensionAPI Expansion (Diff-Style)

```typescript
// src/extensions/ExtensionAPI.ts -- expanded version

export type Disposable = { dispose: () => void } | (() => void);

export class ExtensionAPI {
  private extensionId: string;
  private registeredBlades: string[] = [];
  private registeredCommands: string[] = [];
  private registeredToolbarActions: string[] = [];
  // NEW tracking arrays:
  private registeredContextMenuItems: string[] = [];
  private registeredSidebarPanels: string[] = [];
  private registeredStatusBarItems: string[] = [];
  private gitHookUnsubscribes: (() => void)[] = [];
  private disposables: Disposable[] = [];

  constructor(extensionId: string) {
    this.extensionId = extensionId;
  }

  // ... existing registerBlade, registerCommand, contributeToolbar (unchanged) ...

  // === NEW METHODS ===

  /**
   * Contribute a context menu item.
   * The item ID becomes `ext:{extensionId}:{config.id}`.
   */
  contributeContextMenu(config: ExtensionContextMenuConfig): void {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    useContextMenuRegistry.getState().register({
      ...config,
      id: namespacedId,
      source: `ext:${this.extensionId}`,
    });
    this.registeredContextMenuItems.push(namespacedId);
  }

  /**
   * Contribute a sidebar panel section.
   * The panel ID becomes `ext:{extensionId}:{config.id}`.
   */
  contributeSidebarPanel(config: ExtensionSidebarPanelConfig): void {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    useSidebarPanelRegistry.getState().register({
      ...config,
      id: namespacedId,
      source: `ext:${this.extensionId}`,
    });
    this.registeredSidebarPanels.push(namespacedId);
  }

  /**
   * Contribute a status bar widget.
   * The item ID becomes `ext:{extensionId}:{config.id}`.
   */
  contributeStatusBar(config: ExtensionStatusBarConfig): void {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    useStatusBarRegistry.getState().register({
      ...config,
      id: namespacedId,
      source: `ext:${this.extensionId}`,
    });
    this.registeredStatusBarItems.push(namespacedId);
  }

  /**
   * Subscribe to a git operation event.
   * The subscription is automatically cleaned up on deactivation.
   */
  registerGitHook(config: ExtensionGitHookConfig): void {
    const unsub = gitHookBus.on(config.operation, config.phase, config.handler);
    this.gitHookUnsubscribes.push(unsub);
  }

  /**
   * Register a cleanup callback that fires during deactivation.
   * Accepts a function or an object with a dispose() method.
   */
  onDispose(disposable: Disposable): void {
    this.disposables.push(disposable);
  }

  cleanup(): void {
    // Existing cleanup
    for (const type of this.registeredBlades) {
      unregisterBlade(type);
    }
    for (const id of this.registeredCommands) {
      unregisterCommand(id);
    }
    useToolbarRegistry.getState().unregisterBySource(`ext:${this.extensionId}`);

    // NEW cleanup
    useContextMenuRegistry.getState().unregisterBySource(`ext:${this.extensionId}`);
    useSidebarPanelRegistry.getState().unregisterBySource(`ext:${this.extensionId}`);
    useStatusBarRegistry.getState().unregisterBySource(`ext:${this.extensionId}`);

    for (const unsub of this.gitHookUnsubscribes) {
      unsub();
    }

    // Execute disposables in reverse order
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      const d = this.disposables[i];
      try {
        if (typeof d === "function") {
          d();
        } else {
          d.dispose();
        }
      } catch (e) {
        console.error(`Dispose error in ext:${this.extensionId}:`, e);
      }
    }

    // Reset all tracking arrays
    this.registeredBlades = [];
    this.registeredCommands = [];
    this.registeredToolbarActions = [];
    this.registeredContextMenuItems = [];
    this.registeredSidebarPanels = [];
    this.registeredStatusBarItems = [];
    this.gitHookUnsubscribes = [];
    this.disposables = [];
  }
}
```

### 12.3 Config Types for New Extension Methods

```typescript
// Add to src/extensions/ExtensionAPI.ts (config interfaces)

export interface ExtensionContextMenuConfig {
  id: string;
  label: string;
  icon?: LucideIcon;
  location: ContextMenuLocation;
  group?: string;
  priority?: number;
  when?: (context: ContextMenuContext) => boolean;
  execute: (context: ContextMenuContext) => void | Promise<void>;
}

export interface ExtensionSidebarPanelConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  component: ComponentType<any>;
  priority: number;
  when?: () => boolean;
  defaultOpen?: boolean;
  renderAction?: () => ReactNode;
}

export interface ExtensionStatusBarConfig {
  id: string;
  alignment: StatusBarAlignment;
  priority: number;
  renderCustom: () => ReactNode;
  when?: () => boolean;
  execute?: () => void | Promise<void>;
  tooltip?: string;
}

export interface ExtensionGitHookConfig {
  operation: GitOperation;
  phase: GitHookPhase;
  handler: (context: GitHookContext) => void | Promise<void>;
}
```

### 12.4 BranchItem Context Menu Integration

```typescript
// In src/components/branches/BranchItem.tsx
// Add to the root <div>:

import { useContextMenuRegistry } from "../../lib/contextMenuRegistry";

export function BranchItem({ branch, ...props }: BranchItemProps) {
  // ... existing code ...

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    useContextMenuRegistry.getState().showMenu(
      { x: e.clientX, y: e.clientY },
      "branch-list",
      { location: "branch-list", branchName: branch.name },
    );
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      className={cn(/* existing classes */)}
    >
      {/* existing content unchanged */}
    </div>
  );
}
```

### 12.5 ContextMenu Component (Portal-Based)

```typescript
// src/components/ui/ContextMenu.tsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useContextMenuRegistry, type ContextMenuItem } from "../../lib/contextMenuRegistry";

export function ContextMenuPortal() {
  const activeMenu = useContextMenuRegistry((s) => s.activeMenu);
  const hideMenu = useContextMenuRegistry((s) => s.hideMenu);

  if (!activeMenu) return null;

  return createPortal(
    <ContextMenuOverlay
      items={activeMenu.items}
      position={activeMenu.position}
      context={activeMenu.context}
      onClose={hideMenu}
    />,
    document.body,
  );
}

function ContextMenuOverlay({
  items,
  position,
  context,
  onClose,
}: {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  context: import("../../lib/contextMenuRegistry").ContextMenuContext;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const style = {
    top: `${Math.min(position.y, window.innerHeight - 200)}px`,
    left: `${Math.min(position.x, window.innerWidth - 200)}px`,
  };

  // Group items by group property, with separators between groups
  const groups = new Map<string, ContextMenuItem[]>();
  for (const item of items) {
    const group = item.group ?? "__default__";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(item);
  }

  return (
    <div
      className="fixed inset-0 z-[100]"
      aria-hidden="true"
    >
      <div
        ref={menuRef}
        role="menu"
        className="fixed min-w-48 py-1 bg-ctp-mantle border border-ctp-surface0
                   rounded-lg shadow-xl shadow-black/20 z-[101]"
        style={style}
      >
        {Array.from(groups.entries()).map(([group, groupItems], groupIdx) => (
          <div key={group}>
            {groupIdx > 0 && (
              <div className="my-1 border-t border-ctp-surface0" />
            )}
            {groupItems.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.execute(context);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm
                           text-ctp-text hover:bg-ctp-surface0 transition-colors
                           text-left"
              >
                {item.icon && <item.icon className="w-4 h-4 text-ctp-overlay1" />}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 12.6 GitHookBus Emission in branches.slice.ts

```typescript
// In src/stores/domain/git-ops/branches.slice.ts
// Add import at top:
import { gitHookBus } from "../../../lib/gitHookBus";

// In createBranch:
createBranch: async (name, checkout) => {
  set({ branchIsLoading: true, branchError: null }, undefined, "gitOps:branch/create");
  const result = await commands.createBranch(name, checkout);
  if (result.status === "ok") {
    await get().loadBranches();
    gitHookBus.emit("after", "branch-create", { branchName: name }); // NEW
    return result.data;
  }
  // ...
},

// In checkoutBranch:
checkoutBranch: async (name) => {
  set({ branchIsLoading: true, branchError: null }, undefined, "gitOps:branch/checkout");
  const result = await commands.checkoutBranch(name);
  if (result.status === "ok") {
    await get().loadBranches();
    gitHookBus.emit("after", "branch-checkout", { branchName: name }); // NEW
    return true;
  }
  // ...
},

// In deleteBranch:
deleteBranch: async (name, force) => {
  set({ branchIsLoading: true, branchError: null }, undefined, "gitOps:branch/delete");
  const result = await commands.deleteBranch(name, force);
  if (result.status === "ok") {
    await get().loadBranches();
    gitHookBus.emit("after", "branch-delete", { branchName: name }); // NEW
    return true;
  }
  // ...
},

// In mergeBranch:
mergeBranch: async (sourceBranch) => {
  set({ branchIsLoading: true, branchError: null, branchMergeInProgress: true }, undefined, "gitOps:branch/merge");
  const result = await commands.mergeBranch(sourceBranch);
  if (result.status === "ok") {
    // ... existing success handling ...
    await get().loadBranches();
    gitHookBus.emit("after", "merge", { branchName: sourceBranch }); // NEW
    return result.data;
  }
  // ...
},
```

### 12.7 Plan Allocation

**Plan 37-01 (New Registries):**
- Create `src/lib/contextMenuRegistry.ts`
- Create `src/lib/sidebarPanelRegistry.ts`
- Create `src/lib/statusBarRegistry.ts`
- Create `src/lib/gitHookBus.ts`
- Tests for all four

**Plan 37-02 (UI Surfaces):**
- Create `src/components/ui/ContextMenu.tsx` + `ContextMenuPortal`
- Add `<ContextMenuPortal />` to `App.tsx`
- Create `src/components/ui/StatusBar.tsx`
- Add `<StatusBar />` to `App.tsx`
- Create `DynamicSidebarPanels` in `RepositoryView.tsx`
- Wire `onContextMenu` to `BranchItem.tsx` as proof of concept
- Wire `gitHookBus.emit()` into branches.slice.ts, useCommitExecution.ts, toolbar-actions.ts

**Plan 37-03 (ExtensionAPI Expansion + onDispose):**
- Expand `ExtensionAPI.ts` with 6 new methods + `onDispose()` + updated `cleanup()`
- Add config type interfaces
- Update `src/extensions/index.ts` exports
- Tests for ExtensionAPI new methods and onDispose lifecycle
- Verify GitHub extension still works unchanged

---

*Research completed: 2026-02-10*
*Ready for plan authoring: 37-01-PLAN.md, 37-02-PLAN.md, 37-03-PLAN.md*
