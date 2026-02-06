# Requirements: FlowForge v1.2.0 Bugfixing & Polish

**Defined:** 2026-02-06
**Core Value:** The intelligence is in the agent; the authority is in the infrastructure.

## v1.2.0 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Onboarding

- [ ] **ONBR-01**: User is prompted to initialize a Git repository when opening a non-repo folder

### File Icons

- [ ] **ICON-01**: File tree uses expanded Catppuccin icon set covering common file types

### Stash

- [ ] **STSH-01**: Stash entries display human-friendly format instead of `stash@{0}`

### Command Palette

- [ ] **CMPL-01**: User can open a VS Code-style command palette via keyboard shortcut
- [ ] **CMPL-02**: Command palette uses a registry pattern where commands declare title, description, and shortcut
- [ ] **CMPL-03**: Core actions (Clone, Open, etc.) are registered as palette commands

### Discoverability

- [ ] **DISC-01**: Common actions have tooltips showing name and keyboard shortcut

### Topology

- [ ] **TOPO-01**: Main/master and dev/develop branch labels appear before feature branches in graph

### Settings

- [ ] **SETT-01**: Integrations tab in Settings with external editor and shell configuration
- [ ] **SETT-02**: Git tab in Settings to configure user name, email, and default branch name

### UI Polish

- [ ] **UIPX-01**: Modals open without flickering or appearing briefly in top-left corner
- [ ] **UIPX-02**: Blade opening animation is subtler (less aggressive right-to-left slide)
- [ ] **UIPX-03**: Hierarchical view supports folder-level stage/unstage
- [ ] **UIPX-04**: Hierarchical view has consistent spacing (icon width and icon-to-text padding aligned)
- [ ] **UIPX-05**: Diff blade header shows path in gray + filename in bold as single merged line

### Conventional Commits

- [ ] **CCMT-01**: Conventional Commit type icons use distinct colors per type
- [ ] **CCMT-02**: Changelog generation includes Conventional Commit type icons

### Tags

- [ ] **TAGS-01**: Tags list is sorted with most recent tag first

### Navigation

- [ ] **NAVG-01**: Blade view refreshes correctly when switching repositories

## Future Requirements

Deferred to later milestones. Not in current roadmap.

### v2+ (MCP)

- **MCP-01**: MCP server exposing repository state as structured resources
- **MCP-02**: MCP Git operations as tools with policy enforcement
- **MCP-03**: Tiered autonomy model for agent operations

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive rebase drag-and-drop | Valuable polish, not core differentiator, v3 |
| Smart staging with automatic changeset grouping | Underserved not unserved, v3 |
| Branch health monitoring | Ambient UX enhancement, v3 |
| Built-in code editor | Scope creep, IDE competition |
| Plugin/extension system | Complexity, security risks |
| CI/CD integration | Feature creep |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ONBR-01 | Phase 19 | Pending |
| ICON-01 | Phase 19 | Pending |
| STSH-01 | Phase 16 | Pending |
| CMPL-01 | Phase 18 | Pending |
| CMPL-02 | Phase 18 | Pending |
| CMPL-03 | Phase 18 | Pending |
| DISC-01 | Phase 18 | Pending |
| TOPO-01 | Phase 16 | Pending |
| SETT-01 | Phase 19 | Pending |
| SETT-02 | Phase 19 | Pending |
| UIPX-01 | Phase 16 | Pending |
| UIPX-02 | Phase 16 | Pending |
| UIPX-03 | Phase 17 | Pending |
| UIPX-04 | Phase 17 | Pending |
| UIPX-05 | Phase 16 | Pending |
| CCMT-01 | Phase 17 | Pending |
| CCMT-02 | Phase 17 | Pending |
| TAGS-01 | Phase 16 | Pending |
| NAVG-01 | Phase 16 | Pending |

**Coverage:**
- v1.2.0 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 after roadmap creation*
