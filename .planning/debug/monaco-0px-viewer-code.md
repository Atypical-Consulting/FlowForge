---
status: resolved
trigger: "Monaco editor in viewer-code blade has 0% height when opening .txt files"
created: 2026-02-08T00:00:00Z
updated: 2026-02-08T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - ViewerCodeBlade wrapper div uses flex-1 without h-full; parent is not a flex container so flex-1 is inert
test: Compared height chain of ViewerCodeBlade vs DiffBlade (which works)
expecting: DiffBlade has h-full on its wrapper; ViewerCodeBlade does not
next_action: Write findings and exact fix

## Symptoms

expected: Monaco editor fills the blade content area when viewing .txt files
actual: Monaco editor renders at 0px height
errors: none (visual bug)
reproduction: Open a .txt file from the repo browser in viewer-code blade
started: Since implementation (same class of bug fixed in DiffBlade plan 22-12)

## Eliminated

- hypothesis: Monaco automaticLayout option missing
  evidence: MONACO_COMMON_OPTIONS in monacoConfig.ts line 11 has automaticLayout:true
  timestamp: 2026-02-08

- hypothesis: BladePanel content area breaks the height chain
  evidence: BladePanel content area (line 42) is a flex child of flex-col h-full, so it receives explicit height correctly. The issue is downstream.
  timestamp: 2026-02-08

## Evidence

- timestamp: 2026-02-08
  checked: BladePanel.tsx line 42 - content wrapper classes
  found: "flex-1 min-h-0 overflow-hidden" -- NOT a flex container (no flex or flex-col class)
  implication: Any child using flex-1 will have no effect; child must use h-full or height:100% to fill this container

- timestamp: 2026-02-08
  checked: ViewerCodeBlade.tsx line 55 - Monaco wrapper div
  found: className="flex-1 min-h-0" -- uses flex-1 but parent is NOT a flex container
  implication: flex-1 is inert -> div has no explicit height -> collapses to content height -> Monaco measures 0px

- timestamp: 2026-02-08
  checked: DiffBlade.tsx line 197 - outer wrapper div
  found: className="flex-1 flex flex-col overflow-hidden h-full" -- has h-full
  implication: h-full resolves to 100% of BladePanel content area (which has explicit height) -> DiffBlade gets full height -> Monaco works

- timestamp: 2026-02-08
  checked: DiffBlade.tsx line 275 - Monaco DiffEditor wrapper
  found: className="flex-1 min-h-0 h-full overflow-hidden"
  implication: DiffBlade uses both flex-1 AND h-full as belt-and-suspenders; h-full is what actually provides height

- timestamp: 2026-02-08
  checked: BladeContainer.tsx line 31 - motion.div wrapper
  found: className="flex-1 min-w-0" -- flex child in horizontal flex; gets height via cross-axis stretch
  implication: Height chain from BladeContainer down to BladePanel content area is intact

## Resolution

root_cause: |
  ViewerCodeBlade.tsx line 55: the Monaco wrapper div has className="flex-1 min-h-0" but its
  parent (BladePanel's content area at BladePanel.tsx line 42) is NOT a flex container -- it
  only has "flex-1 min-h-0 overflow-hidden" with no "flex" or "flex-col" class.

  Because the parent is not a flex container, the child's "flex-1" property is inert (flex-grow,
  flex-shrink, flex-basis only apply to children of flex containers). The div therefore has no
  explicit height and collapses to the intrinsic content height, which for Monaco (before it
  measures its container) is 0px.

  DiffBlade avoids this by including "h-full" on its wrapper (line 197), which resolves to
  height:100% of the parent. Since BladePanel's content area has an explicit height (it's a
  flex-1 child of a sized flex-col container), h-full resolves correctly.

fix: |
  In ViewerCodeBlade.tsx line 55, change:
    <div className="flex-1 min-h-0">
  to:
    <div className="h-full overflow-hidden">

  - "h-full" gives height:100% which resolves against BladePanel's content area
  - "overflow-hidden" prevents Monaco from overflowing its container
  - "flex-1" is removed because it has no effect (parent is not flex)
  - "min-h-0" is removed because it's a flex property with no effect here

  This matches the pattern used by DiffBlade's Monaco container (line 275).

verification: |
  1. Open a .txt file from the repo browser -> Monaco should fill the blade
  2. Open files of various types (.ts, .json, .md via code viewer) -> all should render correctly
  3. Resize the window -> Monaco should resize via automaticLayout
  4. Check binary file path still shows info card correctly (not affected)

files_changed:
  - src/components/blades/ViewerCodeBlade.tsx
