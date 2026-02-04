import type { Edge, Node } from "@xyflow/react";
import { graphlib } from "dagre-d3-es";
import { layout } from "dagre-d3-es/src/dagre/index.js";
import type { BranchType, GraphEdge, GraphNode } from "../../bindings";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 60;

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
  g.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 80 });

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

// Catppuccin Mocha color mapping
export const GITFLOW_COLORS: Record<BranchType, string> = {
  main: "#fab387", // ctp-peach
  develop: "#a6e3a1", // ctp-green
  feature: "#89b4fa", // ctp-blue
  release: "#cba6f7", // ctp-mauve
  hotfix: "#f38ba8", // ctp-red
  other: "#6c7086", // ctp-overlay0
};

export function getBranchColor(branchType: BranchType): string {
  return GITFLOW_COLORS[branchType] || GITFLOW_COLORS.other;
}
