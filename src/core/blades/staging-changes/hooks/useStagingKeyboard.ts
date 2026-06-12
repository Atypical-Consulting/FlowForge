import { useHotkeys } from "react-hotkeys-hook";
import type { FileChange } from "../../../../bindings";
import { useUIStore as useStagingStore } from "../../../stores/domain/ui-state";

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
  const { stagingSelectedFile, selectFile } = useStagingStore();

  const currentIndex = allFiles.findIndex(
    (item) => item.file.path === stagingSelectedFile?.path,
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
      if (stagingSelectedFile) {
        onExpand?.();
      }
    },
    { enabled, enableOnFormTags: false },
    [stagingSelectedFile, onExpand],
  );

  useHotkeys(
    "space",
    (e) => {
      // Folder rows (and other button-like elements) handle Space themselves
      // to toggle expand/collapse. react-hotkeys-hook's `enableOnFormTags`
      // filter does not exclude `role="button"` divs or native buttons, so
      // without this guard pressing Space on a focused folder would BOTH
      // expand the folder AND stage/unstage the selected file. Skip the
      // staging toggle when the focused element owns the Space key.
      const target = e.target as HTMLElement | null;
      const focused = (target ?? document.activeElement) as HTMLElement | null;
      if (
        focused &&
        (focused.tagName === "BUTTON" ||
          focused.getAttribute("role") === "button")
      ) {
        return;
      }
      e.preventDefault();
      if (stagingSelectedFile) {
        onToggleStage?.();
      }
    },
    { enabled, enableOnFormTags: false },
    [stagingSelectedFile, onToggleStage],
  );
}
