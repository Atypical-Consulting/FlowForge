import { Monitor, Moon, Sun } from "lucide-react";
import {
  isWindowDecorationsMode,
  type WindowDecorationsMode,
} from "../../../lib/windowDecorations";
import { usePreferencesStore as useThemeStore } from "../../../stores/domain/preferences";
import type { Theme } from "../../../stores/domain/preferences/theme.slice";
import { SettingsField } from "./SettingsField";

const themeOptions: { value: Theme; icon: React.ReactNode; label: string }[] = [
  { value: "light", icon: <Sun className="w-4 h-4" />, label: "Light" },
  { value: "dark", icon: <Moon className="w-4 h-4" />, label: "Dark" },
  { value: "system", icon: <Monitor className="w-4 h-4" />, label: "System" },
];

const decorationOptions: { value: WindowDecorationsMode; label: string }[] = [
  { value: "auto", label: "Auto (hide on tiling compositors)" },
  { value: "always", label: "Always show" },
  { value: "never", label: "Never show" },
];

const selectClassName =
  "w-full max-w-xs px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-md text-sm text-ctp-text focus:outline-none focus:ring-2 focus:ring-ctp-blue focus:border-transparent";

export function AppearanceSettings() {
  const {
    themePreference: theme,
    setTheme,
    settingsData: settings,
    setWindowDecorations,
  } = useThemeStore();

  const handleDecorationsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (isWindowDecorationsMode(value)) {
      void setWindowDecorations(value);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-ctp-text mb-4">Appearance</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
                    theme === option.value
                      ? "bg-ctp-blue text-ctp-base font-medium"
                      : "bg-ctp-surface0 text-ctp-subtext1 hover:bg-ctp-surface1 hover:text-ctp-text"
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <SettingsField
            label="Window title bar"
            description="Tiling compositors (Hyprland, sway, river, niri…) manage windows themselves, so the built-in title bar is redundant there."
            htmlFor="window-decorations"
          >
            <select
              id="window-decorations"
              value={settings.window.decorations}
              onChange={handleDecorationsChange}
              className={selectClassName}
            >
              {decorationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SettingsField>
        </div>
      </div>
    </div>
  );
}
