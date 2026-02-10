# Quick Task 34: Move Extension Files Into Self-Contained Directories

## What Changed

Reorganized 3 extensions (gitflow, content-viewers, conventional-commits) to follow the same self-contained pattern as the GitHub extension. All extension-specific blades and components now live inside their respective extension directories.

## Commits

1. **c3c322e** `refactor: move gitflow and content-viewers files into self-contained extension directories`
   - Moved gitflow cheatsheet blade + 8 components into `src/extensions/gitflow/`
   - Moved 3 content viewer blades into `src/extensions/content-viewers/blades/`
   - Removed old directories: `src/blades/gitflow-cheatsheet/`, `src/components/gitflow/`, `src/blades/viewer-*/`

2. **74a0b78** `refactor: move conventional-commits files into self-contained extension directory`
   - Moved CC blades (ConventionalCommitBlade + ChangelogBlade trees) into `src/extensions/conventional-commits/blades/`
   - Moved 10 CC-specific components into `src/extensions/conventional-commits/components/`
   - Core shared components (CommitForm, CommitHistory, CommitDetails, CommitSearch) remain in `src/components/commit/`
   - Removed empty barrel `src/components/commit/index.ts`

## Result

All 4 extensions now follow the self-contained pattern:

```
src/extensions/
├── github/            (blades/, components/, hooks/, store, types)
├── gitflow/           (blades/, components/, index.ts)
├── content-viewers/   (blades/, index.ts)
├── conventional-commits/ (blades/, components/, index.ts)
└── sandbox/           (sandbox infrastructure)
```

## Verification

- TypeScript: compiles cleanly (zero new errors, pre-existing TS2440 excluded)
- Tests: 233/233 pass (3 pre-existing monaco-editor test environment failures unrelated)
- No orphan imports to old file paths
- Core shared components unaffected
