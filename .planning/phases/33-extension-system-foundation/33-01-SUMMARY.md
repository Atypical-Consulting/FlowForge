---
phase: 33-extension-system-foundation
plan: 01
subsystem: ui
tags: [typescript, xstate, blade-registry, command-registry, extension-system]

# Dependency graph
requires:
  - phase: 32-toolbar-overhaul
    provides: "Toolbar registry with Map-based storage and source tracking pattern"
provides:
  - "CoreBladeType, ExtensionBladeType, widened BladeType union"
  - "bladeRegistry: unregisterBlade(), unregisterBySource(), clearCoreRegistry(), source tracking"
  - "commandRegistry: Map-based, unregisterCommand(), unregisterCommandsBySource(), getOrderedCategories(), source tracking"
  - "Navigation machine dynamic singleton check via bladeRegistry"
  - "Overloaded blade opener signatures for extension types"
affects: [33-02-PLAN, 33-03-PLAN, extension-host, extension-manifest]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CoreType | ExtensionType union pattern for widened type systems"
    - "Function overloads for core type-safety + extension string flexibility"
    - "Source tracking on registry entries for extension cleanup"
    - "Dynamic singleton check via registry instead of static Set"
    - "getOrderedCategories() pattern for dynamic category ordering"

key-files:
  created: []
  modified:
    - "src/stores/bladeTypes.ts"
    - "src/lib/bladeRegistry.ts"
    - "src/lib/commandRegistry.ts"
    - "src/machines/navigation/types.ts"
    - "src/machines/navigation/navigationMachine.ts"
    - "src/lib/bladeOpener.ts"
    - "src/hooks/useBladeNavigation.ts"
    - "src/components/command-palette/CommandPalette.tsx"
    - "src/blades/_discovery.ts"
    - "src/machines/navigation/navigationMachine.test.ts"

key-decisions:
  - "Used Record<string, unknown> for navigation event props (broadest type, machine does not inspect props)"
  - "Used function overloads (not conditional types) for bladeOpener and useBladeNavigation extension support"
  - "Replaced static SINGLETON_TYPES Set with dynamic isSingletonBlade() from bladeRegistry for extensibility"
  - "Used (string & {}) trick to widen CommandCategory while preserving IDE autocompletion"

patterns-established:
  - "Extension type convention: ext:{extensionId}:{name} for blades and commands"
  - "Source field convention: 'core' for built-in, 'ext:{extensionId}' for extensions"
  - "clearCoreRegistry() pattern: HMR dispose clears only core registrations"

# Metrics
duration: 12min
completed: 2026-02-10
---

# Phase 33 Plan 01: Registry Extensibility Refactoring Summary

**Widened blade/command registries with CoreType|ExtensionType unions, Map-based storage, source tracking, unregister functions, and dynamic navigation machine singleton check**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-10T10:34:40Z
- **Completed:** 2026-02-10T10:47:23Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- BladeType widened to CoreBladeType | ExtensionBladeType with isCoreBladeType() runtime guard
- bladeRegistry refactored to string-keyed Map with unregisterBlade(), unregisterBySource(), clearCoreRegistry(), and source tracking
- commandRegistry migrated from array to Map<string, Command> with O(1) lookups, unregisterCommand(), unregisterCommandsBySource(), and getOrderedCategories()
- Navigation machine singleton check made dynamic via isSingletonBlade() from bladeRegistry
- bladeOpener and useBladeNavigation have overloaded signatures preserving core type-safety while accepting extension types
- CommandPalette derives category ordering dynamically, with core categories first and extension categories appended alphabetically
- HMR dispose now uses clearCoreRegistry() to preserve extension registrations during hot reload

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen BladeType system and refactor bladeRegistry for extensibility** - `c76cfda` (feat)
2. **Task 2: Widen navigation machine and blade openers for extension types** - `4ba1916` (feat)
3. **Task 3: Refactor commandRegistry to Map-based storage with unregister and dynamic categories** - `ae1900f` (feat)

## Files Created/Modified
- `src/stores/bladeTypes.ts` - Added CoreBladeType, ExtensionBladeType, isCoreBladeType(), widened BladeType and TypedBlade
- `src/lib/bladeRegistry.ts` - String-keyed Map, source field, unregisterBlade(), unregisterBySource(), clearCoreRegistry()
- `src/blades/_discovery.ts` - Updated HMR dispose to use clearCoreRegistry()
- `src/machines/navigation/types.ts` - Re-exported CoreBladeType/ExtensionBladeType, widened event props to Record<string, unknown>
- `src/machines/navigation/navigationMachine.ts` - Replaced static SINGLETON_TYPES with dynamic isSingletonBlade()
- `src/lib/bladeOpener.ts` - Added overloaded signatures for core + extension blade types
- `src/hooks/useBladeNavigation.ts` - Added overloaded signatures for openBlade, pushBlade, replaceBlade
- `src/lib/commandRegistry.ts` - Map-based storage, CoreCommandCategory, widened CommandCategory, source field, unregister functions, getOrderedCategories()
- `src/components/command-palette/CommandPalette.tsx` - Replaced hardcoded CATEGORY_ORDER with getOrderedCategories()
- `src/machines/navigation/navigationMachine.test.ts` - Added beforeEach to register singleton blade types for isSingletonBlade()

## Decisions Made
- Used `Record<string, unknown>` for PUSH_BLADE/REPLACE_BLADE event props since the navigation machine does not inspect props -- it just stores them. All core blade props are subtypes of `Record<string, unknown>`.
- Used function overloads (not conditional types or branded types) for bladeOpener and useBladeNavigation to keep the extension string overload simple while preserving compile-time safety for core blade props.
- Replaced the static `SINGLETON_TYPES` Set with dynamic `isSingletonBlade()` from bladeRegistry so extensions that register with `singleton: true` are automatically treated as singletons by the navigation machine.
- Used `(string & {})` trick for CommandCategory widening to preserve VS Code autocompletion for core categories while accepting any extension category string.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed navigation machine singleton tests after isSingletonBlade refactoring**
- **Found during:** Task 2 (Navigation machine widening)
- **Issue:** Tests 9 and "singleton duplicate push triggers notifySingletonExists" failed because isSingletonBlade() returned false -- the blade registry was empty in test context (no blades registered)
- **Fix:** Added beforeEach in navigationMachine.test.ts that registers all 5 singleton blade types (settings, changelog, gitflow-cheatsheet, conventional-commit, repo-browser) with cleanup in the return function
- **Files modified:** src/machines/navigation/navigationMachine.test.ts
- **Verification:** All 32 navigation machine tests pass
- **Committed in:** `4ba1916` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Auto-fix necessary for test correctness after singleton guard refactoring. No scope creep.

## Issues Encountered
None beyond the test fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three registries (blade, command, toolbar) now accept dynamic extension registrations with source tracking and cleanup
- Plan 33-02 (Extension Manifest and Loader) can define the manifest schema knowing registries accept string-keyed types
- Plan 33-03 (ExtensionHost) can call registerBlade/registerCommand/unregisterBySource knowing the APIs exist
- All existing core blade/command registrations continue to work unchanged with full type safety

## Self-Check: PASSED

All 10 modified files exist on disk. All 3 task commits verified in git log.

---
*Phase: 33-extension-system-foundation*
*Completed: 2026-02-10*
