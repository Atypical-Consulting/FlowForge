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

  const goBack = () => store.popBlade();
  const goToRoot = () => store.resetStack();

  return {
    ...store,
    openCommitDetails,
    openDiff,
    goBack,
    goToRoot,
  };
}
