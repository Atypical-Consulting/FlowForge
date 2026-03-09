import { useEffect } from "react";
import { useInsightsStore } from "../insightsStore";

/**
 * Triggers insights data loading on mount and when time range changes.
 * Call this in the dashboard blade component.
 */
export function useInsightsData() {
  const loadInsights = useInsightsStore((s) => s.loadInsights);
  const loadBranchHealth = useInsightsStore((s) => s.loadBranchHealth);
  const _timeRange = useInsightsStore((s) => s.timeRange);

  useEffect(() => {
    loadInsights();
    loadBranchHealth();
  }, [loadInsights, loadBranchHealth]);

  return useInsightsStore();
}
