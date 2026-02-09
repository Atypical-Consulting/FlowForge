# Quick Task 30: Make repo-browser a singleton blade + fix navigation actor lifecycle

## Summary

1. Added `"repo-browser"` to the `SINGLETON_TYPES` set so duplicate repo-browser blades cannot stack.
2. Rewrote `NavigationProvider` to use a **module-level singleton actor** that lives outside React lifecycle, completely eliminating the StrictMode double-mount problem from task 29.

## Root Cause (task 29 regression)

The task 29 fix used `useState` + `useEffect` with stopped-actor detection, but this still had a race condition: between detecting the stopped actor and creating a fresh one, children could briefly render with the stopped actor. The fundamental issue was tying actor lifecycle to React component lifecycle.

## Changes

| File | Change |
|------|--------|
| `src/machines/navigation/navigationMachine.ts:13` | Added `"repo-browser"` to `SINGLETON_TYPES` set |
| `src/machines/navigation/guards.ts:9` | Synced `SINGLETON_TYPES` — added `"conventional-commit"` and `"repo-browser"` |
| `src/machines/navigation/context.tsx` | Replaced React-managed actor with module-level singleton created at import time |

## How the singleton actor works

The actor is now created and started once at module import time (`const _navigationActor = createActor(navigationMachine); _navigationActor.start();`). The `NavigationProvider` simply exposes it via React context — no `useEffect`, no `useState`, no lifecycle management. This means:
- StrictMode double-mount has zero effect (actor never stops)
- `getNavigationActor()` never throws (actor always exists)
- No race conditions between actor lifecycle and React renders

## Verification

- TypeScript compilation: passes
- All 31 navigation machine tests pass

## Commits

- `415f2e7` - fix(navigation): add repo-browser to singleton blade types
- `a3bfc3d` - fix(navigation): use module-level singleton actor to avoid StrictMode issues
