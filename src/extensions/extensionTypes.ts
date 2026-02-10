import type { ExtensionManifest } from "./extensionManifest";

export type ExtensionStatus =
  | "discovered" // Manifest found and parsed, not yet activated
  | "activating" // Entry point loading in progress
  | "active" // onActivate completed successfully
  | "error" // Failed to activate or incompatible apiVersion
  | "deactivated"; // Was active, now cleanly deactivated

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  status: ExtensionStatus;
  error?: string;
  manifest: ExtensionManifest;
}
