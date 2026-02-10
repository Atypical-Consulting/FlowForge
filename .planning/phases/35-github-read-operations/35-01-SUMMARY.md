---
phase: 35-github-read-operations
plan: 01
subsystem: api
tags: [github, rest-api, reqwest, tauri-commands, specta, pagination]

# Dependency graph
requires:
  - phase: 34-github-authentication
    provides: OAuth token storage in OS keychain, GitHub module structure, error enum
provides:
  - Shared authenticated GitHub API client (client.rs) with Link header pagination
  - PR list and detail Tauri commands (pulls.rs)
  - Issue list and detail Tauri commands with PR filtering (issues.rs)
  - Typed IPC structs for PR/issue data with camelCase serialization
  - TypeScript bindings for all 4 new commands and 10 IPC types
affects: [35-02, 35-03, frontend-github-hooks]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared-github-client, internal-vs-ipc-type-split, concrete-list-response-types, manual-query-string-construction]

key-files:
  created:
    - src-tauri/src/github/client.rs
    - src-tauri/src/github/pulls.rs
    - src-tauri/src/github/issues.rs
  modified:
    - src-tauri/src/github/types.rs
    - src-tauri/src/github/error.rs
    - src-tauri/src/github/mod.rs
    - src-tauri/src/lib.rs
    - src/bindings.ts

key-decisions:
  - "Manual query string construction instead of reqwest .query() -- avoids missing feature dependency in reqwest 0.13"
  - "Concrete PullRequestListResponse and IssueListResponse types instead of generic Paginated<T> -- avoids specta generic type issues"
  - "Internal deserialization types (GitHubPullRequest etc) separate from IPC types (PullRequestSummary etc) -- clean snake_case/camelCase boundary"
  - "Manual bindings.ts additions (pending specta regeneration on next tauri dev)"

patterns-established:
  - "client::github_get / github_get_with_params: reusable authenticated helpers for all GitHub API modules"
  - "Internal deserialization → IPC type conversion pattern for GitHub API responses"
  - "Link header pagination parsing via parse_next_page for all list endpoints"

# Metrics
duration: 15min
completed: 2026-02-10
---

# Phase 35 Plan 01: GitHub Read Backend Summary

**Authenticated GitHub REST API client with PR/issue list+detail Tauri commands, typed IPC structs, and Link header pagination**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-10T14:51:44Z
- **Completed:** 2026-02-10T15:06:54Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Shared authenticated HTTP client (client.rs) eliminates auth header duplication across all GitHub API modules
- 4 new Tauri commands: github_list_pull_requests, github_get_pull_request, github_list_issues, github_get_issue
- Internal deserialization types map GitHub API snake_case JSON; IPC types use camelCase for frontend
- Issues endpoint filters out PRs via pull_request field check
- Link header pagination properly extracts next page number
- TypeScript bindings added for all commands and 10 IPC types

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared GitHub API client, extend types and error enum** - `6d2f9be` (feat)
2. **Task 2: Create PR/issue Tauri commands and register in lib.rs** - `1fda1bc` (feat)

## Files Created/Modified
- `src-tauri/src/github/client.rs` - Shared authenticated HTTP helpers (github_get, github_get_with_params, parse_next_page, extract_rate_limit)
- `src-tauri/src/github/pulls.rs` - PR list and detail Tauri commands
- `src-tauri/src/github/issues.rs` - Issue list and detail Tauri commands with PR filtering
- `src-tauri/src/github/types.rs` - 7 internal deserialization types + 10 IPC types for PR/issue data
- `src-tauri/src/github/error.rs` - Added ApiError, NotFound, Forbidden variants
- `src-tauri/src/github/mod.rs` - Module declarations and command re-exports
- `src-tauri/src/lib.rs` - Import and register 4 new commands in collect_commands
- `src/bindings.ts` - TypeScript bindings for new commands and types

## Decisions Made
- **Manual query string construction:** reqwest 0.13's `.query()` method was not available without additional feature flags. Built query strings manually to avoid adding dependencies (Rule 3 auto-fix).
- **Concrete list response types:** Used `PullRequestListResponse` and `IssueListResponse` instead of generic `Paginated<T>` to avoid specta generic type issues per research findings.
- **Internal vs IPC type split:** GitHub API types (snake_case, Deserialize only) kept separate from frontend IPC types (camelCase, Serialize + Type derive) for clean boundary.
- **Manual bindings additions:** TypeScript bindings added manually since specta regeneration only runs during `tauri dev` (not plain `cargo build` on Windows).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced reqwest .query() with manual query string construction**
- **Found during:** Task 1 (client.rs creation)
- **Issue:** reqwest 0.13 `.query()` method not available -- caused compilation error `no method named 'query' found for struct 'RequestBuilder'`
- **Fix:** Built query string manually via string formatting instead of using `.query(params)`
- **Files modified:** src-tauri/src/github/client.rs
- **Verification:** cargo check passes
- **Committed in:** 6d2f9be (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- functionally equivalent query parameter handling without reqwest feature dependency.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 backend commands compiled and registered, ready for Plan 02 (frontend TanStack Query hooks)
- TypeScript bindings available for frontend consumption
- Pagination support built in for infinite scroll implementation

## Self-Check: PASSED

All 8 files verified present. Both task commits (6d2f9be, 1fda1bc) verified in git log. cargo check passes. TypeScript compiles cleanly.

---
*Phase: 35-github-read-operations*
*Completed: 2026-02-10*
