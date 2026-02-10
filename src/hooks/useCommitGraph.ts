import { useEffect } from "react";
import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops";
import { useGitOpsStore as useTopologyStore } from "../stores/domain/git-ops";

export function useCommitGraph() {
  const repoStatus = useRepositoryStore((s) => s.repoStatus);
  const {
    nodes,
    edges,
    topologyIsLoading: isLoading,
    topologyError: error,
    topologyHasMore: hasMore,
    topologySelectedCommit: selectedCommit,
    loadGraph,
    loadMore,
    selectCommit,
    resetTopology: reset,
  } = useTopologyStore();

  // Load graph when repo is open
  useEffect(() => {
    if (repoStatus) {
      loadGraph();
    }
    return () => reset();
  }, [repoStatus, loadGraph, reset]);

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      loadMore();
    }
  };

  return {
    nodes,
    edges,
    isLoading,
    error,
    hasMore,
    selectedCommit,
    selectCommit,
    loadMore: handleLoadMore,
    refresh: loadGraph,
  };
}
