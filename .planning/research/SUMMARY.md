# Project Research Summary

**Project:** FlowForge v1.5.0 — Extension System, GitHub Integration, Toolbar UX
**Domain:** Desktop Git client with extension architecture and GitHub platform integration
**Researched:** 2026-02-09
**Confidence:** HIGH

## Executive Summary

FlowForge v1.5 adds three major capabilities to an existing Tauri + React + XState Git client: a manifest-driven extension system, GitHub PR/issue integration as the first extension, and a responsive toolbar with overflow handling. The research reveals that this milestone is fundamentally about **opening a previously local-only application to untrusted code execution and external network access**, which introduces security and architectural challenges that existing Git clients either don't solve (GitHub Desktop has no extension system) or solve poorly (VS Code extensions run unsandboxed with full process permissions).

The recommended approach is a **three-layer architecture**: (1) a sandboxed ExtensionHost that loads extensions from manifest.json files in `.flowforge/extensions/`, (2) a mediated ExtensionAPI facade that tracks registrations per-extension for lifecycle cleanup, and (3) namespace-qualified blade types and commands (`ext:{id}:{name}`) to prevent collisions with core registrations. GitHub OAuth tokens must be stored in OS keychain via Rust's keyring crate, not the existing tauri-plugin-store which writes plaintext JSON. The toolbar requires a ResizeObserver-based overflow menu to prevent items from disappearing at narrow widths — especially critical before adding new GitHub action buttons.

The key risks are sandbox escape (extensions accessing core stores/FSM/IPC directly), OAuth token leakage (storing in plaintext), and lifecycle mismanagement (extensions leaving orphaned registrations after deactivation). Mitigation requires iframe or Web Worker isolation for extension code, keyring-based token storage from day one, and a dispose() protocol that cleans up all registrations when extensions are unloaded.

## Key Findings

### Recommended Stack

**No new Rust dependencies except keyring**. The extension system reuses existing serde_json (manifest parsing), tokio::fs (file loading), and notify (directory watching). GitHub OAuth Device Flow uses the existing reqwest 0.12 dependency with direct implementation (3 functions: request_device_code, poll_for_token, refresh_token) rather than adding oauth2-rs which is overkill for 3 HTTP calls. Token storage uses `keyring = "3"` crate for OS-native secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service).

**Frontend adds only Octokit packages**. The GitHub extension uses `@octokit/rest@^22`, `@octokit/graphql@^8`, and `@octokit/auth-oauth-device@^8` — all from the official GitHub SDK. These provide complete TypeScript types for 700+ GitHub API endpoints, handle pagination/rate limiting/error handling, and avoid implementing a custom HTTP client.

**Core technologies remain unchanged:** Tauri 2.x, React 19, TypeScript, Tailwind v4, Catppuccin, XState v5, Zustand 5, React Query v5, framer-motion. The toolbar overflow menu uses built-in ResizeObserver API, not a library. Extension blade rendering reuses the existing bladeRegistry Map and BladeRenderer component. Extension command registration extends the existing commandRegistry array.

**What NOT to add:**
- ~~tauri-plugin-stronghold~~ (deprecated in v3, requires user password)
- ~~tauri-plugin-http~~ (GitHub API calls via frontend Octokit using fetch)
- ~~iframe sandboxing for v1.5~~ (premature; adds message-passing complexity for first-party extension only)
- ~~@radix-ui/react-dropdown-menu~~ (already have framer-motion for overflow menu)
- ~~Full JSON Schema validator~~ (TypeScript type guards sufficient for <15 manifest fields)

### Expected Features

**Must have (table stakes) — Extension System:**
- Extension manifest format (flowforge.extension.json declaring blades, commands, metadata)
- Install from GitHub URL (clone, validate manifest, activate without restart)
- Lifecycle hooks (onActivate/onDeactivate with cleanup)
- Extension manager UI blade (list installed, enable/disable, uninstall)
- Enable/disable toggle (persist state, skip activation when disabled)
- Uninstall cleanly (deactivate, unregister, delete files)

**Must have (table stakes) — GitHub Integration:**
- OAuth sign-in (Device Flow with localhost redirect or deep linking)
- View PRs (list with title, author, status, CI checks)
- View issues (list with filters)
- Merge PR (with strategy selector: merge/squash/rebase)
- Close/reopen issues
- Account-repo linking (detect GitHub remotes, associate with OAuth account)
- Secure token storage (OS keychain, not plaintext)

**Must have (table stakes) — Toolbar UX:**
- Action grouping by intent (Navigation, Git Actions, Views, App — separated by dividers)
- Overflow menu (kebab icon, collapse secondary actions at narrow widths)
- Consistent iconography (icon-only with ShortcutTooltip, no mixing icon+text)
- Contextual actions (hide repo actions when no repo open)
- Keyboard shortcuts for all actions (already have most, add missing)
- Tooltips on every action (WCAG 2.1 AA requirement)

**Should have (competitive differentiators):**
- Hot-reload extensions in dev mode (watch extension dir, clear/re-register)
- Extension permissions model (manifest declares `network`, `filesystem`, `git-operations`; install flow shows review)
- PR diff viewer integrated with existing diff blade (reuse DiffSource union with github-pr variant)
- PR status checks display (CI badges on PR list items)
- Create PR from current branch (pre-fill title/body from commits)
- Customizable toolbar (drag-and-drop reorder, show/hide toggles)

**Defer (v2+):**
- Extension marketplace/registry (start with GitHub URL install only)
- Full PR review with inline comments (complex position mapping logic)
- Extension dependency resolution (extensionDependencies in manifest)
- Toolbar profiles per workflow ("review" vs "develop" configurations)
- Extension auto-update (security risk; manual update with changelog review)

### Architecture Approach

**Three-layer extension system** that extends the existing blade/command/store registries without breaking type safety. ExtensionHost is a singleton that discovers manifests from `.flowforge/extensions/*/manifest.json`, dynamically imports extension code via `import(/* @vite-ignore */ mainUrl)`, and calls `activate(api)`. ExtensionAPI is a per-extension facade that wraps `registerBlade()`, `registerCommand()`, `toolbarRegistry.contribute()`, and `stores.create()` while tracking all registrations for cleanup. On deactivation, `api.dispose()` removes all registrations, resets stores, and removes event listeners.

**Type system changes for extension blade types**: The existing `BladeType` union of 15 core types (string literals from `BladePropsMap`) is extended with `ExtensionBladeType = \`ext:${string}:${string}\`` to allow runtime-registered types while preserving type safety for core blades. Extension blade types are namespace-qualified (`ext:github:pr-list`) to prevent collisions. The navigation machine's singleton guard checks both the hardcoded `SINGLETON_TYPES` set and extension manifests.

**Toolbar transforms from static JSX to data-driven registry**: The current `Header.tsx` has 16 hardcoded buttons in a flat row. The new `toolbarRegistry` (Map of ToolbarAction objects) enables both core and extension-contributed actions. Actions have priority (core 0-99, extensions 100+), group (for overflow menu sections), and `when` conditions (e.g., `"repo.isOpen && github.isAuthenticated"`). A `useToolbarOverflow` hook with ResizeObserver measures available space and splits actions into visible vs. overflow based on priority.

**Hybrid Rust + JS architecture for GitHub integration**: OAuth Device Flow runs in Rust (requires background polling, OS keychain access, browser launching via opener plugin). API calls run in frontend via Octokit (TypeScript types, React Query integration, avoids 50+ Tauri commands for GitHub endpoints). Rust exposes 3 commands: `store_github_token()`, `get_github_token()`, `delete_github_token()` using keyring crate.

**Major components:**
1. **ExtensionHost (new)** — Discovers, loads, activates, deactivates extensions. Manages lifecycle. Owns ExtensionAPI factory.
2. **ExtensionAPI (new)** — Sandboxed per-extension facade tracking registrations for cleanup. Exposes blades, commands, toolbar, stores, events, context namespaces.
3. **toolbarRegistry (new)** — Ordered list of toolbar actions with priority, visibility rules, overflow grouping.
4. **SecureTokenStore (new)** — Rust keyring wrapper for OAuth tokens. Exposes via Tauri commands.
5. **GitHubClient (new)** — Frontend Octokit wrapper with token from keyring, used by React Query.
6. **bladeRegistry (modified)** — Add `unregisterBlade()`, accept ExtensionBladeType strings.
7. **commandRegistry (modified)** — Add `unregisterCommand()`, change `CommandCategory` from union to string.
8. **navigationMachine (modified)** — Singleton guard checks extension manifests for blade singleton status.

### Critical Pitfalls

1. **Extension Code Escaping the Sandbox (#25)** — Extensions loaded via `import()` run in the same JavaScript Realm as core app, gaining full access to Zustand stores, XState actor, Tauri IPC. Prevention: Run extension logic in sandboxed iframe with `sandbox="allow-scripts"` and no `allow-same-origin`, communicating via postMessage(), OR use Web Worker with Blob URL for non-UI extensions. Never allow extensions to import from core modules or access `window.__TAURI__`.

2. **GitHub OAuth Token Stored in Plaintext (#27)** — Using the existing `tauri-plugin-store` (which writes `flowforge-settings.json` as plaintext) leaks tokens to filesystem. Prevention: Use `keyring` crate in Rust for OS-native secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service). Never store tokens in tauri-plugin-store or any JSON file. Store only boolean `isGitHubConnected` flag in preferences; retrieve token from keyring at runtime.

3. **CSP is Null — Extensions Widen Attack Surface (#28)** — Current `tauri.conf.json` has `"csp": null`. Adding external network requests (GitHub API) and extension system without CSP means any XSS grants full IPC access. Prevention: Set strict CSP before adding GitHub/extensions: `default-src 'self'; script-src 'self'; connect-src 'self' https://api.github.com https://github.com; img-src 'self' https://avatars.githubusercontent.com data:; style-src 'self' 'unsafe-inline'`. Sanitize all GitHub API responses (PR bodies can contain XSS payloads) before rendering.

4. **Extension BladeType Collisions with Core Registry (#26)** — Extensions registering blade types that collide with 15 core types or other extensions. The `BladeType` union is compile-time closed; `registerBlade()` silently overwrites. Prevention: Namespace extension blade types (`ext:{extension-id}:{blade-name}`). Create `ExtensionBladeType` string type with runtime validation alongside compile-time `BladeType` union. Add guard in `registerBlade()` rejecting registration of core blade types by extensions.

5. **Extension Lifecycle Misalignment with Navigation Machine (#32)** — Extensions register blades/commands/stores, then user navigates (`SWITCH_PROCESS`, `RESET_STACK`) or extension is deactivated. Registrations persist as orphans. Prevention: Extension activation must return `dispose()` function removing all registrations. Track registrations per extension in `Map<extensionId, Registration[]>`. On deactivation: call `dispose()`, verify cleanup. Never allow extensions to modify global store reset.

6. **Toolbar Overflow Menu Loses Items Without User Awareness (#33)** — Current `Header.tsx` renders 10+ buttons in flex row. At narrow widths items overflow invisibly or wrap to second line. Prevention: Implement `useToolbarOverflow` hook using ResizeObserver to measure space, split actions into visible vs. overflow based on priority, show overflow menu button with count badge ("... +4"), follow W3C APG toolbar pattern for keyboard accessibility.

7. **GitHub API Rate Limits Hit Silently (#31)** — 5,000 req/hr authenticated, 60/hr unauthenticated. API calls start returning 403/429 with no user feedback. Prevention: Read `X-RateLimit-Remaining` header on every response, store in Zustand, show indicator when remaining < 100, show toast with reset time when limited, use conditional requests with ETag (304 responses don't count), prefer GraphQL over REST (single request vs. 3+ REST calls), cache with React Query `staleTime: 30_000`.

## Implications for Roadmap

Based on research, the milestone naturally decomposes into a **3-phase structure with security hardening as a prerequisite**. The extension system must be fully operational before GitHub integration ships as the first extension (dogfooding the API). Toolbar overhaul precedes GitHub button additions to avoid worsening existing overflow issues.

### Phase 0: Security Hardening (Prerequisite)
**Rationale:** CSP enforcement and capability scoping must happen before introducing external network access (GitHub API) or untrusted code execution (extensions). Retrofitting security after architectural decisions is a rewrite.

**Delivers:**
- Strict CSP in `tauri.conf.json`: `default-src 'self'; script-src 'self'; connect-src 'self' https://api.github.com https://github.com`
- Asset protocol scope narrowed from `["**"]` to specific directories
- Capability audit: ensure no overly broad permissions in `default.json`

**Addresses Pitfalls:** #28 (CSP null)

**Duration:** 1-2 days (config changes, testing)

### Phase 1: Extension System Foundation + Toolbar Overhaul (Parallel)
**Rationale:** Build the extension infrastructure before GitHub integration because GitHub ships AS an extension. This dogfoods the extension API and proves the architecture. Toolbar overhaul in parallel prepares the header for new GitHub action buttons without worsening overflow.

**Delivers:**

**Extension System:**
- Extension manifest schema (`flowforge.extension.json` with id, version, name, contributes.blades/commands/toolbar)
- Rust: `extensions.rs` module (discover manifests via tokio::fs, validate schema)
- TypeScript: ExtensionHost singleton (discover, activate, deactivate lifecycle)
- ExtensionAPI facade (per-extension API wrapper tracking registrations)
- Type system changes: `ExtensionBladeType`, widen `BladeType` union, namespace enforcement
- bladeRegistry modifications: add `unregisterBlade()`, accept string types
- commandRegistry modifications: add `unregisterCommand()`, make `CommandCategory` string
- navigationMachine singleton guard: check extension manifests
- Extension enable/disable toggle (persist in preferences, skip activation)

**Toolbar Overhaul:**
- toolbarRegistry (Map of ToolbarAction with priority, group, when, badge)
- Core toolbar actions migrated from Header.tsx to registry
- useToolbarActions hook (subscribe to registry changes)
- useToolbarOverflow hook (ResizeObserver-based space measurement)
- ToolbarButton component (enforces aria-label, icon, tooltip pattern)
- OverflowMenu component (grouped dropdown with framer-motion animations)
- Action grouping with visual dividers (Navigation | Git Actions | Views | App)
- Consistent iconography audit (all icon-only with ShortcutTooltip)

**Addresses Features:**
- Extension manifest format (table stakes)
- Extension lifecycle hooks (table stakes)
- Extension enable/disable (table stakes)
- Action grouping by intent (table stakes)
- Overflow menu (table stakes)
- Consistent iconography and tooltips (table stakes)

**Avoids Pitfalls:** #26 (blade collisions), #29 (command collisions), #32 (lifecycle mismanagement), #33 (toolbar overflow), #37 (inconsistent patterns)

**Research Flag:** LOW — Extension system patterns well-documented (VS Code), toolbar overflow is standard UX pattern (PatternFly, APG). Implementation straightforward given existing registries.

**Duration:** 1-2 weeks

### Phase 2: GitHub Integration as First Extension
**Rationale:** GitHub integration proves the extension system works. It's the killer demo and the most-requested feature for any Git client. Ships as an installable extension in `.flowforge/extensions/github-integration/`, demonstrating the full extension lifecycle.

**Delivers:**

**Credential Infrastructure:**
- Rust: `credentials.rs` module (keyring crate integration)
- Tauri commands: `store_github_token()`, `get_github_token()`, `delete_github_token()`
- Frontend: DeviceFlowDialog component (show code, polling state, time remaining)

**GitHub Extension:**
- Extension manifest (`flowforge.extension.json` declaring blades, commands, toolbar contributions)
- OAuth Device Flow implementation (`@octokit/auth-oauth-device` with `onVerification` callback)
- GitHubClient wrapper (Octokit + token from keyring)
- useGitHubPRs / useGitHubIssues React Query hooks (cache with 30s staleTime)
- GitHubPRListBlade component (list with status indicators, click to open detail blade)
- GitHubIssueListBlade component (list with filters)
- GitHubPRDetailBlade component (fetch PR details, comments, checks)
- Toolbar contributions (PR count badge, "Open PRs" action with `when: "github.isAuthenticated && repo.hasRemote"`)
- Remote detection (parse `.git/config` remotes for `github.com` patterns)
- Rate limit tracking (read `X-RateLimit-Remaining` header, store in Zustand, show UI indicator)

**Extension Manager UI:**
- Extension manager blade (list installed, enable/disable toggles, uninstall buttons)
- Extension installation from GitHub URL (clone, validate manifest, activate)
- Extension categories display (blade, integration, theme, workflow, tool)

**Addresses Features:**
- GitHub OAuth sign-in (table stakes)
- View PRs/issues (table stakes)
- Merge PR (deferred to Phase 3 — write actions need careful UX)
- Close/reopen issues (table stakes)
- Account-repo linking (table stakes)
- Secure token storage (table stakes)
- Install from GitHub URL (table stakes)
- Extension manager UI (table stakes)

**Avoids Pitfalls:** #25 (sandbox escape — deferred to v2), #27 (plaintext tokens), #30 (Device Flow polling cleanup), #31 (rate limits), #34 (identity mismatch), #35 (FSM corruption)

**Research Flag:** MEDIUM — OAuth Device Flow well-documented, but Tauri integration needs validation. Octokit setup straightforward. Extension lifecycle dogfooding may reveal gaps in Phase 1 API design.

**Duration:** 2-3 weeks

### Phase 3: GitHub Write Actions + Extension Polish
**Rationale:** After read operations (view PRs/issues) work, add write actions (merge, close, create PR). Polish the extension experience with hot-reload for development, permissions display, and error boundaries.

**Delivers:**

**GitHub Write Actions:**
- Merge PR with strategy selector (merge commit, squash, rebase) and confirmation dialog
- Close/reopen issues with confirmation
- Create PR from current branch (pre-fill title from branch name, body from commit messages since divergence)
- PR status checks display (CI badges on PR list items using Octokit `checks.listForRef()`)

**Extension Polish:**
- Hot-reload extensions in dev mode (watch extension dir with `@tauri-apps/plugin-fs` watcher, clear/re-register)
- Extension error boundaries (catch activation/deactivation failures, show error UI)
- Extension settings UI (enable/disable via settings blade, not just extension manager)
- GitHub extension: reviews display (show review status on PR detail blade)
- GitHub extension: branch-PR association (show PR badge on branch list items)

**Addresses Features:**
- Merge PR (table stakes)
- Close/reopen issues (table stakes, deferred from Phase 2)
- Create PR (differentiator)
- PR status checks display (differentiator)
- Hot-reload extensions (differentiator)

**Avoids Pitfalls:** #41 (HMR subscription leaks), #38 (manifest validation too late)

**Research Flag:** LOW — Write operations are straightforward Octokit calls with confirmation UX.

**Duration:** 1-2 weeks

### Phase Ordering Rationale

**Why security hardening first:** CSP enforcement is a config change that breaks nothing but must be in place before network access or extension loading. Retrofitting is painful.

**Why extension system before GitHub integration:** GitHub integration dogfoods the extension API. Building the extension first would lead to a bespoke integration that doesn't use the extension system, defeating the purpose. Building them simultaneously risks the extension API being designed around a single use case (GitHub) instead of being general-purpose.

**Why toolbar overhaul before GitHub buttons:** The current toolbar has no overflow strategy. Adding 2-3 GitHub buttons (PRs, Issues, Create PR) would push the toolbar past the breaking point at narrow widths. Fix overflow first, then add buttons.

**Why read operations before write operations:** Users need to view PRs/issues before merging/closing them. Read-only operations establish the data flow patterns (Octokit + React Query + Zustand) before adding confirmation dialogs and error handling for write operations.

**Dependencies:** Phase 0 → Phase 1 (CSP must be set before extensions load). Phase 1 → Phase 2 (extension system must exist before GitHub extension). Phase 2 → Phase 3 (write actions depend on read operations working). Toolbar overhaul (Phase 1) is independent of extension system and can run in parallel, but both must complete before Phase 2.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 2:** OAuth Device Flow integration with Tauri (localhost redirect vs. deep linking trade-offs), keyring crate platform quirks, extension manifest schema validation approach.
- **Phase 3:** Hot-reload mechanism for extensions (HMR integration with dynamic import), error boundary patterns for async extension loading.

**Phases with standard patterns (skip research-phase):**
- **Phase 0:** CSP configuration is documented in Tauri v2 security guide.
- **Phase 1:** Extension lifecycle (VS Code pattern), toolbar overflow (PatternFly, W3C APG), registry modifications (existing patterns in codebase).
- **Phase 3:** GitHub write actions (Octokit documentation is comprehensive), PR status checks (standard REST API calls).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependencies verified: keyring 3.6.3 on crates.io, @octokit/rest 22.0.1 on npm, @octokit/auth-oauth-device 8.0.3 on npm. No new dependencies required for extension system (reuses existing serde/tokio/notify). |
| Features | HIGH | Table stakes validated against competitor analysis (GitHub Desktop lacks PR review, GitKraken has it but paywalled). VS Code extension manifest format is industry gold standard (17 years, 30+ contribution points). |
| Architecture | MEDIUM | Extension system patterns well-established in VS Code/Figma docs. Integration with FlowForge's specific blade/store/FSM architecture needs validation during implementation. Type system changes (ExtensionBladeType) are novel but TypeScript's template literal types support this pattern. |
| Pitfalls | HIGH | Sandbox escape (#25) validated by Figma post-mortem and Zendesk engineering blog. Token storage (#27) confirmed by Tauri docs (Stronghold deprecated). CSP (#28) directly verified from codebase `tauri.conf.json`. Collision pitfalls (#26, #29) verified from registry source code. |

**Overall confidence:** HIGH

### Gaps to Address

**Sandbox approach for v1.5:** Research recommends iframe or Web Worker isolation, but the proposed Phase 1 does NOT include sandboxing because the GitHub extension is first-party code shipped with FlowForge. The manifest-driven architecture and namespace enforcement prevent accidental collisions, but do not prevent intentional malicious behavior. Decision: defer full sandboxing to v2 when third-party extensions are supported. Phase 1 establishes the extension API surface that will be sandboxed later.

**GraphQL vs REST for GitHub API:** Research recommends GraphQL-first for read operations (single query fetches PR + reviews + CI status vs. 3+ REST calls), but Octokit REST has better TypeScript types and simpler pagination. Decision: start with REST for Phase 2 MVP (view PRs/issues, merge PR). Consider GraphQL in Phase 3 if N+1 query problems emerge or rate limits become an issue.

**Extension hot-reload mechanism:** Research identifies the need but does not specify implementation. Gap: how does dynamic `import()` interact with Vite HMR? Does the extension need its own Vite config? Does the extension host need to bust import caches? Address during Phase 3 planning with a research spike.

**Toolbar action priority values:** Research establishes priority-based ordering (core 0-99, extensions 100+) but does not assign specific values to existing core actions. Gap: audit existing Header.tsx buttons, assign priority values (e.g., Settings 10, Refresh 20, Sync 30), document the priority ranges per group. Address during Phase 1 planning.

**Extension API version negotiation:** Research identifies the need for `apiVersion` in manifests and version checking at load time, but does not specify the versioning scheme or compatibility rules. Gap: define semantic versioning for extension API (1.0.0 for v1.5 launch?), define compatibility shim strategy (support one major version back?). Address during Phase 1 planning.

## Sources

### Primary (HIGH confidence)
- [STACK.md] — Technology recommendations with version verification, rationale for keyring over Stronghold, Octokit package selection, justification for no new extension system dependencies
- [FEATURES.md] — Table stakes vs. differentiators from VS Code extension patterns, GitHub Desktop/GitKraken competitive analysis, feature dependencies graph, MVP recommendations per phase
- [ARCHITECTURE.md] — Three-layer extension system design, ExtensionHost/ExtensionAPI architecture, type system changes for ExtensionBladeType, toolbar registry patterns, data flow diagrams, build order dependency graph
- [PITFALLS.md] — 18 new pitfalls (#25-42) specific to extension system, GitHub integration, toolbar UX; prevention strategies with code examples; phase mapping; anti-patterns section

### Secondary (MEDIUM confidence)
- [GitHub OAuth Device Flow docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) — polling protocol, timeout behavior, error codes
- [VS Code Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest) — contribution points pattern, activation events, engine compatibility
- [Figma Plugin Security Update](https://www.figma.com/blog/an-update-on-plugin-security/) — sandbox escape vulnerabilities in Realm-based approach
- [Tauri v2 Security](https://v2.tauri.app/security/) — CSP configuration, capability scoping, IPC attack surface
- [W3C APG Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) — keyboard navigation, roving tabindex, accessibility requirements
- [PatternFly Overflow Menu](https://www.patternfly.org/components/overflow-menu/design-guidelines/) — priority-based collapse, grouped overflow patterns

### Tertiary (LOW confidence)
- [keyring-rs crate docs](https://docs.rs/keyring) — OS keychain integration, platform-specific features
- [Octokit REST v22 docs](https://octokit.github.io/rest.js/v22/) — API coverage, pagination, type definitions
- [Zendesk: Sandboxing JavaScript](https://medium.com/zendesk-engineering/sandboxing-javascript-e4def55e855e) — Web Worker vs iframe isolation trade-offs

---

**Research completed:** 2026-02-09

**Ready for roadmap:** Yes

**Key takeaway for roadmapper:** This is a security-sensitive milestone. Extension system and GitHub integration introduce untrusted code execution and external network access to a previously local-only app. CSP hardening is non-negotiable prerequisite. Extension API design in Phase 1 must support future sandboxing even if v1.5 ships without full isolation. OAuth token storage in keyring (not plaintext) is mandatory from day one.
