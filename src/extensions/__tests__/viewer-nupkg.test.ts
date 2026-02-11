import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../core/lib/bladeRegistry";
import { onActivate, onDeactivate } from "../viewer-nupkg";

describe("viewer-nupkg extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("viewer-nupkg");
  });

  it("registers viewer-nupkg blade type on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("viewer-nupkg")).toBeDefined();

    api.cleanup();
  });

  it("registers blade type without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    expect(getBladeRegistration("ext:viewer-nupkg:viewer-nupkg")).toBeUndefined();

    api.cleanup();
  });

  it("marks blade as lazy for Suspense wrapping", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("viewer-nupkg");
    expect(reg?.lazy).toBe(true);

    api.cleanup();
  });

  it("tracks source as ext:viewer-nupkg for cleanup", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("viewer-nupkg");
    expect(reg?.source).toBe("ext:viewer-nupkg");

    api.cleanup();
  });

  it("unregisters blade type on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("viewer-nupkg")).toBeUndefined();
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
