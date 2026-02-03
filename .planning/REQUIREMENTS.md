# Requirements: FlowForge

**Defined:** 2026-02-03
**Core Value:** The intelligence is in the agent; the authority is in the infrastructure.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: Application launches on macOS, Windows, and Linux
- [ ] **FOUND-02**: User can open a Git repository from file picker
- [ ] **FOUND-03**: User can open recent repositories from bookmarks
- [ ] **FOUND-04**: Application detects and displays repository status (branch, clean/dirty)
- [ ] **FOUND-05**: IPC layer provides type-safe communication between Rust and React

### Core Git Operations

- [ ] **GIT-01**: User can view list of changed files (staged, unstaged, untracked)
- [ ] **GIT-02**: User can stage individual files or all files
- [ ] **GIT-03**: User can unstage individual files or all files
- [ ] **GIT-04**: User can view diff of any changed file (inline view)
- [ ] **GIT-05**: User can commit staged changes with a message
- [ ] **GIT-06**: User can push commits to remote
- [ ] **GIT-07**: User can pull changes from remote
- [ ] **GIT-08**: User can fetch from remote without merging
- [ ] **GIT-09**: User can view commit history (log) with pagination
- [ ] **GIT-10**: User can view details of any commit (message, author, files changed)
- [ ] **GIT-11**: User can create a new branch from current HEAD
- [ ] **GIT-12**: User can switch to any local branch
- [ ] **GIT-13**: User can delete a local branch (with merge check)
- [ ] **GIT-14**: User can merge one branch into another
- [ ] **GIT-15**: User can stash current changes
- [ ] **GIT-16**: User can apply or pop a stash
- [ ] **GIT-17**: User can create and delete tags

### Gitflow Workflow

- [ ] **FLOW-01**: Application enforces Gitflow branch model via state machine
- [ ] **FLOW-02**: User can start a feature branch (only from develop)
- [ ] **FLOW-03**: User can finish a feature branch (merge to develop, delete branch)
- [ ] **FLOW-04**: User can start a release branch (only from develop)
- [ ] **FLOW-05**: User can finish a release branch (merge to main AND develop, tag, delete)
- [ ] **FLOW-06**: User can start a hotfix branch (only from main)
- [ ] **FLOW-07**: User can finish a hotfix branch (merge to main AND develop, tag, delete)
- [ ] **FLOW-08**: Branch creation dialogs show only valid options for current context
- [ ] **FLOW-09**: Merge operations enforce no-fast-forward for Gitflow merges
- [ ] **FLOW-10**: Application automatically cleans up feature/release/hotfix branches after finish
- [ ] **FLOW-11**: Topology panel displays branches with color-coded Gitflow lanes
- [ ] **FLOW-12**: Invalid Gitflow operations are prevented (not just warned)

### Conventional Commits

- [ ] **CONV-01**: Commit composer suggests commit type based on changed files
- [ ] **CONV-02**: Commit composer suggests scope based on file paths
- [ ] **CONV-03**: User can select commit type from dropdown (feat, fix, docs, style, refactor, test, chore)
- [ ] **CONV-04**: User can enter or select scope with autocomplete from project history
- [ ] **CONV-05**: Commit message is validated in real-time against conventional commit spec
- [ ] **CONV-06**: Invalid commit messages show specific validation errors
- [ ] **CONV-07**: User can add breaking change flag (!) with footer description
- [ ] **CONV-08**: Changelog can be generated from conventional commit history
- [ ] **CONV-09**: Changelog groups commits by type (Features, Bug Fixes, etc.)

### Worktree Management

- [ ] **WORK-01**: Worktree panel displays all active worktrees for repository
- [ ] **WORK-02**: Each worktree shows its linked branch name
- [ ] **WORK-03**: Each worktree shows its status (clean, dirty, conflicts)
- [ ] **WORK-04**: User can create a new worktree from any branch (two-click flow)
- [ ] **WORK-05**: User can specify worktree directory location
- [ ] **WORK-06**: User can delete a worktree with cleanup confirmation
- [ ] **WORK-07**: Deleting a worktree offers to delete the linked branch if fully merged
- [ ] **WORK-08**: User can open a worktree in system file explorer
- [ ] **WORK-09**: User can switch context to a different worktree within the app

### UX Fundamentals

- [ ] **UX-01**: Application supports dark mode
- [ ] **UX-02**: Application supports light mode
- [ ] **UX-03**: User can toggle between dark and light mode
- [ ] **UX-04**: Keyboard shortcuts work for common operations (stage, commit, push)
- [ ] **UX-05**: User can search commits by message text
- [ ] **UX-06**: User can undo last Git operation where possible
- [ ] **UX-07**: Application remembers window size and position
- [ ] **UX-08**: Application shows loading states during async operations
- [ ] **UX-09**: Application shows clear error messages for failed operations

### Performance

- [ ] **PERF-01**: Common operations complete in <100ms on repositories with <10K commits
- [ ] **PERF-02**: Application uses <200MB memory at idle
- [ ] **PERF-03**: Application binary is <50MB installed
- [ ] **PERF-04**: Commit history uses virtual scrolling for large repositories
- [ ] **PERF-05**: File watcher detects external changes within 500ms

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### MCP Server

- **MCP-01**: Application exposes MCP server for AI agent integration
- **MCP-02**: MCP provides repository state as structured resources
- **MCP-03**: MCP provides Git operations as tools with policy enforcement
- **MCP-04**: Tiered autonomy model controls which operations need approval

### Advanced Intelligence

- **AI-01**: Embedded lightweight model for semantic diff analysis
- **AI-02**: Smart staging groups related changes automatically
- **AI-03**: AI-assisted merge conflict resolution with explanations
- **AI-04**: Choreography view shows agent operations in real-time

### Team Features

- **TEAM-01**: Policy configuration file (.gitclient-policy.yml) for workflow rules
- **TEAM-02**: Team can share Gitflow configuration
- **TEAM-03**: Team can share conventional commit scopes

### Advanced Git

- **ADV-01**: Interactive rebase with drag-and-drop UI
- **ADV-02**: Branch health monitoring (staleness, drift indicators)
- **ADV-03**: Side-by-side diff view
- **ADV-04**: Commit signing (GPG/SSH)
- **ADV-05**: Submodule management

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Built-in code editor | Scope creep, IDE competition — users have editors |
| Issue tracker integration | v1 scope control — focus on Git workflows |
| Mercurial/SVN support | Git-only focus — maintenance burden |
| Plugin/extension system | Complexity, v1 focus — security and stability risks |
| CI/CD integration | v1 scope control — feature creep |
| Built-in terminal | Users have terminals — bloat |
| Code review features | GitHub/GitLab do this well — duplication |
| Real-time collaboration | High complexity — not core to workflow enforcement |
| Mobile apps | Desktop-first — different product |
| OAuth login flows | Not needed for local Git client |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| GIT-01 | Phase 2 | Pending |
| GIT-02 | Phase 2 | Pending |
| GIT-03 | Phase 2 | Pending |
| GIT-04 | Phase 2 | Pending |
| GIT-05 | Phase 2 | Pending |
| GIT-06 | Phase 2 | Pending |
| GIT-07 | Phase 2 | Pending |
| GIT-08 | Phase 2 | Pending |
| GIT-09 | Phase 2 | Pending |
| GIT-10 | Phase 2 | Pending |
| GIT-11 | Phase 3 | Pending |
| GIT-12 | Phase 3 | Pending |
| GIT-13 | Phase 3 | Pending |
| GIT-14 | Phase 3 | Pending |
| GIT-15 | Phase 3 | Pending |
| GIT-16 | Phase 3 | Pending |
| GIT-17 | Phase 3 | Pending |
| FLOW-01 | Phase 4 | Pending |
| FLOW-02 | Phase 4 | Pending |
| FLOW-03 | Phase 4 | Pending |
| FLOW-04 | Phase 4 | Pending |
| FLOW-05 | Phase 4 | Pending |
| FLOW-06 | Phase 4 | Pending |
| FLOW-07 | Phase 4 | Pending |
| FLOW-08 | Phase 4 | Pending |
| FLOW-09 | Phase 4 | Pending |
| FLOW-10 | Phase 4 | Pending |
| FLOW-11 | Phase 5 | Pending |
| FLOW-12 | Phase 4 | Pending |
| CONV-01 | Phase 6 | Pending |
| CONV-02 | Phase 6 | Pending |
| CONV-03 | Phase 6 | Pending |
| CONV-04 | Phase 6 | Pending |
| CONV-05 | Phase 6 | Pending |
| CONV-06 | Phase 6 | Pending |
| CONV-07 | Phase 6 | Pending |
| CONV-08 | Phase 6 | Pending |
| CONV-09 | Phase 6 | Pending |
| WORK-01 | Phase 7 | Pending |
| WORK-02 | Phase 7 | Pending |
| WORK-03 | Phase 7 | Pending |
| WORK-04 | Phase 7 | Pending |
| WORK-05 | Phase 7 | Pending |
| WORK-06 | Phase 7 | Pending |
| WORK-07 | Phase 7 | Pending |
| WORK-08 | Phase 7 | Pending |
| WORK-09 | Phase 7 | Pending |
| UX-01 | Phase 8 | Pending |
| UX-02 | Phase 8 | Pending |
| UX-03 | Phase 8 | Pending |
| UX-04 | Phase 8 | Pending |
| UX-05 | Phase 8 | Pending |
| UX-06 | Phase 8 | Pending |
| UX-07 | Phase 8 | Pending |
| UX-08 | Phase 8 | Pending |
| UX-09 | Phase 8 | Pending |
| PERF-01 | Phase 8 | Pending |
| PERF-02 | Phase 8 | Pending |
| PERF-03 | Phase 8 | Pending |
| PERF-04 | Phase 8 | Pending |
| PERF-05 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 58 total
- Mapped to phases: 58
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after initial definition*
