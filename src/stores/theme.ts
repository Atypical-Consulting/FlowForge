import { create } from "zustand";
import { getStore } from "../lib/store";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "latte" | "mocha";

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  isLoading: boolean;

  setTheme: (theme: Theme) => Promise<void>;
  initTheme: () => Promise<void>;
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "mocha"
      : "latte";
  }
  return theme === "dark" ? "mocha" : "latte";
}

function applyTheme(resolved: ResolvedTheme) {
  const html = document.documentElement;
  html.classList.remove("latte", "mocha");
  html.classList.add(resolved);
  // Sync to localStorage for FOUC prevention on next load
  localStorage.setItem("flowforge-theme", resolved);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "system",
  resolvedTheme: "mocha",
  isLoading: true,

  initTheme: async () => {
    try {
      const store = await getStore();
      const saved = await store.get<Theme>("theme");
      const theme = saved ?? "system";

      const resolved = resolveTheme(theme);
      applyTheme(resolved);

      set({ theme, resolvedTheme: resolved, isLoading: false });

      // Listen for system preference changes when in system mode
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        if (get().theme === "system") {
          const newResolved = e.matches ? "mocha" : "latte";
          applyTheme(newResolved);
          set({ resolvedTheme: newResolved });
        }
      };

      mediaQuery.addEventListener("change", handleChange);
    } catch (e) {
      console.error("Failed to initialize theme:", e);
      set({ isLoading: false });
    }
  },

  setTheme: async (theme) => {
    try {
      const store = await getStore();
      await store.set("theme", theme);
      await store.save();

      const resolved = resolveTheme(theme);
      applyTheme(resolved);

      set({ theme, resolvedTheme: resolved });
    } catch (e) {
      console.error("Failed to set theme:", e);
    }
  },
}));
