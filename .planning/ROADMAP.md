# Roadmap: FlowForge

## Milestones

- **v1.0 MVP** - Phases 1-10 (shipped 2026-02-04) -> [archive](milestones/v1.0.0-ROADMAP.md)
- **v1.1.0 Usability** - Phases 11-15 (shipped 2026-02-06) -> [archive](milestones/v1.1.0-ROADMAP.md)
- **v1.2.0 Bugfixing & Polish** - Phases 16-19 (shipped 2026-02-07) -> [archive](milestones/v1.2.0-ROADMAP.md)
- **v1.3.0 Blades Blades Blades** - Phases 20-24 (shipped 2026-02-08) -> [archive](milestones/v1.3.0-ROADMAP.md)
- **v1.4.0 Architecture & Navigation Overhaul** - Phases 25-30 (shipped 2026-02-09) -> [archive](milestones/v1.4.0-ROADMAP.md)
- **v1.5.0 GitHub Extension** - Phases 31-36 (shipped 2026-02-10) -> [archive](milestones/v1.5.0-ROADMAP.md)
- **v1.6.0 Refactor to Extensions** - Phases 37-41 (in progress)

## Phases

- [x] **Phase 37: Extension Platform Foundation** - New registries, UI surfaces, GitHookBus, and ExtensionAPI expansion
- [x] **Phase 38: Content Viewer Extraction** - Markdown, code, and 3D viewers extracted to built-in extension
- [x] **Phase 39: Conventional Commits Extraction** - CC composer, validation, and changelog extracted to built-in extension
- [x] **Phase 40: Gitflow Extraction** - Gitflow sidebar, cheatsheet, and branch coloring extracted to built-in extension
- [ ] **Phase 41: Sandbox & Polish** - Trust flags, Worker prototype, deprecation cleanup, tests, docs, version bump

## Phase Details

### v1.6.0 Refactor to Extensions

**Milestone Goal:** Transform FlowForge from a monolithic app into a truly extensible platform where core features (Gitflow, Conventional Commits, content viewers) are optional extensions, with expanded extension hooks and sandbox infrastructure.

#### Phase 37: Extension Platform Foundation
**Goal**: Extensions can contribute context menus, sidebar panels, status bar widgets, and git operation hooks through the expanded ExtensionAPI
**Depends on**: Phase 36 (v1.5.0 extension system)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06
**Success Criteria** (what must be TRUE):
  1. Right-clicking on a file, branch, or commit shows extension-contributed context menu items
  2. An extension can register a sidebar panel section that renders in the repository view alongside core sections
  3. An extension can contribute a status bar widget that displays live state at the bottom of the window
  4. An extension receives git operation events (onDidCommit, onDidPush) when the user performs git actions
  5. An extension's onDispose callbacks fire during deactivation, cleaning up subscriptions and timers
**Plans**: 3 plans

Plans:
- [x] 37-01-PLAN.md — New registries (ContextMenu, SidebarPanel, StatusBar, GitHookBus) + tests
- [x] 37-02-PLAN.md — UI surfaces (ContextMenu component, dynamic sidebar, StatusBar component) + GitHookBus wiring
- [x] 37-03-PLAN.md — ExtensionAPI expansion and onDispose lifecycle + tests

#### Phase 38: Content Viewer Extraction
**Goal**: Markdown, code, and 3D viewers run as a single toggleable built-in extension, with graceful fallback when disabled
**Depends on**: Phase 37
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04, DEGR-04
**Success Criteria** (what must be TRUE):
  1. Opening a .md file in the file browser launches the markdown preview blade provided by the content-viewers extension
  2. Opening a source file launches the Monaco code viewer blade provided by the content-viewers extension
  3. Opening a .gltf/.glb file launches the 3D model viewer blade provided by the content-viewers extension
  4. Disabling the content-viewers extension in Extension Manager causes file previews to fall back to plain text display
**Plans**: 2 plans

Plans:
- [x] 38-01-PLAN.md — ExtensionAPI coreOverride + viewer-plaintext fallback blade
- [x] 38-02-PLAN.md — Content-viewers extension + graceful degradation

#### Phase 39: Conventional Commits Extraction
**Goal**: Conventional commit composer, validation, templates, and changelog run as a toggleable built-in extension, with plain commit form when disabled
**Depends on**: Phase 37 (git hooks for onWillCommit)
**Requirements**: CCEX-01, CCEX-02, CCEX-03, CCEX-04, CCEX-05, DEGR-03
**Success Criteria** (what must be TRUE):
  1. The conventional commit composer blade and sidebar form are provided by the CC extension, not core
  2. Commit messages are validated against conventional commit format via the onWillCommit hook registered by the CC extension
  3. Type inference, scope autocomplete, commit templates, and changelog generation are all provided by the CC extension
  4. Disabling the CC extension removes commit validation and the CC form -- the commit textarea becomes a plain text input
**Plans**: TBD

Plans:
- [x] 39-01-PLAN.md — CC extension entry point, blade registration, CommitForm gating
- [x] 39-02-PLAN.md — emitWill pre-commit hook, toolbar and command contributions
- [x] 39-03-PLAN.md — Extension lifecycle tests and CommitForm degradation tests

#### Phase 40: Gitflow Extraction
**Goal**: Gitflow sidebar, cheatsheet, branch coloring, and merge flows run as a toggleable built-in extension, enabling plain Git client mode when disabled
**Depends on**: Phase 37 (sidebar panels, git hooks, status bar), Phase 38-39 (proven extraction patterns)
**Requirements**: GFEX-01, GFEX-02, GFEX-03, GFEX-04, GFEX-05, GFEX-06, DEGR-01, DEGR-02
**Success Criteria** (what must be TRUE):
  1. The Gitflow sidebar panel (branch creation, merge flows) is contributed by the Gitflow extension via the SidebarPanelRegistry
  2. Gitflow cheatsheet blade and pre-merge review checklist are provided by the Gitflow extension
  3. Branch classification and color-coding remains in core (ADR-2: 10+ core consumers including topology graph and branch list; classification is core Git UX, not Gitflow-specific)
  4. Disabling the Gitflow extension removes all Gitflow UI -- sidebar sections, cheatsheet blade, toolbar button, command palette entry -- and core Git operations (including branch coloring) remain fully functional
  5. Extension Manager blade shows Gitflow, Conventional Commits, Content Viewers, and GitHub as four independently toggleable extensions
**Plans**: 2 plans

Plans:
- [x] 40-01-PLAN.md -- Create gitflow extension entry point, register in App.tsx, remove core registrations
- [x] 40-02-PLAN.md -- Extension lifecycle tests and graceful degradation verification

#### Phase 41: Sandbox & Polish
**Goal**: Extension sandbox infrastructure is prepared for future third-party extensions, deprecated code is removed, and v1.6.0 ships with full test coverage and documentation
**Depends on**: Phase 40
**Requirements**: SAND-01, SAND-02, SAND-03, MAINT-01, MAINT-02, MAINT-03, MAINT-04
**Success Criteria** (what must be TRUE):
  1. Extension manifest distinguishes built-in (trusted) from external extensions via a trust level flag
  2. A Worker-based sandbox prototype demonstrates postMessage communication between host and isolated extension code
  3. ExtensionAPI methods are classified as sandbox-safe vs requires-trust, documented in code
  4. The 16 deprecated re-export shims from v1.4 are removed and all consumers use direct imports
  5. Extension lifecycle tests cover activate, deactivate, and registry cleanup for all new registries
**Plans**: 5 plans

Plans:
- [ ] 41-01-PLAN.md -- Trust level flag in manifest + API method sandbox classification
- [ ] 41-02-PLAN.md -- Remove 16 deprecated store re-export shims, update all consumers
- [ ] 41-03-PLAN.md -- Worker-based sandbox prototype with postMessage bridge
- [ ] 41-04-PLAN.md -- Extension lifecycle tests (GitHub extension + ExtensionHost)
- [ ] 41-05-PLAN.md -- Extension developer documentation + version bump to v1.6.0

## Progress

<details>
<summary>v1.0.0 MVP (Phases 1-10) -- SHIPPED 2026-02-04</summary>

- [x] Phase 1: Foundation (3/3 plans)
- [x] Phase 3: Core Git & Branches (6/6 plans)
- [x] Phase 4: Gitflow State Machine (5/5 plans)
- [x] Phase 5: Topology Visualization (5/5 plans)
- [x] Phase 6: Conventional Commits (4/4 plans)
- [x] Phase 6.1: Catppuccin Mocha File Icons (2/2 plans)
- [x] Phase 6.2: UX/UI Enhancements (9/9 plans)
- [x] Phase 7: Worktree Management (4/4 plans)
- [x] Phase 8: Polish & Performance (6/6 plans)

</details>

<details>
<summary>v1.1.0 Usability (Phases 11-15) -- SHIPPED 2026-02-06</summary>

- [x] Phase 11: Foundation (5/5 plans)
- [x] Phase 12: Workflows (6/6 plans)
- [x] Phase 13: Navigation (5/5 plans)
- [x] Phase 14: UI Polish (4/4 plans)

</details>

<details>
<summary>v1.2.0 Bugfixing & Polish (Phases 16-19) -- SHIPPED 2026-02-07</summary>

- [x] Phase 16: Quick Fixes & Visual Polish (3/3 plans)
- [x] Phase 17: Hierarchical View & Commit Enhancements (4/4 plans)
- [x] Phase 18: Command Palette & Discoverability (4/4 plans)
- [x] Phase 19: Settings, Onboarding & File Icons (6/6 plans)

</details>

<details>
<summary>v1.3.0 Blades Blades Blades (Phases 20-24) -- SHIPPED 2026-02-08</summary>

- [x] Phase 20: Blade Infrastructure & Modal Migration (8/8 plans)
- [x] Phase 20.1: Blade Extensibility Refactoring (6/6 plans)
- [x] Phase 21: Two-Column Staging & Inline Diff (5/5 plans)
- [x] Phase 22: New Content Blades (26/26 plans)
- [x] Phase 23: Branch Management (7/7 plans)
- [x] Phase 24: Code Review Guidance & Documentation (4/4 plans)

</details>

<details>
<summary>v1.4.0 Architecture & Navigation Overhaul (Phases 25-30) -- SHIPPED 2026-02-09</summary>

- [x] Phase 25: Test Infrastructure Foundation (3/3 plans)
- [x] Phase 26: XState Navigation FSM (4/4 plans)
- [x] Phase 27: Init Repo Blade (4/4 plans)
- [x] Phase 28: Conventional Commit Blade (5/5 plans)
- [x] Phase 29: Blade-Centric File Structure (6/6 plans)
- [x] Phase 30: Store Consolidation & Tech Debt (7/7 plans)

</details>

<details>
<summary>v1.5.0 GitHub Extension (Phases 31-36) -- SHIPPED 2026-02-10</summary>

- [x] Phase 31: Security Hardening (2/2 plans)
- [x] Phase 32: Toolbar Overhaul (2/2 plans)
- [x] Phase 33: Extension System Foundation (3/3 plans)
- [x] Phase 34: GitHub Authentication (3/3 plans)
- [x] Phase 35: GitHub Read Operations (3/3 plans)
- [x] Phase 36: GitHub Write Operations & Extension Manager (3/3 plans)

</details>

### v1.6.0 Refactor to Extensions (In Progress)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 37. Extension Platform Foundation | 3/3 | ✓ Complete | 2026-02-10 |
| 38. Content Viewer Extraction | 2/2 | ✓ Complete | 2026-02-10 |
| 39. Conventional Commits Extraction | 3/3 | ✓ Complete | 2026-02-10 |
| 40. Gitflow Extraction | 2/2 | ✓ Complete | 2026-02-10 |
| 41. Sandbox & Polish | 0/5 | Not started | - |

---
*Last updated: 2026-02-10 after Phase 40 completion*
