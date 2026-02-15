import { createBladeStore } from "@/framework/stores/createBladeStore";
import { resetAllStores } from "@/framework/stores/registry";

describe("createBladeStore", () => {
  it("creates a store with initial state", () => {
    const useStore = createBladeStore("test-blade", () => ({
      value: "hello",
    }));
    expect(useStore.getState().value).toBe("hello");
  });

  it("auto-registers for reset", () => {
    const useStore = createBladeStore<{ value: string; setValue: (v: string) => void }>(
      "test-blade-reset",
      (set) => ({
        value: "initial",
        setValue: (v: string) => set({ value: v }),
      }),
    );

    useStore.getState().setValue("changed");
    expect(useStore.getState().value).toBe("changed");

    resetAllStores();
    expect(useStore.getState().value).toBe("initial");
  });

  it("store actions work correctly", () => {
    const useStore = createBladeStore<{ count: number; increment: () => void }>(
      "test-blade-actions",
      (set) => ({
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 })),
      }),
    );

    useStore.getState().increment();
    useStore.getState().increment();
    expect(useStore.getState().count).toBe(2);
  });
});
