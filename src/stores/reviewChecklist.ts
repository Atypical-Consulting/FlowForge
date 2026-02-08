import { create } from "zustand";
import { getStore } from "../lib/store";

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

interface ReviewChecklistState {
  customItems: Record<FlowType, Omit<ChecklistItem, "checked">[]>;

  initChecklist: () => Promise<void>;
  getItems: (flowType: FlowType) => Omit<ChecklistItem, "checked">[];
  updateItems: (
    flowType: FlowType,
    items: Omit<ChecklistItem, "checked">[],
  ) => Promise<void>;
  resetToDefaults: (flowType: FlowType) => Promise<void>;
}

export const useReviewChecklistStore = create<ReviewChecklistState>(
  (set, get) => ({
    customItems: { ...DEFAULT_CHECKLIST },

    initChecklist: async () => {
      try {
        const store = await getStore();
        const saved = await store.get<
          Record<FlowType, Omit<ChecklistItem, "checked">[]>
        >("review-checklist-items");
        if (saved) {
          set({
            customItems: {
              feature: saved.feature ?? DEFAULT_CHECKLIST.feature,
              release: saved.release ?? DEFAULT_CHECKLIST.release,
              hotfix: saved.hotfix ?? DEFAULT_CHECKLIST.hotfix,
            },
          });
        }
      } catch (e) {
        console.error("Failed to initialize review checklist:", e);
      }
    },

    getItems: (flowType: FlowType) => {
      return get().customItems[flowType] ?? DEFAULT_CHECKLIST[flowType];
    },

    updateItems: async (
      flowType: FlowType,
      items: Omit<ChecklistItem, "checked">[],
    ) => {
      const { customItems } = get();
      const updated = { ...customItems, [flowType]: items };
      try {
        const store = await getStore();
        await store.set("review-checklist-items", updated);
        await store.save();
      } catch (e) {
        console.error("Failed to persist review checklist:", e);
      }
      set({ customItems: updated });
    },

    resetToDefaults: async (flowType: FlowType) => {
      const { customItems } = get();
      const updated = { ...customItems, [flowType]: DEFAULT_CHECKLIST[flowType] };
      try {
        const store = await getStore();
        await store.set("review-checklist-items", updated);
        await store.save();
      } catch (e) {
        console.error("Failed to persist review checklist reset:", e);
      }
      set({ customItems: updated });
    },
  }),
);
