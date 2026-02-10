# Phase 37: Extension Platform Foundation -- Architecture Research

**Phase:** 37 of 41
**Researched:** 2026-02-10
**Confidence:** HIGH
**Scope:** Registry patterns, event bus design, extensibility enforcement, forward compatibility for Phases 38-41

---

## 1. Summary of Architectural Approach

Phase 37 builds the infrastructure that Phases 38-41 consume. It introduces four new registries (ContextMenu, SidebarPanel, StatusBar, GitHook), expands the ExtensionAPI with six new methods, and establishes the dispose/cleanup contract that all future extensions depend on. The design philosophy is:

**Registry-centric contribution model.** Extensions never inject UI directly into core layouts. Instead, they register typed contribution descriptors into Zustand-based registries. Core UI components read those registries and render dynamically. This inverts the dependency: core depends on registry interfaces, not on extension implementations.

**Event-driven decoupling.** The GitHookBus replaces cross-slice method calls (`get().loadBranches()`) with pub/sub events. Extensions emit events after git operations; core store slices subscribe to refresh themselves. This eliminates the circular import risk that would otherwise block Gitflow extraction in Phase 40.

**Disposable tracking with automatic cleanup.** Every registration made through ExtensionAPI is tracked internally. When an extension deactivates, `cleanup()` atomically removes all contributions from all registries. Extensions can also register custom teardown callbacks via `onDispose()` for Zustand subscriptions, timers, and other side effects.

**Forward compatibility by design.** Each new registry and API surface is designed for the specific needs of Phases 38-41, but implemented generically so they serve unknown future extensions too. The typing is strict where it matters (context menu locations, hook operation types) and open where extensibility is needed (custom groups, arbitrary metadata).

---

## 2. Registry Pattern Analysis

### 2.1 Current Registry Landscape

FlowForge already has three registries with two distinct patterns:

| Registry | Storage | Pattern | Zustand? | Source Tagging | Cleanup |
|----------|---------|---------|----------|----------------|---------|
| `bladeRegistry.ts` | Module-level `Map<string, BladeRegistration>` | Imperative functions | No | Yes (`source`) | `unregisterBlade()`, `unregisterBySource()` |
| `commandRegistry.ts` | Module-level `Map<string, Command>` | Imperative functions | No | Yes (`source`) | `unregisterCommand()`, `unregisterCommandsBySource()` |
| `toolbarRegistry.ts` | Zustand store `Map<string, ToolbarAction>` | Zustand + devtools | Yes | Yes (`source`) | `unregister()`, `unregisterBySource()` |

The blade and command registries use module-level Maps with exported functions. The toolbar registry uses a Zustand store. Both patterns work, but have different trade-offs.

### 2.2 Options Analyzed

#### Option A: Module-Level Map with Exported Functions (bladeRegistry/commandRegistry pattern)

```typescript
const registry = new Map<string, ContextMenuItem>();

export function registerContextMenuItem(item: ContextMenuItem): void {
  registry.set(item.id, item);
}
export function unregisterBySource(source: string): void {
  for (const [id, item] of registry) {
    if (item.source === source) registry.delete(id);
  }
}
export function getItemsForLocation(location: ContextMenuLocation, context: ContextMenuContext): ContextMenuItem[] {
  return Array.from(registry.values())
    .filter(item => item.location === location && (!item.when || item.when(context)))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
```

**Pros:** Simple, zero overhead, no Zustand boilerplate, works with static registrations.
**Cons:** No reactivity. UI components cannot subscribe to registration changes. When a new extension registers an item, already-rendered components will not update until they re-render for another reason. No devtools integration for debugging registration state.

#### Option B: Zustand Store (toolbarRegistry pattern)

```typescript
export const useContextMenuRegistry = create<ContextMenuRegistryState>()(
  devtools((set, get) => ({
    items: new Map<string, ContextMenuItem>(),
    register: (item) => { /* immutable Map update */ },
    unregisterBySource: (source) => { /* filter + set */ },
    getItemsForLocation: (location, context) => { /* filter + sort */ },
  }), { name: "context-menu-registry", enabled: import.meta.env.DEV }),
);
```

**Pros:** Reactive -- UI components using `useContextMenuRegistry(selector)` automatically re-render when registrations change. Devtools middleware shows registration history. Consistent with toolbar registry. Supports `visibilityTick` pattern for forcing `when()` re-evaluation.
**Cons:** Zustand overhead (immutable Map replacement on every register call). Slightly more boilerplate. Need to be careful about selector memoization with Map values.

#### Option C: Class-Based Registry with EventEmitter

```typescript
class ContextMenuRegistry extends EventEmitter {
  private items = new Map<string, ContextMenuItem>();
  register(item: ContextMenuItem): void { this.items.set(item.id, item); this.emit('change'); }
  // ...
}
export const contextMenuRegistry = new ContextMenuRegistry();
```

**Pros:** OOP encapsulation, event-driven updates.
**Cons:** Not reactive in React without a hook wrapper. Diverges from existing patterns. No devtools integration. Would need a `useSyncExternalStore` bridge for React compatibility -- essentially re-implementing what Zustand already does.

### 2.3 Recommendation: Zustand Store (Option B)

**Use the Zustand store pattern for all four new registries.** Rationale:

1. **Reactivity is required.** The SidebarPanelRegistry feeds `RepositoryView.tsx`, which must re-render when a panel is registered or removed (extension enable/disable). The StatusBarRegistry feeds a new `<StatusBar />` component. Context menus must reflect newly registered items. All of these require reactive state.

2. **Proven template.** `toolbarRegistry.ts` provides an exact, working template: Map-based storage, immutable updates, source-based batch unregister, devtools middleware, sorted/filtered accessor. Copy the structure; change the types.

3. **Consistency.** Four registries with the same pattern creates a predictable API surface. Extension developers learn one pattern. Code reviewers check the same invariants.

4. **Devtools value.** The devtools middleware makes registration debugging trivial during development. For an extension platform where registration timing matters, this observability is significant.

**Migrate blade and command registries to Zustand later (Phase 41 or tech debt).** For Phase 37, only the four NEW registries use Zustand. Migrating existing registries is out of scope and risks regressions.

### 2.4 Registry Interface Contract

All four new registries should implement this common shape:

```typescript
interface RegistryState<TItem extends { id: string; source?: string }> {
  items: Map<string, TItem>;
  register: (item: TItem) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;
}
```

Each registry adds its own domain-specific accessor methods (e.g., `getItemsForLocation()`, `getPanels()`, `getItems()`).

### 2.5 Ordering and Priority

All registries that produce visible lists use `priority: number` for deterministic ordering:

- **Higher priority = renders first / closer to edge.** Consistent with toolbar (higher = collapses last).
- **Same priority = alphabetical by ID.** Deterministic fallback. Extension IDs include namespace, so `ext:gitflow:panel` sorts before `ext:github:panel`.
- **Group separators.** Context menu uses `group: string` for visual dividers between sections. Groups themselves are ordered by convention (core groups first, extension groups after).

### 2.6 Cleanup Order

`ExtensionAPI.cleanup()` must call `unregisterBySource(source)` on ALL registries in a safe order:

1. **GitHookBus first** -- stop receiving events before removing UI.
2. **Context menus** -- no longer offer actions.
3. **Sidebar panels** -- unmounts React component trees.
4. **Status bar items** -- unmounts widgets.
5. **Toolbar actions** -- removes buttons (existing).
6. **Commands** -- removes palette entries (existing).
7. **Blades** -- unregisters types (existing). Open blades with this type show a "blade unavailable" fallback.
8. **Custom disposables** -- run `onDispose` callbacks last, as they may reference items from steps 1-7.

---

## 3. GitHookBus Design

### 3.1 Why a Dedicated Event Bus (Not Zustand Subscription)

Three options were evaluated for git operation event propagation:

| Approach | Description | Verdict |
|----------|-------------|---------|
| **Zustand subscription** | Extensions subscribe to store selectors (e.g., `useBranchStore.subscribe(...)`) | **Rejected.** Creates direct dependency on core stores. The exact thing we need to decouple. |
| **DOM CustomEvents** | `document.dispatchEvent(new CustomEvent('git:commit', { detail: {...} }))` | **Rejected.** Untyped, no async support, no priority ordering, no cleanup tracking. |
| **Custom TypeScript event bus** | Singleton class with typed on/off/emit, async handler support | **Selected.** Typed, decoupled, supports async, trackable for cleanup, no store dependency. |

### 3.2 Event Taxonomy

Two event phases, each serving a different purpose:

**`onWill*` (intercepting, pre-operation):**
- Fires BEFORE the git operation executes.
- Handlers run sequentially in priority order.
- A handler can signal cancellation by returning `{ cancel: true, reason: string }`.
- If any handler cancels, the operation does not proceed and the UI shows the reason.
- **v1.6.0 scope:** Only `onWillCommit` is implemented as an interceptor (needed by Phase 39 CC validation). All other `onWill*` hooks are deferred.

**`onDid*` (tap-only, post-operation):**
- Fires AFTER the git operation completes (success or failure).
- Handlers run in parallel (fire-and-forget with error catching).
- Handlers receive the operation result (success/error + context).
- Handlers CANNOT modify or cancel anything -- purely observational.
- **v1.6.0 scope:** Full set implemented: `onDidCommit`, `onDidPush`, `onDidPull`, `onDidFetch`, `onDidCheckout`, `onDidBranchCreate`, `onDidBranchDelete`, `onDidMerge`, `onDidStash`, `onDidTagCreate`.

### 3.3 Recommended Implementation

```typescript
// src/lib/gitHookBus.ts

export type GitOperation =
  | "commit" | "push" | "pull" | "fetch"
  | "checkout" | "branch-create" | "branch-delete"
  | "merge" | "stash" | "tag-create";

export interface GitHookContext {
  operation: GitOperation;
  branchName?: string;
  commitOid?: string;
  tagName?: string;
  error?: string;          // Present when operation failed
  isInternal?: boolean;    // True for programmatic operations (suppress cascades)
}

// For onWill* interceptors
export interface WillHookResult {
  cancel?: boolean;
  reason?: string;
}

type DidHandler = (ctx: GitHookContext) => void | Promise<void>;
type WillHandler = (ctx: GitHookContext) => WillHookResult | Promise<WillHookResult | void> | void;

interface HandlerEntry<H> {
  handler: H;
  priority: number;
  source: string;
}

class GitHookBus {
  private didHandlers = new Map<GitOperation, Set<HandlerEntry<DidHandler>>>();
  private willHandlers = new Map<GitOperation, Set<HandlerEntry<WillHandler>>>();
  private reentryDepth = 0;

  // --- onDid* registration ---
  onDid(operation: GitOperation, handler: DidHandler, source: string, priority = 0): () => void {
    const entry: HandlerEntry<DidHandler> = { handler, priority, source };
    if (!this.didHandlers.has(operation)) this.didHandlers.set(operation, new Set());
    this.didHandlers.get(operation)!.add(entry);
    return () => this.didHandlers.get(operation)?.delete(entry);
  }

  // --- onWill* registration ---
  onWill(operation: GitOperation, handler: WillHandler, source: string, priority = 0): () => void {
    const entry: HandlerEntry<WillHandler> = { handler, priority, source };
    if (!this.willHandlers.has(operation)) this.willHandlers.set(operation, new Set());
    this.willHandlers.get(operation)!.add(entry);
    return () => this.willHandlers.get(operation)?.delete(entry);
  }

  // --- Emit onDid* (parallel, fire-and-forget) ---
  async emitDid(operation: GitOperation, ctx: Partial<GitHookContext> = {}): Promise<void> {
    if (this.reentryDepth > 0) return; // Suppress cascading hooks
    this.reentryDepth++;
    try {
      const fullCtx: GitHookContext = { operation, ...ctx };
      const handlers = this.didHandlers.get(operation);
      if (!handlers || handlers.size === 0) return;

      const promises = Array.from(handlers).map(async (entry) => {
        try { await entry.handler(fullCtx); }
        catch (e) { console.error(`[GitHookBus] onDid:${operation} handler error (${entry.source}):`, e); }
      });
      await Promise.allSettled(promises);
    } finally {
      this.reentryDepth--;
    }
  }

  // --- Emit onWill* (sequential by priority, can cancel) ---
  async emitWill(operation: GitOperation, ctx: Partial<GitHookContext> = {}): Promise<WillHookResult> {
    const fullCtx: GitHookContext = { operation, ...ctx };
    const handlers = this.willHandlers.get(operation);
    if (!handlers || handlers.size === 0) return {};

    // Sort by priority descending (higher priority runs first)
    const sorted = Array.from(handlers).sort((a, b) => b.priority - a.priority);

    for (const entry of sorted) {
      try {
        const result = await entry.handler(fullCtx);
        if (result?.cancel) return { cancel: true, reason: result.reason ?? `Cancelled by ${entry.source}` };
      } catch (e) {
        console.error(`[GitHookBus] onWill:${operation} handler error (${entry.source}):`, e);
        // Don't cancel on handler error -- fail open
      }
    }
    return {};
  }

  // --- Source-based cleanup ---
  removeBySource(source: string): void {
    for (const handlers of this.didHandlers.values()) {
      for (const entry of handlers) {
        if (entry.source === source) handlers.delete(entry);
      }
    }
    for (const handlers of this.willHandlers.values()) {
      for (const entry of handlers) {
        if (entry.source === source) handlers.delete(entry);
      }
    }
  }
}

export const gitHookBus = new GitHookBus();
```

### 3.4 Design Decisions

**Re-entrancy guard.** The `reentryDepth` counter prevents infinite loops where a hook handler triggers a git operation that fires more hooks. When `reentryDepth > 0`, `emitDid` returns immediately. This is critical for preventing the cascade pitfall identified in the research.

**Fail-open for `onWill*`.** If a handler throws an error, the operation proceeds anyway. A buggy extension should not block core git operations. Only explicit `{ cancel: true }` return values prevent the operation.

**`onDid*` runs in parallel.** Post-operation handlers are observational and independent. Running them in parallel with `Promise.allSettled` prevents one slow handler from blocking others.

**`onWill*` runs sequentially by priority.** Pre-operation interceptors may depend on order (e.g., message transformation before validation). Sequential execution with priority sorting gives deterministic behavior.

**Source tracking.** Every handler entry records its source (e.g., `"ext:gitflow"`). This enables `removeBySource()` for atomic cleanup on extension deactivation.

### 3.5 How Core Stores Wire Into GitHookBus

Core store slices subscribe to `onDid*` events to replace the current cross-slice coupling:

```typescript
// In a setup module (e.g., src/lib/gitHookBusWiring.ts), called at app startup:
import { gitHookBus } from "./gitHookBus";
import { useGitOpsStore } from "../stores/domain/git-ops";

export function wireGitHookBus(): void {
  // Branch refresh on branch-affecting operations
  gitHookBus.onDid("branch-create", () => useGitOpsStore.getState().loadBranches(), "core", 100);
  gitHookBus.onDid("branch-delete", () => useGitOpsStore.getState().loadBranches(), "core", 100);
  gitHookBus.onDid("checkout", () => {
    useGitOpsStore.getState().loadBranches();
    useGitOpsStore.getState().refreshRepoStatus();
  }, "core", 100);
  gitHookBus.onDid("merge", () => {
    useGitOpsStore.getState().loadBranches();
    useGitOpsStore.getState().refreshRepoStatus();
  }, "core", 100);

  // Repo status refresh on commit/push/pull
  gitHookBus.onDid("commit", () => useGitOpsStore.getState().refreshRepoStatus(), "core", 100);
  gitHookBus.onDid("push", () => useGitOpsStore.getState().refreshRepoStatus(), "core", 100);
  gitHookBus.onDid("pull", () => {
    useGitOpsStore.getState().loadBranches();
    useGitOpsStore.getState().refreshRepoStatus();
  }, "core", 100);
}
```

Core handlers use `priority: 100` (high) so they execute before extension handlers, ensuring the store is fresh when extensions read it.

### 3.6 Avoiding Circular Dependencies

The GitHookBus is a leaf module with zero imports from stores or extensions:

```
gitHookBus.ts imports: nothing from src/stores/ or src/extensions/
stores/domain/git-ops/ imports: gitHookBus (one-directional)
extensions/gitflow/ imports: gitHookBus (one-directional)
```

The bus is the mediator. Stores and extensions both point inward to it but never to each other. This is dependency inversion at its most basic: both high-level (extensions) and low-level (stores) depend on the abstraction (bus), not on each other.

---

## 4. ExtensionAPI Surface Design

### 4.1 Current Surface (v1.5.0)

```typescript
class ExtensionAPI {
  registerBlade(config: ExtensionBladeConfig): void;
  registerCommand(config: ExtensionCommandConfig): void;
  contributeToolbar(config: ExtensionToolbarConfig): void;
  cleanup(): void;
}
```

Three registration methods, one cleanup. All methods namespace IDs with `ext:{extensionId}:` and track registrations in internal arrays for cleanup.

### 4.2 Expanded Surface (v1.6.0)

The API expands with six new methods plus the dispose pattern:

```typescript
class ExtensionAPI {
  // --- Existing (v1.5.0) ---
  registerBlade(config: ExtensionBladeConfig): void;
  registerCommand(config: ExtensionCommandConfig): void;
  contributeToolbar(config: ExtensionToolbarConfig): void;

  // --- New registries (v1.6.0) ---
  contributeContextMenu(config: ExtensionContextMenuConfig): void;
  contributeSidebarPanel(config: ExtensionSidebarPanelConfig): void;
  contributeStatusBar(config: ExtensionStatusBarConfig): void;

  // --- Git hooks (v1.6.0) ---
  onDidGit(operation: GitOperation, handler: DidHandler): void;
  onWillGit(operation: GitOperation, handler: WillHandler): void;

  // --- Dispose pattern (v1.6.0) ---
  onDispose(callback: () => void | Promise<void>): void;

  // --- Cleanup (expanded) ---
  cleanup(): void;  // Now covers all 7 registry types + custom disposables
}
```

### 4.3 Naming Convention Analysis

**Why flat methods instead of namespaced objects (e.g., `api.contextMenu.register()`)?**

Namespaced API:
```typescript
api.contextMenu.register({ ... });
api.sidebar.register({ ... });
api.statusBar.register({ ... });
api.git.onDid("commit", handler);
```

Flat API:
```typescript
api.contributeContextMenu({ ... });
api.contributeSidebarPanel({ ... });
api.contributeStatusBar({ ... });
api.onDidGit("commit", handler);
```

**Recommendation: Flat methods.** Rationale:

1. **Consistency with existing API.** The existing methods (`registerBlade`, `registerCommand`, `contributeToolbar`) are flat. Switching to namespaces mid-API creates inconsistency.
2. **Simpler implementation.** Each method is a single function on the class. No need for sub-objects or proxy patterns.
3. **Better autocomplete.** TypeScript shows all available methods when typing `api.`. With namespaces, the user must know to type `api.contextMenu.` first.
4. **VS Code uses flat methods.** `vscode.commands.registerCommand()` looks namespaced, but that is because `commands` is a module import, not an object on a single API class. The individual extension context API (`context.subscriptions.push(disposable)`) is flat.

**Naming rules:**
- `contributeX()` for UI contributions (context menu, sidebar panel, status bar, toolbar). "Contribute" signals "I am adding something visible."
- `registerX()` for type registrations (blade, command). "Register" signals "I am declaring a capability."
- `onDidX()` / `onWillX()` for event hooks. Matches VS Code's `onDid*` / `onWill*` naming convention.
- `onDispose()` for cleanup callbacks. Matches VS Code's `Disposable` pattern semantically.

### 4.4 Type Safety for Config Objects

Each config type is specific to its registry, not generic:

```typescript
// Context menu -- typed location and context
export interface ExtensionContextMenuConfig {
  id: string;
  label: string;
  icon?: LucideIcon;
  location: ContextMenuLocation;
  group?: string;
  priority?: number;
  when?: (context: ContextMenuContext) => boolean;
  execute: (context: ContextMenuContext) => void | Promise<void>;
}

// Sidebar panel -- requires React component
export interface ExtensionSidebarPanelConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  component: ComponentType<any>;
  priority?: number;
  defaultOpen?: boolean;
  when?: () => boolean;
}

// Status bar -- requires render function or text
export interface ExtensionStatusBarConfig {
  id: string;
  alignment: "left" | "right";
  priority?: number;
  when?: () => boolean;
  execute?: () => void | Promise<void>;
  renderCustom: (tabIndex: number) => ReactNode;
}
```

Note: `component` and `renderCustom` accept React elements, which are NOT JSON-serializable. This is intentional for v1.6.0 where all extensions are trusted and run in-process. Phase 41 (Sandbox) will classify these as "trusted-only" API methods.

### 4.5 Internal Tracking

The ExtensionAPI class tracks registrations in parallel arrays, one per registry type:

```typescript
class ExtensionAPI {
  private extensionId: string;
  // Existing
  private registeredBlades: string[] = [];
  private registeredCommands: string[] = [];
  private registeredToolbarActions: string[] = [];
  // New
  private registeredContextMenuItems: string[] = [];
  private registeredSidebarPanels: string[] = [];
  private registeredStatusBarItems: string[] = [];
  private hookUnsubscribers: (() => void)[] = [];
  private customDisposables: (() => void | Promise<void>)[] = [];
  // ...
}
```

Git hook registrations are tracked as unsubscribe functions (returned by `gitHookBus.onDid/onWill`) rather than IDs, because the bus uses function references internally.

---

## 5. Dispose/Cleanup Pattern

### 5.1 VS Code's Disposable Pattern (Reference)

VS Code uses a `Disposable` interface with a single `dispose()` method. Extensions push disposables into `context.subscriptions`, and VS Code calls `dispose()` on each when the extension deactivates.

```typescript
// VS Code pattern
export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('ext.hello', () => { ... });
  context.subscriptions.push(disposable);  // Automatic cleanup
}
```

Key insight: the extension does not need to manage cleanup explicitly. The framework tracks everything and disposes atomically.

### 5.2 FlowForge's Adapted Pattern

FlowForge already partially implements this. The `ExtensionAPI` instance IS the disposable container. `cleanup()` IS the dispose method. The difference from VS Code is that FlowForge's registrations are tracked implicitly (every `registerX()` call adds to the internal tracking array) rather than explicitly (no `push(disposable)` needed).

For v1.6.0, we add `onDispose()` for extension-specific cleanup that the API cannot track automatically:

```typescript
// Extension-side usage
export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Automatic tracking -- api.cleanup() handles these
  api.registerBlade({ ... });
  api.contributeSidebarPanel({ ... });

  // Manual tracking via onDispose -- for things ExtensionAPI cannot track
  const unsubRepoWatch = useRepositoryStore.subscribe(/* ... */);
  api.onDispose(() => unsubRepoWatch());

  const intervalId = setInterval(() => pollStatus(), 30000);
  api.onDispose(() => clearInterval(intervalId));
}

export function onDeactivate(): void {
  // Extension-specific teardown that needs to happen BEFORE cleanup()
  cancelActivePolling();
}
```

### 5.3 Cleanup Lifecycle Sequence

When `ExtensionHost.deactivateExtension(id)` is called:

```
1. Call module.onDeactivate()
   - Extension performs its own pre-cleanup (cancel polling, reset state)
   - May fail -- errors are caught and logged, cleanup continues

2. Call api.cleanup()
   a. gitHookBus.removeBySource("ext:{id}")     -- stop receiving events
   b. contextMenuRegistry.unregisterBySource()   -- remove menu items
   c. sidebarPanelRegistry.unregisterBySource()  -- remove sidebar panels
   d. statusBarRegistry.unregisterBySource()     -- remove status bar items
   e. toolbarRegistry.unregisterBySource()       -- remove toolbar actions
   f. commandRegistry: unregister each tracked command
   g. bladeRegistry: unregister each tracked blade type
   h. For each hookUnsubscriber: call it          -- detach bus listeners
   i. For each customDisposable: call it           -- run onDispose callbacks
   j. Reset all internal tracking arrays to []

3. Remove api and module from module-level Maps
4. Update extension status to "disabled"
```

### 5.4 Error Handling During Cleanup

Every step in cleanup is wrapped in try/catch. A failing disposable does NOT prevent subsequent disposables from running. All errors are collected and logged as a group:

```typescript
cleanup(): void {
  const errors: Error[] = [];

  // Registry cleanup (steps a-g) -- try each independently
  try { gitHookBus.removeBySource(`ext:${this.extensionId}`); } catch (e) { errors.push(e as Error); }
  // ... similar for each registry

  // Custom disposables (step i) -- try each independently
  for (const disposable of this.customDisposables) {
    try { disposable(); } catch (e) { errors.push(e as Error); }
  }

  // Reset tracking
  this.registeredBlades = [];
  // ... reset all arrays

  if (errors.length > 0) {
    console.error(`[ExtensionAPI:${this.extensionId}] cleanup had ${errors.length} error(s):`, errors);
  }
}
```

### 5.5 Leak Prevention

Three categories of leaks and their prevention:

1. **Registry leaks** (contribution remains after extension deactivation). Prevented by: source-tagged `unregisterBySource()` on every registry. The source tag is set automatically during registration -- extensions cannot forget it.

2. **Subscription leaks** (Zustand `.subscribe()` callback fires after deactivation). Prevented by: `onDispose()` pattern. The GitHub extension already demonstrates this with `unsubRepoWatch` and `unsubGitHubWatch`. Phase 37 formalizes it.

3. **Timer leaks** (setInterval/setTimeout continues after deactivation). Prevented by: `onDispose(() => clearInterval(id))`. Additionally, `onDeactivate()` runs before `cleanup()`, giving the extension a chance to cancel active async operations.

---

## 6. Extensibility Enforcement

### 6.1 The Core Problem

Today, `RepositoryView.tsx` directly imports and renders `<GitflowPanel />`:

```tsx
// Current: DIRECT import -- defeats extension system
import { GitflowPanel } from "./gitflow";
// ...
<details>
  <GitflowPanel />
</details>
```

After extraction, the extension system must be the ONLY path for contributing UI. If a developer can still add a direct import, they will -- the path of least resistance.

### 6.2 Dependency Inversion Strategy

**Principle:** Core UI components depend on registry interfaces, never on extension implementations. Extensions depend on registry interfaces to register. Neither depends on the other.

```
                    +-----------------------+
                    |  Registry Interfaces  |
                    |  (src/lib/*.ts)       |
                    +-----------+-----------+
                                |
              +-----------------+-----------------+
              |                                   |
   +----------v-----------+          +------------v-----------+
   |  Core UI Components  |          |  Extension Modules     |
   |  (RepositoryView,    |          |  (gitflow/index.ts,    |
   |   StatusBar, etc.)   |          |   github/index.ts)     |
   +-----------------------+          +------------------------+
```

**Enforcement mechanisms:**

1. **No direct extension imports in core UI.** After Phase 37 and subsequent extraction phases, `src/components/` should have ZERO imports from `src/extensions/`. This can be verified with a lint rule or `madge` check.

2. **RepositoryView renders from registry.** Instead of hardcoded `<details>` sections, `RepositoryView.tsx` reads the sidebar panel registry and renders each panel dynamically. The conversion happens in two steps:
   - Phase 37: Build `SidebarPanelRegistry` and a `<SidebarSection>` component. Register core sidebar sections (Branches, Stashes, Tags, Worktrees) as `source: "core"` entries.
   - Phase 40: Move Gitflow to an extension that registers via `api.contributeSidebarPanel()`. Remove the last direct import.

3. **StatusBar renders from registry.** The new `<StatusBar />` component reads `useStatusBarRegistry` and renders items. No extension-specific code in the component.

4. **Context menus rendered from registry.** List components (BranchList, FileTreeItem, CommitItem, etc.) call `getItemsForLocation(location, context)` on the context menu registry and render a generic `<ContextMenu>` component.

### 6.3 Import Boundary Validation

To enforce the boundary at CI time:

```
Rule: src/components/**/*.tsx may NOT import from src/extensions/**/
Rule: src/blades/**/*.tsx may NOT import from src/extensions/**/
Rule: src/extensions/**/*.ts may import from src/lib/**/*.ts (registries)
Rule: src/extensions/**/*.ts may import from src/bindings.ts (Rust types)
Rule: src/extensions/**/*.ts may import from src/stores/**/*.ts (built-in only, trusted)
```

For Phase 37, this is documented as a convention. In a future phase, it can be enforced with ESLint `no-restricted-imports` or `eslint-plugin-import/no-restricted-paths`.

### 6.4 Core Sidebar Sections as Registry Entries

To make the sidebar fully registry-driven, core sections register themselves:

```typescript
// In a setup module called at app startup
useSidebarPanelRegistry.getState().register({
  id: "core:branches",
  title: "Branches",
  icon: GitBranch,
  component: BranchesSection,  // Extracted from RepositoryView
  priority: 100,
  defaultOpen: true,
  source: "core",
});
useSidebarPanelRegistry.getState().register({
  id: "core:stashes",
  title: "Stashes",
  icon: Archive,
  component: StashSection,
  priority: 80,
  source: "core",
});
// ... etc
```

`RepositoryView.tsx` then becomes:

```tsx
function RepositoryView() {
  const panels = useSidebarPanelRegistry(s => s.getOrderedPanels());
  return (
    <div className="flex flex-col overflow-y-auto">
      {panels.map(panel => (
        <SidebarSection key={panel.id} panel={panel} />
      ))}
    </div>
  );
}
```

This is the end state. Phase 37 builds the registry and registers core sections. Phase 40 adds the Gitflow extension's panel.

---

## 7. Forward Compatibility for Phases 38-41

### 7.1 What Each Future Phase Needs from Phase 37

| Phase | Feature | What It Consumes from Phase 37 |
|-------|---------|-------------------------------|
| **38** | Content Viewers | `api.registerBlade()` (existing), `api.contributeContextMenu()` for "Open with..." entries, extensible `fileDispatch` |
| **39** | Conventional Commits | `api.onWillGit("commit", handler)` for message validation, `api.contributeContextMenu()` for scope inference, `api.registerCommand()` (existing) |
| **40** | Gitflow | `api.contributeSidebarPanel()` for GitflowPanel, `api.contributeStatusBar()` for active flow widget, `api.contributeContextMenu()` for branch actions, `api.onDidGit()` for refresh after operations, `gitHookBus` for decoupling from core stores |
| **41** | Sandbox Prep | `trusted` flag on manifest, API method classification, serialization audit of registration configs |

### 7.2 What to Build Generic Now

**Build generic:**
- All four registries (ContextMenu, SidebarPanel, StatusBar, GitHook). These are general-purpose contribution points that any extension can use.
- The `onDispose()` pattern. Every extension needs cleanup.
- The `ExtensionAPI` expansion (all six methods). The API surface is stable and specific enough.
- `<SidebarSection>` component that wraps `<details>` + sticky header. This is reusable by both core and extension panels.
- `<StatusBar>` component that renders from registry. No extension-specific logic.
- `fileDispatch` refactoring to be mutable + overlayable. Phase 38 needs this.

**Build specific (only what is proven needed):**
- `onWillCommit` is the ONLY interceptor hook for now. Do not build `onWillPush`, `onWillCheckout`, etc. until a phase proves they are needed.
- Context menu locations: start with `branch-list`, `file-tree`, `commit-list`, `stash-list`, `tag-list`, `blade-tab`. Do not invent locations without a consuming extension.

**Defer entirely:**
- Extension-to-extension API. No current extension needs it.
- Activation events / lazy activation. All built-in extensions activate on startup.
- Settings contribution API. Each extension can register a settings blade section. Formal settings contribution points can wait.
- Worker sandbox bridge. Phase 41 designs it; Phase 37 does not implement it.

### 7.3 FileDispatch Refactoring

`fileDispatch.ts` currently uses a `ReadonlyMap`. Phase 38 (Content Viewers) needs extensions to register file dispatch entries. The refactoring:

```typescript
// Core dispatch entries (immutable, always present)
const CORE_DISPATCH = new Map<string, string>([
  ["png", "viewer-image"],
  // ... etc (remains as fallback)
]);

// Extension overlay (mutable, added/removed by extensions)
const extensionDispatch = new Map<string, string>();

export function registerFileDispatch(extensions: string[], bladeType: string, source: string): void {
  for (const ext of extensions) {
    extensionDispatch.set(ext, bladeType);
  }
}

export function unregisterFileDispatchBySource(source: string): void {
  // Need source tracking -- add a parallel map or tag entries
}

export function bladeTypeForFile(filePath: string, context: "diff" | "browse" = "diff"): string {
  const ext = getExtension(filePath);
  // Extension overlay takes precedence
  const extMapped = extensionDispatch.get(ext);
  if (extMapped) return extMapped;
  // Then core dispatch
  const coreMapped = CORE_DISPATCH.get(ext);
  if (coreMapped) return coreMapped;
  // Fallback
  return context === "browse" ? "viewer-code" : "diff";
}
```

This should be built in Phase 37 but is only consumed starting in Phase 38. Building it now avoids disrupting Phase 38's scope.

### 7.4 Phase 41 Trust Flag Preparation

Add to `ExtensionManifest` (Rust-side, affects `extensionManifest.ts` re-export):

```typescript
interface ExtensionManifest {
  // Existing fields...
  trusted?: boolean;  // Default: true for built-in, configurable for filesystem-loaded
}
```

In `ExtensionInfo`:

```typescript
interface ExtensionInfo {
  // Existing fields...
  trusted: boolean;  // Computed: builtIn => true, else from manifest or user preference
}
```

Phase 37 adds the field. Phase 41 uses it to gate API methods:

```typescript
class ExtensionAPI {
  contributeSidebarPanel(config: ExtensionSidebarPanelConfig): void {
    if (!this.trusted) throw new Error("contributeSidebarPanel requires trusted extension");
    // ... React components are not serializable, so sandboxed extensions cannot use this
  }
}
```

---

## 8. Anti-Patterns to Avoid

### 8.1 Over-Abstracted Registry Base Class

**Anti-pattern:** Creating a generic `Registry<T>` base class that all registries extend.

```typescript
// DON'T DO THIS
class Registry<T extends { id: string; source?: string }> {
  protected items = new Map<string, T>();
  register(item: T): void { ... }
  unregisterBySource(source: string): void { ... }
}
class ContextMenuRegistry extends Registry<ContextMenuItem> { ... }
class SidebarPanelRegistry extends Registry<SidebarPanelConfig> { ... }
```

**Why it is harmful:** Each registry has domain-specific accessor methods (`getItemsForLocation`, `getOrderedPanels`, `getLeftItems/getRightItems`), domain-specific validation, and domain-specific ordering logic. A base class forces these into overrides or template method patterns that obscure the actual logic. The registries share a SHAPE, not behavior.

**Instead:** Copy the `toolbarRegistry.ts` pattern for each new registry. Duplication of 20 lines of Map manipulation is cheaper than a premature abstraction that constrains future changes.

### 8.2 Global Event Bus for Everything

**Anti-pattern:** Using the GitHookBus for non-git events (UI events, navigation events, store changes).

**Why it is harmful:** A general-purpose event bus becomes an untraceable implicit dependency graph. Any module can emit anything; any module can listen to anything. Debugging requires searching the entire codebase for event names.

**Instead:** The GitHookBus handles ONLY git operation events. UI state changes go through Zustand stores (reactive, typed, debuggable). Navigation goes through XState (FSM, predictable). Each communication channel has a clear scope.

### 8.3 Eager Registration in Module Scope

**Anti-pattern:** Registering extension contributions at module import time rather than inside `onActivate()`.

```typescript
// DON'T DO THIS
// gitflow/index.ts
import { useSidebarPanelRegistry } from "../../lib/sidebarPanelRegistry";
useSidebarPanelRegistry.getState().register({ ... }); // Runs on import!

export async function onActivate(api: ExtensionAPI) { ... }
```

**Why it is harmful:** Module-level side effects execute when the module is first imported, which may be before the extension is supposed to be active. The ExtensionHost cannot track or clean up these registrations. If the user has disabled the extension, the registration still happens.

**Instead:** ALL registrations happen inside `onActivate(api)` through the `api.contributeX()` methods. This ensures: (a) namespacing is applied, (b) tracking is recorded, (c) cleanup works, (d) disabled extensions contribute nothing.

### 8.4 Context Menu `when()` Calling Async Functions

**Anti-pattern:** Making `when()` conditions async or side-effectful.

```typescript
// DON'T DO THIS
api.contributeContextMenu({
  when: async (ctx) => {
    const branches = await commands.listBranches(); // Tauri IPC!
    return branches.some(b => b.name === ctx.branchName);
  },
  ...
});
```

**Why it is harmful:** `when()` is called synchronously during menu rendering. An async `when()` would require the menu to show a loading state, flash items in/out, or block the UI thread. Context menus must appear instantly.

**Instead:** `when()` must be synchronous and cheap. It should read in-memory state (Zustand stores, cached values) only. If an extension needs async data to decide menu visibility, it should pre-compute and cache the result, then check the cache in `when()`.

### 8.5 Direct Store Imports in Extension GitHookBus Handlers

**Anti-pattern:** Extension hook handlers importing and calling methods on core stores.

```typescript
// DON'T DO THIS (in gitflow extension)
import { useGitOpsStore } from "../../stores/domain/git-ops";
api.onDidGit("merge", () => {
  useGitOpsStore.getState().loadBranches(); // Circular import risk!
});
```

**Why it is harmful:** This recreates the exact cross-slice coupling that GitHookBus was designed to eliminate. The extension depends on core store internals. Changes to store API break the extension.

**Instead:** The extension emits events via `gitHookBus.emitDid()`. Core stores subscribe to refresh themselves. The extension never calls store methods -- it only fires events.

---

## 9. Specific Recommendations for FlowForge Phase 37

### 9.1 Implementation Order

Execute in strict dependency order within Phase 37:

```
Step 1: GitHookBus (src/lib/gitHookBus.ts)
  - Zero dependencies on other new code
  - Needed by Step 5 (ExtensionAPI) and Step 7 (wiring)
  - Test: unit test with mock handlers

Step 2: ContextMenuRegistry (src/lib/contextMenuRegistry.ts)
  - Zustand store following toolbarRegistry pattern
  - Types: ContextMenuLocation, ContextMenuContext, ContextMenuItem
  - Test: register/unregister/getItemsForLocation

Step 3: SidebarPanelRegistry (src/lib/sidebarPanelRegistry.ts)
  - Zustand store following toolbarRegistry pattern
  - Types: SidebarPanelConfig
  - Accessor: getOrderedPanels() sorted by priority
  - Test: register/unregister/ordering

Step 4: StatusBarRegistry (src/lib/statusBarRegistry.ts)
  - Zustand store following toolbarRegistry pattern
  - Types: StatusBarItem, StatusBarAlignment
  - Accessor: getLeftItems(), getRightItems()
  - Test: register/unregister/alignment

Step 5: ExtensionAPI expansion (src/extensions/ExtensionAPI.ts)
  - Add 6 new methods + onDispose()
  - Expand cleanup() to cover all registries
  - Track all new registration types
  - Test: verify cleanup removes from all registries

Step 6: Core UI components
  - <SidebarSection> component (extracted from RepositoryView details pattern)
  - <StatusBar> component (reads StatusBarRegistry)
  - <ContextMenuWrapper> component (Radix integration, reads ContextMenuRegistry)
  - Dynamic sidebar in RepositoryView (register core sections, render from registry)

Step 7: GitHookBus wiring (src/lib/gitHookBusWiring.ts)
  - Core store subscriptions to bus events
  - Called at app startup after stores initialize

Step 8: FileDispatch refactoring (src/lib/fileDispatch.ts)
  - Make extensible (extension overlay map)
  - Add source tracking for cleanup
  - Preserve existing behavior for all current file types
```

### 9.2 Files to Create

| File | Purpose | Pattern Source |
|------|---------|---------------|
| `src/lib/gitHookBus.ts` | Git operation event bus | New (singleton class) |
| `src/lib/gitHookBusWiring.ts` | Core store subscriptions to bus | New (setup module) |
| `src/lib/contextMenuRegistry.ts` | Context menu item registry | `toolbarRegistry.ts` |
| `src/lib/sidebarPanelRegistry.ts` | Sidebar panel registry | `toolbarRegistry.ts` |
| `src/lib/statusBarRegistry.ts` | Status bar item registry | `toolbarRegistry.ts` |
| `src/components/layout/SidebarSection.tsx` | Reusable sidebar `<details>` wrapper | Extracted from `RepositoryView.tsx` |
| `src/components/layout/StatusBar.tsx` | Status bar UI component | New |
| `src/components/ui/ContextMenuWrapper.tsx` | Radix context menu bridge | New (Radix integration) |

### 9.3 Files to Modify

| File | Change |
|------|--------|
| `src/extensions/ExtensionAPI.ts` | Add 6 new methods, onDispose(), expand cleanup() |
| `src/extensions/extensionTypes.ts` | Add `trusted` field to ExtensionInfo |
| `src/components/RepositoryView.tsx` | Replace hardcoded sections with registry-driven rendering |
| `src/lib/fileDispatch.ts` | Refactor from ReadonlyMap to mutable overlay pattern |
| `src/App.tsx` (or equivalent entry) | Add `<StatusBar />` component to layout, call `wireGitHookBus()` |

### 9.4 Dependencies to Add

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| `@radix-ui/react-context-menu` | ^2.2.x | Accessible context menu primitives | ~32KB |

This is the ONLY new dependency. All other infrastructure uses existing packages (Zustand, React, Lucide).

### 9.5 Success Criteria Mapping

| Success Criterion | Implementation |
|-------------------|----------------|
| Right-clicking on a file, branch, or commit shows extension-contributed context menu items | ContextMenuRegistry + `<ContextMenuWrapper>` on BranchList, file tree, commit list |
| An extension can register a sidebar panel section | SidebarPanelRegistry + dynamic rendering in RepositoryView |
| An extension can contribute a status bar widget | StatusBarRegistry + `<StatusBar>` component |
| An extension receives git operation events (onDidCommit, onDidPush) | GitHookBus + `api.onDidGit()` |
| An extension's onDispose callbacks fire during deactivation | `onDispose()` method + cleanup() sequence |

### 9.6 Testing Strategy

**Unit tests (Vitest):**
- Each registry: register, unregister, unregisterBySource, ordering by priority, filtering by location/when
- GitHookBus: onDid handler fires, onWill handler cancels, re-entrancy guard, removeBySource
- ExtensionAPI: cleanup removes from all registries, onDispose callbacks fire

**Integration tests (manual or Vitest with React Testing Library):**
- Register a mock extension with all contribution types, deactivate, verify all contributions removed
- RepositoryView renders panels from registry, including extension-contributed ones
- StatusBar renders items from registry with correct alignment
- Context menu appears on right-click with extension-contributed items

**Smoke tests (manual):**
- GitHub extension continues to work identically after Phase 37 changes
- All existing sidebar sections (Branches, Stashes, Tags, Gitflow, Worktrees) render correctly after RepositoryView refactoring
- Enable/disable GitHub extension: all UI contributions appear/disappear cleanly

### 9.7 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RepositoryView refactoring breaks sidebar layout | Medium | High | Extract `<SidebarSection>` first, test visual parity before changing rendering source |
| GitHookBus re-entrancy guard is too aggressive | Low | Medium | Only suppress `emitDid` in nested calls; `emitWill` always runs (interceptors are intentional) |
| Radix context menu styling conflicts with Catppuccin | Low | Low | Radix is headless; all styling is Tailwind. No default styles to conflict. |
| Performance impact of Zustand Map replacement on register | Low | Low | Registrations happen at activation time (once), not during rendering. Map replacement cost is negligible for <100 items. |

---

## Sources

### Codebase Analysis (PRIMARY -- HIGH confidence)
- `src/extensions/ExtensionAPI.ts` -- Current API facade, namespacing, cleanup tracking
- `src/extensions/ExtensionHost.ts` -- Lifecycle management, registerBuiltIn, activate/deactivate
- `src/extensions/github/index.ts` -- Reference built-in extension with full lifecycle
- `src/lib/toolbarRegistry.ts` -- Reference Zustand registry pattern (Map, source tagging, devtools)
- `src/lib/bladeRegistry.ts` -- Module-level Map registry pattern
- `src/lib/commandRegistry.ts` -- Module-level Map registry with category ordering
- `src/lib/fileDispatch.ts` -- Static ReadonlyMap needing refactoring
- `src/lib/previewRegistry.ts` -- Array-based matcher registry with priority
- `src/components/viewers/ViewerRegistry.ts` -- Array-based viewer matcher
- `src/components/RepositoryView.tsx` -- Hardcoded sidebar (lines 50-151)
- `src/stores/domain/git-ops/gitflow.slice.ts` -- Cross-slice coupling (get().loadBranches(), get().refreshRepoStatus())
- `src/stores/domain/git-ops/index.ts` -- 9-slice GitOpsStore composition

### Architecture Research
- `.planning/research/v1.6.0-ARCHITECTURE.md` -- Comprehensive architecture patterns for extension platform
- `.planning/research/v1.6.0-PITFALLS.md` -- 16 pitfalls with prevention strategies
- `.planning/research/v1.6.0-SUMMARY.md` -- Research synthesis with phase ordering rationale
- `.planning/research/v1.6.0-FEATURES.md` -- Feature landscape with dependency chain

### External References (HIGH confidence)
- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points) -- viewsContainers, menus, commands, statusBar
- [VS Code Extension Lifecycle](https://code.visualstudio.com/api/get-started/extension-anatomy) -- activate/deactivate, ExtensionContext.subscriptions, Disposable
- [VS Code Context Menu UX](https://code.visualstudio.com/api/ux-guidelines/context-menus) -- group ordering, separator conventions
- [VS Code Status Bar API](https://code.visualstudio.com/api/ux-guidelines/status-bar) -- left/right alignment, priority ordering
- [Radix Context Menu](https://www.radix-ui.com/primitives/docs/components/context-menu) -- Headless, accessible, portal rendering
- [Zustand Slices Pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern) -- Slice extraction and decoupling patterns

---
*Research completed: 2026-02-10*
*Ready for planning: yes*
