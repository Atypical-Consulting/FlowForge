# Roadmap: FlowForge

## Overview

FlowForge delivers a cross-platform Git client in 8 phases: starting with Tauri scaffolding and repository management, building core staging/commit/sync operations, adding branch management, implementing the Gitflow state machine for workflow enforcement, visualizing topology with Gitflow lanes, adding conventional commit tooling, implementing worktree management, and finishing with UX polish and performance optimization. Each phase builds on the previous, with the Gitflow state machine (Phase 4) being the core differentiator that elevates basic Git operations into enforced workflow.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Tauri scaffold, repo opening, IPC layer
- [x] **Phase 2: Core Git - Staging & Commits** - Stage, unstage, diff, commit, push/pull/fetch, history
- [x] **Phase 3: Core Git - Branches** - Branch CRUD, checkout, merge, stash, tags
- [x] **Phase 4: Gitflow State Machine** - Feature/release/hotfix workflows with enforcement
- [x] **Phase 5: Topology Visualization** - DAG graph with Gitflow-colored lanes
- [x] **Phase 6: Conventional Commits** - Composer, validation, changelog generation
- [x] **Phase 6.1: Catppuccin Mocha File Icons** - File type icons in changes view (INSERTED)
- [x] **Phase 6.2: UX/UI Enhancements** - Typography, theming, animations, spatial composition (INSERTED)
- [x] **Phase 7: Worktree Management** - Panel, create/delete, status, navigation
- [ ] **Phase 8: Polish & Performance** - UX fundamentals, keyboard shortcuts, performance targets

## Phase Details

### Phase 1: Foundation
**Goal**: Application launches and can open Git repositories with type-safe Rust-React communication
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05
**Success Criteria** (what must be TRUE):
  1. User can launch the application on macOS, Windows, or Linux and see the main window
  2. User can open a Git repository via file picker and see it load
  3. User can see recent repositories and reopen them with one click
  4. User can see current branch name and dirty/clean status in the UI
**Plans**: 3 plans in 2 waves

Plans:
- [x] 01-01-PLAN.md — Tauri + React scaffold with tauri-specta IPC
- [x] 01-02-PLAN.md — Git service layer with spawn_blocking pattern
- [x] 01-03-PLAN.md — Repository UI with file picker, recent repos, status display

### Phase 2: Core Git - Staging & Commits
**Goal**: User can view changes, stage/unstage files, commit, and sync with remotes
**Depends on**: Phase 1
**Requirements**: GIT-01, GIT-02, GIT-03, GIT-04, GIT-05, GIT-06, GIT-07, GIT-08, GIT-09, GIT-10
**Success Criteria** (what must be TRUE):
  1. User can view a list of changed files grouped by staged, unstaged, and untracked
  2. User can stage or unstage individual files and see the change reflected immediately
  3. User can view inline diff of any changed file before staging
  4. User can write a commit message and commit staged changes
  5. User can push commits to remote, pull changes, and fetch without merging
**Plans**: 6 plans in 2 waves

Plans:
- [x] 02-01-PLAN.md — Rust staging & diff module
- [x] 02-02-PLAN.md — Rust commit & history module
- [x] 02-03-PLAN.md — Rust remote module with Channels
- [x] 02-04-PLAN.md — Frontend file list & staging UI
- [x] 02-05-PLAN.md — Frontend diff viewer & commit form
- [x] 02-06-PLAN.md — Frontend sync & history UI

### Phase 3: Core Git - Branches
**Goal**: User can create, switch, merge, and delete branches with stash and tag support
**Depends on**: Phase 2
**Requirements**: GIT-11, GIT-12, GIT-13, GIT-14, GIT-15, GIT-16, GIT-17
**Success Criteria** (what must be TRUE):
  1. User can create a new branch from current HEAD and switch to it
  2. User can switch between existing local branches
  3. User can merge one branch into another and see the result
  4. User can delete a branch (with protection against unmerged branches)
  5. User can stash changes, view stash list, and apply or pop stashes
**Plans**: 6 plans in 3 waves

Plans:
- [x] 03-01-PLAN.md — Branch backend (list, create, checkout, delete)
- [x] 03-02-PLAN.md — Stash backend (save, list, apply, pop, drop)
- [x] 03-03-PLAN.md — Tag backend (list, create, delete)
- [x] 03-04-PLAN.md — Merge backend (analysis, merge, abort, status)
- [x] 03-05-PLAN.md — Branch UI (store, components, header integration)
- [x] 03-06-PLAN.md — Stash & Tag UI + RepositoryView integration

### Phase 4: Gitflow State Machine
**Goal**: Gitflow workflows are enforced through state machine that prevents invalid operations
**Depends on**: Phase 3
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07, FLOW-08, FLOW-09, FLOW-10, FLOW-12
**Success Criteria** (what must be TRUE):
  1. User can start a feature branch only from develop (other contexts show option disabled)
  2. User can finish a feature branch and see it merge to develop with branch cleanup
  3. User can complete full release flow: start from develop, finish to main AND develop, auto-tag
  4. User can complete full hotfix flow: start from main, finish to main AND develop, auto-tag
  5. Invalid Gitflow operations are prevented (buttons disabled, actions blocked) not just warned
**Plans**: 5 plans in 4 waves

Plans:
- [x] 04-01-PLAN.md — Foundation: statig, errors, policy, state machine
- [x] 04-02-PLAN.md — No-FF merge + Feature flow commands
- [x] 04-03-PLAN.md — Release + Hotfix flow commands + status
- [x] 04-04-PLAN.md — IPC registration + Gitflow store
- [x] 04-05-PLAN.md — Gitflow UI components + integration

### Phase 5: Topology Visualization
**Goal**: User sees commit graph with color-coded Gitflow lanes showing branch relationships
**Depends on**: Phase 4
**Requirements**: FLOW-11
**Success Criteria** (what must be TRUE):
  1. User sees a visual DAG of commits with lines connecting parent-child relationships
  2. Main branch appears in distinct color (red/orange) separate from develop (blue/green)
  3. Feature, release, and hotfix branches each have their own lane colors
  4. User can click on any commit in the graph to see its details
**Plans**: 5 plans in 4 waves

Plans:
- [x] 05-01-PLAN.md — Rust graph module with branch classification and lane assignment
- [x] 05-02-PLAN.md — IPC command registration and TypeScript bindings
- [x] 05-03-PLAN.md — Topology store and useCommitGraph hook
- [x] 05-04-PLAN.md — React Flow components with Gitflow colors
- [x] 05-05-PLAN.md — UI integration and commit selection

### Phase 6: Conventional Commits
**Goal**: Commit composer guides users to write conventional commits with validation and changelog generation
**Depends on**: Phase 2
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07, CONV-08, CONV-09
**Success Criteria** (what must be TRUE):
  1. User sees suggested commit type based on changed files (new file = feat, test file = test, etc.)
  2. User sees suggested scope based on file paths with autocomplete from project history
  3. User gets real-time validation errors when commit message violates conventional commit spec
  4. User can mark commit as breaking change with required footer description
  5. User can generate a changelog grouped by commit type from repository history
**Plans**: 7 plans in 4 waves

Plans:
- [x] 06-01-PLAN.md — Rust conventional commit parsing, validation, type inference
- [x] 06-02-PLAN.md — Rust changelog generation with Tera templates
- [x] 06-03-PLAN.md — IPC command registration for conventional commits
- [x] 06-04-PLAN.md — Frontend store and hooks for conventional commits
- [x] 06-05-PLAN.md — Conventional commit form UI components
- [x] 06-06-PLAN.md — Changelog dialog and preview UI
- [x] 06-07-PLAN.md — Integration with existing commit workflow

### Phase 6.1: Catppuccin Mocha File Icons (INSERTED)
**Goal**: Files in the changes view display Catppuccin Mocha-themed icons based on file type/extension
**Depends on**: Phase 6
**Requirements**: None (UX enhancement)
**Reference**: https://github.com/catppuccin/vscode-icons/tree/main/icons/mocha
**Success Criteria** (what must be TRUE):
  1. User sees file-type-specific icons next to each file in the changes view
  2. Icons follow Catppuccin Mocha color palette for visual consistency
  3. Common file types (js, ts, tsx, rs, md, json, etc.) have distinct icons
  4. Folder icons distinguish directories from files
**Plans**: 2 plans in 2 waves

Plans:
- [x] 06.1-01-PLAN.md — SVG infrastructure, icon download, FileTypeIcon component
- [x] 06.1-02-PLAN.md — Integration into FileItem and FileTreeView

### Phase 6.2: UX/UI Enhancements (INSERTED)
**Goal**: Elevate the visual design with distinctive typography, extended Catppuccin theming, micro-interactions, and improved spatial composition
**Depends on**: Phase 6.1
**Requirements**: None (UX enhancement based on design audit)
**Success Criteria** (what must be TRUE):
  1. Custom typography system with developer-focused fonts (JetBrains Mono/Geist) replaces system defaults
  2. Welcome view features animated gradient background and memorable onboarding experience
  3. Catppuccin Mocha palette extends throughout entire UI (not just file icons)
  4. Header includes backdrop blur, resizable panels are available, collapsible sidebar works
  5. Micro-interactions added: stagger animations on load, smooth tab transitions, hover effects, success feedback
  6. Commit form has visual type selector, character counter progress bar, keyboard shortcuts
  7. File tree has indent guides, search/filter, and improved batch selection
  8. Topology view has animated path drawing, branch color coding, and time-based grouping
**Plans**: 9 plans in 5 waves

Plans:
- [x] 06.2-01-PLAN.md — Typography system (JetBrains Mono + Geist fonts)
- [x] 06.2-02-PLAN.md — Catppuccin color palette integration
- [x] 06.2-03-PLAN.md — Resizable panels with react-resizable-panels
- [x] 06.2-04-PLAN.md — Animation system with framer-motion
- [x] 06.2-05-PLAN.md — Welcome view redesign with animated gradient
- [x] 06.2-06-PLAN.md — Global Catppuccin theming
- [x] 06.2-07-PLAN.md — Commit form UX (TypeSelector, CharacterProgress)
- [x] 06.2-08-PLAN.md — File tree enhancements (indent guides, search)
- [x] 06.2-09-PLAN.md — Topology view polish (animated edges, branch colors)

### Phase 7: Worktree Management
**Goal**: User can manage multiple worktrees with full visibility and easy navigation
**Depends on**: Phase 1
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, WORK-06, WORK-07, WORK-08, WORK-09
**Success Criteria** (what must be TRUE):
  1. User sees all active worktrees with their linked branch names and status (clean/dirty/conflicts)
  2. User can create a new worktree from any branch in two clicks with directory picker
  3. User can delete a worktree with cleanup confirmation and optional branch deletion
  4. User can open a worktree in system file explorer
  5. User can switch context to a different worktree within the app
**Plans**: 4 plans in 4 waves

Plans:
- [x] 07-01-PLAN.md — Backend worktree module (Rust types and operations)
- [x] 07-02-PLAN.md — IPC commands + Frontend store
- [x] 07-03-PLAN.md — WorktreePanel + WorktreeItem components
- [x] 07-04-PLAN.md — Create/Delete dialogs + integration

### Phase 8: Polish & Performance
**Goal**: Application meets UX standards with keyboard shortcuts, theming, and performance targets
**Depends on**: Phase 7 (all features complete)
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, PERF-01, PERF-02, PERF-03, PERF-04, PERF-05
**Success Criteria** (what must be TRUE):
  1. User can toggle between dark and light themes, and preference persists across sessions
  2. User can perform common operations (stage, commit, push) via keyboard shortcuts
  3. User can search commits by message text and see results quickly
  4. Common operations complete in <100ms on repos with <10K commits, verified by profiling
  5. Application uses <200MB memory at idle and binary is <50MB installed
**Plans**: 6 plans in 4 waves

Plans:
- [ ] 08-01-PLAN.md — Theme system with Catppuccin Latte/Mocha toggle
- [ ] 08-02-PLAN.md — File watcher backend with notify-rs
- [ ] 08-03-PLAN.md — Keyboard shortcuts with react-hotkeys-hook
- [ ] 08-04-PLAN.md — Commit search by message text
- [ ] 08-05-PLAN.md — Undo Git operations via reflog
- [ ] 08-06-PLAN.md — Performance optimization and verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Foundation | Complete | 2026-02-04 |
| 2. Core Git - Staging & Commits | Complete | 2026-02-04 |
| 3. Core Git - Branches | Complete | 2026-02-04 |
| 4. Gitflow State Machine | Complete | 2026-02-04 |
| 5. Topology Visualization | Complete | 2026-02-04 |
| 6. Conventional Commits | Complete | 2026-02-04 |
| 6.1 Catppuccin Mocha File Icons | Complete | 2026-02-04 |
| 6.2 UX/UI Enhancements | Complete | 2026-02-04 |
| 7. Worktree Management | Complete | 2026-02-04 |
| 8. Polish & Performance | Not started | - |

---
*Roadmap created: 2026-02-03*
*Milestone: v1.0*
