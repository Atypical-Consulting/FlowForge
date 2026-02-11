import type { StateCreator } from "zustand";
import { getStore } from "../../../lib/store";
import type { PreferencesStore } from "./index";
import type { PreferencesMiddleware } from "./types";

const MAX_RECENT_BRANCHES = 3;

export interface NavigationSlice {
  // Panel state (ephemeral)
  navRepoDropdownOpen: boolean;
  navBranchDropdownOpen: boolean;

  // Persisted state
  navPinnedRepoPaths: string[];
  navRecentBranchesPerRepo: Record<string, string[]>;
  navLastActiveBranchPerRepo: Record<string, string>;

  // Actions -- panel
  toggleNavRepoDropdown: () => void;
  toggleNavBranchDropdown: () => void;
  closeNavPanels: () => void;

  // Actions -- pinned repos
  pinRepo: (path: string) => Promise<void>;
  unpinRepo: (path: string) => Promise<void>;
  isRepoPinned: (path: string) => boolean;

  // Actions -- recent branches
  addNavRecentBranch: (repoPath: string, branchName: string) => Promise<void>;
  getNavRecentBranches: (repoPath: string) => string[];

  // Actions -- last active branch
  setNavLastActiveBranch: (
    repoPath: string,
    branchName: string,
  ) => Promise<void>;
  getNavLastActiveBranch: (repoPath: string) => string | undefined;

  // Initialization
  initNavigation: () => Promise<void>;
}

export const createNavigationSlice: StateCreator<
  PreferencesStore,
  PreferencesMiddleware,
  [],
  NavigationSlice
> = (set, get) => ({
  navRepoDropdownOpen: false,
  navBranchDropdownOpen: false,
  navPinnedRepoPaths: [],
  navRecentBranchesPerRepo: {},
  navLastActiveBranchPerRepo: {},

  toggleNavRepoDropdown: () => {
    const { navRepoDropdownOpen } = get();
    set(
      {
        navRepoDropdownOpen: !navRepoDropdownOpen,
        navBranchDropdownOpen: false,
      },
      false,
      "preferences:nav/toggleRepoDropdown",
    );
  },

  toggleNavBranchDropdown: () => {
    const { navBranchDropdownOpen } = get();
    set(
      {
        navBranchDropdownOpen: !navBranchDropdownOpen,
        navRepoDropdownOpen: false,
      },
      false,
      "preferences:nav/toggleBranchDropdown",
    );
  },

  closeNavPanels: () => {
    set(
      { navRepoDropdownOpen: false, navBranchDropdownOpen: false },
      false,
      "preferences:nav/closePanels",
    );
  },

  pinRepo: async (path: string) => {
    const { navPinnedRepoPaths } = get();
    if (navPinnedRepoPaths.includes(path)) return;
    const updated = [...navPinnedRepoPaths, path];
    try {
      const store = await getStore();
      await store.set("nav-pinned-repos", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist pinned repos:", e);
    }
    set(
      { navPinnedRepoPaths: updated },
      false,
      "preferences:nav/pinRepo",
    );
  },

  unpinRepo: async (path: string) => {
    const { navPinnedRepoPaths } = get();
    const updated = navPinnedRepoPaths.filter((p) => p !== path);
    try {
      const store = await getStore();
      await store.set("nav-pinned-repos", updated);
      await store.save();
    } catch (e) {
      console.error("Failed to persist pinned repos:", e);
    }
    set(
      { navPinnedRepoPaths: updated },
      false,
      "preferences:nav/unpinRepo",
    );
  },

  isRepoPinned: (path: string) => {
    return get().navPinnedRepoPaths.includes(path);
  },

  addNavRecentBranch: async (repoPath: string, branchName: string) => {
    const { navRecentBranchesPerRepo } = get();
    const existing = navRecentBranchesPerRepo[repoPath] || [];
    const filtered = existing.filter((b) => b !== branchName);
    const updated = [branchName, ...filtered].slice(0, MAX_RECENT_BRANCHES);
    const newMap = { ...navRecentBranchesPerRepo, [repoPath]: updated };
    try {
      const store = await getStore();
      await store.set("nav-recent-branches", newMap);
      await store.save();
    } catch (e) {
      console.error("Failed to persist recent branches:", e);
    }
    set(
      { navRecentBranchesPerRepo: newMap },
      false,
      "preferences:nav/addRecentBranch",
    );
  },

  getNavRecentBranches: (repoPath: string) => {
    return get().navRecentBranchesPerRepo[repoPath] || [];
  },

  setNavLastActiveBranch: async (repoPath: string, branchName: string) => {
    const { navLastActiveBranchPerRepo } = get();
    const newMap = { ...navLastActiveBranchPerRepo, [repoPath]: branchName };
    try {
      const store = await getStore();
      await store.set("nav-last-active-branch", newMap);
      await store.save();
    } catch (e) {
      console.error("Failed to persist last active branch:", e);
    }
    set(
      { navLastActiveBranchPerRepo: newMap },
      false,
      "preferences:nav/setLastActiveBranch",
    );
  },

  getNavLastActiveBranch: (repoPath: string) => {
    return get().navLastActiveBranchPerRepo[repoPath];
  },

  initNavigation: async () => {
    try {
      const store = await getStore();
      const navPinnedRepoPaths =
        (await store.get<string[]>("nav-pinned-repos")) || [];
      const navRecentBranchesPerRepo =
        (await store.get<Record<string, string[]>>("nav-recent-branches")) ||
        {};
      const navLastActiveBranchPerRepo =
        (await store.get<Record<string, string>>("nav-last-active-branch")) ||
        {};
      set(
        {
          navPinnedRepoPaths,
          navRecentBranchesPerRepo,
          navLastActiveBranchPerRepo,
        },
        false,
        "preferences:nav/init",
      );
    } catch (e) {
      console.error("Failed to initialize navigation:", e);
    }
  },
});
