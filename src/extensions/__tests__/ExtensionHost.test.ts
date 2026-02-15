import { vi, describe, it, expect, beforeEach } from "vitest";
import { useExtensionHost } from "@/framework/extension-system/ExtensionHost";
import type { BuiltInExtensionConfig } from "@/framework/extension-system/types";
import { useToolbarRegistry } from "../../core/lib/toolbarRegistry";
import type { LucideIcon } from "lucide-react";

// Mock Tauri / infrastructure dependencies
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));
vi.mock("../../bindings", () => ({
  commands: {
    discoverExtensions: vi.fn(),
  },
}));
vi.mock("../../core/lib/store", () => ({
  getStore: vi.fn(async () => ({
    get: vi.fn(async () => []),
    set: vi.fn(),
    save: vi.fn(),
  })),
}));
vi.mock("../../core/stores/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

// Minimal stub icon
const FakeIcon = (() => null) as unknown as LucideIcon;

/** Create a simple built-in extension config for testing */
function createTestConfig(
  overrides?: Partial<BuiltInExtensionConfig>,
): BuiltInExtensionConfig {
  return {
    id: "test-ext",
    name: "Test Extension",
    version: "1.0.0",
    activate: vi.fn(async () => {}),
    deactivate: vi.fn(),
    ...overrides,
  };
}

describe("ExtensionHost", () => {
  beforeEach(() => {
    // Reset the store to initial state
    useExtensionHost.setState({
      extensions: new Map(),
      isDiscovering: false,
    });
    // Reset toolbar registry
    useToolbarRegistry.setState({ actions: new Map(), visibilityTick: 0 });
  });

  // --- registerBuiltIn ---

  it("registerBuiltIn creates ExtensionInfo with active status", async () => {
    const config = createTestConfig();
    await useExtensionHost.getState().registerBuiltIn(config);

    const ext = useExtensionHost.getState().extensions.get("test-ext");
    expect(ext).toBeDefined();
    expect(ext!.status).toBe("active");
  });

  it("registerBuiltIn sets trustLevel to built-in", async () => {
    const config = createTestConfig();
    await useExtensionHost.getState().registerBuiltIn(config);

    const ext = useExtensionHost.getState().extensions.get("test-ext");
    expect(ext!.trustLevel).toBe("built-in");
  });

  it("registerBuiltIn sets builtIn flag to true", async () => {
    const config = createTestConfig();
    await useExtensionHost.getState().registerBuiltIn(config);

    const ext = useExtensionHost.getState().extensions.get("test-ext");
    expect(ext!.builtIn).toBe(true);
  });

  it("registerBuiltIn calls the activate callback with an ExtensionAPI", async () => {
    const activateFn = vi.fn(async () => {});
    const config = createTestConfig({ activate: activateFn });

    await useExtensionHost.getState().registerBuiltIn(config);

    expect(activateFn).toHaveBeenCalledTimes(1);
    expect(activateFn).toHaveBeenCalledWith(
      expect.objectContaining({ registerBlade: expect.any(Function) }),
    );
  });

  // --- Deactivation ---

  it("deactivateExtension transitions to disabled status", async () => {
    const config = createTestConfig();
    await useExtensionHost.getState().registerBuiltIn(config);
    expect(useExtensionHost.getState().extensions.get("test-ext")!.status).toBe("active");

    await useExtensionHost.getState().deactivateExtension("test-ext");
    expect(useExtensionHost.getState().extensions.get("test-ext")!.status).toBe("disabled");
  });

  it("deactivateExtension calls api.cleanup() removing registrations", async () => {
    const config = createTestConfig({
      activate: async (api) => {
        api.contributeToolbar({
          id: "test-action",
          label: "Test",
          icon: FakeIcon,
          group: "app",
          priority: 50,
          execute: () => {},
        });
      },
    });

    await useExtensionHost.getState().registerBuiltIn(config);
    expect(useToolbarRegistry.getState().actions.has("ext:test-ext:test-action")).toBe(true);

    await useExtensionHost.getState().deactivateExtension("test-ext");
    expect(useToolbarRegistry.getState().actions.has("ext:test-ext:test-action")).toBe(false);
  });

  it("deactivateExtension calls onDeactivate callback", async () => {
    const deactivateFn = vi.fn();
    const config = createTestConfig({ deactivate: deactivateFn });

    await useExtensionHost.getState().registerBuiltIn(config);
    await useExtensionHost.getState().deactivateExtension("test-ext");

    expect(deactivateFn).toHaveBeenCalledTimes(1);
  });

  // --- Re-activation ---

  it("re-activation after deactivation works", async () => {
    const activateFn = vi.fn(async () => {});
    const config = createTestConfig({ activate: activateFn });

    await useExtensionHost.getState().registerBuiltIn(config);
    expect(activateFn).toHaveBeenCalledTimes(1);

    await useExtensionHost.getState().deactivateExtension("test-ext");
    expect(useExtensionHost.getState().extensions.get("test-ext")!.status).toBe("disabled");

    await useExtensionHost.getState().activateExtension("test-ext");
    expect(useExtensionHost.getState().extensions.get("test-ext")!.status).toBe("active");
    expect(activateFn).toHaveBeenCalledTimes(2);
  });

  // --- Error recovery ---

  it("activation failure sets error status and cleans up", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const config = createTestConfig({
      activate: async (api) => {
        // Register something before failing
        api.contributeToolbar({
          id: "partial-action",
          label: "Partial",
          icon: FakeIcon,
          group: "app",
          priority: 50,
          execute: () => {},
        });
        throw new Error("activation boom");
      },
    });

    await useExtensionHost.getState().registerBuiltIn(config);

    const ext = useExtensionHost.getState().extensions.get("test-ext");
    expect(ext!.status).toBe("error");
    expect(ext!.error).toBe("activation boom");

    // Partial toolbar registration should be cleaned up
    expect(useToolbarRegistry.getState().actions.has("ext:test-ext:partial-action")).toBe(false);

    errorSpy.mockRestore();
  });
});
