import type { StateCreator } from "zustand";
import type {
  GitflowConfig,
  GitflowInitResult,
  GitflowStatus,
} from "../../../../bindings";
import { commands } from "../../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import type { GitOpsStore } from "./index";
import type { GitOpsMiddleware } from "./types";

// Gitflow operations (start/finish/abort) moved to src/extensions/gitflow/machines/

export interface GitflowSlice {
  gitflowStatus: GitflowStatus | null;
  gitflowIsLoading: boolean;
  gitflowError: string | null;

  refreshGitflow: () => Promise<void>;
  /**
   * Initialize Gitflow. Resolves with the init result on success (so callers
   * can tell whether HEAD actually moved) or `null` on failure, in which case
   * `gitflowError` holds a user-facing message.
   */
  initGitflow: (
    config: GitflowConfig,
    pushDevelop: boolean,
  ) => Promise<GitflowInitResult | null>;
  clearGitflowError: () => void;
}

export const createGitflowSlice: StateCreator<
  GitOpsStore,
  GitOpsMiddleware,
  [],
  GitflowSlice
> = (set, get) => ({
  gitflowStatus: null,
  gitflowIsLoading: false,
  gitflowError: null,

  refreshGitflow: async () => {
    set(
      { gitflowIsLoading: true, gitflowError: null },
      undefined,
      "gitOps:gitflow/refresh",
    );
    const result = await commands.getGitflowStatus();
    if (result.status === "ok") {
      set(
        { gitflowStatus: result.data, gitflowIsLoading: false },
        undefined,
        "gitOps:gitflow/refreshOk",
      );
    } else {
      set({
        gitflowError: getErrorMessage(result.error),
        gitflowIsLoading: false,
      });
    }
  },

  initGitflow: async (config, pushDevelop) => {
    set(
      { gitflowIsLoading: true, gitflowError: null },
      undefined,
      "gitOps:gitflow/init",
    );
    const result = await commands.initGitflow(config, pushDevelop);
    if (result.status === "ok") {
      await get().refreshGitflow();
      return result.data;
    }
    set({
      gitflowError: getErrorMessage(result.error),
      gitflowIsLoading: false,
    });
    return null;
  },

  clearGitflowError: () =>
    set({ gitflowError: null }, undefined, "gitOps:gitflow/clearError"),
});
