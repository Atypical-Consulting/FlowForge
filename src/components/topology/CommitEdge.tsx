import { memo } from "react";
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { getBranchColor } from "./layoutUtils";
import type { CommitEdgeData } from "./layoutUtils";

type CommitEdgeProps = EdgeProps<Edge<CommitEdgeData>>;

export const CommitEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
  }: CommitEdgeProps) => {
    const [edgePath] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    const color = getBranchColor(data?.branchType || "other");

    return (
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: color, strokeWidth: 2 }}
      />
    );
  },
);

CommitEdge.displayName = "CommitEdge";
