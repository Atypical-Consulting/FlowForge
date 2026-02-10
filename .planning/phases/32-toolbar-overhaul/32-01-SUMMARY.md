---
phase: 32-toolbar-overhaul
plan: 01
subsystem: ui
tags: [zustand, toolbar, registry, extensibility, settings, lucide-react]

# Dependency graph
requires:
  - phase: 30-architecture-overhaul
    provides: Domain-driven Zustand store structure, bladeOpener, commandRegistry patterns
provides:
  - ToolbarRegistry Zustand store with register/unregister/unregisterBySource/getGrouped API
  - 15 core ToolbarAction registrations covering all Header.tsx buttons
  - ToolbarSettings with hiddenActions persistence in settings slice
  - Shared queryClient module for non-React query invalidation
affects: [32-02-toolbar-renderer, 33-extension-system]

# Tech tracking
tech-stack:
  added: []
  patterns: [toolbar-registry-pattern, extension-source-tracking, module-level-loading-flags]

key-files:
  created:
    - src/lib/toolbarRegistry.ts
    - src/commands/toolbar-actions.ts
    - src/lib/queryClient.ts
  modified:
    - src/stores/domain/preferences/settings.slice.ts
    - src/main.tsx

key-decisions:
  - "Used union type for ToolbarGroup (not enum) so Phase 33 extensions can declare custom groups"
  - "Used Map<string, ToolbarAction> for O(1) lookup by ID, with new Map copy on mutation for immutable updates"
  - "Module-level boolean flags for sync loading state (fetch/pull/push) instead of a separate Zustand atom"
  - "Extracted queryClient to shared lib module so toolbar undo action can invalidate queries from non-React context"
  - "Registered theme-toggle as a marker action (no-op execute) for special widget rendering in Plan 02"

patterns-established:
  - "Toolbar action ID convention: core='tb:{name}', extensions='ext:{extId}:{name}'"
  - "unregisterBySource pattern: extensions register with source='ext:{extId}', cleanup removes all by source"
  - "when() conditions use .getState() for fresh reads, never closures"
  - "Side-effect barrel pattern for toolbar action registration (import triggers registerMany)"

# Metrics
duration: 5min
completed: 2026-02-10
---

# Phase 32 Plan 01: Toolbar Registry & Action Data Model Summary

**ToolbarRegistry Zustand store with 15 core action registrations, extension-ready unregisterBySource API, and settings-persisted hiddenActions for toolbar visibility**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-10T09:00:32Z
- **Completed:** 2026-02-10T09:05:32Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Created ToolbarRegistry Zustand store with register/registerMany/unregister/unregisterBySource/getGrouped API designed for Phase 33 extension contributions
- Registered all 15 core toolbar actions from Header.tsx inventory across 4 groups (app, git-actions, views, navigation) with correct priorities, shortcuts, when() conditions, and isLoading() indicators
- Extended settings slice with ToolbarSettings.hiddenActions array persisted through Tauri store, enabling user toolbar customization

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ToolbarRegistry Zustand store** - `d895b4e` (feat)
2. **Task 2: Register all 15 core toolbar actions** - `69e2190` (feat)
3. **Task 3: Extend settings slice with toolbar preferences** - `3b8d457` (feat)

## Files Created/Modified
- `src/lib/toolbarRegistry.ts` - ToolbarRegistry Zustand store with ToolbarAction/ToolbarGroup types, register/unregister/getGrouped methods
- `src/commands/toolbar-actions.ts` - Side-effect barrel registering 15 core toolbar actions with icons, groups, priorities, when() conditions
- `src/lib/queryClient.ts` - Shared QueryClient instance for non-React query invalidation (extracted from main.tsx)
- `src/stores/domain/preferences/settings.slice.ts` - Added ToolbarSettings interface, toolbar field to Settings, "toolbar" to SettingsCategory
- `src/main.tsx` - Updated to import queryClient from shared module

## Decisions Made
- **Union type for ToolbarGroup:** Chose union type over enum so Phase 33 extensions can extend with custom group strings without modifying the core type
- **Map for action storage:** Used Map<string, ToolbarAction> with immutable copy-on-write for O(1) ID lookups and clean Zustand reactivity
- **Module-level loading flags:** Used simple boolean flags for fetch/pull/push loading state instead of creating a separate Zustand atom -- keeps the registration file self-contained
- **Shared queryClient extraction:** Extracted QueryClient from main.tsx to src/lib/queryClient.ts so the toolbar undo action can invalidate queries from non-React module scope (deviation Rule 3)
- **Theme toggle as marker:** Registered tb:theme-toggle with no-op execute() as a marker action -- Plan 02 toolbar renderer will check for this ID and render the ThemeToggle widget instead

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted shared queryClient for non-React query invalidation**
- **Found during:** Task 2 (Register toolbar actions)
- **Issue:** The undo toolbar action needs to call queryClient.invalidateQueries() after performing undo, but the QueryClient was created locally inside main.tsx with no export
- **Fix:** Created src/lib/queryClient.ts with the same QueryClient configuration, updated main.tsx to import from it
- **Files modified:** src/lib/queryClient.ts (new), src/main.tsx (updated import)
- **Verification:** TypeScript compiles cleanly, main.tsx still uses the same QueryClient instance
- **Committed in:** 69e2190 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for undo action correctness. Clean extraction with no behavioral change. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ToolbarRegistry store is complete and ready for Plan 02 to consume via useToolbarRegistry hook
- All 15 actions registered -- Plan 02 will render them as ToolbarButton components
- Settings slice supports hiddenActions -- Plan 02 toolbar can filter hidden actions
- The toolbar-actions.ts file needs to be imported from commands/index.ts or App.tsx at startup (Plan 02 will wire this)

## Self-Check: PASSED

All 6 files verified present. All 3 task commits verified in git log.

---
*Phase: 32-toolbar-overhaul*
*Completed: 2026-02-10*
