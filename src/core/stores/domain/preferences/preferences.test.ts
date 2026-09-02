const mockStoreData = vi.hoisted(() => new Map<string, unknown>());
const mockStore = vi.hoisted(() => ({
  get: vi.fn((key: string) => Promise.resolve(mockStoreData.get(key) ?? null)),
  set: vi.fn((key: string, value: unknown) => {
    mockStoreData.set(key, value);
    return Promise.resolve();
  }),
  save: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/framework/stores/persistence/tauri", () => ({
  getStore: vi.fn(() => Promise.resolve(mockStore)),
}));

vi.mock("@/framework/stores/toast", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

import { invoke } from "@tauri-apps/api/core";
import { resetAllStores } from "@/framework/stores/registry";
import { usePreferencesStore } from "./index";
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

    it("defaults window.decorations to auto", () => {
      expect(
        usePreferencesStore.getState().settingsData.window.decorations,
      ).toBe("auto");
    });

    it("initSettings fills window.decorations from defaults when the saved blob predates it", async () => {
      mockStoreData.set("settings", {
        general: { defaultTab: "history" },
      });

      await usePreferencesStore.getState().initSettings();

      expect(
        usePreferencesStore.getState().settingsData.window.decorations,
      ).toBe("auto");
    });

    it("initSettings merges a saved window.decorations value", async () => {
      mockStoreData.set("settings", { window: { decorations: "never" } });

      await usePreferencesStore.getState().initSettings();

      expect(
        usePreferencesStore.getState().settingsData.window.decorations,
      ).toBe("never");
    });

    it("setWindowDecorations persists the mode and applies it to the window", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await usePreferencesStore.getState().setWindowDecorations("never");

      expect(
        usePreferencesStore.getState().settingsData.window.decorations,
      ).toBe("never");
      expect(mockStore.save).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("set_window_decorations", {
        enabled: false,
      });
    });

    it("setWindowDecorations('auto') asks Rust for the detected default", async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) =>
        cmd === "get_default_window_decorations" ? false : undefined,
      );

      await usePreferencesStore.getState().setWindowDecorations("auto");

      expect(invoke).toHaveBeenCalledWith("get_default_window_decorations");
      expect(invoke).toHaveBeenLastCalledWith("set_window_decorations", {
        enabled: false,
      });
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
      expect(
        usePreferencesStore.getState().settingsData.git.defaultRemote,
      ).toBe("upstream");
    });

    it("updateSetting preserves previously-saved settings when init has not hydrated state", async () => {
      // Simulate a persisted blob from a prior session that has NOT yet been
      // loaded into in-memory settingsData (initSettings has not resolved).
      mockStoreData.set("settings", {
        general: { defaultTab: "topology" },
        integrations: { editor: "code", terminal: "iterm" },
      });

      // updateSetting runs before init hydrates state — it must merge against
      // the persisted value, not the in-memory defaults.
      await usePreferencesStore
        .getState()
        .updateSetting("git", "defaultRemote", "upstream");

      const persisted = mockStoreData.get("settings") as {
        general: { defaultTab: string };
        integrations: { editor: string; terminal: string };
        git: { defaultRemote: string };
      };

      // The unrelated previously-saved settings must survive.
      expect(persisted.general.defaultTab).toBe("topology");
      expect(persisted.integrations.editor).toBe("code");
      expect(persisted.integrations.terminal).toBe("iterm");
      // And the changed value is applied.
      expect(persisted.git.defaultRemote).toBe("upstream");
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

      expect(usePreferencesStore.getState().navPinnedRepoPaths).toContain(
        "/test/repo",
      );
      expect(mockStore.set).toHaveBeenCalledWith(
        "nav-pinned-repos",
        expect.arrayContaining(["/test/repo"]),
      );
    });

    it("unpinRepo removes from navPinnedRepoPaths", async () => {
      await usePreferencesStore.getState().pinRepo("/test/repo");
      await usePreferencesStore.getState().unpinRepo("/test/repo");

      expect(usePreferencesStore.getState().navPinnedRepoPaths).not.toContain(
        "/test/repo",
      );
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
        usePreferencesStore
          .getState()
          .isBranchPinned("/test/repo", "feature/test"),
      ).toBe(true);
      expect(
        usePreferencesStore
          .getState()
          .isBranchPinned("/test/repo", "other-branch"),
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
      const items = usePreferencesStore.getState().getChecklistItems("feature");
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
      await usePreferencesStore.getState().resetChecklistToDefaults("feature");

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
  describe("layout slice — sidebar sections", () => {
    it("defaults to no remembered sections", () => {
      expect(
        usePreferencesStore.getState().layoutState.sidebarSections,
      ).toEqual({});
    });

    it("setSidebarSectionOpen updates state immediately and persists under 'layout'", async () => {
      const promise = usePreferencesStore
        .getState()
        .setSidebarSectionOpen("stashes", true);

      // Synchronous update — UI must not wait for disk I/O.
      expect(
        usePreferencesStore.getState().layoutState.sidebarSections.stashes,
      ).toBe(true);

      await promise;
      expect(mockStore.set).toHaveBeenCalledWith(
        "layout",
        expect.objectContaining({ sidebarSections: { stashes: true } }),
      );
      expect(mockStore.save).toHaveBeenCalled();
    });

    it("setSidebarSectionOpen is a no-op when the value is unchanged", async () => {
      await usePreferencesStore.getState().setSidebarSectionOpen("tags", false);
      mockStore.set.mockClear();

      await usePreferencesStore.getState().setSidebarSectionOpen("tags", false);
      expect(mockStore.set).not.toHaveBeenCalled();
    });

    it("setSidebarSectionOpen does not mark the preset as custom", async () => {
      await usePreferencesStore.getState().setSidebarSectionOpen("tags", true);
      expect(usePreferencesStore.getState().layoutState.activePreset).toBe(
        "review",
      );
    });

    it("initLayout restores persisted section state", async () => {
      mockStoreData.set("layout", {
        panelSizes: { sidebar: 25, blades: 75 },
        sidebarSections: { stashes: true, tags: true },
      });

      await usePreferencesStore.getState().initLayout();

      const { layoutState } = usePreferencesStore.getState();
      expect(layoutState.sidebarSections).toEqual({
        stashes: true,
        tags: true,
      });
      expect(layoutState.panelSizes).toEqual({ sidebar: 25, blades: 75 });
    });

    it("initLayout tolerates legacy layouts without sidebarSections", async () => {
      mockStoreData.set("layout", { panelSizes: { sidebar: 25, blades: 75 } });

      await usePreferencesStore.getState().initLayout();

      expect(
        usePreferencesStore.getState().layoutState.sidebarSections,
      ).toEqual({});
    });

    it("setActivePreset keeps remembered sections", async () => {
      await usePreferencesStore.getState().setSidebarSectionOpen("tags", true);
      await usePreferencesStore.getState().setActivePreset("compose");

      const { layoutState } = usePreferencesStore.getState();
      expect(layoutState.activePreset).toBe("compose");
      expect(layoutState.sidebarSections).toEqual({ tags: true });
    });
  });
});
