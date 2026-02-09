import { useUIStore } from "./index";

describe("UI State store", () => {
  describe("composition", () => {
    it("has all slice state keys", () => {
      const state = useUIStore.getState();
      expect(state).toHaveProperty("stagingSelectedFile");
      expect(state).toHaveProperty("stagingSelectedSection");
      expect(state).toHaveProperty("stagingViewMode");
      expect(state).toHaveProperty("stagingScrollPositions");
      expect(state).toHaveProperty("stagingFileListScrollTop");
      expect(state).toHaveProperty("paletteIsOpen");
      expect(state).toHaveProperty("paletteQuery");
      expect(state).toHaveProperty("paletteSelectedIndex");
    });

    it("has correct initial state", () => {
      const state = useUIStore.getState();
      expect(state.stagingSelectedFile).toBeNull();
      expect(state.stagingViewMode).toBe("tree");
      expect(state.paletteIsOpen).toBe(false);
      expect(state.paletteQuery).toBe("");
      expect(state.paletteSelectedIndex).toBe(0);
    });
  });

  describe("staging slice", () => {
    it("selectFile sets selected file and section", () => {
      const file = {
        path: "test.ts",
        status: "modified" as const,
        additions: 1,
        deletions: 0,
      };
      useUIStore.getState().selectFile(file, "unstaged");

      const state = useUIStore.getState();
      expect(state.stagingSelectedFile).toEqual(file);
      expect(state.stagingSelectedSection).toBe("unstaged");
    });

    it("selectFile clears section when not provided", () => {
      useUIStore.getState().selectFile(null);

      const state = useUIStore.getState();
      expect(state.stagingSelectedFile).toBeNull();
      expect(state.stagingSelectedSection).toBeNull();
    });

    it("setStagingViewMode toggles between tree and flat", () => {
      useUIStore.getState().setStagingViewMode("flat");
      expect(useUIStore.getState().stagingViewMode).toBe("flat");
    });

    it("saveStagingScrollPosition persists scroll position per file", () => {
      useUIStore.getState().saveStagingScrollPosition("src/main.ts", 150);
      expect(useUIStore.getState().stagingScrollPositions["src/main.ts"]).toBe(
        150,
      );
    });

    it("clearStagingScrollPositions resets all positions", () => {
      useUIStore.getState().saveStagingScrollPosition("src/main.ts", 150);
      useUIStore.getState().clearStagingScrollPositions();

      expect(useUIStore.getState().stagingScrollPositions).toEqual({});
      expect(useUIStore.getState().stagingFileListScrollTop).toBe(0);
    });
  });

  describe("command palette slice", () => {
    it("openPalette sets paletteIsOpen and resets query", () => {
      useUIStore.getState().openPalette();
      const state = useUIStore.getState();
      expect(state.paletteIsOpen).toBe(true);
      expect(state.paletteQuery).toBe("");
    });

    it("closePalette resets all palette state", () => {
      useUIStore.getState().openPalette();
      useUIStore.getState().closePalette();

      const state = useUIStore.getState();
      expect(state.paletteIsOpen).toBe(false);
      expect(state.paletteQuery).toBe("");
      expect(state.paletteSelectedIndex).toBe(0);
    });

    it("togglePalette flips paletteIsOpen", () => {
      useUIStore.getState().togglePalette();
      expect(useUIStore.getState().paletteIsOpen).toBe(true);

      useUIStore.getState().togglePalette();
      expect(useUIStore.getState().paletteIsOpen).toBe(false);
    });

    it("setPaletteQuery sets query and resets selectedIndex", () => {
      useUIStore.getState().openPalette();
      useUIStore.getState().setPaletteSelectedIndex(3);
      useUIStore.getState().setPaletteQuery("test");

      const state = useUIStore.getState();
      expect(state.paletteQuery).toBe("test");
      expect(state.paletteSelectedIndex).toBe(0);
    });

    it("setPaletteSelectedIndex sets index", () => {
      useUIStore.getState().setPaletteSelectedIndex(5);
      expect(useUIStore.getState().paletteSelectedIndex).toBe(5);
    });
  });

  describe("reset behavior", () => {
    it("resets between tests (auto-reset verification)", () => {
      const state = useUIStore.getState();
      expect(state.stagingSelectedFile).toBeNull();
      expect(state.paletteIsOpen).toBe(false);
    });
  });
});
