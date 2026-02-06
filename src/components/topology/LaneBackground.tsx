import type { BranchType } from "../../bindings";
import { GITFLOW_COLORS } from "./layoutUtils";

interface LaneBgInfo {
  column: number;
  branchType: BranchType;
  x: number;
  width: number;
}

interface LaneBackgroundProps {
  lanes: LaneBgInfo[];
  height: number;
}

export function LaneBackground({ lanes, height }: LaneBackgroundProps) {
  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ height }}>
      {lanes.map((lane) => (
        <rect
          key={lane.column}
          x={lane.x}
          y={0}
          width={lane.width}
          height={height}
          fill={GITFLOW_COLORS[lane.branchType] || GITFLOW_COLORS.other}
          opacity={0.04}
        />
      ))}
    </svg>
  );
}
