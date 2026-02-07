# Requirements: v1.3.0 Blades Blades Blades

## Milestone Requirements

### Blade Migrations

- [ ] **BLADE-01**: User can access Settings as a blade instead of a modal, with back navigation via blade strip
- [ ] **BLADE-02**: User can compose conventional commits inline in the commit form (blade-integrated) instead of a separate modal
- [ ] **BLADE-03**: User can generate and preview changelogs in a blade instead of a modal dialog
- [ ] **BLADE-04**: App removes all modal mounts (SettingsWindow, ChangelogDialog, ConventionalCommitModal) from App.tsx

### New Content Blades

- [ ] **CONTENT-01**: User can preview rendered Markdown files (.md, .mdx) with GitHub Flavored Markdown support (tables, task lists, code highlighting)
- [ ] **CONTENT-02**: User can toggle between raw diff view and rendered markdown preview from the diff blade for .md files
- [ ] **CONTENT-03**: User can preview 3D models (.glb, .gltf) exported from Blender with orbit controls and auto-lighting via @google/model-viewer
- [ ] **CONTENT-04**: User can browse repository file tree at HEAD, navigate directories, and open files in the appropriate viewer blade
- [ ] **CONTENT-05**: User can view a contextual GitFlow cheat sheet blade showing workflow diagram, branch types, and current state highlighting
- [ ] **CONTENT-06**: GitFlow cheat sheet shows "You are here" indicator based on current branch type and suggests next action

### Branch Management

- [ ] **BRANCH-01**: User can see a "Last used branches" section showing recently checked-out branches
- [ ] **BRANCH-02**: User can pin/favorite branches that appear in a persistent "Quick Access" section
- [ ] **BRANCH-03**: User can view Local, Remote, and Last Used branches from a unified branch scope selector
- [ ] **BRANCH-04**: User can clean up merged branches with a bulk delete operation that protects Gitflow branches (main/develop)
- [ ] **BRANCH-05**: Feature branch tags appear in purple across topology and branch lists for visual distinction
- [ ] **BRANCH-06**: Clone button shows a contextually appropriate action when user is already inside a repository

### UX Improvements

- [ ] **UX-01**: User can view Changes and Staged Changes in a side-by-side two-column layout with inline diff preview
- [ ] **UX-02**: User can expand inline diff to a full-screen diff blade via an expand button
- [ ] **UX-03**: User sees a pre-merge review checklist when finishing a Gitflow feature/release/hotfix (configurable items)
- [ ] **UX-04**: Documentation website is published on GitHub Pages with getting-started guide, feature overview, and keyboard shortcuts reference

### Infrastructure

- [ ] **INFRA-01**: BladeType union extended with all new blade types (settings, changelog, conventional-commit, viewer-markdown, viewer-3d, repo-browser, gitflow-cheatsheet)
- [ ] **INFRA-02**: renderBlade switch in RepositoryView handles all new blade types
- [ ] **INFRA-03**: useBladeNavigation hook provides helpers for all new blade types (openSettings, openChangelog, openRepoBrowser, openGitflowCheatsheet)
- [ ] **INFRA-04**: All new viewer dependencies (react-markdown, remark-gfm, rehype-highlight, @google/model-viewer) are lazy-loaded with React.lazy
- [ ] **INFRA-05**: New Rust commands for repo file browsing (list_repo_files, read_repo_file) are registered and type-safe via tauri-specta

## Future Requirements (Deferred)

- [ ] Drag-and-drop between Changes and Staged columns — complex DnD, defer to v1.4+
- [ ] Typed blade props (discriminated union per blade type) — good architecture but not required until 20+ blade types
- [ ] Branch pins stored in Git config for portability — start with local app storage, add Git config in v1.4
- [ ] Per-process blade stack preservation (switching staging/topology preserves each stack) — investigate in v1.4
- [ ] Content Security Policy hardening — enable CSP with Monaco worker-src compatibility

## Out of Scope

- Full code review / PR review mode — duplicates GitHub/GitLab; lightweight checklist is sufficient
- Built-in markdown editor — preview only, not editing (scope creep toward IDE)
- Branch comparison/diff blade — better handled on GitHub/GitLab web UI
- General-purpose file explorer — repo file browser is commit/HEAD-scoped, not a system file manager
- Auto-archive stale branches — too aggressive; manual cleanup with suggestions is safer

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| BLADE-01 | TBD | Pending |
| BLADE-02 | TBD | Pending |
| BLADE-03 | TBD | Pending |
| BLADE-04 | TBD | Pending |
| CONTENT-01 | TBD | Pending |
| CONTENT-02 | TBD | Pending |
| CONTENT-03 | TBD | Pending |
| CONTENT-04 | TBD | Pending |
| CONTENT-05 | TBD | Pending |
| CONTENT-06 | TBD | Pending |
| BRANCH-01 | TBD | Pending |
| BRANCH-02 | TBD | Pending |
| BRANCH-03 | TBD | Pending |
| BRANCH-04 | TBD | Pending |
| BRANCH-05 | TBD | Pending |
| BRANCH-06 | TBD | Pending |
| UX-01 | TBD | Pending |
| UX-02 | TBD | Pending |
| UX-03 | TBD | Pending |
| UX-04 | TBD | Pending |
| INFRA-01 | TBD | Pending |
| INFRA-02 | TBD | Pending |
| INFRA-03 | TBD | Pending |
| INFRA-04 | TBD | Pending |
| INFRA-05 | TBD | Pending |

---
*25 requirements across 5 categories*
*Last updated: 2026-02-07*
