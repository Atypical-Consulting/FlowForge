# Plan 26-01 Summary: XState Navigation Machine Definition + TDD Tests

## What Was Built
Core XState v5 navigation FSM that replaces the imperative Zustand blade store. Pure machine definition with no React/DOM dependencies.

## Key Files
### Created
- `src/machines/navigation/types.ts` — NavigationContext, NavigationEvent, ProcessType, LastAction types
- `src/machines/navigation/guards.ts` — SINGLETON_TYPES set (used by machine inline guards)
- `src/machines/navigation/actions.ts` — rootBladeForProcess() helper function
- `src/machines/navigation/navigationMachine.ts` — Full machine with setup(), inline guards/actions, 2 states
- `src/machines/navigation/selectors.ts` — 8 typed snapshot selectors
- `src/machines/navigation/navigationMachine.test.ts` — 28 pure machine tests
- `src/machines/navigation/index.ts` — Public barrel export

## Architecture Decisions
- **Flat FSM with 2 states**: `navigating` (normal) and `confirmingDiscard` (dirty-form dialog). Blade stack is data in context, not state nodes.
- **Record<string, true> for dirtyBladeIds**: Instead of Set to avoid reference equality issues with useSelector.
- **All guards/actions defined inline in setup()**: XState v5 provides full TypeScript inference when guards/actions are in setup(). External action definitions with ActionFunction type had 9 generic parameters that weren't worth fighting.
- **replayPendingEvent as single assign()**: Instead of enqueueActions with named action replay, uses a single assign() that reads context.pendingEvent and produces the correct state mutation. This avoids the problem of replayed actions reading from the wrong event.
- **Singleton enforcement hardcoded**: SINGLETON_TYPES set in machine file. Will move to registry-driven lookup in Plan 02.
- **Default max stack depth of 8**: Generous enough for normal usage, blocks runaway pushes.

## Test Results
- 28/28 tests passing
- 62/62 full suite tests passing
- 0 TypeScript errors (excluding pre-existing bindings.ts)

## Deviations from Plan
- Guards and actions moved inline into setup() instead of separate files (guards.ts/actions.ts kept for rootBladeForProcess helper and exported guard implementations, but the machine uses inline definitions for full type inference)
- 28 tests instead of planned 21 (added extra dirty-form replay scenarios)

## Self-Check: PASSED
- [x] Machine starts in navigating with staging root blade
- [x] All 6 navigation operations work (push/pop/popToIndex/replace/reset/switchProcess)
- [x] Singleton guard blocks duplicate pushes
- [x] Max depth guard blocks pushes at limit
- [x] Dirty-form guard routes to confirmingDiscard with pendingEvent
- [x] CONFIRM_DISCARD replays pending action (including SWITCH_PROCESS)
- [x] CANCEL_DISCARD returns to navigating with no changes
- [x] No React or DOM dependencies
- [x] machine.provide() allows guard overrides in tests
