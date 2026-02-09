# Plan 29-06 Summary: Migrate Conventional-Commit + Final Cleanup

## Status: COMPLETE

## What was built
- Conventional-commit blade migrated with 6 sub-components co-located
- Old `src/components/blades/registrations/` directory deleted entirely
- `_discovery.ts` simplified from dual-glob to single-glob pattern
- CI boundary enforcement script created
- External barrel imports updated (Header.tsx, RepositoryView.tsx)

## Blades migrated
1. **conventional-commit** — 6 sub-components (CommitForm, CommitScopeInput, CommitTypeSelector, ConventionalCommitForm, ScopeCombobox, TypeCombobox)

## Cleanup performed
- Deleted old `components/blades/registrations/` directory
- Deleted old `components/blades/index.ts` barrel
- Updated `_discovery.ts` to single-glob: `./*/registration.{ts,tsx}`
- Updated Header.tsx: ProcessNavigation import from `../blades/_shared`
- Updated RepositoryView.tsx: BladeContainer import from `../blades/_shared`
- Created `scripts/check-blade-boundaries.sh` for CI enforcement

## Self-Check: PASSED
- tsc --noEmit passes
- vitest run — 19 files, 87 tests pass

## Commits
- `460f67b` refactor(29-06): migrate conventional-commit blade to blade-centric structure
- `4a28935` refactor(29-06): finalize blade-centric structure with single-glob and CI boundary check
