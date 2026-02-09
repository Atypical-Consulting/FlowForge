# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** The intelligence is in the agent; the authority is in the infrastructure.
**Current focus:** Phase 29 COMPLETE - Blade-Centric File Structure

## Current Position

Phase: 29 of 30 (Blade-Centric File Structure)
Plan: 6 of 6 in current phase
Status: Phase 29 COMPLETE
Last activity: 2026-02-09 - Completed Phase 29: all 15 blades migrated to blade-centric file structure

Progress: [████████░░] 83%

## Milestone History

| Milestone | Status | Shipped |
|-----------|--------|---------|
| v1.0.0 MVP | Complete | 2026-02-04 |
| v1.1.0 Usability | Complete | 2026-02-06 |
| v1.2.0 Bugfixing & Polish | Complete | 2026-02-07 |
| v1.3.0 Blades Blades Blades | Complete | 2026-02-08 |
| v1.4.0 Architecture & Navigation Overhaul | In progress | - |

See `.planning/MILESTONES.md` for full history.

## Performance Metrics

**Velocity:**
- Total plans completed: 22 (v1.4.0)
- Average duration: ~5 min/plan
- Total execution time: ~110 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 25 | 3/3 | ~15 min | ~5 min |
| 26 | 4/4 | ~20 min | ~5 min |
| 27 | 4/4 | ~20 min | ~5 min |
| 28 | 5/5 | ~25 min | ~5 min |
| 29 | 6/6 | ~30 min | ~5 min |

*Updated after each plan completion*

## Accumulated Context

### Tech Debt (targeted in Phase 30)

- closeRepository() does not call resetStack()
- defaultTab setting not wired in blade store initialization
- Topology lacks EmptyState for repos with zero commits
- Orphaned v1.0 code: greet, getMergeStatus, CollapsibleSidebar, AnimatedList, FadeIn
- Debug page (viewer3d-test.html) ships in production bundle
- Gitflow cheatsheet not registered in command palette
- Review store errors logged to console only (no user-facing toast)
- Duplicate blade opener implementation
- 21 Zustand stores need consolidation into ~5 domain stores
- CC blade: Debounce aria-live preview by 500-800ms for screen readers (Phase 28 review)
- CC blade: Apply peach/caution color to Commit button in amend mode (not just Commit & Push)
- CC blade: Add aria-label attributes for amend mode buttons
- CC blade: Extract pushAfterCommit to preferences store (survives reset, user preference)
- CC blade: Refactor useAmendPrefill to own the effect instead of callback pattern
- CC blade: Consolidate scopeSuggestions (limit 20) and scopeFrequencies (limit 50) into single fetch
- CC blade: Monitor useConventionalCommit.ts size; split at ~100 lines of logic

### Key Decisions

All decisions logged in PROJECT.md Key Decisions table with outcomes marked.

**Phase 29 decisions:**
- Blade-centric file structure: `src/blades/{blade-name}/` with co-located component, registration, sub-components, hooks, store, tests
- Shared infrastructure in `src/blades/_shared/` (14 files: BladeContainer, BladePanel, BladeStrip, etc.)
- Single-glob auto-discovery: `import.meta.glob("./*/registration.{ts,tsx}")` with dev-mode exhaustiveness check
- Exclusive stores (changelog, initRepo) moved into blade directories; shared stores stay in `src/stores/`
- DiffSource type extracted to `src/blades/diff/types.ts` to break circular dependency
- CI boundary enforcement via `scripts/check-blade-boundaries.sh` (no cross-blade imports)
- Biome `noPrivateImports` skipped (v2 feature, current is 1.9.0); CI script serves as fallback
- Wave-based parallel migration: 3 waves with dependency management for safe concurrent execution

**Phase 25 decisions:**
- Zustand auto-reset mock placed at project root `__mocks__/` (Vitest convention for third-party mocking)
- `vi.hoisted()` required for per-file mock objects (ESM hoisting)
- ResizeObserver polyfill added to global setup for react-resizable-panels
- Monaco loader mock requires `init()` returning `{ editor: { defineTheme } }`

**Phase 26 decisions:**
- XState v5 navigation machine with explicit push/pop/replace/reset events
- Direction-aware blade animations with AnimatePresence
- NavigationGuardDialog for dirty-form protection
- Singleton blade metadata enforced at FSM guard level

**Phase 27 decisions:**
- `reqwest` with `rustls-tls` for GitHub API (cross-platform TLS)
- `include_str!` for bundled templates (compile-time embedding, no runtime resource loading)
- Dual-mode blade rendering via `onCancel`/`onComplete` props for standalone welcome screen use
- Path traversal validation added to `write_init_files` after security review
- Team review identified 13 improvement items for future iteration (see 27-REVIEW-FINDINGS.md)

**Phase 28 decisions:**
- Pure utility extraction (`conventional-utils.ts`) enables testability and shared logic between sidebar and blade
- `useCommitExecution` and `useAmendPrefill` hooks shared between CommitForm (sidebar) and ConventionalCommitBlade
- Singleton blade enforcement via XState FSM guard (SINGLETON_TYPES Set)
- Syntax highlighting uses CC theme colors from `commit-type-theme.ts`
- Success overlay with framer-motion spring animation and 1.5s auto-navigate timer
- 7 built-in commit templates with Lucide icons as chip bar (shows when form empty, collapses on input)
- ScopeFrequencyChart uses pure CSS horizontal bars with Catppuccin accent colors (no charting library)

### Pending Todos

None.

### Blockers/Concerns

None.

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

## Session Continuity

Last session: 2026-02-09
Stopped at: Phase 29 complete, ready for Phase 30
Resume file: None

---
*State updated: 2026-02-09*
*v1.4.0 Architecture & Navigation Overhaul -- Phase 29 COMPLETE, ready for Phase 30*
