# Phase 34: GitHub Authentication - Developer Research

**Researched:** 2026-02-10
**Domain:** OAuth Device Flow, Keychain Storage, GitHub Extension (Tauri v2 + Rust + React)
**Confidence:** HIGH

## Summary

This research documents the exact APIs, crate methods, serde types, Tauri command patterns, and React/Zustand patterns needed to implement GitHub OAuth Device Flow authentication as a FlowForge extension. The implementation spans three layers: a new Rust `github` module with Tauri commands for OAuth flow + keychain storage, a frontend GitHub auth Zustand store + blade component, and the extension entry point that bridges them through the Phase 33 extension system.

The codebase already establishes clear patterns: Rust commands use `#[tauri::command] #[specta::specta]` with serde-typed return values, reqwest is used for HTTP (see `nuget.rs`), the Tauri event system (`app.emit()`) pushes state from Rust to frontend (see `watcher.rs`), and the extension system (`ExtensionAPI`) provides `registerBlade()`, `registerCommand()`, and `contributeToolbar()` with automatic `ext:github:*` namespacing.

**Primary recommendation:** Build the GitHub module as a peer of `git/` and `gitflow/` in `src-tauri/src/github/`, with Tauri commands registered in `lib.rs`. The extension JS entry point imports core Tauri bindings to invoke these commands and registers blades/commands/toolbar via the ExtensionAPI facade.

---

## Standard Stack

### Core (Rust - New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `keyring` | 3.6.x | OS keychain token storage | Cross-platform: macOS Keychain, Windows Credential Manager, Linux Secret Service |
| `reqwest` | 0.13.x | HTTP client for GitHub API | Already in Cargo.toml with `json` + `rustls` features |
| `serde` | 1.x | Serialize/deserialize GitHub API responses | Already in Cargo.toml |
| `serde_json` | 1.x | JSON parsing for OAuth responses | Already in Cargo.toml |
| `specta` | 2.0.0-rc.22 | TypeScript binding generation | Already in Cargo.toml |
| `tauri-specta` | 2.0.0-rc.21 | Tauri command type generation | Already in Cargo.toml |

### Core (Frontend - Existing)

| Library | Version | Purpose | Already Present |
|---------|---------|---------|-----------------|
| `zustand` | 5.x | GitHub auth state store | Yes |
| `@tauri-apps/api` | 2.x | `invoke()` for Tauri commands | Yes |
| `@tauri-apps/plugin-opener` | 2.5.x | `openUrl()` for browser redirect | Yes |
| `lucide-react` | 0.563 | Icons for auth UI | Yes |
| `react` | 19.2.x | UI components | Yes |

### keyring Feature Flags Required

```toml
[dependencies]
keyring = { version = "3", features = ["apple-native", "windows-native", "linux-native-sync-persistent"] }
```

**CRITICAL:** keyring v3.x has NO default features. You MUST specify platform features explicitly or the crate compiles with only a mock store. The three features above cover:
- `apple-native`: macOS Keychain
- `windows-native`: Windows Credential Manager
- `linux-native-sync-persistent`: Linux keyutils + Secret Service (DBus)

### Installation

```bash
# Rust dependencies (in src-tauri/)
cargo add keyring --features apple-native,windows-native,linux-native-sync-persistent
# reqwest already present, no new frontend dependencies needed
```

---

## Architecture Patterns

### Recommended Rust Module Structure

```
src-tauri/src/
  github/
    mod.rs           # pub mod declarations + re-exports
    auth.rs           # OAuth Device Flow commands (start, poll, sign-out)
    token.rs          # Keychain storage (get/set/delete via keyring)
    types.rs          # Serde types for GitHub API responses
    error.rs          # GitHubError enum (like git/error.rs pattern)
    remote.rs         # GitHub remote URL detection/parsing
    rate_limit.rs     # Rate limit header tracking
```

### Recommended Extension JS Structure

```
.flowforge/extensions/github/
  flowforge.extension.json   # Extension manifest
  index.js                   # Entry point: onActivate(api), onDeactivate()

src/extensions/github/       # Source code (built to .flowforge/extensions/github/)
  index.ts                   # Extension entry point
  GitHubAuthBlade.tsx         # Auth blade component
  GitHubAccountBlade.tsx      # Account info/management blade
  githubStore.ts              # Zustand store for GitHub auth state
  types.ts                    # TypeScript types
```

**Important architectural note:** The GitHub extension is BUNDLED with the app (not user-installed). Its source lives in `src/extensions/github/` and is built alongside the app. The `.flowforge/extensions/github/` directory with the manifest is for the extension discovery system to find it. During development, the extension JS can be co-located in `src/` and imported directly.

### Pattern 1: Tauri Command with specta (Rust)

**What:** Every Rust command follows the exact same pattern used throughout the codebase.
**When to use:** All GitHub OAuth and token commands.
**Example:**

```rust
// Source: Verified from src-tauri/src/git/commands.rs, src-tauri/src/git/nuget.rs
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u32,
    pub interval: u32,
}

#[tauri::command]
#[specta::specta]
pub async fn github_start_device_flow(
    scopes: Vec<String>,
) -> Result<DeviceFlowResponse, GitHubError> {
    // ... implementation
}
```

### Pattern 2: Error Enum (Rust)

**What:** Tagged enum error type matching the `GitError` pattern.
**Source:** `src-tauri/src/git/error.rs`

```rust
use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

#[derive(Debug, Error, Serialize, Deserialize, Type, Clone)]
#[serde(tag = "type", content = "message")]
pub enum GitHubError {
    #[error("OAuth flow failed: {0}")]
    OAuthFailed(String),

    #[error("Authorization pending")]
    AuthorizationPending,

    #[error("Authorization denied by user")]
    AccessDenied,

    #[error("Device code expired")]
    ExpiredToken,

    #[error("Rate limited, slow down")]
    SlowDown,

    #[error("Keychain error: {0}")]
    KeychainError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Not authenticated")]
    NotAuthenticated,

    #[error("Rate limit exceeded: {0}")]
    RateLimitExceeded(String),
}
```

### Pattern 3: Zustand Store with devtools (Frontend)

**What:** Extension-owned store following the codebase pattern.
**Source:** `src/stores/domain/git-ops/index.ts`, `src/extensions/ExtensionHost.ts`

```typescript
// Source: Verified pattern from src/stores/domain/git-ops/index.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface GitHubAuthState {
  // Auth status
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authError: string | null;

  // Device flow state
  userCode: string | null;
  verificationUri: string | null;
  expiresAt: number | null;

  // User info (after auth)
  username: string | null;
  avatarUrl: string | null;
  scopes: string[];

  // Rate limit tracking
  rateLimit: { remaining: number; limit: number; reset: number } | null;

  // Actions
  startDeviceFlow: (scopes: string[]) => Promise<void>;
  pollAuth: () => Promise<boolean>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useGitHubAuthStore = create<GitHubAuthState>()(
  devtools(
    (set, get) => ({
      // ... state and actions
    }),
    { name: "github-auth", enabled: import.meta.env.DEV },
  ),
);
```

### Pattern 4: Extension Entry Point

**What:** The extension JS module that the ExtensionHost loads via `onActivate(api)`.
**Source:** `src/extensions/ExtensionHost.ts` lines 166-174

```typescript
// Extension entry point: src/extensions/github/index.ts
import type { ExtensionAPI } from "../../extensions/ExtensionAPI";
import { GitHubAuthBlade } from "./GitHubAuthBlade";
import { useGitHubAuthStore } from "./githubStore";
import { Github } from "lucide-react";

export async function onActivate(api: ExtensionAPI) {
  // Register the auth blade
  // Type becomes "ext:github:auth" automatically
  api.registerBlade({
    type: "auth",
    title: "GitHub",
    component: GitHubAuthBlade,
    singleton: true,
  });

  // Register commands
  api.registerCommand({
    id: "sign-in",
    title: "Sign in to GitHub",
    category: "github",
    action: () => {
      // Open the auth blade
    },
  });

  // Contribute toolbar action
  api.contributeToolbar({
    id: "github-status",
    label: "GitHub",
    icon: Github,
    group: "app",
    priority: 10,
    execute: () => {
      // Toggle auth blade
    },
  });

  // Check for existing auth on activation
  await useGitHubAuthStore.getState().checkAuth();
}

export async function onDeactivate() {
  // Cleanup is handled automatically by ExtensionAPI.cleanup()
  // But we can do extension-specific cleanup here
}
```

### Pattern 5: Blade Component (Frontend)

**What:** Blade component following existing patterns with Catppuccin Tailwind classes.
**Source:** `src/blades/settings/SettingsBlade.tsx`, `src/blades/_shared/BladePanel.tsx`

```tsx
// Component patterns from the codebase:

// Panel layout
<div className="flex flex-col h-full">
  <div className="h-10 px-3 flex items-center gap-2 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
    {/* Title bar */}
  </div>
  <div className="flex-1 min-h-0 overflow-hidden">
    {/* Content */}
  </div>
</div>

// Standard section layout
<div className="space-y-6">
  <div>
    <h3 className="text-lg font-medium text-ctp-text mb-1">Section Title</h3>
    <p className="text-sm text-ctp-subtext0 mb-4">Description text.</p>
  </div>
</div>

// Primary button
<button className="px-4 py-2 bg-ctp-blue text-ctp-base rounded-md text-sm font-medium hover:bg-ctp-sapphire transition-colors">
  Sign In
</button>

// Input fields
<input className="w-full max-w-xs px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-md text-sm text-ctp-text focus:outline-none focus:ring-2 focus:ring-ctp-blue focus:border-transparent" />

// Subtle divider
<div className="border-t border-ctp-surface1 pt-4 mt-6">
  <p className="text-xs text-ctp-overlay0">Helper text</p>
</div>

// Status badge
<span className="px-2 py-0.5 rounded-full text-xs bg-ctp-green/20 text-ctp-green">Connected</span>
<span className="px-2 py-0.5 rounded-full text-xs bg-ctp-red/20 text-ctp-red">Disconnected</span>
```

### Anti-Patterns to Avoid

- **Frontend HTTP calls:** CSP blocks `connect-src` to only `ipc: http://ipc.localhost`. ALL GitHub API calls MUST go through Rust commands. The `nuget.rs` proxy pattern is the model.
- **Storing tokens in JavaScript:** Tokens must only exist in Rust (keychain). The frontend should only know authentication status, never the token value.
- **Sharing git2::Repository across threads:** The codebase uses `RepositoryState` with path-only storage, opening fresh `Repository` handles in `spawn_blocking`. Follow this pattern for remote URL parsing.
- **Non-namespaced registrations:** Extension blades/commands/toolbar MUST go through `ExtensionAPI` for automatic `ext:github:*` namespacing. Never call `registerBlade()` directly from extension code.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keychain access | Custom FFI to Security.framework/DPAPI | `keyring` crate v3 | Handles macOS/Windows/Linux differences, credential lifecycle |
| HTTP client | Raw TCP/TLS | `reqwest` (already in project) | Connection pooling, TLS, JSON handling, timeout support |
| TypeScript bindings | Manual type definitions | `tauri-specta` + `specta` (already in project) | Auto-generates TS types from Rust structs, zero drift |
| URL opening | Custom platform commands | `@tauri-apps/plugin-opener` `openUrl()` | Already used in codebase (MarkdownLink.tsx), handles platform differences |
| Extension namespacing | Manual prefix management | `ExtensionAPI` facade | Automatic `ext:github:*` prefixing, cleanup on deactivation |
| OAuth state polling | setInterval with manual cleanup | Tauri command + AbortController pattern | Avoids zombie intervals, handles component unmount |

**Key insight:** The codebase already has all infrastructure pieces. The GitHub extension connects existing patterns (reqwest for HTTP, opener for browser, extension system for UI registration) with new keyring storage and GitHub-specific logic.

---

## Common Pitfalls

### Pitfall 1: keyring v3 No-Default-Features Trap

**What goes wrong:** `cargo add keyring` with no features compiles fine but only provides the mock credential store. Tokens appear to save but are lost on restart.
**Why it happens:** keyring v3 removed all default features. Each platform backend is opt-in.
**How to avoid:** Always specify features: `keyring = { version = "3", features = ["apple-native", "windows-native", "linux-native-sync-persistent"] }`
**Warning signs:** Token storage works in tests but not in production; `set_password` succeeds but `get_password` returns `NoEntry`.

### Pitfall 2: GitHub Device Flow Polling Rate Limit

**What goes wrong:** Polling too fast returns `slow_down` error and adds 5 seconds to the required interval.
**Why it happens:** GitHub enforces the `interval` field from the initial response (typically 5 seconds). Each `slow_down` adds 5 more seconds.
**How to avoid:** Respect the `interval` field exactly. Use `tokio::time::sleep(Duration::from_secs(interval))` between polls. On `slow_down`, add 5 to the interval.
**Warning signs:** `slow_down` error in polling response.

### Pitfall 3: CSP Blocking Frontend HTTP Requests

**What goes wrong:** Trying to call GitHub API from frontend JavaScript fails silently or throws network error.
**Why it happens:** `connect-src` in `tauri.conf.json` only allows `ipc: http://ipc.localhost`. No external domains.
**How to avoid:** ALL GitHub API calls go through Rust Tauri commands. The frontend invokes `commands.githubStartDeviceFlow()` which calls reqwest internally.
**Warning signs:** Network errors in browser console, blocked by CSP.

### Pitfall 4: Token Leaking to Frontend

**What goes wrong:** OAuth access token ends up in JavaScript memory or browser devtools.
**Why it happens:** Returning the token from a Tauri command or storing it in Zustand.
**How to avoid:** The Rust command that polls for the access token stores it directly in the keychain and returns only `{ authenticated: true, username, scopes }`. The frontend never sees the token.
**Warning signs:** Token visible in devtools network/state tabs.

### Pitfall 5: Device Code Expiry Without User Feedback

**What goes wrong:** User opens browser, takes too long (>15 minutes), comes back to app showing success/error from stale state.
**Why it happens:** GitHub device codes expire after `expires_in` seconds (default 900s/15min). Polling continues until expiry.
**How to avoid:** Track `expires_at` timestamp in the Zustand store. Show countdown. Stop polling when expired and prompt user to restart.
**Warning signs:** `expired_token` error from polling endpoint.

### Pitfall 6: Accept Header for GitHub OAuth Endpoints

**What goes wrong:** GitHub returns URL-encoded form data (`access_token=...&token_type=...`) instead of JSON.
**Why it happens:** GitHub OAuth endpoints default to form-encoded responses unless you send `Accept: application/json`.
**How to avoid:** Always set `.header("Accept", "application/json")` on reqwest requests to GitHub OAuth endpoints.
**Warning signs:** Serde deserialization fails with "expected value" error; response body looks like `access_token=gho_xxx&token_type=bearer`.

### Pitfall 7: Extension Module Loading Path Issues

**What goes wrong:** Extension fails to activate with module load error.
**Why it happens:** `convertFileSrc()` converts filesystem paths to `asset://` URLs. If the extension JS file doesn't exist at the expected path, or the asset protocol scope doesn't include it, the import fails.
**How to avoid:** For a bundled extension, consider having the extension code compiled as part of the main app bundle and discovered via a known path relative to the repo root.
**Warning signs:** `Failed to activate extension` toast, 404 in console.

---

## Code Examples

### 1. GitHub OAuth Device Flow - Rust Implementation

```rust
// Source: GitHub OAuth docs + project reqwest pattern (nuget.rs)

use reqwest::Client;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::time::Duration;

const GITHUB_DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";

// The client_id for the registered GitHub OAuth App
// In production, this should come from config/env, not hardcoded
const GITHUB_CLIENT_ID: &str = "YOUR_CLIENT_ID";

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u32,
    pub interval: u32,
}

#[derive(Debug, Deserialize)]
struct GitHubDeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u32,
    interval: u32,
}

#[derive(Debug, Deserialize)]
struct GitHubTokenResponse {
    access_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    error: Option<String>,
    // error_description and error_uri also available
}

#[tauri::command]
#[specta::specta]
pub async fn github_start_device_flow(
    scopes: Vec<String>,
) -> Result<DeviceFlowResponse, GitHubError> {
    let client = Client::new();
    let scope_string = scopes.join(" ");

    let resp = client
        .post(GITHUB_DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("scope", &scope_string),
        ])
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    if !resp.status().is_success() {
        return Err(GitHubError::OAuthFailed(format!(
            "Device code request failed: {}",
            resp.status()
        )));
    }

    let data: GitHubDeviceCodeResponse = resp
        .json()
        .await
        .map_err(|e| GitHubError::OAuthFailed(format!("Parse error: {}", e)))?;

    Ok(DeviceFlowResponse {
        device_code: data.device_code,
        user_code: data.user_code,
        verification_uri: data.verification_uri,
        expires_in: data.expires_in,
        interval: data.interval,
    })
}
```

### 2. Token Polling - Rust Implementation

```rust
// Source: GitHub OAuth docs + project error pattern

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AuthResult {
    pub authenticated: bool,
    pub username: Option<String>,
    pub scopes: Vec<String>,
    pub error: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn github_poll_auth(
    device_code: String,
) -> Result<AuthResult, GitHubError> {
    let client = Client::new();

    let resp = client
        .post(GITHUB_ACCESS_TOKEN_URL)
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("device_code", &device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    let data: GitHubTokenResponse = resp
        .json()
        .await
        .map_err(|e| GitHubError::OAuthFailed(format!("Parse error: {}", e)))?;

    // Check for error responses
    if let Some(error) = &data.error {
        return match error.as_str() {
            "authorization_pending" => Err(GitHubError::AuthorizationPending),
            "slow_down" => Err(GitHubError::SlowDown),
            "expired_token" => Err(GitHubError::ExpiredToken),
            "access_denied" => Err(GitHubError::AccessDenied),
            other => Err(GitHubError::OAuthFailed(other.to_string())),
        };
    }

    // Success - store token in keychain, NEVER return it
    if let Some(token) = &data.access_token {
        store_token(token)?;

        // Fetch user info to return username
        let user_info = fetch_github_user(&client, token).await?;
        let scopes = data.scope
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        return Ok(AuthResult {
            authenticated: true,
            username: Some(user_info.login),
            scopes,
            error: None,
        });
    }

    Err(GitHubError::OAuthFailed("No token in response".to_string()))
}
```

### 3. Keychain Storage - Rust Implementation

```rust
// Source: keyring docs (docs.rs/keyring/latest/keyring/struct.Entry.html)

const KEYCHAIN_SERVICE: &str = "com.flowforge.desktop";
const KEYCHAIN_USER: &str = "github-oauth-token";

/// Store OAuth token in OS keychain
fn store_token(token: &str) -> Result<(), GitHubError> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER)
        .map_err(|e| GitHubError::KeychainError(format!("Failed to create entry: {}", e)))?;

    entry
        .set_password(token)
        .map_err(|e| GitHubError::KeychainError(format!("Failed to store token: {}", e)))?;

    Ok(())
}

/// Retrieve OAuth token from OS keychain
fn get_token() -> Result<String, GitHubError> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER)
        .map_err(|e| GitHubError::KeychainError(format!("Failed to create entry: {}", e)))?;

    entry
        .get_password()
        .map_err(|e| match e {
            keyring::Error::NoEntry => GitHubError::NotAuthenticated,
            other => GitHubError::KeychainError(format!("Failed to get token: {}", other)),
        })
}

/// Delete OAuth token from OS keychain (sign out)
fn delete_token() -> Result<(), GitHubError> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER)
        .map_err(|e| GitHubError::KeychainError(format!("Failed to create entry: {}", e)))?;

    // delete_credential is the v3 name (renamed from delete_password)
    entry
        .delete_credential()
        .map_err(|e| match e {
            keyring::Error::NoEntry => return Ok(()), // Already deleted, fine
            other => GitHubError::KeychainError(format!("Failed to delete: {}", other)),
        })
}

/// Tauri command: check if user is authenticated (returns user info, never the token)
#[tauri::command]
#[specta::specta]
pub async fn github_get_auth_status() -> Result<AuthResult, GitHubError> {
    let token = match get_token() {
        Ok(t) => t,
        Err(GitHubError::NotAuthenticated) => {
            return Ok(AuthResult {
                authenticated: false,
                username: None,
                scopes: vec![],
                error: None,
            });
        }
        Err(e) => return Err(e),
    };

    // Validate token is still good by calling GitHub API
    let client = Client::new();
    match fetch_github_user(&client, &token).await {
        Ok(user) => Ok(AuthResult {
            authenticated: true,
            username: Some(user.login),
            scopes: vec![], // Could also check scopes via API
            error: None,
        }),
        Err(_) => {
            // Token is invalid, clean up
            let _ = delete_token();
            Ok(AuthResult {
                authenticated: false,
                username: None,
                scopes: vec![],
                error: Some("Token expired or revoked".to_string()),
            })
        }
    }
}

/// Tauri command: sign out (delete token from keychain)
#[tauri::command]
#[specta::specta]
pub async fn github_sign_out() -> Result<(), GitHubError> {
    delete_token()
}
```

### 4. GitHub User Info Fetch

```rust
// Source: GitHub API docs + reqwest pattern from nuget.rs

#[derive(Debug, Deserialize)]
struct GitHubUser {
    login: String,
    avatar_url: String,
    name: Option<String>,
}

async fn fetch_github_user(
    client: &Client,
    token: &str,
) -> Result<GitHubUser, GitHubError> {
    let resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/json")
        .header("User-Agent", "FlowForge-Desktop")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    if !resp.status().is_success() {
        return Err(GitHubError::OAuthFailed(
            format!("GitHub API returned {}", resp.status())
        ));
    }

    resp.json::<GitHubUser>()
        .await
        .map_err(|e| GitHubError::OAuthFailed(format!("Parse error: {}", e)))
}
```

### 5. Rate Limit Header Extraction

```rust
// Source: GitHub API rate limit docs

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitInfo {
    pub limit: u32,
    pub remaining: u32,
    pub reset: u64,    // Unix timestamp
    pub used: u32,
}

/// Extract rate limit info from GitHub API response headers
fn extract_rate_limit(headers: &reqwest::header::HeaderMap) -> Option<RateLimitInfo> {
    let limit = headers.get("x-ratelimit-limit")?.to_str().ok()?.parse().ok()?;
    let remaining = headers.get("x-ratelimit-remaining")?.to_str().ok()?.parse().ok()?;
    let reset = headers.get("x-ratelimit-reset")?.to_str().ok()?.parse().ok()?;
    let used = headers.get("x-ratelimit-used")?.to_str().ok()?.parse().ok()?;

    Some(RateLimitInfo { limit, remaining, reset, used })
}
```

### 6. GitHub Remote URL Parsing

```rust
// Source: git2 API + project pattern from remote.rs

/// Parse owner/repo from a GitHub remote URL.
/// Handles both HTTPS and SSH formats:
///   https://github.com/owner/repo.git
///   git@github.com:owner/repo.git
pub fn parse_github_remote(url: &str) -> Option<(String, String)> {
    // HTTPS format
    if url.starts_with("https://github.com/") {
        let path = url.trim_start_matches("https://github.com/");
        let path = path.trim_end_matches(".git");
        let parts: Vec<&str> = path.splitn(2, '/').collect();
        if parts.len() == 2 {
            return Some((parts[0].to_string(), parts[1].to_string()));
        }
    }

    // SSH format
    if url.starts_with("git@github.com:") {
        let path = url.trim_start_matches("git@github.com:");
        let path = path.trim_end_matches(".git");
        let parts: Vec<&str> = path.splitn(2, '/').collect();
        if parts.len() == 2 {
            return Some((parts[0].to_string(), parts[1].to_string()));
        }
    }

    None
}

/// Detect GitHub remotes in the current repository
#[tauri::command]
#[specta::specta]
pub async fn github_detect_remotes(
    state: tauri::State<'_, crate::git::RepositoryState>,
) -> Result<Vec<GitHubRemote>, GitHubError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitHubError::OAuthFailed("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)
            .map_err(|e| GitHubError::OAuthFailed(e.message().to_string()))?;

        let remotes = repo.remotes()
            .map_err(|e| GitHubError::OAuthFailed(e.message().to_string()))?;

        let mut github_remotes = Vec::new();
        for name in remotes.iter().flatten() {
            if let Ok(remote) = repo.find_remote(name) {
                let url = remote.url().unwrap_or("");
                if let Some((owner, repo_name)) = parse_github_remote(url) {
                    github_remotes.push(GitHubRemote {
                        remote_name: name.to_string(),
                        owner,
                        repo: repo_name,
                        url: url.to_string(),
                    });
                }
            }
        }

        Ok(github_remotes)
    })
    .await
    .map_err(|e| GitHubError::OAuthFailed(format!("Task join error: {}", e)))?
}
```

### 7. Registering Commands in lib.rs

```rust
// Source: src-tauri/src/lib.rs - exact pattern used for all commands

// In lib.rs, add to the collect_commands! macro:
use github::{
    auth::{github_start_device_flow, github_poll_auth, github_get_auth_status, github_sign_out},
    remote::github_detect_remotes,
    rate_limit::github_get_rate_limit,
};

// Then in the Builder:
let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
    // ... existing commands ...
    // GitHub commands
    github_start_device_flow,
    github_poll_auth,
    github_get_auth_status,
    github_sign_out,
    github_detect_remotes,
    github_get_rate_limit,
]);
```

### 8. Frontend Polling Pattern

```typescript
// Source: Derived from codebase patterns (no external deps needed)

async function pollForAuth(
  deviceCode: string,
  interval: number,
  expiresAt: number,
): Promise<void> {
  const { set } = useGitHubAuthStore.getState();
  let currentInterval = interval;

  while (Date.now() < expiresAt * 1000) {
    await new Promise(resolve => setTimeout(resolve, currentInterval * 1000));

    try {
      const result = await commands.githubPollAuth(deviceCode);
      if (result.status === "ok") {
        set({
          isAuthenticated: true,
          isAuthenticating: false,
          username: result.data.username,
          scopes: result.data.scopes,
          userCode: null,
          verificationUri: null,
        });
        return;
      }
    } catch (error: unknown) {
      // tauri-specta returns errors as the error property of the Result
      // Check the specific error types from the Rust enum
      const err = error as { type: string };
      if (err.type === "AuthorizationPending") {
        // Continue polling
        continue;
      } else if (err.type === "SlowDown") {
        currentInterval += 5;
        continue;
      } else if (err.type === "ExpiredToken") {
        set({
          isAuthenticating: false,
          authError: "Authorization code expired. Please try again.",
          userCode: null,
        });
        return;
      } else if (err.type === "AccessDenied") {
        set({
          isAuthenticating: false,
          authError: "Authorization was denied.",
          userCode: null,
        });
        return;
      }
      // Unknown error
      set({ isAuthenticating: false, authError: String(error) });
      return;
    }
  }
}
```

### 9. Opening Browser for Verification URI

```typescript
// Source: src/components/markdown/MarkdownLink.tsx (verified pattern)
import { openUrl } from "@tauri-apps/plugin-opener";

// In the auth blade component:
async function handleOpenBrowser(verificationUri: string) {
  await openUrl(verificationUri);
}
```

### 10. Extension Manifest

```json
{
  "id": "github",
  "name": "GitHub Integration",
  "version": "1.0.0",
  "description": "GitHub authentication, account linking, and API integration",
  "apiVersion": "1",
  "main": "index.js",
  "permissions": ["network"],
  "contributes": {
    "blades": [
      {
        "type": "auth",
        "title": "GitHub Authentication",
        "singleton": true
      },
      {
        "type": "account",
        "title": "GitHub Account",
        "singleton": true
      }
    ],
    "commands": [
      {
        "id": "sign-in",
        "title": "Sign in to GitHub",
        "category": "GitHub"
      },
      {
        "id": "sign-out",
        "title": "Sign out of GitHub",
        "category": "GitHub"
      }
    ],
    "toolbar": [
      {
        "id": "github-status",
        "label": "GitHub",
        "group": "app",
        "priority": 10
      }
    ]
  }
}
```

---

## Tailwind v4 / Catppuccin Color Reference

The project uses `@catppuccin/tailwindcss` with Tailwind v4. All color classes use the `ctp-` prefix. Key colors used throughout the codebase:

| Semantic Use | Class | Example |
|-------------|-------|---------|
| Page background | `bg-ctp-base` | Main content area |
| Panel background | `bg-ctp-crust` | Title bars, sidebars |
| Surface (interactive bg) | `bg-ctp-surface0` | Hover states, inputs |
| Border (subtle) | `border-ctp-surface0` | Panel dividers |
| Border (stronger) | `border-ctp-surface1` | Section separators |
| Primary text | `text-ctp-text` | Main content text |
| Secondary text | `text-ctp-subtext1` | Labels, titles |
| Muted text | `text-ctp-subtext0` | Descriptions |
| Very muted text | `text-ctp-overlay0` | Help text, footnotes |
| Primary accent | `bg-ctp-blue` / `text-ctp-blue` | Buttons, links, active tabs |
| Primary hover | `hover:bg-ctp-sapphire` | Button hover states |
| Success | `text-ctp-green` | Connected status |
| Error | `text-ctp-red` | Error states, disconnected |
| Warning | `text-ctp-yellow` | Rate limit warnings |
| Active on dark | `text-ctp-base` | Text on blue/accent backgrounds |

---

## Codebase Integration Points

### Where New Rust Code Lives

| New Module | Purpose | Peer Of |
|-----------|---------|---------|
| `src-tauri/src/github/mod.rs` | Module root | `git/mod.rs`, `gitflow/mod.rs` |
| `src-tauri/src/github/auth.rs` | OAuth commands | `git/commands.rs` |
| `src-tauri/src/github/token.rs` | Keychain ops | New (no peer) |
| `src-tauri/src/github/types.rs` | Serde structs | `git/repository.rs` types |
| `src-tauri/src/github/error.rs` | Error enum | `git/error.rs` |
| `src-tauri/src/github/remote.rs` | URL parsing | `git/remote.rs` |
| `src-tauri/src/github/rate_limit.rs` | Rate tracking | New (no peer) |

### Files That Need Modification

| File | Change | Why |
|------|--------|-----|
| `src-tauri/src/lib.rs` | Add `mod github;` + import commands + add to `collect_commands!` | Register new Tauri commands |
| `src-tauri/Cargo.toml` | Add `keyring` dependency | New crate for keychain |
| `src/bindings.ts` | Auto-regenerated by `tauri-specta` on build | New command types appear here |

### Extension Bundling Strategy

The GitHub extension is **bundled** with the app (first-party). Two approaches:

**Option A: True Extension (recommended for testing the extension system)**
- Extension source in `src/extensions/github/`
- Build step copies compiled JS to `.flowforge/extensions/github/`
- `flowforge.extension.json` manifest in the extension directory
- Discovered and activated by `ExtensionHost` like any extension

**Option B: Hybrid (simpler but less extensible)**
- Rust commands in `src-tauri/src/github/` (core)
- React components in `src/blades/github-auth/` (core blade, not extension)
- Skip extension system for this feature entirely

**Recommendation:** Option A, because this is the first real extension and validates the Phase 33 system. However, since the extension needs to invoke Tauri commands that are core to the app (not extension-specific), the Rust side lives in `src-tauri/src/github/` regardless.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `keyring` v2 `delete_password()` | `keyring` v3 `delete_credential()` | v3.0 (2024) | Method renamed; old name still works as alias |
| GitHub OAuth Authorization Code | Device Flow for desktop apps | Recommended by GitHub | No redirect URI needed, better UX for desktop |
| `keyring` v2 default features | v3 no default features | v3.0 (2024) | Must explicitly enable platform backends |
| `tauri::Emitter` trait | Still current in Tauri v2 | Tauri v2 | Use `app.emit("event", payload)` for Rust-to-frontend |

---

## Open Questions

1. **GitHub OAuth App Client ID**
   - What we know: Device Flow requires a registered GitHub OAuth App's `client_id`. No `client_secret` needed for device flow.
   - What's unclear: Where should the `client_id` be stored? Hardcoded constant vs. config file vs. Tauri store.
   - Recommendation: Hardcode as a const in `github/auth.rs` for now. It's not a secret (public client ID). Can be moved to config later.

2. **Extension Bundling Build Step**
   - What we know: Extensions are discovered from `.flowforge/extensions/*/flowforge.extension.json`. The extension JS entry point is loaded via `convertFileSrc()`.
   - What's unclear: For a bundled first-party extension, how does the build pipeline produce the extension bundle? Does Vite need a separate entry point?
   - Recommendation: During development, the extension source can be compiled as part of the main Vite build. A simple build script or Vite plugin can copy the output to the expected extension directory. Alternatively, for the first extension, the main app can provide a "built-in extensions" path that points to a known location.

3. **Token Refresh / Expiry**
   - What we know: GitHub OAuth tokens don't expire unless revoked. GitHub App user tokens DO expire and need refresh.
   - What's unclear: If using an OAuth App (not GitHub App), tokens are long-lived. If using GitHub App device flow, refresh tokens are needed.
   - Recommendation: Start with OAuth App (simpler, no refresh needed). Document the token validity model. Add token validation on app startup by calling `/user` endpoint.

4. **keyring on Linux CI/headless**
   - What we know: `linux-native-sync-persistent` requires D-Bus and Secret Service. CI environments often don't have these.
   - What's unclear: Will tests fail in CI without a keyring backend?
   - Recommendation: Use `#[cfg(test)]` with keyring's mock credential store for tests. The `keyring` crate always includes the mock backend regardless of features.

---

## Sources

### Primary (HIGH confidence)
- [keyring crate API docs](https://docs.rs/keyring/latest/keyring/struct.Entry.html) - Entry struct API, version 3.6.3
- [keyring crate overview](https://docs.rs/keyring/latest/keyring/) - Feature flags, platform support
- [GitHub OAuth Device Flow docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) - Full device flow specification
- [GitHub OAuth Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) - Complete scope list
- [GitHub Rate Limit docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) - Rate limit headers
- [Tauri v2 Calling Frontend](https://v2.tauri.app/develop/calling-frontend/) - Event emission from Rust
- [Tauri v2 Opener Plugin](https://v2.tauri.app/plugin/opener/) - openUrl API
- Project codebase: `src-tauri/src/git/nuget.rs` (reqwest pattern), `src-tauri/src/git/watcher.rs` (event emission), `src-tauri/src/git/error.rs` (error pattern), `src/extensions/` (extension system)

### Secondary (MEDIUM confidence)
- [reqwest 0.13 docs](https://docs.rs/reqwest/0.13.1/reqwest/) - HTTP client API
- [GitHub Best Practices for OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app) - Security guidance

### Tertiary (LOW confidence)
- None - all findings verified against official documentation or existing codebase patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified against docs.rs, existing Cargo.toml, and codebase usage
- Architecture: HIGH - Patterns directly derived from existing codebase modules (git/, gitflow/, extensions/)
- Pitfalls: HIGH - CSP constraints verified in tauri.conf.json, keyring feature trap verified in docs, GitHub API behavior verified in official docs
- Code examples: HIGH - Based on verified API docs + existing codebase patterns

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable libraries, well-documented APIs)
