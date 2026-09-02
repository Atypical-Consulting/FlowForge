import type { GraphEdge, GraphNode } from "../../../bindings";
import {
  BRANCH_BADGE_STYLES,
  BRANCH_HEX_COLORS,
  BRANCH_RING_COLORS,
} from "../../../core/lib/branchClassifier";
import { parseConventionalMessage } from "../../conventional-commits/lib/conventional-utils";
import { assignLanes, edgeKey } from "./laneAssignment";

export { BRANCH_BADGE_STYLES, BRANCH_HEX_COLORS, BRANCH_RING_COLORS };

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
/**
 * Vertical distance an edge travels straight out of (or into) a node before
 * it is allowed to curve sideways, so the turn clears the node circle and the
 * badge row instead of cutting under them.
 */
export const EDGE_TURN_OFFSET = BADGE_HEIGHT / 2 + 4;

// ── Positioned types ──

export interface PositionedNode {
  node: GraphNode;
  /** Lane index the commit is drawn in (0 = HEAD ancestry lane) */
  column: number;
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

/** Cubic Bézier between two points, vertical tangent at both ends. */
function verticalCurve(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  return `C ${x1},${midY} ${x2},${midY} ${x2},${y2}`;
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

  const { columns, edgeLanes, laneCount } = assignLanes(graphNodes);
  const laneX = (lane: number) => MAIN_LANE_X + lane * LANE_SPACING;

  // ── Position nodes ──
  const positionedNodes: PositionedNode[] = [];
  const nodeMap = new Map<string, PositionedNode>();
  const rowOf = new Map<string, number>();
  const rowY: number[] = [];
  let currentY = 40;

  for (let i = 0; i < graphNodes.length; i++) {
    const gn = graphNodes[i];
    const isHead = gn.isHeadAncestor;
    const r = isHead ? MAIN_RADIUS : SIDE_RADIUS;
    const column = columns.get(gn.oid) ?? 0;
    const cx = laneX(column);
    const cy = currentY;
    const color = BRANCH_HEX_COLORS[gn.branchType] || BRANCH_HEX_COLORS.other;

    const pn: PositionedNode = { node: gn, column, cx, cy, r, color };
    positionedNodes.push(pn);
    nodeMap.set(gn.oid, pn);
    rowOf.set(gn.oid, i);
    rowY.push(cy);

    // Spacing to next node
    const nextNode = graphNodes[i + 1];
    if (nextNode) {
      currentY +=
        isHead && nextNode.isHeadAncestor ? MAIN_ROW_HEIGHT : SIDE_ROW_HEIGHT;
    }
  }

  const totalHeight = currentY + 60;
  const totalWidth = MAIN_LANE_X + laneCount * LANE_SPACING + BADGE_WIDTH + 20;

  // ── Build lane guide lines ──
  // For each column, find the first and last node and draw a vertical line
  const laneExtents = new Map<
    number,
    { yStart: number; yEnd: number; color: string }
  >();
  for (const pn of positionedNodes) {
    const existing = laneExtents.get(pn.column);
    if (!existing) {
      laneExtents.set(pn.column, {
        yStart: pn.cy,
        yEnd: pn.cy,
        color: pn.color,
      });
    } else {
      existing.yEnd = pn.cy;
    }
  }
  const laneLines: LaneLine[] = [];
  for (const [col, ext] of laneExtents) {
    if (ext.yStart !== ext.yEnd) {
      laneLines.push({
        x: laneX(col),
        yStart: ext.yStart,
        yEnd: ext.yEnd,
        color: ext.color,
      });
    }
  }

  // ── Position edges ──
  // An edge leaves the child straight down, curves into its assigned lane
  // before the next row, runs down that lane (which is guaranteed free of
  // unrelated commits), and curves into the parent right above its row.
  const positionedEdges: PositionedEdge[] = [];
  for (const edge of graphEdges) {
    const source = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);
    if (!source || !target) continue;

    const r1 = rowOf.get(edge.from) as number;
    const r2 = rowOf.get(edge.to) as number;
    if (r2 <= r1) continue;

    const lane = edgeLanes.get(edgeKey(edge.from, edge.to)) ?? target.column;
    const isSameLane = source.column === lane && lane === target.column;
    let path: string;

    if (isSameLane) {
      // Same lane: straight vertical line
      path = `M ${source.cx},${source.cy} L ${target.cx},${target.cy}`;
    } else if (r2 - r1 === 1) {
      // Adjacent rows: a single S-curve between the two nodes
      const exitY = source.cy + EDGE_TURN_OFFSET;
      const entryY = target.cy - EDGE_TURN_OFFSET;
      path = [
        `M ${source.cx},${source.cy}`,
        `L ${source.cx},${exitY}`,
        verticalCurve(source.cx, exitY, target.cx, entryY),
        `L ${target.cx},${target.cy}`,
      ].join(" ");
    } else {
      const x = laneX(lane);
      const parts = [`M ${source.cx},${source.cy}`];
      // Exit the child into the edge's lane before the next row
      const laneStartY = rowY[r1 + 1];
      if (source.column !== lane) {
        const exitY = source.cy + EDGE_TURN_OFFSET;
        parts.push(`L ${source.cx},${exitY}`);
        parts.push(verticalCurve(source.cx, exitY, x, laneStartY));
      }
      // Travel down the lane, then turn into the parent right above its row
      const laneEndY = rowY[r2 - 1];
      if (target.column !== lane) {
        const entryY = target.cy - EDGE_TURN_OFFSET;
        parts.push(`L ${x},${laneEndY}`);
        parts.push(verticalCurve(x, laneEndY, target.cx, entryY));
      }
      parts.push(`L ${target.cx},${target.cy}`);
      path = parts.join(" ");
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
  const parsed = parseConventionalMessage(message);
  return parsed ? parsed.commitType : null;
}
