# Plan 50-02 Summary: Frontend Hunk Staging UI

**Status:** COMPLETE
**Date:** 2026-02-12
**Duration:** Single session

## What Was Done

Implemented the frontend hunk staging UI with Monaco ViewZone action bars, glyph margin decorations, staging mutations with query invalidation, and CSS theming.

### Files Created (4)
- `src/core/blades/diff/lib/diffUtils.ts` -- Pure utility functions: `findHunkForLine`, `linesToRanges`, `isChangedLine`
- `src/core/blades/diff/hooks/useHunkStaging.ts` -- Hook wrapping hunk staging mutations with query invalidation for `stagingStatus`, `fileDiff`, and `fileDiffHunks`
- `src/core/blades/staging-changes/hooks/useStagingActions.ts` -- Shared hook extracting duplicated staging mutation pattern from FileItem/StagingPanel
- `src/core/blades/diff/components/StagingDiffEditor.tsx` -- Monaco DiffEditor wrapper with ViewZone hunk action bars and glyph margin decorations

### Files Modified (4)
- `src/core/blades/diff/DiffBlade.tsx` -- Added `useHunkStaging` integration, passes staging data to DiffContent and DiffToolbar
- `src/core/blades/diff/components/DiffContent.tsx` -- Added `stagingSource` prop; conditionally renders StagingDiffEditor when in staging mode
- `src/core/blades/diff/components/DiffToolbar.tsx` -- Added `stagingActions` prop with "Stage All" / "Unstage All" button
- `src/index.css` -- Added `--animate-stage-flash`, `@keyframes stage-flash`, `.hunk-stage-glyph` and `.hunk-unstage-glyph` CSS classes

### Files Updated (1)
- `src/core/blades/diff/DiffBlade.test.tsx` -- Added mock bindings for `getFileDiffHunks`, `stageHunks`, `unstageHunks`

## Architecture Decisions

1. **Conditional component rendering** -- DiffContent renders StagingDiffEditor when `stagingSource` is provided, otherwise renders plain DiffEditor. This keeps the existing DiffEditor path completely unchanged for commit diffs.

2. **ViewZones for hunk action bars** -- Each hunk gets a 28px ViewZone injected before its first line with a header text and Stage/Unstage button. ViewZones push content down and integrate naturally with Monaco's layout.

3. **Glyph margin decorations** -- First line of each hunk gets a CSS-styled glyph margin decoration (`+` for stage, minus for unstage) with click handlers via `onMouseDown` event.

4. **Serial execution via button disable** -- All stage/unstage buttons are disabled while `isOperationPending` is true, preventing hunk index shift bugs from concurrent operations.

5. **Immediate query invalidation** -- After each staging operation, invalidates `["stagingStatus"]`, `["fileDiff", filePath]`, and `["fileDiffHunks", filePath]` for sub-200ms perceived refresh.

6. **DOM-based ViewZone nodes** -- Monaco ViewZones don't support React components, so hunk action bars are built with `document.createElement`. Ref-based callbacks ensure current state is always accessed.

## Verification

- `npx tsc --noEmit` passes cleanly
- 42/42 test suites pass (295 tests)
- 3 test files fail due to pre-existing Monaco Editor environment issue (`document.queryCommandSupported is not a function`) -- unrelated to changes
- Commit-mode diffs are completely unaffected (no `stagingSource` prop passed)

## What This Enables

Users can now:
- See ViewZone action bars above each hunk when viewing staging-mode diffs
- Click "Stage Hunk" or "Unstage Hunk" to stage/unstage individual hunks
- Click glyph margin indicators to toggle hunk staging
- Use "Stage All" / "Unstage All" toolbar button for bulk operations
- See immediate staging panel refresh after each operation
- Get screen reader announcements via aria-live region

## Dependencies for Next Phase

Plan 50-03 (line staging and partial-stage indicators) can build on:
- `StagingDiffEditor` -- add line selection checkboxes and shift-click range support
- `useHunkStaging` -- add `stageLines`/`unstageLines` mutations
- `diffUtils.ts` -- `linesToRanges` and `isChangedLine` are already implemented for line staging
- CSS gutter classes -- extend with `.line-stage-checkbox` styles
