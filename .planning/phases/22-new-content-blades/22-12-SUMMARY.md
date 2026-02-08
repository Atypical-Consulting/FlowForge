---
phase: 22-new-content-blades
plan: 12
status: complete
gap_closure: true
---

# Plan 22-12: DiffBlade Preview Width and Monaco Height

## What Was Built
Fixed two CSS issues in DiffBlade.tsx that caused markdown preview to be width-constrained and Monaco editor to render at 0px height after toggling.

## Changes
- Removed `max-w-3xl` from markdown preview wrapper, replaced with `w-full` for full blade width
- Added `h-full overflow-hidden` to Monaco DiffEditor container for stable height on remount

## Key Files
- `src/components/blades/DiffBlade.tsx` (modified)

## Commit
- `f27a9fd fix(22-12): DiffBlade preview width and Monaco height`

## Self-Check: PASSED
- Markdown preview fills available blade width (not capped at 768px)
- Monaco container has explicit height for reliable measurement during toggle remount
