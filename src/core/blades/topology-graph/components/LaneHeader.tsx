import type { BranchType } from "../../../../bindings";
import { BRANCH_BADGE_STYLES } from "./layoutUtils";
import { cn } from "../../../lib/utils";

interface Lane {
  column: number;
  branchName: string;
  branchType: BranchType;
}

interface LaneHeaderProps {
  lanes: Lane[];
}

const BRANCH_TYPE_ORDER: Record<BranchType, number> = {
  main: 0,
  develop: 1,
  release: 2,
  hotfix: 3,
  feature: 4,
  other: 5,
};

export function LaneHeader({ lanes }: LaneHeaderProps) {
  if (lanes.length === 0) return null;

  const sortedLanes = [...lanes].sort((a, b) => {
    const orderA = BRANCH_TYPE_ORDER[a.branchType] ?? 5;
    const orderB = BRANCH_TYPE_ORDER[b.branchType] ?? 5;
    if (orderA !== orderB) return orderA - orderB;
    return a.branchName.localeCompare(b.branchName);
  });

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-ctp-surface0 bg-ctp-crust shrink-0 overflow-x-auto">
      {sortedLanes.map((lane) => (
        <span
          key={`${lane.column}-${lane.branchName}`}
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap",
            BRANCH_BADGE_STYLES[lane.branchType] || BRANCH_BADGE_STYLES.other,
          )}
        >
          {lane.branchName}
        </span>
      ))}
    </div>
  );
}
