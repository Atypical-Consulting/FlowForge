import type { MergeResult } from "../../../bindings";

/** Which state a START_MERGE request came from, so a refused request can
 *  return the machine exactly where it was. */
export type MergeVerifyOrigin = "idle" | "conflicted" | "error";

export interface MergeContext {
  sourceBranch: string | null;
  conflicts: string[];
  error: string | null;
  mergeResult: MergeResult | null;
  /** Branch requested by a START_MERGE that is being verified. */
  pendingSourceBranch: string | null;
  /** State to resume when the verification refuses the request. */
  verifyFrom: MergeVerifyOrigin;
}

export type MergeEvent =
  | { type: "START_MERGE"; sourceBranch: string }
  | { type: "ABORT" }
  | { type: "RETRY" }
  /** The `.git` file watcher reported a change: re-check the merge state. */
  | { type: "REPOSITORY_CHANGED" };

export type MergeState =
  | "idle"
  | "verifying"
  | "merging"
  | "conflicted"
  | "aborting"
  | "error";
