import { create } from "zustand";
import { getStore } from "../lib/store";

export type SettingsCategory = "general" | "git" | "appearance" | "integrations" | "review";

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

export interface Settings {
  general: GeneralSettings;
  git: GitSettings;
  integrations: IntegrationsSettings;
}

interface SettingsState {
  activeCategory: SettingsCategory;
  settings: Settings;

  setCategory: (category: SettingsCategory) => void;
  updateSetting: <C extends keyof Settings>(
    category: C,
    key: keyof Settings[C],
    value: Settings[C][keyof Settings[C]]
  ) => Promise<void>;
  initSettings: () => Promise<void>;
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
};

function mergeSettings(saved: Partial<Settings>): Settings {
  return {
    general: { ...defaultSettings.general, ...saved.general },
    git: { ...defaultSettings.git, ...saved.git },
    integrations: { ...defaultSettings.integrations, ...saved.integrations },
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  activeCategory: "general",
  settings: defaultSettings,

  setCategory: (category) => set({ activeCategory: category }),

  updateSetting: async (category, key, value) => {
    try {
      const store = await getStore();
      const currentSettings = get().settings;

      const newSettings: Settings = {
        ...currentSettings,
        [category]: {
          ...currentSettings[category],
          [key]: value,
        },
      };

      await store.set("settings", newSettings);
      await store.save();

      set({ settings: newSettings });
    } catch (e) {
      console.error("Failed to update setting:", e);
    }
  },

  initSettings: async () => {
    try {
      const store = await getStore();
      const saved = await store.get<Partial<Settings>>("settings");

      if (saved) {
        set({ settings: mergeSettings(saved) });
      }
    } catch (e) {
      console.error("Failed to initialize settings:", e);
    }
  },
}));
