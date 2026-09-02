import { fireEvent, render, screen } from "@testing-library/react";
import { createTagInfo } from "@/core/test-utils/mocks/tauri-commands";
import { useContextMenuRegistry } from "@/framework/extension-system/contextMenuRegistry";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { TagItem } from "../components/TagItem";
import { onActivate } from "../index";

describe("tags extension context menu", () => {
  let api: ExtensionAPI;

  beforeEach(async () => {
    useContextMenuRegistry.setState({ items: new Map(), activeMenu: null });
    api = new ExtensionAPI("tags");
    await onActivate(api);
  });

  afterEach(() => {
    api.cleanup();
  });

  it("registers copy-name and delete for tag-list", () => {
    const ids = useContextMenuRegistry
      .getState()
      .getItemsForLocation("tag-list", {
        location: "tag-list",
        tagName: "v1.0.0",
        actions: { delete: vi.fn() },
      })
      .map((i) => i.id);
    expect(ids).toEqual(["ext:tags:copy-name", "ext:tags:delete"]);
  });

  it("copies the tag name to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await useContextMenuRegistry
      .getState()
      .items.get("ext:tags:copy-name")
      ?.execute({ location: "tag-list", tagName: "v2.0.0" });
    expect(writeText).toHaveBeenCalledWith("v2.0.0");
  });

  it("TagItem opens the registry menu with the tag name on right-click", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <TagItem tag={createTagInfo({ name: "v1.2.3" })} onDelete={onDelete} />,
    );

    fireEvent.contextMenu(screen.getByText("v1.2.3"), {
      clientX: 5,
      clientY: 6,
    });

    const active = useContextMenuRegistry.getState().activeMenu;
    expect(active).not.toBeNull();
    expect(active?.position).toEqual({ x: 5, y: 6 });
    expect(active?.context).toMatchObject({
      location: "tag-list",
      tagName: "v1.2.3",
    });
    expect(active?.items.map((i) => i.id)).toEqual([
      "ext:tags:copy-name",
      "ext:tags:delete",
    ]);

    // Delete from the menu goes through the same onDelete prop as the button
    const deleteItem = active?.items.find((i) => i.id === "ext:tags:delete");
    await deleteItem?.execute(active?.context ?? { location: "tag-list" });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
