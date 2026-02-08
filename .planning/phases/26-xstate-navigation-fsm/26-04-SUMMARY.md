# Plan 26-04 Summary: Dirty-Form Guards, Dialog, Cleanup

## What Was Built
NavigationGuardDialog for unsaved changes confirmation, useBladeFormGuard hook for registering dirty state, max depth toast notification, dirty indicators on BladeStrip, and additional machine tests.

## Key Files
### Created
- `src/components/blades/NavigationGuardDialog.tsx` — Confirmation dialog when FSM enters `confirmingDiscard` state, shows dirty blade titles, Stay/Discard actions
- `src/hooks/useBladeFormGuard.ts` — Hook returning `markDirty()`, `markClean()`, `isDirty` with auto-cleanup on unmount

### Modified
- `src/machines/navigation/navigationMachine.ts` — `notifyMaxDepth` action now calls `toast.info()` for max depth feedback
- `src/components/blades/BladeContainer.tsx` — Added `<NavigationGuardDialog />` at end of JSX
- `src/machines/navigation/navigationMachine.test.ts` — Added 3 new tests (CONFIRM_DISCARD after REPLACE_BLADE, CONFIRM_DISCARD after POP_TO_INDEX, switching process clears dirty state) → 31 total machine tests

## Architecture Decisions
- **Dialog visibility driven by FSM state**: `isConfirmingDiscard` selector maps directly to dialog open state — no local useState needed
- **Auto-cleanup in useBladeFormGuard**: `useEffect` cleanup sends `MARK_CLEAN` on unmount to prevent dirty state from leaking when blade components unmount
- **Toast for max depth**: Pragmatic side effect in FSM action — acceptable because this is a client-side machine, not a server-side one. The action is named so it can be overridden via `machine.provide()` in tests
- **No "Save and Leave" button**: Per UX research — there's no generic save action, so only Stay/Discard options are shown

## Self-Check: PASSED
- [x] NavigationGuardDialog appears when FSM enters confirmingDiscard
- [x] "Stay" sends CANCEL_DISCARD, "Discard Changes" sends CONFIRM_DISCARD
- [x] Dialog shows dirty blade title(s) in body
- [x] BladeStrip shows yellow dot + border for dirty blades (from Wave 3)
- [x] BladeStrip aria-label includes "Unsaved changes" for dirty blades
- [x] useBladeFormGuard hook provides markDirty/markClean/isDirty with auto-cleanup
- [x] Max depth toast fires when push is blocked
- [x] 31 machine tests pass covering all dirty-form scenarios
- [x] Old Zustand blade store marked deprecated, no production consumers
- [x] All 65 tests pass
- [x] App builds without errors
- [x] TypeScript clean
