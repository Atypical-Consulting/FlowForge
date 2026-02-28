import { Monitor, Moon, Sun } from "lucide-react";
import { usePreferencesStore as useThemeStore } from "../../stores/domain/preferences";
import type { Theme } from "../../stores/domain/preferences/theme.slice";
import { Button } from "./button";

export function ThemeToggle() {
  const {
    themePreference: theme,
    setTheme,
    themeIsLoading: isLoading,
  } = useThemeStore();

  if (isLoading) {
    return null;
  }

  const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun className="w-4 h-4" />, label: "Light theme" },
    { value: "dark", icon: <Moon className="w-4 h-4" />, label: "Dark theme" },
    {
      value: "system",
      icon: <Monitor className="w-4 h-4" />,
      label: "System theme",
    },
  ];

  return (
    <div className="flex items-center rounded-md border border-ctp-surface0 bg-ctp-mantle p-0.5">
      {options.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          size="sm"
          onClick={() => setTheme(option.value)}
          className={`px-2 py-1 h-7 ${
            theme === option.value
              ? "bg-ctp-surface0 text-ctp-text"
              : "text-ctp-subtext0 hover:text-ctp-text hover:bg-transparent"
          }`}
          aria-label={option.label}
          aria-pressed={theme === option.value}
        >
          {option.icon}
        </Button>
      ))}
    </div>
  );
}
