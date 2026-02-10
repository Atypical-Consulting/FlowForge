# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** The intelligence is in the agent; the authority is in the infrastructure.
**Current focus:** Phase 36 - GitHub Write Operations & Extension Manager (complete)

## Current Position

Phase: 36 of 36 (GitHub Write Operations & Extension Manager)
Plan: 3 of 3 complete
Status: Checkpoint Pending (visual verification)
Last activity: 2026-02-10 — All 3 plans complete (Rust backend + frontend components + integration wiring)

Progress: [████████████████████] 100%

## Milestone History

| Milestone | Status | Shipped |
|-----------|--------|---------|
| v1.0.0 MVP | Complete | 2026-02-04 |
| v1.1.0 Usability | Complete | 2026-02-06 |
| v1.2.0 Bugfixing & Polish | Complete | 2026-02-07 |
| v1.3.0 Blades Blades Blades | Complete | 2026-02-08 |
| v1.4.0 Architecture & Navigation Overhaul | Complete | 2026-02-09 |
| v1.5.0 GitHub Extension | In progress | — |

See `.planning/MILESTONES.md` for full history.

## Performance Metrics

**Cumulative:**
- Total phases: 36 complete
- Total plans: ~205 complete
- Total requirements validated: 209 (all v1.5 requirements covered)
- Codebase: ~36,946 LOC (28,155 TypeScript + 8,791 Rust)
- Tests: 137 (Vitest + jsdom)

**Plan 33-01:** 12min, 3 tasks, 10 files modified
**Plan 33-02:** 18min, 2 tasks, 5 files modified
**Plan 33-03:** 6min, 4 tasks, 6 files modified
**Plan 34-01:** 16min, 2 tasks, 10 files modified
**Plan 34-02:** 7min, 2 tasks, 6 files modified
**Plan 34-03:** 11min, 2 tasks (auto) + 1 checkpoint, 11 files modified
**Plan 35-01:** 15min, 2 tasks, 8 files modified
**Plan 35-02:** 6min, 2 tasks, 8 files modified
**Plan 35-03:** 8min, 2 tasks (auto) + 1 checkpoint, 5 files modified
**Plan 36-01:** 8min, 7 tasks (Rust backend), 10 files modified
**Plan 36-02:** 12min, 12 files created/modified (frontend components)
**Plan 36-03:** 6min, 6 files modified (integration wiring)

## Accumulated Context

### Known Tech Debt

- 16 backward-compatibility re-export shims (@deprecated) — gradual migration needed
- CC blade accessibility polish (aria-live debounce, amend mode styling, aria-labels)
- Init Repo blade UX refinements (focus behavior, listbox pattern, aria-describedby)
- 3D viewer reliability on some hardware (diagnostic logging only)
- Pre-existing TS2440 in auto-generated bindings.ts

### Key Decisions

All decisions logged in PROJECT.md Key Decisions table with outcomes marked.

**Phase 32-01 decisions:**
- Used union type for ToolbarGroup (not enum) so Phase 33 extensions can extend with custom group strings
- Map<string, ToolbarAction> with immutable copy-on-write for O(1) ID lookups
- Toolbar action ID convention: core="tb:{name}", extensions="ext:{extId}:{name}"
- Extracted queryClient to shared lib module for non-React query invalidation access

**Phase 32-02 decisions:**
- ThemeToggle rendered as compound widget via ID check (tb:theme-toggle) with data-toolbar-item wrapper
- ResizeObserver uses prevWidth ref + requestAnimationFrame to avoid infinite-loop pitfall
- ToolbarSettings shows ALL actions (not filtered by when()) for full configurability
- data-toolbar-item attribute pattern for both overflow measurement and roving tabindex

**Phase 33-01 decisions:**
- Record<string, unknown> for navigation event props (machine does not inspect props)
- Function overloads for core type-safety + extension string flexibility in blade openers
- Replaced static SINGLETON_TYPES Set with dynamic isSingletonBlade() from bladeRegistry
- (string & {}) trick to widen CommandCategory while preserving IDE autocompletion

**Phase 33-02 decisions:**
- serde rename_all camelCase on ExtensionManifest for direct JSON field mapping
- base_path field uses serde(default) -- absent in JSON, populated by discovery after parsing
- Invalid manifests are logged and skipped (eprintln), never crash the discovery process

**Phase 33-03 decisions:**
- convertFileSrc from @tauri-apps/api/core for dynamic import URLs (Tauri asset protocol)
- Module-level Maps for extensionApis/extensionModules outside Zustand (non-serializable JS refs)
- ExtensionAPI.registerBlade maps config.title to BladeRegistration.defaultTitle for simpler extension API
- Sequential await in activateAll/deactivateAll to avoid registry mutation race conditions

**Phase 34-01 decisions:**
- Single-poll command pattern: frontend controls device flow polling loop via setTimeout, each poll is one Tauri command
- Token never returned to frontend: AuthResult carries authenticated/username/avatar_url/scopes only
- keyring v3 with explicit platform features for macOS Keychain, Windows Credential Manager, Linux Secret Service
- Added reqwest form feature for OAuth form-encoded POST bodies
- GitHub module as peer of git/ and gitflow/ (core commands, not Tauri plugin)

**Phase 34-02 decisions:**
- renderCustom on ToolbarAction replaces hardcoded ID checks -- fully generic widget rendering
- createElement(ThemeToggle) in .ts file avoids TSX requirement for toolbar-actions
- registerBuiltIn creates synthetic ExtensionManifest with 'as ExtensionManifest' cast for tracking
- Built-in extensions share full ExtensionAPI lifecycle -- same cleanup, deactivation, namespacing

**Phase 34-03 decisions:**
- Added GitHub command bindings manually to bindings.ts (pending specta regeneration on next tauri dev)
- navigator.clipboard.writeText instead of Tauri clipboard plugin (avoids dependency, works cross-env)
- Dynamic import for blade components in extension entry point (code splitting, avoids circular deps)
- Repo change detection via plain subscribe + prevPath comparison (no subscribeWithSelector needed)
- Module-level pollTimeoutId outside Zustand store (non-serializable setTimeout reference)
- Auth state persists across repo switches; only detectedRemotes is reset on repo change

**Phase 35-01 decisions:**
- Manual query string construction instead of reqwest .query() (avoids missing feature dependency in reqwest 0.13)
- Concrete PullRequestListResponse/IssueListResponse instead of generic Paginated<T> (specta generics pitfall)
- Internal deserialization types separate from IPC types for clean snake_case/camelCase boundary
- client::github_get / github_get_with_params pattern as reusable authenticated helpers for all GitHub API modules

**Phase 35-02 decisions:**
- ext:github query key prefix for all GitHub TanStack Query hooks (cache isolation from core queries)
- Manual bindings.ts additions for 4 GitHub read commands and 10 IPC types (pending specta regen)
- No setInterval in TimeAgo -- re-rendered on parent rerender from query refetch
- Inline styles for LabelPill colors because Tailwind v4 cannot generate dynamic hex at build time
- getSelectedRemote() as standalone function (not hook) for non-React access to selected remote

**Phase 35-03 decisions:**
- Virtuoso for infinite scroll list rendering in both PR and issue list blades
- Separated inner list component from outer blade to avoid conditional hook calls (remote guard in outer, hooks in inner)
- queryClient.removeQueries with ext:github key prefix for targeted cache cleanup on deactivation and repo switch
- Toolbar actions in views group (not app group) with auth+remote when() conditions

**Phase 36-01 decisions:**
- 30s timeout for POST/PUT (vs 15s for GET) since write ops may take longer
- Extension install uses rename first (same filesystem), falls back to recursive copy
- Branch info uses spawn_blocking for git2 operations (matches existing pattern)
- ExtensionFetchResult carries manifest JSON + temp path for two-step install flow

**Phase 36-02 decisions:**
- Extension Manager is a core blade (not extension blade) since it manages all extensions
- InstallExtensionDialog uses 6-step state machine for clear progress feedback
- MergeStrategySelector uses sr-only radio inputs for full keyboard accessibility
- IIFE patterns in JSX to avoid unknown values leaking into ReactNode positions

**Phase 36-03 decisions:**
- Merge button placed inline in PR header for maximum visibility (not renderTrailing)
- `disabled` status distinct from `deactivated` — `disabled` = user-intentional, persisted; `deactivated` = runtime cleanup
- Persistence saves disabled IDs (not enabled) — simpler and forward-compatible
- CreatePR toolbar action requires auth + remotes + branch name for visibility

### Pending Todos

None.

### Blockers/Concerns

- ~~CSP is currently null~~ — RESOLVED: Strict CSP applied in Phase 31
- ~~OAuth token storage must use OS keychain from day one, never plaintext~~ -- RESOLVED: keyring crate integrated in Phase 34-01

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 022 | Fix vertical separator stuck on left - resizable panels | 2026-02-05 | e22f4ea | [022-fix-vertical-separator-stuck-left](./quick/022-fix-vertical-separator-stuck-left/) |
| 023 | Fix app icon not filling circle on welcome page | 2026-02-05 | 65485a5 | [023-fix-app-icon-not-filling-circle-on-welco](./quick/023-fix-app-icon-not-filling-circle-on-welco/) |
| 024 | Bump version to v1.1.0 | 2026-02-06 | dfc6d4e | [024-prepare-v110-version-bump](./quick/024-prepare-v110-version-bump/) |
| 025 | Fix TAURI_CHANNEL CI pipeline failure | 2026-02-06 | c6bafb2 | [025-fix-tauri-channel-ci-pipeline](./quick/025-fix-tauri-channel-ci-pipeline/) |
| 026 | Fix DMG damaged on macOS (revert broken signing vars) | 2026-02-06 | 27011ba | [026-fix-dmg-damaged-macos-signing](./quick/026-fix-dmg-damaged-macos-signing/) |
| 027 | Improve doc website with GitFlow/Conventional Commits explanations and download button | 2026-02-08 | d0c8da3 | [27-improve-doc-website-with-gitflow-convent](./quick/27-improve-doc-website-with-gitflow-convent/) |
| 028 | Fix BladeRegistry missing registration for viewer-3d | 2026-02-09 | 977b28e | [28-fix-bladeregistry-missing-registration-f](./quick/28-fix-bladeregistry-missing-registration-f/) |
| 029 | Fix XState navigation machine stopped actor preventing blade opens | 2026-02-09 | 0410d3d | [29-fix-xstate-navigation-machine-stopped-ac](./quick/29-fix-xstate-navigation-machine-stopped-ac/) |
| 030 | Make repo-browser a singleton blade in XState navigation machine | 2026-02-09 | 415f2e7 | [30-make-repo-browser-a-singleton-blade-in-x](./quick/30-make-repo-browser-a-singleton-blade-in-x/) |
| 031 | Merge all dependabot dependency update PRs (#6-#13) | 2026-02-09 | f1b92ba | [31-merge-all-dependabot-dependency-update-p](./quick/31-merge-all-dependabot-dependency-update-p/) |
| 032 | Fix reqwest 0.13 rustls-tls feature rename breaking Rust build | 2026-02-09 | 580c044 | [32-fix-reqwest-0-13-rustls-tls-feature-rena](./quick/32-fix-reqwest-0-13-rustls-tls-feature-rena/) |

## Session Continuity

Last session: 2026-02-10
Stopped at: Phase 36 complete (all 3 plans done). v1.5.0 milestone engineering complete. Visual checkpoint pending.
Resume file: None

---
*State updated: 2026-02-10*
*v1.5.0 GitHub Extension -- Phase 36 engineering complete. All 6 phases (31-36) done. Milestone ready for visual checkpoint and archive.*
