# Phase 23: Branch Management - Architecture Research

**Researched:** 2026-02-08
**Domain:** State architecture, persistence, extensibility patterns for branch management
**Confidence:** HIGH (based on existing codebase patterns + verified Zustand/Tauri docs)

## Summary

The FlowForge codebase already establishes strong extensibility patterns through the blade registry (Phase 20.1) and has a working persistence layer via `@tauri-apps/plugin-store`. The branch management system needs to layer **user metadata** (pins, recents, scope preferences) on top of **git-sourced branch data** while maintaining a clean separation between the two. The navigation store (`src/stores/navigation.ts`) already demonstrates the exact persistence pattern needed, and can serve as the foundation for branch-level pin/recent tracking.

The primary architectural challenge is **consolidating scattered branch classification logic** (three separate implementations exist today), introducing a **registry-based scope/filter system** inspired by the blade registry, and designing a **bulk operations pipeline** that handles partial failures gracefully.

**Primary recommendation:** Create a dedicated `branchMetadata` store (separate from the git-focused `branches` store) for user preferences, use a custom hook to compose git data + metadata into enriched branch views, adopt a scope registry pattern for extensible filtering, and unify all branch classification into a single `branchClassifier.ts` module consumed everywhere.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5 | State management for branch data + user metadata | Already used across all stores |
| @tauri-apps/plugin-store | ^2 | Persistent key-value storage for pins/recents | Already used by settings + navigation stores |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (existing) | Icons for pin/unpin, scope selector, bulk actions | Branch UI elements |
| framer-motion | (existing) | Transitions for scope changes, bulk operation feedback | Optional animation polish |
| class-variance-authority | (existing) | Variant-based styling for branch badges | Branch type visual distinction |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate branchMetadata store | Extending existing branches store | Separate store is cleaner: git data stays pure, metadata is independently testable, no coupling between Tauri commands and user prefs |
| Zustand persist middleware | Direct @tauri-apps/plugin-store calls | Direct calls (current pattern) are simpler for Tauri apps; persist middleware adds localStorage indirection that is unnecessary when we already have a robust KV store |
| zustand-computed | Manual derived selectors | The project has zero use of zustand-computed currently; manual selectors via custom hooks are the established pattern and sufficient for the complexity level |

**No new dependencies needed.** All patterns use existing project dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/
  stores/
    branches.ts              # Git branch data (EXISTING - keep pure)
    branchMetadata.ts         # NEW: pins, recents, scope prefs (persisted)
  hooks/
    useBranches.ts            # NEW: composes git data + metadata into EnrichedBranch[]
    useBranchScopes.ts        # NEW: scope registry + filtering logic
  lib/
    branchClassifier.ts       # EXISTING - EXPAND: single source of truth for types + colors
    branchScopes.ts           # NEW: scope definitions registry
    bulkBranchOps.ts          # NEW: bulk operation pipeline
  components/
    branches/
      BranchList.tsx          # REFACTOR: accepts filtered branches, delegates to scoped views
      BranchItem.tsx          # REFACTOR: accepts EnrichedBranch, shows pin/type badges
      BranchScopeSelector.tsx # NEW: tab/dropdown for scope selection
      BranchQuickAccess.tsx   # NEW: pinned + recent branches panel
      BulkDeleteDialog.tsx    # NEW: bulk merged-branch cleanup
```

### Pattern 1: Layered State Architecture (Git Data + User Metadata)

**What:** Keep the existing `useBranchStore` as a pure git data store. Create a separate `useBranchMetadataStore` for user preferences (pins, recents, scope). Compose them via a custom hook `useBranches()` that produces `EnrichedBranch[]`.

**When to use:** Whenever branch data needs to be displayed with user context (pinned status, recent order, branch type classification).

**Why this pattern:** The git branch data comes from Rust/git2 and is ephemeral (refreshed on every load). User metadata is persistent and independent of git state. Mixing them in one store creates coupling where a pin toggle would trigger unnecessary branch reload logic, and vice versa.

**Example:**
```typescript
// src/stores/branchMetadata.ts
import { create } from "zustand";
import { getStore } from "../lib/store";

interface BranchMetadataState {
  // Per-repo pinned branch names
  pinnedBranches: Record<string, string[]>;  // repoPath -> branchNames
  // Per-repo recent branch history with timestamps
  recentBranches: Record<string, RecentBranchEntry[]>;  // repoPath -> entries
  // Per-repo scope preference
  scopePreference: Record<string, string>;  // repoPath -> scopeId

  // Actions
  pinBranch: (repoPath: string, branchName: string) => Promise<void>;
  unpinBranch: (repoPath: string, branchName: string) => Promise<void>;
  isPinned: (repoPath: string, branchName: string) => boolean;
  recordBranchVisit: (repoPath: string, branchName: string) => Promise<void>;
  getRecentBranches: (repoPath: string) => RecentBranchEntry[];
  setScopePreference: (repoPath: string, scopeId: string) => Promise<void>;
  getScopePreference: (repoPath: string) => string;
  initMetadata: () => Promise<void>;
}

export interface RecentBranchEntry {
  name: string;
  lastVisited: number;  // Date.now() timestamp
}
```

```typescript
// src/hooks/useBranches.ts - Composition hook
import { useMemo } from "react";
import { useBranchStore } from "../stores/branches";
import { useBranchMetadataStore } from "../stores/branchMetadata";
import { classifyBranch } from "../lib/branchClassifier";
import type { EnrichedBranch } from "../lib/branchClassifier";

export function useBranches(repoPath: string) {
  const { branches, allBranches, isLoading, error } = useBranchStore();
  const { pinnedBranches, recentBranches } = useBranchMetadataStore();

  const enriched: EnrichedBranch[] = useMemo(() => {
    const pins = new Set(pinnedBranches[repoPath] ?? []);
    const recents = recentBranches[repoPath] ?? [];
    const recentMap = new Map(recents.map(r => [r.name, r.lastVisited]));

    return branches.map(branch => ({
      ...branch,
      branchType: classifyBranch(branch.name),
      isPinned: pins.has(branch.name),
      lastVisited: recentMap.get(branch.name) ?? null,
    }));
  }, [branches, pinnedBranches, recentBranches, repoPath]);

  return { branches: enriched, allBranches, isLoading, error };
}
```

**Confidence:** HIGH - This pattern directly mirrors how the existing `navigation.ts` store layers repo pins/recents on top of repository data.

### Pattern 2: Scope Registry (Extensible Branch Filtering)

**What:** A declarative registry of branch "scopes" (views/filters), analogous to the blade registry. Each scope defines a filter function, label, icon, and sort order. Adding a new scope is a single-object addition.

**When to use:** For the scope selector (Local/Remote/Last Used) and any future scopes (Stale, Feature, Protected, etc.).

**Example:**
```typescript
// src/lib/branchScopes.ts
import type { EnrichedBranch } from "./branchClassifier";

export interface BranchScope {
  id: string;
  label: string;
  icon?: string;  // Lucide icon name
  filter: (branch: EnrichedBranch) => boolean;
  sort?: (a: EnrichedBranch, b: EnrichedBranch) => number;
  /** If true, scope is always shown in selector; if false, shown in overflow */
  primary?: boolean;
}

const scopeRegistry = new Map<string, BranchScope>();

export function registerScope(scope: BranchScope): void {
  scopeRegistry.set(scope.id, scope);
}

export function getScope(id: string): BranchScope | undefined {
  return scopeRegistry.get(id);
}

export function getAllScopes(): BranchScope[] {
  return Array.from(scopeRegistry.values());
}

export function getPrimaryScopes(): BranchScope[] {
  return getAllScopes().filter(s => s.primary);
}

// ── Built-in scopes ──

registerScope({
  id: "local",
  label: "Local",
  primary: true,
  filter: (b) => !b.isRemote,
  sort: (a, b) => {
    if (a.isHead !== b.isHead) return b.isHead ? 1 : -1;
    if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
    return a.name.localeCompare(b.name);
  },
});

registerScope({
  id: "remote",
  label: "Remote",
  primary: true,
  filter: (b) => b.isRemote,
});

registerScope({
  id: "recent",
  label: "Last Used",
  primary: true,
  filter: (b) => b.lastVisited !== null,
  sort: (a, b) => (b.lastVisited ?? 0) - (a.lastVisited ?? 0),
});

registerScope({
  id: "pinned",
  label: "Pinned",
  primary: false,
  filter: (b) => b.isPinned,
});

// Future: "stale" scope — single object addition
// registerScope({
//   id: "stale",
//   label: "Stale (>30d)",
//   primary: false,
//   filter: (b) => !b.isHead && daysSinceCommit(b) > 30,
// });
```

**Confidence:** HIGH - Directly mirrors the blade registry pattern (`registerBlade()` -> `registerScope()`) already proven in the codebase.

### Pattern 3: Bulk Operation Pipeline with Partial Failure Handling

**What:** A generic bulk operation executor that processes branch operations sequentially, collects per-item results, and reports successes/failures without stopping on first error.

**When to use:** Bulk delete of merged branches, bulk operations that may partially fail.

**Example:**
```typescript
// src/lib/bulkBranchOps.ts

export interface BulkOperationResult<T = string> {
  succeeded: T[];
  failed: { item: T; error: string }[];
  skipped: T[];  // e.g., Gitflow-protected branches
}

export interface BulkDeleteOptions {
  branches: string[];
  force: boolean;
  protectedBranches: string[];  // from Gitflow config
}

export async function bulkDeleteBranches(
  options: BulkDeleteOptions,
  deleteFn: (name: string, force: boolean) => Promise<boolean>,
): Promise<BulkOperationResult> {
  const protectedSet = new Set(options.protectedBranches);
  const result: BulkOperationResult = { succeeded: [], failed: [], skipped: [] };

  for (const branch of options.branches) {
    if (protectedSet.has(branch)) {
      result.skipped.push(branch);
      continue;
    }
    try {
      const success = await deleteFn(branch, options.force);
      if (success) {
        result.succeeded.push(branch);
      } else {
        result.failed.push({ item: branch, error: "Delete returned false" });
      }
    } catch (e) {
      result.failed.push({ item: branch, error: String(e) });
    }
  }

  return result;
}
```

**Confidence:** HIGH - Sequential execution with per-item error collection is the standard pattern for git batch operations. No undo/rollback for branch deletion (git reflog is the safety net).

### Pattern 4: Unified Branch Classifier as Single Source of Truth

**What:** Expand `branchClassifier.ts` to be the ONE place that defines branch type classification, colors (hex for SVG, Tailwind classes for components, CSS vars for themes), and the `EnrichedBranch` type. Remove duplicate `classifyBranch` from `TopologyPanel.tsx`.

**Current problem (DRY violation):** Three separate branch classification systems exist:
1. `src/lib/branchClassifier.ts` - `classifyBranch()` + `BRANCH_TYPE_COLORS` + `BRANCH_TYPE_TW`
2. `src/components/topology/TopologyPanel.tsx` - local `classifyBranch()` (lines 17-27, slightly different logic)
3. `src/components/topology/layoutUtils.ts` - `BRANCH_HEX_COLORS` + `BRANCH_BADGE_STYLES` + `BRANCH_RING_COLORS`
4. Rust backend `src-tauri/src/git/branch.rs` - `BranchType` enum via specta

**Example of unified module:**
```typescript
// src/lib/branchClassifier.ts (EXPANDED)
import type { BranchInfo, BranchType } from "../bindings";

// Re-export Rust-generated type as the canonical type
export type { BranchType };
export type GitflowBranchType = BranchType;  // backward compat alias

export interface EnrichedBranch extends BranchInfo {
  branchType: BranchType;
  isPinned: boolean;
  lastVisited: number | null;
}

/**
 * Classify a branch name into its type.
 * Handles both bare names and ref-prefixed names.
 * SINGLE SOURCE OF TRUTH - used by topology, branch list, gitflow diagram.
 */
export function classifyBranch(branchName: string): BranchType {
  const bare = branchName
    .replace(/^refs\/heads\//, "")
    .replace(/^origin\//, "");

  if (bare === "main" || bare === "master") return "main";
  if (bare === "develop" || bare === "development" || bare === "dev") return "develop";
  if (bare.startsWith("feature/") || bare.startsWith("feature-")) return "feature";
  if (bare.startsWith("release/") || bare.startsWith("release-")) return "release";
  if (bare.startsWith("hotfix/") || bare.startsWith("hotfix-")) return "hotfix";
  return "other";
}

// ── Color systems (all derived from branch type) ──

/** Catppuccin Mocha hex colors for SVG rendering */
export const BRANCH_HEX_COLORS: Record<BranchType, string> = {
  main: "#89b4fa",
  develop: "#a6e3a1",
  feature: "#cba6f7",
  release: "#fab387",
  hotfix: "#f38ba8",
  other: "#6c7086",
};

/** CSS custom property values for theme-aware contexts */
export const BRANCH_TYPE_COLORS: Record<BranchType, string> = {
  main: "var(--catppuccin-color-blue)",
  develop: "var(--catppuccin-color-green)",
  feature: "var(--catppuccin-color-mauve)",
  release: "var(--catppuccin-color-peach)",
  hotfix: "var(--catppuccin-color-red)",
  other: "var(--catppuccin-color-overlay1)",
};

/** Tailwind color token (without prefix) for utility composition */
export const BRANCH_TYPE_TW: Record<BranchType, string> = {
  main: "ctp-blue",
  develop: "ctp-green",
  feature: "ctp-mauve",
  release: "ctp-peach",
  hotfix: "ctp-red",
  other: "ctp-overlay1",
};

/** Tailwind badge styles (border + bg + hover) */
export const BRANCH_BADGE_STYLES: Record<BranchType, string> = {
  main: "border-ctp-blue bg-ctp-blue/10 hover:bg-ctp-blue/20",
  develop: "border-ctp-green bg-ctp-green/10 hover:bg-ctp-green/20",
  feature: "border-ctp-mauve bg-ctp-mauve/10 hover:bg-ctp-mauve/20",
  release: "border-ctp-peach bg-ctp-peach/10 hover:bg-ctp-peach/20",
  hotfix: "border-ctp-red bg-ctp-red/10 hover:bg-ctp-red/20",
  other: "border-ctp-overlay0 bg-ctp-surface0/50 hover:bg-ctp-surface1/50",
};

/** Tailwind ring colors for focus/selection states */
export const BRANCH_RING_COLORS: Record<BranchType, string> = {
  main: "ring-ctp-blue",
  develop: "ring-ctp-green",
  feature: "ring-ctp-mauve",
  release: "ring-ctp-peach",
  hotfix: "ring-ctp-red",
  other: "ring-ctp-overlay0",
};
```

**Confidence:** HIGH - This is a straightforward DRY refactor with clear evidence of the problem. Note: feature branches should use `ctp-mauve` (purple) per BRANCH-05 requirement, which the topology `layoutUtils.ts` already does but the current `branchClassifier.ts` uses `ctp-green`. The unified module resolves this discrepancy.

### Anti-Patterns to Avoid

- **Mixing git state and user preferences in one store:** The `branches.ts` store should remain a pure git data store. Adding `pinnedBranches` or `recentBranches` to it creates coupling where pin toggles trigger git refresh cycles and vice versa.

- **Storing enriched/computed state in the store:** Do NOT put `EnrichedBranch[]` in any store. Compute it in the `useBranches()` hook via `useMemo`. Stores should hold source-of-truth data only.

- **Duplicating branch classification logic:** The current codebase has three copies. New code must import from the unified `branchClassifier.ts`. The topology panel's local `classifyBranch` must be removed.

- **Using Zustand persist middleware with Tauri:** The project already uses `@tauri-apps/plugin-store` directly (not through Zustand persist). Continuing this pattern is correct for Tauri apps -- the Zustand persist middleware targets `localStorage`/`sessionStorage` by default and would require a custom storage adapter. The existing direct `getStore()` pattern is simpler and already proven.

- **Stopping bulk operations on first failure:** Branch deletion should continue through failures, reporting all results. Users need to see which branches succeeded and which failed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent KV storage | Custom file I/O or localStorage | `@tauri-apps/plugin-store` via `getStore()` | Already in project, handles atomicity, file corruption recovery |
| Branch type classification | New classification in each component | Unified `branchClassifier.ts` | Three copies already exist -- consolidate, don't add a fourth |
| State composition (git + metadata) | Combined mega-store | Custom hook with `useMemo` | Zustand docs recommend derived state via selectors, not store bloat |
| Debounced persistence | Manual setTimeout | `autoSave` option on `Store.load()` | Tauri plugin-store has built-in debounced auto-save (100ms default) |
| Branch type color lookup | Inline color maps in components | `BRANCH_*` exports from `branchClassifier.ts` | Single source of truth for all color systems |

**Key insight:** The project's existing patterns (navigation store persistence, blade registry extensibility, `getStore()` for Tauri persistence) are the right ones. The branch management system should follow these same patterns rather than introducing new paradigms.

## Common Pitfalls

### Pitfall 1: Branch Name Mismatch Between Local and Remote
**What goes wrong:** Pinning "feature/login" (local) and "origin/feature/login" (remote) creates two separate entries that should be logically linked.
**Why it happens:** Branch names differ between local and remote representations.
**How to avoid:** Pin/recent tracking should use the **bare branch name** (strip `refs/heads/` and `origin/` prefixes) as the canonical key. The `classifyBranch` function already does this stripping.
**Warning signs:** User pins a branch, switches to Remote scope, same branch appears unpinned.

### Pitfall 2: Stale Metadata for Deleted Branches
**What goes wrong:** A branch is deleted but its pin/recent entry persists in metadata storage, causing ghost entries in Quick Access.
**Why it happens:** Metadata store doesn't know about git operations.
**How to avoid:** The `useBranches()` composition hook should filter metadata against actual git branches. Only return enriched data for branches that actually exist. Periodically (on load), prune metadata entries for branches no longer present. Do NOT eagerly delete metadata on branch delete -- the branch might be recreated.
**Warning signs:** Quick Access shows branches that no longer exist.

### Pitfall 3: Scope Selector Losing State on Branch Refresh
**What goes wrong:** User selects "Remote" scope, a branch operation triggers `loadBranches()`, the scope resets to "Local".
**Why it happens:** Scope preference stored in component state instead of persisted store.
**How to avoid:** Store scope preference in `branchMetadata` store (persisted per-repo). The scope selector reads from the store, not local state.
**Warning signs:** Scope flickers or resets after checkout/merge operations.

### Pitfall 4: Bulk Delete Race Condition with Branch Refresh
**What goes wrong:** Bulk delete triggers multiple `deleteBranch` calls, each of which calls `loadBranches()` internally, causing N reloads for N deletions.
**Why it happens:** The current `deleteBranch` in `branches.ts` calls `loadBranches()` after each delete.
**How to avoid:** Add a `deleteBranchWithoutRefresh` method (or a batch variant) that skips the auto-refresh. The bulk operation pipeline calls refresh ONCE at the end.
**Warning signs:** UI thrashes during bulk delete, performance degrades with many branches.

### Pitfall 5: Feature Branch Color Inconsistency
**What goes wrong:** Feature branches appear green in branch list but purple in topology.
**Why it happens:** `branchClassifier.ts` maps feature to `ctp-green`, but `layoutUtils.ts` maps feature to `ctp-mauve` (purple). The BRANCH-05 requirement specifies purple.
**How to avoid:** Unify all color definitions in `branchClassifier.ts`. The correct color per BRANCH-05 is purple/mauve (`ctp-mauve` / `#cba6f7`).
**Warning signs:** Visual inconsistency between topology graph and branch list.

### Pitfall 6: Gitflow Protection Not Detecting Custom Prefixes
**What goes wrong:** Bulk delete removes `develop` or `main` because protection only checks exact names.
**Why it happens:** Gitflow config allows custom branch names (e.g., "development" instead of "develop").
**How to avoid:** Read Gitflow config from `useGitflowStore` to get actual protected branch names. Don't hardcode "main" and "develop" -- use the configured values.
**Warning signs:** Protected branches appear in the bulk delete candidate list.

## Code Examples

### Composition Hook for Enriched Branches
```typescript
// src/hooks/useBranches.ts
// Composes git branch data with user metadata
import { useMemo } from "react";
import { useBranchStore } from "../stores/branches";
import { useBranchMetadataStore } from "../stores/branchMetadata";
import { useRepositoryStore } from "../stores/repository";
import { classifyBranch, type EnrichedBranch } from "../lib/branchClassifier";

export function useBranches() {
  const repoPath = useRepositoryStore(s => s.status?.path ?? "");
  const { branches, allBranches, isLoading, error, loadBranches, loadAllBranches } = useBranchStore();
  const metadata = useBranchMetadataStore();

  const enriched = useMemo((): EnrichedBranch[] => {
    if (!repoPath) return [];
    const pins = new Set(metadata.pinnedBranches[repoPath] ?? []);
    const recents = metadata.recentBranches[repoPath] ?? [];
    const recentMap = new Map(recents.map(r => [r.name, r.lastVisited]));

    return allBranches.map(branch => {
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
    rawBranches: branches,
    isLoading,
    error,
    loadBranches,
    loadAllBranches,
    repoPath,
  };
}
```

### Scope-Filtered Branch Hook
```typescript
// src/hooks/useBranchScopes.ts
import { useMemo } from "react";
import { useBranches } from "./useBranches";
import { useBranchMetadataStore } from "../stores/branchMetadata";
import { getScope, getPrimaryScopes, type BranchScope } from "../lib/branchScopes";

export function useBranchScopes() {
  const { branches, repoPath, ...rest } = useBranches();
  const { getScopePreference, setScopePreference } = useBranchMetadataStore();

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

  const setScope = (scopeId: string) => {
    setScopePreference(repoPath, scopeId);
  };

  return {
    branches: filtered,
    allBranches: branches,
    activeScopeId,
    setScope,
    scopes: getPrimaryScopes(),
    ...rest,
  };
}
```

### Metadata Store with Tauri Persistence
```typescript
// src/stores/branchMetadata.ts
import { create } from "zustand";
import { getStore } from "../lib/store";

const MAX_RECENT_BRANCHES = 10;

export interface RecentBranchEntry {
  name: string;
  lastVisited: number;
}

interface BranchMetadataState {
  pinnedBranches: Record<string, string[]>;
  recentBranches: Record<string, RecentBranchEntry[]>;
  scopePreference: Record<string, string>;

  pinBranch: (repoPath: string, branchName: string) => Promise<void>;
  unpinBranch: (repoPath: string, branchName: string) => Promise<void>;
  isPinned: (repoPath: string, branchName: string) => boolean;
  recordBranchVisit: (repoPath: string, branchName: string) => Promise<void>;
  getRecentBranches: (repoPath: string) => RecentBranchEntry[];
  setScopePreference: (repoPath: string, scopeId: string) => Promise<void>;
  getScopePreference: (repoPath: string) => string;
  initMetadata: () => Promise<void>;
}

export const useBranchMetadataStore = create<BranchMetadataState>((set, get) => ({
  pinnedBranches: {},
  recentBranches: {},
  scopePreference: {},

  pinBranch: async (repoPath, branchName) => {
    const { pinnedBranches } = get();
    const existing = pinnedBranches[repoPath] ?? [];
    if (existing.includes(branchName)) return;
    const updated = { ...pinnedBranches, [repoPath]: [...existing, branchName] };
    try {
      const store = await getStore();
      await store.set("branch-pinned", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist pinned branches:", e);
    }
    set({ pinnedBranches: updated });
  },

  unpinBranch: async (repoPath, branchName) => {
    const { pinnedBranches } = get();
    const existing = pinnedBranches[repoPath] ?? [];
    const updated = {
      ...pinnedBranches,
      [repoPath]: existing.filter(b => b !== branchName),
    };
    try {
      const store = await getStore();
      await store.set("branch-pinned", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist pinned branches:", e);
    }
    set({ pinnedBranches: updated });
  },

  isPinned: (repoPath, branchName) => {
    return (get().pinnedBranches[repoPath] ?? []).includes(branchName);
  },

  recordBranchVisit: async (repoPath, branchName) => {
    const { recentBranches } = get();
    const existing = recentBranches[repoPath] ?? [];
    const filtered = existing.filter(e => e.name !== branchName);
    const entry: RecentBranchEntry = { name: branchName, lastVisited: Date.now() };
    const updated = {
      ...recentBranches,
      [repoPath]: [entry, ...filtered].slice(0, MAX_RECENT_BRANCHES),
    };
    try {
      const store = await getStore();
      await store.set("branch-recent", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist recent branches:", e);
    }
    set({ recentBranches: updated });
  },

  getRecentBranches: (repoPath) => {
    return get().recentBranches[repoPath] ?? [];
  },

  setScopePreference: async (repoPath, scopeId) => {
    const { scopePreference } = get();
    const updated = { ...scopePreference, [repoPath]: scopeId };
    try {
      const store = await getStore();
      await store.set("branch-scope", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist scope preference:", e);
    }
    set({ scopePreference: updated });
  },

  getScopePreference: (repoPath) => {
    return get().scopePreference[repoPath] ?? "local";
  },

  initMetadata: async () => {
    try {
      const store = await getStore();
      const pinnedBranches = (await store.get<Record<string, string[]>>("branch-pinned")) ?? {};
      const recentBranches = (await store.get<Record<string, RecentBranchEntry[]>>("branch-recent")) ?? {};
      const scopePreference = (await store.get<Record<string, string>>("branch-scope")) ?? {};
      set({ pinnedBranches, recentBranches, scopePreference });
    } catch (e) {
      console.error("Failed to initialize branch metadata:", e);
    }
  },
}));
```

### Bulk Delete with Gitflow Protection
```typescript
// Usage in a component:
import { bulkDeleteBranches } from "../lib/bulkBranchOps";
import { useGitflowStore } from "../stores/gitflow";
import { useBranchStore } from "../stores/branches";

function useBulkDelete() {
  const { status: gitflowStatus } = useGitflowStore();
  const { deleteBranch, loadBranches } = useBranchStore();

  const protectedBranches = useMemo(() => {
    if (!gitflowStatus?.isInitialized) return ["main", "master"];
    // Use actual Gitflow config for protection
    return [
      gitflowStatus.config.mainBranch,
      gitflowStatus.config.developBranch,
    ].filter(Boolean);
  }, [gitflowStatus]);

  const executeBulkDelete = async (branchNames: string[]) => {
    const result = await bulkDeleteBranches(
      { branches: branchNames, force: false, protectedBranches },
      (name, force) => deleteBranch(name, force),
    );
    // Single refresh after all operations
    await loadBranches();
    return result;
  };

  return { executeBulkDelete, protectedBranches };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolithic store | Separate stores + composition hooks | Zustand v4-5 best practices | Better separation of concerns, independent testing |
| Zustand persist + localStorage | Direct Tauri plugin-store | Tauri v2 ecosystem | Native file persistence, no browser storage limitations |
| Inline color maps per component | Centralized classifier module | Current refactor target | DRY, single source of truth |
| Hardcoded branch type checks | Registry-based scope system | New for Phase 23 | Extensible without core modifications |

**Note on Zustand v5:** The project uses `zustand: ^5`. Zustand v5 dropped the `create()()` double-call pattern for some middleware combinations but the project's current patterns (direct `create<State>()` calls) are v5-compatible. The slice pattern and custom hooks work identically in v5.

## Open Questions

1. **Should recent branch tracking trigger on every checkout, or only on user-initiated checkouts?**
   - What we know: The `checkoutBranch` action in the store doesn't distinguish between user-initiated and programmatic checkouts (e.g., Gitflow finish operations also checkout branches).
   - What's unclear: Should Gitflow-initiated branch switches appear in "Last Used"?
   - Recommendation: Track all checkouts. Gitflow switches are still user-meaningful. The `useBranches()` hook should call `recordBranchVisit()` when `checkoutBranch` succeeds.

2. **Should the metadata store use `autoSave` on `Store.load()` instead of manual `store.save()` calls?**
   - What we know: The Tauri plugin-store supports `autoSave: true` with 100ms debounce on `Store.load()`. The existing settings/navigation stores use manual `.save()`.
   - What's unclear: Whether autoSave interacts well with rapid pin/unpin toggling.
   - Recommendation: Keep manual `.save()` for consistency with existing stores. The overhead of calling `.save()` is negligible and provides explicit control.

3. **Should the `BranchList` refactor use render props, compound components, or simple prop drilling?**
   - What we know: Current `BranchList` is simple (map over branches, render `BranchItem`). The blade system uses a registry with lazy-loaded components.
   - What's unclear: How complex the branch item rendering will become with pins, badges, scope-specific actions.
   - Recommendation: Use **prop drilling with enriched types** (simplest, most readable). `BranchItem` receives an `EnrichedBranch` with all needed data. If complexity grows, refactor to compound components later. Avoid premature abstraction.

4. **Where should the `checkoutBranch` -> `recordBranchVisit` integration point be?**
   - What we know: The branch store and metadata store are separate.
   - What's unclear: Cross-store coordination pattern.
   - Recommendation: Use `useBranchStore.getState()` from outside React (same pattern as `useGitflowStore` calling `useBranchStore.getState().loadBranches()` on line 127 of `gitflow.ts`). Or better: put the integration in the `useBranches()` hook, wrapping `checkoutBranch` to also call `recordBranchVisit`.

## Migration/Refactoring Strategy

### Phase 1: Foundation (non-breaking)
1. Expand `branchClassifier.ts` with unified color maps and `EnrichedBranch` type
2. Create `branchMetadata.ts` store (new file, no existing code changes)
3. Create `branchScopes.ts` registry (new file)
4. Create `useBranches.ts` and `useBranchScopes.ts` hooks (new files)
5. Initialize metadata store in app startup (alongside existing `initSettings`/`initNavigation`)

### Phase 2: Consolidation (safe refactors)
6. Update `TopologyPanel.tsx` to import `classifyBranch` from `branchClassifier.ts` (remove local copy)
7. Update `layoutUtils.ts` to import color maps from `branchClassifier.ts` (remove duplicates)
8. Verify color consistency: feature = `ctp-mauve` everywhere

### Phase 3: Branch UI (component changes)
9. Refactor `BranchList.tsx` to use `useBranchScopes()` hook
10. Refactor `BranchItem.tsx` to accept `EnrichedBranch` with pin indicator
11. Add `BranchScopeSelector.tsx` component
12. Add `BranchQuickAccess.tsx` component (pinned + recent)

### Phase 4: Bulk Operations
13. Add `bulkBranchOps.ts` utility
14. Add `BulkDeleteDialog.tsx` with Gitflow protection
15. Add `deleteBranchWithoutRefresh` to branches store (or batch delete variant)

### Phase 5: Integration
16. Wire `checkoutBranch` to `recordBranchVisit` via composition hook
17. Wire scope selector to persisted preferences
18. Add contextual clone button (BRANCH-06)

This ordering ensures each phase is independently testable and no existing functionality breaks until Phase 3.

## Sources

### Primary (HIGH confidence)
- **Zustand docs** (Context7 `/pmndrs/zustand`) - slice pattern, persist middleware, custom storage, derived state patterns
- **Tauri plugin-store docs** (Context7 `/tauri-apps/plugins-workspace`) - Store.load, get/set, autoSave, LazyStore
- **Existing codebase** (direct file reads):
  - `src/stores/branches.ts` - current branch store architecture
  - `src/stores/navigation.ts` - established persistence pattern for pins/recents
  - `src/stores/settings.ts` - established persistence pattern for user preferences
  - `src/stores/blades.ts` + `src/stores/bladeTypes.ts` - type-safe registry pattern
  - `src/lib/bladeRegistry.ts` - extensible registry pattern
  - `src/lib/branchClassifier.ts` - current branch classification (incomplete)
  - `src/components/topology/TopologyPanel.tsx` - duplicate classifyBranch (lines 17-27)
  - `src/components/topology/layoutUtils.ts` - duplicate color maps
  - `src/components/branches/BranchList.tsx` + `BranchItem.tsx` - current branch UI
  - `src/lib/store.ts` - Tauri store singleton pattern
  - `src/hooks/useRecentRepos.ts` - established persistence pattern for recents
  - `src-tauri/src/git/branch.rs` - Rust backend branch operations

### Secondary (MEDIUM confidence)
- Zustand v5 migration patterns verified against Context7 docs
- Tauri plugin-store `autoSave` feature verified against Context7 docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, uses existing patterns
- Architecture: HIGH - Patterns directly derived from existing codebase (navigation store, blade registry)
- Persistence: HIGH - Uses same `getStore()` pattern as settings/navigation stores
- Pitfalls: HIGH - Identified from actual code analysis (three separate classifiers, color mismatches)
- Bulk operations: MEDIUM - Standard pattern but untested in this codebase
- Migration strategy: HIGH - Incremental approach with clear phase boundaries

**Research date:** 2026-02-08
**Valid until:** 2026-03-10 (stable patterns, no fast-moving dependencies)
