import { getMonacoTheme, type MonacoTheme } from "../lib/monacoConfig";
import { usePreferencesStore } from "../stores/domain/preferences";

/**
 * Monaco theme name that follows the app's active Catppuccin flavour
 * (Latte for light mode, Mocha for dark mode).
 */
export function useMonacoTheme(): MonacoTheme {
  const resolved = usePreferencesStore((s) => s.themeResolved);
  return getMonacoTheme(resolved);
}
