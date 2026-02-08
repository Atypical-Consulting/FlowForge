---
status: testing
phase: 24-code-review-guidance-documentation
source: [24-01-PLAN.md, 24-02-PLAN.md, 24-03-PLAN.md]
started: 2026-02-08T12:00:00Z
updated: 2026-02-08T12:05:00Z
---

## Current Test

number: 6
name: Reset to defaults works
expected: |
  In Settings > Review tab, click "Reset to defaults" on the Feature section. The default items should be restored, and any custom items removed.
awaiting: user response

## Tests

### 1. Review checklist appears in FinishFlowDialog
expected: Open a Gitflow-initialized repo, start a feature branch, make a commit, then click "Finish Feature". The FinishFlowDialog should show a "Review checklist" section with 3 default items.
result: pass

### 2. Checklist is advisory (never blocks Finish button)
expected: In the FinishFlowDialog, check some items and leave others unchecked. The "Finish" button should remain enabled regardless of checked state. Clicking Finish should complete the merge normally.
result: pass

### 3. Settings blade has a Review tab
expected: Open Settings (Cmd/Ctrl+,) and look for a "Review" tab. It should appear alongside the other tabs (General, Git, Integrations, Appearance). Clicking it shows 3 flow type sections (Feature, Release, Hotfix) with their default checklist items.
result: pass

### 4. Custom checklist items persist
expected: In Settings > Review tab, add a custom item to the Feature checklist (e.g., "Linting passed"). Close and reopen Settings — the custom item should still be there.
result: pass

### 5. Custom items appear in FinishFlowDialog
expected: After adding a custom item in Settings > Review, start and finish a new feature. The custom item should appear in the review checklist alongside the defaults.
result: issue
reported: "when i create a feature. a feature branch is not created, when finish feature, it should merge. Review implementation of git flow"
severity: major

### 6. Reset to defaults works
expected: In Settings > Review tab, click "Reset to defaults" on the Feature section. The default items should be restored, and any custom items removed.
result: [pending]

### 7. Documentation site builds successfully
expected: Run `npm run docs:build` in the terminal. The command should complete without errors and produce output in `docs/.vitepress/dist/`.
result: [pending]

### 8. Documentation landing page
expected: Run `npm run docs:dev` and open the local server URL. The landing page should show a FlowForge hero section with "Get Started" and "View on GitHub" action buttons, plus 3 feature cards.
result: [pending]

### 9. Getting Started guide content
expected: Navigate to Getting Started page. It should contain installation instructions, how to open your first repository, and how to initialize Gitflow.
result: [pending]

### 10. Keyboard shortcuts reference
expected: Navigate to Reference > Keyboard Shortcuts. A table should list all app shortcuts including Cmd/Ctrl+O (Open), Cmd/Ctrl+, (Settings), Cmd/Ctrl+Shift+A (Stage all), Escape (back), and others.
result: [pending]

### 11. GitHub Actions deployment workflow
expected: The file `.github/workflows/docs.yml` should exist with a valid workflow that deploys to GitHub Pages on push to main when docs change.
result: [pending]

## Summary

total: 11
passed: 4
issues: 1
pending: 6
skipped: 0

## Gaps

- truth: "Custom checklist items appear in FinishFlowDialog alongside defaults when finishing a feature"
  status: failed
  reason: "User reported: when i create a feature. a feature branch is not created, when finish feature, it should merge."
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
