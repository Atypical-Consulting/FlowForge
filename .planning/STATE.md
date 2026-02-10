# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** The intelligence is in the agent; the authority is in the infrastructure.
**Current focus:** Phase 41 - Sandbox & Polish

## Current Position

Phase: 41 of 41 (Sandbox & Polish)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-02-10 - Completed quick task 34: move files related to extensions closer

Progress: [████████░░] 77% (10/13 plans)

## Milestone History

| Milestone | Status | Shipped |
|-----------|--------|---------|
| v1.0.0 MVP | Complete | 2026-02-04 |
| v1.1.0 Usability | Complete | 2026-02-06 |
| v1.2.0 Bugfixing & Polish | Complete | 2026-02-07 |
| v1.3.0 Blades Blades Blades | Complete | 2026-02-08 |
| v1.4.0 Architecture & Navigation Overhaul | Complete | 2026-02-09 |
| v1.5.0 GitHub Extension | Complete | 2026-02-10 |
| v1.6.0 Refactor to Extensions | In progress | - |

See `.planning/MILESTONES.md` for full history.

## Performance Metrics

**Cumulative:**
- Total phases: 40 complete, 1 planned
- Total plans: ~211 complete, 3 planned
- Total requirements validated: 230
- Codebase: ~45,400 LOC (34,300 TypeScript + 11,075 Rust)
- Tests: 207 (Vitest + jsdom)

## Accumulated Context

### Known Tech Debt

- 16 backward-compatibility re-export shims (@deprecated) — targeted for removal in Phase 41
- CC blade accessibility polish (aria-live debounce, amend mode styling, aria-labels)
- Maximize button in CommitForm missing aria-label (identified by UX review)
- Init Repo blade UX refinements (focus behavior, listbox pattern, aria-describedby)
- 3D viewer reliability on some hardware (diagnostic logging only)
- Pre-existing TS2440 in auto-generated bindings.ts
- Phase 34 human runtime testing pending (6 OAuth flow items)
- BladeRenderer does not subscribe to blade registry changes — already-open blades won't auto-restore on extension re-enable (minor UX gap)
- CC Zustand store not explicitly reset on extension disable (ghost data persists but invisible)
- Gitflow sidebar panel position shifted below Worktrees (renders via DynamicSidebarPanels at priority 65)

### Key Decisions

All decisions logged in PROJECT.md Key Decisions table with outcomes marked.
Phase 38: coreOverride pattern adopted for built-in extension blade registration — avoids cascading namespace changes.
Phase 39: CC extraction follows content-viewers pattern for blades, GitHub extension pattern for toolbar/commands. Read-side CC utilities (commit-type-theme, conventional-utils) stay in core. emitWill("commit") infrastructure wired but no handler registered (CC validates via canCommit).
Phase 40: Gitflow extraction follows CC pattern. branchClassifier.ts stays in core (ADR-2: 10+ core consumers, classification is core Git UX). gitflow.slice.ts stays in GitOpsStore (ADR-1: cross-slice deps on loadBranches/refreshRepoStatus).

### Research Flags

- Phase 41 (Sandbox): Worker MessageChannel bridge needs research during planning

### Blockers/Concerns

None active.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 34 | move files related to extensions closer (like for the github extension) | 2026-02-10 | 74a0b78 | [34-move-files-related-to-extensions-closer-](./quick/34-move-files-related-to-extensions-closer-/) |

### Pending Todos

None.

## Session Continuity

Last session: 2026-02-10
Stopped at: Phase 40 complete, ready to plan Phase 41
Resume file: None

---
*State updated: 2026-02-10*
*Phase 40 Gitflow Extraction complete — 2/2 plans, 4/5 must-haves verified (GFEX-03 accepted as core per ADR-2), 9 new lifecycle tests, 3-agent team research + direct execution.*
