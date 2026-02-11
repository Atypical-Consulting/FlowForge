import type { MergeResult } from "../../../bindings";

export interface MergeContext {
  sourceBranch: string | null;
  conflicts: string[];
  error: string | null;
  mergeResult: MergeResult | null;
}

export type MergeEvent =
  | { type: "START_MERGE"; sourceBranch: string }
  | { type: "ABORT" }
  | { type: "RETRY" };

export type MergeState =
  | "idle"
  | "merging"
  | "conflicted"
  | "aborting"
  | "error";
