import type { StateCreator } from "zustand";
import type { GitflowConfig, GitflowStatus } from "../../../bindings";
import { commands } from "../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import type { GitOpsMiddleware } from "./types";
import type { GitOpsStore } from "./index";

export interface GitflowSlice {
  gitflowStatus: GitflowStatus | null;
  gitflowIsLoading: boolean;
  gitflowError: string | null;

  refreshGitflow: () => Promise<void>;
  initGitflow: (config: GitflowConfig, pushDevelop: boolean) => Promise<boolean>;
  startFeature: (name: string) => Promise<string | null>;
  finishFeature: () => Promise<boolean>;
  startRelease: (version: string) => Promise<string | null>;
  finishRelease: (tagMessage?: string) => Promise<string | null>;
  startHotfix: (name: string) => Promise<string | null>;
  finishHotfix: (tagMessage?: string) => Promise<string | null>;
  abortGitflow: () => Promise<boolean>;
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

  startFeature: async (name) => {
    set({ gitflowIsLoading: true, gitflowError: null }, undefined, "gitOps:gitflow/startFeature");
    const result = await commands.startFeature(name);
    if (result.status === "ok") {
      await get().refreshGitflow();
      await get().loadBranches();
      await get().refreshRepoStatus();
      return result.data;
    }
    await get().refreshGitflow();
    set({ gitflowError: getErrorMessage(result.error) });
    return null;
  },

  finishFeature: async () => {
    set({ gitflowIsLoading: true, gitflowError: null }, undefined, "gitOps:gitflow/finishFeature");
    const result = await commands.finishFeature();
    if (result.status === "ok") {
      await get().refreshGitflow();
      await get().loadBranches();
      await get().refreshRepoStatus();
      return true;
    }
    await get().refreshGitflow();
    set({ gitflowError: getErrorMessage(result.error) });
    return false;
  },

  startRelease: async (version) => {
    set({ gitflowIsLoading: true, gitflowError: null }, undefined, "gitOps:gitflow/startRelease");
    const result = await commands.startRelease(version);
    if (result.status === "ok") {
      await get().refreshGitflow();
      await get().loadBranches();
      await get().refreshRepoStatus();
      return result.data;
    }
    await get().refreshGitflow();
    set({ gitflowError: getErrorMessage(result.error) });
    return null;
  },

  finishRelease: async (tagMessage) => {
    set({ gitflowIsLoading: true, gitflowError: null }, undefined, "gitOps:gitflow/finishRelease");
    const result = await commands.finishRelease(tagMessage ?? null);
    if (result.status === "ok") {
      await get().refreshGitflow();
      await get().loadBranches();
      await get().refreshRepoStatus();
      return result.data;
    }
    await get().refreshGitflow();
    set({ gitflowError: getErrorMessage(result.error) });
    return null;
  },

  startHotfix: async (name) => {
    set({ gitflowIsLoading: true, gitflowError: null }, undefined, "gitOps:gitflow/startHotfix");
    const result = await commands.startHotfix(name);
    if (result.status === "ok") {
      await get().refreshGitflow();
      await get().loadBranches();
      await get().refreshRepoStatus();
      return result.data;
    }
    await get().refreshGitflow();
    set({ gitflowError: getErrorMessage(result.error) });
    return null;
  },

  finishHotfix: async (tagMessage) => {
    set({ gitflowIsLoading: true, gitflowError: null }, undefined, "gitOps:gitflow/finishHotfix");
    const result = await commands.finishHotfix(tagMessage ?? null);
    if (result.status === "ok") {
      await get().refreshGitflow();
      await get().loadBranches();
      await get().refreshRepoStatus();
      return result.data;
    }
    await get().refreshGitflow();
    set({ gitflowError: getErrorMessage(result.error) });
    return null;
  },

  abortGitflow: async () => {
    set({ gitflowIsLoading: true, gitflowError: null }, undefined, "gitOps:gitflow/abort");
    const result = await commands.abortGitflow();
    if (result.status === "ok") {
      await get().refreshGitflow();
      await get().loadBranches();
      await get().refreshRepoStatus();
      return true;
    }
    set({ gitflowError: getErrorMessage(result.error), gitflowIsLoading: false });
    return false;
  },

  clearGitflowError: () => set({ gitflowError: null }, undefined, "gitOps:gitflow/clearError"),
});
