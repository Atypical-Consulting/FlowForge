# Phase 36: GitHub Write Operations & Extension Manager - Implementation Research

**Researched:** 2026-02-10
**Domain:** Tauri v2 + Rust (reqwest) + React + TanStack Query + Tailwind v4/Catppuccin
**Confidence:** HIGH (patterns derived from existing codebase + official API docs)

## Summary

Phase 36 introduces **write operations** (merge PR, create PR) to the existing read-only GitHub integration, and adds an **extension manager** blade for installing/managing third-party extensions. The existing codebase provides extremely clear patterns to follow: the `client.rs` helper module, the `types.rs` internal-vs-IPC type separation, the `pulls.rs`/`issues.rs` command pattern, the `useGitHubQuery.ts` TanStack Query hooks, and the extension host system in `ExtensionHost.ts`.

The core technical challenge is extending `client.rs` with `github_post` and `github_put` helpers, adding new Tauri commands in a new `write_ops.rs` module, and building React forms that use `useMutation` for write operations with proper cache invalidation. For the extension manager, the existing `discover_extensions` Tauri command and `ExtensionHost` store already handle 80% of the lifecycle; we need install/uninstall commands and a management blade.

**Primary recommendation:** Follow the exact patterns established in Phase 35 for every new file. Add `github_post`/`github_put` to `client.rs`, create `write_ops.rs` for new commands, add `useMutation` hooks alongside existing `useQuery` hooks, and build new blades using the same component structure as `PullRequestDetailBlade`.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| reqwest | 0.13 | HTTP client for GitHub API POST/PUT | Already used for GET, has `json` feature enabled |
| serde / serde_json | 1.x | Serialize request bodies, deserialize responses | Already used throughout |
| git2 | 0.20 | Local git operations (branch info, commit log) | Already used for all local git operations |
| tauri-specta | 2.0.0-rc.21 | Auto-generate TypeScript bindings | Already generates `bindings.ts` |
| @tanstack/react-query | (project ver) | `useMutation` for write ops, cache invalidation | Already used for read queries |
| framer-motion | (project ver) | Dialog animations | Already used in `dialog.tsx` |
| class-variance-authority | (project ver) | Component variants | Already used in `button.tsx`, `dialog.tsx` |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tokio | 1.x | `spawn_blocking` for git2 ops | Commit message extraction |
| lucide-react | (project ver) | Icons for merge strategies, form elements | All new UI |
| react-virtuoso | (project ver) | Virtualized extension list | Extension manager if many extensions |

### No New Dependencies Needed
The project already has every dependency required. Notably:
- `reqwest` already has `json` and `form` features (supports `.json(&body)` on POST/PUT)
- `git2` already supports revwalk for commit extraction
- `keyring` already stores the OAuth token (all API calls go through `token::get_token()`)

## Architecture Patterns

### Recommended File Structure

```
src-tauri/src/github/
├── client.rs          # ADD: github_post(), github_put()
├── write_ops.rs       # NEW: merge_pr, create_pr commands
├── types.rs           # ADD: MergePrRequest, CreatePrRequest, MergePrResponse, CreatePrResponse
├── mod.rs             # ADD: pub mod write_ops; pub use write_ops::*;
└── (existing files unchanged)

src-tauri/src/extensions/
├── install.rs         # NEW: install_extension, uninstall_extension commands
├── state.rs           # NEW: extension enable/disable persistence (tauri-plugin-store)
├── mod.rs             # ADD: pub mod install; pub mod state;
└── (existing files unchanged)

src/extensions/github/
├── hooks/
│   ├── useGitHubQuery.ts     # EXISTING (read hooks)
│   └── useGitHubMutation.ts  # NEW: useMergePr, useCreatePr mutations
├── blades/
│   ├── PullRequestDetailBlade.tsx  # MODIFY: add merge section
│   ├── CreatePullRequestBlade.tsx  # NEW: PR creation form
│   └── ExtensionManagerBlade.tsx   # NEW: extension list + install
├── components/
│   ├── MergeSection.tsx       # NEW: strategy selector + confirm dialog
│   ├── MergeConfirmDialog.tsx # NEW: confirmation before merge
│   └── PermissionBadge.tsx    # NEW: permission display for extensions
└── index.ts                   # MODIFY: register new blades + commands
```

### Pattern 1: HTTP Client Extension for Write Operations

**What:** Extend `client.rs` with POST/PUT helpers that mirror the existing GET pattern.
**When to use:** For all GitHub API write operations.
**Why:** Maintains the single-point-of-authentication pattern, consistent error handling, consistent headers.

```rust
// Source: Derived from existing client.rs github_get() pattern

/// Make an authenticated POST request to the GitHub REST API with a JSON body.
pub async fn github_post<T: serde::Serialize>(
    path: &str,
    body: &T,
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
        .timeout(Duration::from_secs(30)) // longer for writes
        .json(body)
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    check_response_status(resp).await
}

/// Make an authenticated PUT request to the GitHub REST API with a JSON body.
pub async fn github_put<T: serde::Serialize>(
    path: &str,
    body: &T,
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

**Critical:** The `check_response_status` function is currently `async fn` (private). It needs to be made `pub(super)` or the new write functions should be in the same `client.rs` module. The existing function handles 401, 403, 404 and catch-all, which is sufficient for write ops (GitHub merge returns 405/409/422 which fall into the catch-all `ApiError`).

**Enhancement needed for `check_response_status`:** Add explicit handling for merge-specific errors:
```rust
405 => Err(GitHubError::MethodNotAllowed(body)),  // PR not mergeable
409 => Err(GitHubError::Conflict(body)),           // merge conflict
422 => Err(GitHubError::ValidationFailed(body)),   // validation error
```

### Pattern 2: Tauri Command for Write Operations (Two-Tier Types)

**What:** Separate internal deserialization types from IPC types, matching the existing types.rs pattern.
**When to use:** Every new Tauri command.

```rust
// Source: Derived from existing types.rs pattern

// --- Internal types (for serializing request body to GitHub) ---
// These use snake_case to match GitHub API field names.
// NOT exposed via IPC (no Type derive, no camelCase rename).

#[derive(Debug, Serialize)]
pub struct GitHubMergePrBody {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commit_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commit_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merge_method: Option<String>, // "merge", "squash", "rebase"
}

#[derive(Debug, Deserialize)]
pub struct GitHubMergeResponse {
    pub sha: Option<String>,
    pub merged: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct GitHubCreatePrBody {
    pub title: String,
    pub head: String,
    pub base: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub draft: Option<bool>,
}

// --- IPC types (sent to frontend, camelCase) ---

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MergePullRequestResult {
    pub merged: bool,
    pub sha: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CreatePullRequestResult {
    pub number: u32,
    pub html_url: String,
    pub title: String,
    pub state: String,
}
```

### Pattern 3: Write Command Implementation

**What:** Tauri commands for merge and create PR.
**When to use:** Each GitHub write operation.

```rust
// Source: Derived from existing pulls.rs command pattern

/// Merge a pull request with the specified strategy.
///
/// merge_method: "merge" | "squash" | "rebase"
/// sha: optional HEAD SHA for conflict detection
#[tauri::command]
#[specta::specta]
pub async fn github_merge_pull_request(
    owner: String,
    repo: String,
    pull_number: u32,
    merge_method: String,
    commit_title: Option<String>,
    commit_message: Option<String>,
    sha: Option<String>,
) -> Result<MergePullRequestResult, GitHubError> {
    let path = format!("/repos/{}/{}/pulls/{}/merge", owner, repo, pull_number);

    let body = GitHubMergePrBody {
        commit_title,
        commit_message,
        sha,
        merge_method: Some(merge_method),
    };

    let resp = client::github_put(&path, &body).await?;
    let raw: GitHubMergeResponse = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse merge response: {}", e)))?;

    Ok(MergePullRequestResult {
        merged: raw.merged,
        sha: raw.sha,
        message: raw.message,
    })
}

/// Create a new pull request.
#[tauri::command]
#[specta::specta]
pub async fn github_create_pull_request(
    owner: String,
    repo: String,
    title: String,
    head: String,
    base: String,
    body: Option<String>,
    draft: Option<bool>,
) -> Result<CreatePullRequestResult, GitHubError> {
    let api_path = format!("/repos/{}/{}/pulls", owner, repo);

    let request_body = GitHubCreatePrBody {
        title,
        head,
        base,
        body,
        draft,
    };

    let resp = client::github_post(&api_path, &request_body).await?;
    let raw: GitHubPullRequest = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse PR creation response: {}", e)))?;

    Ok(CreatePullRequestResult {
        number: raw.number,
        html_url: raw.html_url,
        title: raw.title,
        state: raw.state,
    })
}
```

### Pattern 4: Get Commit Messages for PR Body Auto-Fill

**What:** A Tauri command that gets commit messages between current branch and a base branch using `git2` locally.
**When to use:** When creating a PR, auto-fill the body with commit messages.

```rust
// Source: Derived from existing changelog.rs get_commits_in_range() pattern

/// Get commit messages between the current branch and a base reference.
/// Used to auto-fill PR body when creating a new pull request.
#[tauri::command]
#[specta::specta]
pub async fn github_get_branch_commits(
    base_ref: String,
    state: State<'_, RepositoryState>,
) -> Result<Vec<String>, GitHubError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitHubError::Internal("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)
            .map_err(|e| GitHubError::Internal(format!("Failed to open repo: {}", e)))?;

        let head_commit = repo.head()
            .map_err(|e| GitHubError::Internal(format!("No HEAD: {}", e)))?
            .peel_to_commit()
            .map_err(|e| GitHubError::Internal(format!("HEAD is not a commit: {}", e)))?;

        // Resolve base reference (e.g., "origin/main" or "main")
        let base_oid = repo.revparse_single(&base_ref)
            .map_err(|e| GitHubError::Internal(format!("Cannot resolve '{}': {}", base_ref, e)))?
            .id();

        let mut revwalk = repo.revwalk()
            .map_err(|e| GitHubError::Internal(format!("Revwalk error: {}", e)))?;
        revwalk.push(head_commit.id())
            .map_err(|e| GitHubError::Internal(format!("Push error: {}", e)))?;
        revwalk.set_sorting(git2::Sort::TIME)
            .map_err(|e| GitHubError::Internal(format!("Sort error: {}", e)))?;

        let mut messages = Vec::new();
        for oid_result in revwalk {
            let oid = oid_result
                .map_err(|e| GitHubError::Internal(format!("Walk error: {}", e)))?;

            if oid == base_oid { break; }

            let commit = repo.find_commit(oid)
                .map_err(|e| GitHubError::Internal(format!("Commit error: {}", e)))?;

            if let Some(msg) = commit.summary() {
                messages.push(msg.to_string());
            }
        }

        Ok(messages)
    })
    .await
    .map_err(|e| GitHubError::Internal(format!("Task join error: {}", e)))?
}
```

### Pattern 5: useMutation Hooks for Write Operations

**What:** TanStack Query mutations with proper cache invalidation.
**When to use:** Every write operation called from React.

```typescript
// Source: Derived from existing SyncButtons.tsx + useGitHubQuery.ts patterns

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "../../../bindings";
import { toast } from "../../../stores/toast";

function extractErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    if ("message" in error && typeof (error as Record<string, unknown>).message === "string") {
      return (error as Record<string, string>).message;
    }
    if ("type" in error && typeof (error as Record<string, unknown>).type === "string") {
      return (error as Record<string, string>).type;
    }
  }
  return "Unknown GitHub error";
}

/**
 * Merge a pull request with cache invalidation.
 * On success, invalidates both the PR detail and PR list queries.
 */
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
        params.mergeMethod,
        params.commitTitle ?? null,
        params.commitMessage ?? null,
        params.sha ?? null,
      );
      if (result.status === "error") {
        throw new Error(extractErrorMessage(result.error));
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      toast.success(`PR #${variables.pullNumber} merged successfully`);
      // Invalidate PR detail and list queries to refresh
      queryClient.invalidateQueries({
        queryKey: ["ext:github", "pullRequest", owner, repo, variables.pullNumber],
      });
      queryClient.invalidateQueries({
        queryKey: ["ext:github", "pullRequests", owner, repo],
      });
    },
    onError: (error) => {
      toast.error(`Merge failed: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

/**
 * Create a new pull request.
 * On success, invalidates the PR list query and returns the new PR URL.
 */
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
        params.title,
        params.head,
        params.base,
        params.body ?? null,
        params.draft ?? null,
      );
      if (result.status === "error") {
        throw new Error(extractErrorMessage(result.error));
      }
      return result.data;
    },
    onSuccess: (data) => {
      toast.success(`PR #${data.number} created`, {
        label: "Open on GitHub",
        onClick: () => window.open(data.htmlUrl, "_blank"),
      });
      queryClient.invalidateQueries({
        queryKey: ["ext:github", "pullRequests", owner, repo],
      });
    },
    onError: (error) => {
      toast.error(`PR creation failed: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}
```

### Pattern 6: Confirmation Dialog for Merge

**What:** Use the existing Dialog component system for merge confirmation.
**When to use:** Before executing destructive merge action.

```tsx
// Source: Derived from existing dialog.tsx + MergeDialog.tsx patterns

import { AlertTriangle, GitMerge, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";

interface MergeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prNumber: number;
  prTitle: string;
  headRef: string;
  baseRef: string;
  mergeMethod: "merge" | "squash" | "rebase";
  onConfirm: () => void;
  isPending: boolean;
}

export function MergeConfirmDialog({
  open, onOpenChange, prNumber, prTitle,
  headRef, baseRef, mergeMethod, onConfirm, isPending,
}: MergeConfirmDialogProps) {
  const methodLabel = {
    merge: "merge commit",
    squash: "squash and merge",
    rebase: "rebase and merge",
  }[mergeMethod];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-ctp-mauve" />
            Merge Pull Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-ctp-subtext1">
            Merge <strong>#{prNumber}</strong> using <strong>{methodLabel}</strong>?
          </p>
          <div className="text-xs text-ctp-overlay0">
            <span className="font-mono bg-ctp-surface0 px-1.5 py-0.5 rounded">{headRef}</span>
            <span className="mx-1.5">&rarr;</span>
            <span className="font-mono bg-ctp-surface0 px-1.5 py-0.5 rounded">{baseRef}</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-ctp-yellow bg-ctp-yellow/10 p-2 rounded">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>This action cannot be undone. The branch will be merged into {baseRef}.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={isPending} loadingText="Merging...">
            <GitMerge className="w-4 h-4 mr-1.5" />
            Confirm Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 7: Extension Install/Uninstall Tauri Commands

**What:** Rust commands for cloning extension repos and managing the extensions directory.
**When to use:** Extension manager blade install/uninstall actions.

```rust
// Source: Derived from discovery.rs + clone.rs patterns

use std::path::PathBuf;
use super::manifest::ExtensionManifest;

/// Install an extension from a Git repository URL.
///
/// Clones the repository into .flowforge/extensions/{extension-id}/,
/// validates the manifest, and returns the parsed manifest.
/// Uses git2 shallow clone (depth=1) for minimal download.
#[tauri::command]
#[specta::specta]
pub async fn install_extension(
    extensions_dir: String,
    git_url: String,
) -> Result<ExtensionManifest, String> {
    let dir = PathBuf::from(&extensions_dir);

    // Create extensions dir if it doesn't exist
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create extensions directory: {}", e))?;

    // Clone into a temp directory first, validate, then move
    let temp_dir = dir.join(".installing");
    if temp_dir.exists() {
        tokio::fs::remove_dir_all(&temp_dir)
            .await
            .map_err(|e| format!("Failed to clean temp dir: {}", e))?;
    }

    // Use git2 for cloning (already in dependencies)
    let url = git_url.clone();
    let temp = temp_dir.clone();
    tokio::task::spawn_blocking(move || {
        let mut fetch_opts = git2::FetchOptions::new();
        fetch_opts.depth(1); // shallow clone

        let mut builder = git2::build::RepoBuilder::new();
        builder.fetch_options(fetch_opts);

        builder.clone(&url, &temp)
            .map_err(|e| format!("Clone failed: {}", e))?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))??;

    // Read and validate manifest
    let manifest_path = temp_dir.join("flowforge.extension.json");
    if !manifest_path.exists() {
        // Cleanup and fail
        let _ = tokio::fs::remove_dir_all(&temp_dir).await;
        return Err("No flowforge.extension.json found in repository".to_string());
    }

    let content = tokio::fs::read_to_string(&manifest_path)
        .await
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    let manifest: ExtensionManifest = serde_json::from_str(&content)
        .map_err(|e| {
            // Cleanup on validation failure
            let temp = temp_dir.clone();
            tokio::spawn(async move { let _ = tokio::fs::remove_dir_all(&temp).await; });
            format!("Invalid manifest: {}", e)
        })?;

    // Move to final location
    let final_dir = dir.join(&manifest.id);
    if final_dir.exists() {
        tokio::fs::remove_dir_all(&final_dir)
            .await
            .map_err(|e| format!("Failed to remove existing extension: {}", e))?;
    }
    tokio::fs::rename(&temp_dir, &final_dir)
        .await
        .map_err(|e| format!("Failed to install extension: {}", e))?;

    let mut installed = manifest;
    installed.base_path = Some(final_dir.to_string_lossy().into_owned());

    Ok(installed)
}

/// Uninstall an extension by removing its directory.
#[tauri::command]
#[specta::specta]
pub async fn uninstall_extension(
    extensions_dir: String,
    extension_id: String,
) -> Result<(), String> {
    let ext_path = PathBuf::from(&extensions_dir).join(&extension_id);

    if !ext_path.exists() {
        return Err(format!("Extension '{}' not found", extension_id));
    }

    tokio::fs::remove_dir_all(&ext_path)
        .await
        .map_err(|e| format!("Failed to remove extension: {}", e))?;

    Ok(())
}
```

### Pattern 8: Extension Manager Blade Component

**What:** A blade listing all installed extensions with enable/disable toggles.
**When to use:** Extension management UI.

```tsx
// Source: Derived from PullRequestListBlade + extensionTypes.ts patterns

import { useExtensionHost } from "../../ExtensionHost";
import type { ExtensionInfo } from "../../extensionTypes";

export function ExtensionManagerBlade() {
  const extensions = useExtensionHost((s) => s.extensions);

  // Convert Map to sorted array
  const extensionList = Array.from(extensions.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Install section */}
      <div className="px-4 py-3 border-b border-ctp-surface0">
        <InstallExtensionForm />
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto">
        {extensionList.map((ext) => (
          <ExtensionCard key={ext.id} extension={ext} />
        ))}
      </div>
    </div>
  );
}

function ExtensionCard({ extension }: { extension: ExtensionInfo }) {
  const { activateExtension, deactivateExtension } = useExtensionHost();
  const isActive = extension.status === "active";
  const isBuiltIn = extension.builtIn === true;

  const handleToggle = () => {
    if (isActive) {
      deactivateExtension(extension.id);
    } else if (extension.status === "discovered" || extension.status === "deactivated") {
      activateExtension(extension.id);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-ctp-surface0 hover:bg-ctp-surface0/30">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ctp-text">{extension.name}</span>
            <span className="text-xs text-ctp-overlay0">v{extension.version}</span>
            {isBuiltIn && (
              <span className="text-xs bg-ctp-surface1 text-ctp-subtext0 px-1.5 py-0.5 rounded">
                Built-in
              </span>
            )}
          </div>
          {extension.manifest.description && (
            <p className="text-xs text-ctp-overlay0 mt-0.5 truncate">
              {extension.manifest.description}
            </p>
          )}
          {/* Permission badges */}
          {extension.manifest.permissions && extension.manifest.permissions.length > 0 && (
            <div className="flex gap-1 mt-1">
              {extension.manifest.permissions.map((perm) => (
                <PermissionBadge key={perm} permission={perm} />
              ))}
            </div>
          )}
          {extension.error && (
            <p className="text-xs text-ctp-red mt-0.5">{extension.error}</p>
          )}
        </div>
        {/* Toggle switch */}
        <ToggleSwitch
          checked={isActive}
          onChange={handleToggle}
          disabled={isBuiltIn || extension.status === "error" || extension.status === "activating"}
          aria-label={`${isActive ? "Disable" : "Enable"} ${extension.name}`}
        />
      </div>
    </div>
  );
}
```

### Pattern 9: Toggle Switch Component (Tailwind v4)

**What:** A custom toggle switch styled with Catppuccin tokens.
**When to use:** Extension enable/disable, PR draft toggle.

```tsx
// Source: Custom component using Catppuccin theme tokens from index.css

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

export function ToggleSwitch({ checked, onChange, disabled, ...rest }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ctp-overlay0",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        checked ? "bg-ctp-green" : "bg-ctp-surface2",
      )}
      {...rest}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-ctp-text shadow-sm",
          "transition-transform duration-150",
          checked ? "translate-x-4" : "translate-x-0.5",
          "mt-0.5",
        )}
      />
    </button>
  );
}
```

### Pattern 10: Permission Badge Component

**What:** Colored badges for extension permissions.
**When to use:** Extension install review, extension manager cards.

```tsx
// Source: Derived from LabelPill component pattern

const PERMISSION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  network: { bg: "bg-ctp-blue/15", text: "text-ctp-blue", icon: "Globe" },
  filesystem: { bg: "bg-ctp-yellow/15", text: "text-ctp-yellow", icon: "HardDrive" },
  "git-operations": { bg: "bg-ctp-green/15", text: "text-ctp-green", icon: "GitBranch" },
};

export function PermissionBadge({ permission }: { permission: string }) {
  const style = PERMISSION_STYLES[permission] ?? {
    bg: "bg-ctp-surface1",
    text: "text-ctp-subtext0",
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
      style.bg, style.text,
    )}>
      {permission}
    </span>
  );
}
```

### Anti-Patterns to Avoid
- **DO NOT create a new reqwest::Client per request in write commands.** While the current `github_get` creates a new client per call (fine for simple GETs), write operations should follow the same pattern for consistency. If optimization is needed later, a shared client can be introduced.
- **DO NOT use `serde_json::Value` for request bodies.** Always use strongly-typed structs for serialization. The project already follows this pattern.
- **DO NOT call `commands.*` directly in React component event handlers.** Always go through `useMutation` hooks so TanStack Query manages loading states, error handling, and cache invalidation.
- **DO NOT skip the confirmation dialog for merge.** This is a destructive operation that cannot be undone.
- **DO NOT use the `git2` crate across threads.** Always open a fresh `Repository` handle inside `spawn_blocking`, matching the existing pattern in `repository.rs`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog animations | Custom animation code | Existing `Dialog` from `components/ui/dialog.tsx` | Already handles AnimatePresence, backdrop, Escape key, focus trap |
| Loading button states | Manual isPending tracking | `Button` with `loading`/`loadingText` props | Already exists in `components/ui/button.tsx` |
| Error toast notifications | Custom error display | `toast.error()` from `stores/toast.ts` | Project-wide notification system already handles all toast types |
| Form validation UI | Custom validation framework | React controlled components + inline validation | Matches CloneForm pattern, no need for formik/react-hook-form for 2-3 field forms |
| Cache invalidation | Manual refetch triggers | TanStack Query `invalidateQueries` | Handles stale data, background refetch, and component re-render |
| HTTP client auth | Manual token management | `client::github_post`/`github_put` | Token stays in Rust/keychain, consistent headers and error handling |

**Key insight:** The project already has all the UI primitives needed (Dialog, Button, toast). The implementation challenge is wiring them together correctly, not building new foundational components.

## Common Pitfalls

### Pitfall 1: Missing Error Variants for Write-Specific HTTP Status Codes
**What goes wrong:** GitHub returns 405 (not mergeable), 409 (conflict), 422 (validation failed) for merge operations. The current `check_response_status` maps these to generic `ApiError`, losing the semantic meaning.
**Why it happens:** The read-only API in Phase 35 never encounters these codes, so they weren't needed.
**How to avoid:** Add `MethodNotAllowed`, `Conflict`, and `ValidationFailed` variants to `GitHubError` enum. The frontend can then show specific error messages ("PR has merge conflicts" vs "PR failed branch protection checks").
**Warning signs:** All merge failures show the same generic error message.

### Pitfall 2: specta BigInt Panic for u64 Fields
**What goes wrong:** `specta` panics with `BigIntForbidden` when a struct derives `Type` and contains `u64` fields. This was already encountered and fixed in Phase 35 for `CommentInfo.id`.
**Why it happens:** JavaScript's `Number` cannot safely represent u64. specta enforces this.
**How to avoid:** Use `String` for IDs in IPC types. The GitHub API returns numeric IDs as JSON numbers, so deserialize as `u64` internally, then convert to `String` for the IPC type. Follow the existing `CommentInfo.id` pattern.
**Warning signs:** Rust compilation panics with `BigIntForbidden` in specta derive macro.

### Pitfall 3: Stale PR Detail After Merge
**What goes wrong:** After merging a PR, the user sees the old "Open" state because the detail query cache is stale.
**Why it happens:** `useMutation` doesn't automatically refetch related queries.
**How to avoid:** In the merge mutation's `onSuccess`, explicitly invalidate both `["ext:github", "pullRequest", owner, repo, number]` and `["ext:github", "pullRequests", owner, repo]` queries.
**Warning signs:** User merges PR but detail blade still shows "Open" status.

### Pitfall 4: Branch Name Mismatch Between Local and Remote for PR Creation
**What goes wrong:** The user's local branch is `feature/foo` but GitHub needs the `head` parameter as just `feature/foo` (for same-repo PRs) or `username:feature/foo` (for fork PRs).
**Why it happens:** `git2::Repository::head()` returns the local ref name, not the remote-qualified name.
**How to avoid:** For same-repo PRs (detected remote matches the repo), just use the branch name. For fork PRs, prefix with the fork owner. The `RepoStatus.branchName` already extracts the short name via `head.shorthand()`.
**Warning signs:** "Validation Failed: head does not exist" error from GitHub API.

### Pitfall 5: Extension Install Without Manifest Validation = Silent Failures
**What goes wrong:** User installs an extension from a URL that doesn't contain a valid manifest, leading to confusing errors later during discovery/activation.
**Why it happens:** Not validating the manifest immediately after cloning.
**How to avoid:** After git clone, immediately check for `flowforge.extension.json`, parse it, validate `apiVersion`, and only then move to the final directory. If validation fails, remove the cloned directory and return a clear error.
**Warning signs:** Extension appears as "error" status with cryptic message in the extension list.

### Pitfall 6: lib.rs Command Registration Forgotten
**What goes wrong:** New Tauri command is written but bindings are not generated because it's not added to `collect_commands![]` in `lib.rs`.
**Why it happens:** Manual registration in two places (mod.rs re-export + lib.rs collect_commands).
**How to avoid:** After adding any new command, immediately: (1) add `pub use` in `mod.rs`, (2) add to `use` block in `lib.rs`, (3) add to `collect_commands![]`, (4) rebuild to regenerate bindings.ts.
**Warning signs:** `commands.githubMergePullRequest` doesn't exist in TypeScript.

### Pitfall 7: git2 FetchOptions::depth() May Not Be Available
**What goes wrong:** `git2` 0.20 might not support shallow clone via `FetchOptions::depth()`.
**Why it happens:** Shallow clone support in libgit2 (which git2 wraps) has been inconsistent. The method exists but may fail depending on the remote.
**How to avoid:** Use a regular full clone as fallback. Shallow clone is a nice-to-have optimization, not a requirement. Wrap the `depth(1)` in a try, and fall back to default fetch options.
**Warning signs:** Clone fails with "unsupported" error for some repositories.

## Code Examples

### Registering New Commands in lib.rs

```rust
// In lib.rs, add to the use block:
use github::{
    // ... existing imports ...
    github_merge_pull_request, github_create_pull_request,
    github_get_branch_commits,
};
use extensions::install::{install_extension, uninstall_extension};

// In collect_commands![]:
// GitHub write commands
github_merge_pull_request,
github_create_pull_request,
github_get_branch_commits,
// Extension install commands
install_extension,
uninstall_extension,
```

### Registering New Blades in GitHub Extension Entry Point

```typescript
// In src/extensions/github/index.ts, add to ensureComponents():
let CreatePullRequestBlade: React.ComponentType<any> | null = null;
// ...
if (!CreatePullRequestBlade) {
  const mod = await import("./blades/CreatePullRequestBlade");
  CreatePullRequestBlade = mod.CreatePullRequestBlade;
}

// In onActivate(), add blade registration:
api.registerBlade({
  type: "create-pr",
  title: "Create Pull Request",
  component: CreatePullRequestBlade!,
  singleton: true,
  wrapInPanel: true,
  showBack: true,
});

// Add command:
api.registerCommand({
  id: "create-pull-request",
  title: "Create Pull Request",
  category: "GitHub",
  icon: GitPullRequestCreate, // from lucide-react
  action: () => {
    const remote = getSelectedRemote();
    if (remote) openBlade("ext:github:create-pr", {
      owner: remote.owner,
      repo: remote.repo,
    });
  },
  enabled: () => {
    const gh = useGitHubStore.getState();
    return gh.isAuthenticated && gh.detectedRemotes.length > 0;
  },
});
```

### Merge Strategy Selector Component

```tsx
// Source: Custom, using project patterns

const MERGE_STRATEGIES = [
  {
    value: "merge" as const,
    label: "Create a merge commit",
    description: "All commits will be added to the base branch via a merge commit.",
  },
  {
    value: "squash" as const,
    label: "Squash and merge",
    description: "All commits will be squashed into a single commit on the base branch.",
  },
  {
    value: "rebase" as const,
    label: "Rebase and merge",
    description: "All commits will be rebased onto the base branch.",
  },
];

type MergeMethod = "merge" | "squash" | "rebase";

interface MergeStrategySelectorProps {
  value: MergeMethod;
  onChange: (method: MergeMethod) => void;
}

export function MergeStrategySelector({ value, onChange }: MergeStrategySelectorProps) {
  return (
    <div className="space-y-1.5" role="radiogroup" aria-label="Merge strategy">
      {MERGE_STRATEGIES.map((strategy) => (
        <label
          key={strategy.value}
          className={cn(
            "flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
            "border",
            value === strategy.value
              ? "border-ctp-blue bg-ctp-blue/5"
              : "border-ctp-surface1 hover:border-ctp-surface2 hover:bg-ctp-surface0/30",
          )}
        >
          <input
            type="radio"
            name="merge-method"
            value={strategy.value}
            checked={value === strategy.value}
            onChange={() => onChange(strategy.value)}
            className="mt-0.5 accent-ctp-blue"
          />
          <div>
            <span className="text-sm font-medium text-ctp-text">{strategy.label}</span>
            <p className="text-xs text-ctp-overlay0 mt-0.5">{strategy.description}</p>
          </div>
        </label>
      ))}
    </div>
  );
}
```

### Create PR Form Component

```tsx
// Source: Derived from CloneForm.tsx pattern

import { useState, useEffect } from "react";
import { useRepositoryStore } from "../../../stores/repository";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import { useCreatePullRequest } from "../hooks/useGitHubMutation";

interface CreatePullRequestBladeProps {
  owner: string;
  repo: string;
}

export function CreatePullRequestBlade({ owner, repo }: CreatePullRequestBladeProps) {
  const repoStatus = useRepositoryStore((s) => s.repoStatus);
  const currentBranch = repoStatus?.branchName ?? "";

  // Auto-fill title from branch name: feature/add-login -> Add login
  const [title, setTitle] = useState(() =>
    currentBranch
      .replace(/^(feature|fix|hotfix|release|bugfix)\//, "")
      .replace(/[-_]/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase())
  );
  const [base, setBase] = useState("main");
  const [body, setBody] = useState("");
  const [isDraft, setIsDraft] = useState(false);

  const mutation = useCreatePullRequest(owner, repo);

  // Auto-fill body from commit messages (load on mount)
  useEffect(() => {
    commands.githubGetBranchCommits(`origin/${base}`)
      .then((result) => {
        if (result.status === "ok" && result.data.length > 0) {
          setBody(result.data.map((msg) => `- ${msg}`).join("\n"));
        }
      })
      .catch(() => { /* silent */ });
  }, [base]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    mutation.mutate({
      title: title.trim(),
      head: currentBranch,
      base,
      body: body.trim() || undefined,
      draft: isDraft || undefined,
    });
  };

  const canSubmit = title.trim().length > 0 && currentBranch !== base;

  return (
    <form onSubmit={handleSubmit} className="h-full overflow-y-auto">
      <div className="px-4 py-4 space-y-4">
        {/* Branch info */}
        <div className="text-xs text-ctp-overlay0">
          <span className="font-mono bg-ctp-surface0 px-1.5 py-0.5 rounded text-ctp-subtext1">
            {currentBranch}
          </span>
          <span className="mx-1.5">&rarr;</span>
          <input
            type="text"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className={cn(
              "font-mono bg-ctp-surface0 px-1.5 py-0.5 rounded text-ctp-subtext1",
              "border border-transparent focus:border-ctp-blue focus:outline-none",
            )}
          />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="pr-title" className="text-xs text-ctp-overlay1">Title</label>
          <input
            id="pr-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={cn(
              "w-full px-3 py-2 text-sm bg-ctp-mantle border border-ctp-surface1",
              "rounded focus:outline-none focus:border-ctp-blue",
              "text-ctp-text placeholder:text-ctp-overlay0",
            )}
            placeholder="Pull request title"
            autoFocus
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label htmlFor="pr-body" className="text-xs text-ctp-overlay1">Description</label>
          <textarea
            id="pr-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className={cn(
              "w-full px-3 py-2 text-sm bg-ctp-mantle border border-ctp-surface1",
              "rounded focus:outline-none focus:border-ctp-blue resize-y",
              "text-ctp-text placeholder:text-ctp-overlay0 font-mono",
            )}
            placeholder="Describe your changes..."
          />
        </div>

        {/* Draft toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <ToggleSwitch checked={isDraft} onChange={setIsDraft} />
          <span className="text-sm text-ctp-subtext1">Create as draft</span>
        </label>

        {/* Submit */}
        <Button
          type="submit"
          disabled={!canSubmit}
          loading={mutation.isPending}
          loadingText="Creating..."
          className="w-full"
        >
          Create Pull Request
        </Button>

        {currentBranch === base && (
          <p className="text-xs text-ctp-yellow">
            Cannot create a PR from the same branch. Switch to a feature branch first.
          </p>
        )}
      </div>
    </form>
  );
}
```

### Extension Enable/Disable State Persistence

```typescript
// Source: Derived from project patterns with tauri-plugin-store

// The existing tauri-plugin-store (already in Cargo.toml) can persist
// extension enabled/disabled state across app restarts.
// Store file: .flowforge/extension-state.json

import { Store } from "@tauri-apps/plugin-store";

interface ExtensionState {
  enabled: Record<string, boolean>; // extensionId -> enabled
}

const STORE_PATH = ".flowforge/extension-state.json";
let storeInstance: Store | null = null;

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = new Store(STORE_PATH);
  }
  return storeInstance;
}

export async function getExtensionEnabled(extensionId: string): Promise<boolean> {
  const store = await getStore();
  const state = await store.get<ExtensionState>("extensionState");
  return state?.enabled?.[extensionId] ?? true; // default: enabled
}

export async function setExtensionEnabled(extensionId: string, enabled: boolean): Promise<void> {
  const store = await getStore();
  const state = (await store.get<ExtensionState>("extensionState")) ?? { enabled: {} };
  state.enabled[extensionId] = enabled;
  await store.set("extensionState", state);
  await store.save();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| reqwest `.form()` for POST | `.json()` for REST API bodies | N/A (project already uses both) | GitHub REST API requires JSON for PR/merge endpoints; `.form()` is for OAuth only |
| Separate error types per module | Unified `GitHubError` enum | Phase 35 | All GitHub commands share the same error type, simplifies frontend handling |
| Direct Tauri `invoke()` | `commands.*` via tauri-specta bindings | Phase 35 | Type-safe IPC with auto-generated TypeScript types |

**Key version notes:**
- `reqwest 0.13` supports `.json(&body)` on POST/PUT which serializes with serde (confirmed: `json` feature in Cargo.toml)
- `git2 0.20` wraps libgit2 with shallow clone support via `FetchOptions::depth()`
- `tauri-specta 2.0.0-rc.21` generates the `Result<T, E>` wrapper pattern seen in `bindings.ts`

## Open Questions

1. **git2 Shallow Clone Reliability**
   - What we know: `git2::FetchOptions::depth()` exists in git2 0.20
   - What's unclear: Whether all git servers (especially GitHub) reliably support shallow clone via libgit2's implementation
   - Recommendation: Implement with shallow clone, add fallback to full clone on failure. Extension repos are typically small so full clone is acceptable.

2. **Extension Permissions Enforcement**
   - What we know: The `ExtensionManifest` already has a `permissions: Option<Vec<String>>` field
   - What's unclear: Whether Phase 36 should actually enforce permissions (sandboxing) or just display them for user review
   - Recommendation: Display-only for Phase 36. Actual enforcement (permission gating) is a significant additional effort best deferred to a later phase. Show permissions during install review and in the extension card.

3. **Branch Protection Checks Before Merge**
   - What we know: GitHub returns 405 when branch protection blocks merge. There's also a GET endpoint to check merge status.
   - What's unclear: Whether to pre-check merge status before showing the merge button, or just handle the error
   - Recommendation: Pre-check is optional. The merge confirmation dialog should handle the error gracefully. A 405 error message from GitHub includes why the merge is blocked (e.g., "2 required approvals missing").

4. **Extension Manager as Core vs Extension Blade**
   - What we know: The extension manager is a meta-feature that manages other extensions
   - What's unclear: Should it be a core blade (registered in `bladeInit.ts`) or an "extension about extensions" registered by ExtensionHost?
   - Recommendation: Register as a **core blade** (not extension), because it needs to work even when extensions fail. Register in `bladeInit.ts` alongside other core blades.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src-tauri/src/github/client.rs`, `pulls.rs`, `issues.rs`, `types.rs`, `error.rs`, `auth.rs`, `remote.rs`, `token.rs`, `mod.rs` -- exact patterns to follow
- Codebase analysis: `src/extensions/ExtensionAPI.ts`, `ExtensionHost.ts`, `extensionTypes.ts`, `extensionManifest.ts` -- extension lifecycle patterns
- Codebase analysis: `src/extensions/github/index.ts`, `githubStore.ts`, `useGitHubQuery.ts` -- GitHub extension registration and query patterns
- Codebase analysis: `src/components/ui/dialog.tsx`, `button.tsx`, `CloneForm.tsx`, `SyncButtons.tsx`, `MergeDialog.tsx` -- UI component and mutation patterns
- GitHub REST API docs: `POST /repos/{owner}/{repo}/pulls` and `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge` -- API contract
- Context7 `/tanstack/query` -- useMutation with invalidateQueries pattern

### Secondary (MEDIUM confidence)
- GitHub API error codes 405/409/422 for merge operations -- from official docs but partial extraction
- `git2` 0.20 shallow clone via `FetchOptions::depth()` -- API exists but runtime behavior not fully verified

### Tertiary (LOW confidence)
- Extension permission enforcement patterns -- no prior art in this codebase, display-only recommended

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies needed, all patterns from existing code
- Architecture: HIGH -- follows established two-tier type pattern, command pattern, and extension system
- Pitfalls: HIGH -- most pitfalls are derived from observed codebase patterns (BigInt, stale cache, lib.rs registration)
- GitHub API contract: MEDIUM -- create PR endpoint fully documented, merge endpoint partially documented

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable patterns, unlikely to change)
