---
status: diagnosed
phase: 22-new-content-blades
source: 22-17-SUMMARY.md, 22-18-SUMMARY.md, 22-19-SUMMARY.md, 22-20-SUMMARY.md, 22-21-SUMMARY.md, 22-22-SUMMARY.md
started: 2026-02-08T10:00:00Z
updated: 2026-02-08T10:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. DiffBlade — Markdown Preview Loads Content
expected: Stage a change to a `.md` file (or view one from commit history). Open its diff. Toggle to "Preview". Rendered markdown content appears at full blade width (not blank or failed to load).
result: issue
reported: "yes but the toggle Diff Preview must be at the left of Side-by-side option"
severity: cosmetic

### 2. DiffBlade — Monaco Reappears After Preview Toggle
expected: Toggle from Preview back to Diff. Monaco diff editor reappears at full height and width immediately (no 0px collapse).
result: pass

### 3. 3D Model Viewer — Load GLB Model
expected: Open repo browser, navigate to a `.glb` file, click to open. 3D model loads and renders in a Three.js canvas (no "Failed to load 3D model" error).
result: issue
reported: "Failed to load 3D model. No errors in the console."
severity: major

### 4. 3D Model Viewer — Orbit and Zoom
expected: Drag to orbit the model. Scroll to zoom. Model responds to interaction smoothly.
result: skipped
reason: Blocked by Test 3 — model fails to load

### 5. Backspace Navigation — Global
expected: Open repo browser, navigate into a folder, then open a file (e.g., code viewer or diff). Press Backspace. Navigates back (pops blade) from any blade type, not just repo browser.
result: pass

### 6. Gitflow Cheatsheet — SVG Branch Lanes Visible
expected: Open the Gitflow cheatsheet blade (header button or GitflowPanel link). SVG diagram shows 5 branch lanes (main, develop, feature, release, hotfix) with distinct Catppuccin colors on a dark background. No big dark rectangle or invisible paths.
result: pass

### 7. Gitflow Cheatsheet — Smooth Curves and Commit Dots
expected: Branch/merge transition paths in the Gitflow SVG use smooth S-shaped curves (not sharp angles). Commit dots are visible on each lane.
result: issue
reported: "it's ugly and uncomprehensible. reading graph is confusing"
severity: major

### 8. Gitflow Cheatsheet — "You Are Here" Indicator
expected: The SVG diagram highlights the lane matching your current branch type (e.g., if on main, the main lane is brighter). Non-highlighted lanes are still visible at reduced opacity.
result: pass

### 9. Monaco Code Viewer — Full Height
expected: Open a code file from repo browser (e.g., .ts, .js). Monaco editor fills the full blade height (not 0px or collapsed).
result: pass

### 10. Breadcrumb — No Stack Duplication
expected: From a diff blade with breadcrumb, click a parent directory segment. Repo browser opens to that directory without stacking a duplicate repo-browser blade. Back-navigation is clean.
result: pass

### 11. HMR — No Registration Warnings
expected: With dev server running, make a small edit to a file and save. Console does not show "Duplicate blade registration" warnings during hot reload.
result: pass

## Summary

total: 11
passed: 7
issues: 3
pending: 0
skipped: 1

## Gaps

- truth: "Diff/Preview toggle positioned left of Side-by-side option in DiffBlade toolbar"
  status: failed
  reason: "User reported: yes but the toggle Diff Preview must be at the left of Side-by-side option"
  severity: cosmetic
  test: 1
  root_cause: "DiffBlade.tsx toolbar renders Side-by-side/Inline button (lines 200-218) before Diff/Preview toggle (lines 220-255). Need to swap these two JSX blocks."
  artifacts:
    - path: "src/components/blades/DiffBlade.tsx"
      issue: "Toolbar control order: Side-by-side button renders before Diff/Preview toggle"
  missing:
    - "Swap JSX blocks so Diff/Preview toggle renders first, then divider, then Side-by-side button"
  debug_session: ""

- truth: "3D model loads and renders with Three.js from repo browser"
  status: failed
  reason: "User reported: Failed to load 3D model. No errors in the console."
  severity: major
  test: 3
  root_cause: "GLTFLoader.parse() has unguarded JSON.parse calls (lines 426,445,449 of GLTFLoader.js) that throw synchronously — error callback never invoked. No try/catch in useEffect. Also: no cancellation flag (StrictMode race), fetchError in dependency array creates feedback loop, bufferRef declared after loadModel."
  artifacts:
    - path: "src/components/blades/Viewer3dBlade.tsx"
      issue: "Missing try/catch around loader.parse(), no disposed flag, fetchError in deps, bufferRef ordering"
  missing:
    - "Wrap loader.parse() in try/catch for synchronous exceptions"
    - "Add disposed flag to prevent stale callbacks after cleanup"
    - "Remove fetchError from Three.js effect dependency array"
    - "Add cancellation signal to loadModel effect"
    - "Move bufferRef declaration before loadModel"
  debug_session: ".planning/debug/viewer3d-silent-fail.md"

- truth: "Gitflow SVG diagram is clear, readable, and comprehensible"
  status: failed
  reason: "User reported: it's ugly and uncomprehensible. reading graph is confusing"
  severity: major
  test: 7
  root_cause: "7 compounding design problems: (1) no arrowheads on curves — direction impossible to determine, (2) main at Y=200 (middle) instead of top — contradicts every standard gitflow ref, (3) curves cross in center creating spaghetti, (4) low contrast 0.55 opacity on dark bg, (5) no version/temporal markers, (6) short-lived branches shown as full-width permanent lanes, (7) cramped center, wasted edges. Recommend redesign as narrative flow: main/develop permanent, feature/release/hotfix as short arcs branching off and merging back, with arrowheads and labels."
  artifacts:
    - path: "src/components/gitflow/GitflowDiagram.tsx"
      issue: "SVG layout, lane ordering, curve clarity, opacity, missing direction indicators"
  missing:
    - "Redesign SVG with main at top, short-lived branch arcs, arrowheads, higher opacity, version labels"
  debug_session: ".planning/debug/gitflow-svg-confusing.md"
