import { OperationBus } from "@/framework/extension-system/operationBus";

export type GitOperation =
  | "commit"
  | "push"
  | "pull"
  | "fetch"
  | "checkout"
  | "branch-create"
  | "branch-delete"
  | "merge"
  | "stash"
  | "tag-create";

export interface GitHookContext {
  operation: GitOperation;
  branchName?: string;
  commitOid?: string;
  commitMessage?: string;
  remoteName?: string;
  tagName?: string;
  error?: string;
}

/** @deprecated Use `OperationBus<GitOperation, GitHookContext>` directly. */
export type GitHookBus = OperationBus<GitOperation, GitHookContext>;

/** Global Git operation bus instance. */
export const gitHookBus = new OperationBus<GitOperation, GitHookContext>(
  "GitHookBus",
);
