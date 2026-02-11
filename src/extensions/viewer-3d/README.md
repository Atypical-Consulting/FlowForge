# 3D Model Viewer

Renders 3D model files (.obj, .stl, .gltf) using Three.js with orbit controls, ambient and directional lighting, and a grid helper. Registers as a content viewer blade that opens when 3D files are selected in the file tree.

## File Structure

```
viewer-3d/
├── README.md
├── manifest.json
├── index.ts                    # Entry point (onActivate / onDeactivate)
└── blades/
    ├── Viewer3dBlade.tsx       # Three.js canvas with orbit controls
    └── Viewer3dBlade.test.tsx
```

## Blades

| Type | Title | Singleton | Description |
|------|-------|-----------|-------------|
| `viewer-3d` | 3D Model | No | Renders 3D model files with interactive orbit controls |

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
