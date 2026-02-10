# Phase 36: GitHub Write Operations & Extension Manager - Architecture Research

**Researched:** 2026-02-10
**Domain:** GitHub API write operations, extension lifecycle management, extensibility patterns, mutation state management
**Confidence:** HIGH

## Summary

Phase 36 adds two distinct capability sets to FlowForge: (1) GitHub write operations (merge PR with strategy selection, create PR from current branch) and (2) a full extension manager UI (install from GitHub URL, enable/disable, uninstall, permission review). The architectural challenge is not the individual features -- they are straightforward API calls and UI blades -- but rather **how to structure the code so future write operations (reviews, releases, issue creation) and new extension sources (marketplace, local) can be added without refactoring existing code**.

The existing codebase provides excellent foundations. The Rust `github/` module already has a shared authenticated HTTP client (`client.rs`) with `github_get` and `github_get_with_params` helpers, a typed error system (`GitHubError` enum with tagged variants), and clean IPC/internal type separation. The frontend uses TanStack Query hooks (`useGitHubQuery.ts`) for data fetching with structured `queryKey` namespacing (`["ext:github", ...]`). The extension system (`ExtensionHost`, `ExtensionAPI`, manifest discovery) supports built-in and filesystem-discovered extensions with full lifecycle management. The existing patterns are sound -- the task is to *extend* them symmetrically for write operations and extension management, not to refactor them.

The critical architectural insight is that write operations must follow a **command pattern** on the Rust side: each write operation is a dedicated Tauri command (e.g., `github_merge_pull_request`, `github_create_pull_request`) that mirrors the existing read command structure, sharing the same `client.rs` helpers but adding POST/PUT methods. On the frontend, TanStack Query's `useMutation` hook provides the mutation lifecycle (isPending, isError, isSuccess) with automatic cache invalidation via `onSuccess: () => queryClient.invalidateQueries()`. This is the standard pattern that the codebase already uses for TanStack Query reads -- mutations are the natural complement.

**Primary recommendation:** Add `github_post` and `github_put` helpers to `client.rs`, create `merge.rs` and `create_pr.rs` modules in the Rust `github/` directory, build corresponding `useMutation` hooks in the frontend, extend `ExtensionHost` with install/uninstall/enable/disable operations, and add an extension manager blade through the existing extension registration system. No new dependencies required on either side.

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| reqwest | 0.13 (existing) | HTTP POST/PUT for GitHub write operations | Already handles GET; adding POST/PUT methods uses the same client |
| serde/serde_json | 1.x (existing) | Serialize request bodies, deserialize responses | Already in Cargo.toml |
| tokio | 1.x (existing) | Async runtime for write commands | Already in Cargo.toml with "full" features |
| tauri-specta | 2.0.0-rc.21 (existing) | Type-safe IPC for new write commands | Already used for all Tauri commands |
| @tanstack/react-query | ^5 (existing) | `useMutation` for write operations, cache invalidation | Already used for all GitHub queries |
| zustand | ^5 (existing) | Extension manager state, PR form state | Already used for all stores |
| @tauri-apps/plugin-store | ^2 (existing) | Persist extension enable/disable state | Already used via `getStore()` for settings |
| git2 | 0.20 (existing) | Get current branch name, commit messages for PR pre-fill | Already in Cargo.toml |
| tokio::fs | 1.x (existing) | Extension directory operations (clone target, delete) | Already available via tokio "full" |

### Supporting (no new installs)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | ^12 (existing) | Confirm dialog transitions, extension card animations | Already used for UI transitions |
| react-markdown | ^10 (existing) | PR body preview during creation | Already used for PR/issue body rendering |
| lucide-react | ^0.563 (existing) | Icons for merge strategies, extension manager UI | Already used throughout |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| git2 for branch/commit info for PR pre-fill | Tauri command calling `git log` via process | git2 is already used throughout; parsed commit data is more reliable than stdout parsing |
| Tauri plugin-store for extension enable/disable state | Dedicated SQLite or JSON file | plugin-store is already used for settings; extension state is small (a list of IDs); no need for a separate persistence mechanism |
| Shell `git clone` for extension install from GitHub URL | Custom HTTP download + unzip | `git clone` is simpler, handles authentication if configured, and gives the extension a proper git repo for future update support |
| TanStack Query useMutation for write ops | Zustand actions with manual loading state | useMutation provides isPending/isError/isSuccess lifecycle, automatic cache invalidation, retry, and is the standard pattern for mutations in TanStack Query |

## Architecture Patterns

### Recommended Project Structure

```
src-tauri/src/
  github/
    mod.rs                       # MODIFIED: add re-exports for new write commands
    client.rs                    # MODIFIED: add github_post, github_put helpers
    error.rs                     # MODIFIED: add MergeConflict, ValidationFailed variants
    types.rs                     # MODIFIED: add MergeResult, CreatePrRequest/Response
    pulls.rs                     # MODIFIED: add github_merge_pull_request, github_create_pull_request
    issues.rs                    # UNCHANGED
    auth.rs                      # UNCHANGED
    token.rs                     # UNCHANGED
    remote.rs                    # UNCHANGED
    rate_limit.rs                # UNCHANGED
    branch_info.rs               # NEW: get current branch, commits ahead of base
  extensions/
    mod.rs                       # MODIFIED: add install module
    manifest.rs                  # UNCHANGED
    discovery.rs                 # UNCHANGED
    install.rs                   # NEW: clone from URL, validate manifest, install to extensions dir
  lib.rs                         # MODIFIED: register new commands

src/
  extensions/
    ExtensionAPI.ts              # UNCHANGED (no new primitives for Phase 36)
    ExtensionHost.ts             # MODIFIED: add install, uninstall, enable, disable, persist state
    extensionTypes.ts            # MODIFIED: add InstalledExtensionInfo with source, enabledState
    extensionManifest.ts         # UNCHANGED
    github/
      index.ts                   # MODIFIED: register new blades, commands for write ops + extension manager
      githubStore.ts             # UNCHANGED (auth state)
      hooks/
        useGitHubQuery.ts        # UNCHANGED (read hooks)
        useGitHubMutations.ts    # NEW: useMergePullRequest, useCreatePullRequest mutations
      blades/
        PullRequestDetailBlade.tsx  # MODIFIED: add merge action section
        MergePullRequestDialog.tsx  # NEW: strategy selector + confirmation dialog
        CreatePullRequestBlade.tsx  # NEW: PR creation form blade
      components/
        MergeStrategyPicker.tsx  # NEW: merge/squash/rebase radio group
        ConfirmDialog.tsx        # NEW: reusable confirmation dialog
    manager/                     # NEW: extension manager as separate built-in extension or
      ExtensionManagerBlade.tsx  # integrated into github extension, or standalone blade
      ExtensionCard.tsx          # Extension list item with toggle/uninstall
      InstallExtensionDialog.tsx # URL input + manifest review + permission display
      PermissionsBadge.tsx       # Visual permission indicator
```

### Pattern 1: Write Command Architecture (Rust)

**What:** Extend `client.rs` with `github_post` and `github_put` helpers that mirror the existing `github_get` pattern, then build write commands as thin Tauri command wrappers.

**When to use:** For all GitHub API write operations (merge, create PR, and future: create issue, create review, create release).

**Architecture:**
```
+------------------+     +-------------------+     +------------------+
| github_merge_pr  | --> | client::github_put| --> | GitHub REST API  |
| (Tauri command)  |     | (shared helper)   |     | PUT /pulls/merge |
+------------------+     +-------------------+     +------------------+
        |                        |
        |  Uses same:            |
        |  - token::get_token()  |
        |  - check_response_status()
        |  - GitHubError enum    |
        v                        v
+------------------+     +-------------------+
| github_create_pr | --> | client::github_post|
| (Tauri command)  |     | (shared helper)   |
+------------------+     +-------------------+
```

**Key design principle:** The `github_post` and `github_put` helpers accept a `serde_json::Value` body and return `Result<reqwest::Response, GitHubError>`, just like `github_get` returns a Response. Each Tauri command handles its own request/response serialization, keeping the client generic.

```rust
// client.rs additions -- HIGH confidence, follows existing patterns exactly

/// Make an authenticated POST request to the GitHub REST API.
pub async fn github_post(
    path: &str,
    body: &serde_json::Value,
) -> Result<reqwest::Response, GitHubError> {
    let access_token = token::get_token().await?;
    let client = reqwest::Client::new();

    let url = format!("https://api.github.com{}", path);
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "FlowForge-Desktop")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .timeout(Duration::from_secs(30))  // Longer timeout for writes
        .json(body)
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    check_response_status(resp).await
}

/// Make an authenticated PUT request to the GitHub REST API.
pub async fn github_put(
    path: &str,
    body: &serde_json::Value,
) -> Result<reqwest::Response, GitHubError> {
    let access_token = token::get_token().await?;
    let client = reqwest::Client::new();

    let url = format!("https://api.github.com{}", path);
    let resp = client
        .put(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "FlowForge-Desktop")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .timeout(Duration::from_secs(30))
        .json(body)
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    check_response_status(resp).await
}
```

### Pattern 2: Merge Pull Request Command

**What:** A Tauri command that calls GitHub's `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge` endpoint with a strategy selector.

**GitHub API details (HIGH confidence -- from official docs):**
- Endpoint: `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge`
- Parameters: `merge_method` (string: "merge" | "squash" | "rebase"), `commit_title` (optional), `commit_message` (optional), `sha` (optional, validates HEAD before merge)
- Success: HTTP 200 with `{ sha, merged, message }`
- Error 405: PR not mergeable (merge conflict, CI blocking)
- Error 409: SHA mismatch (head has changed since page loaded)
- Error 422: Validation failure

```rust
// pulls.rs addition

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MergeRequest {
    pub merge_method: String, // "merge" | "squash" | "rebase"
    pub commit_title: Option<String>,
    pub commit_message: Option<String>,
    pub sha: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MergeResult {
    pub sha: String,
    pub merged: bool,
    pub message: String,
}

#[tauri::command]
#[specta::specta]
pub async fn github_merge_pull_request(
    owner: String,
    repo: String,
    pull_number: u32,
    request: MergeRequest,
) -> Result<MergeResult, GitHubError> {
    let path = format!("/repos/{}/{}/pulls/{}/merge", owner, repo, pull_number);
    let mut body = serde_json::json!({
        "merge_method": request.merge_method,
    });

    if let Some(title) = &request.commit_title {
        body["commit_title"] = serde_json::Value::String(title.clone());
    }
    if let Some(msg) = &request.commit_message {
        body["commit_message"] = serde_json::Value::String(msg.clone());
    }
    if let Some(sha) = &request.sha {
        body["sha"] = serde_json::Value::String(sha.clone());
    }

    let resp = client::github_put(&path, &body).await?;
    let result: MergeResult = resp.json().await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse merge result: {}", e)))?;

    Ok(result)
}
```

### Pattern 3: Create Pull Request Command

**What:** A Tauri command that calls GitHub's `POST /repos/{owner}/{repo}/pulls` endpoint with pre-filled data from the current branch.

**GitHub API details (HIGH confidence -- from official docs):**
- Endpoint: `POST /repos/{owner}/{repo}/pulls`
- Required: `title` (string), `head` (string, branch name), `base` (string, target branch)
- Optional: `body` (string), `draft` (boolean)
- Success: HTTP 201 with full PR object
- Error 422: Validation failed (e.g., no commits between head and base)

```rust
// pulls.rs addition

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CreatePullRequestRequest {
    pub title: String,
    pub head: String,
    pub base: String,
    pub body: Option<String>,
    pub draft: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CreatePullRequestResponse {
    pub number: u32,
    pub html_url: String,
    pub title: String,
    pub state: String,
}

#[tauri::command]
#[specta::specta]
pub async fn github_create_pull_request(
    owner: String,
    repo: String,
    request: CreatePullRequestRequest,
) -> Result<CreatePullRequestResponse, GitHubError> {
    let path = format!("/repos/{}/{}/pulls", owner, repo);
    let mut body = serde_json::json!({
        "title": request.title,
        "head": request.head,
        "base": request.base,
    });

    if let Some(pr_body) = &request.body {
        body["body"] = serde_json::Value::String(pr_body.clone());
    }
    if let Some(draft) = request.draft {
        body["draft"] = serde_json::Value::Bool(draft);
    }

    let resp = client::github_post(&path, &body).await?;
    let pr: CreatePullRequestResponse = resp.json().await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse create PR result: {}", e)))?;

    Ok(pr)
}
```

### Pattern 4: Branch Info for PR Pre-Fill

**What:** A Tauri command to get current branch name and commits ahead of a base branch, providing data for the "Create PR" form.

**When to use:** When the user opens the "Create PR" blade, to pre-fill title from branch name and body from commit messages.

```rust
// branch_info.rs -- NEW file in github/ module

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfoForPr {
    pub current_branch: String,
    pub default_base: String,  // e.g., "main" or "master"
    pub suggested_title: String,
    pub commit_messages: Vec<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn github_get_branch_info_for_pr(
    state: State<'_, RepositoryState>,
) -> Result<BranchInfoForPr, GitHubError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitHubError::Internal("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)
            .map_err(|e| GitHubError::Internal(format!("Failed to open repo: {}", e)))?;

        // Get current branch name
        let head = repo.head()
            .map_err(|e| GitHubError::Internal(format!("Failed to get HEAD: {}", e)))?;
        let current_branch = head.shorthand().unwrap_or("HEAD").to_string();

        // Suggest title from branch name (feature/add-login -> Add login)
        let suggested_title = branch_name_to_title(&current_branch);

        // Detect default base branch
        let default_base = detect_default_branch(&repo);

        // Get commit messages between base and HEAD (for PR body)
        let commit_messages = get_commits_ahead(&repo, &default_base);

        Ok(BranchInfoForPr {
            current_branch,
            default_base,
            suggested_title,
            commit_messages,
        })
    })
    .await
    .map_err(|e| GitHubError::Internal(format!("Task join error: {}", e)))?
}
```

### Pattern 5: Frontend Mutation Hooks

**What:** TanStack Query `useMutation` hooks that call Tauri write commands and invalidate read caches on success.

**When to use:** For all write operations that modify server state.

**Confidence:** HIGH -- verified against TanStack Query v5 docs via Context7.

```typescript
// useGitHubMutations.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "../../../bindings";
import { toast } from "../../../stores/toast";

export function useMergePullRequest(owner: string, repo: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      pullNumber: number;
      mergeMethod: "merge" | "squash" | "rebase";
      commitTitle?: string;
      commitMessage?: string;
      sha?: string;
    }) => {
      const result = await commands.githubMergePullRequest(
        owner,
        repo,
        params.pullNumber,
        {
          mergeMethod: params.mergeMethod,
          commitTitle: params.commitTitle ?? null,
          commitMessage: params.commitMessage ?? null,
          sha: params.sha ?? null,
        },
      );
      if (result.status === "error") {
        throw new Error(extractErrorMessage(result.error));
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate PR list (merged status changed)
      queryClient.invalidateQueries({
        queryKey: ["ext:github", "pullRequests", owner, repo],
      });
      // Invalidate the specific PR detail
      queryClient.invalidateQueries({
        queryKey: ["ext:github", "pullRequest", owner, repo, variables.pullNumber],
      });
      toast.success(`Pull request #${variables.pullNumber} merged successfully`);
    },
    onError: (error) => {
      toast.error(`Merge failed: ${error.message}`);
    },
  });
}

export function useCreatePullRequest(owner: string, repo: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title: string;
      head: string;
      base: string;
      body?: string;
      draft?: boolean;
    }) => {
      const result = await commands.githubCreatePullRequest(
        owner,
        repo,
        {
          title: params.title,
          head: params.head,
          base: params.base,
          body: params.body ?? null,
          draft: params.draft ?? null,
        },
      );
      if (result.status === "error") {
        throw new Error(extractErrorMessage(result.error));
      }
      return result.data;
    },
    onSuccess: (_data) => {
      // Invalidate PR list (new PR added)
      queryClient.invalidateQueries({
        queryKey: ["ext:github", "pullRequests", owner, repo],
      });
      toast.success("Pull request created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create pull request: ${error.message}`);
    },
  });
}
```

### Pattern 6: Extension Manager Architecture

**What:** Extend `ExtensionHost` with install/uninstall/enable/disable operations and persist extension state.

**Data flow:**

```
User enters GitHub URL
        |
        v
+---------------------+
| InstallExtensionDialog|  (1) User pastes URL
|  - URL input         |
|  - "Fetch" button    |
+---------------------+
        |
        v
+---------------------+
| Rust: clone_extension|  (2) Shallow clone repo to temp dir
|  - git2 clone       |
|  - parse manifest   |
|  - validate schema  |
+---------------------+
        |
        v
+---------------------+
| ManifestReviewStep  |   (3) Show manifest, permissions, contributions
|  - permissions list  |
|  - contributes list  |
|  - "Install" button  |
+---------------------+
        |
        v
+---------------------+
| Rust: install_ext   |   (4) Copy from temp to .flowforge/extensions/{id}/
|  - copy directory    |
|  - validate files    |
+---------------------+
        |
        v
+---------------------+
| ExtensionHost       |   (5) Re-discover + activate
|  - discoverExtensions|
|  - activateExtension |
+---------------------+
```

**Extension state persistence:**

```typescript
// Persisted in tauri-plugin-store (flowforge-settings.json)
interface ExtensionPreferences {
  // Map of extension ID -> enabled state
  // Only stores explicit overrides; default is "enabled"
  disabledExtensions: string[];
  // Extension sources for tracking where extensions came from
  extensionSources: Record<string, {
    source: "built-in" | "local" | "github";
    url?: string;       // GitHub URL for github-sourced
    installedAt: string; // ISO timestamp
  }>;
}
```

### Pattern 7: Extension Install via Rust Command

**What:** A Tauri command that clones a GitHub repo, validates the manifest, and copies it to the extensions directory.

**When to use:** When the user installs an extension from a GitHub URL.

**Why Rust:** CSP blocks all outbound HTTP from the frontend. Git clone requires network access. The Rust side already has git2 for repository operations.

```rust
// extensions/install.rs -- NEW

use std::path::PathBuf;
use super::manifest::ExtensionManifest;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInstallPreview {
    pub manifest: ExtensionManifest,
    pub temp_path: String,
}

/// Fetch extension from GitHub URL: shallow clone + parse manifest.
/// Returns the manifest for review before actual install.
#[tauri::command]
#[specta::specta]
pub async fn extension_fetch_from_url(
    url: String,
    extensions_dir: String,
) -> Result<ExtensionInstallPreview, String> {
    // 1. Create temp directory
    // 2. Shallow clone (depth=1) using git2
    // 3. Look for flowforge.extension.json in repo root
    // 4. Parse and validate manifest
    // 5. Return manifest for UI review
    // (temp dir persists until install_extension or cancel)
    todo!("Implementation in plan")
}

/// Complete extension install: move from temp to extensions dir.
#[tauri::command]
#[specta::specta]
pub async fn extension_install(
    temp_path: String,
    extensions_dir: String,
) -> Result<ExtensionManifest, String> {
    // 1. Read manifest from temp_path
    // 2. Target = extensions_dir / manifest.id
    // 3. If target exists, error (already installed)
    // 4. Copy temp_path contents to target
    // 5. Clean up temp dir
    // 6. Return manifest
    todo!("Implementation in plan")
}

/// Cancel a pending install: clean up temp directory.
#[tauri::command]
#[specta::specta]
pub async fn extension_cancel_install(
    temp_path: String,
) -> Result<(), String> {
    // Remove temp directory
    todo!("Implementation in plan")
}

/// Uninstall an extension: remove its directory.
#[tauri::command]
#[specta::specta]
pub async fn extension_uninstall(
    extension_id: String,
    extensions_dir: String,
) -> Result<(), String> {
    // 1. Deactivate via frontend (ExtensionHost.deactivateExtension)
    // 2. Delete extensions_dir / extension_id
    // 3. Return success
    todo!("Implementation in plan")
}
```

### Pattern 8: Pessimistic UI for Write Operations

**What:** Use pessimistic (server-confirmed) updates for destructive GitHub write operations, NOT optimistic updates.

**When to use:** For merge and create PR operations.

**Why pessimistic over optimistic:**
1. Merge can fail for many reasons (conflicts, CI blocking, permission denied, SHA mismatch) -- rollback would give a jarring UX
2. Merge is irreversible -- showing "merged" then reverting is worse than showing a spinner
3. Create PR can fail due to validation (no commits between branches, duplicate PR)
4. The operation takes ~1-2 seconds -- fast enough that a spinner is acceptable

**Implementation pattern:**
```
User clicks "Merge" -> Confirmation Dialog -> Mutation starts (isPending=true)
                                               |
                                               +--> Show loading spinner on merge button
                                               +--> Disable form inputs
                                               |
                                               v
                                           onSuccess:
                                               +--> invalidateQueries (refreshes list + detail)
                                               +--> Toast success
                                               +--> Close dialog / navigate back
                                           onError:
                                               +--> Toast error with specific message
                                               +--> Re-enable form (user can retry)
```

### Pattern 9: Error Handling for Write Operations

**What:** Extend `GitHubError` enum with write-specific variants for precise frontend error handling.

**When to use:** For merge conflicts, permission errors, and validation failures.

```rust
// error.rs additions

#[derive(Debug, Error, Serialize, Deserialize, Type, Clone)]
#[serde(tag = "type", content = "message")]
pub enum GitHubError {
    // ... existing variants ...

    /// PR cannot be merged (conflicts, CI blocking, branch protections)
    #[error("Merge not allowed: {0}")]
    MergeNotAllowed(String),

    /// HEAD SHA has changed since the page was loaded
    #[error("Head has changed: {0}")]
    HeadChanged(String),

    /// Validation failed (missing fields, duplicate, etc.)
    #[error("Validation failed: {0}")]
    ValidationFailed(String),
}
```

Updated `check_response_status` or per-command response handling:
```rust
// In the merge command, check for specific status codes:
match status.as_u16() {
    405 => Err(GitHubError::MergeNotAllowed(body)),
    409 => Err(GitHubError::HeadChanged(body)),
    422 => Err(GitHubError::ValidationFailed(body)),
    // ... existing error handling
}
```

### Pattern 10: Extension Enable/Disable with Persistence

**What:** Extend ExtensionHost to support enable/disable with state persisted to tauri-plugin-store.

**When to use:** For the extension manager UI toggle.

**Data flow:**
```
ExtensionHost.ts (Zustand store)
        |
        | On extension toggle:
        v
+----------------------------+
| 1. Deactivate (if disabling)|  Calls ext.onDeactivate, api.cleanup()
| 2. Update in-memory state  |  Set status to "disabled" or "discovered"
| 3. Persist to store        |  getStore().set("disabledExtensions", [...])
+----------------------------+
        |
        | On app startup:
        v
+----------------------------+
| 1. Discover all extensions |  Scan filesystem
| 2. Read persisted state    |  getStore().get("disabledExtensions")
| 3. Activate enabled only   |  Skip IDs in disabledExtensions list
+----------------------------+
```

### Anti-Patterns to Avoid

- **Optimistic updates for merge operations:** Merge can fail in many ways. Showing "merged" then reverting is worse than showing a spinner for 1-2 seconds. Use pessimistic (server-confirmed) updates.

- **Making write API calls from frontend JavaScript:** CSP blocks `connect-src`. ALL GitHub API calls (read AND write) go through Rust Tauri commands. This is Phase 31's security hardening in action.

- **Putting PR form state in Zustand:** The "Create PR" form is local to one blade instance. Use React `useState` for the form fields, `useMutation` for submission. Zustand is for shared/persistent state only.

- **Installing extensions directly without manifest preview:** Always show the user what they are installing (name, version, permissions, contributions) BEFORE activating the extension code. This is the EXT-12 requirement.

- **Extending ExtensionAPI with write-specific methods prematurely:** Do not add `api.registerMergeStrategy()` or similar. Merge strategies are a fixed set from GitHub's API. If extensions need to contribute custom strategies in the future, add the API then.

- **Coupling extension manager to GitHub extension:** The extension manager is a core FlowForge feature, not a GitHub extension feature. It should work for ALL extensions regardless of source.

- **Using `git clone` from `std::process::Command`:** Use git2's clone API instead. It is already a dependency, avoids shell injection, and works cross-platform without assuming git is in PATH.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PR merge with strategy | Custom merge via git2 local operations | GitHub REST API `PUT /pulls/{n}/merge` | The API handles merge conflicts, branch protections, required reviews, and CI checks. Local merge would bypass all server-side protections. |
| Branch name to title conversion | Complex NLP parsing | Simple string replace: strip prefix (feature/, fix/, etc.), replace hyphens/underscores with spaces, title case | Branch naming conventions are well-established; complex parsing adds no value. |
| Mutation state management | Manual `isLoading`/`isError` in Zustand | TanStack Query `useMutation` | useMutation provides lifecycle callbacks, retry, cache invalidation, and component-level state without store pollution. |
| Extension installation | Custom HTTP download + manual zip extraction | git2 shallow clone (depth=1) | git clone handles auth, redirects, large repos, and creates a proper git directory for future `git pull` updates. |
| Permission checking for extensions | Custom permission system | Manifest-declared permissions displayed during install | For v1.5, permissions are informational (shown to user during install review). Runtime enforcement is an EXT-F02 concern (sandboxing). |

**Key insight:** GitHub's REST API does the heavy lifting for write operations. FlowForge's role is to provide a better UX (strategy selector, confirmation, pre-filled PR creation), not to reimplement GitHub's merge logic.

## Common Pitfalls

### Pitfall 1: Merge Fails Due to Stale PR Data
**What goes wrong:** User sees a PR is "open and ready to merge," clicks merge, but the PR was already merged or its HEAD changed since the page loaded.
**Why it happens:** TanStack Query's 1-2 minute staleTime means the detail data could be outdated.
**How to avoid:** Pass `sha` parameter in the merge request (GitHub validates HEAD hasn't changed). On `409 HeadChanged` error, automatically refetch the PR detail and show updated state. Consider reducing staleTime for detail views when merge UI is visible.
**Warning signs:** HTTP 409 errors in the console; user reports "merge failed but PR looks mergeable."

### Pitfall 2: Cache Inconsistency After Write Operations
**What goes wrong:** After merging a PR, the PR list still shows it as "open" until staleTime expires.
**Why it happens:** TanStack Query's stale-while-revalidate pattern means the old data shows until `invalidateQueries` triggers and the refetch completes.
**How to avoid:** In the mutation's `onSuccess`, invalidate BOTH the list and detail query keys. Also consider `setQueryData` to update the specific PR's status optimistically after the server confirms the merge succeeded (this is safe because the server already confirmed the operation).
**Warning signs:** UI showing stale state for a few seconds after mutation succeeds.

### Pitfall 3: Extension Clone Leaves Temp Directories on Failure
**What goes wrong:** If the manifest validation fails after cloning, or the user cancels, temp directories accumulate.
**Why it happens:** No cleanup of temp directories on error path.
**How to avoid:** Use `tempfile` crate's `TempDir` which auto-cleans on drop, OR implement explicit cleanup in error handlers AND the `extension_cancel_install` command. Track pending installs in Tauri managed state so they can be cleaned up on app shutdown.
**Warning signs:** Growing temp directory usage; stale clone directories in temp folder.

### Pitfall 4: Extension Install Overwriting Existing Extension
**What goes wrong:** User installs an extension with the same ID as one already installed, silently replacing the existing version.
**Why it happens:** No duplicate detection before copy.
**How to avoid:** Check if `extensions_dir/{manifest.id}` already exists before installing. If it does, prompt "Update existing extension?" or "Extension already installed." Never silently overwrite.
**Warning signs:** Extension behavior changes unexpectedly after install.

### Pitfall 5: Extension Enable/Disable State Lost on App Update
**What goes wrong:** User disables an extension, app updates, extensions are all re-enabled.
**Why it happens:** Extension state not persisted or persisted in a location that gets cleared on update.
**How to avoid:** Persist in tauri-plugin-store (`flowforge-settings.json`), which survives app updates. The store is in the app data directory, not the app installation directory.
**Warning signs:** Users reporting extensions re-enabling after updates.

### Pitfall 6: Create PR Fails Because Branch Not Pushed
**What goes wrong:** User tries to create a PR from a local branch that hasn't been pushed to the remote.
**Why it happens:** GitHub requires the `head` branch to exist on the remote.
**How to avoid:** Before showing the "Create PR" form, check if the current branch has a remote tracking branch. If not, prompt the user to push first (or auto-push with their consent). Show a clear error message if the push hasn't happened.
**Warning signs:** HTTP 422 errors when creating PR; user confusion about "branch not found."

### Pitfall 7: GitHub API Rate Limits After Rapid Write Operations
**What goes wrong:** Multiple rapid merge or create operations exhaust the rate limit.
**Why it happens:** Write operations trigger secondary rate limiting (separate from the primary rate limit).
**How to avoid:** After each write operation, check the `x-ratelimit-remaining` header. Update the GitHub store's rate limit info. The existing `checkRateLimitWarning()` will fire if approaching limits. Disable the merge/create buttons if rate limit is exhausted.
**Warning signs:** HTTP 403 errors with "secondary rate limit" message.

## Code Examples

### Merge Strategy Picker Component

```tsx
// MergeStrategyPicker.tsx
import { GitMerge, Layers, GitBranch } from "lucide-react";

type MergeMethod = "merge" | "squash" | "rebase";

interface MergeStrategyPickerProps {
  value: MergeMethod;
  onChange: (method: MergeMethod) => void;
  disabled?: boolean;
}

const STRATEGIES = [
  {
    value: "merge" as const,
    label: "Create a merge commit",
    description: "All commits will be added to the base branch via a merge commit.",
    icon: GitMerge,
  },
  {
    value: "squash" as const,
    label: "Squash and merge",
    description: "All commits will be combined into one commit on the base branch.",
    icon: Layers,
  },
  {
    value: "rebase" as const,
    label: "Rebase and merge",
    description: "All commits will be rebased and added to the base branch.",
    icon: GitBranch,
  },
];

export function MergeStrategyPicker({ value, onChange, disabled }: MergeStrategyPickerProps) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-xs font-medium text-ctp-subtext1 mb-2">Merge method</legend>
      {STRATEGIES.map((strategy) => (
        <label
          key={strategy.value}
          className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
            value === strategy.value
              ? "border-ctp-blue bg-ctp-blue/5"
              : "border-ctp-surface1 hover:border-ctp-surface2"
          }`}
        >
          <input
            type="radio"
            name="merge-method"
            value={strategy.value}
            checked={value === strategy.value}
            onChange={() => onChange(strategy.value)}
            className="sr-only"
          />
          <strategy.icon className={`w-4 h-4 mt-0.5 shrink-0 ${
            value === strategy.value ? "text-ctp-blue" : "text-ctp-overlay0"
          }`} />
          <div>
            <p className="text-sm text-ctp-text">{strategy.label}</p>
            <p className="text-xs text-ctp-overlay0 mt-0.5">{strategy.description}</p>
          </div>
        </label>
      ))}
    </fieldset>
  );
}
```

### Cache Invalidation After Merge

```typescript
// In useMergePullRequest hook -- verified against TanStack Query v5 docs

onSuccess: async (data, variables) => {
  const queryClient = useQueryClient();

  // 1. Optimistically update the detail (server confirmed merge)
  queryClient.setQueryData(
    ["ext:github", "pullRequest", owner, repo, variables.pullNumber],
    (old: PullRequestDetail | undefined) => old ? { ...old, merged: true, state: "closed" } : old,
  );

  // 2. Invalidate the list to trigger refetch
  await queryClient.invalidateQueries({
    queryKey: ["ext:github", "pullRequests", owner, repo],
  });

  // 3. Invalidate the detail to get full server state
  await queryClient.invalidateQueries({
    queryKey: ["ext:github", "pullRequest", owner, repo, variables.pullNumber],
  });
}
```

### Extension Manager Blade Layout

```tsx
// ExtensionManagerBlade.tsx -- layout pattern
// This would be registered as a blade type: "ext:github:extension-manager" or "extension-manager" (core)

function ExtensionManagerBlade() {
  const { extensions, isDiscovering } = useExtensionHost();
  const [installUrl, setInstallUrl] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);

  const extensionList = Array.from(extensions.values());
  const builtInExts = extensionList.filter((e) => e.builtIn);
  const installedExts = extensionList.filter((e) => !e.builtIn);

  return (
    <div className="h-full flex flex-col">
      {/* Install section */}
      <div className="px-4 py-3 border-b border-ctp-surface0">
        <div className="flex gap-2">
          <input
            type="text"
            value={installUrl}
            onChange={(e) => setInstallUrl(e.target.value)}
            placeholder="GitHub repository URL..."
            className="flex-1 text-xs bg-ctp-surface0 text-ctp-text border border-ctp-surface1 rounded px-2 py-1.5"
          />
          <button
            type="button"
            onClick={() => handleInstall(installUrl)}
            disabled={!installUrl || isInstalling}
            className="text-xs bg-ctp-blue text-ctp-base px-3 py-1.5 rounded disabled:opacity-50"
          >
            Install
          </button>
        </div>
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto">
        {installedExts.length > 0 && (
          <section className="px-4 py-3">
            <h3 className="text-xs font-medium text-ctp-subtext0 uppercase tracking-wide mb-2">
              Installed
            </h3>
            {installedExts.map((ext) => (
              <ExtensionCard key={ext.id} extension={ext} />
            ))}
          </section>
        )}
        <section className="px-4 py-3">
          <h3 className="text-xs font-medium text-ctp-subtext0 uppercase tracking-wide mb-2">
            Built-in
          </h3>
          {builtInExts.map((ext) => (
            <ExtensionCard key={ext.id} extension={ext} showToggleOnly />
          ))}
        </section>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual loading state in Zustand for mutations | TanStack Query `useMutation` | TanStack Query v4+ (2022) | Decoupled mutation state from stores; automatic lifecycle + cache invalidation |
| Optimistic updates for all mutations | Pessimistic for destructive, optimistic for additive | Community consensus 2023+ | Better UX for operations that fail often or are irreversible |
| npm-style package.json install for extensions | Manifest + filesystem copy | VS Code pattern (ongoing) | Simpler, no dependency resolution needed for v1.5 |
| iFrame-based extension sandboxing | Same-context with permission declaration | Pragmatic choice for first-party extensions | Full sandboxing deferred to EXT-F02; permissions are informational in v1.5 |

**Deprecated/outdated:**
- Storing extension state in localStorage: Use tauri-plugin-store for persistence (survives app updates, proper app data directory)
- Using `fetch()` for GitHub API calls from frontend: Blocked by CSP; all API calls through Rust

## Extensibility Analysis

### What Makes the Current Architecture Extensible

1. **Registry pattern (blade, command, toolbar):** All three registries accept dynamic string IDs. Adding a new blade type for "create-pull-request" is just `api.registerBlade({ type: "create-pr", ... })`. No code changes to registries needed.

2. **Shared HTTP client in Rust:** `client.rs` with `github_get`/`github_post`/`github_put` means adding a new API operation is one new Tauri command function. No client setup code duplicated.

3. **ExtensionHost as plugin manager:** The store already tracks lifecycle, supports built-in and discovered extensions. Adding install/uninstall/enable/disable are state transitions, not architectural changes.

4. **TanStack Query key namespacing:** All GitHub queries use `["ext:github", ...]` prefix. New queries (e.g., reviews, releases) naturally extend this namespace without collisions.

5. **Typed error enum:** Adding `MergeNotAllowed` or `ValidationFailed` to `GitHubError` is a variant addition. Frontend error handling uses `err.type` to discriminate, so new variants need only new `case` branches.

### What to Refactor for Extensibility

| Area | Current State | What to Change | Why |
|------|--------------|----------------|-----|
| `client.rs` | Only `github_get` and `github_get_with_params` | Add `github_post`, `github_put` (and optionally `github_delete` for future use) | Write operations require POST/PUT methods with the same auth/error handling |
| `GitHubError` | Covers read errors only | Add `MergeNotAllowed`, `HeadChanged`, `ValidationFailed` variants | Write operations have different failure modes that need distinct frontend handling |
| `ExtensionHost` | Lifecycle only (discover, activate, deactivate) | Add `installFromUrl`, `uninstall`, `enable`, `disable`, `persistState`, `loadPersistedState` | Extension manager requires full lifecycle management |
| `ExtensionInfo` | Status + manifest | Add `source: "built-in" | "local" | "github"`, `installedAt`, `isEnabled` | Extension manager needs to display provenance and control state |
| `pulls.rs` | Read-only (list + detail) | Add merge and create commands | Write operations are the core of GH-09 and GH-10 |

### Future Extensibility Points (NOT for Phase 36)

These are documented to show the architecture supports future needs without current implementation:

1. **Extension marketplace (EXT-F01):** The `source` field on `ExtensionInfo` already distinguishes built-in/local/github. A marketplace would add a `"marketplace"` source. The install flow (fetch manifest -> review -> install) is the same pattern.

2. **Extension auto-update (EXT-F04):** Since extensions are cloned from git repos, `git pull` can check for updates. The `extensionSources` record tracks the source URL for each installed extension.

3. **Extension dependency resolution (EXT-F03):** The manifest's `permissions` field could be extended with `extensionDependencies: string[]`. Resolution would be a topological sort of the dependency graph before activation.

4. **Pluggable merge strategies:** Currently, merge strategies are GitHub's fixed set (merge, squash, rebase). If extensions should contribute custom strategies (e.g., "squash with conventional commit message"), add `api.registerMergeStrategy()` to ExtensionAPI. Not needed for v1.5.

5. **PR template support:** Extensions could contribute PR templates via `api.registerPrTemplate({ name, body })`. The "Create PR" blade would offer a template picker. Not needed for v1.5 -- commit messages as body is sufficient.

## Open Questions

1. **Extension Manager: Separate Blade or Settings Tab?**
   - What we know: VS Code puts its extension manager in the sidebar (Activity Bar). FlowForge uses a blade-based navigation model.
   - What's unclear: Should the extension manager be a standalone blade (like "Settings") or a tab within Settings?
   - Recommendation: Standalone blade registered by ExtensionHost (not by any extension). It is core FlowForge functionality. Register it as blade type `"extension-manager"` in the core BladePropsMap, accessible from command palette and settings.

2. **Extension Manager: Should It Be a Built-in Extension?**
   - What we know: The extension manager manages ALL extensions. Making it an extension creates a chicken-and-egg problem (what manages the manager?).
   - What's unclear: Whether the manager blade should be registered through ExtensionAPI or directly in core bladeRegistry.
   - Recommendation: Register as a core blade (add to BladePropsMap). It is infrastructure, not an extension. The GitHub extension contributes GitHub-specific blades; the extension manager is system-level.

3. **git clone for Extension Install: git2 vs Shell**
   - What we know: git2 is already a dependency. Shell `git clone` is simpler but requires git in PATH.
   - What's unclear: git2's clone API complexity (callbacks, credentials) vs the simplicity of shell execution.
   - Recommendation: Use `git2::Repository::clone()` for simple HTTPS URLs (public repos). If authentication is needed for private repos, consider shelling out to `git` (which uses the user's credential helpers). For v1.5, only public GitHub repos are supported for extension install.

4. **Merge Button Placement: Detail Blade or Dialog?**
   - What we know: GH-09 requires a "confirmation dialog before merge."
   - What's unclear: Where the merge strategy selector lives -- in the PR detail blade directly, or in a dialog that opens from a "Merge" button in the detail blade.
   - Recommendation: Add a "Merge" button to the PR detail blade header. Clicking it opens a dialog with strategy selector + confirmation. This keeps the detail blade clean (read view) while the dialog handles the write interaction. The dialog pattern is consistent with destructive actions (like delete branch confirmation).

5. **Scope of "extension_uninstall" -- Who Deactivates?**
   - What we know: Uninstall requires deactivation first (cleanup registrations) then filesystem deletion.
   - What's unclear: Should the Rust uninstall command also handle deactivation, or should the frontend orchestrate both steps?
   - Recommendation: Frontend orchestrates: (1) call `ExtensionHost.deactivateExtension(id)` in JS, (2) call `commands.extensionUninstall(id, dir)` via IPC, (3) call `ExtensionHost.removeExtension(id)` to update the store. This keeps Rust unaware of JS extension lifecycle.

## Sources

### Primary (HIGH confidence)
- [GitHub REST API - Pull Requests](https://docs.github.com/en/rest/pulls/pulls) -- Merge endpoint (PUT), Create endpoint (POST), parameters, status codes
- TanStack Query v5 docs via Context7 (`/tanstack/query`) -- useMutation, invalidateQueries, optimistic updates, onSuccess/onError/onSettled lifecycle
- FlowForge codebase: `src-tauri/src/github/client.rs` -- Shared HTTP client pattern (github_get, github_get_with_params, check_response_status)
- FlowForge codebase: `src-tauri/src/github/error.rs` -- GitHubError enum with tagged serde variants
- FlowForge codebase: `src-tauri/src/github/types.rs` -- IPC type pattern (internal deserialize types + camelCase IPC types)
- FlowForge codebase: `src-tauri/src/github/pulls.rs` -- Read command pattern (list + detail)
- FlowForge codebase: `src/extensions/ExtensionHost.ts` -- Extension lifecycle store (discover, activate, deactivate, registerBuiltIn)
- FlowForge codebase: `src/extensions/ExtensionAPI.ts` -- Per-extension API facade with namespaced registration
- FlowForge codebase: `src/extensions/extensionTypes.ts` -- ExtensionInfo, ExtensionStatus, BuiltInExtensionConfig
- FlowForge codebase: `src/extensions/github/hooks/useGitHubQuery.ts` -- TanStack Query hook pattern (queryKey, error extraction, staleTime)
- FlowForge codebase: `src/extensions/github/index.ts` -- Extension entry point (onActivate/onDeactivate, lazy imports, store subscriptions)
- FlowForge codebase: `src/lib/queryClient.ts` -- Shared QueryClient instance
- FlowForge codebase: `src/lib/store.ts` -- tauri-plugin-store singleton pattern
- FlowForge codebase: `src/stores/domain/preferences/settings.slice.ts` -- Persistence pattern (getStore, set, save)
- FlowForge Phase 34 Research: `.planning/phases/34-github-authentication/34-RESEARCH-ARCHITECTURE.md` -- Hybrid extension pattern, built-in extension registration

### Secondary (MEDIUM confidence)
- [VS Code Extension Marketplace](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace) -- Install/uninstall/enable/disable UX patterns
- [GitHub REST API overview](https://docs.github.com/en/rest) -- API versioning, rate limits, secondary rate limiting
- git2-rs documentation -- Clone API, shallow clone options

### Tertiary (LOW confidence)
- Community patterns for extension manager UX in desktop apps -- needs validation against actual user testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies needed. All patterns extend existing codebase conventions exactly.
- Write operation architecture: HIGH -- GitHub REST API endpoints verified from official docs. Rust client extension is symmetric with existing GET helpers. TanStack Query mutation patterns verified via Context7.
- Extension manager architecture: HIGH -- ExtensionHost store already has the right shape. Adding install/uninstall/enable/disable is state transition work, not architectural change. Persistence via tauri-plugin-store is an established pattern.
- Error handling: HIGH -- GitHubError enum extension follows existing tagged-serde pattern. Write-specific error variants map directly to HTTP status codes from GitHub API docs.
- Extensibility analysis: MEDIUM -- The assessment of what future extensibility points are needed is a judgment call based on the requirements doc's "Future Requirements" section. The recommended architecture supports all listed future needs, but actual extension usage may surface different patterns.
- Pitfalls: HIGH -- Based on concrete API behavior (HTTP status codes), codebase patterns (staleTime, cache keys), and common failure modes of write operations.

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (GitHub REST API is stable; TanStack Query v5 is stable; extension system architecture is settled)
