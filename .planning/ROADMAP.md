# Roadmap: FlowForge

## Milestones

- **v1.0 MVP** - Phases 1-10 (shipped 2026-02-04) -> [archive](milestones/v1.0.0-ROADMAP.md)
- **v1.1.0 Usability** - Phases 11-15 (shipped 2026-02-06) -> [archive](milestones/v1.1.0-ROADMAP.md)
- **v1.2.0 Bugfixing & Polish** - Phases 16-19 (shipped 2026-02-07) -> [archive](milestones/v1.2.0-ROADMAP.md)
- **v1.3.0 Blades Blades Blades** - Phases 20-24 (shipped 2026-02-08) -> [archive](milestones/v1.3.0-ROADMAP.md)
- **v1.4.0 Architecture & Navigation Overhaul** - Phases 25-30 (shipped 2026-02-09) -> [archive](milestones/v1.4.0-ROADMAP.md)
- **v1.5.0 GitHub Extension** - Phases 31-36 (shipped 2026-02-10) -> [archive](milestones/v1.5.0-ROADMAP.md)
- **v1.6.0 Refactor to Extensions** - Phases 37-42 (shipped 2026-02-11) -> [archive](milestones/v1.6.0-ROADMAP.md)
- **v1.7.0 Extensions Everywhere** - Phases 43-47 (in progress)

## Phases

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

<details>
<summary>v1.6.0 Refactor to Extensions (Phases 37-42) -- SHIPPED 2026-02-11</summary>

- [x] Phase 37: Extension Platform Foundation (3/3 plans) -- completed 2026-02-10
- [x] Phase 38: Content Viewer Extraction (2/2 plans) -- completed 2026-02-10
- [x] Phase 39: Conventional Commits Extraction (3/3 plans) -- completed 2026-02-10
- [x] Phase 40: Gitflow Extraction (2/2 plans) -- completed 2026-02-10
- [x] Phase 41: Sandbox & Polish (5/5 plans) -- completed 2026-02-11
- [x] Phase 42: Audit Tech Debt Cleanup (1/1 plan) -- completed 2026-02-11

</details>

### v1.7.0 Extensions Everywhere (In Progress)

**Milestone Goal:** Push FlowForge closer to a minimal core by extracting Topology, Worktrees, and Init Repo into toggleable built-in extensions, plus cleaning up extension-related tech debt (registry migration, sandbox surface, CC store reset).

- [x] **Phase 43: Infrastructure Prep** - Registry migration to Zustand + tech debt fixes enabling clean extractions -- completed 2026-02-11
- [ ] **Phase 44: Worktree Extraction** - Worktree management as toggleable built-in extension via sidebar panel
- [ ] **Phase 45: Init Repo Extraction** - Init Repo as toggleable built-in extension with dual-context activation
- [ ] **Phase 46: Topology Extraction** - Topology graph as toggleable built-in extension with commit list fallback
- [ ] **Phase 47: Cleanup & Verification** - Remove scaffolding, split discovery types, tests, documentation

## Phase Details

### Phase 43: Infrastructure Prep
**Goal**: Registries are reactive Zustand stores and infrastructure hooks exist for extension-aware process navigation and WelcomeView rendering
**Depends on**: Phase 42 (v1.6.0 complete)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07
**Success Criteria** (what must be TRUE):
  1. Command palette reactively shows extension-contributed commands the moment they register (no reopen needed)
  2. Disabling an extension that contributed preview handlers removes those handlers without stale entries
  3. Topology tab in process navigation hides when no topology blade is available in the registry
  4. WelcomeView renders the Init Repo experience from BladeRegistry lookup, not a hardcoded import
  5. CC store state clears when Conventional Commits extension is disabled (no ghost data on re-enable)
**Plans:** 3 plans
Plans:
- [x] 43-01-PLAN.md -- Registry migrations (commandRegistry + previewRegistry to Zustand stores)
- [x] 43-02-PLAN.md -- Reactive CommandPalette, process tab visibility, WelcomeView registry lookup
- [x] 43-03-PLAN.md -- CC store reset on extension disable + sandbox API expansion

### Phase 44: Worktree Extraction
**Goal**: Worktree management is a self-contained toggleable built-in extension that users can enable/disable from Extension Manager
**Depends on**: Phase 43 (reactive registries for clean command/panel lifecycle)
**Requirements**: WKTR-01, WKTR-02, WKTR-03, WKTR-04, WKTR-05, WKTR-06
**Success Criteria** (what must be TRUE):
  1. Worktree sidebar panel appears in RepositoryView when extension is enabled, with create/delete dialogs fully functional
  2. Disabling the Worktree extension removes the sidebar panel and its command palette entries without errors
  3. No hardcoded worktree JSX remains in RepositoryView (all contributed via extension API)
  4. Worktree data operations (list, create, delete, switch) continue working because the data slice remains in core GitOpsStore
**Plans:** 2 plans
Plans:
- [ ] 44-01-PLAN.md -- Create worktrees extension (entry point, sidebar panel wrapper, move components, badge API)
- [ ] 44-02-PLAN.md -- Wire extension into app, remove hardcoded RepositoryView worktree code, delete old directory

### Phase 45: Init Repo Extraction
**Goal**: Init Repo is a toggleable built-in extension that activates early enough to serve both WelcomeView and blade navigation contexts
**Depends on**: Phase 43 (WelcomeView BladeRegistry lookup pattern)
**Requirements**: INIT-01, INIT-02, INIT-03, INIT-04, INIT-05, INIT-06
**Success Criteria** (what must be TRUE):
  1. Init Repo blade renders correctly from WelcomeView (before any repository is open) via BladeRegistry lookup
  2. Disabling the Init Repo extension shows a simple "Run git init" fallback button in WelcomeView
  3. Init Repo command appears in command palette when extension is enabled and disappears when disabled
  4. Init Repo blade store lives in the extension directory, not in the old core blade location
**Plans**: TBD

### Phase 46: Topology Extraction
**Goal**: Topology graph is a toggleable built-in extension, and disabling it degrades gracefully to a simple commit list with process tab hidden
**Depends on**: Phase 43 (process tab visibility hook), Phase 44-45 (extraction patterns validated)
**Requirements**: TOPO-01, TOPO-02, TOPO-03, TOPO-04, TOPO-05, TOPO-06, TOPO-07, TOPO-08, TOPO-09
**Success Criteria** (what must be TRUE):
  1. Disabling the Topology extension hides the topology process tab and renders a simple commit list fallback instead of crashing
  2. File watcher auto-refresh triggers topology reload only when the topology extension is active (no orphaned event listeners)
  3. Keyboard shortcut for topology is contributed by the extension and disappears when extension is disabled
  4. Settings "default tab" falls back to "changes" when topology extension is disabled (no broken preference)
  5. Extension Manager shows 7 independently toggleable built-in extensions (GitHub, Gitflow, CC, Content Viewers, Worktrees, Init Repo, Topology)
**Plans**: TBD

### Phase 47: Cleanup & Verification
**Goal**: All extraction scaffolding is removed, discovery types are properly split, and every new extension has toggle tests and documentation
**Depends on**: Phase 46 (all extractions complete)
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04
**Success Criteria** (what must be TRUE):
  1. No empty source directories remain at old blade/component locations (topology-graph, init-repo, worktree paths cleaned)
  2. _discovery.ts EXPECTED_TYPES is split into CORE and EXTENSION lists reflecting the new architecture
  3. Toggle tests pass for all 3 new extensions (enable/disable cycles produce no errors or stale state)
  4. Extension developer documentation includes examples from the new built-in extensions (worktrees, init-repo, topology)
**Plans**: TBD

## Progress

**Execution Order:** 43 -> 44 -> 45 -> 46 -> 47

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 43. Infrastructure Prep | v1.7.0 | 3/3 | ✓ Complete | 2026-02-11 |
| 44. Worktree Extraction | v1.7.0 | 0/2 | Planned | - |
| 45. Init Repo Extraction | v1.7.0 | 0/TBD | Not started | - |
| 46. Topology Extraction | v1.7.0 | 0/TBD | Not started | - |
| 47. Cleanup & Verification | v1.7.0 | 0/TBD | Not started | - |

---
*Last updated: 2026-02-11 -- Phase 43 complete*
