import { create } from "zustand";
import { resetAllStores, registerStoreForReset } from "./registry";

describe("Store Registry", () => {
  it("resetAllStores resets a registered store to initial state", () => {
    const useStore = create<{ count: number; increment: () => void }>((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));
    registerStoreForReset(useStore);

    useStore.getState().increment();
    useStore.getState().increment();
    expect(useStore.getState().count).toBe(2);

    resetAllStores();
    expect(useStore.getState().count).toBe(0);
  });

  it("resetAllStores resets multiple registered stores", () => {
    const useStoreA = create<{ value: string; setValue: (v: string) => void }>((set) => ({
      value: "initial",
      setValue: (v) => set({ value: v }),
    }));
    const useStoreB = create<{ count: number; increment: () => void }>((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));
    registerStoreForReset(useStoreA);
    registerStoreForReset(useStoreB);

    useStoreA.getState().setValue("changed");
    useStoreB.getState().increment();

    resetAllStores();
    expect(useStoreA.getState().value).toBe("initial");
    expect(useStoreB.getState().count).toBe(0);
  });

  it("unregistered stores are not affected by resetAllStores", () => {
    const useStore = create<{ count: number; increment: () => void }>((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));
    // Do NOT register

    useStore.getState().increment();
    resetAllStores();
    expect(useStore.getState().count).toBe(1);
  });

  it("resetAllStores can be called multiple times safely", () => {
    const useStore = create<{ count: number }>(() => ({ count: 0 }));
    registerStoreForReset(useStore);

    resetAllStores();
    resetAllStores();
    expect(useStore.getState().count).toBe(0);
  });
});
