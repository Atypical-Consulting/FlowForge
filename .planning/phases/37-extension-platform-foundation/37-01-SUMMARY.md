---
phase: 37-extension-platform-foundation
plan: 01
status: complete
---

# Plan 37-01 Summary: New Registries + Tests

## What Was Built
Four new registries forming the data layer of the Extension Platform Foundation:
- **ContextMenuRegistry** — Zustand store for context menu item registration with location-based filtering, `when()` conditions, and group/priority sorting
- **SidebarPanelRegistry** — Zustand store for sidebar panel registration with priority-based ordering and visibility filtering
- **StatusBarRegistry** — Zustand store for status bar item registration with left/right alignment, priority sorting, and visibility filtering
- **GitHookBus** — Singleton event bus for git operation events with typed `onDid`/`onWill` handlers, error isolation, re-entrancy guard, and fail-open design

All registries support `unregisterBySource()` for atomic cleanup by extension source.

## Key Files Created
- `src/lib/contextMenuRegistry.ts` — ContextMenuRegistry Zustand store
- `src/lib/sidebarPanelRegistry.ts` — SidebarPanelRegistry Zustand store
- `src/lib/statusBarRegistry.ts` — StatusBarRegistry Zustand store
- `src/lib/gitHookBus.ts` — GitHookBus singleton class
- `src/lib/__tests__/contextMenuRegistry.test.ts` — 8 tests
- `src/lib/__tests__/sidebarPanelRegistry.test.ts` — 6 tests
- `src/lib/__tests__/statusBarRegistry.test.ts` — 7 tests
- `src/lib/__tests__/gitHookBus.test.ts` — 8 tests

## Test Results
29 tests passing across 4 test files (0 failures)

## Architecture Notes
- All three Zustand stores follow the exact `toolbarRegistry.ts` pattern: Map-based storage, immutable updates (`new Map(get().items)`), devtools middleware with `enabled: import.meta.env.DEV`
- Source tagging on every registry item enables atomic cleanup via `unregisterBySource()`
- ContextMenuRegistry sorts by group alphabetically, then by priority descending within group
- SidebarPanelRegistry and StatusBarRegistry include `visibilityTick` for forcing re-evaluation of `when()` conditions
- GitHookBus is a plain class (not Zustand) — pub/sub pattern with `emitDid` (parallel, `Promise.allSettled`) and `emitWill` (sequential, can cancel)
- GitHookBus re-entrancy guard (`reentryDepth` counter) prevents infinite loops when handlers trigger nested emits
- Error isolation throughout: handler errors are `console.error`'d but never propagated (fail-open design)

## Self-Check: PASSED
- [x] `npx tsc --noEmit` compiles without new errors
- [x] All 29 tests pass
- [x] Each registry has `register`, `unregister`, `unregisterBySource` with source tagging
- [x] ContextMenuRegistry has `getItemsForLocation` with when() filtering and group/priority sorting
- [x] SidebarPanelRegistry has `getVisiblePanels` with priority sorting
- [x] StatusBarRegistry has `getLeftItems`/`getRightItems` with alignment filtering and priority sorting
- [x] GitHookBus has `emitDid` (parallel, error-isolated) and `emitWill` (sequential, fail-open, can cancel)
- [x] GitHookBus re-entrancy guard prevents infinite hook loops
- [x] No changes to existing files — purely additive
