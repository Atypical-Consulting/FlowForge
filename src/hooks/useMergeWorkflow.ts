import { useSelector } from "@xstate/react";
import { getMergeActor } from "../machines/merge/context";
import {
  selectMergeState,
  selectConflicts,
  selectMergeError,
  selectMergeResult,
  selectIsMerging,
  selectIsConflicted,
  selectIsAborting,
  selectSourceBranch,
} from "../machines/merge/selectors";

/**
 * React hook providing the merge workflow API.
 *
 * Uses the module-level merge machine actor (singleton).
 * State is derived reactively via `useSelector` — components
 * re-render only when selected values change.
 */
export function useMergeWorkflow() {
  const actorRef = getMergeActor();
  const state = useSelector(actorRef, selectMergeState);
  const conflicts = useSelector(actorRef, selectConflicts);
  const error = useSelector(actorRef, selectMergeError);
  const mergeResult = useSelector(actorRef, selectMergeResult);
  const isMerging = useSelector(actorRef, selectIsMerging);
  const isConflicted = useSelector(actorRef, selectIsConflicted);
  const isAborting = useSelector(actorRef, selectIsAborting);
  const sourceBranch = useSelector(actorRef, selectSourceBranch);

  return {
    state,
    conflicts,
    error,
    mergeResult,
    isMerging,
    isConflicted,
    isAborting,
    sourceBranch,
    startMerge: (branch: string) =>
      actorRef.send({ type: "START_MERGE", sourceBranch: branch }),
    abort: () => actorRef.send({ type: "ABORT" }),
    retry: () => actorRef.send({ type: "RETRY" }),
  };
}
