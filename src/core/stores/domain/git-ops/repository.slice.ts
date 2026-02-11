import type { StateCreator } from "zustand";
import type { RepoStatus } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import { getNavigationActor } from "../../../machines/navigation/context";
import { toast } from "../../toast";
import { resetAllStores } from "../../registry";
import type { GitOpsMiddleware } from "./types";
import type { GitOpsStore } from "./index";

export interface RepositorySlice {
  repoStatus: RepoStatus | null;
  repoIsLoading: boolean;
  repoError: string | null;

  openRepository: (path: string) => Promise<void>;
  refreshRepoStatus: () => Promise<void>;
  closeRepository: () => Promise<void>;
  clearRepoError: () => void;
}

export const createRepositorySlice: StateCreator<
  GitOpsStore,
  GitOpsMiddleware,
  [],
  RepositorySlice
> = (set, get) => ({
  repoStatus: null,
  repoIsLoading: false,
  repoError: null,

  openRepository: async (path: string) => {
    set({ repoIsLoading: true, repoError: null }, undefined, "gitOps:repo/open");
    try {
      const result = await commands.openRepository(path);
      if (result.status === "ok") {
        set({ repoStatus: result.data, repoIsLoading: false }, undefined, "gitOps:repo/openOk");
      } else {
        const errorMsg = getErrorMessage(result.error);
        set({ repoError: errorMsg, repoIsLoading: false, repoStatus: null }, undefined, "gitOps:repo/openFail");
        throw new Error(errorMsg);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (!get().repoError) {
        set({ repoError: errorMessage, repoIsLoading: false, repoStatus: null });
      }
      throw e;
    }
  },

  refreshRepoStatus: async () => {
    const { repoStatus } = get();
    if (!repoStatus) return;

    try {
      const result = await commands.getRepositoryStatus();
      if (result.status === "ok") {
        set({ repoStatus: result.data }, undefined, "gitOps:repo/refreshOk");
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
      toast.error("Failed to close repository");
    }
    // Atomically reset all registered stores (gitOps, uiState, blade stores)
    resetAllStores();
    // Reset XState navigation FSM
    getNavigationActor().send({ type: "RESET_STACK" });
  },

  clearRepoError: () => set({ repoError: null }, undefined, "gitOps:repo/clearError"),
});
