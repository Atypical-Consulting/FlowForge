---
phase: 33-extension-system-foundation
plan: 03
subsystem: extensions
tags: [typescript, zustand, extension-api, dynamic-import, tauri-asset-protocol, lifecycle-management]

# Dependency graph
requires:
  - phase: 33-extension-system-foundation
    plan: 01
    provides: "Widened blade/command registries with source tracking, unregister functions, extension type conventions"
  - phase: 33-extension-system-foundation
    plan: 02
    provides: "Rust discover_extensions command and ExtensionManifest TypeScript types in bindings.ts"
provides:
  - "ExtensionHost Zustand store: discoverExtensions, activateExtension, deactivateExtension, activateAll, deactivateAll"
  - "ExtensionAPI facade: namespaced registerBlade, registerCommand, contributeToolbar, cleanup"
  - "Extension lifecycle wired into App.tsx: auto-discover/activate on repo open, deactivate on repo close/switch"
  - "CURRENT_API_VERSION constant for manifest compatibility checking"
  - "Barrel exports for complete extension system public API"
affects: [phase-34-github-auth, phase-35-github-extension, phase-36-extension-manager-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "convertFileSrc for Tauri asset protocol dynamic imports"
    - "Module-level Maps for non-serializable JS references (outside Zustand store)"
    - "Per-extension API facade pattern with constructor-injected ID for namespacing"
    - "Copy-on-write Map updates for Zustand reactivity"
    - "Cleanup-on-failure pattern: api.cleanup() in activation catch block"

key-files:
  created:
    - "src/extensions/extensionManifest.ts"
    - "src/extensions/extensionTypes.ts"
    - "src/extensions/ExtensionAPI.ts"
    - "src/extensions/ExtensionHost.ts"
    - "src/extensions/index.ts"
  modified:
    - "src/App.tsx"

key-decisions:
  - "Used convertFileSrc from @tauri-apps/api/core for dynamic import URLs (Tauri asset protocol)"
  - "Module-level Maps for extensionApis and extensionModules kept outside Zustand (non-serializable JS refs)"
  - "ExtensionAPI.registerBlade maps config.title to BladeRegistration.defaultTitle for API simplicity"
  - "Sequential await in activateAll/deactivateAll to avoid registry mutation race conditions"

patterns-established:
  - "Extension entry point loading: convertFileSrc(basePath + '/' + main) -> dynamic import -> onActivate(api)"
  - "Extension API facade: one instance per extension, constructor-injected ID, tracked registrations"
  - "Extension lifecycle hook in App.tsx: useEffect reacts to status (repoStatus) changes"

# Metrics
duration: 6min
completed: 2026-02-10
---

# Phase 33 Plan 03: Extension Host & API Runtime Summary

**ExtensionHost Zustand store with discovery/activation/deactivation lifecycle, per-extension ExtensionAPI facade with namespaced registry operations, and App.tsx integration triggered on repository open/close/switch**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-10T10:56:23Z
- **Completed:** 2026-02-10T11:02:10Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments
- ExtensionHost Zustand store manages full extension lifecycle: discovery via Rust command, apiVersion validation with toast errors, activation via dynamic import + onActivate, and clean deactivation with onDeactivate + cleanup
- ExtensionAPI facade provides per-extension namespaced registerBlade/registerCommand/contributeToolbar with automatic ext:{id}:{name} prefixing and tracked cleanup
- App.tsx wires extension lifecycle to repository state: opening a repo triggers discoverExtensions + activateAll, closing triggers deactivateAll, switching repos deactivates old then discovers new
- convertFileSrc from @tauri-apps/api/core used to convert filesystem paths to Tauri asset protocol URLs for dynamic import in the webview
- Barrel exports in index.ts expose the complete extension system public API for downstream phases

## Task Commits

Each task was committed atomically:

1. **Task 1: Create extension type definitions and manifest re-exports** - `64b3417` (feat)
2. **Task 2: Create ExtensionAPI facade with namespaced registration and cleanup** - `30317f7` (feat)
3. **Task 3: Create ExtensionHost Zustand store with lifecycle management** - `39bf8f4` (feat)
4. **Task 4: Wire ExtensionHost into app initialization lifecycle** - `16e4e12` (feat)

## Files Created/Modified
- `src/extensions/extensionManifest.ts` - Re-exports ExtensionManifest types from bindings.ts for stable import paths
- `src/extensions/extensionTypes.ts` - ExtensionStatus union and ExtensionInfo interface for frontend state
- `src/extensions/ExtensionAPI.ts` - Per-extension API facade with namespaced registration and tracked cleanup
- `src/extensions/ExtensionHost.ts` - Singleton Zustand store for extension discovery, activation, deactivation
- `src/extensions/index.ts` - Barrel exports for complete extension system public API
- `src/App.tsx` - Added useEffect to wire extension lifecycle to repository state changes

## Decisions Made
- Used `convertFileSrc` from `@tauri-apps/api/core` to convert absolute filesystem paths to Tauri asset protocol URLs for dynamic import. This is the standard Tauri v2 approach for loading local files in the webview.
- Kept `extensionApis` and `extensionModules` as module-level Maps outside the Zustand store because they hold non-serializable JS references (class instances, imported modules) that Zustand shouldn't track.
- Mapped `ExtensionAPI.registerBlade({ title })` to `BladeRegistration.defaultTitle` to give extension authors a simpler API while preserving the internal registry interface.
- Used sequential `await` (not `Promise.all`) in `activateAll`/`deactivateAll` to avoid race conditions from concurrent registry mutations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Extension system runtime is complete and ready for Phase 34 (GitHub Auth/OAuth)
- Extensions placed in `{repoPath}/.flowforge/extensions/{extId}/` with a `flowforge.extension.json` manifest will be automatically discovered and activated when the repo is opened
- The ExtensionAPI provides registerBlade, registerCommand, contributeToolbar for extensions to integrate with the app
- Phase 35 (GitHub Extension) can implement the `onActivate(api)` / `onDeactivate()` contract
- Phase 36 (Extension Manager UI) can read `useExtensionHost.getState().extensions` for the UI

## Self-Check: PASSED

All 7 files verified present on disk. All 4 task commits (64b3417, 30317f7, 39bf8f4, 16e4e12) found in git log.

---
*Phase: 33-extension-system-foundation*
*Plan: 03*
*Completed: 2026-02-10*
