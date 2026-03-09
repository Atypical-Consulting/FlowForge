import type { SnapshotFrom } from "xstate";
import type { mergeMachine } from "./mergeMachine";

type MergeSnapshot = SnapshotFrom<typeof mergeMachine>;

export const selectMergeState = (snap: MergeSnapshot) => snap.value;

export const selectConflicts = (snap: MergeSnapshot) => snap.context.conflicts;

export const selectMergeError = (snap: MergeSnapshot) => snap.context.error;

export const selectMergeResult = (snap: MergeSnapshot) =>
  snap.context.mergeResult;

export const selectIsMerging = (snap: MergeSnapshot) => snap.matches("merging");

export const selectIsConflicted = (snap: MergeSnapshot) =>
  snap.matches("conflicted");

export const selectIsAborting = (snap: MergeSnapshot) =>
  snap.matches("aborting");

export const selectSourceBranch = (snap: MergeSnapshot) =>
  snap.context.sourceBranch;
