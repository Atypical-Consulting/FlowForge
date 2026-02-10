# Phase 33: Extension System Foundation - Research

**Researched:** 2026-02-10
**Domain:** Extension host architecture, manifest-driven registration, lifecycle management, registry refactoring for dynamic extensibility
**Confidence:** HIGH

## Summary

Phase 33 introduces a manifest-driven extension platform into FlowForge where extensions declare capabilities in a `flowforge.extension.json` file and register blades, commands, and toolbar contributions through a tracked, namespaced API. The core challenge is NOT building something from scratch -- it is **refactoring** the existing three registries (bladeRegistry, commandRegistry, toolbarRegistry) and the tightly-coupled BladeType system to support dynamic, namespaced, reversible registrations while preserving the compile-time safety that core blades currently enjoy.

The research was conducted from three distinct angles as requested:

1. **UX angle:** Extension contributions must feel seamless -- extension blades, commands, and toolbar actions should be indistinguishable from core functionality in everyday use. However, the command palette must show extension provenance (category grouping under extension name), and error states (incompatible API version, failed activation) must surface as user-visible toast messages, not silent console warnings.

2. **Technical architecture angle:** The extension system follows the VS Code "ExtensionHost" singleton pattern: a single `ExtensionHost` discovers manifests from `.flowforge/extensions/*/flowforge.extension.json` via Rust (tokio::fs), validates the manifest schema and apiVersion compatibility, then loads each extension's entry point via dynamic `import()`. Each extension receives a per-extension `ExtensionAPI` facade that wraps the registries with automatic tracking. Deactivation reverses all tracked registrations atomically.

3. **Tauri/Rust/React/Tailwind v4 expert angle:** The biggest refactoring challenge is the `BladeType` system. Currently it is a TypeScript union type derived from `keyof BladePropsMap`, which means every blade type must be known at compile time. Extension blades cannot be added to this interface. The solution is to split the type system: keep the compile-time `CoreBladeType` for type-safe core blade operations, and introduce a `string`-accepting overload path for extension blades (`ext:{extId}:{bladeName}`). The commandRegistry's `CommandCategory` has the same problem -- it is a string literal union. The toolbarRegistry is already extensible (union type `ToolbarGroup` with string-accepting patterns, `source` field, `unregisterBySource`).

**Primary recommendation:** Refactor registries bottom-up: (1) widen bladeRegistry and commandRegistry to accept dynamic string types alongside their compile-time unions, (2) add `unregisterBlade()` and `unregisterCommand()` functions with source tracking, (3) build the ExtensionHost as a Zustand store with manifest discovery via a new Rust/tauri-specta command, (4) create the per-extension ExtensionAPI facade, (5) validate with a minimal test extension.

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5 | ExtensionHost store, per-extension store creation | Already used for all stores; reactive state for extension status |
| serde + serde_json (Rust) | 1.x | Parse flowforge.extension.json manifests on Rust side | Already dependencies; JSON parsing in Rust is the secure path |
| tokio::fs (Rust) | 1.x | Async directory scanning for extension discovery | Already a dependency (tokio with "full" features) |
| tauri-specta | 2.0.0-rc.21 | Export extension discovery/lifecycle commands to frontend | Already used for all Tauri commands |
| dynamic import() | ES2020 | Load extension entry point JS modules at runtime | Built into platform; Vite supports dynamic import |

### Supporting (no new installs)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| notify (Rust) | 8.x | Watch .flowforge/extensions/ for hot install/uninstall | Reuse existing file watcher infrastructure; deferred to Phase 36 |
| @tauri-apps/plugin-store | ^2 | Persist extension enabled/disabled state | Already used via getStore() for settings |
| vitest + jsdom | ^4 | Test extension lifecycle, registration tracking, cleanup | Already the test infrastructure |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rust-side manifest parsing | Frontend JSON.parse with FS plugin | Rust-side is more secure (no FS plugin needed, no path traversal risk), and the manifest validation stays in a sandboxed context |
| Dynamic import() for extension loading | Web Workers / iframes for isolation | Workers/iframes add massive complexity for inter-context communication. For v1.5 (first-party extensions only), same-context loading is the right tradeoff. Isolation is a v2.0 concern. |
| Custom semver check | npm `semver` package | For v1.5 the apiVersion is a simple major version string (e.g., "1"). A `===` or basic `startsWith` comparison suffices. Full semver ranges are premature. |
| Zustand store for ExtensionHost | Plain singleton class | Zustand gives reactive UI updates (extension list in settings blade, status indicators). A plain class would need manual event subscriptions. |

**Installation:**
```bash
# No new packages needed -- entire implementation uses existing dependencies
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── extensions/                    # NEW: Extension system core
│   ├── ExtensionHost.ts          # Singleton store: discovery, lifecycle, status tracking
│   ├── ExtensionAPI.ts           # Per-extension facade: registerBlade, registerCommand, etc.
│   ├── extensionManifest.ts      # TypeScript types for flowforge.extension.json
│   ├── extensionTypes.ts         # Shared types: ExtensionStatus, ExtensionInfo
│   └── index.ts                  # Barrel export
├── lib/
│   ├── bladeRegistry.ts          # MODIFIED: add unregisterBlade(), accept string types, source tracking
│   ├── commandRegistry.ts        # MODIFIED: add unregisterCommand(), accept string categories, source tracking
│   └── toolbarRegistry.ts        # ALREADY SUPPORTS: unregister, unregisterBySource, source field
├── stores/
│   └── bladeTypes.ts             # MODIFIED: add ExtensionBladeType, widen navigation types
└── blades/
    └── _shared/
        └── BladeRenderer.tsx     # MODIFIED: handle extension blade types gracefully
src-tauri/src/
├── extensions/                    # NEW: Rust-side extension discovery
│   ├── mod.rs                    # Module root
│   ├── discovery.rs              # Scan .flowforge/extensions/*/ for manifests
│   └── manifest.rs               # Manifest struct, validation, apiVersion check
└── lib.rs                        # MODIFIED: register new extension commands
```

### Pattern 1: Manifest Schema (flowforge.extension.json)

**What:** The extension manifest declares what an extension provides and what it requires.
**When to use:** Every extension must have this file in its directory root.

```json
{
  "id": "github",
  "name": "GitHub Integration",
  "version": "1.0.0",
  "description": "Pull requests, issues, and CI status for GitHub repositories",
  "apiVersion": "1",
  "main": "index.js",
  "contributes": {
    "blades": [
      {
        "type": "pull-requests",
        "title": "Pull Requests",
        "singleton": true
      },
      {
        "type": "issues",
        "title": "Issues",
        "singleton": true
      }
    ],
    "commands": [
      {
        "id": "open-pull-requests",
        "title": "Open Pull Requests",
        "category": "GitHub"
      }
    ],
    "toolbar": [
      {
        "id": "open-prs",
        "label": "Pull Requests",
        "group": "views",
        "priority": 20
      }
    ]
  },
  "permissions": ["network"]
}
```

**Key decisions:**
- `apiVersion` is a simple major version string ("1"), not a semver range. The host checks `manifest.apiVersion === CURRENT_API_VERSION`.
- `main` points to the JS entry point (relative to extension directory). Loaded via dynamic `import()`.
- `contributes.blades[].type` becomes `ext:{id}:{type}` at registration time (e.g., `ext:github:pull-requests`).
- `contributes.commands[].id` becomes `ext:{id}:{commandId}` (e.g., `ext:github:open-pull-requests`).
- `contributes.commands[].category` is a free-form string that the extension controls (e.g., "GitHub").

### Pattern 2: ExtensionHost Lifecycle (Zustand Store)

**What:** The ExtensionHost is a singleton Zustand store that manages all extension lifecycles.
**When to use:** Created once at app startup, before extensions are loaded.

```typescript
// src/extensions/ExtensionHost.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { commands as tauriCommands } from "../bindings";
import { toast } from "../stores/toast";

export const CURRENT_API_VERSION = "1";

export type ExtensionStatus = "discovered" | "activating" | "active" | "error" | "deactivated";

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  status: ExtensionStatus;
  error?: string;
  manifest: ExtensionManifest;
}

interface ExtensionHostState {
  extensions: Map<string, ExtensionInfo>;
  discoverExtensions: () => Promise<void>;
  activateExtension: (id: string) => Promise<void>;
  deactivateExtension: (id: string) => Promise<void>;
  activateAll: () => Promise<void>;
}

export const useExtensionHost = create<ExtensionHostState>()(
  devtools(
    (set, get) => ({
      extensions: new Map(),

      discoverExtensions: async () => {
        // Call Rust command to scan .flowforge/extensions/*/flowforge.extension.json
        const manifests = await tauriCommands.discoverExtensions();
        const extensions = new Map<string, ExtensionInfo>();

        for (const manifest of manifests) {
          if (manifest.apiVersion !== CURRENT_API_VERSION) {
            extensions.set(manifest.id, {
              id: manifest.id,
              name: manifest.name,
              version: manifest.version,
              status: "error",
              error: `Incompatible API version: requires ${manifest.apiVersion}, app supports ${CURRENT_API_VERSION}`,
              manifest,
            });
            toast.error(
              `Extension "${manifest.name}" requires API v${manifest.apiVersion} (app supports v${CURRENT_API_VERSION})`
            );
            continue;
          }

          extensions.set(manifest.id, {
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            status: "discovered",
            manifest,
          });
        }

        set({ extensions: new Map(extensions) }, false, "extension-host/discover");
      },

      activateExtension: async (id) => {
        // ... load entry point, create ExtensionAPI, call onActivate
      },

      deactivateExtension: async (id) => {
        // ... call onDeactivate, clean up all tracked registrations
      },

      activateAll: async () => {
        const { extensions, activateExtension } = get();
        for (const [id, info] of extensions) {
          if (info.status === "discovered") {
            await activateExtension(id);
          }
        }
      },
    }),
    { name: "extension-host", enabled: import.meta.env.DEV },
  ),
);
```

### Pattern 3: Per-Extension API Facade with Registration Tracking

**What:** Each extension receives a unique `ExtensionAPI` instance that wraps registries and tracks all registrations.
**When to use:** Created per-extension at activation time.

```typescript
// src/extensions/ExtensionAPI.ts
import { registerBlade, unregisterBlade } from "../lib/bladeRegistry";
import { registerCommand, unregisterCommand } from "../lib/commandRegistry";
import { useToolbarRegistry } from "../lib/toolbarRegistry";

export class ExtensionAPI {
  private extensionId: string;
  private registeredBlades: string[] = [];
  private registeredCommands: string[] = [];
  private registeredToolbarActions: string[] = [];

  constructor(extensionId: string) {
    this.extensionId = extensionId;
  }

  registerBlade(config: ExtensionBladeConfig): void {
    const namespacedType = `ext:${this.extensionId}:${config.type}`;
    registerBlade({
      ...config,
      type: namespacedType,
      source: `ext:${this.extensionId}`,
    });
    this.registeredBlades.push(namespacedType);
  }

  registerCommand(config: ExtensionCommandConfig): void {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    registerCommand({
      ...config,
      id: namespacedId,
      category: config.category,
      source: `ext:${this.extensionId}`,
    });
    this.registeredCommands.push(namespacedId);
  }

  contributeToolbar(config: ExtensionToolbarConfig): void {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    useToolbarRegistry.getState().register({
      ...config,
      id: namespacedId,
      source: `ext:${this.extensionId}`,
    });
    this.registeredToolbarActions.push(namespacedId);
  }

  /** Called during deactivation -- removes ALL registrations atomically */
  cleanup(): void {
    for (const type of this.registeredBlades) {
      unregisterBlade(type);
    }
    for (const id of this.registeredCommands) {
      unregisterCommand(id);
    }
    useToolbarRegistry.getState().unregisterBySource(`ext:${this.extensionId}`);

    this.registeredBlades = [];
    this.registeredCommands = [];
    this.registeredToolbarActions = [];
  }
}
```

### Pattern 4: Extension Entry Point Contract

**What:** The JavaScript module that an extension exports.
**When to use:** Every extension's `main` file must export these functions.

```typescript
// Extension entry point (e.g., .flowforge/extensions/github/index.js)
export function onActivate(api: ExtensionAPI): void | Promise<void> {
  // Register blades, commands, toolbar actions
  api.registerBlade({
    type: "pull-requests",
    title: "Pull Requests",
    component: PullRequestsBlade,
    singleton: true,
  });

  api.registerCommand({
    id: "open-pull-requests",
    title: "Open Pull Requests",
    category: "GitHub",
    action: () => { /* ... */ },
  });
}

export function onDeactivate(): void | Promise<void> {
  // Optional: extension-specific cleanup beyond registry removal
}
```

### Pattern 5: BladeType Widening Strategy

**What:** The core challenge -- allowing dynamic extension blade types alongside compile-time core types.
**When to use:** When refactoring bladeTypes.ts and all consumers.

```typescript
// src/stores/bladeTypes.ts -- AFTER refactoring

// Core blade types remain a compile-time union for type-safe core code
export interface BladePropsMap {
  "staging-changes": Record<string, never>;
  "topology-graph": Record<string, never>;
  // ... all existing core blades
}

export type CoreBladeType = keyof BladePropsMap;

// Extension blade types are dynamic strings matching ext:{extId}:{name}
export type ExtensionBladeType = `ext:${string}:${string}`;

// The union used by the navigation machine and blade registry
export type BladeType = CoreBladeType | ExtensionBladeType;

// Extension blades always receive Record<string, unknown> props
export type BladeProps<T extends BladeType> = T extends CoreBladeType
  ? BladePropsMap[T]
  : Record<string, unknown>;
```

**Critical impact chain:**
1. `BladeType` widens from `keyof BladePropsMap` to `CoreBladeType | ExtensionBladeType`
2. `NavigationEvent.PUSH_BLADE` must accept the wider `BladeType`
3. `bladeRegistry` Map key changes from `BladeType` to `string` (it already is `Map<BladeType, ...>`)
4. `openBlade()` in bladeOpener and useBladeNavigation need string-accepting overloads
5. `BladeRenderer` already handles unknown blade types gracefully (shows "Unknown blade: {type}")

### Anti-Patterns to Avoid

- **Modifying BladePropsMap at runtime:** Never try to dynamically add keys to the interface. The compile-time map stays fixed for core blades. Extensions use the `ExtensionBladeType` path.
- **Global state for extension instances:** Each extension's `onActivate` module-level state should be scoped. Use the `ExtensionAPI.createStore()` method to create namespaced Zustand stores, not global `create()`.
- **Registering without the facade:** Extensions must NEVER import `registerBlade`/`registerCommand` directly. All registration goes through the ExtensionAPI facade so tracking is guaranteed.
- **Synchronous extension loading:** Always use async activation. Extensions may have async initialization (network, file system). Blocking the main thread during startup is unacceptable.
- **Hardcoded CATEGORY_ORDER in CommandPalette:** The current `CATEGORY_ORDER` array in `CommandPalette.tsx` is hardcoded. Extension categories must be appended dynamically after the core categories.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Manifest JSON parsing | Custom parser in TypeScript | serde_json in Rust via Tauri command | Rust-side parsing avoids giving frontend FS access; serde provides compile-time field validation |
| Extension directory scanning | Frontend fs.readdir | tokio::fs in Rust via Tauri command | No need for tauri-plugin-fs; Rust has full FS access already |
| Semver compatibility checking | Full semver parser | Simple string equality for v1.5 (apiVersion is just "1") | Full semver ranges are premature; the API surface will change significantly before v2.0 |
| Registration tracking | Manual bookkeeping in each registry | ExtensionAPI facade class with arrays | Centralizing tracking in the facade guarantees no orphaned registrations |
| Extension sandboxing/isolation | iframe or Worker isolation | Same-context with constrained API facade | v1.5 ships only first-party extensions; isolation adds massive complexity for no current benefit |

**Key insight:** The extension system for v1.5 is primarily an architectural pattern, not a security boundary. The GitHub extension is first-party code. The value is establishing the contracts and patterns so that Phase 36's extension manager UI and future third-party extensions have a solid foundation.

## Common Pitfalls

### Pitfall 1: BladeType Union Breakage
**What goes wrong:** Widening `BladeType` from a finite union to include template literal strings breaks exhaustive switch/case patterns and type narrowing throughout the codebase.
**Why it happens:** TypeScript exhaustive checks (e.g., `default: never` in switch statements) will fail when the type includes `string` variants.
**How to avoid:** Keep `CoreBladeType = keyof BladePropsMap` as the narrow type for core code paths (fileDispatch, rootBladeForProcess, SINGLETON_TYPES). Only use the wider `BladeType` in the registry, navigation machine, and renderer. Add explicit type guards: `function isCoreBladeType(t: BladeType): t is CoreBladeType`.
**Warning signs:** TypeScript errors mentioning "Type 'string' is not assignable to type 'never'" in switch defaults.

### Pitfall 2: Orphaned Registrations on Error
**What goes wrong:** If an extension's `onActivate` throws after some registrations but before others, partial registrations remain in the registries.
**Why it happens:** The facade has already pushed items to the registries before the error occurs.
**How to avoid:** The ExtensionAPI facade should wrap the entire `onActivate` call in a try-catch. If activation fails, immediately call `cleanup()` to reverse all registrations made so far, then set status to "error".
**Warning signs:** Commands or blades appearing from a failed extension; deactivation not removing all items.

### Pitfall 3: Dynamic Import Path Construction
**What goes wrong:** Vite's `import()` with dynamic string paths may not work as expected because Vite needs to know about modules at build time for code splitting.
**Why it happens:** Extensions are loaded from the filesystem at runtime, not from the bundled app. Vite cannot statically analyze dynamic import paths to external files.
**How to avoid:** For extensions loaded from the filesystem (not bundled), use `new Function` or `import(/* @vite-ignore */ url)` patterns. The extension entry point should be a pre-built JS file (not TypeScript, not JSX). Extensions are bundled separately (by the extension author), and the host loads the result.
**Warning signs:** Vite warnings about dynamic import paths; 404 errors when loading extension modules.

### Pitfall 4: Command Category Hardcoding
**What goes wrong:** The `CommandPalette.tsx` has a hardcoded `CATEGORY_ORDER` array. Extension categories (e.g., "GitHub") will not appear because they are not in the list.
**Why it happens:** The current design assumed all categories were known at compile time.
**How to avoid:** Modify the command palette to derive categories dynamically from registered commands. Known core categories get explicit ordering; unknown categories (from extensions) are appended alphabetically after core categories.
**Warning signs:** Extension commands registered but invisible in the command palette.

### Pitfall 5: HMR Interaction with Extension Registry
**What goes wrong:** The blade discovery module (`_discovery.ts`) uses `import.meta.hot.dispose` to clear the blade registry on HMR. This wipes extension-registered blades too.
**Why it happens:** `clearRegistry()` clears ALL registrations, including extension ones.
**How to avoid:** Modify `clearRegistry()` to only clear core registrations (types that don't start with `ext:`), or make the HMR dispose handler extension-aware. Alternatively, re-activate extensions after HMR re-registration.
**Warning signs:** Extension blades disappearing after saving a source file during development.

### Pitfall 6: Navigation Machine Type Constraints
**What goes wrong:** The `PUSH_BLADE` event in the navigation machine uses `bladeType: BladeType` which is constrained to `keyof BladePropsMap`. Extension blade types won't be assignable.
**Why it happens:** The XState machine types are set up with the narrow BladeType.
**How to avoid:** Widen the machine's event type to accept the broader `BladeType` (which now includes `ExtensionBladeType`). The `props` field for extension blades should accept `Record<string, unknown>`.
**Warning signs:** TypeScript error when calling `actorRef.send({ type: "PUSH_BLADE", bladeType: "ext:github:prs" })`.

## Code Examples

### Manifest Discovery (Rust Command)

```rust
// src-tauri/src/extensions/manifest.rs
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub api_version: String,
    pub main: String,
    pub contributes: Option<ExtensionContributes>,
    pub permissions: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct ExtensionContributes {
    pub blades: Option<Vec<ExtensionBladeContribution>>,
    pub commands: Option<Vec<ExtensionCommandContribution>>,
    pub toolbar: Option<Vec<ExtensionToolbarContribution>>,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct ExtensionBladeContribution {
    pub r#type: String,
    pub title: String,
    pub singleton: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct ExtensionCommandContribution {
    pub id: String,
    pub title: String,
    pub category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct ExtensionToolbarContribution {
    pub id: String,
    pub label: String,
    pub group: Option<String>,
    pub priority: Option<i32>,
}
```

```rust
// src-tauri/src/extensions/discovery.rs
use super::manifest::ExtensionManifest;
use std::path::PathBuf;

#[tauri::command]
#[specta::specta]
pub async fn discover_extensions(
    extensions_dir: String,
) -> Result<Vec<ExtensionManifest>, String> {
    let dir = PathBuf::from(&extensions_dir);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut manifests = Vec::new();
    let mut entries = tokio::fs::read_dir(&dir)
        .await
        .map_err(|e| format!("Failed to read extensions directory: {}", e))?;

    while let Some(entry) = entries.next_entry().await
        .map_err(|e| format!("Failed to read directory entry: {}", e))? {
        if !entry.file_type().await.map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
        }

        let manifest_path = entry.path().join("flowforge.extension.json");
        if !manifest_path.exists() {
            continue;
        }

        match tokio::fs::read_to_string(&manifest_path).await {
            Ok(content) => match serde_json::from_str::<ExtensionManifest>(&content) {
                Ok(manifest) => manifests.push(manifest),
                Err(e) => {
                    eprintln!("Invalid manifest in {:?}: {}", manifest_path, e);
                }
            },
            Err(e) => {
                eprintln!("Failed to read {:?}: {}", manifest_path, e);
            }
        }
    }

    Ok(manifests)
}
```

### BladeRegistry Refactoring (Adding unregisterBlade and source tracking)

```typescript
// src/lib/bladeRegistry.ts -- key changes

export interface BladeRegistration<TProps = Record<string, never>> {
  type: string;  // Changed from BladeType to string to accept extension types
  defaultTitle: string | ((props: TProps) => string);
  component: ComponentType<TProps> | LazyExoticComponent<ComponentType<TProps>>;
  lazy?: boolean;
  wrapInPanel?: boolean;
  showBack?: boolean;
  singleton?: boolean;
  renderTitleContent?: (props: TProps) => ReactNode;
  renderTrailing?: (props: TProps, ctx: BladeRenderContext) => ReactNode;
  source?: string; // "core" or "ext:{extensionId}"
}

const registry = new Map<string, BladeRegistration<any>>();

export function registerBlade<TProps>(config: BladeRegistration<TProps>): void {
  registry.set(config.type, config);
}

export function unregisterBlade(type: string): boolean {
  return registry.delete(type);
}

export function unregisterBySource(source: string): void {
  for (const [type, reg] of registry) {
    if (reg.source === source) {
      registry.delete(type);
    }
  }
}

/** Clear only core registrations. Extension registrations are preserved. */
export function clearCoreRegistry(): void {
  for (const [type, reg] of registry) {
    if (!type.startsWith("ext:")) {
      registry.delete(type);
    }
  }
}
```

### CommandRegistry Refactoring (Dynamic categories, unregister, source tracking)

```typescript
// src/lib/commandRegistry.ts -- key changes

// Widen CommandCategory from literal union to accept extension categories
export type CoreCommandCategory =
  | "Repository" | "Branches" | "Sync" | "Stash"
  | "Tags" | "Worktrees" | "Navigation" | "Settings";

export type CommandCategory = CoreCommandCategory | (string & {});

export interface Command {
  id: string;
  title: string;
  description?: string;
  category: CommandCategory;
  shortcut?: string;
  icon?: LucideIcon;
  action: () => void | Promise<void>;
  enabled?: () => boolean;
  keywords?: string[];
  source?: string; // "core" or "ext:{extensionId}"
}

const commands = new Map<string, Command>(); // Changed from array to Map for O(1) lookups

export function registerCommand(cmd: Command): void {
  commands.set(cmd.id, cmd);
}

export function unregisterCommand(id: string): boolean {
  return commands.delete(id);
}

export function unregisterCommandsBySource(source: string): void {
  for (const [id, cmd] of commands) {
    if (cmd.source === source) {
      commands.delete(id);
    }
  }
}

export function getCommands(): Command[] {
  return Array.from(commands.values());
}

/** Get ordered categories: core categories first (in canonical order), then extension categories alphabetically */
export function getOrderedCategories(): CommandCategory[] {
  const CORE_ORDER: CoreCommandCategory[] = [
    "Navigation", "Repository", "Sync", "Branches",
    "Stash", "Tags", "Worktrees", "Settings",
  ];
  const allCategories = new Set(
    Array.from(commands.values()).map((c) => c.category)
  );
  const extensionCategories = [...allCategories]
    .filter((c) => !CORE_ORDER.includes(c as CoreCommandCategory))
    .sort();
  return [...CORE_ORDER.filter((c) => allCategories.has(c)), ...extensionCategories];
}
```

### Extension Loading via Dynamic Import

```typescript
// Inside ExtensionHost.activateExtension()

async activateExtension(id: string) {
  const extensions = new Map(get().extensions);
  const info = extensions.get(id);
  if (!info || info.status !== "discovered") return;

  // Update status to activating
  extensions.set(id, { ...info, status: "activating" });
  set({ extensions }, false, "extension-host/activating");

  // Create the per-extension API facade
  const api = new ExtensionAPI(id);

  try {
    // Build the URL to the extension's entry point
    // Extensions are stored at: .flowforge/extensions/{id}/{main}
    const extensionBasePath = info.manifest._basePath; // Set during discovery
    const entryUrl = `${extensionBasePath}/${info.manifest.main}`;

    // Dynamic import (the @vite-ignore comment suppresses Vite warnings)
    const module = await import(/* @vite-ignore */ entryUrl);

    if (typeof module.onActivate !== "function") {
      throw new Error(`Extension "${id}" does not export onActivate()`);
    }

    await module.onActivate(api);

    // Store the api and module for later deactivation
    extensionApis.set(id, api);
    extensionModules.set(id, module);

    extensions.set(id, { ...info, status: "active", error: undefined });
    set({ extensions: new Map(extensions) }, false, "extension-host/activated");
  } catch (error) {
    // Cleanup any partial registrations
    api.cleanup();

    const errorMsg = error instanceof Error ? error.message : String(error);
    extensions.set(id, { ...info, status: "error", error: errorMsg });
    set({ extensions: new Map(extensions) }, false, "extension-host/error");
    toast.error(`Extension "${info.name}" failed to activate: ${errorMsg}`);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `BladeType = keyof BladePropsMap` (closed union) | `BladeType = CoreBladeType \| ExtensionBladeType` (open union) | Phase 33 | Core code keeps type safety via `CoreBladeType`; extension code uses the wider type |
| `CommandCategory` as string literal union | `CommandCategory = CoreCommandCategory \| (string & {})` | Phase 33 | Autocompletion still works for core categories; extensions can use any string |
| `commands: Command[]` (array with linear search) | `commands: Map<string, Command>` (O(1) lookups) | Phase 33 | Enables efficient unregisterCommand(); aligns with toolbarRegistry pattern |
| `clearRegistry()` wipes all blades | `clearCoreRegistry()` preserves extension blades during HMR | Phase 33 | Dev experience maintained without losing extension state |
| No `source` tracking in bladeRegistry/commandRegistry | `source` field on all registrations | Phase 33 | Enables `unregisterBySource()` for atomic cleanup |

**Deprecated/outdated after Phase 33:**
- The narrow `BladeType = keyof BladePropsMap` export (replaced by `CoreBladeType` for core code, `BladeType` for all code)
- The `CATEGORY_ORDER` hardcoded array in `CommandPalette.tsx` (replaced by `getOrderedCategories()`)
- `clearRegistry()` in bladeRegistry (renamed to `clearCoreRegistry()` with extension preservation)

## Refactoring Analysis (Expert Angle)

### Registry Refactoring Priority and Risk

| Registry | Current State | Extensibility Readiness | Refactoring Needed | Risk |
|----------|--------------|------------------------|-------------------|------|
| **toolbarRegistry** | Zustand store, Map backing, has `unregister`, `unregisterBySource`, `source` field | READY | None -- already designed for Phase 33 | LOW |
| **commandRegistry** | Module-level array, no unregister, hardcoded category union, no source tracking | NEEDS WORK | Convert array to Map, add unregister/unregisterBySource, widen category type, add source field | MEDIUM |
| **bladeRegistry** | Module-level Map, no unregister, typed to narrow `BladeType`, no source tracking | NEEDS WORK | Add unregister/unregisterBySource, widen type to string, add source field, update HMR | MEDIUM |
| **bladeTypes** | Closed interface, derived union type | NEEDS REFACTORING | Add ExtensionBladeType, create CoreBladeType alias, widen BladeType, update consumers | HIGH (widest impact) |
| **navigationMachine** | Uses narrow BladeType in events and context | NEEDS UPDATE | Accept wider BladeType, handle extension props as Record<string, unknown> | MEDIUM |
| **CommandPalette** | Hardcoded CATEGORY_ORDER | NEEDS UPDATE | Derive categories dynamically from registered commands | LOW |

### Files Requiring Changes (Impact Map)

**Direct changes (must modify):**
1. `src/stores/bladeTypes.ts` -- Add CoreBladeType, ExtensionBladeType, widen BladeType
2. `src/lib/bladeRegistry.ts` -- Add unregister, source tracking, clearCoreRegistry
3. `src/lib/commandRegistry.ts` -- Convert to Map, add unregister, source, widen category
4. `src/machines/navigation/types.ts` -- Accept wider BladeType and flexible props
5. `src/machines/navigation/navigationMachine.ts` -- Update SINGLETON_TYPES to support extension singletons
6. `src/blades/_discovery.ts` -- Use clearCoreRegistry instead of clearRegistry
7. `src/components/command-palette/CommandPalette.tsx` -- Dynamic category ordering

**Indirect changes (may need type updates):**
8. `src/lib/bladeOpener.ts` -- Overload for extension blade types
9. `src/hooks/useBladeNavigation.ts` -- Overload for extension blade types
10. `src/lib/fileDispatch.ts` -- No change needed (uses CoreBladeType)
11. `src/blades/_shared/BladeRenderer.tsx` -- Already handles unknown types; verify with extension types
12. `src/machines/navigation/context.tsx` -- No change (actor type flows from machine)

### Tailwind v4 Considerations for Extension UI

Extensions that contribute UI (blade components) need to work within the app's Tailwind v4 setup. Key considerations:

1. **Extension styles must use the existing Catppuccin theme tokens.** Extensions should use `text-ctp-text`, `bg-ctp-base`, etc. The Tailwind v4 `@theme` directive defines these tokens via CSS custom properties, so extension code can use them directly.

2. **Extensions cannot add new Tailwind classes at runtime.** Tailwind v4 uses the Oxide engine which processes CSS at build time. If an extension needs custom utility classes, it must either:
   - Use existing Tailwind classes (preferred)
   - Use inline styles with CSS custom properties
   - Ship a small CSS file that is injected via `<style>` tag

3. **No extension CSS isolation needed for v1.5.** Since the GitHub extension is first-party and uses the same design system, there are no style collision concerns. For v2.0 third-party extensions, CSS containment or shadow DOM would be appropriate.

4. **Class name safety:** Extensions should use the `cn()` utility from `src/lib/utils.ts` and avoid constructing dynamic class names (Tailwind v4 will not detect them).

## Open Questions

1. **Extension base path resolution for dynamic import()**
   - What we know: Extensions live at `.flowforge/extensions/{id}/`. Tauri's webview runs with `https://tauri.localhost` origin. Files outside the bundle cannot be imported directly via relative paths.
   - What's unclear: The exact mechanism to make `import()` load files from the filesystem. Options: (a) convertFileSrc() from Tauri to get an asset:// URL, (b) read the file content in Rust and eval() on frontend, (c) use Tauri's asset protocol with scoped access to the extensions directory.
   - Recommendation: Research during implementation. Option (c) -- asset protocol with scoped directory -- is the most likely correct approach. The `tauri.conf.json` already has `assetProtocol` configuration. Scoping it to `.flowforge/extensions/` is the secure approach.

2. **Extension store isolation**
   - What we know: Extensions may need their own Zustand stores (e.g., GitHub extension needs auth state, PR cache).
   - What's unclear: Should `ExtensionAPI.createStore()` create stores that participate in `resetAllStores()` (repo switch cleanup)?
   - Recommendation: Extension stores should NOT auto-register for reset. Extensions manage their own lifecycle. The `onDeactivate` hook handles cleanup.

3. **Extension hot-reload during development**
   - What we know: Vite HMR handles core code. Extensions loaded via dynamic import are outside Vite's module graph.
   - What's unclear: How to provide a good DX when developing an extension (e.g., the GitHub extension in Phase 34-36).
   - Recommendation: For v1.5, manual reload (deactivate + reactivate) is acceptable. Hot-reload for extensions is a v2.0 DX concern.

## Sources

### Primary (HIGH confidence)
- FlowForge codebase analysis: `src/lib/bladeRegistry.ts`, `src/lib/commandRegistry.ts`, `src/lib/toolbarRegistry.ts`, `src/stores/bladeTypes.ts`, `src/machines/navigation/navigationMachine.ts`, `src/blades/_discovery.ts`, `src/components/command-palette/CommandPalette.tsx`
- FlowForge `.planning/research/v1.5.0-STACK.md` -- Extension system stack decisions (no new dependencies)
- FlowForge `.planning/ROADMAP.md` -- Phase 33 requirements (EXT-01 through EXT-08)
- Phase 32 implementation: toolbarRegistry.ts already designed with extension support (source field, unregisterBySource, union type ToolbarGroup)

### Secondary (MEDIUM confidence)
- [VS Code Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest) -- Inspiration for manifest schema design, contributes pattern
- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points) -- Pattern for declarative contribution registration
- [VS Code Activation Events](https://code.visualstudio.com/api/references/activation-events) -- onActivate/onDeactivate lifecycle pattern
- [Tauri v2 Plugin Development](https://v2.tauri.app/develop/plugins/) -- Tauri plugin architecture (not directly used, but informs extension security model)
- [Tauri v2 File System](https://v2.tauri.app/plugin/file-system/) -- Reference for asset protocol and FS access patterns
- [Tailwind CSS v4 Custom Styles](https://tailwindcss.com/docs/adding-custom-styles) -- Guidance on extension CSS integration
- [semver npm package](https://www.npmjs.com/package/semver) -- Considered and rejected for v1.5 (simple string equality suffices)

### Tertiary (LOW confidence)
- [Tauri extensions discussion](https://github.com/tauri-apps/tauri/discussions/2685) -- Community patterns for loading addons in Tauri apps (no official pattern exists)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All required capabilities exist in current dependencies (verified against Cargo.toml and package.json). No new packages needed.
- Architecture: HIGH -- The patterns directly follow existing FlowForge conventions (registry pattern, Zustand stores, Tauri commands via specta). VS Code's extension model is a well-proven reference.
- Registry refactoring: HIGH -- All three registries examined in detail. toolbarRegistry is already ready. bladeRegistry and commandRegistry changes are straightforward (Map + source field + unregister methods).
- BladeType widening: MEDIUM -- The approach is sound (CoreBladeType + ExtensionBladeType union), but the exact impact on all 12+ consuming files needs validation during implementation. Type guards may need fine-tuning.
- Extension loading (dynamic import): MEDIUM -- The mechanism for loading JS files from the filesystem in Tauri's webview needs implementation-time validation. The asset protocol approach is the most likely solution.
- Pitfalls: HIGH -- Based on direct codebase analysis of hardcoded patterns (CATEGORY_ORDER, clearRegistry, SINGLETON_TYPES) that will break with extensions.

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain -- extension patterns are well-established)
