---
phase: 35-github-read-operations
plan: 02
subsystem: ui
tags: [react, tanstack-query, zustand, catppuccin, github-api, lucide-react]

# Dependency graph
requires:
  - phase: 34-github-authentication
    provides: "GitHub auth store, extension system, MarkdownRenderer"
provides:
  - "5 shared GitHub UI components (StatusBadge, LabelPill, UserAvatar, TimeAgo, CommentCard)"
  - "4 TanStack Query hooks for PR/issue list and detail fetching"
  - "githubStore selectedRemoteIndex for multi-remote support"
  - "GitHub read operation TypeScript types in bindings.ts"
affects: [35-03-PLAN, github-extension-blades, pr-list-blade, issue-list-blade]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ext:github query key prefix for TanStack Query cache isolation"
    - "Inline style for dynamic hex colors (Tailwind cannot generate arbitrary runtime colors)"
    - "Named exports for all components (no default exports)"
    - "useInfiniteQuery for paginated GitHub lists with page-based pagination"

key-files:
  created:
    - src/extensions/github/components/StatusBadge.tsx
    - src/extensions/github/components/LabelPill.tsx
    - src/extensions/github/components/UserAvatar.tsx
    - src/extensions/github/components/TimeAgo.tsx
    - src/extensions/github/components/CommentCard.tsx
    - src/extensions/github/hooks/useGitHubQuery.ts
  modified:
    - src/extensions/github/githubStore.ts
    - src/bindings.ts

key-decisions:
  - "ext:github query key prefix for all GitHub TanStack Query hooks (cache isolation from core queries)"
  - "Manual bindings.ts additions for 4 GitHub read commands and 10 IPC types (pending specta regen)"
  - "No setInterval in TimeAgo -- re-rendered on parent rerender from query refetch"
  - "Inline styles for LabelPill colors because Tailwind v4 cannot generate dynamic hex at build time"

patterns-established:
  - "ext:github query key prefix: all GitHub extension queries use ['ext:github', resource, ...params]"
  - "GitHub component composition: StatusBadge + LabelPill + UserAvatar + TimeAgo + CommentCard are composable primitives"
  - "getSelectedRemote() convenience function for non-React access to selected remote"

# Metrics
duration: 6min
completed: 2026-02-10
---

# Phase 35 Plan 02: Shared Components & Query Hooks Summary

**5 reusable GitHub UI components with Catppuccin theming, 4 TanStack Query hooks with ext:github cache isolation, and githubStore multi-remote support**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-10T14:51:40Z
- **Completed:** 2026-02-10T14:58:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created 5 shared UI components: StatusBadge (4 PR + 2 issue states), LabelPill (dynamic hex colors), UserAvatar (image + fallback initials), TimeAgo (relative timestamps), CommentCard (avatar + markdown body)
- Created 4 TanStack Query hooks with ext:github cache key prefix: usePullRequestList, usePullRequestDetail, useIssueList, useIssueDetail
- Extended githubStore with selectedRemoteIndex and getSelectedRemote() for multi-remote support
- Added 4 command stubs and 10 TypeScript types to bindings.ts for GitHub read operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared GitHub UI components** - `d41ed53` (feat)
2. **Task 2: Create TanStack Query hooks and extend githubStore** - `68535fa` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `src/extensions/github/components/StatusBadge.tsx` - PR/issue state badge with Catppuccin colors and lucide icons
- `src/extensions/github/components/LabelPill.tsx` - Dynamic hex color label pill using inline styles
- `src/extensions/github/components/UserAvatar.tsx` - Avatar image with fallback initials on error
- `src/extensions/github/components/TimeAgo.tsx` - Relative timestamp (no timers, relies on parent rerender)
- `src/extensions/github/components/CommentCard.tsx` - Comment card composing UserAvatar, TimeAgo, and MarkdownRenderer
- `src/extensions/github/hooks/useGitHubQuery.ts` - 4 TanStack Query hooks with error extraction and cache isolation
- `src/extensions/github/githubStore.ts` - Extended with selectedRemoteIndex and getSelectedRemote()
- `src/bindings.ts` - Added 4 GitHub read command stubs and 10 IPC types

## Decisions Made
- Used `ext:github` query key prefix for all hooks (matches extension namespacing convention from Phase 33 `ext:{extId}:{name}`)
- Added bindings manually to bindings.ts (same approach as Phase 34-03, pending specta regeneration on next tauri dev)
- TimeAgo uses no setInterval -- parent re-renders from TanStack Query refetch update the timestamp naturally
- LabelPill uses inline `style` for background/text/border colors because Tailwind v4 cannot generate arbitrary hex colors at build time
- getSelectedRemote() as standalone function (not a hook) for non-React access to selected remote state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added GitHub read command stubs and types to bindings.ts**
- **Found during:** Task 2 (TanStack Query hooks)
- **Issue:** The hooks reference `commands.githubListPullRequests`, `commands.githubGetPullRequest`, `commands.githubListIssues`, `commands.githubGetIssue` which don't exist in bindings.ts yet (created by plan 35-01 Rust backend)
- **Fix:** Added 4 command stubs and 10 TypeScript types (PullRequestSummary, PullRequestDetail, IssueSummary, IssueDetail, CommentInfo, LabelInfo, UserInfo, MilestoneInfo, PullRequestListResponse, IssueListResponse) to bindings.ts manually
- **Files modified:** src/bindings.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 68535fa (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for compilation. Follows established precedent from Phase 34-03. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 shared components ready for consumption by PR list/detail and issue list/detail blades in plan 35-03
- All 4 query hooks ready for use in blade components
- githubStore supports multi-remote selection for plan 35-03 remote picker UI
- bindings.ts types will be auto-regenerated when Rust backend commands are registered and `tauri dev` runs specta

## Self-Check: PASSED

All 7 created/modified files verified present on disk. Both commit hashes (d41ed53, 68535fa) verified in git log.

---
*Phase: 35-github-read-operations*
*Completed: 2026-02-10*
