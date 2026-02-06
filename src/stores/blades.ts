import { create } from "zustand";

export type BladeType =
  | "staging-changes"
  | "topology-graph"
  | "commit-details"
  | "commit-diff";

export type ProcessType = "staging" | "topology";

export interface Blade {
  id: string;
  type: BladeType;
  title: string;
  props: Record<string, unknown>;
}

interface BladeState {
  activeProcess: ProcessType;
  bladeStack: Blade[];
  setProcess: (process: ProcessType) => void;
  pushBlade: (blade: Omit<Blade, "id">) => void;
  popBlade: () => void;
  popToIndex: (index: number) => void;
  replaceBlade: (blade: Omit<Blade, "id">) => void;
  resetStack: () => void;
}

function rootBladeForProcess(process: ProcessType): Blade {
  if (process === "staging") {
    return { id: "root", type: "staging-changes", title: "Changes", props: {} };
  }
  return { id: "root", type: "topology-graph", title: "Topology", props: {} };
}

export const useBladeStore = create<BladeState>((set) => ({
  activeProcess: "staging",
  bladeStack: [rootBladeForProcess("staging")],

  setProcess: (process) =>
    set({
      activeProcess: process,
      bladeStack: [rootBladeForProcess(process)],
    }),

  pushBlade: (blade) =>
    set((state) => ({
      bladeStack: [
        ...state.bladeStack,
        { ...blade, id: crypto.randomUUID() },
      ],
    })),

  popBlade: () =>
    set((state) => ({
      bladeStack:
        state.bladeStack.length > 1
          ? state.bladeStack.slice(0, -1)
          : state.bladeStack,
    })),

  popToIndex: (index) =>
    set((state) => ({
      bladeStack: state.bladeStack.slice(0, index + 1),
    })),

  replaceBlade: (blade) =>
    set((state) => ({
      bladeStack: [
        ...state.bladeStack.slice(0, -1),
        { ...blade, id: crypto.randomUUID() },
      ],
    })),

  resetStack: () =>
    set((state) => ({
      bladeStack: [rootBladeForProcess(state.activeProcess)],
    })),
}));
