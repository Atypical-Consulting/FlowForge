import { useSelector } from "@xstate/react";
import type { SnapshotFrom } from "xstate";
import { useGitOpsStore } from "../../../core/stores/domain/git-ops";
import { type GitflowActorRef, getGitflowActor } from "../machines/context";
import type { gitflowMachine } from "../machines/gitflowMachine";
import {
  selectGitflowError,
  selectGitflowResult,
  selectGitflowState,
  selectIsAborting,
  selectIsBusy,
  selectIsExecuting,
  selectIsRefreshing,
  selectIsStale,
  selectOperation,
  selectPhase,
  selectRefreshErrors,
} from "../machines/selectors";
import type { GitflowEvent, GitflowOp } from "../machines/types";

type GitflowSnapshot = SnapshotFrom<typeof gitflowMachine>;

const isSettled = (snap: GitflowSnapshot) =>
  snap.matches("idle") || snap.matches("stale") || snap.matches("error");

/**
 * Send an operation event and resolve once the machine has settled again.
 * Resolves `true` when the operation itself succeeded (`idle`, or `stale`
 * when only the post-operation refresh failed) and `false` on `error`.
 *
 * Callers (the dialogs) use this to stay open — button in a loading state —
 * until the outcome is known, and to close only on success.
 */
function sendAndSettle(
  actorRef: GitflowActorRef,
  event: GitflowEvent,
): Promise<boolean> {
  return new Promise((resolve) => {
    let subscription: { unsubscribe: () => void } | null = null;
    let done = false;
    const settle = (snap: GitflowSnapshot) => {
      if (done) return;
      done = true;
      subscription?.unsubscribe();
      resolve(!snap.matches("error"));
    };
    subscription = actorRef.subscribe((snap) => {
      if (isSettled(snap)) settle(snap);
    });
    actorRef.send(event);
    // The event is ignored while an operation is in flight; in that case we
    // simply wait for the in-flight one to settle.
    if (done) subscription.unsubscribe();
  });
}

/**
 * React hook providing the gitflow workflow API.
 *
 * Uses the module-level gitflow machine actor (singleton).
 * State is derived reactively via `useSelector` — components
 * re-render only when selected values change.
 */
export function useGitflowWorkflow() {
  const actorRef = getGitflowActor();
  const state = useSelector(actorRef, selectGitflowState);
  const operation = useSelector(actorRef, selectOperation);
  const phase = useSelector(actorRef, selectPhase);
  const result = useSelector(actorRef, selectGitflowResult);
  const error = useSelector(actorRef, selectGitflowError);
  const refreshErrors = useSelector(actorRef, selectRefreshErrors);
  const isExecuting = useSelector(actorRef, selectIsExecuting);
  const isAborting = useSelector(actorRef, selectIsAborting);
  const isRefreshing = useSelector(actorRef, selectIsRefreshing);
  const isStale = useSelector(actorRef, selectIsStale);
  const isBusy = useSelector(actorRef, selectIsBusy);

  return {
    state,
    operation,
    phase,
    result,
    error,
    refreshErrors,
    isExecuting,
    isAborting,
    isRefreshing,
    isStale,
    isBusy,
    /** Resolves `true` on success, `false` on failure (see `error`). */
    startOperation: (op: GitflowOp, name: string) =>
      sendAndSettle(actorRef, { type: "START", operation: op, name }),
    /** Resolves `true` on success, `false` on failure (see `error`). */
    finishOperation: (op: GitflowOp, tagMessage?: string) =>
      sendAndSettle(actorRef, {
        type: "FINISH",
        operation: op,
        name: useGitOpsStore.getState().gitflowStatus?.activeFlow?.name,
        tagMessage,
      }),
    /** Resolves `true` on success, `false` on failure (see `error`). */
    abortGitflow: () => {
      const active = useGitOpsStore.getState().gitflowStatus?.activeFlow;
      return sendAndSettle(actorRef, {
        type: "ABORT_GITFLOW",
        operation: active?.flowType,
        name: active?.name,
      });
    },
    retryRefresh: () => actorRef.send({ type: "RETRY_REFRESH" }),
    dismiss: () => actorRef.send({ type: "DISMISS_ERROR" }),
  };
}
