import { useEffect } from "react";
import { useTopologyStore } from "../stores/topology";
import { useRepositoryStore } from "../stores/repository";

export function useCommitGraph() {
  const repoStatus = useRepositoryStore((s) => s.status);
  const {
    nodes,
    edges,
    isLoading,
    error,
    hasMore,
    selectedCommit,
    loadGraph,
    loadMore,
    selectCommit,
    reset,
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
