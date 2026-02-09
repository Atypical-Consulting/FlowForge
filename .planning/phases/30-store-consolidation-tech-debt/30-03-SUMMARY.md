# Plan 30-03 Summary: Store Registry, Blade Factory, and GitOps Domain Store

**Status:** COMPLETE
**Duration:** ~20 min
**Commits:** `acbf907`, `26ab8a9`

## What Changed

### Task 1: Store reset registry + blade store factory

**Files created:**
- `src/stores/registry.ts` -- `resetAllStores()` and `registerStoreForReset()` using Zustand's recommended pattern with `getInitialState()` + `setState(_, true)`
- `src/stores/createBladeStore.ts` -- Factory wrapping `create()` with devtools middleware and auto-registration in the reset registry

**Key decisions:**
- Used `StoreApi<T>` from zustand for the store parameter type to avoid incompatibility with devtools middleware's overloaded `setState` signature
- DevTools only enabled in `import.meta.env.DEV`

### Task 2: GitOps domain store (9 slices)

**Files created:**
- `src/stores/domain/git-ops/types.ts` -- `GitOpsMiddleware` type alias for `[["zustand/devtools", never]]`
- `src/stores/domain/git-ops/repository.slice.ts` -- Repository slice with prefixed keys (`repoStatus`, `repoIsLoading`, `repoError`, etc.)
- `src/stores/domain/git-ops/branches.slice.ts` -- Branch slice (`branchList`, `branchAllList`, `branchIsLoading`, `branchError`, etc.)
- `src/stores/domain/git-ops/tags.slice.ts` -- Tag slice (`tagList`, `tagIsLoading`, `tagError`, etc.)
- `src/stores/domain/git-ops/stash.slice.ts` -- Stash slice (`stashList`, `stashIsLoading`, `stashError`, etc.)
- `src/stores/domain/git-ops/worktrees.slice.ts` -- Worktree slice (`worktreeList`, `worktreeIsLoading`, `worktreeError`, `worktreeSelected`, etc.)
- `src/stores/domain/git-ops/gitflow.slice.ts` -- Gitflow slice (`gitflowStatus`, `gitflowIsLoading`, `gitflowError`, etc.)
- `src/stores/domain/git-ops/undo.slice.ts` -- Undo slice (`undoInfo`, `undoIsLoading`, `undoIsUndoing`, etc.)
- `src/stores/domain/git-ops/topology.slice.ts` -- Topology slice (`nodes`, `edges`, `topologySelectedCommit`, `topologyIsLoading`, etc.)
- `src/stores/domain/git-ops/clone.slice.ts` -- Clone slice (`cloneIsCloning`, `cloneProgress`, `cloneError`, etc.)
- `src/stores/domain/git-ops/index.ts` -- Composed `useGitOpsStore` with all 9 slices, registered for reset

**Files modified (converted to re-export shims):**
- `src/stores/repository.ts`, `src/stores/branches.ts`, `src/stores/tags.ts`, `src/stores/stash.ts`, `src/stores/worktrees.ts`, `src/stores/gitflow.ts`, `src/stores/topology.ts`, `src/stores/undo.ts`, `src/stores/clone.ts` -- All now re-export `useGitOpsStore` under their original names

**Consumer files updated (29 files):**
- `src/App.tsx`, `src/components/Header.tsx`, `src/components/RepositoryView.tsx`, `src/components/WelcomeView.tsx`
- `src/components/branches/BranchList.tsx`, `CreateBranchDialog.tsx`, `MergeDialog.tsx`
- `src/components/clone/CloneForm.tsx`
- `src/components/gitflow/GitflowPanel.tsx`, `FinishFlowDialog.tsx`, `InitGitflowDialog.tsx`, `StartFlowDialog.tsx`
- `src/components/stash/StashList.tsx`, `StashDialog.tsx`
- `src/components/tags/TagList.tsx`
- `src/components/worktree/WorktreePanel.tsx`, `CreateWorktreeDialog.tsx`, `DeleteWorktreeDialog.tsx`
- `src/components/navigation/BranchSwitcher.tsx`, `RepoSwitcher.tsx`
- `src/commands/branches.ts`, `navigation.ts`, `repository.ts`, `sync.ts`
- `src/blades/gitflow-cheatsheet/GitflowCheatsheetBlade.tsx`
- `src/hooks/useBranches.ts`, `useCommitGraph.ts`, `useKeyboardShortcuts.ts`
- `src/stores/repository.test.ts`

**Key decisions:**
- All state keys prefixed to avoid collisions: `repo*`, `branch*`, `tag*`, `stash*`, `worktree*`, `gitflow*`, `undo*`, `topology*`, `clone*`
- Action names follow `"gitOps:{slice}/{action}"` convention for DevTools
- Cross-store `getState()` anti-patterns in gitflow and worktrees slices resolved by using `get()` within the unified store
- Re-export shims marked `@deprecated` for gradual migration

## Verification

- `npx tsc --noEmit` -- 0 errors (excluding pre-existing node:crypto in test setup)
- `npm test` -- 82/82 tests pass across 18 test files
