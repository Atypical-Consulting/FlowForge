import { create } from "zustand";
import { getStore } from "../lib/store";

const MAX_RECENT_BRANCHES = 3;

interface NavigationState {
  // Panel state (NOT persisted — ephemeral UI state)
  repoDropdownOpen: boolean;
  branchDropdownOpen: boolean;

  // Persisted state
  pinnedRepoPaths: string[];
  recentBranchesPerRepo: Record<string, string[]>;
  lastActiveBranchPerRepo: Record<string, string>;

  // Actions — panel
  toggleRepoDropdown: () => void;
  toggleBranchDropdown: () => void;
  closePanels: () => void;

  // Actions — pinned repos
  pinRepo: (path: string) => Promise<void>;
  unpinRepo: (path: string) => Promise<void>;
  isPinned: (path: string) => boolean;

  // Actions — recent branches
  addRecentBranch: (repoPath: string, branchName: string) => Promise<void>;
  getRecentBranches: (repoPath: string) => string[];

  // Actions — last active branch
  setLastActiveBranch: (
    repoPath: string,
    branchName: string,
  ) => Promise<void>;
  getLastActiveBranch: (repoPath: string) => string | undefined;

  // Initialization
  initNavigation: () => Promise<void>;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  repoDropdownOpen: false,
  branchDropdownOpen: false,
  pinnedRepoPaths: [],
  recentBranchesPerRepo: {},
  lastActiveBranchPerRepo: {},

  toggleRepoDropdown: () => {
    const { repoDropdownOpen } = get();
    set({ repoDropdownOpen: !repoDropdownOpen, branchDropdownOpen: false });
  },

  toggleBranchDropdown: () => {
    const { branchDropdownOpen } = get();
    set({ branchDropdownOpen: !branchDropdownOpen, repoDropdownOpen: false });
  },

  closePanels: () => {
    set({ repoDropdownOpen: false, branchDropdownOpen: false });
  },

  pinRepo: async (path: string) => {
    const { pinnedRepoPaths } = get();
    if (pinnedRepoPaths.includes(path)) return;
    const updated = [...pinnedRepoPaths, path];
    try {
      const store = await getStore();
      await store.set("nav-pinned-repos", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist pinned repos:", e);
    }
    set({ pinnedRepoPaths: updated });
  },

  unpinRepo: async (path: string) => {
    const { pinnedRepoPaths } = get();
    const updated = pinnedRepoPaths.filter((p) => p !== path);
    try {
      const store = await getStore();
      await store.set("nav-pinned-repos", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist pinned repos:", e);
    }
    set({ pinnedRepoPaths: updated });
  },

  isPinned: (path: string) => {
    return get().pinnedRepoPaths.includes(path);
  },

  addRecentBranch: async (repoPath: string, branchName: string) => {
    const { recentBranchesPerRepo } = get();
    const existing = recentBranchesPerRepo[repoPath] || [];
    const filtered = existing.filter((b) => b !== branchName);
    const updated = [branchName, ...filtered].slice(0, MAX_RECENT_BRANCHES);
    const newMap = { ...recentBranchesPerRepo, [repoPath]: updated };
    try {
      const store = await getStore();
      await store.set("nav-recent-branches", newMap);
      await store.save();
    } catch (e) {
      console.error("Failed to persist recent branches:", e);
    }
    set({ recentBranchesPerRepo: newMap });
  },

  getRecentBranches: (repoPath: string) => {
    return get().recentBranchesPerRepo[repoPath] || [];
  },

  setLastActiveBranch: async (repoPath: string, branchName: string) => {
    const { lastActiveBranchPerRepo } = get();
    const newMap = { ...lastActiveBranchPerRepo, [repoPath]: branchName };
    try {
      const store = await getStore();
      await store.set("nav-last-active-branch", newMap);
      await store.save();
    } catch (e) {
      console.error("Failed to persist last active branch:", e);
    }
    set({ lastActiveBranchPerRepo: newMap });
  },

  getLastActiveBranch: (repoPath: string) => {
    return get().lastActiveBranchPerRepo[repoPath];
  },

  initNavigation: async () => {
    try {
      const store = await getStore();
      const pinnedRepoPaths =
        (await store.get<string[]>("nav-pinned-repos")) || [];
      const recentBranchesPerRepo =
        (await store.get<Record<string, string[]>>("nav-recent-branches")) ||
        {};
      const lastActiveBranchPerRepo =
        (await store.get<Record<string, string>>("nav-last-active-branch")) ||
        {};
      set({ pinnedRepoPaths, recentBranchesPerRepo, lastActiveBranchPerRepo });
    } catch (e) {
      console.error("Failed to initialize navigation:", e);
    }
  },
}));
