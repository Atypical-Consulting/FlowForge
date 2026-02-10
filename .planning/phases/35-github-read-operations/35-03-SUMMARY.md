---
phase: 35-github-read-operations
plan: 03
subsystem: ui
tags: [react, react-virtuoso, tanstack-query, catppuccin, github-api, lucide-react, extension-system, toolbar]

# Dependency graph
requires:
  - phase: 35-github-read-operations
    provides: "5 shared GitHub UI components, 4 TanStack Query hooks, githubStore multi-remote support (plans 01+02)"
  - phase: 34-github-authentication
    provides: "GitHub auth store, extension system, MarkdownRenderer"
provides:
  - "4 GitHub blade components: PullRequestListBlade, PullRequestDetailBlade, IssueListBlade, IssueDetailBlade"
  - "2 toolbar buttons (Pull Requests, Issues) in views group with auth+remote visibility"
  - "2 command palette entries (View Pull Requests, View Issues) under GitHub category"
  - "Cache cleanup on extension deactivation and repo switch via queryClient.removeQueries"
  - "Complete Phase 35 user-facing features (GH-05 through GH-08, TB-07)"
affects: [github-extension, toolbar-registry, blade-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Virtuoso infinite scroll for GitHub lists with endReached + useInfiniteQuery"
    - "State filter tabs (Open/Closed/All) for list blades with stale-while-revalidate"
    - "Remote selector dropdown for multi-remote support in list blades"
    - "queryClient.removeQueries for cache cleanup on deactivation and repo switch"

key-files:
  created:
    - src/extensions/github/blades/PullRequestListBlade.tsx
    - src/extensions/github/blades/PullRequestDetailBlade.tsx
    - src/extensions/github/blades/IssueListBlade.tsx
    - src/extensions/github/blades/IssueDetailBlade.tsx
  modified:
    - src/extensions/github/index.ts

key-decisions:
  - "Virtuoso for infinite scroll list rendering in both PR and issue list blades"
  - "Separate inner list component to avoid hooks conditionally called (remote guard is in outer component)"
  - "queryClient.removeQueries with ext:github key prefix for targeted cache cleanup"
  - "Toolbar actions in views group (not app group) with auth+remote when() conditions"

patterns-established:
  - "List blade pattern: outer component handles remote guard + filter state, inner component handles query + Virtuoso"
  - "Detail blade pattern: loading/error/data guards, header section, markdown body, comments timeline, external link"
  - "Cache cleanup pattern: queryClient.removeQueries({ queryKey: ['ext:github'] }) on deactivation and repo switch"

# Metrics
duration: 8min
completed: 2026-02-10
---

# Phase 35 Plan 03: GitHub PR/Issue Blades & Extension Wiring Summary

**4 blade components (PR list/detail, issue list/detail) with Virtuoso infinite scroll, state filter tabs, markdown rendering, toolbar buttons, and query cache lifecycle management**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-10T15:10:19Z
- **Completed:** 2026-02-10T15:18:00Z
- **Tasks:** 2 auto + 1 checkpoint (pending)
- **Files modified:** 5

## Accomplishments
- Created 4 blade components composing from shared components built in Plan 02 (StatusBadge, LabelPill, UserAvatar, TimeAgo, CommentCard)
- PullRequestListBlade and IssueListBlade both feature Virtuoso infinite scroll, state filter tabs (Open/Closed/All), and multi-remote selector
- PullRequestDetailBlade shows full PR info: header with branch info and diff stats, markdown body, comments timeline
- IssueDetailBlade shows full issue info: header with assignees and milestone, markdown body, comments timeline
- Extension index updated with 4 new blade registrations, 2 new commands, 2 new toolbar actions
- Cache cleanup on both extension deactivation and repository switch

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PR and issue list/detail blade components** - `697e276` (feat)
2. **Task 2: Register blades, toolbar, commands, and cache cleanup in extension index** - `f4aa9b9` (feat)

Task 3 is a visual verification checkpoint (pending).

## Files Created/Modified
- `src/extensions/github/blades/PullRequestListBlade.tsx` - PR list with Virtuoso infinite scroll, state filter tabs, remote selector
- `src/extensions/github/blades/PullRequestDetailBlade.tsx` - PR detail with header, stats, markdown body, comments timeline
- `src/extensions/github/blades/IssueListBlade.tsx` - Issue list with same pattern as PR list, issue-specific StatusBadge
- `src/extensions/github/blades/IssueDetailBlade.tsx` - Issue detail with assignees, milestone, markdown body, comments
- `src/extensions/github/index.ts` - 4 blade registrations, 2 commands, 2 toolbar actions, cache cleanup

## Decisions Made
- Used Virtuoso for infinite scroll rendering in list blades (already installed dependency)
- Separated inner list component from outer blade to avoid conditional hook calls (remote guard in outer, hooks in inner)
- Toolbar actions placed in "views" group (not "app") to appear alongside other view-related buttons
- Cache cleanup uses exact `["ext:github"]` query key prefix, matching the convention from Plan 02

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 35 engineering work complete
- Visual verification checkpoint pending (Task 3) to confirm UX quality
- After verification, Phase 35 is fully complete (GH-05, GH-06, GH-07, GH-08, TB-07)

## Self-Check: PASSED

All 5 files verified present on disk. Both commit hashes (697e276, f4aa9b9) verified in git log. TypeScript compiles cleanly (`npx tsc --noEmit` zero errors).

---
*Phase: 35-github-read-operations*
*Completed: 2026-02-10*
