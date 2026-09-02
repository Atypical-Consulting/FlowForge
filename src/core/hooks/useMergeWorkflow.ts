import { useSelector } from "@xstate/react";
import { getMergeActor } from "../machines/merge/context";
import {
  selectConflicts,
  selectIsAborting,
  selectIsConflicted,
  selectIsMerging,
  selectMergeError,
  selectMergeResult,
  selectMergeState,
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
    /**
     * Request a merge. Returns `false` when the machine cannot accept the
     * request right now (a merge is running or being aborted) so callers can
     * tell the user instead of silently dropping the click.
     */
    startMerge: (branch: string): boolean => {
      const event = { type: "START_MERGE", sourceBranch: branch } as const;
      if (!actorRef.getSnapshot().can(event)) return false;
      actorRef.send(event);
      return true;
    },
    abort: () => actorRef.send({ type: "ABORT" }),
    retry: () => actorRef.send({ type: "RETRY" }),
  };
}
