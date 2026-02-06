---
phase: 14-ui-polish
plan: 04
status: complete
started: 2026-02-06
completed: 2026-02-06
gap_closure: true

key-files:
  modified:
    - src/components/RepositoryView.tsx
    - src/components/layout/ResizablePanelLayout.tsx
    - src/components/ui/ShortcutTooltip.tsx

commits:
  - hash: 4ce4ac8
    message: "fix(14-04): fix sidebar scroll structure for visible frosted glass blur"
  - hash: 8211963
    message: "fix(14-04): add viewport detection and lighten tooltip styling"
---

# Summary: Gap Closure — Frosted Glass & Tooltip Fixes

## What was built

Closed two UAT gaps from Phase 14 verification:

1. **Frosted glass blur fix** — Removed per-section `max-h-XX overflow-y-auto` wrapper divs from 4 sidebar sections (Branches, Stashes, Tags, Worktrees). All content now scrolls in the single outer `overflow-y-auto` container, flowing behind sticky headers where `backdrop-blur-lg` renders the frosted glass effect. Changed Panel's `overflow-hidden` to `overflow-clip` to prevent clipping of `backdrop-filter` rendering.

2. **Tooltip viewport detection & restyle** — Added `getBoundingClientRect` measurement with horizontal nudge (`nudgeX` state) to prevent tooltips from overflowing right/left viewport edges. Lightened visual styling: semi-transparent `bg-ctp-mantle/95` with `backdrop-blur-sm`, subtle `border-ctp-surface0/30`. Flattened kbd elements by removing 3D border/shadow. Simplified framer-motion animation to opacity-only to avoid transform conflicts with the nudge offset.

## Deliverables

- Sidebar sections scroll as single continuous list with visible frosted glass blur on all 5 sticky headers
- ShortcutTooltip auto-detects viewport boundaries and shifts horizontally to stay on screen
- Lightweight tooltip styling consistent with Catppuccin aesthetic
- Flat kbd badges without 3D shadow effect

## Deviations

None.

## Self-Check: PASSED

- [x] All tasks executed (2/2)
- [x] Each task committed individually
- [x] Human checkpoint passed
- [x] No TypeScript errors introduced
- [x] No regressions in sidebar layout or panel resizing
