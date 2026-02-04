import { create } from "zustand";
import { commands } from "../bindings";
import type { RepoStatus } from "../bindings";
import { getErrorMessage } from "../lib/errors";

interface RepositoryState {
  // Current repository state
  status: RepoStatus | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  openRepository: (path: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  closeRepository: () => Promise<void>;
  clearError: () => void;
}

export const useRepositoryStore = create<RepositoryState>((set, get) => ({
  status: null,
  isLoading: false,
  error: null,

  openRepository: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await commands.openRepository(path);
      if (result.status === "ok") {
        set({ status: result.data, isLoading: false });
      } else {
        const errorMsg = getErrorMessage(result.error);
        set({ error: errorMsg, isLoading: false, status: null });
        throw new Error(errorMsg);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (!get().error) {
        set({ error: errorMessage, isLoading: false, status: null });
      }
      throw e;
    }
  },

  refreshStatus: async () => {
    const { status } = get();
    if (!status) return;

    try {
      const result = await commands.getRepositoryStatus();
      if (result.status === "ok") {
        set({ status: result.data });
      }
    } catch (e) {
      console.error("Failed to refresh status:", e);
    }
  },

  closeRepository: async () => {
    try {
      await commands.closeRepository();
    } catch (e) {
      console.error("Failed to close repository:", e);
    }
    set({ status: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
