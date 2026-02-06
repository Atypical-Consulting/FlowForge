import { create } from "zustand";
import type { BranchInfo, MergeResult } from "../bindings";
import { commands } from "../bindings";
import { getErrorMessage } from "../lib/errors";

interface BranchState {
  branches: BranchInfo[];
  allBranches: BranchInfo[];
  isLoading: boolean;
  error: string | null;
  mergeInProgress: boolean;
  lastMergeResult: MergeResult | null;

  loadBranches: () => Promise<void>;
  loadAllBranches: (includeRemote: boolean) => Promise<void>;
  createBranch: (name: string, checkout: boolean) => Promise<BranchInfo | null>;
  checkoutBranch: (name: string) => Promise<boolean>;
  checkoutRemoteBranch: (remoteBranch: string) => Promise<boolean>;
  deleteBranch: (name: string, force: boolean) => Promise<boolean>;
  mergeBranch: (sourceBranch: string) => Promise<MergeResult | null>;
  abortMerge: () => Promise<boolean>;
  clearError: () => void;
  clearMergeResult: () => void;
}

export const useBranchStore = create<BranchState>((set, get) => ({
  branches: [],
  allBranches: [],
  isLoading: false,
  error: null,
  mergeInProgress: false,
  lastMergeResult: null,

  loadBranches: async () => {
    set({ isLoading: true, error: null });
    const result = await commands.listBranches();
    if (result.status === "ok") {
      set({ branches: result.data, isLoading: false });
    } else {
      set({ error: getErrorMessage(result.error), isLoading: false });
    }
  },

  loadAllBranches: async (includeRemote: boolean) => {
    set({ isLoading: true, error: null });
    const result = await commands.listAllBranches(includeRemote);
    if (result.status === "ok") {
      set({ allBranches: result.data, isLoading: false });
    } else {
      set({ error: getErrorMessage(result.error), isLoading: false });
    }
  },

  createBranch: async (name, checkout) => {
    set({ isLoading: true, error: null });
    const result = await commands.createBranch(name, checkout);
    if (result.status === "ok") {
      await get().loadBranches();
      return result.data;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return null;
  },

  checkoutBranch: async (name) => {
    set({ isLoading: true, error: null });
    const result = await commands.checkoutBranch(name);
    if (result.status === "ok") {
      await get().loadBranches();
      return true;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return false;
  },

  checkoutRemoteBranch: async (remoteBranch: string) => {
    set({ isLoading: true, error: null });
    const result = await commands.checkoutRemoteBranch(remoteBranch);
    if (result.status === "ok") {
      await get().loadBranches();
      return true;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return false;
  },

  deleteBranch: async (name, force) => {
    set({ isLoading: true, error: null });
    const result = await commands.deleteBranch(name, force);
    if (result.status === "ok") {
      await get().loadBranches();
      return true;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return false;
  },

  mergeBranch: async (sourceBranch) => {
    set({ isLoading: true, error: null, mergeInProgress: true });
    const result = await commands.mergeBranch(sourceBranch);
    if (result.status === "ok") {
      set({
        lastMergeResult: result.data,
        mergeInProgress: result.data.hasConflicts,
        isLoading: false,
      });
      await get().loadBranches();
      return result.data;
    }
    set({
      error: getErrorMessage(result.error),
      mergeInProgress: false,
      isLoading: false,
    });
    return null;
  },

  abortMerge: async () => {
    const result = await commands.abortMerge();
    if (result.status === "ok") {
      set({ mergeInProgress: false, lastMergeResult: null });
      await get().loadBranches();
      return true;
    }
    return false;
  },

  clearError: () => set({ error: null }),
  clearMergeResult: () => set({ lastMergeResult: null }),
}));
