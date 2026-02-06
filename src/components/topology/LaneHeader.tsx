import type { BranchType } from "../../bindings";
import { BRANCH_BADGE_STYLES } from "./layoutUtils";
import { cn } from "../../lib/utils";

interface Lane {
  column: number;
  branchName: string;
  branchType: BranchType;
}

interface LaneHeaderProps {
  lanes: Lane[];
}

export function LaneHeader({ lanes }: LaneHeaderProps) {
  if (lanes.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-ctp-surface0 bg-ctp-crust shrink-0 overflow-x-auto">
      {lanes.map((lane) => (
        <span
          key={`${lane.column}-${lane.branchName}`}
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap",
            BRANCH_BADGE_STYLES[lane.branchType] ||
              BRANCH_BADGE_STYLES.other,
          )}
        >
          {lane.branchName}
        </span>
      ))}
    </div>
  );
}
