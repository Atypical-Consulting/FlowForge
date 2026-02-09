# Phase 29: Blade-Centric File Structure - Architecture Research

**Researched:** 2026-02-09
**Domain:** Feature-module file structure migration, React project organization, auto-discovery patterns
**Confidence:** HIGH

## Summary

This research maps the complete current file structure, import dependency graph, blade registry mechanism, and identifies the exact migration strategy for moving from a layer-based layout (`components/blades/`, `stores/`, `hooks/`) to a feature-module layout (`blades/{blade-name}/`).

The codebase currently has **15 blade types** with their files scattered across 4+ directories. The blade registry's auto-discovery mechanism uses `import.meta.glob` in a single `registrations/` directory. The migration must adapt this glob pattern to scan per-blade directories while maintaining backward compatibility during the gradual transition.

**Primary recommendation:** Migrate blade-by-blade using a two-glob auto-discovery approach (scanning both old and new locations), starting with the simplest self-contained blades (settings, changelog, viewer-image) before tackling complex blades with shared stores (staging-changes, diff, conventional-commit). Use `git mv` to preserve history. Enforce import boundaries through a custom lint script since Biome lacks native module boundary enforcement.

## Standard Stack

### Core (Already In Use)
| Library | Version | Purpose | Relevance to Phase 29 |
|---------|---------|---------|----------------------|
| Vite | ^7.3.1 | Build tool with `import.meta.glob` | Glob pattern drives auto-discovery; must adapt pattern for new structure |
| TypeScript | ^5.9.3 | Type system with path aliases | Already has `@` alias via `resolve.alias` in vite.config.ts; tsconfig needs matching `paths` |
| Biome | ^2.3 | Linting/formatting | Does NOT support import boundary enforcement natively |
| Vitest | ^3.2.4 | Test runner | Tests must work from new co-located locations |

### Supporting (May Be Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A (custom script) | - | Import boundary enforcement | Biome lacks `no-restricted-paths`; use a grep-based CI check or custom lint script |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom lint script for boundaries | eslint-plugin-boundaries | Would require adding ESLint alongside Biome; too heavy for one rule |
| Per-blade `import.meta.glob` | Manual registration imports | Loses auto-discovery benefit; more boilerplate |
| TypeScript project references | Single tsconfig with paths | Project references add complexity; not needed for this scale |

**Installation:** No new packages needed. This is a structural migration only.

## Architecture Patterns

### Current Project Structure (Layer-Based)
```
src/
  components/
    blades/
      StagingChangesBlade.tsx          # 15 blade components
      CommitDetailsBlade.tsx
      DiffBlade.tsx
      ...
      BladeContainer.tsx               # Shared blade infrastructure
      BladeRenderer.tsx
      BladePanel.tsx
      BladeStrip.tsx
      BladeLoadingFallback.tsx
      BladeErrorBoundary.tsx
      BladeToolbar.tsx
      BladeContentLoading.tsx
      BladeContentError.tsx
      BladeContentEmpty.tsx
      BladeBreadcrumb.tsx
      ProcessNavigation.tsx
      NavigationGuardDialog.tsx
      FileTreeBlade.tsx                # Sub-component used by CommitDetailsBlade
      index.ts                         # Barrel file re-exporting blade components
      registrations/
        index.ts                       # Auto-discovery via import.meta.glob
        staging-changes.ts             # 15 registration files
        diff.tsx
        ...
      *.test.tsx                       # 13 test files co-located in blades/
    staging/                           # Sub-components for staging-changes blade
    topology/                          # Sub-components for topology-graph blade
    commit/                            # Sub-components for conventional-commit blade
    changelog/                         # Sub-components for changelog blade
    settings/                          # Sub-components for settings blade
    init-repo/                         # Sub-components for init-repo blade
    gitflow/                           # Sub-components for gitflow-cheatsheet blade
    viewers/                           # Sub-components for viewer-nupkg blade
    markdown/                          # Sub-components for viewer-markdown blade
  stores/
    staging.ts                         # Blade-specific stores
    conventional.ts
    changelogStore.ts
    initRepo.ts
    topology.ts
    gitflow.ts
    settings.ts
    bladeTypes.ts                      # Shared: BladePropsMap, TypedBlade
    blades.ts                          # Deprecated: old blade store
  hooks/
    useBladeNavigation.ts              # Shared: used by many blades
    useBladeFormGuard.ts               # CC-blade specific
    useConventionalCommit.ts           # CC-blade specific
    useCommitExecution.ts              # CC-blade + CommitForm shared
    useAmendPrefill.ts                 # CC-blade + CommitForm shared
    useStagingKeyboard.ts              # Staging-blade specific
    useRepoFile.ts                     # Shared: viewer-code + viewer-markdown
    useCommitGraph.ts                  # Topology-blade specific
    useBranches.ts                     # Shared: sidebar
    useBulkSelect.ts                   # Shared: sidebar
    ...
  lib/
    bladeRegistry.ts                   # Core: registerBlade, getBladeRegistration
    bladeOpener.ts                     # Core: non-React blade opening
    bladeUtils.tsx                     # Shared: renderPathTitle, renderPathBreadcrumb
    fileDispatch.ts                    # Shared: file extension -> blade type mapping
    fileTypeUtils.ts                   # Shared: re-exports from fileDispatch
    ...
  machines/
    navigation/                        # XState navigation FSM (shared)
```

### Target Project Structure (Feature-Module)
```
src/
  blades/
    _shared/                           # Shared blade infrastructure
      BladeContainer.tsx
      BladeRenderer.tsx
      BladePanel.tsx
      BladeStrip.tsx
      BladeLoadingFallback.tsx
      BladeErrorBoundary.tsx
      BladeToolbar.tsx
      BladeContentLoading.tsx
      BladeContentError.tsx
      BladeContentEmpty.tsx
      BladeBreadcrumb.tsx
      ProcessNavigation.tsx
      NavigationGuardDialog.tsx
      FileTreeBlade.tsx                # Shared sub-component
      index.ts                         # Barrel: re-exports shared components
    _registry/                         # Auto-discovery hub
      index.ts                         # import.meta.glob scanning all blade dirs
    staging-changes/
      StagingChangesBlade.tsx          # Main component
      StagingChangesBlade.test.tsx     # Test
      registration.ts                  # registerBlade() call
      store.ts                         # useStagingStore (currently stores/staging.ts)
      hooks.ts                         # useStagingKeyboard (if blade-exclusive)
      components/                      # Sub-components (from components/staging/)
        StagingPanel.tsx
        StagingDiffPreview.tsx
        FileList.tsx
        ...
    diff/
      DiffBlade.tsx
      DiffBlade.test.tsx
      registration.tsx
      types.ts                         # DiffSource type (currently exported from DiffBlade)
    conventional-commit/
      ConventionalCommitBlade.tsx
      ConventionalCommitBlade.test.tsx
      registration.ts
      store.ts                         # useConventionalStore
      hooks.ts                         # useConventionalCommit, useBladeFormGuard, etc.
      components/                      # From components/commit/ (CC-specific parts)
        TypeSelector.tsx
        ScopeAutocomplete.tsx
        ...
    topology-graph/
      TopologyRootBlade.tsx
      TopologyRootBlade.test.tsx
      registration.ts
      store.ts                         # useTopologyStore
      hooks.ts                         # useCommitGraph
      components/                      # From components/topology/
    settings/
      SettingsBlade.tsx
      SettingsBlade.test.tsx
      registration.ts
      store.ts                         # useSettingsStore (shared with App.tsx!)
      components/                      # From components/settings/
    changelog/
      ChangelogBlade.tsx
      ChangelogBlade.test.tsx
      registration.ts
      store.ts                         # useChangelogStore
      components/
        ChangelogPreview.tsx
    viewer-code/
      ViewerCodeBlade.tsx
      ViewerCodeBlade.test.tsx
      registration.ts
    viewer-markdown/
      ViewerMarkdownBlade.tsx
      ViewerMarkdownBlade.test.tsx
      registration.ts
      components/                      # From components/markdown/
    viewer-image/
      ViewerImageBlade.tsx
      ViewerImageBlade.test.tsx
      registration.ts
    viewer-nupkg/
      ViewerNupkgBlade.tsx
      ViewerNupkgBlade.test.tsx
      registration.ts
      components/
        NugetPackageViewer.tsx
    viewer-3d/
      Viewer3dBlade.tsx
      Viewer3dBlade.test.tsx
      registration.ts
    repo-browser/
      RepoBrowserBlade.tsx
      RepoBrowserBlade.test.tsx
      registration.tsx
    commit-details/
      CommitDetailsBlade.tsx
      CommitDetailsBlade.test.tsx
      registration.ts
    gitflow-cheatsheet/
      GitflowCheatsheetBlade.tsx
      GitflowCheatsheetBlade.test.tsx
      registration.ts
      components/                      # From components/gitflow/ (subset)
    init-repo/
      InitRepoBlade.tsx
      registration.ts
      store.ts                         # useInitRepoStore
      components/                      # From components/init-repo/
  components/                          # Non-blade components stay here
    Header.tsx
    RepositoryView.tsx
    WelcomeView.tsx
    RecentRepos.tsx
    branches/
    clone/
    command-palette/
    commit/                            # Shared commit components (CommitForm, CommitHistory)
    icons/
    layout/
    stash/
    sync/
    tags/
    ui/
    welcome/
    worktree/
  stores/                              # Shared, non-blade-specific stores
    repository.ts
    navigation.ts
    theme.ts
    toast.ts
    undo.ts
    stash.ts
    branches.ts
    tags.ts
    worktrees.ts
    clone.ts
    commandPalette.ts
    branchMetadata.ts
    reviewChecklist.ts
    bladeTypes.ts                      # Shared: BladePropsMap definition
    blades.ts                          # Deprecated store
  hooks/                               # Shared, non-blade-specific hooks
    useBladeNavigation.ts              # Shared: used by many blades
    useRepoFile.ts                     # Shared: used by viewer-code + viewer-markdown
    useRecentRepos.ts
    useBranches.ts
    useBranchScopes.ts
    useBulkSelect.ts
    useKeyboardShortcuts.ts
  lib/                                 # Shared utilities
    bladeRegistry.ts                   # Core registry
    bladeOpener.ts
    bladeUtils.tsx
    fileDispatch.ts
    fileTypeUtils.ts
    ...
  machines/
    navigation/                        # XState FSM (stays shared)
```

### Pattern 1: Auto-Discovery with Dual-Glob (Migration Period)
**What:** The registry index scans both old and new locations during migration.
**When to use:** During the gradual migration when blades exist in both structures.
**Confidence:** HIGH (based on Vite import.meta.glob documentation)

```typescript
// src/blades/_registry/index.ts (migration version)
import { clearRegistry, getAllBladeTypes } from "../../lib/bladeRegistry";

// Scan BOTH old (flat registrations/) and new (per-blade registration.ts) locations
const oldModules = import.meta.glob(
  ["../../components/blades/registrations/*.{ts,tsx}", "!../../components/blades/registrations/index.ts"],
  { eager: true }
);
const newModules = import.meta.glob(
  ["../**/registration.{ts,tsx}", "!./_shared/**", "!./_registry/**"],
  { eager: true }
);

// Dev guard: check for expected blade count
if (import.meta.env.DEV && Object.keys(oldModules).length + Object.keys(newModules).length === 0) {
  console.error("[BladeRegistry] No registration modules found");
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

### Pattern 2: Per-Blade Registration File (Co-located)
**What:** Each blade's `registration.ts` calls `registerBlade()` with a relative import to the component.
**When to use:** For every migrated blade.
**Confidence:** HIGH

```typescript
// src/blades/settings/registration.ts
import { registerBlade } from "@/lib/bladeRegistry";
import { SettingsBlade } from "./SettingsBlade";

registerBlade({
  type: "settings",
  defaultTitle: "Settings",
  component: SettingsBlade,
  singleton: true,
});
```

### Pattern 3: Blade-Specific Barrel File
**What:** Each blade directory exports its public API through an `index.ts`.
**When to use:** When other modules need to import from a blade (e.g., DiffSource type).
**Confidence:** HIGH

```typescript
// src/blades/diff/index.ts
export type { DiffSource } from "./types";
// Do NOT re-export DiffBlade — it's loaded via registration only
```

### Pattern 4: Shared Infrastructure Barrel
**What:** The `_shared/` directory re-exports all shared blade components.
**When to use:** When blade components need shared UI primitives.
**Confidence:** HIGH

```typescript
// src/blades/_shared/index.ts
export { BladePanel } from "./BladePanel";
export { BladeContentLoading } from "./BladeContentLoading";
export { BladeContentError } from "./BladeContentError";
export { BladeContentEmpty } from "./BladeContentEmpty";
export { BladeLoadingFallback } from "./BladeLoadingFallback";
export { BladeBreadcrumb } from "./BladeBreadcrumb";
// etc.
```

### Anti-Patterns to Avoid
- **Cross-blade imports:** `staging-changes/` must never import from `diff/`. If shared logic is needed, extract to `_shared/` or `lib/`.
- **God barrel file:** Do not create a single `blades/index.ts` re-exporting everything. Each blade should be self-contained.
- **Moving shared stores into blades prematurely:** If a store is used outside its blade (e.g., `useSettingsStore` in `App.tsx`, `useTopologyStore` in `App.tsx`), keep it in `stores/` or create a `_shared/stores/` directory. Only move stores that are exclusively used within one blade.
- **Breaking auto-discovery glob:** The `import.meta.glob` pattern must match registration files. Using inconsistent names (e.g., `register.ts` vs `registration.ts`) will silently skip blades.

## Current Codebase Analysis

### Complete Blade Inventory (15 blade types)

| Blade Type | Component | Registration | Store | Hooks | Sub-components Dir | Test |
|------------|-----------|-------------|-------|-------|--------------------|------|
| `staging-changes` | StagingChangesBlade.tsx | staging-changes.ts | staging.ts | useStagingKeyboard.ts | components/staging/ (10 files) | Yes |
| `topology-graph` | TopologyRootBlade.tsx | topology-graph.ts | topology.ts | useCommitGraph.ts | components/topology/ (6 files) | Yes |
| `commit-details` | CommitDetailsBlade.tsx | commit-details.ts | - | - | uses FileTreeBlade (shared) | Yes |
| `diff` | DiffBlade.tsx | diff.tsx | - | - | - | Yes |
| `repo-browser` | RepoBrowserBlade.tsx | repo-browser.tsx | - | - | - | Yes |
| `conventional-commit` | ConventionalCommitBlade.tsx | conventional-commit.ts | conventional.ts | useConventionalCommit, useBladeFormGuard, useCommitExecution, useAmendPrefill | components/commit/ (partial) | - |
| `settings` | SettingsBlade.tsx | settings.ts | settings.ts | - | components/settings/ (7 files) | Yes |
| `changelog` | ChangelogBlade.tsx | changelog.ts | changelogStore.ts | - | components/changelog/ (2 files) | Yes |
| `init-repo` | InitRepoBlade.tsx | init-repo.ts | initRepo.ts | useGitignoreTemplates (partial) | components/init-repo/ (5 files) | - |
| `gitflow-cheatsheet` | GitflowCheatsheetBlade.tsx | gitflow-cheatsheet.ts | gitflow.ts | - | components/gitflow/ (partial) | Yes |
| `viewer-code` | ViewerCodeBlade.tsx | viewer-code.ts | - | useRepoFile (shared) | - | Yes |
| `viewer-markdown` | ViewerMarkdownBlade.tsx | viewer-markdown.ts | - | useRepoFile (shared) | components/markdown/ (5 files) | Yes |
| `viewer-image` | ViewerImageBlade.tsx | viewer-image.ts | - | - | - | Yes |
| `viewer-nupkg` | ViewerNupkgBlade.tsx | viewer-nupkg.ts | - | - | components/viewers/ (3 files) | Yes |
| `viewer-3d` | Viewer3dBlade.tsx | viewer-3d.ts | - | - | - | Yes |

### File Count Summary
- **Total files in `src/components/blades/`:** 59 files
- **Blade component files:** 15 (one per blade type) + 1 (FileTreeBlade sub-component)
- **Shared infrastructure files:** 12 (BladeContainer, BladeRenderer, BladePanel, etc.)
- **Registration files:** 15 + 1 index
- **Test files:** 13
- **Barrel file:** 1 (index.ts)

### Cross-Blade Import Dependencies (CRITICAL)

These imports cross blade boundaries and must be refactored:

1. **CommitDetailsBlade -> FileTreeBlade:** Direct import `import { FileTreeBlade } from "./FileTreeBlade"`. FileTreeBlade is NOT a standalone blade (no registration). It is a shared sub-component used only by CommitDetailsBlade. **Resolution:** Move FileTreeBlade to `_shared/` since it is a reusable UI component, not a blade type itself.

2. **DiffSource type exported from DiffBlade.tsx:** Three files import `DiffSource` from DiffBlade:
   - `src/stores/bladeTypes.ts` (the central type map)
   - `src/components/blades/registrations/diff.tsx` (the registration)
   - `src/lib/previewRegistry.ts`
   **Resolution:** Extract `DiffSource` to a standalone types file (`src/blades/diff/types.ts` or `src/lib/diffTypes.ts`). The type should NOT live in the component file.

3. **BladeBreadcrumb imported by bladeUtils.tsx:** `src/lib/bladeUtils.tsx` imports from `src/components/blades/BladeBreadcrumb`. After migration, BladeBreadcrumb moves to `_shared/`. The import path in bladeUtils must update.

4. **InitRepoBlade imported by WelcomeView.tsx:** `src/components/WelcomeView.tsx` directly imports `InitRepoBlade` component. This is used outside the blade context (rendered directly in WelcomeView, not via BladeRenderer). **Resolution:** This is an unusual usage pattern. The WelcomeView import should reference the new location.

### Stores Classification

**Blade-exclusive stores** (safe to co-locate):
| Store | File | Used By |
|-------|------|---------|
| `useChangelogStore` | changelogStore.ts | ChangelogBlade only |
| `useInitRepoStore` | initRepo.ts | InitRepoBlade + init-repo/ sub-components only |

**Blade-primary stores** (used mostly by blade, but also elsewhere):
| Store | File | Used By | External Consumer |
|-------|------|---------|-------------------|
| `useStagingStore` | staging.ts | StagingChangesBlade + staging/ components + DiffBlade | DiffBlade (cross-blade!) |
| `useConventionalStore` | conventional.ts | ConventionalCommitBlade + useConventionalCommit hook | ConventionalCommitForm (sidebar) |
| `useTopologyStore` | topology.ts | TopologyRootBlade + topology/ components | App.tsx (auto-refresh) |
| `useSettingsStore` | settings.ts | SettingsBlade + settings/ components | App.tsx (init), GitSettings, IntegrationsSettings |
| `useGitflowStore` | gitflow.ts | GitflowCheatsheetBlade + gitflow/ components | gitflow/ sidebar components |

**Decision needed:** Stores used by both blade components and sidebar components (like `useGitflowStore`, `useSettingsStore`) should remain in the shared `stores/` directory or be re-exported from the blade via its `index.ts`.

### Hooks Classification

**Blade-exclusive hooks** (safe to co-locate):
| Hook | File | Used By |
|------|------|---------|
| `useStagingKeyboard` | useStagingKeyboard.ts | StagingChangesBlade only |
| `useBladeFormGuard` | useBladeFormGuard.ts | ConventionalCommitBlade only |

**Shared hooks** (must stay in `hooks/`):
| Hook | File | Used By |
|------|------|---------|
| `useBladeNavigation` | useBladeNavigation.ts | 7+ blade components |
| `useRepoFile` | useRepoFile.ts | ViewerCodeBlade + ViewerMarkdownBlade |
| `useConventionalCommit` | useConventionalCommit.ts | ConventionalCommitBlade + ConventionalCommitForm (sidebar) |
| `useCommitExecution` | useCommitExecution.ts | ConventionalCommitBlade + CommitForm (sidebar) |
| `useAmendPrefill` | useAmendPrefill.ts | ConventionalCommitBlade + CommitForm (sidebar) |
| `useCommitGraph` | useCommitGraph.ts | TopologyPanel (blade sub-component) |

### Shared Infrastructure Files (Stay in `_shared/`)

These are blade-framework components, not individual blade types:
- `BladeContainer.tsx` - Renders the blade stack with animations
- `BladeRenderer.tsx` - Dispatches to correct blade component via registry
- `BladePanel.tsx` - Standard panel wrapper (title, back button, toolbar)
- `BladeStrip.tsx` - Collapsed blade strip in the stack
- `BladeLoadingFallback.tsx` - Suspense fallback for lazy blades
- `BladeErrorBoundary.tsx` - Error boundary wrapper
- `BladeToolbar.tsx` - Toolbar component
- `BladeContentLoading.tsx` - Content loading state
- `BladeContentError.tsx` - Content error state
- `BladeContentEmpty.tsx` - Content empty state
- `BladeBreadcrumb.tsx` - Path breadcrumb navigation
- `ProcessNavigation.tsx` - Process tab switcher
- `NavigationGuardDialog.tsx` - Dirty-state confirmation dialog
- `FileTreeBlade.tsx` - Reusable file tree component (used by CommitDetailsBlade)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Import boundary enforcement | Custom Biome plugin | Grep/script-based CI check | Biome has no `no-restricted-paths` rule; a simple `grep -r` script checking for cross-blade imports is sufficient and maintainable |
| Module auto-discovery | Manual import list | `import.meta.glob` (Vite) | Already in use; proven pattern with HMR support |
| Path aliases | Manual relative paths | `@/` alias (already configured) | Vite `resolve.alias` already maps `@` to `/src` |

**Key insight:** The migration is purely structural. No new runtime code or libraries are needed. The risk is in import path updates and auto-discovery glob pattern changes.

## Common Pitfalls

### Pitfall 1: Silent Blade Disappearance
**What goes wrong:** A blade stops loading after migration because the `import.meta.glob` pattern doesn't match its new `registration.ts` file path.
**Why it happens:** Glob patterns are evaluated at build time. A typo in the path pattern or an inconsistent file name silently excludes the blade.
**How to avoid:** Keep the dev-mode exhaustiveness check (the `EXPECTED_TYPES` array validation in the registry index). Run it on every dev startup and in CI.
**Warning signs:** A blade type appears in `BladePropsMap` but produces "Unknown blade: {type}" at runtime.

### Pitfall 2: Circular Dependencies from Type Exports
**What goes wrong:** `DiffSource` type is defined in `DiffBlade.tsx` and imported by `bladeTypes.ts`, which is imported by `bladeRegistry.ts`, which is imported by `DiffBlade` registration. This creates a circular dependency chain.
**Why it happens:** Types are co-located with components instead of in standalone type files.
**How to avoid:** Extract shared types (like `DiffSource`) to dedicated type files BEFORE moving components. Specifically, move `DiffSource` to `src/blades/diff/types.ts` or `src/lib/diffTypes.ts`.
**Warning signs:** TypeScript reporting `any` types or runtime `undefined` for imported values.

### Pitfall 3: Broken Relative Imports After Move
**What goes wrong:** After moving files, some imports break because relative paths change depth.
**Why it happens:** A file at `components/blades/DiffBlade.tsx` using `../../stores/staging` moves to `blades/diff/DiffBlade.tsx` where the relative path is now `../../stores/staging` (same depth coincidentally, but others change).
**How to avoid:** Use the `@/` path alias for all cross-module imports. Within a blade directory, use `./` relative imports only for sibling files.
**Warning signs:** TypeScript red squiggles in IDE, build failures.

### Pitfall 4: Shared Component Directories Conflated with Blade-Specific
**What goes wrong:** `components/commit/` contains BOTH blade-specific components (TypeSelector, ScopeAutocomplete) AND shared components (CommitForm, CommitHistory). Moving the whole directory into the conventional-commit blade breaks the shared components.
**Why it happens:** The layer-based structure lumped all commit-related components together regardless of consumer.
**How to avoid:** Audit each sub-component's consumers before moving. Split directories: blade-specific parts go into the blade, shared parts stay in `components/`.
**Warning signs:** Import errors from sidebar components after migration.

### Pitfall 5: Git History Lost
**What goes wrong:** Using `cp` + `rm` instead of `git mv` breaks file history tracking.
**Why it happens:** Developer habit or tooling default.
**How to avoid:** Always use `git mv` for file moves. For directory moves, use `git mv src/components/blades/SettingsBlade.tsx src/blades/settings/SettingsBlade.tsx`.
**Warning signs:** `git log --follow` shows no history before the move commit.

### Pitfall 6: Test Mock Paths Break
**What goes wrong:** Tests use `vi.mock("../../bindings")` with relative paths. After moving the test file, the mock path is wrong.
**Why it happens:** Vitest resolves `vi.mock()` paths relative to the test file location.
**How to avoid:** Use `@/bindings` absolute alias in mock calls. Or update mock paths when moving test files.
**Warning signs:** Tests fail with "Cannot find module" errors.

## Code Examples

### Example 1: Updated Auto-Discovery Index (Final State)
```typescript
// src/blades/_registry/index.ts
import { clearRegistry, getAllBladeTypes } from "@/lib/bladeRegistry";

// Scan all registration.{ts,tsx} files in blade directories
const modules = import.meta.glob(
  ["../**/registration.{ts,tsx}", "!./_shared/**", "!./_registry/**"],
  { eager: true }
);

if (import.meta.env.DEV && Object.keys(modules).length === 0) {
  console.error("[BladeRegistry] No registration modules found");
}

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
      `[BladeRegistry] Missing registrations for: ${missing.join(", ")}`
    );
  }
}

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose((data) => {
    data.isUpdate = true;
    clearRegistry();
  });
}
```

### Example 2: Import App.tsx Updated
```typescript
// App.tsx - change import from old registrations path to new registry
import "./blades/_registry";  // was: "./components/blades/registrations"
```

### Example 3: Migrated Blade with Co-located Store
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

// src/blades/changelog/store.ts
import { create } from "zustand";
import { commands } from "@/bindings";
import type { ChangelogOutput } from "@/bindings";
// ... same store code, just different location
```

### Example 4: Import Boundary Check Script
```bash
#!/bin/bash
# scripts/check-blade-boundaries.sh
# Verify no blade imports from another blade

EXIT=0
for blade_dir in src/blades/*/; do
  blade_name=$(basename "$blade_dir")
  [[ "$blade_name" == _* ]] && continue  # Skip _shared, _registry

  # Check if any file in this blade imports from another blade
  other_blades=$(ls -d src/blades/*/ | xargs -I{} basename {} | grep -v "^_" | grep -v "^$blade_name$")
  for other in $other_blades; do
    if grep -r "from.*blades/$other" "$blade_dir" --include="*.ts" --include="*.tsx" -l 2>/dev/null; then
      echo "ERROR: $blade_dir imports from blades/$other/"
      EXIT=1
    fi
  done
done
exit $EXIT
```

### Example 5: TypeScript Path Aliases (tsconfig.json)
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@blades/*": ["src/blades/*"]
    }
  }
}
```

Note: The `@` alias is already configured in `vite.config.ts` but NOT in `tsconfig.json`. For full IDE support, `tsconfig.json` needs the `paths` entry. However, since the project currently uses relative imports throughout, adding `paths` is optional for Phase 29 -- the Vite alias is sufficient for runtime.

## Migration Strategy

### Phase 29 Plan Structure (Recommended 3-4 Plans)

**Plan 1: Scaffolding and Infrastructure**
- Create `src/blades/_shared/` directory with shared infrastructure
- Move 14 shared components (BladeContainer, BladeRenderer, etc.) via `git mv`
- Create `src/blades/_registry/index.ts` with dual-glob (old + new)
- Update `App.tsx` import to new registry location
- Update `RepositoryView.tsx` import of `BladeContainer`
- Extract `DiffSource` type from `DiffBlade.tsx` to standalone file
- Update all imports of shared blade components
- Verify all 15 blades still load (run existing smoke tests)

**Plan 2: Migrate Simple Blades (no stores, no sub-components)**
- Move viewer-image, viewer-3d, viewer-nupkg, commit-details, repo-browser
- Each blade gets: directory, component file, registration file, test file
- Remove migrated registrations from old `registrations/` directory
- Verify via smoke tests

**Plan 3: Migrate Medium Blades (with stores or sub-components)**
- Move settings, changelog, viewer-code, viewer-markdown, gitflow-cheatsheet
- Co-locate blade-exclusive stores; leave shared stores in `stores/`
- Move blade-specific sub-components from `components/{name}/` directories
- Handle shared sub-component directories carefully (split if needed)

**Plan 4: Migrate Complex Blades + Import Boundaries**
- Move staging-changes, topology-graph, diff, conventional-commit, init-repo
- These have the most external dependencies; move carefully
- Split `components/commit/` between CC blade and shared
- Add import boundary check script to CI
- Remove old `components/blades/registrations/` directory
- Remove old `components/blades/` directory (should be empty)
- Final cleanup: update remaining relative imports to use `@/` alias where helpful

### Migration Order (Least to Most Complex)

1. **Tier 1 - Self-contained (no store, no sub-components):**
   - `viewer-image` - Zero dependencies beyond shared
   - `viewer-3d` - Zero dependencies beyond shared
   - `viewer-code` - Only uses shared `useRepoFile` hook
   - `commit-details` - Only uses shared FileTreeBlade
   - `repo-browser` - Only uses shared BladeBreadcrumb

2. **Tier 2 - Own store, simple sub-components:**
   - `changelog` - Exclusive store, 1 sub-component
   - `viewer-markdown` - Uses shared hook + markdown components
   - `viewer-nupkg` - Has NugetPackageViewer sub-component
   - `settings` - Own store (shared with App.tsx!) + 7 sub-components

3. **Tier 3 - Complex, many dependencies:**
   - `gitflow-cheatsheet` - Store shared with gitflow sidebar
   - `init-repo` - Exclusive store + 5 sub-components
   - `topology-graph` - Store used by App.tsx + 6 sub-components
   - `staging-changes` - Store used by DiffBlade + 10 sub-components
   - `diff` - DiffSource type cross-referenced everywhere
   - `conventional-commit` - 4 hooks (some shared with sidebar), many sub-components

### Backward Compatibility During Migration

The dual-glob pattern ensures that:
1. Blades in the OLD location (`components/blades/registrations/`) continue to work
2. Blades in the NEW location (`blades/{name}/registration.ts`) are also discovered
3. Both can coexist indefinitely; no big-bang migration needed
4. Each blade can be migrated in its own commit for clean git history

### Git History Preservation

- Use `git mv` for all file moves
- Move one blade at a time in separate commits
- Each commit message: `refactor(structure): migrate {blade-name} to feature module`
- Run `git log --follow src/blades/settings/SettingsBlade.tsx` to verify history preservation

## TypeScript Path Aliases

### Current State
- **vite.config.ts:** `resolve.alias: { "@": "/src" }` -- CONFIGURED
- **tsconfig.json:** No `paths` or `baseUrl` -- NOT CONFIGURED

### Impact
- Vite resolves `@/` imports at build time and dev server -- works for runtime
- TypeScript/IDE won't resolve `@/` without `paths` in tsconfig -- affects IntelliSense
- Existing codebase uses relative imports exclusively (no `@/` imports found)

### Recommendation
Add `paths` to `tsconfig.json` for IDE support, but do NOT mass-convert existing imports. Use `@/` selectively for new cross-module imports during migration:

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

This is a non-breaking change. Existing relative imports continue to work. New imports in migrated blades can use either `@/lib/bladeRegistry` or `../../lib/bladeRegistry`.

## Open Questions

1. **Where should `DiffSource` type ultimately live?**
   - What we know: Currently exported from `DiffBlade.tsx`, imported by `bladeTypes.ts`, `previewRegistry.ts`, and `registrations/diff.tsx`
   - What's unclear: Should it be in `src/blades/diff/types.ts` (making other modules depend on the diff blade) or in `src/lib/diffTypes.ts` (truly shared)?
   - Recommendation: Put it in `src/lib/diffTypes.ts` since it is used by the shared `bladeTypes.ts` file. A shared type should live in shared space.

2. **How to handle `components/commit/` split?**
   - What we know: Contains both CC-blade-specific components (TypeSelector, ScopeAutocomplete, etc.) and shared components (CommitForm, CommitHistory used by sidebar)
   - What's unclear: Exact boundary of which files go where
   - Recommendation: CommitForm, CommitHistory, CommitDetails, CommitSearch stay in `components/commit/`. TypeSelector, ScopeAutocomplete, BreakingChangeSection, CharacterProgress, ValidationErrors, CommitPreview, CommitActionBar, TemplateSelector, ScopeFrequencyChart move to `blades/conventional-commit/components/`.

3. **Should `useSettingsStore` move to the settings blade?**
   - What we know: Used by `App.tsx` (init), `SettingsBlade`, and 3 settings sub-components
   - What's unclear: App.tsx dependency makes it "shared"
   - Recommendation: Keep in `stores/settings.ts` for now. Phase 30 (Store Consolidation) will address this.

4. **Should `useCommitExecution` and `useAmendPrefill` move to the CC blade?**
   - What we know: Both are used by ConventionalCommitBlade AND CommitForm (sidebar)
   - What's unclear: They serve both the blade and the sidebar
   - Recommendation: Keep in `hooks/` since they serve multiple consumers.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: Direct file reads of all 59 blade files, 25 store files, 14 hook files
- `/vitejs/vite` Context7 docs - `import.meta.glob` eager loading patterns
- `/biomejs/biome` Context7 docs - Confirmed no `no-restricted-paths` rule exists

### Secondary (MEDIUM confidence)
- [Biome Roadmap 2026](https://biomejs.dev/blog/roadmap-2026/) - Module graph infrastructure exists but no import boundary enforcement planned
- [Biome vs ESLint comparison](https://betterstack.com/community/guides/scaling-nodejs/biome-eslint/) - Confirmed Biome limitations for module boundaries

### Tertiary (LOW confidence)
- Feature-module patterns from React community: General consensus from multiple React architecture guides that co-location is preferred, but no single authoritative source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; all tooling already in place
- Architecture: HIGH - Based on exhaustive codebase analysis with exact file counts and dependency mapping
- Migration strategy: HIGH - Based on measured dependencies; each blade's complexity categorized
- Import boundaries: MEDIUM - Biome lacks native support; custom script approach is simple but untested
- Pitfalls: HIGH - Based on actual dependency analysis revealing real circular dependency risks

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable; structure migration doesn't depend on external library changes)
