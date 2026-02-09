# Plan 29-02 Summary: Migrate 4 Simple Blades

## Status: COMPLETE

## What was built
- Migrated 4 simple self-contained blades to `src/blades/{name}/` directories
- Each blade has co-located component, test, registration (with React.lazy), and barrel
- Old registration files deleted from `components/blades/registrations/`

## Blades migrated
1. **viewer-image** — `src/blades/viewer-image/` (uses renderPathBreadcrumb)
2. **viewer-3d** — `src/blades/viewer-3d/` (uses renderPathBreadcrumb)
3. **commit-details** — `src/blades/commit-details/` (uses FileTreeBlade from _shared)
4. **repo-browser** — `src/blades/repo-browser/` (singleton, .tsx registration with BladeBreadcrumb JSX)

## Self-Check: PASSED
- tsc --noEmit passes
- vitest run — 19 files, 87 tests pass
- Dual-glob discovery finds all blade types

## Commit
- `89b71cb` refactor(29-02): migrate 4 simple blades to blade-centric structure
