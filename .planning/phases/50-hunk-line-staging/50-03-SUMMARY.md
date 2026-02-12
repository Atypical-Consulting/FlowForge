---
phase: 50-hunk-line-staging
plan: 03
status: complete
---

# Plan 50-03 Summary: Frontend Line Staging and Partial-Stage Indicators

## What was done

### Task 1: Line selection and staging in StagingDiffEditor

**Created `src/core/blades/diff/hooks/useLineStaging.ts`:**
- Hook managing line selection state with `Set<number>` for selected line numbers
- `toggleLine(lineNumber)` for single-click glyph margin selection
- `selectRange(toLine)` for Shift+click range selection from last clicked line
- `clearSelection()` to reset selection state
- `stageSelectedLines()` dispatches stage or unstage based on the `staged` prop
- Uses `findHunkForLine` to determine which hunk contains the selection
- Converts selected lines to contiguous `LineRange[]` using `linesToRanges`
- Calls `commands.stageLines` or `commands.unstageLines` Tauri commands
- Clears selection and invalidates queries on success

**Enhanced `src/core/blades/diff/components/StagingDiffEditor.tsx`:**
- Added optional `lineSelection` prop with the full selection interface
- Added per-line glyph margin decorations: `line-stage-checkbox` for unselected changed lines, `line-stage-checkbox-checked` for selected lines
- Added `line-selected-for-staging` CSS class for whole-line background highlight on selected lines
- Enhanced glyph margin click handler: changed lines get line toggle/range behavior, non-changed lines fall back to hunk toggle
- Shift+click on glyph margin triggers range selection
- Dynamic ViewZone button labels: "Stage Hunk" changes to "Stage N Lines" when lines in that hunk are selected, with blue color for line actions
- Keyboard shortcuts registered via `editor.addAction()`:
  - `]` — Navigate to next hunk
  - `[` — Navigate to previous hunk
  - `Ctrl+Shift+S` / `Cmd+Shift+S` — Stage selected lines (or hunk at cursor if no selection)
  - `Ctrl+Shift+U` / `Cmd+Shift+U` — Unstage selected lines (or hunk at cursor)
  - `Escape` — Clear line selection
- Screen reader announcements updated for line staging actions

**Enhanced `src/core/blades/diff/DiffBlade.tsx`:**
- Added `useLineStaging` hook call alongside existing `useHunkStaging`
- Passes `lineStagingResult` through `stagingSource.lineSelection` to DiffContent

**Enhanced `src/core/blades/diff/components/DiffContent.tsx`:**
- Extended `StagingSource` interface with optional `lineSelection` property
- Passes `lineSelection` through to `StagingDiffEditor`

**Added CSS to `src/index.css`:**
- `.line-stage-checkbox` — 12x12px border-only glyph with cursor pointer, hover turns blue
- `.line-stage-checkbox-checked` — Blue filled glyph for selected lines
- `.line-stage-selected` — Blue filled glyph (alias)
- `.line-selected-for-staging` — Blue tinted whole-line background highlight

### Task 2: Partial-stage indicator in FileItem and StagingPanel

**Enhanced `src/core/blades/staging-changes/components/FileItem.tsx`:**
- Added `isPartiallyStaged?: boolean` prop
- Renders a yellow half-filled circle SVG indicator when `isPartiallyStaged` is true
- Positioned at top-left of the file icon area (`absolute -top-0.5 -left-0.5`)
- SVG uses a circle outline + half-arc path filled with `text-ctp-yellow`
- Includes `title="Partially staged"` and `aria-label="File is partially staged"`

**Enhanced `src/core/blades/staging-changes/components/StagingPanel.tsx`:**
- Computes `partiallyStagedPaths` via `useMemo`: intersection of staged and unstaged file paths
- Passes `partiallyStagedPaths` to all `FileTreeView` and `FileList` components

**Enhanced `src/core/blades/staging-changes/components/FileTreeView.tsx`:**
- Added `partiallyStagedPaths?: Set<string>` to `FileTreeViewProps` and `TreeNodeProps`
- Passes `isPartiallyStaged={partiallyStagedPaths?.has(file.path)}` to leaf `FileItem` nodes

**Enhanced `src/core/blades/staging-changes/components/FileList.tsx`:**
- Added `partiallyStagedPaths?: Set<string>` to `FileListProps`
- Passes `isPartiallyStaged={partiallyStagedPaths?.has(file.path)}` to `FileItem`

## Verification

- `npx tsc --noEmit` passes cleanly
- `npx vitest run` — 295 tests pass, 3 test suites fail due to pre-existing Monaco `document.queryCommandSupported` environment issue (not related to this change)

## Files modified

| File | Change |
|------|--------|
| `src/core/blades/diff/hooks/useLineStaging.ts` | **New** — Line selection state and staging mutations hook |
| `src/core/blades/diff/components/StagingDiffEditor.tsx` | Enhanced with line selection decorations, keyboard shortcuts, dynamic button labels |
| `src/core/blades/diff/DiffBlade.tsx` | Integrates useLineStaging and passes to DiffContent |
| `src/core/blades/diff/components/DiffContent.tsx` | Extended StagingSource interface with lineSelection |
| `src/core/blades/staging-changes/components/FileItem.tsx` | Added isPartiallyStaged prop and yellow half-circle indicator |
| `src/core/blades/staging-changes/components/StagingPanel.tsx` | Computes partiallyStagedPaths and passes to child components |
| `src/core/blades/staging-changes/components/FileTreeView.tsx` | Passes partiallyStagedPaths through tree to FileItem |
| `src/core/blades/staging-changes/components/FileList.tsx` | Passes partiallyStagedPaths to FileItem |
| `src/index.css` | Line selection CSS classes for Monaco glyph margin decorations |
