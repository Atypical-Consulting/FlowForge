---
status: complete
started: 2026-02-11
completed: 2026-02-11
---

# Plan 46-01 Summary: Foundation — Extract parseConventionalType + Fallback Blade

## What was built

1. **commitClassifier.ts** — Core utility extracting `parseConventionalType` from topology's `layoutUtils.ts`, breaking the dependency between `CommitTypeIcon` and the topology-graph directory.

2. **commit-list-fallback blade** — Minimal blade wrapping `CommitHistory` with blade navigation. Serves as graceful degradation when topology extension is disabled.

3. **Registry-aware rootBladeForProcess** — Now checks `useBladeRegistry` before returning `topology-graph`. Falls back to `commit-list-fallback` when topology blade is unregistered.

## Key files

### Created
- `src/core/lib/commitClassifier.ts` — parseConventionalType utility
- `src/core/blades/commit-list-fallback/CommitListFallbackBlade.tsx` — Fallback blade component
- `src/core/blades/commit-list-fallback/registration.ts` — Core blade registration

### Modified
- `src/core/components/icons/CommitTypeIcon.tsx` — Import from commitClassifier instead of topology layoutUtils
- `src/core/stores/bladeTypes.ts` — Added "commit-list-fallback" to BladePropsMap
- `src/core/blades/_discovery.ts` — Added "commit-list-fallback" to EXPECTED_TYPES
- `src/core/machines/navigation/actions.ts` — Registry-aware rootBladeForProcess
- `src/core/machines/navigation/navigationMachine.test.ts` — Register topology-graph in test setup

## Deviations

- Navigation machine tests needed topology-graph registered in beforeEach to pass, since rootBladeForProcess now checks the blade registry.

## Self-Check: PASSED
- TypeScript compilation clean (no new errors)
- All 32 navigation machine tests pass
- parseConventionalType extracted to core
- commit-list-fallback registered and discoverable
- rootBladeForProcess is registry-aware with fallback
