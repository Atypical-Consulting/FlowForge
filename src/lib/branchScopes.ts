import type { EnrichedBranch } from "./branchClassifier";

export interface BranchScopeDefinition {
  id: string;
  label: string;
  filter: (branch: EnrichedBranch) => boolean;
  sort?: (a: EnrichedBranch, b: EnrichedBranch) => number;
  primary: boolean;
}

const scopeRegistry = new Map<string, BranchScopeDefinition>();

export function registerScope(scope: BranchScopeDefinition): void {
  scopeRegistry.set(scope.id, scope);
}

export function getScope(id: string): BranchScopeDefinition | undefined {
  return scopeRegistry.get(id);
}

export function getAllScopes(): BranchScopeDefinition[] {
  return Array.from(scopeRegistry.values());
}

export function getPrimaryScopes(): BranchScopeDefinition[] {
  return Array.from(scopeRegistry.values()).filter((s) => s.primary);
}

// ── Built-in scopes ──

registerScope({
  id: "local",
  label: "Local",
  filter: (branch) => !branch.isRemote,
  sort: (a, b) => {
    if (a.isHead && !b.isHead) return -1;
    if (!a.isHead && b.isHead) return 1;
    return a.name.localeCompare(b.name);
  },
  primary: true,
});

registerScope({
  id: "remote",
  label: "Remote",
  filter: (branch) => branch.isRemote,
  sort: (a, b) => a.name.localeCompare(b.name),
  primary: true,
});

registerScope({
  id: "recent",
  label: "Recent",
  filter: (branch) => branch.lastVisited !== null,
  sort: (a, b) => (b.lastVisited ?? 0) - (a.lastVisited ?? 0),
  primary: true,
});
