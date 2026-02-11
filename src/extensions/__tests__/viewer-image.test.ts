import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../core/lib/bladeRegistry";
import { onActivate, onDeactivate } from "../viewer-image";

describe("viewer-image extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("viewer-image");
  });

  it("registers viewer-image blade type on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("viewer-image")).toBeDefined();

    api.cleanup();
  });

  it("registers blade type without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    expect(getBladeRegistration("ext:viewer-image:viewer-image")).toBeUndefined();

    api.cleanup();
  });

  it("marks blade as lazy for Suspense wrapping", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("viewer-image");
    expect(reg?.lazy).toBe(true);

    api.cleanup();
  });

  it("tracks source as ext:viewer-image for cleanup", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("viewer-image");
    expect(reg?.source).toBe("ext:viewer-image");

    api.cleanup();
  });

  it("unregisters blade type on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("viewer-image")).toBeUndefined();
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
