import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock @tauri-apps/api/event (listen returns an unlisten function)
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(vi.fn())),
}));

// Mock @tauri-apps/plugin-store (used for settings/defaultTab)
vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn(() =>
      Promise.resolve({
        get: vi.fn(() => Promise.resolve(null)),
      })
    ),
  },
}));

// Mock navigation actor
vi.mock("../../core/machines/navigation/context", () => ({
  getNavigationActor: vi.fn(() => ({
    send: vi.fn(),
  })),
}));

// Mock git-ops store
vi.mock("../../core/stores/domain/git-ops", () => ({
  useGitOpsStore: {
    getState: () => ({
      repoStatus: null,
      nodes: [],
      loadGraph: vi.fn(),
    }),
  },
}));

import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { getBladeRegistration } from "@/framework/layout/bladeRegistry";
import { getCommandById } from "@/framework/command-palette/commandRegistry";
import { onActivate, onDeactivate } from "../topology";

describe("topology extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("topology");
  });

  it("registers topology-graph blade type on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("topology-graph")).toBeDefined();

    api.cleanup();
  });

  it("registers blade type without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    expect(getBladeRegistration("ext:topology:topology-graph")).toBeUndefined();

    api.cleanup();
  });

  it("marks topology blade as lazy and singleton", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("topology-graph");
    expect(reg?.lazy).toBe(true);
    expect(reg?.singleton).toBe(true);

    api.cleanup();
  });

  it("tracks blade source as ext:topology for cleanup", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("topology-graph");
    expect(reg?.source).toBe("ext:topology");

    api.cleanup();
  });

  it("registers show-topology command on activation", async () => {
    await onActivate(api);

    expect(getCommandById("ext:topology:show-topology")).toBeDefined();

    api.cleanup();
  });

  it("show-topology command has category Navigation", async () => {
    await onActivate(api);

    const cmd = getCommandById("ext:topology:show-topology");
    expect(cmd?.category).toBe("Navigation");

    api.cleanup();
  });

  it("unregisters all registrations on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("topology-graph")).toBeUndefined();
    expect(getCommandById("ext:topology:show-topology")).toBeUndefined();
  });

  it("re-activation after cleanup restores registrations", async () => {
    await onActivate(api);
    api.cleanup();

    const api2 = new ExtensionAPI("topology");
    await onActivate(api2);

    expect(getBladeRegistration("topology-graph")).toBeDefined();
    expect(getCommandById("ext:topology:show-topology")).toBeDefined();

    api2.cleanup();
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
