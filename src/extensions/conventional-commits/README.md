# Conventional Commits

Provides a structured commit composer following the [Conventional Commits](https://www.conventionalcommits.org/) specification, along with a changelog generator that parses commit history into categorized release notes.

## File Structure

```
conventional-commits/
├── README.md
├── manifest.json
├── index.ts                        # Entry point (onActivate / onDeactivate)
├── store.ts                        # Zustand store (commit types, scopes, validation)
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
├── components/
│   ├── BreakingChangeSection.tsx
│   ├── CharacterProgress.tsx
│   ├── CommitActionBar.tsx
│   ├── CommitPreview.tsx
│   ├── ConventionalCommitForm.tsx
│   ├── ScopeAutocomplete.tsx
│   ├── ScopeFrequencyChart.tsx
│   ├── TemplateSelector.tsx
│   ├── TypeSelector.tsx
│   └── ValidationErrors.tsx
├── hooks/
│   ├── useConventionalCommit.ts   # Form state management hook
│   └── useAmendPrefill.ts         # Amend mode with last commit pre-fill
└── lib/
    ├── conventional-utils.ts      # Parse/build conventional commit messages
    ├── conventional-utils.test.ts
    ├── commit-templates.ts        # Built-in commit templates
    └── commit-type-theme.ts       # Type-to-color/icon mapping
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

## Hooks & Stores

- **store.ts** - Zustand store managing commit type, scope, description, body, breaking change flag, validation state, and template application.
- **useConventionalCommit** - Hook providing form state, validation, and commit message building for the conventional commit composer.
- **useAmendPrefill** - Hook for amend mode that pre-fills form fields from the last commit message.
- **conventional-utils** - Parse and build conventional commit messages (type, scope, breaking, body).
- **commit-templates** - Built-in commit message templates (new feature, bug fix, refactor, etc.).
- **commit-type-theme** - Maps commit types to Catppuccin colors and Lucide icons for visual display.

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
