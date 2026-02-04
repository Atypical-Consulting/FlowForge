import { create } from "zustand";
import { type UndoInfo, commands } from "../bindings";

interface UndoState {
  undoInfo: UndoInfo | null;
  isLoading: boolean;
  isUndoing: boolean;

  loadUndoInfo: () => Promise<void>;
  performUndo: () => Promise<boolean>;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  undoInfo: null,
  isLoading: false,
  isUndoing: false,

  loadUndoInfo: async () => {
    set({ isLoading: true });
    try {
      const result = await commands.getUndoInfo();
      if (result.status === "ok") {
        set({ undoInfo: result.data, isLoading: false });
      } else {
        set({ undoInfo: null, isLoading: false });
      }
    } catch (e) {
      console.error("Failed to load undo info:", e);
      set({ undoInfo: null, isLoading: false });
    }
  },

  performUndo: async () => {
    const { undoInfo } = get();
    if (!undoInfo?.canUndo) return false;

    set({ isUndoing: true });
    try {
      const result = await commands.undoLastOperation();
      if (result.status === "ok") {
        // Reload undo info after successful undo
        await get().loadUndoInfo();
        set({ isUndoing: false });
        return true;
      }
      set({ isUndoing: false });
      return false;
    } catch (e) {
      console.error("Failed to undo:", e);
      set({ isUndoing: false });
      return false;
    }
  },
}));
