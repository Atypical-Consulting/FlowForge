# Init Repository

Repository initialization wizard that guides users through creating a new Git repository with .gitignore templates, a README file, and an initial commit. Supports automatic project type detection to recommend relevant templates.

## File Structure

```
init-repo/
├── README.md
├── manifest.json
├── index.ts                        # Entry point (onActivate / onDeactivate)
├── store.ts                        # Form state (directory, templates, readme)
├── blades/
│   └── InitRepoBlade.tsx           # Main initialization blade (split pane)
├── components/
│   ├── InitRepoForm.tsx            # Left pane: form inputs
│   ├── InitRepoPreview.tsx         # Right pane: live preview
│   ├── TemplatePicker.tsx          # .gitignore template grid
│   ├── ProjectDetectionBanner.tsx  # Auto-detected project type display
│   ├── CategoryFilter.tsx          # Template category filter chips
│   ├── TemplateChips.tsx           # Selected template pills
│   └── index.ts
├── hooks/
│   └── useGitignoreTemplates.ts   # React Query hooks for template data
└── lib/
    └── gitignoreComposer.ts       # Merge multiple .gitignore templates
```

## Blades

| Type | Title | Singleton | Description |
|------|-------|-----------|-------------|
| `init-repo` | Initialize Repository | Yes | Split-pane wizard with form and live .gitignore preview |

## Commands

| ID | Title | Category | Description |
|----|-------|----------|-------------|
| `init-repository` | Initialize Repository | Repository | Opens a folder picker then launches the init wizard |

## Toolbar Actions

This extension does not contribute any toolbar actions.

## Hooks & Stores

- **store.ts** - Zustand store managing form state: selected directory, .gitignore templates, template contents, README name, and detected project types.
- **useGitignoreTemplates** - React Query hooks for fetching template lists and project type detection.
- **gitignoreComposer** - Utility to merge multiple .gitignore templates into a single deduplicated output.

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
