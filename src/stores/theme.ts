// @deprecated - Import from "./domain/preferences" directly.
import { usePreferencesStore } from "./domain/preferences";

export { type Theme, type ResolvedTheme } from "./domain/preferences/theme.slice";

export const useThemeStore = usePreferencesStore;
