import { fromPromise } from "xstate";
import { gitHookBus } from "@/core/services/gitHookBus";
import type { MergeResult, MergeStatus } from "../../../bindings";
import { commands } from "../../../bindings";
import { getErrorMessage } from "../../lib/errors";

export const executeMerge = fromPromise<MergeResult, { sourceBranch: string }>(
  async ({ input }) => {
    const result = await commands.mergeBranch(input.sourceBranch);
    if (result.status === "error") {
      throw new Error(getErrorMessage(result.error));
    }
    return result.data;
  },
);

export const abortMergeActor = fromPromise<void, void>(async () => {
  const result = await commands.abortMerge();
  if (result.status === "error") {
    throw new Error(getErrorMessage(result.error));
  }
  gitHookBus.emitDid("merge-abort");
});

/**
 * Ask the backend whether the repository is really in the middle of a merge
 * (`MERGE_HEAD` present) and which files are still conflicted in the index.
 * This is the source of truth the machine resyncs against, since a merge can
 * be aborted, resolved or committed outside the app.
 */
export async function probeMergeStatus(): Promise<MergeStatus> {
  const result = await commands.getMergeStatus();
  if (result.status === "error") {
    throw new Error(getErrorMessage(result.error));
  }
  return result.data;
}

export const probeMergeStatusActor = fromPromise<MergeStatus, void>(() =>
  probeMergeStatus(),
);
