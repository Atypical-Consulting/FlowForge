---
phase: 37-extension-platform-foundation
plan: 02
status: complete
---

# Plan 37-02 Summary: UI Surfaces + GitHookBus Wiring

## What Was Built

Three new UI surface components that render extension-contributed data from the registries (Plan 37-01), plus GitHookBus emission points wired into 3 existing files covering 8 git operations.

### ContextMenuPortal
Portal-based context menu that renders at mouse coordinates via `createPortal(menu, document.body)`. Subscribes to `useContextMenuRegistry` for active menu state. Features grouped menu items with separators, Escape key dismissal, click-outside closing, viewport clamping to prevent off-screen rendering, and auto-focus on first menu item.

### StatusBar
Footer bar component at the app bottom (h-6) that renders left-aligned and right-aligned widgets from `useStatusBarRegistry`. Returns null when no items are registered (zero layout impact). Each widget supports clickable (button) and static (span) modes.

### DynamicSidebarPanels
Extension-contributed sidebar panels rendered after the core Worktrees section. Subscribes to `useSidebarPanelRegistry` and renders visible panels in priority order using the same `<details>/<summary>` pattern as existing sidebar sections. Each panel is wrapped in an `ExtensionPanelErrorBoundary` to isolate failures. Returns null when no panels are registered.

### BranchItem Context Menu
Right-click handler on `BranchItem` calls `showMenu()` with `"branch-list"` location and branch context, serving as the first integration point for the context menu system.

### GitHookBus Emissions
Fire-and-forget `gitHookBus.emitDid()` calls added to 8 git operations across 3 files:
- **useCommitExecution.ts**: `commit`, `push`
- **toolbar-actions.ts**: `fetch`, `pull`, `push`
- **branches.slice.ts**: `branch-create`, `branch-delete`, `checkout`, `merge`

## Key Files
### Created
- `src/components/ui/ContextMenu.tsx` — ContextMenuPortal component
- `src/components/ui/StatusBar.tsx` — StatusBar component with StatusBarWidget

### Modified
- `src/App.tsx` — Added ContextMenuPortal and StatusBar imports/JSX
- `src/components/RepositoryView.tsx` — Added DynamicSidebarPanels and ExtensionPanelErrorBoundary
- `src/components/branches/BranchItem.tsx` — Added onContextMenu handler
- `src/hooks/useCommitExecution.ts` — Added gitHookBus.emitDid for commit and push
- `src/commands/toolbar-actions.ts` — Added gitHookBus.emitDid for fetch, pull, push
- `src/stores/domain/git-ops/branches.slice.ts` — Added gitHookBus.emitDid for branch-create, branch-delete, checkout, merge

## UX Decisions

- **Accessibility**: ContextMenu uses `role="menu"` and `role="menuitem"`, StatusBar uses `role="status"` with `aria-label`, all interactive elements are buttons with proper types
- **Theme integration**: All components use Catppuccin Mocha tokens (`bg-ctp-mantle`, `border-ctp-surface0`, `text-ctp-text`, `text-ctp-subtext0`, `hover:bg-ctp-surface0`)
- **Keyboard navigation**: Escape key closes context menu, first item auto-focused on open
- **Click-outside**: Full-screen invisible overlay catches clicks outside the context menu
- **Viewport clamping**: Context menu position is clamped to stay within viewport bounds
- **Error isolation**: DynamicSidebarPanels wraps each extension panel in an error boundary; a failing panel shows a red error message instead of crashing the sidebar
- **Zero impact when empty**: StatusBar returns null, DynamicSidebarPanels returns null, ContextMenuPortal returns null — existing layout is completely unchanged until extensions register items
- **Inline ErrorBoundary**: Used a minimal class component instead of `react-error-boundary` package to avoid adding a dependency

## Self-Check: PASSED
- `npx tsc --noEmit` compiles with zero new errors
- All registry types match usage (ContextMenuItem, StatusBarItem, SidebarPanelConfig, GitHookBus)
- GitHookBus emissions cover 8 operations: commit, push, pull, fetch, branch-create, branch-delete, checkout, merge
- Existing sidebar sections unchanged (Branches, Stashes, Tags, Gitflow, Worktrees)
- StatusBar conditionally rendered only when repo is open (`{status && <StatusBar />}`)
