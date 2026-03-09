import { Flame, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCommitGraph } from "../../../core/hooks/useCommitGraph";
import type { GitflowBranchType } from "../../../core/lib/branchClassifier";
import { classifyBranch } from "../../../core/lib/branchClassifier";
import { getHeatColor } from "../lib/heatMapUtils";
import {
  BADGE_HEIGHT,
  BADGE_WIDTH,
  computeLayout,
  type LaneLine,
  type PositionedEdge,
  type PositionedNode,
} from "../lib/layoutUtils";
import { CommitBadge } from "./CommitBadge";
import { CommitTooltip } from "./CommitTooltip";
import { HeatMapLegend } from "./HeatMapLegend";
import { LaneHeader } from "./LaneHeader";
import { TopologyEmptyState } from "./TopologyEmptyState";

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

  // Heat map and tooltip state
  const [heatMapEnabled, setHeatMapEnabled] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<PositionedNode | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up hide timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

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

  // Compute timestamp range for heat map coloring
  const { minTs, maxTs } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const n of graphNodes) {
      if (n.timestampMs < min) min = n.timestampMs;
      if (n.timestampMs > max) max = n.timestampMs;
    }
    return {
      minTs: min === Infinity ? 0 : min,
      maxTs: max === -Infinity ? 0 : max,
    };
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
    return <TopologyEmptyState />;
  }

  return (
    <div className="h-full w-full relative bg-ctp-mantle flex flex-col">
      <div className="flex items-center">
        <div className="flex-1">
          <LaneHeader lanes={laneInfo} />
        </div>
        <button
          onClick={() => setHeatMapEnabled((prev) => !prev)}
          aria-label="Toggle heat map"
          aria-pressed={heatMapEnabled}
          className={`mr-3 p-1.5 rounded-md transition-colors ${
            heatMapEnabled
              ? "bg-ctp-surface1 text-ctp-peach"
              : "text-ctp-overlay0 hover:text-ctp-text"
          }`}
        >
          <Flame className="w-4 h-4" />
        </button>
      </div>
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
            {nodes.map((pn: PositionedNode) => {
              const nodeFill = heatMapEnabled
                ? getHeatColor(pn.node.timestampMs, minTs, maxTs)
                : pn.color;
              return (
                <circle
                  key={pn.node.oid}
                  cx={pn.cx}
                  cy={pn.cy}
                  r={pn.r}
                  fill={nodeFill}
                  fillOpacity={0.9}
                  stroke={pn.node.oid === selectedCommit ? "#ffffff" : nodeFill}
                  strokeWidth={pn.node.oid === selectedCommit ? 3 : 1.5}
                  strokeOpacity={pn.node.oid === selectedCommit ? 1 : 0.6}
                  className="cursor-pointer pointer-events-auto"
                  onClick={() => handleNodeClick(pn.node.oid)}
                  onMouseEnter={() => {
                    if (hideTimerRef.current) {
                      clearTimeout(hideTimerRef.current);
                      hideTimerRef.current = null;
                    }
                    setHoveredNode(pn);
                  }}
                  onMouseLeave={() => {
                    hideTimerRef.current = setTimeout(() => {
                      setHoveredNode(null);
                      hideTimerRef.current = null;
                    }, 100);
                  }}
                />
              );
            })}
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

          {/* Hover tooltip for commit nodes */}
          {hoveredNode && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: hoveredNode.cx + hoveredNode.r + 16,
                top: hoveredNode.cy - 20,
              }}
            >
              <CommitTooltip node={hoveredNode.node} />
            </div>
          )}
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

      {/* Heat map legend overlay */}
      {heatMapEnabled && (
        <div className="absolute bottom-3 left-3 z-40">
          <HeatMapLegend minDate={new Date(minTs)} maxDate={new Date(maxTs)} />
        </div>
      )}
    </div>
  );
}
