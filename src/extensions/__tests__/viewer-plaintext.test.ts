import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../core/lib/bladeRegistry";
import { onActivate, onDeactivate } from "../viewer-plaintext";

describe("viewer-plaintext extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("viewer-plaintext");
  });

  it("registers viewer-plaintext blade type on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("viewer-plaintext")).toBeDefined();

    api.cleanup();
  });

  it("registers blade type without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    expect(getBladeRegistration("ext:viewer-plaintext:viewer-plaintext")).toBeUndefined();

    api.cleanup();
  });

  it("marks blade as lazy for Suspense wrapping", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("viewer-plaintext");
    expect(reg?.lazy).toBe(true);

    api.cleanup();
  });

  it("tracks source as ext:viewer-plaintext for cleanup", async () => {
    await onActivate(api);

    const reg = getBladeRegistration("viewer-plaintext");
    expect(reg?.source).toBe("ext:viewer-plaintext");

    api.cleanup();
  });

  it("unregisters blade type on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("viewer-plaintext")).toBeUndefined();
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
