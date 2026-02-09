# Plan 30-02 Summary: Fix UX Bugs and Feature Gaps

**Status:** COMPLETE
**Duration:** ~5 min
**Commits:** `023a382`, `5e37aea`

## What Changed

### Task 1: Fix stale blade stack on close + wire defaultTab (ARCH-07, ARCH-08)

**Files modified:**
- `src/components/Header.tsx` -- Added `RESET_STACK` event dispatch in `handleClose` after `closeRepository()`
- `src/App.tsx` -- Imported `getNavigationActor`, wired `defaultTab` setting to `SWITCH_PROCESS` event on app startup after `initSettings()` completes

**Key decisions:**
- RESET_STACK sent after closeRepository (not before), matching the existing repo-switch pattern
- defaultTab applied via `.then()` on `initSettings()` to ensure settings are loaded from persistent storage first
- Only "topology" and "history" values trigger SWITCH_PROCESS (both map to topology process); "changes" is the default and requires no action

### Task 2: Topology empty state, command palette gitflow, review toasts (ARCH-09, ARCH-12, ARCH-13)

**Files created:**
- `src/blades/topology-graph/components/TopologyEmptyState.tsx` -- Illustrated empty state with inline SVG branch tree, heading, description, and "Go to Changes" CTA button

**Files modified:**
- `src/blades/topology-graph/components/TopologyPanel.tsx` -- Replaced bare-text empty state with `<TopologyEmptyState />` component
- `src/commands/navigation.ts` -- Registered `open-gitflow-cheatsheet` command with GitBranch icon, keywords, and `enabled` guard
- `src/stores/reviewChecklist.ts` -- Added `toast.warning()` in initChecklist catch, `toast.error()` in updateItems and resetToDefaults catch blocks

## Verification

- [x] `grep "RESET_STACK" src/components/Header.tsx` -- present in handleClose
- [x] `grep "defaultTab" src/App.tsx` -- setting read and applied on startup
- [x] `ls src/blades/topology-graph/components/TopologyEmptyState.tsx` -- file exists
- [x] `grep "TopologyEmptyState" src/blades/topology-graph/components/TopologyPanel.tsx` -- component imported and used
- [x] `grep "gitflow-cheatsheet" src/commands/navigation.ts` -- command registered
- [x] `grep -c "toast\." src/stores/reviewChecklist.ts` -- returns 3
- [x] `npm test` -- 82 tests pass (18 files)
- [x] `npx tsc --noEmit` -- no new errors (pre-existing bindings.ts and setup.ts errors only)

## Resolved Issues

| ID | Issue | Resolution |
|----|-------|------------|
| ARCH-07 | Stale blade stack on close | RESET_STACK sent after closeRepository |
| ARCH-08 | defaultTab setting not wired | Read on init, applied via SWITCH_PROCESS |
| ARCH-09 | Topology lacks empty state | SVG illustration + CTA button component |
| ARCH-12 | Gitflow cheatsheet not in command palette | Registered with keywords and enabled guard |
| ARCH-13 | Review store errors console-only | toast.warning/error added to 3 catch blocks |
