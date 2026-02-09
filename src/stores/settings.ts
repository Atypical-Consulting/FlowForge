// @deprecated - Import from "./domain/preferences" directly.
import { usePreferencesStore } from "./domain/preferences";

export { type SettingsCategory, type GeneralSettings, type GitSettings, type IntegrationsSettings, type Settings } from "./domain/preferences/settings.slice";

export const useSettingsStore = usePreferencesStore;
