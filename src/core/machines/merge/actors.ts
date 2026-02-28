import { fromPromise } from "xstate";
import type { MergeResult } from "../../../bindings";
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
});
