/**
 * @deprecated Use NavigationProvider + useBladeNavigation() or getNavigationActor().
 * This store is kept for backward compat during migration. All navigation now goes
 * through the XState FSM in src/machines/navigation/.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { BladeType, BladePropsMap, TypedBlade } from "./bladeTypes";

/** @deprecated Use types from src/machines/navigation/types.ts */
export type { BladeType, TypedBlade };
/** @deprecated Use types from src/machines/navigation/types.ts */
export type { BladePropsMap };

/** @deprecated Use TypedBlade instead */
export type Blade = TypedBlade;

export type ProcessType = "staging" | "topology";

interface BladeState {
  activeProcess: ProcessType;
  bladeStack: TypedBlade[];
  setProcess: (process: ProcessType) => void;
  pushBlade: <K extends BladeType>(blade: {
    type: K;
    title: string;
    props: BladePropsMap[K];
  }) => void;
  popBlade: () => void;
  popToIndex: (index: number) => void;
  replaceBlade: <K extends BladeType>(blade: {
    type: K;
    title: string;
    props: BladePropsMap[K];
  }) => void;
  resetStack: () => void;
}

function rootBladeForProcess(process: ProcessType): TypedBlade {
  if (process === "staging") {
    return {
      id: "root",
      type: "staging-changes",
      title: "Changes",
      props: {} as Record<string, never>,
    };
  }
  return {
    id: "root",
    type: "topology-graph",
    title: "Topology",
    props: {} as Record<string, never>,
  };
}

export const useBladeStore = create<BladeState>()(
  devtools(
    (set) => ({
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
            { ...blade, id: crypto.randomUUID() } as TypedBlade,
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
            { ...blade, id: crypto.randomUUID() } as TypedBlade,
          ],
        })),

      resetStack: () =>
        set((state) => ({
          bladeStack: [rootBladeForProcess(state.activeProcess)],
        })),
    }),
    { name: "blade-store", enabled: import.meta.env.DEV },
  ),
);
