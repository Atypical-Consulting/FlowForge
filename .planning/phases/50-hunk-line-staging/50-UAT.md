---
status: testing
phase: 50-hunk-line-staging
source: 50-01-SUMMARY.md, 50-02-SUMMARY.md, 50-03-SUMMARY.md
started: 2026-02-12T14:00:00Z
updated: 2026-02-12T14:05:00Z
---

## Current Test

number: 2
name: Stage Individual Hunk
expected: |
  Click "Stage Hunk" on one specific hunk. The staging panel updates immediately — the file appears in (or updates in) the staged section, and the diff refreshes to show the remaining unstaged hunks.
awaiting: user response

## Tests

### 1. Hunk Action Bars in Diff Viewer
expected: Open a file with multiple changes from the staging panel (unstaged side). The diff viewer shows ViewZone action bars above each hunk — a colored bar with the hunk header text and a "Stage Hunk" button. Each hunk is visually separated.
result: issue
reported: "the stage hunk button appears but does not work"
severity: major

### 2. Stage Individual Hunk
expected: Click "Stage Hunk" on one specific hunk. The staging panel updates immediately — the file appears in (or updates in) the staged section, and the diff refreshes to show the remaining unstaged hunks.
result: [pending]

### 3. Unstage Individual Hunk
expected: Open a file from the staged side. ViewZone action bars show "Unstage Hunk" buttons. Click one — the hunk moves back to unstaged, and the staging panel reflects the change immediately.
result: [pending]

### 4. Glyph Margin Hunk Toggle
expected: In the diff viewer gutter (left margin), each hunk's first line has a clickable glyph indicator (+ or minus icon). Clicking it toggles staging for that entire hunk, same as clicking the ViewZone button.
result: [pending]

### 5. Stage All / Unstage All Toolbar Button
expected: The diff toolbar shows a "Stage All" button (when viewing unstaged) or "Unstage All" button (when viewing staged). Clicking it stages/unstages all hunks in the file at once.
result: [pending]

### 6. Line Selection via Glyph Margin
expected: In the diff viewer, each changed line (addition/deletion) has a small checkbox-like glyph in the margin. Clicking it selects that line — the glyph fills in blue and the line gets a blue background highlight.
result: [pending]

### 7. Stage Selected Lines
expected: After selecting individual lines via glyph margin clicks, the ViewZone button for that hunk changes from "Stage Hunk" to "Stage N Lines" (with blue color). Clicking it stages only those selected lines, not the entire hunk.
result: [pending]

### 8. Keyboard Hunk Navigation
expected: With focus in the diff editor, pressing `]` jumps to the next hunk and `[` jumps to the previous hunk. Cursor moves to the first line of each hunk.
result: [pending]

### 9. Keyboard Staging Shortcuts
expected: Ctrl+Shift+S (or Cmd+Shift+S on Mac) stages the selected lines or current hunk. Ctrl+Shift+U (or Cmd+Shift+U) unstages. Escape clears any line selection.
result: [pending]

### 10. Partial-Stage Indicator
expected: When a file has some hunks staged and some unstaged (appears in both staged and unstaged sections), a yellow half-filled circle indicator appears on the file icon in the staging panel, with tooltip "Partially staged".
result: [pending]

## Summary

total: 10
passed: 0
issues: 1
pending: 9
skipped: 0

## Gaps

- truth: "Stage Hunk button in ViewZone action bar triggers hunk staging when clicked"
  status: failed
  reason: "User reported: the stage hunk button appears but does not work"
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
