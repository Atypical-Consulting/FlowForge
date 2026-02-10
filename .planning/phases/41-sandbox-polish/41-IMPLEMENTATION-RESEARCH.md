# Phase 41: Sandbox & Polish - Implementation Research

**Researched:** 2026-02-10
**Domain:** Extension sandbox infrastructure, deprecation cleanup, release polish
**Confidence:** HIGH (store shims and extension API verified in code), MEDIUM (Worker sandbox Tauri integration)

## Summary

Phase 41 has three pillars: (1) sandbox infrastructure preparation for future third-party extensions, (2) removing 16 deprecated store re-export shims from Phase 30's migration, and (3) shipping v1.6.0 with full extension lifecycle test coverage.

The sandbox work is a **prototype** -- not a production runtime. The Worker-based sandbox must demonstrate postMessage communication between a host and isolated extension code, classify ExtensionAPI methods by trust level, and add a trust level flag to manifests. The Tauri v2 CSP already includes `worker-src: 'self' blob:`, confirming Workers are supported. However, Workers in Tauri v2's WebView do NOT have access to `window.__TAURI_INTERNALS__`, meaning they cannot directly call `invoke()`. A postMessage bridge from the main thread is the correct pattern.

The deprecation cleanup involves exactly 16 store shim files (all `@deprecated` from Phase 30 migration) with ~37 consumer import sites across the codebase. The shims are simple `export const useXStore = useDomainStore` re-exports -- safe to remove with mechanical find-and-replace of import paths.

**Primary recommendation:** Implement the Worker sandbox as a prototype module (`src/extensions/sandbox/`) with a WorkerHost class that wraps Worker creation and postMessage/MessageChannel communication. Classify ExtensionAPI methods into trusted/sandboxed tiers and document them with JSDoc. Remove all 16 store shims by updating import paths to domain stores. Add GitHub extension lifecycle tests (the only built-in without them). Bump to v1.6.0.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^4.0.18 | Test framework | Already used, 207 tests passing |
| @vitest/web-worker | (new) | Worker testing | Official Vitest package for Worker simulation in jsdom |
| TypeScript | ^5.9.3 | Type-safe sandbox API | Already in strict mode |
| Vite | ^7.3.1 | Worker bundling | Already configured with `worker: { format: "es" }` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/web-worker | latest | Testing Worker communication | Needed ONLY for sandbox prototype tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Worker | iframe sandbox | Heavier, more complex CSP, Tauri already has isolation pattern via iframe |
| @vitest/web-worker | Manual Worker mock | Less reliable, re-invents what vitest already provides |
| Manual import rewriting | jscodeshift | Overkill for 37 import sites -- manual is safer and auditable |

**Installation:**
```bash
npm install -D @vitest/web-worker
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  extensions/
    sandbox/                    # NEW: Worker sandbox infrastructure
      ExtensionSandbox.ts      # WorkerHost class wrapping Worker lifecycle
      sandbox-worker.ts        # Worker entry point (runs inside sandbox)
      sandbox-bridge.ts        # postMessage protocol types and helpers
      sandbox-api-surface.ts   # Trusted vs sandbox-safe API classification
      __tests__/
        sandbox.test.ts        # Worker communication tests
    ExtensionAPI.ts            # MODIFIED: trust level annotations on methods
    ExtensionHost.ts           # MODIFIED: trust level in registerBuiltIn
    extensionTypes.ts          # MODIFIED: TrustLevel type added
    extensionManifest.ts       # RE-EXPORTS from Rust bindings (already)
    __tests__/
      github.test.ts           # NEW: lifecycle tests for GitHub extension
  stores/
    topology.ts                # DELETED (shim)
    repository.ts              # DELETED (shim)
    ... (all 16 shims removed)
```

### Pattern 1: Worker Sandbox Host (postMessage Bridge)

**What:** A WorkerHost class that creates a Worker, manages its lifecycle, and proxies allowed ExtensionAPI calls through postMessage.

**When to use:** When executing untrusted extension code that should not have direct access to Tauri IPC, Zustand stores, or DOM.

**Confidence:** HIGH for the pattern, MEDIUM for Tauri-specific Worker behavior.

**Key insight:** Workers in Tauri v2 WebView do NOT have access to `window.__TAURI_INTERNALS__`. This is actually a **security benefit** for sandboxing -- the Worker is naturally isolated from Tauri IPC. The host thread must proxy any allowed commands via postMessage.

```typescript
// src/extensions/sandbox/sandbox-bridge.ts
// Source: Verified against Tauri v2 CSP config (worker-src: 'self' blob:)

/** Message types for host <-> worker communication */
export type SandboxMessage =
  | { type: "activate"; extensionId: string }
  | { type: "api-call"; callId: string; method: string; args: unknown[] }
  | { type: "api-response"; callId: string; result: unknown; error?: string }
  | { type: "deactivate" }
  | { type: "ready" }
  | { type: "error"; message: string };

/** API methods safe to call from sandbox (no direct store/DOM access) */
export const SANDBOX_SAFE_METHODS = [
  "registerCommand",
  "registerBlade",     // With restrictions: component must be serializable config
  "onDispose",
] as const;

/** API methods requiring trust (direct store access, IPC, DOM manipulation) */
export const TRUST_REQUIRED_METHODS = [
  "contributeToolbar",       // Accesses Zustand store directly
  "contributeSidebarPanel",  // Renders React components in host
  "contributeStatusBar",     // Renders in host DOM
  "contributeContextMenu",   // Accesses context menu registry
  "onDidGit",                // Subscribes to git hook bus
  "onWillGit",               // Can cancel git operations
] as const;
```

```typescript
// src/extensions/sandbox/ExtensionSandbox.ts
export class ExtensionSandbox {
  private worker: Worker | null = null;
  private pendingCalls = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  async start(workerUrl: string | URL): Promise<void> {
    this.worker = new Worker(workerUrl, { type: "module" });
    this.worker.onmessage = (e: MessageEvent<SandboxMessage>) => {
      this.handleMessage(e.data);
    };
    this.worker.onerror = (e) => {
      console.error("[Sandbox] Worker error:", e.message);
    };
  }

  async callApi(method: string, args: unknown[]): Promise<unknown> {
    if (!SANDBOX_SAFE_METHODS.includes(method as any)) {
      throw new Error(`Method "${method}" is not sandbox-safe`);
    }
    const callId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(callId, { resolve, reject });
      this.worker?.postMessage({ type: "api-call", callId, method, args });
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    // Reject all pending calls
    for (const [, pending] of this.pendingCalls) {
      pending.reject(new Error("Sandbox terminated"));
    }
    this.pendingCalls.clear();
  }

  private handleMessage(msg: SandboxMessage): void {
    if (msg.type === "api-response") {
      const pending = this.pendingCalls.get(msg.callId);
      if (pending) {
        this.pendingCalls.delete(msg.callId);
        if (msg.error) pending.reject(new Error(msg.error));
        else pending.resolve(msg.result);
      }
    }
  }
}
```

### Pattern 2: Trust Level Classification

**What:** Every ExtensionAPI method annotated with a trust level, and the manifest extended with a `trustLevel` field.

**When to use:** All extensions -- built-in are `trusted`, external are `sandboxed` by default.

```typescript
// src/extensions/extensionTypes.ts additions
export type TrustLevel = "trusted" | "sandboxed";

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  status: ExtensionStatus;
  error?: string;
  manifest: ExtensionManifest;
  builtIn?: boolean;
  trustLevel: TrustLevel;  // NEW
}
```

### Pattern 3: Store Shim Removal

**What:** Replace 16 deprecated store re-exports with direct imports to domain stores.

**When to use:** All consumers of the old `stores/{name}.ts` shims.

**Example (before):**
```typescript
import { useRepositoryStore } from "../stores/repository";
// useRepositoryStore is actually useGitOpsStore
```

**Example (after):**
```typescript
import { useGitOpsStore } from "../stores/domain/git-ops";
// Direct import, no indirection
```

**Critical detail:** Some shims re-export **types** in addition to the store alias:
- `settings.ts` re-exports: `SettingsCategory`, `GeneralSettings`, `GitSettings`, `IntegrationsSettings`, `Settings`
- `reviewChecklist.ts` re-exports: `ChecklistItem`, `FlowType`, `DEFAULT_CHECKLIST`
- `branchMetadata.ts` re-exports: `RecentBranchEntry`

These type re-exports must be preserved or their consumers updated to import from the slice directly.

### Anti-Patterns to Avoid
- **Running Tauri invoke() inside a Worker:** Workers do NOT have `window.__TAURI_INTERNALS__`. Never attempt to import `@tauri-apps/api/core` inside Worker code. Always proxy through the host thread.
- **Removing shims without updating consumers first:** This will cause compile errors. Always update imports THEN delete shims.
- **Adding `@vitest/web-worker` globally in setup.ts:** It can conflict with jsdom's `postMessage`. Import it only in sandbox test files that need it.
- **Making the sandbox prototype load real extensions:** Phase 41 is a prototype. Use a hardcoded test extension script, not the full discovery/activation pipeline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker testing in Vitest | Custom Worker mock class | `@vitest/web-worker` | Handles MessageEvent, onmessage, postMessage correctly in jsdom |
| Import path rewriting | jscodeshift transform | Manual find-replace + TypeScript compiler check | Only 37 sites; jscodeshift adds complexity, TS compiler catches misses |
| Manifest schema validation | Custom JSON validator | Rust serde + TypeScript type narrowing | Already validated in `discovery.rs` |
| Worker lifecycle management | Raw `new Worker()` calls | `ExtensionSandbox` wrapper class | Centralizes error handling, pending call tracking, termination cleanup |

**Key insight:** The sandbox is a prototype for Phase 41. Keep it minimal. The full sandbox runtime (with CSP enforcement, capability-based permissions) is a future phase concern.

## Common Pitfalls

### Pitfall 1: Workers Cannot Access Tauri IPC
**What goes wrong:** Attempting to call `invoke()` or import `@tauri-apps/api/core` inside a Web Worker causes a runtime error because `window.__TAURI_INTERNALS__` is undefined in Worker scope.
**Why it happens:** Tauri injects its IPC bridge into the main WebView window, not into Worker contexts. Workers have their own global scope (`self`) without Tauri's initialization script.
**How to avoid:** All Tauri IPC must go through the host thread. The Worker sends a postMessage request, the host calls `invoke()`, and sends the result back via postMessage.
**Warning signs:** `TypeError: Cannot read property 'invoke' of undefined` in Worker code.
**Confidence:** HIGH -- verified from Tauri v2 architecture docs: "The initialization_script initializes `window.__TAURI_INTERNALS__.postMessage`" (window scope only).

### Pitfall 2: @vitest/web-worker + jsdom Scope Conflict
**What goes wrong:** When `@vitest/web-worker` is loaded globally alongside jsdom, `postMessage()` inside Worker code may route to jsdom's `window.postMessage` instead of the Worker's `self.postMessage`.
**Why it happens:** jsdom and @vitest/web-worker both polyfill messaging APIs. The Worker runs in the same thread as tests (not a real thread).
**How to avoid:** Import `@vitest/web-worker` only in test files that need it (not globally in `setup.ts`). Use `self.postMessage` explicitly in Worker code. Prefer `self.onmessage` over bare `onmessage`.
**Warning signs:** Messages not being received, tests hanging, or messages appearing in wrong handlers.
**Confidence:** HIGH -- documented in vitest/web-worker README: "Workers will have access to the same shared global space as your tests."

### Pitfall 3: Settings Shim Has Type Re-exports
**What goes wrong:** Deleting `stores/settings.ts` breaks consumers that import type aliases like `SettingsCategory` from it.
**Why it happens:** The `settings.ts` shim re-exports 5 types from `domain/preferences/settings.slice`: `SettingsCategory`, `GeneralSettings`, `GitSettings`, `IntegrationsSettings`, `Settings`.
**How to avoid:** Before deleting each shim, check for type re-exports. Update consumers to import types directly from the slice file: `import { type SettingsCategory } from "../stores/domain/preferences/settings.slice"`.
**Warning signs:** TypeScript errors: `Module '"../stores/settings"' has no exported member 'SettingsCategory'`.
**Confidence:** HIGH -- verified by reading actual shim file contents.

### Pitfall 4: GitHub Extension Has No Lifecycle Tests
**What goes wrong:** Phase 41 success criteria require "extension lifecycle tests cover activate, deactivate, and registry cleanup for all new registries." The GitHub extension is the most complex (7 blades, 5 commands, 4 toolbar items, store subscriptions, polling cancellation) and currently has ZERO lifecycle tests.
**Why it happens:** It was added in Phase 36 before the lifecycle test pattern was established in Phase 38.
**How to avoid:** Write `src/extensions/__tests__/github.test.ts` following the established pattern. The GitHub extension's `ensureComponents()` does async imports that will need mocking.
**Warning signs:** Missing test file during verification.
**Confidence:** HIGH -- verified via `Glob` that no `github.test.ts` exists.

### Pitfall 5: Version Bump Locations
**What goes wrong:** Version is bumped in `package.json` but not in `Cargo.toml` or `tauri.conf.json`, or vice versa.
**Why it happens:** Three separate files track the version: `package.json` (1.5.0), `Cargo.toml` (1.5.0), `tauri.conf.json` (1.5.0).
**How to avoid:** Update all three files atomically in the same task.
**Warning signs:** Version mismatch between frontend and backend.
**Confidence:** HIGH -- all three files verified at 1.5.0.

## Code Examples

### Worker Sandbox Test Pattern
```typescript
// src/extensions/sandbox/__tests__/sandbox.test.ts
// Confidence: HIGH for pattern, uses @vitest/web-worker
import "@vitest/web-worker";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("ExtensionSandbox", () => {
  let sandbox: ExtensionSandbox;

  beforeEach(() => {
    sandbox = new ExtensionSandbox();
  });

  afterEach(() => {
    sandbox.terminate();
  });

  it("creates worker and receives ready message", async () => {
    // Use inline worker via Blob URL (supported by @vitest/web-worker)
    const workerCode = `
      self.postMessage({ type: "ready" });
      self.onmessage = (e) => {
        if (e.data.type === "activate") {
          self.postMessage({ type: "api-response", callId: "1", result: "ok" });
        }
      };
    `;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);

    await sandbox.start(url);
    // Worker should be running
    expect(sandbox.isRunning).toBe(true);

    URL.revokeObjectURL(url);
  });

  it("postMessage bridge relays API calls", async () => {
    // ... test that callApi sends message and receives response
  });

  it("terminate rejects pending calls", async () => {
    // ... test that termination cleans up
  });
});
```

### Trust Level in Manifest
```typescript
// src/extensions/extensionManifest.ts -- types come from Rust bindings
// The Rust ExtensionManifest struct needs a new optional field:
// pub trust_level: Option<String>,  // "trusted" | "sandboxed"
// For Phase 41 prototype, built-in extensions get trustLevel: "trusted" synthetically
```

### Store Shim Removal -- Import Migration Map
```
// Complete migration map for all 16 shims:
//
// OLD IMPORT PATH                  -> NEW IMPORT PATH                          -> ALIAS
// stores/repository                -> stores/domain/git-ops                    -> useGitOpsStore
// stores/branches                  -> stores/domain/git-ops                    -> useGitOpsStore
// stores/tags                      -> stores/domain/git-ops                    -> useGitOpsStore
// stores/stash                     -> stores/domain/git-ops                    -> useGitOpsStore
// stores/worktrees                 -> stores/domain/git-ops                    -> useGitOpsStore
// stores/gitflow                   -> stores/domain/git-ops                    -> useGitOpsStore
// stores/topology                  -> stores/domain/git-ops                    -> useGitOpsStore
// stores/undo                      -> stores/domain/git-ops                    -> useGitOpsStore
// stores/clone                     -> stores/domain/git-ops                    -> useGitOpsStore
// stores/settings                  -> stores/domain/preferences                -> usePreferencesStore
// stores/theme                     -> stores/domain/preferences                -> usePreferencesStore
// stores/navigation                -> stores/domain/preferences                -> usePreferencesStore
// stores/branchMetadata            -> stores/domain/preferences                -> usePreferencesStore
// stores/reviewChecklist           -> stores/domain/preferences                -> usePreferencesStore
// stores/staging                   -> stores/domain/ui-state                   -> useUIStore
// stores/commandPalette            -> stores/domain/ui-state                   -> useUIStore
//
// Consumer usage patterns:
//   useRepositoryStore(s => s.repoStatus)  ->  useGitOpsStore(s => s.repoStatus)
//   useTopologyStore(s => s.nodes)         ->  useGitOpsStore(s => s.nodes)
//   useThemeStore(s => s.initTheme)        ->  usePreferencesStore(s => s.initTheme)
```

### GitHub Extension Lifecycle Test Template
```typescript
// src/extensions/__tests__/github.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../lib/bladeRegistry";
import { useToolbarRegistry } from "../../lib/toolbarRegistry";

// Must mock the async component imports
vi.mock("../github/blades/GitHubAuthBlade", () => ({
  GitHubAuthBlade: () => null,
}));
vi.mock("../github/blades/GitHubAccountBlade", () => ({
  GitHubAccountBlade: () => null,
}));
// ... mock all 8 component imports

vi.mock("../github/githubStore", () => ({
  useGitHubStore: { getState: () => ({ isAuthenticated: false, detectedRemotes: [], checkAuth: vi.fn(), resetRemotes: vi.fn(), detectRemotes: vi.fn() }), subscribe: vi.fn(() => vi.fn()) },
  getSelectedRemote: vi.fn(),
  cancelGitHubPolling: vi.fn(),
}));

vi.mock("../../stores/repository", () => ({
  useRepositoryStore: { getState: () => ({ repoStatus: null }), subscribe: vi.fn(() => vi.fn()) },
}));

describe("github extension", () => {
  let api: ExtensionAPI;

  beforeEach(() => {
    api = new ExtensionAPI("github");
    useToolbarRegistry.setState({ actions: new Map(), visibilityTick: 0 });
  });

  it("registers 7 blade types on activation", async () => {
    const { onActivate } = await import("../github");
    await onActivate(api);
    expect(getBladeRegistration("ext:github:sign-in")).toBeDefined();
    expect(getBladeRegistration("ext:github:account")).toBeDefined();
    // ... verify all 7 blades
    api.cleanup();
  });

  it("cleanup removes all registrations", async () => {
    const { onActivate } = await import("../github");
    await onActivate(api);
    api.cleanup();
    expect(getBladeRegistration("ext:github:sign-in")).toBeUndefined();
    // ... verify all cleaned up
  });
});
```

## Implementation Details: Tauri v2 Worker Integration

### Verified Facts (HIGH Confidence)

1. **CSP already supports Workers:** The `tauri.conf.json` includes `"worker-src": "'self' blob:"` in both production and dev CSP. Workers created from same-origin scripts or Blob URLs will work.

2. **Vite Worker configuration exists:** `vite.config.ts` already has `worker: { format: "es" }`, meaning Vite will bundle Worker files as ES modules.

3. **Workers CANNOT access Tauri IPC:** Tauri's initialization script that sets up `window.__TAURI_INTERNALS__` runs only in the main WebView context. A Worker has no `window` object -- only `self`. This means `invoke()` from `@tauri-apps/api/core` will fail inside a Worker.

4. **The Isolation Pattern uses iframes, not Workers:** Tauri v2's built-in isolation pattern interposes an iframe sandbox between the frontend and Tauri Core, using AES-GCM encrypted messages. This is architecturally different from our Worker sandbox and should not be confused with it. Our Worker sandbox isolates extension JavaScript; Tauri's isolation pattern protects the Rust backend from the frontend.

### Architecture Decision: postMessage Bridge

Since Workers cannot call `invoke()`, the host thread must act as a proxy:

```
Extension Worker                Host Thread (main)
     |                               |
     |--- postMessage(api-call) ---->|
     |                               |-- invoke() -> Rust
     |                               |<- Result from Rust
     |<-- postMessage(api-response) -|
```

For Phase 41, this is a **prototype only**. The Worker will demonstrate:
- Creating a Worker from a Blob URL (simulating loading extension code)
- Sending `activate` and `deactivate` messages
- Receiving `api-call` requests and responding with `api-response`
- Proper error handling and termination

No real Tauri commands will be proxied in the prototype. The focus is on proving the communication pattern works.

## React Extensibility Patterns

### Current Extension UI Model (Verified)

The project already supports extension-contributed UI through 6 registries:
1. **BladeRegistry** -- full blade types (React components rendered in main content area)
2. **ToolbarRegistry** -- toolbar actions and custom render functions
3. **SidebarPanelRegistry** -- collapsible sidebar sections
4. **StatusBarRegistry** -- status bar widgets with custom render
5. **ContextMenuRegistry** -- right-click menu items
6. **CommandRegistry** -- command palette entries

Extensions register React components through `ExtensionAPI`. The `BladeRenderer` component in `src/blades/_shared/BladeRenderer.tsx` already supports:
- `React.lazy()` with Suspense fallback for lazy-loaded blades
- `ErrorBoundary` wrapping for blade render failures
- Dynamic title resolution from props

### What Sandboxed Extensions Can Contribute

Sandboxed (untrusted) extensions should be limited to:
- **Commands:** Action functions can be proxied through postMessage (serializable)
- **Blade declarations:** Type/title metadata (but NOT React components -- those require trust)
- **Data providers:** Extensions that transform/filter data without rendering UI

What requires trust:
- **React components:** Cannot be serialized through postMessage. Components need direct access to the React runtime.
- **Store subscriptions:** Zustand subscriptions require same-thread access.
- **Git hooks:** `onWillGit` can cancel operations -- too powerful for untrusted code.

### Future Pattern: Sandboxed UI via Proxy Components

For a future phase, sandboxed extensions could contribute UI through a "proxy component" pattern:
- Extension declares UI as a JSON schema (title, fields, actions)
- Host renders the UI using a generic `SandboxedBladeRenderer`
- User interactions are serialized back to the Worker via postMessage

This is OUT OF SCOPE for Phase 41 but should inform the API classification.

## Tailwind v4 Extension Theming

### Current Theme Architecture (Verified)

- `src/index.css` imports `@catppuccin/tailwindcss/mocha.css` which provides CSS custom properties
- Catppuccin tokens available as `--catppuccin-color-{name}` (e.g., `--catppuccin-color-text`, `--catppuccin-color-base`)
- Tailwind v4 exposes these as utility classes: `bg-ctp-base`, `text-ctp-text`, etc.
- Theme switching uses `.mocha` / `.latte` class on `<html>` element
- Custom animations in `@theme {}` block use `--animate-{name}` pattern

### Extension CSS Considerations

**For built-in (trusted) extensions:**
- Full access to Tailwind utility classes and Catppuccin tokens
- Already demonstrated: GitHub extension uses `bg-ctp-surface0`, `text-ctp-green`, etc.
- No CSS isolation needed -- they are part of the same build

**For sandboxed (external) extensions:**
- If they provide React components (requires trust), they use the same CSS context
- If using the proxy component pattern (future), theming is automatic (host renders with host CSS)
- CSS custom properties (e.g., `--catppuccin-color-text`) are accessible in any DOM context, including shadow DOM or iframes
- **No special Tailwind v4 changes needed for Phase 41**

### Design Token Documentation

Phase 41 should document available tokens for extension authors:
- Color tokens: `--catppuccin-color-{rosewater|flamingo|pink|mauve|red|maroon|peach|yellow|green|teal|sky|sapphire|blue|lavender|text|subtext1|subtext0|overlay2|overlay1|overlay0|surface2|surface1|surface0|base|mantle|crust}`
- Tailwind classes: `bg-ctp-{name}`, `text-ctp-{name}`, `border-ctp-{name}`

## Rust Backend Considerations

### Current State (Verified)

The Rust backend at `src-tauri/src/extensions/` provides:
1. `discovery.rs` -- Scans `{repoPath}/.flowforge/extensions/` for `flowforge.extension.json` manifests
2. `manifest.rs` -- Serde structs for ExtensionManifest (id, name, version, apiVersion, main, contributes, permissions, basePath)
3. `install.rs` -- Git clone from URL, install to extensions dir, uninstall

### Rust Changes for Phase 41

**Manifest struct update (REQUIRED):**
The `ExtensionManifest` struct in `manifest.rs` needs a `trust_level` field:

```rust
// src-tauri/src/extensions/manifest.rs
pub struct ExtensionManifest {
    // ... existing fields ...

    /// Trust level: "trusted" for built-in, "sandboxed" for external.
    /// Populated by discovery or set synthetically for built-in extensions.
    #[serde(default)]
    pub trust_level: Option<String>,
}
```

This will auto-generate the TypeScript type in `bindings.ts` (via specta), making `trustLevel` available on the frontend.

**No Tauri plugin system changes needed:**
Tauri v2's plugin system (`tauri::plugin::Plugin` trait) is for extending the Rust backend, not for frontend extensions. The FlowForge extension system is entirely frontend-driven with Rust providing discovery and manifest parsing. No Rust-side plugin architecture changes are needed for Phase 41.

**The Rust command set is static:**
Commands are registered at build time via `collect_commands![]` in `lib.rs`. Dynamic command registration is not supported by tauri-specta's architecture. If external extensions need backend capabilities, they would go through existing commands (e.g., file read/write) or a future generic "extension command proxy" -- but this is out of scope for Phase 41.

## Deprecation Cleanup: Complete Shim Inventory

### All 16 Store Shims

| # | Shim File | Re-exports As | Maps To | Consumer Count |
|---|-----------|---------------|---------|----------------|
| 1 | `stores/repository.ts` | `useRepositoryStore` | `useGitOpsStore` | 12 files |
| 2 | `stores/branches.ts` | `useBranchStore` | `useGitOpsStore` | 3 files |
| 3 | `stores/topology.ts` | `useTopologyStore` | `useGitOpsStore` | 3 files |
| 4 | `stores/undo.ts` | `useUndoStore` | `useGitOpsStore` | 3 files |
| 5 | `stores/tags.ts` | `useTagStore` | `useGitOpsStore` | 2 files |
| 6 | `stores/stash.ts` | `useStashStore` | `useGitOpsStore` | 2 files |
| 7 | `stores/commandPalette.ts` | `useCommandPaletteStore` | `useUIStore` | 3 files |
| 8 | `stores/branchMetadata.ts` | `useBranchMetadataStore` | `usePreferencesStore` | 3 files |
| 9 | `stores/theme.ts` | `useThemeStore` | `usePreferencesStore` | 2 files |
| 10 | `stores/navigation.ts` | `useNavigationStore` | `usePreferencesStore` | 2 files |
| 11 | `stores/settings.ts` | `useSettingsStore` | `usePreferencesStore` | 1 file |
| 12 | `stores/reviewChecklist.ts` | `useReviewChecklistStore` | `usePreferencesStore` | 1 file |
| 13 | `stores/clone.ts` | `useCloneStore` | `useGitOpsStore` | 0 files |
| 14 | `stores/worktrees.ts` | `useWorktreeStore` | `useGitOpsStore` | 0 files |
| 15 | `stores/gitflow.ts` | `useGitflowStore` | `useGitOpsStore` | 0 files |
| 16 | `stores/staging.ts` | `useStagingStore` | `useUIStore` | 0 files |

**Total consumer import sites: ~37**

### Shims with Type Re-exports (Require Special Handling)

| Shim | Types Re-exported | Source |
|------|-------------------|--------|
| `stores/settings.ts` | `SettingsCategory, GeneralSettings, GitSettings, IntegrationsSettings, Settings` | `domain/preferences/settings.slice` |
| `stores/reviewChecklist.ts` | `ChecklistItem, FlowType, DEFAULT_CHECKLIST` | `domain/preferences/review-checklist.slice` |
| `stores/branchMetadata.ts` | `RecentBranchEntry` | `domain/preferences/branch-metadata.slice` |

### Additional Compat Layer
| File | What | Consumers |
|------|------|-----------|
| `lib/fileTypeUtils.ts` | Re-exports `bladeTypeForFile`, `isBinaryFile` from `fileDispatch` + adds `isTextDiffable()` | 1 file (`hooks/useBladeNavigation.ts`) |

**Note:** `lib/fileTypeUtils.ts` has its own function `isTextDiffable()`, so it cannot simply be deleted. Only the re-export line is the compatibility shim. This may or may not be in scope for the "16 shims" requirement.

### Migration Strategy

**Approach:** Manual find-and-replace with TypeScript compilation verification.

**Why not jscodeshift:** With only 37 import sites, manual replacement is faster, more predictable, and allows per-file review. The TypeScript compiler will catch any missed references.

**Step-by-step per shim:**
1. Identify all consumers (already inventoried above)
2. For each consumer file:
   - Change import path from `../stores/{name}` to `../stores/domain/{domain-store}`
   - Change imported name from `use{Name}Store` to `use{Domain}Store`
   - Verify selector functions still work (they do -- all shims map to the exact same store)
3. If shim has type re-exports, also update type import paths
4. Delete the shim file
5. Run `tsc --noEmit` to verify no broken imports
6. Run `vitest run` to verify no test regressions

**Ordering:** Start with zero-consumer shims (clone, worktrees, gitflow, staging) as risk-free deletions, then work through low-consumer shims up to high-consumer ones (repository with 12 consumers).

### Effect on Extensions

The `src/extensions/gitflow/index.ts` imports `useRepositoryStore` from `../../stores/repository` -- this is a shim consumer and must be updated to `../../stores/domain/git-ops` with `useGitOpsStore`.

## Vitest Worker Testing Strategy

### Recommended Approach

1. **Install `@vitest/web-worker`** as a dev dependency
2. **Import per-test-file**, NOT in global setup.ts (avoids jsdom scope conflicts)
3. **Use Blob URLs** for inline worker code in tests (simulates extension loading)
4. **Test the bridge protocol**, not actual extension logic

### Known Limitations (Verified)

- `@vitest/web-worker` runs Workers in the same thread as tests (NOT a real thread isolation)
- `self.onmessage = () => {}` is required (not bare `onmessage = () => {}`)
- `self.postMessage()` is required (not bare `postMessage()`)
- Buffer transfer does not alter `byteLength` (structured clone is simplified)
- Workers share the same global space as tests (useful for some test patterns, dangerous for others)

### Test Coverage for Sandbox Prototype

Minimum tests for the sandbox prototype:
1. Worker creation and ready handshake
2. postMessage API call with response
3. Error response handling
4. Worker termination cleans up pending calls
5. Sandbox-safe method whitelist enforcement (blocks trusted-only methods)

### Test Coverage for Extension Lifecycle

Current state:
- `content-viewers.test.ts` -- 6 tests (activate, cleanup, coreOverride, lazy, source, deactivate no-op)
- `conventional-commits.test.ts` -- 7 tests (activate, cleanup, coreOverride, lazy, singleton, source, deactivate no-op)
- `gitflow.test.ts` -- 9 tests (activate, cleanup, coreOverride, lazy, singleton, source, sidebar, toolbar, deactivate no-op)
- `ExtensionAPI.test.ts` -- 12 tests (all registries, cleanup, disposables, git hooks)
- **github.test.ts** -- MISSING (0 tests)

Required additions:
- `github.test.ts` with: activate (7 blades + 5 commands + 4 toolbar), cleanup removes all, deactivate cancels polling and cleans up subscriptions

## Performance Analysis

### Worker Startup Time

- **Blob URL Worker creation:** Essentially instant (< 1ms) -- no network fetch
- **Module Worker from file:** Depends on bundled size. For small extension scripts (< 50KB), < 10ms
- **In Tauri context:** The WebView's Worker creation has same performance as Chromium/WebKit browsers

### Message Serialization Overhead

- **Structured clone algorithm** is used for postMessage data
- For simple JSON-serializable objects (extension API calls, responses): negligible overhead (< 0.1ms per message)
- **Avoid transferring large objects** (DOM nodes, Uint8Arrays) through the bridge
- For Phase 41 prototype: no measurable performance impact expected

### Lazy Loading Extensions

Current pattern already uses `React.lazy()` for blade components:
```typescript
const ViewerMarkdownBlade = lazy(() =>
  import("../../blades/viewer-markdown/ViewerMarkdownBlade").then(...)
);
```

This defers component loading until first render. For sandboxed extensions, the Worker would be created lazily on first activation, not at app startup.

**Recommendation:** No performance concerns for Phase 41. The sandbox is a prototype with no production workload.

## Refactoring Code Patterns

### Pattern 1: Trust-Annotated API Methods (JSDoc + TypeScript)

```typescript
// ExtensionAPI.ts
export class ExtensionAPI {
  /**
   * Register a command with automatic namespacing.
   * @sandbox-safe - Can be called from sandboxed extensions.
   * Command action is a serializable function name, not a closure.
   */
  registerCommand(config: ExtensionCommandConfig): void { ... }

  /**
   * Contribute a toolbar action with automatic namespacing.
   * @requires-trust - Needs React component access and Zustand store.
   * Cannot be called from sandboxed extensions.
   */
  contributeToolbar(config: ExtensionToolbarConfig): void { ... }
}
```

### Pattern 2: Factory for Sandbox-Restricted API

```typescript
// src/extensions/sandbox/sandbox-api-surface.ts
export function createSandboxAPI(extensionId: string): Pick<ExtensionAPI, 'registerCommand' | 'registerBlade' | 'onDispose'> {
  const fullApi = new ExtensionAPI(extensionId);
  return {
    registerCommand: fullApi.registerCommand.bind(fullApi),
    registerBlade: fullApi.registerBlade.bind(fullApi),
    onDispose: fullApi.onDispose.bind(fullApi),
  };
}
```

### Pattern 3: Registry Dependency Injection (Already In Place)

The project already uses Zustand stores as registries with `getState()` for synchronous access. This is effectively a service locator pattern. No refactoring needed -- the pattern works well for the extension system:

```typescript
// Extension registers
useToolbarRegistry.getState().register({ ... });
// Extension unregisters via source
useToolbarRegistry.getState().unregisterBySource("ext:github");
```

### Pattern 4: Version Bump Atomicity

```bash
# All three files must be updated together
# package.json: "version": "1.5.0" -> "1.6.0"
# Cargo.toml: version = "1.5.0" -> version = "1.6.0"
# tauri.conf.json: "version": "1.5.0" -> "version": "1.6.0"
```

## Recommendations

### Priority Order (Dependency-Driven)

1. **SAND-01 (Trust Level Flag)** -- Modify Rust manifest + TypeScript types. This is a foundation for SAND-03.
   - Add `trust_level: Option<String>` to Rust `ExtensionManifest`
   - Regenerate TypeScript bindings
   - Set `trustLevel: "trusted"` in `registerBuiltIn` synthetic manifest
   - Set `trustLevel: "sandboxed"` as default for discovered extensions

2. **SAND-03 (API Method Classification)** -- Annotate ExtensionAPI methods with trust requirements.
   - Add JSDoc `@sandbox-safe` / `@requires-trust` tags
   - Create `sandbox-api-surface.ts` with the method classification constants
   - Document in code which methods are callable from sandbox

3. **SAND-02 (Worker Sandbox Prototype)** -- Build the postMessage bridge demo.
   - Create `ExtensionSandbox` class
   - Create `sandbox-bridge.ts` with message types
   - Create `sandbox-worker.ts` with echo/ready protocol
   - Write tests with `@vitest/web-worker`

4. **MAINT-01 (Remove 16 Shims)** -- Largest mechanical change, no dependencies.
   - Start with 4 zero-consumer shims (delete immediately)
   - Batch remaining by domain: git-ops shims (9), preferences shims (5), ui-state shims (2)
   - Handle type re-exports from settings, reviewChecklist, branchMetadata
   - Verify with `tsc --noEmit` after each batch

5. **MAINT-02 (Extension Lifecycle Tests)** -- Add GitHub extension tests.
   - Create `github.test.ts` following established pattern
   - Mock all 8 async component imports
   - Mock `useGitHubStore` and `useRepositoryStore`
   - Test: activation registers 7 blades + 5 commands + 4 toolbar items
   - Test: cleanup removes everything
   - Test: deactivate cancels polling

6. **MAINT-04 (Version Bump)** -- Atomic update to all 3 version files.
   - `package.json`: 1.5.0 -> 1.6.0
   - `Cargo.toml`: 1.5.0 -> 1.6.0
   - `tauri.conf.json`: 1.5.0 -> 1.6.0

7. **MAINT-03 (Documentation)** -- Update docs site for extension architecture.
   - Document ExtensionAPI methods and trust levels
   - Document extension manifest schema with trustLevel field
   - Document available Catppuccin design tokens for extension authors

### Risk Assessment

| Task | Risk | Mitigation |
|------|------|------------|
| Worker sandbox prototype | MEDIUM: @vitest/web-worker + jsdom scope conflicts | Import per-file, use self.postMessage, test incrementally |
| Store shim removal (37 sites) | LOW: Mechanical replacement, TS catches errors | Batch by domain, run tsc after each batch |
| GitHub extension tests | LOW: Follows established pattern, needs mocking | Reference gitflow.test.ts as template |
| Rust manifest change | LOW: Adding optional field, backward compatible | `#[serde(default)]` ensures old manifests still parse |
| Version bump | TRIVIAL: 3 file edits | Grep for "1.5.0" to find all locations |

## Open Questions

1. **Should `lib/fileTypeUtils.ts` be counted as shim #17?**
   - What we know: It re-exports from `fileDispatch` but also has its own `isTextDiffable()` function
   - What's unclear: Whether the requirement's "16 shims" includes this file
   - Recommendation: Remove only the re-export lines, keep the file for `isTextDiffable()`. The backward-compat re-exports have only 1 consumer.

2. **Should the sandbox prototype load a real extension or use a test stub?**
   - What we know: Phase 41 says "demonstrates postMessage communication"
   - What's unclear: Whether it needs to run actual extension JS or just prove the bridge
   - Recommendation: Use a hardcoded inline Worker script. A real extension loader is future work.

3. **How complex should GitHub extension lifecycle tests be?**
   - What we know: GitHub extension has store subscriptions, async imports, polling
   - What's unclear: Whether tests should verify the store subscription/polling cleanup or just registration counts
   - Recommendation: Test registration counts AND verify deactivate cancels polling (matching the established pattern where onDeactivate is tested).

## Sources

### Primary (HIGH confidence)
- Project codebase direct inspection: ExtensionHost.ts, ExtensionAPI.ts, extensionTypes.ts, extensionManifest.ts, all 16 shim files, all extension test files, tauri.conf.json, vite.config.ts, vitest.config.ts, Cargo.toml, lib.rs, manifest.rs
- Tauri v2 official docs: https://v2.tauri.app/concept/inter-process-communication/isolation/ -- Isolation pattern architecture
- @vitest/web-worker README (via Context7 /vitest-dev/vitest) -- Worker testing API and limitations

### Secondary (MEDIUM confidence)
- Tauri v2 docs (via Context7 /websites/v2_tauri_app) -- CSP configuration, capability system, plugin architecture
- Tauri GitHub Discussion #9595 -- Workers do work in Tauri WebView with proper CSP
- Tauri IPC architecture -- invoke() only available in main window context

### Tertiary (LOW confidence)
- Future sandbox runtime patterns (iframe vs Worker vs both) -- no project precedent, needs validation in implementation

## Metadata

**Confidence breakdown:**
- Store shim removal: HIGH -- all 16 files read, all consumers inventoried, migration is mechanical
- Extension lifecycle tests: HIGH -- 3 existing test files provide exact template
- Trust level flag: HIGH -- simple Rust struct field addition + synthetic value for built-in
- Worker sandbox prototype: MEDIUM -- @vitest/web-worker has known jsdom quirks; Tauri Worker IPC limitations verified but prototype untested
- Version bump: HIGH -- trivial 3-file change
- API classification: HIGH -- all methods reviewed, trust boundaries clear from code inspection

**Research date:** 2026-02-10
**Valid until:** 2026-03-12 (stable patterns, no external dependency changes expected)
