import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { getBladeRegistration } from "@/framework/layout/bladeRegistry";
import { useSidebarPanelRegistry } from "@/framework/layout/sidebarPanelRegistry";
import { useToolbarRegistry } from "../../core/lib/toolbarRegistry";
import { onActivate, onDeactivate } from "../gitflow";

describe("gitflow extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("gitflow");
  });

  it("registers gitflow-cheatsheet blade type on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("gitflow-cheatsheet")).toBeDefined();

    api.cleanup();
  });

  it("registers blade type without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    // Should NOT be namespaced
    expect(getBladeRegistration("ext:gitflow:gitflow-cheatsheet")).toBeUndefined();

    api.cleanup();
  });

  it("marks cheatsheet blade as lazy and singleton", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("gitflow-cheatsheet");
    expect(reg?.lazy).toBe(true);
    expect(reg?.singleton).toBe(true);

    api.cleanup();
  });

  it("tracks blade source as ext:gitflow for cleanup", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("gitflow-cheatsheet");
    expect(reg?.source).toBe("ext:gitflow");

    api.cleanup();
  });

  it("registers gitflow sidebar panel on activation", async () => {
    await onActivate(api);

    const panels = useSidebarPanelRegistry.getState().panels;
    expect(panels.has("ext:gitflow:gitflow-panel")).toBe(true);

    api.cleanup();
  });

  it("sidebar panel has priority 65 and defaultOpen false", async () => {
    await onActivate(api);

    const panel = useSidebarPanelRegistry.getState().panels.get("ext:gitflow:gitflow-panel");
    expect(panel?.priority).toBe(65);
    expect(panel?.defaultOpen).toBe(false);

    api.cleanup();
  });

  it("registers toolbar action on activation", async () => {
    await onActivate(api);

    const actions = useToolbarRegistry.getState().actions;
    expect(actions.has("ext:gitflow:gitflow-guide")).toBe(true);

    api.cleanup();
  });

  it("unregisters all registrations on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("gitflow-cheatsheet")).toBeUndefined();
    expect(useSidebarPanelRegistry.getState().panels.has("ext:gitflow:gitflow-panel")).toBe(false);
    expect(useToolbarRegistry.getState().actions.has("ext:gitflow:gitflow-guide")).toBe(false);
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
