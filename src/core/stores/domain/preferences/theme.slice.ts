import type { StateCreator } from "zustand";
import { getStore } from "@/framework/stores/persistence/tauri";
import type { PreferencesStore } from "./index";
import type { PreferencesMiddleware } from "./types";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "latte" | "mocha";

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
  localStorage.setItem("flowforge-theme", resolved);
}

export interface ThemeSlice {
  themePreference: Theme;
  themeResolved: ResolvedTheme;
  themeIsLoading: boolean;
  setTheme: (theme: Theme) => Promise<void>;
  initTheme: () => Promise<void>;
}

export const createThemeSlice: StateCreator<
  PreferencesStore,
  PreferencesMiddleware,
  [],
  ThemeSlice
> = (set, get) => ({
  themePreference: "system",
  themeResolved: "mocha",
  themeIsLoading: true,

  initTheme: async () => {
    try {
      const store = await getStore();
      const saved = await store.get<Theme>("theme");
      const theme = saved ?? "system";

      const resolved = resolveTheme(theme);
      applyTheme(resolved);

      set(
        {
          themePreference: theme,
          themeResolved: resolved,
          themeIsLoading: false,
        },
        false,
        "preferences:theme/init",
      );

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        if (get().themePreference === "system") {
          const newResolved = e.matches ? "mocha" : "latte";
          applyTheme(newResolved);
          set(
            { themeResolved: newResolved },
            false,
            "preferences:theme/systemChange",
          );
        }
      };

      mediaQuery.addEventListener("change", handleChange);
    } catch (e) {
      console.error("Failed to initialize theme:", e);
      set({ themeIsLoading: false }, false, "preferences:theme/initError");
    }
  },

  setTheme: async (theme) => {
    try {
      const store = await getStore();
      await store.set("theme", theme);
      await store.save();

      const resolved = resolveTheme(theme);
      applyTheme(resolved);

      set(
        { themePreference: theme, themeResolved: resolved },
        false,
        "preferences:theme/set",
      );
    } catch (e) {
      console.error("Failed to set theme:", e);
    }
  },
});
