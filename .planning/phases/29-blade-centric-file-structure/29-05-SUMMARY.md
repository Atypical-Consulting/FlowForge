# Plan 29-05 Summary: Migrate 4 Complex Blades

## Status: COMPLETE

## What was built
- Migrated staging-changes (10 sub-components + exclusive hook), diff (into existing directory), topology-graph (5 sub-components), and init-repo (6 sub-components + exclusive store)
- All imports updated across moved files and external consumers
- Old registration files and empty directories removed

## Blades migrated
1. **staging-changes** — 10 sub-components in components/, exclusive `useStagingKeyboard` hook in hooks/, ROOT blade (not lazy)
2. **diff** — merged into existing `src/blades/diff/` (types.ts from Plan 29-01); removed duplicate DiffSource type from DiffBlade.tsx
3. **topology-graph** — 5 sub-components (TopologyPanel, CommitBadge, LaneHeader, LaneBackground, layoutUtils), ROOT blade
4. **init-repo** — 6 sub-components, exclusive store moved as `store.ts` within blade

## Key decisions
- Staging store stays shared (used by both staging-changes and diff blades)
- Topology store stays shared (external consumers)
- Repository store stays shared (used broadly)
- initRepo store moved to blade (blade-exclusive)
- CommitTypeIcon updated to import `parseConventionalType` from new topology-graph location
- WelcomeView updated to import InitRepoBlade from new location

## Self-Check: PASSED
- tsc --noEmit passes (only pre-existing node:crypto error)
- vitest run — 19 files, 87 tests pass

## Commit
- `b32d8e0` refactor(29-05): migrate staging-changes, diff, topology-graph, and init-repo blades
