---
phase: 45-init-repo-extraction
plan: 02
status: complete
started: 2026-02-11
completed: 2026-02-11
---

## Summary

Added WelcomeView fallback UI for when the Init Repo extension is disabled. Users who disable the extension can still initialize a basic git repository via a "Run git init" button. Mid-session disable recovery prevents the UI from getting stuck.

## What Was Built

- **GitInitFallbackBanner** (`src/components/welcome/GitInitFallbackBanner.tsx`): Fallback banner matching GitInitBanner visual style (Catppuccin Mocha theme, fadeInUp animation). Shows "Run git init" button with loading spinner, error handling, and info text guiding users to enable the extension for the full experience.
- **WelcomeView conditional rendering**: Renders GitInitBanner when extension is enabled, GitInitFallbackBanner when disabled. Uses `initRepoRegistration` from BladeRegistry to determine which to show.
- **Mid-session disable recovery**: `useEffect` watches for `showInitRepo && !initRepoRegistration` and resets `showInitRepo` to false to prevent stuck "Preparing repository setup..." screen.

## Key Files

### Created
- `src/components/welcome/GitInitFallbackBanner.tsx`

### Modified
- `src/components/WelcomeView.tsx` — conditional render, mid-session recovery
- `src/components/welcome/index.ts` — barrel export for GitInitFallbackBanner

## Deviations

None.

## Self-Check: PASSED

- [x] GitInitFallbackBanner exists with "Run git init" button calling commands.gitInit(path, "main")
- [x] WelcomeView renders GitInitBanner when extension enabled, GitInitFallbackBanner when disabled
- [x] Mid-session disable useEffect resets showInitRepo
- [x] Fallback banner matches Catppuccin Mocha theme and GitInitBanner styling
- [x] Info text guides users to Settings > Extensions
- [x] Loading state with spinner during git init
- [x] TypeScript compiles cleanly (ignoring pre-existing TS2440)
