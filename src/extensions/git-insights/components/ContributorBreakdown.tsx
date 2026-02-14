import type { ContributorStats } from "../types";

interface Props {
  contributors: ContributorStats[];
  totalCommits: number;
}

export function ContributorBreakdown({ contributors, totalCommits }: Props) {
  return (
    <div className="text-xs text-ctp-subtext0 text-center py-4">
      {contributors.length} contributors, {totalCommits} commits
    </div>
  );
}
