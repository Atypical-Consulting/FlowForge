import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { registerStoreForReset } from "@/framework/stores/registry";
import {
  type CommandPaletteSlice,
  createCommandPaletteSlice,
} from "./command-palette.slice";
import { createStagingSlice, type StagingSlice } from "./staging.slice";

export type UIStore = StagingSlice & CommandPaletteSlice;

export const useUIStore = create<UIStore>()(
  devtools(
    (...args) => ({
      ...createStagingSlice(...args),
      ...createCommandPaletteSlice(...args),
    }),
    { name: "ui-state", enabled: import.meta.env.DEV },
  ),
);

// UI state resets on repo close
registerStoreForReset(useUIStore);
