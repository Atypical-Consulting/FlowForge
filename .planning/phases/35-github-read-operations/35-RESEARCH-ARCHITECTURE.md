# Phase 35: GitHub Read Operations - Architecture Research

**Researched:** 2026-02-10
**Domain:** Data flow architecture, API layer design, extension data isolation, blade registration patterns, state machine integration, caching/invalidation, error handling, extensibility refactoring
**Perspective:** Technical Architecture (one of three researchers: UX, Architecture, Expert Dev)
**Confidence:** HIGH (based on thorough codebase analysis + official GitHub API docs)

## Summary

Phase 35 adds GitHub PR listing, PR detail, issue listing, issue detail, and extension toolbar contributions to FlowForge. The existing codebase has a well-designed extension system (Phase 33-34) with namespaced registrations, cleanup lifecycle, and a blade registry that already supports dynamic extension blades. The architecture challenge is not "can we add GitHub blades" (that is straightforward) but "how do we architect this so that a Jira, GitLab, or Azure DevOps extension could follow the exact same patterns?"

The current codebase has all the building blocks: ExtensionAPI with registerBlade/registerCommand/contributeToolbar, a blade registry with dynamic type support, XState navigation with PUSH_BLADE that accepts any blade type, TanStack Query v5 with a shared queryClient, and Zustand stores with devtools. What is missing is: (1) an ExtensionAPI method to access queryClient for data fetching, (2) a convention for extension query key namespacing and cache cleanup on deactivation, (3) reusable list/detail blade primitives that extensions can compose rather than rebuild, and (4) a Rust-side pattern for extensions to add Tauri commands for API proxying.

**Primary recommendation:** Use REST API via Rust backend commands (not frontend fetch), TanStack Query for all GitHub API data caching in the frontend, Zustand only for GitHub-specific UI state (filters, selected items), and build generic list/detail blade primitives in `_shared` that GitHub blades compose and future extensions reuse.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5 | API data caching, background refresh, stale-while-revalidate | Already used for git operations; natural fit for GitHub API data |
| zustand | (current) | UI state (filters, selections, auth) | Already used; GitHub extension already has githubStore |
| xstate | (current) | Blade navigation state machine | Already manages blade stack; PR list->detail is PUSH_BLADE |
| reqwest | 0.13 | Rust HTTP client for GitHub API | Already used for auth flow; extend for PR/issue endpoints |
| tauri-specta | 2.0.0-rc.21 | Type-safe IPC bindings | Already generates TypeScript bindings from Rust commands |

### Supporting (New for Phase 35)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| parse_link_header (Rust) | latest | Parse GitHub API Link header for pagination | Every paginated GitHub API response |
| serde (already present) | 1 | Deserialize GitHub API JSON responses | All Rust GitHub API commands |

### Not Needed
| Instead of | Don't Use | Reason |
|------------|-----------|--------|
| octocrab | Raw reqwest | Project already uses reqwest for GitHub auth; octocrab adds 30+ transitive deps, and we only need 4-5 endpoints. The overhead is not justified. |
| GitHub GraphQL v4 | REST v3 | GraphQL requires a separate auth token type, adds query complexity, and the data volume for PR/issue listing is small enough that REST pagination is fine. REST also gives simpler Rust deserialization (no nested { data: { repository: { pullRequests: { nodes } } } } unwrapping). |
| Frontend fetch() | Rust commands | Token is stored in OS keychain (Rust-only access). All GitHub API calls MUST go through Rust to attach the Bearer token without ever exposing it to the frontend. This is a security architecture decision from Phase 34. |

## Architecture Patterns

### Recommended Data Flow

```
GitHub API  <-->  Rust Commands (reqwest + token)  <-->  IPC (tauri-specta)
                                                             |
                                                    TypeScript bindings
                                                             |
                                                   TanStack Query hooks
                                                      (useQuery)
                                                             |
                                                    React Components
                                                    (PR list, detail)
```

**Key principle:** The Rust backend is the ONLY layer that talks to GitHub. The frontend never sees tokens, never makes direct HTTP requests to api.github.com. This is the same pattern used by commit history, staging status, and every other git operation in FlowForge.

### Recommended Project Structure

```
src/extensions/github/
  index.ts                    # Extension entry point (onActivate/onDeactivate)
  githubStore.ts              # Auth state, UI state (filters, selections)
  types.ts                    # Scope profiles, auth types
  hooks/
    useGitHubPullRequests.ts  # TanStack Query hook: list PRs
    useGitHubPullRequest.ts   # TanStack Query hook: single PR detail
    useGitHubIssues.ts        # TanStack Query hook: list issues
    useGitHubIssue.ts         # TanStack Query hook: single issue detail
    useGitHubCheckStatus.ts   # TanStack Query hook: CI status for commit
  blades/
    GitHubAuthBlade.tsx       # (existing)
    GitHubAccountBlade.tsx    # (existing)
    PullRequestListBlade.tsx  # New: PR list using ListBlade primitives
    PullRequestDetailBlade.tsx# New: PR detail
    IssueListBlade.tsx        # New: issue list using ListBlade primitives
    IssueDetailBlade.tsx      # New: issue detail
  components/
    GitHubStatusButton.tsx    # (existing)
    ScopeSelector.tsx         # (existing)
    RateLimitBar.tsx          # (existing)
    PullRequestRow.tsx        # PR list item
    IssueRow.tsx              # Issue list item
    CIStatusBadge.tsx         # CI check indicators
    LabelBadge.tsx            # GitHub label with color
    UserAvatar.tsx            # GitHub user avatar

src-tauri/src/github/
  mod.rs                      # (existing + new command re-exports)
  auth.rs                     # (existing)
  token.rs                    # (existing)
  error.rs                    # (existing, extend with new variants)
  rate_limit.rs               # (existing)
  remote.rs                   # (existing)
  types.rs                    # (existing + new PR/Issue/CheckRun types)
  pulls.rs                    # New: list_pull_requests, get_pull_request
  issues.rs                   # New: list_issues, get_issue
  checks.rs                   # New: get_combined_status, list_check_runs

src/blades/_shared/
  ListBlade.tsx               # New: generic list blade primitive
  DetailBlade.tsx             # New: generic detail blade primitive (optional)
```

### Pattern 1: Rust Command per GitHub Endpoint

**What:** Each GitHub API endpoint gets its own Tauri command with typed request/response structs.
**When to use:** Every new GitHub API operation.
**Why:** Type safety end-to-end via tauri-specta, automatic TypeScript binding generation, token attached in Rust only.

```rust
// src-tauri/src/github/pulls.rs

use super::error::GitHubError;
use super::token;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestSummary {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub draft: bool,
    pub user_login: String,
    pub user_avatar_url: String,
    pub created_at: String,
    pub updated_at: String,
    pub head_sha: String,
    pub base_ref: String,
    pub labels: Vec<LabelInfo>,
    pub requested_reviewers: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LabelInfo {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedResponse<T: specta::Type> {
    pub items: Vec<T>,
    pub has_next_page: bool,
    pub next_page: Option<u32>,
    pub total_count: Option<u32>,
}

#[tauri::command]
#[specta::specta]
pub async fn github_list_pull_requests(
    owner: String,
    repo: String,
    state: Option<String>,    // "open" | "closed" | "all"
    page: Option<u32>,
    per_page: Option<u32>,
    sort: Option<String>,     // "created" | "updated" | "popularity"
    direction: Option<String>,// "asc" | "desc"
) -> Result<PaginatedResponse<PullRequestSummary>, GitHubError> {
    let token = token::get_token().await?;
    // ... implementation with reqwest, Link header parsing
}
```

### Pattern 2: TanStack Query Hooks for Extension Data

**What:** Each GitHub data blade uses a TanStack Query hook that calls the Rust command via generated bindings.
**When to use:** Every data-fetching blade component.
**Why:** Automatic caching, background refresh, loading/error states, stale-while-revalidate.

```typescript
// src/extensions/github/hooks/useGitHubPullRequests.ts

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { commands } from "../../../bindings";

export interface PRListFilters {
  state?: "open" | "closed" | "all";
  sort?: "created" | "updated" | "popularity";
  direction?: "asc" | "desc";
  page?: number;
  perPage?: number;
}

export function useGitHubPullRequests(
  owner: string,
  repo: string,
  filters: PRListFilters = {},
) {
  return useQuery({
    // Namespaced query key: ext:github prefix for cache isolation
    queryKey: ["ext:github", "pullRequests", owner, repo, filters],
    queryFn: () =>
      commands.githubListPullRequests(
        owner,
        repo,
        filters.state ?? "open",
        filters.page ?? 1,
        filters.perPage ?? 30,
        filters.sort ?? "updated",
        filters.direction ?? "desc",
      ),
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: keepPreviousData, // Keep old data while fetching new page
    enabled: !!owner && !!repo,
  });
}
```

### Pattern 3: Query Key Namespacing Convention

**What:** All extension query keys start with `"ext:{extensionId}"` prefix.
**When to use:** Every TanStack Query hook in any extension.
**Why:** Enables cache cleanup on deactivation via `queryClient.removeQueries({ queryKey: ["ext:github"] })`.

```typescript
// Convention:
// Core queries:  ["commitHistory", oid]
// Extension:     ["ext:github", "pullRequests", owner, repo, filters]
// Extension:     ["ext:github", "pullRequest", owner, repo, number]
// Extension:     ["ext:github", "issues", owner, repo, filters]
// Extension:     ["ext:github", "checkStatus", owner, repo, sha]

// Cleanup on deactivation (ExtensionAPI or onDeactivate):
import { queryClient } from "../../lib/queryClient";
queryClient.removeQueries({ queryKey: ["ext:github"] });
```

### Pattern 4: Extension Blade Registration (List + Detail)

**What:** Extension registers both list and detail blade types; list items open detail via `openBlade()`.
**When to use:** Any extension that has a browsable list with drilldown.

```typescript
// In extension onActivate:
api.registerBlade({
  type: "pr-list",
  title: "Pull Requests",
  component: PullRequestListBlade,
  singleton: true,
  wrapInPanel: true,
  showBack: true,
});

api.registerBlade({
  type: "pr-detail",
  title: (props) => `PR #${props.number}`,
  component: PullRequestDetailBlade,
  singleton: false, // Multiple PR details can be open
  wrapInPanel: true,
  showBack: true,
});

// In PullRequestListBlade, when user clicks a PR:
openBlade("ext:github:pr-detail", { owner, repo, number: pr.number }, `PR #${pr.number}: ${pr.title}`);
```

### Pattern 5: Toolbar Contribution with Visibility Condition

**What:** Extension contributes toolbar actions that only appear when preconditions are met.
**When to use:** TB-07 requirement.

```typescript
api.contributeToolbar({
  id: "open-prs",
  label: "Pull Requests",
  icon: GitPullRequest,
  group: "views",
  priority: 50,
  when: () => {
    const { isAuthenticated, detectedRemotes } = useGitHubStore.getState();
    return isAuthenticated && detectedRemotes.length > 0;
  },
  execute: () => {
    const remote = useGitHubStore.getState().detectedRemotes[0];
    openBlade("ext:github:pr-list", { owner: remote.owner, repo: remote.repo });
  },
});
```

### Anti-Patterns to Avoid

- **Frontend direct API calls:** Never call api.github.com from the browser. The token is in the OS keychain, accessible only from Rust. This is the security architecture from Phase 34.
- **Storing API response data in Zustand:** TanStack Query already manages loading, error, caching, and refetch for server data. Using Zustand for API data creates dual sources of truth. Zustand is for UI-only state (filters, selections, auth status).
- **Monolithic Rust command:** Don't create one giant `github_fetch_data(endpoint, params)` command. Each endpoint should be its own typed command for type safety through the IPC boundary.
- **Hardcoded owner/repo:** Always pass owner/repo as parameters from the detected remote. Don't store them globally. The user might switch repos or have multiple remotes.
- **Extension query keys without namespace prefix:** All extension queries MUST use `["ext:{extensionId}", ...]` prefix to enable targeted cache cleanup.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API data caching | Custom Zustand cache store | TanStack Query with queryKey namespacing | TanStack handles stale/fresh, background refresh, deduplication, error retry. Rolling your own means reimplementing all of this. |
| Pagination state | Custom page tracking state | TanStack Query with `keepPreviousData` + page in queryKey | Changing queryKey params auto-fetches next page while keeping old data visible. |
| Loading/error states | Custom isLoading/error booleans in Zustand | `useQuery()` return values | TanStack Query already provides isLoading, isError, error, data, isFetching, isRefetching. |
| GitHub API Link header parsing | String.split() hacks | `parse_link_header` crate in Rust | RFC 8288 compliant parsing. GitHub's Link header has edge cases (quoted params, multiple rels). |
| Token attachment | Token state in frontend | Rust-side reqwest with keychain access | Token NEVER crosses the IPC boundary. Security-critical. |
| HTTP error classification | Generic try/catch | Typed GitHubError enum with specta | The existing error pattern (tag = "type", content = "message") gives the frontend discriminated union matching. |

## Caching and Invalidation Strategy

### TanStack Query Configuration for GitHub Data

```typescript
// GitHub-specific stale times (different from core git operations)
const GITHUB_STALE_TIMES = {
  prList: 2 * 60 * 1000,      // 2 minutes - PRs change moderately
  prDetail: 60 * 1000,        // 1 minute - comments/reviews are live
  issueList: 2 * 60 * 1000,   // 2 minutes
  issueDetail: 60 * 1000,     // 1 minute
  checkStatus: 30 * 1000,     // 30 seconds - CI status is time-sensitive
};
```

### Invalidation Triggers

| Trigger | What to Invalidate | How |
|---------|-------------------|-----|
| Manual refresh button | Current list query | `queryClient.invalidateQueries({ queryKey: ["ext:github", "pullRequests", owner, repo] })` |
| Extension deactivation | ALL GitHub queries | `queryClient.removeQueries({ queryKey: ["ext:github"] })` |
| Repo switch | ALL GitHub queries | Same as deactivation, triggered by repo change subscriber |
| PR detail opened | Nothing (lazy fetch) | useQuery with the PR number in queryKey auto-fetches |
| Window focus | Active queries only | TanStack Query's built-in `refetchOnWindowFocus` (default: true) |
| Background polling | None (not recommended) | Use `refetchInterval` only for check status, not for lists |

### Extension Lifecycle and Cache Cleanup

**Critical:** When the GitHub extension is deactivated (repo close, extension disable), ALL cached GitHub API data must be purged. This prevents stale data from a previous repo from appearing when a new repo is opened.

```typescript
// In onDeactivate:
export function onDeactivate(): void {
  cancelGitHubPolling();

  // Clean up ALL cached GitHub API data
  queryClient.removeQueries({ queryKey: ["ext:github"] });

  // ... existing cleanup
}
```

### Rate Limit-Aware Fetching

The existing `checkRateLimit` and `checkRateLimitWarning` in githubStore should be called after any batch of API requests. The Rust commands should return rate limit info from response headers (X-RateLimit-Remaining, X-RateLimit-Reset) alongside the response data.

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GitHubResponse<T: specta::Type> {
    pub data: T,
    pub rate_limit_remaining: Option<u32>,
    pub rate_limit_reset: Option<u32>,
}
```

## State Machine Integration

### Blade Navigation for List -> Detail

The existing navigation machine handles this perfectly. No machine changes are needed.

```
PR list blade (PUSH_BLADE) --> PR detail blade (PUSH_BLADE) --> back (POP_BLADE)
```

**How it works today:**
1. User clicks toolbar "Pull Requests" -> `openBlade("ext:github:pr-list", { owner, repo })`
2. Navigation machine: PUSH_BLADE with bladeType="ext:github:pr-list"
3. User clicks a PR row -> `openBlade("ext:github:pr-detail", { owner, repo, number: 42 })`
4. Navigation machine: PUSH_BLADE with bladeType="ext:github:pr-detail"
5. User clicks back -> POP_BLADE, returns to PR list (still cached in TanStack Query)

**Key insight:** The navigation machine does NOT need nested states for list->detail. Each blade is a separate PUSH_BLADE event. The blade stack handles the nesting: `[staging-changes, ext:github:pr-list, ext:github:pr-detail]`.

**Singleton decisions:**
- PR list: `singleton: true` (only one list open at a time)
- PR detail: `singleton: false` (user might open multiple PRs for comparison)
- Issue list: `singleton: true`
- Issue detail: `singleton: false`

### No Navigation Machine Changes Required

The current machine already handles:
- Dynamic blade types (no hardcoded type enum in the machine)
- Singleton detection via `isSingletonBlade()` which calls blade registry
- Stack depth limits (max 8)
- Dirty blade guards (PR/issue blades won't be dirty since they're read-only)
- POP_TO_INDEX for breadcrumb navigation

## Error Handling Architecture

### Layered Error Strategy

```
Layer 1: Rust command     -> GitHubError enum (typed, discriminated)
Layer 2: TanStack Query   -> useQuery error state, retry logic
Layer 3: Blade component  -> BladeContentError (retry button) or BladeErrorBoundary (crash recovery)
Layer 4: Global           -> Toast for rate limit warnings, auth expiry
```

### Extending GitHubError for API Operations

```rust
// Add to src-tauri/src/github/error.rs:
#[derive(Debug, Error, Serialize, Deserialize, Type, Clone)]
#[serde(tag = "type", content = "message")]
pub enum GitHubError {
    // ... existing variants ...

    #[error("Repository not found: {0}")]
    NotFound(String),

    #[error("Forbidden: insufficient permissions: {0}")]
    Forbidden(String),

    #[error("Validation error: {0}")]
    ValidationError(String),
}
```

### Per-Blade Error Handling (Not Global)

Each GitHub blade handles its own errors via the TanStack Query error state. This avoids coupling core error boundaries to GitHub-specific error types.

```typescript
// In PullRequestListBlade:
const { data, isLoading, error, refetch } = useGitHubPullRequests(owner, repo, filters);

if (isLoading) return <BladeContentLoading />;

if (error) {
  const githubError = extractGitHubError(error);

  if (githubError?.type === "NotAuthenticated") {
    return <BladeContentError
      message="Not signed in to GitHub"
      detail="Sign in to view pull requests"
      onRetry={() => openBlade("ext:github:sign-in", {})}
    />;
  }

  if (githubError?.type === "RateLimitExceeded") {
    return <BladeContentError
      message="GitHub API rate limit exceeded"
      detail={`Resets at ${formatResetTime(githubError.message)}`}
    />;
  }

  return <BladeContentError
    message="Failed to load pull requests"
    detail={githubError?.message}
    onRetry={() => refetch()}
  />;
}
```

### Token Expiration Handling

When any GitHub API command returns NotAuthenticated (token invalid/expired), the frontend should:
1. Show error in the current blade (per-blade, not global)
2. Update githubStore to `isAuthenticated: false`
3. Show toast with "Sign in again" action

This is extension-specific logic, not in core. A Jira extension would have different auth expiry behavior.

## Refactoring for Extensibility

### Refactoring 1: Add queryClient Access to ExtensionAPI

**Current state:** ExtensionAPI has registerBlade, registerCommand, contributeToolbar. No data-fetching support.

**Problem:** Extensions need to invalidate/remove queries on cleanup. Currently, the GitHub extension imports queryClient directly from `../../lib/queryClient`, which is a coupling to internal paths.

**Recommendation:** Do NOT add queryClient to ExtensionAPI for now. The current direct import works fine for built-in extensions. When external extensions arrive (loaded from filesystem), they would need a different mechanism. For Phase 35, keep the direct import pattern -- it matches how the extension already imports `openBlade` and `useRepositoryStore`.

**Rationale:** Over-abstracting now creates an API surface we might need to break later. The built-in GitHub extension lives in the same source tree and can import any module.

### Refactoring 2: Cache Cleanup in Extension Lifecycle

**Current state:** ExtensionAPI.cleanup() removes blades, commands, and toolbar actions. Does not touch TanStack Query cache.

**Recommended addition:** Add query cache cleanup to the extension deactivation flow. Two options:

**Option A (Recommended): Convention-based cleanup in onDeactivate**
The extension's own `onDeactivate` calls `queryClient.removeQueries({ queryKey: ["ext:github"] })`. This is simple, explicit, and doesn't require ExtensionAPI changes.

**Option B: Automatic cleanup via ExtensionAPI**
Add `cleanupQueries(prefix: string)` to ExtensionAPI that calls queryClient.removeQueries. This is over-engineered for one extension.

**Decision: Use Option A.** The convention of `["ext:{extensionId}", ...]` query keys + cleanup in onDeactivate is sufficient and keeps the extension system simple.

### Refactoring 3: Generic List Blade Primitive

**Current state:** No reusable list blade component exists. Each blade builds its own layout from scratch.

**Recommendation:** Create a `ListBlade` component in `src/blades/_shared/` that provides:
- Search/filter bar slot
- Virtualized scrollable list area
- Loading state
- Empty state
- Error state with retry
- Pagination controls (load more button or infinite scroll)
- Item click handler

```typescript
// src/blades/_shared/ListBlade.tsx
interface ListBladeProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  onItemClick?: (item: T) => void;
  isLoading?: boolean;
  isError?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyIcon?: LucideIcon;
  emptyMessage?: string;
  emptyDetail?: string;
  header?: ReactNode;  // Filter bar, search, tabs
  footer?: ReactNode;  // Pagination, load more
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
}
```

**Why this matters for extensibility:** A Jira extension listing tickets, a GitLab extension listing merge requests, or even a core feature listing branches -- all follow the same list pattern. Building it once in `_shared` means every extension gets consistent UX and behavior for free.

### Refactoring 4: BladePropsMap Extension Point

**Current state:** `BladePropsMap` in `src/stores/bladeTypes.ts` enumerates ALL core blade types and their props. Extension blades use `ExtensionBladeType = \`ext:${string}:${string}\`` with `Record<string, unknown>` props (no type safety for extension blade props).

**Assessment:** This is fine as-is. Extension blade props are typed within the extension code itself (e.g., PullRequestDetailBlade has `{ owner: string; repo: string; number: number }`). The loosely-typed IPC boundary at the navigation machine level is acceptable because:
1. The extension registers the component and the component types its own props
2. The openBlade call within the extension provides the correct props
3. Cross-extension blade opening (rare) would need runtime validation anyway

**No refactoring needed here.**

### Refactoring 5: Rust Command Organization for Extensions

**Current state:** All Tauri commands are registered in a single `collect_commands![]` call in `lib.rs`. GitHub auth commands are in `src-tauri/src/github/`.

**Assessment:** This scales fine for built-in extensions. Each extension's Rust module exports its commands, lib.rs imports and registers them. The naming convention (`github_list_pull_requests`, `github_get_issue`) provides natural namespacing.

**Pattern for new commands:**
```rust
// lib.rs additions:
use github::{
    // ... existing ...
    github_list_pull_requests, github_get_pull_request,
    github_list_issues, github_get_issue,
    github_get_combined_status, github_list_check_runs,
    github_list_pr_comments, github_list_pr_reviews,
};
```

### Refactoring 6: Rate Limit Info from Response Headers

**Current state:** Rate limit checking is a separate API call (`github_check_rate_limit`).

**Recommendation:** Every GitHub API response includes rate limit headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`). Extract these in every Rust command and include them in the response. This eliminates the need for a separate rate limit check after each operation.

**Implementation:** Create a shared `make_github_request` helper function in Rust that:
1. Gets token from keychain
2. Makes the reqwest request with standard headers
3. Extracts rate limit headers
4. Checks for HTTP error status codes and maps to GitHubError
5. Returns both the response body and rate limit info

```rust
// src-tauri/src/github/client.rs (new file)
pub struct GitHubClient {
    client: reqwest::Client,
}

impl GitHubClient {
    pub async fn get<T: serde::de::DeserializeOwned + specta::Type>(
        &self,
        url: &str,
    ) -> Result<GitHubApiResponse<T>, GitHubError> {
        let token = token::get_token().await?;
        let resp = self.client
            .get(url)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "FlowForge-Desktop")
            .header("Accept", "application/vnd.github+json")
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

        let rate_remaining = resp.headers()
            .get("x-ratelimit-remaining")
            .and_then(|v| v.to_str().ok()?.parse().ok());
        let rate_reset = resp.headers()
            .get("x-ratelimit-reset")
            .and_then(|v| v.to_str().ok()?.parse().ok());

        let status = resp.status();
        if !status.is_success() {
            return Err(match status.as_u16() {
                401 => GitHubError::NotAuthenticated,
                403 if rate_remaining == Some(0) => {
                    GitHubError::RateLimitExceeded("Rate limit exceeded".into())
                }
                403 => GitHubError::Forbidden("Insufficient permissions".into()),
                404 => GitHubError::NotFound("Resource not found".into()),
                _ => GitHubError::Internal(format!("HTTP {}", status)),
            });
        }

        // Parse Link header for pagination
        let link_header = resp.headers()
            .get("link")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let data: T = resp.json().await
            .map_err(|e| GitHubError::Internal(format!("JSON parse error: {}", e)))?;

        Ok(GitHubApiResponse {
            data,
            rate_limit_remaining: rate_remaining,
            rate_limit_reset: rate_reset,
            link_header,
        })
    }
}
```

## Common Pitfalls

### Pitfall 1: Token Exposure via Frontend Fetch

**What goes wrong:** Developer adds a `fetch("https://api.github.com/...")` call in a React component, bypassing the Rust backend.
**Why it happens:** It seems simpler than adding a Rust command.
**How to avoid:** ALL GitHub API calls go through Rust commands. The token is ONLY in the OS keychain, accessed only by Rust. This is enforced by architecture, not just convention -- the frontend literally cannot get the token.
**Warning signs:** Any import of `fetch` or `axios` in extension code targeting api.github.com.

### Pitfall 2: GitHub Issues API Returns PRs

**What goes wrong:** The `GET /repos/{owner}/{repo}/issues` endpoint returns BOTH issues and pull requests. PRs are issues with a `pull_request` key.
**Why it happens:** GitHub treats PRs as a special type of issue internally.
**How to avoid:** In the Rust `list_issues` command, filter out items that have the `pull_request` field set. Or check for the presence of the `pull_request` key in the JSON response.
**Warning signs:** Issue list shows PR titles mixed in.

### Pitfall 3: Stale Data After Repo Switch

**What goes wrong:** User opens repo A, views PRs, switches to repo B, sees repo A's PRs briefly.
**Why it happens:** TanStack Query cache persists across repo switches unless explicitly cleared.
**How to avoid:** In the repo change subscriber (already exists in GitHub extension), call `queryClient.removeQueries({ queryKey: ["ext:github"] })` when the repo path changes.
**Warning signs:** Seeing data from a previous repo flash before new data loads.

### Pitfall 4: Rate Limit Exhaustion from Aggressive Polling

**What goes wrong:** Setting `refetchInterval` on PR list queries burns through API rate limits.
**Why it happens:** Each refetch is a full API call. With 5 tabs and 30-second intervals, that is 600 requests/hour.
**How to avoid:** Do NOT use `refetchInterval` for list queries. Use `refetchOnWindowFocus` (default true) + manual refresh button. Only use `refetchInterval` for check status on the PR detail blade (and only when the detail blade is mounted).
**Warning signs:** Rate limit warnings appearing frequently.

### Pitfall 5: Over-Fetching PR Details for List View

**What goes wrong:** Fetching full PR detail (comments, reviews, diffs) just to show a list row.
**Why it happens:** Using the single-PR endpoint instead of the list endpoint.
**How to avoid:** Use `GET /repos/{owner}/{repo}/pulls` for the list (returns summary data). Use `GET /repos/{owner}/{repo}/pulls/{number}` only when the detail blade opens. CI status is a separate call (`GET /repos/{owner}/{repo}/commits/{sha}/status`).
**Warning signs:** Slow list loading, high API usage.

### Pitfall 6: specta Type Issues with Generics

**What goes wrong:** `PaginatedResponse<T>` with `specta::Type` bound may not generate correct TypeScript bindings.
**Why it happens:** specta has limitations with generic type parameters in some versions.
**How to avoid:** If generics don't work with specta, create concrete types: `PaginatedPullRequests`, `PaginatedIssues`. Test the generated bindings.ts file after adding new types.
**Warning signs:** Build errors in bindings.ts, missing type definitions.

### Pitfall 7: BigInt Serialization for GitHub IDs

**What goes wrong:** GitHub issue/PR IDs can exceed JavaScript's safe integer range when using the `id` field (not the `number` field).
**Why it happens:** GitHub's internal `id` field is a large integer. The `number` field (per-repo sequential) is always small.
**How to avoid:** Use `number` (not `id`) as the primary identifier for PRs and issues. If `id` is needed, use `u64` in Rust and document that it arrives as a number in JS (safe for values under 2^53). The project already addressed this in Phase 34 verification.
**Warning signs:** PRs with wrong numbers, duplicate detection failing.

## Extension Data Isolation

### Zustand Store Isolation

The GitHub extension already has its own Zustand store (`useGitHubStore`) created with `create()` outside the core store registry. This is correct -- extension stores should NOT be registered with `registerStoreForReset()` because:
1. Auth state should persist across repo switches
2. Extension stores are cleaned up by the extension's own `onDeactivate`
3. Core store reset should not affect extensions

For Phase 35, extend `githubStore` with UI state for filters:

```typescript
// Add to githubStore or create a separate githubUIStore:
interface GitHubUIState {
  prFilters: { state: "open" | "closed" | "all"; sort: string };
  issueFilters: { state: "open" | "closed" | "all"; labels: string[]; assignee: string };
  // NOT API data -- that lives in TanStack Query
}
```

### TanStack Query Isolation

TanStack Query uses the single shared `queryClient` instance. Extensions achieve isolation through query key namespacing:

```
Core queries:     ["stagingStatus"], ["commitHistory", oid]
GitHub extension: ["ext:github", "pullRequests", ...], ["ext:github", "issues", ...]
Future Jira ext:  ["ext:jira", "tickets", ...], ["ext:jira", "sprints", ...]
```

Cleanup: `queryClient.removeQueries({ queryKey: ["ext:github"] })` removes ALL GitHub queries without affecting core or other extensions.

## Code Examples

### Rust Command: List Pull Requests

```rust
// Source: GitHub REST API docs + project patterns from auth.rs

#[tauri::command]
#[specta::specta]
pub async fn github_list_pull_requests(
    owner: String,
    repo: String,
    state: Option<String>,
    page: Option<u32>,
    per_page: Option<u32>,
    sort: Option<String>,
    direction: Option<String>,
) -> Result<PaginatedPullRequests, GitHubError> {
    let token = token::get_token().await?;
    let client = reqwest::Client::new();

    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls?state={}&page={}&per_page={}&sort={}&direction={}",
        owner, repo,
        state.as_deref().unwrap_or("open"),
        page.unwrap_or(1),
        per_page.unwrap_or(30),
        sort.as_deref().unwrap_or("updated"),
        direction.as_deref().unwrap_or("desc"),
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "FlowForge-Desktop")
        .header("Accept", "application/vnd.github+json")
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    if !resp.status().is_success() {
        // Map HTTP status to typed error
        return Err(map_http_error(resp.status()));
    }

    // Extract pagination from Link header
    let has_next = resp.headers()
        .get("link")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.contains(r#"rel="next""#))
        .unwrap_or(false);

    let items: Vec<GitHubPullRequestRaw> = resp.json().await
        .map_err(|e| GitHubError::Internal(e.to_string()))?;

    let summaries = items.into_iter().map(|pr| PullRequestSummary {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft.unwrap_or(false),
        user_login: pr.user.login,
        user_avatar_url: pr.user.avatar_url,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        head_sha: pr.head.sha,
        base_ref: pr.base.ref_field,
        labels: pr.labels.into_iter().map(|l| LabelInfo { name: l.name, color: l.color }).collect(),
        requested_reviewers: pr.requested_reviewers.into_iter().map(|r| r.login).collect(),
    }).collect();

    Ok(PaginatedPullRequests {
        items: summaries,
        has_next_page: has_next,
        next_page: if has_next { Some(page.unwrap_or(1) + 1) } else { None },
    })
}
```

### TanStack Query Hook: PR Detail with Related Data

```typescript
// Source: TanStack Query v5 docs + project patterns from CommitDetailsBlade

import { useQuery, useQueries } from "@tanstack/react-query";
import { commands } from "../../../bindings";

export function useGitHubPullRequest(owner: string, repo: string, number: number) {
  const prQuery = useQuery({
    queryKey: ["ext:github", "pullRequest", owner, repo, number],
    queryFn: () => commands.githubGetPullRequest(owner, repo, number),
    staleTime: 60 * 1000,
  });

  // Fetch CI status only when we have the head SHA
  const headSha = prQuery.data?.status === "ok" ? prQuery.data.data.headSha : undefined;
  const checksQuery = useQuery({
    queryKey: ["ext:github", "checkStatus", owner, repo, headSha],
    queryFn: () => commands.githubGetCombinedStatus(owner, repo, headSha!),
    enabled: !!headSha,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000, // CI status is time-sensitive
  });

  return { prQuery, checksQuery };
}
```

### Extension Registration: Full onActivate with All Blades

```typescript
// Source: Existing GitHub extension index.ts pattern

export async function onActivate(api: ExtensionAPI): Promise<void> {
  await ensureComponents();

  // --- Blades ---
  api.registerBlade({ type: "sign-in", title: "GitHub Sign In", component: GitHubAuthBlade!, singleton: true, wrapInPanel: true, showBack: true });
  api.registerBlade({ type: "account", title: "GitHub Account", component: GitHubAccountBlade!, singleton: true, wrapInPanel: true, showBack: true });
  api.registerBlade({ type: "pr-list", title: "Pull Requests", component: PullRequestListBlade!, singleton: true, wrapInPanel: true, showBack: true });
  api.registerBlade({ type: "pr-detail", title: "Pull Request", component: PullRequestDetailBlade!, singleton: false, wrapInPanel: true, showBack: true });
  api.registerBlade({ type: "issue-list", title: "Issues", component: IssueListBlade!, singleton: true, wrapInPanel: true, showBack: true });
  api.registerBlade({ type: "issue-detail", title: "Issue", component: IssueDetailBlade!, singleton: false, wrapInPanel: true, showBack: true });

  // --- Commands ---
  api.registerCommand({ id: "open-prs", title: "View Pull Requests", category: "GitHub", icon: GitPullRequest,
    action: () => { const r = useGitHubStore.getState().detectedRemotes[0]; if (r) openBlade("ext:github:pr-list", { owner: r.owner, repo: r.repo }); },
    enabled: () => useGitHubStore.getState().isAuthenticated && useGitHubStore.getState().detectedRemotes.length > 0,
  });
  api.registerCommand({ id: "open-issues", title: "View Issues", category: "GitHub", icon: CircleDot,
    action: () => { const r = useGitHubStore.getState().detectedRemotes[0]; if (r) openBlade("ext:github:issue-list", { owner: r.owner, repo: r.repo }); },
    enabled: () => useGitHubStore.getState().isAuthenticated && useGitHubStore.getState().detectedRemotes.length > 0,
  });

  // --- Toolbar (TB-07) ---
  api.contributeToolbar({ id: "open-prs", label: "Pull Requests", icon: GitPullRequest, group: "views", priority: 50,
    when: () => useGitHubStore.getState().isAuthenticated && useGitHubStore.getState().detectedRemotes.length > 0,
    execute: () => { const r = useGitHubStore.getState().detectedRemotes[0]; if (r) openBlade("ext:github:pr-list", { owner: r.owner, repo: r.repo }); },
  });

  // ... existing auth commands, toolbar, subscriptions ...
}
```

## API Endpoints Required

### GitHub REST API Endpoints for Phase 35

| Endpoint | Rust Command | Use Case |
|----------|-------------|----------|
| `GET /repos/{owner}/{repo}/pulls` | `github_list_pull_requests` | GH-05: PR list |
| `GET /repos/{owner}/{repo}/pulls/{number}` | `github_get_pull_request` | GH-06: PR detail |
| `GET /repos/{owner}/{repo}/pulls/{number}/reviews` | `github_list_pr_reviews` | GH-06: Review status |
| `GET /repos/{owner}/{repo}/issues` | `github_list_issues` | GH-07: Issue list |
| `GET /repos/{owner}/{repo}/issues/{number}` | `github_get_issue` | GH-08: Issue detail |
| `GET /repos/{owner}/{repo}/issues/{number}/comments` | `github_list_issue_comments` | GH-06/GH-08: Comments |
| `GET /repos/{owner}/{repo}/commits/{ref}/status` | `github_get_combined_status` | GH-05: CI indicators |
| `GET /repos/{owner}/{repo}/commits/{ref}/check-runs` | `github_list_check_runs` | GH-06: Detailed checks |

### Pagination Strategy

Use page-based pagination (not cursor) with the REST API. The Link header provides next/prev/last URLs. The Rust command parses the Link header and returns `has_next_page: bool` and `next_page: Option<u32>`.

**Frontend pagination pattern:** Simple page state in the query key. TanStack Query's `keepPreviousData` shows the current page while fetching the next.

```typescript
const [page, setPage] = useState(1);
const { data } = useGitHubPullRequests(owner, repo, { ...filters, page });

// Load next page:
if (data?.hasNextPage) setPage(p => p + 1);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Frontend fetch() to GitHub API | Rust backend proxy with keychain token | Phase 34 (current project) | Security: token never in JS memory |
| Custom cache layer in Zustand | TanStack Query with stale-while-revalidate | Phase 30 (store consolidation) | Simpler code, automatic cache management |
| Hardcoded blade types | Dynamic blade registry with extension support | Phase 33 (extension foundation) | Extensions can add blades without core changes |
| GitHub API v3 only | GraphQL v4 available but not recommended here | Always available | REST is simpler for our use case (few endpoints, moderate data) |

## Open Questions

1. **Should PR comments use infinite scroll or pagination?**
   - What we know: PRs can have hundreds of comments. TanStack Query supports infinite queries via `useInfiniteQuery`.
   - What is unclear: Whether the UX team prefers load-more button vs infinite scroll vs paginated.
   - Recommendation: Start with `useInfiniteQuery` + load-more button. Let UX researcher decide final pattern.

2. **Should check runs be fetched eagerly for the PR list or lazily per-row?**
   - What we know: Getting CI status requires a separate API call per PR (using head SHA). For 30 PRs, that is 30 additional requests.
   - What is unclear: Whether the rate limit budget allows eager fetching.
   - Recommendation: Lazy fetch on hover or visibility (IntersectionObserver). Show a placeholder badge initially. Only fetch check status when the row becomes visible or is hovered.

3. **How should markdown rendering work for PR/issue bodies?**
   - What we know: PR descriptions and comments are GitHub Flavored Markdown with HTML. The project already has a markdown viewer blade.
   - What is unclear: Whether to reuse the existing markdown viewer or build an inline renderer.
   - Recommendation: Defer to UX researcher. Architecturally, either works. The existing viewer-markdown blade takes a file path, not raw content, so it would need a new variant or we use a react-markdown component inline.

4. **Multiple remotes: which remote's PRs to show?**
   - What we know: `detectedRemotes` is an array. Most repos have one GitHub remote (origin), but forks have upstream + origin.
   - What is unclear: UX for selecting which remote to browse.
   - Recommendation: Default to first detected remote (usually origin). Add a remote selector dropdown if `detectedRemotes.length > 1`. Pass owner/repo explicitly to every blade and hook.

## Sources

### Primary (HIGH confidence)
- Codebase analysis of `src/extensions/ExtensionAPI.ts`, `src/extensions/ExtensionHost.ts`, `src/extensions/github/` -- current extension system architecture
- Codebase analysis of `src/lib/bladeRegistry.ts`, `src/stores/bladeTypes.ts` -- blade registration patterns
- Codebase analysis of `src/machines/navigation/navigationMachine.ts` -- XState navigation
- Codebase analysis of `src/lib/queryClient.ts`, `src/blades/commit-details/CommitDetailsBlade.tsx` -- TanStack Query patterns
- Codebase analysis of `src-tauri/src/github/` -- Rust GitHub API layer, token storage, error types
- [GitHub REST API: Pull Requests](https://docs.github.com/en/rest/pulls/pulls) -- Endpoint specs
- [GitHub REST API: Issues](https://docs.github.com/en/rest/issues/issues) -- Endpoint specs
- [GitHub REST API: Commit Statuses](https://docs.github.com/en/rest/commits/statuses) -- Combined status endpoint
- [GitHub REST API: Check Runs](https://docs.github.com/en/rest/checks/runs) -- CI check details
- [GitHub REST API: Pull Request Reviews](https://docs.github.com/en/rest/pulls/reviews) -- Review status
- [GitHub REST API: Pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api) -- Link header format

### Secondary (MEDIUM confidence)
- [TanStack Query v5: Query Invalidation](https://tanstack.com/query/v5/docs/react/guides/query-invalidation) -- removeQueries/invalidateQueries patterns
- [TanStack Query v5: QueryClient Reference](https://tanstack.com/query/v5/docs/reference/QueryClient) -- API reference
- [Comparing GitHub REST and GraphQL](https://docs.github.com/en/rest/about-the-rest-api/comparing-githubs-rest-api-and-graphql-api) -- API choice rationale
- [parse_link_header crate](https://crates.io/crates/parse_link_header) -- Rust Link header parsing

### Tertiary (LOW confidence)
- [Understanding GitHub API Rate Limits](https://github.com/orgs/community/discussions/163553) -- Community discussion on rate limit nuances

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Verified against existing codebase patterns and official docs. No new libraries beyond parse_link_header.
- Architecture (data flow): HIGH -- Follows existing reqwest->Tauri command->TanStack Query pattern already proven in the project.
- Architecture (extensibility): HIGH -- Extension system already supports everything needed; only convention additions required.
- Pitfalls: HIGH -- Based on concrete GitHub API documentation and verified project patterns.
- Open questions: MEDIUM -- UX-dependent decisions that need cross-team resolution.

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (GitHub REST API is stable; project architecture is under active development)
