# Phase 43: Infrastructure Prep - Implementation Research

**Researched:** 2026-02-11
**Domain:** Zustand store migration, extension infrastructure hooks, reactive registries
**Confidence:** HIGH

## Summary

Phase 43 migrates `commandRegistry` and `previewRegistry` from plain Map-based modules to Zustand stores, following the exact pattern already established by `bladeRegistry` (migrated in v1.6). The codebase has 5 existing Zustand-backed registries (blade, toolbar, context-menu, sidebar-panel, status-bar) that all follow an identical pattern: `create<StateInterface>()(devtools((set, get) => ({...}), { name: "...", enabled: import.meta.env.DEV }))` with backward-compatible function exports that delegate to `useStore.getState().method()`.

The migration is low-risk because: (1) the pattern is thoroughly proven in this codebase, (2) commandRegistry has only 10 consumer files and previewRegistry has only 2, (3) the `__mocks__/zustand.ts` auto-reset mock already handles new Zustand stores in tests. The extension lifecycle hooks (`onDidNavigate`, `events`, `settings`) already exist in `ExtensionAPI.ts` and `sandbox-api-surface.ts` simply needs them declared.

**Primary recommendation:** Follow the bladeRegistry migration pattern exactly -- Zustand store with `Map<string, T>` state, backward-compatible function exports, devtools middleware. Use `useCommandRegistry` selector in CommandPalette to replace the `useMemo(() => getEnabledCommands(), [isOpen])` anti-pattern with true reactivity.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5 | State management for registries | Already used for 7+ stores in the project |
| zustand/middleware (devtools) | ^5 | DevTools integration | Curried form `create<T>()(devtools(...))` is project convention |
| @xstate/react | ^6 | Navigation machine React bindings | Already used for process navigation |
| xstate | ^5.26 | Navigation FSM | Already used for blade stack management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand/shallow | ^5 | Shallow equality for selectors | When selecting multiple values from store to avoid unnecessary re-renders |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand Map-based store | Array-based store | Map preserves O(1) lookup by ID; array would require .find(). Stick with Map for consistency with 5 other registries. |
| Direct store subscription in CommandPalette | useSyncExternalStore | Zustand's useStore IS useSyncExternalStore under the hood. No benefit to going lower-level. |

**Installation:** No new packages needed. All dependencies already in package.json.

## Architecture Patterns

### Recommended File Structure
```
src/
├── lib/
│   ├── commandRegistry.ts       # MODIFY: Zustand store + backward-compat exports
│   └── previewRegistry.ts       # MODIFY: Zustand store + backward-compat exports
├── components/
│   └── command-palette/
│       └── CommandPalette.tsx    # MODIFY: useCommandRegistry selector
├── blades/
│   └── _shared/
│       └── ProcessNavigation.tsx # MODIFY: conditional tab visibility
├── components/
│   └── WelcomeView.tsx          # MODIFY: BladeRegistry lookup for InitRepoBlade
├── extensions/
│   ├── ExtensionAPI.ts          # VERIFY: cleanup() already calls unregisterCommand
│   └── sandbox/
│       └── sandbox-api-surface.ts  # MODIFY: add 3 new methods
├── stores/
│   └── conventional.ts          # MODIFY: explicit reset on extension disable
└── hooks/
    └── useProcessTabVisibility.ts  # NEW: hook for conditional tab visibility
```

### Pattern 1: Registry-to-Zustand Migration (Proven Pattern)

**What:** Convert a `Map<string, T>` module-level variable with exported functions into a Zustand store with identical function exports.

**When to use:** Any registry that needs reactive updates in React components.

**Example -- commandRegistry migration:**

```typescript
// Source: Verified pattern from src/lib/bladeRegistry.ts (lines 36-94)
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { LucideIcon } from "lucide-react";

// --- Types (UNCHANGED) ---
export type CoreCommandCategory = /* ... existing ... */;
export type CommandCategory = CoreCommandCategory | (string & {});
export interface Command { /* ... existing interface ... */ }

// --- Store ---

export interface CommandRegistryState {
  commands: Map<string, Command>;
  register: (cmd: Command) => void;
  unregister: (id: string) => boolean;
  unregisterBySource: (source: string) => void;
  getAll: () => Command[];
  getEnabled: () => Command[];
  getById: (id: string) => Command | undefined;
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

      getEnabled: () =>
        Array.from(get().commands.values()).filter(
          (cmd) => (cmd.enabled ? cmd.enabled() : true)
        ),

      getById: (id) => get().commands.get(id),

      getOrderedCategories: () => {
        // Identical logic to current getOrderedCategories()
        const allCategories = new Set<CommandCategory>();
        for (const cmd of get().commands.values()) {
          allCategories.add(cmd.category);
        }
        const coreSet = new Set<string>(CORE_ORDER);
        const ordered: CommandCategory[] = [];
        for (const cat of CORE_ORDER) {
          if (allCategories.has(cat)) ordered.push(cat);
        }
        const extensionCats = Array.from(allCategories)
          .filter((cat) => !coreSet.has(cat))
          .sort();
        ordered.push(...extensionCats);
        return ordered;
      },
    }),
    { name: "command-registry", enabled: import.meta.env.DEV },
  ),
);

// --- Backward-compatible function exports ---
// All 10 consumer files continue importing these same functions unchanged.

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
  const cmd = getCommandById(id);
  if (!cmd) return;
  if (cmd.enabled && !cmd.enabled()) return;
  cmd.action();
}

export function getOrderedCategories(): CommandCategory[] {
  return useCommandRegistry.getState().getOrderedCategories();
}
```

**Key points:**
- Store uses `Map<string, Command>` for O(1) lookup consistency
- Every mutation creates `new Map(get().commands)` for Zustand reference equality
- Devtools action names follow `"registry-name/action"` convention
- Function exports delegate to `useStore.getState().method()` -- zero API change for callers
- The `CORE_ORDER` constant stays as a module-level const (no need to put in store)

### Pattern 2: Reactive CommandPalette Subscription

**What:** Replace the non-reactive `useMemo(() => getEnabledCommands(), [isOpen])` with a Zustand selector that re-renders on actual command changes.

**Current code (non-reactive):**
```typescript
// CommandPalette.tsx line 24 -- commands snapshot ONLY when isOpen changes
const enabledCommands = useMemo(() => getEnabledCommands(), [isOpen]);
```

**Migrated code (reactive):**
```typescript
import { useCommandRegistry } from "../../lib/commandRegistry";

// Subscribe to the commands Map directly -- re-renders on any register/unregister
const commands = useCommandRegistry((s) => s.commands);

// Derive enabled commands from the reactive state
const enabledCommands = useMemo(
  () => Array.from(commands.values()).filter((cmd) => (cmd.enabled ? cmd.enabled() : true)),
  [commands],
);
```

**Why this works:** Every `register()`/`unregister()` call creates a new `Map` reference in the store. This triggers Zustand's `Object.is` comparison to detect a change, causing the CommandPalette to re-render with the latest commands. No need for shallow equality because we're selecting the entire Map reference.

### Pattern 3: PreviewRegistry Migration

**What:** Convert the array-based previewRegistry to a Zustand store with source-based cleanup.

**Current state:** `previewRegistry.ts` is 31 lines with a simple `registry: PreviewRegistration[]` array. Only 2 consumer files.

**Store shape:**
```typescript
export interface PreviewRegistryState {
  previews: PreviewRegistration[];
  register: (config: PreviewRegistration) => void;
  unregister: (key: string) => boolean;
  unregisterBySource: (source: string) => void;
  getForFile: (filePath: string) => PreviewRegistration | undefined;
}
```

**CRITICAL: PreviewRegistration needs a `source` field** -- the current interface does NOT have one. Must be added for extension cleanup to work:
```typescript
export interface PreviewRegistration {
  key: string;
  matches: (filePath: string) => boolean;
  mode: PreviewMode;
  placeholder?: { icon: ComponentType<{ className?: string }>; message: string };
  component?: ComponentType<{ file: FileChange; source: DiffSource }>;
  priority?: number;
  source?: string;  // NEW: "core" for built-in, "ext:{extensionId}" for extensions
}
```

### Pattern 4: Process Tab Visibility Hook

**What:** A React hook that checks BladeRegistry for `topology-graph` registration and conditionally filters the PROCESSES array.

**Implementation approach:**
```typescript
// src/hooks/useProcessTabVisibility.ts
import { useBladeRegistry } from "../lib/bladeRegistry";
import type { ProcessType } from "../machines/navigation/types";

interface VisibleProcess {
  id: ProcessType;
  label: string;
  icon: LucideIcon;
}

export function useVisibleProcesses(): VisibleProcess[] {
  const blades = useBladeRegistry((s) => s.blades);

  return useMemo(() => {
    const processes: VisibleProcess[] = [
      { id: "staging", label: "Staging", icon: Files },
    ];
    // Only show topology tab if the blade type is registered
    if (blades.has("topology-graph")) {
      processes.push({ id: "topology", label: "Topology", icon: Network });
    }
    return processes;
  }, [blades]);
}
```

**Why hook-based:** ProcessNavigation.tsx currently hardcodes `PROCESSES` as a const array. The hook approach makes it reactive to BladeRegistry changes. When an extension that provides `topology-graph` is disabled (and unregisters the blade), the tab disappears automatically.

### Pattern 5: WelcomeView BladeRegistry Lookup

**What:** Replace the direct `import { InitRepoBlade } from "../blades/init-repo"` with a BladeRegistry lookup.

**Current code (hardcoded):**
```typescript
import { InitRepoBlade } from "../blades/init-repo";
// ...
<InitRepoBlade directoryPath={pendingInitPath} onCancel={...} onComplete={...} />
```

**Migrated approach:**
```typescript
import { useBladeRegistry } from "../lib/bladeRegistry";

// Inside WelcomeView:
const initRepoBlade = useBladeRegistry((s) => s.blades.get("init-repo"));

if (showInitRepo && pendingInitPath && initRepoBlade) {
  const Component = initRepoBlade.component;
  return (
    <div className="h-[calc(100vh-3.5rem)] bg-ctp-base">
      <Component
        directoryPath={pendingInitPath}
        onCancel={() => setShowInitRepo(false)}
        onComplete={async (path) => { /* ... */ }}
      />
    </div>
  );
}
```

**Important:** The `InitRepoBlade` import should be kept as a fallback (or the blade registration should happen via `_discovery.ts` side-effect, which it already does through `src/blades/init-repo/registration.ts`). The BladeRegistry lookup just makes it dynamic -- if an extension overrides `init-repo`, the extension's component renders instead.

### Pattern 6: CC Store Reset on Extension Disable

**What:** When the Conventional Commits extension is disabled, explicitly reset the `useConventionalStore`.

**Where to hook in:** The CC extension's `onDeactivate` function (currently a no-op) or via an `api.onDispose()` call during `onActivate`.

**Implementation:**
```typescript
// In src/extensions/conventional-commits/index.ts onActivate:
import { useConventionalStore } from "../../stores/conventional";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // ... existing blade/command registrations ...

  // Reset CC store when this extension is cleaned up
  api.onDispose(() => {
    useConventionalStore.getState().reset();
  });
}
```

**Why `api.onDispose()` over `onDeactivate`:** The `onDispose` pattern is already used by ExtensionAPI for cleanup and runs during `api.cleanup()`. The `onDeactivate` lifecycle runs BEFORE cleanup. Using `onDispose` ensures the store reset happens in the right order (after commands/blades are unregistered) and is automatically tracked by the API facade.

**CRITICAL:** The `useConventionalStore` is created via `createBladeStore` which calls `registerStoreForReset`. However, `resetAllStores()` is only called during global reset (repo switch), NOT during extension disable. Extension-specific reset requires explicit `store.getState().reset()` or `store.setState(store.getInitialState(), true)`.

### Pattern 7: Sandbox API Surface Updates

**What:** Add 3 new method names to the classification arrays in `sandbox-api-surface.ts`.

**Current state:**
```typescript
export const SANDBOX_SAFE_METHODS = [
  "onDidGit", "onWillGit", "onDispose",
] as const;

export const REQUIRES_TRUST_METHODS = [
  "registerBlade", "registerCommand", "contributeToolbar",
  "contributeContextMenu", "contributeSidebarPanel", "contributeStatusBar",
] as const;
```

**Changes needed:**
```typescript
export const SANDBOX_SAFE_METHODS = [
  "onDidGit", "onWillGit", "onDispose",
  "onDidNavigate",  // NEW: handler receives serializable BladeNavigationEvent
  "events",         // NEW: pub/sub with serializable payloads
  "settings",       // NEW: key-value store via tauri-plugin-store
] as const;
```

**Note:** `onDidNavigate`, `events`, and `settings` are already IMPLEMENTED in `ExtensionAPI.ts`. The only missing piece is declaring them in the sandbox-api-surface classification. All three are sandbox-safe because they deal with serializable data.

### Anti-Patterns to Avoid

- **Don't use `useShallow` for single-value selectors:** `useCommandRegistry((s) => s.commands)` returns a Map reference. Since Zustand uses `Object.is` comparison and we create a new Map on every mutation, this triggers correctly. `useShallow` is only needed when returning tuples/objects from selectors.

- **Don't put `getAll()` / `getEnabled()` / `getOrderedCategories()` in store state:** These are derived values. Storing them would require updating them on every mutation. Instead, compute them in selectors or expose them as store methods that call `get()`.

- **Don't move `CORE_ORDER` into the Zustand store:** It's a static constant that never changes. Keeping it as a module-level const avoids unnecessary store complexity.

- **Don't remove backward-compatible function exports immediately:** The migration must be invisible to the 10 commandRegistry consumers and 2 previewRegistry consumers. Function exports are the compatibility bridge.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Store equality | Custom deep comparison | Zustand default `Object.is` with new Map reference | Creating `new Map()` on every mutation guarantees reference change detection |
| Store reset in tests | Manual `beforeEach` reset | `__mocks__/zustand.ts` auto-reset | Already handles curried `create<T>()()` form used by devtools |
| Reactive updates | Custom event emitter + forceUpdate | Zustand `useStore(selector)` | Zustand's built-in React integration handles subscription, unsubscription, and re-render |
| Store devtools labels | Unnamed stores | `devtools(..., { name: "...", enabled: import.meta.env.DEV })` | Consistent with all 7+ existing stores |

**Key insight:** Every pattern needed for this phase already exists in the codebase. BladeRegistry is the exact template for commandRegistry. ToolbarRegistry is the exact template for any store needing `unregisterBySource`. The `__mocks__/zustand.ts` handles test auto-reset. There is zero novel infrastructure to build.

## Common Pitfalls

### Pitfall 1: CommandPalette Re-render Storm
**What goes wrong:** Subscribing to the entire `commands` Map in CommandPalette could cause re-renders on every command registration during app startup (10+ commands registered synchronously).
**Why it happens:** Each `registerCommand()` call creates a new Map reference, triggering a re-render.
**How to avoid:** This is actually fine for two reasons: (1) CommandPalette renders `null` when `!isOpen`, so re-renders are essentially free, (2) The Zustand auto-batching in React 18+ batches synchronous state updates. But if it becomes an issue, use `useCommandRegistry((s) => s.commands.size)` as a lightweight "version counter" selector.
**Warning signs:** React DevTools showing hundreds of CommandPalette renders during startup.

### Pitfall 2: Stale Closure in Command `enabled()` Callbacks
**What goes wrong:** Command `enabled` callbacks capture stale store state if they use closures instead of reading `.getState()` at call time.
**Why it happens:** The `enabled` function is registered once and called later. If it closes over a variable instead of calling `.getState()`, it sees stale data.
**How to avoid:** This is an EXISTING issue that pre-dates the migration. The migration doesn't make it worse. Existing commands already correctly use `.getState()` (e.g., `enabled: () => !!useRepositoryStore.getState().repoStatus`).
**Warning signs:** Commands appearing enabled when they shouldn't be.

### Pitfall 3: Zustand Auto-Reset Mock and Curried Create
**What goes wrong:** The `__mocks__/zustand.ts` mock intercepts `create()` but needs to handle the curried form `create<T>()(devtools(...))`.
**Why it happens:** When `create()` is called without arguments (curried form), it returns a function that accepts the state creator. The mock must handle both `create(fn)` and `create()(fn)`.
**How to avoid:** The existing mock at `__mocks__/zustand.ts` (lines 18-23) already handles this: `if (typeof stateCreator === "function") return createUncurried(stateCreator); return createUncurried;`. However, the mock strips the `devtools` wrapper. This is fine because devtools is a transparent middleware that doesn't affect behavior in tests.
**Warning signs:** Tests failing with "create is not a function" or store state not resetting between tests.

### Pitfall 4: Circular Import Between commandRegistry and ExtensionAPI
**What goes wrong:** `commandRegistry.ts` is imported by `ExtensionAPI.ts`, and if commandRegistry were to import anything from the extension system, it would create a circular dependency.
**Why it happens:** commandRegistry is a foundational module imported by both core code and extension API.
**How to avoid:** The current import graph is clean: `ExtensionAPI.ts -> commandRegistry.ts -> (no extension imports)`. The migration must NOT add any imports from the extension system into commandRegistry. Keep the dependency direction one-way: extension layer -> registry layer -> types only.
**Warning signs:** Runtime errors like "Cannot access 'X' before initialization" or undefined imports during module evaluation.

### Pitfall 5: PreviewRegistry Source Field Missing
**What goes wrong:** Attempting to call `unregisterBySource()` on previewRegistry fails because existing `PreviewRegistration` entries don't have a `source` field.
**Why it happens:** The current interface doesn't include `source`. Core preview registrations (binary, image, archive, 3d, text-diff) in `previewRegistrations.ts` will need `source: "core"` added.
**How to avoid:** Add `source?: string` to the `PreviewRegistration` interface. Update the 5 existing `registerPreview()` calls in `previewRegistrations.ts` to include `source: "core"`. Make `source` optional so it defaults to `undefined` (treated as "no source" for backward compatibility).
**Warning signs:** Extension preview handlers persisting after extension disable.

### Pitfall 6: ProcessNavigation Reactivity Timing
**What goes wrong:** The topology tab could flicker during extension activation/deactivation because BladeRegistry updates and navigation state updates happen asynchronously.
**Why it happens:** Extension activation registers blades then switches process. If the component re-renders between these two operations, it might briefly show/hide the tab.
**How to avoid:** The `useVisibleProcesses` hook derives from BladeRegistry state, which updates synchronously within the store. Blade registration happens during `activate()` BEFORE any navigation events. The tab visibility should be stable. If flicker occurs, add a debounce or use `startTransition`.
**Warning signs:** Topology tab briefly appearing/disappearing during extension toggle.

### Pitfall 7: CC Store Ghost Data on Re-enable
**What goes wrong:** If the CC store is not reset on disable, and the user re-enables the extension, they see stale form data (old commit type, scope, description).
**Why it happens:** The `createBladeStore` auto-reset only fires on `resetAllStores()` (global reset), not on per-extension disable.
**How to avoid:** The `api.onDispose(() => useConventionalStore.getState().reset())` call in the CC extension's `onActivate` ensures the store is reset when the extension is cleaned up. Verify that `reset()` clears ALL state including `scopeFrequencies` and `pushAfterCommit` which are not currently included in the existing `reset()` method.
**Warning signs:** Re-enabling CC extension shows previously entered commit data.

## Code Examples

### Example 1: Full commandRegistry Migration (TypeScript)

See Pattern 1 above for the complete implementation. Key files to modify:
- `src/lib/commandRegistry.ts` -- replace module Map with Zustand store
- All 10 consumer files remain unchanged (backward-compat exports)

### Example 2: CommandPalette Reactive Subscription

```typescript
// src/components/command-palette/CommandPalette.tsx
// BEFORE (non-reactive):
import { getEnabledCommands, getOrderedCategories } from "../../lib/commandRegistry";
const enabledCommands = useMemo(() => getEnabledCommands(), [isOpen]);

// AFTER (reactive):
import { useCommandRegistry, type CommandCategory } from "../../lib/commandRegistry";

const commands = useCommandRegistry((s) => s.commands);
const enabledCommands = useMemo(
  () => Array.from(commands.values()).filter((cmd) => (cmd.enabled ? cmd.enabled() : true)),
  [commands],
);
const orderedCategories = useMemo(() => {
  // Use getOrderedCategories() from backward-compat export, or inline the logic
  return getOrderedCategories();
}, [commands]); // Re-derive when commands change
```

### Example 3: Process Tab Visibility Hook

```typescript
// src/hooks/useProcessTabVisibility.ts
import { useMemo } from "react";
import { Files, Network, type LucideIcon } from "lucide-react";
import { useBladeRegistry } from "../lib/bladeRegistry";
import type { ProcessType } from "../machines/navigation/types";

export interface VisibleProcess {
  id: ProcessType;
  label: string;
  icon: LucideIcon;
}

const STAGING_PROCESS: VisibleProcess = {
  id: "staging",
  label: "Staging",
  icon: Files,
};
const TOPOLOGY_PROCESS: VisibleProcess = {
  id: "topology",
  label: "Topology",
  icon: Network,
};

export function useVisibleProcesses(): VisibleProcess[] {
  const blades = useBladeRegistry((s) => s.blades);

  return useMemo(() => {
    const visible: VisibleProcess[] = [STAGING_PROCESS];
    if (blades.has("topology-graph")) {
      visible.push(TOPOLOGY_PROCESS);
    }
    return visible;
  }, [blades]);
}
```

### Example 4: CC Store Cleanup via onDispose

```typescript
// In src/extensions/conventional-commits/index.ts
import { useConventionalStore } from "../../stores/conventional";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // ... existing registrations ...

  // Ensure CC store resets when extension is disabled
  api.onDispose(() => {
    useConventionalStore.getState().reset();
  });
}
```

### Example 5: Sandbox API Surface Update

```typescript
// src/extensions/sandbox/sandbox-api-surface.ts
export const SANDBOX_SAFE_METHODS = [
  "onDidGit",
  "onWillGit",
  "onDispose",
  "onDidNavigate",
  "events",
  "settings",
] as const;
```

### Example 6: PreviewRegistry with Source-based Cleanup

```typescript
// src/lib/previewRegistry.ts -- Zustand migration
import type { ComponentType } from "react";
import type { FileChange } from "../bindings";
import type { DiffSource } from "../blades/diff";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type PreviewMode = "inline-diff" | "placeholder" | "custom";

export interface PreviewRegistration {
  key: string;
  matches: (filePath: string) => boolean;
  mode: PreviewMode;
  placeholder?: {
    icon: ComponentType<{ className?: string }>;
    message: string;
  };
  component?: ComponentType<{ file: FileChange; source: DiffSource }>;
  priority?: number;
  source?: string; // "core" for built-in, "ext:{extensionId}" for extensions
}

export interface PreviewRegistryState {
  previews: PreviewRegistration[];
  register: (config: PreviewRegistration) => void;
  unregister: (key: string) => boolean;
  unregisterBySource: (source: string) => void;
  getForFile: (filePath: string) => PreviewRegistration | undefined;
}

export const usePreviewRegistry = create<PreviewRegistryState>()(
  devtools(
    (set, get) => ({
      previews: [] as PreviewRegistration[],

      register: (config) => {
        const next = [...get().previews, config].sort(
          (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
        );
        set({ previews: next }, false, "preview-registry/register");
      },

      unregister: (key) => {
        const prev = get().previews;
        const next = prev.filter((r) => r.key !== key);
        if (next.length === prev.length) return false;
        set({ previews: next }, false, "preview-registry/unregister");
        return true;
      },

      unregisterBySource: (source) => {
        const next = get().previews.filter((r) => r.source !== source);
        set({ previews: next }, false, "preview-registry/unregisterBySource");
      },

      getForFile: (filePath) => {
        return get().previews.find((r) => r.matches(filePath));
      },
    }),
    { name: "preview-registry", enabled: import.meta.env.DEV },
  ),
);

// --- Backward-compatible function exports ---

export function registerPreview(config: PreviewRegistration): void {
  usePreviewRegistry.getState().register(config);
}

export function getPreviewForFile(
  filePath: string,
): PreviewRegistration | undefined {
  return usePreviewRegistry.getState().getForFile(filePath);
}
```

## Detailed File-by-File Impact Analysis

### Files to MODIFY

| File | Change | Risk | Lines Changed |
|------|--------|------|---------------|
| `src/lib/commandRegistry.ts` | Replace Map + functions with Zustand store + backward-compat exports | LOW | ~80 (full rewrite, same logic) |
| `src/lib/previewRegistry.ts` | Replace array + functions with Zustand store + backward-compat exports | LOW | ~50 (full rewrite, same logic) |
| `src/components/command-palette/CommandPalette.tsx` | Use `useCommandRegistry` selector instead of `useMemo(() => getEnabledCommands())` | LOW | ~5 lines |
| `src/blades/_shared/ProcessNavigation.tsx` | Use `useVisibleProcesses()` hook instead of hardcoded PROCESSES | LOW | ~10 lines |
| `src/components/WelcomeView.tsx` | Use BladeRegistry lookup for InitRepoBlade | MEDIUM | ~10 lines |
| `src/extensions/sandbox/sandbox-api-surface.ts` | Add 3 methods to SANDBOX_SAFE_METHODS | LOW | 3 lines |
| `src/extensions/conventional-commits/index.ts` | Add `api.onDispose(() => store.reset())` | LOW | 4 lines |
| `src/blades/staging-changes/components/previewRegistrations.ts` | Add `source: "core"` to 5 registerPreview calls | LOW | 5 lines |

### Files to CREATE

| File | Purpose | Risk |
|------|---------|------|
| `src/hooks/useProcessTabVisibility.ts` | Hook to derive visible process tabs from BladeRegistry | LOW |

### Files that REMAIN UNCHANGED

All 10 files that import from commandRegistry's function exports:
- `src/commands/branches.ts`, `extensions.ts`, `navigation.ts`, `repository.ts`, `settings.ts`, `sync.ts`
- `src/blades/extension-detail/ExtensionDetailBlade.tsx`
- `src/components/command-palette/CommandPaletteItem.tsx`
- `src/extensions/ExtensionAPI.ts`
- `src/lib/fuzzySearch.ts`

Both files that import from previewRegistry's function exports:
- `src/blades/staging-changes/components/StagingDiffPreview.tsx` (uses `getPreviewForFile`)
- `src/blades/staging-changes/components/previewRegistrations.ts` (uses `registerPreview`)

## Circular Import Analysis

### Current Import Graph (commandRegistry)
```
commandRegistry.ts
├── imports from: lucide-react (types only)
└── imported by:
    ├── src/commands/*.ts (6 files) -- call registerCommand()
    ├── src/components/command-palette/CommandPalette.tsx -- calls getEnabledCommands, getOrderedCategories
    ├── src/components/command-palette/CommandPaletteItem.tsx -- imports Command type only
    ├── src/extensions/ExtensionAPI.ts -- calls registerCommand, unregisterCommand
    ├── src/blades/extension-detail/ExtensionDetailBlade.tsx -- calls getCommands
    └── src/lib/fuzzySearch.ts -- imports Command type only
```

**Risk assessment:** commandRegistry imports NOTHING from the project. It only imports the LucideIcon type from lucide-react. The Zustand migration adds `import { create } from "zustand"` and `import { devtools } from "zustand/middleware"` -- both external packages. **ZERO circular import risk.**

### Current Import Graph (previewRegistry)
```
previewRegistry.ts
├── imports from: react (types), bindings (types), blades/diff (types)
└── imported by:
    ├── src/blades/staging-changes/components/previewRegistrations.ts
    └── src/blades/staging-changes/components/StagingDiffPreview.tsx
```

**Risk assessment:** previewRegistry imports types from `bindings` and `blades/diff`. Neither of these import from previewRegistry. The Zustand migration adds `zustand` and `zustand/middleware` imports. **ZERO circular import risk.**

### Post-Migration Graph Verification
After migration, no new project-internal imports are introduced in either registry file. The dependency direction remains strictly one-way: consumers -> registry -> external types only. No `madge --circular` check should be needed, but running it as a verification step is still recommended.

## Testing Approach

### Test Pattern: Registry Store Tests

```typescript
// src/lib/__tests__/commandRegistry.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useCommandRegistry, registerCommand, unregisterCommand, getCommands } from "../commandRegistry";

describe("commandRegistry", () => {
  // No beforeEach needed -- __mocks__/zustand.ts auto-resets after each test

  it("registerCommand adds to store", () => {
    registerCommand({
      id: "test-cmd",
      title: "Test",
      category: "Repository",
      action: () => {},
    });
    expect(useCommandRegistry.getState().commands.has("test-cmd")).toBe(true);
  });

  it("unregisterCommand removes from store", () => {
    registerCommand({ id: "test-cmd", title: "Test", category: "Repository", action: () => {} });
    const result = unregisterCommand("test-cmd");
    expect(result).toBe(true);
    expect(useCommandRegistry.getState().commands.has("test-cmd")).toBe(false);
  });

  it("unregisterBySource removes all commands from a source", () => {
    registerCommand({ id: "cmd-1", title: "Cmd 1", category: "Repository", action: () => {}, source: "ext:foo" });
    registerCommand({ id: "cmd-2", title: "Cmd 2", category: "Repository", action: () => {}, source: "ext:foo" });
    registerCommand({ id: "cmd-3", title: "Cmd 3", category: "Repository", action: () => {}, source: "core" });

    useCommandRegistry.getState().unregisterBySource("ext:foo");
    expect(getCommands()).toHaveLength(1);
    expect(getCommands()[0].id).toBe("cmd-3");
  });

  it("getOrderedCategories returns core categories first", () => {
    registerCommand({ id: "nav-1", title: "Nav", category: "Navigation", action: () => {} });
    registerCommand({ id: "repo-1", title: "Repo", category: "Repository", action: () => {} });
    registerCommand({ id: "ext-1", title: "Ext", category: "CustomExt", action: () => {} });

    const categories = useCommandRegistry.getState().getOrderedCategories();
    expect(categories[0]).toBe("Navigation");
    expect(categories[1]).toBe("Repository");
    expect(categories[2]).toBe("CustomExt");
  });
});
```

### Test Pattern: Reactive CommandPalette

```typescript
// Can be tested with @testing-library/react renderHook or component render
// The key test: register a command AFTER the palette is open, verify it appears

it("CommandPalette reactively shows new commands without reopen", async () => {
  // Render CommandPalette in open state
  // Register a new command
  // Assert new command appears in results
});
```

### Test Pattern: CC Store Reset

```typescript
it("CC store resets when extension is disabled", async () => {
  // Create ExtensionAPI for CC
  // Activate with onDispose handler that calls reset
  // Set some CC store state
  // Call api.cleanup()
  // Verify CC store is at initial state
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Module-level Map + exported functions | Zustand store + backward-compat exports | v1.6 (BladeRegistry) | Reactive UI updates, DevTools visibility |
| Hardcoded process tabs | Dynamic tabs from registry lookup | This phase (v1.7) | Extensions can add/remove process types |
| Direct component imports in views | BladeRegistry lookup for components | This phase (v1.7) | Extensions can override view components |

**Deprecated/outdated:**
- Plain Map-based registries: Still functional but cannot trigger React re-renders. The migration to Zustand stores is the upgrade path.

## Open Questions

1. **CC Store `reset()` Completeness**
   - What we know: `reset()` on line 224 of `conventional.ts` clears most fields but does NOT reset `scopeFrequencies` or `pushAfterCommit`.
   - What's unclear: Should these fields persist across extension disable/re-enable? `pushAfterCommit` is a user preference. `scopeFrequencies` is fetched data.
   - Recommendation: Reset ALL fields including `scopeFrequencies` and `pushAfterCommit`. The extension re-enable should start fresh. If users complain, make `pushAfterCommit` a persistent setting via `ExtensionSettings` instead.

2. **ProcessNavigation Fallback When No Topology Blade**
   - What we know: If `topology-graph` is not registered, the topology tab hides. But what if the user was ON the topology process when the extension is disabled?
   - What's unclear: Should the navigation machine auto-switch to "staging" process when topology becomes unavailable?
   - Recommendation: The navigation machine should detect when `activeProcess` refers to an unavailable blade type and auto-switch to "staging". This can be handled by the `useVisibleProcesses` hook sending a `SWITCH_PROCESS` event when the active process is no longer visible.

3. **HMR Behavior for Zustand Registries**
   - What we know: `_discovery.ts` handles HMR for blade registrations via `clearCoreRegistry()`. Command registrations in `src/commands/*.ts` use side-effect imports via `src/commands/index.ts`.
   - What's unclear: Will HMR correctly re-register commands when commandRegistry.ts changes?
   - Recommendation: Add HMR dispose handler similar to `_discovery.ts` for command registrations. The Zustand store persists across HMR, so stale commands might accumulate. Consider adding `clearCoreCommands()` analogous to `clearCoreRegistry()`.

## Sources

### Primary (HIGH confidence)
- `/pmndrs/zustand` (Context7) - Store creation, devtools middleware, subscription patterns, equality functions
- Codebase: `src/lib/bladeRegistry.ts` - Exact migration pattern (Zustand store + backward-compat exports)
- Codebase: `src/lib/toolbarRegistry.ts` - Zustand registry with unregisterBySource
- Codebase: `src/lib/contextMenuRegistry.ts` - Zustand registry pattern reference
- Codebase: `src/extensions/ExtensionAPI.ts` - Full cleanup lifecycle, onDispose, onDidNavigate
- Codebase: `src/extensions/ExtensionHost.ts` - Built-in extension lifecycle
- Codebase: `__mocks__/zustand.ts` - Auto-reset mock handling curried create

### Secondary (MEDIUM confidence)
- Codebase: `src/stores/conventional.ts` - CC store reset pattern, createBladeStore usage
- Codebase: `src/blades/_shared/ProcessNavigation.tsx` - Current hardcoded process tabs
- Codebase: `src/components/WelcomeView.tsx` - Current hardcoded InitRepoBlade import

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, patterns proven in 5+ registries
- Architecture: HIGH - Exact migration pattern exists in bladeRegistry.ts
- Pitfalls: HIGH - All pitfalls observed from actual codebase analysis, not speculation
- Testing: HIGH - `__mocks__/zustand.ts` already handles the exact store pattern needed

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable patterns, no external dependency changes expected)

## RESEARCH COMPLETE

**Phase:** 43 - infrastructure-prep
**Confidence:** HIGH

### Key Findings
1. The commandRegistry and previewRegistry migration follows the EXACT pattern already established by bladeRegistry (migrated in v1.6). Zero novel patterns needed.
2. CommandPalette's current `useMemo(() => getEnabledCommands(), [isOpen])` is a non-reactive anti-pattern. Replacing with `useCommandRegistry((s) => s.commands)` gives true reactivity -- commands appear the moment they register.
3. The 3 sandbox API methods (`onDidNavigate`, `events`, `settings`) are already fully implemented in ExtensionAPI.ts. Only the classification in sandbox-api-surface.ts needs updating.
4. CC store reset requires explicit `api.onDispose(() => store.reset())` because `createBladeStore`'s auto-reset only fires on global store reset, not extension disable.
5. PreviewRegistration interface needs a new `source?: string` field for source-based cleanup to work.

### File Created
`.planning/phases/43-infrastructure-prep/43-RESEARCH-IMPLEMENTATION.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All libraries already in package.json, patterns proven in codebase |
| Architecture | HIGH | Exact migration pattern exists in bladeRegistry.ts, 5 other registries confirm the pattern |
| Pitfalls | HIGH | All pitfalls derived from actual codebase analysis, circular import graph verified clean |
| Testing | HIGH | __mocks__/zustand.ts auto-reset mock confirmed compatible with curried create pattern |

### Open Questions
1. CC store `reset()` may need to include `scopeFrequencies` and `pushAfterCommit` fields
2. Navigation machine auto-switch when active process blade becomes unavailable
3. HMR behavior for command re-registration needs a `clearCoreCommands()` handler

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
