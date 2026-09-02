import { describe, expect, it } from "vitest";
import type { GraphNode } from "../../../bindings";
import {
  assignLanes,
  edgeKey,
  type LaneAssignment,
} from "../lib/laneAssignment";
import {
  computeLayout,
  EDGE_TURN_OFFSET,
  LANE_SPACING,
  MAIN_LANE_X,
} from "../lib/layoutUtils";

// ── Fixtures ──

function commit(
  oid: string,
  parents: string[],
  isHeadAncestor: boolean,
  ideologicalBranch = "main",
  branchNames: string[] = [],
): GraphNode {
  return {
    oid,
    shortOid: oid.slice(0, 7),
    message: `commit ${oid}`,
    author: "Test",
    timestampMs: 0,
    parents,
    branchType: "other",
    branchNames,
    isHeadAncestor,
    ideologicalBranch,
  };
}

/**
 * The ff-testrepo topology (HEAD = develop), as shown by `git log --graph`:
 *
 *   * 395b3ac (develop)
 *   * c4a8f2e
 *   | * f5514ca (main)            parents: 639b5bc + 56ebdcd
 *   | | * ee24470 (feature/search)
 *   | |/
 *   * | 56ebdcd Merge feature/login into develop   parents: 2927075 + 42a4eac
 *   |\ \
 *   | * | 42a4eac (feature/login)
 *   | * | faea265
 *   |/ /
 *   * / 2927075
 *   ...
 *   * 639b5bc (initial)
 */
function testRepoGraphLog(): GraphNode[] {
  return [
    commit("395b3ac", ["c4a8f2e"], true, "develop", ["develop"]),
    commit("c4a8f2e", ["56ebdcd"], true, "develop"),
    commit("f5514ca", ["639b5bc", "56ebdcd"], false, "main", ["main"]),
    commit("ee24470", ["2927075"], false, "feature/search", ["feature/search"]),
    commit("56ebdcd", ["2927075", "42a4eac"], true, "develop"),
    commit("42a4eac", ["faea265"], false, "feature/login", ["feature/login"]),
    commit("faea265", ["2927075"], false, "feature/login"),
    commit("2927075", ["6d3117b"], true, "develop"),
    commit("6d3117b", ["5e056ac"], true, "develop"),
    commit("5e056ac", ["a235aa6"], true, "develop"),
    commit("a235aa6", ["79590e7"], true, "develop"),
    commit("79590e7", ["9790c69"], true, "develop"),
    commit("9790c69", ["8a499d1"], true, "develop"),
    commit("8a499d1", ["34b9edc"], true, "develop"),
    commit("34b9edc", ["639b5bc"], true, "develop"),
    commit("639b5bc", [], true, "develop"),
  ];
}

/** Same repository in the order the backend revwalk emits it (date-order). */
function testRepoDateOrder(): GraphNode[] {
  const byOid = new Map(testRepoGraphLog().map((n) => [n.oid, n]));
  const order = [
    "395b3ac",
    "ee24470",
    "f5514ca",
    "c4a8f2e",
    "56ebdcd",
    "42a4eac",
    "faea265",
    "2927075",
    "6d3117b",
    "5e056ac",
    "a235aa6",
    "79590e7",
    "9790c69",
    "8a499d1",
    "34b9edc",
    "639b5bc",
  ];
  return order.map((oid) => {
    const node = byOid.get(oid);
    if (!node) throw new Error(`missing fixture commit ${oid}`);
    return node;
  });
}

// ── Invariant helpers ──

/**
 * For every edge (child row r1, parent row r2, lane L), no commit strictly
 * between r1 and r2 may sit in lane L: an edge must never run through a
 * commit it is not connected to.
 */
function expectNoEdgeThroughUnrelatedNode(
  nodes: GraphNode[],
  { columns, edgeLanes }: LaneAssignment,
) {
  const rowOf = new Map(nodes.map((n, i) => [n.oid, i]));
  for (const node of nodes) {
    expect(columns.has(node.oid), `no lane for ${node.oid}`).toBe(true);
    for (const parent of node.parents) {
      const r1 = rowOf.get(node.oid) as number;
      const r2 = rowOf.get(parent);
      if (r2 === undefined) continue;
      expect(r2, `${parent} must be listed after its child ${node.oid}`).toBe(
        Math.max(r1 + 1, r2),
      );
      const lane = edgeLanes.get(edgeKey(node.oid, parent));
      expect(lane, `no lane for edge ${node.oid}->${parent}`).toBeDefined();
      for (let row = r1 + 1; row < r2; row++) {
        const crossed = nodes[row];
        expect(
          columns.get(crossed.oid),
          `edge ${node.oid}->${parent} (lane ${lane}) runs through ${crossed.oid} at row ${row}`,
        ).not.toBe(lane);
      }
    }
  }
}

function expectHeadChainInLaneZero(
  nodes: GraphNode[],
  { columns }: LaneAssignment,
) {
  for (const node of nodes) {
    if (node.isHeadAncestor) {
      expect(columns.get(node.oid), `${node.oid} is a HEAD ancestor`).toBe(0);
    }
  }
}

/** Tiny deterministic PRNG so the fuzz test is reproducible. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Random DAG in topological order (parents always after children). */
function randomGraph(seed: number, size: number): GraphNode[] {
  const rand = lcg(seed);
  const oids = Array.from({ length: size }, (_, i) => `c${i}`);
  const parents: string[][] = oids.map((_, i) => {
    const remaining = size - i - 1;
    if (remaining === 0) return [];
    const first = i + 1 + Math.floor(rand() * Math.min(remaining, 4));
    const list = [oids[first]];
    if (remaining > 1 && rand() < 0.3) {
      const second = i + 1 + Math.floor(rand() * remaining);
      if (second !== first) list.push(oids[second]);
    }
    return list;
  });
  // HEAD = c0; its first-parent chain is the head ancestry.
  const head = new Set<string>();
  let current: string | undefined = oids[0];
  while (current !== undefined) {
    head.add(current);
    current = parents[oids.indexOf(current)][0];
  }
  return oids.map((oid, i) => commit(oid, parents[i], head.has(oid)));
}

// ── Tests ──

describe("assignLanes", () => {
  it("returns an empty assignment for an empty graph", () => {
    const result = assignLanes([]);
    expect(result.columns.size).toBe(0);
    expect(result.edgeLanes.size).toBe(0);
  });

  it("keeps a linear history in a single lane", () => {
    const nodes = [
      commit("c", ["b"], true),
      commit("b", ["a"], true),
      commit("a", [], true),
    ];
    const result = assignLanes(nodes);
    expect([...result.columns.values()]).toEqual([0, 0, 0]);
    expect(result.edgeLanes.get(edgeKey("c", "b"))).toBe(0);
    expect(result.edgeLanes.get(edgeKey("b", "a"))).toBe(0);
    expect(result.laneCount).toBe(1);
  });

  it("puts a merged feature branch in its own lane next to HEAD", () => {
    const nodes = [
      commit("merge", ["base2", "f2"], true),
      commit("f2", ["f1"], false, "feature/x"),
      commit("f1", ["base"], false, "feature/x"),
      commit("base2", ["base"], true),
      commit("base", [], true),
    ];
    const result = assignLanes(nodes);
    expect(result.columns.get("merge")).toBe(0);
    expect(result.columns.get("f2")).toBe(1);
    expect(result.columns.get("f1")).toBe(1);
    expect(result.columns.get("base")).toBe(0);
    // Second-parent edge branches out into the feature lane.
    expect(result.edgeLanes.get(edgeKey("merge", "f2"))).toBe(1);
    // The feature lane keeps running until it joins `base`, even though
    // `base2` (lane 0) sits in between.
    expect(result.edgeLanes.get(edgeKey("f1", "base"))).toBe(1);
    expectNoEdgeThroughUnrelatedNode(nodes, result);
  });

  it("reproduces the ff-testrepo topology without running main's edge through feature/login", () => {
    const nodes = testRepoGraphLog();
    const result = assignLanes(nodes);

    expectHeadChainInLaneZero(nodes, result);
    expectNoEdgeThroughUnrelatedNode(nodes, result);

    // The regression: main's first-parent edge (f5514ca -> initial commit)
    // spans the rows of 42a4eac / faea265, so they must not share its lane.
    const mainEdgeLane = result.edgeLanes.get(edgeKey("f5514ca", "639b5bc"));
    expect(mainEdgeLane).toBe(result.columns.get("f5514ca"));
    expect(result.columns.get("42a4eac")).not.toBe(mainEdgeLane);
    expect(result.columns.get("faea265")).not.toBe(mainEdgeLane);
    // feature/login stays in one lane.
    expect(result.columns.get("42a4eac")).toBe(result.columns.get("faea265"));
    expect(result.columns.get("42a4eac")).toBe(
      result.edgeLanes.get(edgeKey("56ebdcd", "42a4eac")),
    );
  });

  it("handles the backend's date-order listing of the same repository", () => {
    const nodes = testRepoDateOrder();
    const result = assignLanes(nodes);
    expectHeadChainInLaneZero(nodes, result);
    expectNoEdgeThroughUnrelatedNode(nodes, result);
  });

  it("reserves lane 0 for HEAD even when a newer branch tip is listed first", () => {
    const nodes = [
      commit("tip", ["base"], false, "feature/x"),
      commit("head", ["base"], true),
      commit("base", [], true),
    ];
    const result = assignLanes(nodes);
    expect(result.columns.get("tip")).toBe(1);
    expect(result.columns.get("head")).toBe(0);
    expect(result.columns.get("base")).toBe(0);
    expectNoEdgeThroughUnrelatedNode(nodes, result);
  });

  it("works without any HEAD ancestor (detached or unborn HEAD)", () => {
    const nodes = [
      commit("b", ["a"], false, "other"),
      commit("x", ["a"], false, "other"),
      commit("a", [], false, "other"),
    ];
    const result = assignLanes(nodes);
    expect(result.columns.get("b")).toBe(0);
    expect(result.columns.get("x")).toBe(1);
    expect(result.columns.get("a")).toBe(0);
    expectNoEdgeThroughUnrelatedNode(nodes, result);
  });

  it("never runs an edge through an unrelated commit on random graphs", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const nodes = randomGraph(seed, 12 + (seed % 20));
      const result = assignLanes(nodes);
      expectHeadChainInLaneZero(nodes, result);
      expectNoEdgeThroughUnrelatedNode(nodes, result);
    }
  });
});

describe("computeLayout edges", () => {
  const laneX = (lane: number) => MAIN_LANE_X + lane * LANE_SPACING;

  it("positions nodes on the assigned lanes", () => {
    const nodes = testRepoGraphLog();
    const edges = nodes.flatMap((n) =>
      n.parents.map((p) => ({ from: n.oid, to: p })),
    );
    const { nodes: positioned } = computeLayout(nodes, edges);
    const { columns } = assignLanes(nodes);
    for (const pn of positioned) {
      expect(pn.column).toBe(columns.get(pn.node.oid));
      expect(pn.cx).toBe(laneX(pn.column));
    }
  });

  it("draws same-lane edges as straight vertical lines", () => {
    const nodes = testRepoGraphLog();
    const edges = [{ from: "c4a8f2e", to: "56ebdcd" }];
    const { edges: positioned } = computeLayout(nodes, edges);
    expect(positioned).toHaveLength(1);
    expect(positioned[0].isSameLane).toBe(true);
    expect(positioned[0].path).toMatch(/^M [\d.]+,[\d.]+ L [\d.]+,[\d.]+$/);
  });

  it("leaves and enters nodes vertically on cross-lane edges", () => {
    const nodes = testRepoGraphLog();
    const edges = [
      // merge -> second parent, one row apart
      { from: "56ebdcd", to: "42a4eac" },
      // main -> initial commit, many rows apart, turns into lane 0 at the end
      { from: "f5514ca", to: "639b5bc" },
    ];
    const { edges: positioned, nodes: positionedNodes } = computeLayout(
      nodes,
      edges,
    );
    const at = (oid: string) => {
      const pn = positionedNodes.find((n) => n.node.oid === oid);
      if (!pn) throw new Error(`missing ${oid}`);
      return pn;
    };

    for (const edge of positioned) {
      expect(edge.isSameLane).toBe(false);
      const source = at(edge.from);
      const target = at(edge.to);
      // Exit: leave the node straight down.
      expect(
        edge.path.startsWith(`M ${source.cx},${source.cy} L ${source.cx},`),
      ).toBe(true);
      // Entry: arrive straight down into the target centre, past its badge row.
      expect(
        edge.path.endsWith(
          `${target.cx},${target.cy - EDGE_TURN_OFFSET} L ${target.cx},${target.cy}`,
        ),
      ).toBe(true);
      // No hard right angles: only cubic curves besides the vertical lines.
      expect(edge.path).toContain(" C ");
      expect(edge.path).not.toMatch(/L [\d.]+,([\d.]+) L [\d.]+,\1\b/);
    }

    // The merge edge changes lane right away: it must clear the badge row
    // before curving, instead of turning at the node's own row.
    const mergeEdge = positioned.find((e) => e.from === "56ebdcd");
    if (!mergeEdge) throw new Error("merge edge missing");
    const merge = at("56ebdcd");
    expect(
      mergeEdge.path.startsWith(
        `M ${merge.cx},${merge.cy} L ${merge.cx},${merge.cy + EDGE_TURN_OFFSET} C `,
      ),
    ).toBe(true);

    // The long main edge travels in its own lane and only leaves it at the end.
    const mainEdge = positioned.find((e) => e.from === "f5514ca");
    if (!mainEdge) throw new Error("main edge missing");
    const main = at("f5514ca");
    const initial = at("639b5bc");
    const login = at("42a4eac");
    expect(mainEdge.path).toContain(
      `L ${main.cx},${positionedNodes[positionedNodes.indexOf(initial) - 1].cy}`,
    );
    expect(main.cx).not.toBe(login.cx);
  });
});
