# Roadmap: FlowForge v1.1.0 Usability

## Overview

v1.1.0 focuses on UX improvements and Ungit-style topology visualization. Starting from the foundation (toast notifications, settings), building through workflows (clone, Gitflow init), navigation (repo/branch switcher), UI polish (empty states, loading spinners), and concluding with the highest-risk topology rework. Toast notifications come first because they enable user feedback for all subsequent features.

## Milestones

- [x] **v1.0 MVP** - Phases 1-10 (shipped 2026-02-04)
- [ ] **v1.1.0 Usability** - Phases 11-15 (in progress)

## Phases

- [x] **Phase 11: Foundation** - Toast notifications, settings window, layout fixes
- [x] **Phase 12: Workflows** - Clone repository, Gitflow initialization, amend commit
- [x] **Phase 13: Navigation** - Repository/branch switcher in top bar
- [x] **Phase 14: UI Polish** - Empty states, loading spinners, tooltips, animations
- [ ] **Phase 15: Topology** - Ungit-style visualization with commit details and history diff

## Phase Details

### Phase 11: Foundation

**Goal**: Users receive visual feedback for operations and can configure preferences in organized settings
**Depends on**: v1.0 complete
**Requirements**: UI-01, UI-02, UI-03, UI-04, DFLT-01, DFLT-05, DFLT-06, LAYOUT-01, LAYOUT-02, LAYOUT-03
**Success Criteria** (what must be TRUE):
  1. User sees toast notification after Git operations (commit, push, pull, merge)
  2. Error toasts persist until user dismisses them; success toasts auto-dismiss
  3. User can access settings from menu/header and see categorized sections
  4. Left panel branches/stashes/tags are readable with no icon overlap
  5. Conventional Commits panel does not cover the changes list
**Plans:** 5 plans
Plans:
- [x] 11-01-PLAN.md — Toast System Core (store + components)
- [x] 11-02-PLAN.md — Settings Window (store + UI + access)
- [x] 11-03-PLAN.md — Layout Fixes (compact left panel, commit positioning)
- [x] 11-04-PLAN.md — Wire Toasts to Git Operations
- [x] 11-05-PLAN.md — Human Verification

### Phase 12: Workflows

**Goal**: Users can clone repositories, initialize Gitflow on plain repos, and amend commits with message reload
**Depends on**: Phase 11
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, DFLT-02, DFLT-03, DFLT-04
**Success Criteria** (what must be TRUE):
  1. User can clone a repository by URL and see progress during clone
  2. User can select destination folder for cloned repository
  3. User can initialize Gitflow on a non-Gitflow repository via UI
  4. Gitflow init creates develop branch and allows branch name configuration
  5. Amending a commit pre-fills the previous commit message (subject and body)
**Plans:** 6 plans
Plans:
- [x] 12-01-PLAN.md — Clone Backend (progress callbacks)
- [x] 12-02-PLAN.md — Clone Frontend (form, progress, entry points)
- [x] 12-03-PLAN.md — Gitflow Init Backend (command, config storage)
- [x] 12-04-PLAN.md — Gitflow Init Frontend (dialog, sidebar button)
- [x] 12-05-PLAN.md — Amend Commit (get message, pre-fill, confirmation)
- [x] 12-06-PLAN.md — Human Verification

### Phase 13: Navigation

**Goal**: Users can quickly switch repositories and branches from the top bar
**Depends on**: Phase 12
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
**Success Criteria** (what must be TRUE):
  1. Top bar displays current repository name and current branch name
  2. User can switch repositories from a dropdown in the top bar
  3. User can switch branches from a dropdown with recent branches and search
**Plans:** 5 plans
Plans:
- [x] 13-01-PLAN.md — Rust backend: remote branch listing and checkout commands
- [x] 13-02-PLAN.md — Navigation store and RepoSwitcher component
- [x] 13-03-PLAN.md — BranchSwitcher component with search and remote toggle
- [x] 13-04-PLAN.md — Header integration, switching logic, stash-and-switch
- [x] 13-05-PLAN.md — Human verification

### Phase 14: UI Polish

**Goal**: Application feels polished with helpful empty states, loading feedback, and visual refinements
**Depends on**: Phase 13
**Requirements**: UI-05, UI-06, UI-07, UI-08, UI-09
**Success Criteria** (what must be TRUE):
  1. Empty states (no changes, no stashes, no tags) show illustration and guidance
  2. Buttons show loading spinner during async operations
  3. Keyboard shortcut hints appear in relevant button tooltips
  4. Panel headers have frosted glass visual effect
  5. Dirty state indicator has subtle pulse animation
**Plans:** 4 plans
Plans:
- [x] 14-01-PLAN.md — Reusable UI components (EmptyState, ShortcutTooltip, Skeleton) + CSS + MotionConfig
- [x] 14-02-PLAN.md — Empty states in 4 panels + frosted glass on 5 sidebar headers
- [x] 14-03-PLAN.md — Button loading states + shortcut tooltips on 6 buttons + dirty pulse animation
- [x] 14-04-PLAN.md — Gap closure: frosted glass scroll fix + tooltip viewport detection and restyle

### Phase 15: Topology

**Goal**: Topology graph matches Ungit's intuitive approach with commit details and history diff viewing
**Depends on**: Phase 14
**Requirements**: TOPO-01, TOPO-02, TOPO-03, TOPO-04, TOPO-05, TOPO-06, TOPO-07, HIST-01, HIST-02, HIST-03
**Success Criteria** (what must be TRUE):
  1. Clicking a commit in topology shows details in center panel (author, date, SHA, message, files)
  2. User can view diff of any file in a selected commit
  3. Topology graph renders with clear Gitflow lanes (Ungit-inspired style)
  4. Topology auto-refreshes after commits (fixes v1.0 tech debt)
  5. User can select commits in History view and inspect their diffs
**Plans:** 7 plans
Plans:
- [ ] 15-01-PLAN.md — Backend commit file diff command (Rust + bindings)
- [ ] 15-02-PLAN.md — Blade navigation system (store + container + process nav)
- [ ] 15-03-PLAN.md — Topology graph restyle (badges, edges, lane colors)
- [ ] 15-04-PLAN.md — Layout integration (RepositoryView + Header + auto-refresh)
- [ ] 15-05-PLAN.md — Commit details blade + file tree
- [ ] 15-06-PLAN.md — Diff blade + history integration + keyboard shortcuts
- [ ] 15-07-PLAN.md — Human verification

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 11. Foundation | 5/5 | Complete | 2026-02-05 |
| 12. Workflows | 6/6 | Complete | 2026-02-05 |
| 13. Navigation | 5/5 | Complete | 2026-02-06 |
| 14. UI Polish | 4/4 | Complete | 2026-02-06 |
| 15. Topology | 0/7 | Not started | - |

---
*Roadmap created: 2026-02-05*
*Milestone: v1.1.0 Usability*
