---
phase: 17-hierarchical-view-commit-enhancements
plan: 04
status: complete
started: 2026-02-07
completed: 2026-02-07
gap_closure: true
key-files:
  created: []
  modified:
    - src/components/staging/FileTreeView.tsx
    - src/components/staging/FileItem.tsx
  deleted:
    - src/components/staging/TreeIndentGuides.tsx
---

# Summary: Fix broken vertical indent guide lines in hierarchical file tree

## What was built

Replaced the broken absolute-positioned `IndentGuides` component with a **border-based tree connector system** using SVG curved connectors. The tree now renders professional-quality indent guides with:

- **Continuous vertical lines** via `border-left` on children wrapper divs — lines naturally span the full height of all children with zero gaps
- **`├──` T-connectors** for middle children (horizontal SVG line from vertical border to content)
- **`╰──` curved corners** for last children (SVG quadratic bezier curve from vertical line into horizontal branch)
- **Precise pixel alignment** with parent chevrons via calculated layout constants (`GUIDE_INDENT=15`, `BRANCH_WIDTH=9`, `ROW_CENTER=12`)

## Key decisions

1. **Border-left approach over per-row inline guides**: Per-row absolute or flex-based guides always had gaps between rows. Using `border-left` on the children container creates one continuous DOM element that naturally spans all children.
2. **SVG connectors over CSS-only**: SVG `<path>` with quadratic bezier curves provides smooth rounded corners that CSS `border-radius` alone can't achieve for this layout pattern.
3. **Deleted TreeIndentGuides.tsx**: The per-row guide component was replaced entirely by the structural border-left + SVG approach built into FileTreeView.tsx.
4. **`--catppuccin-color-surface1` variable**: Tailwind v4 + Catppuccin maps `border-ctp-surface1` to `var(--catppuccin-color-surface1)`, not `var(--ctp-surface1)`. Used a `GUIDE_COLOR` constant for inline SVG styles.
5. **Last-child margin compensation**: When `border-left: none` on last children, added `marginLeft: 1px` to compensate for the missing border width and keep content aligned with siblings.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 86999f9 | fix(17-04): border-based tree indent guides with SVG curved connectors |

## Deviations from plan

- **Plan called for TreeIndentGuides.tsx as shared component**: The per-row inline flex approach from the plan didn't produce continuous lines. Pivoted to border-left + SVG connectors built directly into FileTreeView.tsx. TreeIndentGuides.tsx was created then deleted.
- **FileItem.tsx simplified**: Instead of adding indent guides to FileItem, the tree structure itself handles indentation via nesting. FileItem was simplified to remove depth/guides/isLast props and the unused `indentStyle` variable.

## Self-Check: PASSED

- [x] Vertical indent guide lines form continuous columns from parent through all children
- [x] Folder icons and file icons at same depth align vertically
- [x] Last children have smooth curved `╰──` connectors
- [x] Middle children have `├──` T-connectors
- [x] Flat file list view has no regressions
- [x] TypeScript compiles without new errors
- [x] Frontend builds successfully
- [x] Human visual verification: approved
