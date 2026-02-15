import { Settings, Sun } from "lucide-react";
import { registerCommand } from "@/framework/command-palette/commandRegistry";
import { openBlade } from "../lib/bladeOpener";
import type { Theme } from "../stores/domain/preferences/theme.slice";
import { usePreferencesStore as useThemeStore } from "../stores/domain/preferences";

registerCommand({
  id: "open-settings",
  title: "Open Settings",
  description: "Open application settings",
  category: "Settings",
  shortcut: "mod+,",
  icon: Settings,
  action: () => {
    openBlade("settings", {} as Record<string, never>);
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
    const current = useThemeStore.getState().themePreference;
    const currentIndex = themeOrder.indexOf(current);
    const next = themeOrder[(currentIndex + 1) % themeOrder.length];
    useThemeStore.getState().setTheme(next);
  },
});
