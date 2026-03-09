import type { StateCreator } from "zustand";
import type { CreateWorktreeOptions, WorktreeInfo } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import type { GitOpsStore } from "./index";
import type { GitOpsMiddleware } from "./types";

export interface WorktreeSlice {
  worktreeList: WorktreeInfo[];
  worktreeIsLoading: boolean;
  worktreeError: string | null;
  worktreeSelected: string | null;

  loadWorktrees: () => Promise<void>;
  createWorktree: (
    options: CreateWorktreeOptions,
  ) => Promise<WorktreeInfo | null>;
  deleteWorktree: (
    name: string,
    force: boolean,
    deleteBranch: boolean,
  ) => Promise<boolean>;
  selectWorktree: (name: string | null) => void;
  openInExplorer: (path: string) => Promise<void>;
  switchToWorktree: (path: string) => Promise<boolean>;
  clearWorktreeError: () => void;
}

export const createWorktreeSlice: StateCreator<
  GitOpsStore,
  GitOpsMiddleware,
  [],
  WorktreeSlice
> = (set, get) => ({
  worktreeList: [],
  worktreeIsLoading: false,
  worktreeError: null,
  worktreeSelected: null,

  loadWorktrees: async () => {
    set(
      { worktreeIsLoading: true, worktreeError: null },
      undefined,
      "gitOps:worktree/load",
    );
    const result = await commands.listWorktrees();
    if (result.status === "ok") {
      set(
        { worktreeList: result.data, worktreeIsLoading: false },
        undefined,
        "gitOps:worktree/loadOk",
      );
    } else {
      set({
        worktreeError: getErrorMessage(result.error),
        worktreeIsLoading: false,
      });
    }
  },

  createWorktree: async (options) => {
    set(
      { worktreeIsLoading: true, worktreeError: null },
      undefined,
      "gitOps:worktree/create",
    );
    const result = await commands.createWorktree(options);
    if (result.status === "ok") {
      await get().loadWorktrees();
      return result.data;
    }
    set({
      worktreeError: getErrorMessage(result.error),
      worktreeIsLoading: false,
    });
    return null;
  },

  deleteWorktree: async (name, force, deleteBranch) => {
    set(
      { worktreeIsLoading: true, worktreeError: null },
      undefined,
      "gitOps:worktree/delete",
    );
    const result = await commands.deleteWorktree(name, force, deleteBranch);
    if (result.status === "ok") {
      await get().loadWorktrees();
      return true;
    }
    set({
      worktreeError: getErrorMessage(result.error),
      worktreeIsLoading: false,
    });
    return false;
  },

  selectWorktree: (name) =>
    set({ worktreeSelected: name }, undefined, "gitOps:worktree/select"),

  openInExplorer: async (path) => {
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    await revealItemInDir(path);
  },

  switchToWorktree: async (path) => {
    try {
      await get().openRepository(path);
      return true;
    } catch {
      return false;
    }
  },

  clearWorktreeError: () =>
    set({ worktreeError: null }, undefined, "gitOps:worktree/clearError"),
});
