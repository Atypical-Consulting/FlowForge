# Plain Text Viewer

Displays plain text files with proper loading states and binary file detection. Uses the useRepoFile hook to load file content and shared blade content components for consistent loading, error, and empty states.

## File Structure

```
viewer-plaintext/
├── README.md
├── manifest.json
├── index.ts                           # Entry point (onActivate / onDeactivate)
└── blades/
    ├── ViewerPlaintextBlade.tsx       # Text display with loading/error states
    └── ViewerPlaintextBlade.test.tsx
```

## Blades

| Type | Title | Singleton | Description |
|------|-------|-----------|-------------|
| `viewer-plaintext` | Plain Text | No | Displays plain text with monospace font |

## Commands

This extension does not register any commands.

## Toolbar Actions

This extension does not contribute any toolbar actions.

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
