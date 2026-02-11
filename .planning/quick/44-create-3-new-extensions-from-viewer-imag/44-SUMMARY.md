# Quick Task 44 Summary

## Task
Create 3 new extensions from viewer-image, viewer-nupkg and viewer-plaintext. Move also related components, commands, hooks.

## What Changed

### New Extensions Created
- **viewer-image** — Image file viewer with base64 loading from working tree or commit history
- **viewer-nupkg** — NuGet package viewer that fetches metadata from NuGet.org
- **viewer-plaintext** — Plain text viewer with loading/error/binary states

### Each Extension Contains
- `manifest.json` — Extension metadata
- `index.ts` — Entry point with `onActivate`/`onDeactivate`, lazy loading, `coreOverride: true`
- `README.md` — Extension documentation
- `blades/` — Blade component + test (moved from `src/core/blades/`)
- `components/` — (viewer-nupkg only) `NugetPackageViewer.tsx` moved from `src/core/components/viewers/`

### Files Modified
- `src/App.tsx` — Added 3 `registerBuiltIn` calls for the new extensions
- `src/extensions/extensionCategories.ts` — Added viewer-image, viewer-nupkg, viewer-plaintext to "viewers" category
- `src/core/blades/_discovery.ts` — Removed viewer-image, viewer-nupkg, viewer-plaintext from `EXPECTED_TYPES`
- `src/core/components/viewers/index.ts` — Removed `NugetPackageViewer` re-export

### Files Deleted
- `src/core/blades/viewer-image/` (entire directory)
- `src/core/blades/viewer-nupkg/` (entire directory)
- `src/core/blades/viewer-plaintext/` (entire directory)
- `src/core/components/viewers/NugetPackageViewer.tsx`

### Tests Added
- `src/extensions/__tests__/viewer-image.test.ts` (6 tests)
- `src/extensions/__tests__/viewer-nupkg.test.ts` (6 tests)
- `src/extensions/__tests__/viewer-plaintext.test.ts` (6 tests)

## Verification
- TypeScript compiles clean (ignoring pre-existing bindings.ts TS2440)
- All 270 tests pass (18 new extension tests)
- No broken imports

## Commit
`cbdb0e2` — feat(quick-44): extract viewer-image, viewer-nupkg, viewer-plaintext to extensions
