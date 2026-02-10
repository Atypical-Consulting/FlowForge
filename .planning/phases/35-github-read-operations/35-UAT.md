---
status: complete
phase: 35-github-read-operations
source: 35-01-SUMMARY.md, 35-02-SUMMARY.md, 35-03-SUMMARY.md
started: 2026-02-10T16:00:00Z
updated: 2026-02-10T16:08:00Z
---

## Current Test

[testing complete]

## Tests

### 1. GitHub Toolbar Buttons Appear
expected: When signed into GitHub and a repo with a GitHub remote is open, two new toolbar buttons appear in the Views group: "Pull Requests" (GitPullRequest icon) and "Issues" (CircleDot icon). They should NOT appear when signed out or when no GitHub remote is detected.
result: pass

### 2. Open Pull Request List
expected: Clicking the "Pull Requests" toolbar button (or running "View Pull Requests" from the command palette) opens a Pull Request List blade showing PRs with title, author avatar, status badge (open/closed/merged), and labels as colored pills.
result: pass

### 3. PR List State Filtering
expected: The PR list blade has filter tabs at the top (Open / Closed / All). Clicking a tab switches the displayed PRs to match the selected state. The active tab is visually highlighted.
result: pass

### 4. Open PR Detail
expected: Clicking a PR in the list opens a Pull Request Detail blade showing: PR title and number, branch info (base <- head), diff stats (additions/deletions/changed files), the full description rendered as markdown, and a link to open in browser.
result: pass

### 5. PR Comments Timeline
expected: The PR detail blade shows a comments section below the description. Each comment displays the author's avatar, username, relative timestamp (e.g. "2 hours ago"), and the comment body rendered as markdown.
result: pass

### 6. Open Issue List
expected: Clicking the "Issues" toolbar button (or running "View Issues" from the command palette) opens an Issue List blade showing issues with title, status badge (open/closed), labels as colored pills, and assignee avatar.
result: pass

### 7. Issue List State Filtering
expected: The issue list blade has filter tabs (Open / Closed / All). Clicking a tab switches the displayed issues. The active tab is visually highlighted.
result: pass

### 8. Open Issue Detail
expected: Clicking an issue in the list opens an Issue Detail blade showing: issue title and number, assignees with avatars, milestone (if set), the full description rendered as markdown, and a link to open in browser.
result: pass

### 9. Issue Comments Timeline
expected: The issue detail blade shows a comments section below the description. Each comment displays the author's avatar, username, relative timestamp, and the comment body rendered as markdown.
result: pass

### 10. Command Palette GitHub Entries
expected: Opening the command palette (Ctrl/Cmd+K) and typing "github" or "pull" or "issue" shows "View Pull Requests" and "View Issues" entries under a GitHub category. Selecting one opens the corresponding list blade.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
