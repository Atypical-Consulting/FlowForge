import type { Edge, EdgeProps } from "@xyflow/react";
import { memo } from "react";
import type { CommitEdgeData } from "./layoutUtils";
import { GITFLOW_COLORS } from "./layoutUtils";

function getAngledEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  if (Math.abs(sourceX - targetX) < 1) {
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }
  const midY = sourceY + (targetY - sourceY) * 0.5;
  return `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
}

type BranchEdgeProps = EdgeProps<Edge<CommitEdgeData>>;

export const BranchEdge = memo(
  ({ sourceX, sourceY, targetX, targetY, data }: BranchEdgeProps) => {
    const edgePath = getAngledEdgePath(sourceX, sourceY, targetX, targetY);
    const color =
      GITFLOW_COLORS[data?.branchType || "other"] || GITFLOW_COLORS.other;

    return (
      <g>
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeOpacity={0.15}
        />
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeOpacity={0.8}
        />
      </g>
    );
  },
);

BranchEdge.displayName = "BranchEdge";
