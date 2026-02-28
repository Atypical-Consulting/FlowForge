import type { StateCreator } from "zustand";
import type { UndoInfo } from "../../../../bindings";
import { commands } from "../../../../bindings";
import type { GitOpsStore } from "./index";
import type { GitOpsMiddleware } from "./types";

export interface UndoSlice {
  undoInfo: UndoInfo | null;
  undoIsLoading: boolean;
  undoIsUndoing: boolean;

  loadUndoInfo: () => Promise<void>;
  performUndo: () => Promise<boolean>;
}

export const createUndoSlice: StateCreator<
  GitOpsStore,
  GitOpsMiddleware,
  [],
  UndoSlice
> = (set, get) => ({
  undoInfo: null,
  undoIsLoading: false,
  undoIsUndoing: false,

  loadUndoInfo: async () => {
    set({ undoIsLoading: true }, undefined, "gitOps:undo/load");
    try {
      const result = await commands.getUndoInfo();
      if (result.status === "ok") {
        set(
          { undoInfo: result.data, undoIsLoading: false },
          undefined,
          "gitOps:undo/loadOk",
        );
      } else {
        set({ undoInfo: null, undoIsLoading: false });
      }
    } catch (e) {
      console.error("Failed to load undo info:", e);
      set({ undoInfo: null, undoIsLoading: false });
    }
  },

  performUndo: async () => {
    const { undoInfo } = get();
    if (!undoInfo?.canUndo) return false;

    set({ undoIsUndoing: true }, undefined, "gitOps:undo/perform");
    try {
      const result = await commands.undoLastOperation();
      if (result.status === "ok") {
        await get().loadUndoInfo();
        set({ undoIsUndoing: false }, undefined, "gitOps:undo/performOk");
        return true;
      }
      set({ undoIsUndoing: false });
      return false;
    } catch (e) {
      console.error("Failed to undo:", e);
      set({ undoIsUndoing: false });
      return false;
    }
  },
});
