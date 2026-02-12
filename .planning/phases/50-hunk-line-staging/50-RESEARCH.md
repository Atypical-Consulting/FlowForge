# Phase 50 Research: Hunk & Line Staging

**Researched:** 2026-02-12
**Method:** Three-angle parallel research (UX specialist, technical architect, expert developer)
**Confidence:** HIGH (codebase analysis, git2 APIs, competitive analysis) / MEDIUM (Monaco gutter widget interactivity)

---

## Executive Summary

Phase 50 adds `git add -p` equivalent functionality to FlowForge's diff viewer. Users will stage/unstage individual hunks and lines directly from the DiffBlade gutter, with immediate reflection in the staging panel.

### Key Decisions (Cross-Researcher Consensus)

| Decision | Rationale |
|----------|-----------|
| **Core feature, NOT extension** | Hunk staging modifies staging.rs + diff.rs directly; it's fundamental Git functionality |
| **Enhance DiffBlade, no new blade** | `DiffSource.mode === "staging"` already signals when to enable staging controls |
| **No new Zustand store** | Staging operations are atomic fire-and-forget; react-query mutations + component-local state suffice |
| **Server-confirmed state, no optimistic updates** | ~100ms round-trip is fast enough; optimistic diff state risks misleading users |
| **Serial staging execution with button disable** | Prevents hunk index shift bugs from concurrent operations |
| **Immediate query invalidation** | Invalidate `stagingStatus` + `fileDiff` after each operation for sub-200ms refresh |

### Approach Divergences Resolved

| Topic | Architect View | Dev View | Resolution |
|-------|---------------|----------|------------|
| Hunk staging backend | `Index::add_frombuffer()` (manual) | `Repository::apply()` + `hunk_callback` | **Use `apply()` for hunks** (idiomatic, libgit2 handles edge cases) |
| Line staging backend | Manual content construction | Manual content construction | **`index.add_frombuffer()`** for lines (apply() is hunk-granularity only) |
| Line selection UX | Selection-based (UX) vs checkboxes (Arch/Dev) | Glyph margin checkboxes | **Hybrid: glyph margin click + shift-click range** (best of both) |

---

## 1. Competitive Analysis Summary

| Feature | Sublime Merge | VS Code | GitKraken | Fork | Tower | **FlowForge (target)** |
|---------|---------------|---------|-----------|------|-------|------------------------|
| Hunk staging | Hover button | Gutter click | Card button | Header checkbox | Header button | **Gutter button + ViewZone** |
| Line staging | Selection + button | Selection + context menu | Right-click only | Per-line checkbox | Line number click | **Glyph margin click + range** |
| Keyboard hunk nav | Tab/Shift+Tab | Alt+F5 | None | None | None | **[/] bracket keys** |
| Partial stage indicator | None | File label | None | Tri-state checkbox | Tri-state checkbox | **Tri-state icon** |

### Top UX Takeaways
1. **Hover-reveal hunk action bars** (Sublime Merge pattern) — keeps diff clean, reveals on intent
2. **Selection-based line staging** (Tower pattern) — avoids checkbox clutter, click line numbers
3. **Tri-state staging indicator** (Fork/Tower pattern) — at-a-glance partial staging state in file list
4. **Keyboard-first hunk navigation** with `[`/`]` bracket keys
5. **Dynamic button labels** — "Stage Hunk" becomes "Stage N Lines" when lines selected

---

## 2. Architecture Design

### 2.1 Component Architecture

```
DiffBlade (ENHANCED)
  |-- DiffToolbar (ENHANCED: stage all hunks button in staging mode)
  |-- DiffContent (ENHANCED: conditional StagingDiffEditor)
  |   |-- StagingDiffEditor (NEW: Monaco DiffEditor + ViewZones + glyph decorations)
  |   |   |-- ViewZone hunk action bars (Stage Hunk / Unstage Hunk)
  |   |   |-- Glyph margin line staging indicators + click handler
  |-- StagingDiffNavigation (existing, unchanged)

New files:
  src/core/blades/diff/
    components/StagingDiffEditor.tsx     (NEW)
    hooks/useHunkStaging.ts              (NEW)
    lib/diffUtils.ts                     (NEW)
  src/core/blades/staging-changes/
    hooks/useStagingActions.ts           (NEW - extract shared mutations)
```

### 2.2 Data Flow

```
                         Rust Backend                    Frontend
                         -----------                    --------
get_file_diff(path)  --> FileDiff { hunks[] }       --> useDiffQuery()
get_file_diff_hunks(path) --> DiffHunkDetail[]      --> useHunkDetailQuery()
                                                         |
stage_hunks(path, indices) <--- user clicks hunk    <--- StagingDiffEditor
  |                                                      |
  |- repo.apply(diff, Index, hunk_callback)              |- invalidate stagingStatus
  |- returns OK                                          |- invalidate fileDiff
                                                         |- staging panel auto-refreshes
```

### 2.3 State Management

```
+-------------------+------------------+------------------+
| Git Index (Rust)  | React-Query      | Component State  |
| Source of truth   | Cache layer      | UI-only          |
+-------------------+------------------+------------------+
| staged content    | stagingStatus    | selectedLines    |
| workdir content   | fileDiff         | isStaging        |
| hunk data         | fileDiffHunks    | activeHunkIndex  |
+-------------------+------------------+------------------+
```

No Zustand store needed. All staging operations are atomic mutations.

---

## 3. Rust Backend Implementation

### 3.1 New Types

```rust
// DiffLine, DiffLineOrigin, DiffHunkDetail -- enriched diff data for line-level UI
// LineRange { start: u32, end: u32 } -- for line staging operations
```

### 3.2 New Commands

| Command | Approach | Notes |
|---------|----------|-------|
| `stage_hunks(path, hunk_indices)` | `repo.apply(diff, Index, hunk_callback)` | Filter hunks via callback |
| `unstage_hunks(path, hunk_indices)` | Reverse: diff HEAD->index, manual content | Apply inverse of selected hunks |
| `stage_lines(path, line_ranges)` | Manual: `index.add_frombuffer(computed)` | Build content with selected lines |
| `unstage_lines(path, line_ranges)` | Manual: `index.add_frombuffer(computed)` | Remove selected lines from index |
| `get_file_diff_hunks(path, staged)` | `diff.foreach()` with line callback | Returns `Vec<DiffHunkDetail>` |

### 3.3 Refactoring Targets (Rust)

- **Extract `extract_hunks()` helper** from duplicated `diff.foreach` patterns in `diff.rs`
- **Extract `with_repo()` helper** to reduce boilerplate in `staging.rs`
- **Add error variants**: `HunkIndexOutOfRange`, `LineRangeInvalid`, `BinaryFileUnsupported`

### 3.4 Key Insight: DiffHunk Data Already Available

The Rust backend already returns `hunks: Vec<DiffHunk>` in `FileDiff`, but **the frontend ignores it**. These hunks contain `newStart`, `newLines` — exactly what's needed for Monaco decoration placement. The new `get_file_diff_hunks` command adds per-line detail on top.

---

## 4. Monaco Editor Integration

### 4.1 Hunk-Level Controls: ViewZones

ViewZones inject DOM elements between editor lines — perfect for hunk action bars:

```typescript
modifiedEditor.changeViewZones((accessor) => {
  accessor.addZone({
    afterLineNumber: hunk.newStart - 1,
    heightInPx: 28,
    domNode: createHunkActionBar(hunk),
  });
});
```

### 4.2 Line-Level Controls: Glyph Margin + Click Handler

```typescript
// Glyph margin CSS decorations for staging indicators
editor.createDecorationsCollection([{
  range: new monaco.Range(line, 1, line, 1),
  options: { glyphMarginClassName: 'line-stage-glyph' },
}]);

// Click handler for glyph margin
editor.onMouseDown((e) => {
  if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
    toggleLineSelection(e.target.position?.lineNumber);
  }
});
```

### 4.3 Performance Mitigations

| Concern | Mitigation |
|---------|------------|
| Many ViewZones (100+ hunks) | Only create for visible viewport; manage with `onDidScrollChange` |
| Decoration re-creation | `createDecorationsCollection()` diffs efficiently |
| Large files (10K+ lines) | Glyph margin decorations are CSS-only, no DOM per line |
| Diff re-parsing | Cache parsed hunks; re-parse only on data change |

---

## 5. UX Design Decisions

### 5.1 Gutter Visual States

| State | Gutter Bar | Background | Color |
|-------|-----------|------------|-------|
| Unstaged addition | `bg-ctp-green/30` (semi-transparent) | `bg-ctp-green/6` | Green 30% |
| Staged addition | `bg-ctp-green` (solid) | `bg-ctp-green/15` | Green 100% |
| Unstaged deletion | `bg-ctp-red/30` | `bg-ctp-red/6` | Red 30% |
| Staged deletion | `bg-ctp-red` (solid) | `bg-ctp-red/15` | Red 100% |
| Selected (for action) | `bg-ctp-blue` | `bg-ctp-blue/20` | Blue 100% |

### 5.2 Tri-State File Indicator

| State | Icon | Color |
|-------|------|-------|
| Fully staged | Filled circle | `text-ctp-green` |
| Fully unstaged | Empty circle | `text-ctp-overlay0` |
| Partially staged | Half-filled circle | `text-ctp-yellow` |

### 5.3 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `]` / `[` | Next/previous hunk |
| `Ctrl+Shift+Enter` | Stage/unstage current hunk |
| `Ctrl+Shift+S` | Stage selected lines |
| `Ctrl+Shift+U` | Unstage selected lines |
| `Escape` | Clear selection |

### 5.4 Accessibility

- `aria-live="polite"` for staging status announcements
- Focus ring (`ring-ctp-blue ring-2`) for keyboard navigation
- All actions keyboard-accessible
- Color-independent state indicators (opacity + shape, not just color)
- `motion-safe:` prefix on all animations

---

## 6. Testing Strategy

### Rust Unit Tests (11 tests)
- `test_stage_single_hunk` / `test_stage_multi_hunk`
- `test_unstage_hunk_reverts_to_head`
- `test_stage_lines_addition_only` / `test_stage_lines_deletion_only` / `test_stage_lines_mixed`
- `test_binary_file_returns_error`
- `test_hunk_index_out_of_range`
- `test_conflicted_file_returns_error`
- `test_unborn_branch_handling`
- `test_empty_hunk_indices_is_noop`

### React Component Tests
- Hunk glyph decorations render in staging mode
- Click on glyph triggers staging mutation
- Line selection with shift-click range support
- Query invalidation after staging
- Buttons disabled during pending mutation

---

## 7. Implementation Plan Sketch

| Plan | Focus | Wave |
|------|-------|------|
| **50-01** | Rust backend: types, `extract_hunks` refactor, `get_file_diff_hunks`, `stage_hunks`, `unstage_hunks` + tests | 1 |
| **50-02** | Rust backend: `stage_lines`, `unstage_lines` + manual content construction + tests | 1 |
| **50-03** | Frontend: `useStagingActions` hook, `StagingDiffEditor`, ViewZone hunk bars, glyph margin, query invalidation | 2 |
| **50-04** | Frontend: line selection UI, keyboard shortcuts, CSS/theme, partial-stage indicator, tests | 2 |

---

## 8. File Impact Map

| File | Action |
|------|--------|
| `src-tauri/src/git/staging.rs` | MODIFY — 4 new commands + helpers |
| `src-tauri/src/git/diff.rs` | MODIFY — new types, `get_file_diff_hunks`, `extract_hunks` |
| `src-tauri/src/lib.rs` | MODIFY — register 5 new commands |
| `src/bindings.ts` | AUTO-GENERATED |
| `src/core/blades/diff/components/DiffContent.tsx` | MODIFY — conditional staging editor |
| `src/core/blades/diff/DiffBlade.tsx` | MODIFY — pass staging callbacks |
| `src/core/blades/diff/components/DiffToolbar.tsx` | MODIFY — stage all button |
| `src/core/blades/diff/components/StagingDiffEditor.tsx` | CREATE |
| `src/core/blades/diff/hooks/useHunkStaging.ts` | CREATE |
| `src/core/blades/diff/lib/diffUtils.ts` | CREATE |
| `src/core/blades/staging-changes/hooks/useStagingActions.ts` | CREATE |
| `src/core/blades/staging-changes/components/FileItem.tsx` | MODIFY — partial indicator |
| `src/index.css` | MODIFY — gutter CSS, animations |

---

## Detailed Research Documents

- [50-UX-RESEARCH.md](50-UX-RESEARCH.md) — Competitive analysis, interaction design, accessibility, Catppuccin integration
- [50-ARCH-RESEARCH.md](50-ARCH-RESEARCH.md) — Component architecture, data flow, state management, extensibility
- [50-DEV-RESEARCH.md](50-DEV-RESEARCH.md) — git2-rs APIs, Tauri commands, React implementation, testing

## RESEARCH COMPLETE

*Research synthesized from 3 parallel researcher agents*
*Phase: 50 — Hunk & Line Staging*
*Date: 2026-02-12*
