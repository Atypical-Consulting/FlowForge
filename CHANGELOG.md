# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
