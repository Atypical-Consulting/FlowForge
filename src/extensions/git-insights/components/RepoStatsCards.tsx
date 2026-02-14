import type { RepoInsights } from "../types";

interface Props {
  insights: RepoInsights | null;
  branchCount: number;
  isLoading: boolean;
}

export function RepoStatsCards({ insights, branchCount, isLoading }: Props) {
  return (
    <div className="text-xs text-ctp-subtext0 text-center py-4">
      {isLoading
        ? "Loading..."
        : `${insights?.totalCommits ?? 0} commits, ${branchCount} branches`}
    </div>
  );
}
