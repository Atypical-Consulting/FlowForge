import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { BarChart3, GitBranch, Users, Activity } from "lucide-react";
import { useInsightsData } from "../hooks/useInsightsData";
import { TimeRangeSelector } from "../components/TimeRangeSelector";
import { useInsightsStore } from "../insightsStore";
import { CommitActivityChart } from "../components/CommitActivityChart";
import { ContributorBreakdown } from "../components/ContributorBreakdown";
import { BranchHealthOverview } from "../components/BranchHealthOverview";
import { RepoStatsCards } from "../components/RepoStatsCards";

export function InsightsDashboardBlade() {
  const { insights, branchHealth, isLoading, error } = useInsightsData();
  const timeRange = useInsightsStore((s) => s.timeRange);
  const setTimeRange = useInsightsStore((s) => s.setTimeRange);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-ctp-red">
        <div className="text-center">
          <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header with title and time range */}
      <div className="flex items-center justify-between border-b border-ctp-surface0/50 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="h-4.5 w-4.5 text-ctp-blue" />
          <h2 className="text-sm font-semibold text-ctp-text">
            Repository Insights
          </h2>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Dashboard content */}
      <div className="flex-1 overflow-y-auto p-5">
        <motion.div
          className="flex flex-col gap-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Row 1: Stats cards */}
          <RepoStatsCards
            insights={insights}
            branchCount={branchHealth.length}
            isLoading={isLoading}
          />

          {/* Row 2: Commit activity chart (full width) */}
          <DashboardCard
            title="Commit Activity"
            icon={Activity}
            isLoading={isLoading}
          >
            {insights && <CommitActivityChart data={insights.dailyCommits} />}
          </DashboardCard>

          {/* Row 3: Contributors + Branch Health */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <DashboardCard
              title="Contributors"
              icon={Users}
              isLoading={isLoading}
            >
              {insights && (
                <ContributorBreakdown
                  contributors={insights.contributors}
                  totalCommits={insights.totalCommits}
                />
              )}
            </DashboardCard>

            <DashboardCard
              title="Branch Health"
              icon={GitBranch}
              isLoading={isLoading}
            >
              <BranchHealthOverview branches={branchHealth} />
            </DashboardCard>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/** Reusable glass-morphism card wrapper for dashboard sections */
function DashboardCard({
  title,
  icon: Icon,
  isLoading,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  isLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ctp-surface0/50 bg-ctp-mantle/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-ctp-surface0/30 px-4 py-2.5">
        <Icon className="h-3.5 w-3.5 text-ctp-subtext0" />
        <span className="text-xs font-medium text-ctp-subtext1">{title}</span>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-ctp-surface2 border-t-ctp-blue" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
