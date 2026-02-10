# Phase 34: GitHub Authentication - Architecture Research

**Researched:** 2026-02-10
**Domain:** OAuth Device Flow, OS keychain integration, Tauri hybrid extension architecture, auth provider patterns
**Confidence:** HIGH

## Summary

Phase 34 introduces GitHub authentication into FlowForge as the first extension built on Phase 33's ExtensionHost. This creates a unique architectural challenge: the GitHub extension is a **hybrid extension** that needs both JavaScript UI components (blades, commands, toolbar actions registered through ExtensionAPI) and Rust-side capabilities (keychain access via `keyring`, HTTP calls to GitHub API via `reqwest`, git remote parsing via `git2`). The current Phase 33 extension system only supports pure JavaScript extensions loaded via dynamic import -- it has no mechanism for extensions to invoke Rust-side capabilities beyond what core Tauri commands already provide.

The OAuth Device Flow is architecturally straightforward: a two-step process where the Rust backend (1) requests device/user codes from GitHub's `/login/device/code` endpoint, (2) polls `/login/oauth/access_token` on an interval until the user authorizes in their browser or the codes expire. The device flow does NOT require a client secret (only `client_id`), making it safe for desktop apps. Tokens are stored in the OS keychain via the `keyring` crate (v3.6, cross-platform: macOS Keychain, Windows Credential Manager, Linux Secret Service). GitHub OAuth app tokens do not expire and have no refresh mechanism -- GitHub App tokens do expire (8h) with refresh tokens (6mo), but that requires a client secret for non-device-flow refreshes. For a desktop app using device flow, OAuth Apps are the simpler, more appropriate choice.

The critical architectural question is how to bridge the gap between the JS extension system and Rust-side capabilities. Three patterns are available: (A) the extension's JS code calls existing core Tauri commands that happen to serve auth needs, (B) new Tauri commands are registered as core infrastructure that any auth extension can use, (C) the ExtensionAPI is extended with auth-specific primitives. This research recommends **Pattern B**: add a new `auth` module in `src-tauri/src/` with dedicated Tauri commands for the device flow, keychain operations, and GitHub remote detection. These are core commands (registered in `lib.rs` like all existing commands), but they are **consumed by** the GitHub extension's JS module. The extension JS code orchestrates the UX flow (showing device code blade, polling status, updating its Zustand store) while delegating security-sensitive operations (HTTP, keychain) to Rust.

**Primary recommendation:** Build GitHub auth as core Tauri commands in a new `src-tauri/src/auth/` module (keychain CRUD, device flow initiation/polling, remote detection), consumed by a GitHub extension JS module that registers blades/commands/toolbar via Phase 33's ExtensionAPI. Do NOT extend ExtensionAPI with auth primitives yet -- wait for a second auth provider to justify the abstraction.

## Standard Stack

### Core (Rust-side -- new dependency)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| keyring | 3.6 | Cross-platform OS keychain access (macOS/Windows/Linux) | The standard Rust crate for credential storage; 1M+ downloads; supports all target platforms |
| reqwest | 0.13 (existing) | HTTP client for GitHub API calls (device flow, rate limit) | Already in Cargo.toml; async with tokio; supports JSON |
| git2 | 0.20 (existing) | Parse git remotes to detect GitHub URLs | Already in Cargo.toml; used throughout the app |
| serde/serde_json | 1.x (existing) | Serialize/deserialize GitHub API responses | Already in Cargo.toml |
| tokio | 1.x (existing) | Async runtime for polling, timers | Already in Cargo.toml with "full" features |
| tauri-specta | 2.0.0-rc.21 (existing) | Type-safe IPC for new auth commands | Already in Cargo.toml |

### Core (Frontend-side -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5 (existing) | GitHub auth store (token status, user info, rate limits) | Already used for all stores; extension-owned store pattern |
| @tauri-apps/api | ^2 (existing) | invoke() for auth commands, listen() for events | Already used throughout |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| url (Rust) | 2.x | Parse git remote URLs to extract host/owner/repo | Only if git-url-parse is too heavy; basic URL parsing suffices |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| keyring 3.6 | tauri-plugin-stronghold | Stronghold is Tauri-native but stores in encrypted files, not OS keychain. Users expect OS keychain integration (system credential managers). keyring is the right choice. |
| Hand-rolled device flow with reqwest | oauth2 crate (v5) | oauth2 crate has DeviceAuthorizationRequest support but adds 15+ transitive dependencies. GitHub's device flow is only 2 endpoints with 3 error states -- reqwest is simpler and already a dependency. |
| OAuth App (no token expiry) | GitHub App (8h token expiry + refresh) | GitHub Apps need client_secret for refresh (except device flow initial auth). OAuth Apps have simpler token lifecycle. For a desktop app, OAuth App tokens that don't expire are appropriate. GitHub Apps are better for server-side apps. |
| Core Tauri commands for auth | ExtensionAPI.registerAuthProvider() | Premature abstraction. With only one auth provider (GitHub), building a generic auth registry adds complexity without value. Revisit when a second provider (GitLab, Bitbucket) is needed. |

**Installation (Rust):**
```toml
# Add to [dependencies] in Cargo.toml
keyring = { version = "3", features = ["apple-native", "windows-native", "sync-secret-service"] }
```

```bash
# No new npm packages needed
```

## Architecture Patterns

### Recommended Project Structure

```
src-tauri/src/
  auth/                          # NEW: Authentication infrastructure
    mod.rs                       # Module root
    error.rs                     # AuthError enum (IPC-serializable)
    keychain.rs                  # keyring CRUD commands (store/get/delete token)
    device_flow.rs               # GitHub device flow: initiate, poll, cancel
    github_remote.rs             # Parse git2 remotes -> detect github.com URLs
    rate_limit.rs                # GitHub API rate limit checking
    types.rs                     # Shared types: DeviceCodeResponse, GitHubUser, etc.
  lib.rs                         # MODIFIED: register auth commands, manage AuthState

src/
  extensions/                    # Phase 33 (existing)
    ExtensionAPI.ts              # NOT MODIFIED for Phase 34 (no auth primitives yet)
    ExtensionHost.ts             # NOT MODIFIED (discovery/lifecycle unchanged)

  # The GitHub extension JS entry point (bundled with app, not in .flowforge/extensions/)
  # This is a "built-in extension" -- shipped as part of the app, activated by ExtensionHost
  extensions/github/             # NEW: GitHub extension module (built-in, not user-installed)
    index.ts                     # onActivate/onDeactivate entry point
    store.ts                     # Extension-owned Zustand store: auth state, rate limits
    blades/
      GitHubAuthBlade.tsx        # Device code display + status UI
      GitHubAccountBlade.tsx     # Signed-in account info, scopes, rate limits
    commands.ts                  # Command registrations (sign-in, sign-out, etc.)
    toolbar.ts                   # Toolbar action registrations
    remoteDetection.ts           # Frontend logic: listen for repo-open, call detect command
```

### Pattern 1: Hybrid Extension Architecture (Core Commands + JS Extension)

**What:** The GitHub extension is a "hybrid" -- its UI and registration are handled by Phase 33's JS extension system, but its security-sensitive operations (keychain, HTTP) are core Tauri commands.

**When to use:** When an extension needs Rust-side capabilities that cannot run in the webview context.

**Architecture diagram:**
```
+-------------------+      IPC (invoke)      +------------------+
|  GitHub Extension  | -------- (1) -------> |  auth::keychain   |
|  (JavaScript)      | -------- (2) -------> |  auth::device_flow|
|                    | -------- (3) -------> |  auth::github_rem |
|  - Zustand store   | <------- (4) -------- |  auth::rate_limit |
|  - Blades (React)  |      events/results   |  (Rust commands)  |
|  - Commands        |                       |                   |
|  - Toolbar actions  |                      |  Managed State:   |
+-------------------+                       |  AuthState        |
        |                                    +------------------+
        | registers via ExtensionAPI                |
        v                                           v
+-------------------+                       +------------------+
| Phase 33 Registries|                      |  OS Keychain     |
| (blade, command,   |                      |  (keyring crate) |
|  toolbar)          |                      +------------------+
+-------------------+
```

**Key insight:** The JS extension calls `commands.githubDeviceFlowInitiate()` (typed via tauri-specta), NOT `fetch('https://github.com/...')` (blocked by CSP). All GitHub API calls happen in Rust. The JS layer handles only UX orchestration.

### Pattern 2: Built-in Extension (Shipped with App)

**What:** The GitHub extension is shipped as part of the FlowForge app source code, not as a user-installed extension in `.flowforge/extensions/`.

**When to use:** For first-party extensions that need to be available without user installation.

**How it works:**
```typescript
// In app initialization (e.g., App.tsx or a boot sequence)
// After ExtensionHost discovers user-installed extensions, also activate built-in ones.

import { useExtensionHost } from "./extensions";

// Option A: Register the built-in extension manifest programmatically
useExtensionHost.getState().registerBuiltIn({
  id: "github",
  name: "GitHub Integration",
  version: "1.0.0",
  apiVersion: "1",
  // Instead of a filesystem path, import directly
  activate: () => import("./extensions/github/index"),
});

// Option B: Simpler -- just call the extension's onActivate directly
// with a manually created ExtensionAPI instance.
import { ExtensionAPI } from "./extensions/ExtensionAPI";
import { onActivate } from "./extensions/github";

const githubApi = new ExtensionAPI("github");
await onActivate(githubApi);
```

**Recommendation:** Use Option B for Phase 34. The GitHub extension is tightly coupled to the app (it uses core Tauri commands). Treating it as a "discovered" extension from the filesystem adds unnecessary complexity. Instead, import and activate it directly during app initialization, passing it a standard ExtensionAPI instance so all registrations are properly namespaced and tracked.

**Why this is safe:** ExtensionAPI's cleanup() still works. The extension's blades/commands/toolbar actions are still namespaced with `ext:github:*`. Deactivation still removes everything cleanly.

### Pattern 3: Extension-Owned Zustand Store

**What:** Each extension creates and owns its own Zustand store, separate from core stores.

**When to use:** When an extension has state beyond what registries track (auth status, cached data, rate limits).

```typescript
// src/extensions/github/store.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface GitHubUser {
  login: string;
  avatarUrl: string;
  name: string | null;
}

interface GitHubRateLimits {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

interface GitHubAuthState {
  // Auth status
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  user: GitHubUser | null;
  scopes: string[];

  // Device flow state (transient, during sign-in only)
  deviceCode: string | null;
  userCode: string | null;
  verificationUri: string | null;
  expiresAt: number | null;
  pollInterval: number;

  // Rate limits
  rateLimits: GitHubRateLimits | null;

  // Remote detection
  detectedRemotes: Array<{ name: string; owner: string; repo: string }>;

  // Actions
  initiateDeviceFlow: (scopes: string[]) => Promise<void>;
  pollForAuthorization: () => Promise<void>;
  cancelDeviceFlow: () => void;
  signOut: () => Promise<void>;
  checkRateLimits: () => Promise<void>;
  detectRemotes: () => Promise<void>;
}

export const useGitHubStore = create<GitHubAuthState>()(
  devtools(
    (set, get) => ({
      // ... implementation
    }),
    { name: "github-auth", enabled: import.meta.env.DEV },
  ),
);
```

**Key design decisions:**
1. This store is NOT registered with `registerStoreForReset()`. Auth state persists across repo switches.
2. Rate limits and detected remotes ARE reset when the repo changes (handled by the extension listening to repo-change events).
3. Device flow transient state (device code, user code) is cleared after auth completes or is cancelled.

### Pattern 4: OAuth Device Flow State Machine

**What:** The device flow has well-defined states that map to a state machine.

**State transitions:**
```
idle -> requesting_codes -> awaiting_user_authorization -> polling -> authenticated
                                       |                     |
                                       v                     v
                                    expired              error/denied
                                       |                     |
                                       +------> idle <-------+
```

**Implementation approach:** Use the Zustand store's state fields as an implicit state machine (NOT XState -- the flow is simple enough that explicit FSM adds no value over state fields):
- `isAuthenticating: false, deviceCode: null` = idle
- `isAuthenticating: true, deviceCode: null` = requesting_codes
- `isAuthenticating: true, deviceCode: string` = awaiting_user_authorization / polling
- `isAuthenticated: true` = authenticated

### Pattern 5: Tauri Managed State for Auth

**What:** A Rust-side `AuthState` struct managed by Tauri, analogous to `RepositoryState`.

**When to use:** To store the active poll cancellation token and cached token status on the Rust side.

```rust
// src-tauri/src/auth/mod.rs
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AuthState {
    /// Cancellation flag for device flow polling
    poll_cancel: Arc<Mutex<bool>>,
}

impl AuthState {
    pub fn new() -> Self {
        Self {
            poll_cancel: Arc::new(Mutex::new(false)),
        }
    }
}
```

Registered in `lib.rs`:
```rust
.manage(AuthState::new())
```

### Pattern 6: GitHub Remote Detection via git2

**What:** Parse git remotes to identify GitHub repositories and associate them with authenticated accounts.

**When to use:** On repository open and when remotes change.

```rust
// Regex-free URL parsing for GitHub remotes
fn parse_github_remote(url: &str) -> Option<(String, String)> {
    // HTTPS: https://github.com/owner/repo.git
    // SSH: git@github.com:owner/repo.git
    // SSH: ssh://git@github.com/owner/repo.git

    let url_lower = url.to_lowercase();

    if url_lower.contains("github.com") {
        // Strip protocol and github.com prefix
        let path = if let Some(rest) = url.strip_prefix("https://github.com/")
            .or_else(|| url.strip_prefix("http://github.com/"))
            .or_else(|| url.strip_prefix("ssh://git@github.com/"))
        {
            rest.to_string()
        } else if let Some(rest) = url.strip_prefix("git@github.com:") {
            rest.to_string()
        } else {
            return None;
        };

        // Strip .git suffix and split owner/repo
        let clean = path.trim_end_matches(".git").trim_end_matches('/');
        let parts: Vec<&str> = clean.splitn(2, '/').collect();
        if parts.len() == 2 {
            return Some((parts[0].to_string(), parts[1].to_string()));
        }
    }
    None
}
```

### Anti-Patterns to Avoid

- **Making GitHub API calls from frontend JavaScript:** CSP blocks `connect-src` to only `ipc:` and `http://ipc.localhost`. All HTTP calls to `github.com` MUST go through Rust Tauri commands. This is a security feature, not a limitation.

- **Storing tokens in Tauri's plugin-store:** The plugin-store writes to a JSON file on disk (plaintext). Tokens MUST go through keyring to the OS keychain. Never write tokens to any file.

- **Adding auth primitives to ExtensionAPI prematurely:** With only one auth provider, `registerAuthProvider()` is speculative abstraction. Build the concrete GitHub implementation first. When a second provider arrives, extract the pattern.

- **Using the oauth2 crate for GitHub's simple device flow:** The oauth2 crate adds ~15 transitive dependencies for a protocol that is literally 2 HTTP endpoints and 3 error codes. Use reqwest directly.

- **Polling from the frontend:** The polling loop for device flow authorization should run in Rust (tokio timer + reqwest), NOT in JavaScript (setInterval + invoke). Rust-side polling avoids IPC overhead per poll iteration and allows clean cancellation via a shared atomic flag.

- **Treating the GitHub extension as a filesystem-discovered extension:** Built-in extensions should be imported directly, not placed in `.flowforge/extensions/` and "discovered" by the Rust scanner. This avoids filesystem-dependent test setups and build pipeline complexity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS keychain access | Custom file encryption, SQLite with encryption | keyring crate v3.6 | Cross-platform keychain access is deceptively complex (5 different APIs across 3 OSes). keyring handles macOS Keychain, Windows Credential Manager, Linux Secret Service. |
| Git URL parsing for GitHub detection | Custom regex parsing | Simple string operations (see Pattern 6) | Git remote URLs have limited formats (HTTPS, SSH, git@ prefix). A regex would be overkill; string splitting is clearer and testable. Don't add git-url-parse crate for one use case. |
| OAuth token storage format | Custom serialization | JSON string in single keychain entry | Store `{ access_token, scopes, created_at }` as a JSON string in one keychain entry. Don't create multiple keychain entries per field. |
| GitHub API client | Custom HTTP wrapper | reqwest with typed response structs | reqwest already handles JSON, async, TLS. Just define serde structs for GitHub API responses. |
| Token refresh | Complex refresh token rotation | No refresh needed (OAuth App tokens don't expire) | GitHub OAuth App tokens are long-lived. No refresh mechanism exists or is needed. If switching to GitHub Apps later, that's a Phase 36+ concern. |

**Key insight:** The entire auth flow is 2 HTTP endpoints, 1 keychain entry, and 1 git remote parser. The complexity is in the UX orchestration (showing device code, polling status, scope selection), not in the protocol implementation.

## Common Pitfalls

### Pitfall 1: Device Flow Polling Rate Limiting
**What goes wrong:** GitHub returns `slow_down` error because polling is too fast, adding 5 seconds to the required interval each time.
**Why it happens:** The polling interval from the initial response (typically 5 seconds) is treated as exact rather than minimum. Network latency or processing time eats into the interval.
**How to avoid:** Use `tokio::time::interval()` with the GitHub-specified interval PLUS a 1-second buffer. On `slow_down` error, increase interval by 5 seconds as specified. Never reset the interval back down.
**Warning signs:** `slow_down` errors in logs; GitHub returning HTTP 429.

### Pitfall 2: Keychain Entry Naming Collision
**What goes wrong:** Multiple FlowForge installations (or other apps) overwrite each other's keychain entries because they use the same service/user names.
**Why it happens:** The keyring crate identifies entries by `(service, user)` pair.
**How to avoid:** Use a specific, unique service name: `"com.flowforge.desktop"` (matching the Tauri identifier). Use the GitHub username as the user field: `Entry::new("com.flowforge.desktop.github", &github_username)`.
**Warning signs:** Token disappearing after another app runs; wrong token retrieved.

### Pitfall 3: CSP Blocking GitHub API Calls from Frontend
**What goes wrong:** `fetch("https://api.github.com/...")` fails silently or with CSP violation.
**Why it happens:** The CSP `connect-src` is restricted to `ipc: http://ipc.localhost` (Phase 31 security hardening). This is intentional.
**How to avoid:** ALL GitHub API calls MUST go through Tauri commands (Rust reqwest). The frontend invokes typed commands, never makes direct HTTP calls.
**Warning signs:** Network errors in DevTools console; CSP violation reports.

### Pitfall 4: Keyring Crate Thread Safety on Windows
**What goes wrong:** Concurrent keychain access from multiple Tauri command invocations causes intermittent failures.
**Why it happens:** The keyring crate docs warn that "Multi-threaded access to the same credential can fail, especially on Windows and Linux."
**How to avoid:** Wrap keychain operations in a Mutex-protected Tauri managed state, or ensure all keychain operations are serialized through a single async task. Since keychain ops are fast and infrequent, a simple `Mutex<()>` guard suffices.
**Warning signs:** Intermittent "credential not found" errors on Windows; race conditions during sign-in/sign-out.

### Pitfall 5: Device Code Expiration Without UX Feedback
**What goes wrong:** User leaves the device code screen open, codes expire after 15 minutes, and subsequent authorization attempts fail silently.
**Why it happens:** The `expires_in` field from GitHub (default 900s / 15 min) is ignored.
**How to avoid:** Track `expiresAt` in the store. Show a countdown timer in the device code blade. When expired, automatically transition to an "expired" state with a "Try Again" button. The Rust polling loop should also stop on expiration (GitHub returns `expired_token` error).
**Warning signs:** User reports "nothing happens" after waiting too long.

### Pitfall 6: Extension Store Not Resetting Remote Detection on Repo Switch
**What goes wrong:** After switching repositories, the previously detected GitHub remotes still show.
**Why it happens:** The GitHub extension's store is NOT registered with `resetAllStores()` (by design -- auth state should persist). But remote detection data IS repo-specific.
**How to avoid:** The extension should listen for the `repository-changed` Tauri event and clear `detectedRemotes` while re-running detection for the new repo. Auth state (`isAuthenticated`, `user`, `scopes`) should NOT be cleared.
**Warning signs:** Wrong GitHub remote association displayed after repo switch.

### Pitfall 7: Scope Selection UX Confusion
**What goes wrong:** Users select scopes but don't understand what they mean, or the scope selection happens AFTER the device code is generated (too late).
**Why it happens:** Scopes must be specified in the initial `/login/device/code` request. They cannot be changed after the device code is generated.
**How to avoid:** Show a scope selection UI BEFORE initiating the device flow. Provide clear descriptions for each scope. Default to minimal scopes (`repo`, `read:user`) with opt-in for broader scopes.
**Warning signs:** Users complaining about permission requests; needing to re-authenticate to add scopes.

## Code Examples

### Keychain CRUD Operations (Rust)

```rust
// src-tauri/src/auth/keychain.rs
use keyring::Entry;
use serde::{Deserialize, Serialize};
use specta::Type;

use super::error::AuthError;

const SERVICE_NAME: &str = "com.flowforge.desktop.github";

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StoredToken {
    pub access_token: String,
    pub scopes: Vec<String>,
    pub created_at: i64,  // Unix timestamp
}

#[tauri::command]
#[specta::specta]
pub async fn store_github_token(
    username: String,
    token_data: StoredToken,
) -> Result<(), AuthError> {
    let json = serde_json::to_string(&token_data)
        .map_err(|e| AuthError::Internal(format!("Failed to serialize token: {}", e)))?;

    // keyring operations are blocking -- run on blocking thread
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(SERVICE_NAME, &username)
            .map_err(|e| AuthError::KeychainError(format!("Failed to create entry: {}", e)))?;
        entry
            .set_password(&json)
            .map_err(|e| AuthError::KeychainError(format!("Failed to store token: {}", e)))?;
        Ok(())
    })
    .await
    .map_err(|e| AuthError::Internal(format!("Task join error: {}", e)))?
}

#[tauri::command]
#[specta::specta]
pub async fn get_github_token(username: String) -> Result<Option<StoredToken>, AuthError> {
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(SERVICE_NAME, &username)
            .map_err(|e| AuthError::KeychainError(format!("Failed to create entry: {}", e)))?;
        match entry.get_password() {
            Ok(json) => {
                let token: StoredToken = serde_json::from_str(&json)
                    .map_err(|e| AuthError::Internal(format!("Failed to parse token: {}", e)))?;
                Ok(Some(token))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(AuthError::KeychainError(format!(
                "Failed to retrieve token: {}",
                e
            ))),
        }
    })
    .await
    .map_err(|e| AuthError::Internal(format!("Task join error: {}", e)))?
}

#[tauri::command]
#[specta::specta]
pub async fn delete_github_token(username: String) -> Result<(), AuthError> {
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(SERVICE_NAME, &username)
            .map_err(|e| AuthError::KeychainError(format!("Failed to create entry: {}", e)))?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
            Err(e) => Err(AuthError::KeychainError(format!(
                "Failed to delete token: {}",
                e
            ))),
        }
    })
    .await
    .map_err(|e| AuthError::Internal(format!("Task join error: {}", e)))?
}
```

### Device Flow Initiation (Rust)

```rust
// src-tauri/src/auth/device_flow.rs
use reqwest::Client;
use serde::{Deserialize, Serialize};
use specta::Type;

use super::error::AuthError;

const GITHUB_DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[tauri::command]
#[specta::specta]
pub async fn github_device_flow_initiate(
    client_id: String,
    scopes: Vec<String>,
) -> Result<DeviceCodeResponse, AuthError> {
    let client = Client::new();
    let scope_str = scopes.join(" ");

    let response = client
        .post(GITHUB_DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .form(&[("client_id", &client_id), ("scope", &scope_str)])
        .send()
        .await
        .map_err(|e| AuthError::NetworkError(format!("Failed to request device code: {}", e)))?;

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(AuthError::GitHubApiError(format!(
            "Device code request failed: {}",
            body
        )));
    }

    let device_response: DeviceCodeResponse = response
        .json()
        .await
        .map_err(|e| AuthError::Internal(format!("Failed to parse device code response: {}", e)))?;

    Ok(device_response)
}
```

### Device Flow Polling (Rust)

```rust
// src-tauri/src/auth/device_flow.rs (continued)
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, sleep};
use tauri::State;

use super::AuthState;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AccessTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub scope: String,
}

#[derive(Debug, Deserialize)]
struct TokenPollResponse {
    access_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    error: Option<String>,
    interval: Option<u64>,
}

#[tauri::command]
#[specta::specta]
pub async fn github_device_flow_poll(
    client_id: String,
    device_code: String,
    initial_interval: u64,
    state: State<'_, AuthState>,
) -> Result<AccessTokenResponse, AuthError> {
    let client = Client::new();
    let mut interval_secs = initial_interval.max(5); // Minimum 5 seconds
    let cancel = state.poll_cancel.clone();

    // Reset cancellation flag
    *cancel.lock().await = false;

    loop {
        // Check for cancellation
        if *cancel.lock().await {
            return Err(AuthError::Cancelled);
        }

        // Wait for the interval
        sleep(Duration::from_secs(interval_secs + 1)).await; // +1s buffer

        // Check for cancellation again after sleep
        if *cancel.lock().await {
            return Err(AuthError::Cancelled);
        }

        let response = client
            .post(GITHUB_ACCESS_TOKEN_URL)
            .header("Accept", "application/json")
            .form(&[
                ("client_id", &client_id),
                ("device_code", &device_code),
                ("grant_type", &"urn:ietf:params:oauth:grant-type:device_code".to_string()),
            ])
            .send()
            .await
            .map_err(|e| AuthError::NetworkError(format!("Token poll failed: {}", e)))?;

        let poll: TokenPollResponse = response
            .json()
            .await
            .map_err(|e| AuthError::Internal(format!("Failed to parse poll response: {}", e)))?;

        match poll.error.as_deref() {
            Some("authorization_pending") => continue,
            Some("slow_down") => {
                // GitHub says: add 5 seconds to interval
                interval_secs += 5;
                continue;
            }
            Some("expired_token") => {
                return Err(AuthError::DeviceCodeExpired);
            }
            Some("access_denied") => {
                return Err(AuthError::AccessDenied);
            }
            Some(other) => {
                return Err(AuthError::GitHubApiError(format!(
                    "Unexpected error during polling: {}",
                    other
                )));
            }
            None => {
                // Success! We have a token
                if let (Some(token), Some(token_type), Some(scope)) =
                    (poll.access_token, poll.token_type, poll.scope)
                {
                    return Ok(AccessTokenResponse {
                        access_token: token,
                        token_type,
                        scope,
                    });
                }
                return Err(AuthError::Internal(
                    "Token response missing required fields".to_string(),
                ));
            }
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn github_device_flow_cancel(state: State<'_, AuthState>) -> Result<(), AuthError> {
    *state.poll_cancel.lock().await = true;
    Ok(())
}
```

### AuthError Type (Rust)

```rust
// src-tauri/src/auth/error.rs
use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

#[derive(Debug, Error, Serialize, Deserialize, Type, Clone)]
#[serde(tag = "type", content = "message")]
pub enum AuthError {
    #[error("Keychain error: {0}")]
    KeychainError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("GitHub API error: {0}")]
    GitHubApiError(String),

    #[error("Device code expired")]
    DeviceCodeExpired,

    #[error("Access denied by user")]
    AccessDenied,

    #[error("Operation cancelled")]
    Cancelled,

    #[error("Internal error: {0}")]
    Internal(String),
}
```

### GitHub Remote Detection (Rust)

```rust
// src-tauri/src/auth/github_remote.rs
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::git::RepositoryState;
use super::error::AuthError;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRemote {
    pub remote_name: String,
    pub owner: String,
    pub repo: String,
    pub url: String,
}

fn parse_github_url(url: &str) -> Option<(String, String)> {
    // Handle: https://github.com/owner/repo.git
    //         git@github.com:owner/repo.git
    //         ssh://git@github.com/owner/repo.git
    let normalized = url.to_lowercase();
    if !normalized.contains("github.com") {
        return None;
    }

    let path = url
        .strip_prefix("https://github.com/")
        .or_else(|| url.strip_prefix("http://github.com/"))
        .or_else(|| url.strip_prefix("ssh://git@github.com/"))
        .or_else(|| url.strip_prefix("git@github.com:"))?;

    let clean = path.trim_end_matches(".git").trim_end_matches('/');
    let mut parts = clean.splitn(2, '/');
    let owner = parts.next()?;
    let repo = parts.next()?;

    if owner.is_empty() || repo.is_empty() {
        return None;
    }

    Some((owner.to_string(), repo.to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn detect_github_remotes(
    state: State<'_, RepositoryState>,
) -> Result<Vec<GitHubRemote>, AuthError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| AuthError::Internal("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)
            .map_err(|e| AuthError::Internal(format!("Failed to open repo: {}", e)))?;

        let remotes = repo
            .remotes()
            .map_err(|e| AuthError::Internal(format!("Failed to list remotes: {}", e)))?;

        let mut github_remotes = Vec::new();

        for name in remotes.iter().flatten() {
            if let Ok(remote) = repo.find_remote(name) {
                if let Some(url) = remote.url() {
                    if let Some((owner, repo_name)) = parse_github_url(url) {
                        github_remotes.push(GitHubRemote {
                            remote_name: name.to_string(),
                            owner,
                            repo: repo_name,
                            url: url.to_string(),
                        });
                    }
                }
            }
        }

        Ok(github_remotes)
    })
    .await
    .map_err(|e| AuthError::Internal(format!("Task join error: {}", e)))?
}
```

### Rate Limit Checking (Rust)

```rust
// src-tauri/src/auth/rate_limit.rs
use reqwest::Client;
use serde::{Deserialize, Serialize};
use specta::Type;

use super::error::AuthError;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitInfo {
    pub limit: u32,
    pub remaining: u32,
    pub reset: u64,  // Unix timestamp
    pub used: u32,
}

#[derive(Deserialize)]
struct RateLimitResponse {
    resources: RateLimitResources,
}

#[derive(Deserialize)]
struct RateLimitResources {
    core: RateLimitData,
}

#[derive(Deserialize)]
struct RateLimitData {
    limit: u32,
    remaining: u32,
    reset: u64,
    used: u32,
}

#[tauri::command]
#[specta::specta]
pub async fn check_github_rate_limit(
    access_token: String,
) -> Result<RateLimitInfo, AuthError> {
    let client = Client::new();

    let response = client
        .get("https://api.github.com/rate_limit")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "FlowForge-Desktop")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| AuthError::NetworkError(format!("Rate limit check failed: {}", e)))?;

    if !response.status().is_success() {
        return Err(AuthError::GitHubApiError(format!(
            "Rate limit API returned {}",
            response.status()
        )));
    }

    let data: RateLimitResponse = response
        .json()
        .await
        .map_err(|e| AuthError::Internal(format!("Failed to parse rate limit: {}", e)))?;

    Ok(RateLimitInfo {
        limit: data.resources.core.limit,
        remaining: data.resources.core.remaining,
        reset: data.resources.core.reset,
        used: data.resources.core.used,
    })
}
```

### GitHub Extension Entry Point (TypeScript)

```typescript
// src/extensions/github/index.ts
import type { ExtensionAPI } from "../ExtensionAPI";
import { useGitHubStore } from "./store";
import { GitHubAuthBlade } from "./blades/GitHubAuthBlade";
import { GitHubAccountBlade } from "./blades/GitHubAccountBlade";
import { Github } from "lucide-react";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Register blades
  api.registerBlade({
    type: "auth",
    title: "GitHub Sign In",
    component: GitHubAuthBlade,
    singleton: true,
  });

  api.registerBlade({
    type: "account",
    title: "GitHub Account",
    component: GitHubAccountBlade,
    singleton: true,
  });

  // Register commands
  api.registerCommand({
    id: "sign-in",
    title: "Sign in to GitHub",
    category: "GitHub",
    action: () => {
      // Open the auth blade
      // Use navigation to push ext:github:auth blade
    },
    enabled: () => !useGitHubStore.getState().isAuthenticated,
  });

  api.registerCommand({
    id: "sign-out",
    title: "Sign out of GitHub",
    category: "GitHub",
    action: () => useGitHubStore.getState().signOut(),
    enabled: () => useGitHubStore.getState().isAuthenticated,
  });

  // Register toolbar action
  api.contributeToolbar({
    id: "github-status",
    label: "GitHub",
    icon: Github,
    group: "views",
    priority: 15,
    execute: () => {
      // Toggle GitHub account blade
    },
    when: () => true,
  });

  // Initialize: check for existing token in keychain
  await useGitHubStore.getState().initialize();
}

export function onDeactivate(): void {
  // Clear transient state (not auth -- that persists in keychain)
  useGitHubStore.setState({
    deviceCode: null,
    userCode: null,
    verificationUri: null,
    detectedRemotes: [],
  });
}
```

## Extensibility Refactoring Analysis

### What Core Infrastructure Needs for Phase 34

| Area | Change Needed? | Description |
|------|---------------|-------------|
| ExtensionAPI auth primitives | NO (Phase 34) | Don't add `registerAuthProvider()` or `getToken()` yet. Only one auth provider exists. Premature abstraction. |
| Core "auth provider" registry | NO (Phase 34) | No registry needed with one provider. The GitHub store IS the auth state. Revisit in Phase 36+ if GitLab/Bitbucket are added. |
| Extension-owned Rust commands | ARCHITECTURAL DECISION | See analysis below. |
| Extension state management | PATTERN ONLY | Extension-owned Zustand stores are a convention, not infrastructure. Document the pattern; no new code in core. |
| ExtensionHost built-in support | SMALL CHANGE | Add ability to register built-in extensions that are imported directly (not filesystem-discovered). |

### The "Extension-Owned Rust Commands" Question

The central architectural tension: GitHub auth needs Rust commands (keychain, HTTP), but the Phase 33 extension system is JS-only. Three options:

**Option A: Auth commands are core commands (RECOMMENDED)**
```
lib.rs: .commands(collect_commands![..., store_github_token, github_device_flow_initiate, ...])
```
- Auth commands live in `src-tauri/src/auth/` as core infrastructure
- The GitHub extension's JS code calls them via typed bindings (just like `commands.openRepository()`)
- No change to ExtensionAPI or ExtensionHost
- Pro: Simplest. Follows existing patterns. Type-safe via tauri-specta.
- Con: "GitHub" specifics in core code. But they are infrastructure-level (keychain, HTTP proxy) not business logic.

**Option B: Plugin-based Rust extensions (OVER-ENGINEERED)**
```
// Tauri plugin for each extension that needs Rust
tauri_plugin_github_auth::init()
```
- Each hybrid extension becomes a Tauri plugin
- Adds massive complexity (plugin lifecycle, IPC registration, NPM companion package)
- Pro: Clean separation. Follows Tauri's intended pattern.
- Con: Way too much machinery for one extension. Tauri plugins are designed for reusable cross-app modules, not app-specific features.

**Option C: ExtensionAPI.invokeRust() bridge (COMPLEX)**
```typescript
api.invokeRust("github_store_token", { username, token_data });
```
- ExtensionAPI gets a method to invoke extension-specific Rust commands
- Requires a command routing layer on the Rust side
- Pro: Extensions can declare Rust capabilities in manifest.
- Con: Reinvents Tauri's IPC. No type safety. Significant new infrastructure.

**Decision: Option A.** The auth commands are core commands. They happen to be consumed primarily by the GitHub extension, but keychain access and HTTP proxying are legitimate core infrastructure that any future extension could use. The `auth/` module in Rust is part of the core app, just like `git/` and `gitflow/`.

### What to Defer to Phase 36+

When a second auth provider (GitLab, Bitbucket) is needed:
1. Extract `AuthProvider` interface: `{ id, name, initiateAuth(), getToken(), signOut() }`
2. Create `AuthProviderRegistry` in core (like BladeRegistry)
3. Add `ExtensionAPI.registerAuthProvider()` method
4. Refactor GitHub auth to register as a provider through this API
5. Add `ExtensionAPI.getAuthToken(providerId)` for cross-extension auth sharing

This refactoring is straightforward once the concrete GitHub implementation exists.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Web flow OAuth (redirect-based) | Device Flow OAuth (code-based) | GitHub 2020 | No redirect URI needed; safe for desktop apps; no client secret required |
| Storing tokens in config files | OS keychain via keyring crate | keyring v3 (2024) | Tokens never in plaintext; leverages OS-level encryption |
| oauth2 crate for all OAuth | reqwest-direct for simple flows | N/A (architectural choice) | Avoid 15+ transitive deps for 2-endpoint protocol |
| All extensions pure JS | Hybrid extensions (JS UI + Rust commands) | Phase 34 (new pattern) | Enables security-sensitive operations in extensions without exposing Rust APIs to extension JS |

**Deprecated/outdated:**
- GitHub API `rate` object (use `resources.core` instead)
- Token storage in application config files (security anti-pattern)

## Open Questions

1. **OAuth App Client ID Distribution**
   - What we know: The device flow needs a `client_id` from a registered GitHub OAuth App. This ID is public (safe to embed in code).
   - What's unclear: Should the client_id be hardcoded in the Rust source, in a config file, or in the extension manifest?
   - Recommendation: Hardcode as a const in `src-tauri/src/auth/device_flow.rs`. It's a public identifier (not a secret). One less config surface to manage.

2. **Built-in Extension Registration Mechanism**
   - What we know: The GitHub extension should use ExtensionAPI for registration tracking but should NOT be filesystem-discovered.
   - What's unclear: The exact mechanism to integrate built-in extensions with ExtensionHost.
   - Recommendation: Add a `registerBuiltIn()` method to ExtensionHost that takes a manifest object and an `activate` function. This keeps the extension visible in the extension list (future settings blade) while avoiding filesystem discovery.

3. **Multiple GitHub Accounts**
   - What we know: Phase 34 requirements mention "the authenticated account" (singular).
   - What's unclear: Should the keychain/store support multiple GitHub accounts?
   - Recommendation: Design the keychain storage to support multiple accounts (keyed by username), but the UI in Phase 34 shows only one active account. Multi-account switching is Phase 36+.

4. **Rate Limit Warning Threshold**
   - What we know: GH-11 requires a warning toast when "approaching the limit."
   - What's unclear: What threshold triggers the warning?
   - Recommendation: Warn at 20% remaining (e.g., 1000 of 5000). Make the threshold configurable in the extension store (not user-facing settings yet).

5. **Token Persistence Across Sessions**
   - What we know: Tokens go to OS keychain (persists across app restarts). But the extension needs to know the username to look up the token.
   - What's unclear: Where to store the "last authenticated username" so the extension can bootstrap on app start.
   - Recommendation: Use `tauri-plugin-store` to persist just the GitHub username (not the token). On app start, the extension reads the username from the store, then retrieves the token from keychain.

## Sources

### Primary (HIGH confidence)
- [GitHub OAuth Device Flow Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) -- Complete device flow endpoints, parameters, error codes, polling mechanism
- [GitHub OAuth Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) -- Available scopes for OAuth apps
- [GitHub Rate Limit API](https://docs.github.com/en/rest/rate-limit/rate-limit) -- Rate limit checking endpoint, response format
- [GitHub Token Refresh](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens) -- Refresh token flow (GitHub Apps only, not OAuth Apps)
- [keyring crate docs.rs](https://docs.rs/keyring/latest/keyring/) -- Entry API, platform feature flags, error types
- [keyring crate Cargo.toml](https://docs.rs/crate/keyring/latest/source/Cargo.toml) -- Feature flags: apple-native, windows-native, sync-secret-service
- [keyring-rs GitHub](https://github.com/hwchen/keyring-rs) -- Cross-platform library for credential management
- FlowForge codebase: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/src/git/remote.rs`, `src-tauri/src/git/repository.rs`, `src-tauri/src/git/error.rs`, `src-tauri/src/git/watcher.rs`
- FlowForge codebase: `src/extensions/ExtensionHost.ts`, `src/extensions/ExtensionAPI.ts`, `src/extensions/extensionTypes.ts`
- FlowForge codebase: `src/lib/bladeRegistry.ts`, `src/lib/commandRegistry.ts`, `src/lib/toolbarRegistry.ts`
- FlowForge codebase: `src/stores/domain/git-ops/`, `src/stores/registry.ts`, `src/stores/toast.ts`
- FlowForge Phase 33 Research: `.planning/phases/33-extension-system-foundation/33-RESEARCH.md`

### Secondary (MEDIUM confidence)
- [Tauri v2 State Management](https://v2.tauri.app/develop/state-management/) -- Managed state patterns, interior mutability
- [Tauri v2 Calling Frontend from Rust](https://v2.tauri.app/develop/calling-frontend/) -- Event emission from Rust to JS
- [Tauri v2 Architecture](https://v2.tauri.app/concept/architecture/) -- IPC boundaries, security model
- [oauth2-rs crate](https://docs.rs/oauth2/latest/oauth2/) -- Evaluated and rejected; device flow support exists but adds unnecessary complexity
- [git2 Remote struct](https://docs.rs/git2/latest/git2/struct.Remote.html) -- Remote URL access API

### Tertiary (LOW confidence)
- [oauth2-rs Microsoft Device Flow example](https://github.com/ramosbugs/oauth2-rs/blob/main/examples/microsoft_devicecode.rs) -- Reference pattern for device flow in Rust (Microsoft, not GitHub)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- keyring crate is the de facto standard for Rust keychain access; reqwest already in use; all GitHub API endpoints verified against official docs
- Architecture (hybrid extension): HIGH -- The hybrid pattern (core Rust commands + JS extension UI) follows existing codebase conventions exactly; no new architectural concepts
- Architecture (device flow): HIGH -- GitHub's device flow docs are comprehensive; the protocol is simple (2 endpoints, 6 error states); polling is standard tokio pattern
- Architecture (keychain): HIGH -- keyring crate API verified via docs.rs; feature flags confirmed; thread safety caveats documented
- Architecture (extension refactoring): MEDIUM -- The decision to NOT add auth primitives to ExtensionAPI is a judgment call. Correct for Phase 34, but the boundary may shift when more providers are added.
- Pitfalls: HIGH -- CSP restrictions verified against actual tauri.conf.json; keyring threading caveats from official docs; GitHub rate limiting documented in API docs
- Remote detection: HIGH -- git2 API for remotes already used in codebase (get_remotes command); URL parsing is straightforward string manipulation

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (GitHub API is stable; keyring crate v3.x is stable; Tauri v2 architecture is stable)
