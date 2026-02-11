# NuGet Package Viewer

Displays NuGet package information by parsing .nupkg filenames and fetching metadata from NuGet.org. Shows package name, version, description, download count, authors, tags, and links to NuGet.org and source repository.

## File Structure

```
viewer-nupkg/
├── README.md
├── manifest.json
├── index.ts                        # Entry point (onActivate / onDeactivate)
├── blades/
│   ├── ViewerNupkgBlade.tsx       # Blade wrapper passing props to viewer
│   └── ViewerNupkgBlade.test.tsx
└── components/
    └── NugetPackageViewer.tsx      # NuGet.org metadata fetcher and display
```

## Blades

| Type | Title | Singleton | Description |
|------|-------|-----------|-------------|
| `viewer-nupkg` | Package | No | Fetches and displays NuGet package metadata |

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
