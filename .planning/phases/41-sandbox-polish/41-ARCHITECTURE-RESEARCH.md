# Phase 41: Sandbox & Polish - Architecture Research

**Researched:** 2026-02-10
**Domain:** Worker sandbox infrastructure, extension trust levels, API classification, deprecation removal, test coverage
**Confidence:** HIGH (codebase analysis), MEDIUM (Worker sandbox design -- prototype work, not production)

---

## Summary

Phase 41 completes the v1.6.0 extension platform by building sandbox preparation infrastructure, removing accumulated technical debt, and shipping with full test coverage. The work divides into three distinct tracks: (1) Sandbox Infrastructure (SAND-01 through SAND-03), which adds trust level metadata to the manifest, builds a Worker-based sandbox prototype, and classifies ExtensionAPI methods by safety level; (2) Deprecation Removal (MAINT-01), which removes 16 re-export shim files from `src/stores/` and updates 66 import sites across the codebase; and (3) Polish (MAINT-02 through MAINT-04), which ensures extension lifecycle tests cover all registries, documentation is updated, and the version is bumped to v1.6.0.

The sandbox work is explicitly **preparation, not production**. No third-party untrusted extensions exist yet. The deliverables are: a trust flag in the manifest, a proof-of-concept Worker-based sandbox with postMessage RPC, and documentation of which API methods are sandbox-safe. The v1.6.0 architecture research (already completed) explicitly calls out "premature full sandbox implementation" as Anti-Pattern #5.

**Primary recommendation:** Use Comlink (1.1kB) for the Worker sandbox prototype RPC layer. It provides type-safe proxy-based communication over postMessage with zero boilerplate, handles serialization automatically, and is the standard library for Worker RPC in the TypeScript ecosystem. For the shim removal, use `grep`-based identification plus manual migration (not jscodeshift) because the shims are simple re-exports with predictable patterns across only 66 consumer files.

---

## Standard Stack

### Core (No New Runtime Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Comlink | 4.4.2 | Worker RPC for sandbox prototype | 1.1kB, GoogleChromeLabs, standard Worker RPC library, type-safe proxies over postMessage |
| Vitest | existing | Test runner for lifecycle tests | Already in use, 207 tests passing |
| TypeScript | existing | Trust level types, API classification | Already in use |

### Supporting (Already Present)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | existing | Registry stores for cleanup testing | All registry tests |
| lucide-react | existing | Mock icons in extension tests | Test setup |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Comlink | worker-rpc | More manual setup, less type safety, but more control over message format |
| Comlink | kkrpc | Newer, cross-runtime support unnecessary for this use case |
| Comlink | Manual postMessage + JSON-RPC | Full control, but reimplements what Comlink provides in 1.1kB |
| Comlink | Effect RPC | Overkill for a prototype; Effect is a large dependency |

**Decision: Comlink.** It is the established standard (GoogleChromeLabs), tiny (1.1kB), provides exactly the proxy-based RPC model needed, and works with MessagePort/MessageChannel which is the correct communication primitive for Worker isolation.

**Installation:**
```bash
npm install comlink
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/extensions/
  ExtensionAPI.ts              # Add sandbox-safe classification metadata
  ExtensionHost.ts             # Add trust level checks to activation pipeline
  extensionManifest.ts         # Re-export updated Rust manifest types
  extensionTypes.ts            # Add TrustLevel to ExtensionInfo
  sandbox/                     # NEW: Sandbox infrastructure
    SandboxBridge.ts           # Worker creation + Comlink proxy setup
    SandboxedExtensionAPI.ts   # Proxy-safe API subset for sandboxed extensions
    sandbox.worker.ts          # Worker entry point that receives extension code
    types.ts                   # Shared message types between host and worker
    __tests__/
      SandboxBridge.test.ts    # postMessage round-trip tests
```

### Pattern 1: Worker Sandbox with Comlink RPC

**What:** A Web Worker that executes extension code in isolation, communicating with the host via Comlink-proxied postMessage.

**When to use:** For the SAND-02 prototype. This is prep work, not production. The prototype demonstrates that:
1. Extension code can run inside a Worker
2. Bidirectional communication works via postMessage
3. The host can proxy a restricted API surface to the sandboxed code
4. UI contributions (blade registration) can be serialized and sent as descriptors

**Architecture:**

```
┌─────────────────────┐       MessagePort        ┌──────────────────────┐
│   Main Thread       │  <─── Comlink RPC ────>  │   Worker Thread      │
│                     │                           │                      │
│  SandboxBridge      │                           │  sandbox.worker.ts   │
│    - Creates Worker │                           │    - Receives API    │
│    - Comlink.wrap() │                           │    - Runs extension  │
│    - Proxies API    │                           │    - Comlink.expose()│
│                     │                           │                      │
│  SandboxedExtAPI    │                           │  Extension code      │
│    - registerBlade()│  ──> descriptor JSON ──>  │    - api.register()  │
│    - registerCmd()  │  <── result/error <────   │    - api.contribute()│
│    - (no React)     │                           │    - (no DOM access) │
└─────────────────────┘                           └──────────────────────┘
```

**Example:**

```typescript
// Host side: SandboxBridge.ts
import * as Comlink from "comlink";

export class SandboxBridge {
  private worker: Worker;
  private proxy: Comlink.Remote<SandboxWorkerAPI>;

  constructor(extensionId: string) {
    this.worker = new Worker(
      new URL("./sandbox.worker.ts", import.meta.url),
      { type: "module" }
    );
    this.proxy = Comlink.wrap<SandboxWorkerAPI>(this.worker);
  }

  async loadExtension(code: string, apiProxy: SandboxedExtensionAPI): Promise<void> {
    // Expose the restricted API to the worker
    await this.proxy.initialize(
      Comlink.proxy(apiProxy),
      code
    );
  }

  terminate(): void {
    this.worker.terminate();
  }
}
```

```typescript
// Worker side: sandbox.worker.ts
import * as Comlink from "comlink";

interface SandboxWorkerAPI {
  initialize(api: SandboxedExtensionAPI, code: string): Promise<void>;
}

const workerAPI: SandboxWorkerAPI = {
  async initialize(api, code) {
    // Execute extension code with restricted API
    const module = new Function("api", code);
    await module(api);
  },
};

Comlink.expose(workerAPI);
```

**Source:** [Comlink documentation](https://github.com/GoogleChromeLabs/comlink) -- MessagePort usage, proxy pattern, expose/wrap API.

### Pattern 2: Trust Level Flag in Manifest

**What:** Extend `ExtensionManifest` (Rust struct) and `ExtensionInfo` (TypeScript) with a trust classification.

**When to use:** For SAND-01. The trust level determines which ExtensionAPI methods are available and whether the extension runs in-process or in a Worker.

**Design:**

```typescript
// In extensionTypes.ts
export type TrustLevel = "built-in" | "user-trusted" | "sandboxed";

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  status: ExtensionStatus;
  error?: string;
  manifest: ExtensionManifest;
  builtIn?: boolean;           // Existing flag
  trustLevel: TrustLevel;      // NEW: explicit trust classification
}
```

```rust
// In manifest.rs -- add optional trust_level field
#[derive(Debug, Serialize, Deserialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionManifest {
    // ... existing fields ...

    /// Trust level for the extension.
    /// "built-in" for bundled extensions, "user-trusted" for user-installed,
    /// "sandboxed" for untrusted third-party (future).
    /// Defaults to "sandboxed" when not specified in the manifest.
    #[serde(default = "default_trust_level")]
    pub trust_level: String,
}

fn default_trust_level() -> String {
    "sandboxed".to_string()
}
```

**Confidence:** HIGH -- this is a simple type extension that does not change behavior. The `builtIn` boolean already exists; `trustLevel` makes the model explicit and three-valued.

### Pattern 3: API Classification with Decorator Metadata

**What:** Classify each `ExtensionAPI` method as `sandbox-safe` or `requires-trust`, enforced at the proxy layer.

**When to use:** For SAND-03. The classification determines which methods are available in the `SandboxedExtensionAPI` proxy.

**Classification Table:**

| Method | Classification | Rationale |
|--------|---------------|-----------|
| `registerBlade()` | **requires-trust** | Accepts React component references (not serializable) |
| `registerCommand()` | **requires-trust** | Accepts action callbacks with closure access |
| `contributeToolbar()` | **requires-trust** | Accepts React render functions, callbacks |
| `contributeContextMenu()` | **sandbox-safe** (descriptor only) | Can accept serializable config, host renders |
| `contributeSidebarPanel()` | **requires-trust** | Accepts React component references |
| `contributeStatusBar()` | **requires-trust** | Accepts React render functions |
| `onDidGit()` | **sandbox-safe** | Handler receives serializable GitHookContext |
| `onWillGit()` | **sandbox-safe** | Handler receives/returns serializable data |
| `onDispose()` | **sandbox-safe** | Cleanup callback, no DOM access needed |

**Key Insight:** Most UI contribution methods are `requires-trust` because they accept React component references or render functions, which cannot be serialized across a Worker boundary. A future sandbox-safe UI contribution model would need a descriptor-based approach where the sandboxed extension sends JSON descriptors and the host renders them using a built-in component library.

**Enforcement Mechanism:**

```typescript
// SandboxedExtensionAPI.ts -- proxy that only exposes safe methods
export class SandboxedExtensionAPI {
  private hostApi: ExtensionAPI;

  constructor(hostApi: ExtensionAPI) {
    this.hostApi = hostApi;
  }

  // Sandbox-safe: serializable handler
  onDidGit(operation: GitOperation, handler: DidHandler): void {
    this.hostApi.onDidGit(operation, handler);
  }

  // Sandbox-safe: serializable handler with serializable return
  onWillGit(operation: GitOperation, handler: WillHandler): void {
    this.hostApi.onWillGit(operation, handler);
  }

  // Sandbox-safe: cleanup callback
  onDispose(disposable: () => void): void {
    this.hostApi.onDispose(disposable);
  }

  // BLOCKED: requires-trust methods throw descriptive errors
  registerBlade(_config: unknown): never {
    throw new Error(
      "registerBlade() requires trust level 'built-in' or 'user-trusted'. " +
      "Sandboxed extensions cannot register React components directly."
    );
  }

  // Future: descriptor-based registration for sandboxed UI
  // contributeContextMenuDescriptor(descriptor: ContextMenuDescriptor): void { ... }
}
```

**Decision: Throw, don't silently no-op.** When a sandboxed extension calls a requires-trust method, it should receive a clear error explaining why and what trust level is needed. Silent no-ops hide bugs and make extension development frustrating. The error message should be actionable: "requires trust level X, current level is Y."

**Confidence:** HIGH for classification, MEDIUM for enforcement (enforcement is prototype-level, not production).

### Anti-Patterns to Avoid

- **Premature Full Sandbox Implementation:** Do NOT build production Worker isolation, iframe blade rendering, or a marketplace. The v1.6.0 deliverable is a prototype demonstrating the communication pattern. Full sandbox is v1.7.0+.
- **Using BroadcastChannel for Worker Communication:** BroadcastChannel is one-to-many and lacks the point-to-point guarantees needed for extension isolation. Each sandboxed extension needs its own dedicated MessagePort. Use MessageChannel (one-to-one) via Comlink.
- **Exposing Zustand Stores to Sandboxed Extensions:** Store references contain closures and React state. They cannot cross the Worker boundary. All data exchanged with sandboxed extensions must be JSON-serializable.
- **Mixing Trust Levels at Runtime:** A sandboxed extension must not be able to escalate to trusted by any means. The trust level is set at discovery/registration time and is immutable for the lifetime of the extension session.

---

## Worker Sandbox Design (SAND-02)

### MessageChannel vs BroadcastChannel

| Feature | MessageChannel | BroadcastChannel |
|---------|---------------|-----------------|
| Communication | One-to-one (point-to-point) | One-to-many (broadcast) |
| Isolation | Each channel is private between two ports | Any same-origin context can join |
| Security | Ports are capabilities -- only holders can communicate | Channel name is the only credential |
| Use case | Extension-to-host private channel | Tab synchronization, notifications |
| Comlink support | Native (wrap/expose on MessagePort) | Not directly supported |

**Decision: MessageChannel.** Each sandboxed extension gets a dedicated `MessageChannel`. One port goes to the Worker, the other stays on the host. This provides capability-based isolation -- only the holder of the port can communicate. BroadcastChannel is wrong for sandboxing because any code on the same origin could listen on the channel name.

### VS Code Extension Host Comparison

VS Code's extension host architecture provides the design reference:

| VS Code | FlowForge Equivalent |
|---------|---------------------|
| Extension Host Process (Node.js child process) | Web Worker (thread isolation) |
| IPC over stdio/socket | postMessage over MessagePort |
| `vscode` API namespace | `ExtensionAPI` class instance |
| Activation events (onLanguage, onCommand) | `onActivate(api)` callback |
| Extension Manifest `contributes` | `ExtensionManifest.contributes` + runtime registration |
| Workspace trust (trusted/restricted) | `TrustLevel` (built-in/user-trusted/sandboxed) |
| Web extension host (Worker-based for web) | SandboxBridge (Worker-based for untrusted) |

**Key difference:** VS Code runs ALL extensions in the host process (or web worker for web extensions). FlowForge only sandboxes untrusted extensions. Built-in and user-trusted extensions run in the main thread for full API access. This is a more pragmatic model for a desktop app.

### Worker Limitations in Tauri

Workers in a Tauri webview have specific constraints:

1. **No Tauri IPC access.** Workers cannot call `window.__TAURI_INVOKE__`. All Tauri commands must be proxied through the main thread. The SandboxBridge acts as the proxy.
2. **No DOM access.** Workers cannot create or manipulate DOM elements. React components cannot be instantiated in a Worker. This is why `registerBlade()` (which accepts `ComponentType`) is `requires-trust`.
3. **Module Workers supported.** Vite supports `{ type: "module" }` Workers, so the sandbox Worker can use ES module imports. The extension code loaded into the Worker would be evaluated, not imported (since it comes from the filesystem).
4. **Structured cloning limits.** Functions, DOM nodes, and React elements cannot be sent via postMessage. Only JSON-serializable data + Transferable objects (ArrayBuffer, MessagePort) can cross the boundary.

**Confidence:** MEDIUM -- based on Tauri documentation and Web Worker specs. The Tauri-specific Worker behavior has not been verified with a running prototype. This is exactly what the SAND-02 prototype should validate.

---

## Trust Level System (SAND-01)

### Manifest Extension

The current `ExtensionManifest` Rust struct already has a `permissions: Option<Vec<String>>` field. The trust level extends this with an explicit classification:

**Rust changes (manifest.rs):**
```rust
pub struct ExtensionManifest {
    // ... existing fields ...

    /// Trust level override. If absent, defaults to "sandboxed".
    /// Built-in extensions set this to "built-in" in their synthetic manifest.
    /// User-installed extensions can be promoted to "user-trusted" via settings.
    #[serde(default = "default_trust_level")]
    pub trust_level: String,
}
```

**TypeScript changes (extensionTypes.ts):**
```typescript
export type TrustLevel = "built-in" | "user-trusted" | "sandboxed";

export interface ExtensionInfo {
  // ... existing fields ...
  trustLevel: TrustLevel;  // NEW
}
```

**ExtensionHost changes (registration pipeline):**
- `registerBuiltIn()` sets `trustLevel: "built-in"` on the synthetic manifest and ExtensionInfo
- `discoverExtensions()` reads `trust_level` from the parsed manifest, defaults to `"sandboxed"`
- `activateExtension()` checks trust level to decide whether to run in-process or in Worker (future)

### Trust Level Hierarchy

```
built-in          (highest trust)
  - Bundled with app binary
  - Full ExtensionAPI access
  - Direct store access, React components, Tauri IPC
  - Examples: github, content-viewers, conventional-commits, gitflow

user-trusted      (medium trust)
  - Installed from filesystem (.flowforge/extensions/)
  - Full ExtensionAPI access (same as built-in)
  - Loaded via dynamic import() with Tauri asset:// protocol
  - User explicitly approved installation
  - Current external extensions already work this way

sandboxed         (lowest trust, FUTURE)
  - Loaded into Worker via SandboxBridge
  - SandboxedExtensionAPI only (restricted method set)
  - All communication via postMessage (serializable data only)
  - No React component registration, no store access, no Tauri IPC
  - UI contributions via descriptors (host renders)
  - v1.7.0+ when marketplace/community extensions exist
```

**Chrome Extension Comparison:**
Chrome Manifest V3 uses a similar model: all code must be in the extension package (no remote code), permissions are declared upfront, and host permissions are separate. FlowForge's trust model maps roughly as:
- `built-in` = Chrome built-in features (unrestricted)
- `user-trusted` = Chrome extension with user-granted permissions
- `sandboxed` = Chrome extension in a restricted sandbox

**Confidence:** HIGH for the type system design, LOW for the `sandboxed` runtime behavior (prototype only, not production).

---

## Registry Refactoring for Sandbox

### Current Registry Architecture

| Registry | Storage | Reactive | Source-based cleanup |
|----------|---------|----------|---------------------|
| BladeRegistry | Module-level Map | No | Yes (unregisterBySource) |
| CommandRegistry | Module-level Map | No | Yes (unregisterCommandsBySource) |
| ToolbarRegistry | Zustand store | Yes | Yes (unregisterBySource) |
| ContextMenuRegistry | Zustand store | Yes | Yes (unregisterBySource) |
| SidebarPanelRegistry | Zustand store | Yes | Yes (unregisterBySource) |
| StatusBarRegistry | Zustand store | Yes | Yes (unregisterBySource) |
| PreviewRegistry | Module-level Array | No | No |
| GitHookBus | Class with Maps | No | Yes (removeBySource) |

### Sandbox Boundary Considerations

For trusted extensions (built-in, user-trusted), registries work exactly as they do today -- extensions call `api.registerBlade()` etc. and the registrations go directly into the registry stores.

For sandboxed extensions (future), the communication protocol would be:

1. **Sandboxed extension** sends a registration descriptor (JSON) via postMessage
2. **SandboxBridge** receives the descriptor on the host side
3. **SandboxBridge** validates the descriptor against allowed schemas
4. **SandboxBridge** calls the appropriate registry API to create the registration
5. **SandboxBridge** tracks the registration for cleanup when the extension deactivates

**What changes now (v1.6.0):**
- Nothing about registry internals changes. The registries are already sandbox-compatible in their interfaces.
- The `source` field on all registrations already provides the cleanup mechanism.
- The only new work is documenting which registrations can accept serializable descriptors (for future sandboxed use).

**What changes later (v1.7.0+):**
- BladeRegistry needs React component hosting. A sandboxed extension cannot provide a `ComponentType`. Future options: (a) iframe-based blade rendering, (b) a declarative UI description language, (c) web component bridge.
- CommandRegistry needs callback proxying. A sandboxed extension's `action` callback must be proxied through the Worker bridge.
- All "when" condition functions need a replacement mechanism (declarative conditions instead of closures).

### BladeRenderer Non-Reactivity Issue

The phase context notes: "BladeRenderer doesn't subscribe to blade registry changes." This is because BladeRegistry uses a module-level Map (not a Zustand store). When an extension registers/unregisters blade types, already-rendered BladeRenderer instances do not re-render.

**Current impact:** Minimal. Blade types are registered during extension activation (before any blade instances exist) and unregistered during deactivation (which closes or fallbacks existing blades). The timing is not problematic.

**Future consideration:** If the BladeRegistry is migrated to Zustand (like the other registries), BladeRenderer could subscribe reactively. This is Phase 41 tech debt cleanup scope but is NOT required for SAND-01/02/03.

**Recommendation:** Do NOT migrate BladeRegistry to Zustand in Phase 41. It is a separate concern. Document it as future work.

---

## Deprecation Removal Strategy (MAINT-01)

### Inventory of 16 Deprecated Shims

| # | Shim File | Export Name | Target Domain | Target Store | Consumers |
|---|-----------|------------|---------------|-------------|-----------|
| 1 | `stores/repository.ts` | `useRepositoryStore` | git-ops | `useGitOpsStore` | 25 files |
| 2 | `stores/branches.ts` | `useBranchStore` | git-ops | `useGitOpsStore` | 11 files |
| 3 | `stores/tags.ts` | `useTagStore` | git-ops | `useGitOpsStore` | 3 files |
| 4 | `stores/stash.ts` | `useStashStore` | git-ops | `useGitOpsStore` | 4 files |
| 5 | `stores/worktrees.ts` | `useWorktreeStore` | git-ops | `useGitOpsStore` | 4 files |
| 6 | `stores/clone.ts` | `useCloneStore` | git-ops | `useGitOpsStore` | 1 file |
| 7 | `stores/undo.ts` | `useUndoStore` | git-ops | `useGitOpsStore` | 3 files |
| 8 | `stores/topology.ts` | `useTopologyStore` | git-ops | `useGitOpsStore` | 3 files |
| 9 | `stores/gitflow.ts` | `useGitflowStore` | git-ops | `useGitOpsStore` | 6 files |
| 10 | `stores/staging.ts` | `useStagingStore` | ui-state | `useUIStore` | 6 files |
| 11 | `stores/commandPalette.ts` | `useCommandPaletteStore` | ui-state | `useUIStore` | 4 files |
| 12 | `stores/navigation.ts` | `useNavigationStore` | preferences | `usePreferencesStore` | 5 files |
| 13 | `stores/theme.ts` | `useThemeStore` + types | preferences | `usePreferencesStore` | 3 files |
| 14 | `stores/settings.ts` | `useSettingsStore` + types | preferences | `usePreferencesStore` | 6 files |
| 15 | `stores/reviewChecklist.ts` | `useReviewChecklistStore` + types | preferences | `usePreferencesStore` | 3 files |
| 16 | `stores/branchMetadata.ts` | `useBranchMetadataStore` + types | preferences | `usePreferencesStore` | 4 files |

**Total import sites to update: ~66 files** (some files import from multiple shims).

### Migration Strategy

**Approach: Manual migration with grep verification.** NOT jscodeshift.

**Rationale:** The shims follow exactly two patterns:
1. Simple alias: `export const useXStore = useGitOpsStore;` (git-ops, ui-state shims)
2. Alias + type re-exports: `export { type T } from "./domain/X/slice"; export const useXStore = usePreferencesStore;` (preferences shims)

The migration for each consumer is mechanical:
1. Change `import { useXStore } from "../stores/x"` to `import { useGitOpsStore } from "../stores/domain/git-ops"`
2. Find-and-replace `useXStore` with `useGitOpsStore` in the file (or keep the aliased name with local `const useXStore = useGitOpsStore`)

**However**, there is a design question: should consumers continue to use domain-specific names (`useBranchStore`) or switch to the unified store name (`useGitOpsStore`)?

**Recommendation: Keep domain-specific aliases using local const declarations.**

```typescript
// BEFORE (deprecated shim import):
import { useBranchStore } from "../stores/branches";

// AFTER (direct domain import with local alias):
import { useGitOpsStore } from "../stores/domain/git-ops";
const useBranchStore = useGitOpsStore; // readable alias
```

**Why:** Jumping directly to `useGitOpsStore` everywhere would lose semantic meaning. `useBranchStore` communicates intent (I am reading branch data). This is optional -- the planner can decide. But the cognitive load of 25 files all saying `useGitOpsStore` with different selectors is worse than aliased names.

**Alternative (simpler, recommended for speed):** Just change the import path. The store hooks are identical (they all point to the same store), so the old name works fine:

```typescript
// SIMPLEST: just change the import source
import { useGitOpsStore as useBranchStore } from "../stores/domain/git-ops";
```

### Type Re-export Handling

Five shims re-export types alongside the store alias:
- `theme.ts`: `type Theme`, `type ResolvedTheme`
- `settings.ts`: `type SettingsCategory`, `type GeneralSettings`, etc.
- `reviewChecklist.ts`: `type ChecklistItem`, `type FlowType`, `DEFAULT_CHECKLIST`
- `branchMetadata.ts`: `type RecentBranchEntry`

These type imports need to be redirected to their source slice files:

```typescript
// BEFORE:
import { type Theme, useThemeStore } from "../../stores/theme";

// AFTER:
import { usePreferencesStore } from "../../stores/domain/preferences";
import type { Theme } from "../../stores/domain/preferences/theme.slice";
```

### Execution Order

1. **Create a branch** for the migration
2. **Process one shim at a time** (start with lowest consumer count):
   - `clone.ts` (1 consumer) -- validate pattern
   - `tags.ts` (3), `undo.ts` (3), `topology.ts` (3), `reviewChecklist.ts` (3), `theme.ts` (3)
   - `stash.ts` (4), `worktrees.ts` (4), `commandPalette.ts` (4), `branchMetadata.ts` (4)
   - `navigation.ts` (5), `staging.ts` (6), `settings.ts` (6), `gitflow.ts` (6)
   - `branches.ts` (11)
   - `repository.ts` (25) -- highest impact, do last
3. **After each shim migration:** run `npx tsc --noEmit` to verify no type errors
4. **After all migrations:** delete the 16 shim files, run full test suite
5. **Verify:** `grep -r "from.*stores/(branches|tags|stash|worktrees|clone|undo|topology|gitflow|staging|commandPalette|navigation|theme|settings|reviewChecklist|branchMetadata)" src/` returns zero results

### Risk Assessment

- **Low risk** per individual shim (mechanical import path changes)
- **Medium risk** for the `repository.ts` shim (25 consumers including extensions)
- **Important:** The gitflow extension (`src/extensions/gitflow/index.ts`) imports from `../../stores/repository`. This import must be updated to `../../stores/domain/git-ops` during shim removal. Same for conventional-commits and github extensions.

**Confidence:** HIGH -- all 16 shims are trivial re-exports with known consumers.

---

## Test Architecture (MAINT-02)

### Current Test Coverage

- `ExtensionAPI.test.ts`: 12 tests covering context menu, sidebar, status bar, toolbar, git hooks, disposables, cleanup, coreOverride
- `content-viewers.test.ts`: 6 tests covering blade registration, namespacing, lazy flag, source tracking, cleanup, deactivate
- `conventional-commits.test.ts`: 7 tests covering blade registration, namespacing, lazy flag, singleton flag, source tracking, cleanup, deactivate
- `gitflow.test.ts`: 8 tests covering blade registration, namespacing, lazy/singleton flags, source tracking, sidebar panel, toolbar, cleanup, deactivate

**Total extension tests: 33**

### Missing Test Coverage

The success criteria requires: "Extension lifecycle tests cover activate, deactivate, and registry cleanup for all new registries."

| Registry | Registration tested | Cleanup tested | Lifecycle (activate/deactivate) tested |
|----------|-------------------|----------------|---------------------------------------|
| BladeRegistry | Yes (ExtensionAPI + per-extension tests) | Yes | Yes |
| CommandRegistry | Yes (ExtensionAPI) | Yes (via cleanup) | Partially (no per-extension command test) |
| ToolbarRegistry | Yes (gitflow, ExtensionAPI) | Yes | Yes |
| ContextMenuRegistry | Yes (ExtensionAPI) | Yes | Yes |
| SidebarPanelRegistry | Yes (gitflow, ExtensionAPI) | Yes | Yes |
| StatusBarRegistry | Yes (ExtensionAPI) | Yes | Yes |
| GitHookBus | Yes (ExtensionAPI) | Yes | Yes |
| PreviewRegistry | **No** | **No** | **No** |

### New Tests Needed

1. **ExtensionHost lifecycle tests** -- currently no tests for `ExtensionHost.ts`:
   - `registerBuiltIn()` creates ExtensionInfo with correct status
   - `activateExtension()` transitions from "discovered" to "active"
   - `deactivateExtension()` transitions from "active" to "disabled"
   - `deactivateExtension()` calls `api.cleanup()` and `onDeactivate()`
   - Re-activation after deactivation works
   - Activation failure leaves extension in "error" state with cleanup

2. **GitHub extension lifecycle test** -- the most complex extension has no test:
   - Registers 7 blades, 5 commands, 4 toolbar actions
   - Cleanup removes all registrations
   - `onDeactivate()` cancels polling, cleans up subscriptions

3. **Trust level tests** (new for SAND-01):
   - Built-in extensions have `trustLevel: "built-in"`
   - Discovered extensions default to `trustLevel: "sandboxed"`
   - Trust level is reflected in ExtensionInfo

4. **Sandbox bridge tests** (new for SAND-02):
   - Worker creation and termination
   - postMessage round-trip (host sends, worker receives, worker responds)
   - Restricted API throws on requires-trust methods
   - Serialization: only JSON-serializable data crosses boundary

### Testing Patterns for Worker Communication

**Challenge:** Vitest runs in jsdom which does not have real Worker support.

**Solution options:**

1. **Mock Worker with MessageChannel:** jsdom supports `MessageChannel` and `MessagePort`. Create a mock Worker class that uses MessageChannel internally:

```typescript
// test-utils/MockWorker.ts
export class MockWorker {
  private port1: MessagePort;
  private port2: MessagePort;

  constructor() {
    const channel = new MessageChannel();
    this.port1 = channel.port1;
    this.port2 = channel.port2;
  }

  get hostPort(): MessagePort { return this.port1; }
  get workerPort(): MessagePort { return this.port2; }

  // Simulate Worker.postMessage
  postMessage(data: any, transfer?: Transferable[]): void {
    this.port2.postMessage(data, transfer ?? []);
  }

  addEventListener(event: string, handler: (e: MessageEvent) => void): void {
    this.port1.addEventListener(event, handler as EventListener);
  }

  terminate(): void {
    this.port1.close();
    this.port2.close();
  }
}
```

2. **Integration test with real Worker:** Use Vitest's `browser` mode or a custom pool that runs in a real browser context. This is heavier but validates real Worker behavior.

**Recommendation:** Use MockWorker for unit tests (fast, reliable, tests the protocol), with one integration test using a real Worker if the test infrastructure supports it. The prototype's goal is to demonstrate the communication pattern, not to be production-hardened.

### Testing Async Extension Lifecycle

```typescript
describe("ExtensionHost lifecycle", () => {
  beforeEach(() => {
    // Reset extension host state
    useExtensionHost.setState({
      extensions: new Map(),
      isDiscovering: false,
    });
    // Reset all registry stores
    useToolbarRegistry.setState({ actions: new Map(), visibilityTick: 0 });
    useContextMenuRegistry.setState({ items: new Map(), activeMenu: null });
    useSidebarPanelRegistry.setState({ panels: new Map(), visibilityTick: 0 });
    useStatusBarRegistry.setState({ items: new Map(), visibilityTick: 0 });
  });

  it("registerBuiltIn activates and cleanup deactivates atomically", async () => {
    const { registerBuiltIn, deactivateExtension } = useExtensionHost.getState();

    await registerBuiltIn({
      id: "test-ext",
      name: "Test Extension",
      version: "1.0.0",
      activate: async (api) => {
        api.contributeToolbar({ /* ... */ });
        api.contributeContextMenu({ /* ... */ });
      },
    });

    // Verify active state
    const ext = useExtensionHost.getState().extensions.get("test-ext");
    expect(ext?.status).toBe("active");
    expect(useToolbarRegistry.getState().actions.size).toBeGreaterThan(0);

    // Deactivate
    await deactivateExtension("test-ext");

    // Verify all cleanup
    expect(useExtensionHost.getState().extensions.get("test-ext")?.status).toBe("disabled");
    expect(useToolbarRegistry.getState().actions.size).toBe(0);
    expect(useContextMenuRegistry.getState().items.size).toBe(0);
  });
});
```

**Confidence:** HIGH for test patterns, MEDIUM for Worker testing (depends on jsdom MessageChannel support).

---

## Extensibility Patterns

### Registry-Per-Concern

The current architecture already follows this pattern well:

```
Concern         Registry                    Pattern
─────────      ──────────                  ───────
Blades         bladeRegistry.ts            Module Map + functions
Commands       commandRegistry.ts          Module Map + functions
Toolbar        toolbarRegistry.ts          Zustand store
Context Menu   contextMenuRegistry.ts      Zustand store
Sidebar        sidebarPanelRegistry.ts     Zustand store
Status Bar     statusBarRegistry.ts        Zustand store
Previews       previewRegistry.ts          Module Array
Git Hooks      gitHookBus.ts               Event bus class
```

**To make adding new extension points trivial:**

1. **Registry Template:** Establish a canonical Zustand registry template (already exists -- toolbarRegistry is the reference):
   - `items: Map<string, TItem>`
   - `register(item: TItem)`
   - `unregister(id: string)`
   - `unregisterBySource(source: string)`
   - `visibilityTick` + `refreshVisibility()` (for when conditions)
   - Domain-specific accessor (e.g., `getGrouped()`, `getItemsForLocation()`)

2. **ExtensionAPI Method Convention:** Each registry gets a corresponding method on `ExtensionAPI`:
   - Method name: `contribute{RegistryName}(config)` or `register{RegistryName}(config)`
   - Auto-namespacing: `ext:{extensionId}:{config.id}`
   - Priority clamping: extensions get a restricted range, core gets reserved range
   - Source tagging: `ext:{extensionId}` automatically
   - Tracking: pushed to `this.registered{RegistryName}` array for cleanup

3. **Cleanup Integration:** `ExtensionAPI.cleanup()` iterates all tracking arrays and calls `unregisterBySource()` on each registry.

### Event Bus Pattern for Decoupling

The `GitHookBus` provides the template for any future event-driven extension point:

```typescript
// Pattern: typed event bus with source tracking
class SomeEventBus<TEvent extends string, TPayload> {
  private handlers = new Map<TEvent, Set<HandlerEntry<TPayload>>>();

  on(event: TEvent, handler: Handler<TPayload>, source: string): () => void { ... }
  emit(event: TEvent, payload: TPayload): Promise<void> { ... }
  removeBySource(source: string): void { ... }
}
```

### Capability Negotiation (Future)

For v1.7.0+ when sandboxed extensions need declarative UI contributions:

```typescript
// Future: Capability descriptor for sandbox-safe UI registration
interface BladeDescriptor {
  type: string;
  title: string;
  singleton?: boolean;
  // Instead of ComponentType, a declarative UI spec:
  ui: {
    type: "markdown" | "form" | "list" | "custom-element";
    content?: string;      // for markdown
    schema?: object;       // for form
    webComponentUrl?: string; // for custom-element (loaded in iframe)
  };
}
```

This is explicitly out of scope for Phase 41 but the trust level classification (SAND-01) and API classification (SAND-03) lay the groundwork.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker RPC | Manual postMessage + request/response tracking | Comlink | Handles serialization, proxying, error propagation, TypeScript types in 1.1kB |
| Import path migration | jscodeshift codemod | Manual grep + find-replace | Only 66 sites, simple pattern, codemod setup overhead exceeds manual work |
| Trust level enum validation | Runtime string checks | TypeScript union type + exhaustive switch | Compile-time safety |
| Worker mock for tests | Custom event emulation | MessageChannel (jsdom-supported) | Standard API, matches real behavior |
| Extension lifecycle testing | Manual setup/teardown per test | beforeEach reset pattern + shared helpers | Already proven in existing test files |

**Key insight:** The sandbox prototype should be minimal. The goal is proving the communication pattern, not building production infrastructure. Comlink eliminates the need to hand-roll the most complex part (RPC over postMessage).

---

## Common Pitfalls

### Pitfall 1: Over-Engineering the Sandbox Prototype

**What goes wrong:** Developer builds a full Worker isolation system with iframe-based blade rendering, capability negotiation, and a marketplace. Phase takes 3x longer and none of the complex infrastructure is used because no sandboxed extensions exist.

**Why it happens:** The excitement of building a sandbox system leads to scope creep beyond the stated requirements (SAND-02 says "prototype," not "production").

**How to avoid:** The sandbox deliverable is: (1) a Worker that receives code, (2) postMessage RPC working via Comlink, (3) a restricted API proxy that throws on requires-trust methods. Nothing more. No iframe rendering, no marketplace, no code signing.

**Warning signs:** PRs adding `<iframe>` elements, Content-Security-Policy changes, code signing infrastructure, or a "store" for downloading extensions.

### Pitfall 2: Breaking Extension Imports During Shim Removal

**What goes wrong:** The gitflow, conventional-commits, and github extensions import from `../../stores/repository`. Removing the shim without updating these imports breaks the extensions.

**Why it happens:** Developer focuses on component/blade consumers and forgets that extensions also import from the deprecated shim paths.

**How to avoid:** Include extension entry points in the consumer audit. Grep `src/extensions/` for all deprecated store imports. Update them as part of the shim removal.

**Warning signs:** TypeScript compilation errors in `src/extensions/` after shim deletion.

### Pitfall 3: Type Re-exports Lost During Migration

**What goes wrong:** Five shims re-export types (`Theme`, `SettingsCategory`, `ChecklistItem`, etc.) alongside store aliases. Deleting the shim file removes the type re-export, breaking consumers.

**Why it happens:** Developer treats all 16 shims as identical "just rename import" when 5 of them also re-export types from slice files.

**How to avoid:** For each shim with type re-exports, ensure consumers of those types update their imports to the source slice file, not just the store.

**Warning signs:** `Cannot find name 'Theme'` or `Cannot find name 'SettingsCategory'` compilation errors after shim deletion.

### Pitfall 4: Structured Clone Failures in Worker Tests

**What goes wrong:** Test sends a function or React element through postMessage/Comlink and gets a `DataCloneError` because functions are not structured-clonable.

**Why it happens:** Developer accidentally passes a callback or component reference through the sandbox bridge.

**How to avoid:** The `SandboxedExtensionAPI` proxy must validate that all data sent to the Worker is JSON-serializable. In tests, use only plain objects and primitives.

**Warning signs:** `DOMException: Failed to execute 'postMessage'` errors in tests.

### Pitfall 5: Version Bump Without Full Test Suite Pass

**What goes wrong:** Version is bumped to 1.6.0 but a test failure goes unnoticed, or the version bump is done before all other MAINT tasks complete.

**Why it happens:** Version bump (MAINT-04) is treated as a standalone task rather than the final step.

**How to avoid:** MAINT-04 must be the absolute last task. It runs after all shim removals (MAINT-01), all test additions (MAINT-02), and documentation updates (MAINT-03). The version bump commit should have a green CI pipeline.

**Warning signs:** Version bump PR created while other Phase 41 tasks are still in progress.

---

## Code Examples

### Trust Level Check in Activation Pipeline

```typescript
// In ExtensionHost.ts -- activateExtension modification
activateExtension: async (id: string) => {
  const ext = get().extensions.get(id);
  if (!ext) return;

  // Trust level determines execution environment
  const trustLevel = ext.trustLevel ?? "sandboxed";

  if (trustLevel === "sandboxed") {
    // Future: activate in Worker via SandboxBridge
    console.warn(`Sandboxed extension "${id}" not yet supported. Skipping activation.`);
    updateExtension(get, set, id, {
      status: "error",
      error: "Sandboxed extensions are not yet supported (v1.7.0+)",
    });
    return;
  }

  // Existing activation logic for trusted extensions
  // ...
},
```

### API Classification Documentation (In-Code)

```typescript
// In ExtensionAPI.ts -- classification comments
export class ExtensionAPI {
  /**
   * Register a blade type.
   * @sandboxSafety requires-trust
   * @reason Accepts React ComponentType which is not serializable across Worker boundary.
   */
  registerBlade(config: ExtensionBladeConfig): void { ... }

  /**
   * Register a handler for post-operation git events.
   * @sandboxSafety sandbox-safe
   * @reason Handler receives serializable GitHookContext. No DOM or React access needed.
   */
  onDidGit(operation: GitOperation, handler: DidHandler): void { ... }
}
```

### Shim Removal Migration Example

```typescript
// BEFORE (src/components/Header.tsx):
import { useBranchStore } from "../stores/branches";
import { useStashStore } from "../stores/stash";
import { useTagStore } from "../stores/tags";

// AFTER:
import { useGitOpsStore } from "../stores/domain/git-ops";
// Local aliases for readability (optional but recommended):
const useBranchStore = useGitOpsStore;
const useStashStore = useGitOpsStore;
const useTagStore = useGitOpsStore;
```

Or the more compact form:

```typescript
// AFTER (compact):
import { useGitOpsStore as useBranchStore } from "../stores/domain/git-ops";
import { useGitOpsStore as useStashStore } from "../stores/domain/git-ops";
import { useGitOpsStore as useTagStore } from "../stores/domain/git-ops";
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 16 re-export shims in `stores/` | Direct domain imports (`stores/domain/git-ops`, etc.) | Phase 30 (created shims), Phase 41 (removes them) | Cleaner import graph, fewer indirection layers |
| Boolean `builtIn` flag | Three-valued `TrustLevel` enum | Phase 41 | Explicit security model, sandbox-ready |
| All extensions run in main thread | Trust-based execution environment selection | Phase 41 (prep), Phase 47+ (implementation) | Foundation for sandboxed third-party extensions |
| No API classification | Sandbox-safe vs requires-trust annotations | Phase 41 | Documented security boundary for ExtensionAPI |

**Deprecated/outdated:**
- ShadowRealm (TC39 Stage 2.7): Not available in any runtime. OUT OF SCOPE.
- Iframe sandboxing in Tauri: Documented limitations (Windows ES Module, Linux request confusion). OUT OF SCOPE.
- `builtIn?: boolean` on ExtensionInfo: Will be superseded by `trustLevel` but should be kept for backward compatibility in v1.6.0 (remove in v1.7.0).

---

## Open Questions

### 1. Should `useRepositoryStore` Alias Be Preserved As a Convention?

**What we know:** `useRepositoryStore` is used in 25 files and is the most intuitive name for "the store where I get repo status." The target store `useGitOpsStore` is a mega-store containing branches, tags, stash, worktrees, clone, undo, topology, gitflow, AND repository data.

**What's unclear:** Is `useGitOpsStore` the right name for consumer code, or should consumers use aliases like `useRepositoryStore = useGitOpsStore`?

**Recommendation:** Use `import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops"` pattern. This preserves semantic clarity while eliminating the shim file. The planner should decide if this is worth the verbosity.

### 2. Should the Sandbox Prototype Support Any Real Extension?

**What we know:** SAND-02 requires "a Worker-based sandbox prototype demonstrates postMessage communication." This could be satisfied by a synthetic test extension (test-only code) or by actually sandboxing a simple built-in extension.

**What's unclear:** What level of completeness is expected? A test harness demonstrating the bridge? Or a working extension running in a Worker?

**Recommendation:** Build the bridge with a synthetic test extension. Do NOT attempt to sandbox a real built-in extension like content-viewers -- they all use React components which cannot cross the Worker boundary. The prototype extension should do something minimal like registering a git hook handler (which IS sandbox-safe).

### 3. Should PreviewRegistry Get Source Tracking and Cleanup?

**What we know:** PreviewRegistry (`src/lib/previewRegistry.ts`) is a module-level array with no source tracking and no `unregisterBySource()`. It is not exposed through ExtensionAPI.

**What's unclear:** Should Phase 41 add source tracking and cleanup to PreviewRegistry for consistency, or is this out of scope?

**Recommendation:** Out of scope for Phase 41. PreviewRegistry is currently only used by core registrations (binary file preview). When an extension needs to contribute preview handlers, the registry should be upgraded. Document this as future work.

### 4. Documentation Website (MAINT-03) Scope

**What we know:** The requirement says "Documentation website updated for v1.6.0 extension architecture." It is unclear if this refers to inline code documentation, a separate docs site, or README updates.

**What's unclear:** What documentation deliverable satisfies MAINT-03?

**Recommendation:** Interpret as: (1) JSDoc comments on all new types and methods (trust level, sandbox classification), (2) README section describing the extension system architecture, (3) `EXTENSIONS.md` guide for extension developers. Do NOT build a documentation website (out of scope for a CLI/desktop app release).

---

## Recommendations

### Prioritized Architectural Decisions

1. **Use Comlink for Worker RPC** (SAND-02). Install as runtime dependency. Build the SandboxBridge as a thin wrapper around Comlink's wrap/expose pattern with MessageChannel. [HIGH confidence]

2. **Add `trustLevel` field to Rust manifest + TypeScript types** (SAND-01). Default to `"sandboxed"` for external extensions, force `"built-in"` for `registerBuiltIn()`. Keep existing `builtIn?: boolean` for backward compatibility. [HIGH confidence]

3. **Classify API methods with JSDoc annotations** (SAND-03). Use `@sandboxSafety` tag. Build `SandboxedExtensionAPI` proxy class that throws on requires-trust methods. Document the classification in a table in the code. [HIGH confidence]

4. **Remove shims smallest-first** (MAINT-01). Process in ascending consumer-count order. Use `import { useGitOpsStore as useXStore }` pattern for readability. Type re-exports redirect to source slices. [HIGH confidence]

5. **Add ExtensionHost lifecycle tests** (MAINT-02). Cover registerBuiltIn, activate, deactivate, re-activate, error recovery. Test all registries are cleaned up. [HIGH confidence]

6. **Sandbox prototype uses synthetic extension** (SAND-02). Do NOT sandbox a real extension. Create a test-only extension that registers a git hook handler through the Worker bridge. [HIGH confidence]

7. **Version bump LAST** (MAINT-04). After all other tasks complete, bump `package.json` and `Cargo.toml` from 1.5.0 to 1.6.0. [HIGH confidence]

### Task Ordering

```
Track A (Sandbox):     SAND-01 → SAND-03 → SAND-02
Track B (Maintenance): MAINT-01 → MAINT-02 → MAINT-03
Final:                 MAINT-04 (version bump, depends on all above)
```

Tracks A and B can run in parallel. SAND-01 (trust level types) should come before SAND-03 (API classification) because the classification references trust levels. SAND-02 (Worker prototype) comes last in Track A because it depends on both the trust types and the API classification.

---

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/extensions/ExtensionAPI.ts` (341 lines) -- all methods analyzed for sandbox safety
- Codebase analysis: `src/extensions/ExtensionHost.ts` (403 lines) -- lifecycle pipeline, trust level injection points
- Codebase analysis: `src-tauri/src/extensions/manifest.rs` (99 lines) -- Rust manifest struct for trust_level field addition
- Codebase analysis: 16 deprecated shim files in `src/stores/` -- complete inventory with consumer counts
- Codebase analysis: `src/extensions/__tests__/` (4 test files, 33 tests) -- current test coverage baseline
- Codebase analysis: All 7 registries (blade, command, toolbar, context menu, sidebar, status bar, preview) -- source tracking and cleanup capabilities
- `.planning/research/v1.6.0-ARCHITECTURE.md` -- Sandbox Infrastructure section, Trust Level Summary, Anti-Pattern #5
- `.planning/research/v1.6.0-PITFALLS.md` -- Pitfall #7 (iframe IPC blocked), Pitfall #10 (shim accumulation)
- `.planning/phases/37-extension-platform-foundation/37-ARCHITECTURE-RESEARCH.md` -- Registry patterns, cleanup order, extensibility design
- `.planning/phases/40-gitflow-extraction/40-RESEARCH-ARCHITECTURE.md` -- Extension extraction proven patterns

### Secondary (MEDIUM confidence)
- [Comlink GitHub](https://github.com/GoogleChromeLabs/comlink) -- API documentation, TypeScript types, MessagePort usage (via Context7)
- [VS Code Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host) -- Process isolation architecture reference
- [VS Code Process Sandboxing](https://code.visualstudio.com/blogs/2022/11/28/vscode-sandbox) -- Migration to process sandboxing
- [VS Code Extension Runtime Security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security) -- Workspace trust model
- [Tauri v2 Isolation Pattern](https://v2.tauri.app/concept/inter-process-communication/isolation/) -- iframe limitations, IPC security
- [Chrome Manifest V3 Security](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security) -- Permission model reference
- [Capability-Based Security (Wikipedia)](https://en.wikipedia.org/wiki/Capability-based_security) -- Theory behind object-capability security model
- [MessageChannel vs BroadcastChannel](https://medium.com/@codewithrajat/have-you-ever-wondered-which-is-best-for-inter-context-communication-in-your-web-app-the-eb3fed32f80c) -- Communication primitive tradeoffs

### Tertiary (LOW confidence)
- [Web Worker Sandboxing Gist](https://gist.github.com/pfrazee/8949363) -- General in-app sandboxing patterns
- [VS Code Extension Sandbox Issue #59756](https://github.com/microsoft/vscode/issues/59756) -- Open discussion, not implemented

---

## Metadata

**Confidence breakdown:**
- Trust level system (SAND-01): HIGH -- simple type extension with clear prior art (builtIn flag, VS Code workspace trust, Chrome permissions)
- Worker sandbox prototype (SAND-02): MEDIUM -- standard Comlink/Worker patterns are well-known, but Tauri-specific Worker behavior unverified
- API classification (SAND-03): HIGH -- based on direct analysis of each method's parameter serializability
- Shim removal (MAINT-01): HIGH -- all 16 shims inventoried with consumer counts, mechanical migration
- Test architecture (MAINT-02): HIGH -- existing test patterns provide templates, clear gaps identified
- Version bump (MAINT-04): HIGH -- trivial file edits
- Documentation (MAINT-03): MEDIUM -- scope unclear, recommendation provided

**Research date:** 2026-02-10
**Valid until:** 2026-03-12 (30 days -- patterns stable, no external dependency changes expected)
