---
status: complete
phase: 22-new-content-blades
source: 22-17-SUMMARY.md, 22-18-SUMMARY.md, 22-19-SUMMARY.md
started: 2026-02-08T10:00:00Z
updated: 2026-02-08T10:17:00Z
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
  artifacts: []
  missing: []

- truth: "Gitflow cheatsheet SVG diagram shows 5 colored branch lanes with correct Catppuccin colors"
  status: failed
  reason: "User reported: yes but colors are too darks, the graphics has strange curves. Seems not a good representation of branches. Think about the GitKraken Graph"
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "Viewer-code blade (Monaco) displays file content at full height for .txt and other file types"
  status: failed
  reason: "User reported: yes but the monaco editor has 0% height for txt files and surely other types"
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "No duplicate blade registration warnings in browser console during HMR"
  status: failed
  reason: "User reported: warning still appears"
  severity: minor
  test: 6
  artifacts: []
  missing: []
