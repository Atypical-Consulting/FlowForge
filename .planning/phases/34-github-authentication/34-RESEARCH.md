# Phase 34: GitHub Authentication - Research Synthesis

**Researched:** 2026-02-10
**Sources:** 3 parallel researcher agents (UX, Architecture, Developer)

## Detailed Research Files

- `34-RESEARCH-UX.md` — OAuth Device Flow UX patterns, scope selection, rate limit display, auth status, extension-contributed UI
- `34-RESEARCH-ARCHITECTURE.md` — Hybrid extension architecture, Tauri command layer, keychain integration, state management
- `34-RESEARCH-DEVELOPER.md` — Exact APIs, crate patterns, serde types, Tauri commands, React/Zustand patterns, code examples

## Key Decisions (Consensus Across All 3 Researchers)

### 1. Hybrid Extension Pattern
The GitHub extension is a **hybrid extension**: JS UI (blades, commands, toolbar) registered through Phase 33's ExtensionAPI + Rust backend commands (keychain, HTTP, git remote detection) as core Tauri commands.
- **Rust side:** New `src-tauri/src/github/` module with Tauri commands (peer of `git/`, `gitflow/`)
- **JS side:** Extension entry point in `src/extensions/github/` using `api.registerBlade()`, `api.registerCommand()`, `api.contributeToolbar()`
- **Decision:** Auth commands are CORE Tauri commands consumed by the extension's JS module. NOT ExtensionAPI auth primitives (premature abstraction with one provider).

### 2. OAuth Device Flow (Not Auth Code Flow)
- GitHub's Device Flow (RFC 8628) — no redirect URI needed, no client secret needed
- Two endpoints: POST `/login/device/code` (get codes), POST `/login/oauth/access_token` (poll for token)
- User code is 8 chars with hyphen (e.g., "WDJB-MJHT"), expires in 15 minutes
- Use **OAuth App** (not GitHub App) — tokens don't expire, simpler lifecycle
- Client ID is public, safe to hardcode as const in Rust

### 3. OS Keychain via keyring Crate
- `keyring` v3.6 with explicit platform features: `apple-native`, `windows-native`, `linux-native-sync-persistent`
- **CRITICAL:** v3 has NO default features — must specify platform backends or get mock store only
- Service name: `com.flowforge.desktop`, account key: `github-oauth-token`
- Tokens NEVER leave Rust — frontend gets auth status, never the token itself

### 4. Extension-Contributed UI
- Sign-in flow as singleton blade: `ext:github:sign-in` (multi-step wizard: scope selection → device code → polling → success)
- Account management blade: `ext:github:account` (user info, scopes, rate limits, sign out)
- Toolbar action: `ext:github:github-status` in "app" group with auth status indicator
- Commands: "Sign in to GitHub", "Sign out of GitHub" in "GitHub" command palette category
- All registered via ExtensionAPI with automatic `ext:github:*` namespacing

### 5. Rate Limit Display Strategy
- Three tiers: toolbar badge (persistent, visible count), toast warnings (when < 20% remaining, debounced 5min), account blade (detailed breakdown with progress bars)
- Track core, search, and graphql rate limits separately
- Extract from response headers on every GitHub API call

### 6. GitHub Remote Auto-Detection
- Parse git2 remotes for github.com URLs (HTTPS and SSH formats)
- Auto-link to signed-in account when repo has GitHub remote
- Single account support for v1.5 (multi-account is v2.0)

### 7. State Management
- Extension-owned Zustand store (`useGitHubAuthStore`) — NOT registered for repo-switch reset (auth is global)
- Username persisted in tauri-plugin-store for bootstrap on app restart (token stays in keychain)
- Auth state: `isAuthenticated`, `username`, `avatarUrl`, `scopes`, `rateLimit`, `isAuthenticating`, `deviceCode` states

### 8. Scope Selection UX
- Profile-based: "Read Only" (recommended), "Full Access", "Custom"
- Profiles map to GitHub scope combinations (repo:status vs repo vs full scope set)
- Advanced toggle reveals individual scope checkboxes for custom selection

## New Dependencies

| Dependency | Type | Version | Purpose |
|-----------|------|---------|---------|
| keyring | Rust crate | 3.6 | OS keychain (macOS/Windows/Linux) |
| (reqwest) | Rust (existing) | 0.13 | GitHub API HTTP calls |
| (git2) | Rust (existing) | 0.20 | Remote URL parsing |

No new frontend dependencies needed.

## Rust Module Structure

```
src-tauri/src/github/
  mod.rs           # Module root + re-exports
  auth.rs          # OAuth Device Flow commands (start, poll, cancel)
  token.rs         # Keychain CRUD (store/get/delete via keyring)
  types.rs         # Serde types for GitHub API responses
  error.rs         # GitHubError enum (IPC-serializable)
  remote.rs        # GitHub remote URL detection/parsing
  rate_limit.rs    # Rate limit checking + header extraction
```

## Extension Structure

```
src/extensions/github/
  index.ts                   # onActivate/onDeactivate entry point
  store.ts                   # useGitHubAuthStore (Zustand)
  blades/
    GitHubAuthBlade.tsx      # Sign-in wizard (scope selection, device code, polling)
    GitHubAccountBlade.tsx   # Account info, rate limits, sign out
  components/
    DeviceCodeDisplay.tsx    # Large code display with copy button
    ScopeSelector.tsx        # Profile cards + custom scope checkboxes
    RateLimitBar.tsx         # Progress bar for rate limit display
    AuthPollingState.tsx     # Spinner + countdown while waiting for browser auth
```

## Open Questions (Need Resolution During Planning)

1. **Custom toolbar widget rendering** — Should ToolbarAction get a `renderCustom` property for extension widgets, or hardcode another special ID check (like `tb:theme-toggle`)?
2. **Built-in extension registration** — ExtensionHost needs a `registerBuiltIn()` method for first-party extensions (avoids filesystem discovery for bundled extensions)
3. **Extension build pipeline** — How does the GitHub extension get built and placed in the discovery path?
4. **keyring on Linux CI** — Need mock credential store for tests in headless environments

## Extensibility Refactoring Notes

Per user request, focus on refactoring for extensibility:
- **ToolbarAction.renderCustom** — Generalize the `tb:theme-toggle` special-case pattern into a first-class API
- **ExtensionHost.registerBuiltIn()** — Support bundled first-party extensions without filesystem discovery
- **BladeRegistry already extensible** — Phase 33 supports dynamic `ext:*` blade types
- **CommandRegistry already extensible** — Phase 33 supports dynamic extension command categories
- **Do NOT add auth provider registry** — Wait for second provider; premature abstraction
- **Do NOT extend ExtensionAPI with auth primitives** — GitHub extension calls core Tauri commands directly
