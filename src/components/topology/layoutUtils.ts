import * as Dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { GraphNode, GraphEdge, BranchType } from "../../bindings";

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
}

export function layoutGraph(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
): { nodes: Node<CommitNodeData>[]; edges: Edge<CommitEdgeData>[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 80 });

  // Add nodes to dagre
  graphNodes.forEach((node) => {
    g.setNode(node.oid, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Add edges to dagre
  graphEdges.forEach((edge) => {
    g.setEdge(edge.from, edge.to);
  });

  // Run layout
  Dagre.layout(g);

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

// Gitflow color mapping (per success criteria)
export const GITFLOW_COLORS: Record<BranchType, string> = {
  main: "#f97316", // orange-500 (red/orange per success criteria)
  develop: "#22c55e", // green-500 (blue/green per success criteria)
  feature: "#3b82f6", // blue-500
  release: "#a855f7", // purple-500
  hotfix: "#ef4444", // red-500
  other: "#6b7280", // gray-500
};

export function getBranchColor(branchType: BranchType): string {
  return GITFLOW_COLORS[branchType] || GITFLOW_COLORS.other;
}
