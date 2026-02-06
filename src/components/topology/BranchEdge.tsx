import {
  BaseEdge,
  type Edge,
  type EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react";
import { memo } from "react";
import type { BranchType } from "../../bindings";
import type { CommitEdgeData } from "./layoutUtils";

// Hex colors for SVG stroke — CSS variables don't reliably resolve in SVG
const EDGE_COLORS: Record<BranchType, string> = {
  main: "#89b4fa", // ctp-blue
  develop: "#a6e3a1", // ctp-green
  feature: "#cba6f7", // ctp-mauve
  release: "#fab387", // ctp-peach
  hotfix: "#f38ba8", // ctp-red
  other: "#6c7086", // ctp-overlay0
};

type BranchEdgeProps = EdgeProps<Edge<CommitEdgeData>>;

export const BranchEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
  }: BranchEdgeProps) => {
    const [edgePath] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
    });

    const color = EDGE_COLORS[data?.branchType || "other"] || EDGE_COLORS.other;

    return (
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: color, strokeWidth: 2, strokeOpacity: 0.7 }}
      />
    );
  },
);

BranchEdge.displayName = "BranchEdge";
