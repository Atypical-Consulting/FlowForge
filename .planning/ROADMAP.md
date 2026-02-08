# Roadmap: FlowForge

## Milestones

- **v1.0 MVP** - Phases 1-10 (shipped 2026-02-04) -> [archive](milestones/v1.0.0-ROADMAP.md)
- **v1.1.0 Usability** - Phases 11-15 (shipped 2026-02-06) -> [archive](milestones/v1.1.0-ROADMAP.md)
- **v1.2.0 Bugfixing & Polish** - Phases 16-19 (shipped 2026-02-07) -> [archive](milestones/v1.2.0-ROADMAP.md)
- **v1.3.0 Blades Blades Blades** - Phases 20-24 (active)

## Active Milestone: v1.3.0 Blades Blades Blades

### Overview

v1.3.0 expands the blade navigation system into FlowForge's primary interaction model. Modals are migrated to blades, new content blades add rich file previews (markdown, 3D models, repo browser, Gitflow reference), staging gets a two-column layout, and branch management gains quick-access features and bulk cleanup. The milestone delivers 7 new blade types, removes 3 modal dialogs, and adds 4 lazy-loaded production dependencies while keeping startup impact at zero.

### Phase 20: Blade Infrastructure & Modal Migration

**Goal**: Users interact with settings, changelogs, and commit composition through blades instead of modal dialogs, with all new blade types registered and routable

**Depends on**: v1.2.0 complete

**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, BLADE-01, BLADE-02, BLADE-03, BLADE-04

**Success Criteria**:
1. User can open Settings from the header and it appears as a blade with back-navigation via the blade strip (not a modal overlay)
2. User can compose a conventional commit inline in the commit form area without a separate modal appearing
3. User can generate and preview a changelog in a blade that supports push/pop navigation alongside other blades
4. App.tsx contains zero modal mounts for SettingsWindow, ChangelogDialog, or ConventionalCommitModal
5. All 7 new blade types (settings, changelog, conventional-commit, viewer-markdown, viewer-3d, repo-browser, gitflow-cheatsheet) are registered in BladeType, renderBlade, and useBladeNavigation

**Plans:** 20-01 through 20-08 (8 plans, all complete)

---

### Phase 20.1: Blade Extensibility Refactoring

**Goal**: The blade system supports adding new blade types with a single file (registration + component), enforces type-safe props at compile time, and renders with consistent UX patterns (error boundaries, loading states, Suspense) — reducing the per-blade change footprint from 4-7 files to 1-2 files

**Depends on**: Phase 20 complete

**Requirements**: REFACTOR-01 (type-safe blade props), REFACTOR-02 (blade registry), REFACTOR-03 (render performance), REFACTOR-04 (error boundaries), REFACTOR-05 (UX consistency)

**Success Criteria**:
1. Adding a new blade type requires only creating a component file and a registration — no changes to RepositoryView, useBladeNavigation, or the BladeType union
2. `pushBlade("commit-details", {})` is a TypeScript compile error (missing required `oid` prop)
3. A blade that throws during rendering shows a recovery UI instead of crashing the entire view
4. All blades use consistent loading and Suspense fallback patterns
5. The `renderBlade` function in RepositoryView is replaced by a generic registry-based renderer
6. AnimatePresence exit animations work correctly during blade navigation

**Plans:** 20.1-01 through 20.1-06 (6 plans in 4 waves, all complete)

---

### Phase 21: Two-Column Staging & Inline Diff

**Goal**: Users can see their changed files and a diff preview side-by-side without losing context by navigating away from the staging view

**Depends on**: Phase 20 (blade infrastructure must be stable)

**Requirements**: UX-01, UX-02

**Success Criteria**:
1. User sees Changes and Staged Changes in a resizable two-column layout with a file list on the left and inline diff preview on the right
2. User can click any file in the list and immediately see its diff in the adjacent panel without pushing a new blade
3. User can click an expand button on the inline diff to open a full-screen diff blade

**Plans:** 5 plans in 4 waves (all complete)

Plans:
- [x] 21-01-PLAN.md -- Foundation: SplitPaneLayout, staging store extension, preview registry, file type utilities
- [x] 21-02-PLAN.md -- Diff preview components: InlineDiffViewer, DiffPreviewHeader, NonTextPlaceholder, StagingDiffPreview
- [x] 21-03-PLAN.md -- Integration: StagingChangesBlade two-column refactor, StagingPanel/FileItem mods, keyboard navigation
- [x] 21-04-PLAN.md -- Full-screen diff navigation: next/prev file arrows in DiffBlade, state preservation
- [x] 21-05-PLAN.md -- Human verification checkpoint (UAT 15/15 passed)

---

### Phase 22: New Content Blades

**Goal**: Users can preview markdown files, browse the repository file tree, view 3D models, and reference Gitflow workflows -- all within the blade navigation system

**Depends on**: Phase 20 (blade types registered and routable)

**Requirements**: CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04, CONTENT-05, CONTENT-06

**Success Criteria**:
1. User can view a rendered markdown file with GitHub Flavored Markdown support (tables, task lists, syntax-highlighted code blocks) inside a blade
2. User can toggle between raw diff view and rendered markdown preview when viewing a .md file from the diff blade
3. User can preview a .glb or .gltf 3D model with orbit controls and auto-lighting inside a blade
4. User can browse the repository file tree at HEAD, navigate into directories via breadcrumbs, and open files in the appropriate viewer blade
5. User can open a Gitflow cheat sheet blade that shows workflow diagrams, branch type descriptions, and a "You are here" indicator based on the current branch

**Plans:** 26 plans in 10 waves

Plans:
- [x] 22-01-PLAN.md -- W1: Extensibility Refactoring (type safety, auto-registration, file dispatch)
- [x] 22-02-PLAN.md -- W1: Shared Utilities (useRepoFile, BladeContent components, BladeToolbar, renderPathTitle, Monaco config, branchClassifier)
- [x] 22-03-PLAN.md -- W1: Dependencies & Theme (rehype-sanitize, @catppuccin/highlightjs, gentle-pulse animation, model-viewer types)
- [x] 22-04-PLAN.md -- W2: Viewer-Markdown Blade (GFM, syntax highlighting, copy code, link/image handling)
- [x] 22-05-PLAN.md -- W2: Viewer-Code Blade (Monaco read-only, language auto-detection)
- [x] 22-06-PLAN.md -- W2: Repo Browser Blade (file tree at HEAD, breadcrumbs, smart dispatch, keyboard nav)
- [x] 22-07-PLAN.md -- W3: DiffBlade Markdown Toggle (segmented diff/preview control)
- [x] 22-08-PLAN.md -- W3: Viewer-3D Blade (model-viewer, orbit controls, progress bar, WebGL fallback)
- [x] 22-09-PLAN.md -- W3: Gitflow Cheatsheet Blade (SVG diagram, "You Are Here", action cards, branch reference)
- [x] 22-10-PLAN.md -- W4: Integration & Polish (cross-blade nav, header entry points, accessibility audit)
- [x] 22-11-PLAN.md -- W5: Human Verification Checkpoint (UAT — 6 gaps identified)
- [x] 22-12-PLAN.md -- W5: Gap Closure — DiffBlade preview width and Monaco height
- [x] 22-13-PLAN.md -- W5: Gap Closure — 3D model loading and error diagnostics
- [x] 22-14-PLAN.md -- W5: Gap Closure — Backspace navigation in repo browser
- [x] 22-15-PLAN.md -- W5: Gap Closure — Gitflow cheatsheet entry points
- [x] 22-16-PLAN.md -- W6: Gap Closure — Unified breadcrumb UX across all blades
- [x] 22-17-PLAN.md -- W7: Gap Closure — CSS variable name fix (var(--ctp-*) to var(--catppuccin-color-*))
- [x] 22-18-PLAN.md -- W7: Gap Closure — DiffBlade markdown routing and 3D model atob revert
- [x] 22-19-PLAN.md -- W7: Gap Closure — Breadcrumb dedup, global Backspace, HMR warning suppression
- [x] 22-20-PLAN.md -- W8: Gap Closure — Monaco 0px height fix and HMR registration cleanup
- [x] 22-21-PLAN.md -- W8: Gap Closure — Replace model-viewer with Three.js + GLTFLoader
- [x] 22-22-PLAN.md -- W8: Gap Closure — Redesign Gitflow SVG diagram (opacity, cubic curves, geometry)
- [x] 22-23-PLAN.md -- W9: Gap Closure — DiffBlade toolbar order fix and Viewer3dBlade silent failure fix
- [x] 22-24-PLAN.md -- W9: Gap Closure — Gitflow SVG complete redesign (canonical layout, arrowheads, readability)
- [x] 22-25-PLAN.md -- W10: Gap Closure — Viewer3dBlade diagnostic logging and standalone test page
- [x] 22-26-PLAN.md -- W10: Gap Closure — Gitflow SVG mermaid gitgraph-style redesign (straight lines, 5 lanes)

---

### Phase 23: Branch Management

**Goal**: Users can quickly access, organize, and clean up branches with pinning, recent-branch tracking, bulk cleanup, and visual distinction for feature branches

**Depends on**: Phase 20 (no direct blade dependency, but infrastructure should be stable)

**Requirements**: BRANCH-01, BRANCH-02, BRANCH-03, BRANCH-04, BRANCH-05, BRANCH-06

**Success Criteria**:
1. User sees a "Last used branches" section showing recently checked-out branches in the branch list
2. User can pin/favorite branches that appear in a persistent "Quick Access" section at the top of the branch list
3. User can switch between Local, Remote, and Last Used views from a unified branch scope selector
4. User can select multiple merged branches and delete them in bulk, with Gitflow branches (main/develop) protected from deletion
5. Feature branch tags appear in purple across both the topology graph and branch list views
6. Clone button shows a contextually appropriate action (e.g., "Open in Explorer" or similar) when user is already inside a repository

**Plans:** 7 plans in 4 waves

Plans:
- [ ] 23-01-PLAN.md -- W1: Unified branch color system (single source of truth, feature=purple)
- [ ] 23-02-PLAN.md -- W1: Branch metadata store, scope registry, and composition hooks
- [ ] 23-03-PLAN.md -- W1: Rust backend commands (get_recent_checkouts, batch_delete_branches)
- [ ] 23-04-PLAN.md -- W2: Branch scope selector, tiered section layout, pin/badge UI
- [ ] 23-05-PLAN.md -- W2: Bulk delete pipeline, multi-select hook, confirmation dialog
- [ ] 23-06-PLAN.md -- W3: Bulk delete integration, contextual clone/reveal button, metadata init
- [ ] 23-07-PLAN.md -- W4: Human verification checkpoint (UAT)

---

### Phase 24: Code Review Guidance & Documentation

**Goal**: Users receive lightweight review guidance during Gitflow merges, and new users can discover FlowForge through a published documentation website

**Depends on**: Phase 20 (blade system for checklist display)

**Requirements**: UX-03, UX-04

**Success Criteria**:
1. User sees a pre-merge review checklist when finishing a Gitflow feature, release, or hotfix, with configurable checklist items
2. Documentation website is live on GitHub Pages with a getting-started guide, feature overview, and keyboard shortcuts reference

**Plans:** TBD

---

## Progress

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| 20 | Blade Infrastructure & Modal Migration | 9 | Complete |
| 20.1 | Blade Extensibility Refactoring | 5 | Complete |
| 21 | Two-Column Staging & Inline Diff | 2 | Complete |
| 22 | New Content Blades | 6 | Complete |
| 23 | Branch Management | 6 | Planned |
| 24 | Code Review Guidance & Documentation | 2 | Pending |

**Total:** 25 requirements across 5 phases

---
*Created: 2026-02-07*
*Milestone: v1.3.0 Blades Blades Blades*
