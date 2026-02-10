# Phase 39: Conventional Commits Extraction - Research Synthesis

**Synthesized:** 2026-02-10
**Sources:** 39-RESEARCH-UX.md, 39-RESEARCH-ARCHITECTURE.md, 39-RESEARCH-IMPLEMENTATION.md
**Confidence:** HIGH (3 independent researchers, consistent findings)

---

## Consensus Decisions

### 1. Follow Phase 38 Pattern Exactly
All three researchers agree: use `registerBuiltIn()` + `coreOverride: true` + `React.lazy()` + `api.cleanup()`.

### 2. Keep Component Files in Place
Do NOT move component files to `src/extensions/conventional-commits/`. Keep them in `src/blades/` and `src/components/commit/`. Only move **registrations** to the extension entry point. This follows the Phase 38 content-viewers pattern.

### 3. Core Retains CC Protocol Layer (Read-Only)
These stay in core — used by topology graph, commit history, and commit badges:
- `src/lib/commit-type-theme.ts` (COMMIT_TYPE_THEME)
- `src/lib/conventional-utils.ts` (parseConventionalMessage, buildCommitMessage)
- `src/components/icons/CommitTypeIcon.tsx`

### 4. CommitForm.tsx is the Key Integration Point
`CommitForm.tsx` has a dual-mode design (simple textarea + CC inline). The CC toggle visibility must be gated by extension status. Use `useExtensionHost` to check if `"conventional-commits"` extension is active. Auto-reset `useConventional` to false when extension is disabled.

### 5. Defer onWillCommit Validation
All researchers flag that `emitWill("commit")` is NOT currently called in `useCommitExecution.ts`. However, UX and dev researchers recommend **deferring** onWillCommit-based validation:
- The CC form already validates via `canCommit` flag (type + description required, Rust validation)
- Adding onWillCommit would intercept ALL commits (including simple mode), which contradicts degradation design
- Wire `emitWill("commit")` as infrastructure prep, but do NOT register a CC validation handler in this phase

### 6. No New Registry Needed
Architecture research proposed a `CommitFormRegistry`. UX and dev research show the simpler approach works:
- CommitForm checks extension host status to conditionally show CC toggle
- CC components are lazy-imported from existing paths
- No new API surface or registry needed for Phase 39

### 7. Rust Backend Stays Unchanged
All 5 CC-related IPC commands remain in the Rust backend. The extension extraction is purely frontend. Rust tests (20 tests) stay in place.

### 8. No Vite/CSS Changes Needed
- All CC styles are inline Tailwind utilities
- No CC-specific `@theme {}` entries
- Catppuccin tokens are global
- Build output unchanged — same lazy chunk boundaries

---

## File Inventory Summary

### Create (1 file)
| File | Purpose |
|------|---------|
| `src/extensions/conventional-commits/index.ts` | Extension entry point |

### Delete (2 files)
| File | Reason |
|------|--------|
| `src/blades/conventional-commit/registration.ts` | Registration moves to extension |
| `src/blades/changelog/registration.ts` | Registration moves to extension |

### Modify (3-5 files)
| File | Change |
|------|--------|
| `src/App.tsx` | Add `registerBuiltIn` for conventional-commits |
| `src/blades/_discovery.ts` | Remove "conventional-commit" and "changelog" from EXPECTED_TYPES |
| `src/components/commit/CommitForm.tsx` | Gate CC toggle on extension status; auto-reset useConventional |
| `src/hooks/useCommitExecution.ts` | Wire `emitWill("commit")` before commit (infrastructure prep) |
| `src/commands/toolbar-actions.ts` | Remove `tb:changelog` (moves to extension) |
| `src/commands/repository.ts` | Remove `generate-changelog` (moves to extension) |

### Keep Unchanged
All 25+ CC component files, stores, hooks, and Rust backend code stay in their current locations.

---

## Risk Matrix

| Risk | Severity | Mitigation |
|------|----------|------------|
| CommitForm refactoring breaks sidebar commit | HIGH | Test both modes before/after; incremental changes |
| Import cycles between extension and core | MEDIUM | Extension imports from core only (one-way) |
| Stale CC store state after disable/re-enable | LOW | Accept as edge case; store resets on blade close |
| BladeRenderer with disabled extension blade | LOW | Phase 38 already added fallback for unregistered types |

---

## Plan Structure Recommendation

**3 plans in 2 waves:**

**Wave 1 (infrastructure):**
- Plan 01: Extension entry point + registration migration + CommitForm integration

**Wave 2 (cleanup + verification):**
- Plan 02: Wire emitWill("commit"), move toolbar/command registrations, cleanup core
- Plan 03: Graceful degradation testing + extension lifecycle tests

---

## Detailed Research Documents

- [39-RESEARCH-UX.md](./39-RESEARCH-UX.md) — UX flows, form patterns, degradation design, accessibility
- [39-RESEARCH-ARCHITECTURE.md](./39-RESEARCH-ARCHITECTURE.md) — Dependency graph, extraction sequence, extensibility patterns
- [39-RESEARCH-IMPLEMENTATION.md](./39-RESEARCH-IMPLEMENTATION.md) — Tauri/Rust, React components, stores, tests, build config
