export type GitflowOp = "feature" | "release" | "hotfix";
export type GitflowPhase = "start" | "finish";

export interface GitflowContext {
  operation: GitflowOp | null;
  phase: GitflowPhase | null;
  name: string | null;
  tagMessage: string | null;
  result: string | null;
  error: string | null;
  refreshErrors: string[];
}

export type GitflowEvent =
  | { type: "START"; operation: GitflowOp; name: string }
  | { type: "FINISH"; operation: GitflowOp; tagMessage?: string }
  | { type: "ABORT_GITFLOW" }
  | { type: "RETRY_REFRESH" }
  | { type: "DISMISS_ERROR" };

export type GitflowState =
  | "idle"
  | "executing"
  | "refreshing"
  | "stale"
  | "error";
