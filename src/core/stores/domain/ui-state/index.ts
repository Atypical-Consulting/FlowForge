import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { registerStoreForReset } from "@/framework/stores/registry";
import {
  type CommandPaletteSlice,
  createCommandPaletteSlice,
} from "./command-palette.slice";
import { createStagingSlice, type StagingSlice } from "./staging.slice";
import {
  createTopologyViewSlice,
  type TopologyViewSlice,
} from "./topology-view.slice";

export type UIStore = StagingSlice & CommandPaletteSlice & TopologyViewSlice;

export const useUIStore = create<UIStore>()(
  devtools(
    (...args) => ({
      ...createStagingSlice(...args),
      ...createCommandPaletteSlice(...args),
      ...createTopologyViewSlice(...args),
    }),
    { name: "ui-state", enabled: import.meta.env.DEV },
  ),
);

// UI state resets on repo close
registerStoreForReset(useUIStore);

export type { TopologyView, TopologyViewSlice } from "./topology-view.slice";
