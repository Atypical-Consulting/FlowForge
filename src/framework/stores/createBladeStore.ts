import { create, type StateCreator } from "zustand";
import { devtools } from "zustand/middleware";
import { registerStoreForReset } from "./registry";

export function createBladeStore<T>(
  name: string,
  stateCreator: StateCreator<T, [["zustand/devtools", never]]>,
) {
  const store = create<T>()(
    devtools(stateCreator, { name, enabled: import.meta.env.DEV }),
  );
  registerStoreForReset(store);
  return store;
}
