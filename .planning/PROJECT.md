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

(None yet — ship to validate)

### Active

- [ ] Tauri application scaffolding with Rust backend and React frontend
- [ ] Core Git operations via libgit2 (clone, stage, commit, push, pull, merge, branch, log)
- [ ] Gitflow state machine in Rust enforcing valid operations
- [ ] Topology panel with color-coded Gitflow lanes (main, develop, feature/*, release/*, hotfix/*)
- [ ] Contextual branch creation dialogs (options adapt to current branch context)
- [ ] Guided merge flows with no-fast-forward enforcement for Gitflow
- [ ] Automatic branch cleanup after successful merge
- [ ] Conventional commit composer with rule-based suggestions
- [ ] Scope inference from file paths and directory structure
- [ ] Type inference from change patterns (new files → feat, tests → test, etc.)
- [ ] Real-time commit message validation against conventional commit spec
- [ ] Scope autocomplete from project commit history
- [ ] Changelog generation from conventional commit history
- [ ] Worktree management panel showing all active worktrees
- [ ] Worktree creation from any branch (two-click flow)
- [ ] Worktree deletion with cleanup confirmation
- [ ] Worktree status display (clean, dirty, conflicts)
- [ ] Cross-platform support (macOS, Windows, Linux via Tauri)
- [ ] Performance on large repositories (targeting <100ms for common operations)

### Out of Scope

- MCP server — v2 feature; need real usage patterns before designing the API surface
- Embedded LLM for semantic analysis — rule-based heuristics are sufficient for v1
- Choreography view and tiered autonomy UI — depends on MCP, therefore v2
- Policy configuration file (.gitclient-policy.yml) — v2 alongside MCP; guardrails exist in v1 but aren't user-configurable
- Interactive rebase drag-and-drop — valuable polish, not core differentiator, v3
- Smart staging with automatic changeset grouping — underserved not unserved, v3
- Branch health monitoring (staleness, drift indicators) — ambient UX enhancement, v3

## Context

**Why now:** AI coding agents are proliferating, but their Git interactions are primitive — raw CLI commands with no workflow awareness, no conventions, no guardrails. The opportunity is to build the infrastructure layer that makes AI-assisted Git workflows trustworthy.

**Competitive landscape:** GitKraken, Fork, Tower, Sourcetree dominate the GUI space. None treat Gitflow or worktrees as first-class. None are AI-ready. None are built on a modern, lightweight stack (Electron bloat is the norm).

**The v2 vision:** MCP server exposing repository state (branches, worktrees, commit history, diffs, Gitflow context) as structured resources and tools. Tiered autonomy model:
- **Tier 1 (full autonomy):** Reversible, local, convention-clear operations (staging, commit message crafting, worktree creation, local validation)
- **Tier 2 (inform and proceed):** Low-risk expected outcomes (merging feature into develop, deleting merged branches, worktree cleanup)
- **Tier 3 (hard stop):** Irreversible, cross-boundary, or ambiguous (force-push, merging to main, tagging, non-trivial conflict resolution)

The enforcement architecture ships in v1 (Gitflow state machine prevents invalid operations). The policy configuration making it agent-tunable ships in v2.

## Constraints

- **Tech stack**: Tauri + Rust + React — non-negotiable for performance and cross-platform goals
- **Git integration**: libgit2 preferred for performance; CLI fallback where libgit2 lacks features
- **Binary size**: Target <50MB installed (Tauri advantage over Electron)
- **Memory**: Target <200MB baseline (vs 500MB+ for Electron alternatives)
- **Offline-first**: Core functionality must work without network; MCP and sync are additive

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Defer MCP to v2 | API surface needs real usage patterns; shipping prematurely creates bad contracts | — Pending |
| Rule-based commit suggestions in v1 | 80% accuracy with zero dependencies; embedded model is v2 enhancement | — Pending |
| Gitflow as structural, not optional | Core differentiator; enforcing workflow prevents errors rather than warning about them | — Pending |
| Tauri over Electron | Performance, memory, binary size all dramatically better; worth the smaller ecosystem | — Pending |
| libgit2 over shell-out | Performance and type safety; CLI fallback only where libgit2 lacks coverage | — Pending |

---
*Last updated: 2026-02-03 after initialization*
