import { create } from "zustand";
import type { WorktreeInfo, CreateWorktreeOptions } from "../bindings";
import { commands } from "../bindings";
import { getErrorMessage } from "../lib/errors";

interface WorktreeState {
  worktrees: WorktreeInfo[];
  isLoading: boolean;
  error: string | null;
  selectedWorktree: string | null;

  loadWorktrees: () => Promise<void>;
  createWorktree: (
    options: CreateWorktreeOptions
  ) => Promise<WorktreeInfo | null>;
  deleteWorktree: (
    name: string,
    force: boolean,
    deleteBranch: boolean
  ) => Promise<boolean>;
  selectWorktree: (name: string | null) => void;
  openInExplorer: (path: string) => Promise<void>;
  switchToWorktree: (path: string) => Promise<boolean>;
  clearError: () => void;
}

export const useWorktreeStore = create<WorktreeState>((set, get) => ({
  worktrees: [],
  isLoading: false,
  error: null,
  selectedWorktree: null,

  loadWorktrees: async () => {
    set({ isLoading: true, error: null });
    const result = await commands.listWorktrees();
    if (result.status === "ok") {
      set({ worktrees: result.data, isLoading: false });
    } else {
      set({ error: getErrorMessage(result.error), isLoading: false });
    }
  },

  createWorktree: async (options) => {
    set({ isLoading: true, error: null });
    const result = await commands.createWorktree(options);
    if (result.status === "ok") {
      await get().loadWorktrees();
      return result.data;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return null;
  },

  deleteWorktree: async (name, force, deleteBranch) => {
    set({ isLoading: true, error: null });
    const result = await commands.deleteWorktree(name, force, deleteBranch);
    if (result.status === "ok") {
      await get().loadWorktrees();
      return true;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return false;
  },

  selectWorktree: (name) => set({ selectedWorktree: name }),

  openInExplorer: async (path) => {
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    await revealItemInDir(path);
  },

  switchToWorktree: async (path) => {
    // Import repository store and switch context
    const { useRepositoryStore } = await import("./repository");
    try {
      await useRepositoryStore.getState().openRepository(path);
      return true;
    } catch {
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
