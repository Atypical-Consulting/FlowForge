import { create } from "zustand";
import type { FileChange } from "../bindings";

type ViewMode = "tree" | "flat";

interface StagingState {
  selectedFile: FileChange | null;
  selectedSection: "staged" | "unstaged" | "untracked" | null;
  viewMode: ViewMode;
  selectFile: (
    file: FileChange | null,
    section?: "staged" | "unstaged" | "untracked",
  ) => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useStagingStore = create<StagingState>((set) => ({
  selectedFile: null,
  selectedSection: null,
  viewMode: "tree", // Tree view as default
  selectFile: (file, section) =>
    set({ selectedFile: file, selectedSection: section ?? null }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
