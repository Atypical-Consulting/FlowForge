---
status: complete
started: 2026-02-08
completed: 2026-02-08
---

# Plan 27-03 Summary: InitRepoBlade Shell, React Query Hooks, and Form UI

## What was built
- **InitRepoBlade.tsx** — SplitPaneLayout with form (left) and preview (right), store hydration on mount, project detection auto-selecting recommended templates, cleanup on unmount
- **Blade registration** — `init-repo` type in BladePropsMap, EXPECTED_TYPES, and registration file (singleton)
- **3 React Query hooks** — `useGitignoreTemplateList`, `useGitignoreTemplateContent`, `useProjectDetection`
- **InitRepoForm.tsx** — 4 collapsible sections (core config, .gitignore, README, commit) with action bar, init pipeline, error handling
- **TemplatePicker.tsx** — Search with 150ms debounce, category tabs, multi-select listbox with keyboard navigation, loading skeletons, online/offline badge
- **TemplateChips.tsx** — Removable chips with "Clear all" link
- **CategoryFilter.tsx** — Horizontal scrollable category tabs from GITIGNORE_CATEGORIES
- **ProjectDetectionBanner.tsx** — Smart recommendation banner with quick-add buttons
- **InitRepoPreview.tsx** — Full preview panel with 4 context-sensitive views (gitignore, readme, commit, summary) with AnimatePresence transitions

## Key files
- `src/components/blades/InitRepoBlade.tsx`
- `src/components/blades/registrations/init-repo.ts`
- `src/hooks/useGitignoreTemplates.ts`
- `src/components/init-repo/InitRepoForm.tsx`
- `src/components/init-repo/InitRepoPreview.tsx`
- `src/components/init-repo/components/TemplatePicker.tsx`
- `src/components/init-repo/components/TemplateChips.tsx`
- `src/components/init-repo/components/CategoryFilter.tsx`
- `src/components/init-repo/components/ProjectDetectionBanner.tsx`

## Deviations
- Implemented InitRepoPreview in full during this plan (was planned for 27-04) to keep components co-located and avoid placeholder
- InitRepoBlade accepts `onCancel` and `onComplete` optional props for standalone mode (needed for welcome screen integration in 27-04)

## Self-Check: PASSED
- TypeScript compiles without errors
- `"init-repo"` in BladePropsMap and EXPECTED_TYPES
- All ARIA roles applied: listbox, option, tablist, tab, aria-live, aria-expanded
- Keyboard navigation in template picker (ArrowUp/Down, Space/Enter)
