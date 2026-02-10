import { Monitor, Moon, Sun } from "lucide-react";
import type { Theme } from "../../../stores/domain/preferences/theme.slice";
import { usePreferencesStore as useThemeStore } from "../../../stores/domain/preferences";

const themeOptions: { value: Theme; icon: React.ReactNode; label: string }[] = [
  { value: "light", icon: <Sun className="w-4 h-4" />, label: "Light" },
  { value: "dark", icon: <Moon className="w-4 h-4" />, label: "Dark" },
  { value: "system", icon: <Monitor className="w-4 h-4" />, label: "System" },
];

export function AppearanceSettings() {
  const { themePreference: theme, setTheme } = useThemeStore();

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
        </div>
      </div>
    </div>
  );
}
