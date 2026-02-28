import type { StateCreator } from "zustand";
import { gitHookBus } from "@/core/services/gitHookBus";
import type { BranchInfo } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import type { GitOpsStore } from "./index";
import type { GitOpsMiddleware } from "./types";

// Merge workflow moved to src/machines/merge/

export interface BranchSlice {
  branchList: BranchInfo[];
  branchAllList: BranchInfo[];
  branchIsLoading: boolean;
  branchError: string | null;

  loadBranches: () => Promise<void>;
  loadAllBranches: (includeRemote: boolean) => Promise<void>;
  createBranch: (name: string, checkout: boolean) => Promise<BranchInfo | null>;
  checkoutBranch: (name: string) => Promise<boolean>;
  checkoutRemoteBranch: (remoteBranch: string) => Promise<boolean>;
  deleteBranch: (name: string, force: boolean) => Promise<boolean>;
  clearBranchError: () => void;
}

export const createBranchSlice: StateCreator<
  GitOpsStore,
  GitOpsMiddleware,
  [],
  BranchSlice
> = (set, get) => ({
  branchList: [],
  branchAllList: [],
  branchIsLoading: false,
  branchError: null,

  loadBranches: async () => {
    set(
      { branchIsLoading: true, branchError: null },
      undefined,
      "gitOps:branch/load",
    );
    const result = await commands.listBranches();
    if (result.status === "ok") {
      set(
        { branchList: result.data, branchIsLoading: false },
        undefined,
        "gitOps:branch/loadOk",
      );
    } else {
      set({
        branchError: getErrorMessage(result.error),
        branchIsLoading: false,
      });
    }
  },

  loadAllBranches: async (includeRemote: boolean) => {
    set(
      { branchIsLoading: true, branchError: null },
      undefined,
      "gitOps:branch/loadAll",
    );
    const result = await commands.listAllBranches(includeRemote);
    if (result.status === "ok") {
      set(
        { branchAllList: result.data, branchIsLoading: false },
        undefined,
        "gitOps:branch/loadAllOk",
      );
    } else {
      set({
        branchError: getErrorMessage(result.error),
        branchIsLoading: false,
      });
    }
  },

  createBranch: async (name, checkout) => {
    set(
      { branchIsLoading: true, branchError: null },
      undefined,
      "gitOps:branch/create",
    );
    const result = await commands.createBranch(name, checkout);
    if (result.status === "ok") {
      await get().loadBranches();
      gitHookBus.emitDid("branch-create", { branchName: name });
      return result.data;
    }
    set({ branchError: getErrorMessage(result.error), branchIsLoading: false });
    return null;
  },

  checkoutBranch: async (name) => {
    set(
      { branchIsLoading: true, branchError: null },
      undefined,
      "gitOps:branch/checkout",
    );
    const result = await commands.checkoutBranch(name);
    if (result.status === "ok") {
      await get().loadBranches();
      gitHookBus.emitDid("checkout", { branchName: name });
      return true;
    }
    set({ branchError: getErrorMessage(result.error), branchIsLoading: false });
    return false;
  },

  checkoutRemoteBranch: async (remoteBranch: string) => {
    set(
      { branchIsLoading: true, branchError: null },
      undefined,
      "gitOps:branch/checkoutRemote",
    );
    const result = await commands.checkoutRemoteBranch(remoteBranch);
    if (result.status === "ok") {
      await get().loadBranches();
      return true;
    }
    set({ branchError: getErrorMessage(result.error), branchIsLoading: false });
    return false;
  },

  deleteBranch: async (name, force) => {
    set(
      { branchIsLoading: true, branchError: null },
      undefined,
      "gitOps:branch/delete",
    );
    const result = await commands.deleteBranch(name, force);
    if (result.status === "ok") {
      await get().loadBranches();
      gitHookBus.emitDid("branch-delete", { branchName: name });
      return true;
    }
    set({ branchError: getErrorMessage(result.error), branchIsLoading: false });
    return false;
  },

  clearBranchError: () =>
    set({ branchError: null }, undefined, "gitOps:branch/clearError"),
});
