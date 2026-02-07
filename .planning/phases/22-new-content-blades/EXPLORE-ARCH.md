# Architecture Exploration: Blade System (Phase 22)

Deep-dive into the blade registry, type system, rendering pipeline, navigation, and file dispatch — with risks, gaps, and recommendations for the extensibility refactoring.

---

## 1. Blade Registry (`src/lib/bladeRegistry.ts`)

### Current Design
- **Map-based registry**: `Map<string, BladeRegistration<any>>` — runtime store, populated by side-effect imports.
- **`BladeRegistration<TProps>` interface** (7 fields):
  - `type: string` — **not constrained** to `BladeType` union. Any string accepted.
  - `defaultTitle: string | ((props: TProps) => string)` — supports static or dynamic titles.
  - `component: ComponentType<TProps> | LazyExoticComponent<...>` — supports both eager and lazy components.
  - `lazy?: boolean` — flags whether to wrap in `<Suspense>`.
  - `wrapInPanel?: boolean` — defaults to `true` (checked via `!== false`).
  - `showBack?: boolean` — defaults to `true`.
  - `renderTitleContent?` / `renderTrailing?` — custom title bar rendering hooks.
- **API**: `registerBlade<TProps>()`, `getBladeRegistration(type: string)`, `getAllBladeTypes(): string[]`.
- **No unregister**, no validation, no duplicate detection.

### Type Safety Gap
The registry's `type` field is `string`, meaning `registerBlade({ type: "typo-here", ... })` compiles silently. The plan to constrain it to `BladeType` (Plan 22-01 Task 1) is correct and straightforward.

### Risk: `any` Erasure
The internal map is `Map<string, BladeRegistration<any>>`, and `getBladeRegistration` returns `BladeRegistration | undefined` (defaults `TProps = Record<string, never>`). This means `BladeRenderer` must cast props as `any` when passing to `reg.component`. This is an inherent limitation of a runtime registry — compile-time generics are erased. **Not a problem to solve in Phase 22**, but worth documenting.

### Recommendation
- Constrain `type` to `BladeType` ✓ (already planned)
- Add optional `singleton?: boolean` field to `BladeRegistration` instead of maintaining a parallel `SINGLETON_TYPES` array (see Section 5 below)
- Consider adding `category?: string` for future grouping (command palette, blade picker)

---

## 2. Blade Types (`src/stores/bladeTypes.ts`)

### Current Design
- **`BladePropsMap`** interface: 12 entries mapping `BladeType` string → required props object.
- **`BladeType`** = `keyof BladePropsMap` — derived union, single source of truth.
- **`TypedBlade`** = discriminated union (`{ id, type, title, props }`) derived from the map via mapped type.
- **Import of `DiffSource`**: `bladeTypes.ts` imports from `../components/blades/DiffBlade` — this creates a dependency from the type layer into the component layer.

### Entries (12 types currently):
| Type | Props | Lazy? |
|------|-------|-------|
| `staging-changes` | `Record<string, never>` | No |
| `topology-graph` | `Record<string, never>` | No |
| `commit-details` | `{ oid: string }` | No |
| `diff` | `{ source: DiffSource }` | Yes |
| `viewer-nupkg` | `{ filePath: string }` | No |
| `viewer-image` | `{ filePath: string; oid?: string }` | No |
| `viewer-markdown` | `{ filePath: string }` | Yes |
| `viewer-3d` | `{ filePath: string }` | Yes |
| `repo-browser` | `{ path?: string }` | Yes |
| `settings` | `Record<string, never>` | No |
| `changelog` | `Record<string, never>` | No |
| `gitflow-cheatsheet` | `Record<string, never>` | Yes |

### Observation: Common Props Pattern
Five viewer blades share `{ filePath: string }` or `{ filePath: string; oid?: string }`. A shared base interface would reduce repetition:
```ts
interface FileViewerProps { filePath: string; oid?: string }
```
This would be useful for the `viewer-code` addition and any future file viewers.

### Cross-Layer Import Risk
`bladeTypes.ts` imports `DiffSource` from the `DiffBlade` component. This is a **type-only import** so it doesn't create a runtime dependency cycle, but it couples the type definition layer to a specific component. Consider moving `DiffSource` to a shared types file or keeping it in `bladeTypes.ts` directly.

---

## 3. Registrations Directory (`src/components/blades/registrations/`)

### Current Structure
- **13 files**: 12 registration files + 1 `index.ts` barrel.
- **12 `.ts` files** and **1 `.tsx` file** (`diff.tsx`) — the diff registration uses JSX in `renderTitleContent`.
- **Barrel file** (`index.ts`): explicit import list of all 12 registration files. Each import triggers the side-effect `registerBlade()` call.
- **Imported from** `src/App.tsx` line 5: `import "./components/blades/registrations"` — ensures all blades are registered before any rendering.

### Registration Patterns

**Simple (no props, no lazy)**:
```ts
registerBlade({ type: "settings", defaultTitle: "Settings", component: SettingsBlade });
```

**With typed props**:
```ts
registerBlade<{ oid: string }>({ type: "commit-details", defaultTitle: "Commit", component: CommitDetailsBlade });
```

**Lazy-loaded**:
```ts
const ViewerMarkdownBlade = lazy(() => import("../ViewerMarkdownBlade").then(...));
registerBlade<{ filePath: string }>({ type: "viewer-markdown", defaultTitle: (props) => ..., component: ViewerMarkdownBlade, lazy: true });
```

**With JSX rendering hooks** (diff.tsx only):
```tsx
registerBlade<{ source: DiffSource }>({ type: "diff", ..., renderTitleContent: (props) => <span>...</span> });
```

### Critical `import.meta.glob` Issue

Plan 22-01 Task 3 proposes:
```ts
const modules = import.meta.glob(["./*.ts", "!./index.ts"], { eager: true });
```

**BUG**: This glob pattern `"./*.ts"` will **NOT** match `diff.tsx` because `.ts` and `.tsx` are different extensions. The diff blade registration will silently be excluded.

**Fix**: The glob must be:
```ts
const modules = import.meta.glob(["./*.ts", "./*.tsx", "!./index.ts"], { eager: true });
```
Or use a broader pattern:
```ts
const modules = import.meta.glob(["./*.{ts,tsx}", "!./index.ts"], { eager: true });
```

Note: Vite's `import.meta.glob` supports brace expansion in globs, so `"./*.{ts,tsx}"` should work. Verify with Vite docs.

### Module Execution Order
With `eager: true`, all matched modules execute synchronously at import time. The order is determined by the filesystem sort order (alphabetical). This should be fine since registrations are independent — no inter-registration dependencies.

---

## 4. BladeRenderer (`src/components/blades/BladeRenderer.tsx`)

### Rendering Pipeline
1. Lookup registration via `getBladeRegistration(blade.type)`.
2. Fallback: red "Unknown blade" div if not found.
3. Resolve title: dynamic function or static string.
4. Create component: `<Component {...(blade.props as any)} />`.
5. Wrap in `<Suspense>` if `reg.lazy`.
6. Always wrap in `<BladeErrorBoundary>`.
7. Wrap in `<BladePanel>` unless `wrapInPanel === false`.

### Props Casting
The `as any` casts are necessary because the runtime registry loses generic type information. This is acceptable and not a type safety concern — the type safety is enforced at the `openBlade` / `pushBlade` call site, not at render time.

### Error Handling
`BladeErrorBoundary` is a class-based error boundary with retry and go-back actions. `BladeLoadingFallback` shows a centered spinner. Both are well-implemented.

### No Performance Concern
BladeRenderer creates inline JSX on each render but this is fine — React handles this efficiently. The `Suspense` wrapping only applies to lazy blades.

---

## 5. Navigation & Blade Opening

### Two Code Paths (Duplication)

**1. `useBladeNavigation` hook** (React context):
- `openBlade<K>(type, props, title?)` — type-safe generic, used from React components.
- `openDiff(oid, filePath)` — commit file dispatch.
- `openStagingDiff(file, section)` — staging file dispatch.
- Contains `SINGLETON_TYPES` array.

**2. `bladeOpener.ts`** (non-React context):
- `openBlade<K>(type, props, title?)` — identical logic, uses `useBladeStore.getState()`.
- Used from `commands/settings.ts`, `commands/repository.ts`, `hooks/useKeyboardShortcuts.ts`.
- Also contains its own `SINGLETON_TYPES` array — **duplicated definition**.

### SINGLETON_TYPES Duplication
Both files maintain identical `SINGLETON_TYPES` arrays:
```ts
const SINGLETON_TYPES: BladeType[] = ["settings", "changelog", "gitflow-cheatsheet"];
```
This is fragile — if a new singleton blade is added, both arrays must be updated.

**Recommendation**: Move `singleton` into `BladeRegistration` interface:
```ts
interface BladeRegistration<TProps> {
  // ...existing fields
  singleton?: boolean;
}
```
Then the guard logic checks `reg?.singleton` instead of maintaining a separate list.

### File Dispatch in Navigation
Both `openDiff` and `openStagingDiff` use `bladeTypeForFile()` and then have branching logic:
- If type is `"diff"` → construct `DiffSource` and call `openBlade("diff", { source: ... })`.
- If type is `"viewer-image"` → call `openBlade("viewer-image", { filePath, oid })`.
- Else → `store.pushBlade({ type, title, props: { filePath } as any })`.

The `as any` cast in the else branch is a type safety hole — it bypasses `BladePropsMap` validation. The declarative file dispatch refactoring should also address this by making the navigation helpers generic over the dispatch result.

---

## 6. File Type Utils (`src/lib/fileTypeUtils.ts`)

### Current Design
- **`bladeTypeForFile(filePath): BladeType`** — cascading if/else on extensions, returns `"diff"` as default.
- **`isTextDiffable(filePath): boolean`** — delegates to `bladeTypeForFile === "diff"`.
- **`isBinaryFile(filePath): boolean`** — checks against `BINARY_EXTENSIONS` set.
- **Only consumer**: `useBladeNavigation.ts` imports `bladeTypeForFile`.

### Planned Replacement
Plan 22-01 Task 4 creates `src/lib/fileDispatch.ts` with:
- `FILE_DISPATCH_MAP: ReadonlyMap<string, BladeType>` — declarative extension mapping.
- `bladeTypeForFile(filePath, context)` — adds `context` parameter with `"diff" | "browse"`.
- `hasSpecializedViewer(filePath)` — new utility.
- `isBinaryExtension(filePath)` — replaces `isBinaryFile`.

Plan 22-01 Task 5 converts `fileTypeUtils.ts` to re-export from `fileDispatch.ts`.

### Signature Change Risk
The new `bladeTypeForFile` adds an optional `context` parameter. Existing call sites:
- `useBladeNavigation.ts:39` — `bladeTypeForFile(filePath)` — still works (defaults to `"diff"`).
- No other call sites found.

This is backward compatible. No risk.

---

## 7. Blade Store (`src/stores/blades.ts`)

### State Shape
```ts
interface BladeState {
  activeProcess: ProcessType;           // "staging" | "topology"
  bladeStack: TypedBlade[];             // full blade stack
  setProcess(p): void;                  // resets stack to root
  pushBlade<K>(blade): void;            // adds blade with crypto.randomUUID() id
  popBlade(): void;                     // removes last (guards against empty)
  popToIndex(index): void;              // breadcrumb navigation
  replaceBlade<K>(blade): void;         // replaces last blade
  resetStack(): void;                   // back to root
}
```

### Root Blade Logic
`rootBladeForProcess()` returns a `TypedBlade` with `id: "root"` for either staging or topology. This is well-encapsulated.

### Type Safety
`pushBlade` and `replaceBlade` are generic over `BladeType`, ensuring compile-time props validation. The cast `as TypedBlade` at the spread is safe because the generic constraint guarantees correctness.

### Zustand Devtools
Enabled only in dev mode via `import.meta.env.DEV`. Good practice.

---

## 8. Vite Config (`vite.config.ts`)

### Relevant for `import.meta.glob`
- Standard Vite config with `@tailwindcss/vite`, `@vitejs/plugin-react`, `vite-plugin-svgr`.
- **Path alias**: `@ → /src` — available for imports but not currently used in registrations.
- **No custom glob config** — `import.meta.glob` will use Vite's built-in behavior.
- **`optimizeDeps.include`**: `dagre-d3-es` — pre-bundled. No impact on registration.
- **Target**: Safari 13+ (macOS) or Chrome 105+ (Windows) — relevant for Tauri.

### `import.meta.glob` Behavior
With `eager: true`, Vite statically analyzes the glob at build time and generates import statements. This means:
- No runtime filesystem access needed.
- The result is a record of module exports.
- Tree-shaking still applies to unused exports within matched modules.
- **Build time**: negligible impact for ~12 small files.

---

## 9. Import Graph & Circular Dependency Analysis

### Module Dependency Flow
```
App.tsx
  └── imports registrations/index.ts (side-effect)
        └── imports each registration/*.ts
              └── each calls registerBlade() from lib/bladeRegistry.ts
              └── some import components (lazy or eager)

stores/bladeTypes.ts
  └── imported by stores/blades.ts, hooks/useBladeNavigation.ts,
      lib/fileTypeUtils.ts, lib/bladeOpener.ts, components/blades/BladeRenderer.tsx
  └── imports DiffSource from components/blades/DiffBlade (type-only)

lib/bladeRegistry.ts
  └── imported by all registration files (registerBlade)
  └── imported by BladeRenderer.tsx, useBladeNavigation.ts, bladeOpener.ts (getBladeRegistration)
  └── NO imports from stores or components — it's a leaf module
```

### Potential Circular Dependency
**Currently none.** The key insight is:
- `bladeRegistry.ts` imports nothing from the project (pure module).
- `bladeTypes.ts` has a type-only import from `DiffBlade.tsx` — no runtime cycle.
- Registration files import from `bladeRegistry.ts` (one direction only).

### Post-Refactoring Risk
If `bladeRegistry.ts` is changed to import `BladeType` from `bladeTypes.ts` (Plan 22-01 Task 1), the dependency becomes:
```
bladeRegistry.ts → (type import) → bladeTypes.ts → (type import) → DiffBlade.tsx
registration/*.ts → bladeRegistry.ts
```
This is still safe because:
- `bladeRegistry.ts → bladeTypes.ts` is type-only.
- Registration files don't import from `bladeTypes.ts` directly.
- No circular runtime dependencies.

### `import.meta.glob` and Circular Risk
The glob-based barrel (`registrations/index.ts`) will import all sibling `.ts`/`.tsx` files. Since `index.ts` itself doesn't call `registerBlade()`, and the exclusion pattern `!./index.ts` prevents self-import, there's no circular issue.

---

## 10. Summary of Risks & Issues

### CRITICAL
1. **`import.meta.glob` pattern misses `.tsx` files**: Plan 22-01 Task 3 uses `"./*.ts"` which will not match `diff.tsx`. Must use `"./*.{ts,tsx}"` or include both `"./*.ts"` and `"./*.tsx"`.

### MODERATE
2. **Duplicated `SINGLETON_TYPES`**: Both `useBladeNavigation.ts` and `bladeOpener.ts` maintain identical arrays. Should be consolidated — either into the registry (`singleton` field) or a shared constant.
3. **`as any` cast in `openDiff`/`openStagingDiff` else-branch**: `store.pushBlade({ type, title, props: { filePath } as any })` bypasses type safety for non-diff, non-image viewer types. The file dispatch refactoring should produce properly-typed props.
4. **Hardcoded `EXPECTED_TYPES` in exhaustiveness check** (Plan 22-01 Task 6): Listing types manually defeats the purpose. Better to derive from `BladePropsMap` at build time or use `Object.keys()` on a type-to-key helper.

### LOW
5. **`DiffSource` imported across layers**: `bladeTypes.ts` imports from a component. Minor coupling — could be moved to a shared types file.
6. **`bladeOpener.ts` duplicates `openBlade` logic from `useBladeNavigation.ts`**: Consider extracting a shared `createBladeOpener` function.
7. **No duplicate registration guard**: Calling `registerBlade()` twice with the same type silently overwrites. In dev mode, a warning would be helpful.

---

## 11. Recommendations for Plan 22-01 Refinement

1. **Fix the glob pattern** in Task 3 to include `.tsx`:
   ```ts
   import.meta.glob(["./*.{ts,tsx}", "!./index.ts"], { eager: true })
   ```

2. **Derive exhaustiveness check dynamically** in Task 6 instead of hardcoding types. The `getAllBladeTypes()` returns registered types; the check needs to compare against the full `BladePropsMap` keyset. One approach:
   ```ts
   // Build a set of all expected types from BladePropsMap at compile time
   import type { BladeType } from "../../../stores/bladeTypes";
   const ALL_TYPES: BladeType[] = [/* auto-maintained list */];
   ```
   Or accept the manual list as pragmatic — the compile-time `BladeType` union already guards against typos in this list.

3. **Add `singleton` field to `BladeRegistration`** and delete both `SINGLETON_TYPES` arrays.

4. **Rename `diff.tsx` to `diff.ts`**: Extract the JSX from `renderTitleContent` into a small helper component imported from a separate file. This keeps all registrations as `.ts` and simplifies the glob. Alternatively, just fix the glob pattern (option 1 above).

5. **Type the else-branch in `openDiff`/`openStagingDiff`**: After file dispatch refactoring, ensure that all blade opening paths go through `openBlade<K>()` for full type safety.

6. **Add duplicate registration warning**:
   ```ts
   export function registerBlade<TProps>(config: BladeRegistration<TProps>): void {
     if (import.meta.env.DEV && registry.has(config.type)) {
       console.warn(`[BladeRegistry] Duplicate registration for "${config.type}"`);
     }
     registry.set(config.type, config);
   }
   ```
