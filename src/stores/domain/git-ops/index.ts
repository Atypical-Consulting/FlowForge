import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { registerStoreForReset } from "../../registry";
import { createRepositorySlice, type RepositorySlice } from "./repository.slice";
import { createBranchSlice, type BranchSlice } from "./branches.slice";
import { createTagSlice, type TagSlice } from "./tags.slice";
import { createStashSlice, type StashSlice } from "./stash.slice";
import { createWorktreeSlice, type WorktreeSlice } from "./worktrees.slice";
import { createGitflowSlice, type GitflowSlice } from "./gitflow.slice";
import { createUndoSlice, type UndoSlice } from "./undo.slice";
import { createTopologySlice, type TopologySlice } from "./topology.slice";
import { createCloneSlice, type CloneSlice } from "./clone.slice";

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

export type { RepositorySlice } from "./repository.slice";
export type { BranchSlice } from "./branches.slice";
export type { TagSlice } from "./tags.slice";
export type { StashSlice } from "./stash.slice";
export type { WorktreeSlice } from "./worktrees.slice";
export type { GitflowSlice } from "./gitflow.slice";
export type { UndoSlice } from "./undo.slice";
export type { TopologySlice } from "./topology.slice";
export type { CloneSlice } from "./clone.slice";
