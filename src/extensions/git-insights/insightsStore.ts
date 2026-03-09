import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { commands } from "../../bindings";
import type { BranchHealthInfo, RepoInsights, TimeRange } from "./types";

interface InsightsState {
  // Data
  insights: RepoInsights | null;
  branchHealth: BranchHealthInfo[];
  isLoading: boolean;
  error: string | null;

  // Filters
  timeRange: TimeRange;
  selectedContributor: string | null;

  // Actions
  loadInsights: () => Promise<void>;
  loadBranchHealth: () => Promise<void>;
  setTimeRange: (range: TimeRange) => void;
  selectContributor: (email: string | null) => void;
  reset: () => void;
}

const STALE_DAYS = 30;

export const useInsightsStore = create<InsightsState>()(
  devtools(
    (set, get) => ({
      insights: null,
      branchHealth: [],
      isLoading: false,
      error: null,
      timeRange: 30,
      selectedContributor: null,

      loadInsights: async () => {
        set({ isLoading: true, error: null }, false, "insights/load-start");
        try {
          const result = await commands.getRepoInsights(get().timeRange);
          if (result.status === "error") {
            const errMsg =
              "message" in result.error
                ? String(result.error.message)
                : result.error.type;
            set(
              { error: errMsg, isLoading: false },
              false,
              "insights/load-error",
            );
            return;
          }
          set(
            { insights: result.data, isLoading: false },
            false,
            "insights/load-success",
          );
        } catch (e) {
          set(
            {
              error: e instanceof Error ? e.message : String(e),
              isLoading: false,
            },
            false,
            "insights/load-error",
          );
        }
      },

      loadBranchHealth: async () => {
        try {
          const result = await commands.getBranchHealth(STALE_DAYS);
          if (result.status === "error") return;
          set(
            { branchHealth: result.data },
            false,
            "insights/branch-health-loaded",
          );
        } catch {
          // Silent fail -- branch health is supplementary
        }
      },

      setTimeRange: (range) => {
        set({ timeRange: range }, false, "insights/set-time-range");
        get().loadInsights();
      },

      selectContributor: (email) => {
        set(
          { selectedContributor: email },
          false,
          "insights/select-contributor",
        );
      },

      reset: () => {
        set(
          {
            insights: null,
            branchHealth: [],
            isLoading: false,
            error: null,
            timeRange: 30,
            selectedContributor: null,
          },
          false,
          "insights/reset",
        );
      },
    }),
    { name: "git-insights", enabled: import.meta.env.DEV },
  ),
);
