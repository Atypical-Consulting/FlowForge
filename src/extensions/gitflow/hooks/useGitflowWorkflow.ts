import { useSelector } from "@xstate/react";
import { getGitflowActor } from "../machines/context";
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
import type { GitflowOp } from "../machines/types";

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
    startOperation: (op: GitflowOp, name: string) =>
      actorRef.send({ type: "START", operation: op, name }),
    finishOperation: (op: GitflowOp, tagMessage?: string) =>
      actorRef.send({ type: "FINISH", operation: op, tagMessage }),
    abortGitflow: () => actorRef.send({ type: "ABORT_GITFLOW" }),
    retryRefresh: () => actorRef.send({ type: "RETRY_REFRESH" }),
    dismiss: () => actorRef.send({ type: "DISMISS_ERROR" }),
  };
}
