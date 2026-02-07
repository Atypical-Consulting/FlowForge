# Phase 19 UAT: Settings, Onboarding & File Icons

## Session
- Started: 2026-02-07
- Phase: 19 — Settings, Onboarding & File Icons
- Status: complete

## Tests

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Integrations tab visible in Settings | pass | 4 tabs visible: General, Git, Integrations, Appearance |
| 2 | Editor dropdown shows platform-appropriate options | pass | Enhancement: show icons for installed editors, add Antigravity |
| 3 | Terminal dropdown shows platform-appropriate options | pass | Enhancement: add Ghostty |
| 4 | Custom path input appears for integrations | pass | |
| 5 | Git tab shows identity fields (name, email, default branch) | pass | |
| 6 | Git identity fields load from global git config | pass | |
| 7 | Git identity changes auto-save with status indicator | pass | |
| 8 | Settings tabs navigate with arrow keys | pass | |
| 9 | Opening a non-git folder shows git init banner | pass | |
| 10 | Git init banner initializes repo and auto-opens it | issue | Main branch does not appear in branch list after init (empty repo, no commits yet) |
| 11 | Git init cancel dismisses the banner | pass | |
| 12 | File tree shows distinct icons for .ts, .rs, .json, .md files | pass | Enhancement: add .NET icons (.csproj, .nupkg, .props, .razor) |
| 13 | File tree shows image/font/archive/env icons for new types | pass | |

## Issues

### ISS-01: Main branch not visible after git init (minor)
- **Test**: #10
- **Observed**: After initializing a new repo, the "main" branch does not appear in the branch list
- **Expected**: Branch list should show "main" (or indicate empty repo state)
- **Root cause (likely)**: Fresh repo has no commits, so the branch ref doesn't exist yet — app may not handle this edge case

## Enhancement Requests (logged, not failures)

- **ENH-01**: Show icons indicating which editors/terminals are installed on the machine
- **ENH-02**: Add Antigravity (AI editor) to editor options
- **ENH-03**: Add Ghostty to terminal options
- **ENH-04**: Add file icons for .NET ecosystem (.csproj, .nupkg, .props, .razor, etc.)

## Summary
- Total: 13
- Passed: 12
- Issues: 1 (minor)
- Failed: 0
- Enhancements noted: 4
