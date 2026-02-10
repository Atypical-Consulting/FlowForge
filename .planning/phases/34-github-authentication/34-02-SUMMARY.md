---
phase: 34-github-authentication
plan: 02
subsystem: ui, extensions
tags: [toolbar, renderCustom, extensibility, built-in-extensions, zustand]

# Dependency graph
requires:
  - phase: 32-toolbar-extensibility
    provides: ToolbarAction interface, toolbar registry, Toolbar.tsx rendering
  - phase: 33-extension-system
    provides: ExtensionHost store, ExtensionAPI facade, extensionTypes
provides:
  - ToolbarAction.renderCustom property for custom widget rendering
  - ExtensionHost.registerBuiltIn() for first-party bundled extensions
  - BuiltInExtensionConfig type for built-in extension registration
  - Generic toolbar rendering (no hardcoded ID checks)
affects: [34-03-github-extension, future-extensions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "renderCustom callback pattern for toolbar widget customization"
    - "registerBuiltIn with synthetic manifest for bundled extensions"
    - "createElement() for JSX in .ts files (toolbar-actions)"

key-files:
  created: []
  modified:
    - src/lib/toolbarRegistry.ts
    - src/components/toolbar/Toolbar.tsx
    - src/commands/toolbar-actions.ts
    - src/extensions/ExtensionAPI.ts
    - src/extensions/ExtensionHost.ts
    - src/extensions/extensionTypes.ts

key-decisions:
  - "renderCustom on ToolbarAction replaces hardcoded ID checks -- fully generic widget rendering"
  - "createElement(ThemeToggle) in .ts file avoids TSX requirement for toolbar-actions"
  - "registerBuiltIn creates synthetic ExtensionManifest with 'as ExtensionManifest' cast for tracking"
  - "Built-in extensions share full ExtensionAPI lifecycle -- same cleanup, deactivation, namespacing"

patterns-established:
  - "renderCustom pattern: any toolbar action can provide custom rendering via callback"
  - "Built-in extension pattern: registerBuiltIn(config) for bundled first-party extensions"

# Metrics
duration: 7min
completed: 2026-02-10
---

# Phase 34 Plan 02: Toolbar Extensibility & Built-in Extension Registration Summary

**ToolbarAction.renderCustom for generic custom widgets plus ExtensionHost.registerBuiltIn() for bundled first-party extensions**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-10T11:45:59Z
- **Completed:** 2026-02-10T11:52:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `renderCustom` property to ToolbarAction interface for fully generic custom widget rendering
- Eliminated all hardcoded ID checks from Toolbar.tsx -- rendering is now 100% data-driven
- Migrated ThemeToggle to use the renderCustom pattern (moved from Toolbar.tsx to toolbar-actions.ts)
- Added `registerBuiltIn()` to ExtensionHost for first-party bundled extensions without filesystem discovery
- Added `BuiltInExtensionConfig` type with activate/deactivate lifecycle
- Built-in extensions receive full ExtensionAPI (namespaced registrations, tracked cleanup, standard deactivation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add renderCustom to ToolbarAction and refactor Toolbar.tsx** - `7470619` (feat)
2. **Task 2: Add registerBuiltIn to ExtensionHost for first-party bundled extensions** - `25336ff` (feat)

## Files Created/Modified
- `src/lib/toolbarRegistry.ts` - Added ReactNode import and renderCustom property to ToolbarAction interface
- `src/components/toolbar/Toolbar.tsx` - Replaced hardcoded tb:theme-toggle check with generic action.renderCustom, removed ThemeToggle import
- `src/commands/toolbar-actions.ts` - Added renderCustom callback using createElement(ThemeToggle) to tb:theme-toggle registration
- `src/extensions/ExtensionAPI.ts` - Added renderCustom to ExtensionToolbarConfig interface
- `src/extensions/extensionTypes.ts` - Added BuiltInExtensionConfig type with activate/deactivate callbacks
- `src/extensions/ExtensionHost.ts` - Added registerBuiltIn method to interface and implementation

## Decisions Made
- **renderCustom replaces ID checks:** Instead of checking `action.id === "tb:theme-toggle"`, Toolbar.tsx now checks `action.renderCustom` -- fully generic, any action can provide custom rendering
- **createElement over JSX:** toolbar-actions.ts is a `.ts` file (not `.tsx`), so used `createElement(ThemeToggle)` instead of JSX syntax
- **Synthetic manifest with cast:** registerBuiltIn creates a synthetic ExtensionManifest using `as ExtensionManifest` cast since built-in extensions don't have basePath; acceptable since manifest is only for display/tracking
- **Shared lifecycle:** Built-in extensions go through identical ExtensionAPI activation path as discovered extensions -- same namespacing, same cleanup, same deactivation via deactivateExtension(id)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- renderCustom is ready for the GitHub extension's rate-limit badge toolbar widget (Plan 03)
- registerBuiltIn is ready for activating the GitHub extension as a bundled first-party extension (Plan 03)
- Both patterns are generic and benefit all future extensions, not just GitHub

## Self-Check: PASSED

All 7 files verified present. Both commit hashes (7470619, 25336ff) found in git log.

---
*Phase: 34-github-authentication*
*Completed: 2026-02-10*
