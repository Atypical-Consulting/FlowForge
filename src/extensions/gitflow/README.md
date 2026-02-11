# Gitflow

Provides Gitflow workflow management with a visual cheatsheet blade, a sidebar panel for quick actions, and dialogs for initializing, starting, and finishing Gitflow branches (feature, release, hotfix).

## File Structure

```
gitflow/
├── README.md
├── manifest.json
├── index.ts                        # Entry point (onActivate / onDeactivate)
├── blades/
│   ├── GitflowCheatsheetBlade.tsx  # Gitflow workflow guide blade
│   └── GitflowCheatsheetBlade.test.tsx
└── components/
    ├── FinishFlowDialog.tsx
    ├── GitflowActionCards.tsx
    ├── GitflowBranchReference.tsx
    ├── GitflowDiagram.tsx
    ├── GitflowPanel.tsx            # Sidebar panel component
    ├── InitGitflowDialog.tsx
    ├── ReviewChecklist.tsx
    ├── StartFlowDialog.tsx
    └── index.ts
```

## Blades

| Type | Title | Singleton | Description |
|------|-------|-----------|-------------|
| `gitflow-cheatsheet` | Gitflow Guide | Yes | Visual reference for the Gitflow branching model with diagrams |

## Commands

| ID | Title | Category | Description |
|----|-------|----------|-------------|
| `open-gitflow-cheatsheet` | Gitflow Cheatsheet | Navigation | Opens the Gitflow workflow guide |

## Toolbar Actions

| ID | Label | Group | Priority |
|----|-------|-------|----------|
| `gitflow-guide` | Gitflow Guide | views | 50 |

## Sidebar Panels

| ID | Title | Default Open |
|----|-------|-------------|
| `gitflow-panel` | Gitflow | No |

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
