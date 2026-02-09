# Plan 30-04 Summary: UI State + Preferences Stores, Factory Migration, Reset Wiring, Barrel Export

**Status:** COMPLETE
**Duration:** ~15 min
**Commits:** `af9eb97`, `8adad24`

## What Changed

### Task 1: Create UI State and Preferences domain stores

**Files created:**
- `src/stores/domain/ui-state/types.ts` -- `UIStateMiddleware` type alias
- `src/stores/domain/ui-state/staging.slice.ts` -- Staging slice: `stagingSelectedFile`, `stagingSelectedSection`, `stagingViewMode`, `stagingScrollPositions`, `stagingFileListScrollTop` + actions
- `src/stores/domain/ui-state/command-palette.slice.ts` -- Command palette slice: `paletteIsOpen`, `paletteQuery`, `paletteSelectedIndex` + actions
- `src/stores/domain/ui-state/index.ts` -- Composed `useUIStore`, registered for reset
- `src/stores/domain/preferences/types.ts` -- `PreferencesMiddleware` type alias
- `src/stores/domain/preferences/settings.slice.ts` -- Settings slice: `settingsActiveCategory`, `settingsData` + actions
- `src/stores/domain/preferences/theme.slice.ts` -- Theme slice: `themePreference`, `themeResolved`, `themeIsLoading` + actions
- `src/stores/domain/preferences/navigation.slice.ts` -- Navigation slice: `navRepoDropdownOpen`, `navBranchDropdownOpen`, `navPinnedRepoPaths`, etc.
- `src/stores/domain/preferences/branch-metadata.slice.ts` -- Branch metadata slice: `metaPinnedBranches`, `metaRecentBranches`, `metaScopePreference` + actions
- `src/stores/domain/preferences/review-checklist.slice.ts` -- Review checklist slice: `checklistCustomItems` + actions
- `src/stores/domain/preferences/index.ts` -- Composed `usePreferencesStore`, NOT registered for reset, exports `initAllPreferences()`

**Files converted to re-export shims (7 files):**
- `src/stores/staging.ts`, `commandPalette.ts`, `settings.ts`, `theme.ts`, `navigation.ts`, `branchMetadata.ts`, `reviewChecklist.ts`

**Consumer files updated (21 files):**
- Settings blade components, staging blade components, command palette, Header, branch/repo switchers, theme toggle, keyboard shortcuts, branch list, review checklist, branch scopes, App.tsx, commands

### Task 2: Blade factory migration, reset wiring, barrel export

**Files modified:**
- `src/stores/conventional.ts` -- Rewritten to use `createBladeStore("conventional-commit", ...)` (auto-registered for reset)
- `src/blades/changelog/store.ts` -- Rewritten to use `createBladeStore("changelog", ...)`
- `src/blades/init-repo/store.ts` -- Rewritten to use `createBladeStore("init-repo", ...)`
- `src/stores/domain/git-ops/repository.slice.ts` -- `closeRepository()` now calls `resetAllStores()` + `getNavigationActor().send({ type: "RESET_STACK" })` atomically
- `src/components/Header.tsx` -- Removed duplicate `RESET_STACK` from `handleClose`

**Files created:**
- `src/stores/index.ts` -- Barrel export: `useGitOpsStore`, `useUIStore`, `usePreferencesStore`, `toast`, `resetAllStores`, `registerStoreForReset`, `createBladeStore`, blade types

**Key decisions:**
- Preferences store NOT registered for reset (survives repo switches)
- Toast store kept standalone (infrastructure, no reset needed)
- Conventional store kept at `src/stores/conventional.ts` (many external consumers) but uses `createBladeStore`
- `closeRepository()` handles both store reset and navigation FSM reset atomically (removed duplicate from Header.tsx)

## Verification

- `npx tsc --noEmit` -- 0 errors (excluding pre-existing node:crypto in test setup)
- `npm test` -- 82/82 tests pass across 18 test files
- Store count: 3 domain stores (git-ops, ui-state, preferences) + toast standalone + 3 blade-local stores using factory
- `resetAllStores()` resets gitOps, uiState, and blade stores but NOT preferences
