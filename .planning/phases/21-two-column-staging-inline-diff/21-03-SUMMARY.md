# Plan 21-03 Summary: Integration

**Status:** Complete
**Commits:** 926cd54, 11f7c9c

## What was built

1. **StagingChangesBlade refactored** — Now renders `SplitPaneLayout` with `StagingPanel` (40% left) and `StagingDiffPreview` (60% right). Builds flat ordered file list from staging query for keyboard navigation. Manages focus state for keyboard shortcuts.

2. **StagingPanel updated** — Removed `onFileSelect` prop entirely. Selection is now fully store-driven. Added file selection reconciliation after stage/unstage (file moves between sections but stays selected). Added scroll position preservation via ref + staging store.

3. **FileItem updated** — Removed `onFileSelect` prop. `handleSelect()` only calls `selectFile()` now (no blade push). Added `scrollIntoView({ block: "nearest" })` when programmatically selected via keyboard navigation.

4. **FileTreeView/FileList updated** — Removed all `onFileSelect` prop passing. Components now rely entirely on store-driven selection via FileItem.

5. **useStagingKeyboard** (`src/hooks/useStagingKeyboard.ts`) — Arrow keys (and j/k vim-style) navigate files, Space toggles stage/unstage, Enter expands to full diff blade. Respects focus context (only active when file list is focused). `enableOnFormTags: false` prevents conflicts with search input.

## Deviations

None.

## Verification

- `npx tsc --noEmit` passes with no new errors
- No remaining `onFileSelect` references in codebase
- Two-column layout renders correctly
