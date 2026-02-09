# Phase 29: Blade-Centric File Structure -- UX Research

**Researched:** 2026-02-09
**Domain:** Developer Experience (DX) of feature-module file structures, migration safety, extensibility patterns, import boundary enforcement
**Confidence:** HIGH
**Applies to:** STRC-01 through STRC-06

---

## Summary

This research examines Phase 29 from a **developer experience (DX) and user experience (UX) perspective**. The phase migrates FlowForge from a layer-based file organization (top-level `components/`, `stores/`, `hooks/`) to a blade-centric feature-module structure (`blades/{blade-name}/` with co-located files). The central question is: how do we make this migration improve daily developer workflow without introducing regressions in the user-facing blade system?

The current codebase has **15 blade types** with files scattered across 4+ top-level directories. A single blade like `conventional-commit` touches files in `components/blades/`, `components/commit/`, `stores/`, `hooks/`, and `lib/` -- five directories for one feature. The migration must consolidate each blade's files into a single feature directory while preserving the auto-discovery system (`import.meta.glob`), the XState navigation FSM lifecycle, and all animations/transitions.

**Primary recommendation:** Migrate incrementally, one blade at a time, using the existing `import.meta.glob` pattern adjusted to scan `blades/*/registration.ts` instead of `blades/registrations/*.ts`. Classify files into "blade-private" (move into blade directory) and "shared" (keep in `shared/` or `lib/`). Enforce boundaries using Biome's `noPrivateImports` rule with `@package` JSDoc annotations, not ESLint. Provide a blade scaffolding template and a migration checklist so that both new blade creation and existing blade migration follow a repeatable pattern.

---

## 1. Developer Experience (DX) of Feature-Module File Structures

### 1.1 Current Pain: File Scatter Across Layers

The current layer-based structure forces developers to navigate multiple directories to understand or modify a single blade feature:

**Example: `conventional-commit` blade (current state)**
```
src/
  components/blades/ConventionalCommitBlade.tsx          # Blade component
  components/blades/registrations/conventional-commit.ts  # Registration
  components/blades/ConventionalCommitBlade.test.tsx      # Test (unused name)
  components/commit/ConventionalCommitForm.tsx            # Sub-component
  components/commit/CommitActionBar.tsx                   # Sub-component
  components/commit/ScopeAutocomplete.tsx                 # Sub-component
  components/commit/TypeSelector.tsx                      # Sub-component
  components/commit/TemplateSelector.tsx                  # Sub-component
  components/commit/ScopeFrequencyChart.tsx               # Sub-component
  components/commit/CommitPreview.tsx                     # Sub-component
  stores/conventional.ts                                  # Zustand store
  hooks/useConventionalCommit.ts                          # Hook
  hooks/useCommitExecution.ts                             # Hook
  hooks/useAmendPrefill.ts                                # Hook
  lib/conventional-utils.ts                               # Utilities
  lib/commit-type-theme.ts                                # Shared theming
  lib/commit-templates.ts                                 # Templates
```

**Observed problems (HIGH confidence -- codebase analysis):**

1. **Discovery friction.** A developer working on the commit blade must know to look in 5+ directories. There is no single place that answers "what files belong to the conventional-commit feature?"
2. **Mental model mismatch.** The layer-based structure organizes by technical concern (component vs store vs hook), but developers think about features. "I need to change how conventional commits work" maps to one blade, not three layers.
3. **Implicit coupling is invisible.** `useConventionalCommit.ts` in `hooks/` is tightly coupled to `conventional.ts` in `stores/` and `ConventionalCommitBlade.tsx` in `components/blades/`. This coupling is not represented by the file structure.
4. **High cognitive load for onboarding.** A new contributor must learn the naming conventions (blade component in `blades/`, sub-components in a differently-named directory, hooks in `hooks/`, store in `stores/`) to find all the files for a feature.

### 1.2 Target: Feature-Module Co-location

**Example: `conventional-commit` blade (target state)**
```
src/blades/conventional-commit/
  ConventionalCommitBlade.tsx         # Main blade component
  ConventionalCommitBlade.test.tsx    # Blade-level test
  registration.ts                     # Blade registration (registerBlade call)
  store.ts                            # Zustand store (useConventionalStore)
  hooks/
    useConventionalCommit.ts          # Feature-specific hook
    useCommitExecution.ts             # Feature-specific hook
    useAmendPrefill.ts                # Feature-specific hook
  components/
    ConventionalCommitForm.tsx        # Sub-component
    CommitActionBar.tsx               # Sub-component
    ScopeAutocomplete.tsx             # Sub-component
    TypeSelector.tsx                  # Sub-component
    TemplateSelector.tsx              # Sub-component
    ScopeFrequencyChart.tsx           # Sub-component
    CommitPreview.tsx                 # Sub-component
  utils/
    conventional-utils.ts             # Feature-specific utilities
    conventional-utils.test.ts        # Utility tests
  index.ts                            # Public API barrel
```

**DX benefits (MEDIUM confidence -- industry consensus):**

1. **Single-directory discovery.** Developer opens `blades/conventional-commit/` and sees everything. No hunting across layers.
2. **Feature ownership.** When a team member is responsible for the commit blade, they own one directory. Code review boundaries align with feature boundaries.
3. **Delete-ability.** To remove a blade, delete one directory. In the current structure, you must find and remove files from 5+ locations.
4. **IDE navigation.** File tree in VS Code / IDE shows all related files grouped together. Fuzzy-find (`Cmd+P`) with "conventional" returns all files in one cluster.
5. **Reduced import depth.** Within a blade module, imports are `./store` instead of `../../stores/conventional`. Shorter, more readable.

### 1.3 How Developers Navigate Feature-Module Structures

Based on observed patterns in the React ecosystem (Robin Wieruch's "React Folder Structure in 5 Steps", Infinum Frontend Handbook, Profy "Screaming Architecture"):

**What makes a feature module intuitive:**

| Principle | Implementation | Why It Works |
|-----------|----------------|--------------|
| **Predictable naming** | Every blade has `registration.ts`, `index.ts`, `*.test.tsx` | Developers build muscle memory for file locations |
| **Shallow nesting** | Max 2 levels deep within a blade directory | Deep nesting defeats the purpose of co-location |
| **Barrel file as public API** | `index.ts` exports only what other modules need | Clear contract: "this is what you can import from this blade" |
| **Consistent internal structure** | Same sub-directory names across blades (`components/`, `hooks/`, `utils/`) | Pattern recognition across blades |
| **README or docs optional** | Only for complex blades | Low ceremony for simple blades |

**What makes it unintuitive:**

| Anti-Pattern | Why It Fails |
|--------------|--------------|
| Deeply nested `blades/diff/components/panels/left/DiffHeader.tsx` | Defeats co-location benefit; back to hunting |
| Inconsistent naming (some blades use `lib/`, others `utils/`, others inline) | Breaks pattern recognition |
| Barrel file re-exports everything (including internals) | Barrel becomes a maintenance burden, defeats encapsulation |
| No clear shared vs private distinction | Developers unsure which imports are allowed |

---

## 2. Impact on UX Regressions

### 2.1 Critical User-Facing Systems That Must Not Break

The migration is a file reorganization, not a rewrite. However, incorrect migration can break several user-facing behaviors:

**1. Blade Auto-Discovery (CRITICAL)**

Current mechanism in `src/components/blades/registrations/index.ts`:
```typescript
const modules = import.meta.glob(["./*.{ts,tsx}", "!./index.ts"], { eager: true });
```

This `import.meta.glob` call eagerly imports all registration files from the `registrations/` directory. Each file's top-level `registerBlade()` call executes on import, populating the blade registry `Map`.

**Risk:** If the glob pattern does not match the new file structure, blade types will not register and the app will render "Unknown blade: {type}" errors for every blade.

**Mitigation:** Update the glob to scan the new structure:
```typescript
// New: scan blades/*/registration.ts
const modules = import.meta.glob(
  ["../*/registration.{ts,tsx}", "!./index.ts"],
  { eager: true }
);
```

**Verification:** The existing dev-mode exhaustiveness check (lines 14-29 of registrations/index.ts) already warns if any blade type is missing. This check must be preserved and should log to both console and an on-screen dev-only banner.

**2. Lazy Loading & Code Splitting**

Blade registrations currently use `lazy(() => import("../DiffBlade"))` for code splitting. After migration, the import path changes. Vite handles this correctly as long as paths resolve at build time.

**Risk:** If dynamic import paths use variables or string concatenation, Vite cannot analyze them and code splitting fails -- all blades load eagerly, increasing initial bundle size.

**Mitigation:** Keep dynamic imports as string literals with the new paths. Do NOT create a generic `lazy(() => import(\`../blades/${type}/Component\`))` pattern.

**3. HMR (Hot Module Replacement)**

The current registrations index has HMR-aware disposal:
```typescript
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose((data) => {
    data.isUpdate = true;
    clearRegistry();
  });
}
```

**Risk:** If the new discovery module does not include the same HMR handling, editing a blade during dev will cause the registry to accumulate stale registrations or lose registrations entirely, requiring a full page reload.

**Mitigation:** Copy the HMR disposal pattern to the new discovery entry point. Test HMR after migration by editing a blade and verifying it hot-reloads correctly.

**4. XState Navigation FSM Lifecycle**

The navigation machine (`src/machines/navigation/navigationMachine.ts`) manages blade pushing, popping, dirty state, and animation direction. It operates on `BladeType` string literals, not file paths.

**Risk:** LOW. The navigation machine is decoupled from file structure. It works with types from `BladePropsMap`, which is a TypeScript interface, not a file path. As long as the interface and registry stay in sync, navigation is unaffected.

**Verification:** Run the existing navigation machine test suite (`navigationMachine.test.ts`, 21KB) -- if all 20+ tests pass, navigation is correct.

**5. Framer Motion Animations**

`BladeContainer.tsx` uses `AnimatePresence` and `motion.div` for blade transitions. Animation variants are defined in `src/lib/animations.ts`.

**Risk:** LOW. Animations are driven by React component tree position and `key` props (blade ID), not file paths. Moving files does not affect animation behavior.

**Verification:** Manual smoke test -- push/pop a blade and verify slide animation plays correctly.

**6. Blade Type Safety (TypedBlade, BladePropsMap)**

`BladePropsMap` in `src/stores/bladeTypes.ts` is the type-level contract. `DiffSource` type is currently exported from `DiffBlade.tsx` and imported by `bladeTypes.ts`.

**Risk:** MEDIUM. The circular dependency concern -- `bladeTypes.ts` imports a type from a blade component. After migration, this becomes a cross-boundary import (`shared/bladeTypes.ts` importing from `blades/diff/DiffBlade.tsx`), which violates the "blades don't export to shared" rule.

**Mitigation:** Extract `DiffSource` type to a shared types file (`shared/types/diff.ts` or into `bladeTypes.ts` itself) before migrating the diff blade. This is a prerequisite step.

### 2.2 Regression Testing Strategy

| Test Type | What It Catches | When to Run |
|-----------|-----------------|-------------|
| **TypeScript compilation** (`tsc --noEmit`) | Broken imports, missing types | After each blade migration |
| **Vitest unit tests** (`vitest run`) | Broken blade components, store logic | After each blade migration |
| **Dev-mode exhaustiveness check** | Missing blade registrations | Automatically on app start |
| **Manual smoke test: blade navigation** | Broken lazy loading, missing animations | After each batch of migrations |
| **Manual smoke test: HMR** | Broken hot reload | After discovery module change |
| **Build test** (`vite build`) | Code splitting issues, dynamic import failures | After all blades migrated |

### 2.3 Migration Order for Minimum Risk

Migrate in order of complexity (simple blades first):

**Wave 1: Simple blades (no sub-components, no blade-specific store)**
- `changelog`, `settings`, `gitflow-cheatsheet` -- few dependencies, small files
- These serve as proof-of-concept for the pattern

**Wave 2: Viewer blades (similar structure, can batch)**
- `viewer-code`, `viewer-image`, `viewer-markdown`, `viewer-3d`, `viewer-nupkg`
- All share a similar pattern: blade component + registration + test

**Wave 3: Medium complexity**
- `commit-details`, `topology-graph`, `repo-browser`
- More hooks and store dependencies

**Wave 4: High complexity (most sub-components and stores)**
- `staging-changes`, `diff` -- share `useStagingStore` (cross-blade dependency)
- `init-repo`, `conventional-commit` -- many sub-components and dedicated stores

The staging/diff pair is the most complex because `DiffBlade` imports `useStagingStore` (a store also used by `StagingChangesBlade`). This is a legitimate cross-blade shared dependency -- the staging store must remain in `shared/` (not blade-private).

---

## 3. Extensibility: "Add a New Blade by Creating Files in One Directory"

### 3.1 The Ideal Scaffold (What "Create a New Blade" Looks Like)

**Goal:** A developer can add a new blade type by:
1. Creating a new directory under `src/blades/{blade-name}/`
2. Adding files following the established pattern
3. Adding one entry to `BladePropsMap` in shared types
4. Auto-discovery picks up the registration -- no other files need editing

**Minimum viable blade (3 files):**
```
src/blades/my-feature/
  MyFeatureBlade.tsx         # Component
  registration.ts            # registerBlade() call
  index.ts                   # Re-export for external use
```

**Full-featured blade (8+ files):**
```
src/blades/my-feature/
  MyFeatureBlade.tsx          # Main blade component
  MyFeatureBlade.test.tsx     # Tests
  registration.ts             # Blade registration
  store.ts                    # Zustand store (if needed)
  hooks/
    useMyFeature.ts           # Feature-specific hooks
  components/
    MySubComponent.tsx        # Internal sub-components
  types.ts                    # Feature-specific types
  index.ts                    # Public API barrel
```

### 3.2 Registration File Pattern

Each blade's `registration.ts` should be self-contained:

```typescript
// src/blades/my-feature/registration.ts
import { lazy } from "react";
import { registerBlade } from "@/shared/bladeRegistry";

const MyFeatureBlade = lazy(() =>
  import("./MyFeatureBlade").then((m) => ({ default: m.MyFeatureBlade })),
);

registerBlade<{ someParam: string }>({
  type: "my-feature",
  defaultTitle: "My Feature",
  component: MyFeatureBlade,
  lazy: true,
});
```

**Key DX property:** The registration imports the component from `./` (same directory), not `../SomeOtherPlace`. This makes the registration readable and self-contained.

### 3.3 Barrel File (index.ts) Contract

The barrel file defines the blade's **public API** -- what other modules are allowed to import:

```typescript
// src/blades/my-feature/index.ts

// Public: types that other blades or shared code may need
export type { MyFeatureProps } from "./types";

// Public: the component (for direct rendering outside blade stack, e.g. WelcomeView)
export { MyFeatureBlade } from "./MyFeatureBlade";

// NOT exported: store, hooks, sub-components (blade-private)
```

**Rule:** If a file is not exported from `index.ts`, it is blade-private and must not be imported from outside the blade directory.

### 3.4 The `BladePropsMap` Edit -- The One Shared File Touch

Adding a new blade still requires one edit to the shared `BladePropsMap` interface:

```typescript
// src/shared/types/bladeTypes.ts
export interface BladePropsMap {
  // ... existing blades ...
  "my-feature": { someParam: string };
}
```

This is intentional. The type system enforces that every blade type has a typed props contract. Making this automatic (e.g., scanning directories) would lose type safety. The one shared file edit is an acceptable trade-off.

**The dev-mode exhaustiveness check** already warns when a `BladePropsMap` entry exists without a matching registration, and vice versa. This catches the "forgot to register" mistake immediately.

### 3.5 CLI Scaffolding (Future Enhancement)

A `plop` or custom script could automate blade creation:
```bash
npm run create-blade -- --name my-feature --with-store --with-hooks
```
This is a nice-to-have, not a Phase 29 requirement. The file pattern is simple enough that copy-paste from an existing blade works for v1.

---

## 4. Co-location Patterns: Ideal Structure for a Single Blade Module

### 4.1 Classifying Files: Blade-Private vs Shared

Before migrating, each file associated with a blade must be classified:

| Classification | Meaning | Example |
|----------------|---------|---------|
| **Blade-private** | Only used by this blade and its sub-components | `ConventionalCommitForm.tsx`, `useAmendPrefill.ts` |
| **Shared** | Used by multiple blades or non-blade code | `useStagingStore` (used by both `staging-changes` and `diff` blades) |
| **Infrastructure** | Part of the blade system itself, not any specific blade | `BladeRegistry`, `BladeContainer`, `BladeRenderer`, `BladePanel` |

**Current file classification for all 15 blades:**

| Blade | Blade-Private Store | Blade-Private Hooks | Shared Store Dependencies | Sub-Components |
|-------|--------------------|--------------------|--------------------------|----------------|
| `staging-changes` | None | `useStagingKeyboard` | `staging`, `bladeNavigation` | `StagingPanel`, `FileList`, `FileItem`, etc. |
| `diff` | None | None | `staging`, `bladeNavigation` | None (self-contained) |
| `conventional-commit` | `conventional` | `useConventionalCommit`, `useCommitExecution`, `useAmendPrefill` | `bladeNavigation`, `bladeFormGuard` | `CommitForm`, `TypeSelector`, `ScopeAutocomplete`, etc. |
| `init-repo` | `initRepo` | `useGitignoreTemplates` | None | `InitRepoForm`, `InitRepoPreview`, `TemplatePicker`, etc. |
| `settings` | `settings` (SHARED) | None | `settings` | `GeneralSettings`, `AppearanceSettings`, etc. |
| `changelog` | `changelogStore` | `bladeNavigation` | None | `ChangelogPreview` |
| `commit-details` | None | `bladeNavigation` | None | None |
| `topology-graph` | None | `bladeNavigation` | None | None |
| `repo-browser` | None | `bladeNavigation` | None | None |
| `gitflow-cheatsheet` | None | None | `gitflow`, `repository` | None |
| `viewer-code` | None | `useRepoFile` (shared) | None | None |
| `viewer-image` | None | None | None | None |
| `viewer-markdown` | None | `useRepoFile` (shared) | None | None |
| `viewer-3d` | None | None | None | None |
| `viewer-nupkg` | None | None | None | None |

**Key observations:**

1. **`settings` store is special.** It is used by both the `SettingsBlade` and `App.tsx` (for initialization). It MUST stay shared. The settings sub-components (`GeneralSettings`, `AppearanceSettings`, etc.) are blade-private.
2. **`staging` store is shared between `staging-changes` and `diff` blades.** It stays in `shared/stores/`.
3. **`useBladeNavigation` and `useBladeFormGuard`** are infrastructure hooks used by many blades. They stay in `shared/hooks/`.
4. **`useRepoFile` hook** is used by multiple viewer blades. It stays in `shared/hooks/`.
5. **`conventional` store and its hooks** are blade-private to `conventional-commit`. They should move into the blade directory.
6. **`initRepo` store** is blade-private to `init-repo`. It should move.
7. **`changelogStore`** is blade-private to `changelog`. It should move.

### 4.2 The Ideal Internal Structure

**Simple blade (no store, no sub-components):**
```
src/blades/viewer-image/
  ViewerImageBlade.tsx
  ViewerImageBlade.test.tsx
  registration.ts
  index.ts
```
4 files. Clean, minimal. Most viewer blades follow this pattern.

**Medium blade (store, no sub-components):**
```
src/blades/changelog/
  ChangelogBlade.tsx
  ChangelogBlade.test.tsx
  registration.ts
  store.ts                    # changelogStore, blade-private
  index.ts
```
5 files. Store is co-located but not exposed in barrel.

**Complex blade (store, hooks, sub-components):**
```
src/blades/conventional-commit/
  ConventionalCommitBlade.tsx
  ConventionalCommitBlade.test.tsx
  registration.ts
  store.ts                          # useConventionalStore
  index.ts
  hooks/
    useConventionalCommit.ts
    useCommitExecution.ts
    useAmendPrefill.ts
  components/
    ConventionalCommitForm.tsx
    CommitActionBar.tsx
    CommitPreview.tsx
    ScopeAutocomplete.tsx
    ScopeFrequencyChart.tsx
    TemplateSelector.tsx
    TypeSelector.tsx
  utils/
    conventional-utils.ts
    conventional-utils.test.ts
```
15+ files. Organized into sub-directories by concern, but all within one feature directory.

### 4.3 Shared Infrastructure Directory

Files that are NOT blade-specific stay in a shared location:

```
src/
  shared/
    bladeRegistry.ts              # registerBlade, getBladeRegistration
    bladeOpener.ts                # openBlade from non-React contexts
    bladeUtils.tsx                # renderPathTitle, renderPathBreadcrumb
    types/
      bladeTypes.ts               # BladePropsMap, BladeType, TypedBlade
    hooks/
      useBladeNavigation.ts       # Navigation hook (used by many blades)
      useBladeFormGuard.ts        # Dirty state hook
      useRepoFile.ts              # File content hook (used by viewer blades)
    stores/
      staging.ts                  # Used by staging-changes AND diff blades
      settings.ts                 # Used by settings blade AND App.tsx
      repository.ts               # Used everywhere
      navigation.ts               # Deprecated, but still referenced
    lib/
      animations.ts               # Blade transition animations
      fileDispatch.ts             # File type -> blade type mapping
      fileTypeUtils.ts            # File type utilities
  blades/
    _infrastructure/              # Blade system shell components
      BladeContainer.tsx
      BladeRenderer.tsx
      BladePanel.tsx
      BladeStrip.tsx
      BladeErrorBoundary.tsx
      BladeLoadingFallback.tsx
      BladeToolbar.tsx
      BladeContentEmpty.tsx
      BladeContentError.tsx
      BladeContentLoading.tsx
      BladeBreadcrumb.tsx
      NavigationGuardDialog.tsx
      ProcessNavigation.tsx
    _discovery/
      index.ts                    # import.meta.glob auto-discovery
    changelog/
      ...
    conventional-commit/
      ...
    commit-details/
      ...
    diff/
      ...
    # ... etc
```

The `_infrastructure/` prefix (or `__infrastructure__`) keeps blade system files visually distinct from blade feature directories. The underscore prefix sorts them to the top of the directory listing.

### 4.4 What NOT to Co-locate

Some files should NOT be moved into blade directories even if they seem related:

| File | Why It Stays Shared |
|------|---------------------|
| `bladeRegistry.ts` | Used by all blades and the discovery system |
| `bladeOpener.ts` | Used by command palette, keyboard shortcuts |
| `bladeTypes.ts` (BladePropsMap) | Single source of truth for all blade types |
| `useBladeNavigation.ts` | Used by 8+ blades |
| `useBladeFormGuard.ts` | Used by any blade with forms |
| `animations.ts` | Blade transition config, used by BladeContainer |
| `fileDispatch.ts` | Maps file extensions to blade types, cross-cutting |
| `useStagingStore` | Used by both staging-changes and diff blades |
| `useSettingsStore` | Used by settings blade AND App.tsx initialization |

---

## 5. Import Boundary Enforcement UX

### 5.1 The Core Rule

**Blades must not import from other blades.** Each blade can import from:
- Its own directory (blade-private files)
- `shared/` (infrastructure, shared stores, shared hooks, shared types)
- Third-party packages (`react`, `zustand`, `framer-motion`, etc.)

**Features (non-blade components) must not import from other features.** They can import from:
- Their own directory
- `shared/`

### 5.2 Enforcement Options

The project uses **Biome** (not ESLint) for linting and formatting. This constrains available tooling.

#### Option A: Biome `noPrivateImports` (RECOMMENDED)

**How it works:** Annotate exports with `@package` JSDoc tags. Biome then prevents imports of those exports from outside the package (directory and its subdirectories).

**Implementation:**

1. In each blade's internal files, annotate non-barrel exports:
```typescript
// src/blades/conventional-commit/store.ts
/** @package */
export const useConventionalStore = create<ConventionalState>()(/* ... */);
```

2. The barrel `index.ts` re-exports without `@package`:
```typescript
// src/blades/conventional-commit/index.ts
// These are public -- importable from outside
export { ConventionalCommitBlade } from "./ConventionalCommitBlade";
export type { ConventionalCommitProps } from "./types";
```

3. Biome flags violations:
```
ERROR: Importing a package-scoped symbol from outside its package.
  src/blades/diff/DiffBlade.tsx:3
  import { useConventionalStore } from "../conventional-commit/store";
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  This import violates the @package boundary of 'useConventionalStore'.
```

**DX feedback loop:** Developers see violations in their IDE (Biome LSP integration) with red squiggles, and in CI via `biome check`. Feedback is immediate -- no waiting for a build step.

**Effort:** LOW. Requires adding `@package` JSDoc tags to blade-private exports. Can be done incrementally.

**Limitation:** `noPrivateImports` does not enforce "blade A cannot import from blade B" at the directory level. It works at the export level. A developer who forgets to add `@package` will not get a warning. This is a convention-based approach with tooling assistance.

#### Option B: ESLint `eslint-plugin-boundaries` (ALTERNATIVE)

**How it works:** Define element types and rules in ESLint config:
```javascript
// eslint.config.js
settings: {
  "boundaries/elements": [
    { type: "blade", pattern: "blades/*", mode: "folder", capture: ["bladeName"] },
    { type: "shared", pattern: "shared/**", mode: "full" },
  ]
},
rules: {
  "boundaries/element-types": [2, {
    default: "disallow",
    rules: [
      { from: "blade", allow: ["shared"] },
      // Blades cannot import from other blades
    ]
  }]
}
```

**DX feedback loop:** ESLint errors appear in IDE and CI. Very precise -- can enforce "blade A cannot import blade B" at the directory level.

**Effort:** MEDIUM. Requires adding ESLint alongside Biome. The project currently uses only Biome. Running both introduces:
- Two lint tools to configure and maintain
- Potential rule conflicts
- Slower CI (two passes)
- Developer confusion about which tool enforces what

**Verdict:** Do NOT add ESLint just for boundary enforcement. Use Biome `noPrivateImports` as the primary mechanism, supplemented by TypeScript path mappings (see Option C).

#### Option C: TypeScript Path Aliases + Barrel Files (SUPPLEMENTARY)

**How it works:** Configure `tsconfig.json` paths to make internal blade files un-importable:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/shared/*": ["./src/shared/*"],
      "@/blades/*": ["./src/blades/*/index.ts"]  // Only barrel files
    }
  }
}
```

With this setup, `import { something } from "@/blades/diff"` resolves to `blades/diff/index.ts` (the barrel). Direct imports like `@/blades/diff/store` would need explicit path mapping or would fail.

**Limitation:** Path aliases do not block relative imports (`../diff/store`). A developer can bypass the barrel by using relative paths. This is a soft guard, not a hard boundary.

**Effort:** LOW. Add paths to `tsconfig.json` and update Vite's `resolve.alias`.

**Verdict:** Add `@/shared` and `@/blades` path aliases as a DX improvement (shorter imports, clearer semantics), but rely on Biome `noPrivateImports` for enforcement.

#### Option D: CI Custom Script (SUPPLEMENTARY)

**How it works:** A simple script in CI that greps for cross-blade imports:

```bash
# Check that no blade imports from another blade's internals
for blade_dir in src/blades/*/; do
  blade_name=$(basename "$blade_dir")
  # Find imports from other blade directories (not own, not shared)
  grep -rn "from.*blades/(?!${blade_name}|_)" "$blade_dir" --include="*.ts" --include="*.tsx" && exit 1
done
```

**DX feedback loop:** Only in CI. Not immediate. But catches violations that Biome misses (e.g., missing `@package` annotations).

**Effort:** VERY LOW. A 10-line script.

**Verdict:** Add as a CI safety net, not the primary enforcement mechanism.

### 5.3 Recommended Enforcement Stack

| Layer | Tool | Catches | When |
|-------|------|---------|------|
| **Primary** | Biome `noPrivateImports` + `@package` annotations | Import of blade-private exports from outside | IDE (immediate) + CI |
| **Secondary** | TypeScript path aliases (`@/blades/*`, `@/shared/*`) | Encourages barrel-only imports | IDE (immediate) |
| **Tertiary** | CI grep script | Cross-blade directory imports (regardless of `@package` annotations) | CI (post-push) |

### 5.4 Developer Feedback Speed

| Mechanism | Feedback Time | Developer Action |
|-----------|---------------|------------------|
| Biome IDE integration (LSP) | < 1 second | Red squiggle appears as they type the import |
| TypeScript language server | < 1 second | Import autocomplete only shows barrel exports |
| `biome check` (CLI) | 2-5 seconds | Run before commit (can be a pre-commit hook) |
| CI boundary check | 1-3 minutes | Post-push, blocks merge |

The fastest feedback (< 1 second) comes from Biome LSP and TypeScript, which is where most violations will be caught. The CI check is a safety net for edge cases.

---

## 6. Migration Mechanics: Preserving Auto-Discovery

### 6.1 Current Auto-Discovery System

```typescript
// src/components/blades/registrations/index.ts
const modules = import.meta.glob(["./*.{ts,tsx}", "!./index.ts"], { eager: true });
```

This globs all `.ts` and `.tsx` files in the `registrations/` directory (excluding the index itself). Each file's top-level `registerBlade()` call runs as a side effect.

**Imported in `App.tsx` line 5:**
```typescript
import "./components/blades/registrations";
```

### 6.2 New Auto-Discovery System

```typescript
// src/blades/_discovery/index.ts
import { clearRegistry, getAllBladeTypes } from "@/shared/bladeRegistry";

// Scan all blades/*/registration.ts files
const modules = import.meta.glob(
  ["../**/registration.{ts,tsx}", "!./_infrastructure/**"],
  { eager: true }
);

// Dev-mode exhaustiveness check (same as current)
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

**Update in `App.tsx`:**
```typescript
import "./blades/_discovery";
```

### 6.3 Incremental Migration Support

During migration, some blades will be in the new structure and some in the old. The discovery module can support both:

```typescript
// Scan both old and new locations during migration
const oldModules = import.meta.glob(
  ["../../components/blades/registrations/*.{ts,tsx}", "!**/index.ts"],
  { eager: true }
);
const newModules = import.meta.glob(
  ["../**/registration.{ts,tsx}", "!./_infrastructure/**", "!./_discovery/**"],
  { eager: true }
);
```

As each blade is migrated, its old registration file is deleted and a new `registration.ts` appears in `blades/{name}/`. The discovery module finds both automatically. When all blades are migrated, the old glob is removed.

---

## 7. Handling the DiffSource Type Dependency

### 7.1 The Problem

Currently, `DiffSource` type is defined in `DiffBlade.tsx` and imported by two shared files:
- `src/stores/bladeTypes.ts` (for `BladePropsMap["diff"]`)
- `src/lib/previewRegistry.ts`

After migration, `DiffBlade.tsx` moves to `src/blades/diff/DiffBlade.tsx`. If `bladeTypes.ts` stays in shared, this creates a shared-imports-from-blade violation.

### 7.2 The Solution

Extract `DiffSource` to a shared types file BEFORE migrating the diff blade:

```typescript
// src/shared/types/diff.ts (new file)
export type DiffSource =
  | { mode: "staging"; filePath: string; staged: boolean }
  | { mode: "commit"; oid: string; filePath: string };
```

Then update both `bladeTypes.ts` and `DiffBlade.tsx` to import from the shared location. This removes the circular dependency and respects the boundary rule.

This is the ONLY pre-migration step required for type dependencies. No other blade exports types consumed by shared code.

---

## 8. Impact on Existing Tests

### 8.1 Test File Location

Currently, blade tests are co-located with blade components in `src/components/blades/`. In the new structure, they move to `src/blades/{name}/`.

The `vitest.config.ts` include pattern is already broad enough:
```typescript
include: ["src/**/*.test.{ts,tsx}"],
```

This matches tests in any subdirectory of `src/`, so blade tests at `src/blades/diff/DiffBlade.test.tsx` will be discovered automatically. No vitest config change needed.

### 8.2 Test Import Paths

Tests import from relative paths:
```typescript
// Current: src/components/blades/SettingsBlade.test.tsx
import { render } from "../../test-utils/render";
import { SettingsBlade } from "./SettingsBlade";
```

After migration:
```typescript
// New: src/blades/settings/SettingsBlade.test.tsx
import { render } from "@/shared/test-utils/render";  // or relative: "../../shared/test-utils/render"
import { SettingsBlade } from "./SettingsBlade";        // Still relative, still works
```

The `render` import path changes (deeper nesting), but the component import stays the same since tests are co-located with their component.

### 8.3 Mock Patterns

Tests that mock `../../bindings` or `../../stores/...` will need path updates. This is a mechanical change -- search-and-replace the import paths in mock calls.

---

## Common Pitfalls

### Pitfall 1: Barrel File Re-Export Explosion
**What goes wrong:** The barrel `index.ts` re-exports every internal file, defeating encapsulation. Other blades start importing internals through the barrel.
**Why it happens:** Developer adds exports to barrel "for convenience" without thinking about public API.
**How to avoid:** Strict rule: barrel only exports the blade component and shared types. Review barrel files in PRs.
**Warning signs:** `index.ts` with more than 5 export lines.

### Pitfall 2: Shared Store Moved Into Blade Directory
**What goes wrong:** `useStagingStore` gets moved into `blades/staging-changes/store.ts`, but `blades/diff/` still needs it. Now diff imports from staging-changes, violating boundaries.
**Why it happens:** Store seems "owned" by the staging blade because of naming.
**How to avoid:** Before moving any store, grep for all consumers. If 2+ consumers exist outside the blade, keep it shared.
**Warning signs:** Any store imported by more than one blade directory.

### Pitfall 3: Breaking `import.meta.glob` With Incorrect Patterns
**What goes wrong:** The glob pattern does not match the new `registration.ts` files. No blades register. App shows "Unknown blade" for every type.
**Why it happens:** Glob patterns are string literals and are not type-checked.
**How to avoid:** After changing the glob, verify `Object.keys(modules).length` matches expected count. The existing dev-mode check catches this.
**Warning signs:** Console error "[BladeRegistry] No registration modules found" at dev startup.

### Pitfall 4: Dynamic Import Paths Break Code Splitting
**What goes wrong:** A generic `lazy(() => import(\`../../blades/${type}/Component\`))` pattern means Vite cannot statically analyze imports. All blade code ends up in one chunk.
**Why it happens:** Developer tries to DRY up registration by generating lazy imports from blade type names.
**How to avoid:** Each `registration.ts` must have a literal string import path. No template literals in dynamic imports.
**Warning signs:** Build output shows a single large chunk instead of per-blade chunks.

### Pitfall 5: Missing HMR Disposal After Discovery Module Move
**What goes wrong:** Editing a blade component in dev mode causes the old registration to persist alongside the new one, or the blade disappears entirely until full reload.
**Why it happens:** The HMR `dispose` callback that calls `clearRegistry()` is not ported to the new discovery module.
**How to avoid:** Copy the HMR block verbatim to the new discovery `index.ts`. Test HMR manually after the move.
**Warning signs:** Console shows duplicate "registerBlade" calls or "Missing registrations" warning during HMR.

### Pitfall 6: WelcomeView Direct Import of InitRepoBlade
**What goes wrong:** `WelcomeView.tsx` directly imports and renders `InitRepoBlade` as a component (not through the blade stack). After moving `InitRepoBlade` to `blades/init-repo/`, the import path in `WelcomeView` breaks.
**Why it happens:** `InitRepoBlade` is used both as a blade-stack component AND as a direct-rendered component in a non-blade context.
**How to avoid:** Update `WelcomeView`'s import to use the barrel: `import { InitRepoBlade } from "@/blades/init-repo"`. The barrel should export the component for this use case.
**Warning signs:** TypeScript error in `WelcomeView.tsx` after migration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Import boundary enforcement | Custom webpack/Vite plugin | Biome `noPrivateImports` + `@package` | Biome already runs in the project; adding a plugin increases maintenance |
| Auto-discovery of blade registrations | Manual import list | `import.meta.glob` (already used) | Manual lists are error-prone and violate the "add blade without editing shared files" goal |
| Module scaffolding CLI | Full-blown generator framework | Copy-paste from template or simple shell script | 15 blades is not enough to justify generator infrastructure |
| Barrel file generation | Code generation tool | Manual `index.ts` (3-5 lines per blade) | Over-engineering for the current scale |

---

## Architecture Patterns

### Recommended Project Structure (Target)

```
src/
  blades/                           # All blade features
    _infrastructure/                # Blade system shell (Container, Renderer, Panel, etc.)
    _discovery/                     # Auto-discovery entry point
    changelog/                      # Feature: changelog blade
    commit-details/                 # Feature: commit details blade
    conventional-commit/            # Feature: conventional commit blade
    diff/                           # Feature: diff blade
    gitflow-cheatsheet/             # Feature: gitflow cheatsheet blade
    init-repo/                      # Feature: init repo blade
    repo-browser/                   # Feature: repository browser blade
    settings/                       # Feature: settings blade
    staging-changes/                # Feature: staging changes blade
    topology-graph/                 # Feature: topology graph blade
    viewer-3d/                      # Feature: 3D model viewer blade
    viewer-code/                    # Feature: code viewer blade
    viewer-image/                   # Feature: image viewer blade
    viewer-markdown/                # Feature: markdown viewer blade
    viewer-nupkg/                   # Feature: NuGet package viewer blade
  shared/                           # Cross-cutting shared code
    hooks/                          # Hooks used by multiple blades
    stores/                         # Stores used by multiple blades or App.tsx
    types/                          # Shared type definitions (BladePropsMap, etc.)
    lib/                            # Shared utilities, animation config, etc.
  components/                       # Non-blade UI components (Header, WelcomeView, etc.)
  machines/                         # XState machines (navigation FSM)
  commands/                         # Command palette registrations
  assets/                           # Static assets
  test-utils/                       # Test utilities (render wrapper, setup)
```

### Pattern: Registration-Per-Blade
**What:** Each blade has a `registration.ts` that calls `registerBlade()` with the component, type, and options.
**When to use:** Always. Every blade must have exactly one registration file.
**Why:** Keeps the registration co-located with the component. The discovery module (`_discovery/index.ts`) finds all `registration.ts` files via `import.meta.glob`.

### Pattern: Barrel-as-Public-API
**What:** Each blade's `index.ts` exports only what external code is allowed to import.
**When to use:** Always. Even simple blades need a barrel.
**Why:** Creates a clear boundary. Developers know that imports from `@/blades/some-blade` resolve to the barrel, not to internal files.

### Anti-Patterns to Avoid
- **Deep re-exports:** `blades/diff/index.ts` should NOT re-export from `blades/diff/components/panels/LeftPanel`. Keep barrels flat.
- **Cross-blade imports:** `blades/diff/DiffBlade.tsx` should NOT import from `blades/staging-changes/store.ts`. If both need it, it belongs in `shared/`.
- **God barrel:** A top-level `blades/index.ts` that re-exports all blades. Not needed -- the discovery system handles registration, and direct imports go through individual barrels.

---

## Open Questions

### 1. Should `_infrastructure` blade shell components stay under `blades/` or move to `shared/`?

**What we know:** Components like `BladeContainer`, `BladeRenderer`, and `BladePanel` are the shell that renders blades, not blades themselves. They are used by the app layout, not by individual blades.

**What's unclear:** Whether grouping them under `blades/_infrastructure/` (physical proximity to blade features) is better DX than `shared/blade-shell/` (logical grouping with other shared code).

**Recommendation:** Keep them under `blades/_infrastructure/` for physical proximity. Developers working on the blade system will find everything in one top-level directory. The underscore prefix clearly signals "not a blade feature."

### 2. Should the `@/` path alias be activated for this migration?

**What we know:** `vite.config.ts` already has `resolve.alias: { "@": "/src" }`, but `tsconfig.json` has no `paths` mapping. No file in the codebase currently uses `@/` imports.

**What's unclear:** Whether activating `@/` aliases now (adding `paths` to tsconfig) would simplify the migration or add noise (every import path changes).

**Recommendation:** YES, activate `@/` aliases as part of Phase 29. The migration already touches every import path in blade files. Adding `@/shared/` and `@/blades/` at the same time is lower total cost than two separate passes. Add `"paths": { "@/*": ["./src/*"] }` to `tsconfig.json` to match the existing Vite alias.

### 3. How to handle the `components/commit/` sub-component directory?

**What we know:** `src/components/commit/` contains 15 files used only by the conventional-commit blade. Some (like `ScopeAutocomplete`, `TypeSelector`) are also used by the sidebar commit form in `StagingPanel`.

**What's unclear:** Whether the sidebar commit form should import from the conventional-commit blade's barrel (creating a dependency from non-blade code to blade code), or whether these shared sub-components should stay in `shared/`.

**Recommendation:** Check if each component in `components/commit/` is used outside the conventional-commit blade. If used only by the blade -> move to `blades/conventional-commit/components/`. If shared with the sidebar -> keep in `shared/components/commit/` or extract to `shared/components/`.

---

## Sources

### Primary (HIGH confidence -- codebase analysis)
- `src/components/blades/registrations/index.ts` -- auto-discovery mechanism with `import.meta.glob`
- `src/lib/bladeRegistry.ts` -- blade registration Map, `registerBlade()`, `getBladeRegistration()`
- `src/stores/bladeTypes.ts` -- `BladePropsMap` interface, `BladeType` union type
- `src/components/blades/BladeRenderer.tsx` -- runtime blade resolution from registry
- `src/components/blades/BladeContainer.tsx` -- blade stack rendering, framer-motion animations
- `src/machines/navigation/navigationMachine.ts` -- XState FSM for blade lifecycle
- `src/App.tsx` -- blade registration import, `NavigationProvider` wrapping
- `src/components/WelcomeView.tsx` -- direct `InitRepoBlade` import (non-stack usage)
- `vite.config.ts` -- `@` alias configuration
- `tsconfig.json` -- no `paths` mapping configured
- `biome.json` -- Biome linter configuration (no ESLint)
- `vitest.config.ts` -- test include pattern `src/**/*.test.{ts,tsx}`

### Secondary (MEDIUM confidence -- verified with official sources)
- [Biome `noPrivateImports` rule](https://biomejs.dev/linter/rules/no-private-imports/) -- `@package` annotation enforcement
- [Biome Roadmap 2026](https://biomejs.dev/blog/roadmap-2026/) -- upcoming multi-file analysis capabilities
- [Biome Discussion #6245](https://github.com/biomejs/biome/discussions/6245) -- Nx-style boundary enforcement request
- [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) -- ESLint-based boundary enforcement (Context7 library ID: `/javierbrea/eslint-plugin-boundaries`)
- [Vite Glob Imports](https://vite.dev/guide/features) -- `import.meta.glob` documentation

### Tertiary (MEDIUM confidence -- community patterns)
- [React Folder Structure in 5 Steps (Robin Wieruch, 2025)](https://www.robinwieruch.de/react-folder-structure/) -- co-location best practices
- [Infinum Frontend Handbook](https://infinum.com/handbook/frontend/react/project-structure) -- feature-based structure
- [Profy "Screaming Architecture"](https://profy.dev/article/react-folder-structure) -- feature-module vs layer comparison
- [GeeksforGeeks React Architecture 2025](https://www.geeksforgeeks.org/reactjs/react-architecture-pattern-and-best-practices/) -- co-location patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Biome `noPrivateImports`, `import.meta.glob`, TypeScript path aliases are well-documented
- Architecture: HIGH -- feature-module structure is industry-standard, codebase structure fully analyzed
- Pitfalls: HIGH -- identified through codebase analysis (DiffSource dependency, WelcomeView import, HMR disposal)
- Migration safety: HIGH -- exhaustiveness check, test suite, and incremental migration strategy provide strong safety nets

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable domain, patterns are mature)
