---
phase: 47
plan: 01
status: complete
---

## Summary

Split `_discovery.ts` blade type checking into `CORE_BLADE_TYPES` (9 types, `console.warn`) and `EXTENSION_BLADE_TYPES` (12 types, `console.debug`). Moved `ToggleSwitch` and `PermissionBadge` from `src/extensions/github/components/` to `src/core/components/ui/`, updated 3 core file imports, and replaced originals with re-exports for backward compatibility. Removed stale `init-repo/components/index.ts` comment file.

## Key Files

### Created
- `src/core/components/ui/ToggleSwitch.tsx` — ToggleSwitch component in core
- `src/core/components/ui/PermissionBadge.tsx` — PermissionBadge component in core

### Modified
- `src/core/blades/_discovery.ts` — Split EXPECTED_TYPES into CORE/EXTENSION lists
- `src/core/blades/extension-manager/components/ExtensionCard.tsx` — Import from core
- `src/core/blades/extension-manager/components/InstallExtensionDialog.tsx` — Import from core
- `src/core/blades/extension-detail/ExtensionDetailBlade.tsx` — Import from core
- `src/extensions/github/components/ToggleSwitch.tsx` — Re-export from core
- `src/extensions/github/components/PermissionBadge.tsx` — Re-export from core

### Deleted
- `src/extensions/init-repo/components/index.ts` — Stale comment-only file

## Deviations

None.

## Self-Check: PASSED
- [x] CORE_BLADE_TYPES and EXTENSION_BLADE_TYPES exist in _discovery.ts
- [x] No EXPECTED_TYPES remaining
- [x] Zero core/ imports from extensions/github/components/
- [x] TypeScript compiles with no new errors
- [x] Both components exist in src/core/components/ui/
