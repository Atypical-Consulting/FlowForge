# FlowForge Reusability Architecture Proposal

## Vision

Extract FlowForge's generic infrastructure into a **reusable application framework** ("FlowForge Core" / `@flowforge/core`) that enables building desktop productivity apps with the same layout, extension system, command palette, and state management patterns — without being coupled to Git.

**Target applications:** IDE-like tools, database clients, API explorers, note-taking apps, DevOps dashboards — any desktop app that benefits from panels, extensions, commands, and a plugin architecture.

---

## Current State: What We Have

| System | Total LOC | Reusable LOC | Score |
|--------|-----------|-------------|-------|
| Layout (panels, blades, sidebar, toolbar, menubar) | ~2,000 | ~1,700 | 85% |
| Command Palette + Hotkeys | ~700 | ~680 | 97% |
| Extension System (host, API, registries) | ~1,500 | ~1,350 | 90% |
| State Management (stores, persistence, event bus) | ~1,200 | ~900 | 75% |
| **Total** | **~5,400** | **~4,630** | **86%** |

FlowForge already has clean separation between infrastructure and domain logic. The main work is **formalizing boundaries**, not rewriting.

---

## Proposed Package Architecture

```
@flowforge/core                    # Meta-package (re-exports all below)
├── @flowforge/extension-system    # Extension host, API, lifecycle, registries
├── @flowforge/layout              # Panels, blades, sidebar, toolbar, menubar
├── @flowforge/command-palette     # Command registry, palette UI, hotkeys
├── @flowforge/stores              # Store utilities, persistence, event bus
└── @flowforge/theme               # Theme system, animations, CSS tokens

flowforge (app)                    # Git client consuming @flowforge/core
├── src/domain/                    # Git-specific stores, blades, commands
├── src/extensions/                # Git-specific extensions
└── src/app.tsx                    # App shell using @flowforge/core
```

### Why This Split?

- **`extension-system`**: The most valuable piece. Any app can have extensions.
- **`layout`**: Blade navigation + resizable panels + sidebar is a complete IDE shell.
- **`command-palette`**: Standalone value — many apps want Cmd+K.
- **`stores`**: Toast, persistence adapter, store registry, event bus are universal.
- **`theme`**: Catppuccin + animation system, but swappable.

---

## Package Details

### 1. `@flowforge/extension-system` (~500 LOC core)

**Extracts from:**
- `src/extensions/ExtensionHost.ts`
- `src/extensions/ExtensionAPI.ts`
- `src/extensions/extensionTypes.ts`
- `src/extensions/extensionEventBus.ts`
- `src/extensions/extensionSettings.ts`
- All 8 registries (blade, command, toolbar, context menu, sidebar, status bar, machine, viewer)

**Key abstractions:**

```typescript
// Generic registry factory — replaces 8 hand-written registries
function createRegistry<TItem extends RegistryItem>(
  name: string,
  options?: { sort?: (a: TItem, b: TItem) => number }
): Registry<TItem>

interface Registry<T> {
  register(item: T): void;
  unregister(id: string): void;
  unregisterBySource(source: string): void;
  getAll(): T[];
  useItems(): T[];  // React hook
}

// Generic extension API — apps plug in their extension points
interface ExtensionPoint<TConfig> {
  name: string;
  register(api: ExtensionAPI, config: TConfig): void;
  unregister(api: ExtensionAPI, id: string): void;
}

// App defines its extension points
const app = createExtensionHost({
  extensionPoints: [
    viewExtensionPoint,
    commandExtensionPoint,
    toolbarExtensionPoint,
    sidebarExtensionPoint,
    // App-specific:
    gitHookExtensionPoint,
  ],
  discoverers: [fileSystemDiscoverer],
});
```

**What changes from current code:**
- Replace hardcoded `onWillGit`/`onDidGit` with generic operation hooks
- Make extension point list configurable (not hardcoded in ExtensionAPI)
- Add `createRegistry()` factory to eliminate boilerplate
- Abstract discovery mechanism (pluggable discoverers)
- Add optional lazy activation events

### 2. `@flowforge/layout` (~1,700 LOC)

**Extracts from:**
- `src/core/components/layout/ResizablePanelLayout.tsx` (105 lines)
- `src/core/components/layout/SplitPaneLayout.tsx` (52 lines)
- `src/core/blades/_shared/` — BladeContainer, BladeRenderer, BladePanel, BladeStrip (248 lines)
- `src/core/lib/bladeRegistry.ts` (137 lines)
- `src/core/machines/navigation/navigationMachine.ts` (300 lines)
- `src/core/lib/sidebarPanelRegistry.ts` (94 lines)
- `src/core/components/toolbar/Toolbar.tsx` (132 lines)
- `src/core/components/menu-bar/MenuBar.tsx` (65 lines)
- `src/core/lib/layoutPresets.ts` (63 lines)
- `src/core/stores/domain/preferences/layout.slice.ts` (175 lines)
- `src/core/lib/animations.ts` (139 lines)

**Provides an AppShell component:**

```tsx
import { AppShell, BladeContainer, Sidebar, Toolbar, MenuBar } from '@flowforge/layout';

<AppShell
  header={
    <AppBar>
      <AppBar.Leading><MenuBar menus={appMenus} /></AppBar.Leading>
      <AppBar.Center><WorkflowTabs workflows={workflows} /></AppBar.Center>
      <AppBar.Trailing><Toolbar /></AppBar.Trailing>
    </AppBar>
  }
  sidebar={
    <Sidebar>
      <Sidebar.DynamicPanels />  {/* Extension-contributed panels */}
      <Sidebar.Footer>{/* App-specific footer */}</Sidebar.Footer>
    </Sidebar>
  }
  main={<BladeContainer />}
  statusBar={<StatusBar />}
  presets={layoutPresets}
/>
```

**What changes from current code:**
- Rename "process" → "workflow" (generic term)
- Make workflow tabs configurable (not hardcoded staging/topology)
- Extract sidebar sections from RepositoryView into slot-based composition
- Make layout preset definitions data-driven (app provides preset configs)
- Keep blade system as-is (it's already 100% generic)

### 3. `@flowforge/command-palette` (~680 LOC)

**Extracts from:**
- `src/core/lib/commandRegistry.ts` (178 lines)
- `src/core/lib/fuzzySearch.ts` (138 lines)
- `src/core/components/command-palette/CommandPalette.tsx` (249 lines)
- `src/core/components/command-palette/CommandPaletteItem.tsx` (76 lines)
- `src/core/stores/domain/ui-state/command-palette.slice.ts` (67 lines)
- Shortcut formatting from `useKeyboardShortcuts.ts`

**API:**

```typescript
import { CommandPalette, useCommandRegistry, useCommandShortcuts } from '@flowforge/command-palette';

// Register commands
const registry = useCommandRegistry();
registry.register({
  id: "open-file",
  title: "Open File",
  category: "File",
  shortcut: "mod+o",
  icon: FolderOpen,
  action: () => openFileDialog(),
});

// Render palette
<CommandPalette
  isOpen={isOpen}
  onClose={close}
  placeholder="Type a command..."
/>

// Bind all registered shortcuts
useCommandShortcuts();
```

**What changes from current code:**
- Remove hardcoded category list — make categories generic (string union)
- Theme via CSS custom properties instead of Catppuccin tokens
- Export fuzzy search as standalone utility
- Refactor useKeyboardShortcuts to be purely registry-driven

### 4. `@flowforge/stores` (~900 LOC)

**Extracts from:**
- `src/core/stores/registry.ts` — Store reset coordination
- `src/core/stores/createBladeStore.ts` — Blade store factory
- `src/core/stores/toast.ts` — Toast notification system
- `src/core/stores/domain/preferences/theme.slice.ts` — Theme preference (template)
- `src/core/stores/domain/preferences/layout.slice.ts` — Layout state (template)
- `src/core/stores/domain/ui-state/command-palette.slice.ts`
- `src/core/lib/store.ts` — Tauri persistence wrapper
- `src/core/lib/gitHookBus.ts` → genericized as OperationBus
- `src/core/lib/queryClient.ts`

**Key abstractions:**

```typescript
// Persistence adapter (swap between Tauri, localStorage, IndexedDB)
interface PersistenceAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  save(): Promise<void>;
}

// Tauri adapter (default)
const tauriAdapter = createTauriPersistence("app-settings.json");

// Generic operation bus (replaces gitHookBus)
const operationBus = createOperationBus<MyOperations>();
operationBus.onWill("save", async (ctx) => { /* validate */ });
operationBus.onDid("save", async (ctx) => { /* notify */ });
```

### 5. `@flowforge/theme` (~300 LOC)

**Extracts from:**
- `src/index.css` — Theme tokens + animations
- Theme slice logic
- `src/core/lib/animations.ts`

**Provides:**
- CSS custom property system for theming
- Catppuccin as default theme (swappable)
- Animation presets (respects `prefers-reduced-motion`)
- Theme provider component with system/light/dark switching

---

## Migration Strategy

### Phase 1: Internal Boundary (No Package Split Yet)

Reorganize `src/` into clear layers **within the existing monolith**:

```
src/
├── framework/              # <- NEW: Extracted generic infrastructure
│   ├── extension-system/   # ExtensionHost, API, registries (generic)
│   ├── layout/             # Blades, panels, sidebar, toolbar, menubar
│   ├── command-palette/    # Registry, UI, fuzzy search
│   ├── stores/             # Toast, persistence, event bus, store registry
│   └── theme/              # Tokens, animations, provider
├── domain/                 # <- RENAMED from parts of core/
│   ├── git-ops/            # Git stores, commands, types
│   ├── blades/             # Git-specific blade components
│   ├── components/         # Git-specific UI (BranchList, DiffView, etc.)
│   └── commands/           # Git-specific command registrations
├── extensions/             # (unchanged) Git-specific extensions
└── app.tsx                 # Shell wiring framework + domain
```

**Why internal first:**
- Zero risk — no package management complexity
- Validates boundaries before committing to packages
- Incremental — move files one system at a time
- Import paths reveal coupling issues immediately

### Phase 2: Extract to Workspace Packages

Once boundaries are proven, extract `src/framework/` into workspace packages:

```
packages/
├── core/                   # @flowforge/core (meta-package)
├── extension-system/       # @flowforge/extension-system
├── layout/                 # @flowforge/layout
├── command-palette/        # @flowforge/command-palette
├── stores/                 # @flowforge/stores
└── theme/                  # @flowforge/theme

apps/
└── flowforge/              # The Git client, consuming packages
```

Use pnpm workspaces or Turborepo for monorepo management.

### Phase 3: Publish & Prove with Second App

Build a second small app (e.g., a database client, API explorer) using `@flowforge/core` to validate the abstraction. This proves the framework works beyond Git.

---

## Concrete Phase 1 File Moves

### Step 1: Create `src/framework/` structure

```bash
mkdir -p src/framework/{extension-system,layout,command-palette,stores,theme}
```

### Step 2: Move pure infrastructure (zero coupling changes)

| From | To | LOC |
|------|----|-----|
| `src/core/lib/bladeRegistry.ts` | `src/framework/layout/bladeRegistry.ts` | 137 |
| `src/core/lib/sidebarPanelRegistry.ts` | `src/framework/layout/sidebarPanelRegistry.ts` | 94 |
| `src/core/lib/animations.ts` | `src/framework/theme/animations.ts` | 139 |
| `src/core/lib/layoutPresets.ts` | `src/framework/layout/layoutPresets.ts` | 63 |
| `src/core/lib/fuzzySearch.ts` | `src/framework/command-palette/fuzzySearch.ts` | 138 |
| `src/core/lib/commandRegistry.ts` | `src/framework/command-palette/commandRegistry.ts` | 178 |
| `src/core/components/command-palette/` | `src/framework/command-palette/components/` | 325 |
| `src/core/blades/_shared/BladeContainer.tsx` | `src/framework/layout/BladeContainer.tsx` | 67 |
| `src/core/blades/_shared/BladeRenderer.tsx` | `src/framework/layout/BladeRenderer.tsx` | 69 |
| `src/core/blades/_shared/BladePanel.tsx` | `src/framework/layout/BladePanel.tsx` | 78 |
| `src/core/blades/_shared/BladeStrip.tsx` | `src/framework/layout/BladeStrip.tsx` | 34 |
| `src/core/components/layout/ResizablePanelLayout.tsx` | `src/framework/layout/ResizablePanelLayout.tsx` | 105 |
| `src/core/components/layout/SplitPaneLayout.tsx` | `src/framework/layout/SplitPaneLayout.tsx` | 52 |
| `src/core/machines/navigation/` | `src/framework/layout/navigation/` | 300 |
| `src/core/stores/registry.ts` | `src/framework/stores/registry.ts` | ~30 |
| `src/core/stores/createBladeStore.ts` | `src/framework/stores/createBladeStore.ts` | ~50 |
| `src/core/stores/toast.ts` | `src/framework/stores/toast.ts` | ~80 |
| `src/core/lib/store.ts` | `src/framework/stores/persistence/tauri.ts` | ~30 |
| `src/extensions/ExtensionHost.ts` | `src/framework/extension-system/ExtensionHost.ts` | ~200 |
| `src/extensions/ExtensionAPI.ts` | `src/framework/extension-system/ExtensionAPI.ts` | ~210 |
| `src/extensions/extensionTypes.ts` | `src/framework/extension-system/types.ts` | ~100 |
| `src/extensions/extensionEventBus.ts` | `src/framework/extension-system/eventBus.ts` | ~50 |

### Step 3: Add barrel exports

Each `src/framework/*/index.ts` re-exports the public API. Domain code imports from `@/framework/*` instead of scattered `@/core/lib/*` paths.

### Step 4: Update imports across codebase

Use TypeScript path aliases:
```json
{
  "paths": {
    "@framework/*": ["./src/framework/*"],
    "@domain/*": ["./src/domain/*"]
  }
}
```

---

## Key Design Decisions

### 1. Monorepo with workspace packages (not separate repos)
- Easier to iterate, test, and version together
- pnpm workspaces or Turborepo

### 2. Peer dependencies for React ecosystem
- `react`, `zustand`, `xstate`, `framer-motion`, `react-hotkeys-hook` as peer deps
- Apps bring their own versions

### 3. CSS custom properties for theming (not Tailwind classes)
- Framework components use `var(--ff-surface)`, `var(--ff-text)`, etc.
- Apps map their theme tokens to these variables
- Catppuccin mapping provided as default

### 4. Generic registry factory
- Single `createRegistry<T>()` replaces 8 hand-written registries
- Reduces boilerplate from ~800 LOC to ~100 LOC
- Apps can create custom registries for domain-specific extension points

### 5. Pluggable persistence
- `PersistenceAdapter` interface abstracts storage
- Tauri Store adapter (default), localStorage adapter, IndexedDB adapter
- Apps inject their preferred adapter

### 6. Operation bus instead of Git hooks
- `createOperationBus<T>()` with generic operation types
- FlowForge defines Git operations; other apps define their own
- Same will/did pattern, same extension integration

---

## What NOT to Extract

These stay in FlowForge domain code:

- All Git operation stores (repository, branches, tags, stash, worktrees, gitflow, topology, clone, undo)
- Git-specific blades (DiffBlade, StagingChangesBlade, TopologyBlade, etc.)
- Git-specific components (BranchList, CommitForm, DiffView, etc.)
- Git-specific commands and toolbar actions
- Git-specific extensions (viewer-code is borderline — could be framework-level)
- Tauri backend commands (`src/bindings.ts`)
- Branch metadata, review checklist, diff preferences stores

---

## Success Criteria

1. **A new app can be created** using `@flowforge/core` that has:
   - Resizable panel layout with presets
   - Blade navigation with dirty state tracking
   - Command palette with fuzzy search
   - Extension system with sidebar, toolbar, and command contributions
   - Toast notifications
   - Theme switching (light/dark/system)
   - Keyboard shortcuts

2. **FlowForge continues working** with zero functional regressions after the extraction.

3. **No circular dependencies** between framework packages or between framework and domain.

4. **< 5% code duplication** between framework and domain layers.

---

## Estimated Effort

| Phase | Scope | Estimate |
|-------|-------|----------|
| Phase 1a | Create `src/framework/` structure + move pure infra files | Small |
| Phase 1b | Update all imports, add barrel exports, verify build | Medium |
| Phase 1c | Abstract git-specific hooks into generic patterns | Medium |
| Phase 2 | Extract to workspace packages with proper builds | Medium |
| Phase 3 | Build proof-of-concept second app | Large |

**Phase 1 is the critical path** — it validates boundaries with minimal risk. Phases 2-3 can be deferred until a second app is actually needed.

---

## Recommendation

**Start with Phase 1a immediately.** The codebase is already well-structured enough that the `src/framework/` reorganization is mostly file moves + import updates. The blade system, command palette, and extension system are all production-proven and near-zero coupling to Git domain logic.

The highest-value extraction targets (in order):
1. **Extension system** — most unique, hardest to rebuild, broadest applicability
2. **Command palette** — standalone value, could be published as OSS
3. **Layout/blade system** — complete IDE shell, significant competitive advantage
4. **Stores/persistence** — good patterns but less unique
5. **Theme** — nice-to-have, easy to swap
