# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0] - 2026-02-15

### Added

- **Enhanced Diff Viewer**
  - Collapsible unchanged code regions with "Show N unchanged lines" expander
  - Word-level (character-level) diff highlighting within changed lines
  - Persistent diff view mode preference (split/unified) across sessions

- **Inline Conflict Resolution**
  - Two-pane diff view (ours vs theirs) with editable result panel
  - One-click hunk resolution: accept ours, theirs, or both with undo support
  - Manual merged result editing with syntax highlighting and reset
  - Mark file as resolved with auto-staging and toast confirmation
  - Conflict count badge in toolbar

- **Hunk & Line Staging**
  - Stage/unstage individual hunks from diff viewer via gutter controls
  - Stage/unstage individual lines with clickable glyph margin checkboxes
  - Keyboard shortcuts (Shift+click range, Ctrl+Shift+S/U)
  - Partial-stage indicator (yellow half-circle) in staging panel

- **Git Insights Dashboard** (new extension)
  - Commit activity chart with configurable time ranges (7/30/90 days)
  - Contributor breakdown with commit counts and click-to-filter
  - Branch health overview with staleness flags and quick actions
  - Repository stats cards (total commits, branches, contributors, repo age)
  - Gravatar avatars in commit history views with initials fallback

- **Visualization & Welcome Polish**
  - Commit heat map on topology graph colored by recency with legend
  - Hover tooltips on commit nodes (hash, author, date, subject)
  - Pinned repositories on welcome screen with persistent pin state
  - Repository health indicators (clean/dirty/ahead/behind/diverged) on welcome cards
  - Quick actions on repo cards (open, open in terminal, remove from recents)

- **Workspace Layout Presets**
  - Four presets: Review, Commit, Explore, Focus via toolbar View menu
  - Focus mode via double-click on panel header, Esc to exit
  - Panel toggle via Panels menu with Cmd+\ sidebar shortcut
  - Panel sizes persist across sessions with "Reset to default" option

## [1.0.0] - 2026-02-04

### Added

- **Core Git Operations**
  - File staging and unstaging with visual diff viewer
  - Commit creation with conventional commit support
  - Branch management (create, switch, merge, delete)
  - Tag management (lightweight and annotated)
  - Stash operations (save, pop, apply, drop)

- **Gitflow Workflow**
  - Start and finish feature branches
  - Start and finish release branches
  - Start and finish hotfix branches
  - Automatic merging and tagging

- **Visual Features**
  - Interactive commit topology graph
  - Resizable three-panel layout
  - File tree view with status indicators
  - Monaco-based diff viewer with syntax highlighting

- **Worktree Management**
  - Create and manage multiple worktrees
  - Switch between worktrees
  - Remove worktrees safely

- **Conventional Commits**
  - Type selector (feat, fix, docs, style, refactor, test, chore)
  - Scope autocomplete from recent commits
  - Breaking change support
  - Real-time validation

- **User Experience**
  - Catppuccin Mocha dark theme throughout
  - Smooth animations with Framer Motion
  - Keyboard shortcuts
  - Recent repositories list
  - Drag-and-drop folder opening

- **Technical Foundation**
  - Tauri 2 for cross-platform desktop app
  - React 19 with TypeScript
  - Rust backend with libgit2 (git2-rs)
  - Type-safe IPC with tauri-specta
  - Zustand for state management
  - TanStack Query for async data

[1.0.0]: https://github.com/phmatray/git-ai/releases/tag/v1.0.0
