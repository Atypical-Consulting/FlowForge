---
status: complete
phase: 27-init-repo-blade
reviewers: ux-reviewer, arch-reviewer, tauri-expert
date: 2026-02-08
---

# Phase 27 Team Review Findings

## Review Team
- **UX Reviewer** — Form layout, accessibility, preview behavior, extensibility
- **Architecture Reviewer** — Blade registration, store design, component composition, dual-mode rendering
- **Tauri Expert** — Rust implementation, TypeScript bindings, Tailwind patterns, security

## Critical Issues Found & Resolution

### 1. Path Traversal in `write_init_files` (tauri-expert)
**Severity:** CRITICAL — Security vulnerability
**Issue:** `write_init_files` accepted arbitrary filenames including `../` sequences
**Resolution:** Added filename validation rejecting `/`, `\`, and `..` — committed in security fix

### 2. `include_str!` Path (tauri-expert)
**Severity:** Flagged as CRITICAL — Actually correct
**Analysis:** Reviewer calculated 3 levels up, but `../../resources/` from `src/git/gitignore.rs` is correct. Confirmed by `cargo check` passing.

### 3. `createCommit` Missing Argument (tauri-expert)
**Severity:** Flagged as CRITICAL — Already handled
**Analysis:** Implementation already passes `false` as the `amend` parameter at InitRepoForm.tsx:106.

## Actionable Improvements (for future phases)

### HIGH PRIORITY

| # | Finding | Reviewer | Action |
|---|---------|----------|--------|
| 1 | Preview auto-switching on `onFocus` may be jarring during keyboard navigation | UX | Consider explicit interaction triggers (click, toggle) instead of focus-driven switching |
| 2 | Listbox with interactive children (eye icon inside `role="option"`) | UX | Either remove eye icon from options or switch to `role="grid"` |
| 3 | Missing `aria-describedby` on search input for filtered count | UX | Add live region announcing filtered/selected count |

### MEDIUM PRIORITY

| # | Finding | Reviewer | Action |
|---|---------|----------|--------|
| 4 | Zustand store mixes 4 concerns (form, UI, cache, progress) | Arch | Move `searchQuery`, `activeCategory`, `isPickerOpen` to local component state |
| 5 | `templateContents` in store may duplicate React Query cache | Arch | Evaluate using `useQueries` instead of manual store cache |
| 6 | Template picker "Done" button may scroll out of view | UX | Add sticky footer within picker |
| 7 | Collapsed commit section with `commitEnabled: true` is contradictory | UX | Auto-expand commit section when toggle is ON |
| 8 | `useProjectDetection` returns `null` on error (indistinguishable from loading) | Arch | Return `{ detectedTypes: [] }` on error instead |
| 9 | Collapsible sections need ARIA disclosure pattern | UX | Add `aria-expanded` / `aria-controls` or use native `<details>` |

### LOW PRIORITY

| # | Finding | Reviewer | Action |
|---|---------|----------|--------|
| 10 | Component tree 3 levels deep (`init-repo/components/`) | Arch | Consider flattening |
| 11 | Preview panel `aria-live` scope too broad | UX | Apply only to status region, not entire content |
| 12 | Chip container missing `role="group"` | UX | Add `role="group" aria-label="Selected templates"` |
| 13 | Init pipeline shows only spinner, no step progress | UX | Show step-by-step progress text |

## Extensibility Recommendations (for Phase 28+)

1. **FormSection component** — Extract collapsible section with header icon + content
2. **PreviewSwitcher component** — Extract `activeSection`-based switching with `AnimatePresence`
3. **CategoryFilter** — Already generic, candidate for `src/components/common/`
4. **ChipList** — Extract generic multi-select chip display
5. **Sticky action bar** — Extract bottom Cancel/Submit pattern
6. **Dual-mode blade** — Document `onCancel`/`onComplete` props as standard pattern for blades rendering outside blade stack

**Recommendation:** Don't extract during Phase 27. Build inline, extract during Phase 28 when actual duplication appears.

## Overall Verdict

Architecture is sound and consistent with codebase patterns. The dual-mode standalone rendering approach is correct. The main actionable fix (path traversal) has been applied. UX and accessibility improvements are documented for iteration.
