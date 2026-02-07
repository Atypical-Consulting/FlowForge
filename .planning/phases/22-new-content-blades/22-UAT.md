---
status: diagnosed
phase: 22-new-content-blades
source: 22-11-PLAN.md, 22-VERIFICATION.md
started: 2026-02-07T21:00:00Z
updated: 2026-02-07T21:25:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Markdown Viewer — Basic Rendering
expected: Open repo browser, navigate to a `.md` file, click to open. Markdown renders with styled headings, paragraphs, and text.
result: pass

### 2. Markdown Viewer — GFM Tables
expected: Open a `.md` file containing a GFM table. Table renders with borders, header styling, and alternating row colors.
result: pass

### 3. Markdown Viewer — Task Lists
expected: Open a `.md` file containing GFM task lists (`- [x]` / `- [ ]`). Checkboxes render (read-only).
result: pass

### 4. Markdown Viewer — Syntax-Highlighted Code Blocks
expected: Open a `.md` file with fenced code blocks with language specifiers. Syntax highlighting in Catppuccin Mocha colors. Copy button visible on each code block.
result: pass

### 5. Markdown Viewer — Copy Code Button
expected: Click the copy button on a code block. Code copies to clipboard. Button briefly shows a checkmark.
result: pass

### 6. Markdown Viewer — Relative Images
expected: Open a `.md` file containing relative image references. Images load inline from git HEAD.
result: pass

### 7. Markdown Viewer — External Links
expected: Click an external link (https://...) in rendered markdown. System browser opens with the URL.
result: pass

### 8. Markdown Viewer — Relative .md Links
expected: Click a relative `.md` link in rendered markdown. Current blade replaces with new markdown content (not pushed as new blade).
result: pass

### 9. Markdown Viewer — Relative Non-.md Links
expected: Click a relative non-`.md` link in rendered markdown. Repo browser blade is pushed onto the stack.
result: pass

### 10. Markdown Viewer — XSS Sanitization
expected: A `.md` file containing `<script>alert('xss')</script>` has the script tag stripped/sanitized. No alert appears.
result: pass

### 11. Diff Markdown Toggle — Toggle Visible for .md
expected: Stage a change to a `.md` file, open its diff. DiffBlade toolbar shows a Diff/Preview segmented toggle.
result: pass

### 12. Diff Markdown Toggle — No Toggle for Non-.md
expected: Open a diff for a `.tsx` file. No Diff/Preview toggle appears.
result: pass

### 13. Diff Markdown Toggle — Preview Mode
expected: Toggle from Diff to Preview on a `.md` diff. Rendered markdown replaces the Monaco diff editor.
result: issue
reported: "the width of the rendered markdown does not take 100% width"
severity: cosmetic

### 14. Diff Markdown Toggle — Back to Diff
expected: Toggle back from Preview to Diff. Monaco diff editor reappears.
result: issue
reported: "no, i cannot see the diff editor 0px height, not 100% width"
severity: major

### 15. Diff Markdown Toggle — Toolbar State
expected: In preview mode, the inline/side-by-side toggle is hidden. Only the Diff/Preview toggle is visible.
result: pass

### 16. 3D Model Viewer — Load Model
expected: Open a `.glb` file from the repo browser. 3D model loads and renders with orbit controls.
result: issue
reported: "Failed to load 3D model"
severity: major

### 17. 3D Model Viewer — Orbit Controls
expected: Drag to orbit the model. Model rotates. Auto-rotation stops on first interaction.
result: skipped
reason: Blocked by Test 16 — model fails to load

### 18. 3D Model Viewer — Zoom
expected: Scroll to zoom in/out on the 3D model. Camera zooms in and out.
result: skipped
reason: Blocked by Test 16 — model fails to load

### 19. 3D Model Viewer — Metadata Panel
expected: Click the Info button or verify metadata panel toggle. Metadata panel shows file format and size.
result: skipped
reason: Blocked by Test 16 — model fails to load

### 20. 3D Model Viewer — Interaction Hint
expected: On first ever load, "Drag to orbit | Scroll to zoom | Shift+drag to pan" appears and fades after ~4 seconds.
result: skipped
reason: Blocked by Test 16 — model fails to load

### 21. Repo Browser — Open from Header
expected: Click "Browse Files" in the header toolbar. Repo browser opens at repository root with files and folders listed.
result: pass

### 22. Repo Browser — Sort Order
expected: Folders appear before files, both sorted alphabetically.
result: pass

### 23. Repo Browser — Navigate into Folder
expected: Click a folder to navigate into it. Blade replaces in-place, breadcrumbs update.
result: issue
reported: "pass but the headers of this blade should be merged [back button, breadcrumb]. apply the same breadcrumb to all viewers and diff editors"
severity: minor

### 24. Repo Browser — Breadcrumb Ancestor
expected: Click a breadcrumb ancestor segment. Navigates to that ancestor directory.
result: pass

### 25. Repo Browser — Home Icon
expected: Click the Home icon in breadcrumbs. Navigates to repository root.
result: pass

### 26. Repo Browser — Keyboard Arrow Navigation
expected: Use Arrow Up/Down to move through the file list. Focus moves between items.
result: pass

### 27. Repo Browser — Enter to Open
expected: Press Enter on a focused file. Appropriate viewer blade opens.
result: pass

### 28. Repo Browser — Backspace to Parent
expected: Press Backspace in the file list. Navigates to parent directory.
result: issue
reported: "no, the backspace button does not work for navigation"
severity: major

### 29. Repo Browser — Empty Directory
expected: Navigate to an empty directory (if one exists). "This directory is empty" message with FolderOpen icon.
result: skipped
reason: Git doesn't track empty directories — untestable in practice

### 30. Gitflow Cheatsheet — SVG Diagram
expected: Open the Gitflow Guide blade. SVG diagram shows 5 branch lanes with Catppuccin colors.
result: issue
reported: "no, the gitflow cheat sheet is not accessible from anywhere"
severity: major

### 31. Gitflow Cheatsheet — Active Lane Highlight
expected: The current branch type lane is highlighted with full opacity and wider stroke; inactive lanes are dimmed.
result: skipped
reason: Blocked by Test 30 — cheatsheet not accessible

### 32. Gitflow Cheatsheet — You Are Here Indicator
expected: Branch name in code font, "You are here" badge on the diagram.
result: skipped
reason: Blocked by Test 30 — cheatsheet not accessible

### 33. Gitflow Cheatsheet — Branch Reference Cards
expected: All 5 branch type cards visible with description, naming convention, branches from/merges to.
result: skipped
reason: Blocked by Test 30 — cheatsheet not accessible

### 34. Gitflow Cheatsheet — Current Branch Emphasis
expected: "You are here" badge on the matching branch reference card.
result: skipped
reason: Blocked by Test 30 — cheatsheet not accessible

### 35. Gitflow Actions — Feature Branch
expected: On a `feature/*` branch, "Finish feature" and "Push to remote" action cards appear.
result: skipped
reason: Blocked by Test 30 — cheatsheet not accessible

### 36. Gitflow Actions — Develop Branch
expected: On `develop`, "Start a feature" and "Start a release" action cards appear.
result: skipped
reason: Blocked by Test 30 — cheatsheet not accessible

### 37. Gitflow Actions — Main Branch
expected: On `main`, "Start a hotfix" and "Review tags" action cards appear.
result: skipped
reason: Blocked by Test 30 — cheatsheet not accessible

### 38. Gitflow Actions — Non-Gitflow Branch
expected: On a non-gitflow branch, "This branch does not match a gitflow naming pattern" message.
result: skipped
reason: Blocked by Test 30 — cheatsheet not accessible

### 39. Gitflow Actions — Informational Only
expected: Action cards show descriptions and git commands in code font, but no executable buttons.
result: skipped
reason: Blocked by Test 30 — cheatsheet not accessible

### 40. Regression — Staging & Diff
expected: Open staging view, stage a file, view its diff. All existing staging functionality works.
result: pass

### 41. Regression — Topology & Commit Details
expected: Open topology graph, click a commit, view commit details. Works correctly.
result: pass

### 42. Regression — Settings Blade
expected: Open settings blade. Settings blade opens and functions normally.
result: pass

### 43. Regression — Changelog Blade
expected: Open changelog blade. Changelog generation works normally.
result: pass

### 44. Regression — Blade Stack Navigation
expected: Navigate between multiple blades using back button and blade strip. Blade stack navigation works correctly with animations.
result: pass

## Summary

total: 44
passed: 26
issues: 6
pending: 0
skipped: 12

## Gaps

- truth: "Rendered markdown preview fills available width in DiffBlade"
  status: failed
  reason: "User reported: the width of the rendered markdown does not take 100% width"
  severity: cosmetic
  test: 13
  root_cause: "DiffBlade.tsx line 265: max-w-3xl constrains preview to 768px"
  artifacts:
    - path: "src/components/blades/DiffBlade.tsx"
      issue: "max-w-3xl on preview container limits width to 768px"
  missing:
    - "Remove or widen max-w-3xl on the markdown preview container"
  debug_session: ".planning/debug/diffblade-monaco-0px-height.md"

- truth: "Monaco diff editor reappears at full size when toggling back from Preview to Diff"
  status: failed
  reason: "User reported: no, i cannot see the diff editor 0px height, not 100% width"
  severity: major
  test: 14
  root_cause: "DiffBlade.tsx line 275: Monaco container missing h-full overflow-hidden; conditional rendering causes full remount, Monaco measures 0px before flex resolves"
  artifacts:
    - path: "src/components/blades/DiffBlade.tsx"
      issue: "Container has flex-1 min-h-0 but lacks h-full overflow-hidden; conditional ternary remounts DiffEditor"
  missing:
    - "Add h-full overflow-hidden to Monaco container div"
  debug_session: ".planning/debug/diffblade-monaco-0px-height.md"

- truth: "3D model loads and renders with orbit controls from repo browser"
  status: failed
  reason: "User reported: Failed to load 3D model"
  severity: major
  test: 16
  root_cause: "Viewer3dBlade.tsx: error handler (line 109-111) swallows actual error; environment-image='neutral' (line 286) may fail in Tauri WKWebView causing Promise.all rejection"
  artifacts:
    - path: "src/components/blades/Viewer3dBlade.tsx"
      issue: "Error handler discards event detail; environment-image may fail in Tauri WebView"
  missing:
    - "Capture actual error from CustomEvent detail"
    - "Handle environment failures gracefully or remove environment-image attribute"
  debug_session: ".planning/debug/3d-model-load-failure.md"

- truth: "Repo browser blade header merges back button and breadcrumb into one row; all viewer and diff blades use the same breadcrumb pattern"
  status: failed
  reason: "User reported: headers of this blade should be merged [back button, breadcrumb]. apply the same breadcrumb to all viewers and diff editors"
  severity: minor
  test: 23
  root_cause: "3 inconsistent header patterns: BladePanel has back button (row 1), RepoBrowserBlade has separate Breadcrumbs in BladeToolbar (row 2), viewers use static non-clickable renderPathTitle"
  artifacts:
    - path: "src/components/blades/BladePanel.tsx"
      issue: "Back button in row 1, breadcrumb in row 2 for repo-browser"
    - path: "src/components/blades/RepoBrowserBlade.tsx"
      issue: "Breadcrumbs in BladeToolbar creates separate row from back button"
    - path: "src/lib/bladeUtils.tsx"
      issue: "renderPathTitle is static/non-clickable, not a real breadcrumb"
  missing:
    - "Create shared BladeBreadcrumb component with clickable segments"
    - "Move breadcrumb into BladePanel titleContent slot (same row as back button)"
    - "Apply to all viewer and diff blade registrations"
  debug_session: ".planning/debug/blade-header-breadcrumb-ux.md"

- truth: "Backspace navigates to parent directory in repo browser"
  status: failed
  reason: "User reported: no, the backspace button does not work for navigation"
  severity: major
  test: 28
  root_cause: "RepoBrowserBlade.tsx line 46-48: useEffect depends on [focusedIndex] only; fires before query data loads, never re-fires when entries populate; listbox div (line 155) lacks tabIndex so it can't receive focus as fallback"
  artifacts:
    - path: "src/components/blades/RepoBrowserBlade.tsx"
      issue: "Focus useEffect misses entries dependency; listbox div lacks tabIndex"
  missing:
    - "Add entries to focus useEffect dependency array"
    - "Add tabIndex={0} to listbox div as defensive fallback"
  debug_session: ".planning/debug/backspace-nav-repo-browser.md"

- truth: "Gitflow cheatsheet blade is accessible from the UI"
  status: failed
  reason: "User reported: no, the gitflow cheat sheet is not accessible from anywhere"
  severity: major
  test: 30
  root_cause: "Zero calls to openBlade('gitflow-cheatsheet') anywhere in codebase; blade is registered but no entry point wired up in Header, command palette, or GitflowPanel"
  artifacts:
    - path: "src/components/Header.tsx"
      issue: "Missing gitflow-cheatsheet button (has buttons for settings, repo-browser, changelog but not gitflow)"
    - path: "src/components/gitflow/GitflowPanel.tsx"
      issue: "No link to cheatsheet blade in sidebar gitflow section"
  missing:
    - "Add header button for gitflow-cheatsheet"
    - "Add link in GitflowPanel sidebar"
  debug_session: ".planning/debug/gitflow-cheatsheet-no-entry-point.md"
