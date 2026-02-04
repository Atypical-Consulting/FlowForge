import { type Edge, type EdgeProps, getSmoothStepPath } from "@xyflow/react";
import { motion } from "framer-motion";
import { memo } from "react";
import type { CommitEdgeData } from "./layoutUtils";

// Catppuccin Mocha branch colors for edges using CSS variables
const BRANCH_EDGE_COLORS: Record<string, string> = {
  main: "var(--ctp-peach)",
  develop: "var(--ctp-green)",
  feature: "var(--ctp-blue)",
  release: "var(--ctp-mauve)",
  hotfix: "var(--ctp-red)",
  other: "var(--ctp-overlay0)",
};

type CommitEdgeProps = EdgeProps<Edge<CommitEdgeData>> & {
  data?: CommitEdgeData & {
    index?: number;
  };
};

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
      borderRadius: 8,
    });

    const color =
      BRANCH_EDGE_COLORS[data?.branchType || "other"] ||
      BRANCH_EDGE_COLORS.other;

    // Stagger animation based on edge index
    const delay = (data?.index ?? 0) * 0.02;

    return (
      <g>
        {/* Background path for glow effect */}
        <motion.path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeOpacity={0.2}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: 0.4,
            delay,
            ease: "easeOut",
          }}
        />
        {/* Main edge path */}
        <motion.path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: 0.4,
            delay,
            ease: "easeOut",
          }}
        />
      </g>
    );
  },
);

CommitEdge.displayName = "CommitEdge";
