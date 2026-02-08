---
phase: 22-new-content-blades
plan: 19
subsystem: ui
tags: [breadcrumb, navigation, keyboard-shortcuts, hmr, blade-system]

requires:
  - phase: 22-new-content-blades
    provides: "BladeBreadcrumb, useKeyboardShortcuts, bladeRegistry"
provides:
  - "Clean breadcrumb navigation without stack duplication"
  - "Global Backspace hotkey for blade back-navigation"
  - "Quiet HMR console (no duplicate registration warnings)"
affects: [blade-navigation, keyboard-shortcuts]

tech-stack:
  added: []
  patterns: ["Ancestor search before blade stack manipulation", "HMR-aware registration with import.meta.hot guard"]

key-files:
  created: []
  modified:
    - src/components/blades/BladeBreadcrumb.tsx
    - src/hooks/useKeyboardShortcuts.ts
    - src/lib/bladeRegistry.ts

key-decisions:
  - "Used manual reverse loop instead of findLastIndex (ES2023 not in tsconfig lib ES2020)"
  - "Used synchronous popToIndex + replaceBlade instead of setTimeout(0) to avoid React batching issues"
  - "Backspace uses enableOnFormTags: false to prevent interference with text editing"

patterns-established:
  - "Blade stack ancestor search pattern: manual loop for ES2020 compat, atomic pop+replace"

duration: 3min
completed: 2026-02-08
---

# Phase 22 Plan 19: Breadcrumb Dedup, Global Backspace, HMR Warning Suppression Summary

**Fixed breadcrumb stack duplication via ancestor search + atomic replace, added global Backspace back-navigation, suppressed HMR blade registration warnings**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T23:29:00Z
- **Completed:** 2026-02-07T23:30:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- BladeBreadcrumb navigateTo/navigateToRoot finds repo-browser ancestor before replacing (prevents stack duplication from diff blades)
- Global Backspace hotkey pops blade stack from any blade (not just repo browser)
- HMR re-registration warnings suppressed via import.meta.hot guard
- Used ES2020-compatible manual loop instead of findLastIndex

## Task Commits

1. **Task 1: Fix breadcrumb navigation to prevent duplicate repo-browser blades** - `b6a185e` (fix)
2. **Task 2: Global Backspace hotkey + HMR warning suppression** - `b6a185e` (fix, same commit)

## Files Created/Modified
- `src/components/blades/BladeBreadcrumb.tsx` - Ancestor search + atomic pop/replace
- `src/hooks/useKeyboardShortcuts.ts` - Backspace hotkey with enableOnFormTags: false
- `src/lib/bladeRegistry.ts` - import.meta.hot guard on duplicate warning

## Decisions Made
- Used manual reverse loop instead of findLastIndex (tsconfig lib is ES2020, findLastIndex is ES2023)
- Avoided setTimeout(0) from plan — used synchronous popToIndex + replaceBlade for atomic state update (prevents visual flash from React batching issues)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ES2020 compatibility for findLastIndex**
- **Found during:** Task 1 (Breadcrumb navigation fix)
- **Issue:** Plan used `findLastIndex` which is ES2023, but tsconfig.json has `"lib": ["ES2020"]`
- **Fix:** Used manual reverse `for` loop instead
- **Files modified:** src/components/blades/BladeBreadcrumb.tsx
- **Verification:** npx tsc --noEmit passes
- **Committed in:** b6a185e

**2. [Rule 1 - Bug] Avoided setTimeout(0) for state mutation**
- **Found during:** Task 1 (Breadcrumb navigation fix)
- **Issue:** Plan used `setTimeout(() => store.replaceBlade(...), 0)` after `popToIndex` — this breaks React 18 synchronous batching, causing potential visual flash
- **Fix:** Called `popToIndex` and `replaceBlade` synchronously (Zustand supports sequential synchronous calls within React event handlers)
- **Files modified:** src/components/blades/BladeBreadcrumb.tsx
- **Verification:** Both calls execute atomically in same React batch
- **Committed in:** b6a185e

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes improve correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
All wave 7 gap closure plans complete. Phase 22 ready for verification.

---
*Phase: 22-new-content-blades*
*Completed: 2026-02-08*
