// @deprecated - Import from "./domain/preferences" directly.
import { usePreferencesStore } from "./domain/preferences";

export { type RecentBranchEntry } from "./domain/preferences/branch-metadata.slice";

export const useBranchMetadataStore = usePreferencesStore;
