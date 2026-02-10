---
phase: 39-conventional-commits-extraction
plan: "01"
status: complete
started: 2026-02-10T22:20:00Z
completed: 2026-02-10T22:30:00Z
---

## Summary
Created the conventional-commits built-in extension that registers the conventional-commit and changelog blade types via coreOverride, replacing the old eager registration.ts side-effect files. The CommitForm component is now extension-aware: the CC toggle checkbox and expand button only appear when the conventional-commits extension is active, and useConventional auto-resets to false when the extension is disabled, leaving the simple textarea commit form fully functional.

## Tasks Completed
| # | Task | Status |
|---|------|--------|
| 1 | Create CC extension + register in App.tsx | done |
| 2 | Gate CommitForm CC toggle on extension status | done |

## Key Files
### Created
- `src/extensions/conventional-commits/index.ts` — CC extension entry point with onActivate/onDeactivate

### Modified
- `src/App.tsx` — registerBuiltIn for conventional-commits (between content-viewers and github)
- `src/blades/_discovery.ts` — removed "conventional-commit" and "changelog" from EXPECTED_TYPES
- `src/components/commit/CommitForm.tsx` — CC toggle gated on isCCActive, auto-reset useEffect

### Deleted
- `src/blades/conventional-commit/registration.ts`
- `src/blades/changelog/registration.ts`

## Deviations
None

## Self-Check
PASSED — TypeScript compiles cleanly (no new errors). All 187 tests pass. 3 pre-existing Monaco Editor test suite failures (DiffBlade, StagingChangesBlade, ViewerCodeBlade) are unrelated to these changes. All verification grep checks confirm correct wiring.
