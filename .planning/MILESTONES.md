# Project Milestones: FlowForge

## v1.3.0 Blades Blades Blades (Shipped: 2026-02-08)

**Delivered:** Expanded blade navigation into the primary interaction model — migrated 3 modals to blades, built extensible blade registry, added 5 new content blades (markdown, code, 3D, repo browser, Gitflow cheatsheet), two-column staging with inline diff, branch management hub, pre-merge review checklist, and documentation website.

**Phases completed:** 20-24 (6 phases, ~56 plans, 25 requirements)

**Key accomplishments:**

- Migrated 3 modal dialogs (Settings, Changelog, Conventional Commit) to blade navigation system
- Built extensible blade registry — adding a new blade type requires only 1-2 files instead of 4-7
- Implemented two-column staging layout with inline diff preview and expand-to-fullscreen
- Added 5 new content blades: Markdown preview, Code viewer, 3D model viewer, Repo browser, Gitflow cheatsheet
- Delivered branch management hub with pin/favorites, scope selector, bulk delete, and feature branch coloring
- Added pre-merge review checklist for Gitflow workflows and published documentation website on GitHub Pages

**Stats:**

- 253 files changed (+39,773/-1,262 lines)
- ~29,590 lines of code (21,189 TypeScript + 8,401 Rust)
- 6 phases, ~56 plans, 25 requirements
- 2 days (2026-02-07 → 2026-02-08)
- 112 commits

**Git range:** `feat(20)` → `test(24)`

**Tech debt accepted:**
- 3D viewer reliability on some hardware (diagnostic logging added, root cause unresolved)
- Debug page ships in production bundle
- Gitflow cheatsheet not in command palette
- Missing formal VERIFICATION.md for 3 phases (mitigated by UAT evidence)
- Pre-existing: closeRepository() doesn't reset blade stack, defaultTab not wired, topology EmptyState, orphaned v1.0 code

**What's next:** v1.4+ — Drag-and-drop staging, branch pins in Git config, per-process blade stacks, CSP hardening

---

## v1.2.0 Bugfixing & Polish (Shipped: 2026-02-07)

**Delivered:** Command palette, Git identity settings, Git init onboarding, folder-level staging, commit type icons, changelog emoji, expanded file icons, visual polish, and toolbar shortcut tooltips.

**Phases completed:** 16-19 (4 phases)

**Key accomplishments:**

- VS Code-style command palette with registry pattern and fuzzy search
- Git identity and integrations settings tabs
- Git init onboarding prompt for non-repo folders
- Folder-level stage/unstage in hierarchical view
- Color-coded conventional commit type icons across all views
- Expanded Catppuccin file-type icon set

**Git range:** `v1.1.0` → `v1.2.0`

---

## v1.1.0 Usability (Shipped: 2026-02-06)

**Delivered:** UX overhaul with toast notifications, clone workflow, repo/branch switcher, UI polish suite, and Ungit-style topology with blade navigation and diff viewing.

**Phases completed:** 11-15 (27 plans total)

**Key accomplishments:**

- Toast notification system with queue management, stacking, auto-dismiss, and action buttons wired to 27+ operation sites
- Clone repository with progress tracking, auto-open, and default destination folders
- Repository/branch switcher in top bar with keyboard navigation, search, remote toggle, and stash-and-switch for dirty trees
- UI polish suite: EmptyState illustrations, Skeleton loaders, ShortcutTooltip, frosted glass headers, button loading spinners, dirty-pulse animation
- Ungit-style topology rewrite as SVG+DOM hybrid with lane guide lines, step-path edges, color-coded Gitflow branches
- Blade navigation system with commit details, file tree, Monaco diff viewer, image viewer, and keyboard shortcuts

**Stats:**

- 170 files changed (+18,111/-2,894 lines)
- ~21,559 lines of code (13,937 TypeScript + 7,622 Rust)
- 5 phases, 27 plans, 34 requirements
- 2 days (2026-02-05 → 2026-02-06)
- 112 commits since v1.0

**Git range:** `v1.0` → `v1.1.0`

**Tech debt accepted:**
- defaultTab setting not wired in blade store initialization
- Topology EmptyState and Skeleton consistency
- Orphaned v1.0 code still present
- Phase 15 missing formal SUMMARY/VERIFICATION files

---

## v1.0.0 MVP (Shipped: 2026-02-04)

**Delivered:** A cross-platform desktop Git client with enforced Gitflow workflows, conventional commits, topology visualization, and worktree management.

**Phases completed:** 1-8 + 6.1, 6.2 (53 plans total)

**Key accomplishments:**

- Built complete Tauri application with type-safe Rust-React IPC via tauri-specta
- Implemented full Git operations: staging, commits, push/pull/fetch, branches, stash, tags, merge
- Created Gitflow state machine that enforces valid operations (prevents invalid workflows)
- Visualized commit topology with color-coded Gitflow lanes using React Flow + dagre
- Built conventional commit composer with type inference, scope autocomplete, and changelog generation
- Added first-class worktree management with create/delete/switch/status
- Polished UX with Catppuccin Mocha/Latte themes, keyboard shortcuts, file icons, animations
- Achieved performance targets: <100ms operations, <200MB memory, <50MB binary

**Stats:**

- 196 files created/modified
- ~16,355 lines of code (6,518 Rust + 9,837 TypeScript)
- 10 phases, 53 plans, 58 requirements
- 2 days from initialization to ship (2026-02-03 → 2026-02-04)
- 21 quick polish tasks after core phases

**Git range:** `docs: initialize project` → `ci(quick-021): add GitHub Actions release workflow`

**Tech debt accepted:**
- Topology auto-refresh (manual tab switch needed after commits)
- Orphaned code: greet, getMergeStatus, CollapsibleSidebar, AnimatedList, FadeIn

---

## v1.4.0 Architecture & Navigation Overhaul (Shipped: 2026-02-09)

**Delivered:** Replaced implicit navigation with an XState finite state machine, added Init Repo and Conventional Commit blades, migrated all 15 blades to co-located feature modules, consolidated 21 Zustand stores into 3 domain stores, resolved all 9 accumulated tech debt items, and established a test infrastructure with 140 tests.

**Phases completed:** 25-30 (6 phases, 29 plans, 39 requirements)

**Key accomplishments:**

- Established Vitest test infrastructure with jsdom, Zustand auto-reset mock, typed Tauri factories, and 13 blade smoke tests (34 → 140 tests, 4.1x growth)
- Replaced imperative blade store with XState v5 navigation FSM — push/pop/replace/reset with dirty-form guards, singleton enforcement, direction-aware animations, and visual inspector
- Built Init Repo blade with .gitignore template discovery (163 templates), multi-template composition, project type detection, and offline bundled fallback
- Built Conventional Commit blade with full-width workspace, commit-and-push pipeline, amend mode with pre-filled fields, 7 commit templates, and scope frequency chart
- Migrated all 15 blades to co-located feature modules (`src/blades/{name}/`) with single-glob auto-discovery and CI boundary enforcement
- Consolidated 21 Zustand stores into 3 domain stores (GitOps, UIState, Preferences) + store registry + blade store factory; resolved all 9 tech debt items including stale blade stack, topology empty state, orphaned code removal, command palette Cmd+K shortcut

**Stats:**

- 376 files changed (+42,164/-4,807 lines)
- ~36,946 lines of code (28,155 TypeScript + 8,791 Rust)
- 6 phases, 29 plans, 39 requirements
- 2 days (2026-02-08 → 2026-02-09)
- 79 commits

**Git range:** `v1.3.0` → `v1.4.0`

**Tech debt accepted:**
- 16 backward-compatibility re-export shims (@deprecated) for gradual consumer migration
- CC blade accessibility polish (aria-live debounce, amend mode styling, aria-labels)
- Init Repo blade UX refinements (focus behavior, listbox pattern, aria-describedby)
- Missing formal VERIFICATION.md for phases 26-29 (mitigated by UAT and summary evidence)
- Pre-existing TS2440 in auto-generated bindings.ts

**What's next:** v2.0 — MCP server, tiered autonomy model, or further polish

---


## v1.5.0 GitHub Extension (Shipped: 2026-02-10)

**Delivered:** Added an extension system to FlowForge and shipped GitHub integration (PRs, issues, OAuth Device Flow) as the first extension, alongside a data-driven toolbar overhaul with security hardening.

**Phases completed:** 31-36 (6 phases, 16 plans, 34 requirements)

**Key accomplishments:**

- Security hardened the app with strict CSP, disabled asset protocol, and narrowed Tauri capabilities before introducing external network access
- Built extension platform with manifest-driven lifecycle, namespaced registrations (ext:{id}:{name}), API versioning, and install from GitHub URL with permission review
- Overhauled toolbar from hardcoded Header.tsx buttons to data-driven ToolbarRegistry with overflow menu, context-based visibility, and per-action show/hide settings
- Shipped GitHub OAuth via Device Flow with secure OS keychain token storage, automatic remote detection, and rate limit tracking with toolbar badge
- Delivered GitHub read/write operations — browse PRs/issues with Virtuoso infinite scroll, merge PRs with strategy selector, create PRs from current branch
- Built Extension Manager blade with install dialog (6-step state machine), enable/disable toggles, permission badges, and persistent extension state

**Stats:**

- 149 files changed (+29,218/-644 lines)
- ~45,227 lines of code (34,152 TypeScript + 11,075 Rust)
- 6 phases, 16 plans, 34 requirements
- 7 days (2026-02-03 → 2026-02-10)
- 76 commits

**Git range:** `docs(31-security-hardening)` → `docs(audit)`

**Tech debt accepted:**
- Missing formal VERIFICATION.md for phases 35-36 (mitigated by UAT and integration checker evidence)
- Phase 34 human runtime testing pending (6 OAuth flow items)
- 16 backward-compatibility re-export shims (@deprecated) from v1.4
- Pre-existing TS2440 in auto-generated bindings.ts

**What's next:** v2.0 — MCP server, tiered autonomy model, or further polish

---


## v1.6.0 Refactor to Extensions (Shipped: 2026-02-11)

**Delivered:** Transformed FlowForge from a monolithic app into a truly extensible platform — extracted Gitflow, Conventional Commits, and content viewers into four independently toggleable built-in extensions, expanded the extension API with context menus, sidebar panels, status bar, and git operation hooks, and built sandbox infrastructure for future third-party extension safety.

**Phases completed:** 37-42 (6 phases, 16 plans, 32 requirements)

**Key accomplishments:**

- Built extension platform foundation with 4 new registries (ContextMenu, SidebarPanel, StatusBar, GitHookBus) and expanded ExtensionAPI with 6 new methods + onDispose lifecycle
- Extracted content viewers (Markdown, Code, 3D) to toggleable built-in extension with plaintext fallback on disable
- Extracted Conventional Commits to built-in extension with pre-commit hook infrastructure and graceful degradation to plain textarea
- Extracted Gitflow to built-in extension — disabling enables plain Git client mode while branch coloring stays in core (ADR-2)
- Built sandbox infrastructure: trust levels in manifest, Worker-based sandbox prototype with postMessage bridge, API method classification (sandbox-safe vs requires-trust)
- Removed 16 deprecated v1.4 re-export shims, added extension developer documentation, bumped version to 1.6.0

**Stats:**

- 238 files changed (+21,075/-593 lines)
- ~49,470 lines of code (38,325 TypeScript + 11,145 Rust)
- 6 phases, 16 plans, 32 requirements
- 8 days (2026-02-03 → 2026-02-11)
- 80 commits

**Git range:** `feat(37-01)` → `docs(audit)`

**Tech debt accepted:**
- GFEX-06 needs human runtime verification (architecture correct, Gitflow extension state defers to Rust backend)
- 3 new ExtensionAPI methods (onDidNavigate, events, settings) not yet classified in sandbox-api-surface.ts
- 3 pre-existing Monaco Editor mock test failures (not v1.6.0 related)
- CC Zustand store not explicitly reset on extension disable (ghost data persists but invisible)
- commandRegistry and previewRegistry still use plain Maps (not Zustand)

**What's next:** v2.0 — MCP server, tiered autonomy model, or further polish

---

