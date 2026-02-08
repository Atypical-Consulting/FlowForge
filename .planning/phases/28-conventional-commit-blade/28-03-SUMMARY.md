# Plan 28-03 Summary: Blade Shell & Sidebar Coexistence

## Status: COMPLETE

## What Was Built
- **Blade registration**: `conventional-commit` type in `BladePropsMap` with `{ amend?: boolean }` props, singleton enforcement, auto-discovered registration
- **`ConventionalCommitBlade.tsx`**: Full-width blade with SplitPaneLayout (55/45 split), form panel (TypeSelector at 6 columns, taller body textarea), preview panel, footer with CommitActionBar
- **Sidebar coexistence**: Expand button (Maximize2 icon) opens blade, "Editing in blade view" placeholder when blade is open, state persists via shared Zustand store
- **Dirty form guard**: Marks dirty when description or commitType has content, auto-cleans on unmount

## Key Files

### Created
- `src/components/blades/ConventionalCommitBlade.tsx` — blade shell
- `src/components/blades/registrations/conventional-commit.ts` — blade registration

### Modified
- `src/stores/bladeTypes.ts` — added `"conventional-commit"` to BladePropsMap
- `src/components/blades/registrations/index.ts` — added to EXPECTED_TYPES
- `src/machines/navigation/navigationMachine.ts` — added to SINGLETON_TYPES
- `src/components/commit/CommitForm.tsx` — Expand button + blade detection + placeholder

## Self-Check: PASSED
- [x] Type check clean
- [x] Vite build succeeds
- [x] 87/87 tests pass
- [x] Blade registered as singleton
- [x] Sidebar Expand button shows only when CC enabled and blade not open

## Commit
`067a6e3` feat(28-03): add conventional commit blade shell with sidebar coexistence
