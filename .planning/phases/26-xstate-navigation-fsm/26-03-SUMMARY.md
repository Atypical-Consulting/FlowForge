# Plan 26-03 Summary: Consumer Migration + Direction-Aware Animations

## What Was Built
Migrated all blade store consumers from imperative Zustand calls to FSM events, added direction-aware blade animations, and deprecated the old blade store.

## Key Files
### Modified
- `src/hooks/useBladeNavigation.ts` — Rewritten to delegate to FSM actor via `useNavigationActorRef()` + `useSelector()`
- `src/lib/bladeOpener.ts` — Uses `getNavigationActor().send()` instead of `useBladeStore.getState()`, removed SINGLETON_TYPES array
- `src/hooks/useKeyboardShortcuts.ts` — Escape/Backspace/Enter handlers use `getNavigationActor()` for FSM events
- `src/lib/animations.ts` — Added `bladeTransitionVariants`, `bladeTransitionConfig`, and `BladeTransitionDirection` type
- `src/components/blades/BladeContainer.tsx` — Uses FSM selectors, direction-aware AnimatePresence, `useReducedMotion`, enhanced screen reader announcements
- `src/components/blades/ProcessNavigation.tsx` — Uses FSM actor for activeProcess/SWITCH_PROCESS
- `src/components/blades/BladeStrip.tsx` — Added `isDirty` prop with yellow dot indicator, border, and aria-label
- `src/components/Header.tsx` — Replaced `useBladeStore.getState().resetStack()` with `getNavigationActor().send({ type: "RESET_STACK" })`
- `src/components/blades/BladeBreadcrumb.tsx` — Switched from `useBladeStore()` to `useBladeNavigation()` hook
- `src/components/blades/DiffBlade.tsx` — Switched from `useBladeStore()` to `useBladeNavigation()` hook
- `src/components/blades/RepoBrowserBlade.tsx` — Switched from `useBladeStore()` to `useBladeNavigation()` hook
- `src/components/markdown/MarkdownLink.tsx` — Switched from `useBladeStore()` to `useBladeNavigation()` hook
- `src/stores/blades.ts` — Added deprecation comments on all exports
- `src/test-utils/render.tsx` — Added `NavigationProvider` wrapper for all component tests

## Architecture Decisions
- **Direction-aware animations**: `lastAction` from FSM context drives custom AnimatePresence variants — push slides right, pop slides left, replace crossfades, reset fade-scales
- **useReducedMotion**: All blade animations respect OS `prefers-reduced-motion` setting (duration: 0)
- **Screen reader announcements**: `aria-live="polite"` region announces action-specific messages (Opened/Returned to/Switched to/Navigated to)
- **isDirty prop on BladeStrip**: Prepared for Wave 4's dirty-form guards — yellow dot, border, and aria-label enhancement
- **NavigationProvider in test wrapper**: All component tests automatically get FSM actor context via `AllTheProviders`
- **FSM guard handles blade stack protection**: Escape/Backspace handlers simply send POP_BLADE — the FSM guard prevents popping the root blade

## Self-Check: PASSED
- [x] Zero `useBladeStore` imports in production code (only deprecated store def and its test)
- [x] useBladeNavigation() returns same API shape, delegates to FSM
- [x] bladeOpener.ts uses getNavigationActor().send()
- [x] Keyboard shortcuts use getNavigationActor()
- [x] BladeContainer shows direction-aware animations driven by lastAction
- [x] AnimatePresence uses custom prop for exit direction
- [x] Screen reader announcements include action type
- [x] ProcessNavigation sends SWITCH_PROCESS FSM event
- [x] useReducedMotion respected for accessibility
- [x] BladeStrip has isDirty prop with indicators
- [x] All 62 tests pass
- [x] App builds without errors
- [x] TypeScript clean
