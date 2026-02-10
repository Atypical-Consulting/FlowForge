---
phase: 39-conventional-commits-extraction
plan: "02"
status: complete
started: 2026-02-10T22:30:00Z
completed: 2026-02-10T22:40:00Z
---

## Summary
Wired `emitWill("commit")` pre-commit hook infrastructure into `useCommitExecution` so extensions can intercept and cancel commits via GitHookBus, and moved the changelog toolbar button and command palette entries (generate-changelog, open-conventional-commit) from core into the conventional-commits extension. Core command files no longer contain any CC-specific registrations, and disabling the CC extension removes these contributions via `api.cleanup()`.

## Tasks Completed
| # | Task | Status |
|---|------|--------|
| 1 | Wire emitWill pre-commit hook | done |
| 2 | Move toolbar/commands to CC extension | done |

## Key Files
### Modified
- `src/hooks/useCommitExecution.ts` — added `emitWill("commit")` before `createCommit` in both `commit()` and `commitAndPush()`, with warning toast on cancellation
- `src/extensions/conventional-commits/index.ts` — added `contributeToolbar` for changelog, `registerCommand` for generate-changelog and open-conventional-commit
- `src/commands/toolbar-actions.ts` — removed `tb:changelog` action and unused `FileText` import
- `src/commands/repository.ts` — removed `generate-changelog` command and unused `FileText`/`openBlade` imports

## Deviations
None

## Self-Check
PASSED — TypeScript compiles cleanly (no new errors). All 194 tests pass. 3 pre-existing Monaco Editor test suite failures (DiffBlade, StagingChangesBlade, ViewerCodeBlade) are unrelated to these changes. All verification grep checks confirm correct wiring: emitWill in useCommitExecution, tb:changelog removed from toolbar-actions, generate-changelog removed from repository.ts, contributeToolbar and registerCommand present in CC extension, FileText removed from core imports.
