import { create } from "zustand";
import type { GitflowConfig, GitflowStatus } from "../bindings";
import { commands } from "../bindings";
import { getErrorMessage } from "../lib/errors";
import { useBranchStore } from "./branches";
import { useRepositoryStore } from "./repository";

interface GitflowState {
  status: GitflowStatus | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  initGitflow: (
    config: GitflowConfig,
    pushDevelop: boolean,
  ) => Promise<boolean>;
  startFeature: (name: string) => Promise<string | null>;
  finishFeature: () => Promise<boolean>;
  startRelease: (version: string) => Promise<string | null>;
  finishRelease: (tagMessage?: string) => Promise<string | null>;
  startHotfix: (name: string) => Promise<string | null>;
  finishHotfix: (tagMessage?: string) => Promise<string | null>;
  abort: () => Promise<boolean>;
  clearError: () => void;
}

export const useGitflowStore = create<GitflowState>((set, get) => ({
  status: null,
  isLoading: false,
  error: null,

  refresh: async () => {
    set({ isLoading: true, error: null });
    const result = await commands.getGitflowStatus();
    if (result.status === "ok") {
      set({ status: result.data, isLoading: false });
    } else {
      set({ error: getErrorMessage(result.error), isLoading: false });
    }
  },

  initGitflow: async (config, pushDevelop) => {
    set({ isLoading: true, error: null });
    const result = await commands.initGitflow(config, pushDevelop);
    if (result.status === "ok") {
      await get().refresh();
      return true;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return false;
  },

  startFeature: async (name) => {
    set({ isLoading: true, error: null });
    const result = await commands.startFeature(name);
    if (result.status === "ok") {
      await get().refresh();
      await useBranchStore.getState().loadBranches();
      await useRepositoryStore.getState().refreshStatus();
      return result.data;
    }
    await get().refresh();
    set({ error: getErrorMessage(result.error) });
    return null;
  },

  finishFeature: async () => {
    set({ isLoading: true, error: null });
    const result = await commands.finishFeature();
    if (result.status === "ok") {
      await get().refresh();
      await useBranchStore.getState().loadBranches();
      await useRepositoryStore.getState().refreshStatus();
      return true;
    }
    await get().refresh();
    set({ error: getErrorMessage(result.error) });
    return false;
  },

  startRelease: async (version) => {
    set({ isLoading: true, error: null });
    const result = await commands.startRelease(version);
    if (result.status === "ok") {
      await get().refresh();
      await useBranchStore.getState().loadBranches();
      await useRepositoryStore.getState().refreshStatus();
      return result.data;
    }
    await get().refresh();
    set({ error: getErrorMessage(result.error) });
    return null;
  },

  finishRelease: async (tagMessage) => {
    set({ isLoading: true, error: null });
    const result = await commands.finishRelease(tagMessage ?? null);
    if (result.status === "ok") {
      await get().refresh();
      await useBranchStore.getState().loadBranches();
      await useRepositoryStore.getState().refreshStatus();
      return result.data;
    }
    await get().refresh();
    set({ error: getErrorMessage(result.error) });
    return null;
  },

  startHotfix: async (name) => {
    set({ isLoading: true, error: null });
    const result = await commands.startHotfix(name);
    if (result.status === "ok") {
      await get().refresh();
      await useBranchStore.getState().loadBranches();
      await useRepositoryStore.getState().refreshStatus();
      return result.data;
    }
    await get().refresh();
    set({ error: getErrorMessage(result.error) });
    return null;
  },

  finishHotfix: async (tagMessage) => {
    set({ isLoading: true, error: null });
    const result = await commands.finishHotfix(tagMessage ?? null);
    if (result.status === "ok") {
      await get().refresh();
      await useBranchStore.getState().loadBranches();
      await useRepositoryStore.getState().refreshStatus();
      return result.data;
    }
    await get().refresh();
    set({ error: getErrorMessage(result.error) });
    return null;
  },

  abort: async () => {
    set({ isLoading: true, error: null });
    const result = await commands.abortGitflow();
    if (result.status === "ok") {
      await get().refresh();
      // Refresh branches (deleted feature/release/hotfix) and repo status (switched branch)
      await useBranchStore.getState().loadBranches();
      await useRepositoryStore.getState().refreshStatus();
      return true;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return false;
  },

  clearError: () => set({ error: null }),
}));
