/**
 * API method classification for sandbox trust boundaries.
 *
 * Methods classified as "sandbox-safe" can be proxied to Worker-based
 * sandboxed extensions via postMessage. Methods classified as
 * "requires-trust" need direct host-thread access (React components,
 * Zustand stores, closures).
 */

/** Methods safe to call from a Worker sandbox (serializable I/O) */
export const SANDBOX_SAFE_METHODS = [
  "onDidGit",
  "onWillGit",
  "onDispose",
  "onDidNavigate",
  "events",
  "settings",
] as const;

/** Methods that require trust level "built-in" or "user-trusted" */
export const REQUIRES_TRUST_METHODS = [
  "registerBlade",
  "registerCommand",
  "contributeToolbar",
  "contributeContextMenu",
  "contributeSidebarPanel",
  "contributeStatusBar",
] as const;

export type SandboxSafeMethod = (typeof SANDBOX_SAFE_METHODS)[number];
export type RequiresTrustMethod = (typeof REQUIRES_TRUST_METHODS)[number];

/** Check if a method name is sandbox-safe */
export function isSandboxSafe(method: string): method is SandboxSafeMethod {
  return (SANDBOX_SAFE_METHODS as readonly string[]).includes(method);
}
