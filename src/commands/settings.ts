import { Settings, Sun } from "lucide-react";
import { registerCommand } from "../lib/commandRegistry";
import { useSettingsStore } from "../stores/settings";
import { type Theme, useThemeStore } from "../stores/theme";

registerCommand({
  id: "open-settings",
  title: "Open Settings",
  description: "Open application settings",
  category: "Settings",
  shortcut: "mod+,",
  icon: Settings,
  action: () => {
    useSettingsStore.getState().openSettings();
  },
});

const themeOrder: Theme[] = ["dark", "light", "system"];

registerCommand({
  id: "toggle-theme",
  title: "Toggle Theme",
  description: "Cycle through dark, light, and system themes",
  category: "Settings",
  icon: Sun,
  action: () => {
    const current = useThemeStore.getState().theme;
    const currentIndex = themeOrder.indexOf(current);
    const next = themeOrder[(currentIndex + 1) % themeOrder.length];
    useThemeStore.getState().setTheme(next);
  },
});
