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

// ── Positioned types ──

export interface PositionedNode {
  node: GraphNode;
  cx: number;
  cy: number;
  r: number;
  color: string;
}

export interface PositionedEdge {
  from: string;
  to: string;
  path: string;
  color: string;
  /** Whether this edge stays in the same lane (straight line) */
  isSameLane: boolean;
}

/** A continuous vertical lane guide line */
export interface LaneLine {
  x: number;
  yStart: number;
  yEnd: number;
  color: string;
}

// ── Layout function ──

export function computeLayout(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
): {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  laneLines: LaneLine[];
  totalHeight: number;
  totalWidth: number;
} {
  if (graphNodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      laneLines: [],
      totalHeight: 0,
      totalWidth: 0,
    };
  }

  // ── Position nodes ──
  const positionedNodes: PositionedNode[] = [];
  const nodeMap = new Map<string, PositionedNode>();
  let currentY = 40;
  let maxColumn = 0;

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

    if (gn.column > maxColumn) maxColumn = gn.column;

    // Spacing to next node
    const nextNode = graphNodes[i + 1];
    if (nextNode) {
      currentY +=
        isHead && nextNode.isHeadAncestor ? MAIN_ROW_HEIGHT : SIDE_ROW_HEIGHT;
    }
  }

  const totalHeight = currentY + 60;
  const totalWidth =
    MAIN_LANE_X + (maxColumn + 1) * LANE_SPACING + BADGE_WIDTH + 20;

  // ── Build lane guide lines ──
  // For each column, find the first and last node and draw a vertical line
  const laneExtents = new Map<
    number,
    { yStart: number; yEnd: number; color: string }
  >();
  for (const pn of positionedNodes) {
    const col = pn.node.column;
    const existing = laneExtents.get(col);
    if (!existing) {
      laneExtents.set(col, { yStart: pn.cy, yEnd: pn.cy, color: pn.color });
    } else {
      existing.yEnd = pn.cy;
    }
  }
  const laneLines: LaneLine[] = [];
  for (const [col, ext] of laneExtents) {
    if (ext.yStart !== ext.yEnd) {
      laneLines.push({
        x: MAIN_LANE_X + col * LANE_SPACING,
        yStart: ext.yStart,
        yEnd: ext.yEnd,
        color: ext.color,
      });
    }
  }

  // ── Position edges ──
  const positionedEdges: PositionedEdge[] = [];
  for (const edge of graphEdges) {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);
    if (!source || !target) continue;

    const isSameLane = source.cx === target.cx;
    let path: string;

    if (isSameLane) {
      // Same lane: straight vertical line
      path = `M ${source.cx},${source.cy} L ${target.cx},${target.cy}`;
    } else {
      // Cross-lane: step path — go down from source, then horizontal, then down to target.
      // The horizontal step happens at the midpoint Y.
      const midY = source.cy + (target.cy - source.cy) * 0.3;
      path = `M ${source.cx},${source.cy} L ${source.cx},${midY} L ${target.cx},${midY} L ${target.cx},${target.cy}`;
    }

    positionedEdges.push({
      from: edge.from,
      to: edge.to,
      path,
      color: source.color,
      isSameLane,
    });
  }

  // Sort: same-lane edges first (behind), cross-lane edges on top
  positionedEdges.sort((a, b) => {
    if (a.isSameLane && !b.isSameLane) return -1;
    if (!a.isSameLane && b.isSameLane) return 1;
    return 0;
  });

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    laneLines,
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
