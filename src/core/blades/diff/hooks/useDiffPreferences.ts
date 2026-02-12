import { useShallow } from "zustand/shallow";
import { usePreferencesStore } from "../../../stores/domain/preferences";

export function useDiffPreferences() {
  return usePreferencesStore(
    useShallow((s) => ({
      viewMode: s.diffPreferences.viewMode,
      collapseUnchanged: s.diffPreferences.collapseUnchanged,
      contextLines: s.diffPreferences.contextLines,
      setDiffViewMode: s.setDiffViewMode,
      setDiffCollapseUnchanged: s.setDiffCollapseUnchanged,
    })),
  );
}
