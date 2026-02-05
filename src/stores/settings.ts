import { create } from "zustand";
import { getStore } from "../lib/store";

export type SettingsCategory = "general" | "git" | "appearance";

export interface GeneralSettings {
  defaultTab: "changes" | "history" | "topology";
}

export interface GitSettings {
  defaultRemote: string;
  autoFetchInterval: number | null;
}

export interface Settings {
  general: GeneralSettings;
  git: GitSettings;
}

interface SettingsState {
  isOpen: boolean;
  activeCategory: SettingsCategory;
  settings: Settings;

  openSettings: () => void;
  closeSettings: () => void;
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
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isOpen: false,
  activeCategory: "general",
  settings: defaultSettings,

  openSettings: () => set({ isOpen: true }),
  closeSettings: () => set({ isOpen: false }),
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
      const saved = await store.get<Settings>("settings");

      if (saved) {
        const merged: Settings = {
          general: { ...defaultSettings.general, ...saved.general },
          git: { ...defaultSettings.git, ...saved.git },
        };
        set({ settings: merged });
      }
    } catch (e) {
      console.error("Failed to initialize settings:", e);
    }
  },
}));
