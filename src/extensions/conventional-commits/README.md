# Conventional Commits

Provides a structured commit composer following the [Conventional Commits](https://www.conventionalcommits.org/) specification, along with a changelog generator that parses commit history into categorized release notes.

## File Structure

```
conventional-commits/
├── README.md
├── manifest.json
├── index.ts                        # Entry point (onActivate / onDeactivate)
├── blades/
│   ├── changelog/
│   │   ├── ChangelogBlade.tsx      # Changelog generator blade
│   │   ├── ChangelogBlade.test.tsx
│   │   ├── components/             # Changelog-specific sub-components
│   │   ├── store.ts                # Changelog UI state
│   │   └── index.ts
│   └── conventional-commit/
│       ├── ConventionalCommitBlade.tsx  # Commit composer blade
│       ├── hooks/                      # Blade-local hooks (useBladeFormGuard)
│       └── index.ts
└── components/
    ├── BreakingChangeSection.tsx
    ├── CharacterProgress.tsx
    ├── CommitActionBar.tsx
    ├── CommitPreview.tsx
    ├── ConventionalCommitForm.tsx
    ├── ScopeAutocomplete.tsx
    ├── ScopeFrequencyChart.tsx
    ├── TemplateSelector.tsx
    ├── TypeSelector.tsx
    └── ValidationErrors.tsx
```

## Blades

| Type | Title | Singleton | Description |
|------|-------|-----------|-------------|
| `conventional-commit` | Conventional Commit | Yes | Structured commit message composer with type, scope, and body fields |
| `changelog` | Generate Changelog | Yes | Generates categorized changelog from conventional commit history |

## Commands

| ID | Title | Category | Description |
|----|-------|----------|-------------|
| `generate-changelog` | Generate Changelog | Repository | Opens the changelog generator blade |
| `open-conventional-commit` | Open Conventional Commit Composer | Repository | Opens the commit composer blade |

## Toolbar Actions

| ID | Label | Group | Priority |
|----|-------|-------|----------|
| `changelog` | Changelog | views | 30 |

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
