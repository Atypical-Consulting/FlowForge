export { mergeMachine } from "./mergeMachine";
export { getMergeActor, type MergeActorRef } from "./context";
export {
  selectMergeState,
  selectConflicts,
  selectMergeError,
  selectMergeResult,
  selectIsMerging,
  selectIsConflicted,
  selectIsAborting,
  selectSourceBranch,
} from "./selectors";
export type { MergeContext, MergeEvent, MergeState } from "./types";
