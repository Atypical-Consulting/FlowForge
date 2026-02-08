# FlowForge

## What This Is

A cross-platform desktop Git client built on Tauri (Rust backend + React frontend) that makes Gitflow, conventional commits, and worktrees the structural foundation of the interface — not afterthoughts buried in menus. The client enforces workflow conventions through its architecture, preventing invalid operations rather than just warning about them. Features a blade-based navigation system with 13 blade types for rich content preview and inline workflows.

## Core Value

**The intelligence is in the agent; the authority is in the infrastructure.** The Rust backend is the policy engine that enforces workflow rules — no operation violates Gitflow, no commit message breaks conventional format, no agent or human bypasses the guardrails. Trust comes from constraints that cannot be circumvented.

## Architecture Philosophy

The product is designed in concentric circles, each standing alone:

1. **Inner circle (v1):** Best-in-class Git client with visual Gitflow, smart conventional commits, and first-class worktrees. No AI required — just excellent UX for powerful Git features.

2. **Middle circle (v2+):** Local intelligence layer — rule-based heuristics in v1, embedded lightweight model in v2+. Smart commit suggestions, semantic diff analysis, conflict annotation. Works offline, no external dependencies.

3. **Outer circle (v2+):** MCP server exposing repository state and workflow operations as structured tools. Enables AI agents to orchestrate Git workflows with policy-enforced guardrails. The tiered autonomy model (full autonomy / inform and proceed / hard stop) governs what agents can do without human approval.

Each layer adds value; each inner layer stands without the outer ones.

## Requirements

### Validated

- ✓ Tauri application scaffolding with Rust backend and React frontend — v1.0
- ✓ Core Git operations via git2-rs (stage, commit, push, pull, merge, branch, log) — v1.0
- ✓ Gitflow state machine in Rust enforcing valid operations — v1.0
- ✓ Topology panel with color-coded Gitflow lanes (main, develop, feature/*, release/*, hotfix/*) — v1.0
- ✓ Contextual branch creation dialogs (options adapt to current branch context) — v1.0
- ✓ Guided merge flows with no-fast-forward enforcement for Gitflow — v1.0
- ✓ Automatic branch cleanup after successful merge — v1.0
- ✓ Conventional commit composer with rule-based suggestions — v1.0
- ✓ Scope inference from file paths and directory structure — v1.0
- ✓ Type inference from change patterns (new files → feat, tests → test, etc.) — v1.0
- ✓ Real-time commit message validation against conventional commit spec — v1.0
- ✓ Scope autocomplete from project commit history — v1.0
- ✓ Changelog generation from conventional commit history — v1.0
- ✓ Worktree management panel showing all active worktrees — v1.0
- ✓ Worktree creation from any branch (two-click flow) — v1.0
- ✓ Worktree deletion with cleanup confirmation — v1.0
- ✓ Worktree status display (clean, dirty, conflicts) — v1.0
- ✓ Cross-platform support (macOS, Windows, Linux via Tauri) — v1.0
- ✓ Performance on large repositories (<100ms for common operations) — v1.0
- ✓ Dark/light theme toggle with Catppuccin Mocha/Latte — v1.0
- ✓ Keyboard shortcuts for common operations — v1.0
- ✓ Commit search by message text — v1.0
- ✓ Undo Git operations via reflog — v1.0
- ✓ File watcher for external change detection — v1.0

- ✓ Left panel readability (text size, action icons not overlapping) — v1.1
- ✓ Conventional Commits checkbox unchecked by default — v1.1
- ✓ Conventional Commits panel not covering changes list — v1.1
- ✓ Repository/branch switcher in top bar (GitHub Desktop style) — v1.1
- ✓ Settings grouped into dedicated settings window — v1.1
- ✓ Clone repository from within app — v1.1
- ✓ Ungit-style topology graph with SVG+DOM hybrid, lane guides, step-path edges — v1.1
- ✓ Topology center panel shows commit details on selection — v1.1
- ✓ Amend commit reloads previous commit message — v1.1
- ✓ Initialize Gitflow from app for non-Gitflow repos — v1.1
- ✓ Inspect diffs of previous commits in History view — v1.1
- ✓ Toast notification system with queue, stacking, auto-dismiss — v1.1
- ✓ Empty state illustrations for staging, stash, tags, commit history — v1.1
- ✓ Keyboard shortcut tooltips on 6 buttons — v1.1
- ✓ Button loading spinners with per-action states — v1.1
- ✓ Panel header frosted glass effect on 5 sidebar sections — v1.1
- ✓ Dirty state pulse animation on branch switcher — v1.1
- ✓ Blade navigation system with commit details, file tree, diff viewer — v1.1
- ✓ Topology auto-refresh after commits (fixed v1.0 tech debt) — v1.1
- ✓ Skeleton loaders replacing spinners during data fetch — v1.1

- ✓ VS Code-style command palette with registry pattern and fuzzy search — v1.2
- ✓ Git identity and integrations settings tabs — v1.2
- ✓ Git init onboarding prompt for non-repo folders — v1.2
- ✓ Folder-level stage/unstage in hierarchical view — v1.2
- ✓ Color-coded conventional commit type icons across all views — v1.2
- ✓ Changelog generation with commit type emoji — v1.2
- ✓ Expanded Catppuccin file-type icon set (image, font, archive, env) — v1.2
- ✓ Visual polish: modal flicker fix, subtler blade animation, tag sorting, stash labels — v1.2
- ✓ Shortcut tooltips on toolbar buttons — v1.2
- ✓ Topology branch ordering (main/develop first) — v1.2
- ✓ Diff header formatting (path gray + filename bold) — v1.2
- ✓ Blade refresh on repository switch — v1.2

- ✓ Settings migrated from modal to blade with back navigation — v1.3
- ✓ Conventional commit composer inline in commit form (blade-integrated) — v1.3
- ✓ Changelog preview as blade instead of modal dialog — v1.3
- ✓ All modal mounts removed from App.tsx — v1.3
- ✓ Extensible blade registry (1-2 files to add new blade type) — v1.3
- ✓ Type-safe blade props with compile-time validation — v1.3
- ✓ Error boundaries and Suspense fallbacks on all blades — v1.3
- ✓ Two-column Changes/Staged layout with inline diff preview — v1.3
- ✓ Inline diff expand to full-screen diff blade — v1.3
- ✓ Markdown preview blade with GFM support — v1.3
- ✓ Code viewer blade with Monaco read-only editor — v1.3
- ✓ 3D model viewer blade with orbit controls (Three.js + GLTFLoader) — v1.3
- ✓ Repository file browser blade at HEAD with breadcrumbs — v1.3
- ✓ Gitflow cheat sheet blade with SVG diagram and "You are here" indicator — v1.3
- ✓ DiffBlade markdown preview toggle for .md files — v1.3
- ✓ Branch pin/favorites with persistent Quick Access section — v1.3
- ✓ Branch scope selector (Local/Remote/Last Used) — v1.3
- ✓ Bulk delete merged branches with Gitflow protection — v1.3
- ✓ Feature branch tags in purple across topology and branch lists — v1.3
- ✓ Contextual clone/reveal button in branch management — v1.3
- ✓ Pre-merge review checklist for Gitflow finish operations — v1.3
- ✓ Documentation website on GitHub Pages — v1.3
- ✓ Rust commands for repo file browsing (list_repo_files, read_repo_file) — v1.3
- ✓ Lazy-loaded viewer dependencies (react-markdown, three.js, Monaco) — v1.3
- ✓ Unified branch classification and color system — v1.3

### Active

(No active milestone — planning next)

### Deferred to v2+

- [ ] MCP server exposing repository state as structured resources
- [ ] MCP Git operations as tools with policy enforcement
- [ ] Tiered autonomy model for agent operations

### Out of Scope

- Embedded LLM for semantic analysis — rule-based heuristics are sufficient for v1
- Choreography view and tiered autonomy UI — depends on MCP, therefore v2
- Policy configuration file (.gitclient-policy.yml) — v2 alongside MCP; guardrails exist in v1 but aren't user-configurable
- Interactive rebase drag-and-drop — valuable polish, not core differentiator, v3
- Smart staging with automatic changeset grouping — underserved not unserved, v3
- Branch health monitoring (staleness, drift indicators) — ambient UX enhancement, v3
- Built-in code editor — scope creep, IDE competition
- Issue tracker integration — v1 scope control
- Mercurial/SVN support — Git-only focus
- Plugin/extension system — complexity, security risks
- CI/CD integration — feature creep
- Built-in terminal — users have terminals
- Code review features — GitHub/GitLab do this well (lightweight checklist added in v1.3)
- Real-time collaboration — high complexity
- Mobile apps — desktop-first

## Context

**Current state:** Shipped v1.3.0 with ~29,590 LOC (8,401 Rust + 21,189 TypeScript).
Tech stack: Tauri 2.x, React 19, Zustand, React Query, Monaco Editor, Three.js, framer-motion.
All 136 requirements implemented across 25 phases (~156 plans) in four milestones.
13 blade types in registry-based navigation system.
Documentation website live on GitHub Pages.

**Known tech debt:**
- closeRepository() does not call resetStack() (stale blade content in memory after close)
- defaultTab setting not wired in blade store initialization (hard-coded to "staging")
- Topology lacks EmptyState for repos with zero commits
- Orphaned v1.0 code: greet command, getMergeStatus, CollapsibleSidebar, AnimatedList, FadeIn
- Pre-existing TS2440 in auto-generated bindings.ts
- 3D viewer reliability on some hardware (diagnostic logging only)
- Debug page (viewer3d-test.html) ships in production bundle
- Gitflow cheatsheet not registered in command palette
- Review store errors logged to console only (no user-facing toast)

**v2 vision:** MCP server exposing repository state (branches, worktrees, commit history, diffs, Gitflow context) as structured resources and tools. Tiered autonomy model:
- **Tier 1 (full autonomy):** Reversible, local, convention-clear operations
- **Tier 2 (inform and proceed):** Low-risk expected outcomes
- **Tier 3 (hard stop):** Irreversible, cross-boundary, or ambiguous

## Constraints

- **Tech stack**: Tauri + Rust + React — non-negotiable for performance and cross-platform goals
- **Git integration**: git2-rs (libgit2) for performance; CLI fallback where needed
- **Binary size**: Target <50MB installed (achieved in v1.0)
- **Memory**: Target <200MB baseline (achieved in v1.0)
- **Offline-first**: Core functionality works without network; MCP and sync are additive

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Defer MCP to v2 | API surface needs real usage patterns; shipping prematurely creates bad contracts | ✓ Good — shipped v1 faster |
| Rule-based commit suggestions in v1 | 80% accuracy with zero dependencies; embedded model is v2 enhancement | ✓ Good — works well |
| Gitflow as structural, not optional | Core differentiator; enforcing workflow prevents errors rather than warning | ✓ Good — state machine works |
| Tauri over Electron | Performance, memory, binary size all dramatically better | ✓ Good — <50MB binary |
| git2-rs over shell-out | Performance and type safety; CLI fallback only where needed | ✓ Good — fast operations |
| tauri-specta for IPC | Type-safe bindings eliminate manual sync between Rust and TypeScript | ✓ Good — zero type drift |
| React Flow + dagre for topology | Standard graph visualization with good layout algorithm | ✓ Good — clear visualization |
| Catppuccin for theming | Modern, cohesive palette with dark/light variants | ✓ Good — polished appearance |
| Zustand + React Query | Simple state management, powerful async handling | ✓ Good — clean architecture |
| SVG+DOM hybrid for topology (v1.1) | React Flow too rigid for Ungit-style; custom SVG gives full layout control | ✓ Good — lane guides + step-path edges |
| Blade navigation pattern (v1.1) | Stack-based navigation for commit details/diff viewing; breadcrumb-like UX | ✓ Good — clean push/pop semantics |
| Monaco DiffEditor for diffs (v1.1) | Professional diff rendering with syntax highlighting, inline/side-by-side toggle | ✓ Good — high-quality diff UX |
| framer-motion for animations (v1.1) | MotionConfig with reducedMotion="user" for accessibility | ✓ Good — respects OS preferences |
| Event-driven auto-refresh (v1.1) | "repository-changed" event triggers topology reload instead of polling | ✓ Good — efficient, reliable |
| Command registry pattern (v1.2) | Centralized command definitions enable palette, shortcuts, and tooltips from single source | ✓ Good — 14 commands, single registration |
| Shared commit type theme (v1.2) | Single COMMIT_TYPE_THEME module used by 4 consumers instead of per-component definitions | ✓ Good — no duplication |
| git-cliff for changelogs (v1.2) | Automated changelog generation from conventional commits in CI/CD | ✓ Good — release notes auto-generated |
| Blade registry over switch statement (v1.3) | Registry pattern reduces per-blade change footprint from 4-7 files to 1-2 | ✓ Good — extensible, type-safe |
| Three.js over model-viewer (v1.3) | model-viewer Web Component conflicts with React lifecycle; Three.js gives full control | ✓ Good — reliable rendering |
| Lazy-loaded content blades (v1.3) | Heavy dependencies (Three.js, Monaco, react-markdown) loaded on demand, zero startup impact | ✓ Good — no performance regression |
| Lightweight review checklist over full PR review (v1.3) | Avoids duplicating GitHub/GitLab; encourages review habits without blocking merges | ✓ Good — non-intrusive guidance |
| VitePress for documentation (v1.3) | Vue-based SSG with excellent DX, Catppuccin theme integration, GitHub Pages deployment | ✓ Good — fast, polished docs site |

---
*Last updated: 2026-02-08 after v1.3.0 milestone*
