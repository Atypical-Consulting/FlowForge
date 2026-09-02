import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { registerStoreForReset } from "@/framework/stores/registry";
import { type BranchSlice, createBranchSlice } from "./branches.slice";
import { type CloneSlice, createCloneSlice } from "./clone.slice";
import { createGitflowSlice, type GitflowSlice } from "./gitflow.slice";
import {
  createRepositorySlice,
  type RepositorySlice,
} from "./repository.slice";
import { createStashSlice, type StashSlice } from "./stash.slice";
import { createTagSlice, type TagSlice } from "./tags.slice";
import { createTopologySlice, type TopologySlice } from "./topology.slice";
import { createUndoSlice, type UndoSlice } from "./undo.slice";
import { createWorktreeSlice, type WorktreeSlice } from "./worktrees.slice";

export type GitOpsStore = RepositorySlice &
  BranchSlice &
  TagSlice &
  StashSlice &
  WorktreeSlice &
  GitflowSlice &
  UndoSlice &
  TopologySlice &
  CloneSlice;

export const useGitOpsStore = create<GitOpsStore>()(
  devtools(
    (...args) => ({
      ...createRepositorySlice(...args),
      ...createBranchSlice(...args),
      ...createTagSlice(...args),
      ...createStashSlice(...args),
      ...createWorktreeSlice(...args),
      ...createGitflowSlice(...args),
      ...createUndoSlice(...args),
      ...createTopologySlice(...args),
      ...createCloneSlice(...args),
    }),
    { name: "git-ops", enabled: import.meta.env.DEV },
  ),
);

registerStoreForReset(useGitOpsStore);

/** Selector: is a repository open on the frontend? */
export const selectIsRepositoryOpen = (state: GitOpsStore): boolean =>
  state.repoStatus !== null;

/**
 * Single source of truth for "a repository is open", for non-React code such
 * as toolbar/menu `when()`/`enabled()` predicates. It reads the same store
 * the App uses to choose between the welcome screen and the repository view.
 */
export function isRepositoryOpen(): boolean {
  return selectIsRepositoryOpen(useGitOpsStore.getState());
}

export type { BranchSlice } from "./branches.slice";
export { selectCurrentBranchName } from "./branches.slice";
export type { CloneSlice } from "./clone.slice";
export type { GitflowSlice } from "./gitflow.slice";
export type { RepositorySlice } from "./repository.slice";
export type { StashSlice } from "./stash.slice";
export type { TagSlice } from "./tags.slice";
export type { TopologySlice } from "./topology.slice";
export type { UndoSlice } from "./undo.slice";
export type { WorktreeSlice } from "./worktrees.slice";
