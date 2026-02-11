import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock bladeOpener
vi.mock("../../core/lib/bladeOpener", () => ({
  openBlade: vi.fn(),
}));

// Mock the init-repo store
vi.mock("../init-repo/store", () => ({
  useInitRepoStore: {
    getState: () => ({
      reset: vi.fn(),
    }),
  },
}));

import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../core/lib/bladeRegistry";
import { getCommandById } from "../../core/lib/commandRegistry";
import { onActivate, onDeactivate } from "../init-repo";

describe("init-repo extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("init-repo");
  });

  it("registers init-repo blade type on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("init-repo")).toBeDefined();

    api.cleanup();
  });

  it("registers blade type without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    expect(getBladeRegistration("ext:init-repo:init-repo")).toBeUndefined();

    api.cleanup();
  });

  it("marks blade as lazy and singleton", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("init-repo");
    expect(reg?.lazy).toBe(true);
    expect(reg?.singleton).toBe(true);

    api.cleanup();
  });

  it("tracks blade source as ext:init-repo for cleanup", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("init-repo");
    expect(reg?.source).toBe("ext:init-repo");

    api.cleanup();
  });

  it("registers init-repository command on activation", async () => {
    await onActivate(api);

    expect(getCommandById("ext:init-repo:init-repository")).toBeDefined();

    api.cleanup();
  });

  it("init-repository command has category Repository", async () => {
    await onActivate(api);

    const cmd = getCommandById("ext:init-repo:init-repository");
    expect(cmd?.category).toBe("Repository");

    api.cleanup();
  });

  it("unregisters all registrations on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("init-repo")).toBeUndefined();
    expect(getCommandById("ext:init-repo:init-repository")).toBeUndefined();
  });

  it("re-activation after cleanup restores registrations", async () => {
    await onActivate(api);
    api.cleanup();

    const api2 = new ExtensionAPI("init-repo");
    await onActivate(api2);

    expect(getBladeRegistration("init-repo")).toBeDefined();
    expect(getCommandById("ext:init-repo:init-repository")).toBeDefined();

    api2.cleanup();
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
