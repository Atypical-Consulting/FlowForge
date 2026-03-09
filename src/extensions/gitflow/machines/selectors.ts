import type { SnapshotFrom } from "xstate";
import type { gitflowMachine } from "./gitflowMachine";

type GitflowSnapshot = SnapshotFrom<typeof gitflowMachine>;

export const selectGitflowState = (snap: GitflowSnapshot) => snap.value;

export const selectOperation = (snap: GitflowSnapshot) =>
  snap.context.operation;

export const selectPhase = (snap: GitflowSnapshot) => snap.context.phase;

export const selectGitflowResult = (snap: GitflowSnapshot) =>
  snap.context.result;

export const selectGitflowError = (snap: GitflowSnapshot) => snap.context.error;

export const selectRefreshErrors = (snap: GitflowSnapshot) =>
  snap.context.refreshErrors;

export const selectIsExecuting = (snap: GitflowSnapshot) =>
  snap.matches("executing");

export const selectIsAborting = (snap: GitflowSnapshot) =>
  snap.matches("aborting");

export const selectIsRefreshing = (snap: GitflowSnapshot) =>
  snap.matches("refreshing");

export const selectIsStale = (snap: GitflowSnapshot) => snap.matches("stale");

export const selectIsBusy = (snap: GitflowSnapshot) =>
  snap.matches("executing") ||
  snap.matches("aborting") ||
  snap.matches("refreshing");
