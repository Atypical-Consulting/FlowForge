---
phase: 45-init-repo-extraction
plan: 01
status: complete
started: 2026-02-11
completed: 2026-02-11
---

## Summary

Extracted the Init Repo blade from core (`src/blades/init-repo/`) into a toggleable built-in extension (`src/extensions/init-repo/`). The extension registers via `registerBuiltIn()` in App.tsx for early activation before any repository is open, which is critical for WelcomeView's BladeRegistry lookup.

## What Was Built

- **Extension entry point** (`index.ts`): `onActivate` registers blade with `coreOverride: true`, registers "Initialize Repository" command in palette under "Repository" category, and sets up store reset on dispose
- **Store** (`store.ts`): Moved Zustand blade store with all init-repo state (templates, README, commit config)
- **7 components**: InitRepoBlade, InitRepoForm, InitRepoPreview, TemplatePicker, TemplateChips, CategoryFilter, ProjectDetectionBanner — all moved with corrected import paths
- **App.tsx integration**: `registerBuiltIn({ id: "init-repo" })` call placed after worktrees, before github
- **_discovery.ts cleanup**: Removed "init-repo" from EXPECTED_TYPES (now registered by extension, not registration.ts)

## Key Files

### Created
- `src/extensions/init-repo/index.ts`
- `src/extensions/init-repo/store.ts`
- `src/extensions/init-repo/components/index.ts`
- `src/extensions/init-repo/components/InitRepoBlade.tsx`
- `src/extensions/init-repo/components/InitRepoForm.tsx`
- `src/extensions/init-repo/components/InitRepoPreview.tsx`
- `src/extensions/init-repo/components/TemplatePicker.tsx`
- `src/extensions/init-repo/components/TemplateChips.tsx`
- `src/extensions/init-repo/components/CategoryFilter.tsx`
- `src/extensions/init-repo/components/ProjectDetectionBanner.tsx`

### Modified
- `src/App.tsx` — added init-repo registerBuiltIn
- `src/blades/_discovery.ts` — removed "init-repo" from EXPECTED_TYPES

### Deleted
- `src/blades/init-repo/` — entire directory (registration.ts, index.ts, store.ts, InitRepoBlade.tsx, components/)

## Deviations

None.

## Self-Check: PASSED

- [x] All 10 files exist in `src/extensions/init-repo/`
- [x] TypeScript compiles cleanly (ignoring pre-existing TS2440)
- [x] coreOverride: true in blade registration
- [x] registerCommand for palette entry
- [x] "init-repo" removed from _discovery.ts EXPECTED_TYPES
- [x] Old src/blades/init-repo/ directory deleted
- [x] Store reset on extension disable via api.onDispose
