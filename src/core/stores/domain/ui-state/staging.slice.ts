import type { StateCreator } from "zustand";
import type { FileChange } from "../../../../bindings";
import type { UIStore } from "./index";
import type { UIStateMiddleware } from "./types";

type ViewMode = "tree" | "flat";

export interface StagingSlice {
  stagingSelectedFile: FileChange | null;
  stagingSelectedSection: "staged" | "unstaged" | "untracked" | null;
  stagingViewMode: ViewMode;
  stagingScrollPositions: Record<string, number>;
  stagingFileListScrollTop: number;
  selectFile: (
    file: FileChange | null,
    section?: "staged" | "unstaged" | "untracked",
  ) => void;
  setStagingViewMode: (mode: ViewMode) => void;
  saveStagingScrollPosition: (filePath: string, scrollTop: number) => void;
  setStagingFileListScrollTop: (top: number) => void;
  clearStagingScrollPositions: () => void;
}

export const createStagingSlice: StateCreator<
  UIStore,
  UIStateMiddleware,
  [],
  StagingSlice
> = (set) => ({
  stagingSelectedFile: null,
  stagingSelectedSection: null,
  stagingViewMode: "tree",
  stagingScrollPositions: {},
  stagingFileListScrollTop: 0,
  selectFile: (file, section) =>
    set(
      { stagingSelectedFile: file, stagingSelectedSection: section ?? null },
      false,
      "uiState:staging/selectFile",
    ),
  setStagingViewMode: (mode) =>
    set({ stagingViewMode: mode }, false, "uiState:staging/setViewMode"),
  saveStagingScrollPosition: (filePath, scrollTop) =>
    set(
      (state) => ({
        stagingScrollPositions: {
          ...state.stagingScrollPositions,
          [filePath]: scrollTop,
        },
      }),
      false,
      "uiState:staging/saveScrollPosition",
    ),
  setStagingFileListScrollTop: (top) =>
    set(
      { stagingFileListScrollTop: top },
      false,
      "uiState:staging/setFileListScrollTop",
    ),
  clearStagingScrollPositions: () =>
    set(
      { stagingScrollPositions: {}, stagingFileListScrollTop: 0 },
      false,
      "uiState:staging/clearScrollPositions",
    ),
});
