---
status: diagnosed
phase: 22-new-content-blades
source: 22-17-SUMMARY.md, 22-18-SUMMARY.md, 22-19-SUMMARY.md
started: 2026-02-08T10:00:00Z
updated: 2026-02-08T10:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. DiffBlade — Markdown Preview Loads Content
expected: Stage a change to a `.md` file (or view a commit that touches a .md file). Open its diff. Toggle to Preview. Rendered markdown should appear with full content — no blank/error state.
result: pass

### 2. 3D Model Viewer — Load GLB Model
expected: Open repo browser, navigate to a `.glb` file, click to open. 3D model loads and renders (no "Failed to load 3D model" error). If your system lacks WebGL, a clear "WebGL not supported" message should appear instead of a cryptic error.
result: issue
reported: "Failed to load 3D model. Console shows App component error and duplicate blade registration warnings."
severity: blocker

### 3. Gitflow Cheatsheet — SVG Colors
expected: Open the Gitflow cheatsheet blade (via header button or Gitflow panel link). SVG diagram shows 5 colored branch lanes (not a dark/black rectangle). Colors should be visible Catppuccin theme colors.
result: issue
reported: "yes but colors are too darks, the graphics has strange curves. Seems not a good representation of branches. Think about the GitKraken Graph"
severity: major

### 4. Backspace Navigation — Global
expected: Open repo browser, navigate into a folder, then open a file (e.g., a .md or code file). From the viewer blade, press Backspace. Should navigate back (pop blade). Works from any blade, not just repo browser.
result: issue
reported: "yes but the monaco editor has 0% height for txt files and surely other types"
severity: major

### 5. Breadcrumb — No Duplicate Repo Browser
expected: Open a diff for a file. In the diff blade header, click a parent breadcrumb segment. Then click into a folder. The repo browser blade should NOT be stacked twice — navigation should feel clean with no duplicates.
result: skipped
reason: Known issue — will be fixed later with xstate blade state machine

### 6. HMR Console — No Duplicate Registration Warnings
expected: During development with hot reload, the browser console should NOT show "Blade type X already registered" warnings when editing files that trigger HMR.
result: issue
reported: "warning still appears"
severity: minor

## Summary

total: 6
passed: 1
issues: 4
pending: 0
skipped: 1

## Gaps

- truth: "3D model loads and renders with orbit controls from repo browser"
  status: failed
  reason: "User reported: Failed to load 3D model. Console shows App component error and duplicate blade registration warnings."
  severity: blocker
  test: 2
  root_cause: "@google/model-viewer detects Tauri WKWebView as iOS WKWebView (window.webkit.messageHandlers is truthy), entering unsupported code paths. Side-effect import crashes during chunk evaluation (customElements.define, WASM decoder, Renderer singleton). WebGL renderer creation fails silently. model-viewer is officially unsupported in webviews."
  artifacts:
    - path: "src/components/blades/Viewer3dBlade.tsx"
      issue: "Top-level side-effect import crashes; error handler masks real error"
    - path: "node_modules/.vite/deps/@google_model-viewer.js"
      issue: "IS_WKWEBVIEW detection returns true in Tauri"
  missing:
    - "Replace model-viewer with direct Three.js + GLTFLoader (eliminates WKWebView misdetection)"
    - "Or: dynamic import with error catching + loading='eager' as interim fix"
  debug_session: ".planning/debug/3d-model-wave7.md"

- truth: "Gitflow cheatsheet SVG diagram shows 5 colored branch lanes with correct Catppuccin colors"
  status: failed
  reason: "User reported: yes but colors are too darks, the graphics has strange curves. Seems not a good representation of branches. Think about the GitKraken Graph"
  severity: major
  test: 3
  root_cause: "Three compounding issues: (1) Non-highlighted lanes at opacity 0.3-0.4 on #181825 background reduces bright pastels to muddy darks; (2) Quadratic Bezier Q curves produce simple arcs instead of smooth S-curves like GitKraken; (3) Branch/merge curves don't connect to commit dots — disconnected geometry"
  artifacts:
    - path: "src/components/gitflow/GitflowDiagram.tsx"
      issue: "Opacity 0.3-0.4, quadratic Q curves, disconnected commit dots"
  missing:
    - "Raise opacity to 0.65-0.7 for non-highlighted lanes, 0.5 for paths"
    - "Replace Q curves with cubic C curves for smooth S-shaped transitions"
    - "Align branch/merge paths to actual commit dot positions"
    - "Increase strokeWidth to 2-2.5px, remove dash pattern"
  debug_session: ".planning/debug/gitflow-svg-wave7.md"

- truth: "Viewer-code blade (Monaco) displays file content at full height for .txt and other file types"
  status: failed
  reason: "User reported: yes but the monaco editor has 0% height for txt files and surely other types"
  severity: major
  test: 4
  root_cause: "ViewerCodeBlade.tsx:55 uses className='flex-1 min-h-0' but parent (BladePanel content area) is NOT a flex container. flex-1 is inert. Monaco measures 0px. DiffBlade works because it has h-full."
  artifacts:
    - path: "src/components/blades/ViewerCodeBlade.tsx"
      issue: "Line 55: flex-1 min-h-0 on non-flex parent — needs h-full overflow-hidden"
    - path: "src/components/blades/BladePanel.tsx"
      issue: "Line 42: content area has flex-1 min-h-0 overflow-hidden but no flex/flex-col"
  missing:
    - "Change ViewerCodeBlade.tsx:55 from 'flex-1 min-h-0' to 'h-full overflow-hidden'"
  debug_session: ".planning/debug/monaco-0px-viewer-code.md"

- truth: "No duplicate blade registration warnings in browser console during HMR"
  status: failed
  reason: "User reported: warning still appears"
  severity: minor
  test: 6
  root_cause: "import.meta.hot guard has wrong semantics — it's always truthy in Vite dev mode (it's the HMR API object, not an 'in update' flag). Registry Map persists across HMR while registration modules re-execute. Need to clear registry on HMR dispose, then re-register cleanly."
  artifacts:
    - path: "src/lib/bladeRegistry.ts"
      issue: "!import.meta.hot guard is always false in dev — wrong approach"
    - path: "src/components/blades/registrations/index.ts"
      issue: "eager glob re-executes all registrations on HMR; needs self-accept + dispose handler"
  missing:
    - "Add clearRegistry() export to bladeRegistry.ts"
    - "Add import.meta.hot.accept() + dispose(clearRegistry) to registrations/index.ts"
    - "Skip exhaustiveness check during HMR re-evaluation"
  debug_session: ".planning/debug/hmr-registration-wave7.md"
