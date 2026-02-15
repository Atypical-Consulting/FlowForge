import type { ExtensionAPI } from "./ExtensionAPI";
import type { ExtensionManifest } from "../../extensions/extensionManifest";

export type TrustLevel = "built-in" | "user-trusted" | "sandboxed";

export type ExtensionStatus =
  | "discovered" // Manifest found and parsed, not yet activated
  | "activating" // Entry point loading in progress
  | "active" // onActivate completed successfully
  | "error" // Failed to activate or incompatible apiVersion
  | "deactivated" // Was active, now cleanly deactivated
  | "disabled"; // Intentionally disabled by user (persisted)

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  status: ExtensionStatus;
  error?: string;
  manifest: ExtensionManifest;
  builtIn?: boolean;
  trustLevel: TrustLevel;
}

/** Configuration for registering a built-in (bundled) extension. */
export interface BuiltInExtensionConfig {
  id: string;
  name: string;
  version: string;
  activate: (api: ExtensionAPI) => Promise<void>;
  deactivate?: () => Promise<void> | void;
}
