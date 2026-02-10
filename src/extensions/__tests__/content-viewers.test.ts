import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../lib/bladeRegistry";
import { onActivate, onDeactivate } from "../content-viewers";

describe("content-viewers extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("content-viewers");
  });

  it("registers three viewer blade types on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("viewer-markdown")).toBeDefined();
    expect(getBladeRegistration("viewer-code")).toBeDefined();
    expect(getBladeRegistration("viewer-3d")).toBeDefined();

    api.cleanup();
  });

  it("registers blade types without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    // Should NOT be namespaced
    expect(getBladeRegistration("ext:content-viewers:viewer-markdown")).toBeUndefined();
    expect(getBladeRegistration("ext:content-viewers:viewer-code")).toBeUndefined();
    expect(getBladeRegistration("ext:content-viewers:viewer-3d")).toBeUndefined();

    api.cleanup();
  });

  it("marks all blades as lazy for Suspense wrapping", async () => {
    await onActivate(api);

    const md = getBladeRegistration("viewer-markdown");
    const code = getBladeRegistration("viewer-code");
    const v3d = getBladeRegistration("viewer-3d");

    expect(md?.lazy).toBe(true);
    expect(code?.lazy).toBe(true);
    expect(v3d?.lazy).toBe(true);

    api.cleanup();
  });

  it("tracks source as ext:content-viewers for cleanup", async () => {
    await onActivate(api);

    const md = getBladeRegistration("viewer-markdown");
    expect(md?.source).toBe("ext:content-viewers");

    api.cleanup();
  });

  it("unregisters all blade types on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("viewer-markdown")).toBeUndefined();
    expect(getBladeRegistration("viewer-code")).toBeUndefined();
    expect(getBladeRegistration("viewer-3d")).toBeUndefined();
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    // Should not throw
    expect(() => onDeactivate()).not.toThrow();
  });
});
