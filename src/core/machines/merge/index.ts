export { getMergeActor, type MergeActorRef } from "./context";
export { MERGE_IN_PROGRESS_MESSAGE, mergeMachine } from "./mergeMachine";
export {
  selectConflicts,
  selectIsAborting,
  selectIsConflicted,
  selectIsMerging,
  selectMergeError,
  selectMergeResult,
  selectMergeState,
  selectSourceBranch,
} from "./selectors";
export type { MergeContext, MergeEvent, MergeState } from "./types";
