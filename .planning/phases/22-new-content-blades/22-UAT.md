---
status: complete
phase: 22-new-content-blades
source: 22-17-SUMMARY.md, 22-18-SUMMARY.md, 22-19-SUMMARY.md, 22-20-SUMMARY.md, 22-21-SUMMARY.md, 22-22-SUMMARY.md, 22-23-SUMMARY.md, 22-24-SUMMARY.md
started: 2026-02-08T12:00:00Z
updated: 2026-02-08T12:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. DiffBlade — Markdown Preview Loads Content
expected: Stage a change to a `.md` file, open its diff, toggle to Preview. Rendered markdown loads and displays correctly (GFM tables, code blocks, etc.) filling the full blade width.
result: pass

### 2. DiffBlade — Toolbar Order
expected: When viewing a `.md` file diff, the toolbar shows Diff/Preview toggle on the LEFT and Side-by-side button on the RIGHT.
result: pass

### 3. DiffBlade — Monaco Reappears After Toggle
expected: Toggle from Preview back to Diff. Monaco diff editor reappears at full height and width immediately (no 0px collapse).
result: pass

### 4. 3D Model Viewer — Load GLB Model
expected: Open repo browser, navigate to a `.glb` file, click to open. 3D model loads and renders in the viewer (no "Failed to load 3D model" error). Background is dark Catppuccin base color.
result: issue
reported: "Failed to load 3D model. need to be fixed by creating a external html page and playwright mcp to debug it."
severity: major

### 5. 3D Model Viewer — Orbit and Zoom
expected: Drag to orbit the loaded 3D model. Scroll to zoom. Model responds to interaction smoothly.
result: skipped
reason: Blocked by Test 4 — model fails to load

### 6. Gitflow Cheatsheet — SVG Diagram Colors
expected: Open the Gitflow cheatsheet blade. SVG diagram shows colored branch lanes with Catppuccin theme colors (no dark/black rectangle). Main lane at top, develop below, with feature/release/hotfix arcs.
result: issue
reported: "some rows are invisible. inspire yourself from the implementation of mermaid. https://mermaid.ai/open-source/syntax/gitgraph.html https://github.com/mermaid-js/mermaid/tree/524695dd075d36ba9e48ce4e5be6aff01a1d65a0/packages/parser/src/language/gitGraph"
severity: major

### 7. Gitflow Cheatsheet — Arrowheads and Labels
expected: Gitflow SVG diagram shows arrowheads on flow curves indicating direction. Version labels (v1.0, v2.0) appear on the main lane at merge points.
result: issue
reported: "yes for the version labels but i dont want curves, I want typical gitgraph"
severity: major

### 8. Gitflow Cheatsheet — You Are Here Indicator
expected: Current branch type is highlighted in the diagram. A "You Are Here" indicator appears near the relevant branch lane.
result: pass

### 9. Breadcrumb — No Stack Duplication
expected: From repo browser, open a file (e.g., .md file). In the viewer blade, click a parent breadcrumb segment, then navigate into a folder. Only one repo-browser blade exists in the stack (no duplication).
result: pass

### 10. Global Backspace Navigation
expected: Open any blade (diff, viewer, etc.), press Backspace (when not in a text input). Navigates back to previous blade in the stack.
result: pass

### 11. Monaco Code Viewer — Full Height
expected: Open a code file from repo browser (e.g., `.ts`, `.js`). Monaco editor renders at full blade height (not collapsed to 0px).
result: pass

### 12. No HMR Registration Warnings
expected: During development with hot reload, no "duplicate blade registration" console warnings appear.
result: pass

## Summary

total: 12
passed: 8
issues: 3
pending: 0
skipped: 1

## Gaps

- truth: "3D model loads and renders with Three.js from repo browser"
  status: failed
  reason: "User reported: Failed to load 3D model. need to be fixed by creating a external html page and playwright mcp to debug it."
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Gitflow SVG diagram shows all branch lanes with visible colors"
  status: failed
  reason: "User reported: some rows are invisible. inspire yourself from the implementation of mermaid."
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Gitflow SVG uses typical gitgraph style (not curves)"
  status: failed
  reason: "User reported: yes for the version labels but i dont want curves, I want typical gitgraph"
  severity: major
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
