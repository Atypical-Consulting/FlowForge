# Summary: 48-02 — Collapsible regions, word-level highlighting, and theme tuning

## What was built
Enabled Monaco's built-in collapsible unchanged regions and word-level diff highlighting across all diff viewers. Tuned the Catppuccin Mocha diff theme with a layered opacity strategy.

## Key files

### Modified
- `src/core/lib/monacoTheme.ts` — Layered opacity colors (word=25%, line=6%, gutter=18%) + collapsed region styling
- `src/core/blades/diff/components/DiffContent.tsx` — hideUnchangedRegions, diffAlgorithm: "advanced", responsive breakpoint
- `src/core/blades/diff/components/DiffToolbar.tsx` — Collapse toggle with FoldVertical/UnfoldVertical icons
- `src/core/blades/diff/DiffBlade.tsx` — Wired collapseUnchanged preference through toolbar and content
- `src/core/blades/staging-changes/components/InlineDiffViewer.tsx` — Matching hideUnchangedRegions + advanced algorithm

## Deviations
None. All tasks completed as planned.

## Self-Check: PASSED
- [x] Unchanged regions collapsed by default with "Show N lines" expander
- [x] Word-level diff highlighting with distinct green/red colors at 25% opacity
- [x] Collapse toggle in toolbar persists preference across sessions
- [x] InlineDiffViewer in staging panel has matching features
- [x] Narrow panels auto-switch to inline below 600px
- [x] TypeScript compiles with no new errors
- [x] All 295 existing tests pass (3 pre-existing Monaco mock failures unrelated)
