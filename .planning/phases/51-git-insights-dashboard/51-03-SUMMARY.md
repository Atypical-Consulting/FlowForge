# Plan 51-03 Summary: Git Insights Extension Scaffold

## What Was Built

The full extension scaffold for the Git Insights Dashboard: manifest, Zustand store with devtools, data-loading hook, extension lifecycle (index.ts), the main dashboard blade shell, four stub chart components, and registration in App.tsx.

## Files Created (9)

| File | Purpose |
|------|---------|
| `src/extensions/git-insights/manifest.json` | Extension manifest declaring blades, commands, toolbar contribution |
| `src/extensions/git-insights/insightsStore.ts` | Zustand store with devtools middleware; manages insights data, branch health, time range filter, loading/error state |
| `src/extensions/git-insights/hooks/useInsightsData.ts` | React hook that triggers `loadInsights` + `loadBranchHealth` on mount and when time range changes |
| `src/extensions/git-insights/index.ts` | Extension lifecycle: registers blade, command, toolbar button; listens for `repository-changed` events for auto-refresh |
| `src/extensions/git-insights/blades/InsightsDashboardBlade.tsx` | Main dashboard blade with header, time range selector, stats cards, chart sections, and reusable DashboardCard wrapper |
| `src/extensions/git-insights/components/CommitActivityChart.tsx` | Stub component (placeholder for Plan 04 visx chart) |
| `src/extensions/git-insights/components/ContributorBreakdown.tsx` | Stub component (placeholder for Plan 04 pie chart) |
| `src/extensions/git-insights/components/BranchHealthOverview.tsx` | Stub component (placeholder for Plan 04 branch table) |
| `src/extensions/git-insights/components/RepoStatsCards.tsx` | Stub component (placeholder for Plan 04 stat cards) |

## Files Modified (1)

| File | Change |
|------|--------|
| `src/App.tsx` | Added import for `insightsActivate`/`insightsDeactivate` and `registerBuiltIn` call for the `git-insights` extension |

## Key Decisions

1. **Error message extraction**: Used `String(result.error.message)` instead of direct assignment because `GitError` variants like `StashNotFound` and `HunkIndexOutOfRange` have numeric `message` fields. This ensures the store's `error: string | null` type is always satisfied.

2. **Stub components**: Created four stub components that return minimal placeholder text. This prevents import errors in the dashboard blade while Plan 04 implements the actual visx charts.

3. **Store pattern**: Followed existing Zustand + devtools middleware pattern with action labels for Redux DevTools tracing. Silent failure for branch health (supplementary data) vs. error surfacing for primary insights.

4. **Auto-refresh**: Listens to `repository-changed` Tauri event, but only triggers refresh if insights data is already loaded (avoids unnecessary calls when dashboard hasn't been opened).

5. **Extension lifecycle**: Follows the topology extension pattern with lazy-loaded blade, command palette integration, toolbar contribution, and cleanup via `useInsightsStore.getState().reset()` on deactivation.

## Verification Results

- `npx tsc --noEmit --skipLibCheck` produces no errors from any git-insights or App.tsx files
- All grep checks pass: `git-insights` in App.tsx, `registerBlade` in index.ts, `repository-changed` listener, `getRepoInsights` in store
- Pre-existing TS2440 in bindings.ts is unrelated and expected
