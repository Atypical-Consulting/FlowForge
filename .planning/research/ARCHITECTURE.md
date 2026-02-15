# Architecture Patterns: Monorepo Extraction & Framework Packaging

**Domain:** Monorepo conversion for Tauri desktop app framework extraction
**Researched:** 2026-02-15

## Recommended Architecture

### Target Monorepo Structure

```
flowforge/                              # Root workspace
├── Cargo.toml                          # Cargo workspace (members: crates/*, apps/*/src-tauri)
├── package.json                        # pnpm workspace root
├── pnpm-workspace.yaml                 # workspace: ["packages/*", "apps/*"]
├── turbo.json                          # Turborepo task pipeline
├── tsconfig.base.json                  # Shared TS config (paths, compiler options)
│
├── packages/                           # Shared TypeScript packages
│   ├── core/                           # @flowforge/core — meta-package re-exporting all below
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts
│   ├── extension-system/               # @flowforge/extension-system
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/                        # ExtensionHost, ExtensionAPI, registries, buses
│   ├── layout/                         # @flowforge/layout
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/                        # Blades, panels, navigation machine, sidebar
│   ├── command-palette/                # @flowforge/command-palette
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/                        # Registry, UI, fuzzy search, shortcuts
│   ├── stores/                         # @flowforge/stores
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/                        # Toast, persistence adapters, blade store, registry
│   └── theme/                          # @flowforge/theme
│       ├── package.json
│       ├── tsconfig.json
│       └── src/                        # CSS tokens, animations, theme provider
│
├── crates/                             # Shared Rust crates (deferred)
│   └── flowforge-git/                  # Git domain operations (extracted from src-tauri)
│       ├── Cargo.toml
│       └── src/
│
├── apps/                               # Application shells
│   └── flowforge/                      # The Git client app
│       ├── package.json                # Depends on @flowforge/* packages
│       ├── tsconfig.json               # Extends tsconfig.base.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── src/
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── bindings.ts             # tauri-specta generated
│       │   ├── domain/                 # Git-specific stores, blades, commands
│       │   └── extensions/             # Git-specific extensions (22 built-in)
│       └── src-tauri/                  # Tauri shell for this app
│           ├── Cargo.toml              # Depends on flowforge-git crate
│           ├── tauri.conf.json
│           ├── src/
│           └── icons/
│
└── docs/                               # VitePress documentation (stays at root)
```

### Why This Structure

**Confidence: HIGH** (based on existing REUSABILITY-PROPOSAL.md analysis, current codebase inspection, Tauri monorepo community patterns)

1. **Phase 1 is already complete.** The `src/framework/` directory already exists with clean separation into `extension-system/`, `layout/`, `command-palette/`, `stores/`, `theme/`. The extraction to workspace packages is Phase 2 of the original REUSABILITY-PROPOSAL.md -- the hard boundary work is done.

2. **pnpm + Turborepo** is the right tooling choice (not Nx). Nx is overkill for 5-6 packages and adds a steep learning curve. Turborepo provides task caching and pipeline ordering with minimal configuration. pnpm workspaces handle package linking natively.

3. **Cargo workspace at root** allows shared Rust crates without restructuring Tauri's expectations. Tauri v2 is flexible about directory naming -- it only requires `tauri.conf.json` next to the app's `Cargo.toml`.

4. **No build step for internal packages** during development. Use TypeScript path aliases pointing to package source directories. Only build packages when publishing or for CI validation.

---

## Component Boundaries

### Package Dependency Graph

```
@flowforge/core (meta-package)
  ├── re-exports @flowforge/extension-system
  ├── re-exports @flowforge/layout
  ├── re-exports @flowforge/command-palette
  ├── re-exports @flowforge/stores
  └── re-exports @flowforge/theme

@flowforge/extension-system
  ├── depends on @flowforge/stores (createRegistry, toast)
  ├── depends on @flowforge/layout (bladeRegistry, sidebarPanelRegistry)
  └── depends on @flowforge/command-palette (commandRegistry)

@flowforge/layout
  ├── depends on @flowforge/stores (createRegistry, createBladeStore)
  └── depends on @flowforge/theme (animations)

@flowforge/command-palette
  └── depends on @flowforge/stores (createRegistry)

@flowforge/stores
  └── depends on nothing (leaf package)

@flowforge/theme
  └── depends on nothing (leaf package)
```

**Critical observation:** `extension-system` depends on both `layout` and `command-palette` because `ExtensionAPI` directly calls `registerBlade()`, `registerCommand()`, `useSidebarPanelRegistry`, etc. This is the tightest coupling point and it flows in ONE direction (extension-system depends on layout/command-palette, never the reverse). This is safe and intentional.

### Component Responsibilities

| Package | Responsibility | Key Exports | Communicates With |
|---------|---------------|-------------|-------------------|
| `@flowforge/stores` | State management primitives | `createRegistry`, `createBladeStore`, `toast`, `OperationBus`, `PersistenceAdapter` | None (leaf) |
| `@flowforge/theme` | Theming and animations | CSS tokens, `animations`, theme provider | None (leaf) |
| `@flowforge/command-palette` | Command registry and palette UI | `CommandPalette`, `registerCommand`, `fuzzySearch` | `stores` |
| `@flowforge/layout` | Blade navigation, panels, sidebar | `BladeRenderer`, `BladeContainer`, `navigationMachine`, `bladeRegistry`, `sidebarPanelRegistry`, `workflowRegistry` | `stores`, `theme` |
| `@flowforge/extension-system` | Extension lifecycle, API facade | `ExtensionHost`, `ExtensionAPI`, `configureExtensionHost` | `stores`, `layout`, `command-palette` |
| `@flowforge/core` | Convenience re-export | Everything above | All packages |

### Rust Crate Boundaries

| Crate | Responsibility | Dependencies |
|-------|---------------|-------------|
| `flowforge-git` (future) | Pure git2-rs operations, no Tauri coupling | `git2`, `serde`, `chrono`, `git-conventional` |
| `flowforge` (app crate) | Tauri commands, state management, file watcher | `tauri`, `tauri-specta`, `flowforge-git` |

---

## Integration Points (New vs Modified Code)

### New Code Required

| What | Where | Purpose |
|------|-------|---------|
| `pnpm-workspace.yaml` | Root | Define workspace packages and apps |
| `turbo.json` | Root | Build/test/lint pipeline with caching |
| `tsconfig.base.json` | Root | Shared compiler options, path aliases to package sources |
| `packages/*/package.json` | Each package | Package metadata, peer deps, exports field |
| `packages/*/tsconfig.json` | Each package | Extends base, may define project references |
| `packages/stores/src/persistence/adapter.ts` | stores package | `PersistenceAdapter` interface (abstracts Tauri away) |
| `packages/stores/src/persistence/memory.ts` | stores package | In-memory adapter for testing/non-Tauri apps |
| `apps/flowforge/src/persistence/tauri-adapter.ts` | App | Tauri persistence implementation (moved from framework) |

### Modified Code (Moved + Rewired)

| Current Location | New Location | Changes Required |
|-----------------|-------------|-----------------|
| `src/framework/extension-system/` | `packages/extension-system/src/` | Update import paths from `@/framework/` to `@flowforge/*` |
| `src/framework/layout/` | `packages/layout/src/` | Same |
| `src/framework/command-palette/` | `packages/command-palette/src/` | Same |
| `src/framework/stores/` | `packages/stores/src/` | Extract `persistence/tauri.ts` to app code, replace with adapter interface |
| `src/framework/theme/` | `packages/theme/src/` | Same |
| `src/framework/lib/utils.ts` | `packages/stores/src/utils.ts` or `packages/theme/src/utils.ts` | Evaluate placement (clsx/tailwind-merge utility) |
| `src/core/` | `apps/flowforge/src/domain/` | Update imports to use `@flowforge/*` packages |
| `src/extensions/` | `apps/flowforge/src/extensions/` | Update imports |
| `src/App.tsx` | `apps/flowforge/src/App.tsx` | Update imports |
| `src/main.tsx` | `apps/flowforge/src/main.tsx` | Add persistence adapter injection |
| `src/bindings.ts` | `apps/flowforge/src/bindings.ts` | No changes (app-specific, auto-generated) |
| `src/index.css` | `apps/flowforge/src/index.css` | No changes (app-specific theme) |
| `src-tauri/` | `apps/flowforge/src-tauri/` | Update Cargo workspace path |
| `Cargo.toml` (root) | Same | Update `members` to include `apps/flowforge/src-tauri` |

### Key Integration Points in Detail

#### 1. Persistence Adapter (Critical Coupling Break)

**Current state:** `src/framework/stores/persistence/tauri.ts` directly imports `@tauri-apps/plugin-store`. This couples the framework to Tauri.

**Required change:** Extract a `PersistenceAdapter` interface into `@flowforge/stores`. The Tauri implementation stays in the app:

```typescript
// packages/stores/src/persistence/adapter.ts (NEW)
export interface PersistenceAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  save(): Promise<void>;
}

let adapter: PersistenceAdapter | null = null;

export function configurePersistence(a: PersistenceAdapter): void {
  adapter = a;
}

export function getPersistence(): PersistenceAdapter {
  if (!adapter) throw new Error(
    "Persistence not configured. Call configurePersistence() at app init."
  );
  return adapter;
}

// apps/flowforge/src/persistence/tauri-adapter.ts (MOVED from framework)
import { Store } from "@tauri-apps/plugin-store";
import type { PersistenceAdapter } from "@flowforge/stores";

export function createTauriAdapter(filename: string): PersistenceAdapter {
  let store: Store | null = null;
  const getStore = async () => {
    if (!store) store = await Store.load(filename);
    return store;
  };
  return {
    get: async (key) => { const s = await getStore(); return s.get(key) ?? null; },
    set: async (key, value) => { const s = await getStore(); await s.set(key, value); },
    save: async () => { const s = await getStore(); await s.save(); },
  };
}
```

**Impact:** `ExtensionHost` (for `persistDisabledExtensions`/`loadDisabledExtensions`), `ExtensionSettings`, and all preference stores currently import `getStore()` from `@/framework/stores/persistence/tauri`. They must be changed to use `getPersistence()` from the adapter interface. This is the single most important coupling break.

#### 2. Module Augmentation for Blade Types

**Current state:** `src/core/stores/bladeTypes.ts` augments `@/framework/layout/bladeTypes` with app-specific blade types using TypeScript's `declare module` syntax. This is already a clean integration point.

**After extraction:** The augmentation target changes from `@/framework/layout/bladeTypes` to `@flowforge/layout/bladeTypes` (or wherever the `BladePropsMap` interface lives). The pattern remains identical:

```typescript
// apps/flowforge/src/domain/bladeTypes.ts
declare module "@flowforge/layout" {
  interface BladePropsMap {
    "staging-changes": Record<string, never>;
    "topology-graph": Record<string, never>;
    "commit-details": { oid: string };
    // ... all 18+ app-specific blade types
  }
}
```

**No structural change needed** -- TypeScript module augmentation works across package boundaries in a monorepo. The augmented interface is visible wherever the package is imported.

#### 3. Extension System DI (Already Partially Done)

**Current state:** `configureExtensionHost()` already accepts a `discoverExtensions` dependency. `ExtensionAPI.setOperationBus()` injects the git hook bus. These patterns survive extraction unchanged.

**Additional DI needed after extraction:**
- `ExtensionSettings` currently uses `getStore()` from Tauri persistence -- needs to use `getPersistence()` instead
- `ExtensionHost` persistence functions (`persistDisabledExtensions`, `loadDisabledExtensions`) -- same change

#### 4. `import.meta.env.DEV` References

**Current state:** Multiple files use `import.meta.env.DEV` for Zustand devtools enable/disable. This is Vite-specific.

**After extraction:** Package source is consumed directly via path aliases (not bundled separately). Vite processes it as part of the app build, so `import.meta.env.DEV` continues to work. **No change needed** for the source-level consumption strategy.

#### 5. Tauri-Specta Bindings

**Current state:** `src/bindings.ts` is auto-generated by tauri-specta. It stays entirely in the app.

**After extraction:** No change. The app imports `commands` from its own `bindings.ts`. Extensions that call Tauri commands import them from the app's bindings, not from framework packages. This is already the case -- extensions use relative imports to reach `../../core/stores/` for Tauri-backed stores.

#### 6. CSS Theme Tokens

**Current state:** `src/index.css` contains the Tailwind v4 `@theme {}` block with `--ctp-*` Catppuccin tokens. Framework layout components reference these tokens via Tailwind classes (`bg-ctp-base`, `text-ctp-text`).

**Integration decision:** For now, framework components keep using `--ctp-*` tokens. The app provides these tokens. This works because:
- Internal monorepo -- all apps use the same Catppuccin theme system
- No publishing to npm -- no need for theme-agnostic CSS vars yet
- Refactoring to semantic vars (`--ff-surface`, `--ff-text`) can happen later as a non-blocking enhancement

#### 7. Peer Dependencies for React Ecosystem

Framework packages declare these as `peerDependencies`:
- `react` (^19)
- `react-dom` (^19)
- `zustand` (^5)
- `xstate` (^5) -- only `@flowforge/layout` (navigation machine)
- `@xstate/react` (^6) -- only `@flowforge/layout`
- `framer-motion` (^12) -- only packages using animations
- `react-hotkeys-hook` (^5) -- only `@flowforge/command-palette`
- `lucide-react` -- used in ExtensionAPI types, command-palette
- `react-resizable-panels` (^4) -- only `@flowforge/layout`

The app's `package.json` provides concrete versions. This prevents duplicate React instances in the bundle.

---

## Data Flow Changes

### Current Data Flow

```
src/App.tsx
  └── imports from @/framework/* (direct file imports via Vite path alias)
  └── imports from @/core/* (direct file imports via Vite path alias)
  └── imports from @/extensions/* (direct file imports)
  └── Zustand stores are module-level singletons (created at import time)
  └── Tauri IPC via src/bindings.ts (tauri-specta generated)
  └── Persistence via getStore() (directly imports @tauri-apps/plugin-store)
```

### Post-Extraction Data Flow

```
apps/flowforge/src/App.tsx
  └── imports from @flowforge/* (via Vite aliases to package src/)
  └── imports from ./domain/* (app-specific code)
  └── imports from ./extensions/* (app-specific extensions)
  └── Zustand stores remain module-level singletons (no change)
  └── Tauri IPC via ./bindings.ts (unchanged)
  └── PersistenceAdapter injected at app startup via configurePersistence()
```

**The only meaningful data flow change is persistence injection.** Zustand stores, registries, the OperationBus, the EventBus, and the navigation machine all work identically as module-level singletons regardless of package boundaries.

---

## Patterns to Follow

### Pattern 1: Source-Level Package Consumption (No Build Step)

**What:** During development, apps consume package source directly through TypeScript path aliases. Packages have no build step.

**When:** Internal monorepo where all consumers use the same bundler (Vite).

**Why:** Eliminates build step complexity, provides instant HMR, no need for watch mode on packages.

**Configuration:**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "paths": {
      "@flowforge/core": ["./packages/core/src"],
      "@flowforge/core/*": ["./packages/core/src/*"],
      "@flowforge/extension-system": ["./packages/extension-system/src"],
      "@flowforge/extension-system/*": ["./packages/extension-system/src/*"],
      "@flowforge/layout": ["./packages/layout/src"],
      "@flowforge/layout/*": ["./packages/layout/src/*"],
      "@flowforge/command-palette": ["./packages/command-palette/src"],
      "@flowforge/command-palette/*": ["./packages/command-palette/src/*"],
      "@flowforge/stores": ["./packages/stores/src"],
      "@flowforge/stores/*": ["./packages/stores/src/*"],
      "@flowforge/theme": ["./packages/theme/src"],
      "@flowforge/theme/*": ["./packages/theme/src/*"]
    }
  }
}
```

```typescript
// apps/flowforge/vite.config.ts
import { resolve } from "path";

const root = resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@flowforge/core": resolve(root, "packages/core/src"),
      "@flowforge/extension-system": resolve(root, "packages/extension-system/src"),
      "@flowforge/layout": resolve(root, "packages/layout/src"),
      "@flowforge/command-palette": resolve(root, "packages/command-palette/src"),
      "@flowforge/stores": resolve(root, "packages/stores/src"),
      "@flowforge/theme": resolve(root, "packages/theme/src"),
      // App-local alias
      "@": resolve(__dirname, "src"),
    },
  },
});
```

### Pattern 2: Dependency Injection for Platform Coupling

**What:** Any framework code that touches platform APIs (Tauri, filesystem, OS) receives its implementation via DI setter.

**When:** Always, for any platform-specific behavior in framework packages.

**Why:** Allows framework packages to work in non-Tauri environments (browser tests, Electron, etc.).

**Current DI patterns already in the codebase:**
- `configureExtensionHost({ discoverExtensions })` -- injects Tauri discovery
- `ExtensionAPI.setOperationBus(gitHookBus)` -- injects the git operation bus

**New DI patterns needed:**
- `configurePersistence(adapter)` -- injects storage backend
- `convertFileSrc` in ExtensionHost (used for loading external extension JS) -- can be injected as part of `configureExtensionHost`

### Pattern 3: Registry-Based Extension Points

**What:** All extension contribution points use the `createRegistry()` factory from `@flowforge/stores`.

**Current registries (already using createRegistry):**
- `bladeRegistry` (layout)
- `sidebarPanelRegistry` (layout)
- `commandRegistry` (command-palette)
- `toolbarRegistry` (extension-system)
- `contextMenuRegistry` (extension-system)
- `statusBarRegistry` (extension-system)
- `machineRegistry` (extension-system)

**Why this pattern works for extraction:** Each registry is a Zustand store created by the same factory. They can live in different packages as long as the factory (`createRegistry`) is importable.

### Pattern 4: Module Augmentation for Type Extension

**What:** Apps extend framework types via TypeScript `declare module` without modifying framework source.

**When:** For any type that needs app-specific entries (blade types, command categories, extension points).

**Why:** Already proven in the codebase. `BladePropsMap` is empty in the framework and augmented by the app.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Building Packages as Separate Bundles

**What:** Creating separate Vite/Rollup/esbuild builds for each package, producing `dist/` with JS files.

**Why bad:** Adds build complexity, slower iteration, potential duplicate React instances, CSS extraction headaches with Tailwind v4. Internal packages that are never published to npm do not need to be bundled.

**Instead:** Use source-level consumption via path aliases. Only add a build step if/when packages are published publicly.

### Anti-Pattern 2: Circular Dependencies Between Packages

**What:** `extension-system` imports from `layout`, and `layout` imports from `extension-system`.

**Why bad:** Breaks build ordering, causes subtle import-time bugs, makes packages impossible to extract independently.

**Current risk:** `ExtensionAPI.ts` directly imports `registerBlade` from layout and `registerCommand` from command-palette. These are one-directional and safe. The reverse direction must **never** exist.

**Prevention rule:** `layout` and `command-palette` must never import from `extension-system`. If layout needs extension awareness (e.g., `source` field on `BladeRegistration`), it defines the interface and extension-system implements it. This is already the case -- `RegistryItem.source` is defined in `stores`, not in `extension-system`.

### Anti-Pattern 3: Moving Tauri Dependencies into Framework Packages

**What:** Having `@tauri-apps/*` as a dependency of any `@flowforge/*` package.

**Why bad:** Couples the framework to Tauri. A browser-based or Electron app cannot use the framework.

**Instead:** All Tauri imports stay in app code. Framework receives platform capabilities via DI adapters.

### Anti-Pattern 4: Premature Abstraction of Theme Tokens

**What:** Replacing all `--ctp-*` tokens with semantic `--ff-*` tokens before the extraction is complete.

**Why bad:** Adds a large refactoring step that blocks extraction progress. Semantic tokens are a nice-to-have, not a prerequisite.

**Instead:** Extract first with Catppuccin tokens intact. Refactor to semantic tokens as a follow-up enhancement.

### Anti-Pattern 5: Publishing Packages to npm Before a Second App Exists

**What:** Setting up npm publishing, semantic versioning, changesets, etc. before proving the framework works for another app.

**Why bad:** Premature infrastructure. Publishing adds maintenance overhead (changelogs, version bumps, breaking change policies) without providing value until external consumers exist.

**Instead:** Keep everything as internal workspace packages. When (and if) a second team needs the packages, add publishing then.

---

## Suggested Build Order for Extraction

The extraction should happen in dependency order (leaves first). Each phase should leave the app fully functional and passing all tests.

### Phase 1: Workspace Scaffolding (Foundation)

**What:** Create monorepo infrastructure without moving any code yet.

1. Initialize pnpm workspace (`pnpm-workspace.yaml` defining `packages/*` and `apps/*`)
2. Create `turbo.json` with build/test/lint/typecheck pipeline
3. Create `tsconfig.base.json` with shared compiler options
4. Create empty package directories with `package.json` files (name, version, main, types, peerDependencies)
5. Create `apps/flowforge/` with its own `package.json` depending on `@flowforge/*`
6. Configure Vite aliases in `apps/flowforge/vite.config.ts`
7. Update root `Cargo.toml` workspace members for new app location
8. Verify existing app still builds and tests pass from new location

**Dependencies:** None
**Risk:** Low -- structural changes only, no code moves
**Validation:** `pnpm install && pnpm turbo build` succeeds; `pnpm turbo test` passes all 295 tests

### Phase 2: Leaf Packages (`stores` + `theme`)

**What:** Move the two packages with zero internal dependencies.

1. Move `src/framework/stores/*.ts` to `packages/stores/src/`
2. Move `src/framework/theme/*.ts` to `packages/theme/src/`
3. Extract `PersistenceAdapter` interface into `packages/stores/src/persistence/`
4. Create `createTauriAdapter()` in app code
5. Add `configurePersistence()` call in `apps/flowforge/src/main.tsx`
6. Update all `getStore()` calls in framework code to use `getPersistence()`
7. Update all imports throughout `src/framework/` and `src/core/` to use `@flowforge/stores` and `@flowforge/theme`
8. Verify build and tests pass

**Dependencies:** Phase 1
**Risk:** MEDIUM -- persistence adapter extraction requires careful DI wiring. Every store that persists data must be updated.

### Phase 3: Middle Packages (`command-palette` + `layout`)

**What:** Extract packages that depend on `stores` and `theme`.

1. Move `src/framework/command-palette/` to `packages/command-palette/src/`
2. Move `src/framework/layout/` to `packages/layout/src/`
3. Update all internal imports to use `@flowforge/stores`, `@flowforge/theme`
4. Update all consumer imports in `src/core/` and `src/extensions/` to use `@flowforge/layout` and `@flowforge/command-palette`
5. Verify build and tests pass (navigation machine tests, registry tests)

**Dependencies:** Phase 2 (both packages import from `stores`)
**Risk:** MEDIUM -- `layout` is the largest single piece (~50 files). The XState navigation machine tests must pass.

### Phase 4: Top Package (`extension-system` + `core`)

**What:** Extract the package that depends on everything else.

1. Move `src/framework/extension-system/` to `packages/extension-system/src/`
2. Update imports in `ExtensionAPI.ts` to use `@flowforge/layout`, `@flowforge/command-palette`, `@flowforge/stores`
3. Update `configureExtensionHost` to also accept `convertFileSrc` via DI (currently imports from `@tauri-apps/api/core`)
4. Create `packages/core/src/index.ts` that re-exports all packages
5. Delete `src/framework/` (now empty)
6. Verify build and tests pass

**Dependencies:** Phase 3
**Risk:** LOW -- mostly import path changes, since `extension-system` already uses the DI pattern

### Phase 5: App Relocation

**What:** Move app code from `src/` to `apps/flowforge/src/`.

1. Move `src/core/` to `apps/flowforge/src/domain/`
2. Move `src/extensions/` to `apps/flowforge/src/extensions/`
3. Move `src/App.tsx`, `src/main.tsx`, `src/bindings.ts`, `src/index.css`, `src/vite-env.d.ts` to `apps/flowforge/src/`
4. Move `src-tauri/` to `apps/flowforge/src-tauri/`
5. Move `index.html` to `apps/flowforge/`
6. Move `vite.config.ts`, `vitest.config.ts`, `biome.json` to `apps/flowforge/`
7. Update `tauri.conf.json` paths (devUrl, beforeDevCommand, beforeBuildCommand)
8. Update Cargo workspace to point to `apps/flowforge/src-tauri`
9. Update all remaining `@/core/` and `@/extensions/` import aliases to relative or app-local `@/domain/` aliases
10. Verify FULL build chain: TypeScript + Rust + Tauri + tests

**Dependencies:** Phase 4
**Risk:** HIGH -- largest number of file moves, config changes, and path updates. Most breakage-prone phase. Should be done as a single atomic step with immediate verification.

### Phase 6: Rust Crate Extraction (Deferred)

**What:** Extract `flowforge-git` crate from `apps/flowforge/src-tauri/src/git/`.

1. Create `crates/flowforge-git/` with pure git2-rs operations (no Tauri state, no `#[tauri::command]`)
2. Keep Tauri command wrappers in `apps/flowforge/src-tauri/src/`
3. Update `Cargo.toml` dependencies

**Dependencies:** Phase 5
**Risk:** LOW -- Rust crate extraction is straightforward with Cargo workspaces
**Defer rationale:** Only relevant when a second Tauri app needs git operations. For a non-git second app, skip entirely.

---

## File Mapping: Current to Target

This table provides the complete mapping for every `src/framework/` directory:

| Current | Target Package | Notes |
|---------|---------------|-------|
| `src/framework/stores/createRegistry.ts` | `packages/stores/src/createRegistry.ts` | Foundation for all registries |
| `src/framework/stores/createBladeStore.ts` | `packages/stores/src/createBladeStore.ts` | Blade-scoped Zustand factory |
| `src/framework/stores/registry.ts` | `packages/stores/src/registry.ts` | Store reset coordination |
| `src/framework/stores/toast.ts` | `packages/stores/src/toast.ts` | Toast notification system |
| `src/framework/stores/persistence/tauri.ts` | `apps/flowforge/src/persistence/tauri-adapter.ts` | **Moved to app** (platform-specific) |
| `src/framework/stores/persistence/index.ts` | `packages/stores/src/persistence/index.ts` | Adapter interface + configure/get |
| `src/framework/theme/animations.ts` | `packages/theme/src/animations.ts` | Motion presets |
| `src/framework/theme/index.ts` | `packages/theme/src/index.ts` | Theme exports |
| `src/framework/command-palette/*` | `packages/command-palette/src/*` | All 8 files move as-is |
| `src/framework/layout/*` | `packages/layout/src/*` | All ~20 files move as-is |
| `src/framework/layout/navigation/*` | `packages/layout/src/navigation/*` | XState machine + context + guards |
| `src/framework/extension-system/*` | `packages/extension-system/src/*` | All ~12 files move |
| `src/framework/lib/utils.ts` | `packages/theme/src/utils.ts` | `cn()` utility (clsx + tailwind-merge) |

---

## Scalability Considerations

| Concern | Current (1 app) | 2 Apps | 5+ Apps |
|---------|-----------------|--------|---------|
| Build time | ~30s full | ~45s (Turborepo caches shared packages) | Turborepo parallelizes, <60s |
| Dependency conflicts | N/A | pnpm strict mode prevents phantom deps | Peer deps enforce alignment |
| Type safety across packages | Path aliases (instant) | Same, add `tsc --build` for CI | TypeScript project references |
| Extension compatibility | N/A | Shared ExtensionAPI contract | Version via `apiVersion` field (already exists) |
| CSS conflicts | N/A | Semantic CSS vars per app (enhancement) | Theme package provides base, apps customize |
| Tauri config | N/A | Each app has own `tauri.conf.json` + icons | Shared Cargo workspace, separate app crates |

---

## Sources

- [Tauri v2 monorepo discussion (GitHub #13941)](https://github.com/orgs/tauri-apps/discussions/13941) - MEDIUM confidence (community patterns, not official guide)
- [Turborepo + pnpm monorepo configuration (Nhost)](https://nhost.io/blog/how-we-configured-pnpm-and-turborepo-for-our-monorepo) - MEDIUM confidence
- [Vite TypeScript monorepo RFC](https://github.com/vitejs/vite-ts-monorepo-rfc) - HIGH confidence (official Vite RFC)
- [Monorepo architecture guide 2025](https://feature-sliced.design/blog/frontend-monorepo-explained) - MEDIUM confidence (general best practices)
- [Live types in TypeScript monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo) - MEDIUM confidence (path alias strategy)
- FlowForge `REUSABILITY-PROPOSAL.md` - HIGH confidence (first-party analysis, already validated by Phase 1 completion)
- Direct codebase analysis of FlowForge `src/framework/` - HIGH confidence (46,958 LOC TS + 13,059 Rust inspected)
