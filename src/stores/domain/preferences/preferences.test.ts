const mockStoreData = vi.hoisted(() => new Map<string, unknown>());
const mockStore = vi.hoisted(() => ({
  get: vi.fn((key: string) => Promise.resolve(mockStoreData.get(key) ?? null)),
  set: vi.fn((key: string, value: unknown) => {
    mockStoreData.set(key, value);
    return Promise.resolve();
  }),
  save: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../lib/store", () => ({
  getStore: vi.fn(() => Promise.resolve(mockStore)),
}));

vi.mock("../../toast", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

import { usePreferencesStore } from "./index";
import { resetAllStores } from "../../registry";
import { DEFAULT_CHECKLIST } from "./review-checklist.slice";

describe("Preferences store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreData.clear();
  });

  describe("composition", () => {
    it("has all slice state keys", () => {
      const state = usePreferencesStore.getState();
      expect(state).toHaveProperty("settingsActiveCategory");
      expect(state).toHaveProperty("settingsData");
      expect(state).toHaveProperty("themePreference");
      expect(state).toHaveProperty("themeResolved");
      expect(state).toHaveProperty("navRepoDropdownOpen");
      expect(state).toHaveProperty("navPinnedRepoPaths");
      expect(state).toHaveProperty("metaPinnedBranches");
      expect(state).toHaveProperty("checklistCustomItems");
    });

    it("has correct initial defaults", () => {
      const state = usePreferencesStore.getState();
      expect(state.settingsData.general.defaultTab).toBe("changes");
      expect(state.themePreference).toBe("system");
      expect(state.navRepoDropdownOpen).toBe(false);
      expect(state.navPinnedRepoPaths).toEqual([]);
      expect(state.checklistCustomItems).toHaveProperty("feature");
      expect(state.checklistCustomItems).toHaveProperty("release");
      expect(state.checklistCustomItems).toHaveProperty("hotfix");
    });
  });

  describe("settings slice", () => {
    it("setSettingsCategory changes active category", () => {
      usePreferencesStore.getState().setSettingsCategory("git");
      expect(usePreferencesStore.getState().settingsActiveCategory).toBe("git");
    });

    it("initSettings loads and merges saved settings", async () => {
      mockStoreData.set("settings", {
        general: { defaultTab: "topology" },
      });

      await usePreferencesStore.getState().initSettings();

      const state = usePreferencesStore.getState();
      expect(state.settingsData.general.defaultTab).toBe("topology");
      expect(state.settingsData.git.defaultRemote).toBe("origin");
    });

    it("updateSetting persists to store and updates state", async () => {
      await usePreferencesStore
        .getState()
        .updateSetting("git", "defaultRemote", "upstream");

      expect(mockStore.set).toHaveBeenCalledWith(
        "settings",
        expect.objectContaining({
          git: expect.objectContaining({ defaultRemote: "upstream" }),
        }),
      );
      expect(mockStore.save).toHaveBeenCalled();
      expect(usePreferencesStore.getState().settingsData.git.defaultRemote).toBe(
        "upstream",
      );
    });
  });

  describe("theme slice", () => {
    beforeEach(() => {
      // jsdom does not implement matchMedia — provide a stub
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === "(prefers-color-scheme: dark)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      // Stub localStorage for applyTheme — jsdom may not provide a working impl
      const localStorageMock = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };
      Object.defineProperty(window, "localStorage", {
        writable: true,
        value: localStorageMock,
      });
    });

    it("initTheme defaults to system", async () => {
      await usePreferencesStore.getState().initTheme();

      const state = usePreferencesStore.getState();
      expect(state.themePreference).toBe("system");
      expect(state.themeIsLoading).toBe(false);
    });

    it("setTheme persists and updates state", async () => {
      await usePreferencesStore.getState().setTheme("dark");

      const state = usePreferencesStore.getState();
      expect(state.themePreference).toBe("dark");
      expect(state.themeResolved).toBe("mocha");
      expect(mockStore.set).toHaveBeenCalledWith("theme", "dark");
      expect(mockStore.save).toHaveBeenCalled();
    });
  });

  describe("navigation slice", () => {
    it("toggleNavRepoDropdown toggles and closes branch dropdown", () => {
      usePreferencesStore.getState().toggleNavRepoDropdown();

      const state = usePreferencesStore.getState();
      expect(state.navRepoDropdownOpen).toBe(true);
      expect(state.navBranchDropdownOpen).toBe(false);
    });

    it("pinRepo adds to navPinnedRepoPaths and persists", async () => {
      await usePreferencesStore.getState().pinRepo("/test/repo");

      expect(
        usePreferencesStore.getState().navPinnedRepoPaths,
      ).toContain("/test/repo");
      expect(mockStore.set).toHaveBeenCalledWith(
        "nav-pinned-repos",
        expect.arrayContaining(["/test/repo"]),
      );
    });

    it("unpinRepo removes from navPinnedRepoPaths", async () => {
      await usePreferencesStore.getState().pinRepo("/test/repo");
      await usePreferencesStore.getState().unpinRepo("/test/repo");

      expect(
        usePreferencesStore.getState().navPinnedRepoPaths,
      ).not.toContain("/test/repo");
    });

    it("pinRepo is idempotent", async () => {
      await usePreferencesStore.getState().pinRepo("/test/repo");
      await usePreferencesStore.getState().pinRepo("/test/repo");

      expect(usePreferencesStore.getState().navPinnedRepoPaths).toHaveLength(1);
    });

    it("addNavRecentBranch caps at MAX_RECENT_BRANCHES (3)", async () => {
      const repo = "/test/repo";
      await usePreferencesStore.getState().addNavRecentBranch(repo, "branch-1");
      await usePreferencesStore.getState().addNavRecentBranch(repo, "branch-2");
      await usePreferencesStore.getState().addNavRecentBranch(repo, "branch-3");
      await usePreferencesStore.getState().addNavRecentBranch(repo, "branch-4");

      const recent = usePreferencesStore.getState().getNavRecentBranches(repo);
      expect(recent).toHaveLength(3);
      expect(recent[0]).toBe("branch-4");
    });
  });

  describe("branch metadata slice", () => {
    it("pinBranch adds branch for repo", async () => {
      await usePreferencesStore
        .getState()
        .pinBranch("/test/repo", "feature/test");

      const pinned = usePreferencesStore.getState().metaPinnedBranches;
      expect(pinned["/test/repo"]).toContain("feature/test");
    });

    it("isBranchPinned returns correct boolean", async () => {
      await usePreferencesStore
        .getState()
        .pinBranch("/test/repo", "feature/test");

      expect(
        usePreferencesStore.getState().isBranchPinned("/test/repo", "feature/test"),
      ).toBe(true);
      expect(
        usePreferencesStore.getState().isBranchPinned("/test/repo", "other-branch"),
      ).toBe(false);
    });

    it("recordBranchVisit adds entry with timestamp", async () => {
      const before = Date.now();
      await usePreferencesStore
        .getState()
        .recordBranchVisit("/test/repo", "main");
      const after = Date.now();

      const recent = usePreferencesStore
        .getState()
        .getMetaRecentBranches("/test/repo");
      expect(recent).toHaveLength(1);
      expect(recent[0].name).toBe("main");
      expect(recent[0].lastVisited).toBeGreaterThanOrEqual(before);
      expect(recent[0].lastVisited).toBeLessThanOrEqual(after);
    });

    it("getMetaScopePreference defaults to 'local'", () => {
      const scope = usePreferencesStore
        .getState()
        .getMetaScopePreference("/unknown/repo");
      expect(scope).toBe("local");
    });
  });

  describe("review checklist slice", () => {
    it("getChecklistItems returns defaults for flow type", () => {
      const items = usePreferencesStore
        .getState()
        .getChecklistItems("feature");
      expect(items).toHaveLength(3);
      expect(items).toEqual(DEFAULT_CHECKLIST.feature);
    });

    it("updateChecklistItems persists custom items", async () => {
      const newItems = [{ id: "custom1", label: "Custom check" }];
      await usePreferencesStore
        .getState()
        .updateChecklistItems("feature", newItems);

      expect(mockStore.set).toHaveBeenCalledWith(
        "review-checklist-items",
        expect.objectContaining({ feature: newItems }),
      );
      expect(mockStore.save).toHaveBeenCalled();
      expect(
        usePreferencesStore.getState().checklistCustomItems.feature,
      ).toEqual(newItems);
    });

    it("resetChecklistToDefaults restores default items", async () => {
      const newItems = [{ id: "custom1", label: "Custom check" }];
      await usePreferencesStore
        .getState()
        .updateChecklistItems("feature", newItems);
      await usePreferencesStore
        .getState()
        .resetChecklistToDefaults("feature");

      expect(
        usePreferencesStore.getState().checklistCustomItems.feature,
      ).toEqual(DEFAULT_CHECKLIST.feature);
    });

    it("initChecklist loads saved items from store", async () => {
      const savedItems = {
        feature: [{ id: "saved1", label: "Saved check" }],
        release: DEFAULT_CHECKLIST.release,
        hotfix: DEFAULT_CHECKLIST.hotfix,
      };
      mockStoreData.set("review-checklist-items", savedItems);

      await usePreferencesStore.getState().initChecklist();

      expect(
        usePreferencesStore.getState().checklistCustomItems.feature,
      ).toEqual([{ id: "saved1", label: "Saved check" }]);
    });
  });

  describe("reset behavior", () => {
    it("preferences store is NOT registered for reset", () => {
      // Mutate state
      usePreferencesStore.getState().setSettingsCategory("git");
      expect(usePreferencesStore.getState().settingsActiveCategory).toBe("git");

      // Call resetAllStores — preferences should survive
      resetAllStores();

      // State should STILL be mutated
      expect(usePreferencesStore.getState().settingsActiveCategory).toBe("git");
    });
  });
});
