import type { StateCreator } from "zustand";
import type { TagInfo } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import type { GitOpsStore } from "./index";
import type { GitOpsMiddleware } from "./types";

export interface TagSlice {
  tagList: TagInfo[];
  tagIsLoading: boolean;
  tagError: string | null;

  loadTags: () => Promise<void>;
  deleteTag: (name: string) => Promise<boolean>;
  clearTagError: () => void;
}

export const createTagSlice: StateCreator<
  GitOpsStore,
  GitOpsMiddleware,
  [],
  TagSlice
> = (set, get) => ({
  tagList: [],
  tagIsLoading: false,
  tagError: null,

  loadTags: async () => {
    set({ tagIsLoading: true, tagError: null }, undefined, "gitOps:tag/load");
    const result = await commands.listTags();
    if (result.status === "ok") {
      set(
        { tagList: result.data, tagIsLoading: false },
        undefined,
        "gitOps:tag/loadOk",
      );
    } else {
      set({ tagError: getErrorMessage(result.error), tagIsLoading: false });
    }
  },

  deleteTag: async (name: string) => {
    set({ tagIsLoading: true, tagError: null }, undefined, "gitOps:tag/delete");
    const result = await commands.deleteTag(name);
    if (result.status === "ok") {
      await get().loadTags();
      return true;
    }
    set({ tagError: getErrorMessage(result.error), tagIsLoading: false });
    return false;
  },

  clearTagError: () =>
    set({ tagError: null }, undefined, "gitOps:tag/clearError"),
});
