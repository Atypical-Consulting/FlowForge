---
phase: 34-github-authentication
plan: 01
subsystem: auth
tags: [github, oauth, device-flow, keyring, keychain, tauri-commands, reqwest]

# Dependency graph
requires:
  - phase: 33-extension-system-foundation
    provides: "Extension system infrastructure (ExtensionAPI, ExtensionHost, registries)"
provides:
  - "GitHub Rust module with 6 submodules (error, types, token, auth, remote, rate_limit)"
  - "6 Tauri commands for GitHub OAuth Device Flow, keychain token storage, remote detection, rate limits"
  - "GitHubError enum with 11 variants including polling control-flow errors"
  - "Cross-platform keychain token CRUD via keyring crate"
  - "GitHub remote URL parser supporting HTTPS, SSH, and SSH protocol formats"
affects: [34-02-PLAN, 34-03-PLAN, github-extension-frontend]

# Tech tracking
tech-stack:
  added: ["keyring v3.6 (apple-native, windows-native, sync-secret-service)", "reqwest form feature"]
  patterns: ["Hybrid extension pattern (core Rust commands + JS extension UI)", "Keychain token storage with spawn_blocking", "Single-poll command pattern (frontend controls polling loop)", "GitHub remote URL parsing without regex"]

key-files:
  created:
    - "src-tauri/src/github/mod.rs"
    - "src-tauri/src/github/error.rs"
    - "src-tauri/src/github/types.rs"
    - "src-tauri/src/github/token.rs"
    - "src-tauri/src/github/auth.rs"
    - "src-tauri/src/github/remote.rs"
    - "src-tauri/src/github/rate_limit.rs"
  modified:
    - "src-tauri/Cargo.toml"
    - "src-tauri/src/lib.rs"

key-decisions:
  - "Single-poll command pattern: frontend controls polling loop via setTimeout, each poll is one Tauri command invocation"
  - "Token never returned to frontend: AuthResult carries authenticated/username/avatar_url/scopes, never the token itself"
  - "keyring v3 with explicit platform features (no defaults) for macOS Keychain, Windows Credential Manager, Linux Secret Service"
  - "Added reqwest form feature for OAuth form-encoded POST bodies (was missing from existing config)"
  - "GitHub module as peer of git/ and gitflow/ in src-tauri/src/ (core commands, not plugin)"

patterns-established:
  - "Hybrid extension: core Rust commands consumed by JS extension via typed Tauri IPC"
  - "Keychain CRUD with spawn_blocking: all keyring Entry operations wrapped in tokio::task::spawn_blocking"
  - "Control-flow errors: GitHubError::AuthorizationPending and SlowDown used as polling control signals"
  - "GitHub URL parsing: regex-free string matching for HTTPS/SSH/SSH-protocol remote URLs"

# Metrics
duration: 16min
completed: 2026-02-10
---

# Phase 34 Plan 01: GitHub Rust Backend Summary

**Complete Rust backend for GitHub OAuth Device Flow with keyring keychain storage, remote detection, and rate limit checking across 6 submodules and 6 Tauri commands**

## Performance

- **Duration:** 16 min
- **Started:** 2026-02-10T11:46:04Z
- **Completed:** 2026-02-10T12:02:17Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Created github/ Rust module with 6 submodules: error, types, token, auth, remote, rate_limit
- Registered 6 Tauri commands: github_start_device_flow, github_poll_auth, github_get_auth_status, github_sign_out, github_detect_remotes, github_check_rate_limit
- Implemented cross-platform keychain token CRUD via keyring crate with spawn_blocking for all blocking operations
- Device flow handles all 4 GitHub error states (authorization_pending, slow_down, expired_token, access_denied)
- Token never leaves Rust -- frontend receives AuthResult with user metadata only
- GitHub remote URL parser handles HTTPS, SSH (git@), SSH protocol, and HTTP formats

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub Rust module with error types, shared types, and keychain storage** - `0094863` (feat)
2. **Task 2: Register all commands in lib.rs collect_commands** - `0c83e24` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `src-tauri/src/github/mod.rs` - Module root with pub mod declarations and re-exports of all Tauri commands
- `src-tauri/src/github/error.rs` - GitHubError enum with 11 variants for IPC serialization
- `src-tauri/src/github/types.rs` - Shared types: DeviceFlowResponse, AuthResult, GitHubUser, RateLimitInfo, GitHubRemoteInfo
- `src-tauri/src/github/token.rs` - Keychain CRUD (store/get/delete token), fetch_github_user, auth status check, sign out commands
- `src-tauri/src/github/auth.rs` - OAuth Device Flow start and single-poll commands with GitHub error state handling
- `src-tauri/src/github/remote.rs` - GitHub remote URL parser and detect_remotes command using RepositoryState
- `src-tauri/src/github/rate_limit.rs` - Rate limit checking via GitHub API with authenticated requests
- `src-tauri/Cargo.toml` - Added keyring dependency, added form feature to reqwest
- `src-tauri/src/lib.rs` - Added mod github, imported and registered all 6 GitHub commands
- `Cargo.lock` - Updated with keyring and form_urlencoded dependencies

## Decisions Made

- **Single-poll pattern:** The frontend controls the polling loop via setTimeout and calls github_poll_auth once per interval. This avoids long-running Tauri commands and gives the frontend full control over UX (countdown timer, cancel button).
- **Token isolation:** The access token is stored directly in the keychain after successful auth and never returned across IPC. Only AuthResult metadata crosses the boundary.
- **Added reqwest form feature:** The existing reqwest dependency was missing the `form` feature needed for OAuth form-encoded POST bodies. Added it alongside json and rustls.
- **Placeholder client_id:** Used a placeholder GitHub OAuth App client_id with TODO comment. The user needs to register their own OAuth App and replace the value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added reqwest form feature to Cargo.toml**
- **Found during:** Task 1 (cargo check)
- **Issue:** reqwest was configured with only json and rustls features. The OAuth endpoints require form-encoded POST bodies, which needs the `form` feature.
- **Fix:** Added `form` to reqwest features list in Cargo.toml
- **Files modified:** src-tauri/Cargo.toml
- **Verification:** cargo check passes, form method available on RequestBuilder
- **Committed in:** 0094863 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed `ref access_token` pattern in auth.rs**
- **Found during:** Task 1 (cargo check)
- **Issue:** `if let Some(ref access_token)` caused Rust compilation error due to str sizing. Changed to `if let Some(access_token) = &data.access_token`.
- **Fix:** Used reference binding pattern instead of ref keyword
- **Files modified:** src-tauri/src/github/auth.rs
- **Verification:** cargo check passes
- **Committed in:** 0094863 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep.

## Issues Encountered

- bindings.ts auto-regeneration requires running the Tauri app (runtime operation in the Builder), not just `cargo build`. The bindings will update on next `tauri dev` run. This is expected behavior per the existing codebase pattern (noted as pre-existing tech debt in STATE.md).

## User Setup Required

**External services require manual configuration:**
- Register a GitHub OAuth App at https://github.com/settings/developers -> OAuth Apps -> New OAuth App
- Replace the placeholder `GITHUB_CLIENT_ID` in `src-tauri/src/github/auth.rs` with the registered app's client_id
- No client_secret needed (device flow uses only public client_id)

## Next Phase Readiness

- All 6 Rust backend commands are compiled and registered, ready for frontend consumption
- Plan 34-02 can build the frontend extension (Zustand store, blades, commands) that invokes these Tauri commands
- bindings.ts will auto-generate TypeScript types for all new commands on next app run

## Self-Check: PASSED

All 8 created files verified present. Both task commits (0094863, 0c83e24) verified in git log. cargo check passes with 0 errors.

---
*Phase: 34-github-authentication*
*Completed: 2026-02-10*
