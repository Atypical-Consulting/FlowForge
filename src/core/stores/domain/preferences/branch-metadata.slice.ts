import type { StateCreator } from "zustand";
import { getStore } from "@/framework/stores/persistence/tauri";
import type { PreferencesStore } from "./index";
import type { PreferencesMiddleware } from "./types";

const MAX_PINNED = 5;
const MAX_RECENT = 10;

export interface RecentBranchEntry {
  name: string;
  lastVisited: number;
}

export interface BranchMetadataSlice {
  metaPinnedBranches: Record<string, string[]>;
  metaRecentBranches: Record<string, RecentBranchEntry[]>;
  metaScopePreference: Record<string, string>;

  pinBranch: (repoPath: string, branchName: string) => Promise<void>;
  unpinBranch: (repoPath: string, branchName: string) => Promise<void>;
  isBranchPinned: (repoPath: string, branchName: string) => boolean;
  recordBranchVisit: (repoPath: string, branchName: string) => Promise<void>;
  getMetaRecentBranches: (repoPath: string) => RecentBranchEntry[];
  setMetaScopePreference: (repoPath: string, scopeId: string) => Promise<void>;
  getMetaScopePreference: (repoPath: string) => string;
  initMetadata: () => Promise<void>;
}

export const createBranchMetadataSlice: StateCreator<
  PreferencesStore,
  PreferencesMiddleware,
  [],
  BranchMetadataSlice
> = (set, get) => ({
  metaPinnedBranches: {},
  metaRecentBranches: {},
  metaScopePreference: {},

  pinBranch: async (repoPath: string, branchName: string) => {
    const { metaPinnedBranches } = get();
    const existing = metaPinnedBranches[repoPath] ?? [];
    if (existing.includes(branchName)) return;
    const updated = {
      ...metaPinnedBranches,
      [repoPath]: [...existing, branchName].slice(0, MAX_PINNED),
    };
    try {
      const store = await getStore();
      await store.set("branch-pinned", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist pinned branches:", e);
    }
    set({ metaPinnedBranches: updated }, false, "preferences:meta/pinBranch");
  },

  unpinBranch: async (repoPath: string, branchName: string) => {
    const { metaPinnedBranches } = get();
    const existing = metaPinnedBranches[repoPath] ?? [];
    const updated = {
      ...metaPinnedBranches,
      [repoPath]: existing.filter((b) => b !== branchName),
    };
    try {
      const store = await getStore();
      await store.set("branch-pinned", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist pinned branches:", e);
    }
    set({ metaPinnedBranches: updated }, false, "preferences:meta/unpinBranch");
  },

  isBranchPinned: (repoPath: string, branchName: string) => {
    const existing = get().metaPinnedBranches[repoPath] ?? [];
    return existing.includes(branchName);
  },

  recordBranchVisit: async (repoPath: string, branchName: string) => {
    const { metaRecentBranches } = get();
    const existing = metaRecentBranches[repoPath] ?? [];
    const filtered = existing.filter((e) => e.name !== branchName);
    const entry: RecentBranchEntry = {
      name: branchName,
      lastVisited: Date.now(),
    };
    const updated = {
      ...metaRecentBranches,
      [repoPath]: [entry, ...filtered].slice(0, MAX_RECENT),
    };
    try {
      const store = await getStore();
      await store.set("branch-recent", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist recent branches:", e);
    }
    set({ metaRecentBranches: updated }, false, "preferences:meta/recordVisit");
  },

  getMetaRecentBranches: (repoPath: string) => {
    return get().metaRecentBranches[repoPath] ?? [];
  },

  setMetaScopePreference: async (repoPath: string, scopeId: string) => {
    const { metaScopePreference } = get();
    const updated = { ...metaScopePreference, [repoPath]: scopeId };
    try {
      const store = await getStore();
      await store.set("branch-scope", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist scope preference:", e);
    }
    set(
      { metaScopePreference: updated },
      false,
      "preferences:meta/setScopePreference",
    );
  },

  getMetaScopePreference: (repoPath: string) => {
    return get().metaScopePreference[repoPath] ?? "local";
  },

  initMetadata: async () => {
    try {
      const store = await getStore();
      const metaPinnedBranches =
        (await store.get<Record<string, string[]>>("branch-pinned")) ?? {};
      const metaRecentBranches =
        (await store.get<Record<string, RecentBranchEntry[]>>(
          "branch-recent",
        )) ?? {};
      const metaScopePreference =
        (await store.get<Record<string, string>>("branch-scope")) ?? {};
      set(
        { metaPinnedBranches, metaRecentBranches, metaScopePreference },
        false,
        "preferences:meta/init",
      );
    } catch (e) {
      console.error("Failed to initialize branch metadata:", e);
    }
  },
});
