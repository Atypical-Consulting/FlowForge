import { REQUIRES_TRUST_METHODS } from "./sandbox-api-surface";
import type { ExtensionAPI } from "../ExtensionAPI";
import type { GitOperation, DidHandler, WillHandler } from "../../lib/gitHookBus";
import type { Disposable } from "../ExtensionAPI";

/**
 * Restricted API proxy for sandboxed (untrusted) extensions.
 *
 * Exposes only sandbox-safe methods. Calling any requires-trust method
 * throws a descriptive error explaining what trust level is needed.
 */
export class SandboxedExtensionAPI {
  private hostApi: ExtensionAPI;

  constructor(hostApi: ExtensionAPI) {
    this.hostApi = hostApi;
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

  // --- Blocked methods (requires-trust) ---

  registerBlade(): never {
    throw this.trustError("registerBlade");
  }

  registerCommand(): never {
    throw this.trustError("registerCommand");
  }

  contributeToolbar(): never {
    throw this.trustError("contributeToolbar");
  }

  contributeContextMenu(): never {
    throw this.trustError("contributeContextMenu");
  }

  contributeSidebarPanel(): never {
    throw this.trustError("contributeSidebarPanel");
  }

  contributeStatusBar(): never {
    throw this.trustError("contributeStatusBar");
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
