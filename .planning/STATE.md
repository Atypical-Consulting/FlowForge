# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** The intelligence is in the agent; the authority is in the infrastructure.
**Current focus:** v1.6.0 milestone complete — ready for archival

## Current Position

Phase: 42 of 42 (Audit Tech Debt Cleanup) ✓ Complete
Plan: 1 of 1 in current phase
Status: Phase complete, milestone ready for archival
Last activity: 2026-02-11 - Phase 42 executed: BladeRegistry Zustand, SandboxedAPI constant, GFEX-03

Progress: [██████████] 100% (16/16 plans)

## Milestone History

| Milestone | Status | Shipped |
|-----------|--------|---------|
| v1.0.0 MVP | Complete | 2026-02-04 |
| v1.1.0 Usability | Complete | 2026-02-06 |
| v1.2.0 Bugfixing & Polish | Complete | 2026-02-07 |
| v1.3.0 Blades Blades Blades | Complete | 2026-02-08 |
| v1.4.0 Architecture & Navigation Overhaul | Complete | 2026-02-09 |
| v1.5.0 GitHub Extension | Complete | 2026-02-10 |
| v1.6.0 Refactor to Extensions | Complete | 2026-02-11 |

See `.planning/MILESTONES.md` for full history.

## Performance Metrics

**Cumulative:**
- Total phases: 42 complete
- Total plans: ~217 complete
- Total requirements validated: 232
- Codebase: ~45,400 LOC (34,300 TypeScript + 11,075 Rust)
- Tests: 233 (Vitest + jsdom)

## Accumulated Context

### Known Tech Debt

- CC blade accessibility polish (aria-live debounce, amend mode styling, aria-labels)
- Maximize button in CommitForm missing aria-label (identified by UX review)
- Init Repo blade UX refinements (focus behavior, listbox pattern, aria-describedby)
- 3D viewer reliability on some hardware (diagnostic logging only)
- Pre-existing TS2440 in auto-generated bindings.ts
- Phase 34 human runtime testing pending (6 OAuth flow items)
- CC Zustand store not explicitly reset on extension disable (ghost data persists but invisible)
- Gitflow sidebar panel position shifted below Worktrees (renders via DynamicSidebarPanels at priority 65)
- GFEX-06 needs human runtime verification (Gitflow extension state defers to Rust backend)
- commandRegistry and previewRegistry still use plain Maps (not Zustand) — flagged by architecture analysis
- 3 new ExtensionAPI methods (onDidNavigate, events, settings) missing from sandbox-api-surface.ts classification

### Key Decisions

All decisions logged in PROJECT.md Key Decisions table with outcomes marked.
Phase 38: coreOverride pattern adopted for built-in extension blade registration — avoids cascading namespace changes.
Phase 39: CC extraction follows content-viewers pattern for blades, GitHub extension pattern for toolbar/commands. Read-side CC utilities (commit-type-theme, conventional-utils) stay in core. emitWill("commit") infrastructure wired but no handler registered (CC validates via canCommit).
Phase 40: Gitflow extraction follows CC pattern. branchClassifier.ts stays in core (ADR-2: 10+ core consumers, classification is core Git UX). gitflow.slice.ts stays in GitOpsStore (ADR-1: cross-slice deps on loadBranches/refreshRepoStatus).
Phase 42: BladeRegistry converted to Zustand store with backward-compat wrappers. SandboxedExtensionAPI uses REQUIRES_TRUST_METHODS constant. Used targeted Zustand selector in BladeRenderer for optimal performance.

### Research Flags

None active.

### Blockers/Concerns

None active.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 34 | move files related to extensions closer (like for the github extension) | 2026-02-10 | 74a0b78 | [34-move-files-related-to-extensions-closer-](./quick/34-move-files-related-to-extensions-closer-/) |
| 35 | implement 10 high-value features (copy SHA, ahead/behind, bulk staging, author filter, ext detail, settings API, event bus, onDidNavigate, badges) | 2026-02-11 | 9975187 | [35-implement-10-high-value-features-copy-sh](./quick/35-implement-10-high-value-features-copy-sh/) |
| 36 | fix duplicate GitHub linked toast on repo open | 2026-02-11 | d18e497 | [36-fix-duplicate-github-linked-toast-on-rep](./quick/36-fix-duplicate-github-linked-toast-on-rep/) |

### Pending Todos

None.

## Session Continuity

Last session: 2026-02-11
Stopped at: Phase 42 complete, v1.6.0 milestone ready for archival
Resume file: None

---
*State updated: 2026-02-11*
*Phase 42 executed: BladeRegistry Zustand conversion, SandboxedExtensionAPI constant usage, GFEX-03 checkbox. All 3 audit tech debt items resolved.*
