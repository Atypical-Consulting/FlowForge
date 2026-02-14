---
phase: 53-workspace-layout-presets
plan: 01
subsystem: ui
tags: [zustand, tauri-store, layout-presets, command-palette, menu-bar, lucide-react]

# Dependency graph
requires:
  - phase: 52-visualization-welcome-polish
    provides: "Preferences store infrastructure with slice pattern and Tauri Store persistence"
provides:
  - "Layout preset definitions (Review, Commit, Explore, Focus) as typed data objects"
  - "Zustand layout slice with 7 actions and Tauri Store persistence"
  - "7 layout commands registered in command palette"
  - "View menu with layout preset and panel toggle entries"
affects: [53-02-PLAN, panel-wiring, keyboard-shortcuts, focus-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layout presets as data-driven configuration objects with typed PresetId union"
    - "Layout state slice with activePreset tracking and custom detection on manual resize"
    - "Transient UI state (focusedPanel) not persisted to Tauri Store"

key-files:
  created:
    - src/core/lib/layoutPresets.ts
    - src/core/stores/domain/preferences/layout.slice.ts
    - src/core/commands/layout.ts
  modified:
    - src/core/stores/domain/preferences/index.ts
    - src/core/commands/index.ts
    - src/core/components/menu-bar/menu-definitions.ts

key-decisions:
  - "Focus mode state (focusedPanel) is transient and not persisted -- exits on app restart"
  - "Manual resize sets activePreset to 'custom' to deselect all preset indicators"
  - "All panel IDs use string keys (sidebar, blades) for forward compatibility with future panels"

patterns-established:
  - "Layout preset data model: id, label, icon, description, layout (Record<string, number>), visiblePanels"
  - "Layout commands iterate LAYOUT_PRESETS array to auto-generate one command per preset"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 53 Plan 01: Layout Data Foundation Summary

**Layout preset definitions, Zustand layout slice with Tauri Store persistence, 7 command palette commands, and View menu layout entries**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T19:46:56Z
- **Completed:** 2026-02-14T19:49:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Defined 4 layout presets (Review, Commit, Explore, Focus) as typed data objects with panel size mappings and visibility arrays
- Created layout Zustand slice with 7 actions: setActivePreset, setPanelSizes, togglePanel, enterFocusMode, exitFocusMode, resetLayout, initLayout
- Registered 7 commands in the command palette: 4 preset selectors + toggle sidebar + reset layout + toggle focus mode
- Updated View menu with Layout section (4 presets) and Panels section (toggle sidebar, reset layout) separated by dividers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create layout preset definitions and Zustand layout slice** - `a6d3893` (feat)
2. **Task 2: Register layout commands and add View menu entries** - `6552046` (feat)

## Files Created/Modified
- `src/core/lib/layoutPresets.ts` - Layout preset definitions: LayoutPreset interface, PresetId type, LAYOUT_PRESETS array (4 presets), getPresetById helper
- `src/core/stores/domain/preferences/layout.slice.ts` - Zustand layout slice with LayoutState interface, 7 actions, Tauri Store persistence under "layout" key
- `src/core/stores/domain/preferences/index.ts` - Wired LayoutSlice into PreferencesStore union type and initAllPreferences()
- `src/core/commands/layout.ts` - 7 command registrations: 4 preset selectors, toggle sidebar (mod+\), reset layout, toggle focus mode
- `src/core/commands/index.ts` - Added layout.ts import for auto-registration at module load
- `src/core/components/menu-bar/menu-definitions.ts` - Added 5 icon imports, 4 layout preset entries, 2 panel toggle entries, and 2 dividers to View menu

## Decisions Made
- Focus mode state (focusedPanel) is transient -- not persisted to Tauri Store since it should reset on app restart
- Manual resize sets activePreset to "custom" rather than clearing it, enabling UI to detect non-preset state
- All panel IDs are open-ended strings (Record<string, number>) for forward compatibility with future panels

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Layout data foundation complete: presets, state management, commands, and menu entries all in place
- Ready for Plan 02 to wire layout state to the actual react-resizable-panels imperative API in RepositoryView
- Panel IDs ("sidebar", "blades") match existing Panel id props in the codebase

## Self-Check: PASSED

All 7 files verified present. Both task commits (a6d3893, 6552046) verified in git log.

---
*Phase: 53-workspace-layout-presets*
*Completed: 2026-02-14*
