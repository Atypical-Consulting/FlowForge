# Image Viewer

Displays image files with base64 loading from the working tree or commit history. Registers as a content viewer blade that opens when image files are selected in the file tree. Supports PNG, JPEG, GIF, SVG, and other common image formats.

## File Structure

```
viewer-image/
├── README.md
├── manifest.json
├── index.ts                      # Entry point (onActivate / onDeactivate)
└── blades/
    ├── ViewerImageBlade.tsx      # Base64 image loader and display
    └── ViewerImageBlade.test.tsx
```

## Blades

| Type | Title | Singleton | Description |
|------|-------|-----------|-------------|
| `viewer-image` | Image | No | Loads and displays images via base64 encoding |

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
