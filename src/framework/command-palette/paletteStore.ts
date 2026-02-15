import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface PaletteState {
  paletteIsOpen: boolean;
  paletteQuery: string;
  paletteSelectedIndex: number;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setPaletteQuery: (query: string) => void;
  setPaletteSelectedIndex: (index: number) => void;
}

export const usePaletteStore = create<PaletteState>()(
  devtools(
    (set) => ({
      paletteIsOpen: false,
      paletteQuery: "",
      paletteSelectedIndex: 0,
      openPalette: () =>
        set(
          { paletteIsOpen: true, paletteQuery: "", paletteSelectedIndex: 0 },
          false,
          "palette/open",
        ),
      closePalette: () =>
        set(
          { paletteIsOpen: false, paletteQuery: "", paletteSelectedIndex: 0 },
          false,
          "palette/close",
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
          "palette/toggle",
        ),
      setPaletteQuery: (query) =>
        set(
          { paletteQuery: query, paletteSelectedIndex: 0 },
          false,
          "palette/setQuery",
        ),
      setPaletteSelectedIndex: (index) =>
        set(
          { paletteSelectedIndex: index },
          false,
          "palette/setSelectedIndex",
        ),
    }),
    { name: "command-palette", enabled: import.meta.env.DEV },
  ),
);
