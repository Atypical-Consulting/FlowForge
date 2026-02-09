# Phase 29: Blade-Centric File Structure - Extensibility Research

**Researched:** 2026-02-09
**Domain:** Feature-module architecture, Tauri v2, React lazy loading, Tailwind v4, Vite code-splitting, module boundary enforcement
**Confidence:** HIGH
**Perspective:** Expert Developer (Tauri + React + Tailwind v4)

## Summary

Phase 29 migrates FlowForge from a layer-based directory structure (components/, stores/, hooks/ at top level) to a feature-module structure where each blade's files are co-located under `blades/{blade-name}/`. The current codebase has 15 blade types spread across 4 directories (blades/, stores/, hooks/, and feature-specific component directories like staging/, commit/, gitflow/). The migration is structurally safe because the existing blade registry pattern (`import.meta.glob` + `registerBlade()`) already decouples blade discovery from file location.

Key findings: (1) Tauri v2 has zero coupling to frontend file structure -- the Rust backend communicates exclusively through the `bindings.ts` IPC layer and the Vite dev server. (2) Tailwind v4's automatic content detection scans all non-gitignored, non-binary files under the project root, so moving files within `src/` has no impact on class purging. (3) Vite's `import.meta.glob` can be updated to scan `../blades/*/registration.{ts,tsx}` instead of the current flat directory pattern. (4) Biome v2's `noPrivateImports` rule provides a ready-made mechanism for enforcing import boundaries via `@package` and `@private` JSDoc annotations. (5) The existing `React.lazy` + `Suspense` pattern in 6 blade registrations already creates chunk boundaries; extending this to all blades with `import.meta.glob` in lazy mode will maximize code-splitting.

**Primary recommendation:** Use a self-registering blade module pattern where each `blades/{blade-name}/index.ts` exports the blade's registration call, and the discovery index uses `import.meta.glob("../blades/*/registration.{ts,tsx}", { eager: true })`. Enforce boundaries with Biome's `noPrivateImports` rule using `@package` annotations on internal blade files.

## Standard Stack

### Core (Already In Project)

| Library | Version | Purpose | Relevance to Phase 29 |
|---------|---------|---------|----------------------|
| Vite | ^7.3.1 | Bundler, dev server, `import.meta.glob` | Glob patterns drive blade auto-discovery; chunk splitting for lazy blades |
| React | ^19.2.4 | UI framework | `React.lazy` + `Suspense` for blade-level code splitting |
| TypeScript | ^5.9.3 | Type system | Path aliases, barrel exports, type-only imports for boundary enforcement |
| Zustand | ^5 | State management | Stores move into blade directories; shared stores remain in `stores/` |
| Biome | ^2.3 | Linter/formatter | `noPrivateImports` rule for enforcing import boundaries |
| Tailwind CSS | ^4 | Styling | `@tailwindcss/vite` plugin handles content detection automatically |
| XState | ^5.26.0 | Navigation FSM | Navigation machine types (`BladeType`, `BladePropsMap`) are shared infrastructure |

### Supporting (No New Dependencies Needed)

This phase is a pure restructuring. No new npm packages are required.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Biome `noPrivateImports` | ESLint `no-restricted-imports` | Would require adding ESLint alongside Biome; Biome already handles linting. ESLint's rule offers regex patterns but Biome's `noPrivateImports` is annotation-based and lower friction. |
| Biome `noPrivateImports` | TypeScript project references | Heavyweight -- requires separate `tsconfig.json` per blade, complicates the build pipeline. Over-engineering for a single-app codebase. |
| `import.meta.glob` auto-discovery | Manual import barrel | Manual barrel requires editing `index.ts` when adding a blade, defeating the "zero-config new blade" goal. |
| Feature-module blades | Nx-style workspace with `enforce-module-boundaries` | Nx is a monorepo tool; FlowForge is a single app. The overhead is not justified. |

## Architecture Patterns

### Recommended Target Structure

```
src/
  blades/                          # Feature modules (one per blade type)
    _shared/                       # Shared blade infrastructure
      BladeContainer.tsx
      BladePanel.tsx
      BladeRenderer.tsx
      BladeStrip.tsx
      BladeToolbar.tsx
      BladeBreadcrumb.tsx
      BladeErrorBoundary.tsx
      BladeLoadingFallback.tsx
      BladeContentEmpty.tsx
      BladeContentError.tsx
      BladeContentLoading.tsx
      NavigationGuardDialog.tsx
      ProcessNavigation.tsx
      index.ts                     # Public API barrel
    staging-changes/
      StagingChangesBlade.tsx      # Blade component
      StagingChangesBlade.test.tsx # Co-located test
      registration.ts              # registerBlade() call
      index.ts                     # Public barrel (re-exports component + types)
    diff/
      DiffBlade.tsx
      DiffBlade.test.tsx
      types.ts                     # DiffSource type (extracted from component)
      registration.tsx
      index.ts
    changelog/
      ChangelogBlade.tsx
      ChangelogBlade.test.tsx
      store.ts                     # useChangelogStore (blade-specific)
      registration.ts
      index.ts
    settings/
      SettingsBlade.tsx
      SettingsBlade.test.tsx
      registration.ts
      components/                  # Sub-components specific to this blade
        AppearanceSettings.tsx
        GeneralSettings.tsx
        GitSettings.tsx
        IntegrationsSettings.tsx
        ReviewSettings.tsx
        SettingsField.tsx
      index.ts
    topology-graph/
      TopologyRootBlade.tsx
      TopologyRootBlade.test.tsx
      registration.ts
      components/                  # Sub-components
        TopologyPanel.tsx
        CommitBadge.tsx
        LaneBackground.tsx
        LaneHeader.tsx
        layoutUtils.ts
      index.ts
    conventional-commit/
      ConventionalCommitBlade.tsx
      registration.ts
      index.ts
    init-repo/
      InitRepoBlade.tsx
      registration.ts
      store.ts                     # useInitRepoStore (blade-specific)
      components/
        InitRepoForm.tsx
        InitRepoPreview.tsx
        TemplatePicker.tsx
        CategoryFilter.tsx
        TemplateChips.tsx
        ProjectDetectionBanner.tsx
      index.ts
    gitflow-cheatsheet/
      GitflowCheatsheetBlade.tsx
      GitflowCheatsheetBlade.test.tsx
      registration.ts
      components/                  # gitflow-specific sub-components
        GitflowPanel.tsx
        GitflowActionCards.tsx
        GitflowDiagram.tsx
        ...
      index.ts
    commit-details/
      CommitDetailsBlade.tsx
      CommitDetailsBlade.test.tsx
      registration.ts
      index.ts
    repo-browser/
      RepoBrowserBlade.tsx
      RepoBrowserBlade.test.tsx
      registration.tsx
      index.ts
    viewer-code/
      ViewerCodeBlade.tsx
      ViewerCodeBlade.test.tsx
      registration.ts
      index.ts
    viewer-image/
      ViewerImageBlade.tsx
      ViewerImageBlade.test.tsx
      registration.ts
      index.ts
    viewer-markdown/
      ViewerMarkdownBlade.tsx
      ViewerMarkdownBlade.test.tsx
      registration.ts
      index.ts
    viewer-3d/
      Viewer3dBlade.tsx
      Viewer3dBlade.test.tsx
      registration.ts
      index.ts
    viewer-nupkg/
      ViewerNupkgBlade.tsx
      ViewerNupkgBlade.test.tsx
      registration.ts
      index.ts
    _discovery.ts                  # import.meta.glob auto-discovery + HMR
  components/                      # Shared non-blade components
    ui/                            # Shared UI primitives (button, dialog, etc.)
    layout/                        # Layout components (SplitPaneLayout, etc.)
    markdown/                      # Shared markdown renderer
    Header.tsx
    RepositoryView.tsx
    WelcomeView.tsx
    ...
  stores/                          # Cross-cutting Zustand stores
    repository.ts                  # Repository state (used by many features)
    staging.ts                     # Staging state (used by staging blade + DiffBlade)
    navigation.ts                  # Navigation persistence (cross-cutting)
    theme.ts                       # Theme state (cross-cutting)
    settings.ts                    # Settings persistence (cross-cutting)
    toast.ts                       # Toast notifications (cross-cutting)
    commandPalette.ts              # Command palette state (cross-cutting)
    branches.ts                    # Branch state (used by multiple features)
    ...
  hooks/                           # Shared hooks (useBladeNavigation, etc.)
  lib/                             # Shared utilities
  machines/                        # XState machines (navigation)
  commands/                        # Command palette registrations
```

### Pattern 1: Self-Registering Blade Module

**What:** Each blade directory contains a `registration.ts` file that calls `registerBlade()` with the blade's metadata. A central discovery file uses `import.meta.glob` to find and eagerly import all registration files.

**When to use:** Every blade type in the system.

**Example:**

```typescript
// src/blades/changelog/registration.ts
import { registerBlade } from "@/lib/bladeRegistry";
import { ChangelogBlade } from "./ChangelogBlade";

registerBlade({
  type: "changelog",
  defaultTitle: "Generate Changelog",
  component: ChangelogBlade,
  singleton: true,
});
```

```typescript
// src/blades/_discovery.ts
import { clearRegistry, getAllBladeTypes } from "@/lib/bladeRegistry";

// Auto-import all blade registration modules.
// Each registration.ts top-level registerBlade() call executes on import.
const modules = import.meta.glob(
  ["./*/registration.{ts,tsx}", "!./_shared/**"],
  { eager: true }
);

// Dev-mode guard
if (import.meta.env.DEV && Object.keys(modules).length === 0) {
  console.error("[BladeRegistry] No registration modules found");
}

// Dev-mode exhaustiveness check
if (import.meta.env.DEV && !import.meta.hot?.data?.isUpdate) {
  const registered = new Set(getAllBladeTypes());
  const EXPECTED_TYPES: string[] = [
    "staging-changes", "topology-graph", "commit-details", "diff",
    "viewer-nupkg", "viewer-image", "viewer-markdown", "viewer-3d",
    "viewer-code", "repo-browser", "settings", "changelog",
    "gitflow-cheatsheet", "init-repo", "conventional-commit",
  ];
  const missing = EXPECTED_TYPES.filter(t => !registered.has(t as any));
  if (missing.length > 0) {
    console.warn(
      `[BladeRegistry] Missing registrations: ${missing.join(", ")}`
    );
  }
}

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose((data) => {
    data.isUpdate = true;
    clearRegistry();
  });
}
```

**Confidence:** HIGH -- This is a direct evolution of the existing pattern in `src/components/blades/registrations/index.ts`. Only the glob path changes.

### Pattern 2: Lazy Blade Registration with React.lazy

**What:** Blades with heavy dependencies (Monaco editor, Three.js, etc.) use `React.lazy()` in their registration to create separate chunks.

**When to use:** Any blade with large third-party dependencies or infrequently-accessed UI.

**Example:**

```typescript
// src/blades/viewer-code/registration.ts
import { lazy } from "react";
import { registerBlade } from "@/lib/bladeRegistry";
import { renderPathBreadcrumb } from "@/lib/bladeUtils";

const ViewerCodeBlade = lazy(() =>
  import("./ViewerCodeBlade").then((m) => ({ default: m.ViewerCodeBlade }))
);

registerBlade<{ filePath: string }>({
  type: "viewer-code",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Code",
  component: ViewerCodeBlade,
  lazy: true,
  renderTitleContent: (props) => renderPathBreadcrumb(props.filePath),
});
```

**Confidence:** HIGH -- 6 of 15 blade registrations already use this exact pattern.

### Pattern 3: Blade Public API Barrel

**What:** Each blade directory exports only what other modules need through an `index.ts` barrel. Internal components, helpers, and implementation details are not exported.

**When to use:** Every blade module.

**Example:**

```typescript
// src/blades/diff/index.ts
/** @package */
export { DiffBlade } from "./DiffBlade";
export type { DiffSource } from "./types";
```

```typescript
// src/blades/diff/types.ts
/**
 * Blade input: diff source configuration.
 * Exported for use by BladePropsMap and other blades that open diffs.
 */
export type DiffSource =
  | { mode: "staging"; filePath: string; staged: boolean }
  | { mode: "commit"; oid: string; filePath: string };
```

**Confidence:** HIGH -- The DiffSource type is currently defined inside DiffBlade.tsx and imported by 3 external files (bladeTypes.ts, previewRegistry.ts, diff registration). Extracting it to a separate types.ts in the blade directory resolves the cross-boundary dependency cleanly.

### Pattern 4: Import Boundary Enforcement with Biome `noPrivateImports`

**What:** Use Biome's `noPrivateImports` rule with `@package` JSDoc annotations to prevent cross-blade imports.

**When to use:** All blade-internal files that should not be imported from outside the blade directory.

**Example:**

```typescript
// src/blades/changelog/ChangelogBlade.tsx
/** @package */
export function ChangelogBlade() {
  // ... implementation
}
```

```typescript
// src/blades/changelog/store.ts
/** @package */
export const useChangelogStore = create<ChangelogState>((set, get) => ({
  // ... only imported within blades/changelog/
}));
```

```json
// biome.json addition
{
  "linter": {
    "rules": {
      "recommended": true,
      "correctness": {
        "noPrivateImports": "error"
      }
    }
  }
}
```

**How it works:** Files annotated with `@package` can only be imported by files in the same directory or its subdirectories. A file in `blades/staging-changes/` cannot import from `blades/changelog/ChangelogBlade.tsx` if it's marked `@package`. The registration barrel (`index.ts`) and the blade's `registration.ts` can re-export things as public that the rest of the app needs.

**Confidence:** HIGH -- Biome's `noPrivateImports` rule exists in Biome v2 and is documented. Source: https://biomejs.dev/linter/rules/no-private-imports/

### Anti-Patterns to Avoid

- **Cross-blade imports:** `blades/staging-changes/StagingChangesBlade.tsx` must NEVER import from `blades/diff/DiffBlade.tsx`. If they share logic, it belongs in `lib/` or `hooks/`.
- **Blade importing from another blade's store:** If `StagingChangesBlade` needs staging state and `DiffBlade` also needs it, the store belongs in shared `stores/staging.ts`, not in either blade directory.
- **Deeply nested blade directories:** Keep blade directories shallow (max 2 levels). If a blade has many sub-components, a single `components/` subdirectory is sufficient.
- **Moving ALL stores into blades:** Only truly blade-specific stores (used by exactly one blade) should move. Cross-cutting stores (repository, theme, toast, settings, navigation, branches, stash, tags, worktrees) stay in shared `stores/`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Import boundary enforcement | Custom lint script checking imports | Biome `noPrivateImports` rule | Built-in to existing toolchain, annotation-based, zero config beyond enabling the rule |
| Module auto-discovery | Manual barrel that lists all blades | `import.meta.glob` (Vite built-in) | Already proven in the codebase; adding a blade = adding a directory, no barrel edit |
| Code splitting boundaries | Manual `React.lazy` wrapper per blade | Registration pattern with `lazy: true` flag | The BladeRenderer already handles Suspense wrapping based on the `lazy` flag |
| Chunk naming | Custom Rollup plugin for chunk names | Vite's default chunk naming from dynamic imports | Vite already names chunks based on the dynamic import path; `React.lazy(() => import("./DiffBlade"))` creates a predictable chunk |

**Key insight:** The existing blade registry + `import.meta.glob` pattern already handles 90% of the extensibility concerns. Phase 29 is primarily a file move operation with updated glob patterns, not an architecture overhaul.

## Common Pitfalls

### Pitfall 1: Circular Dependencies After Move

**What goes wrong:** Moving files can create circular import chains. For example, `bladeTypes.ts` currently imports `DiffSource` from `DiffBlade.tsx`, and `DiffBlade.tsx` imports types from `bladeTypes.ts`. After the move, this circle becomes more visible.

**Why it happens:** The `DiffSource` type is defined inside a component file but used as a shared type in `BladePropsMap`.

**How to avoid:** Extract `DiffSource` to `blades/diff/types.ts` and update `stores/bladeTypes.ts` to import from there. This breaks the cycle because `bladeTypes.ts` imports a types-only file, not the component.

**Warning signs:** TypeScript error "Cannot access X before initialization" or Vite error about circular dependencies during dev.

### Pitfall 2: Broken `import.meta.glob` After Path Change

**What goes wrong:** The `import.meta.glob` pattern in the discovery file doesn't match the new file locations, causing zero blade registrations.

**Why it happens:** The glob pattern is a string literal that Vite evaluates at compile time. If the relative path from the discovery file to the registration files is wrong, no modules are found.

**How to avoid:** The existing dev-mode guard (`Object.keys(modules).length === 0`) will catch this immediately. Keep the discovery file at `src/blades/_discovery.ts` and use `./*/registration.{ts,tsx}` as the glob pattern.

**Warning signs:** Console error "[BladeRegistry] No registration modules found" or blank blade area on dev reload.

### Pitfall 3: HMR Breaks During Migration

**What goes wrong:** During the migration period (old and new structures coexisting), HMR may fail to pick up changes because the glob pattern was updated before all files were moved.

**Why it happens:** Vite's `import.meta.glob` is evaluated at compile time. If some registrations are in the old location and some in the new, the glob won't find both.

**How to avoid:** Use an array glob pattern during migration: `import.meta.glob(["./*/registration.{ts,tsx}", "../../components/blades/registrations/*.{ts,tsx}"], { eager: true })`. Remove the old pattern once migration is complete.

**Warning signs:** Some blades render, others show "Unknown blade: X".

### Pitfall 4: Shared Store Wrongly Moved Into Blade

**What goes wrong:** A store that is used by multiple features gets moved into a single blade directory, breaking imports from other consumers.

**Why it happens:** Developer sees `useStagingStore` is imported by `StagingChangesBlade` and assumes it belongs there, but `DiffBlade` and `useStagingKeyboard` also import it.

**How to avoid:** Before moving any store, run `grep -r "from.*stores/{store-name}" src/` to check all consumers. If more than one blade imports it, it stays in shared `stores/`.

**Stores that MUST stay shared:**
- `staging.ts` (used by StagingChangesBlade, DiffBlade, useStagingKeyboard, StagingPanel, FileItem, StagingDiffPreview)
- `repository.ts` (cross-cutting: App.tsx + many components)
- `theme.ts`, `settings.ts`, `navigation.ts` (cross-cutting)
- `toast.ts`, `commandPalette.ts` (cross-cutting)
- `branches.ts`, `stash.ts`, `tags.ts`, `worktrees.ts` (cross-cutting)
- `conventional.ts` (used by ConventionalCommitBlade, sidebar CommitForm, hooks)
- `gitflow.ts` (used by GitflowCheatsheetBlade + multiple gitflow components)
- `topology.ts` (used by App.tsx for auto-refresh + TopologyRootBlade)

**Stores that CAN move into blades:**
- `changelogStore.ts` -> `blades/changelog/store.ts` (only used by ChangelogBlade + ChangelogPreview)
- `initRepo.ts` -> `blades/init-repo/store.ts` (only used by InitRepoBlade + its sub-components)
- `reviewChecklist.ts` -> potentially `blades/gitflow-cheatsheet/` or stays shared (used by App.tsx init)

### Pitfall 5: Test Import Paths Break After Move

**What goes wrong:** Test files use relative imports like `../../test-utils/render` which change depth when moved into blade directories.

**Why it happens:** Relative path depth changes when a test moves from `src/components/blades/` to `src/blades/changelog/`.

**How to avoid:** Use the Vite `@/` alias for test utility imports. The alias is already configured in `vite.config.ts` (`"@": "/src"`), but tsconfig.json needs a matching `paths` entry for TypeScript resolution. Alternatively, keep relative paths and update them during the move.

**Recommended:** Add `paths` to tsconfig.json:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### Pitfall 6: Biome `noPrivateImports` Blocks Legitimate Cross-Module Access

**What goes wrong:** After enabling `noPrivateImports`, the discovery file or BladeRenderer can't import from blade modules because everything is marked `@package`.

**Why it happens:** `@package` restricts imports to the same directory tree. The discovery file is at `blades/_discovery.ts` and blade registrations are in `blades/*/registration.ts` -- these ARE in the same tree, so this specific case works. But `BladeRenderer` (in `blades/_shared/`) importing a blade component directly would be blocked.

**How to avoid:** BladeRenderer never imports blade components directly -- it uses the registry (`getBladeRegistration(type).component`). This is by design. Only registration files reference blade components, and registration files use relative imports within their own blade directory. The `@package` boundary is naturally respected.

## Specific Research Answers

### 1. Tauri v2 Implications

**Impact: NONE.** Confidence: HIGH.

Tauri v2's configuration (`tauri.conf.json`) references:
- `frontendDist: "../dist"` -- Vite's output directory, unaffected by source structure
- `devUrl: "http://localhost:1420"` -- Vite dev server URL, unaffected
- `beforeDevCommand: "npm run dev"` / `beforeBuildCommand: "npm run build"` -- npm scripts, unaffected

The Rust backend (`src-tauri/src/`) communicates with the frontend exclusively through:
- `bindings.ts` -- Auto-generated Tauri IPC bindings (file stays in `src/`)
- Tauri event system (`@tauri-apps/api/event`) -- No file path coupling

**No Tauri plugin or command registration references frontend file paths.** The Tauri Rust code has zero knowledge of the React component tree structure.

**Vite dev server / HMR:** Vite serves the `src/` directory. `import.meta.glob` patterns are resolved at compile time relative to the importing file. As long as the glob patterns are updated to match the new structure, HMR works identically. The existing HMR dispose/accept pattern in the discovery file handles re-registration cleanly.

### 2. React Patterns for Extensible Plugin-Like Architecture

**Current state:** 6 of 15 blades already use `React.lazy()` for code splitting (diff, viewer-code, viewer-markdown, viewer-3d, gitflow-cheatsheet, repo-browser). The `BladeRenderer` already handles `Suspense` wrapping based on the `lazy: true` flag in registrations.

**Recommendation: Make ALL non-root blades lazy.** Only `staging-changes` and `topology-graph` (the two root blades for their respective processes) should be eagerly loaded since they render on initial load. All other blades should use `React.lazy()` in their registration files.

**Dynamic import pattern for all blades:**

```typescript
// blades/changelog/registration.ts
import { lazy } from "react";
import { registerBlade } from "@/lib/bladeRegistry";

const ChangelogBlade = lazy(() =>
  import("./ChangelogBlade").then((m) => ({ default: m.ChangelogBlade }))
);

registerBlade({
  type: "changelog",
  defaultTitle: "Generate Changelog",
  component: ChangelogBlade,
  lazy: true,
  singleton: true,
});
```

**Code-splitting boundaries:** Each `React.lazy(() => import("./XBlade"))` creates a Vite/Rollup chunk boundary. The blade component and its private dependencies (sub-components, blade-specific store, blade-specific hooks) are tree-shaken into that chunk. Shared dependencies (React, Zustand, Tailwind classes) are in the common chunk.

**Why this matters for extensibility:** A new blade developer creates their blade directory, writes a registration file with `React.lazy()`, and gets automatic code splitting. The blade's code doesn't ship until the user navigates to it.

### 3. Tailwind v4 Considerations

**Impact: NONE.** Confidence: HIGH.

**Automatic content detection:** Tailwind v4 with the `@tailwindcss/vite` plugin scans ALL source files in the project for class names. Per official docs: "Tailwind will scan every file in your project for class names, except files in `.gitignore`, `node_modules`, binary files, CSS files, and lock files."

Moving `.tsx` files from `src/components/blades/` to `src/blades/` has zero impact because:
1. Both locations are under `src/` which is not in `.gitignore`
2. Tailwind treats files as plain text and scans for class tokens, regardless of directory structure
3. No `@source` directive is configured (nor needed) -- automatic detection covers everything

**No `@source` directives needed.** The `@source` directive is only required when files are outside the project root, in `.gitignore`'d directories, or in locations Tailwind's default scanning misses (e.g., external component libraries). None of these apply.

**`@theme {}` block and `--ctp-*` tokens:** These are defined in `src/index.css` and are completely independent of component file locations. No impact.

**The `@catppuccin/tailwindcss` import:** This is in `src/index.css` and provides the Catppuccin color tokens. Unaffected by file moves.

### 4. Refactoring for Extensibility -- Zero-Config New Blade Experience

**Current "add a blade" workflow (4 steps):**
1. Create component in `src/components/blades/YourBlade.tsx`
2. Add props to `BladePropsMap` in `src/stores/bladeTypes.ts`
3. Create registration in `src/components/blades/registrations/your-type.ts`
4. (Optional) Add file dispatch mapping in `src/lib/fileDispatch.ts`

**Target "add a blade" workflow (3 steps, 1 shared file edit):**
1. Create directory `src/blades/your-blade/` with component, registration, and index.ts
2. Add props to `BladePropsMap` in `src/stores/bladeTypes.ts` (the ONE shared file edit)
3. (Optional) Add file dispatch mapping

Step 2 cannot be eliminated entirely because `BladePropsMap` is a TypeScript interface that provides compile-time type safety for all blade navigation calls. This is the correct tradeoff: one line in a type file gives you type-checked `openBlade("your-blade", { ...props })` across the entire codebase.

**Why a "blade manifest" pattern is NOT recommended:** Some feature-module architectures use a manifest JSON or a `defineFeature()` config object. This adds indirection without benefit here because:
- The registration file IS the manifest (it describes type, title, component, lazy, singleton)
- TypeScript provides type safety that JSON manifests cannot
- `import.meta.glob` provides zero-config discovery that manual manifests don't

**Zero-config auto-discovery:** The glob pattern `./*/registration.{ts,tsx}` means ANY new directory under `blades/` with a `registration.ts` file is automatically discovered. No imports to add, no barrel to edit, no config to update.

### 5. XState Integration with Feature Modules

**Current coupling points:**

1. **`BladeType` and `BladePropsMap`** are defined in `src/stores/bladeTypes.ts` and re-exported through `src/machines/navigation/types.ts`. These types are used by:
   - The XState navigation machine (event types, guards, actions)
   - `useBladeNavigation` hook (all consumers)
   - All blade registrations (type checking)
   - `fileDispatch.ts` (mapping file extensions to blade types)

2. **`SINGLETON_TYPES`** set in `navigationMachine.ts` lists blade types that can only appear once in the stack: `["settings", "changelog", "gitflow-cheatsheet", "conventional-commit", "repo-browser"]`. This is independent of file structure but creates a second source of truth alongside `singleton: true` in registrations.

**Recommendation for Phase 29:**
- `BladeType`, `BladePropsMap`, `TypedBlade` stay in `src/stores/bladeTypes.ts` as shared types. They should NOT move into any blade directory because they are consumed by the navigation machine and all blade registrations.
- The `SINGLETON_TYPES` set in `navigationMachine.ts` should ideally be derived from the blade registry (`getAllBladeTypes().filter(t => isSingletonBlade(t))`) instead of being a hardcoded set. This is a small tech-debt fix that aligns with the extensibility goal (adding a singleton blade = setting `singleton: true` in registration, no edit to the machine needed). However, this is an optimization, not a blocker.
- Blade metadata (type, title, singleton, lazy, etc.) is already IN the blade module via the registration file. No need to create additional metadata files.

### 6. Testing Co-Location

**Current state:** 13 blade test files are in `src/components/blades/` alongside their components. The vitest config uses:
```typescript
include: ["src/**/*.test.{ts,tsx}"]
```

**Impact of moving tests:** NONE. The `src/**/*.test.{ts,tsx}` glob pattern matches regardless of depth within `src/`. Moving `ChangelogBlade.test.tsx` from `src/components/blades/` to `src/blades/changelog/` still matches the pattern.

**What needs updating in tests:** Relative import paths. Current tests import from `../../test-utils/render`. After moving to `src/blades/changelog/`, the path becomes `../../test-utils/render` (same depth, coincidentally) or different depending on exact nesting.

**Recommendation:** Add the `@/` path alias to `tsconfig.json` so tests can use `@/test-utils/render` regardless of their location:

```json
// tsconfig.json (add to compilerOptions)
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["src/*"]
  }
}
```

The Vite alias `"@": "/src"` is already configured. Adding the tsconfig `paths` makes TypeScript understand it too, improving IDE support and making import paths stable across moves.

**Coverage configuration:** The current coverage excludes `src/bindings.ts`, `src/test-utils/**`, `src/__mocks__/**`. No blade-specific excludes needed.

**Vitest config changes needed:** None. The existing config is already directory-agnostic.

### 7. Build Performance

**Impact: Positive.** Moving to blade-centric structure with consistent `React.lazy()` usage will IMPROVE build performance characteristics.

**Chunk splitting:** Currently, 6 blades are lazy-loaded and create separate chunks. The remaining 9 are eagerly loaded and bundled into the main chunk. Making all non-root blades lazy (recommendation from section 2) would:
- Reduce initial bundle size (fewer blades in the main chunk)
- Create predictable chunk boundaries at the blade level
- Improve Vite's tree-shaking (each chunk's dependencies are scoped)

**Vite build times:** File restructuring has negligible impact on build times. Vite/Rollup processes files based on the import graph, not directory structure. The number of files and their dependencies remain the same.

**`import.meta.glob` performance:** The glob pattern `./*/registration.{ts,tsx}` is evaluated at compile time by Vite. It generates a static import/require for each matched file. With 15 blades, this is 15 imports -- trivial.

**Tree-shaking considerations:** Barrel files (`index.ts`) in each blade directory should only re-export what's needed by external consumers (typically just the component type and any shared types). This prevents tree-shaking bypass where importing one export pulls in the entire module. With `React.lazy()`, the component itself is already behind a dynamic import boundary, so tree-shaking is naturally scoped.

**HMR performance:** Vite's HMR is file-based, not directory-based. Moving files doesn't affect HMR speed. The `import.meta.hot` handler in the discovery file re-clears and re-registers all blades on hot reload, which is already the current behavior.

## Code Examples

### Example 1: Complete New Blade Creation (Zero-Config)

```typescript
// Step 1: Create src/blades/my-new-blade/MyNewBlade.tsx
/** @package */
export function MyNewBlade({ someParam }: { someParam: string }) {
  return <div className="p-4 text-ctp-text">{someParam}</div>;
}

// Step 2: Create src/blades/my-new-blade/registration.ts
import { lazy } from "react";
import { registerBlade } from "@/lib/bladeRegistry";

const MyNewBlade = lazy(() =>
  import("./MyNewBlade").then((m) => ({ default: m.MyNewBlade }))
);

registerBlade<{ someParam: string }>({
  type: "my-new-blade",
  defaultTitle: "My New Blade",
  component: MyNewBlade,
  lazy: true,
});

// Step 3: Create src/blades/my-new-blade/index.ts
export type { /* any public types */ } from "./MyNewBlade";

// Step 4: Add to BladePropsMap (the ONE shared file edit)
// In src/stores/bladeTypes.ts:
export interface BladePropsMap {
  // ... existing entries ...
  "my-new-blade": { someParam: string };
}

// Step 5 (optional): Create src/blades/my-new-blade/MyNewBlade.test.tsx
import { render } from "@/test-utils/render";
import { MyNewBlade } from "./MyNewBlade";

describe("MyNewBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<MyNewBlade someParam="test" />);
    expect(container.firstChild).not.toBeNull();
  });
});
```

**What happens automatically:**
- `import.meta.glob("./*/registration.{ts,tsx}")` in `_discovery.ts` finds the new registration
- The blade appears in the registry and can be opened via `openBlade("my-new-blade", { someParam: "test" })`
- Dev-mode console warning fires if the type isn't in the EXPECTED_TYPES list (intentional -- the developer should add it)

### Example 2: Discovery File with Migration Support

```typescript
// src/blades/_discovery.ts (during migration period)
import { clearRegistry, getAllBladeTypes } from "@/lib/bladeRegistry";

// Phase 1: Import from BOTH old and new locations during migration
const modules = import.meta.glob(
  [
    "./*/registration.{ts,tsx}",              // New location
    "../components/blades/registrations/*.{ts,tsx}",  // Old location
    "!../components/blades/registrations/index.ts",   // Exclude old barrel
    "!./_shared/**",                          // Exclude shared infrastructure
  ],
  { eager: true }
);

// ... rest identical to current registrations/index.ts
```

### Example 3: Biome Configuration for Import Boundaries

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noPrivateImports": "error"
      }
    }
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 }
}
```

### Example 4: DiffSource Type Extraction

```typescript
// BEFORE (src/components/blades/DiffBlade.tsx, lines 28-33)
export type DiffSource =
  | { mode: "staging"; filePath: string; staged: boolean }
  | { mode: "commit"; oid: string; filePath: string };

// AFTER (src/blades/diff/types.ts)
/**
 * Blade input: diff source configuration.
 * Public type -- imported by bladeTypes.ts and previewRegistry.ts.
 */
export type DiffSource =
  | { mode: "staging"; filePath: string; staged: boolean }
  | { mode: "commit"; oid: string; filePath: string };

// src/blades/diff/DiffBlade.tsx now imports from local types.ts:
import type { DiffSource } from "./types";

// src/stores/bladeTypes.ts now imports from the blade's public API:
import type { DiffSource } from "../blades/diff/types";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Layer-based dirs (components/, stores/, hooks/) | Feature-module dirs (one dir per feature) | React ecosystem convention, widespread since ~2023 | Reduces cognitive load, improves co-location, enables lazy loading per feature |
| Manual barrel exports for module registration | `import.meta.glob` for auto-discovery | Vite 3+ (2022) | Zero-config module discovery; adding a file is sufficient |
| ESLint `no-restricted-imports` for boundaries | Biome `noPrivateImports` with JSDoc annotations | Biome v2 (2025-2026) | Annotation-based boundaries are more maintainable than regex-based import rules |
| Tailwind v3 manual `content` array in config | Tailwind v4 automatic content detection | Tailwind v4 (2025) | No config changes needed when moving files |

## Store Classification (Move vs. Stay)

| Store | Current Location | Classification | Used By | Recommendation |
|-------|-----------------|---------------|---------|----------------|
| `changelogStore.ts` | `stores/` | Blade-specific | ChangelogBlade, ChangelogPreview | MOVE to `blades/changelog/store.ts` |
| `initRepo.ts` | `stores/` | Blade-specific | InitRepoBlade, 6 sub-components | MOVE to `blades/init-repo/store.ts` |
| `staging.ts` | `stores/` | Cross-cutting | 6 consumers across 3 features | STAY in `stores/` |
| `conventional.ts` | `stores/` | Cross-cutting | ConventionalCommitBlade, sidebar CommitForm, hooks | STAY in `stores/` |
| `topology.ts` | `stores/` | Cross-cutting | App.tsx (auto-refresh), TopologyRootBlade, hooks | STAY in `stores/` |
| `gitflow.ts` | `stores/` | Cross-cutting | 6 gitflow components + blade | STAY in `stores/` |
| `repository.ts` | `stores/` | Cross-cutting | App.tsx + many components | STAY in `stores/` |
| `theme.ts` | `stores/` | Cross-cutting | App.tsx, ThemeToggle | STAY in `stores/` |
| `settings.ts` | `stores/` | Cross-cutting | App.tsx, settings components | STAY in `stores/` |
| `navigation.ts` | `stores/` | Cross-cutting | App.tsx | STAY in `stores/` |
| `toast.ts` | `stores/` | Cross-cutting | Many components | STAY in `stores/` |
| `commandPalette.ts` | `stores/` | Cross-cutting | CommandPalette, keyboard shortcuts | STAY in `stores/` |
| `blades.ts` | `stores/` | Deprecated | Legacy (replaced by XState machine) | STAY (or remove in Phase 30) |
| `bladeTypes.ts` | `stores/` | Shared types | All blades, navigation machine | STAY in `stores/` |
| `branches.ts` | `stores/` | Cross-cutting | Branch management features | STAY in `stores/` |
| `branchMetadata.ts` | `stores/` | Cross-cutting | App.tsx | STAY in `stores/` |
| `clone.ts` | `stores/` | Feature-specific | CloneForm | STAY (not blade-related) |
| `reviewChecklist.ts` | `stores/` | Cross-cutting | App.tsx (init), gitflow blade | STAY in `stores/` |
| `undo.ts` | `stores/` | Cross-cutting | App.tsx, keyboard shortcuts | STAY in `stores/` |
| `stash.ts` | `stores/` | Cross-cutting | Multiple features | STAY in `stores/` |
| `tags.ts` | `stores/` | Cross-cutting | Multiple features | STAY in `stores/` |
| `worktrees.ts` | `stores/` | Cross-cutting | Multiple features | STAY in `stores/` |

**Result:** Only 2 stores move into blade directories. 19 stores stay shared.

## Component Sub-Directory Classification

| Current Location | Files | Target | Rationale |
|-----------------|-------|--------|-----------|
| `components/staging/` | 10 files | `blades/staging-changes/components/` | All used exclusively by StagingChangesBlade |
| `components/settings/` | 6 files | `blades/settings/components/` | All used exclusively by SettingsBlade |
| `components/topology/` | 6 files | `blades/topology-graph/components/` | All used exclusively by TopologyRootBlade |
| `components/commit/` | 14 files | SPLIT -- see below | Used by both sidebar CommitForm AND ConventionalCommitBlade |
| `components/changelog/` | 2 files | `blades/changelog/components/` | Used only by ChangelogBlade |
| `components/gitflow/` | 8 files | `blades/gitflow-cheatsheet/components/` | All used by gitflow features |
| `components/init-repo/` | 6 files | `blades/init-repo/components/` | All used by InitRepoBlade |
| `components/viewers/` | 3 files | SPLIT across viewer blades | NugetPackageViewer -> viewer-nupkg, ViewerRegistry -> shared |
| `components/ui/` | 9 files | STAY in `components/ui/` | Shared UI primitives |
| `components/layout/` | -- | STAY in `components/layout/` | Shared layout components |
| `components/markdown/` | -- | STAY in `components/markdown/` | Shared markdown renderer |
| `components/navigation/` | 5 files | STAY in `components/navigation/` | Shared navigation UI |
| `components/command-palette/` | -- | STAY in `components/command-palette/` | Shared command palette |

**`components/commit/` split:** This directory has 14 files shared between the sidebar CommitForm (in RepositoryView) and the ConventionalCommitBlade. Components like TypeSelector, ScopeAutocomplete, BreakingChangeSection, CharacterProgress, ValidationErrors are used by both. These should STAY in `components/commit/` as shared components. Only blade-specific components (if any) move.

## Open Questions

1. **Should the `blades/` directory be at `src/blades/` or `src/features/blades/`?**
   - What we know: The existing structure uses `src/components/blades/`. Moving to `src/blades/` is the most direct path. `src/features/blades/` adds an unnecessary nesting level.
   - Recommendation: Use `src/blades/` -- it's concise, clear, and matches the domain language.

2. **Should the `@/` path alias be adopted project-wide during this phase?**
   - What we know: The Vite alias `"@": "/src"` exists but zero imports use it. Adding `paths` to tsconfig.json would enable TypeScript resolution. This would stabilize import paths across moves.
   - What's unclear: Whether adopting `@/` project-wide is within scope of Phase 29 or should be Phase 30 tech debt.
   - Recommendation: Add the tsconfig `paths` entry in Phase 29 but only use `@/` for NEW imports in the restructured blade modules. Don't mass-convert existing imports (that's a Phase 30 task).

3. **Should the deprecated `blades.ts` store (replaced by XState in Phase 26) be removed in this phase?**
   - What we know: It's marked `@deprecated` but may still have consumers.
   - Recommendation: Check for consumers. If none, remove it. If some, leave it for Phase 30.

4. **Should the `SINGLETON_TYPES` set in `navigationMachine.ts` be derived from the registry?**
   - What we know: Currently hardcoded. Making it dynamic would mean the machine reads from the registry at creation time.
   - What's unclear: Whether this creates a timing dependency (registry must be populated before machine starts).
   - Recommendation: Defer to Phase 30. The hardcoded set works, and changing the machine behavior is outside the "file restructure" scope.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct investigation of 270 source files in FlowForge
- **Context7 /websites/tailwindcss** -- Tailwind v4 automatic content detection, `@source` directive docs
- **Context7 /vitejs/vite** -- `import.meta.glob` API, dynamic import chunk splitting
- **Context7 /biomejs/biome** -- `noPrivateImports`, `noBarrelFile`, `noNamespaceImport` rules
- **Biome official docs** -- https://biomejs.dev/linter/rules/no-private-imports/

### Secondary (MEDIUM confidence)
- **Biome GitHub discussions** -- https://github.com/biomejs/biome/discussions/6245 (Nx-style enforce-module-boundaries request)
- **Previous phase research** -- Phase 20.1 (blade extensibility), Phase 25 (test infrastructure), Phase 28 (architecture)

### Tertiary (LOW confidence)
- None. All findings verified against codebase or official documentation.

## Metadata

**Confidence breakdown:**
- Tauri v2 implications: HIGH -- Verified against tauri.conf.json and codebase imports
- React lazy loading patterns: HIGH -- 6 existing blades already use the pattern
- Tailwind v4 content detection: HIGH -- Verified against Context7 Tailwind v4 docs
- Import boundary enforcement: HIGH -- Verified Biome `noPrivateImports` against official docs
- Store classification: HIGH -- Grep-verified all import consumers
- Build performance: HIGH -- Understood from Vite's documented behavior
- XState integration: HIGH -- Read full navigation machine source

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable -- this is a refactoring phase with no dependency version changes)
