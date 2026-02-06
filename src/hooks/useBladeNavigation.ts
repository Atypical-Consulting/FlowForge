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

  const openDiff = (oid: string, filePath: string) => {
    store.pushBlade({
      type: "commit-diff",
      title: filePath.split("/").pop() || filePath,
      props: { oid, filePath },
    });
  };

  const openStagingDiff = (
    file: FileChange,
    section: "staged" | "unstaged" | "untracked",
  ) => {
    store.pushBlade({
      type: "staging-diff",
      title: file.path.split("/").pop() || file.path,
      props: {
        filePath: file.path,
        section,
        file: JSON.parse(JSON.stringify(file)),
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
