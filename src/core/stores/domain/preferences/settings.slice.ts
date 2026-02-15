import type { StateCreator } from "zustand";
import { getStore } from "@/framework/stores/persistence/tauri";
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

export interface Settings {
  general: GeneralSettings;
  git: GitSettings;
  integrations: IntegrationsSettings;
  toolbar: ToolbarSettings;
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
};

function mergeSettings(saved: Partial<Settings>): Settings {
  return {
    general: { ...defaultSettings.general, ...saved.general },
    git: { ...defaultSettings.git, ...saved.git },
    integrations: { ...defaultSettings.integrations, ...saved.integrations },
    toolbar: { ...defaultSettings.toolbar, ...saved.toolbar },
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
      const currentSettings = get().settingsData;

      const newSettings: Settings = {
        ...currentSettings,
        [category]: {
          ...currentSettings[category],
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
