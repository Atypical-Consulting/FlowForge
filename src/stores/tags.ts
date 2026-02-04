import { create } from "zustand";
import type { TagInfo } from "../bindings";
import { commands } from "../bindings";
import { getErrorMessage } from "../lib/errors";

interface TagState {
  tags: TagInfo[];
  isLoading: boolean;
  error: string | null;
  loadTags: () => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  clearError: () => void;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  isLoading: false,
  error: null,

  loadTags: async () => {
    set({ isLoading: true, error: null });
    const result = await commands.listTags();
    if (result.status === "ok") {
      set({ tags: result.data, isLoading: false });
    } else {
      set({ error: getErrorMessage(result.error), isLoading: false });
    }
  },

  deleteTag: async (name: string) => {
    const result = await commands.deleteTag(name);
    if (result.status === "ok") {
      await get().loadTags();
    }
  },

  clearError: () => set({ error: null }),
}));
