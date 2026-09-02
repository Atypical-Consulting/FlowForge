import type { GraphNode } from "../../../bindings";

/**
 * Result of the lane (column) assignment for a commit graph.
 */
export interface LaneAssignment {
  /** Commit OID -> lane index (0 = leftmost). */
  columns: Map<string, number>;
  /**
   * `edgeKey(child, parent)` -> lane in which the edge travels downward
   * between the child's row and the parent's row. The edge leaves the child
   * into this lane right below the child's row and turns into the parent's
   * lane right above the parent's row.
   */
  edgeLanes: Map<string, number>;
  /** Number of lanes used by the layout. */
  laneCount: number;
}

/** Stable key identifying the child -> parent edge in `edgeLanes`. */
export function edgeKey(from: string, to: string): string {
  return `${from}->${to}`;
}

/**
 * Assign a lane to every commit and to every child -> parent edge.
 *
 * `nodes` must be in topological order (every commit before its parents),
 * one commit per row. The algorithm keeps the set of *active* lanes: a lane
 * is active from the row of a child down to the row of the parent its edge
 * is travelling towards. A commit may only be placed in a lane that is free
 * at its row (or in the lane of an edge that ends at it), so an edge never
 * runs through a commit it is not connected to.
 *
 * Rules:
 * - HEAD's first-parent chain always stays in lane 0 (reserved up front).
 * - A commit takes the lane of the edge(s) reaching it, or the leftmost free
 *   lane when nothing points at it yet (a branch tip).
 * - The first-parent edge of a commit continues straight down in the
 *   commit's own lane when that lane is free below it.
 * - An edge towards a parent that already has an active lane joins that lane
 *   instead of reserving a new one; other edges take the leftmost free lane.
 * - Lanes are released at the parent's row, so they can be reused below.
 */
export function assignLanes(nodes: GraphNode[]): LaneAssignment {
  const columns = new Map<string, number>();
  const edgeLanes = new Map<string, number>();

  // active[lane] = OID of the parent the edge occupying that lane is heading
  // to, or null when the lane is free at the current row.
  const active: (string | null)[] = [];

  const firstFreeLane = (): number => {
    const free = active.indexOf(null);
    if (free >= 0) return free;
    active.push(null);
    return active.length - 1;
  };

  // Reserve lane 0 for HEAD's first-parent chain before anything else can
  // grab it (a newer branch tip may be listed above HEAD).
  const firstHeadAncestor = nodes.find((n) => n.isHeadAncestor);
  if (firstHeadAncestor) {
    active[0] = firstHeadAncestor.oid;
  }

  for (const node of nodes) {
    // 1. Every edge heading to this commit ends here: release its lane.
    const incoming: number[] = [];
    for (let lane = 0; lane < active.length; lane++) {
      if (active[lane] === node.oid) {
        active[lane] = null;
        incoming.push(lane);
      }
    }

    // 2. Place the commit.
    let column: number;
    if (node.isHeadAncestor) {
      column = 0;
    } else if (incoming.length > 0) {
      column = incoming[0];
    } else {
      column = firstFreeLane();
    }
    columns.set(node.oid, column);

    // 3. Reserve a lane for each edge towards a parent.
    node.parents.forEach((parent, index) => {
      const key = edgeKey(node.oid, parent);
      if (edgeLanes.has(key)) return;

      let lane: number;
      if (node.isHeadAncestor && index === 0) {
        // HEAD chain: keep going straight down lane 0.
        lane = 0;
        active[0] = parent;
      } else {
        const existing = active.indexOf(parent);
        if (existing >= 0) {
          lane = existing;
        } else {
          lane =
            index === 0 && active[column] === null ? column : firstFreeLane();
          active[lane] = parent;
        }
      }
      edgeLanes.set(key, lane);
    });
  }

  return { columns, edgeLanes, laneCount: Math.max(active.length, 1) };
}
