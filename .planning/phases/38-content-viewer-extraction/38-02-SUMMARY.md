---
phase: 38-content-viewer-extraction
plan: 02
status: complete
completed: 2026-02-10
---

# Plan 38-02 Summary: Content-viewers extension + graceful degradation

## What was built

Created the content-viewers built-in extension that takes ownership of markdown, code, and 3D viewer registrations. Old registration files deleted. BladeRenderer now shows a friendly fallback when a blade's extension is disabled.

## Key changes

### Created
- `src/extensions/content-viewers/index.ts` — Extension entry point registering 3 viewer blades with `coreOverride: true` and `React.lazy()`
- `src/extensions/__tests__/content-viewers.test.ts` — 6 lifecycle tests

### Deleted
- `src/blades/viewer-markdown/registration.ts` — Registration moved to extension
- `src/blades/viewer-code/registration.ts` — Registration moved to extension
- `src/blades/viewer-3d/registration.ts` — Registration moved to extension

### Modified
- `src/App.tsx` — Added `registerBuiltIn()` for content-viewers (before GitHub extension)
- `src/blades/_discovery.ts` — Removed `viewer-markdown`, `viewer-code`, `viewer-3d` from `EXPECTED_TYPES`
- `src/blades/_shared/BladeRenderer.tsx` — Replaced red "Unknown blade" text with Puzzle icon + "Open Extension Manager" link

## Deviations

None.

## Self-Check: PASSED

- [x] content-viewers extension registers viewer-markdown, viewer-code, viewer-3d
- [x] All three use coreOverride: true (original type names preserved)
- [x] All three use React.lazy() and lazy: true for on-demand loading
- [x] Old registration.ts files deleted
- [x] Blade component files remain in original locations
- [x] Extension registered in App.tsx before GitHub extension
- [x] _discovery.ts no longer includes extracted types
- [x] BladeRenderer shows graceful fallback for unregistered blades
- [x] Extension lifecycle tests pass (6/6)
- [x] All existing tests pass (187 passing, 3 pre-existing Monaco failures)
- [x] TypeScript compiles clean
