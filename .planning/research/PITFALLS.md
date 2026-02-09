# FlowForge Critical Pitfalls

> **Research Dimension**: Pitfalls
> **Project**: FlowForge -- AI-native Git client (Tauri + Rust + React)
> **Target Constraints**: <50MB binary, <200MB memory, <100ms common operations
> **Last Updated**: 2026-02-09

---

## Executive Summary

42 domain-specific pitfalls identified across two milestone scopes. Pitfalls 1-24 cover the core Git client foundation (established). Pitfalls 25-42 cover the extension system, GitHub integration, and toolbar UX overhaul -- the focus of the next milestone. The extension/GitHub pitfalls are particularly dangerous because they introduce untrusted code execution, external network access, and new attack surface to an app that was previously entirely local.

---

## PART A: Core Git Client Pitfalls (Established)

These pitfalls were identified during initial project research and remain relevant.

---

### Critical Pitfalls (Phase 1)

### 1. IPC Serialization Bottleneck

**Problem**: Tauri's default JSON serialization becomes a bottleneck for Git data. A 10MB diff takes 5ms on macOS but 200ms on Windows.

**Warning Signs**:
- UI freezes during large diffs
- Clone progress updates lag
- Status refresh takes >100ms

**Prevention**:
- Paginate everything (commits, files, diffs)
- Keep bulk data in Rust, send summaries to frontend
- Use Channels for streaming, not single large payloads
- Treat WebView as display-only, not data storage

**Phase**: Address in Phase 1 (Foundation)

---

### 2. Blocking the Async Runtime

**Problem**: git2-rs is synchronous. Calling it directly on Tokio's async runtime blocks all other tasks.

**Warning Signs**:
- UI freezes during Git operations
- File watcher events delayed
- Commands queue up

**Prevention**:
```rust
// WRONG - blocks runtime
#[tauri::command]
async fn get_status(repo: State<'_, Repo>) -> Result<Status, Error> {
    repo.statuses(None)?  // Blocks!
}

// CORRECT - spawn blocking task
#[tauri::command]
async fn get_status(repo: State<'_, Repo>) -> Result<Status, Error> {
    let repo = repo.clone();
    tokio::task::spawn_blocking(move || {
        repo.statuses(None)
    }).await?
}
```

**Phase**: Address in Phase 1 (Foundation)

---

### 3. libgit2 Thread Safety

**Problem**: git2 Repository objects cannot be shared across threads. Attempting to do so causes undefined behavior or panics.

**Warning Signs**:
- Random panics in Git operations
- Data corruption
- Segfaults

**Prevention**:
- One Repository handle per thread
- Use `Arc<Mutex<Repository>>` for shared access
- Never share git2 objects (Commit, Tree, etc.) across threads
- Clone Repository for parallel operations

**Phase**: Address in Phase 1 (Foundation)

---

### 4. Cross-Platform WebView Differences

**Problem**: Windows (WebView2), macOS (WKWebView), and Linux (WebKitGTK) behave differently in subtle ways.

**Warning Signs**:
- Works on Mac, broken on Windows
- CSS rendering differences
- IPC performance varies 10-40x between platforms

**Prevention**:
- CI builds and tests on all three platforms from day one
- Test IPC performance on each platform
- Avoid platform-specific CSS features
- Document known platform quirks

**Phase**: Address in Phase 1 (Foundation)

---

### High Priority Pitfalls (Phases 2-4)

### 5. Memory Leaks from git2

**Problem**: Long-lived Repository handles accumulate file descriptors and memory. libgit2 caches aggressively.

**Prevention**:
- Open Repository per-operation OR with explicit lifecycle
- Call `Repository::cleanup_state()` periodically
- Monitor file descriptor count in development
- Consider re-opening repo after N operations

**Phase**: Address in Phase 2 (Core Git)

---

### 6. File Watching Platform Limits

**Problem**: Each platform has different limits and behaviors:
- Linux inotify: Default 8,192 watches (configurable)
- macOS kqueue: Opens file descriptor per file (~256 default)
- Windows: Can only watch directories, not individual files

**Prevention**:
- Use notify-rs (handles cross-platform)
- Watch directories, not files
- Watch `.git/` directory specifically, not entire worktree
- Implement polling fallback for network filesystems
- Debounce events (Git operations generate hundreds)

**Phase**: Address in Phase 3 (Real-Time Updates)

---

### 7. Large Repository History Loading

**Problem**: 100K+ commits cannot be loaded at once. `git log --graph` takes 2.8+ seconds even on moderate repos.

**Prevention**:
- Virtual scrolling in commit list (only render visible)
- Incremental loading (load 100 at a time)
- Use git commit-graph for faster traversal
- Defer graph layout calculation
- Cache commit metadata

**Phase**: Address in Phase 4 (Branch Operations) and Phase 8 (Topology)

---

### 8. Gitflow Double-Merge Enforcement

**Problem**: Release and hotfix branches must merge to BOTH main AND develop. Easy to forget one.

**Prevention**:
- State machine tracks pending merges
- Block branch deletion until both merges complete
- UI shows merge checklist for release/hotfix finish
- Implement as transaction (rollback if either fails)

**Phase**: Address in Phase 5 (Gitflow State Machine)

---

### 9. DAG Layout Complexity

**Problem**: Naive graph layout algorithms are O(n^2) or worse. Real repos have thousands of nodes.

**Prevention**:
- Use swimlane algorithm (O(n))
- Virtualize rendering (only visible nodes)
- Cluster old commits
- Pre-compute layout in Rust, send positions to frontend
- Limit visible history (show last 1000, load more on demand)

**Phase**: Address in Phase 8 (Topology)

---

### Medium Priority Pitfalls

### 10. Linux WebKitGTK Version Hell

**Problem**: Ubuntu 20.04, 22.04, and 24.04 ship different WebKitGTK versions. They are not compatible.

**Prevention**:
- Target minimum WebKitGTK version explicitly
- Test on multiple Ubuntu versions in CI
- Document system requirements
- Consider AppImage for better isolation

**Phase**: Address throughout development

---

### 11. Event Storms from File Watching

**Problem**: A single `git checkout` generates hundreds of file events. Processing each individually overwhelms the UI.

**Prevention**:
```rust
// Debounce events - only process after 100ms of quiet
let debouncer = new_debouncer(Duration::from_millis(100), move |events| {
    // Batch process
})?;
```

**Phase**: Address in Phase 3 (Real-Time Updates)

---

### 12. Atomic File Update Blindness

**Problem**: Many editors (vim, VSCode) save files atomically via rename. If you are watching the original file, you miss the update.

**Prevention**:
- Watch directories, not files
- Use notify-rs which handles this
- Re-establish watches after rename events

**Phase**: Address in Phase 3 (Real-Time Updates)

---

### 13. Gitflow is Polarizing

**Problem**: Gitflow has critics. Some teams prefer GitHub Flow or trunk-based development. The original gitflow repo was archived October 2025.

**Prevention**:
- Position Gitflow as primary but not exclusive
- Design state machine to support multiple workflows
- Consider GitHub Flow support in v2
- Do not force Gitflow on repos that do not use it

**Phase**: Design consideration throughout

---

### 14. Merge Conflict During Multi-Step Operations

**Problem**: Gitflow "finish release" involves multiple merges. A conflict in the first breaks the flow.

**Prevention**:
- Check for potential conflicts before starting
- Make operations transactional (complete or rollback)
- Save state to allow resuming after conflict resolution
- Clear UI for "operation in progress" state

**Phase**: Address in Phase 5 (Gitflow State Machine)

---

### 15. Stale Branch Detection False Positives

**Problem**: A branch may be "old" but actively worked on in a worktree.

**Prevention**:
- Cross-reference worktree status
- Use last commit date, not creation date
- Allow user to mark branches as "active"
- Do not auto-delete, only suggest

**Phase**: Address in Phase 7 (Worktrees)

---

### Performance Pitfalls

### 16. Status on Large Worktrees

**Problem**: `git status` touches every file in the worktree. On repos with 50K+ files, this takes seconds.

**Prevention**:
- Use libgit2's `StatusOptions::include_untracked(false)` for quick checks
- Cache status, invalidate on file change
- Show "checking..." state, do not block UI
- Respect `.gitignore` strictly

**Phase**: Address in Phase 2 (Core Git)

---

### 17. Diff Memory Explosion

**Problem**: Loading both sides of a large diff into memory for comparison can use gigabytes.

**Prevention**:
- Stream diffs line-by-line
- Limit diff display size (offer "show full" option)
- Use libgit2's delta compression when available
- Paginate hunks

**Phase**: Address in Phase 2 (Core Git)

---

### 18. Commit Message Scope Inference Failures

**Problem**: Rule-based scope inference from file paths fails for monorepos with complex structures, files that moved, and cross-cutting changes.

**Prevention**:
- Use most common directory as scope
- Allow manual override (always)
- Learn from previous commits in same paths
- Do not over-engineer v1 - 80% accuracy is fine

**Phase**: Address in Phase 6 (Conventional Commits)

---

### Security Pitfalls

### 19. Credential Exposure

**Problem**: Git credentials (tokens, passwords) can leak through logs, error messages, or IPC.

**Prevention**:
- Never log URLs with credentials
- Sanitize error messages before sending to frontend
- Use OS keychain (macOS Keychain, Windows Credential Manager)
- Never store credentials in config files

**Phase**: Address throughout development

---

### 20. Path Traversal in Worktree Operations

**Problem**: User-controlled paths in worktree creation could escape intended directories.

**Prevention**:
- Validate all paths on backend
- Canonicalize paths before operations
- Reject paths with `..` components
- Use allowlist of permitted parent directories

**Phase**: Address in Phase 7 (Worktrees)

---

### UX Pitfalls

### 21. Topology Overload

**Problem**: Showing all branches, all commits, all information overwhelms users.

**Prevention**:
- Default to collapsed/filtered view
- Hide old/merged branches by default
- Progressive disclosure
- Quick filters (this week, this month, this branch)

**Phase**: Address in Phase 8 (Topology)

---

### 22. Conventional Commit Rigidity

**Problem**: Strict validation frustrates users who are learning or have edge cases.

**Prevention**:
- Warnings, not errors (allow non-conventional commits)
- Helpful error messages ("Did you mean `feat:` instead of `feature:`?")
- Quick-fix suggestions
- Optional strict mode

**Phase**: Address in Phase 6 (Conventional Commits)

---

### 23. Worktree Path Confusion

**Problem**: Users forget which worktree they are in, make changes in wrong location.

**Prevention**:
- Clear visual indicator of current worktree
- Show worktree path prominently
- Different window title per worktree
- Quick switcher

**Phase**: Address in Phase 7 (Worktrees)

---

### 24. Lost Work During Destructive Operations

**Problem**: Branch deletion, stash drop, reset can lose work permanently.

**Prevention**:
- Reflog integration (allow recovery)
- Confirmation dialogs for destructive operations
- Show what will be lost before proceeding
- Undo where possible

**Phase**: Address throughout development

---

## PART B: Extension System, GitHub Integration, and Toolbar UX Pitfalls

These pitfalls are specific to adding an extension system, GitHub PR/issues integration, and toolbar UX overhaul to the existing FlowForge codebase. They focus on integration risks with the existing blade/store/FSM architecture.

**Researched**: 2026-02-09

---

### CRITICAL -- Mistakes that cause rewrites, security vulnerabilities, or fundamental breakage

---

### 25. Extension Code Escaping the Sandbox

**What goes wrong:** Extensions loaded from `.flowforge/extensions/` per-repo execute arbitrary JavaScript in the same context as the core app. A malicious or buggy extension gains full access to Zustand stores, the XState navigation actor, Tauri IPC commands, and the filesystem.

**Why it happens:** The natural approach -- `import()` or `eval()` of extension code -- runs that code in the same JavaScript Realm as the host app. There is no isolation boundary. Figma learned this the hard way: their initial Realms-shim sandbox had multiple escape vulnerabilities where sandbox code could access host objects. They ultimately switched to QuickJS compiled to WebAssembly for true isolation.

**Consequences:**
- Extension reads/writes to any Zustand store (git-ops, preferences, UI state)
- Extension sends arbitrary events to the navigation machine (`RESET_STACK`, `SWITCH_PROCESS`)
- Extension calls Tauri IPC commands directly (file access, shell commands if exposed)
- Supply-chain attack vector: a repo's `.flowforge/extensions/` folder is cloned by contributors

**Prevention:**
- Run extension logic in a sandboxed `<iframe>` with `sandbox="allow-scripts"` and no `allow-same-origin`, communicating via `postMessage()` only
- Alternatively, use a Web Worker with a Blob URL for non-UI extensions -- Worker cannot access DOM, Tauri IPC, or main-thread globals
- Define a strict Extension API surface as a message protocol (not direct function calls): `{ type: "registerCommand", payload: {...} }`
- Never allow extensions to `import` from core modules or access `window.__TAURI__`

**Detection:** Any extension that uses `import()`, `eval()`, `new Function()`, or accesses `window.__TAURI_INTERNALS__` in its code.

**Phase:** Must be addressed in the Extension System foundation phase. Retrofitting sandboxing is a rewrite.

**Confidence:** HIGH -- Figma's public post-mortem and the Zendesk engineering sandbox analysis both confirm Realm-based approaches are insufficient. WebWorker/iframe isolation is well-established.

---

### 26. Extension BladeType Collisions with Core Blade Registry

**What goes wrong:** Extensions register blade types that collide with the 15 existing core types or with other extensions. The `BladePropsMap` interface is a compile-time TypeScript map; extensions cannot extend it at runtime without breaking type safety. The `bladeRegistry` Map uses `BladeType` as key, and `registerBlade()` silently overwrites existing registrations.

**Why it happens:** The current architecture uses a string-literal union type for `BladeType`:
```typescript
export type BladeType = keyof BladePropsMap;
// "staging-changes" | "topology-graph" | "commit-details" | ...
```
Extensions need to register new blade types, but this union is closed at compile time. Developers either widen it to `string` (losing type safety for core blades) or create a parallel untyped registry (fragmenting the system).

**Consequences:**
- Extension registers `"settings"` blade type, overwriting core settings blade
- The `SINGLETON_TYPES` set in `navigationMachine.ts` is hardcoded -- extension singletons are not enforced
- `_discovery.ts` exhaustiveness check fires false positives for extension types
- The navigation machine's `PUSH_BLADE` event type accepts only `BladeType`, rejecting extension blade types at the TypeScript level

**Prevention:**
- Namespace extension blade types: `ext:{extension-id}:{blade-name}` (e.g., `ext:github:pr-list`)
- Create a separate `ExtensionBladeType` that is `string` but validated at runtime, alongside the compile-time `BladeType` union
- Make the navigation machine accept `BladeType | ExtensionBladeType` with runtime validation
- Add a guard in `registerBlade()` that rejects registration of core blade types by extensions
- Add namespace prefix validation in the extension loader before any registration calls

**Detection:** Extension registering a blade type without the `ext:` prefix. Core blade types listed in `EXPECTED_TYPES` appearing in extension manifests.

**Phase:** Extension System foundation phase. The `BladeType` type system must be extended before any extension can provide UI.

**Confidence:** HIGH -- directly verified from codebase analysis of `bladeTypes.ts`, `bladeRegistry.ts`, and `navigationMachine.ts`.

---

### 27. GitHub OAuth Token Stored in Plaintext via tauri-plugin-store

**What goes wrong:** The natural approach is to store the GitHub OAuth token using the existing `getStore()` function (which writes to `flowforge-settings.json`). This stores the token as plaintext JSON on disk, readable by any process with filesystem access.

**Why it happens:** `tauri-plugin-store` is designed for preferences, not secrets. The existing settings store at `flowforge-settings.json` is unencrypted. Developers reach for the tool they already have.

**Consequences:**
- OAuth token readable by any local process or malware
- Token persists on disk even after logout if not explicitly cleared
- On shared machines, other users could access tokens
- If the repo is on a network drive, tokens could be exposed over the network

**Prevention:**
- Use `tauri-plugin-keyring` (wraps OS keychain: macOS Keychain, Windows Credential Manager, Linux Secret Service) for all OAuth tokens
- Never store tokens in `flowforge-settings.json` or any tauri-plugin-store instance
- Store only a boolean `isGitHubConnected` flag in the preferences store; retrieve the actual token from keyring at runtime
- Implement token clearing on explicit logout

**Detection:** Any `store.set()` call with keys like "github_token", "access_token", or "oauth_token".

**Phase:** GitHub OAuth phase. Must be the first thing decided before any token storage code is written.

**Confidence:** HIGH -- Tauri's own documentation recommends native keychain. Stronghold is deprecated in v3. The `tauri-plugin-store` docs explicitly state it is for non-sensitive data.

---

### 28. CSP is Null -- Extensions and GitHub Integration Widen the Attack Surface

**What goes wrong:** The current `tauri.conf.json` has `"csp": null`, meaning no Content Security Policy is enforced. This was acceptable when the app only loaded local assets and communicated with Tauri IPC. Adding an extension system and GitHub API calls (external network requests) without CSP means any XSS vulnerability grants full access to both the extension API and GitHub tokens.

**Why it happens:** CSP was never needed because the app was entirely local. Adding network-facing features without tightening CSP is an oversight that creates a large attack surface.

**Consequences:**
- Injected scripts can call Tauri IPC commands (all permissions in `default.json` are available)
- Injected scripts can steal GitHub OAuth tokens from memory
- Extension-provided HTML/UI could inject scripts that escape the extension sandbox
- No protection against script injection via Git commit messages, branch names, or PR content rendered in the UI

**Prevention:**
- Before adding GitHub integration or extensions, set a strict CSP:
  ```json
  "csp": "default-src 'self'; script-src 'self'; connect-src 'self' https://api.github.com https://github.com; img-src 'self' https://avatars.githubusercontent.com data:; style-src 'self' 'unsafe-inline'"
  ```
- Sanitize all GitHub API response content before rendering (PR bodies contain arbitrary markdown with potential XSS payloads)
- Extension iframes must have their own restrictive CSP via sandbox attributes
- Test CSP in development -- Vite dev server may need `connect-src` adjustments

**Detection:** `"csp": null` in `tauri.conf.json`. Any `dangerouslySetInnerHTML` usage with unsanitized GitHub API content.

**Phase:** Must be addressed before either GitHub integration or extension system. This is a prerequisite security hardening step.

**Confidence:** HIGH -- directly verified from `tauri.conf.json` in the codebase. Tauri security documentation explicitly warns about CSP misconfiguration.

---

### 29. Command Name Collisions Between Extensions and Core

**What goes wrong:** Extensions register commands via `registerCommand()` with IDs that collide with existing core commands. The current `commandRegistry.ts` silently overwrites commands by ID:
```typescript
const existingIndex = commands.findIndex((c) => c.id === cmd.id);
if (existingIndex >= 0) {
  commands[existingIndex] = cmd; // Silent overwrite!
}
```

**Why it happens:** The command registry was designed for a closed set of core commands. There is no namespace enforcement. Extensions naturally want IDs like "open-settings" or "refresh" that may conflict with core commands.

**Consequences:**
- Extension overwrites core command, breaking keyboard shortcut
- Two extensions register the same command ID, last-write-wins with no warning
- Command palette shows extension commands mixed with core commands with no visual distinction

**Prevention:**
- Namespace extension commands: `ext:{extension-id}:{command-name}`
- Add a `source` field to the `Command` interface: `source: "core" | { extension: string }`
- Reject `registerCommand()` calls that would overwrite a `source: "core"` command
- Add an "Extensions" category to the `CommandCategory` union or per-extension categories
- Show extension provenance in the command palette UI (icon badge, section grouping)

**Detection:** `registerCommand()` called with an ID that does not start with `ext:` prefix from extension context.

**Phase:** Extension System foundation phase, alongside blade type namespacing.

**Confidence:** HIGH -- directly verified from `commandRegistry.ts` source code.

---

### MODERATE -- Significant bugs, poor UX, or technical debt

---

### 30. GitHub Device Flow User Abandonment and Stale Polling

**What goes wrong:** User starts OAuth Device Flow, sees the code, opens browser, gets distracted, and never completes authorization. The app polls GitHub every 5 seconds for up to 15 minutes (the code expiration window), consuming 180 unnecessary HTTP requests. If the component unmounts during polling, the interval continues in background.

**Why it happens:** Device Flow requires polling -- there is no callback or webhook. The 15-minute timeout and 5-second interval are GitHub's constraints. Developers implement the polling loop but forget cleanup on component unmount or app state change.

**Prevention:**
- Track polling with an `AbortController`; abort on component unmount, repo switch, or user cancel
- Show a clear "Cancel" button alongside the device code display
- Show elapsed time / time remaining (the code expires after 900 seconds)
- Implement exponential backoff on `slow_down` errors (add 5 seconds per GitHub's spec)
- After 3 minutes without completion, show a "Still waiting... Re-enter code?" prompt
- Store the device flow state in a dedicated Zustand slice, not component-local state, so the flow survives blade navigation

**Detection:** Network tab showing repeated POST requests to `https://github.com/login/oauth/access_token` after user has navigated away.

**Phase:** GitHub OAuth implementation phase.

**Confidence:** HIGH -- GitHub's Device Flow docs explicitly document polling protocol, error codes (`authorization_pending`, `slow_down`, `expired_token`, `access_denied`), and timeout behavior.

---

### 31. GitHub API Rate Limits Hit Silently Without User Feedback

**What goes wrong:** The app makes many GitHub API calls (list PRs, issues, fetch PR details, check CI status) and hits the rate limit (5,000 requests/hour for authenticated users, 60/hour unauthenticated). API calls start returning 403/429 errors with no user-visible feedback.

**Why it happens:** Developers build the happy path first. Rate limit handling is added as an afterthought, usually as a console.error that users never see.

**Consequences:**
- PR list shows stale data with no indication of staleness
- Issue creation fails silently
- CI status checks stop updating

**Prevention:**
- Read `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers on every GitHub API response
- Store rate limit state in a Zustand slice; show a subtle indicator when remaining < 100
- When rate limited: show toast with reset time, disable fetch buttons, show countdown
- Use conditional requests with `If-None-Match` / `ETag` headers -- 304 responses do not count against rate limit
- Prefer GraphQL over REST for PR/issue queries: single request fetches PR + reviews + CI status vs. 3+ REST calls
- Cache GitHub responses with `@tanstack/react-query` using appropriate `staleTime` (30-60 seconds for PR lists)

**Detection:** GitHub API response with `X-RateLimit-Remaining: 0` and no corresponding UI feedback.

**Phase:** GitHub API integration phase. Must be designed into the API client from the start.

**Confidence:** HIGH -- GitHub rate limit documentation is explicit and well-documented.

---

### 32. Extension Lifecycle Misalignment with Navigation Machine

**What goes wrong:** Extension activates, registers blades and commands, then the user navigates to a different process (`SWITCH_PROCESS`) or resets the stack (`RESET_STACK`). Extension state persists in Zustand stores and the command registry, but the extension's blades are gone from the stack. When the extension is deactivated, its registered commands and blade types remain as orphans.

**Why it happens:** The navigation machine's `resetStack` and `switchProcess` actions clear the `bladeStack` and `dirtyBladeIds`, but have no concept of extension lifecycle. Extensions register side effects (commands, store slices, event listeners) that outlive their blades. The `resetAllStores()` function in `registry.ts` resets all registered stores but does not deregister extension-added slices.

**Consequences:**
- Orphaned commands in command palette from deactivated extensions
- Memory leaks from extension event listeners not cleaned up
- Store state pollution: extension slices persist after deactivation
- Zombie blade registrations in `bladeRegistry` after extension removal

**Prevention:**
- Extension activation must return a `dispose()` function that cleans up all registrations:
  ```typescript
  interface ExtensionActivation {
    dispose: () => void; // Removes commands, blades, store subscriptions, listeners
  }
  ```
- Track all registrations per extension in a `Map<extensionId, Registration[]>`
- On extension deactivation: call `dispose()`, then verify cleanup with a dev-mode check
- Listen to navigation machine transitions to clean up extension blades removed from stack
- Never allow extensions to modify `registerStoreForReset()` -- extension stores should be managed by the extension lifecycle, not the global reset

**Detection:** After disabling an extension, search the command palette for its commands (they should be gone). Check `bladeRegistry` size before and after deactivation.

**Phase:** Extension System foundation phase. The lifecycle protocol must be defined before any extension can register anything.

**Confidence:** HIGH -- directly verified from `registry.ts`, `commandRegistry.ts`, and `navigationMachine.ts`.

---

### 33. Toolbar Overflow Menu Loses Items Without User Awareness

**What goes wrong:** The current `Header.tsx` renders 10+ action buttons in a `flex` row. When the window narrows, items either overflow invisibly (hidden by `overflow-hidden`) or wrap to a second line (breaking the 56px header height). Users lose access to actions they know exist, with no indication that more items are available.

**Why it happens:** The current header uses `flex items-center justify-between` with no overflow strategy. At the current window width of 1200px this works. Below ~900px, items start overlapping or disappearing. There is no `ResizeObserver`-based measurement, no overflow menu, and no responsive breakpoint handling.

**Consequences:**
- At narrow widths: Settings, Theme Toggle, Command Palette, Undo, Refresh, Sync, Gitflow, Repo Browser, Changelog, Close, Reveal, Open buttons compete for ~400px of space
- Users cannot access hidden actions
- No keyboard path to hidden items (violates WCAG 2.1 toolbar pattern)
- Adding GitHub integration buttons (PR, Issues) makes the overflow worse

**Prevention:**
- Implement a `useToolbarOverflow` hook using `ResizeObserver` to measure available space
- Prioritize items: always-visible (Open, Branch Switcher, Command Palette), conditionally-visible (Sync, Refresh), overflow-menu (Gitflow, Changelog, Reveal, Close)
- Overflow menu button with count badge: "... +4" showing number of hidden items
- Follow W3C APG toolbar pattern: `role="toolbar"`, roving tabindex, Left/Right arrow navigation
- Overflow menu must be keyboard-accessible: `aria-haspopup="true"`, `aria-expanded`, `role="menu"` for items
- Add `aria-label` to all icon-only buttons (some already have `aria-label`, several do not)

**Detection:** Resize window to 800px wide. Count visible toolbar items vs. expected items. Check that all toolbar items are reachable via keyboard.

**Phase:** Toolbar UX phase. Should be implemented before adding any new toolbar items (GitHub buttons would make this worse).

**Confidence:** HIGH -- directly verified from `Header.tsx` source code.

---

### 34. GitHub Token Identity Mismatch After Account Switch

**What goes wrong:** User authenticates with GitHub account A. Later, they switch GitHub accounts in their browser. The app still uses account A's token. PRs are created under the wrong account. GitHub's Device Flow docs explicitly warn: "a user can change which account they are signed into."

**Why it happens:** OAuth tokens are bound to the account that authorized them, not the account currently logged into the browser. The token has no visible "identity" in the app.

**Prevention:**
- After OAuth flow completes, fetch `GET /user` to get the authenticated user's login and avatar
- Display the connected GitHub identity prominently in the UI (avatar + username)
- Provide a "Switch Account" / "Disconnect" action that clears the keyring token and restarts the device flow
- Before sensitive operations (create PR, push), verify the token is still valid with a lightweight API call
- Store the GitHub username alongside the token (in preferences, not keyring) to show identity without re-fetching

**Detection:** After authenticating, switch GitHub accounts in browser, then check the app's "Connected as" display.

**Phase:** GitHub OAuth implementation phase.

**Confidence:** HIGH -- GitHub's official Device Flow documentation explicitly warns about this.

---

### 35. Extensions Corrupting Navigation Machine State

**What goes wrong:** An extension sends events directly to the navigation actor via `getNavigationActor().send()`. A buggy extension sends `PUSH_BLADE` in a rapid loop, filling the blade stack to `maxStackDepth` (8). Or sends `RESET_STACK` while the user is editing a conventional commit (dirty blade), bypassing the `confirmingDiscard` guard.

**Why it happens:** The navigation actor is a module-level singleton exported via `getNavigationActor()`. Any code in the main thread can send events to it. Extensions that `import` or access this function can manipulate navigation state directly.

**Prevention:**
- Extensions must not have direct access to `getNavigationActor()` -- enforce via sandboxing (iframe/Worker)
- Provide a mediated API: `extensionApi.openBlade(type, props)` that validates the blade type, enforces namespace, and rate-limits push events
- Add rate limiting to the navigation machine: reject `PUSH_BLADE` events faster than 1 per 100ms
- When an extension is deactivated, pop all its blades from the stack (filter by `ext:` prefix)
- Add an `extension_id` field to `TypedBlade` for extension-provided blades, enabling targeted cleanup

**Detection:** Navigation machine receiving events with extension blade types. Blade stack containing blades from deactivated extensions.

**Phase:** Extension System foundation phase.

**Confidence:** HIGH -- directly verified from `context.tsx` (module-level singleton with public getter) and `navigationMachine.ts`.

---

### 36. GitHub GraphQL vs REST Choice Made Per-Endpoint Instead of Strategically

**What goes wrong:** Developers use REST for some endpoints and GraphQL for others based on what they find in docs first. This creates two separate API clients, two authentication paths, two rate-limit tracking systems, and inconsistent error handling.

**Why it happens:** GitHub provides both REST and GraphQL for most resources. Tutorials often mix them.

**Consequences:**
- Duplicate API client infrastructure
- Rate limits consumed from two separate budgets (REST: 5,000 req/hr; GraphQL: 5,000 points/hr)
- Pagination logic implemented twice (cursor-based for GraphQL, Link header for REST)
- Inconsistent caching strategy

**Prevention:**
- Commit to GraphQL as the primary API for all read operations (PRs, issues, CI status, repo metadata) -- it allows fetching exactly the needed fields in one request
- Use REST only for write operations where GraphQL mutations are not available or less documented
- Build a single `GitHubClient` class that handles auth, rate limiting, and caching for both protocols
- Implement one shared rate-limit tracker that accounts for both REST and GraphQL consumption

**Detection:** Two or more separate `fetch()` / `reqwest` call patterns with independent error handling.

**Phase:** GitHub API integration phase. Decide the strategy before writing the first API call.

**Confidence:** MEDIUM -- based on GitHub API documentation comparison. The 2025 GraphQL resource limits announcement adds uncertainty about future cost calculations.

---

### MINOR -- Polish issues, developer confusion, or minor bugs

---

### 37. Toolbar Icon-Only Buttons Without Consistent Tooltip/Label Pattern

**What goes wrong:** The current Header.tsx mixes patterns: some buttons use `ShortcutTooltip` (Settings, Command Palette, Open), some use `title` attribute only (Gitflow, Repo Browser, Refresh), and some have both `title` and `aria-label` while others have neither beyond `title`. New GitHub integration buttons follow whichever pattern the developer finds first.

**Prevention:**
- Create a `ToolbarButton` component that enforces: icon, label (for screen readers), tooltip text, optional shortcut
- Audit existing buttons and migrate to `ToolbarButton`
- Make `aria-label` required in the component props (TypeScript enforcement)
- Use `ShortcutTooltip` for all toolbar buttons, even those without shortcuts (show just the label)

**Phase:** Toolbar UX phase.

**Confidence:** HIGH -- directly verified from `Header.tsx` source code.

---

### 38. Extension Manifest Validation Happens Too Late

**What goes wrong:** Extension manifest is loaded and parsed, but validation happens after some initialization. A malformed manifest (missing `name`, invalid `version`, unsupported `apiVersion`) causes a runtime crash deep in the extension loader rather than a clean error at load time.

**Prevention:**
- Define a strict JSON Schema or Zod schema for extension manifests
- Validate the entire manifest before any extension code is loaded
- Provide clear error messages: "Extension 'foo' has invalid manifest: missing required field 'name'"
- Include an `apiVersion` field that must match the current extension API version
- Fail fast and fail clearly -- never partially load an extension with an invalid manifest

**Phase:** Extension System foundation phase.

**Confidence:** MEDIUM -- based on general plugin system architecture patterns.

---

### 39. GitHub Pagination Fetches All Pages Eagerly

**What goes wrong:** When fetching PR or issue lists, the API client fetches all pages upfront. For repos with hundreds of open PRs, this means 3-10 API calls just to render a list where the user sees only the first 20 items.

**Prevention:**
- Use `@tanstack/react-query`'s `useInfiniteQuery` for all paginated GitHub resources
- Fetch only the first page (25-50 items) on initial load
- Implement "Load more" or virtual scrolling for additional pages
- Set `first: 25` in GraphQL queries, not `first: 100`
- Cache pages independently so navigating back does not re-fetch

**Phase:** GitHub API integration phase.

**Confidence:** HIGH -- standard pagination pattern issue.

---

### 40. Tauri Capabilities Not Scoped for GitHub Network Access

**What goes wrong:** Adding GitHub API calls requires network permissions. The current capabilities file (`default.json`) has no HTTP/network permissions. Developers add broad permissions like `"http:default"` that allow the frontend to make arbitrary HTTP requests, widening the attack surface.

**Prevention:**
- Route all GitHub API calls through Tauri commands (Rust backend), not the frontend
- The Rust backend already has `reqwest` -- add dedicated commands like `github_fetch_prs`, `github_create_pr`
- If frontend HTTP access is needed, scope it: `"http:allow-fetch"` with URL scope restricted to `https://api.github.com/*` and `https://github.com/login/*`
- Keep the capabilities file minimal; document why each permission exists

**Detection:** `default.json` containing `"http:default"` without URL scope restrictions.

**Phase:** GitHub integration phase. Decide routing (frontend vs. backend) before implementing.

**Confidence:** HIGH -- directly verified from Tauri v2 capabilities documentation and the current `default.json`.

---

### 41. Store Subscription Leaks from Extension Hot-Reload

**What goes wrong:** During development, extensions are modified and hot-reloaded. Each reload creates new Zustand `subscribe()` calls without cleaning up previous subscriptions. Store updates trigger callbacks from both old and new extension instances.

**Why it happens:** The current HMR handling in `_discovery.ts` calls `clearRegistry()` on dispose, but there is no equivalent mechanism for extension store subscriptions.

**Prevention:**
- Extension activation must return disposers for all subscriptions
- The extension host must call all disposers before re-activating on HMR
- Use Zustand's `subscribe()` return value (the unsubscribe function) consistently
- Implement a dev-mode warning that detects duplicate subscriptions from the same extension ID

**Phase:** Extension System development experience phase.

**Confidence:** MEDIUM -- inferred from the existing HMR pattern in `_discovery.ts` and general Zustand subscription behavior.

---

### 42. Extension API Version Mismatch After Core Update

**What goes wrong:** FlowForge updates its extension API (changes a message type, adds a required field, removes a deprecated method). Existing installed extensions break silently because they were written against the old API version.

**Prevention:**
- Include `apiVersion` in extension manifests: `"apiVersion": "1.0"`
- The extension host checks `apiVersion` against a supported range at load time
- If incompatible: disable the extension with a clear message
- Use semantic versioning for the extension API
- Consider a compatibility shim layer for one major version back

**Phase:** Extension System foundation phase.

**Confidence:** MEDIUM -- standard plugin versioning concern.

---

## Phase-Mapped Summary

### Core Git Client (Established)

| Phase | Critical Pitfalls |
|-------|-------------------|
| 1 (Foundation) | IPC serialization, spawn_blocking, thread safety, cross-platform CI |
| 2 (Core Git) | Memory leaks, status performance, diff memory |
| 3 (Real-Time) | File watching limits, event storms, atomic updates |
| 4 (Branches) | History loading |
| 5 (Gitflow) | Double-merge enforcement, conflict handling |
| 6 (Commits) | Scope inference, validation UX |
| 7 (Worktrees) | Path validation, context clarity |
| 8 (Topology) | DAG layout, visual overload |

### Extension System, GitHub, Toolbar (New Milestone)

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Security hardening (prerequisite) | #28 CSP null, asset protocol scope `["**"]` too broad | Set strict CSP, narrow asset scope before adding extensions or GitHub |
| Extension System foundation | #25 Sandbox escape, #26 blade/command collisions, #32 lifecycle mismanagement, #35 FSM corruption | iframe/Worker sandbox, namespace enforcement, dispose protocol, mediated API |
| Extension development experience | #41 HMR subscription leaks, #38 manifest validation too late, #42 API version mismatch | Disposer protocol, upfront schema validation, version negotiation |
| GitHub OAuth | #27 Token in plaintext, #30 user abandonment during device flow, #34 identity mismatch | Keyring storage, AbortController polling, identity display |
| GitHub API integration | #31 Rate limits silent, #36 GraphQL/REST inconsistency, #39 eager pagination, #40 capability scope | Rate limit tracking, GraphQL-first strategy, infinite query, backend routing |
| Toolbar UX overhaul | #33 Overflow items hidden, #37 inconsistent patterns | ResizeObserver overflow, ToolbarButton component, APG toolbar pattern |
| Adding GitHub buttons to toolbar | #33 Toolbar already overcrowded before new items added | Implement overflow first, then add GitHub buttons |

---

## Quality Gate Verification

- [x] Pitfalls are specific to Tauri + Git GUI + libgit2 domain
- [x] Extension system pitfalls cover sandbox escape, blade/store/FSM integration, lifecycle management
- [x] GitHub OAuth pitfalls cover token storage, device flow polling, identity management
- [x] GitHub API pitfalls cover rate limiting, GraphQL/REST strategy, pagination
- [x] Toolbar UX pitfalls cover overflow, accessibility, consistency
- [x] Prevention strategies are actionable (specific code patterns, configuration values, component designs)
- [x] Phase mapping included for roadmap integration
- [x] Integration pitfalls between extensions and core blade/store/FSM covered

---

## Sources

### Official Documentation
- [Tauri v2 Security](https://v2.tauri.app/security/)
- [Tauri v2 Capabilities](https://v2.tauri.app/security/capabilities/)
- [Tauri v2 Isolation Pattern](https://v2.tauri.app/concept/inter-process-communication/isolation/)
- [Tauri Stronghold (deprecated)](https://v2.tauri.app/plugin/stronghold/)
- [Tauri IPC Performance Discussion](https://github.com/tauri-apps/tauri/discussions/7146)
- [GitHub OAuth Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub REST Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub GraphQL Rate Limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)
- [GitHub GraphQL Resource Limits (Sept 2025)](https://github.blog/changelog/2025-09-01-graphql-api-resource-limits/)
- [W3C APG Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [libgit2 Threading Documentation](https://github.com/libgit2/libgit2/blob/main/docs/threading.md)

### Community / Engineering Blogs
- [Figma Plugin Security Update](https://www.figma.com/blog/an-update-on-plugin-security/)
- [Figma Plugin System Architecture](https://www.figma.com/blog/how-we-built-the-figma-plugin-system/)
- [Zendesk: Sandboxing JavaScript](https://medium.com/zendesk-engineering/sandboxing-javascript-e4def55e855e)
- [JavaScript Sandbox Architecture (DEV)](https://dev.to/alexgriss/the-architecture-of-browser-sandboxes-a-deep-dive-into-javascript-code-isolation-1dnj)
- [Tauri Discussion: Safe Storage API](https://github.com/tauri-apps/tauri/discussions/7846)
- [notify-rs Documentation](https://docs.rs/notify/latest/notify/)
- [Tauri WebView Versions](https://v2.tauri.app/reference/webview-versions/)

### Third-Party Libraries
- [tauri-plugin-keyring](https://github.com/HuakunShen/tauri-plugin-keyring)
- [zustand-namespaces](https://github.com/mooalot/zustand-namespaces)
- [Octokit Auth Device Flow](https://github.com/octokit/auth-oauth-device.js)

### Codebase Files Analyzed
- `src/stores/bladeTypes.ts` -- BladeType union, BladePropsMap interface
- `src/lib/bladeRegistry.ts` -- registerBlade(), clearRegistry()
- `src/lib/commandRegistry.ts` -- registerCommand() with silent overwrite
- `src/machines/navigation/navigationMachine.ts` -- XState FSM, SINGLETON_TYPES, event handling
- `src/machines/navigation/context.tsx` -- Module-level singleton actor, public getNavigationActor()
- `src/machines/navigation/types.ts` -- NavigationContext, NavigationEvent types
- `src/stores/registry.ts` -- registerStoreForReset(), resetAllStores()
- `src/stores/domain/ui-state/index.ts` -- UIStore composition
- `src/lib/store.ts` -- Tauri plugin-store for settings (plaintext JSON)
- `src/components/Header.tsx` -- Current toolbar with 10+ buttons, no overflow handling
- `src/blades/_discovery.ts` -- import.meta.glob blade discovery, HMR handling
- `src-tauri/tauri.conf.json` -- CSP null, asset protocol scope **
- `src-tauri/capabilities/default.json` -- Current permission set
- `src-tauri/Cargo.toml` -- reqwest already available in backend
