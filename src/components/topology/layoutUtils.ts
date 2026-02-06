import type { Edge, Node } from "@xyflow/react";
import { graphlib } from "dagre-d3-es";
import { layout } from "dagre-d3-es/src/dagre/index.js";
import type { BranchType, GraphEdge, GraphNode } from "../../bindings";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 40;

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

export function layoutGraph(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
): { nodes: Node<CommitNodeData>[]; edges: Edge<CommitEdgeData>[] } {
  const g = new graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 60 });

  // Add nodes to graph
  graphNodes.forEach((node) => {
    g.setNode(node.oid, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Add edges to graph
  graphEdges.forEach((edge) => {
    g.setEdge(edge.from, edge.to);
  });

  // Run layout
  layout(g, undefined);

  // Convert to React Flow format
  const nodes: Node<CommitNodeData>[] = graphNodes.map((node) => {
    const dagreNode = g.node(node.oid);
    return {
      id: node.oid,
      type: "commit",
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - NODE_HEIGHT / 2,
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
    };
  });

  const edges: Edge<CommitEdgeData>[] = graphEdges.map((edge, i) => {
    // Find source node to get branch type for coloring
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
