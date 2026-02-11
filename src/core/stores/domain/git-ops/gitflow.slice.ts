import type { StateCreator } from "zustand";
import type { GitflowConfig, GitflowStatus } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import type { GitOpsMiddleware } from "./types";
import type { GitOpsStore } from "./index";

// Gitflow operations (start/finish/abort) moved to src/extensions/gitflow/machines/

export interface GitflowSlice {
  gitflowStatus: GitflowStatus | null;
  gitflowIsLoading: boolean;
  gitflowError: string | null;

  refreshGitflow: () => Promise<void>;
  initGitflow: (config: GitflowConfig, pushDevelop: boolean) => Promise<boolean>;
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
    set({ gitflowIsLoading: true, gitflowError: null }, undefined, "gitOps:gitflow/refresh");
    const result = await commands.getGitflowStatus();
    if (result.status === "ok") {
      set({ gitflowStatus: result.data, gitflowIsLoading: false }, undefined, "gitOps:gitflow/refreshOk");
    } else {
      set({ gitflowError: getErrorMessage(result.error), gitflowIsLoading: false });
    }
  },

  initGitflow: async (config, pushDevelop) => {
    set({ gitflowIsLoading: true, gitflowError: null }, undefined, "gitOps:gitflow/init");
    const result = await commands.initGitflow(config, pushDevelop);
    if (result.status === "ok") {
      await get().refreshGitflow();
      return true;
    }
    set({ gitflowError: getErrorMessage(result.error), gitflowIsLoading: false });
    return false;
  },

  clearGitflowError: () => set({ gitflowError: null }, undefined, "gitOps:gitflow/clearError"),
});
