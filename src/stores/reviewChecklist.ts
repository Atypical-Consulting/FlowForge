// @deprecated - Import from "./domain/preferences" directly.
import { usePreferencesStore } from "./domain/preferences";

export { type ChecklistItem, type FlowType, DEFAULT_CHECKLIST } from "./domain/preferences/review-checklist.slice";

export const useReviewChecklistStore = usePreferencesStore;
