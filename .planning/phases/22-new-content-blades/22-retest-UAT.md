---
status: diagnosed
phase: 22-new-content-blades
source: 22-12-SUMMARY.md, 22-13-SUMMARY.md, 22-14-SUMMARY.md, 22-15-SUMMARY.md, 22-16-SUMMARY.md
started: 2026-02-07T22:00:00Z
updated: 2026-02-07T22:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. DiffBlade — Markdown Preview Full Width
expected: Stage a change to a `.md` file, open its diff, toggle to Preview. Rendered markdown fills the full available blade width (not capped at ~768px).
result: issue
reported: "full the available space but failed to load markdown"
severity: major

### 2. DiffBlade — Monaco Reappears After Toggle
expected: Toggle from Preview back to Diff. Monaco diff editor reappears at full height and width immediately (no 0px collapse).
result: pass

### 3. 3D Model Viewer — Load GLB Model
expected: Open repo browser, navigate to a `.glb` file, click to open. 3D model loads and renders (no "Failed to load 3D model" error).
result: issue
reported: "Failed to load 3D model"
severity: major

### 4. 3D Model Viewer — Orbit and Zoom
expected: Drag to orbit the model. Scroll to zoom. Model responds to interaction. Auto-rotation stops on first drag.
result: skipped
reason: Blocked by Test 3 — model fails to load. Also noted: duplicate blade registration warnings in console.

### 5. Repo Browser — Backspace to Parent
expected: Open repo browser, navigate into a folder, press Backspace. Navigates back to parent directory.
result: issue
reported: "pass but not from the view full diff blades"
severity: minor

### 6. Gitflow Cheatsheet — Header Button
expected: In the header toolbar, a Gitflow guide button (GitBranch icon) is visible. Click it to open the Gitflow cheatsheet blade.
result: issue
reported: "pass but the blade contains a big dark rectangle. svg colors for paths does not exists"
severity: major

### 7. Gitflow Cheatsheet — GitflowPanel Link
expected: Open the Gitflow sidebar panel. A "Gitflow Guide" link is visible. Click it to open the Gitflow cheatsheet blade.
result: pass

### 8. Gitflow Cheatsheet — SVG Diagram
expected: Gitflow cheatsheet blade shows an SVG diagram with 5 branch lanes in Catppuccin colors. Current branch type is highlighted.
result: issue
reported: "problem with colors"
severity: major

### 9. Breadcrumb — Repo Browser Single Row
expected: Open repo browser, navigate into a folder. Back button and breadcrumb appear in the same single row (no separate toolbar row for breadcrumb).
result: pass

### 10. Breadcrumb — Viewer Blades
expected: Open any file from repo browser (e.g., a `.md` or code file). Blade header shows clickable breadcrumb with Home icon and path segments in the same row as back button.
result: pass

### 11. Breadcrumb — Click Ancestor Segment
expected: In any viewer blade, click a parent segment in the breadcrumb. Navigates to that directory in the repo browser.
result: pass

### 12. Breadcrumb — Diff Blade
expected: Open a diff for a file. Diff blade header shows the file path as a clickable breadcrumb (same pattern as viewer blades).
result: issue
reported: "yes but when i click on a breadcrumb item parent then on a folder, the folder explorer blade is stacked a second time"
severity: minor

## Summary

total: 12
passed: 5
issues: 6
pending: 0
skipped: 1

## Gaps

- truth: "Rendered markdown preview loads content in DiffBlade preview mode"
  status: failed
  reason: "User reported: full the available space but failed to load markdown"
  severity: major
  test: 1
  root_cause: "fileDispatch.ts maps .md files to viewer-markdown unconditionally. openDiff()/openStagingDiff() in useBladeNavigation.ts don't handle viewer-markdown type — .md files never reach DiffBlade which has the working Preview toggle"
  artifacts:
    - path: "src/lib/fileDispatch.ts"
      issue: "Maps .md/.mdx to viewer-markdown without context awareness for diff vs browse"
    - path: "src/hooks/useBladeNavigation.ts"
      issue: "openDiff() and openStagingDiff() only handle 'diff' and 'viewer-image' types; viewer-markdown falls through to generic pushBlade losing oid/staged props"
  missing:
    - "Route .md/.mdx files to 'diff' blade type in openDiff()/openStagingDiff() contexts"
  debug_session: ".planning/debug/diffblade-md-preview.md"

- truth: "3D model loads and renders with orbit controls from repo browser"
  status: failed
  reason: "User reported: Failed to load 3D model"
  severity: major
  test: 3
  root_cause: "Two issues: (1) fetch('data:...') may fail in Tauri WKWebView custom protocol scheme — revert to atob() approach; (2) model-viewer $updateEnvironment() always runs in Promise.all with model loading — environment map generation failure kills entire load even if .glb data is valid"
  artifacts:
    - path: "src/components/blades/Viewer3dBlade.tsx"
      issue: "fetch('data:...') approach may fail in Tauri production WKWebView; error handler needs better diagnostic logging"
  missing:
    - "Revert to atob()/Uint8Array approach for base64 decode (avoids fetch restrictions)"
    - "Add diagnostic console.error logging for actual error details"
    - "Add WebGL capability detection before rendering model-viewer"
  debug_session: ".planning/debug/3d-model-load-failure.md"

- truth: "Backspace navigates back from diff blades"
  status: failed
  reason: "User reported: pass but not from the view full diff blades"
  severity: minor
  test: 5
  root_cause: "Backspace handler exists only inside RepoBrowserBlade as component-local onKeyDown on listbox div. No global Backspace binding in useKeyboardShortcuts.ts. DiffBlade has no Backspace handler."
  artifacts:
    - path: "src/components/blades/RepoBrowserBlade.tsx"
      issue: "Backspace handler is blade-local, not global"
    - path: "src/hooks/useKeyboardShortcuts.ts"
      issue: "No Backspace binding — only Escape is registered for blade pop"
  missing:
    - "Add global Backspace hotkey in useKeyboardShortcuts.ts that calls popBlade() when stack depth > 1"
  debug_session: ".planning/debug/breadcrumb-nav-issues.md"

- truth: "Gitflow cheatsheet SVG diagram renders with correct Catppuccin colors"
  status: failed
  reason: "User reported: pass but the blade contains a big dark rectangle. svg colors for paths does not exists"
  severity: major
  test: 6
  root_cause: "CSS custom property name mismatch. Code uses var(--ctp-red), var(--ctp-blue), etc. but these don't exist. Actual variables from @catppuccin/tailwindcss are var(--catppuccin-color-red), var(--catppuccin-color-blue), etc. Tailwind utility classes work (bg-ctp-red compiles to var(--catppuccin-color-red)) but inline var(--ctp-*) references resolve to initial values (black fill, no stroke)."
  artifacts:
    - path: "src/lib/branchClassifier.ts"
      issue: "BRANCH_TYPE_COLORS uses var(--ctp-*) instead of var(--catppuccin-color-*)"
    - path: "src/components/gitflow/GitflowDiagram.tsx"
      issue: "Background rect uses var(--ctp-mantle) — wrong variable name"
    - path: "src/index.css"
      issue: "React Flow control styles also use broken var(--ctp-*) pattern"
    - path: "src/components/blades/Viewer3dBlade.tsx"
      issue: "Also uses var(--ctp-base) and var(--ctp-mantle) inline"
  missing:
    - "Replace all var(--ctp-*) with var(--catppuccin-color-*) in inline styles, SVG attributes, and raw CSS"
  debug_session: ".planning/debug/gitflow-svg-dark-rectangle.md"

- truth: "Gitflow cheatsheet SVG shows 5 branch lanes with correct colors and highlights"
  status: failed
  reason: "User reported: problem with colors"
  severity: major
  test: 8
  root_cause: "Same as Test 6 — CSS variable name mismatch across branchClassifier.ts and GitflowDiagram.tsx"
  artifacts:
    - path: "src/lib/branchClassifier.ts"
      issue: "BRANCH_TYPE_COLORS uses wrong CSS variable names"
    - path: "src/components/gitflow/GitflowDiagram.tsx"
      issue: "SVG elements reference non-existent var(--ctp-*) variables"
  missing:
    - "Fix var(--ctp-*) to var(--catppuccin-color-*) in branchClassifier.ts and GitflowDiagram.tsx"
  debug_session: ".planning/debug/gitflow-svg-dark-rectangle.md"

- truth: "Breadcrumb navigation from diff blade does not duplicate repo browser blade on stack"
  status: failed
  reason: "User reported: yes but when i click on a breadcrumb item parent then on a folder, the folder explorer blade is stacked a second time"
  severity: minor
  test: 12
  root_cause: "BladeBreadcrumb.navigateTo() calls store.replaceBlade() which replaces the last blade (diff). The existing repo-browser beneath the diff is left untouched, producing [repo-browser] -> [repo-browser] duplicate stack."
  artifacts:
    - path: "src/components/blades/BladeBreadcrumb.tsx"
      issue: "Calls replaceBlade unaware that repo-browser may exist one level below"
    - path: "src/stores/blades.ts"
      issue: "replaceBlade has no duplicate-type guard or ancestor checking"
  missing:
    - "Pop to nearest repo-browser ancestor before replacing, or pop current blade first if it's not a repo-browser"
  debug_session: ".planning/debug/breadcrumb-nav-issues.md"

## Additional Finding: Duplicate Blade Registration Warnings

- root_cause: "HMR re-execution — Vite re-evaluates registration modules when shared dependencies (bladeUtils.tsx, BladeBreadcrumb.tsx) change. registry Map persists across HMR cycles."
  severity: cosmetic
  artifacts:
    - path: "src/lib/bladeRegistry.ts"
      issue: "registerBlade() warns on HMR re-registration"
    - path: "src/components/blades/registrations/index.ts"
      issue: "eager glob with negative pattern has known Vite HMR issues"
  missing:
    - "Suppress warning during HMR or gate behind !import.meta.hot check"
  debug_session: ".planning/debug/duplicate-blade-registration.md"
