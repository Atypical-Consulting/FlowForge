# Phase 35: GitHub Read Operations - Developer Research

**Researched:** 2026-02-10
**Domain:** Rust/Tauri GitHub API integration, React blade components, Tailwind v4 patterns
**Perspective:** Expert Developer (Tauri, Rust, React, Tailwind v4)
**Confidence:** HIGH

## Summary

This research covers concrete implementation patterns for adding GitHub PR and issue read operations to FlowForge. The codebase has an established, consistent architecture: Rust Tauri commands with `#[tauri::command]` + `#[specta::specta]` decorators producing typed bindings, a Zustand store for GitHub state, and an extension system with blade registration via `ExtensionAPI`. The existing `github/` module in Rust already handles auth, token storage, rate limits, and remote detection -- all following the same pattern of `reqwest::Client` calls with `token::get_token()` for authentication.

The frontend uses TanStack Query (`@tanstack/react-query` v5) for all data fetching, with `useQuery` for single resources and `useInfiniteQuery` for paginated lists (see `CommitHistory.tsx`). The project already has `react-markdown` v10, `remark-gfm`, `rehype-highlight`, and `rehype-sanitize` installed with a reusable `MarkdownRenderer` component -- meaning PR/issue description rendering requires zero new dependencies.

**Primary recommendation:** Add 5-6 new Rust commands in a new `github/pulls.rs` and `github/issues.rs` module, with a shared `github/client.rs` helper for authenticated requests and Link header pagination. On the frontend, create 4 new blade components (PR list, PR detail, issue list, issue detail) registered through the existing extension system. Extract a reusable `ListBlade` pattern to reduce duplication and enable future extensions.

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| reqwest | 0.13 | HTTP client for GitHub API calls | Already in Cargo.toml with `json`, `rustls`, `form` features |
| serde | 1.x | Serialization/deserialization of API responses | Already in Cargo.toml |
| specta | 2.0.0-rc.22 | TypeScript type generation from Rust types | Already in Cargo.toml |
| tauri-specta | 2.0.0-rc.21 | Tauri command binding generation | Already in Cargo.toml |
| keyring | 3.x | OAuth token storage in OS keychain | Already in Cargo.toml |
| @tanstack/react-query | ^5 | Data fetching and caching on frontend | Already in package.json |
| react-markdown | ^10.1.0 | Markdown rendering for PR/issue bodies | Already in package.json |
| remark-gfm | ^4.0.1 | GitHub Flavored Markdown support | Already in package.json |
| rehype-highlight | ^7.0.2 | Code syntax highlighting in markdown | Already in package.json |
| rehype-sanitize | ^6.0.0 | XSS protection for rendered markdown | Already in package.json |
| react-virtuoso | ^4.18.1 | Virtual scrolling for long lists | Already in package.json |
| zustand | ^5 | State management for GitHub extension store | Already in package.json |
| lucide-react | ^0.563 | Icons (GitPullRequest, CircleDot, etc.) | Already in package.json |
| class-variance-authority | ^0.7.1 | Component variant styling | Already in package.json |
| framer-motion | ^12.34 | Animations (transitions, presence) | Already in package.json |

### No New Dependencies Required

Every library needed is already installed. Zero `npm install` or `cargo add` commands.

## Architecture Patterns

### Rust Module Structure

```
src-tauri/src/github/
  mod.rs           # Re-exports all commands (EXISTING, needs updating)
  auth.rs          # OAuth device flow (EXISTING)
  token.rs         # Keychain token storage (EXISTING)
  error.rs         # GitHubError enum (EXISTING, needs 2 new variants)
  types.rs         # Shared types (EXISTING, needs new structs)
  rate_limit.rs    # Rate limit checking (EXISTING)
  remote.rs        # Remote detection (EXISTING)
  client.rs        # NEW: Shared HTTP client helper
  pulls.rs         # NEW: PR list + PR detail commands
  issues.rs        # NEW: Issue list + Issue detail + comments command
```

### Frontend Structure

```
src/extensions/github/
  index.ts              # Extension entry point (EXISTING, needs blade registrations)
  githubStore.ts        # Zustand store (EXISTING, needs selectedRemote state)
  types.ts              # Frontend types (EXISTING, needs PR/Issue types)
  blades/
    GitHubAuthBlade.tsx       # (EXISTING)
    GitHubAccountBlade.tsx    # (EXISTING)
    PullRequestListBlade.tsx  # NEW
    PullRequestDetailBlade.tsx # NEW
    IssueListBlade.tsx        # NEW
    IssueDetailBlade.tsx      # NEW
  components/
    GitHubStatusButton.tsx    # (EXISTING)
    ScopeSelector.tsx         # (EXISTING)
    RateLimitBar.tsx          # (EXISTING)
    DeviceCodeDisplay.tsx     # (EXISTING)
    StatusBadge.tsx           # NEW: open/closed/merged/draft badge
    LabelPill.tsx             # NEW: colored label pill
    CICheckIndicator.tsx      # NEW: CI status dot/icon
    UserAvatar.tsx            # NEW: GitHub avatar with fallback
    TimeAgo.tsx               # NEW: relative time display
  hooks/
    useGitHubQuery.ts         # NEW: TanStack Query wrappers for GitHub data
```

### Pattern 1: Shared Authenticated Client Helper (Rust)

**What:** A reusable function that creates an authenticated reqwest client with standard GitHub API headers, handles rate limit extraction from response headers, and parses Link pagination headers.

**When to use:** Every GitHub API command.

**Why:** The existing codebase creates `reqwest::Client::new()` and manually adds auth/UA headers in every command (see `rate_limit.rs`, `token.rs`). This is fine for 2-3 commands but will cause duplication with 5+ new commands.

```rust
// src-tauri/src/github/client.rs
use reqwest::{Client, Response, header};
use super::error::GitHubError;
use super::token;

const GITHUB_API_BASE: &str = "https://api.github.com";
const USER_AGENT: &str = "FlowForge-Desktop";

/// Build an authenticated GET request to a GitHub API endpoint.
/// Token is fetched from keychain automatically.
pub async fn github_get(path: &str) -> Result<Response, GitHubError> {
    let token = token::get_token().await?;
    let client = Client::new();
    let url = format!("{}{}", GITHUB_API_BASE, path);

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    if resp.status() == 403 {
        // Check if rate limited
        if let Some(remaining) = resp.headers().get("x-ratelimit-remaining") {
            if remaining.to_str().unwrap_or("1") == "0" {
                return Err(GitHubError::RateLimitExceeded(
                    "API rate limit exceeded".to_string()
                ));
            }
        }
    }

    if resp.status() == 401 {
        return Err(GitHubError::NotAuthenticated);
    }

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(GitHubError::ApiError(format!(
            "GitHub API returned {}: {}", status, body
        )));
    }

    Ok(resp)
}

/// Authenticated GET with query parameters for pagination.
pub async fn github_get_with_params(
    path: &str,
    params: &[(&str, &str)],
) -> Result<Response, GitHubError> {
    let token = token::get_token().await?;
    let client = Client::new();
    let url = format!("{}{}", GITHUB_API_BASE, path);

    let resp = client
        .get(&url)
        .query(params)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    // Same error handling as above...
    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(GitHubError::ApiError(format!(
            "GitHub API returned {}: {}", status, body
        )));
    }

    Ok(resp)
}

/// Parse the Link header to extract the "next" page number.
/// GitHub Link header format:
/// <https://api.github.com/repos/owner/repo/pulls?page=2>; rel="next", ...
pub fn parse_next_page(link_header: &str) -> Option<u32> {
    for part in link_header.split(',') {
        let part = part.trim();
        if part.contains("rel=\"next\"") {
            // Extract URL between < and >
            if let Some(start) = part.find('<') {
                if let Some(end) = part.find('>') {
                    let url = &part[start + 1..end];
                    // Extract page= parameter
                    if let Some(page_pos) = url.find("page=") {
                        let page_str = &url[page_pos + 5..];
                        let page_end = page_str.find('&').unwrap_or(page_str.len());
                        return page_str[..page_end].parse::<u32>().ok();
                    }
                }
            }
        }
    }
    None
}

/// Extract rate limit info from response headers.
pub fn extract_rate_limit(resp: &Response) -> Option<(u32, u32)> {
    let remaining = resp.headers()
        .get("x-ratelimit-remaining")?
        .to_str().ok()?
        .parse::<u32>().ok()?;
    let limit = resp.headers()
        .get("x-ratelimit-limit")?
        .to_str().ok()?
        .parse::<u32>().ok()?;
    Some((remaining, limit))
}
```

**Confidence:** HIGH -- This follows the exact pattern established in the existing `rate_limit.rs` and `token.rs`, just extracted for reuse. The Link header parsing is a simple string operation; no need for `parse_link_header` crate dependency.

### Pattern 2: GitHub API Response Types (Rust)

**What:** Serde structs for deserializing GitHub API responses, with `#[serde(rename_all = "snake_case")]` for the GitHub API wire format (which uses `snake_case`) and separate IPC types with `#[serde(rename_all = "camelCase")]` for frontend consumption.

**Critical decision:** GitHub's API returns `snake_case` JSON (`pull_request`, `created_at`, `avatar_url`). The IPC types sent to the frontend use `camelCase` (matching existing `AuthResult`, `RateLimitInfo`). Use two-layer types: internal deserialization structs (snake_case, no `Type` derive) and IPC structs (camelCase, with `Type` derive for specta).

```rust
// src-tauri/src/github/types.rs (additions to existing file)

// ==========================================
// Internal deserialization types (GitHub API wire format)
// NOT exposed to frontend. No Type derive.
// ==========================================

/// GitHub user in API responses (minimal fields needed)
#[derive(Debug, Deserialize)]
pub struct GitHubUserRef {
    pub login: String,
    pub avatar_url: String,
}

/// GitHub label in API responses
#[derive(Debug, Deserialize)]
pub struct GitHubLabel {
    pub id: u64,
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}

/// GitHub milestone in API responses
#[derive(Debug, Deserialize)]
pub struct GitHubMilestone {
    pub number: u32,
    pub title: String,
    pub state: String,
}

/// Branch ref in PR responses
#[derive(Debug, Deserialize)]
pub struct GitHubBranchRef {
    #[serde(rename = "ref")]
    pub ref_name: String,
    pub sha: String,
}

/// Pull request from GitHub API (list endpoint)
#[derive(Debug, Deserialize)]
pub struct GitHubPullRequest {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub draft: Option<bool>,
    pub user: GitHubUserRef,
    pub head: GitHubBranchRef,
    pub base: GitHubBranchRef,
    pub labels: Vec<GitHubLabel>,
    pub created_at: String,
    pub updated_at: String,
    pub merged_at: Option<String>,
    pub body: Option<String>,
    pub comments: Option<u32>,
    pub review_comments: Option<u32>,
    pub commits: Option<u32>,
    pub additions: Option<u32>,
    pub deletions: Option<u32>,
    pub changed_files: Option<u32>,
    pub html_url: String,
}

/// Issue from GitHub API
#[derive(Debug, Deserialize)]
pub struct GitHubIssue {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub user: GitHubUserRef,
    pub labels: Vec<GitHubLabel>,
    pub assignees: Vec<GitHubUserRef>,
    pub milestone: Option<GitHubMilestone>,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
    pub body: Option<String>,
    pub comments: u32,
    pub html_url: String,
    /// Present if this "issue" is actually a PR
    pub pull_request: Option<serde_json::Value>,
}

/// Comment from GitHub API (used for both issue and PR comments)
#[derive(Debug, Deserialize)]
pub struct GitHubComment {
    pub id: u64,
    pub user: GitHubUserRef,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
}

// ==========================================
// IPC types (sent to frontend via Tauri specta)
// camelCase, with Type derive
// ==========================================

/// Pull request summary for list display
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestSummary {
    pub number: u32,
    pub title: String,
    pub state: String,         // "open" | "closed"
    pub draft: bool,
    pub merged: bool,
    pub author_login: String,
    pub author_avatar_url: String,
    pub head_ref: String,
    pub base_ref: String,
    pub labels: Vec<LabelInfo>,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    pub comment_count: u32,
}

/// Pull request detail (superset of summary)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestDetail {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub draft: bool,
    pub merged: bool,
    pub author_login: String,
    pub author_avatar_url: String,
    pub head_ref: String,
    pub head_sha: String,
    pub base_ref: String,
    pub labels: Vec<LabelInfo>,
    pub body: String,          // markdown body
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    pub comment_count: u32,
    pub review_comment_count: u32,
    pub commits: u32,
    pub additions: u32,
    pub deletions: u32,
    pub changed_files: u32,
    pub comments: Vec<CommentInfo>,
}

/// Issue summary for list display
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IssueSummary {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub author_login: String,
    pub author_avatar_url: String,
    pub labels: Vec<LabelInfo>,
    pub assignee_logins: Vec<String>,
    pub milestone_title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    pub comment_count: u32,
}

/// Issue detail
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IssueDetail {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub author_login: String,
    pub author_avatar_url: String,
    pub labels: Vec<LabelInfo>,
    pub assignees: Vec<UserInfo>,
    pub milestone: Option<MilestoneInfo>,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
    pub html_url: String,
    pub comment_count: u32,
    pub comments: Vec<CommentInfo>,
}

/// Label info (shared between PR and Issue)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LabelInfo {
    pub name: String,
    pub color: String,       // hex without #
    pub description: Option<String>,
}

/// User info
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    pub login: String,
    pub avatar_url: String,
}

/// Milestone info
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneInfo {
    pub number: u32,
    pub title: String,
    pub state: String,
}

/// Comment info (shared between PR and Issue)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommentInfo {
    pub id: u64,
    pub author_login: String,
    pub author_avatar_url: String,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
}

/// Paginated response wrapper
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedResponse<T: specta::Type + Clone> {
    pub items: Vec<T>,
    pub has_next_page: bool,
    pub next_page: Option<u32>,
}
```

**Note on serde rename strategy:** GitHub's API returns `snake_case` (e.g., `created_at`, `avatar_url`, `pull_request`). The internal deserialization structs use the default serde behavior which maps snake_case Rust fields to snake_case JSON -- no `rename_all` needed because Rust field names already match. The IPC types use `#[serde(rename_all = "camelCase")]` to match the existing codebase convention (see `AuthResult`, `RateLimitInfo`, `DeviceFlowResponse`). The `ref` field on branch refs needs `#[serde(rename = "ref")]` since `ref` is a Rust keyword.

**Confidence:** HIGH -- This follows the exact two-layer pattern established by `GitHubDeviceCodeResponse` (internal) vs `DeviceFlowResponse` (IPC) in auth.rs.

### Pattern 3: Tauri Commands for PR/Issue Data

**What:** Separate commands for list and detail views, with owner/repo passed as parameters (not read from state).

**Why pass owner/repo as params:** The frontend Zustand store (`githubStore.ts`) already holds `detectedRemotes` with `owner` and `repo` fields. The frontend decides which remote to query. This matches the pattern where Tauri commands are stateless data fetchers (like `get_commit_history` takes `skip` and `limit`). The token is the only thing read from Rust-side state (keychain).

```rust
// src-tauri/src/github/pulls.rs

use super::client::{github_get_with_params, parse_next_page};
use super::error::GitHubError;
use super::types::*;

/// List pull requests for a repository.
/// Supports pagination via page parameter and filtering by state.
#[tauri::command]
#[specta::specta]
pub async fn github_list_pull_requests(
    owner: String,
    repo: String,
    state: String,    // "open" | "closed" | "all"
    page: u32,
    per_page: u32,
) -> Result<PaginatedResponse<PullRequestSummary>, GitHubError> {
    let path = format!("/repos/{}/{}/pulls", owner, repo);
    let page_str = page.to_string();
    let per_page_str = per_page.to_string();

    let resp = github_get_with_params(&path, &[
        ("state", &state),
        ("page", &page_str),
        ("per_page", &per_page_str),
        ("sort", "updated"),
        ("direction", "desc"),
    ]).await?;

    // Parse pagination from Link header before consuming body
    let has_next = resp.headers()
        .get("link")
        .and_then(|v| v.to_str().ok())
        .map(|link| parse_next_page(link))
        .flatten();

    let prs: Vec<GitHubPullRequest> = resp.json().await
        .map_err(|e| GitHubError::Internal(format!("Failed to parse PRs: {}", e)))?;

    let summaries: Vec<PullRequestSummary> = prs.into_iter().map(|pr| {
        PullRequestSummary {
            number: pr.number,
            title: pr.title,
            state: pr.state.clone(),
            draft: pr.draft.unwrap_or(false),
            merged: pr.merged_at.is_some(),
            author_login: pr.user.login,
            author_avatar_url: pr.user.avatar_url,
            head_ref: pr.head.ref_name,
            base_ref: pr.base.ref_name,
            labels: pr.labels.into_iter().map(|l| LabelInfo {
                name: l.name,
                color: l.color,
                description: l.description,
            }).collect(),
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            html_url: pr.html_url,
            comment_count: pr.comments.unwrap_or(0),
        }
    }).collect();

    Ok(PaginatedResponse {
        items: summaries,
        has_next_page: has_next.is_some(),
        next_page: has_next,
    })
}

/// Get detailed pull request information including comments.
#[tauri::command]
#[specta::specta]
pub async fn github_get_pull_request(
    owner: String,
    repo: String,
    number: u32,
) -> Result<PullRequestDetail, GitHubError> {
    // Fetch PR detail
    let path = format!("/repos/{}/{}/pulls/{}", owner, repo, number);
    let resp = github_get(&path).await?;
    let pr: GitHubPullRequest = resp.json().await
        .map_err(|e| GitHubError::Internal(format!("Failed to parse PR: {}", e)))?;

    // Fetch comments (issue comments endpoint, not review comments)
    let comments_path = format!("/repos/{}/{}/issues/{}/comments", owner, repo, number);
    let comments = fetch_all_comments(&comments_path).await?;

    Ok(PullRequestDetail {
        number: pr.number,
        title: pr.title,
        state: pr.state.clone(),
        draft: pr.draft.unwrap_or(false),
        merged: pr.merged_at.is_some(),
        author_login: pr.user.login,
        author_avatar_url: pr.user.avatar_url,
        head_ref: pr.head.ref_name,
        head_sha: pr.head.sha,
        base_ref: pr.base.ref_name,
        labels: pr.labels.into_iter().map(|l| LabelInfo {
            name: l.name, color: l.color, description: l.description,
        }).collect(),
        body: pr.body.unwrap_or_default(),
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        html_url: pr.html_url,
        comment_count: pr.comments.unwrap_or(0),
        review_comment_count: pr.review_comments.unwrap_or(0),
        commits: pr.commits.unwrap_or(0),
        additions: pr.additions.unwrap_or(0),
        deletions: pr.deletions.unwrap_or(0),
        changed_files: pr.changed_files.unwrap_or(0),
        comments,
    })
}
```

**Confidence:** HIGH -- Follows identical patterns to existing commands.

### Pattern 4: TanStack Query Integration (Frontend)

**What:** Custom hooks wrapping `useQuery` and `useInfiniteQuery` with properly structured query keys for cache invalidation.

**Query key structure:**

```typescript
// Query keys for GitHub data
// Pattern: ["github", resource, owner, repo, ...params]

["github", "pulls", owner, repo, stateFilter]           // PR list
["github", "pull", owner, repo, number]                   // PR detail
["github", "issues", owner, repo, stateFilter]            // Issue list
["github", "issue", owner, repo, number]                  // Issue detail
```

```typescript
// src/extensions/github/hooks/useGitHubQuery.ts

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { commands } from "../../../bindings";

const PER_PAGE = 30;

export function usePullRequestList(
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
) {
  return useInfiniteQuery({
    queryKey: ["github", "pulls", owner, repo, state],
    queryFn: async ({ pageParam = 1 }) => {
      const result = await commands.githubListPullRequests(
        owner, repo, state, pageParam, PER_PAGE,
      );
      if (result.status === "error") {
        throw new Error(
          "message" in result.error ? result.error.message : result.error.type,
        );
      }
      return result.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextPage : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes (GitHub data changes frequently)
    enabled: !!owner && !!repo,
  });
}

export function usePullRequestDetail(
  owner: string,
  repo: string,
  number: number,
) {
  return useQuery({
    queryKey: ["github", "pull", owner, repo, number],
    queryFn: async () => {
      const result = await commands.githubGetPullRequest(owner, repo, number);
      if (result.status === "error") {
        throw new Error(
          "message" in result.error ? result.error.message : result.error.type,
        );
      }
      return result.data;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!owner && !!repo && number > 0,
  });
}

// Similar for useIssueList and useIssueDetail...
```

**Confidence:** HIGH -- This is the exact pattern used in `CommitHistory.tsx` (`useInfiniteQuery`) and `CommitDetailsBlade.tsx` (`useQuery`).

### Pattern 5: Blade Registration via Extension API

**What:** Register 4 new blades through the existing `onActivate` in `index.ts`, with lazy loading via dynamic imports.

```typescript
// In src/extensions/github/index.ts onActivate():

// PR List blade
api.registerBlade({
  type: "pull-requests",
  title: "Pull Requests",
  component: PullRequestListBlade!,
  singleton: true,
  wrapInPanel: true,
  showBack: true,
});

// PR Detail blade (NOT singleton -- multiple PRs can be open)
api.registerBlade({
  type: "pull-request",
  title: "Pull Request",
  component: PullRequestDetailBlade!,
  singleton: false,
  wrapInPanel: true,
  showBack: true,
});

// Toolbar action for "Open PRs"
api.contributeToolbar({
  id: "open-prs",
  label: "Pull Requests",
  icon: GitPullRequest,
  group: "app",
  priority: 50,
  execute: () => openBlade("ext:github:pull-requests", {}),
  when: () => {
    const gh = useGitHubStore.getState();
    return gh.isAuthenticated && gh.detectedRemotes.length > 0;
  },
});
```

**Blade naming convention:** Extension blades are namespaced as `ext:github:pull-requests`, `ext:github:pull-request`, `ext:github:issues`, `ext:github:issue`. This follows the existing convention (`ext:github:sign-in`, `ext:github:account`).

**Confidence:** HIGH -- Directly follows the existing blade registration pattern.

### Pattern 6: PR/Issue List Blade Component

**What:** A list blade using Virtuoso for virtual scrolling with infinite scroll, matching the `CommitHistory.tsx` pattern.

```tsx
// src/extensions/github/blades/PullRequestListBlade.tsx

import { useInfiniteQuery } from "@tanstack/react-query";
import { GitPullRequest, Loader2 } from "lucide-react";
import { useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { commands } from "../../../bindings";
import { useBladeNavigation } from "../../../hooks/useBladeNavigation";
import { BladeContentEmpty, BladeContentLoading, BladeContentError } from "../../../blades/_shared";
import { useGitHubStore } from "../githubStore";
import { StatusBadge } from "../components/StatusBadge";
import { LabelPill } from "../components/LabelPill";
import { UserAvatar } from "../components/UserAvatar";
import { TimeAgo } from "../components/TimeAgo";
import { cn } from "../../../lib/utils";

type StateFilter = "open" | "closed" | "all";

export function PullRequestListBlade() {
  const { openBlade } = useBladeNavigation();
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const remotes = useGitHubStore((s) => s.detectedRemotes);
  const remote = remotes[0]; // Use first detected remote

  const query = useInfiniteQuery({
    queryKey: ["github", "pulls", remote?.owner, remote?.repo, stateFilter],
    queryFn: async ({ pageParam = 1 }) => {
      const result = await commands.githubListPullRequests(
        remote!.owner, remote!.repo, stateFilter, pageParam, 30,
      );
      if (result.status === "error") {
        throw new Error("message" in result.error ? result.error.message : result.error.type);
      }
      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.nextPage : undefined,
    initialPageParam: 1,
    enabled: !!remote,
    staleTime: 2 * 60 * 1000,
  });

  if (!remote) {
    return <BladeContentEmpty icon={GitPullRequest} message="No GitHub remote detected" />;
  }

  if (query.isLoading) return <BladeContentLoading />;
  if (query.error) return <BladeContentError message="Failed to load pull requests" onRetry={() => query.refetch()} />;

  const prs = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-ctp-surface0">
        {(["open", "closed", "all"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStateFilter(filter)}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors capitalize",
              stateFilter === filter
                ? "bg-ctp-surface1 text-ctp-text font-medium"
                : "text-ctp-overlay0 hover:text-ctp-subtext1 hover:bg-ctp-surface0",
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* PR list */}
      <div className="flex-1 min-h-0">
        {prs.length === 0 ? (
          <BladeContentEmpty icon={GitPullRequest} message={`No ${stateFilter} pull requests`} />
        ) : (
          <Virtuoso
            data={prs}
            endReached={() => {
              if (query.hasNextPage && !query.isFetchingNextPage) {
                query.fetchNextPage();
              }
            }}
            itemContent={(_, pr) => (
              <button
                type="button"
                onClick={() => openBlade("ext:github:pull-request", { owner: remote.owner, repo: remote.repo, number: pr.number }, `#${pr.number} ${pr.title}`)}
                className="w-full text-left px-3 py-2.5 border-b border-ctp-surface0 hover:bg-ctp-surface0/50 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <StatusBadge state={pr.state} merged={pr.merged} draft={pr.draft} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ctp-text truncate">{pr.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-ctp-overlay0">
                      <span>#{pr.number}</span>
                      <span>{pr.authorLogin}</span>
                      <TimeAgo date={pr.createdAt} />
                      {pr.labels.length > 0 && (
                        <div className="flex gap-1">
                          {pr.labels.slice(0, 3).map((l) => (
                            <LabelPill key={l.name} name={l.name} color={l.color} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )}
            components={{
              Footer: () => query.isFetchingNextPage ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-ctp-subtext0" />
                </div>
              ) : null,
            }}
          />
        )}
      </div>
    </div>
  );
}
```

**Confidence:** HIGH -- Directly based on the `CommitHistory.tsx` pattern with Virtuoso infinite scroll.

### Pattern 7: PR/Issue Detail Blade with Markdown

**What:** A detail blade that shows PR/issue metadata, renders the body via the existing `MarkdownRenderer`, and displays comments.

```tsx
// src/extensions/github/blades/PullRequestDetailBlade.tsx (key structure)

import { useQuery } from "@tanstack/react-query";
import { MarkdownRenderer } from "../../../components/markdown/MarkdownRenderer";
import { BladeContentLoading, BladeContentError } from "../../../blades/_shared";

interface PullRequestDetailBladeProps {
  owner: string;
  repo: string;
  number: number;
}

export function PullRequestDetailBlade({ owner, repo, number }: PullRequestDetailBladeProps) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["github", "pull", owner, repo, number],
    queryFn: async () => {
      const result = await commands.githubGetPullRequest(owner, repo, number);
      if (result.status === "error") throw new Error(/*...*/);
      return result.data;
    },
  });

  if (isLoading) return <BladeContentLoading />;
  if (error || !data) return <BladeContentError message="Failed to load PR" onRetry={refetch} />;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header section */}
      <div className="px-4 py-4 border-b border-ctp-surface0">
        <h2 className="text-base font-semibold text-ctp-text">{data.title}</h2>
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge state={data.state} merged={data.merged} draft={data.draft} />
          <span className="text-xs text-ctp-overlay0">
            {data.authorLogin} wants to merge {data.commits} commits into {data.baseRef} from {data.headRef}
          </span>
        </div>
        {/* Stats: +additions -deletions, changed files */}
        <div className="flex gap-3 mt-2 text-xs">
          <span className="text-ctp-green">+{data.additions}</span>
          <span className="text-ctp-red">-{data.deletions}</span>
          <span className="text-ctp-overlay0">{data.changedFiles} files</span>
        </div>
      </div>

      {/* Body (markdown) */}
      {data.body && (
        <div className="px-4 py-4 border-b border-ctp-surface0">
          <MarkdownRenderer content={data.body} />
        </div>
      )}

      {/* Comments */}
      <div className="px-4 py-4">
        <h3 className="text-sm font-medium text-ctp-subtext1 mb-3">
          Comments ({data.comments.length})
        </h3>
        <div className="space-y-4">
          {data.comments.map((comment) => (
            <div key={comment.id} className="bg-ctp-surface0/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <UserAvatar login={comment.authorLogin} avatarUrl={comment.authorAvatarUrl} size="sm" />
                <span className="text-sm font-medium text-ctp-text">{comment.authorLogin}</span>
                <TimeAgo date={comment.createdAt} />
              </div>
              <MarkdownRenderer content={comment.body} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Confidence:** HIGH -- Uses the existing `MarkdownRenderer` component unchanged.

### Anti-Patterns to Avoid

- **Reading token on the frontend:** Token stays in Rust/keychain. Frontend passes `owner`/`repo`; Rust commands call `token::get_token()` internally. This is the established pattern from Phase 34.
- **Creating a new reqwest::Client per command:** Each command currently creates `reqwest::Client::new()`. This works fine because reqwest's `Client::new()` is cheap and internally uses connection pooling. Do NOT try to manage a global client in Tauri state; it adds complexity for no benefit at this request volume.
- **Using GitHub's GraphQL API:** Stick with REST. The project already uses reqwest for REST calls. GraphQL would require a new dependency (graphql_client) and different patterns. REST is sufficient for list/detail views.
- **Storing paginated data in Zustand:** Use TanStack Query for all fetched data. Zustand is for auth state and detected remotes only. TanStack Query handles caching, pagination, and invalidation.
- **Coupling blade components to store state for owner/repo:** Pass owner/repo as blade props so blades work with any repo, not just the "current" one. The list blade reads from the store to determine which remote to use, but passes explicit values when opening detail blades.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom HTML parser | `MarkdownRenderer` component (already exists) | GFM tables, task lists, code highlighting, XSS sanitization -- all handled |
| Virtual scrolling | Manual scroll position tracking | `react-virtuoso` (already installed) | Handles dynamic heights, infinite scroll, edge cases |
| Data caching & pagination | Manual cache in Zustand | `@tanstack/react-query` with `useInfiniteQuery` | Automatic stale-while-revalidate, deduplication, cache invalidation |
| Link header parsing | Full RFC 5988 parser | Simple string split on `rel="next"` | GitHub's Link header format is predictable; a regex/split is sufficient |
| Type generation | Manual TypeScript types | `specta` + `tauri-specta` auto-generation | Types in `bindings.ts` are auto-generated from Rust structs |
| Icon system | Custom SVG components | `lucide-react` (already installed) | Has `GitPullRequest`, `CircleDot`, `CheckCircle2`, `XCircle`, `Tag`, etc. |

**Key insight:** The project already has every library needed. The implementation is purely about writing commands and components, not adding infrastructure.

## Common Pitfalls

### Pitfall 1: GitHub Issues API Returns PRs
**What goes wrong:** The `/repos/{owner}/{repo}/issues` endpoint returns BOTH issues AND pull requests. PRs appear as issues with a `pull_request` field.
**Why it happens:** GitHub considers every PR to be an issue.
**How to avoid:** Filter out items with a non-null `pull_request` field in the Rust command before returning to the frontend.
**Warning signs:** Issue counts are unexpectedly high; PRs appear in the issues list.

### Pitfall 2: Rate Limiting with Multiple API Calls
**What goes wrong:** The PR detail command makes 2 API calls (PR + comments). The issue detail also makes 2 calls. Combined with list views, this can exhaust the 5,000 requests/hour limit quickly.
**Why it happens:** Each Tauri command invocation triggers fresh API calls.
**How to avoid:** Use TanStack Query's `staleTime` (2 min for lists, 1 min for details) to avoid redundant fetches. Show rate limit info in the UI (the `RateLimitBar` component already exists). Consider adding an `If-None-Match`/`If-Modified-Since` conditional request pattern (returns 304 and does NOT count against rate limit).
**Warning signs:** `RateLimitBar` showing rapid consumption; 403 responses from API.

### Pitfall 3: u64 IDs and JavaScript Number Limits
**What goes wrong:** GitHub IDs and comment IDs are `u64`. JavaScript `Number` loses precision above 2^53.
**Why it happens:** JSON serialization sends u64 as a number literal.
**How to avoid:** This was already handled in Phase 34 (commit `62f5b5e`). For comment IDs and label IDs, use `u64` in Rust and `bigint` in TypeScript bindings (specta handles this). Alternatively, keep IDs as u64 since GitHub IDs haven't exceeded 2^53 yet, but be aware of the theoretical risk. Check that specta's handling is consistent.
**Warning signs:** Truncated or wrong IDs when comparing/selecting items.

### Pitfall 4: Merged State is Not a Field on List Endpoint
**What goes wrong:** The PR list endpoint does NOT return a `merged` boolean field. Only the detail endpoint has it.
**Why it happens:** GitHub API design choice.
**How to avoid:** Use `merged_at` presence as the indicator: `merged: pr.merged_at.is_some()`. The `merged_at` field IS available on the list endpoint. A closed PR with `merged_at != null` is merged; a closed PR with `merged_at == null` was closed without merging.
**Warning signs:** All closed PRs showing as "Closed" instead of distinguishing "Merged" vs "Closed".

### Pitfall 5: Empty Body Fields
**What goes wrong:** PR and issue `body` can be `null` from the API, not just empty string.
**Why it happens:** Users sometimes create PRs/issues without a description.
**How to avoid:** Use `Option<String>` in the Rust deserialization type, and `pr.body.unwrap_or_default()` when converting to IPC type.
**Warning signs:** Deserialization errors when body is null.

### Pitfall 6: CI Check Status Complexity
**What goes wrong:** Getting CI status requires a SEPARATE API call per PR (`GET /repos/{owner}/{repo}/commits/{sha}/check-runs`). For a list of 30 PRs, this would be 30 additional API calls.
**Why it happens:** GitHub check runs are per-commit, not per-PR.
**How to avoid:** Do NOT fetch CI status in the list view. Show CI status only in the detail view where a single additional API call is acceptable. In the list, show only the PR state badge (open/closed/merged/draft). This is a deliberate trade-off: CI status in lists requires either N+1 queries or GraphQL (which we're not using).
**Warning signs:** List view making 30+ API calls; rate limit depletion; slow list loading.

### Pitfall 7: Specta Generic Type Support
**What goes wrong:** `PaginatedResponse<T>` with a generic type parameter may not work with specta's TypeScript generation.
**Why it happens:** Specta's support for generics in Tauri command return types can be limited.
**How to avoid:** Instead of a generic `PaginatedResponse<T>`, create concrete types: `PullRequestListResponse`, `IssueListResponse` that each contain `items: Vec<...>`, `has_next_page: bool`, `next_page: Option<u32>`. This is less DRY but avoids specta limitations.
**Warning signs:** Compilation errors in specta macro expansion; missing or wrong TypeScript types in `bindings.ts`.

## Tailwind v4 Patterns

### Color Token Usage (Catppuccin)

The project uses `@catppuccin/tailwindcss` with the mocha flavor. All colors use the `ctp-` prefix. Existing patterns from the codebase:

```
// Text hierarchy
text-ctp-text          // Primary text (white in mocha)
text-ctp-subtext1      // Secondary text (slightly dimmer)
text-ctp-subtext0      // Tertiary text (dimmer)
text-ctp-overlay0      // Muted text (timestamps, metadata)
text-ctp-overlay1      // Icons in inactive state

// Backgrounds
bg-ctp-base            // Main background
bg-ctp-mantle          // Slightly elevated
bg-ctp-crust           // Title bars, headers
bg-ctp-surface0        // Cards, list items
bg-ctp-surface1        // Active/selected items
bg-ctp-surface0/30     // Subtle card backgrounds

// Borders
border-ctp-surface0    // Default dividers
border-ctp-surface1    // Active borders

// Semantic colors
text-ctp-green / bg-ctp-green    // Success, merged PRs
text-ctp-red / bg-ctp-red        // Error, closed PRs, destructive
text-ctp-blue / bg-ctp-blue      // Primary actions, links, open state
text-ctp-yellow / bg-ctp-yellow  // Warnings, draft state
text-ctp-peach                    // Inline code
```

### Status Badge Patterns

```tsx
// StatusBadge component for PR/Issue state
function StatusBadge({ state, merged, draft }: StatusBadgeProps) {
  if (merged) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-ctp-mauve/15 text-ctp-mauve">
        <GitMerge className="w-3 h-3" />
        Merged
      </span>
    );
  }
  if (draft) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-ctp-overlay0/15 text-ctp-overlay0">
        <GitPullRequestDraft className="w-3 h-3" />
        Draft
      </span>
    );
  }
  if (state === "open") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-ctp-green/15 text-ctp-green">
        <GitPullRequest className="w-3 h-3" />
        Open
      </span>
    );
  }
  // closed (not merged)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-ctp-red/15 text-ctp-red">
      <GitPullRequestClosed className="w-3 h-3" />
      Closed
    </span>
  );
}
```

### Label Pill with Dynamic Color

GitHub labels have hex colors. Use inline `style` for the background with Tailwind for structure:

```tsx
function LabelPill({ name, color }: { name: string; color: string }) {
  // GitHub color is 6-char hex without #
  const bgColor = `#${color}20`; // 12.5% opacity for background
  const textColor = `#${color}`;

  // For light colors, we need to check luminance
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap"
      style={{
        backgroundColor: bgColor,
        color: luminance > 0.6 ? `#${color}` : textColor,
        border: `1px solid #${color}40`,
      }}
    >
      {name}
    </span>
  );
}
```

**Note:** Tailwind v4 cannot generate arbitrary hex colors at build time. The `style` attribute is the correct approach for dynamic GitHub label colors. This is not a workaround; it's the intended pattern for truly dynamic colors.

### List Item Row Pattern

```tsx
// Consistent with CommitHistory.tsx row pattern
<button
  type="button"
  className={cn(
    "w-full text-left px-3 py-2.5 cursor-pointer border-b border-ctp-surface0",
    "hover:bg-ctp-surface0/50 transition-colors",
    isSelected && "bg-ctp-blue/20",
  )}
>
```

## Refactoring for Extensibility

### Identified Refactoring Opportunities

#### 1. Shared GitHub API Client (Rust) -- NEW FILE

**File:** `src-tauri/src/github/client.rs`

**Why:** The existing commands (`rate_limit.rs`, `token.rs`) repeat the same pattern of creating a `reqwest::Client`, adding auth headers, and checking response status. With 5-6 new commands, this duplication becomes maintenance debt.

**What to extract:**
- `github_get(path)` -- authenticated GET
- `github_get_with_params(path, params)` -- authenticated GET with query params
- `parse_next_page(link_header)` -- Link header pagination parsing
- `extract_rate_limit(response)` -- rate limit header extraction

**Impact:** The existing `rate_limit.rs` and `token.rs` commands can optionally be refactored to use this helper too, but this is not required for Phase 35.

#### 2. Error Enum Extension (Rust) -- EXISTING FILE

**File:** `src-tauri/src/github/error.rs`

**Change:** Add one new variant:

```rust
#[error("API error: {0}")]
ApiError(String),
```

This covers generic GitHub API errors (404 repo not found, 422 validation, etc.) that aren't specifically auth or rate-limit related.

#### 3. Frontend Shared Components for List/Detail Pattern

**Problem:** The PR list and issue list blades will have nearly identical structure: filter tabs at top, virtual-scrolled list, empty/loading/error states. Similarly, PR detail and issue detail share: header with metadata, markdown body section, comments section.

**Proposal:** Do NOT create a formal `ListBlade` or `DetailBlade` abstraction yet. Instead, extract small reusable components that can be composed:

| Component | Purpose | Reuse Potential |
|-----------|---------|-----------------|
| `StatusBadge` | PR/Issue state indicator | Used in list rows and detail headers |
| `LabelPill` | Colored label display | Used in list rows and detail headers |
| `UserAvatar` | GitHub avatar with fallback | Used in list rows, detail headers, comments |
| `TimeAgo` | Relative timestamp | Used in list rows and comments |
| `FilterTabs` | Open/Closed/All tab bar | Used by both PR and Issue list blades |
| `CommentCard` | Comment with avatar, time, markdown body | Used by both PR and Issue detail blades |

**Why not a formal `ListBlade` wrapper:** The PR list and issue list differ in their row content (PRs show branch refs and CI status; issues show assignees and milestones). A generic wrapper would either be too abstract or too leaky. Small composable components are more flexible.

**Future extensibility:** If a third extension needs a list-detail pattern (e.g., GitHub Actions, Releases), THEN extract a shared pattern. Two instances are not enough to justify an abstraction.

#### 4. GitHub Store Extension (Frontend) -- EXISTING FILE

**File:** `src/extensions/github/githubStore.ts`

**Change:** Add a `selectedRemoteIndex` field so users can switch between multiple remotes (e.g., `origin` vs `upstream`). Also add a derived selector for the currently selected remote.

```typescript
// Addition to GitHubState interface:
selectedRemoteIndex: number;

// Addition to actions:
setSelectedRemote: (index: number) => void;

// Derived helper (outside store):
export function getSelectedRemote(): GitHubRemote | null {
  const state = useGitHubStore.getState();
  return state.detectedRemotes[state.selectedRemoteIndex] ?? null;
}
```

#### 5. Extension Index Entry Point -- EXISTING FILE

**File:** `src/extensions/github/index.ts`

**Changes needed:**
- Add lazy imports for 4 new blade components
- Add 4 new `api.registerBlade()` calls
- Add 2 new `api.contributeToolbar()` calls (Open PRs, Open Issues buttons)
- Add 2 new `api.registerCommand()` calls

The `ensureComponents()` function pattern is already established for lazy loading.

#### 6. lib.rs Command Registration -- EXISTING FILE

**File:** `src-tauri/src/lib.rs`

**Changes needed:**
- Add `use` imports for new commands
- Add new commands to `collect_commands![]` macro
- Follow existing grouping pattern (add a `// GitHub read commands` comment group)

#### 7. mod.rs Re-exports -- EXISTING FILE

**File:** `src-tauri/src/github/mod.rs`

**Changes needed:**
- Add `pub mod client;`
- Add `pub mod pulls;`
- Add `pub mod issues;`
- Add re-exports: `pub use pulls::{github_list_pull_requests, github_get_pull_request};`
- Add re-exports: `pub use issues::{github_list_issues, github_get_issue};`

## Code Examples

### Existing Patterns to Follow

#### Tauri Command Pattern (from history.rs)
```rust
// Source: src-tauri/src/git/history.rs
#[tauri::command]
#[specta::specta]
pub async fn get_commit_history(
    skip: u32,
    limit: u32,
    state: State<'_, RepositoryState>,
) -> Result<Vec<CommitSummary>, GitError> {
    // Note: GitHub commands don't use State<RepositoryState>
    // because they use token::get_token() instead
}
```

#### TanStack InfiniteQuery Pattern (from CommitHistory.tsx)
```typescript
// Source: src/components/commit/CommitHistory.tsx
const historyQuery = useInfiniteQuery({
    queryKey: ["commitHistory"],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await commands.getCommitHistory(pageParam, PAGE_SIZE);
      if (result.status === "ok") return result.data;
      throw new Error(/* extract message */);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
    initialPageParam: 0,
});
```

#### Extension Blade Registration (from index.ts)
```typescript
// Source: src/extensions/github/index.ts
api.registerBlade({
    type: "sign-in",
    title: "GitHub Sign In",
    component: GitHubAuthBlade!,
    singleton: true,
    wrapInPanel: true,
    showBack: true,
});
```

#### Blade Content States (from blades/_shared)
```typescript
// Source: src/blades/_shared/
// Loading: <BladeContentLoading />
// Error:   <BladeContentError message="..." onRetry={refetch} />
// Empty:   <BladeContentEmpty icon={Icon} message="..." />
```

#### Markdown Rendering (from MarkdownRenderer.tsx)
```tsx
// Source: src/components/markdown/MarkdownRenderer.tsx
<MarkdownRenderer content={markdownString} />
// Already handles: GFM tables, task lists, code blocks with
// syntax highlighting, links, images, XSS sanitization
```

#### Authenticated GitHub API Call (from rate_limit.rs)
```rust
// Source: src-tauri/src/github/rate_limit.rs
let access_token = token::get_token().await?;
let client = reqwest::Client::new();

let resp = client
    .get("https://api.github.com/rate_limit")
    .header("Authorization", format!("Bearer {}", access_token))
    .header("User-Agent", "FlowForge-Desktop")
    .header("Accept", "application/vnd.github+json")
    .timeout(std::time::Duration::from_secs(10))
    .send()
    .await
    .map_err(|e| GitHubError::NetworkError(format!("Rate limit check failed: {}", e)))?;
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| GitHub API v3 default Accept header | `application/vnd.github+json` with `X-GitHub-Api-Version: 2022-11-28` | Ensures stable API behavior |
| Offset-based pagination for all endpoints | Still offset-based for issues/PRs (cursor-based only for some newer endpoints) | Use `page` + `per_page` params, parse `Link` header |
| Single `merged` field on list | `merged_at` as proxy on list, `merged` only on detail | Check `merged_at.is_some()` for list items |

## Open Questions

1. **CI Check Status in List View**
   - What we know: Requires per-PR API call to `/commits/{sha}/check-runs`. For 30 PRs = 30 extra calls.
   - What's unclear: Whether users expect CI indicators in the list vs only in detail.
   - Recommendation: Phase 35 shows CI status ONLY in detail view. Add list-level CI indicators as a future enhancement with conditional fetching or background polling.

2. **PR Review Comments vs Issue Comments**
   - What we know: PRs have TWO comment types: issue comments (general discussion) and review comments (inline on code). Different API endpoints.
   - What's unclear: Should the detail view show both types interleaved by date, or only general comments?
   - Recommendation: Show only issue comments (`/issues/{number}/comments`) in Phase 35. Review comments (inline code feedback) are a Phase 36+ concern since they require showing diff context.

3. **Multiple Remote Selection**
   - What we know: The store holds `detectedRemotes` as an array. Most repos have 1 remote, but forks have `origin` + `upstream`.
   - What's unclear: UX for selecting which remote to query.
   - Recommendation: Default to `detectedRemotes[0]`. Add a remote selector dropdown in the list blade header if `detectedRemotes.length > 1`.

4. **Specta Generic Support**
   - What we know: Specta v2 rc.22 is used. Generic types in command return values may or may not work.
   - What's unclear: Whether `PaginatedResponse<T>` will generate correct TypeScript.
   - Recommendation: Test with a generic first. If specta fails, fall back to concrete types (`PullRequestListResponse`, `IssueListResponse`).

## Concrete File Change Summary

### New Files (6)

| File | Purpose | LOC Estimate |
|------|---------|-------------|
| `src-tauri/src/github/client.rs` | Shared authenticated HTTP helper | ~80 |
| `src-tauri/src/github/pulls.rs` | PR list and detail commands | ~120 |
| `src-tauri/src/github/issues.rs` | Issue list, detail, and comments commands | ~140 |
| `src/extensions/github/blades/PullRequestListBlade.tsx` | PR list blade | ~120 |
| `src/extensions/github/blades/PullRequestDetailBlade.tsx` | PR detail blade | ~150 |
| `src/extensions/github/blades/IssueListBlade.tsx` | Issue list blade | ~120 |
| `src/extensions/github/blades/IssueDetailBlade.tsx` | Issue detail blade | ~140 |
| `src/extensions/github/components/StatusBadge.tsx` | State badge component | ~50 |
| `src/extensions/github/components/LabelPill.tsx` | Colored label pill | ~30 |
| `src/extensions/github/components/UserAvatar.tsx` | Avatar with fallback | ~25 |
| `src/extensions/github/components/TimeAgo.tsx` | Relative time display | ~25 |
| `src/extensions/github/components/CommentCard.tsx` | Comment display card | ~40 |
| `src/extensions/github/hooks/useGitHubQuery.ts` | TanStack Query hooks | ~80 |

### Modified Files (5)

| File | Change | LOC Estimate |
|------|--------|-------------|
| `src-tauri/src/github/mod.rs` | Add module declarations and re-exports | +8 |
| `src-tauri/src/github/types.rs` | Add PR, Issue, Comment, Label IPC types | +120 |
| `src-tauri/src/github/error.rs` | Add `ApiError` variant | +3 |
| `src-tauri/src/lib.rs` | Add new commands to `collect_commands![]` | +8 |
| `src/extensions/github/index.ts` | Register new blades, commands, toolbar actions | +60 |

### Total Estimated Changes

- **New Rust LOC:** ~340
- **New TypeScript/TSX LOC:** ~640
- **Modified LOC:** ~200
- **Total:** ~1,180 LOC
- **New dependencies:** 0

## Sources

### Primary (HIGH confidence)
- FlowForge codebase: `src-tauri/src/github/` -- existing Rust module structure, auth pattern, error handling, types
- FlowForge codebase: `src/extensions/github/` -- existing extension entry point, store, blade components
- FlowForge codebase: `src/components/markdown/MarkdownRenderer.tsx` -- existing markdown rendering setup
- FlowForge codebase: `src/components/commit/CommitHistory.tsx` -- existing TanStack `useInfiniteQuery` + Virtuoso pattern
- FlowForge codebase: `src/blades/_shared/` -- existing blade content state components
- FlowForge codebase: `src/extensions/ExtensionAPI.ts` -- blade registration API
- [GitHub REST API - Pull Requests](https://docs.github.com/en/rest/pulls/pulls) -- PR endpoint response fields
- [GitHub REST API - Issues](https://docs.github.com/en/rest/issues/issues) -- Issue endpoint response fields
- [GitHub REST API - Pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api) -- Link header format
- [GitHub REST API - Issue Comments](https://docs.github.com/en/rest/issues/comments) -- Comments endpoint

### Secondary (MEDIUM confidence)
- [GitHub REST API - Check Runs](https://docs.github.com/en/rest/checks/runs) -- CI status endpoint
- [GitHub REST API - Commit Statuses](https://docs.github.com/en/rest/commits/statuses) -- Combined status endpoint

### Tertiary (LOW confidence)
- [parse_link_header crate](https://crates.io/crates/parse_link_header) -- Available but NOT recommended (manual parsing is simpler)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, verified in package.json and Cargo.toml
- Architecture: HIGH -- follows established codebase patterns exactly, every pattern cited from existing code
- Rust implementation: HIGH -- follows auth.rs/rate_limit.rs/remote.rs patterns, GitHub API well-documented
- Frontend implementation: HIGH -- follows CommitHistory.tsx/CommitDetailsBlade.tsx patterns exactly
- Pitfalls: HIGH -- based on direct GitHub API documentation and established project patterns
- Refactoring scope: MEDIUM -- small component extraction is straightforward, but generic type support in specta needs validation

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, well-established APIs)
