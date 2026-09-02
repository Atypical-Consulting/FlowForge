import { fireEvent, render, screen } from "@testing-library/react";
import type { EnrichedBranch } from "@/core/lib/branchClassifier";
import { createBranchInfo } from "@/core/test-utils/mocks/tauri-commands";
import {
  type ContextMenuContext,
  useContextMenuRegistry,
} from "@/framework/extension-system/contextMenuRegistry";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";

vi.mock("../../../bindings", () => ({
  commands: {
    getBranchAheadBehind: vi
      .fn()
      .mockResolvedValue({ status: "ok", data: { ahead: 0, behind: 0 } }),
  },
}));

import { BranchItem } from "../components/BranchItem";
import { onActivate } from "../index";

function makeBranch(overrides: Partial<EnrichedBranch> = {}): EnrichedBranch {
  return {
    ...createBranchInfo({ name: "feature/x", isHead: false }),
    branchType: "feature",
    isPinned: false,
    lastVisited: null,
    ...overrides,
  };
}

function itemsFor(ctx: Omit<ContextMenuContext, "location">) {
  return useContextMenuRegistry
    .getState()
    .getItemsForLocation("branch-list", { location: "branch-list", ...ctx })
    .map((i) => i.id);
}

describe("branches extension context menu", () => {
  let api: ExtensionAPI;

  beforeEach(async () => {
    useContextMenuRegistry.setState({ items: new Map(), activeMenu: null });
    api = new ExtensionAPI("branches");
    await onActivate(api);
  });

  afterEach(() => {
    api.cleanup();
  });

  const allActions = {
    checkout: vi.fn(),
    merge: vi.fn(),
    delete: vi.fn(),
    togglePin: vi.fn(),
  };

  it("registers branch-list items", () => {
    const ids = itemsFor({ branchName: "feature/x", actions: allActions });
    expect(ids).toEqual([
      "ext:branches:checkout",
      "ext:branches:merge",
      "ext:branches:pin",
      "ext:branches:copy-name",
      "ext:branches:delete",
    ]);
  });

  it("hides checkout, merge and delete for the HEAD branch", () => {
    const ids = itemsFor({
      branchName: "main",
      isHead: true,
      actions: allActions,
    });
    expect(ids).not.toContain("ext:branches:checkout");
    expect(ids).not.toContain("ext:branches:merge");
    expect(ids).not.toContain("ext:branches:delete");
    expect(ids).toContain("ext:branches:copy-name");
    expect(ids).toContain("ext:branches:pin");
  });

  it("offers Unpin instead of Pin for a pinned branch", () => {
    const ids = itemsFor({
      branchName: "feature/x",
      isPinned: true,
      actions: allActions,
    });
    expect(ids).toContain("ext:branches:unpin");
    expect(ids).not.toContain("ext:branches:pin");
  });

  it("invokes the row-supplied action handlers", () => {
    const items = useContextMenuRegistry.getState().items;
    const ctx: ContextMenuContext = {
      location: "branch-list",
      branchName: "feature/x",
      actions: allActions,
    };
    items.get("ext:branches:checkout")?.execute(ctx);
    items.get("ext:branches:merge")?.execute(ctx);
    items.get("ext:branches:delete")?.execute(ctx);
    items.get("ext:branches:pin")?.execute(ctx);
    expect(allActions.checkout).toHaveBeenCalledTimes(1);
    expect(allActions.merge).toHaveBeenCalledTimes(1);
    expect(allActions.delete).toHaveBeenCalledTimes(1);
    expect(allActions.togglePin).toHaveBeenCalledTimes(1);
  });

  it("copies the branch name to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await useContextMenuRegistry
      .getState()
      .items.get("ext:branches:copy-name")
      ?.execute({ location: "branch-list", branchName: "feature/x" });
    expect(writeText).toHaveBeenCalledWith("feature/x");
  });

  it("BranchItem opens the registry menu with branch context on right-click", () => {
    const onCheckout = vi.fn();
    render(
      <BranchItem
        branch={makeBranch({ name: "feature/x", isHead: false })}
        onCheckout={onCheckout}
        onDelete={vi.fn()}
        onMerge={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByTitle("feature/x"), {
      clientX: 40,
      clientY: 50,
    });

    const active = useContextMenuRegistry.getState().activeMenu;
    expect(active).not.toBeNull();
    expect(active?.position).toEqual({ x: 40, y: 50 });
    expect(active?.context.location).toBe("branch-list");
    expect(active?.context.branchName).toBe("feature/x");
    expect(active?.context.isHead).toBe(false);
    expect(active?.items.map((i) => i.id)).toContain("ext:branches:checkout");

    // The menu's checkout goes through the same prop the hover button uses
    active?.context.actions?.checkout?.();
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it("BranchItem right-click on HEAD branch omits checkout", () => {
    render(
      <BranchItem
        branch={makeBranch({ name: "main", isHead: true })}
        onCheckout={vi.fn()}
        onDelete={vi.fn()}
        onMerge={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByText("main"));

    const active = useContextMenuRegistry.getState().activeMenu;
    expect(active?.context.isHead).toBe(true);
    const ids = active?.items.map((i) => i.id) ?? [];
    expect(ids).not.toContain("ext:branches:checkout");
    expect(ids).not.toContain("ext:branches:delete");
    // No onTogglePin prop -> no pin entry, but copy is always available
    expect(ids).not.toContain("ext:branches:pin");
    expect(ids).toContain("ext:branches:copy-name");
  });
});
