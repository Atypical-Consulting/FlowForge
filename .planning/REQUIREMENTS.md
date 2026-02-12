# Requirements: FlowForge

**Defined:** 2026-02-12
**Core Value:** The intelligence is in the agent; the authority is in the infrastructure.

## v1.8.0 Requirements

Requirements for the UI/UX Enhancements milestone. Each maps to roadmap phases.

### Enhanced Diff Viewer

- [ ] **DIFF-01**: User can view diffs with unchanged code regions collapsed by default, with a "Show N unchanged lines" expander that reveals hidden lines inline while preserving scroll position
- [ ] **DIFF-02**: User can stage individual hunks from within the diff viewer via gutter controls, with hunk headers providing "Stage hunk" / "Unstage hunk" actions
- [ ] **DIFF-03**: User can stage individual lines within a hunk via clickable line controls, with keyboard shortcut support and immediate reflection in the staging panel
- [ ] **DIFF-04**: User can see word-level diff highlighting within changed lines, with distinct colors for additions and deletions in both split and unified view modes
- [ ] **DIFF-05**: User's preferred diff view mode (split or unified) persists across sessions via app settings

### Branch & Commit Visualization

- [ ] **VIZ-01**: User can see author avatars next to commits in topology and history views, fetched from Gravatar with initials fallback and local caching
- [ ] **VIZ-02**: User can toggle a commit heat map where commit nodes are colored by recency, with a legend and respect for prefers-reduced-motion
- [ ] **VIZ-03**: User can hover over commit nodes in the topology graph to see a tooltip with short hash, author, date, and subject line

### Welcome Screen

- [ ] **WELC-01**: User can pin repositories to the top of the welcome screen, with pin state persisting across restarts
- [ ] **WELC-02**: User can see repository health indicators on welcome screen cards showing sync status (clean/dirty/behind/ahead) via colored status dots with tooltips
- [ ] **WELC-03**: User can perform quick actions on welcome screen repo cards (open, open in terminal, remove from recents) via hover-revealed action buttons

### Inline Conflict Resolution

- [ ] **CONF-01**: User can see conflicted files clearly marked with red warning icons in file tree, a conflict count badge in the toolbar, and a "Conflicts" filter in staging
- [ ] **CONF-02**: User can view conflicted files in a two-pane diff view (ours vs theirs) with an editable result panel below, with synchronized scrolling
- [ ] **CONF-03**: User can accept "ours", "theirs", or "both" with one click per conflict hunk, with undo support for each resolution action
- [ ] **CONF-04**: User can manually edit the merged result in a Monaco Editor with syntax highlighting and a "Reset" button to revert to the conflicted state
- [ ] **CONF-05**: User can mark a file as resolved, which stages the file, removes the conflict indicator, and shows a toast confirmation

### Git Insights Dashboard

- [ ] **INSI-01**: User can view a commit activity chart showing daily commit frequency over configurable time ranges (7/30/90 days) with hover details
- [ ] **INSI-02**: User can view a contributor breakdown with commit counts, activity percentage, and click-to-filter to that contributor's commits
- [ ] **INSI-03**: User can view a branch health overview listing all branches with last commit date, ahead/behind counts, staleness flags, and quick actions
- [ ] **INSI-04**: User can view repository stats cards showing total commits, active branches, contributors, and repo age in a responsive grid

### Customizable Workspace Layouts

- [ ] **LYOT-01**: User can select from layout presets (Review, Commit, Explore, Focus) via a toolbar menu, with smooth animated transitions
- [ ] **LYOT-02**: User can maximize a single panel to fullscreen via double-click on panel header, with Esc to exit focus mode
- [ ] **LYOT-03**: User can toggle individual panels on/off via a "Panels" menu, with remaining panels redistributing space
- [ ] **LYOT-04**: User's panel sizes persist across sessions and restore on app launch, with a "Reset to default" option

## Future Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Enhanced Diff (Deferred)

- **DIFF-06**: User can see renamed variables/functions visually linked with semantic change highlighting (requires language parsing)
- **DIFF-07**: User can see rendered markdown preview alongside diff with changed sections highlighted

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| AI-powered conflict resolution | Requires cloud API calls, conflicts with local-first architecture |
| Drag-and-drop panel rearrangement | Complex implementation; named presets achieve same goal more reliably |
| Custom diff algorithms (patience, histogram) | Niche feature affecting very few users; use git2 defaults |
| Code churn alerts / burnout detection | Crosses into surveillance territory; show data without judgment |
| Real-time collaboration | Git not designed for real-time sync; focus on single-user excellence |
| Full GitHub-style code review comments | Belongs in GitHub extension, not core diff viewer |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIFF-01 | — | Pending |
| DIFF-02 | — | Pending |
| DIFF-03 | — | Pending |
| DIFF-04 | — | Pending |
| DIFF-05 | — | Pending |
| VIZ-01 | — | Pending |
| VIZ-02 | — | Pending |
| VIZ-03 | — | Pending |
| WELC-01 | — | Pending |
| WELC-02 | — | Pending |
| WELC-03 | — | Pending |
| CONF-01 | — | Pending |
| CONF-02 | — | Pending |
| CONF-03 | — | Pending |
| CONF-04 | — | Pending |
| CONF-05 | — | Pending |
| INSI-01 | — | Pending |
| INSI-02 | — | Pending |
| INSI-03 | — | Pending |
| INSI-04 | — | Pending |
| LYOT-01 | — | Pending |
| LYOT-02 | — | Pending |
| LYOT-03 | — | Pending |
| LYOT-04 | — | Pending |

**Coverage:**
- v1.8.0 requirements: 23 total
- Mapped to phases: 0
- Unmapped: 23 ⚠️

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-12 after initial definition*
