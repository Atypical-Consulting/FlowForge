# Project Research Summary

**Project:** FlowForge v1.9.0 — Monorepo Conversion & Framework Extraction
**Domain:** Internal TypeScript monorepo for Tauri desktop application framework
**Researched:** 2026-02-15
**Confidence:** HIGH

## Executive Summary

FlowForge is a 60K LOC Tauri desktop Git client with a sophisticated UI framework already cleanly separated in `src/framework/`. The research confirms that extracting this framework into an internal monorepo with pnpm workspaces + Turborepo is the right approach. The existing codebase is remarkably well-prepared — Phase 1 of the original REUSABILITY-PROPOSAL.md is complete, with clean separation into `extension-system/`, `layout/`, `command-palette/`, `stores/`, and `theme/` directories.

The recommended strategy is **Just-in-Time packages** (source-level consumption via TypeScript path aliases) rather than building packages separately. This eliminates build complexity and preserves Vite's instant HMR. The critical path involves: (1) establishing monorepo infrastructure with pnpm/Turborepo, (2) breaking the single critical platform coupling (Tauri persistence via adapter pattern), (3) extracting packages in dependency order (leaf packages first), and (4) validating with a second minimal app.

The primary risks are all preventable through sequencing: circular dependencies must be fixed BEFORE extraction begins, path aliases must be migrated while still in single-package form, and Zustand singleton breakage must be prevented via peer dependencies. The research identified 312 cross-module imports that need systematic migration, 3 circular dependency violations to fix, and 14 critical/moderate pitfalls with specific prevention strategies. With disciplined incremental extraction (one package at a time, keeping the app functional throughout), this conversion carries LOW execution risk.

## Key Findings

### Recommended Stack

The monorepo tooling selection prioritizes simplicity and minimalism appropriate for a 3-5 package internal monorepo. **pnpm 10.x** provides strict node_modules isolation (critical for preventing phantom dependencies) and native workspace protocol support. **Turborepo 2.8.x** adds intelligent task caching and pipeline orchestration without the complexity of Nx, which would be overkill for this project scale.

**Core technologies:**
- **pnpm 10.x workspaces**: Package manager with strict isolation — prevents phantom dependencies that cause runtime breakage when extracting shared packages
- **Turborepo 2.8.7**: Build orchestration with caching — zero-config for basic use, understands package graph, trivial to remove if needed later
- **TypeScript project references**: Incremental type-checking — already in use (`tsconfig.node.json` pattern), provides real speedup for 60K LOC, enforces package boundaries at type level
- **Just-in-Time package strategy**: Source-level consumption via path aliases — no build step per package, instant HMR, Vite transpiles everything
- **Shared config packages**: `@flowforge/tsconfig` and `@flowforge/biome-config` — keep shared config minimal (Vite and Tailwind configs remain per-app)

**Alternatives rejected:**
- npm workspaces: lacks strict node_modules, no content-addressable store
- yarn 4: PnP mode has Tauri CLI compatibility issues
- Nx: overkill for 5-package monorepo, invasive setup, harder to remove later
- tsup/tsc per package: unnecessary build step for internal-only Vite-consumed packages

### Expected Features

Research identified a clear separation between framework infrastructure (reusable) and application domain logic (FlowForge-specific). The extraction must focus on infrastructure only.

**Must have (table stakes):**
- pnpm workspace configuration with TypeScript project references — foundation for everything
- Peer dependency declarations (React, Zustand, XState) — prevents duplicate instances that break state sharing
- Persistence abstraction layer (storage adapter interface) — decouples framework from Tauri, most critical coupling break
- Blade navigation system with module augmentation — the core UI paradigm, already uses TypeScript module augmentation pattern
- Extension platform with DI for platform specifics — ExtensionHost/ExtensionAPI must work in non-Tauri environments
- Minimal second app that proves the framework works — validation that extraction succeeded

**Should have (competitive DX):**
- App bootstrap function (`createFlowForgeApp()`) — reduces boilerplate from App.tsx's 400+ lines of wiring
- Turborepo build caching — significant CI speedup once project scales beyond 5 packages
- Framework DevTools panel — XState inspector integration exists, extending to all registries adds DX value
- Type-safe extension contribution points — schema validation would catch errors earlier than current runtime validation

**Defer (v2+):**
- `create-flowforge-app` CLI scaffolding — wait until framework API stabilizes after real usage
- Extension sandbox (Web Worker isolation) — prototype exists but production isolation is separate milestone
- npm publishing pipeline — internal-only monorepo, adds semver/changelog overhead without value until external consumers exist
- Multi-framework support (Vue/Svelte) — framework is deeply React-specific, no benefit to abstracting

### Architecture Approach

The target structure uses 6 packages organized in a clear dependency hierarchy: `stores` and `theme` as leaf packages (no internal dependencies), `command-palette` and `layout` depending only on those leaves, `extension-system` depending on all lower layers, and `core` as a meta-package re-exporting everything. The existing `src/framework/` directory maps almost 1:1 to this package structure, confirming that boundary work is already complete.

**Major components:**
1. **@flowforge/stores** — State management primitives (`createRegistry`, `createBladeStore`, `toast`, `PersistenceAdapter` interface, `OperationBus`). Leaf package with zero dependencies. Contains the critical abstraction point: persistence adapter interface that breaks Tauri coupling.
2. **@flowforge/layout** — Blade navigation system (XState FSM + registry), sidebar panels, workflow registry, resizable panel layouts. Depends on stores + theme. The largest single package (~50 files, ~15K LOC).
3. **@flowforge/extension-system** — Extension lifecycle (`ExtensionHost`, `ExtensionAPI`), all registries (toolbar, context menu, status bar, machine), extension manifest system, event bus. Depends on layout + command-palette + stores. The tightest coupling point in the architecture.
4. **@flowforge/command-palette** — Command registry, palette UI, fuzzy search, keyboard shortcuts. Depends only on stores.
5. **@flowforge/theme** — CSS tokens, animations, theme provider. Leaf package. Currently Catppuccin-specific (acceptable for internal monorepo, semantic tokens are a later enhancement).
6. **@flowforge/core** — Meta-package re-exporting all of the above for convenience.

**Critical integration point:** The persistence adapter pattern is the only meaningful architectural change. Current code directly imports `getStore()` from `@tauri-apps/plugin-store`. New code will import `getPersistence()` which returns a configured `PersistenceAdapter` interface. The Tauri implementation moves to app code, injected at startup via `configurePersistence(createTauriAdapter())`. This pattern already exists for extension discovery (`configureExtensionHost`) and operation bus injection.

**Data flow:** Zustand stores, registries, event bus, operation bus, and navigation machine remain module-level singletons — no change to data flow patterns. TypeScript module augmentation for blade types survives package boundaries unchanged.

### Critical Pitfalls

1. **Circular dependencies between extracted packages** — Current codebase has 6 bidirectional imports: `framework` imports `Button`/`Dialog` from `core` (2 files), `core` imports `DiffSource` type and `CommitHistory` component from `extensions` (3 files). TypeScript project references forbid circular dependencies — `tsc --build` will fail. **Fix BEFORE extraction:** Move UI primitives into framework or create shared package; extract shared types to core; replace component imports with registry patterns. **Detection:** Run `madge --circular src/` to find all cycles.

2. **Vite path aliases break across package boundaries** — 312 cross-module imports use `@/` alias which resolves relative to each package's root, not the app root. All imports like `@/core/components/ui/button` from framework code will fail. **Fix BEFORE extraction:** Convert to package-name imports (`@flowforge/core`) while still in single-package form, using TypeScript path aliases to map to current locations. This validates dependency graph before creating separate packages.

3. **Zustand store singleton breakage** — If `zustand` is installed at different versions or hoisting fails, stores in different packages cannot share state. Silent data loss with no error messages. **Prevention:** Declare `zustand` (and `react`, `react-dom`) as peerDependencies in all packages; pin single version in workspace root; verify `pnpm ls zustand` shows exactly one resolved version.

4. **Tailwind CSS v4 classes not generated for package components** — Tailwind scans source files to determine which utilities to generate. Packages outside app source tree are not scanned automatically. Components render completely unstyled. **Prevention:** Add `@source "../packages/*/src/**/*.{ts,tsx}";` directives to app's `index.css`. Keep `@theme {}` block in app CSS — packages export components that USE classes but don't PROCESS them.

5. **Test infrastructure breaks across package boundaries** — `__mocks__/zustand.ts` at project root won't apply to other packages; setup.ts mocks Tauri plugins globally but packages can't import it without circular deps. 295 tests pass in old structure, fail in new. **Prevention:** Create `@flowforge/test-utils` package with Zustand auto-reset mock, Tauri API mocks, polyfills, and render helpers. Each package's vitest.config.ts references shared setup.

## Implications for Roadmap

Based on research, suggested phase structure follows strict dependency ordering (leaf packages first) with incremental validation after each extraction. Each phase must leave the app fully functional with all tests passing.

### Phase 1: Monorepo Scaffolding (Foundation)
**Rationale:** Infrastructure without code moves validates tooling setup and structural changes before any extraction risk. Lowest-risk phase that enables all subsequent work.
**Delivers:** Working pnpm workspace, Turborepo pipeline config, shared config packages, FlowForge app relocated to `apps/flowforge/` with all existing functionality intact
**Addresses:** Package structure and build (table stakes), shared config packages (table stakes)
**Avoids:** Big-bang extraction trap (I-1), frontendDist path breakage (Pitfall 6)
**Research flag:** Skip research-phase — pnpm workspace setup is well-documented

### Phase 2: Pre-Extraction Refactoring (Critical Path)
**Rationale:** Fix all circular dependencies and migrate path aliases BEFORE extraction begins. These changes are safe in single-package form but catastrophic to attempt during extraction.
**Delivers:** Zero circular dependencies (verified by madge), all cross-package imports using `@flowforge/*` paths, UI primitives relocated to framework layer, shared types extracted to core
**Addresses:** Circular dependency violations, path alias migration
**Avoids:** Circular dependencies (Pitfall 1 — critical), path alias breakage (Pitfall 3 — critical), module augmentation issues (I-3)
**Research flag:** Skip research-phase — pure refactoring based on known violations

### Phase 3: Leaf Package Extraction (Stores + Theme)
**Rationale:** Extract the two packages with zero internal dependencies first. Introduces the persistence adapter pattern (most critical architectural change). Success validates the Just-in-Time consumption strategy.
**Delivers:** `@flowforge/stores` with PersistenceAdapter interface, `@flowforge/theme`, Tauri adapter in app code, `configurePersistence()` wired at app startup
**Addresses:** Persistence abstraction layer (table stakes — most critical), generic createRegistry factory (table stakes), theme system extraction (table stakes)
**Avoids:** Tauri coupling in framework (Anti-Pattern 3), HMR breakage (Pitfall 7), Zustand singleton issues (Pitfall 4)
**Research flag:** Skip research-phase — dependency injection pattern already exists in codebase

### Phase 4: Middle Layer Extraction (Command Palette + Layout)
**Rationale:** Extract packages that depend only on leaf packages. Layout is the largest single package (~50 files) and contains the XState navigation FSM — highest technical risk component. Validates that complex state machines work across package boundaries.
**Delivers:** `@flowforge/command-palette`, `@flowforge/layout` with blade navigation system + workflow registry + navigation guards
**Addresses:** Blade navigation system extraction (table stakes — complex), workflow registry (table stakes), command palette (table stakes), layout presets (table stakes)
**Avoids:** TypeScript declaration/module resolution issues (Pitfall 9), test infrastructure breakage (Pitfall 8)
**Research flag:** Skip research-phase — XState FSM already has comprehensive tests, registry pattern proven

### Phase 5: Top Layer Extraction (Extension System + Core Meta-Package)
**Rationale:** Extract the package depending on everything else last. Extension system is the integration point for all registries. Creating the meta-package provides ergonomic imports for consumers.
**Delivers:** `@flowforge/extension-system` with ExtensionHost/ExtensionAPI + all registries, `@flowforge/core` meta-package re-exporting all framework packages, complete deletion of `src/framework/`
**Addresses:** ExtensionHost store extraction (table stakes), ExtensionAPI facade (table stakes), dependency injection for platform specifics (table stakes), all extension contribution points
**Avoids:** Import path complexity (packages/core provides single import point)
**Research flag:** Skip research-phase — DI pattern already proven via `configureExtensionHost`

### Phase 6: Second App Validation (Proof of Reusability)
**Rationale:** Build minimal app that imports framework to prove extraction succeeded. Catches any implicit coupling to FlowForge domain logic. Validates module augmentation pattern for blade types works across package boundaries.
**Delivers:** `apps/skeleton/` — minimal Tauri app with 1 workflow, 1 blade type, extension host initialization, proves all 15 FlowForge extensions still work
**Addresses:** App skeleton (table stakes — validation), app bootstrap function (differentiator — reduces boilerplate), minimal working app (table stakes)
**Avoids:** Publishing packages before validation (Anti-Pattern 5), store registry reset mechanism breakage (I-2)
**Research flag:** May need research-phase for Tauri workspace configuration patterns

### Phase Ordering Rationale

- **Foundation first (Phase 1):** Validate tooling and structure with zero code moves — fails fast if monorepo setup is wrong
- **Fix violations in safe context (Phase 2):** Refactoring while in single-package form allows incremental testing; attempting during extraction creates compound failures
- **Dependency order (Phases 3-5):** Leaf packages → middle layer → top layer ensures each extraction depends only on completed work; prevents cascading failures
- **Validation last (Phase 6):** Building second app after all extraction proves the framework works; doing it earlier would test incomplete packages

This ordering minimizes risk at each step: Phase 1 is structural only (reversible), Phase 2 is refactoring without architectural change (testable incrementally), Phases 3-5 each have one package's worth of blast radius (isolated failures), Phase 6 validates the complete system.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 6 (Second App):** Tauri workspace configuration for multiple apps sharing Rust crates — community patterns exist but not official guide (MEDIUM confidence from research)
- **Deferred Phase (Rust Crate Extraction):** If second app needs shared Rust code, extracting `flowforge-git` crate requires Cargo workspace patterns — straightforward but app-dependent

Phases with standard patterns (skip research-phase):
- **Phase 1:** pnpm workspace + Turborepo setup well-documented in official guides
- **Phase 2:** Pure refactoring based on direct codebase analysis (HIGH confidence)
- **Phase 3:** Dependency injection pattern already exists (`configureExtensionHost` precedent)
- **Phase 4:** XState FSM has comprehensive test coverage, registry pattern proven
- **Phase 5:** Extension system DI already proven, meta-package is standard pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | pnpm workspaces, Turborepo, and Just-in-Time package strategy are well-documented. TypeScript project references already in use. All recommendations backed by official docs or established community patterns. |
| Features | HIGH | Based on direct codebase analysis (60K LOC inspected). Existing `src/framework/` directory provides clear boundary. Table stakes features verified by checking current functionality. MVP recommendation aligns with original REUSABILITY-PROPOSAL.md. |
| Architecture | HIGH | Proposed package structure maps 1:1 to existing `src/framework/` subdirectories. Dependency graph verified by analyzing 312 cross-module imports. Persistence adapter pattern proven via existing `configureExtensionHost` DI. Module augmentation pattern already working. |
| Pitfalls | HIGH | Critical pitfalls (1-5) verified by codebase analysis: circular dependencies found with grep (6 violations), path aliases counted (312 instances), Zustand singleton issue documented in upstream discussion. Prevention strategies validated against similar monorepo conversions. |

**Overall confidence:** HIGH

### Gaps to Address

Minor gaps that need validation during implementation but don't block planning:

- **Tauri multi-app workspace configuration:** Community patterns exist (Tauri discussion #13941, blog posts) but no official monorepo guide from Tauri team. Confidence: MEDIUM. **Handle during Phase 6** via targeted research-phase for Tauri workspace setup.
- **Vite HMR edge cases with workspace packages:** Standard patterns documented but exact behavior depends on Vite version and package manager. Confidence: MEDIUM. **Handle during Phase 3** by validating HMR after leaf package extraction, before continuing.
- **TypeScript module augmentation across packages:** Pattern should work based on TypeScript spec, but recent commit (df76fd2) moved blade types with augmentation — needs validation in multi-package context. Confidence: MEDIUM. **Handle during Phase 4** with explicit test of augmented blade types in consuming package.
- **Tauri plugin resolution with pnpm hoisting:** Should work but edge cases exist per Tauri discussion #7368. Confidence: MEDIUM. **Handle during Phase 1** by testing all 5 Tauri plugins (`@tauri-apps/plugin-*`) after workspace setup.
- **Semantic CSS variable abstraction:** Current framework uses Catppuccin-specific `--ctp-*` tokens. Research confirmed this is acceptable for internal monorepo. Refactoring to semantic `--ff-*` tokens is deferred enhancement, not blocker. **Defer to post-v1.9.0.**

## Sources

### Primary (HIGH confidence)
- FlowForge codebase direct analysis — 60K LOC TypeScript + 13K Rust inspected, 312 cross-module imports counted, 6 circular dependency violations found, dependency graph mapped
- FlowForge `REUSABILITY-PROPOSAL.md` — first-party architecture analysis, Phase 1 validation complete
- [Turborepo Internal Packages](https://turborepo.dev/docs/core-concepts/internal-packages) — Just-in-Time vs Compiled strategy
- [pnpm Workspaces](https://pnpm.io/workspaces) — workspace protocol and configuration
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html) — composite projects and incremental builds
- [Vite TypeScript monorepo RFC](https://github.com/vitejs/vite-ts-monorepo-rfc) — official Vite path alias and HMR patterns
- [Zustand external package discussion #2870](https://github.com/pmndrs/zustand/discussions/2870) — duplicate instance problem

### Secondary (MEDIUM confidence)
- [Tauri v2 monorepo discussion #13941](https://github.com/orgs/tauri-apps/discussions/13941) — community patterns, not official guide
- [Nhost pnpm + Turborepo configuration](https://nhost.io/blog/how-we-configured-pnpm-and-turborepo-for-our-monorepo) — monorepo setup patterns
- [Tailwind CSS v4 monorepo discussion #18770](https://github.com/tailwindlabs/tailwindcss/discussions/18770) — @source directive for workspace packages
- [Nx blog: Managing TS packages in monorepos](https://nx.dev/blog/managing-ts-packages-in-monorepos) — TypeScript config patterns
- [Tauri monorepo discussion #7368](https://github.com/tauri-apps/tauri/discussions/7368) — plugin resolution edge cases

### Tertiary (LOW confidence)
- [Monorepo tools overview](https://monorepo.tools/) — general comparison, needs validation
- [Robin Wieruch: JavaScript Monorepos](https://www.robinwieruch.de/javascript-monorepos/) — workspace protocol patterns

---
*Research completed: 2026-02-15*
*Ready for roadmap: yes*
