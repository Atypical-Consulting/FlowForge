# Phase 29: Blade-Centric File Structure - Consolidated Research

**Researched:** 2026-02-09
**Confidence:** HIGH
**Perspectives Synthesized:** UX/DX, Architecture, Extensibility

---

## Executive Summary

Phase 29 migrates FlowForge from a layer-based file organization (top-level `components/`, `stores/`, `hooks/`) to a blade-centric feature-module structure where each blade's files are co-located under `blades/{blade-name}/`. This consolidation synthesizes findings from three research perspectives: **UX/DX** (developer experience), **Architecture** (technical feasibility), and **Extensibility** (future-proofing).

### Key Findings (Cross-Perspective Agreement)

All three research documents agree on these core findings:

1. **15 blade types** currently have files scattered across 4+ directories, creating discovery friction and implicit coupling
2. **`import.meta.glob` auto-discovery** mechanism can be adapted from the current flat `registrations/` directory to scan `blades/*/registration.ts`
3. **Biome `noPrivateImports` rule** with `@package` annotations provides ready-made import boundary enforcement
4. **Tauri v2 has zero coupling** to frontend file structure (communicates only through `bindings.ts` IPC layer)
5. **Tailwind v4 automatic content detection** scans all source files; moving files within `src/` has no impact
6. **Only 2 stores should move** into blade directories (`changelogStore`, `initRepo`); 19 stores stay shared
7. **DiffSource type extraction** from `DiffBlade.tsx` to a standalone types file is a prerequisite step
8. **Migration order: simple to complex** (self-contained viewer blades first, cross-dependent blades last)

### Conflicting Perspectives Resolved

#### Where Should Shared Infrastructure Live?

- **UX research:** Recommends `blades/_infrastructure/` (physical proximity, underscore signals "not a blade")
- **Architecture research:** Recommends `blades/_shared/` (logical grouping with infrastructure components)
- **Extensibility research:** Recommends `blades/_shared/` (consistent naming, exports via barrel)
- **Resolution:** Use `blades/_shared/` for shared infrastructure components (BladeContainer, BladeRenderer, BladePanel, etc.) because it enables a clean public API via `index.ts` and aligns with the "shared within domain" semantic.

#### Should All Blades Be Lazy-Loaded?

- **UX research:** No strong position; focuses on HMR preservation
- **Architecture research:** Documents existing pattern (6 of 15 blades lazy)
- **Extensibility research:** Recommends making ALL non-root blades lazy for optimal code-splitting
- **Resolution:** Make all non-root blades lazy (staging-changes and topology-graph are root blades for their processes). Each blade's `registration.ts` uses `React.lazy()` for automatic chunk splitting.

#### Should `@/` Path Alias Be Activated?

- **UX research:** YES, add `paths` to tsconfig.json during Phase 29 (lower total cost than two passes)
- **Architecture research:** Optional, notes it's already in Vite config but not tsconfig
- **Extensibility research:** YES for new imports only, don't mass-convert existing imports
- **Resolution:** Add `"paths": { "@/*": ["src/*"] }` to `tsconfig.json` in Phase 29 for IDE support. Use `@/` selectively for cross-module imports in migrated blades. Do NOT mass-convert existing relative imports.

---

## Target Directory Structure

```
src/
  blades/                           # All blade feature modules
    _shared/                        # Shared blade infrastructure
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
      FileTreeBlade.tsx             # Reusable sub-component (not a blade type)
      index.ts                      # Public API barrel
    _discovery.ts                   # import.meta.glob auto-discovery + HMR
    changelog/
      ChangelogBlade.tsx
      ChangelogBlade.test.tsx
      registration.ts
      store.ts                      # Blade-specific store (move from stores/)
      components/
        ChangelogPreview.tsx
      index.ts                      # Public API (types only)
    commit-details/
      CommitDetailsBlade.tsx
      CommitDetailsBlade.test.tsx
      registration.ts
      index.ts
    conventional-commit/
      ConventionalCommitBlade.tsx
      ConventionalCommitBlade.test.tsx
      registration.ts
      components/
        TypeSelector.tsx
        ScopeAutocomplete.tsx
        # ... (blade-specific commit sub-components)
      utils/
        conventional-utils.ts
      index.ts
    diff/
      DiffBlade.tsx
      DiffBlade.test.tsx
      registration.tsx
      types.ts                      # DiffSource (extracted from component)
      index.ts
    gitflow-cheatsheet/
      GitflowCheatsheetBlade.tsx
      GitflowCheatsheetBlade.test.tsx
      registration.ts
      components/
        GitflowPanel.tsx
        GitflowActionCards.tsx
        GitflowDiagram.tsx
      index.ts
    init-repo/
      InitRepoBlade.tsx
      registration.ts
      store.ts                      # Blade-specific store (move from stores/)
      components/
        InitRepoForm.tsx
        InitRepoPreview.tsx
        TemplatePicker.tsx
        # ... (5 more sub-components)
      index.ts
    repo-browser/
      RepoBrowserBlade.tsx
      RepoBrowserBlade.test.tsx
      registration.tsx
      index.ts
    settings/
      SettingsBlade.tsx
      SettingsBlade.test.tsx
      registration.ts
      components/
        GeneralSettings.tsx
        AppearanceSettings.tsx
        GitSettings.tsx
        IntegrationsSettings.tsx
        ReviewSettings.tsx
        SettingsField.tsx
      index.ts
    staging-changes/
      StagingChangesBlade.tsx
      StagingChangesBlade.test.tsx
      registration.ts
      hooks/
        useStagingKeyboard.ts       # Blade-exclusive hook
      components/
        StagingPanel.tsx
        StagingDiffPreview.tsx
        FileList.tsx
        FileItem.tsx
        # ... (10 sub-components)
      index.ts
    topology-graph/
      TopologyRootBlade.tsx
      TopologyRootBlade.test.tsx
      registration.ts
      components/
        TopologyPanel.tsx
        CommitBadge.tsx
        LaneBackground.tsx
        LaneHeader.tsx
        layoutUtils.ts
      index.ts
    viewer-3d/
      Viewer3dBlade.tsx
      Viewer3dBlade.test.tsx
      registration.ts
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
    viewer-nupkg/
      ViewerNupkgBlade.tsx
      ViewerNupkgBlade.test.tsx
      registration.ts
      components/
        NugetPackageViewer.tsx
      index.ts
  components/                       # Non-blade shared components
    commit/                         # Shared commit UI (sidebar CommitForm)
    ui/                             # Shared UI primitives
    layout/                         # Layout components
    markdown/                       # Shared markdown renderer
    Header.tsx
    RepositoryView.tsx
    WelcomeView.tsx
    # ... (branches, clone, command-palette, stash, tags, worktree, etc.)
  stores/                           # Cross-cutting Zustand stores
    repository.ts
    staging.ts                      # Shared (used by staging + diff blades)
    conventional.ts                 # Shared (used by blade + sidebar)
    topology.ts                     # Shared (used by blade + App.tsx)
    gitflow.ts                      # Shared (used by blade + gitflow components)
    settings.ts                     # Shared (used by blade + App.tsx)
    navigation.ts
    theme.ts
    toast.ts
    commandPalette.ts
    branches.ts
    bladeTypes.ts                   # Shared: BladePropsMap, BladeType
    # ... (19 total stores stay shared)
  hooks/                            # Shared hooks
    useBladeNavigation.ts           # Infrastructure hook (many blades)
    useBladeFormGuard.ts            # Shared (CC blade + others)
    useRepoFile.ts                  # Shared (viewer-code + viewer-markdown)
    useConventionalCommit.ts        # Shared (blade + sidebar)
    useCommitExecution.ts           # Shared (blade + sidebar)
    useAmendPrefill.ts              # Shared (blade + sidebar)
    # ... (other shared hooks)
  lib/                              # Shared utilities
    bladeRegistry.ts                # Core: registerBlade, getBladeRegistration
    bladeOpener.ts                  # Core: non-React blade opening
    bladeUtils.tsx                  # renderPathTitle, renderPathBreadcrumb
    fileDispatch.ts                 # File extension -> blade type mapping
    animations.ts                   # Blade transition animations
    # ... (other utilities)
  machines/
    navigation/                     # XState navigation FSM (shared)
```

---

## Migration Strategy

### Incremental Migration (4 Waves)

**Goal:** Migrate blade-by-blade with dual-glob discovery pattern supporting both old and new locations during transition. Each wave is a separate plan.

#### Wave 1: Scaffolding and Prerequisite Fixes (Plan 1)

**Purpose:** Set up the new structure without breaking existing blades.

1. Create `src/blades/_shared/` directory
2. Move 14 shared components via `git mv` (BladeContainer, BladeRenderer, BladePanel, etc.)
3. Create `src/blades/_shared/index.ts` barrel exporting shared components
4. Create `src/blades/_discovery.ts` with dual-glob (old + new locations)
5. Update `App.tsx` import to new discovery location
6. Extract `DiffSource` type from `DiffBlade.tsx` to `src/blades/diff/types.ts` (prerequisite for diff migration)
7. Update all imports of shared blade components to use `@blades/_shared`
8. Verify all 15 blades still load (run smoke tests)

**Risk:** LOW. Shared components move but all blade types stay in old location.

**Exit criteria:** All tests pass, all blades render, HMR works.

#### Wave 2: Simple Self-Contained Blades (Plan 2)

**Purpose:** Establish the pattern with lowest-risk blades (no stores, no sub-components).

**Migrate:** `viewer-image`, `viewer-3d`, `commit-details`, `repo-browser`

Each blade gets:
- Directory `src/blades/{blade-name}/`
- Component file (via `git mv`)
- Test file (via `git mv`)
- New `registration.ts` with `React.lazy()`
- New `index.ts` barrel (types-only export)

**Post-migration per blade:**
- Delete old registration file from `components/blades/registrations/`
- Run smoke test
- Verify blade loads and navigates correctly

**Risk:** LOW. These blades have zero sub-components and no blade-specific stores.

**Exit criteria:** 4 blades migrated, tests pass, dual-glob discovery works.

#### Wave 3: Medium Complexity Blades (Plan 3)

**Purpose:** Handle blades with stores or sub-components.

**Migrate:** `settings`, `changelog`, `viewer-code`, `viewer-markdown`, `viewer-nupkg`, `gitflow-cheatsheet`

For blades with stores:
- Move blade-exclusive stores (`changelogStore` -> `blades/changelog/store.ts`, `initRepo` -> `blades/init-repo/store.ts`)
- Verify cross-cutting stores stay shared (settings, gitflow, etc.)

For blades with sub-components:
- Move entire sub-component directory via `git mv` (e.g., `components/settings/` -> `blades/settings/components/`)
- Update internal imports to relative paths

**Post-migration per blade:**
- Delete old registration and moved files
- Update all imports of blade store (if moved)
- Run unit tests + smoke tests

**Risk:** MEDIUM. Store moves require updating import paths in multiple files.

**Exit criteria:** 6 more blades migrated (10/15 total), no broken imports.

#### Wave 4: Complex Cross-Dependent Blades + Cleanup (Plan 4)

**Purpose:** Migrate most complex blades with shared dependencies, finalize structure.

**Migrate:** `staging-changes`, `topology-graph`, `diff`, `conventional-commit`, `init-repo`

**Special handling:**
- **`staging-changes` + `diff`:** Share `useStagingStore` (stays in `stores/staging.ts`)
- **`conventional-commit`:** Has blade-specific components BUT also shares some commit components with sidebar. Audit `components/commit/` and ONLY move blade-specific parts.
- **`diff`:** `DiffSource` type already extracted in Wave 1, just move component + registration
- **`topology-graph`, `init-repo`:** Move stores, sub-components, hooks

**Cleanup:**
- Remove entire `components/blades/registrations/` directory
- Remove old `components/blades/` directory (should be empty except index.ts)
- Remove old component sub-directories (staging, topology, changelog, etc.)
- Update `_discovery.ts` to remove old glob pattern (new pattern only)
- Add Biome `noPrivateImports` check to CI
- Final pass: update any remaining relative imports to `@/` where appropriate

**Risk:** HIGH. These blades have the most cross-dependencies.

**Exit criteria:** All 15 blades migrated, old structure deleted, CI passes with boundary checks.

### Migration Order (Detailed)

| Tier | Blade Type | Store | Sub-Components | Shared Dependencies | Complexity |
|------|-----------|-------|---------------|---------------------|------------|
| 1 | `viewer-image` | None | None | None | Very Low |
| 1 | `viewer-3d` | None | None | None | Very Low |
| 1 | `commit-details` | None | FileTreeBlade (shared) | None | Low |
| 1 | `repo-browser` | None | None | None | Low |
| 2 | `changelog` | Exclusive | 1 | None | Low |
| 2 | `viewer-code` | None | None | useRepoFile (shared) | Low |
| 2 | `viewer-markdown` | None | 5 | useRepoFile (shared) | Medium |
| 2 | `viewer-nupkg` | None | 1 | None | Low |
| 2 | `settings` | Shared (App.tsx) | 6 | None | Medium |
| 2 | `gitflow-cheatsheet` | Shared (gitflow components) | 8 | None | Medium |
| 3 | `init-repo` | Exclusive | 6 | None | Medium |
| 3 | `topology-graph` | Shared (App.tsx) | 6 | None | Medium |
| 3 | `staging-changes` | Shared (DiffBlade) | 10 | useStagingStore | High |
| 3 | `diff` | None | None | useStagingStore | High |
| 3 | `conventional-commit` | Shared (sidebar) | 15+ | 4 shared hooks | Very High |

---

## Import Boundary Enforcement

### Three-Layer Enforcement Strategy

All three research perspectives agree on a layered approach (IDE feedback + Biome + CI).

#### Layer 1: Biome `noPrivateImports` (Primary)

**How it works:** Annotate blade-internal exports with `@package` JSDoc. Biome flags violations in IDE and CI.

**Implementation:**

```typescript
// src/blades/changelog/ChangelogBlade.tsx
/** @package */
export function ChangelogBlade() {
  // ... only importable within blades/changelog/
}
```

```typescript
// src/blades/changelog/store.ts
/** @package */
export const useChangelogStore = create<ChangelogState>(/* ... */);
```

```json
// biome.json
{
  "linter": {
    "rules": {
      "correctness": {
        "noPrivateImports": "error"
      }
    }
  }
}
```

**Feedback loop:** < 1 second (IDE red squiggle via Biome LSP)

**Confidence:** HIGH (verified in Biome v2 documentation)

#### Layer 2: TypeScript Path Aliases (Secondary)

**How it works:** Configure `tsconfig.json` paths to encourage barrel-only imports.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/blades/*": ["src/blades/*/index.ts"]
    }
  }
}
```

**Limitation:** Does not block relative imports (`../diff/store`). This is a soft guard.

**Feedback loop:** < 1 second (TypeScript language server, autocomplete only suggests barrel exports)

#### Layer 3: CI Boundary Check Script (Tertiary)

**How it works:** Grep-based script checks for cross-blade directory imports.

```bash
#!/bin/bash
# scripts/check-blade-boundaries.sh
EXIT=0
for blade_dir in src/blades/*/; do
  blade_name=$(basename "$blade_dir")
  [[ "$blade_name" == _* ]] && continue  # Skip _shared, _discovery

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

**Feedback loop:** 1-3 minutes (post-push CI)

**Purpose:** Safety net for violations that Biome misses (e.g., missing `@package` annotations)

### The Core Boundary Rules

1. **Blades must not import from other blades.** Each blade can import from:
   - Its own directory (blade-private files)
   - `blades/_shared/` (infrastructure)
   - `shared/`, `stores/`, `hooks/`, `lib/` (cross-cutting)
   - Third-party packages

2. **Barrel files define public API.** Only exports in `index.ts` are importable from outside the blade.

3. **`@package` annotation marks internal files.** Files not re-exported by the barrel should be annotated.

---

## Auto-Discovery Mechanism

### Current Pattern (Flat Directory)

```typescript
// src/components/blades/registrations/index.ts
const modules = import.meta.glob(["./*.{ts,tsx}", "!./index.ts"], { eager: true });
```

### Target Pattern (Per-Blade Registration)

```typescript
// src/blades/_discovery.ts
import { clearRegistry, getAllBladeTypes } from "@/lib/bladeRegistry";

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
    console.warn(`[BladeRegistry] Missing registrations: ${missing.join(", ")}`);
  }
}

// HMR support (preserve existing behavior)
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose((data) => {
    data.isUpdate = true;
    clearRegistry();
  });
}
```

### Migration Period Pattern (Dual-Glob)

During migration, scan BOTH old and new locations:

```typescript
const modules = import.meta.glob(
  [
    "./*/registration.{ts,tsx}",              // New location
    "../components/blades/registrations/*.{ts,tsx}",  // Old location
    "!../components/blades/registrations/index.ts",   // Exclude old barrel
    "!./_shared/**",                          // Exclude infrastructure
  ],
  { eager: true }
);
```

---

## Store and Hook Classification

### Stores That MOVE Into Blade Directories

| Store | From | To | Rationale |
|-------|------|-----|-----------|
| `changelogStore.ts` | `stores/` | `blades/changelog/store.ts` | Only used by ChangelogBlade + ChangelogPreview |
| `initRepo.ts` | `stores/` | `blades/init-repo/store.ts` | Only used by InitRepoBlade + sub-components |

### Stores That STAY Shared

All 19 other stores stay in `stores/` because they are used by multiple features or App.tsx:

- `staging.ts` (used by staging-changes, diff, sidebar)
- `conventional.ts` (used by blade + sidebar CommitForm)
- `topology.ts` (used by blade + App.tsx auto-refresh)
- `gitflow.ts` (used by blade + gitflow components)
- `settings.ts` (used by blade + App.tsx init)
- `repository.ts`, `theme.ts`, `navigation.ts`, `toast.ts`, `commandPalette.ts` (cross-cutting)
- `branches.ts`, `stash.ts`, `tags.ts`, `worktrees.ts` (cross-cutting)

### Hooks That MOVE Into Blade Directories

| Hook | From | To | Rationale |
|------|------|-----|-----------|
| `useStagingKeyboard.ts` | `hooks/` | `blades/staging-changes/hooks/` | Only used by StagingChangesBlade |
| `useBladeFormGuard.ts` | `hooks/` | `blades/conventional-commit/hooks/` | Only used by ConventionalCommitBlade |

### Hooks That STAY Shared

- `useBladeNavigation.ts` (infrastructure, used by 7+ blades)
- `useRepoFile.ts` (used by viewer-code + viewer-markdown)
- `useConventionalCommit.ts` (used by blade + sidebar CommitForm)
- `useCommitExecution.ts` (used by blade + sidebar)
- `useAmendPrefill.ts` (used by blade + sidebar)
- `useCommitGraph.ts` (used by topology blade components)
- All other hooks (cross-cutting)

---

## Cross-Blade Dependency Resolution

### DiffSource Type (Prerequisite Step)

**Current:** `DiffSource` is exported from `DiffBlade.tsx` and imported by:
- `stores/bladeTypes.ts` (for `BladePropsMap["diff"]`)
- `lib/previewRegistry.ts`
- `components/blades/registrations/diff.tsx`

**Problem:** After migration, `bladeTypes.ts` (shared) would import from `blades/diff/DiffBlade.tsx` (blade-private), violating boundaries.

**Solution:** Extract `DiffSource` to `blades/diff/types.ts` BEFORE migrating the diff blade (part of Wave 1).

```typescript
// src/blades/diff/types.ts
/**
 * Blade input: diff source configuration.
 * Public type -- imported by bladeTypes.ts and previewRegistry.ts.
 */
export type DiffSource =
  | { mode: "staging"; filePath: string; staged: boolean }
  | { mode: "commit"; oid: string; filePath: string };
```

```typescript
// src/blades/diff/index.ts
export type { DiffSource } from "./types";
```

```typescript
// src/stores/bladeTypes.ts
import type { DiffSource } from "@/blades/diff";
```

### FileTreeBlade Sub-Component

**Current:** `FileTreeBlade.tsx` is in `components/blades/` and imported by `CommitDetailsBlade`.

**Problem:** FileTreeBlade is NOT a blade type (no registration), but a reusable UI component.

**Solution:** Move to `blades/_shared/FileTreeBlade.tsx`. It's infrastructure, not a feature.

### WelcomeView Direct Import of InitRepoBlade

**Current:** `WelcomeView.tsx` directly imports `InitRepoBlade` component and renders it outside the blade stack.

**Problem:** After migration, the import path changes.

**Solution:** Update import to use the blade's barrel: `import { InitRepoBlade } from "@/blades/init-repo"`. The barrel should export the component for this use case.

### Conventional Commit Shared Components

**Current:** `components/commit/` contains 14 files used by BOTH `ConventionalCommitBlade` AND sidebar `CommitForm`.

**Problem:** Some files are blade-specific (TypeSelector, ScopeAutocomplete), others are shared (CommitForm, CommitHistory).

**Solution:** SPLIT the directory:
- **Stay in `components/commit/`:** CommitForm, CommitHistory, CommitDetails, CommitSearch (shared with sidebar)
- **Move to `blades/conventional-commit/components/`:** TypeSelector, ScopeAutocomplete, BreakingChangeSection, CharacterProgress, ValidationErrors, CommitPreview, CommitActionBar, TemplateSelector, ScopeFrequencyChart (blade-specific)

---

## TypeScript Path Aliases

### Current State

- **vite.config.ts:** `resolve.alias: { "@": "/src" }` -- CONFIGURED
- **tsconfig.json:** No `paths` or `baseUrl` -- NOT CONFIGURED
- **Codebase:** Zero `@/` imports currently exist (all relative)

### Recommendation

Add to `tsconfig.json` for IDE support:

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

**Use selectively:** For cross-module imports in migrated blades (e.g., `@/lib/bladeRegistry`, `@/stores/staging`). Do NOT mass-convert existing relative imports (that's tech debt for Phase 30).

---

## Testing Considerations

### Test File Co-Location

**Current:** 13 test files in `src/components/blades/`

**Target:** Each blade's test moves into its directory: `src/blades/{name}/{BladeName}.test.tsx`

**Impact:** NONE on test discovery. Vitest config `include: ["src/**/*.test.{ts,tsx}"]` matches all depths.

**Import path updates:** Test files use relative imports like `../../test-utils/render`. After moving, depth may change. Recommendation: Use `@/test-utils/render` with the tsconfig path alias for stability.

### Regression Testing Strategy

| Test Type | What It Catches | When to Run |
|-----------|-----------------|-------------|
| TypeScript compilation (`tsc --noEmit`) | Broken imports, missing types | After each blade migration |
| Vitest unit tests (`vitest run`) | Broken components, store logic | After each blade migration |
| Dev-mode exhaustiveness check | Missing blade registrations | Automatically on app start |
| Manual smoke test: navigation | Broken lazy loading, missing animations | After each wave |
| Manual smoke test: HMR | Broken hot reload | After discovery module change |
| Build test (`vite build`) | Code splitting issues, dynamic imports | After Wave 4 completion |

---

## Extensibility: Zero-Config New Blade

### The Ideal "Add a Blade" Workflow (3 Steps)

1. **Create blade directory and files:**

```
src/blades/my-feature/
  MyFeatureBlade.tsx
  MyFeatureBlade.test.tsx
  registration.ts
  index.ts
```

2. **Add one line to shared `BladePropsMap`:**

```typescript
// src/stores/bladeTypes.ts
export interface BladePropsMap {
  // ... existing entries ...
  "my-feature": { someParam: string };
}
```

3. **Automatic discovery:** `import.meta.glob` finds `registration.ts`, blade is registered.

### What Happens Automatically

- Registration file executes on import (side-effect `registerBlade()` call)
- Blade appears in registry
- `openBlade("my-feature", { someParam: "value" })` works immediately
- Dev-mode console warning if type isn't in EXPECTED_TYPES list (developer adds it)
- Code-splitting chunk created if `lazy: true` in registration

### The ONE Required Shared File Edit

The `BladePropsMap` edit is **intentional and cannot be eliminated**. It provides:
- Compile-time type safety for all `openBlade()` calls
- TypeScript autocomplete for blade props
- Exhaustiveness checking (dev-mode warning for missing registrations)

This is the correct tradeoff: one line in a shared type file gives type-checked navigation across the entire codebase.

---

## Common Pitfalls (Consolidated)

All three research documents identified these high-risk pitfalls:

### 1. Circular Dependencies After Type Move

**What:** `bladeTypes.ts` imports `DiffSource` from `DiffBlade.tsx`, `DiffBlade.tsx` imports from `bladeTypes.ts`.

**Solution:** Extract `DiffSource` to `blades/diff/types.ts` BEFORE migration (Wave 1 prerequisite).

### 2. Broken `import.meta.glob` Pattern

**What:** Glob pattern doesn't match new file locations; zero blade registrations.

**Solution:** Use dual-glob during migration, verify `Object.keys(modules).length > 0`, keep dev-mode exhaustiveness check.

### 3. Shared Store Wrongly Moved Into Blade

**What:** `useStagingStore` moved to `staging-changes/` breaks `DiffBlade` imports.

**Solution:** Before moving any store, grep for all consumers. If 2+ consumers exist, keep it shared.

**Stores that MUST stay shared:** staging, conventional, topology, gitflow, settings, repository, theme, navigation, toast, commandPalette, branches, stash, tags, worktrees.

### 4. Missing HMR Disposal

**What:** HMR breaks during migration; editing a blade duplicates registrations or loses them.

**Solution:** Copy the `import.meta.hot` dispose/accept pattern from old registrations index to new `_discovery.ts`.

### 5. Test Import Paths Break

**What:** Tests use `../../test-utils/render`; after move, depth changes.

**Solution:** Add `@/` path alias to tsconfig, use `@/test-utils/render` in tests.

### 6. Git History Lost

**What:** Using `cp` + `rm` instead of `git mv` breaks file history.

**Solution:** Always use `git mv` for file moves.

### 7. Dynamic Import Template Literals Break Code Splitting

**What:** `lazy(() => import(\`./blades/${type}/Component\`))` prevents Vite static analysis.

**Solution:** Each registration must use a literal string path: `import("./ChangelogBlade")`.

### 8. WelcomeView Import Breaks

**What:** `WelcomeView.tsx` directly imports `InitRepoBlade`; path changes after migration.

**Solution:** Update to `import { InitRepoBlade } from "@/blades/init-repo"`. Export from barrel.

---

## Migration Checklist (Per Blade)

Use this checklist for each blade during migration:

- [ ] Create `src/blades/{blade-name}/` directory
- [ ] `git mv` blade component file
- [ ] `git mv` test file (if exists)
- [ ] `git mv` sub-components (if any) to `components/` subdirectory
- [ ] `git mv` blade-specific store (if applicable)
- [ ] Create `registration.ts` with `React.lazy()` dynamic import
- [ ] Create `index.ts` barrel exporting public types only
- [ ] Add `@package` annotations to internal files
- [ ] Update imports in the blade component (adjust relative paths)
- [ ] Update imports of blade store (if moved)
- [ ] Delete old registration file from `components/blades/registrations/`
- [ ] Run `tsc --noEmit` (verify no TypeScript errors)
- [ ] Run `vitest run` (verify tests pass)
- [ ] Dev smoke test: open the blade, verify it renders
- [ ] Dev smoke test: edit blade component, verify HMR works
- [ ] Add blade type to `EXPECTED_TYPES` in `_discovery.ts`

---

## Recommended Plan Breakdown

### Plan 1: Scaffolding (STRC-01)
**Scope:** Set up new structure, move shared infrastructure, extract DiffSource type
**Complexity:** Medium
**Risk:** Low
**Deliverable:** Dual-glob discovery works, all 15 blades still load

### Plan 2: Simple Blades (STRC-02)
**Scope:** Migrate 4 self-contained blades (viewer-image, viewer-3d, commit-details, repo-browser)
**Complexity:** Low
**Risk:** Low
**Deliverable:** 4 blades in new structure, pattern established

### Plan 3: Medium Blades (STRC-03)
**Scope:** Migrate 6 blades with stores/sub-components (settings, changelog, viewer-code, viewer-markdown, viewer-nupkg, gitflow-cheatsheet)
**Complexity:** Medium
**Risk:** Medium
**Deliverable:** 10/15 blades migrated, store moves validated

### Plan 4: Complex Blades + Cleanup (STRC-04, STRC-05, STRC-06)
**Scope:** Migrate remaining 5 blades (staging-changes, topology-graph, diff, conventional-commit, init-repo), delete old structure, add boundary checks
**Complexity:** High
**Risk:** High
**Deliverable:** All 15 blades migrated, old structure deleted, CI boundary enforcement active

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|-----------|-----------|
| Standard stack | HIGH | No new dependencies; uses existing Vite, Biome, TypeScript features |
| Architecture | HIGH | Based on exhaustive codebase analysis (59 blade files, 25 stores, 14 hooks) |
| Migration strategy | HIGH | Incremental approach with dual-glob safety net, explicit ordering |
| Import boundaries | HIGH | Biome `noPrivateImports` verified in official docs, layered enforcement |
| Pitfalls | HIGH | Identified through dependency analysis (DiffSource, WelcomeView, HMR) |
| Extensibility | HIGH | Zero-config discovery proven by existing `import.meta.glob` pattern |
| Tauri v2 impact | HIGH | Verified zero coupling to frontend file structure |
| Tailwind v4 impact | HIGH | Automatic content detection covers all `src/` files |
| Build performance | HIGH | Code-splitting via `React.lazy()` already proven in 6 blades |

---

## Sources (Consolidated)

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct file reads of 270 source files
- **Biome official docs** -- https://biomejs.dev/linter/rules/no-private-imports/
- **Context7 /vitejs/vite** -- `import.meta.glob` API, dynamic import patterns
- **Context7 /websites/tailwindcss** -- Tailwind v4 automatic content detection
- **Context7 /biomejs/biome** -- Linter rules documentation
- **tauri.conf.json** -- Verified no frontend path references

### Secondary (MEDIUM confidence)
- **Biome Roadmap 2026** -- https://biomejs.dev/blog/roadmap-2026/
- **React Folder Structure (Robin Wieruch)** -- https://www.robinwieruch.de/react-folder-structure/
- **Infinum Frontend Handbook** -- Feature-module patterns

### Tertiary (MEDIUM confidence)
- **Previous phase research** -- Phase 20.1 (blade extensibility), Phase 25 (test infrastructure), Phase 28 (architecture)

---

## Metadata

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable domain; no external dependency changes)
**Applies to tickets:** STRC-01 through STRC-06
