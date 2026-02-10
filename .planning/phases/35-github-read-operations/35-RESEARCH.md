# Phase 35: GitHub Read Operations - Research Synthesis

**Researched:** 2026-02-10
**Research Team:** UX specialist, Technical Architect, Expert Developer (Tauri/Rust/React/Tailwind v4)
**Detailed research:** See `35-RESEARCH-UX.md`, `35-RESEARCH-ARCHITECTURE.md`, `35-RESEARCH-DEVELOPER.md`
**Confidence:** HIGH

## Executive Summary

Phase 35 adds GitHub PR/issue browsing to FlowForge. Three parallel researchers analyzed the codebase (~37K LOC) and converged on these key findings:

1. **Zero new dependencies needed** -- every library (reqwest, TanStack Query, react-markdown, react-virtuoso, lucide-react) is already installed
2. **Established patterns cover 90% of the work** -- existing blade system, extension API, TanStack Query hooks, markdown renderer, and Virtuoso list patterns can be directly reused
3. **~1,180 LOC total** -- 6 new Rust files (~340 LOC), 13 new TS/TSX files (~640 LOC), 5 modified files (~200 LOC)
4. **Key extensibility refactoring**: shared HTTP client in Rust, small reusable UI components (StatusBadge, LabelPill, CommentCard, TimeAgo), query key namespacing convention for cache isolation

## Team Consensus

### Agreed (All 3 researchers)
- **REST API via Rust backend** -- token never crosses IPC boundary (security architecture from Phase 34)
- **TanStack Query for API data** -- Zustand only for UI state (filters, selected remote)
- **Separate blades for PRs and Issues** -- not tabs within one blade (matches existing blade-per-concern pattern)
- **Page-based pagination** with Link header parsing (GitHub REST standard)
- **No new npm/cargo dependencies** -- everything is already installed
- **Existing MarkdownRenderer** for PR/issue body and comments rendering
- **Existing BladeContentLoading/Error/Empty** for state management
- **Virtuoso infinite scroll** for list views (matches CommitHistory.tsx)

### Resolved Disagreements

| Topic | UX View | Architecture View | Developer View | Resolution |
|-------|---------|-------------------|----------------|------------|
| CI status in list | Show dots per row | Lazy-fetch on hover | Detail-only for Phase 35 | **Detail-only** -- N+1 API calls for list would burn rate limits. Show CI in detail view only. |
| Generic ListBlade wrapper | Build reusable ExtensionListLayout | Build generic ListBlade in _shared/ | Wait -- small composable components | **Small composable components** -- PR/issue rows differ enough that a generic wrapper would be too abstract. Extract pattern after 3+ uses. |
| Query key prefix | Not specified | `["ext:github", ...]` | `["github", ...]` | **`["ext:github", ...]`** -- matches extension namespace convention, enables targeted cache cleanup on deactivation |
| Label colors | GitHub hex colors with opacity | Not discussed | Inline `style` attribute | **Inline `style`** -- Tailwind v4 can't generate arbitrary dynamic hex colors at build time |

## Data Flow Architecture

```
GitHub REST API  <-->  Rust Commands (reqwest + keychain token)  <-->  Tauri IPC
                                                                         |
                                                                TypeScript bindings
                                                                         |
                                                               TanStack Query hooks
                                                                  (useQuery)
                                                                         |
                                                                React Components
                                                                (blade components)
```

## API Endpoints Required

| Endpoint | Rust Command | Requirement |
|----------|-------------|-------------|
| `GET /repos/{o}/{r}/pulls` | `github_list_pull_requests` | GH-05 |
| `GET /repos/{o}/{r}/pulls/{n}` | `github_get_pull_request` | GH-06 |
| `GET /repos/{o}/{r}/issues` | `github_list_issues` | GH-07 |
| `GET /repos/{o}/{r}/issues/{n}` | `github_get_issue` | GH-08 |
| `GET /repos/{o}/{r}/issues/{n}/comments` | (inline in PR/issue detail) | GH-06/GH-08 |
| `GET /repos/{o}/{r}/commits/{sha}/check-runs` | `github_get_check_runs` | GH-06 (detail only) |

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src-tauri/src/github/client.rs` | Shared authenticated HTTP helper |
| `src-tauri/src/github/pulls.rs` | PR list and detail commands |
| `src-tauri/src/github/issues.rs` | Issue list, detail, comments commands |
| `src/extensions/github/blades/PullRequestListBlade.tsx` | PR list blade |
| `src/extensions/github/blades/PullRequestDetailBlade.tsx` | PR detail blade |
| `src/extensions/github/blades/IssueListBlade.tsx` | Issue list blade |
| `src/extensions/github/blades/IssueDetailBlade.tsx` | Issue detail blade |
| `src/extensions/github/components/StatusBadge.tsx` | PR/Issue state badge |
| `src/extensions/github/components/LabelPill.tsx` | Colored label pill |
| `src/extensions/github/components/UserAvatar.tsx` | GitHub avatar |
| `src/extensions/github/components/TimeAgo.tsx` | Relative time |
| `src/extensions/github/components/CommentCard.tsx` | Comment display |
| `src/extensions/github/hooks/useGitHubQuery.ts` | TanStack Query hooks |

### Modified Files
| File | Change |
|------|--------|
| `src-tauri/src/github/mod.rs` | Add module declarations + re-exports |
| `src-tauri/src/github/types.rs` | Add PR/Issue/Comment IPC types |
| `src-tauri/src/github/error.rs` | Add `ApiError` variant |
| `src-tauri/src/lib.rs` | Register new commands |
| `src/extensions/github/index.ts` | Register blades, commands, toolbar |
| `src/extensions/github/githubStore.ts` | Add selectedRemoteIndex |

## Key Technical Decisions

1. **Two-layer Rust types**: Internal deserialization structs (snake_case, no specta) + IPC structs (camelCase, specta Type derive)
2. **Serde rename**: `#[serde(rename_all = "camelCase")]` on IPC types, no rename on internal types (GitHub API is already snake_case)
3. **Pagination**: Page-based with manual Link header parsing (no parse_link_header crate needed)
4. **Caching**: staleTime 2min for lists, 1min for details, 30s for CI checks. refetchOnWindowFocus for automatic refresh
5. **Cache cleanup**: `queryClient.removeQueries({ queryKey: ["ext:github"] })` in onDeactivate and on repo switch
6. **PR filter**: state=open|closed|all (merged detected via `merged_at.is_some()`)
7. **Issues filter**: Filter out items with `pull_request` field (GitHub issues API returns PRs too)
8. **Toolbar actions**: PR and Issues buttons in `views` group, visible only when authenticated + GitHub remote detected

## Critical Pitfalls (from all researchers)

1. **GitHub issues API returns PRs** -- filter items with `pull_request` field in Rust
2. **No `merged` field on list endpoint** -- use `merged_at.is_some()` instead
3. **CI status requires N+1 calls** -- defer to detail view only
4. **Rate limit exhaustion** -- use staleTime, NO refetchInterval on lists
5. **Stale data on repo switch** -- removeQueries on repo change subscriber
6. **u64 IDs** -- use `number` (not `id`) as primary identifier; specta handles u64->bigint
7. **Specta generics may not work** -- prepare concrete fallback types (PullRequestListResponse)
8. **Empty body fields** -- `Option<String>` + `unwrap_or_default()`

## RESEARCH COMPLETE
