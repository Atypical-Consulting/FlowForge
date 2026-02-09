import { useCallback, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useCommitGraph } from "../../../hooks/useCommitGraph";
import { classifyBranch } from "../../../lib/branchClassifier";
import type { GitflowBranchType } from "../../../lib/branchClassifier";
import { LaneHeader } from "./LaneHeader";
import { CommitBadge } from "./CommitBadge";
import {
  BADGE_HEIGHT,
  BADGE_WIDTH,
  type LaneLine,
  type PositionedEdge,
  type PositionedNode,
  computeLayout,
} from "./layoutUtils";

interface TopologyPanelProps {
  onCommitSelect?: (oid: string) => void;
}

export function TopologyPanel({ onCommitSelect }: TopologyPanelProps) {
  const {
    nodes: graphNodes,
    edges: graphEdges,
    isLoading,
    error,
    hasMore,
    selectedCommit,
    selectCommit,
    loadMore,
  } = useCommitGraph();

  const containerRef = useRef<HTMLDivElement>(null);

  // Compute layout
  const { nodes, edges, laneLines, totalHeight, totalWidth } = useMemo(
    () => computeLayout(graphNodes, graphEdges),
    [graphNodes, graphEdges],
  );

  // Extract unique branch lanes for header
  const laneInfo = useMemo(() => {
    const seen = new Map<
      string,
      {
        column: number;
        branchName: string;
        branchType: GitflowBranchType;
      }
    >();
    for (const gn of graphNodes) {
      for (const name of gn.branchNames) {
        if (!seen.has(name)) {
          seen.set(name, {
            column: gn.column,
            branchName: name,
            branchType: classifyBranch(name),
          });
        }
      }
    }
    return Array.from(seen.values());
  }, [graphNodes]);

  const handleNodeClick = useCallback(
    (oid: string) => {
      selectCommit(oid);
      onCommitSelect?.(oid);
    },
    [selectCommit, onCommitSelect],
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-ctp-mantle text-ctp-red p-4">
        <div className="text-center">
          <p className="font-medium">Error loading commit graph</p>
          <p className="text-sm text-ctp-subtext0 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading && nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-ctp-mantle">
        <Loader2 className="h-8 w-8 animate-spin text-ctp-overlay0" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-ctp-mantle text-ctp-overlay0">
        <p>No commits to display</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative bg-ctp-mantle flex flex-col">
      <LaneHeader lanes={laneInfo} />
      <div className="flex-1 min-h-0 overflow-auto" ref={containerRef}>
        <div
          className="relative"
          style={{ width: totalWidth, height: totalHeight, minWidth: "100%" }}
        >
          {/* SVG layer: lane lines, edges, and node circles */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={totalWidth}
            height={totalHeight}
          >
            {/* Lane guide lines (continuous vertical stripes) */}
            {laneLines.map((lane: LaneLine) => (
              <line
                key={`lane-${lane.x}`}
                x1={lane.x}
                y1={lane.yStart}
                x2={lane.x}
                y2={lane.yEnd}
                stroke={lane.color}
                strokeWidth={2}
                strokeOpacity={0.12}
              />
            ))}
            {/* Edges (sorted: same-lane behind, cross-lane on top) */}
            {edges.map((edge: PositionedEdge) => (
              <path
                key={`${edge.from}-${edge.to}`}
                d={edge.path}
                stroke={edge.color}
                strokeWidth={edge.isSameLane ? 2.5 : 2}
                strokeOpacity={edge.isSameLane ? 0.5 : 0.35}
                fill="none"
              />
            ))}
            {/* Node circles */}
            {nodes.map((pn: PositionedNode) => (
              <circle
                key={pn.node.oid}
                cx={pn.cx}
                cy={pn.cy}
                r={pn.r}
                fill={pn.color}
                fillOpacity={0.9}
                stroke={pn.node.oid === selectedCommit ? "#ffffff" : pn.color}
                strokeWidth={pn.node.oid === selectedCommit ? 3 : 1.5}
                strokeOpacity={pn.node.oid === selectedCommit ? 1 : 0.6}
                className="cursor-pointer pointer-events-auto"
                onClick={() => handleNodeClick(pn.node.oid)}
              />
            ))}
          </svg>

          {/* DOM layer: commit badges */}
          {nodes.map((pn: PositionedNode) => (
            <div
              key={`badge-${pn.node.oid}`}
              className="absolute pointer-events-auto"
              style={{
                left: pn.cx + pn.r + 12,
                top: pn.cy - BADGE_HEIGHT / 2,
                width: BADGE_WIDTH,
                height: BADGE_HEIGHT,
              }}
            >
              <CommitBadge
                node={pn.node}
                isSelected={pn.node.oid === selectedCommit}
                onClick={() => handleNodeClick(pn.node.oid)}
              />
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="flex justify-center py-4">
            <button
              onClick={loadMore}
              disabled={isLoading}
              className="px-4 py-2 bg-ctp-blue text-ctp-base rounded-md hover:bg-ctp-blue/90 disabled:opacity-50 font-medium transition-colors"
            >
              {isLoading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
