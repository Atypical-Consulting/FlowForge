# Plan 29: Fix XState navigation machine stopped actor preventing blade opens

## Objective

Fix bug where `PUSH_BLADE` events are sent to a stopped XState actor, preventing repo-browser and changelog blades from opening after navigating to a repository.

## Root Cause

`React.StrictMode` in development mode causes components to mount → unmount → remount. The `NavigationProvider` in `context.tsx` creates and starts the actor in `useMemo`, then stops it in `useEffect` cleanup. On StrictMode remount, `useMemo` returns the same (now stopped) actor, and `useEffect` re-sets the stopped actor as the module-level reference.

In XState v5, once an actor is stopped it cannot be restarted — a new actor must be created.

## Fix

Modify `NavigationProvider` in `src/machines/navigation/context.tsx` to use `useRef` + `useState` pattern that detects a stopped actor and creates a fresh one on remount.

## Tasks

### Task 1: Fix NavigationProvider to handle StrictMode remount

**File:** `src/machines/navigation/context.tsx`

Replace `useMemo(() => createNavigationActor(), [])` with a pattern that:
1. Uses `useRef` to hold the actor
2. In `useEffect`, checks if actor needs to be (re)started
3. If the actor was stopped (by StrictMode cleanup), creates a fresh one
4. Provides the current live actor via context

The key change: move `actor.start()` out of the factory and into `useEffect`, and create a new actor if the previous one was stopped.
