import type { StateCreator } from "zustand";
import type { GraphEdge, GraphNode } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import type { GitOpsMiddleware } from "./types";
import type { GitOpsStore } from "./index";

const INITIAL_LIMIT = 100;
const LOAD_MORE_AMOUNT = 50;

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
    set({ topologyIsLoading: true, topologyError: null }, undefined, "gitOps:topology/load");
    try {
      const result = await commands.getCommitGraph(INITIAL_LIMIT, 0);
      if (result.status === "ok") {
        set({
          nodes: result.data.nodes,
          edges: result.data.edges,
          topologyIsLoading: false,
          topologyHasMore: result.data.nodes.length === INITIAL_LIMIT,
          topologyCurrentOffset: result.data.nodes.length,
          topologyLastRefresh: Date.now(),
        }, undefined, "gitOps:topology/loadOk");
      } else {
        set({ topologyError: getErrorMessage(result.error), topologyIsLoading: false });
      }
    } catch (e) {
      set({ topologyError: String(e), topologyIsLoading: false });
    }
  },

  loadMore: async () => {
    const { topologyCurrentOffset, nodes, edges, topologyIsLoading, topologyHasMore } = get();
    if (topologyIsLoading || !topologyHasMore) return;

    set({ topologyIsLoading: true }, undefined, "gitOps:topology/loadMore");
    try {
      const result = await commands.getCommitGraph(LOAD_MORE_AMOUNT, topologyCurrentOffset);
      if (result.status === "ok") {
        set({
          nodes: [...nodes, ...result.data.nodes],
          edges: [...edges, ...result.data.edges],
          topologyIsLoading: false,
          topologyHasMore: result.data.nodes.length === LOAD_MORE_AMOUNT,
          topologyCurrentOffset: topologyCurrentOffset + result.data.nodes.length,
        }, undefined, "gitOps:topology/loadMoreOk");
      } else {
        set({ topologyError: getErrorMessage(result.error), topologyIsLoading: false });
      }
    } catch (e) {
      set({ topologyError: String(e), topologyIsLoading: false });
    }
  },

  selectCommit: (oid) => set({ topologySelectedCommit: oid }, undefined, "gitOps:topology/selectCommit"),

  resetTopology: () =>
    set({
      nodes: [],
      edges: [],
      topologySelectedCommit: null,
      topologyIsLoading: false,
      topologyError: null,
      topologyHasMore: true,
      topologyLastRefresh: 0,
      topologyCurrentOffset: 0,
    }, undefined, "gitOps:topology/reset"),

  clearTopologyError: () => set({ topologyError: null }, undefined, "gitOps:topology/clearError"),
});
