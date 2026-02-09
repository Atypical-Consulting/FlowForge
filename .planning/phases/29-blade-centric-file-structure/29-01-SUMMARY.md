# Plan 29-01 Summary: Scaffold Shared Infrastructure & Discovery

## Status: COMPLETE

## What was built
- Moved 14 shared blade infrastructure files to `src/blades/_shared/` with barrel export
- Created dual-glob discovery module at `src/blades/_discovery.ts` scanning both old and new registration locations
- Extracted DiffSource type to `src/blades/diff/types.ts` with barrel re-export
- Configured TypeScript `@/*` path alias in tsconfig.json
- Updated all imports across the codebase (3 external consumers, 5 blade components, 2 registration files)

## Key files created
- `src/blades/_shared/index.ts` — barrel export for all 14 infrastructure components
- `src/blades/_discovery.ts` — dual-glob auto-discovery with HMR and dev-mode checks
- `src/blades/diff/types.ts` — extracted DiffSource type
- `src/blades/diff/index.ts` — public barrel for diff blade types

## Key files modified
- `src/App.tsx` — imports from `./blades/_discovery` instead of old registrations barrel
- `src/stores/bladeTypes.ts` — DiffSource from `../blades/diff`
- `src/lib/previewRegistry.ts` — DiffSource from `../blades/diff`
- `tsconfig.json` — added `baseUrl` and `paths` for `@/*`

## Deviations
- Skipped Biome `noPrivateImports` rule — requires Biome v2 (current: 1.9.0). CI boundary check script in Plan 06 serves as fallback.

## Self-Check: PASSED
- `tsc --noEmit` passes (only pre-existing TS2440 in bindings.ts)
- `vitest run` — 19 files, 87 tests pass
- All 15 blade types discoverable via dual-glob
- No stale infrastructure imports remain

## Commit
- `d1db005` refactor(29-01): scaffold blade-centric directory structure
