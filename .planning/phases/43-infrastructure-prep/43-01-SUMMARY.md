---
plan: 43-01
status: complete
---

# Plan 43-01: Registry Migrations to Zustand

## What Was Built
Migrated `commandRegistry` and `previewRegistry` from plain Map/array module-level state to reactive Zustand stores with `devtools` middleware, following the exact pattern established by `bladeRegistry` in v1.6. Both stores default `source` to `"core"`, support `unregisterBySource()` for extension cleanup, and preserve full backward compatibility through function re-exports.

## Tasks Completed
| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Migrate commandRegistry to Zustand store | done | 0da9195 |
| 2 | Migrate previewRegistry to Zustand store with source field | done | e875162 |

## Key Files
### Created/Modified
- `src/lib/commandRegistry.ts` — Zustand store with `useCommandRegistry` hook, `CommandRegistryState` interface, devtools, and backward-compat function exports
- `src/lib/previewRegistry.ts` — Zustand store with `usePreviewRegistry` hook, `PreviewRegistryState` interface, new `source` field, and backward-compat function exports
- `src/blades/staging-changes/components/previewRegistrations.ts` — Added `source: "core"` to all 5 `registerPreview()` calls

## Self-Check
PASSED
- `npx tsc --noEmit` (excluding pre-existing bindings.ts error): zero new type errors
- `npx vitest run`: 233 tests pass, 33 test files pass; 3 failing suites are pre-existing Monaco mock issues (unrelated to this change)
- All backward-compatible function exports verified present
- All 12 consumer files continue importing the same function names with zero breaking changes

## Deviations
None
