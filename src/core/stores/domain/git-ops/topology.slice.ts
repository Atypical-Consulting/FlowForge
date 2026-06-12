import type { StateCreator } from "zustand";
import type { GraphEdge, GraphNode } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import type { GitOpsStore } from "./index";
import type { GitOpsMiddleware } from "./types";

const INITIAL_LIMIT = 100;
const LOAD_MORE_AMOUNT = 50;

// Monotonic token guarding against stale async results. Any operation that
// resets/replaces the graph (resetTopology, loadGraph) bumps this token; an
// in-flight load captures the token before awaiting and discards its result if
// the token changed while it was suspended, preventing stale-data clobbering.
let topologyLoadToken = 0;

export interface TopologySlice {
  nodes: GraphNode[];
  edges: GraphEdge[];
  topologySelectedCommit: string | null;
  topologyIsLoading: boolean;
  topologyError: string | null;
  topologyHasMore: boolean;
  topologyLastRefresh: number;
  topologyCurrentOffset: number;

  loadGraph: () => Promise<void>;
  loadMore: () => Promise<void>;
  selectCommit: (oid: string | null) => void;
  resetTopology: () => void;
  clearTopologyError: () => void;
}

export const createTopologySlice: StateCreator<
  GitOpsStore,
  GitOpsMiddleware,
  [],
  TopologySlice
> = (set, get) => ({
  nodes: [],
  edges: [],
  topologySelectedCommit: null,
  topologyIsLoading: false,
  topologyError: null,
  topologyHasMore: true,
  topologyLastRefresh: 0,
  topologyCurrentOffset: 0,

  loadGraph: async () => {
    // A fresh full load supersedes any in-flight load (including loadMore).
    const myToken = ++topologyLoadToken;
    set(
      { topologyIsLoading: true, topologyError: null },
      undefined,
      "gitOps:topology/load",
    );
    try {
      const result = await commands.getCommitGraph(INITIAL_LIMIT, 0);
      // Discard if a reset (unmount/repo switch/close) or another load ran
      // while this request was pending, to avoid repopulating stale data.
      if (myToken !== topologyLoadToken) return;
      if (result.status === "ok") {
        set(
          {
            nodes: result.data.nodes,
            edges: result.data.edges,
            topologyIsLoading: false,
            topologyHasMore: result.data.nodes.length === INITIAL_LIMIT,
            topologyCurrentOffset: result.data.nodes.length,
            topologyLastRefresh: Date.now(),
          },
          undefined,
          "gitOps:topology/loadOk",
        );
      } else {
        set({
          topologyError: getErrorMessage(result.error),
          topologyIsLoading: false,
        });
      }
    } catch (e) {
      set({ topologyError: String(e), topologyIsLoading: false });
    }
  },

  loadMore: async () => {
    const { topologyCurrentOffset, topologyIsLoading, topologyHasMore } = get();
    if (topologyIsLoading || !topologyHasMore) return;

    // Capture the current token; a concurrent loadGraph/resetTopology will bump
    // it and invalidate the page we are about to fetch at this offset.
    const myToken = ++topologyLoadToken;
    set({ topologyIsLoading: true }, undefined, "gitOps:topology/loadMore");
    try {
      const result = await commands.getCommitGraph(
        LOAD_MORE_AMOUNT,
        topologyCurrentOffset,
      );
      // If a full reload/reset happened while we were awaiting, this page was
      // fetched against a now-stale offset/base; discard it to avoid
      // duplicated/misaligned commits and a corrupted offset.
      if (myToken !== topologyLoadToken) return;
      if (result.status === "ok") {
        // Append using the functional form so we read the freshest arrays.
        set(
          (cur) => ({
            nodes: [...cur.nodes, ...result.data.nodes],
            edges: [...cur.edges, ...result.data.edges],
            topologyIsLoading: false,
            topologyHasMore: result.data.nodes.length === LOAD_MORE_AMOUNT,
            topologyCurrentOffset:
              cur.topologyCurrentOffset + result.data.nodes.length,
          }),
          undefined,
          "gitOps:topology/loadMoreOk",
        );
      } else {
        set({
          topologyError: getErrorMessage(result.error),
          topologyIsLoading: false,
        });
      }
    } catch (e) {
      set({ topologyError: String(e), topologyIsLoading: false });
    }
  },

  selectCommit: (oid) =>
    set(
      { topologySelectedCommit: oid },
      undefined,
      "gitOps:topology/selectCommit",
    ),

  resetTopology: () => {
    // Invalidate any in-flight load so its result can't repopulate the graph
    // after an unmount/repo-switch/close reset.
    topologyLoadToken++;
    set(
      {
        nodes: [],
        edges: [],
        topologySelectedCommit: null,
        topologyIsLoading: false,
        topologyError: null,
        topologyHasMore: true,
        topologyLastRefresh: 0,
        topologyCurrentOffset: 0,
      },
      undefined,
      "gitOps:topology/reset",
    );
  },

  clearTopologyError: () =>
    set({ topologyError: null }, undefined, "gitOps:topology/clearError"),
});
