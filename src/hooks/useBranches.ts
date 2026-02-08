import { useMemo } from "react";
import { useBranchStore } from "../stores/branches";
import { useBranchMetadataStore } from "../stores/branchMetadata";
import { useRepositoryStore } from "../stores/repository";
import { classifyBranch, type EnrichedBranch } from "../lib/branchClassifier";

export function useBranches() {
  const repoPath = useRepositoryStore((s) => s.status?.repoPath ?? "");
  const { branches, allBranches, isLoading, error, loadBranches, loadAllBranches } =
    useBranchStore();
  const metadata = useBranchMetadataStore();

  const enriched = useMemo((): EnrichedBranch[] => {
    if (!repoPath) return [];
    const pins = new Set(metadata.pinnedBranches[repoPath] ?? []);
    const recents = metadata.recentBranches[repoPath] ?? [];
    const recentMap = new Map(recents.map((r) => [r.name, r.lastVisited]));

    return allBranches.map((branch) => {
      const bareName = branch.name
        .replace(/^refs\/heads\//, "")
        .replace(/^origin\//, "");
      return {
        ...branch,
        branchType: classifyBranch(branch.name),
        isPinned: pins.has(bareName),
        lastVisited: recentMap.get(bareName) ?? null,
      };
    });
  }, [allBranches, metadata.pinnedBranches, metadata.recentBranches, repoPath]);

  return {
    branches: enriched,
    localBranches: branches,
    isLoading,
    error,
    loadBranches,
    loadAllBranches,
    repoPath,
  };
}
