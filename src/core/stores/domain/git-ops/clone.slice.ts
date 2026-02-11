import type { StateCreator } from "zustand";
import type { CloneProgress } from "../../../../bindings";
import type { GitOpsMiddleware } from "./types";
import type { GitOpsStore } from "./index";

export interface CloneSlice {
  cloneIsCloning: boolean;
  cloneProgress: CloneProgress | null;
  cloneError: string | null;

  startClone: () => void;
  updateCloneProgress: (progress: CloneProgress) => void;
  finishClone: () => void;
  setCloneError: (error: string) => void;
  resetClone: () => void;
}

export const createCloneSlice: StateCreator<
  GitOpsStore,
  GitOpsMiddleware,
  [],
  CloneSlice
> = (set) => ({
  cloneIsCloning: false,
  cloneProgress: null,
  cloneError: null,

  startClone: () => {
    set({ cloneIsCloning: true, cloneProgress: null, cloneError: null }, undefined, "gitOps:clone/start");
  },

  updateCloneProgress: (progress) => {
    set({ cloneProgress: progress }, undefined, "gitOps:clone/progress");
  },

  finishClone: () => {
    set({ cloneIsCloning: false }, undefined, "gitOps:clone/finish");
  },

  setCloneError: (error) => {
    set({ cloneIsCloning: false, cloneError: error }, undefined, "gitOps:clone/error");
  },

  resetClone: () => {
    set({ cloneIsCloning: false, cloneProgress: null, cloneError: null }, undefined, "gitOps:clone/reset");
  },
});
