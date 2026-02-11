import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../lib/bladeRegistry";
import { onActivate, onDeactivate } from "../viewer-markdown";

describe("viewer-markdown extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("viewer-markdown");
  });

  it("registers viewer-markdown blade type on activation", async () => {
    await onActivate(api);

    expect(getBladeRegistration("viewer-markdown")).toBeDefined();

    api.cleanup();
  });

  it("registers blade type without ext: namespace (coreOverride)", async () => {
    await onActivate(api);

    expect(getBladeRegistration("ext:viewer-markdown:viewer-markdown")).toBeUndefined();

    api.cleanup();
  });

  it("marks blade as lazy for Suspense wrapping", async () => {
    await onActivate(api);

    const md = getBladeRegistration("viewer-markdown");
    expect(md?.lazy).toBe(true);

    api.cleanup();
  });

  it("tracks source as ext:viewer-markdown for cleanup", async () => {
    await onActivate(api);

    const md = getBladeRegistration("viewer-markdown");
    expect(md?.source).toBe("ext:viewer-markdown");

    api.cleanup();
  });

  it("unregisters blade type on cleanup", async () => {
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("viewer-markdown")).toBeUndefined();
  });

  it("onDeactivate is a no-op (cleanup handled by ExtensionAPI)", () => {
    expect(() => onDeactivate()).not.toThrow();
  });
});
