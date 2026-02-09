# Quick Task 29: Fix XState navigation machine stopped actor preventing blade opens

## Summary

Fixed a bug where opening repo-browser or changelog blades after navigating to a repository would fail with the error: `Event "PUSH_BLADE" was sent to stopped actor "x:0 (x:0)"`.

## Root Cause

`React.StrictMode` (enabled in dev via `main.tsx`) causes components to mount → unmount → remount. The `NavigationProvider` in `context.tsx`:

1. Created and **started** the actor in `useMemo` (stable across StrictMode remounts)
2. Stopped the actor in `useEffect` cleanup during the unmount phase
3. On remount, `useMemo` returned the **same stopped actor** — XState v5 actors cannot be restarted once stopped
4. All subsequent `PUSH_BLADE` events were silently dropped

## Fix

**File:** `src/machines/navigation/context.tsx`

- Replaced `useMemo` with `useState` for actor creation
- Moved `actor.start()` from the factory function into `useEffect`
- Added stopped-actor detection: if `actorRef.getSnapshot().status === "stopped"`, a fresh actor is created via `setActorRef(fresh)`, triggering a new `useEffect` cycle
- On remount after StrictMode cleanup, a fresh actor is created and started

## Verification

- TypeScript compilation: passes (no new errors)
- All 31 navigation machine tests pass
- The `PUSH_BLADE` event is now handled by a live actor after StrictMode remount

## Commit

`0410d3d` - fix(navigation): handle StrictMode double-mount stopping actor
