import { useContextMenuRegistry } from "../contextMenuRegistry";
import type {
  ContextMenuItem,
  ContextMenuContext,
} from "../contextMenuRegistry";

const makeItem = (
  overrides: Partial<ContextMenuItem> & { id: string },
): ContextMenuItem => ({
  label: overrides.id,
  location: "file-tree",
  execute: () => {},
  ...overrides,
});

describe("ContextMenuRegistry", () => {
  beforeEach(() => {
    useContextMenuRegistry.setState({ items: new Map(), activeMenu: null });
  });

  it("registers and retrieves item by location", () => {
    const { register, getItemsForLocation } =
      useContextMenuRegistry.getState();
    register(makeItem({ id: "copy", location: "file-tree" }));
    register(makeItem({ id: "paste", location: "branch-list" }));

    const ctx: ContextMenuContext = { location: "file-tree" };
    const items = getItemsForLocation("file-tree", ctx);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("copy");
  });

  it("filters by when() condition", () => {
    const { register, getItemsForLocation } =
      useContextMenuRegistry.getState();
    register(
      makeItem({
        id: "delete-branch",
        location: "branch-list",
        when: (ctx) => ctx.branchName !== "main",
      }),
    );

    const mainCtx: ContextMenuContext = {
      location: "branch-list",
      branchName: "main",
    };
    expect(getItemsForLocation("branch-list", mainCtx)).toHaveLength(0);

    const featureCtx: ContextMenuContext = {
      location: "branch-list",
      branchName: "feature/x",
    };
    expect(getItemsForLocation("branch-list", featureCtx)).toHaveLength(1);
  });

  it("sorts by priority descending within group", () => {
    const { register, getItemsForLocation } =
      useContextMenuRegistry.getState();
    register(
      makeItem({
        id: "low",
        location: "file-tree",
        group: "actions",
        priority: 10,
      }),
    );
    register(
      makeItem({
        id: "high",
        location: "file-tree",
        group: "actions",
        priority: 100,
      }),
    );

    const ctx: ContextMenuContext = { location: "file-tree" };
    const items = getItemsForLocation("file-tree", ctx);
    expect(items[0].id).toBe("high");
    expect(items[1].id).toBe("low");
  });

  it("separates items by group alphabetically", () => {
    const { register, getItemsForLocation } =
      useContextMenuRegistry.getState();
    register(
      makeItem({ id: "z-item", location: "file-tree", group: "zebra" }),
    );
    register(
      makeItem({ id: "a-item", location: "file-tree", group: "alpha" }),
    );

    const ctx: ContextMenuContext = { location: "file-tree" };
    const items = getItemsForLocation("file-tree", ctx);
    expect(items[0].id).toBe("a-item");
    expect(items[1].id).toBe("z-item");
  });

  it("unregister removes item", () => {
    const { register, unregister } = useContextMenuRegistry.getState();
    register(makeItem({ id: "temp" }));
    expect(useContextMenuRegistry.getState().items.size).toBe(1);

    unregister("temp");
    expect(useContextMenuRegistry.getState().items.size).toBe(0);
  });

  it("unregisterBySource removes all items for source", () => {
    const { register, unregisterBySource } =
      useContextMenuRegistry.getState();
    register(makeItem({ id: "ext-a", source: "ext:foo" }));
    register(makeItem({ id: "ext-b", source: "ext:foo" }));
    register(makeItem({ id: "core-a", source: "core" }));

    unregisterBySource("ext:foo");
    const { items } = useContextMenuRegistry.getState();
    expect(items.size).toBe(1);
    expect(items.has("core-a")).toBe(true);
  });

  it("showMenu populates activeMenu", () => {
    const { register, showMenu } = useContextMenuRegistry.getState();
    register(makeItem({ id: "action", location: "file-tree" }));

    showMenu({ x: 100, y: 200 }, "file-tree", { location: "file-tree" });
    const { activeMenu } = useContextMenuRegistry.getState();
    expect(activeMenu).not.toBeNull();
    expect(activeMenu!.items).toHaveLength(1);
    expect(activeMenu!.position).toEqual({ x: 100, y: 200 });
  });

  it("hideMenu clears activeMenu", () => {
    const { register, showMenu, hideMenu } =
      useContextMenuRegistry.getState();
    register(makeItem({ id: "action", location: "file-tree" }));

    showMenu({ x: 0, y: 0 }, "file-tree", { location: "file-tree" });
    expect(useContextMenuRegistry.getState().activeMenu).not.toBeNull();

    hideMenu();
    expect(useContextMenuRegistry.getState().activeMenu).toBeNull();
  });
});
