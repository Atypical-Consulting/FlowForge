import type { StateCreator } from "zustand";
import type { UIStore } from "./index";
import type { UIStateMiddleware } from "./types";

export interface CommandPaletteSlice {
  paletteIsOpen: boolean;
  paletteQuery: string;
  paletteSelectedIndex: number;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setPaletteQuery: (query: string) => void;
  setPaletteSelectedIndex: (index: number) => void;
}

export const createCommandPaletteSlice: StateCreator<
  UIStore,
  UIStateMiddleware,
  [],
  CommandPaletteSlice
> = (set) => ({
  paletteIsOpen: false,
  paletteQuery: "",
  paletteSelectedIndex: 0,
  openPalette: () =>
    set(
      { paletteIsOpen: true, paletteQuery: "", paletteSelectedIndex: 0 },
      false,
      "uiState:palette/open",
    ),
  closePalette: () =>
    set(
      { paletteIsOpen: false, paletteQuery: "", paletteSelectedIndex: 0 },
      false,
      "uiState:palette/close",
    ),
  togglePalette: () =>
    set(
      (state) =>
        state.paletteIsOpen
          ? {
              paletteIsOpen: false,
              paletteQuery: "",
              paletteSelectedIndex: 0,
            }
          : {
              paletteIsOpen: true,
              paletteQuery: "",
              paletteSelectedIndex: 0,
            },
      false,
      "uiState:palette/toggle",
    ),
  setPaletteQuery: (query) =>
    set(
      { paletteQuery: query, paletteSelectedIndex: 0 },
      false,
      "uiState:palette/setQuery",
    ),
  setPaletteSelectedIndex: (index) =>
    set(
      { paletteSelectedIndex: index },
      false,
      "uiState:palette/setSelectedIndex",
    ),
});
