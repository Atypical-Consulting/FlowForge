import { fireEvent, render, screen } from "@testing-library/react";
import { createStashEntry } from "@/core/test-utils/mocks/tauri-commands";
import { useContextMenuRegistry } from "@/framework/extension-system/contextMenuRegistry";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { StashItem } from "../components/StashItem";
import { onActivate } from "../index";

describe("stash extension context menu", () => {
  let api: ExtensionAPI;

  beforeEach(async () => {
    useContextMenuRegistry.setState({ items: new Map(), activeMenu: null });
    api = new ExtensionAPI("stash");
    await onActivate(api);
  });

  afterEach(() => {
    api.cleanup();
  });

  it("registers apply, pop and drop for stash-list", () => {
    const ids = useContextMenuRegistry
      .getState()
      .getItemsForLocation("stash-list", {
        location: "stash-list",
        stashIndex: 0,
        actions: { apply: vi.fn(), pop: vi.fn(), drop: vi.fn() },
      })
      .map((i) => i.id);
    expect(ids).toEqual(["ext:stash:apply", "ext:stash:pop", "ext:stash:drop"]);
  });

  it("StashItem opens the registry menu with the stash index on right-click", async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    const onPop = vi.fn().mockResolvedValue(undefined);
    const onDrop = vi.fn().mockResolvedValue(undefined);
    render(
      <StashItem
        stash={createStashEntry({ index: 2, message: "WIP on main: fix" })}
        onApply={onApply}
        onPop={onPop}
        onDrop={onDrop}
      />,
    );

    fireEvent.contextMenu(screen.getByText(/stash@/), {
      clientX: 12,
      clientY: 34,
    });

    const active = useContextMenuRegistry.getState().activeMenu;
    expect(active).not.toBeNull();
    expect(active?.position).toEqual({ x: 12, y: 34 });
    expect(active?.context).toMatchObject({
      location: "stash-list",
      stashIndex: 2,
    });
    expect(active?.items.map((i) => i.id)).toEqual([
      "ext:stash:apply",
      "ext:stash:pop",
      "ext:stash:drop",
    ]);

    // Drop from the menu invokes the same callback as the hover button,
    // so it inherits whatever confirmation StashList wires into onDrop.
    const dropItem = active?.items.find((i) => i.id === "ext:stash:drop");
    await dropItem?.execute(active?.context ?? { location: "stash-list" });
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(onPop).not.toHaveBeenCalled();
  });
});
