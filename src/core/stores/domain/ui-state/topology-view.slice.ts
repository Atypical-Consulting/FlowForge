import type { StateCreator } from "zustand";
import type { UIStore } from "./index";
import type { UIStateMiddleware } from "./types";

/** Sub-tab of the Topology workflow root blade. */
export type TopologyView = "graph" | "history";

export interface TopologyViewSlice {
  /**
   * Selected tab of the Topology root blade. Kept here (not in component
   * state) so the tab survives the root blade unmounting while a child blade
   * (e.g. commit details) is open, and "Show History" can target it.
   */
  topologyView: TopologyView;
  setTopologyView: (view: TopologyView) => void;
}

export const createTopologyViewSlice: StateCreator<
  UIStore,
  UIStateMiddleware,
  [],
  TopologyViewSlice
> = (set) => ({
  topologyView: "graph",
  setTopologyView: (view) =>
    set({ topologyView: view }, false, "uiState:topology/setView"),
});
