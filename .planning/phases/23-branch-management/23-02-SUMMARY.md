---
status: complete
---

# Plan 23-02: Branch Metadata Store, Scope Registry, and Composition Hooks

## What was built
Extensible branch management data layer: a Zustand store for per-repo user metadata (pins, recents, scope preference) with Tauri persistence, a registry-based scope system for branch filtering/sorting, and two composition hooks that merge raw git branch data with user metadata into typed `EnrichedBranch[]` arrays.

## Key files
### Created
- `src/stores/branchMetadata.ts` -- Zustand store managing pinned branches (max 5), recent branch visits (max 10), and scope preferences per repository, all persisted to the Tauri store
- `src/lib/branchScopes.ts` -- Registry-based scope system with `BranchScopeDefinition` interface and three built-in scopes: local (alpha, HEAD first), remote (alpha), recent (by lastVisited descending)
- `src/hooks/useBranches.ts` -- Composition hook that merges `useBranchStore` git data with `useBranchMetadataStore` user metadata and `classifyBranch` typing into `EnrichedBranch[]`
- `src/hooks/useBranchScopes.ts` -- Higher-level hook wrapping `useBranches` with active scope filtering/sorting, plus computed pinned and recent branch sections

## Deviations
None

## Self-Check
PASSED -- `npx tsc --noEmit` reports zero new errors (only pre-existing bindings.ts TS2440). All 4 files export their intended interfaces, types, and functions.
