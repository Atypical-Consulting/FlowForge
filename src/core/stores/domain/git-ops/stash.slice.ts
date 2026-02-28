import type { StateCreator } from "zustand";
import type { StashEntry } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import type { GitOpsStore } from "./index";
import type { GitOpsMiddleware } from "./types";

export interface StashSlice {
  stashList: StashEntry[];
  stashIsLoading: boolean;
  stashError: string | null;

  loadStashes: () => Promise<void>;
  saveStash: (
    message: string | null,
    includeUntracked: boolean,
  ) => Promise<boolean>;
  applyStash: (index: number) => Promise<boolean>;
  popStash: (index: number) => Promise<boolean>;
  dropStash: (index: number) => Promise<boolean>;
  clearStashError: () => void;
}

export const createStashSlice: StateCreator<
  GitOpsStore,
  GitOpsMiddleware,
  [],
  StashSlice
> = (set, get) => ({
  stashList: [],
  stashIsLoading: false,
  stashError: null,

  loadStashes: async () => {
    set(
      { stashIsLoading: true, stashError: null },
      undefined,
      "gitOps:stash/load",
    );
    const result = await commands.listStashes();
    if (result.status === "ok") {
      set(
        { stashList: result.data, stashIsLoading: false },
        undefined,
        "gitOps:stash/loadOk",
      );
    } else {
      set({ stashError: getErrorMessage(result.error), stashIsLoading: false });
    }
  },

  saveStash: async (message, includeUntracked) => {
    set(
      { stashIsLoading: true, stashError: null },
      undefined,
      "gitOps:stash/save",
    );
    const result = await commands.stashSave(message, includeUntracked);
    if (result.status === "ok") {
      await get().loadStashes();
      return true;
    }
    set({ stashError: getErrorMessage(result.error), stashIsLoading: false });
    return false;
  },

  applyStash: async (index) => {
    set(
      { stashIsLoading: true, stashError: null },
      undefined,
      "gitOps:stash/apply",
    );
    const result = await commands.stashApply(index);
    if (result.status === "ok") {
      set({ stashIsLoading: false }, undefined, "gitOps:stash/applyOk");
      return true;
    }
    set({ stashError: getErrorMessage(result.error), stashIsLoading: false });
    return false;
  },

  popStash: async (index) => {
    set(
      { stashIsLoading: true, stashError: null },
      undefined,
      "gitOps:stash/pop",
    );
    const result = await commands.stashPop(index);
    if (result.status === "ok") {
      await get().loadStashes();
      return true;
    }
    set({ stashError: getErrorMessage(result.error), stashIsLoading: false });
    return false;
  },

  dropStash: async (index) => {
    set(
      { stashIsLoading: true, stashError: null },
      undefined,
      "gitOps:stash/drop",
    );
    const result = await commands.stashDrop(index);
    if (result.status === "ok") {
      await get().loadStashes();
      return true;
    }
    set({ stashError: getErrorMessage(result.error), stashIsLoading: false });
    return false;
  },

  clearStashError: () =>
    set({ stashError: null }, undefined, "gitOps:stash/clearError"),
});
