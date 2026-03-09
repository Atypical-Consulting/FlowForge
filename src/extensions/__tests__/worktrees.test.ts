import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock git-ops store
vi.mock("../../core/stores/domain/git-ops", () => ({
  useGitOpsStore: {
    getState: () => ({
      repoStatus: null,
      worktreeList: [],
      loadWorktrees: vi.fn(),
    }),
  },
}));

import { getCommandById } from "@/framework/command-palette/commandRegistry";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { useSidebarPanelRegistry } from "@/framework/layout/sidebarPanelRegistry";
import { onActivate, onDeactivate } from "../worktrees";

describe("worktrees extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("worktrees");
  });

  it("registers worktree sidebar panel on activation", async () => {
    await onActivate(api);

    const panels = useSidebarPanelRegistry.getState().items;
    expect(panels.has("ext:worktrees:worktree-panel")).toBe(true);

    api.cleanup();
  });

  it("sidebar panel has priority 69 and defaultOpen false", async () => {
    await onActivate(api);

    const panel = useSidebarPanelRegistry
      .getState()
      .items.get("ext:worktrees:worktree-panel");
    expect(panel?.priority).toBe(69);
    expect(panel?.defaultOpen).toBe(false);

    api.cleanup();
  });

  it("registers create-worktree command on activation", async () => {
    await onActivate(api);

    expect(getCommandById("ext:worktrees:create-worktree")).toBeDefined();

    api.cleanup();
  });

  it("registers refresh-worktrees command on activation", async () => {
    await onActivate(api);

    expect(getCommandById("ext:worktrees:refresh-worktrees")).toBeDefined();

    api.cleanup();
  });

  it("unregisters all registrations on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(
      useSidebarPanelRegistry
        .getState()
        .items.has("ext:worktrees:worktree-panel"),
    ).toBe(false);
    expect(getCommandById("ext:worktrees:create-worktree")).toBeUndefined();
    expect(getCommandById("ext:worktrees:refresh-worktrees")).toBeUndefined();
  });

  it("re-activation after cleanup restores registrations", async () => {
    await onActivate(api);
    api.cleanup();

    const api2 = new ExtensionAPI("worktrees");
    await onActivate(api2);

    expect(
      useSidebarPanelRegistry
        .getState()
        .items.has("ext:worktrees:worktree-panel"),
    ).toBe(true);
    expect(getCommandById("ext:worktrees:create-worktree")).toBeDefined();

    api2.cleanup();
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
