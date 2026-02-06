import type { FileChange } from "../bindings";
import type { BladeType } from "../stores/blades";
import { useBladeStore } from "../stores/blades";

/** Map file extension to a specialized blade type, or "diff" as default */
function bladeTypeForFile(filePath: string): BladeType {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".nupkg")) return "viewer-nupkg";
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".ico")
  )
    return "viewer-image";
  return "diff";
}

export function useBladeNavigation() {
  const store = useBladeStore();

  const openCommitDetails = (oid: string) => {
    store.pushBlade({
      type: "commit-details",
      title: "Commit",
      props: { oid },
    });
  };

  /** Push a diff blade for a historical commit file */
  const openDiff = (oid: string, filePath: string) => {
    const type = bladeTypeForFile(filePath);
    store.pushBlade({
      type,
      title: filePath.split("/").pop() || filePath,
      props: { mode: "commit", oid, filePath },
    });
  };

  /** Push a diff/viewer blade for a staging (working-tree) file */
  const openStagingDiff = (
    file: FileChange,
    section: "staged" | "unstaged" | "untracked",
  ) => {
    const type = bladeTypeForFile(file.path);
    store.pushBlade({
      type,
      title: file.path.split("/").pop() || file.path,
      props: {
        mode: "staging",
        filePath: file.path,
        staged: section === "staged",
      },
    });
  };

  const goBack = () => store.popBlade();
  const goToRoot = () => store.resetStack();

  return {
    ...store,
    openCommitDetails,
    openDiff,
    openStagingDiff,
    goBack,
    goToRoot,
  };
}
