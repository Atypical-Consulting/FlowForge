import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { getBladeRegistration } from "@/framework/layout/bladeRegistry";
import { onActivate, onDeactivate } from "../viewer-code";

describe("viewer-code extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("viewer-code");
  });

  it("registers viewer-code blade type on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("viewer-code")).toBeDefined();

    api.cleanup();
  });

  it("registers blade type without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    expect(getBladeRegistration("ext:viewer-code:viewer-code")).toBeUndefined();

    api.cleanup();
  });

  it("marks blade as lazy for Suspense wrapping", async () => {
    await onActivate(api);

    const code = getBladeRegistration("viewer-code");
    expect(code?.lazy).toBe(true);

    api.cleanup();
  });

  it("tracks source as ext:viewer-code for cleanup", async () => {
    await onActivate(api);

    const code = getBladeRegistration("viewer-code");
    expect(code?.source).toBe("ext:viewer-code");

    api.cleanup();
  });

  it("unregisters blade type on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("viewer-code")).toBeUndefined();
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
