# Requirements: FlowForge v1.9.0 — Architecture Extraction & Monorepo

**Defined:** 2026-02-15
**Core Value:** The intelligence is in the agent; the authority is in the infrastructure.

## v1.9.0 Requirements

Requirements for v1.9.0 milestone. Each maps to roadmap phases.

### Monorepo Infrastructure (MONO)

- [ ] **MONO-01**: Project uses pnpm workspaces with `pnpm-workspace.yaml` defining apps/ and packages/ directories
- [ ] **MONO-02**: Turborepo configured with pipeline for build, typecheck, test, and lint tasks
- [ ] **MONO-03**: Shared TypeScript config package (`@flowforge/tsconfig`) provides base, React, and node configs
- [ ] **MONO-04**: Shared Biome config package (`@flowforge/biome-config`) provides unified linting/formatting rules
- [ ] **MONO-05**: FlowForge app relocated to `apps/flowforge/` with all existing functionality intact
- [ ] **MONO-06**: All 295+ existing tests pass after workspace restructuring
- [ ] **MONO-07**: Tauri build (`pnpm tauri build`) succeeds from workspace root
- [ ] **MONO-08**: Vitest workspace config enables running tests across all packages from root

### Pre-Extraction Refactoring (REFAC)

- [ ] **REFAC-01**: Zero circular dependencies between framework, core, and extensions layers (verified by tooling)
- [ ] **REFAC-02**: All cross-layer imports use `@flowforge/*` package-name paths instead of `@/` aliases
- [ ] **REFAC-03**: UI primitives (Button, Dialog, etc.) used by framework relocated from core to framework layer
- [ ] **REFAC-04**: Shared types used across layers (DiffSource, etc.) extracted to appropriate ownership layer
- [ ] **REFAC-05**: Module augmentation for blade types works with package-name imports
- [ ] **REFAC-06**: All existing tests pass after path alias migration with no regressions

### Stores Package (STOR)

- [ ] **STOR-01**: `@flowforge/stores` package exports `createRegistry` factory for typed Zustand registries
- [ ] **STOR-02**: `@flowforge/stores` exports `createBladeStore` factory for blade-specific state
- [ ] **STOR-03**: `@flowforge/stores` exports `PersistenceAdapter` interface decoupled from Tauri
- [ ] **STOR-04**: `@flowforge/stores` exports `OperationBus` for cross-store communication
- [ ] **STOR-05**: `@flowforge/stores` exports toast notification system
- [ ] **STOR-06**: `@flowforge/stores` exports store registry with reset capability
- [ ] **STOR-07**: Tauri persistence adapter (`createTauriAdapter()`) lives in app code, injected at startup via `configurePersistence()`
- [ ] **STOR-08**: Zustand declared as peerDependency — single instance verified across packages

### Theme Package (THEME)

- [ ] **THEME-01**: `@flowforge/theme` package exports CSS custom properties (Catppuccin tokens)
- [ ] **THEME-02**: `@flowforge/theme` exports animation keyframes and `--animate-*` theme variables
- [ ] **THEME-03**: `@flowforge/theme` exports `cn()` utility (clsx + tailwind-merge)
- [ ] **THEME-04**: `@flowforge/theme` exports ThemeProvider component with dark/light mode toggle
- [ ] **THEME-05**: Tailwind v4 `@source` directive in app CSS correctly scans package component files
- [ ] **THEME-06**: All themed components render correctly when imported from packages (no unstyled flash)

### Command Palette Package (CMD)

- [ ] **CMD-01**: `@flowforge/command-palette` package exports command registry with register/unregister API
- [ ] **CMD-02**: `@flowforge/command-palette` exports CommandPalette UI component with fuzzy search
- [ ] **CMD-03**: `@flowforge/command-palette` exports keyboard shortcut binding system
- [ ] **CMD-04**: Command palette depends only on `@flowforge/stores` (no circular deps)

### Layout Package (LAYOUT)

- [ ] **LAYOUT-01**: `@flowforge/layout` package exports blade navigation system with XState FSM
- [ ] **LAYOUT-02**: `@flowforge/layout` exports blade registry with push/pop/replace/reset operations
- [ ] **LAYOUT-03**: `@flowforge/layout` exports sidebar panel registry and sidebar component
- [ ] **LAYOUT-04**: `@flowforge/layout` exports workflow registry with configurable workspace presets
- [ ] **LAYOUT-05**: `@flowforge/layout` exports navigation guard system (unsaved changes protection)
- [ ] **LAYOUT-06**: `@flowforge/layout` exports resizable panel layout components
- [ ] **LAYOUT-07**: TypeScript module augmentation for blade type definitions works across package boundaries
- [ ] **LAYOUT-08**: XState navigation FSM maintains all existing state transitions and guards

### Extension System Package (EXT)

- [ ] **EXT-01**: `@flowforge/extension-system` package exports ExtensionHost with lifecycle management
- [ ] **EXT-02**: `@flowforge/extension-system` exports ExtensionAPI facade for extension authors
- [ ] **EXT-03**: `@flowforge/extension-system` exports toolbar registry with overflow menu
- [ ] **EXT-04**: `@flowforge/extension-system` exports context menu registry
- [ ] **EXT-05**: `@flowforge/extension-system` exports status bar registry
- [ ] **EXT-06**: `@flowforge/extension-system` exports extension manifest system with validation
- [ ] **EXT-07**: `@flowforge/extension-system` exports event bus for extension communication
- [ ] **EXT-08**: ExtensionHost accepts dependency injection for platform-specific APIs (convertFileSrc, etc.)
- [ ] **EXT-09**: All 3 previously unclassified sandbox methods classified with proper API surface
- [ ] **EXT-10**: All 15 built-in FlowForge extensions activate and function correctly from packages

### Core Meta-Package (CORE)

- [ ] **CORE-01**: `@flowforge/core` meta-package re-exports all framework packages via single import
- [ ] **CORE-02**: `@flowforge/core` provides `createApp()` bootstrap function reducing App.tsx boilerplate
- [ ] **CORE-03**: Tree-shaking works — importing single sub-package doesn't bundle everything

### App Skeleton (SKEL)

- [ ] **SKEL-01**: `apps/skeleton/` contains minimal Tauri app importing `@flowforge/core`
- [ ] **SKEL-02**: Skeleton app renders at least 1 blade type with navigation
- [ ] **SKEL-03**: Skeleton app initializes ExtensionHost and activates at least 1 sample extension
- [ ] **SKEL-04**: Skeleton app uses `createApp()` bootstrap with custom persistence adapter
- [ ] **SKEL-05**: Skeleton app builds successfully with `pnpm tauri build`

### Test Infrastructure (TEST)

- [ ] **TEST-01**: `@flowforge/test-utils` package provides Zustand auto-reset mock for all packages
- [ ] **TEST-02**: `@flowforge/test-utils` provides Tauri API mocks (invoke, event, plugin-store)
- [ ] **TEST-03**: `@flowforge/test-utils` provides ResizeObserver polyfill and common setup
- [ ] **TEST-04**: Each extracted package has its own vitest.config.ts using shared test-utils
- [ ] **TEST-05**: All 295+ existing tests pass in new package structure
- [ ] **TEST-06**: `pnpm test` from workspace root runs all package and app tests

### Tech Debt (DEBT)

- [ ] **DEBT-01**: CC blade accessibility polish — aria-live debounce, amend mode styling, aria-labels
- [ ] **DEBT-02**: Init Repo blade UX refinements — focus behavior, listbox pattern, aria-describedby
- [ ] **DEBT-03**: Extension API gap closure — all sandbox methods classified and documented
- [ ] **DEBT-04**: `src/framework/` directory fully deleted — all framework code lives in packages

## v2.0 Requirements (Deferred)

### MCP Integration

- **MCP-01**: MCP server exposing repository state as structured resources
- **MCP-02**: MCP Git operations as tools with policy enforcement
- **MCP-03**: Tiered autonomy model for agent operations

### Framework Enhancements

- **FWK-01**: `create-flowforge-app` CLI scaffolding tool
- **FWK-02**: Extension sandbox with Web Worker isolation
- **FWK-03**: npm publishing pipeline for framework packages
- **FWK-04**: Semantic CSS token abstraction (`--ff-*` replacing `--ctp-*`)
- **FWK-05**: Framework DevTools panel (registry inspector, XState visualizer)
- **FWK-06**: Type-safe extension contribution points with schema validation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-framework support (Vue/Svelte) | Framework is deeply React-specific; no benefit without external demand |
| npm publishing | Internal monorepo only; semver/changelog overhead without value until external consumers |
| Rust crate extraction | Only needed if second app shares git operations; defer until concrete need |
| Changesets / Lerna | Solves npm publishing problems FlowForge doesn't have |
| Extension sandbox (production) | Prototype exists; production isolation is separate milestone |
| Interactive rebase drag-and-drop | Valuable polish, not core differentiator, v3 |
| Embedded LLM for semantic analysis | Rule-based heuristics sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MONO-01 | Phase 54 | Pending |
| MONO-02 | Phase 54 | Pending |
| MONO-03 | Phase 54 | Pending |
| MONO-04 | Phase 54 | Pending |
| MONO-05 | Phase 54 | Pending |
| MONO-06 | Phase 54 | Pending |
| MONO-07 | Phase 54 | Pending |
| MONO-08 | Phase 54 | Pending |
| REFAC-01 | Phase 55 | Pending |
| REFAC-02 | Phase 55 | Pending |
| REFAC-03 | Phase 55 | Pending |
| REFAC-04 | Phase 55 | Pending |
| REFAC-05 | Phase 55 | Pending |
| REFAC-06 | Phase 55 | Pending |
| STOR-01 | Phase 56 | Pending |
| STOR-02 | Phase 56 | Pending |
| STOR-03 | Phase 56 | Pending |
| STOR-04 | Phase 56 | Pending |
| STOR-05 | Phase 56 | Pending |
| STOR-06 | Phase 56 | Pending |
| STOR-07 | Phase 56 | Pending |
| STOR-08 | Phase 56 | Pending |
| THEME-01 | Phase 56 | Pending |
| THEME-02 | Phase 56 | Pending |
| THEME-03 | Phase 56 | Pending |
| THEME-04 | Phase 56 | Pending |
| THEME-05 | Phase 56 | Pending |
| THEME-06 | Phase 56 | Pending |
| CMD-01 | Phase 57 | Pending |
| CMD-02 | Phase 57 | Pending |
| CMD-03 | Phase 57 | Pending |
| CMD-04 | Phase 57 | Pending |
| LAYOUT-01 | Phase 57 | Pending |
| LAYOUT-02 | Phase 57 | Pending |
| LAYOUT-03 | Phase 57 | Pending |
| LAYOUT-04 | Phase 57 | Pending |
| LAYOUT-05 | Phase 57 | Pending |
| LAYOUT-06 | Phase 57 | Pending |
| LAYOUT-07 | Phase 57 | Pending |
| LAYOUT-08 | Phase 57 | Pending |
| EXT-01 | Phase 58 | Pending |
| EXT-02 | Phase 58 | Pending |
| EXT-03 | Phase 58 | Pending |
| EXT-04 | Phase 58 | Pending |
| EXT-05 | Phase 58 | Pending |
| EXT-06 | Phase 58 | Pending |
| EXT-07 | Phase 58 | Pending |
| EXT-08 | Phase 58 | Pending |
| EXT-09 | Phase 58 | Pending |
| EXT-10 | Phase 58 | Pending |
| CORE-01 | Phase 58 | Pending |
| CORE-02 | Phase 58 | Pending |
| CORE-03 | Phase 58 | Pending |
| SKEL-01 | Phase 59 | Pending |
| SKEL-02 | Phase 59 | Pending |
| SKEL-03 | Phase 59 | Pending |
| SKEL-04 | Phase 59 | Pending |
| SKEL-05 | Phase 59 | Pending |
| TEST-01 | Phase 56 | Pending |
| TEST-02 | Phase 56 | Pending |
| TEST-03 | Phase 56 | Pending |
| TEST-04 | Phase 56 | Pending |
| TEST-05 | Phase 56 | Pending |
| TEST-06 | Phase 56 | Pending |
| DEBT-01 | Phase 55 | Pending |
| DEBT-02 | Phase 55 | Pending |
| DEBT-03 | Phase 58 | Pending |
| DEBT-04 | Phase 58 | Pending |

**Coverage:**
- v1.9.0 requirements: 68 total
- Mapped to phases: 68
- Unmapped: 0

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-18 after roadmap phase assignment*
