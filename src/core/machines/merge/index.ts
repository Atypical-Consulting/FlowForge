export { getMergeActor, type MergeActorRef } from "./context";
export { mergeMachine } from "./mergeMachine";
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
