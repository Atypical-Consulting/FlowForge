import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  createSettingsSlice,
  type SettingsSlice,
} from "./settings.slice";
import {
  createThemeSlice,
  type ThemeSlice,
} from "./theme.slice";
import {
  createNavigationSlice,
  type NavigationSlice,
} from "./navigation.slice";
import {
  createBranchMetadataSlice,
  type BranchMetadataSlice,
} from "./branch-metadata.slice";
import {
  createReviewChecklistSlice,
  type ReviewChecklistSlice,
} from "./review-checklist.slice";
import {
  createDiffSlice,
  type DiffSlice,
} from "./diff.slice";

export type PreferencesStore = SettingsSlice &
  ThemeSlice &
  NavigationSlice &
  BranchMetadataSlice &
  ReviewChecklistSlice &
  DiffSlice;

export const usePreferencesStore = create<PreferencesStore>()(
  devtools(
    (...args) => ({
      ...createSettingsSlice(...args),
      ...createThemeSlice(...args),
      ...createNavigationSlice(...args),
      ...createBranchMetadataSlice(...args),
      ...createReviewChecklistSlice(...args),
      ...createDiffSlice(...args),
    }),
    { name: "preferences", enabled: import.meta.env.DEV },
  ),
);

// NOTE: Preferences are NOT registered for reset — they survive repo switches

/** Initialize all preference slices from persistent storage. */
export async function initAllPreferences(): Promise<void> {
  const state = usePreferencesStore.getState();
  await Promise.all([
    state.initSettings(),
    state.initTheme(),
    state.initNavigation(),
    state.initMetadata(),
    state.initChecklist(),
    state.initDiffPreferences(),
  ]);
}
