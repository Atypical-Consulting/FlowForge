# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** The intelligence is in the agent; the authority is in the infrastructure.
**Current focus:** v1.8.0 UI/UX Enhancements -- Phase 53: Workspace Layout Presets

## Current Position

Phase: 53 of 53 (Workspace Layout Presets)
Plan: 1 of 2 in current phase
Status: Executing Phase 53
Last activity: 2026-02-14 -- Completed 53-01 (layout data foundation: presets, slice, commands, menu)

Progress: [█████████░] 90% (v1.8.0)

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
| v1.7.0 Extensions Everywhere | Complete | 2026-02-11 |

See `.planning/MILESTONES.md` for full history.

## Performance Metrics

**Cumulative:**
- Total phases: 52 complete, 1 in progress
- Total plans: ~243 complete
- Total requirements validated: 306
- Codebase: ~42,200 LOC TypeScript + ~11,400 Rust
- Tests: 295 (Vitest + jsdom), 74 (Rust)
- Built-in extensions: 15

## Accumulated Context

### Known Tech Debt

- CC blade accessibility polish (aria-live debounce, amend mode styling, aria-labels)
- Init Repo blade UX refinements (focus behavior, listbox pattern, aria-describedby)
- 3D viewer reliability on some hardware (diagnostic logging only)
- Pre-existing TS2440 in auto-generated bindings.ts
- Phase 34 human runtime testing pending (6 OAuth flow items)
- GFEX-06 needs human runtime verification (architecture correct)
- 13 items pending human runtime verification from v1.7.0
- Phase 50: 5 items pending human runtime verification (ViewZone visuals, hunk round-trip, line selection, keyboard shortcuts, partial indicator)
- Phase 51 gaps: CLOSED — contributor filter wired to CommitHistory, GravatarAvatar integrated in history views (plan 51-05)

### Key Decisions

All decisions logged in PROJECT.md Key Decisions table with outcomes marked.
- Phase 52-01: Two-segment interpolation (green->yellow->red) for clearer visual distinction at gradient extremes
- Phase 52-01: 100ms anti-flicker delay on tooltip hide to prevent flash between adjacent nodes
- Phase 52-01: Legend as absolute overlay at bottom-left to avoid layout shifts
- Phase 52-02: isPinned optional field for backward compat with existing stored data
- Phase 52-02: Pin state preserved when re-opening repo via existingEntry lookup
- Phase 52-03: Temporary repo handle pattern for health checks avoids state conflicts with active repository
- Phase 52-03: 500ms debounce on health checks to prevent rapid re-fetches
- Phase 52-03: Health dot between folder icon and repo name for left-side visual indicator
- Phase 53-01: Focus mode state (focusedPanel) is transient, not persisted to Tauri Store
- Phase 53-01: Manual resize sets activePreset to "custom" for non-preset state detection
- Phase 53-01: Panel IDs as open-ended strings for forward compatibility with future panels

### Research Flags

None active.

### Blockers/Concerns

None active.

### Pending Todos

None.

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 53-01-PLAN.md (layout data foundation). Phase 53 plan 1 of 2 done.
Resume file: None

---
*State updated: 2026-02-14*
*Next: 53-02-PLAN.md (panel wiring and UI integration)*
