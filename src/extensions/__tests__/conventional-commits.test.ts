import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { getBladeRegistration } from "@/framework/layout/bladeRegistry";
import { onActivate, onDeactivate } from "../conventional-commits";

describe("conventional-commits extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("conventional-commits");
  });

  it("registers conventional-commit and changelog blade types on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("conventional-commit")).toBeDefined();
    expect(getBladeRegistration("changelog")).toBeDefined();

    api.cleanup();
  });

  it("registers blade types without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    // Should NOT be namespaced
    expect(getBladeRegistration("ext:conventional-commits:conventional-commit")).toBeUndefined();
    expect(getBladeRegistration("ext:conventional-commits:changelog")).toBeUndefined();

    api.cleanup();
  });

  it("marks both blades as lazy for Suspense wrapping", async () => {
    await onActivate(api);

    const cc = getBladeRegistration("conventional-commit");
    const changelog = getBladeRegistration("changelog");

    expect(cc?.lazy).toBe(true);
    expect(changelog?.lazy).toBe(true);

    api.cleanup();
  });

  it("marks both blades as singletons", async () => {
    await onActivate(api);

    const cc = getBladeRegistration("conventional-commit");
    const changelog = getBladeRegistration("changelog");

    expect(cc?.singleton).toBe(true);
    expect(changelog?.singleton).toBe(true);

    api.cleanup();
  });

  it("tracks source as ext:conventional-commits for cleanup", async () => {
    await onActivate(api);

    const cc = getBladeRegistration("conventional-commit");
    expect(cc?.source).toBe("ext:conventional-commits");

    const changelog = getBladeRegistration("changelog");
    expect(changelog?.source).toBe("ext:conventional-commits");

    api.cleanup();
  });

  it("unregisters all blade types on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("conventional-commit")).toBeUndefined();
    expect(getBladeRegistration("changelog")).toBeUndefined();
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    // Should not throw
    expect(() => onDeactivate()).not.toThrow();
  });
});
