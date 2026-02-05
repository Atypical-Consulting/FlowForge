---
phase: quick-022
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/layout/ResizablePanelLayout.tsx
  - src/bindings.ts
autonomous: true

must_haves:
  truths:
    - "Resizable panel separators respond visually to drag with correct data attribute"
    - "Build passes without TypeScript errors"
  artifacts:
    - path: "src/components/layout/ResizablePanelLayout.tsx"
      provides: "Fixed ResizeHandle with correct data-separator attribute"
      contains: "data-[separator=active]"
---

# Plan 022-01: Fix Vertical Separator Stuck on Left

## Objective

Fix resizable panel separators that are stuck on the left and don't respond visually to drag operations. This is a recurrence of the issue from Quick Task 016.

## Root Cause Analysis

The `react-resizable-panels` library v4.5.9 uses `data-separator` attribute with values `"inactive"`, `"active"`, or `"hover"` for styling states. The current code uses an incorrect Tailwind selector:

**Current (incorrect):** `data-[resize-handle-active]:bg-ctp-blue`
**Correct:** `data-[separator=active]:bg-ctp-blue`

Additionally, a TypeScript build error was found in `src/bindings.ts` where `TAURI_CHANNEL` was defined both as a type alias and imported, causing a conflict.

## Tasks

### Task 1: Fix ResizeHandle data attribute selector

**File:** src/components/layout/ResizablePanelLayout.tsx

**Change:** Update the Tailwind selector from `data-[resize-handle-active]:bg-ctp-blue` to `data-[separator=active]:bg-ctp-blue`

### Task 2: Fix TAURI_CHANNEL duplicate declaration

**File:** src/bindings.ts

**Change:** Remove the incorrect type alias `export type TAURI_CHANNEL<TSend> = null` which conflicts with the imported `Channel as TAURI_CHANNEL`.

## Verification

- `npm run build` passes without TypeScript errors
- Separator has correct data attribute selector for visual feedback

## Success Criteria

- Build passes
- ResizeHandle component uses correct `data-[separator=active]` selector
