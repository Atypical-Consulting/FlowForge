import { create } from "zustand";
import type { StashEntry } from "../bindings";
import { commands } from "../bindings";
import { getErrorMessage } from "../lib/errors";

interface StashState {
  stashes: StashEntry[];
  isLoading: boolean;
  error: string | null;

  loadStashes: () => Promise<void>;
  saveStash: (
    message: string | null,
    includeUntracked: boolean,
  ) => Promise<boolean>;
  applyStash: (index: number) => Promise<boolean>;
  popStash: (index: number) => Promise<boolean>;
  dropStash: (index: number) => Promise<boolean>;
  clearError: () => void;
}

export const useStashStore = create<StashState>((set, get) => ({
  stashes: [],
  isLoading: false,
  error: null,

  loadStashes: async () => {
    set({ isLoading: true, error: null });
    const result = await commands.listStashes();
    if (result.status === "ok") {
      set({ stashes: result.data, isLoading: false });
    } else {
      set({ error: getErrorMessage(result.error), isLoading: false });
    }
  },

  saveStash: async (message, includeUntracked) => {
    set({ isLoading: true, error: null });
    const result = await commands.stashSave(message, includeUntracked);
    if (result.status === "ok") {
      await get().loadStashes();
      return true;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return false;
  },

  applyStash: async (index) => {
    set({ isLoading: true, error: null });
    const result = await commands.stashApply(index);
    if (result.status === "ok") {
      set({ isLoading: false });
      return true;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return false;
  },

  popStash: async (index) => {
    set({ isLoading: true, error: null });
    const result = await commands.stashPop(index);
    if (result.status === "ok") {
      await get().loadStashes();
      return true;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return false;
  },

  dropStash: async (index) => {
    set({ isLoading: true, error: null });
    const result = await commands.stashDrop(index);
    if (result.status === "ok") {
      await get().loadStashes();
      return true;
    }
    set({ error: getErrorMessage(result.error), isLoading: false });
    return false;
  },

  clearError: () => set({ error: null }),
}));
