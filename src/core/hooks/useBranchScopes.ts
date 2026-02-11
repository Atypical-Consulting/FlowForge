import { useMemo } from "react";
import { useBranches } from "./useBranches";
import { usePreferencesStore as useBranchMetadataStore } from "../stores/domain/preferences";
import { getScope, getPrimaryScopes } from "../lib/branchScopes";

export function useBranchScopes() {
  const { branches, repoPath, ...rest } = useBranches();
  const { getMetaScopePreference: getScopePreference, setMetaScopePreference: setScopePreference } = useBranchMetadataStore();

  const activeScopeId = getScopePreference(repoPath) || "local";
  const activeScope = getScope(activeScopeId);

  const filtered = useMemo(() => {
    if (!activeScope) return branches;
    let result = branches.filter(activeScope.filter);
    if (activeScope.sort) {
      result = [...result].sort(activeScope.sort);
    }
    return result;
  }, [branches, activeScope]);

  const pinnedBranches = useMemo(
    () => branches.filter((b) => b.isPinned),
    [branches],
  );

  const recentBranches = useMemo(
    () =>
      branches
        .filter((b) => b.lastVisited !== null && !b.isPinned && !b.isHead)
        .sort((a, b) => (b.lastVisited ?? 0) - (a.lastVisited ?? 0))
        .slice(0, 5),
    [branches],
  );

  const setScope = (scopeId: string) => {
    setScopePreference(repoPath, scopeId);
  };

  return {
    branches: filtered,
    allBranches: branches,
    pinnedBranches,
    recentBranches,
    activeScopeId,
    setScope,
    scopes: getPrimaryScopes(),
    repoPath,
    ...rest,
  };
}
