# Quick Task 28: Fix BladeRegistry missing registration for viewer-3d

## Summary

Moved the `viewer-3d` blade registration file from the wrong location (`src/components/blades/viewer-3d.ts`) to the correct auto-discovered directory (`src/components/blades/registrations/viewer-3d.ts`).

## Root Cause

The `registrations/index.ts` uses `import.meta.glob(["./*.{ts,tsx}", "!./index.ts"], { eager: true })` to auto-discover blade registration files. The `viewer-3d.ts` file was one directory level up in `blades/` instead of `blades/registrations/`, so it was never imported and the `registerBlade()` call never executed.

## Changes

| File | Action |
|------|--------|
| `src/components/blades/registrations/viewer-3d.ts` | Created (moved from parent dir, updated import paths) |
| `src/components/blades/viewer-3d.ts` | Deleted (old misplaced location) |

### Import Path Updates

| Import | Old (`blades/`) | New (`blades/registrations/`) |
|--------|----------------|-------------------------------|
| bladeRegistry | `../../lib/bladeRegistry` | `../../../lib/bladeRegistry` |
| bladeUtils | `../../lib/bladeUtils` | `../../../lib/bladeUtils` |
| Viewer3dBlade | `./Viewer3dBlade` | `../Viewer3dBlade` |

## Verification

- TypeScript compilation: passes (no new errors)
- No other files imported the old `viewer-3d.ts` location
- The `viewer-3d` blade type is now auto-discovered by the registration index

## Commit

`977b28e` - fix(blade-registry): move viewer-3d registration to registrations directory
