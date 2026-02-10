# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** The intelligence is in the agent; the authority is in the infrastructure.
**Current focus:** Phase 32 - Toolbar Overhaul

## Current Position

Phase: 32 of 36 (Toolbar Overhaul)
Plan: 1 of 2 complete
Status: Executing
Last activity: 2026-02-10 — Plan 32-01 Toolbar Registry & Action Data Model complete (3/3 tasks)

Progress: [█░░░░░░░░░] 17%

## Milestone History

| Milestone | Status | Shipped |
|-----------|--------|---------|
| v1.0.0 MVP | Complete | 2026-02-04 |
| v1.1.0 Usability | Complete | 2026-02-06 |
| v1.2.0 Bugfixing & Polish | Complete | 2026-02-07 |
| v1.3.0 Blades Blades Blades | Complete | 2026-02-08 |
| v1.4.0 Architecture & Navigation Overhaul | Complete | 2026-02-09 |
| v1.5.0 GitHub Extension | In progress | — |

See `.planning/MILESTONES.md` for full history.

## Performance Metrics

**Cumulative:**
- Total phases: 31 complete + 5 planned = 36
- Total plans: ~187 complete
- Total requirements validated: 178 (+ 31 v1.5 pending)
- Codebase: ~36,946 LOC (28,155 TypeScript + 8,791 Rust)
- Tests: 140 (Vitest + jsdom)

## Accumulated Context

### Known Tech Debt

- 16 backward-compatibility re-export shims (@deprecated) — gradual migration needed
- CC blade accessibility polish (aria-live debounce, amend mode styling, aria-labels)
- Init Repo blade UX refinements (focus behavior, listbox pattern, aria-describedby)
- 3D viewer reliability on some hardware (diagnostic logging only)
- Pre-existing TS2440 in auto-generated bindings.ts

### Key Decisions

All decisions logged in PROJECT.md Key Decisions table with outcomes marked.

**Phase 32-01 decisions:**
- Used union type for ToolbarGroup (not enum) so Phase 33 extensions can extend with custom group strings
- Map<string, ToolbarAction> with immutable copy-on-write for O(1) ID lookups
- Toolbar action ID convention: core="tb:{name}", extensions="ext:{extId}:{name}"
- Extracted queryClient to shared lib module for non-React query invalidation access

### Pending Todos

None.

### Blockers/Concerns

- ~~CSP is currently null~~ — RESOLVED: Strict CSP applied in Phase 31
- OAuth token storage must use OS keychain from day one, never plaintext (Phase 34 addresses this)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 022 | Fix vertical separator stuck on left - resizable panels | 2026-02-05 | e22f4ea | [022-fix-vertical-separator-stuck-left](./quick/022-fix-vertical-separator-stuck-left/) |
| 023 | Fix app icon not filling circle on welcome page | 2026-02-05 | 65485a5 | [023-fix-app-icon-not-filling-circle-on-welco](./quick/023-fix-app-icon-not-filling-circle-on-welco/) |
| 024 | Bump version to v1.1.0 | 2026-02-06 | dfc6d4e | [024-prepare-v110-version-bump](./quick/024-prepare-v110-version-bump/) |
| 025 | Fix TAURI_CHANNEL CI pipeline failure | 2026-02-06 | c6bafb2 | [025-fix-tauri-channel-ci-pipeline](./quick/025-fix-tauri-channel-ci-pipeline/) |
| 026 | Fix DMG damaged on macOS (revert broken signing vars) | 2026-02-06 | 27011ba | [026-fix-dmg-damaged-macos-signing](./quick/026-fix-dmg-damaged-macos-signing/) |
| 027 | Improve doc website with GitFlow/Conventional Commits explanations and download button | 2026-02-08 | d0c8da3 | [27-improve-doc-website-with-gitflow-convent](./quick/27-improve-doc-website-with-gitflow-convent/) |
| 028 | Fix BladeRegistry missing registration for viewer-3d | 2026-02-09 | 977b28e | [28-fix-bladeregistry-missing-registration-f](./quick/28-fix-bladeregistry-missing-registration-f/) |
| 029 | Fix XState navigation machine stopped actor preventing blade opens | 2026-02-09 | 0410d3d | [29-fix-xstate-navigation-machine-stopped-ac](./quick/29-fix-xstate-navigation-machine-stopped-ac/) |
| 030 | Make repo-browser a singleton blade in XState navigation machine | 2026-02-09 | 415f2e7 | [30-make-repo-browser-a-singleton-blade-in-x](./quick/30-make-repo-browser-a-singleton-blade-in-x/) |
| 031 | Merge all dependabot dependency update PRs (#6-#13) | 2026-02-09 | f1b92ba | [31-merge-all-dependabot-dependency-update-p](./quick/31-merge-all-dependabot-dependency-update-p/) |
| 032 | Fix reqwest 0.13 rustls-tls feature rename breaking Rust build | 2026-02-09 | 580c044 | [32-fix-reqwest-0-13-rustls-tls-feature-rena](./quick/32-fix-reqwest-0-13-rustls-tls-feature-rena/) |

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 32-01-PLAN.md — ready for 32-02-PLAN.md
Resume file: None

---
*State updated: 2026-02-10*
*v1.5.0 GitHub Extension -- Phase 32 Plan 01 complete, Plan 02 next*
