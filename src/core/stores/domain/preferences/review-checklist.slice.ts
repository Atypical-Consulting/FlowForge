import type { StateCreator } from "zustand";
import { getStore } from "@/framework/stores/persistence/tauri";
import { toast } from "@/framework/stores/toast";
import type { PreferencesStore } from "./index";
import type { PreferencesMiddleware } from "./types";

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export type FlowType = "feature" | "release" | "hotfix";

export const DEFAULT_CHECKLIST: Record<
  FlowType,
  Omit<ChecklistItem, "checked">[]
> = {
  feature: [
    { id: "f1", label: "Code has been tested locally" },
    { id: "f2", label: "No unresolved TODOs or FIXMEs" },
    { id: "f3", label: "Changes match the feature requirements" },
  ],
  release: [
    { id: "r1", label: "Version number has been updated" },
    { id: "r2", label: "Changelog has been reviewed" },
    { id: "r3", label: "All features are tested and stable" },
    { id: "r4", label: "No known critical bugs remain" },
  ],
  hotfix: [
    { id: "h1", label: "Fix addresses the reported issue" },
    { id: "h2", label: "Regression tests have been added" },
    { id: "h3", label: "Fix has been verified in a clean environment" },
  ],
};

export interface ReviewChecklistSlice {
  checklistCustomItems: Record<FlowType, Omit<ChecklistItem, "checked">[]>;

  initChecklist: () => Promise<void>;
  getChecklistItems: (flowType: FlowType) => Omit<ChecklistItem, "checked">[];
  updateChecklistItems: (
    flowType: FlowType,
    items: Omit<ChecklistItem, "checked">[],
  ) => Promise<void>;
  resetChecklistToDefaults: (flowType: FlowType) => Promise<void>;
}

export const createReviewChecklistSlice: StateCreator<
  PreferencesStore,
  PreferencesMiddleware,
  [],
  ReviewChecklistSlice
> = (set, get) => ({
  checklistCustomItems: { ...DEFAULT_CHECKLIST },

  initChecklist: async () => {
    try {
      const store = await getStore();
      const saved = await store.get<
        Record<FlowType, Omit<ChecklistItem, "checked">[]>
      >("review-checklist-items");
      if (saved) {
        set(
          {
            checklistCustomItems: {
              feature: saved.feature ?? DEFAULT_CHECKLIST.feature,
              release: saved.release ?? DEFAULT_CHECKLIST.release,
              hotfix: saved.hotfix ?? DEFAULT_CHECKLIST.hotfix,
            },
          },
          false,
          "preferences:checklist/init",
        );
      }
    } catch (e) {
      toast.warning("Could not load review checklist. Using defaults.");
      console.error("Failed to initialize review checklist:", e);
    }
  },

  getChecklistItems: (flowType: FlowType) => {
    return (
      get().checklistCustomItems[flowType] ?? DEFAULT_CHECKLIST[flowType]
    );
  },

  updateChecklistItems: async (
    flowType: FlowType,
    items: Omit<ChecklistItem, "checked">[],
  ) => {
    const { checklistCustomItems } = get();
    const updated = { ...checklistCustomItems, [flowType]: items };
    try {
      const store = await getStore();
      await store.set("review-checklist-items", updated);
      await store.save();
    } catch (e) {
      toast.error("Failed to save checklist changes");
      console.error("Failed to persist review checklist:", e);
    }
    set(
      { checklistCustomItems: updated },
      false,
      "preferences:checklist/update",
    );
  },

  resetChecklistToDefaults: async (flowType: FlowType) => {
    const { checklistCustomItems } = get();
    const updated = {
      ...checklistCustomItems,
      [flowType]: DEFAULT_CHECKLIST[flowType],
    };
    try {
      const store = await getStore();
      await store.set("review-checklist-items", updated);
      await store.save();
    } catch (e) {
      toast.error("Failed to reset checklist to defaults");
      console.error("Failed to persist review checklist reset:", e);
    }
    set(
      { checklistCustomItems: updated },
      false,
      "preferences:checklist/reset",
    );
  },
});
