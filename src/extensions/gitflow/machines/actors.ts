import { fromPromise } from "xstate";
import { commands } from "../../../bindings";
import { getErrorMessage } from "../../../core/lib/errors";
import { refreshRepositoryState } from "../../../core/lib/repositoryRefresh";
import type { GitflowOp, GitflowPhase } from "./types";

export interface ExecuteGitflowInput {
  operation: GitflowOp;
  phase: GitflowPhase;
  name: string | null;
  tagMessage: string | null;
}

export const executeGitflowOp = fromPromise<string | null, ExecuteGitflowInput>(
  async ({ input }) => {
    const { operation, phase, name, tagMessage } = input;

    if (phase === "start") {
      const fn =
        operation === "feature"
          ? commands.startFeature
          : operation === "release"
            ? commands.startRelease
            : commands.startHotfix;
      const result = await fn(name!);
      if (result.status === "error") {
        throw new Error(getErrorMessage(result.error));
      }
      return result.data;
    }

    // finish phase
    if (operation === "feature") {
      const result = await commands.finishFeature();
      if (result.status === "error") {
        throw new Error(getErrorMessage(result.error));
      }
      return result.data;
    }
    const fn =
      operation === "release" ? commands.finishRelease : commands.finishHotfix;
    const result = await fn(tagMessage ?? null);
    if (result.status === "error") {
      throw new Error(getErrorMessage(result.error));
    }
    return result.data;
  },
);

export const abortGitflowOp = fromPromise<void, void>(async () => {
  const result = await commands.abortGitflow();
  if (result.status === "error") {
    throw new Error(getErrorMessage(result.error));
  }
});

/**
 * Post-operation refresh. Gitflow start/finish/abort move HEAD, so the
 * repository status (header branch), branch list, gitflow status and the
 * TanStack queries must all be refetched — the shared helper does exactly
 * that and rejects if any refresh fails (machine enters the `stale` state).
 */
export const refreshAll = fromPromise<void, void>(async () => {
  await refreshRepositoryState();
});
