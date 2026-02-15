import { useStatusBarRegistry } from "@/framework/extension-system/statusBarRegistry";
import type { StatusBarItem } from "@/framework/extension-system/statusBarRegistry";

const makeItem = (
  overrides: Partial<StatusBarItem> & { id: string },
): StatusBarItem => ({
  alignment: "left",
  priority: 0,
  renderCustom: () => null,
  ...overrides,
});

describe("StatusBarRegistry", () => {
  beforeEach(() => {
    useStatusBarRegistry.setState({ items: new Map(), visibilityTick: 0 });
  });

  it("registers item", () => {
    const { register } = useStatusBarRegistry.getState();
    register(makeItem({ id: "branch" }));
    expect(useStatusBarRegistry.getState().items.size).toBe(1);
  });

  it("getLeftItems returns only left-aligned items sorted by priority", () => {
    const { register, getLeftItems } = useStatusBarRegistry.getState();
    register(makeItem({ id: "low", alignment: "left", priority: 10 }));
    register(makeItem({ id: "high", alignment: "left", priority: 100 }));
    register(makeItem({ id: "right-item", alignment: "right", priority: 50 }));

    const left = getLeftItems();
    expect(left).toHaveLength(2);
    expect(left[0].id).toBe("high");
    expect(left[1].id).toBe("low");
  });

  it("getRightItems returns only right-aligned items sorted by priority", () => {
    const { register, getRightItems } = useStatusBarRegistry.getState();
    register(makeItem({ id: "low-r", alignment: "right", priority: 5 }));
    register(makeItem({ id: "high-r", alignment: "right", priority: 50 }));
    register(makeItem({ id: "left-item", alignment: "left", priority: 100 }));

    const right = getRightItems();
    expect(right).toHaveLength(2);
    expect(right[0].id).toBe("high-r");
    expect(right[1].id).toBe("low-r");
  });

  it("filters by when() condition", () => {
    const { register, getLeftItems } = useStatusBarRegistry.getState();
    register(makeItem({ id: "visible", when: () => true }));
    register(makeItem({ id: "hidden", when: () => false }));

    const items = getLeftItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("visible");
  });

  it("unregister removes item", () => {
    const { register, unregister } = useStatusBarRegistry.getState();
    register(makeItem({ id: "temp" }));
    expect(useStatusBarRegistry.getState().items.size).toBe(1);

    unregister("temp");
    expect(useStatusBarRegistry.getState().items.size).toBe(0);
  });

  it("unregisterBySource removes all items for source", () => {
    const { register, unregisterBySource } =
      useStatusBarRegistry.getState();
    register(makeItem({ id: "ext-a", source: "ext:baz" }));
    register(makeItem({ id: "ext-b", source: "ext:baz" }));
    register(makeItem({ id: "core-a", source: "core" }));

    unregisterBySource("ext:baz");
    const { items } = useStatusBarRegistry.getState();
    expect(items.size).toBe(1);
    expect(items.has("core-a")).toBe(true);
  });

  it("refreshVisibility increments tick", () => {
    expect(useStatusBarRegistry.getState().visibilityTick).toBe(0);
    useStatusBarRegistry.getState().refreshVisibility();
    expect(useStatusBarRegistry.getState().visibilityTick).toBe(1);
    useStatusBarRegistry.getState().refreshVisibility();
    expect(useStatusBarRegistry.getState().visibilityTick).toBe(2);
  });
});
