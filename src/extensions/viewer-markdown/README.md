# Markdown Viewer

Renders Markdown files with full formatting, syntax-highlighted code blocks, and live preview. Registers as a content viewer blade that opens when `.md` files are selected in the file tree.

## File Structure

```
viewer-markdown/
├── README.md
├── manifest.json
├── index.ts                        # Entry point (onActivate / onDeactivate)
└── blades/
    ├── ViewerMarkdownBlade.tsx     # Rendered markdown display
    └── ViewerMarkdownBlade.test.tsx
```

## Blades

| Type | Title | Singleton | Description |
|------|-------|-----------|-------------|
| `viewer-markdown` | Markdown | No | Rendered markdown with syntax-highlighted code blocks |

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
