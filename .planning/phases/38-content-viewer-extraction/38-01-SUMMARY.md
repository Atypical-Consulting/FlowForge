---
phase: 38-content-viewer-extraction
plan: 01
status: complete
completed: 2026-02-10
---

# Plan 38-01 Summary: ExtensionAPI coreOverride + viewer-plaintext fallback

## What was built

Added `coreOverride` flag to `ExtensionBladeConfig` and created a minimal `viewer-plaintext` core fallback blade.

## Key changes

### Created
- `src/blades/viewer-plaintext/ViewerPlaintextBlade.tsx` — Plain text fallback viewer (~40 lines, zero heavy deps)
- `src/blades/viewer-plaintext/registration.ts` — Core blade registration with React.lazy
- `src/blades/viewer-plaintext/index.ts` — Barrel export
- `src/blades/viewer-plaintext/ViewerPlaintextBlade.test.tsx` — 3 tests (text, loading, binary)

### Modified
- `src/extensions/ExtensionAPI.ts` — Added `coreOverride?: boolean` to `ExtensionBladeConfig`; widened `title` to support function; `registerBlade()` skips `ext:` prefix when `coreOverride: true`
- `src/stores/bladeTypes.ts` — Added `viewer-plaintext` to `BladePropsMap`
- `src/lib/fileDispatch.ts` — Browse fallback changed from `viewer-code` to `viewer-plaintext`
- `src/blades/_discovery.ts` — Added `viewer-plaintext` to `EXPECTED_TYPES`
- `src/extensions/__tests__/ExtensionAPI.test.ts` — 2 new tests for coreOverride registration and cleanup

## Deviations

None.

## Self-Check: PASSED

- [x] ExtensionBladeConfig has coreOverride?: boolean
- [x] registerBlade() conditionally skips ext: namespacing
- [x] Cleanup removes coreOverride blades via tracked type
- [x] viewer-plaintext renders file content as monospaced text
- [x] viewer-plaintext shows binary file placeholder
- [x] fileDispatch browse fallback is "viewer-plaintext"
- [x] All tests pass (181 passing, 3 pre-existing Monaco failures)
- [x] TypeScript compiles clean
