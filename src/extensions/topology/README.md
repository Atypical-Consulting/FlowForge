# Topology Graph

Visualize commit history as an interactive lane-based graph with branch classification and commit type icons. Provides the "topology" process tab with lane-based visualization, commit badges, and a file watcher that auto-refreshes the graph when repository files change externally.

## File Structure

```
topology/
├── README.md
├── manifest.json
├── index.ts                          # Entry point (onActivate / onDeactivate)
├── __tests__/
│   └── TopologyRootBlade.test.tsx    # Root blade unit tests
├── blades/
│   └── TopologyRootBlade.tsx         # Root blade (lazy-loaded)
├── components/
│   ├── CommitBadge.tsx               # Commit type badge
│   ├── LaneBackground.tsx            # Lane background rendering
│   ├── LaneHeader.tsx                # Lane header with branch name
│   ├── TopologyEmptyState.tsx        # Empty state placeholder
│   └── TopologyPanel.tsx             # Main topology panel
└── lib/
    └── layoutUtils.ts                # Lane layout computation utilities
```

## Blades

| Type | Title | Singleton | Lazy | Core Override |
|------|-------|-----------|------|---------------|
| `topology-graph` | Topology | Yes | Yes | Yes |

## Commands

| ID | Title | Category | Shortcut | Description |
|----|-------|----------|----------|-------------|
| `show-topology` | Show History | Navigation | `Mod+2` | Switch to the topology (history) view |

## Toolbar Actions

This extension does not contribute any toolbar actions.

## Sidebar Panels

This extension does not contribute any sidebar panels.

## Lifecycle

- **onActivate**: Registers the topology-graph blade (coreOverride), the show-topology command with keyboard shortcut, a file watcher listener for auto-refresh, and applies the defaultTab user setting.
- **onDeactivate**: No-op. Cleanup is handled by `api.cleanup()`. Topology data stays in GitOpsStore (shared core state).

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
