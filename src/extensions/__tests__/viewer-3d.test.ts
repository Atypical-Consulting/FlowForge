import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { getBladeRegistration } from "@/framework/layout/bladeRegistry";
import { onActivate, onDeactivate } from "../viewer-3d";

describe("viewer-3d extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("viewer-3d");
  });

  it("registers viewer-3d blade type on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("viewer-3d")).toBeDefined();

    api.cleanup();
  });

  it("registers blade type without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    expect(getBladeRegistration("ext:viewer-3d:viewer-3d")).toBeUndefined();

    api.cleanup();
  });

  it("marks blade as lazy for Suspense wrapping", async () => {
    await onActivate(api);

    const v3d = getBladeRegistration("viewer-3d");
    expect(v3d?.lazy).toBe(true);

    api.cleanup();
  });

  it("tracks source as ext:viewer-3d for cleanup", async () => {
    await onActivate(api);

    const v3d = getBladeRegistration("viewer-3d");
    expect(v3d?.source).toBe("ext:viewer-3d");

    api.cleanup();
  });

  it("unregisters blade type on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("viewer-3d")).toBeUndefined();
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
