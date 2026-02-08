import { useHotkeys } from "react-hotkeys-hook";
import type { FileChange } from "../bindings";
import { useStagingStore } from "../stores/staging";

interface UseStagingKeyboardOptions {
  allFiles: Array<{
    file: FileChange;
    section: "staged" | "unstaged" | "untracked";
  }>;
  enabled: boolean;
  onExpand?: () => void;
  onToggleStage?: () => void;
}

export function useStagingKeyboard({
  allFiles,
  enabled,
  onExpand,
  onToggleStage,
}: UseStagingKeyboardOptions): void {
  const { selectedFile, selectFile } = useStagingStore();

  const currentIndex = allFiles.findIndex(
    (item) => item.file.path === selectedFile?.path,
  );

  useHotkeys(
    "down",
    (e) => {
      e.preventDefault();
      if (currentIndex < allFiles.length - 1) {
        const next = allFiles[currentIndex + 1];
        selectFile(next.file, next.section);
      }
    },
    { enabled, enableOnFormTags: false },
    [currentIndex, allFiles, selectFile],
  );

  useHotkeys(
    "j",
    (e) => {
      e.preventDefault();
      if (currentIndex < allFiles.length - 1) {
        const next = allFiles[currentIndex + 1];
        selectFile(next.file, next.section);
      }
    },
    { enabled, enableOnFormTags: false },
    [currentIndex, allFiles, selectFile],
  );

  useHotkeys(
    "up",
    (e) => {
      e.preventDefault();
      if (currentIndex > 0) {
        const prev = allFiles[currentIndex - 1];
        selectFile(prev.file, prev.section);
      }
    },
    { enabled, enableOnFormTags: false },
    [currentIndex, allFiles, selectFile],
  );

  useHotkeys(
    "k",
    (e) => {
      e.preventDefault();
      if (currentIndex > 0) {
        const prev = allFiles[currentIndex - 1];
        selectFile(prev.file, prev.section);
      }
    },
    { enabled, enableOnFormTags: false },
    [currentIndex, allFiles, selectFile],
  );

  useHotkeys(
    "enter",
    (e) => {
      e.preventDefault();
      if (selectedFile) {
        onExpand?.();
      }
    },
    { enabled, enableOnFormTags: false },
    [selectedFile, onExpand],
  );

  useHotkeys(
    "space",
    (e) => {
      e.preventDefault();
      if (selectedFile) {
        onToggleStage?.();
      }
    },
    { enabled, enableOnFormTags: false },
    [selectedFile, onToggleStage],
  );
}
