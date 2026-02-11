# Code Viewer

Displays source code files with syntax highlighting using Monaco Editor. Registers as a content viewer blade that opens when source files are selected in the file tree. Supports read-only viewing with full Monaco features including search, folding, and minimap.

## File Structure

```
viewer-code/
├── README.md
├── manifest.json
├── index.ts                    # Entry point (onActivate / onDeactivate)
└── blades/
    ├── ViewerCodeBlade.tsx     # Monaco editor in read-only mode
    └── ViewerCodeBlade.test.tsx
```

## Blades

| Type | Title | Singleton | Description |
|------|-------|-----------|-------------|
| `viewer-code` | Code | No | Read-only Monaco editor with syntax highlighting |

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
