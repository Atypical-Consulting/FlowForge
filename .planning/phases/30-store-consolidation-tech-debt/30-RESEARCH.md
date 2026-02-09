# Phase 30: Store Consolidation & Tech Debt - Research Synthesis

**Researched:** 2026-02-09
**Domain:** Zustand store consolidation, tech debt resolution, UX improvements
**Confidence:** HIGH
**Approach:** 3-agent parallel research (UX Specialist, Technical Architect, Expert Developer)

## Summary

Phase 30 consolidates FlowForge's 21 shared Zustand stores (+ 2 blade-local) into ~5 domain-grouped stores using Zustand v5's official slices pattern, fixes 9 accumulated tech debt items, and resolves 5 UX-impacting bugs. The research was conducted by three parallel agents covering UX, architecture, and implementation angles. All three converged on the same core recommendations.

**Primary recommendation:** Use Zustand's `StateCreator` slices pattern for domain consolidation, implement a store registry with `resetAllStores()` for coordinated resets, and fix targeted UX bugs (stale blades, empty state, toast surfacing) before the consolidation to reduce risk.

## Detailed Research

Three specialized research documents provide the full details:

| Document | Focus | Lines |
|----------|-------|-------|
| [30-RESEARCH-UX.md](./30-RESEARCH-UX.md) | Empty states, toasts, context switch UX, accessibility, command palette, store consolidation UX risks | 654 |
| [30-RESEARCH-ARCHITECTURE.md](./30-RESEARCH-ARCHITECTURE.md) | Slices pattern, domain grouping, reset architecture, extensibility, migration strategy, dead code | 917 |
| [30-RESEARCH-IMPLEMENTATION.md](./30-RESEARCH-IMPLEMENTATION.md) | Current store inventory, Rust cleanup, Tailwind patterns, XState integration, testing impact, code examples | 770 |

## Cross-Cutting Consensus

### 1. Domain Store Grouping (All 3 agree)

| Domain Store | Slices (from current stores) | Count |
|-------------|------------------------------|-------|
| `useGitStore` | repository, branches, tags, stash, worktrees, topology, undo, gitflow, clone | 9 slices |
| `useWorkflowStore` | conventional, reviewChecklist | 2 slices |
| `useUIStore` | toast, commandPalette, staging | 3 slices |
| `usePreferencesStore` | settings, theme, navigation, branchMetadata | 4 slices |
| Blade-local (independent) | changelog, init-repo | 2 stores |

### 2. Execution Order (All 3 agree)

1. **Remove orphaned code first** (zero behavioral risk)
2. **Fix targeted bugs** (verifiable, independent)
3. **Consolidate stores** (highest risk, needs stable foundation)
4. **Surface errors as toasts** (requires consolidated store access patterns)

### 3. Critical Implementation Details

- **Naming collisions:** 8 stores have `isLoading`, 7 have `error` — MUST prefix with domain (`repoIsLoading`, `branchError`)
- **Reset architecture:** Store registry pattern with `resetAllStores()`, preferences exempt
- **Stale blade root cause:** `handleClose` in Header.tsx missing `RESET_STACK` (handleRepoSwitch has it)
- **Rust cleanup:** Only `greet` command is orphaned; `getMergeStatus` is NOT orphaned
- **Testing:** `__mocks__/zustand.ts` auto-reset mock works unchanged with sliced stores
- **`useShallow`** required for all multi-property selectors from consolidated stores

### 4. Key Open Questions

1. **defaultTab "history" option:** Maps to topology process but is a sub-view. Keep the setting but implement as two-step (switch to topology + set sub-view)
2. **Console.error to toast scope:** ~28 console.error calls in stores. Only user-triggered operations should toast; background operations should remain console-only
3. **Gitflow slice placement:** Recommended in gitOps due to heavy cross-dependencies with branches/repository

## Sources

See individual research documents for full source lists. All findings verified via:
- Context7 `/pmndrs/zustand` (v5.0.x) — slices pattern, TypeScript generics, devtools, reset
- Direct codebase analysis — all 23 store files, lib.rs, navigation machine, CSS theme
- WCAG 2.1 AA accessibility guidelines for toast/empty state patterns
