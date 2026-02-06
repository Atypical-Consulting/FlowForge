import type { BranchType, GraphEdge, GraphNode } from "../../bindings";

// ── Layout constants (Ungit-inspired) ──

/** X position of the main (HEAD ancestry) lane */
export const MAIN_LANE_X = 60;
/** Horizontal spacing between branch lanes */
export const LANE_SPACING = 90;
/** Vertical spacing between consecutive HEAD-ancestor commits */
export const MAIN_ROW_HEIGHT = 90;
/** Vertical spacing between side-branch or mixed commits */
export const SIDE_ROW_HEIGHT = 60;
/** Circle radius for HEAD-ancestor commits */
export const MAIN_RADIUS = 12;
/** Circle radius for side-branch commits */
export const SIDE_RADIUS = 8;
/** Width of commit detail badge (DOM overlay) */
export const BADGE_WIDTH = 240;
/** Height of commit detail badge (DOM overlay) */
export const BADGE_HEIGHT = 32;

// ── Color mapping ──

/** Catppuccin Mocha hex colors for SVG rendering */
export const BRANCH_HEX_COLORS: Record<BranchType, string> = {
  main: "#89b4fa",
  develop: "#a6e3a1",
  feature: "#cba6f7",
  release: "#fab387",
  hotfix: "#f38ba8",
  other: "#6c7086",
};

/** Tailwind-compatible CSS color classes per branch type */
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

// ── Positioned node type ──

export interface PositionedNode {
  /** Original graph node data */
  node: GraphNode;
  /** Center X of the circle */
  cx: number;
  /** Center Y of the circle */
  cy: number;
  /** Circle radius */
  r: number;
  /** Hex color for SVG fill/stroke */
  color: string;
}

export interface PositionedEdge {
  /** Source node OID (child) */
  from: string;
  /** Target node OID (parent) */
  to: string;
  /** SVG path data (M...L) */
  path: string;
  /** Hex color for SVG stroke */
  color: string;
}

// ── Layout function ──

/**
 * Compute positioned nodes and edges for SVG rendering.
 *
 * Uses Ungit-style layout:
 * - HEAD-ancestor nodes are large, in column 0, with wider spacing
 * - Side-branch nodes are smaller, offset right, with tighter spacing
 * - Edges are straight lines between node centers
 */
export function computeLayout(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
): {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  totalHeight: number;
  totalWidth: number;
} {
  if (graphNodes.length === 0) {
    return { nodes: [], edges: [], totalHeight: 0, totalWidth: 0 };
  }

  // Position nodes
  const positionedNodes: PositionedNode[] = [];
  const nodeMap = new Map<string, PositionedNode>();
  let currentY = 40; // Start 40px from top
  let maxX = 0;

  for (let i = 0; i < graphNodes.length; i++) {
    const gn = graphNodes[i];
    const isHead = gn.isHeadAncestor;
    const r = isHead ? MAIN_RADIUS : SIDE_RADIUS;
    const cx = MAIN_LANE_X + gn.column * LANE_SPACING;
    const cy = currentY;
    const color = BRANCH_HEX_COLORS[gn.branchType] || BRANCH_HEX_COLORS.other;

    const pn: PositionedNode = { node: gn, cx, cy, r, color };
    positionedNodes.push(pn);
    nodeMap.set(gn.oid, pn);

    if (cx > maxX) maxX = cx;

    // Determine spacing to next node
    const nextNode = graphNodes[i + 1];
    if (nextNode) {
      const nextIsHead = nextNode.isHeadAncestor;
      // Use larger spacing when both are on the main line
      if (isHead && nextIsHead) {
        currentY += MAIN_ROW_HEIGHT;
      } else {
        currentY += SIDE_ROW_HEIGHT;
      }
    }
  }

  const totalHeight = currentY + 60;
  const totalWidth = maxX + LANE_SPACING + BADGE_WIDTH + 20;

  // Build visible OID set
  const visibleOids = new Set(graphNodes.map((n) => n.oid));

  // Position edges as straight lines
  const positionedEdges: PositionedEdge[] = [];
  for (const edge of graphEdges) {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);
    if (!source || !target) continue; // Skip edges to nodes outside visible set
    if (!visibleOids.has(edge.from) || !visibleOids.has(edge.to)) continue;

    const path = `M ${source.cx},${source.cy} L ${target.cx},${target.cy}`;
    const color = source.color;

    positionedEdges.push({ from: edge.from, to: edge.to, path, color });
  }

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    totalHeight,
    totalWidth,
  };
}

export function parseConventionalType(message: string): string | null {
  const match = message.match(
    /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+?\))?(!)?:/,
  );
  return match ? match[1] : null;
}
