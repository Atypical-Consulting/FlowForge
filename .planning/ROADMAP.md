# Roadmap: FlowForge v1.2.0 Bugfixing & Polish

## Overview

v1.2.0 addresses accumulated UX bugs, visual inconsistencies, and adds a command palette with registry architecture. Starting with quick visual fixes and bug squashing, then improving the hierarchical view and conventional commit visuals, building the command palette as the milestone's most architecturally significant feature, and finishing with settings expansion, onboarding, and file icons.

## Milestones

- ✅ **v1.0 MVP** - Phases 1-10 (shipped 2026-02-04)
- ✅ **v1.1.0 Usability** - Phases 11-15 (shipped 2026-02-06)
- ◆ **v1.2.0 Bugfixing & Polish** - Phases 16-19 (in progress)

## Phases

- [ ] **Phase 16: Quick Fixes & Visual Polish** - Fix scattered bugs and cosmetic issues across the UI
- [ ] **Phase 17: Hierarchical View & Commit Enhancements** - Improve staging tree and conventional commit visuals
- [ ] **Phase 18: Command Palette & Discoverability** - Build registry-based command palette with shortcut tooltips
- [ ] **Phase 19: Settings, Onboarding & File Icons** - Expand settings, add git init prompt, expand icon coverage

## Phase Details

### Phase 16: Quick Fixes & Visual Polish
**Goal**: Users experience a polished, glitch-free interface with correct ordering and formatting across stash, tags, topology, modals, blades, and diffs
**Depends on**: v1.1.0 complete
**Requirements**: UIPX-01, UIPX-02, UIPX-05, STSH-01, TAGS-01, TOPO-01, NAVG-01
**Success Criteria** (what must be TRUE):
  1. Modals appear centered on screen immediately with no flicker or position jump
  2. Blade panels slide in with a subtle animation that does not feel aggressive or jarring
  3. Stash entries display a descriptive label (e.g., branch name, message) instead of raw `stash@{0}` identifiers
  4. Tags list shows most recently created tag at the top
  5. Main/master and dev/develop branch labels appear before feature branches in the topology graph
  6. Diff blade header shows path in gray + filename in bold as a single merged line
  7. Switching to a different repository causes the blade view to reset and display correct content for the new repo
**Plans**: 3 plans
Plans:
- [ ] 16-01-PLAN.md — Animation polish: fix modal flicker + subtler blade slide
- [ ] 16-02-PLAN.md — Tag sorting: add timestamp, sort most recent first
- [ ] 16-03-PLAN.md — Frontend quick fixes: stash labels, diff header, blade reset, topology verify

### Phase 17: Hierarchical View & Commit Enhancements
**Goal**: Users can stage/unstage entire folders and see color-coded conventional commit types throughout the app
**Depends on**: Phase 16
**Requirements**: UIPX-03, UIPX-04, CCMT-01, CCMT-02
**Success Criteria** (what must be TRUE):
  1. Clicking a stage button on a folder in hierarchical view stages/unstages all files within that folder
  2. All items in the hierarchical file tree have uniform icon widths and consistent icon-to-text spacing regardless of nesting depth
  3. Each conventional commit type (feat, fix, docs, etc.) displays its icon in a distinct, recognizable color
  4. Generated changelogs include the conventional commit type icon next to each entry
**Plans**: TBD

### Phase 18: Command Palette & Discoverability
**Goal**: Users can discover and invoke any registered action through a searchable command palette or shortcut tooltips
**Depends on**: Phase 16
**Requirements**: CMPL-01, CMPL-02, CMPL-03, DISC-01
**Success Criteria** (what must be TRUE):
  1. Pressing Ctrl+Shift+P (or Cmd+Shift+P on macOS) opens a centered command palette overlay with a search input
  2. Typing in the palette filters commands by title and description with results updating in real time
  3. Clone, Open Repository, Settings, and other core actions appear in the palette and execute when selected
  4. Hovering over common toolbar buttons shows a tooltip with the action name and its keyboard shortcut
**Plans**: TBD

### Phase 19: Settings, Onboarding & File Icons
**Goal**: Users can configure Git identity and external tools, get prompted to initialize repos, and see rich file-type icons
**Depends on**: Phase 16
**Requirements**: SETT-01, SETT-02, ONBR-01, ICON-01
**Success Criteria** (what must be TRUE):
  1. Settings window has an Integrations tab where user can configure preferred external editor and terminal shell
  2. Settings window has a Git tab where user can set name, email, and default branch name
  3. Opening a folder that is not a Git repository shows a prompt offering to run `git init`
  4. File tree displays distinct Catppuccin-themed icons for common file types (.ts, .rs, .json, .md, .toml, images, etc.)
**Plans**: TBD

## Progress

**Execution Order:**
Phases 17, 18, 19 depend on Phase 16 but are independent of each other.
After Phase 16 completes, remaining phases can execute in any order.

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 16. Quick Fixes & Visual Polish | 0/3 | Not started | — |
| 17. Hierarchical View & Commit Enhancements | 0/TBD | Not started | — |
| 18. Command Palette & Discoverability | 0/TBD | Not started | — |
| 19. Settings, Onboarding & File Icons | 0/TBD | Not started | — |

---
*Roadmap created: 2026-02-06*
*Milestone: v1.2.0 Bugfixing & Polish*
