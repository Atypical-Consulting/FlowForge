import { useMemo } from "react";
import { useGitOpsStore as useBranchStore } from "../stores/domain/git-ops";
import { usePreferencesStore as useBranchMetadataStore } from "../stores/domain/preferences";
import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops";
import { classifyBranch, type EnrichedBranch } from "../lib/branchClassifier";

export function useBranches() {
  const repoPath = useRepositoryStore((s) => s.repoStatus?.repoPath ?? "");
  const { branchList: branches, branchAllList: allBranches, branchIsLoading: isLoading, branchError: error, loadBranches, loadAllBranches } =
    useBranchStore();
  const metadata = useBranchMetadataStore();

  const enriched = useMemo((): EnrichedBranch[] => {
    if (!repoPath) return [];
    const pins = new Set(metadata.metaPinnedBranches[repoPath] ?? []);
    const recents = metadata.metaRecentBranches[repoPath] ?? [];
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
  }, [allBranches, metadata.metaPinnedBranches, metadata.metaRecentBranches, repoPath]);

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
