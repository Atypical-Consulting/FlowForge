import type { StateCreator } from "zustand";
import { getStore } from "@/framework/stores/persistence/tauri";
import type { PreferencesStore } from "./index";
import type { PreferencesMiddleware } from "./types";

export interface DiffPreferences {
  viewMode: "inline" | "side-by-side";
  collapseUnchanged: boolean;
  contextLines: number;
}

const defaultDiffPreferences: DiffPreferences = {
  viewMode: "inline",
  collapseUnchanged: true,
  contextLines: 3,
};

function mergeDiffPreferences(
  saved: Partial<DiffPreferences>,
): DiffPreferences {
  return { ...defaultDiffPreferences, ...saved };
}

export interface DiffSlice {
  diffPreferences: DiffPreferences;
  setDiffViewMode: (mode: "inline" | "side-by-side") => Promise<void>;
  setDiffCollapseUnchanged: (collapse: boolean) => Promise<void>;
  initDiffPreferences: () => Promise<void>;
}

export const createDiffSlice: StateCreator<
  PreferencesStore,
  PreferencesMiddleware,
  [],
  DiffSlice
> = (set, get) => ({
  diffPreferences: defaultDiffPreferences,

  setDiffViewMode: async (mode) => {
    try {
      const store = await getStore();
      const newPrefs: DiffPreferences = {
        ...get().diffPreferences,
        viewMode: mode,
      };

      await store.set("diff-preferences", newPrefs);
      await store.save();

      set(
        { diffPreferences: newPrefs },
        false,
        "preferences:diff/setViewMode",
      );
    } catch (e) {
      console.error("Failed to update diff view mode:", e);
    }
  },

  setDiffCollapseUnchanged: async (collapse) => {
    try {
      const store = await getStore();
      const newPrefs: DiffPreferences = {
        ...get().diffPreferences,
        collapseUnchanged: collapse,
      };

      await store.set("diff-preferences", newPrefs);
      await store.save();

      set(
        { diffPreferences: newPrefs },
        false,
        "preferences:diff/setCollapseUnchanged",
      );
    } catch (e) {
      console.error("Failed to update diff collapse setting:", e);
    }
  },

  initDiffPreferences: async () => {
    try {
      const store = await getStore();
      const saved =
        await store.get<Partial<DiffPreferences>>("diff-preferences");

      if (saved) {
        set(
          { diffPreferences: mergeDiffPreferences(saved) },
          false,
          "preferences:diff/init",
        );
      }
    } catch (e) {
      console.error("Failed to initialize diff preferences:", e);
    }
  },
});
