# Roadmap: FlowForge

## Milestones

- **v1.0 MVP** - Phases 1-10 (shipped 2026-02-04) -> [archive](milestones/v1.0.0-ROADMAP.md)
- **v1.1.0 Usability** - Phases 11-15 (shipped 2026-02-06) -> [archive](milestones/v1.1.0-ROADMAP.md)
- **v1.2.0 Bugfixing & Polish** - Phases 16-19 (shipped 2026-02-07) -> [archive](milestones/v1.2.0-ROADMAP.md)
- **v1.3.0 Blades Blades Blades** - Phases 20-24 (shipped 2026-02-08) -> [archive](milestones/v1.3.0-ROADMAP.md)
- **v1.4.0 Architecture & Navigation Overhaul** - Phases 25-30 (in progress)

## v1.4.0 Architecture & Navigation Overhaul

**Milestone Goal:** Reorganize the frontend around blade-centric modules, replace implicit navigation with an XState finite state machine, migrate remaining flows to blades, and resolve all accumulated tech debt with a testing foundation.

### Overview

Six phases transform FlowForge's frontend architecture from implicit, store-driven navigation to an explicit XState FSM while adding two new blade types, restructuring the codebase into feature modules, and eliminating nine tech debt items. Test infrastructure comes first so every subsequent architectural change is verified. XState navigation second while file structure is familiar. New blades third and fourth as examples of correct patterns. File restructuring fifth after new blades exist as migration templates. Store consolidation and tech debt cleanup last when everything is stable.

### Phases

- [x] **Phase 25: Test Infrastructure Foundation** - Establish Vitest with jsdom, typed Tauri mocks, and Zustand auto-reset so all subsequent changes are verifiable
- [ ] **Phase 26: XState Navigation FSM** - Replace imperative blade store with an explicit state machine governing push/pop/replace/reset with guards, constraints, and side effects
- [ ] **Phase 27: Init Repo Blade** - Full-width blade for repository initialization with .gitignore template search, multi-template composition, and offline fallback
- [x] **Phase 28: Conventional Commit Blade** - Full-width blade workspace for conventional commits with commit-and-push workflow and post-commit navigation
- [ ] **Phase 29: Blade-Centric File Structure** - Migrate from layer-based to feature-module organization with co-located components, stores, hooks, and tests per blade
- [ ] **Phase 30: Store Consolidation & Tech Debt** - Consolidate Zustand stores into domain groups and resolve all nine accumulated tech debt items

## Phase Details

### Phase 25: Test Infrastructure Foundation
**Goal**: Developers can write and run unit tests for XState machines, Zustand stores, and React components with typed mocks and proper isolation
**Depends on**: Nothing (first phase of v1.4.0)
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04
**Success Criteria** (what must be TRUE):
  1. Developer can run `npm test` and Vitest executes with jsdom environment, producing pass/fail results
  2. Developer can write a Zustand store test where state resets automatically between test cases (no cross-test pollution)
  3. Developer can mock Tauri IPC commands with type-safe factories that match actual binding signatures
  4. Developer can run component smoke tests that verify each blade type renders without crashing
  5. Developer can test XState machine guards and transitions with deterministic assertions (no DOM needed)
**Plans**: 3 plans

Plans:
- [x] 25-01-PLAN.md -- Vitest config, global setup, Zustand auto-reset mock, blades store test
- [x] 25-02-PLAN.md -- Typed Tauri mock factories, custom render wrapper, store tests (repository + toast)
- [x] 25-03-PLAN.md -- Blade smoke tests (all 13 types) + XState machine test example

### Phase 26: XState Navigation FSM
**Goal**: Users navigate between blades via an explicit finite state machine that enforces valid transitions, prevents data loss, and provides observable state for debugging
**Depends on**: Phase 25 (tests verify FSM behavior)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NAV-06, NAV-07, NAV-08, NAV-09, NAV-10
**Success Criteria** (what must be TRUE):
  1. User can push, pop, replace, and reset blades with all operations governed by the XState FSM (no imperative store calls)
  2. User is prevented from navigating away from a blade with unsaved form data (guard blocks the transition, confirmation dialog appears)
  3. User cannot open a second instance of singleton blades like Settings or Changelog (FSM guard silently prevents it)
  4. User can switch between staging and topology processes with atomic blade stack reset (no stale blade content from previous process)
  5. Developer can inspect live navigation state via XState visual inspector in dev mode and sees current state, context, and event history
**Plans**: 4 plans

Plans:
- [x] 26-01-PLAN.md -- XState navigation machine definition + pure TDD tests (types, guards, actions, machine, selectors)
- [x] 26-02-PLAN.md -- React provider, module-level actor, dev inspector, extensibility refactoring (singleton metadata)
- [x] 26-03-PLAN.md -- Consumer migration: hooks, bladeOpener, components, direction-aware animations
- [x] 26-04-PLAN.md -- Dirty-form guards, navigation guard dialog, dirty indicators, max depth, store cleanup

### Phase 27: Init Repo Blade
**Goal**: Users can initialize a repository through a rich, full-width blade that offers .gitignore template discovery, composition, and project scaffolding
**Depends on**: Phase 26 (blade lifecycle managed by XState FSM)
**Requirements**: INIT-01, INIT-02, INIT-03, INIT-04, INIT-05, INIT-06, INIT-07, INIT-08, INIT-09, INIT-10
**Success Criteria** (what must be TRUE):
  1. User can open the Init Repo blade from the welcome screen and initialize a repository with a chosen default branch name, optional README, and optional initial commit
  2. User can search, filter, and browse .gitignore templates from the full GitHub collection (163 templates) grouped by category (Languages, Frameworks, Editors/IDEs, OS)
  3. User can preview a .gitignore template's contents before applying it, and compose multiple templates (e.g., Node + macOS + JetBrains) into a single .gitignore
  4. User can select .gitignore templates while offline via bundled fallback templates (top 15-20) without errors or empty states
  5. User receives smart .gitignore recommendations based on auto-detected project type (e.g., package.json detected suggests Node template)
**Plans**: 4 plans

Plans:
- [x] 27-01-PLAN.md -- Rust backend: reqwest, bundled templates, 4 Tauri commands (list/get/detect/write)
- [x] 27-02-PLAN.md -- TypeScript utilities: gitignore composer, category mapping, Zustand store
- [x] 27-03-PLAN.md -- InitRepoBlade shell, React Query hooks, form UI, template picker
- [x] 27-04-PLAN.md -- Preview panel, init pipeline wiring, entry point integration, verification

### Phase 28: Conventional Commit Blade
**Goal**: Users can compose conventional commits in a dedicated full-width blade workspace with richer layout, commit-and-push workflow, and automatic post-commit navigation
**Depends on**: Phase 26 (blade lifecycle managed by XState FSM)
**Requirements**: CC-01, CC-02, CC-03, CC-04, CC-05, CC-06, CC-07, CC-08, CC-09
**Success Criteria** (what must be TRUE):
  1. User can open a full-width Conventional Commit blade and compose a commit using type selector, scope autocomplete, and description fields in a spacious layout
  2. User can preview the full formatted commit message in a generous monospace preview area before committing
  3. User can commit and push in a single action from the CC blade, and is automatically navigated back to staging after success
  4. User can amend the previous commit with type, scope, and description fields pre-filled from the existing commit message
  5. User can still use the inline sidebar CC form for quick commits (both compact sidebar and full-width blade modes coexist)
**Plans**: 5 plans

Plans:
- [x] 28-01-PLAN.md -- Extract pure utilities (buildCommitMessage, parseConventionalMessage) and extend store
- [x] 28-02-PLAN.md -- Extract commit execution hook, amend hook, and UI primitives (CommitPreview, CommitActionBar)
- [x] 28-03-PLAN.md -- Blade shell, registration, SplitPaneLayout, and sidebar coexistence
- [x] 28-04-PLAN.md -- Preview syntax highlighting, commit+push pipeline, auto-navigate, amend mode
- [x] 28-05-PLAN.md -- Commit templates and scope frequency chart

### Phase 29: Blade-Centric File Structure
**Goal**: Developers find each blade's files co-located in a single feature module directory with enforced import boundaries, while auto-discovery and the blade registry continue to work
**Depends on**: Phase 27 and Phase 28 (new blades start in correct structure as migration examples)
**Requirements**: STRC-01, STRC-02, STRC-03, STRC-04, STRC-05, STRC-06
**Success Criteria** (what must be TRUE):
  1. Developer finds each blade type's component, registration, hooks, store, and tests co-located in a single `blades/{blade-name}/` directory
  2. Developer can add a new blade type by creating files in one feature directory (no edits to shared files beyond the blade registry)
  3. Blade auto-discovery works with the new file structure (application loads all blade types, no regressions)
  4. Import boundaries are enforced: blades do not import from other blades, features do not import from other features (only from shared)
**Plans**: 6 plans

Plans:
- [ ] 29-01-PLAN.md -- Scaffold _shared/ directory, dual-glob discovery, DiffSource extraction, tsconfig paths, Biome config
- [ ] 29-02-PLAN.md -- Migrate 4 simple blades (viewer-image, viewer-3d, commit-details, repo-browser)
- [ ] 29-03-PLAN.md -- Migrate 3 viewer blades + changelog blade with exclusive store
- [ ] 29-04-PLAN.md -- Migrate settings (6 sub-components) and gitflow-cheatsheet blades
- [ ] 29-05-PLAN.md -- Migrate staging-changes, diff, topology-graph, init-repo (complex cross-dependent blades)
- [ ] 29-06-PLAN.md -- Migrate conventional-commit, delete old structure, finalize single-glob, CI boundary check

### Phase 30: Store Consolidation & Tech Debt
**Goal**: Zustand stores are consolidated into domain groups, duplicate code is removed, and all nine accumulated tech debt items are resolved
**Depends on**: Phase 29 (file structure stable, stores co-located with features)
**Requirements**: ARCH-05, ARCH-06, ARCH-07, ARCH-08, ARCH-09, ARCH-10, ARCH-11, ARCH-12, ARCH-13
**Success Criteria** (what must be TRUE):
  1. Developer finds related Zustand stores consolidated into domain-grouped stores with consistent naming (reduced from 21 to approximately 5 domain stores)
  2. Closing a repository resets the blade stack (no stale blade content visible when opening a different repo)
  3. Topology shows an empty state illustration for repositories with zero commits instead of a blank panel
  4. Orphaned v1.0 code (greet command, getMergeStatus, CollapsibleSidebar, AnimatedList, FadeIn) and the debug page (viewer3d-test.html) are removed from the production bundle
  5. Gitflow cheatsheet is accessible from the command palette, defaultTab setting is wired in blade initialization, and review store errors surface as user-facing toasts
**Plans**: TBD

Plans:
- [ ] 30-01: TBD
- [ ] 30-02: TBD
- [ ] 30-03: TBD
- [ ] 30-04: TBD

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

### v1.4.0 Architecture & Navigation Overhaul (In Progress)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 25. Test Infrastructure Foundation | 3/3 | ✓ Complete | 2026-02-08 |
| 26. XState Navigation FSM | 4/4 | ✓ Complete | 2026-02-08 |
| 27. Init Repo Blade | 4/4 | ✓ Complete | 2026-02-08 |
| 28. Conventional Commit Blade | 5/5 | ✓ Complete | 2026-02-09 |
| 29. Blade-Centric File Structure | 0/TBD | Not started | - |
| 30. Store Consolidation & Tech Debt | 0/TBD | Not started | - |

---
*Last updated: 2026-02-09*
*Phase 28 complete — Conventional Commit Blade with syntax highlighting, commit+push, amend mode, templates, and scope chart*
