import type { Edge, Node } from "@xyflow/react";
import type { BranchType, GraphEdge, GraphNode } from "../../bindings";

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 40;
const LANE_WIDTH = 280; // horizontal spacing between lane centers
const ROW_HEIGHT = 70; // vertical spacing between commit rows

export interface CommitNodeData extends Record<string, unknown> {
  oid: string;
  shortOid: string;
  message: string;
  author: string;
  timestampMs: number;
  parents: string[];
  branchType: BranchType;
  column: number;
  branchNames: string[];
  isSelected?: boolean;
  onSelect?: (oid: string) => void;
}

export interface CommitEdgeData extends Record<string, unknown> {
  branchType: BranchType;
  index?: number;
}

/**
 * Layout commit graph using lane-based positioning.
 *
 * X position: determined by the commit's `column` (lane) from the backend.
 * Y position: determined by topological order (array index) — commits come
 *             pre-sorted from the backend revwalk (TOPOLOGICAL | TIME).
 *
 * This produces a clean git-graph style layout where each branch stays in
 * its own vertical lane, unlike dagre which optimizes for generic DAG layout.
 */
export function layoutGraph(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
): { nodes: Node<CommitNodeData>[]; edges: Edge<CommitEdgeData>[] } {
  // Build a set of visible node OIDs for fast lookup
  const visibleOids = new Set(graphNodes.map((n) => n.oid));

  // Position nodes: column → x, row index → y
  const nodes: Node<CommitNodeData>[] = graphNodes.map((node, index) => ({
    id: node.oid,
    type: "commit",
    position: {
      x: node.column * LANE_WIDTH,
      y: index * ROW_HEIGHT,
    },
    data: {
      oid: node.oid,
      shortOid: node.shortOid,
      message: node.message,
      author: node.author,
      timestampMs: node.timestampMs,
      parents: node.parents,
      branchType: node.branchType,
      column: node.column,
      branchNames: node.branchNames,
    },
  }));

  // Filter edges: only include edges where BOTH source and target exist
  const validEdges = graphEdges.filter(
    (edge) => visibleOids.has(edge.from) && visibleOids.has(edge.to),
  );

  const edges: Edge<CommitEdgeData>[] = validEdges.map((edge, i) => {
    const sourceNode = graphNodes.find((n) => n.oid === edge.from);
    return {
      id: `e-${i}`,
      source: edge.from,
      target: edge.to,
      type: "gitflow",
      data: {
        branchType: sourceNode?.branchType || "other",
      },
    };
  });

  return { nodes, edges };
}

// Catppuccin Mocha color mapping using CSS variables
export const GITFLOW_COLORS: Record<BranchType, string> = {
  main: "var(--ctp-blue)",
  develop: "var(--ctp-green)",
  feature: "var(--ctp-mauve)",
  release: "var(--ctp-peach)",
  hotfix: "var(--ctp-red)",
  other: "var(--ctp-overlay0)",
};

export function getBranchColor(branchType: BranchType): string {
  return GITFLOW_COLORS[branchType] || GITFLOW_COLORS.other;
}

export const BRANCH_BADGE_STYLES: Record<BranchType, string> = {
  main: "border-ctp-blue bg-ctp-blue/10 hover:bg-ctp-blue/20",
  develop: "border-ctp-green bg-ctp-green/10 hover:bg-ctp-green/20",
  feature: "border-ctp-mauve bg-ctp-mauve/10 hover:bg-ctp-mauve/20",
  release: "border-ctp-peach bg-ctp-peach/10 hover:bg-ctp-peach/20",
  hotfix: "border-ctp-red bg-ctp-red/10 hover:bg-ctp-red/20",
  other: "border-ctp-overlay0 bg-ctp-surface0/50 hover:bg-ctp-surface1/50",
};

export const BRANCH_RING_COLORS: Record<BranchType, string> = {
  main: "ring-ctp-blue",
  develop: "ring-ctp-green",
  feature: "ring-ctp-mauve",
  release: "ring-ctp-peach",
  hotfix: "ring-ctp-red",
  other: "ring-ctp-overlay0",
};

export const BRANCH_LANE_BG: Record<BranchType, string> = {
  main: "bg-ctp-blue/5",
  develop: "bg-ctp-green/5",
  feature: "bg-ctp-mauve/5",
  release: "bg-ctp-peach/5",
  hotfix: "bg-ctp-red/5",
  other: "bg-ctp-overlay0/5",
};

export function parseConventionalType(message: string): string | null {
  const match = message.match(
    /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+?\))?(!)?:/,
  );
  return match ? match[1] : null;
}
