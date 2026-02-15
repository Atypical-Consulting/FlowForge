import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { convertFileSrc } from "@tauri-apps/api/core";
import { toast } from "../stores/toast";
import { getStore } from "../stores/persistence/tauri";
import { ExtensionAPI } from "./ExtensionAPI";
import type { BuiltInExtensionConfig, ExtensionInfo } from "./types";
import type { ExtensionManifest } from "./manifest";

// ---------------------------------------------------------------------------
// Dependency Injection
// ---------------------------------------------------------------------------

interface ExtensionHostDeps {
  /** Discover extensions on the filesystem and return their manifests. */
  discoverExtensions: (path: string) => Promise<{ status: "ok"; data: ExtensionManifest[] } | { status: "error"; error: string }>;
}

let hostDeps: ExtensionHostDeps | null = null;

/**
 * Configure the ExtensionHost with platform-specific dependencies.
 * Must be called before `discoverExtensions` is used.
 */
export function configureExtensionHost(deps: ExtensionHostDeps): void {
  hostDeps = deps;
}

function getHostDeps(): ExtensionHostDeps {
  if (!hostDeps) {
    throw new Error(
      "[ExtensionHost] Not configured. Call configureExtensionHost() before using the extension host.",
    );
  }
  return hostDeps;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current extension API version. Extensions must declare this value. */
export const CURRENT_API_VERSION = "1";

// ---------------------------------------------------------------------------
// Module-level Maps (NOT in the Zustand store -- hold JS references)
// ---------------------------------------------------------------------------

/** Per-extension API facade instances (created at activation) */
const extensionApis = new Map<string, ExtensionAPI>();

/** Loaded extension modules (for calling onDeactivate) */
const extensionModules = new Map<string, any>();

/** Built-in extension configs (survive deactivation for re-activation) */
const builtInConfigs = new Map<string, BuiltInExtensionConfig>();

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface ExtensionHostState {
  extensions: Map<string, ExtensionInfo>;
  isDiscovering: boolean;

  discoverExtensions: (repoPath: string) => Promise<void>;
  activateExtension: (id: string) => Promise<void>;
  deactivateExtension: (id: string) => Promise<void>;
  activateAll: () => Promise<void>;
  deactivateAll: () => Promise<void>;
  registerBuiltIn: (config: BuiltInExtensionConfig) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Persist disabled extension IDs to tauri-plugin-store */
async function persistDisabledExtensions(extensions: Map<string, ExtensionInfo>): Promise<void> {
  try {
    const store = await getStore();
    const disabledIds = Array.from(extensions.values())
      .filter((ext) => ext.status === "deactivated" || ext.status === "disabled")
      .map((ext) => ext.id);
    await store.set("disabledExtensions", disabledIds);
    await store.save();
  } catch (e) {
    console.error("Failed to persist extension state:", e);
  }
}

/** Load disabled extension IDs from tauri-plugin-store */
async function loadDisabledExtensions(): Promise<string[]> {
  try {
    const store = await getStore();
    const disabledIds = await store.get<string[]>("disabledExtensions");
    return disabledIds ?? [];
  } catch {
    return [];
  }
}

/** Immutable Map update -- Zustand needs a new reference to trigger re-renders */
function updateExtension(
  get: () => ExtensionHostState,
  set: (
    partial: Partial<ExtensionHostState>,
    replace?: false,
    action?: string,
  ) => void,
  id: string,
  patch: Partial<ExtensionInfo>,
): void {
  const next = new Map(get().extensions);
  const existing = next.get(id);
  if (existing) {
    next.set(id, { ...existing, ...patch });
    set({ extensions: next }, false, `extension-host/update:${id}`);
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useExtensionHost = create<ExtensionHostState>()(
  devtools(
    (set, get) => ({
      extensions: new Map<string, ExtensionInfo>(),
      isDiscovering: false,

      // -------------------------------------------------------------------
      // Discovery
      // -------------------------------------------------------------------

      discoverExtensions: async (repoPath: string) => {
        set({ isDiscovering: true }, false, "extension-host/discover:start");

        const extensionsDir = repoPath + "/.flowforge/extensions";

        try {
          const result = await getHostDeps().discoverExtensions(extensionsDir);

          if (result.status === "error") {
            console.error(
              "Extension discovery failed:",
              result.error,
            );
            toast.error(`Extension discovery failed: ${result.error}`);
            set(
              { isDiscovering: false },
              false,
              "extension-host/discover:error",
            );
            return;
          }

          const manifests: ExtensionManifest[] = result.data;
          // Preserve built-in extensions when rebuilding the map
          const next = new Map<string, ExtensionInfo>();
          for (const [existingId, existingExt] of get().extensions) {
            if (existingExt.builtIn) {
              next.set(existingId, existingExt);
            }
          }

          for (const manifest of manifests) {
            if (manifest.apiVersion !== CURRENT_API_VERSION) {
              // Incompatible API version -- reject immediately
              next.set(manifest.id, {
                id: manifest.id,
                name: manifest.name,
                version: manifest.version,
                status: "error",
                error: `Incompatible API version: expected ${CURRENT_API_VERSION}, got ${manifest.apiVersion}`,
                manifest,
                trustLevel: (manifest as any).trustLevel ?? "sandboxed",
              });
              toast.error(
                `Extension "${manifest.name}" requires API version ${manifest.apiVersion} (current: ${CURRENT_API_VERSION})`,
              );
            } else {
              next.set(manifest.id, {
                id: manifest.id,
                name: manifest.name,
                version: manifest.version,
                status: "discovered",
                manifest,
                trustLevel: (manifest as any).trustLevel ?? "sandboxed",
              });
            }
          }

          set(
            { extensions: next, isDiscovering: false },
            false,
            "extension-host/discover:done",
          );
        } catch (e) {
          console.error("Extension discovery threw:", e);
          set(
            { isDiscovering: false },
            false,
            "extension-host/discover:error",
          );
        }
      },

      // -------------------------------------------------------------------
      // Activation
      // -------------------------------------------------------------------

      activateExtension: async (id: string) => {
        const ext = get().extensions.get(id);
        if (!ext || (ext.status !== "discovered" && ext.status !== "disabled" && ext.status !== "deactivated")) return;

        // Built-in extensions use their stored config instead of filesystem import
        const builtInConfig = builtInConfigs.get(id);
        if (ext.builtIn && builtInConfig) {
          updateExtension(get, set, id, { status: "activating" });
          const api = new ExtensionAPI(id);
          try {
            await builtInConfig.activate(api);
            extensionApis.set(id, api);
            extensionModules.set(id, { onDeactivate: builtInConfig.deactivate });
            updateExtension(get, set, id, { status: "active", error: undefined });
            await persistDisabledExtensions(get().extensions);
          } catch (e) {
            api.cleanup();
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`Failed to activate built-in extension "${id}":`, e);
            updateExtension(get, set, id, { status: "error", error: errorMessage });
            toast.error(`Extension "${ext.name}" failed to activate: ${errorMessage}`);
          }
          return;
        }

        updateExtension(get, set, id, { status: "activating" });

        const api = new ExtensionAPI(id);

        try {
          // Build entry point URL from basePath + main using Tauri asset protocol
          const basePath = ext.manifest.basePath ?? "";
          const mainFile = ext.manifest.main;
          const filePath = basePath + "/" + mainFile;

          // convertFileSrc converts an absolute filesystem path to a URL
          // that the Tauri webview can load (asset:// protocol on desktop)
          const entryUrl = convertFileSrc(filePath);

          const module = await import(/* @vite-ignore */ entryUrl);

          if (typeof module.onActivate !== "function") {
            throw new Error(
              `Extension "${ext.name}" does not export an onActivate function`,
            );
          }

          await module.onActivate(api);

          // Store references for deactivation
          extensionApis.set(id, api);
          extensionModules.set(id, module);

          updateExtension(get, set, id, {
            status: "active",
            error: undefined,
          });

          // Persist re-enabled state
          await persistDisabledExtensions(get().extensions);
        } catch (e) {
          // Clean up any partial registrations made before the error
          api.cleanup();

          const errorMessage =
            e instanceof Error ? e.message : String(e);
          console.error(`Failed to activate extension "${id}":`, e);

          updateExtension(get, set, id, {
            status: "error",
            error: errorMessage,
          });

          toast.error(
            `Extension "${ext.name}" failed to activate: ${errorMessage}`,
          );
        }
      },

      // -------------------------------------------------------------------
      // Deactivation
      // -------------------------------------------------------------------

      deactivateExtension: async (id: string) => {
        const ext = get().extensions.get(id);
        if (!ext || ext.status !== "active") return;

        // Call onDeactivate if the extension exports it
        const module = extensionModules.get(id);
        if (module && typeof module.onDeactivate === "function") {
          try {
            await module.onDeactivate();
          } catch (e) {
            console.error(
              `Error during onDeactivate of extension "${id}":`,
              e,
            );
          }
        }

        // Clean up all registrations
        const api = extensionApis.get(id);
        if (api) {
          api.cleanup();
        }

        // Remove from module-level Maps
        extensionApis.delete(id);
        extensionModules.delete(id);

        updateExtension(get, set, id, { status: "disabled" });

        // Persist disabled state
        await persistDisabledExtensions(get().extensions);
      },

      // -------------------------------------------------------------------
      // Bulk operations
      // -------------------------------------------------------------------

      activateAll: async () => {
        const disabledIds = await loadDisabledExtensions();
        const disabledSet = new Set(disabledIds);
        const extensions = get().extensions;

        for (const [id, ext] of extensions) {
          if (ext.status === "discovered") {
            if (disabledSet.has(id)) {
              // Mark as disabled -- user intentionally disabled this extension
              updateExtension(get, set, id, { status: "disabled" });
            } else {
              await get().activateExtension(id);
            }
          }
        }
      },

      deactivateAll: async () => {
        const extensions = get().extensions;
        for (const [id, ext] of extensions) {
          if (ext.status === "active" && !ext.builtIn) {
            await get().deactivateExtension(id);
          }
        }
      },

      // -------------------------------------------------------------------
      // Built-in extension registration
      // -------------------------------------------------------------------

      registerBuiltIn: async (config) => {
        const { id, name, version, activate, deactivate } = config;

        // Store config so built-in extensions can be re-activated after deactivation
        builtInConfigs.set(id, config);

        // Create a synthetic manifest for tracking
        const manifest = {
          id,
          name,
          version,
          apiVersion: CURRENT_API_VERSION,
          main: "(built-in)",
          description: `Built-in extension: ${name}`,
          contributes: null,
          permissions: null,
        } as ExtensionManifest;

        // Register as discovered first
        const next = new Map(get().extensions);
        next.set(id, {
          id,
          name,
          version,
          status: "discovered",
          manifest,
          builtIn: true,
          trustLevel: "built-in" as const,
        });
        set(
          { extensions: next },
          false,
          `extension-host/register-builtin:${id}`,
        );

        // Now activate through the standard API facade
        const api = new ExtensionAPI(id);

        try {
          await activate(api);

          // Store references for deactivation
          extensionApis.set(id, api);
          // Store a synthetic module object with onDeactivate
          extensionModules.set(id, { onDeactivate: deactivate });

          updateExtension(get, set, id, {
            status: "active",
            error: undefined,
          });
        } catch (e) {
          api.cleanup();
          const errorMessage =
            e instanceof Error ? e.message : String(e);
          console.error(
            `Failed to activate built-in extension "${id}":`,
            e,
          );
          updateExtension(get, set, id, {
            status: "error",
            error: errorMessage,
          });
          toast.error(
            `Built-in extension "${name}" failed to activate: ${errorMessage}`,
          );
        }
      },
    }),
    { name: "extension-host", enabled: import.meta.env.DEV },
  ),
);
