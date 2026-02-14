import type { BranchHealthInfo } from "../types";

interface Props {
  branches: BranchHealthInfo[];
}

export function BranchHealthOverview({ branches }: Props) {
  return (
    <div className="text-xs text-ctp-subtext0 text-center py-4">
      {branches.length} branches
    </div>
  );
}
