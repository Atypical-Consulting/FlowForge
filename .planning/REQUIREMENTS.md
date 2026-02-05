# Requirements: FlowForge v1.1.0 Usability

**Defined:** 2026-02-05
**Core Value:** The intelligence is in the agent; the authority is in the infrastructure.

## v1.1 Requirements

Requirements for v1.1.0 release. Each maps to roadmap phases.

### Layout & Readability (LAYOUT)

- [ ] **LAYOUT-01**: Left panel displays branches, stashes, and tags with readable text size
- [ ] **LAYOUT-02**: Left panel action icons do not overlap with text content
- [ ] **LAYOUT-03**: Conventional Commits panel does not cover the changes list when expanded

### Defaults & Settings (DFLT)

- [ ] **DFLT-01**: Conventional Commits checkbox is unchecked by default for new commits
- [ ] **DFLT-02**: Amend commit action loads the previous commit's subject line
- [ ] **DFLT-03**: Amend commit action loads the previous commit's body/description
- [ ] **DFLT-04**: Amend commit works for both regular and conventional commit formats
- [ ] **DFLT-05**: Settings are organized in a dedicated settings window/modal
- [ ] **DFLT-06**: Settings window has categorized sections (General, Gitflow, Commits, Graph)

### Navigation (NAV)

- [ ] **NAV-01**: Top bar displays current repository name
- [ ] **NAV-02**: Top bar displays current branch name
- [ ] **NAV-03**: User can switch repositories from top bar dropdown
- [ ] **NAV-04**: User can switch branches from top bar dropdown
- [ ] **NAV-05**: Branch dropdown shows recent branches with search capability

### Git Workflows (FLOW)

- [ ] **FLOW-01**: User can clone a repository by entering URL
- [ ] **FLOW-02**: Clone shows progress indicator (receiving, resolving, checkout phases)
- [ ] **FLOW-03**: Clone allows selecting destination directory
- [ ] **FLOW-04**: User can initialize Gitflow on a non-Gitflow repository
- [ ] **FLOW-05**: Gitflow init creates develop branch from main if not exists
- [ ] **FLOW-06**: Gitflow init allows configuring branch names (main, develop)

### Topology Visualization (TOPO)

- [ ] **TOPO-01**: Clicking a commit node shows commit details in center panel
- [ ] **TOPO-02**: Commit details include author, date, SHA, and commit message
- [ ] **TOPO-03**: Commit details include list of changed files with status indicators
- [ ] **TOPO-04**: User can view diff of any file in commit details
- [ ] **TOPO-05**: Topology graph renders in Ungit-inspired style with clear branch lanes
- [ ] **TOPO-06**: Topology auto-refreshes after commits (fixes v1.0 tech debt)
- [ ] **TOPO-07**: Center panel shows meaningful content when no commit is selected

### History (HIST)

- [ ] **HIST-01**: User can select a commit in History view to see its details
- [ ] **HIST-02**: User can view diff of files changed in any historical commit
- [ ] **HIST-03**: Diff viewer shows old vs new content for historical commits

### UI Polish (UI)

- [ ] **UI-01**: Toast notifications appear for Git operation results (success/error)
- [ ] **UI-02**: Toast notifications auto-dismiss after appropriate delay
- [ ] **UI-03**: Toast notifications can be manually dismissed
- [ ] **UI-04**: Error toasts persist until dismissed
- [ ] **UI-05**: Empty states show helpful illustration and guidance (staging, stash, tags)
- [ ] **UI-06**: Buttons show loading spinner during async operations
- [ ] **UI-07**: Keyboard shortcut hints appear on relevant button tooltips
- [ ] **UI-08**: Panel headers have frosted glass visual effect
- [ ] **UI-09**: Dirty state indicator has subtle pulse animation

## Future Requirements (v1.2+)

Deferred to future releases. Tracked but not in current roadmap.

### Advanced Topology

- **TOPO-F01**: Interactive rebase via drag-and-drop in topology
- **TOPO-F02**: Branch health indicators (staleness, drift)

### Diff Enhancements

- **DIFF-F01**: Line-level staging from diff viewer
- **DIFF-F02**: Collapsible unchanged regions in diff

### Command Palette

- **CMD-F01**: Command palette (⌘K) for quick action access
- **CMD-F02**: Fuzzy search in command palette

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| MCP server integration | Deferred to v2.0 — needs real usage patterns |
| Embedded AI model | v2.0+ — rule-based heuristics sufficient |
| Tiered autonomy UI | Depends on MCP, therefore v2.0 |
| Three-way merge view | High complexity, separate milestone |
| Git insights dashboard | Analytics feature, not core usability |
| Customizable workspace layouts | Polish feature, v1.2+ |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | TBD | Pending |
| LAYOUT-02 | TBD | Pending |
| LAYOUT-03 | TBD | Pending |
| DFLT-01 | TBD | Pending |
| DFLT-02 | TBD | Pending |
| DFLT-03 | TBD | Pending |
| DFLT-04 | TBD | Pending |
| DFLT-05 | TBD | Pending |
| DFLT-06 | TBD | Pending |
| NAV-01 | TBD | Pending |
| NAV-02 | TBD | Pending |
| NAV-03 | TBD | Pending |
| NAV-04 | TBD | Pending |
| NAV-05 | TBD | Pending |
| FLOW-01 | TBD | Pending |
| FLOW-02 | TBD | Pending |
| FLOW-03 | TBD | Pending |
| FLOW-04 | TBD | Pending |
| FLOW-05 | TBD | Pending |
| FLOW-06 | TBD | Pending |
| TOPO-01 | TBD | Pending |
| TOPO-02 | TBD | Pending |
| TOPO-03 | TBD | Pending |
| TOPO-04 | TBD | Pending |
| TOPO-05 | TBD | Pending |
| TOPO-06 | TBD | Pending |
| TOPO-07 | TBD | Pending |
| HIST-01 | TBD | Pending |
| HIST-02 | TBD | Pending |
| HIST-03 | TBD | Pending |
| UI-01 | TBD | Pending |
| UI-02 | TBD | Pending |
| UI-03 | TBD | Pending |
| UI-04 | TBD | Pending |
| UI-05 | TBD | Pending |
| UI-06 | TBD | Pending |
| UI-07 | TBD | Pending |
| UI-08 | TBD | Pending |
| UI-09 | TBD | Pending |

**Coverage:**
- v1.1 requirements: 34 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 34

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after initial definition*
