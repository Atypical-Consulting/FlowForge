import type { FileChange } from "../bindings";
import { useBladeStore } from "../stores/blades";

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
    store.pushBlade({
      type: "diff",
      title: filePath.split("/").pop() || filePath,
      props: { mode: "commit", oid, filePath },
    });
  };

  /** Push a diff blade for a staging (working-tree) file */
  const openStagingDiff = (
    file: FileChange,
    section: "staged" | "unstaged" | "untracked",
  ) => {
    store.pushBlade({
      type: "diff",
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
