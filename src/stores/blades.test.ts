import { useBladeStore } from "./blades";

describe("useBladeStore", () => {
  it("has correct initial state with staging root blade", () => {
    const state = useBladeStore.getState();
    expect(state.activeProcess).toBe("staging");
    expect(state.bladeStack).toHaveLength(1);
    expect(state.bladeStack[0].type).toBe("staging-changes");
  });

  it("pushBlade adds a blade to the stack", () => {
    useBladeStore.getState().pushBlade({
      type: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });

    const state = useBladeStore.getState();
    expect(state.bladeStack).toHaveLength(2);
    expect(state.bladeStack[1].type).toBe("settings");
  });

  it("resets state between tests (auto-reset verification)", () => {
    // This test runs AFTER pushBlade test above.
    // If auto-reset works correctly, stack should be back to 1 blade.
    const { bladeStack } = useBladeStore.getState();
    expect(bladeStack).toHaveLength(1);
    expect(bladeStack[0].type).toBe("staging-changes");
  });

  it("popBlade does not remove root blade", () => {
    useBladeStore.getState().popBlade();
    expect(useBladeStore.getState().bladeStack).toHaveLength(1);
  });

  it("setProcess resets stack to process root", () => {
    useBladeStore.getState().setProcess("topology");
    const state = useBladeStore.getState();
    expect(state.activeProcess).toBe("topology");
    expect(state.bladeStack[0].type).toBe("topology-graph");
  });
});
