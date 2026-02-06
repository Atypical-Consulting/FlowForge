---
status: complete
phase: 17-hierarchical-view-commit-enhancements
source: 17-01-SUMMARY.md, 17-02-SUMMARY.md, 17-03-SUMMARY.md
started: 2026-02-06T18:00:00Z
updated: 2026-02-06T18:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Colored commit type icons in topology graph
expected: In the topology/graph view, each commit node shows a colored icon matching its conventional commit type (e.g., feat = green sparkles, fix = red bug, docs = blue book, etc.) instead of monochrome gray icons.
result: pass

### 2. Colored commit type icons in commit history
expected: In the commit history list, each commit row shows a small colored icon matching its conventional commit type, parsed from the commit message.
result: pass

### 3. Colored commit type badges in type selector
expected: When composing a commit, the type selector dropdown shows colored badge styling for each commit type (feat, fix, docs, etc.) with matching colors.
result: pass

### 4. Folder stage — stage all files in a folder
expected: In the hierarchical staging view, hovering over a folder in "Changes" or "Untracked Files" reveals a stage button. Clicking it stages all files within that folder at once.
result: pass

### 5. Folder unstage — unstage all files in a folder
expected: In the hierarchical staging view, hovering over a folder in "Staged Changes" reveals an unstage button. Clicking it unstages all files within that folder at once.
result: pass

### 6. Uniform icon spacing in file tree
expected: In the hierarchical file tree, icons have uniform widths and consistent icon-to-text spacing regardless of nesting depth. Folder icons and file icons align vertically across all levels.
result: issue
reported: "the vertical lines are broken and not coherent. You need to improve that part"
severity: major

### 7. Changelog emoji in generated markdown
expected: When generating a changelog (via the changelog feature), the exported markdown includes emoji markers in group headings (e.g., "## ✨ Features", "## 🐛 Bug Fixes").
result: pass

### 8. Changelog preview with colored icons
expected: The ChangelogPreview component shows a summary grid with colored commit type icons next to each group name, and a detailed commit list organized by type with group header icons.
result: pass

## Summary

total: 8
passed: 7
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "In the hierarchical file tree, icons have uniform widths and consistent icon-to-text spacing regardless of nesting depth. Folder icons and file icons align vertically across all levels."
  status: failed
  reason: "User reported: the vertical lines are broken and not coherent. You need to improve that part"
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
