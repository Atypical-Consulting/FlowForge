import { create } from "zustand";
import type { CommitGraph, GraphEdge, GraphNode } from "../bindings";
import { commands } from "../bindings";
import { getErrorMessage } from "../lib/errors";

const INITIAL_LIMIT = 100;
const LOAD_MORE_AMOUNT = 50;

interface TopologyState {
  // Data
  nodes: GraphNode[];
  edges: GraphEdge[];

  // UI State
  selectedCommit: string | null;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;

  // Pagination
  currentOffset: number;

  // Actions
  loadGraph: () => Promise<void>;
  loadMore: () => Promise<void>;
  selectCommit: (oid: string | null) => void;
  reset: () => void;
  clearError: () => void;
}

export const useTopologyStore = create<TopologyState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedCommit: null,
  isLoading: false,
  error: null,
  hasMore: true,
  currentOffset: 0,

  loadGraph: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await commands.getCommitGraph(INITIAL_LIMIT, 0);
      if (result.status === "ok") {
        set({
          nodes: result.data.nodes,
          edges: result.data.edges,
          isLoading: false,
          hasMore: result.data.nodes.length === INITIAL_LIMIT,
          currentOffset: result.data.nodes.length,
        });
      } else {
        set({ error: getErrorMessage(result.error), isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  loadMore: async () => {
    const { currentOffset, nodes, edges, isLoading, hasMore } = get();
    if (isLoading || !hasMore) return;

    set({ isLoading: true });
    try {
      const result = await commands.getCommitGraph(
        LOAD_MORE_AMOUNT,
        currentOffset,
      );
      if (result.status === "ok") {
        set({
          nodes: [...nodes, ...result.data.nodes],
          edges: [...edges, ...result.data.edges],
          isLoading: false,
          hasMore: result.data.nodes.length === LOAD_MORE_AMOUNT,
          currentOffset: currentOffset + result.data.nodes.length,
        });
      } else {
        set({ error: getErrorMessage(result.error), isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  selectCommit: (oid) => set({ selectedCommit: oid }),

  reset: () =>
    set({
      nodes: [],
      edges: [],
      selectedCommit: null,
      isLoading: false,
      error: null,
      hasMore: true,
      currentOffset: 0,
    }),

  clearError: () => set({ error: null }),
}));
