# Phase 43: Infrastructure Prep - Architecture Research

**Researched:** 2026-02-11
**Domain:** Registry migration, reactive state, extension lifecycle, extensibility enforcement
**Confidence:** HIGH

## Summary

Phase 43 migrates the two remaining plain-Map registries (commandRegistry, previewRegistry) to Zustand stores following the exact pattern already established by BladeRegistry in v1.6. The codebase already has 5 Zustand-based registries (bladeRegistry, toolbarRegistry, contextMenuRegistry, sidebarPanelRegistry, statusBarRegistry) that serve as a proven template. The migration is structurally straightforward but requires careful attention to backward compatibility (13 consumer files import from commandRegistry), reactive integration with CommandPalette, and source-based cleanup orchestration in ExtensionAPI.

Beyond registry migration, this phase adds infrastructure hooks: a process tab visibility hook that conditionally renders based on BladeRegistry state, a WelcomeView lookup pattern that resolves InitRepoBlade from BladeRegistry instead of hardcoded imports, CC store reset on extension disable, and 3 new sandbox-safe ExtensionAPI methods.

**Primary recommendation:** Follow the BladeRegistry migration pattern exactly -- Zustand store with devtools middleware at top of file, backward-compatible function exports at bottom. Keep the same file paths and export signatures so consumers need zero changes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | (already installed) | Reactive registry stores | Already used for 5/7 registries; standard in this project |
| zustand/middleware (devtools) | (already installed) | DevTools integration | All stores use `devtools()` wrapper |
| @xstate/react (useSelector) | (already installed) | Reactive XState subscriptions | Used in ProcessNavigation already |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand/middleware (subscribeWithSelector) | (already installed) | Fine-grained external subscriptions | If CommandPalette needs to subscribe to command changes outside React lifecycle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand store for commandRegistry | Keep plain Map + manual event emitter | Adds custom pub/sub infrastructure; inconsistent with 5 other registries |
| `useSyncExternalStore` for reactivity | Zustand hook selector | Zustand already wraps useSyncExternalStore internally; no benefit to using raw API |

**Installation:** No new packages needed. All dependencies already in the project.

## Architecture Patterns

### Recommended File Structure (changes only)
```
src/
├── lib/
│   ├── commandRegistry.ts       # MODIFY: Add Zustand store, keep function exports
│   └── previewRegistry.ts       # MODIFY: Add Zustand store, keep function exports
├── extensions/
│   ├── ExtensionAPI.ts          # MODIFY: Update cleanup() for source-based unregister
│   └── sandbox/
│       ├── sandbox-api-surface.ts   # MODIFY: Add 3 new sandbox-safe methods
│       └── SandboxedExtensionAPI.ts # MODIFY: Add onDidNavigate, events, settings proxy
├── blades/
│   └── _shared/
│       └── ProcessNavigation.tsx # MODIFY: Conditionally render topology tab
├── components/
│   ├── WelcomeView.tsx          # MODIFY: BladeRegistry lookup for InitRepoBlade
│   └── command-palette/
│       └── CommandPalette.tsx    # MODIFY: Subscribe to store reactively
└── stores/
    └── conventional.ts          # No change needed (reset is called via CC extension deactivate)
```

### Pattern 1: Registry Migration (commandRegistry -> Zustand store)

**What:** Convert plain `Map<string, Command>` to a Zustand store with the same interface shape as BladeRegistry.
**When to use:** For commandRegistry and previewRegistry migration.
**Confidence:** HIGH -- this is an exact copy of the BladeRegistry pattern already shipped in v1.6.

**Template (derived from actual BladeRegistry at `src/lib/bladeRegistry.ts`):**

```typescript
// src/lib/commandRegistry.ts -- AFTER migration

import type { LucideIcon } from "lucide-react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

// --- Types (unchanged) ---
export type CoreCommandCategory = /* ... same ... */;
export type CommandCategory = CoreCommandCategory | (string & {});
export interface Command { /* ... same, with source? field ... */ }

// --- Store ---
export interface CommandRegistryState {
  commands: Map<string, Command>;
  register: (cmd: Command) => void;
  unregister: (id: string) => boolean;
  unregisterBySource: (source: string) => void;
  getAll: () => Command[];
  getEnabled: () => Command[];
  getById: (id: string) => Command | undefined;
  execute: (id: string) => void;
  getOrderedCategories: () => CommandCategory[];
}

export const useCommandRegistry = create<CommandRegistryState>()(
  devtools(
    (set, get) => ({
      commands: new Map<string, Command>(),

      register: (cmd) => {
        const next = new Map(get().commands);
        next.set(cmd.id, cmd);
        set({ commands: next }, false, "command-registry/register");
      },

      unregister: (id) => {
        const prev = get().commands;
        if (!prev.has(id)) return false;
        const next = new Map(prev);
        next.delete(id);
        set({ commands: next }, false, "command-registry/unregister");
        return true;
      },

      unregisterBySource: (source) => {
        const next = new Map(get().commands);
        for (const [id, cmd] of next) {
          if (cmd.source === source) {
            next.delete(id);
          }
        }
        set({ commands: next }, false, "command-registry/unregisterBySource");
      },

      getAll: () => Array.from(get().commands.values()),
      getEnabled: () => Array.from(get().commands.values())
        .filter((cmd) => (cmd.enabled ? cmd.enabled() : true)),
      getById: (id) => get().commands.get(id),
      execute: (id) => {
        const cmd = get().commands.get(id);
        if (!cmd) return;
        if (cmd.enabled && !cmd.enabled()) return;
        cmd.action();
      },
      getOrderedCategories: () => { /* same logic as current getOrderedCategories() */ },
    }),
    { name: "command-registry", enabled: import.meta.env.DEV },
  ),
);

// --- Backward-compatible function exports ---
// All 13 consumer files continue importing these same functions unchanged.

export function registerCommand(cmd: Command): void {
  useCommandRegistry.getState().register(cmd);
}

export function unregisterCommand(id: string): boolean {
  return useCommandRegistry.getState().unregister(id);
}

export function unregisterCommandsBySource(source: string): void {
  useCommandRegistry.getState().unregisterBySource(source);
}

export function getCommands(): Command[] {
  return useCommandRegistry.getState().getAll();
}

export function getEnabledCommands(): Command[] {
  return useCommandRegistry.getState().getEnabled();
}

export function getCommandById(id: string): Command | undefined {
  return useCommandRegistry.getState().getById(id);
}

export function executeCommand(id: string): void {
  useCommandRegistry.getState().execute(id);
}

export function getOrderedCategories(): CommandCategory[] {
  return useCommandRegistry.getState().getOrderedCategories();
}
```

**Key architectural decisions:**
1. The Zustand store hook is named `useCommandRegistry` (not `useCommandRegistryStore`) to match the existing convention (`useBladeRegistry`, `useToolbarRegistry`, etc.).
2. Backward-compatible function exports delegate to `getState()` -- identical pattern to BladeRegistry lines 96-136.
3. The `commands` field uses `Map<string, Command>` and each mutation creates `new Map(get().commands)` to trigger Zustand re-renders.
4. `source?: string` field already exists on the Command interface (line 28 of current commandRegistry.ts).

### Pattern 2: PreviewRegistry Migration

**What:** Convert plain array `PreviewRegistration[]` to Zustand store with source tracking and cleanup.
**Confidence:** HIGH -- follows same template, but array-based instead of Map-based.

**Critical difference from commandRegistry:** PreviewRegistry currently uses an array sorted by priority, not a Map keyed by ID. The migration should:
1. Add a `source?: string` field to `PreviewRegistration` (doesn't exist yet).
2. Store as `Map<string, PreviewRegistration>` keyed by `key` (already exists on each registration).
3. Computed getter returns sorted array (same as `getGrouped` in toolbarRegistry).

```typescript
// src/lib/previewRegistry.ts -- AFTER migration

export interface PreviewRegistration {
  key: string;
  matches: (filePath: string) => boolean;
  mode: PreviewMode;
  placeholder?: { icon: ComponentType<{ className?: string }>; message: string };
  component?: ComponentType<{ file: FileChange; source: DiffSource }>;
  priority?: number;
  source?: string;  // NEW: "core" or "ext:{extensionId}"
}

export interface PreviewRegistryState {
  previews: Map<string, PreviewRegistration>;
  register: (config: PreviewRegistration) => void;
  unregister: (key: string) => boolean;
  unregisterBySource: (source: string) => void;
  getForFile: (filePath: string) => PreviewRegistration | undefined;
}

export const usePreviewRegistry = create<PreviewRegistryState>()(
  devtools(
    (set, get) => ({
      previews: new Map<string, PreviewRegistration>(),

      register: (config) => {
        const next = new Map(get().previews);
        next.set(config.key, config);
        set({ previews: next }, false, "preview-registry/register");
      },

      unregister: (key) => { /* ... */ },
      unregisterBySource: (source) => { /* ... */ },

      getForFile: (filePath) => {
        // Sort by priority descending, then find first match
        const sorted = Array.from(get().previews.values())
          .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        return sorted.find((r) => r.matches(filePath));
      },
    }),
    { name: "preview-registry", enabled: import.meta.env.DEV },
  ),
);

// Backward-compatible exports
export function registerPreview(config: PreviewRegistration): void {
  usePreviewRegistry.getState().register(config);
}

export function getPreviewForFile(filePath: string): PreviewRegistration | undefined {
  return usePreviewRegistry.getState().getForFile(filePath);
}
```

### Pattern 3: CommandPalette Reactive Updates (INFRA-03)

**What:** Make CommandPalette reactively update when extensions register/unregister commands.
**Confidence:** HIGH -- straightforward Zustand hook subscription.

**Current problem:** CommandPalette calls `getEnabledCommands()` (a plain function) inside `useMemo(() => getEnabledCommands(), [isOpen])`. This only re-evaluates when the palette opens/closes, not when commands are registered/unregistered.

**Fix:** Subscribe to the Zustand store's `commands` Map directly:

```typescript
// CommandPalette.tsx -- AFTER
import { useCommandRegistry } from "../../lib/commandRegistry";

export function CommandPalette() {
  // Subscribe reactively to the commands Map
  const commandsMap = useCommandRegistry((s) => s.commands);

  const enabledCommands = useMemo(
    () => Array.from(commandsMap.values())
      .filter((cmd) => (cmd.enabled ? cmd.enabled() : true)),
    [commandsMap],
  );

  // Rest unchanged...
}
```

**Why this works:** When `useCommandRegistry.getState().register(cmd)` runs (triggered by extension activation), it sets a new Map reference. Zustand detects the reference change and re-renders any component subscribed to `(s) => s.commands`. The CommandPalette instantly sees the new command list.

**Alternative considered:** Using `subscribe()` outside React -- rejected because the component already has a natural Zustand selector path, and using external subscriptions adds complexity.

### Pattern 4: Process Tab Visibility Hook (INFRA-04)

**What:** Conditionally show/hide the Topology tab in ProcessNavigation based on BladeRegistry state.
**Confidence:** HIGH -- BladeRegistry is already a Zustand store; this is a simple selector.

**Current problem:** ProcessNavigation hardcodes `PROCESSES` as a static array:
```typescript
const PROCESSES = [
  { id: "staging", label: "Staging", icon: Files },
  { id: "topology", label: "Topology", icon: Network },
] as const;
```

**Architecture decision:** Create a generic hook `useAvailableProcesses()` or `useProcessTabs()` that filters PROCESSES based on BladeRegistry availability.

```typescript
// Option A: Hook-based (RECOMMENDED)
// src/blades/_shared/useAvailableProcesses.ts

import { useBladeRegistry } from "../../lib/bladeRegistry";
import type { ProcessType } from "../../machines/navigation/types";

interface ProcessTab {
  id: ProcessType;
  label: string;
  icon: LucideIcon;
  /** The root blade type this process requires to be available */
  rootBladeType: string;
}

const ALL_PROCESSES: ProcessTab[] = [
  { id: "staging", label: "Staging", icon: Files, rootBladeType: "staging-changes" },
  { id: "topology", label: "Topology", icon: Network, rootBladeType: "topology-graph" },
];

export function useAvailableProcesses(): ProcessTab[] {
  const blades = useBladeRegistry((s) => s.blades);
  return ALL_PROCESSES.filter((p) => blades.has(p.rootBladeType));
}
```

**Why hook-based:** This is generic enough that when Topology is extracted to an extension (Phase 46), the tab simply disappears when the topology-graph blade type is unregistered. No special-case code needed.

**Edge case:** If the user is viewing the topology process and the extension is disabled, the active process becomes invalid. The ProcessNavigation component should auto-switch to staging:

```typescript
// In ProcessNavigation.tsx
const availableProcesses = useAvailableProcesses();
const activeProcess = useSelector(actorRef, selectActiveProcess);

// Auto-fallback: if current process has no tab, switch to staging
useEffect(() => {
  if (!availableProcesses.some(p => p.id === activeProcess)) {
    actorRef.send({ type: "SWITCH_PROCESS", process: "staging" });
  }
}, [availableProcesses, activeProcess, actorRef]);
```

### Pattern 5: WelcomeView BladeRegistry Lookup (INFRA-05)

**What:** Replace hardcoded `import { InitRepoBlade }` with runtime BladeRegistry lookup.
**Confidence:** HIGH -- BladeRegistry.getRegistration() already returns component references.

**Current problem (WelcomeView.tsx line 11):**
```typescript
import { InitRepoBlade } from "../blades/init-repo";
```
This creates a hard compile-time dependency on the InitRepoBlade module, meaning it cannot be conditionally available based on extension state.

**Solution architecture:**

```typescript
// WelcomeView.tsx -- AFTER
import { useBladeRegistry } from "../lib/bladeRegistry";

function WelcomeView() {
  const blades = useBladeRegistry((s) => s.blades);

  // ...

  if (showInitRepo && pendingInitPath) {
    const initRepoReg = blades.get("init-repo");

    if (initRepoReg) {
      const InitRepoComponent = initRepoReg.component;
      return (
        <div className="h-[calc(100vh-3.5rem)] bg-ctp-base">
          <Suspense fallback={<LoadingSpinner />}>
            <InitRepoComponent
              directoryPath={pendingInitPath}
              onCancel={() => setShowInitRepo(false)}
              onComplete={async (path: string) => {
                await openRepository(path);
                await addRecentRepo(path);
                setShowInitRepo(false);
                setPendingInitPath(null);
              }}
            />
          </Suspense>
        </div>
      );
    }

    // Fallback: extension not available
    return <SimpleInitFallback path={pendingInitPath} />;
  }

  // ... rest unchanged
}
```

**Key insight:** The component reference lives inside `BladeRegistration.component`. Since InitRepoBlade uses `lazy()` loading when registered as an extension, the WelcomeView needs `<Suspense>` wrapping (it already has this pattern for other lazy components in the codebase).

**Fallback behavior:** When the init-repo extension is disabled, show a simple message with a "Run git init" button that calls the Tauri backend directly, or show nothing. Phase 45 will define the exact fallback behavior.

### Pattern 6: CC Store Reset on Extension Disable (INFRA-06)

**What:** Reset the conventional commits Zustand store when the CC extension is deactivated.
**Confidence:** HIGH -- the store already has a `reset()` method; just need to wire it into deactivation.

**Current state:** The CC extension's `onDeactivate()` at `src/extensions/conventional-commits/index.ts:76` is:
```typescript
export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all blade unregistrations
}
```

**Solution:** Call the store's reset in the deactivate callback:

```typescript
import { useConventionalStore } from "../../stores/conventional";

export function onDeactivate(): void {
  // Reset CC store state to prevent ghost data on re-enable
  useConventionalStore.getState().reset();
}
```

**Why this is safe:** `useConventionalStore` is created via `createBladeStore()` which uses `registerStoreForReset()`. However, `resetAllStores()` is a bulk operation tied to repo switches, not extension toggles. The extension-specific reset ensures clean state on a per-extension disable/enable cycle.

**Alternative considered:** Making ExtensionAPI.cleanup() automatically reset any stores registered by the extension. Rejected because it requires a store registration mechanism in ExtensionAPI, which is over-engineered for this single use case. The explicit `onDeactivate` callback is the right place.

### Pattern 7: Sandbox API Surface Expansion (INFRA-07)

**What:** Add `onDidNavigate`, `events`, and `settings` to sandbox-api-surface.ts.
**Confidence:** HIGH -- these methods already exist on ExtensionAPI and are already used.

**Current sandbox-api-surface.ts:**
```typescript
export const SANDBOX_SAFE_METHODS = [
  "onDidGit",
  "onWillGit",
  "onDispose",
] as const;

export const REQUIRES_TRUST_METHODS = [
  "registerBlade",
  "registerCommand",
  "contributeToolbar",
  "contributeContextMenu",
  "contributeSidebarPanel",
  "contributeStatusBar",
] as const;
```

**What to add:**

| Method | Classification | Rationale |
|--------|---------------|-----------|
| `onDidNavigate` | sandbox-safe | Handler receives serializable `BladeNavigationEvent` (type, props, stackDepth). No DOM/React access needed. |
| `events` (emit + on) | sandbox-safe | Payload is `unknown` but must be serializable for Worker boundary. Handler receives serializable data. |
| `settings` (get/set/remove/getAll/clear) | sandbox-safe | All methods return `Promise<T>` with serializable values. Settings stored in tauri-plugin-store. |

```typescript
// sandbox-api-surface.ts -- AFTER
export const SANDBOX_SAFE_METHODS = [
  "onDidGit",
  "onWillGit",
  "onDispose",
  "onDidNavigate",
  "events",
  "settings",
] as const;
```

**SandboxedExtensionAPI changes:** Add proxy methods for `onDidNavigate`, `events`, and `settings` that delegate to the host API:

```typescript
// SandboxedExtensionAPI.ts -- additions
onDidNavigate(handler: (event: BladeNavigationEvent) => void): () => void {
  return this.hostApi.onDidNavigate(handler);
}

get events() {
  return this.hostApi.events;
}

get settings() {
  return this.hostApi.settings;
}
```

### Anti-Patterns to Avoid

- **Wrapping Map in Array for state:** Don't use `commands: Command[]` as the store state shape. Use `Map<string, Command>` for O(1) lookup by ID, consistent with all other registries.
- **Shallow equality on Map:** Don't rely on `shallow` comparison for Map values in Zustand selectors. Always create `new Map()` on mutation to ensure reference inequality triggers re-renders.
- **Direct store mutation:** Never do `get().commands.set(id, cmd)`. Always create a new Map: `const next = new Map(get().commands); next.set(id, cmd); set({ commands: next })`.
- **Hardcoded component imports in WelcomeView:** The entire point of INFRA-05 is to remove the direct `import { InitRepoBlade }` and use BladeRegistry lookup instead. Don't add new hardcoded imports.
- **Circular dependency between stores:** If commandRegistry imports from ExtensionAPI or vice versa at the module level, circular imports will break. The current architecture avoids this by having ExtensionAPI import from commandRegistry (one-way). Keep it that way.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive state management | Custom event emitter on top of plain Map | Zustand store | Already standard; 5 registries already use it |
| Source tracking for cleanup | Custom WeakMap or parallel tracking structure | `source` field on each registration + `unregisterBySource()` | Already proven in bladeRegistry, toolbarRegistry, etc. |
| Conditional UI visibility | Manual `useState` + `useEffect` with registry subscriptions | Zustand selector on BladeRegistry | One-liner: `useBladeRegistry((s) => s.blades.has("topology-graph"))` |
| Store reset on extension disable | Custom extension-store binding system | Explicit `store.getState().reset()` in `onDeactivate` | Simple, debuggable, no magic |

**Key insight:** Every pattern needed for Phase 43 already has a working implementation somewhere in the codebase. The job is to replicate established patterns, not invent new ones.

## Common Pitfalls

### Pitfall 1: Circular Imports After Migration
**What goes wrong:** Moving commandRegistry to a Zustand store could introduce circular imports if the store module imports from modules that themselves import from commandRegistry.
**Why it happens:** Zustand stores often import from other modules for initialization; if those modules also import from the store being created, a cycle forms.
**How to avoid:**
1. Run `npx madge --circular src/lib/commandRegistry.ts` before and after migration.
2. The current import graph is clean: `commandRegistry.ts` only imports `LucideIcon` type. Keep it that way.
3. ExtensionAPI.ts imports FROM commandRegistry (not the other way). This is the correct direction.
**Warning signs:** Runtime errors about undefined exports, or store being `undefined` at import time.

### Pitfall 2: CommandPalette Stale Closure
**What goes wrong:** After migrating to reactive Zustand subscription, the CommandPalette's `useMemo` dependency on `isOpen` becomes insufficient. The memo recalculates on every command map change, but the `enabledCommands` computation involves calling `cmd.enabled()` which may close over stale state.
**Why it happens:** The `enabled()` callback is a closure from registration time, not from render time. If the callback checks Zustand store state (e.g., `useRepositoryStore.getState().repoStatus`), it reads fresh state each time -- this is fine. But if it closes over local variables, those could be stale.
**How to avoid:** The convention in this codebase is that `enabled()` callbacks always use `.getState()` to read fresh state (see CC extension's `enabled: () => !!useRepositoryStore.getState().repoStatus`). This is correct and should be documented as a requirement.
**Warning signs:** Commands appearing enabled/disabled incorrectly after state changes.

### Pitfall 3: PreviewRegistry Sorting After Reactive Migration
**What goes wrong:** When previewRegistry becomes a Map-based Zustand store, the priority-based sort order must be computed at read time, not maintained at insertion time.
**Why it happens:** Current implementation sorts on `registerPreview()`. The Zustand store pattern stores a flat Map; sorting happens in the `getForFile()` computed getter.
**How to avoid:** Ensure `getForFile()` sorts by priority before matching. Add a unit test that registers previews in random priority order and verifies the highest-priority match wins.
**Warning signs:** Binary file previews showing inline diff instead of placeholder.

### Pitfall 4: ProcessNavigation Infinite Loop on Auto-Fallback
**What goes wrong:** If the topology blade is unregistered while the user views the topology process, the auto-fallback `useEffect` sends `SWITCH_PROCESS` which triggers a re-render, which re-evaluates `availableProcesses`, which still doesn't include topology, which re-sends `SWITCH_PROCESS`...
**Why it happens:** The `SWITCH_PROCESS` event changes `activeProcess` in XState context, but if the effect dependency array includes `availableProcesses` (a new array each render), it fires infinitely.
**How to avoid:**
1. Memoize `availableProcesses` with a stable reference (use `useMemo` or Zustand selector with shallow compare).
2. Guard the effect: only send `SWITCH_PROCESS` if `activeProcess !== "staging"`.
3. Use `useRef` to track whether a fallback has already been triggered.
**Warning signs:** Maximum update depth exceeded error; rapid re-renders in React DevTools.

### Pitfall 5: WelcomeView Suspense Boundary Missing
**What goes wrong:** When InitRepoBlade is loaded from BladeRegistry (which uses `lazy()` loading via the extension), rendering it without a `<Suspense>` boundary crashes with "A component suspended while responding to synchronous input."
**Why it happens:** `React.lazy()` components must be wrapped in `<Suspense>`.
**How to avoid:** Always wrap BladeRegistry-resolved components in `<Suspense fallback={...}>` when rendering outside the main BladeRenderer (which already has Suspense).
**Warning signs:** Unhandled Promise in console; white screen on WelcomeView "Init" action.

### Pitfall 6: Ghost State in CC Store
**What goes wrong:** User fills out a conventional commit form, disables the CC extension, re-enables it, and sees the old form data pre-filled.
**Why it happens:** The CC store is a Zustand store created via `createBladeStore()` which persists across extension toggle cycles. The store's initial state is only set at module load time.
**How to avoid:** Call `useConventionalStore.getState().reset()` in the CC extension's `onDeactivate()`.
**Warning signs:** Form fields pre-populated after extension re-enable; validation state carrying over.

## Code Examples

### Example 1: BladeRegistry Pattern (existing, verified)
Source: `src/lib/bladeRegistry.ts` (lines 36-94)
```typescript
// This is the EXACT pattern to follow for commandRegistry and previewRegistry.
// Store + backward-compatible exports at bottom.
export const useBladeRegistry = create<BladeRegistryState>()(
  devtools(
    (set, get) => ({
      blades: new Map<string, BladeRegistration<any>>(),
      register: (config) => {
        const next = new Map(get().blades);
        next.set(config.type, config);
        set({ blades: next }, false, "blade-registry/register");
      },
      // ... etc
    }),
    { name: "blade-registry", enabled: import.meta.env.DEV },
  ),
);

// Backward-compatible function exports
export function registerBlade<TProps>(config: BladeRegistration<TProps>): void {
  useBladeRegistry.getState().register(config);
}
```

### Example 2: Source-Based Cleanup (existing, verified)
Source: `src/extensions/ExtensionAPI.ts` (lines 369-393)
```typescript
// ExtensionAPI.cleanup() already does per-item unregistration for commands.
// For the Zustand migration, switch to source-based bulk cleanup:
cleanup(): void {
  // CURRENT (per-item):
  for (const id of this.registeredCommands) {
    unregisterCommand(id);
  }

  // AFTER MIGRATION (source-based, same as other registries):
  useCommandRegistry.getState().unregisterBySource(`ext:${this.extensionId}`);
  usePreviewRegistry.getState().unregisterBySource(`ext:${this.extensionId}`);

  // Other registries already use source-based cleanup:
  useToolbarRegistry.getState().unregisterBySource(`ext:${this.extensionId}`);
  useContextMenuRegistry.getState().unregisterBySource(`ext:${this.extensionId}`);
  // ...
}
```

### Example 3: Reactive Zustand Selector in Component (existing pattern)
Source: Zustand docs, confirmed by existing codebase patterns
```typescript
// Component subscribes to specific store slice
function MyComponent() {
  const items = useToolbarRegistry((s) => s.actions);  // Re-renders when actions change
  // ...
}

// Equivalent pattern for CommandPalette:
function CommandPalette() {
  const commands = useCommandRegistry((s) => s.commands); // Re-renders on register/unregister
  // ...
}
```

### Example 4: Process Tab Visibility via BladeRegistry
```typescript
// Reactive check: does a blade type exist in the registry?
function ProcessNavigation() {
  const blades = useBladeRegistry((s) => s.blades);
  const availableProcesses = useMemo(
    () => ALL_PROCESSES.filter((p) => blades.has(p.rootBladeType)),
    [blades],
  );
  // Render only available tabs
}
```

## Ownership Tracking Architecture

### Current State of Source Tracking

| Registry | Has `source` field | Has `unregisterBySource` | Store Type |
|----------|--------------------|--------------------------|------------|
| bladeRegistry | YES | YES | Zustand |
| commandRegistry | YES | YES (function) | Plain Map |
| previewRegistry | NO | NO | Plain Array |
| toolbarRegistry | YES | YES | Zustand |
| contextMenuRegistry | YES | YES | Zustand |
| sidebarPanelRegistry | YES | YES | Zustand |
| statusBarRegistry | YES | YES | Zustand |
| ViewerRegistry | NO | NO | Plain Array |

### After Phase 43

| Registry | Has `source` field | Has `unregisterBySource` | Store Type |
|----------|--------------------|--------------------------|------------|
| bladeRegistry | YES | YES | Zustand |
| commandRegistry | YES | YES | **Zustand** |
| previewRegistry | **YES** | **YES** | **Zustand** |
| toolbarRegistry | YES | YES | Zustand |
| contextMenuRegistry | YES | YES | Zustand |
| sidebarPanelRegistry | YES | YES | Zustand |
| statusBarRegistry | YES | YES | Zustand |
| ViewerRegistry | NO | NO | Plain Array (out of scope) |

**ViewerRegistry** (`src/components/viewers/ViewerRegistry.ts`) is also a plain array without source tracking, but it has only 2 consumer files and is not in scope for Phase 43. It should be migrated in a future phase if content viewers need per-extension cleanup.

### ExtensionAPI.cleanup() After Migration

After Phase 43, `cleanup()` can be simplified to use `unregisterBySource` consistently for ALL registries:

```typescript
cleanup(): void {
  const source = `ext:${this.extensionId}`;

  // All registries: source-based bulk cleanup
  useBladeRegistry.getState().unregisterBySource(source);
  useCommandRegistry.getState().unregisterBySource(source);
  usePreviewRegistry.getState().unregisterBySource(source);
  useToolbarRegistry.getState().unregisterBySource(source);
  useContextMenuRegistry.getState().unregisterBySource(source);
  useSidebarPanelRegistry.getState().unregisterBySource(source);
  useStatusBarRegistry.getState().unregisterBySource(source);

  // Event bus
  extensionEventBus.removeAllForSource(this.extensionId);

  // Navigation + git hooks + disposables (unchanged)
  // ...
}
```

This means the `registeredCommands: string[]` tracking array in ExtensionAPI becomes unnecessary (can be removed or kept for backward compat with existing extensions that call `unregisterCommand` directly).

## Enforcing Extensibility

### Problem Statement
The codebase currently has 3 hardcoded patterns that Phase 43 needs to fix:
1. `WelcomeView.tsx:11` -- `import { InitRepoBlade } from "../blades/init-repo"`
2. `ProcessNavigation.tsx:8-11` -- Static `PROCESSES` array
3. `CommandPalette.tsx:24` -- `useMemo(() => getEnabledCommands(), [isOpen])` (not reactive)

### Architectural Guardrails

**1. File-level lint rule (Biome `noRestrictedImports`):**

Add to `biome.json`:
```json
{
  "linter": {
    "rules": {
      "recommended": true,
      "nursery": {
        "noRestrictedImports": {
          "level": "warn",
          "options": {
            "paths": {
              "../blades/init-repo": "Use BladeRegistry lookup instead of direct InitRepoBlade import",
              "../blades/topology-graph": "Use BladeRegistry lookup instead of direct TopologyRootBlade import"
            }
          }
        }
      }
    }
  }
}
```

**Note:** Biome's `noRestrictedImports` is in the nursery category as of Biome 1.9. Verify its availability in the project's Biome version. If not available, document the restriction in CONTRIBUTING.md or use a code review convention.

**Confidence:** MEDIUM -- need to verify Biome 1.9 nursery rule availability.

**2. BladeRegistry exhaustiveness check (already exists):**

`_discovery.ts` already has an `EXPECTED_TYPES` check that warns when core blade types are missing. After Phase 45-46 extractions, this list should be split into `CORE_TYPES` (always present) and `EXTENSION_TYPES` (present when extension is active). This is Phase 47 work, but the infrastructure prep should not break this mechanism.

**3. Type-level enforcement for new registrations:**

The `Command.source` field is already `source?: string`. Making it **required** would force every `registerCommand()` call to declare its source. However, this is a breaking change for the 6 command files in `src/commands/`.

**Recommendation:** Keep `source` optional for backward compatibility but have the Zustand store default it to `"core"` when unset:

```typescript
register: (cmd) => {
  const next = new Map(get().commands);
  next.set(cmd.id, { ...cmd, source: cmd.source ?? "core" });
  set({ commands: next }, false, "command-registry/register");
},
```

This ensures every command has a source for filtering/cleanup, without requiring changes to existing registration files.

**4. Convention: "Registry-first" development pattern:**

Document the architectural rule: "If a feature needs a UI element to appear or disappear based on available functionality, query the registry, don't import the component." This should be in the project's developer documentation (Phase 47 responsibility).

## Execution Order Dependencies

```
INFRA-01 (commandRegistry -> Zustand) ─┐
                                        ├─> INFRA-03 (CommandPalette reactive)
INFRA-02 (previewRegistry -> Zustand) ──┘

INFRA-01 + INFRA-02 ──> ExtensionAPI.cleanup() simplification

BladeRegistry (already done) ──> INFRA-04 (process tab visibility hook)
                             ──> INFRA-05 (WelcomeView lookup)

INFRA-06 (CC store reset) ──> independent, no dependencies
INFRA-07 (sandbox API) ──> independent, no dependencies
```

**Recommended plan order:**
1. **Plan A:** INFRA-01 + INFRA-02 (registry migrations) -- foundational, enables everything else
2. **Plan B:** INFRA-03 + INFRA-06 (CommandPalette reactive + CC reset) -- depends on Plan A for reactive commands
3. **Plan C:** INFRA-04 + INFRA-05 (process visibility + WelcomeView) -- depends on BladeRegistry (already done)
4. **Plan D:** INFRA-07 (sandbox API expansion) -- independent
5. **Plan E:** ExtensionAPI.cleanup() simplification + tests -- depends on Plans A-D

## Consumer Impact Analysis

### commandRegistry Consumers (13 files)

| File | Imports | Impact |
|------|---------|--------|
| `src/commands/repository.ts` | `registerCommand` | ZERO -- backward-compat export |
| `src/commands/navigation.ts` | `registerCommand` | ZERO -- backward-compat export |
| `src/commands/settings.ts` | `registerCommand` | ZERO -- backward-compat export |
| `src/commands/extensions.ts` | `registerCommand` | ZERO -- backward-compat export |
| `src/commands/branches.ts` | `registerCommand` | ZERO -- backward-compat export |
| `src/commands/sync.ts` | `registerCommand` | ZERO -- backward-compat export |
| `src/extensions/ExtensionAPI.ts` | `registerCommand`, `unregisterCommand`, `CommandCategory` | ZERO -- backward-compat exports |
| `src/components/command-palette/CommandPalette.tsx` | `getEnabledCommands`, `getOrderedCategories`, `CommandCategory` | MODIFY -- switch to Zustand hook |
| `src/components/command-palette/CommandPaletteItem.tsx` | `Command` (type) | ZERO -- type re-exported |
| `src/lib/fuzzySearch.ts` | `Command` (type) | ZERO -- type re-exported |
| `src/blades/extension-detail/ExtensionDetailBlade.tsx` | `getCommands` | ZERO -- backward-compat export |
| `src/extensions/__tests__/github.test.ts` | `getCommandById` | ZERO -- backward-compat export |

**Result:** Only CommandPalette.tsx needs active modification. All other consumers use backward-compatible function exports unchanged.

### previewRegistry Consumers (2 files)

| File | Imports | Impact |
|------|---------|--------|
| `src/blades/staging-changes/components/previewRegistrations.ts` | `registerPreview` | ZERO -- backward-compat export |
| `src/blades/staging-changes/components/StagingDiffPreview.tsx` | `getPreviewForFile` | ZERO (or MODIFY if reactivity needed) |

**Result:** Minimal impact. If StagingDiffPreview needs reactive updates when preview registrations change, switch to Zustand hook. Otherwise backward-compat exports suffice.

## Open Questions

1. **Should ViewerRegistry also be migrated?**
   - What we know: It's a plain array without source tracking, used by 2 files. The content-viewers extension currently registers via BladeRegistry, not ViewerRegistry.
   - What's unclear: Whether any future extension will contribute viewers through this registry.
   - Recommendation: Out of scope for Phase 43. Migrate if needed in a future phase.

2. **Should `source` be required on Command interface?**
   - What we know: Making it required forces 6 command files to add `source: "core"`. Making it optional with store-level defaulting achieves the same effect with zero breaking changes.
   - Recommendation: Keep optional, default to `"core"` in the store's `register()` action.

3. **What happens when both topology and init-repo are disabled?**
   - What we know: ProcessNavigation shows only "Staging" tab. WelcomeView shows a fallback UI.
   - What's unclear: Exact fallback UX for WelcomeView when init-repo is disabled (Phase 45 responsibility).
   - Recommendation: Phase 43 only needs to establish the lookup pattern. Phase 45 defines the fallback component.

4. **HMR behavior for migrated registries:**
   - What we know: BladeRegistry handles HMR via `clearCoreRegistry()` in `_discovery.ts`.
   - What's unclear: Do `src/commands/*.ts` files need HMR handling? Currently they use side-effect imports that run at module load time.
   - Recommendation: If commands double-register on HMR, add `if (import.meta.hot)` cleanup similar to `_discovery.ts`. Test this during implementation.

## Sources

### Primary (HIGH confidence)
- `/pmndrs/zustand` via Context7 -- store creation, getState(), subscribe patterns
- Direct codebase analysis of all 7 registry implementations
- Direct codebase analysis of ExtensionAPI.ts, ExtensionHost.ts, sandbox-api-surface.ts
- Direct codebase analysis of CommandPalette.tsx, WelcomeView.tsx, ProcessNavigation.tsx

### Secondary (MEDIUM confidence)
- Zustand subscribeWithSelector middleware docs (Context7)
- Biome noRestrictedImports nursery rule -- needs version verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use
- Architecture patterns: HIGH -- every pattern is derived from existing codebase implementations
- Pitfalls: HIGH -- based on direct code analysis of real files
- Enforceability: MEDIUM -- Biome lint rule needs version verification

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days -- stable patterns, no external dependency changes expected)

## RESEARCH COMPLETE
