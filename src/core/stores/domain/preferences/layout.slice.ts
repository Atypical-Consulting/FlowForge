import type { StateCreator } from "zustand";
import { getStore } from "../../../lib/store";
import {
  DEFAULT_PRESET_ID,
  getPresetById,
  type PresetId,
} from "../../../lib/layoutPresets";
import type { PreferencesStore } from "./index";
import type { PreferencesMiddleware } from "./types";

export interface LayoutState {
  activePreset: PresetId | "custom";
  panelSizes: Record<string, number>;
  hiddenPanels: string[];
  focusedPanel: string | null;
}

const defaultLayoutState: LayoutState = {
  activePreset: DEFAULT_PRESET_ID,
  panelSizes: { sidebar: 20, blades: 80 },
  hiddenPanels: [],
  focusedPanel: null,
};

function mergeLayoutState(saved: Partial<LayoutState>): LayoutState {
  return { ...defaultLayoutState, ...saved };
}

export interface LayoutSlice {
  layoutState: LayoutState;
  setActivePreset: (presetId: PresetId) => Promise<void>;
  setPanelSizes: (sizes: Record<string, number>) => Promise<void>;
  togglePanel: (panelId: string) => Promise<void>;
  enterFocusMode: (panelId: string) => void;
  exitFocusMode: () => void;
  resetLayout: () => Promise<void>;
  initLayout: () => Promise<void>;
}

export const createLayoutSlice: StateCreator<
  PreferencesStore,
  PreferencesMiddleware,
  [],
  LayoutSlice
> = (set, get) => ({
  layoutState: defaultLayoutState,

  setActivePreset: async (presetId) => {
    try {
      const preset = getPresetById(presetId);
      if (!preset) return;

      const allPanels = ["sidebar", "blades"];
      const hiddenPanels = allPanels.filter(
        (p) => !preset.visiblePanels.includes(p),
      );

      const newState: LayoutState = {
        activePreset: presetId,
        panelSizes: { ...preset.layout },
        hiddenPanels,
        focusedPanel: null,
      };

      const store = await getStore();
      await store.set("layout", newState);
      await store.save();

      set({ layoutState: newState }, false, "preferences:layout/setPreset");
    } catch (e) {
      console.error("Failed to set active preset:", e);
    }
  },

  setPanelSizes: async (sizes) => {
    try {
      const newState: LayoutState = {
        ...get().layoutState,
        activePreset: "custom",
        panelSizes: sizes,
      };

      const store = await getStore();
      await store.set("layout", newState);
      await store.save();

      set({ layoutState: newState }, false, "preferences:layout/setPanelSizes");
    } catch (e) {
      console.error("Failed to set panel sizes:", e);
    }
  },

  togglePanel: async (panelId) => {
    try {
      const current = get().layoutState;
      const isHidden = current.hiddenPanels.includes(panelId);
      const hiddenPanels = isHidden
        ? current.hiddenPanels.filter((p) => p !== panelId)
        : [...current.hiddenPanels, panelId];

      const newState: LayoutState = {
        ...current,
        activePreset: "custom",
        hiddenPanels,
      };

      const store = await getStore();
      await store.set("layout", newState);
      await store.save();

      set({ layoutState: newState }, false, "preferences:layout/togglePanel");
    } catch (e) {
      console.error("Failed to toggle panel:", e);
    }
  },

  enterFocusMode: (panelId) => {
    set(
      {
        layoutState: {
          ...get().layoutState,
          focusedPanel: panelId,
        },
      },
      false,
      "preferences:layout/enterFocusMode",
    );
  },

  exitFocusMode: () => {
    set(
      {
        layoutState: {
          ...get().layoutState,
          focusedPanel: null,
        },
      },
      false,
      "preferences:layout/exitFocusMode",
    );
  },

  resetLayout: async () => {
    try {
      const store = await getStore();
      await store.set("layout", defaultLayoutState);
      await store.save();

      set(
        { layoutState: { ...defaultLayoutState } },
        false,
        "preferences:layout/reset",
      );
    } catch (e) {
      console.error("Failed to reset layout:", e);
    }
  },

  initLayout: async () => {
    try {
      const store = await getStore();
      const saved = await store.get<Partial<LayoutState>>("layout");

      if (saved) {
        set(
          { layoutState: mergeLayoutState(saved) },
          false,
          "preferences:layout/init",
        );
      }
    } catch (e) {
      console.error("Failed to initialize layout preferences:", e);
    }
  },
});
