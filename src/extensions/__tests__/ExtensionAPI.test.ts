import { vi, describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { useContextMenuRegistry } from "@/framework/extension-system/contextMenuRegistry";
import { useSidebarPanelRegistry } from "@/framework/layout/sidebarPanelRegistry";
import { useStatusBarRegistry } from "@/framework/extension-system/statusBarRegistry";
import { useToolbarRegistry } from "@/framework/extension-system/toolbarRegistry";
import { gitHookBus } from "@/framework/extension-system/operationBus";
import { getBladeRegistration } from "@/framework/layout/bladeRegistry";
import type { ContextMenuContext } from "@/framework/extension-system/contextMenuRegistry";
import type { LucideIcon } from "lucide-react";

// Minimal stub for LucideIcon used by sidebar/toolbar configs
const FakeIcon = (() => null) as unknown as LucideIcon;

describe("ExtensionAPI", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("test-ext");

    // Reset Zustand stores
    useContextMenuRegistry.setState({ items: new Map(), activeMenu: null });
    useSidebarPanelRegistry.setState({ items: new Map(), visibilityTick: 0 });
    useStatusBarRegistry.setState({ items: new Map(), visibilityTick: 0 });
    useToolbarRegistry.setState({ items: new Map(), visibilityTick: 0 });

    // Reset gitHookBus by replacing internal handler maps via removeBySource
    // We use a fresh bus instance indirectly by clearing everything
    gitHookBus.removeBySource("ext:test-ext");
  });

  // Test 1
  it("contributeContextMenu registers with namespaced ID and source", () => {
    api.contributeContextMenu({
      id: "my-item",
      label: "Test Item",
      location: "branch-list",
      execute: vi.fn(),
    });

    const items = useContextMenuRegistry.getState().items;
    expect(items.has("ext:test-ext:my-item")).toBe(true);
    expect(items.get("ext:test-ext:my-item")!.source).toBe("ext:test-ext");
    expect(items.get("ext:test-ext:my-item")!.label).toBe("Test Item");
  });

  // Test 2
  it("contributeSidebarPanel registers with namespaced ID and clamped priority", () => {
    // Priority 100 should clamp to 69
    api.contributeSidebarPanel({
      id: "panel-high",
      title: "High Priority Panel",
      icon: FakeIcon,
      component: () => null,
      priority: 100,
    });

    expect(useSidebarPanelRegistry.getState().items.has("ext:test-ext:panel-high")).toBe(true);
    expect(useSidebarPanelRegistry.getState().items.get("ext:test-ext:panel-high")!.priority).toBe(69);

    // Priority 0 should clamp to 1
    api.contributeSidebarPanel({
      id: "panel-low",
      title: "Low Priority Panel",
      icon: FakeIcon,
      component: () => null,
      priority: 0,
    });

    expect(useSidebarPanelRegistry.getState().items.get("ext:test-ext:panel-low")!.priority).toBe(1);

    // Default priority (undefined) should become 50
    api.contributeSidebarPanel({
      id: "panel-default",
      title: "Default Panel",
      icon: FakeIcon,
      component: () => null,
    });

    expect(useSidebarPanelRegistry.getState().items.get("ext:test-ext:panel-default")!.priority).toBe(50);
  });

  // Test 3
  it("contributeStatusBar registers with namespaced ID and clamped priority", () => {
    // Priority 100 should clamp to 89
    api.contributeStatusBar({
      id: "status-high",
      alignment: "left",
      priority: 100,
      renderCustom: () => null,
    });

    expect(useStatusBarRegistry.getState().items.has("ext:test-ext:status-high")).toBe(true);
    expect(useStatusBarRegistry.getState().items.get("ext:test-ext:status-high")!.priority).toBe(89);

    // Priority -5 should clamp to 1
    api.contributeStatusBar({
      id: "status-low",
      alignment: "right",
      priority: -5,
      renderCustom: () => null,
    });

    expect(useStatusBarRegistry.getState().items.get("ext:test-ext:status-low")!.priority).toBe(1);
  });

  // Test 4
  it("onDidGit registers handler that receives events", async () => {
    const handler = vi.fn();
    api.onDidGit("commit", handler);

    await gitHookBus.emitDid("commit", { commitMessage: "test message" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "commit",
        commitMessage: "test message",
      }),
    );
  });

  // Test 5
  it("onWillGit registers handler that can cancel", async () => {
    api.onWillGit("commit", () => ({ cancel: true, reason: "blocked by test" }));

    const result = await gitHookBus.emitWill("commit");

    expect(result.cancel).toBe(true);
    expect(result.reason).toBe("blocked by test");
  });

  // Test 6
  it("onDispose collects callbacks and invokes them on cleanup", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const fn3 = vi.fn();

    api.onDispose(fn1);
    api.onDispose(fn2);
    api.onDispose(fn3);

    api.cleanup();

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    expect(fn3).toHaveBeenCalledTimes(1);
  });

  // Test 7
  it("cleanup removes all contributions from all registries", async () => {
    // Register in context menu
    api.contributeContextMenu({
      id: "ctx-item",
      label: "Ctx",
      location: "file-tree",
      execute: vi.fn(),
    });

    // Register in sidebar
    api.contributeSidebarPanel({
      id: "side-panel",
      title: "Side",
      icon: FakeIcon,
      component: () => null,
    });

    // Register in status bar
    api.contributeStatusBar({
      id: "status-item",
      alignment: "left",
      priority: 50,
      renderCustom: () => null,
    });

    // Register a git hook handler
    const gitHandler = vi.fn();
    api.onDidGit("push", gitHandler);

    // Verify registrations exist
    expect(useContextMenuRegistry.getState().items.size).toBe(1);
    expect(useSidebarPanelRegistry.getState().items.size).toBe(1);
    expect(useStatusBarRegistry.getState().items.size).toBe(1);

    // Cleanup
    api.cleanup();

    // Verify all registries are empty
    expect(useContextMenuRegistry.getState().items.size).toBe(0);
    expect(useSidebarPanelRegistry.getState().items.size).toBe(0);
    expect(useStatusBarRegistry.getState().items.size).toBe(0);

    // Verify git hook handler no longer fires
    await gitHookBus.emitDid("push");
    expect(gitHandler).not.toHaveBeenCalled();
  });

  // Test 8
  it("onDispose callbacks execute in reverse order (LIFO)", () => {
    const order: number[] = [];

    api.onDispose(() => order.push(1));
    api.onDispose(() => order.push(2));
    api.onDispose(() => order.push(3));

    api.cleanup();

    expect(order).toEqual([3, 2, 1]);
  });

  // Test 9
  it("cleanup continues after disposable error", () => {
    const fn1 = vi.fn();
    const fn3 = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Register in reverse since they execute LIFO: fn3 (last registered = first to run)
    api.onDispose(fn1); // runs 3rd (index 0, last in reverse)
    api.onDispose(() => {
      throw new Error("disposable failure");
    }); // runs 2nd (index 1)
    api.onDispose(fn3); // runs 1st (index 2)

    api.cleanup();

    // Both fn1 and fn3 should have been called despite the error
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn3).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[ExtensionAPI] Error in disposable"),
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  // Test 10: coreOverride registers without namespace
  it("registers blade with original type when coreOverride is true", () => {
    const api2 = new ExtensionAPI("content-viewers");
    api2.registerBlade({
      type: "viewer-markdown",
      title: "Markdown Preview",
      component: () => null,
      coreOverride: true,
    });
    expect(getBladeRegistration("viewer-markdown")).toBeDefined();
    expect(getBladeRegistration("ext:content-viewers:viewer-markdown")).toBeUndefined();
    api2.cleanup();
  });

  // Test 11: coreOverride cleanup
  it("cleanup removes coreOverride blades correctly", () => {
    const api2 = new ExtensionAPI("content-viewers");
    api2.registerBlade({
      type: "viewer-markdown",
      title: "Markdown Preview",
      component: () => null,
      coreOverride: true,
    });
    expect(getBladeRegistration("viewer-markdown")).toBeDefined();
    api2.cleanup();
    expect(getBladeRegistration("viewer-markdown")).toBeUndefined();
  });

  // Test 12
  it("cleanup resets tracking arrays so second cleanup only removes second batch", () => {
    // First batch
    api.contributeContextMenu({
      id: "item-1",
      label: "First",
      location: "file-tree",
      execute: vi.fn(),
    });

    api.cleanup();
    expect(useContextMenuRegistry.getState().items.size).toBe(0);

    // Second batch
    api.contributeContextMenu({
      id: "item-2",
      label: "Second",
      location: "file-tree",
      execute: vi.fn(),
    });

    expect(useContextMenuRegistry.getState().items.has("ext:test-ext:item-2")).toBe(true);

    // Second cleanup should only remove the second item, not error on missing first
    api.cleanup();
    expect(useContextMenuRegistry.getState().items.size).toBe(0);
  });
});
