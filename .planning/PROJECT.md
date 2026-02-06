# FlowForge

## What This Is

A cross-platform desktop Git client built on Tauri (Rust backend + React frontend) that makes Gitflow, conventional commits, and worktrees the structural foundation of the interface — not afterthoughts buried in menus. The client enforces workflow conventions through its architecture, preventing invalid operations rather than just warning about them.

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

### Active

(No active requirements — next milestone needed)

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
- Code review features — GitHub/GitLab do this well
- Real-time collaboration — high complexity
- Mobile apps — desktop-first

## Context

**Current state:** Shipped v1.1.0 with ~21,559 LOC (7,622 Rust + 13,937 TypeScript).
Tech stack: Tauri 2.x, React 19, Zustand, React Query, Monaco Editor, framer-motion.
All 92 requirements implemented across 15 phases (80 plans) in two milestones.

**Known tech debt:**
- defaultTab setting not wired in blade store initialization (hard-coded to "staging")
- Topology lacks EmptyState for repos with zero commits
- Orphaned v1.0 code: greet command, getMergeStatus, CollapsibleSidebar, AnimatedList, FadeIn
- Pre-existing TS2440 in auto-generated bindings.ts

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

---
*Last updated: 2026-02-06 after v1.1.0 milestone complete*
