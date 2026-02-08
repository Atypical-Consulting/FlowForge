# Phase 28 Review Findings

Three parallel reviewers (UX, Architecture, Expert Developer) examined Plans 28-01 and 28-02 before execution. This document tracks their findings and resolution status.

## UX Review

| # | Priority | Finding | Status |
|---|----------|---------|--------|
| 1 | Low | CommitPreview compact: add overflow indicator (gradient or "N more lines") | Deferred to Phase 30 |
| 2 | Medium | CommitPreview full: consider min-h-[200px] instead of 300px | Kept 300px; flex-1 handles expansion |
| 3 | High | Debounce aria-live content by 500-800ms for screen readers | Tracked in STATE.md for Phase 30 |
| 4 | Medium | Apply peach/caution color to ALL buttons in amend mode | Tracked in STATE.md for Phase 30 |
| 5 | High | Add aria-label attributes for amend mode buttons | Tracked in STATE.md for Phase 30 |
| 6 | Low | TypeSelector: consider container-query responsive fallback 6->4 columns | Deferred |
| 7 | High | Ensure sidebar-blade mutual exclusion before blade ships | Done in Plan 28-03 |
| 8 | Low | Consider swapping green/blue emphasis for button hierarchy | Kept current ordering |

## Architecture Review

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Low | ConventionalMessageParts.commitType should be CommitType (not "") in pure function | Accepted; function handles empty gracefully |
| 2 | Low | Document round-trip tests as behavioral, not contractual | Tests cover current behavior |
| 3 | Medium | Consolidate scopeSuggestions and scopeFrequencies into one fetch | Tracked in STATE.md for Phase 30 |
| 4 | Low | Extract pushAfterCommit to preferences store | Tracked in STATE.md for Phase 30 |
| 5 | Low | Refactor useAmendPrefill callback pattern | Tracked in STATE.md for Phase 30 |
| 6 | Medium | Migrate CommitTypeIcon to import from conventional-utils.ts directly | Target Phase 29 |
| 7 | Low | Monitor useConventionalCommit.ts size; split at ~100 lines | Tracked in STATE.md for Phase 30 |

## Expert Developer Review

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Low | CC regex allows space before colon | Kept lenient parsing (user-friendly) |
| 2 | Low | CC regex should support BREAKING-CHANGE: (hyphen) | Done in CommitPreview HighlightedBodyLine |
| 3 | Info | Channel<SyncProgress> created but not listened to | Documented for future progress UI |
| 4 | Info | Store lacks devtools middleware (pre-existing) | Intentionally not added |
| 5 | Info | Round-trip test caveat for empty inputs | Tests use valid inputs only |
| 6 | Good | Amend stale closure bug fix via mutation variable | Implemented as designed |
| 7 | Good | hasContent callback fixes stale message reference | Implemented as designed |

## Summary

- **3 findings addressed during execution** (sidebar exclusion, BREAKING-CHANGE hyphen, amend closure fix)
- **7 findings tracked for Phase 30** (accessibility, store cleanup, hook refactoring)
- **1 finding tracked for Phase 29** (CommitTypeIcon parser migration)
- **Remaining findings**: deferred or accepted as-is with documented rationale
