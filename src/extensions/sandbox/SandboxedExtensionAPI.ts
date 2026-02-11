import { REQUIRES_TRUST_METHODS } from "./sandbox-api-surface";
import type { RequiresTrustMethod } from "./sandbox-api-surface";
import type { ExtensionAPI, BladeNavigationEvent } from "../ExtensionAPI";
import type { GitOperation, DidHandler, WillHandler } from "../../core/lib/gitHookBus";
import type { Disposable } from "../ExtensionAPI";

/**
 * Restricted API proxy for sandboxed (untrusted) extensions.
 *
 * Exposes only sandbox-safe methods. Calling any requires-trust method
 * throws a descriptive error explaining what trust level is needed.
 *
 * Blocked method stubs are generated dynamically from REQUIRES_TRUST_METHODS
 * in the constructor — adding a new requires-trust method only needs an
 * update to sandbox-api-surface.ts plus a type declaration here.
 */
export class SandboxedExtensionAPI {
  private hostApi: ExtensionAPI;

  // Blocked methods (dynamically assigned from REQUIRES_TRUST_METHODS in constructor)
  registerBlade!: () => never;
  registerCommand!: () => never;
  contributeToolbar!: () => never;
  contributeContextMenu!: () => never;
  contributeSidebarPanel!: () => never;
  contributeStatusBar!: () => never;

  constructor(hostApi: ExtensionAPI) {
    this.hostApi = hostApi;

    for (const method of REQUIRES_TRUST_METHODS) {
      (this as any)[method] = () => {
        throw this.trustError(method);
      };
    }
  }

  // --- Sandbox-safe methods ---

  onDidGit(operation: GitOperation, handler: DidHandler): void {
    this.hostApi.onDidGit(operation, handler);
  }

  onWillGit(operation: GitOperation, handler: WillHandler): void {
    this.hostApi.onWillGit(operation, handler);
  }

  onDispose(disposable: Disposable): void {
    this.hostApi.onDispose(disposable);
  }

  onDidNavigate(handler: (event: BladeNavigationEvent) => void): () => void {
    return this.hostApi.onDidNavigate(handler);
  }

  get events() {
    return this.hostApi.events;
  }

  get settings() {
    return this.hostApi.settings;
  }

  private trustError(method: string): Error {
    return new Error(
      `${method}() requires trust level "built-in" or "user-trusted". ` +
      `Sandboxed extensions cannot call this method because it requires ` +
      `React component references or closure access that cannot be ` +
      `serialized across the Worker boundary.`
    );
  }
}

// Compile-time exhaustiveness check: ensures all REQUIRES_TRUST_METHODS
// have corresponding type declarations on the class.
type _AssertTrustCovered = {
  [K in RequiresTrustMethod]: SandboxedExtensionAPI[K];
};
