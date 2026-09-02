import type { StateCreator } from "zustand";
import { getStore } from "@/framework/stores/persistence/tauri";
import {
  applyWindowDecorations,
  type WindowDecorationsMode,
} from "../../../lib/windowDecorations";
import type { PreferencesStore } from "./index";
import type { PreferencesMiddleware } from "./types";

export type SettingsCategory =
  | "general"
  | "git"
  | "appearance"
  | "integrations"
  | "review"
  | "toolbar";

export interface GeneralSettings {
  defaultTab: "changes" | "history" | "topology";
}

export interface GitSettings {
  defaultRemote: string;
  autoFetchInterval: number | null;
}

export interface IntegrationsSettings {
  editor: string;
  terminal: string;
}

export interface ToolbarSettings {
  /** Action IDs the user has explicitly hidden from the toolbar */
  hiddenActions: string[];
}

export interface WindowSettings {
  /**
   * Client-side title bar policy. `auto` defers to the Rust runtime detection
   * (hidden on tiling Wayland compositors, shown elsewhere).
   */
  decorations: WindowDecorationsMode;
}

export interface Settings {
  general: GeneralSettings;
  git: GitSettings;
  integrations: IntegrationsSettings;
  toolbar: ToolbarSettings;
  window: WindowSettings;
}

const defaultSettings: Settings = {
  general: {
    defaultTab: "changes",
  },
  git: {
    defaultRemote: "origin",
    autoFetchInterval: null,
  },
  integrations: {
    editor: "",
    terminal: "",
  },
  toolbar: {
    hiddenActions: [],
  },
  window: {
    decorations: "auto",
  },
};

function mergeSettings(saved: Partial<Settings>): Settings {
  return {
    general: { ...defaultSettings.general, ...saved.general },
    git: { ...defaultSettings.git, ...saved.git },
    integrations: { ...defaultSettings.integrations, ...saved.integrations },
    toolbar: { ...defaultSettings.toolbar, ...saved.toolbar },
    window: { ...defaultSettings.window, ...saved.window },
  };
}

export interface SettingsSlice {
  settingsActiveCategory: SettingsCategory;
  settingsData: Settings;
  setSettingsCategory: (category: SettingsCategory) => void;
  updateSetting: <C extends keyof Settings>(
    category: C,
    key: keyof Settings[C],
    value: Settings[C][keyof Settings[C]],
  ) => Promise<void>;
  /** Persist the title bar preference and apply it to the window right away. */
  setWindowDecorations: (mode: WindowDecorationsMode) => Promise<void>;
  initSettings: () => Promise<void>;
}

export const createSettingsSlice: StateCreator<
  PreferencesStore,
  PreferencesMiddleware,
  [],
  SettingsSlice
> = (set, get) => ({
  settingsActiveCategory: "general",
  settingsData: defaultSettings,

  setSettingsCategory: (category) =>
    set(
      { settingsActiveCategory: category },
      false,
      "preferences:settings/setCategory",
    ),

  updateSetting: async (category, key, value) => {
    try {
      const store = await getStore();

      // Merge against the currently persisted value rather than in-memory
      // state. If init has not yet hydrated settingsData (it still equals
      // defaultSettings), merging against in-memory state would clobber any
      // previously-saved settings that have not been loaded yet. Reading the
      // persisted blob here makes the write safe-by-construction.
      const saved = mergeSettings(
        (await store.get<Partial<Settings>>("settings")) ?? {},
      );

      const newSettings: Settings = {
        ...saved,
        [category]: {
          ...saved[category],
          [key]: value,
        },
      };

      await store.set("settings", newSettings);
      await store.save();

      set({ settingsData: newSettings }, false, "preferences:settings/update");
    } catch (e) {
      console.error("Failed to update setting:", e);
    }
  },

  setWindowDecorations: async (mode) => {
    await get().updateSetting("window", "decorations", mode);
    try {
      await applyWindowDecorations(mode);
    } catch (e) {
      console.error("Failed to apply window decorations:", e);
    }
  },

  initSettings: async () => {
    try {
      const store = await getStore();
      const saved = await store.get<Partial<Settings>>("settings");

      if (saved) {
        set(
          { settingsData: mergeSettings(saved) },
          false,
          "preferences:settings/init",
        );
      }
    } catch (e) {
      console.error("Failed to initialize settings:", e);
    }
  },
});
