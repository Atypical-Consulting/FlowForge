---
status: complete
phase: 49-inline-conflict-resolution
source: 49-01-SUMMARY.md, 49-02-SUMMARY.md, 49-03-SUMMARY.md
started: 2026-02-12T12:00:00Z
updated: 2026-02-12T12:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Conflict Indicators in File Tree
expected: When a repository has merge conflicts, conflicted files are marked with a distinct red/warning icon in the file tree. A conflict count badge is visible in the toolbar area.
result: pass

### 2. Staging Panel Conflict Filter
expected: In the staging panel, a filter option allows showing only conflicted files. Activating the filter hides non-conflicted files from the list.
result: pass

### 3. Open Conflict Resolution Blade
expected: The conflict resolution blade can be opened via the toolbar button or command palette entry. It shows a file list sidebar on the left with all conflicted files and their resolution status.
result: pass

### 4. Two-Pane Diff View (Ours vs Theirs)
expected: Selecting a conflicted file in the blade shows a side-by-side Monaco DiffEditor with "Ours" content on the left and "Theirs" content on the right, with branch labels displayed.
result: pass

### 5. Editable Result Panel
expected: Below the diff view, an editable Monaco Editor shows the merged result content with syntax highlighting. The result starts pre-populated with "ours" content.
result: pass

### 6. Per-Hunk Accept Actions
expected: Each conflict hunk has "Accept Ours", "Accept Theirs", and "Accept Both" buttons. Clicking one updates the result editor content for that hunk. The selected action is visually highlighted.
result: pass

### 7. Undo Hunk Resolution
expected: After accepting a hunk resolution, an "Undo" button appears allowing you to revert that specific hunk resolution. The result editor updates accordingly.
result: pass

### 8. Manual Editing of Result
expected: The result editor is fully editable — you can manually type changes to the merged content with full syntax highlighting support.
result: pass

### 9. Reset to Original State
expected: A "Reset" action is available that restores the result editor to its original conflicted state, undoing all hunk resolutions and manual edits.
result: pass

### 10. Mark File as Resolved
expected: A "Mark as Resolved" action stages the resolved file, removes the conflict indicator from the file tree, and shows a toast confirmation message.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
