import { create } from "zustand";
import type { CloneProgress } from "../bindings";

interface CloneState {
  isCloning: boolean;
  progress: CloneProgress | null;
  error: string | null;
  startClone: () => void;
  updateProgress: (progress: CloneProgress) => void;
  finishClone: () => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useCloneStore = create<CloneState>((set) => ({
  isCloning: false,
  progress: null,
  error: null,

  startClone: () => {
    set({ isCloning: true, progress: null, error: null });
  },

  updateProgress: (progress) => {
    set({ progress });
  },

  finishClone: () => {
    set({ isCloning: false });
  },

  setError: (error) => {
    set({ isCloning: false, error });
  },

  reset: () => {
    set({ isCloning: false, progress: null, error: null });
  },
}));
