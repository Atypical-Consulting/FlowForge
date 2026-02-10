---
phase: 32-toolbar-overhaul
plan: 02
subsystem: ui
tags: [react, toolbar, overflow, resize-observer, aria, roving-tabindex, tailwind, catppuccin]

# Dependency graph
requires:
  - phase: 32-toolbar-overhaul
    provides: ToolbarRegistry Zustand store with 15 registered core actions, settings.toolbar.hiddenActions
provides:
  - Toolbar component rendering grouped actions from registry with overflow menu
  - ToolbarButton with icon-only rendering and ShortcutTooltip
  - ToolbarGroup with visual dividers between intent groups
  - ToolbarOverflowMenu with count badge and dropdown
  - ResizeObserver-based overflow detection (useToolbarOverflow)
  - ARIA roving tabindex keyboard navigation (useRovingTabindex)
  - ToolbarSettings panel in Settings blade for show/hide preferences
  - Header.tsx refactored to thin composition shell
affects: [33-extension-system, future-toolbar-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [toolbar-composition-pattern, resize-observer-overflow, roving-tabindex-aria, data-toolbar-item-measurement]

key-files:
  created:
    - src/components/toolbar/Toolbar.tsx
    - src/components/toolbar/ToolbarButton.tsx
    - src/components/toolbar/ToolbarGroup.tsx
    - src/components/toolbar/ToolbarOverflowMenu.tsx
    - src/components/toolbar/useToolbarOverflow.ts
    - src/components/toolbar/useRovingTabindex.ts
    - src/blades/settings/components/ToolbarSettings.tsx
  modified:
    - src/components/Header.tsx
    - src/App.tsx
    - src/blades/settings/SettingsBlade.tsx

key-decisions:
  - "ThemeToggle rendered as compound widget via ID check (tb:theme-toggle) — data-toolbar-item wrapper enables roving tabindex participation"
  - "useToolbarOverflow uses prevWidth ref + requestAnimationFrame to avoid ResizeObserver infinite loop pitfall"
  - "ToolbarSettings shows ALL registered actions (not filtered by when()) so users can configure repo-specific actions even when no repo is open"
  - "Header.tsx kept at 174 lines (plan estimated 80-120) — excess is the 4 structural callbacks for repo/branch switching that the plan explicitly required to keep"

patterns-established:
  - "data-toolbar-item attribute pattern: used for both overflow measurement and roving tabindex focus management"
  - "Toolbar is purely declarative — reads from registry, contains zero business logic"
  - "Special widget rendering via action ID check (tb:theme-toggle → ThemeToggle component)"

# Metrics
duration: 7min
completed: 2026-02-10
---

# Phase 32 Plan 02: Toolbar UI Components & Header Refactor Summary

**Responsive toolbar with ResizeObserver overflow, ARIA roving tabindex, visual group dividers, and Header.tsx refactored from 417-line monolith to thin composition shell**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-10T09:08:56Z
- **Completed:** 2026-02-10T09:16:10Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Built 6-component toolbar tree: Toolbar, ToolbarButton, ToolbarGroup, ToolbarOverflowMenu, useToolbarOverflow, useRovingTabindex — rendering all actions from registry with no hardcoded buttons
- Refactored Header.tsx from 417 lines to 174 lines, removing all individual toolbar button JSX, handler functions, and 12 unused imports — now a thin shell composing [Logo, RepoSwitcher, BranchSwitcher, ProcessNav, Toolbar]
- Created ToolbarSettings panel in Settings blade with grouped checkbox toggles for showing/hiding each toolbar action, persisted via Tauri store

## Task Commits

Each task was committed atomically:

1. **Task 1: Create toolbar UI components** - `5873b11` (feat)
2. **Task 2: Refactor Header.tsx to thin shell and wire toolbar registration** - `609385d` (feat)
3. **Task 3: Add ToolbarSettings panel to Settings blade** - `f4d8f49` (feat)

## Files Created/Modified
- `src/components/toolbar/Toolbar.tsx` - Main composition component: reads registry, groups actions, renders with overflow + roving tabindex
- `src/components/toolbar/ToolbarButton.tsx` - Icon-only action button wrapped in ShortcutTooltip, with data-toolbar-item attribute
- `src/components/toolbar/ToolbarGroup.tsx` - Visual group wrapper with optional divider (bg-ctp-surface1)
- `src/components/toolbar/ToolbarOverflowMenu.tsx` - Overflow dropdown with count badge, role="menu", click-outside/Escape close
- `src/components/toolbar/useToolbarOverflow.ts` - ResizeObserver hook measuring data-toolbar-item children with rAF guard
- `src/components/toolbar/useRovingTabindex.ts` - ARIA roving tabindex: Arrow Left/Right wrap, Home/End jump, Tab exits naturally
- `src/blades/settings/components/ToolbarSettings.tsx` - Settings panel with checkbox toggles grouped by intent, reset-to-defaults button
- `src/components/Header.tsx` - Refactored to thin shell: structural components + Toolbar, removed all button JSX
- `src/App.tsx` - Added side-effect import for toolbar-actions registration
- `src/blades/settings/SettingsBlade.tsx` - Added Toolbar tab with PanelTop icon after Appearance

## Decisions Made
- **ThemeToggle as compound widget:** Toolbar checks for `tb:theme-toggle` action ID and renders `<ThemeToggle />` component instead of a standard `<ToolbarButton>`. Wrapped in a `data-toolbar-item` div so it participates in roving tabindex
- **ResizeObserver infinite-loop guard:** `useToolbarOverflow` stores `prevWidth` ref and skips height-only changes. Measurement is wrapped in `requestAnimationFrame` to batch layout reads
- **ToolbarSettings shows all actions:** Not filtered by `when()` conditions so users can configure visibility of repo-specific actions even when no repository is open
- **Header.tsx line count:** Plan estimated 80-120 lines but required keeping 4 complex async callbacks (handleRepoSwitch, performBranchSwitch, handleBranchSwitch, handleStashAndSwitch) plus stash-and-switch dialog. Result: 174 lines of purely structural navigation code with zero toolbar business logic

## Deviations from Plan

None - plan executed as written. The only notable observation is that Header.tsx at 174 lines exceeds the plan's 120-line target, but all excess lines are the structural callbacks and stash dialog that the plan explicitly required to keep. No toolbar business logic remains — the refactoring goal is fully met.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Toolbar UI is fully functional and renders all 15 core actions from registry
- Phase 33 extension system can register actions via `useToolbarRegistry.getState().register()` and they will render identically to core actions
- SyncButtons.tsx and SyncProgressDisplay.tsx are now dead code (sync handled by toolbar actions with toast feedback) — can be cleaned up in a future polish pass
- ToolbarSettings persists user customization — hidden actions survive app restarts

## Self-Check: PASSED

All 11 files verified present. All 3 task commits verified in git log.

---
*Phase: 32-toolbar-overhaul*
*Completed: 2026-02-10*
