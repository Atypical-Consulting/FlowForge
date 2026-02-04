---
phase: quick-016
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/layout/ResizablePanelLayout.tsx
autonomous: true

must_haves:
  truths:
    - "Resizable panel separators respond visually to drag"
    - "Panels resize when dragging separators"
    - "Panel sizes persist correctly with autoSaveId"
  artifacts:
    - path: "src/components/layout/ResizablePanelLayout.tsx"
      provides: "Fixed resizable panel wrapper components"
      contains: "w-full h-full"
  key_links:
    - from: "ResizablePanelLayout"
      to: "react-resizable-panels/Group"
      via: "proper dimension classes"
      pattern: "w-full h-full"
---

# Plan 016-01: Fix Resizable Panel Separators

## Objective

Fix resizable panel separators that are stuck on the left and don't respond visually to drag operations.

## Root Cause Analysis

Two issues found in `src/components/layout/ResizablePanelLayout.tsx`:

1. **Missing `w-full` on Group container (line 17):** The Group only has `className="h-full"`. For horizontal flex layouts, the container needs explicit width. Without width, the panels collapse to the left because there's no space to distribute.

2. **Wrong data attribute selector (line 55):** The class `data-resize-handle-active:bg-ctp-blue` references a non-existent attribute. react-resizable-panels uses `data-separator` with values "inactive", "active", or "hover". The correct Tailwind selector is `data-[separator=active]:bg-ctp-blue`.

## Tasks

### Task 1: Fix ResizablePanelLayout component

**Files:** src/components/layout/ResizablePanelLayout.tsx

**Changes:**

1. Add `w-full` to Group container className
2. Fix data attribute selector from `data-resize-handle-active:` to `data-[separator=active]:`

## Verification

- `npm run check` passes
- Visual test: drag separators - panels resize smoothly
- Visual test: separator turns blue during active drag
- Persistence test: resize panels, close app, reopen - sizes restored

## Success Criteria

- Resizable panel separators are draggable and panels resize accordingly
- Separator visual feedback works (hover and active states)
- No TypeScript or lint errors
