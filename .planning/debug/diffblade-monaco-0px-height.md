---
status: diagnosed
trigger: "Monaco diff editor in DiffBlade has 0px height when toggling from Preview back to Diff mode, and markdown preview doesn't take 100% width"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:01:00Z
---

## Current Focus

hypothesis: Two independent issues — Monaco container lacks explicit height propagation, and markdown preview has intentional max-width constraint
test: Traced full CSS height chain and compared with working components
expecting: Identified specific CSS classes that need modification
next_action: Return diagnosis

## Symptoms

expected: Monaco DiffEditor fills available vertical space; markdown preview takes full container width
actual: Monaco DiffEditor renders at 0px height; markdown preview is constrained to max-w-3xl
errors: None (visual layout issue)
reproduction: Toggle between Preview and Diff modes on a .md file; also observed on .tsx files
started: Unknown

## Eliminated

- hypothesis: Framer-motion AnimatePresence popLayout causes height collapse
  evidence: AnimatePresence wraps ALL blades equally, yet ViewerCodeBlade (also using Monaco) works. The animation only applies on blade transitions, not on internal showPreview toggle.
  timestamp: 2026-02-07

- hypothesis: BladeErrorBoundary or Suspense wrapper breaks flex chain
  evidence: BladeErrorBoundary renders children directly (no wrapper div) when no error. Suspense adds no DOM elements. Both affect ViewerCodeBlade equally.
  timestamp: 2026-02-07

- hypothesis: @monaco-editor/react DiffEditor behaves differently from Editor re: container sizing
  evidence: Both use identical wrapper component (Ee/H) with same default height="100%" and width="100%". Both call automaticLayout:true. Same section+div DOM structure.
  timestamp: 2026-02-07

## Evidence

- timestamp: 2026-02-07
  checked: Full CSS height chain for DiffBlade
  found: |
    The complete chain is:
    1. BladeContainer root: `flex h-full overflow-hidden` (flex-ROW)
    2. motion.div: `flex-1 min-w-0` (height from align-items:stretch)
    3. BladePanel: `flex flex-col h-full`
    4. BladePanel title bar: `h-10 shrink-0`
    5. BladePanel children wrapper: `flex-1 min-h-0 overflow-hidden` (NOT a flex container, just a block div that is a flex-item)
    6. DiffBlade root: `flex-1 flex flex-col overflow-hidden h-full`
    7. DiffBlade toolbar: `shrink-0`
    8. Monaco container: `flex-1 min-h-0` (NO h-full, NO overflow-hidden)
    9. Monaco section: inline `height:100%; width:100%; display:flex; position:relative`
  implication: Step 5 (BladePanel children wrapper) is a block div, not a flex container. Step 6's `flex-1` is MEANINGLESS (parent is not flex), but `h-full` resolves against parent's computed height. Step 8's `flex-1` works because step 6 IS flex-col. Monaco section's `height:100%` needs step 8 to have a definite height.

- timestamp: 2026-02-07
  checked: Whether `flex-1` in flex-col gives definite height for percentage children
  found: Per CSS spec, a flex item's resolved size IS definite for percentage resolution. However, Monaco editor has known issues with this pattern (GitHub issues #3393, #3512 on microsoft/monaco-editor). The `automaticLayout` uses ResizeObserver which only fires on size CHANGES, not on initial mount.
  implication: If Monaco measures the container before layout resolves, it gets 0 and ResizeObserver may not fire again if the size doesn't subsequently change.

- timestamp: 2026-02-07
  checked: DiffBlade.tsx lines 263-288 — conditional rendering pattern
  found: Uses `{showPreview && isMarkdown ? <preview> : <diff>}` which causes full unmount/remount of DiffEditor when toggling. This triggers a fresh Monaco `createDiffEditor` call each time.
  implication: Each toggle-back-to-diff is a fresh mount. Monaco re-initializes and may measure 0px during the layout transition.

- timestamp: 2026-02-07
  checked: DiffBlade.tsx line 265 — markdown preview container
  found: Inner wrapper uses `className="p-6 max-w-3xl mx-auto"`. The `max-w-3xl` = max-width: 768px.
  implication: This matches ViewerMarkdownBlade.tsx:53 pattern. It's an intentional readability constraint, but user wants full width.

- timestamp: 2026-02-07
  checked: @monaco-editor/react v4.7.0 source code
  found: Both Editor and DiffEditor render a `<section style="height:100%; width:100%; display:flex; position:relative">` wrapper. Inside is a `<div ref={containerRef} style="width:100%">` (no explicit height — relies on flex stretch). Monaco creates the editor inside this ref div via useEffect.
  implication: Monaco's container div has no explicit height. It gets height from flex stretch inside the section. The section's height:100% requires its parent (our flex-1 min-h-0 div) to have a resolved height.

## Resolution

root_cause: |
  TWO ISSUES IDENTIFIED:

  **Issue 1: Monaco DiffEditor 0px height**
  File: `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/blades/DiffBlade.tsx`
  Line: 275

  The DiffEditor container div at line 275 uses `className="flex-1 min-h-0"` without `h-full` or `overflow-hidden`. While `flex-1` in a flex-col parent should provide a definite height, Monaco editor has known issues resolving `height: 100%` against flex-computed heights, especially on fresh mount/remount.

  The container needs both `h-full` (to explicitly set `height: 100%` for Monaco's section wrapper to resolve against) and `overflow-hidden` (to prevent Monaco's internal absolutely-positioned elements from expanding the container and creating a sizing feedback loop).

  When `showPreview` toggles from true to false (lines 263-288), the DiffEditor is fully remounted via React's conditional rendering ternary. Monaco calls `createDiffEditor` in a useEffect, and if the container height isn't definitively resolved at that moment, Monaco initializes with 0px. The ResizeObserver from `automaticLayout: true` may not subsequently fire because the container size doesn't "change" — it starts and stays at the flex-computed value, but Monaco already captured 0.

  **Issue 2: Markdown preview not taking full width**
  File: `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/blades/DiffBlade.tsx`
  Line: 265

  The inner preview wrapper uses `className="p-6 max-w-3xl mx-auto"`. The `max-w-3xl` class constrains content to max-width: 768px. This is a deliberate design choice matching ViewerMarkdownBlade.tsx:53, but the user wants full width in the diff context.

fix: (not applied — diagnosis only)
verification: (not verified — diagnosis only)
files_changed: []
