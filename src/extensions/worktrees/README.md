# Worktrees

Git worktree management via a sidebar panel. Provides UI for listing, creating, switching, and deleting worktrees. Uses CustomEvent dispatching for dialog triggers to avoid tight coupling between the sidebar panel and dialog components.

## File Structure

```
worktrees/
├── README.md
├── manifest.json
├── index.tsx                       # Entry point (onActivate / onDeactivate)
└── components/
    ├── WorktreeSidebarPanel.tsx    # Main sidebar panel content
    ├── WorktreePanel.tsx           # Worktree list layout
    ├── WorktreeItem.tsx            # Single worktree row
    ├── CreateWorktreeDialog.tsx    # Create dialog with branch selection
    ├── DeleteWorktreeDialog.tsx    # Delete confirmation dialog
    └── index.ts
```

## Blades

This extension does not register any blades.

## Commands

| ID | Title | Category | Description |
|----|-------|----------|-------------|
| `create-worktree` | Create Worktree | Worktrees | Opens the create worktree dialog |
| `refresh-worktrees` | Refresh Worktrees | Worktrees | Reloads the worktree list from disk |

## Toolbar Actions

This extension does not contribute any toolbar actions.

## Sidebar Panels

| ID | Title | Default Open |
|----|-------|-------------|
| `worktree-panel` | Worktrees | No |

<details>
<summary>Extension Directory Convention</summary>

Every FlowForge extension should follow this directory structure:

```
extension-name/
├── README.md          # Extension documentation (this file)
├── manifest.json      # Extension metadata
├── index.ts           # Entry point (onActivate / onDeactivate)
├── blades/            # Blade components
├── components/        # Shared UI components
├── commands/          # Command definitions (if complex)
├── hooks/             # React hooks
├── machines/          # XState machines
├── types.ts           # Extension-specific types
└── store.ts           # Zustand stores
```

</details>
