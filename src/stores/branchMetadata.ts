import { create } from "zustand";
import { getStore } from "../lib/store";

const MAX_PINNED = 5;
const MAX_RECENT = 10;

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

export const useBranchMetadataStore = create<BranchMetadataState>(
  (set, get) => ({
    pinnedBranches: {},
    recentBranches: {},
    scopePreference: {},

    pinBranch: async (repoPath: string, branchName: string) => {
      const { pinnedBranches } = get();
      const existing = pinnedBranches[repoPath] ?? [];
      if (existing.includes(branchName)) return;
      const updated = {
        ...pinnedBranches,
        [repoPath]: [...existing, branchName].slice(0, MAX_PINNED),
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

    unpinBranch: async (repoPath: string, branchName: string) => {
      const { pinnedBranches } = get();
      const existing = pinnedBranches[repoPath] ?? [];
      const updated = {
        ...pinnedBranches,
        [repoPath]: existing.filter((b) => b !== branchName),
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

    isPinned: (repoPath: string, branchName: string) => {
      const existing = get().pinnedBranches[repoPath] ?? [];
      return existing.includes(branchName);
    },

    recordBranchVisit: async (repoPath: string, branchName: string) => {
      const { recentBranches } = get();
      const existing = recentBranches[repoPath] ?? [];
      const filtered = existing.filter((e) => e.name !== branchName);
      const entry: RecentBranchEntry = {
        name: branchName,
        lastVisited: Date.now(),
      };
      const updated = {
        ...recentBranches,
        [repoPath]: [entry, ...filtered].slice(0, MAX_RECENT),
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

    getRecentBranches: (repoPath: string) => {
      return get().recentBranches[repoPath] ?? [];
    },

    setScopePreference: async (repoPath: string, scopeId: string) => {
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

    getScopePreference: (repoPath: string) => {
      return get().scopePreference[repoPath] ?? "local";
    },

    initMetadata: async () => {
      try {
        const store = await getStore();
        const pinnedBranches =
          (await store.get<Record<string, string[]>>("branch-pinned")) ?? {};
        const recentBranches =
          (await store.get<Record<string, RecentBranchEntry[]>>(
            "branch-recent",
          )) ?? {};
        const scopePreference =
          (await store.get<Record<string, string>>("branch-scope")) ?? {};
        set({ pinnedBranches, recentBranches, scopePreference });
      } catch (e) {
        console.error("Failed to initialize branch metadata:", e);
      }
    },
  }),
);
