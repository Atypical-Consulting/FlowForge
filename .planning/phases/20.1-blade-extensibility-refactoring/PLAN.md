# Phase 20.1: Blade Extensibility Refactoring — Execution Plan

**Goal**: The blade system supports adding new blade types with a single file (registration + component), enforces type-safe props at compile time, and renders with consistent UX patterns — reducing the per-blade change footprint from 4-7 files to 1-2 files

**Requirements**: REFACTOR-01, REFACTOR-02, REFACTOR-03, REFACTOR-04, REFACTOR-05

---

## Plan 20.1-01: Introduce BladePropsMap and Type-Safe Blade Types

**Wave**: 1
**Depends on**: None
**Covers**: REFACTOR-01

**Tasks**:

### 1a. Create `src/stores/bladeTypes.ts`

Define the central `BladePropsMap` interface that maps each blade type string to its required props shape. Import `DiffSource` from DiffBlade for the diff entry.

```typescript
import type { DiffSource } from "../components/blades/DiffBlade";

/**
 * Central map: blade type → required props.
 * Adding a new blade type = adding one entry here.
 */
export interface BladePropsMap {
  "staging-changes": Record<string, never>;
  "topology-graph": Record<string, never>;
  "commit-details": { oid: string };
  "diff": { source: DiffSource };
  "viewer-nupkg": { filePath: string };
  "viewer-image": { filePath: string; oid?: string };
  "viewer-markdown": { filePath: string };
  "viewer-3d": { filePath: string };
  "repo-browser": { path?: string };
  "settings": Record<string, never>;
  "changelog": Record<string, never>;
  "gitflow-cheatsheet": Record<string, never>;
}

/** Derived from the map — single source of truth */
export type BladeType = keyof BladePropsMap;

/** A type-safe blade with discriminated props */
export type TypedBlade = {
  [K in BladeType]: {
    id: string;
    type: K;
    title: string;
    props: BladePropsMap[K];
  };
}[BladeType];
```

**Note**: Export `DiffSource` from `DiffBlade.tsx` if not already exported.

### 1b. Update `src/stores/blades.ts`

- Remove the hardcoded `BladeType` union (lines 3-15)
- Import `BladeType`, `BladePropsMap`, and `TypedBlade` from `./bladeTypes`
- Re-export `BladeType` and `TypedBlade` for backward compatibility
- Change the `Blade` interface to use `TypedBlade` (or keep `Blade` as a type alias for `TypedBlade`)
- Update `pushBlade` signature to be generic:

```typescript
pushBlade: <K extends BladeType>(blade: {
  type: K;
  title: string;
  props: BladePropsMap[K];
}) => void;
```

- Add `devtools()` middleware wrapper for debugging (conditionally enabled for dev only):

```typescript
import { devtools } from "zustand/middleware";

export const useBladeStore = create<BladeState>()(
  devtools(
    (set) => ({ /* existing implementation */ }),
    { name: "blade-store", enabled: import.meta.env.DEV }
  )
);
```

### 1c. Fix compile errors in existing push sites

After tightening `pushBlade`, fix any type errors in:
- `src/hooks/useBladeNavigation.ts` — update all `pushBlade` calls to match the new generic signature
- `src/hooks/useKeyboardShortcuts.ts` — lines 110, 214
- `src/commands/settings.ts` — line 14
- `src/commands/repository.ts` — line 57

These should mostly work already since the existing objects already match the expected shapes.

### 1d. Export DiffSource from DiffBlade

In `src/components/blades/DiffBlade.tsx`, change `type DiffSource` to `export type DiffSource` so it can be imported by `bladeTypes.ts`.

### 1e. Type-check

Run `npx tsc --noEmit` to verify no new type errors (except the pre-existing TS2440 in bindings.ts).

**Files created**: `src/stores/bladeTypes.ts`
**Files modified**: `src/stores/blades.ts`, `src/hooks/useBladeNavigation.ts`, `src/hooks/useKeyboardShortcuts.ts`, `src/commands/settings.ts`, `src/commands/repository.ts`, `src/components/blades/DiffBlade.tsx`

**Commit**: `refactor(20.1-01): introduce BladePropsMap and type-safe blade types`

**must_haves**:
- `BladePropsMap` interface with all 12 blade type entries
- `BladeType` derived from `keyof BladePropsMap`
- `pushBlade` is generic and compiler-enforced
- All existing push sites compile without `as` casts on the props

---

## Plan 20.1-02: Create Blade Registry Infrastructure

**Wave**: 1
**Depends on**: None (can run in parallel with 20.1-01)
**Covers**: REFACTOR-02

**Tasks**:

### 2a. Create `src/lib/bladeRegistry.ts`

Follow the pattern established by `src/lib/commandRegistry.ts`:

```typescript
import type { ComponentType, LazyExoticComponent, ReactNode } from "react";

export interface BladeRenderContext {
  goBack: () => void;
}

export interface BladeRegistration<TProps = Record<string, never>> {
  /** Unique blade type identifier (must match BladePropsMap key) */
  type: string;
  /** Default title — static string or dynamic from props */
  defaultTitle: string | ((props: TProps) => string);
  /** The blade component (eager or lazy) */
  component: ComponentType<TProps> | LazyExoticComponent<ComponentType<TProps>>;
  /** Whether the component is React.lazy (needs Suspense) */
  lazy?: boolean;
  /** Whether to wrap in BladePanel (default: true) */
  wrapInPanel?: boolean;
  /** Whether to show back button (default: true for non-root) */
  showBack?: boolean;
  /** Custom title content renderer */
  renderTitleContent?: (props: TProps) => ReactNode;
  /** Custom trailing toolbar renderer */
  renderTrailing?: (props: TProps, ctx: BladeRenderContext) => ReactNode;
}

const registry = new Map<string, BladeRegistration<any>>();

export function registerBlade<TProps>(config: BladeRegistration<TProps>): void {
  registry.set(config.type, config);
}

export function getBladeRegistration(type: string): BladeRegistration | undefined {
  return registry.get(type);
}

export function getAllBladeTypes(): string[] {
  return Array.from(registry.keys());
}
```

### 2b. Create shared UI components for blade rendering

**`src/components/blades/BladeLoadingFallback.tsx`**:
```typescript
import { Loader2 } from "lucide-react";

export function BladeLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
    </div>
  );
}
```

**`src/components/blades/BladeErrorBoundary.tsx`**:
A React error boundary that catches errors in blade rendering. Shows:
- The blade title
- Error message
- A "Go back" button that calls `popBlade()`
- A "Retry" button that resets the error state

### 2c. Create `src/components/blades/BladeRenderer.tsx`

Generic render function that replaces the switch statement:

```typescript
import { Suspense } from "react";
import { getBladeRegistration } from "../../lib/bladeRegistry";
import { BladePanel } from "./BladePanel";
import { BladeLoadingFallback } from "./BladeLoadingFallback";
import { BladeErrorBoundary } from "./BladeErrorBoundary";
import type { TypedBlade } from "../../stores/bladeTypes";

interface BladeRendererProps {
  blade: TypedBlade;
  goBack: () => void;
}

export function BladeRenderer({ blade, goBack }: BladeRendererProps) {
  const reg = getBladeRegistration(blade.type);
  if (!reg) return <div className="p-4 text-ctp-red">Unknown blade: {blade.type}</div>;

  const Component = reg.component;
  const title = typeof reg.defaultTitle === "function"
    ? reg.defaultTitle(blade.props)
    : blade.title || reg.defaultTitle;

  let content = <Component {...(blade.props as any)} />;

  if (reg.lazy) {
    content = (
      <Suspense fallback={<BladeLoadingFallback />}>
        {content}
      </Suspense>
    );
  }

  content = (
    <BladeErrorBoundary bladeTitle={title} onBack={goBack}>
      {content}
    </BladeErrorBoundary>
  );

  if (reg.wrapInPanel !== false) {
    content = (
      <BladePanel
        title={title}
        titleContent={reg.renderTitleContent?.(blade.props as any)}
        trailing={reg.renderTrailing?.(blade.props as any, { goBack })}
        showBack={reg.showBack !== false}
        onBack={goBack}
      >
        {content}
      </BladePanel>
    );
  }

  return content;
}
```

**Files created**: `src/lib/bladeRegistry.ts`, `src/components/blades/BladeLoadingFallback.tsx`, `src/components/blades/BladeErrorBoundary.tsx`, `src/components/blades/BladeRenderer.tsx`

**Commit**: `refactor(20.1-02): create blade registry infrastructure and shared components`

**must_haves**:
- `registerBlade` / `getBladeRegistration` API matching the commandRegistry pattern
- `BladeRenderer` component that uses the registry
- `BladeErrorBoundary` wrapping each blade — throwing an error in a blade shows recovery UI with "Go back" button (not white screen)
- `BladeLoadingFallback` as consistent loading UI with Loader2 spinner

---

## Plan 20.1-03: Create Blade Registrations for All 12 Types

**Wave**: 2
**Depends on**: 20.1-01, 20.1-02
**Covers**: REFACTOR-02

**Tasks**:

### 3a. Create registration files for root blades

**`src/components/blades/registrations/staging-changes.ts`**:
```typescript
import { registerBlade } from "../../../lib/bladeRegistry";
import { StagingChangesBlade } from "../StagingChangesBlade";

registerBlade({
  type: "staging-changes",
  defaultTitle: "Changes",
  component: StagingChangesBlade,
  wrapInPanel: false,  // Root blade, no title bar
  showBack: false,
});
```

**`src/components/blades/registrations/topology-graph.ts`**: Same pattern, `wrapInPanel: false`.

### 3b. Create registration files for standard blades

For each of: `commit-details`, `settings`, `changelog`, `viewer-nupkg`, `viewer-image`.

Each follows the same pattern:
```typescript
import { registerBlade } from "../../../lib/bladeRegistry";
import { CommitDetailsBlade } from "../CommitDetailsBlade";

registerBlade<{ oid: string }>({
  type: "commit-details",
  defaultTitle: "Commit",
  component: CommitDetailsBlade,
  wrapInPanel: true,
  showBack: true,
});
```

For `viewer-nupkg` and `viewer-image`, the `defaultTitle` should be a function extracting the filename from `filePath`:
```typescript
defaultTitle: (props) => props.filePath.split("/").pop() || "Package",
```

### 3c. Create registration for the diff blade (complex case)

The diff blade has custom title content and a trailing toolbar toggle. The `diffInline` state moves INTO the registration's `renderTrailing`:

```typescript
import { lazy } from "react";
import { AlignJustify, Columns } from "lucide-react";
import { registerBlade } from "../../../lib/bladeRegistry";
import type { DiffSource } from "../DiffBlade";
import { Button } from "../../ui/button";

// Use lazy import for DiffBlade since it pulls in Monaco (~3MB)
const DiffBlade = lazy(() =>
  import("../DiffBlade").then((m) => ({ default: m.DiffBlade }))
);

registerBlade<{ source: DiffSource }>({
  type: "diff",
  defaultTitle: "Diff",
  component: DiffBlade,
  lazy: true,
  wrapInPanel: true,
  showBack: true,
  renderTitleContent: (props) => {
    const filePath = props.source.filePath;
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash === -1) {
      return <span className="text-sm font-semibold text-ctp-text truncate">{filePath}</span>;
    }
    return (
      <span className="text-sm truncate">
        <span className="text-ctp-overlay1">{filePath.slice(0, lastSlash + 1)}</span>
        <span className="font-semibold text-ctp-text">{filePath.slice(lastSlash + 1)}</span>
      </span>
    );
  },
  // Note: renderTrailing for the inline/side-by-side toggle will be handled
  // by DiffBlade internally (the toggle state belongs with the component)
});
```

**Important**: The `diffInline` state currently lives in `RepositoryView.tsx` and is passed as an `inline` prop to `DiffBlade`. Since the toggle is blade-specific state, it should move INTO `DiffBlade` itself. Update `DiffBlade` to manage its own `inline` state internally instead of receiving it as a prop.

### 3d. Create registration files for lazy-loaded blades

For `viewer-markdown`, `viewer-3d`, `repo-browser`, `gitflow-cheatsheet`. Each uses `React.lazy`:

```typescript
import { lazy } from "react";
import { registerBlade } from "../../../lib/bladeRegistry";

const ViewerMarkdownBlade = lazy(() =>
  import("../ViewerMarkdownBlade").then((m) => ({ default: m.ViewerMarkdownBlade }))
);

registerBlade<{ filePath: string }>({
  type: "viewer-markdown",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Markdown",
  component: ViewerMarkdownBlade,
  lazy: true,
  wrapInPanel: true,
  showBack: true,
});
```

### 3e. Create registration barrel

**`src/components/blades/registrations/index.ts`**:
```typescript
// Blade registration barrel
// Importing these files triggers registerBlade() calls at module load time
import "./staging-changes";
import "./topology-graph";
import "./commit-details";
import "./diff";
import "./viewer-nupkg";
import "./viewer-image";
import "./settings";
import "./changelog";
import "./viewer-markdown";
import "./viewer-3d";
import "./repo-browser";
import "./gitflow-cheatsheet";
```

### 3f. Import the registration barrel in App.tsx

Add `import "./components/blades/registrations"` near the top of `src/App.tsx` (alongside the existing `import "./commands"` barrel).

### 3g. Move diffInline state into DiffBlade

In `src/components/blades/DiffBlade.tsx`:
- Add `const [inline, setInline] = useState(true)` inside the component
- Remove the `inline` prop from `DiffBladeProps` (keep only `source: DiffSource`)
- The inline/side-by-side toggle button moves INTO the DiffBlade component body (above the Monaco editor area), NOT via the BladePanel trailing slot. This is because the toggle is local UI state that belongs with the component, not with the registration. The toggle renders as a small button bar at the top of the blade content area (e.g., `<div className="flex items-center gap-2 px-3 py-1 border-b border-ctp-surface0">`)
- The diff registration in Task 3c has NO `renderTrailing` — only `renderTitleContent` for the file path display

**Files created**: `src/components/blades/registrations/staging-changes.ts`, `topology-graph.ts`, `commit-details.ts`, `diff.ts`, `viewer-nupkg.ts`, `viewer-image.ts`, `settings.ts`, `changelog.ts`, `viewer-markdown.ts`, `viewer-3d.ts`, `repo-browser.ts`, `gitflow-cheatsheet.ts`, `index.ts`
**Files modified**: `src/App.tsx`, `src/components/blades/DiffBlade.tsx`

**Commit**: `refactor(20.1-03): register all 12 blade types with the blade registry`

**must_haves**:
- All 12 blade types registered
- Registration barrel imported at app startup
- DiffBlade manages its own inline toggle state
- Lazy blades use React.lazy in their registrations

---

## Plan 20.1-04: Replace renderBlade Switch with BladeRenderer

**Wave**: 3
**Depends on**: 20.1-03
**Covers**: REFACTOR-02, REFACTOR-03, REFACTOR-04, REFACTOR-05

**Tasks**:

### 4a. Update BladeContainer to use BladeRenderer directly

In `src/components/blades/BladeContainer.tsx`:
- Remove the `renderBlade` callback prop
- Import `BladeRenderer` and `useBladeStore`
- Render the active blade using `<BladeRenderer blade={blade} goBack={popBlade} />`
- Fix AnimatePresence placement: move it OUTSIDE the `.map()` loop
- Use the store's `popBlade` method directly (stable reference from Zustand)

Updated structure:
```typescript
export function BladeContainer() {
  const { bladeStack, popToIndex, popBlade } = useBladeStore();
  const activeBlade = bladeStack[bladeStack.length - 1];

  return (
    <div className="flex h-full overflow-hidden">
      {bladeStack.slice(0, -1).map((blade, index) => (
        <BladeStrip
          key={blade.id}
          title={blade.title}
          onExpand={() => popToIndex(index)}
        />
      ))}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeBlade.id}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
          className="flex-1 min-w-0"
        >
          <BladeRenderer blade={activeBlade} goBack={popBlade} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

### 4b. Clean up RepositoryView.tsx

- Remove the `renderBlade` useCallback (lines 79-242)
- Remove the `diffInline` state and `setDiffInline`
- Remove all lazy import declarations at the top (lines 41-60)
- Remove all blade component imports from the `./blades` barrel that were only used in renderBlade (keep `BladeContainer`)
- Remove the `renderBlade={renderBlade}` prop from `<BladeContainer>`
- `BladeContainer` is now self-contained — no render prop needed

### 4c. Clean up barrel exports

In `src/components/blades/index.ts`:
- Remove exports for lazy-loaded blade components (`ViewerMarkdownBlade`, `Viewer3dBlade`, `RepoBrowserBlade`, `GitflowCheatsheetBlade`) — they are now imported only via lazy registrations
- Keep exports for components that are used directly elsewhere (if any)

### 4d. Type-check and verify

Run `npx tsc --noEmit` to verify all imports and types are correct.

### 4e. Verify AnimatePresence exit animations

After completing the refactor, manually test blade transitions:
1. Open a blade (e.g., Settings) — verify slide-in animation plays
2. Press Back — verify the slide-out exit animation fires (the blade should animate out to the right before disappearing)
3. Push 3+ blades, then click a BladeStrip to pop multiple — verify smooth transition
4. If exit animations are not visible, check that `AnimatePresence mode="popLayout"` is correctly placed OUTSIDE the map, and that the `key` prop on `motion.div` changes when the active blade changes

**Files modified**: `src/components/blades/BladeContainer.tsx`, `src/components/RepositoryView.tsx`, `src/components/blades/index.ts`

**Commit**: `refactor(20.1-04): replace renderBlade switch with registry-based BladeRenderer`

**must_haves**:
- No switch statement in RepositoryView
- BladeContainer uses BladeRenderer internally
- AnimatePresence is outside the map loop with blade.id as key on motion.div
- Exit animations fire when navigating back (verified by manual test)
- No lazy imports in RepositoryView
- RepositoryView is significantly shorter (~120 lines vs ~384)
- All 12 blade types render correctly via the registry

---

## Plan 20.1-05: Refactor Navigation Hook and Consolidate Push Sites

**Wave**: 3
**Depends on**: 20.1-01, 20.1-02 (for typed pushBlade and getBladeRegistration)
**Covers**: REFACTOR-01, REFACTOR-03

**Tasks**:

### 5a. Refactor `useBladeNavigation.ts`

Replace the 9 named helpers with a generic `openBlade` function:

```typescript
import type { BladeType, BladePropsMap } from "../stores/bladeTypes";
import { getBladeRegistration } from "../lib/bladeRegistry";
import { useBladeStore } from "../stores/blades";

export function useBladeNavigation() {
  const store = useBladeStore();

  /** Type-safe blade opener — compiler enforces correct props per type */
  function openBlade<K extends BladeType>(
    type: K,
    props: BladePropsMap[K],
    title?: string,
  ) {
    const reg = getBladeRegistration(type);
    const resolvedTitle =
      title ??
      (typeof reg?.defaultTitle === "function"
        ? reg.defaultTitle(props as any)
        : reg?.defaultTitle ?? type);

    store.pushBlade({ type, title: resolvedTitle, props });
  }

  /** Resolve file extension to viewer type, then open */
  function openFileViewer(
    filePath: string,
    context?: { oid?: string; mode?: string; staged?: boolean },
  ) {
    const type = bladeTypeForFile(filePath);
    const title = filePath.split("/").pop() || filePath;
    store.pushBlade({ type, title, props: { filePath, ...context } as any });
  }

  const goBack = store.popBlade;
  const goToRoot = store.resetStack;

  return {
    openBlade,
    openFileViewer,
    goBack,
    goToRoot,
    ...store,
  };
}
```

Keep `bladeTypeForFile()` as a local utility function (unchanged).

### 5b. Create standalone blade opener for non-React contexts

**`src/lib/bladeOpener.ts`**:
```typescript
import type { BladeType, BladePropsMap } from "../stores/bladeTypes";
import { getBladeRegistration } from "./bladeRegistry";
import { useBladeStore } from "../stores/blades";

/** Open a blade from non-React contexts (command palette, etc.) */
export function openBlade<K extends BladeType>(
  type: K,
  props: BladePropsMap[K],
  title?: string,
) {
  const reg = getBladeRegistration(type);
  const resolvedTitle =
    title ??
    (typeof reg?.defaultTitle === "function"
      ? reg.defaultTitle(props as any)
      : reg?.defaultTitle ?? type);

  useBladeStore.getState().pushBlade({ type, title: resolvedTitle, props });
}
```

### 5c. Update all consumers

Update every file that calls `useBladeNavigation()` or `pushBlade` directly:

**`src/components/Header.tsx`**: Change `openSettings()` and `openChangelog()` to use `openBlade("settings", {})` and `openBlade("changelog", {})`.

**`src/hooks/useKeyboardShortcuts.ts`**: Replace `useBladeStore.getState().pushBlade(...)` calls with `openBlade(...)` from the standalone opener.

**`src/commands/settings.ts`**: Replace direct `pushBlade` with `openBlade("settings", {})`.

**`src/commands/repository.ts`**: Replace direct `pushBlade` with `openBlade("changelog", {})`.

**`src/components/blades/CommitDetailsBlade.tsx`**: Uses `useBladeNavigation()` for `openDiff` — update to `openFileViewer` or `openBlade`.

**`src/components/blades/StagingChangesBlade.tsx`** (and any component using `openStagingDiff`): Update to `openFileViewer`.

### 5d. Add singleton guard for utility blades

In the standalone opener and the hook, check if a singleton blade (settings, changelog) is already on the stack before pushing:

```typescript
function openBlade<K extends BladeType>(...) {
  // Singleton guard for utility blades
  const singletonTypes: BladeType[] = ["settings", "changelog", "gitflow-cheatsheet"];
  if (singletonTypes.includes(type)) {
    const stack = useBladeStore.getState().bladeStack;
    if (stack.some(b => b.type === type)) return;
  }
  // ... push as normal
}
```

### 5e. Type-check

Run `npx tsc --noEmit`.

**Files created**: `src/lib/bladeOpener.ts`
**Files modified**: `src/hooks/useBladeNavigation.ts`, `src/components/Header.tsx`, `src/hooks/useKeyboardShortcuts.ts`, `src/commands/settings.ts`, `src/commands/repository.ts`, `src/components/blades/CommitDetailsBlade.tsx`, `src/components/blades/StagingChangesBlade.tsx` (and any other consumers)

**Commit**: `refactor(20.1-05): generic openBlade replaces per-type navigation helpers`

**must_haves**:
- `openBlade("commit-details", {})` is a TypeScript compile error
- No direct `pushBlade` calls outside the store itself
- Singleton guard prevents duplicate settings/changelog blades
- All consumers updated and compiling

---

## Plan 20.1-06: Final Cleanup and Verification

**Wave**: 4
**Depends on**: 20.1-04, 20.1-05
**Covers**: All REFACTOR requirements

**Tasks**:

### 6a. Remove dead code

- Remove any unused imports from `RepositoryView.tsx`
- Remove any now-unused blade component imports from the barrel
- Remove the old `BladeContainerProps` interface if BladeContainer no longer takes a `renderBlade` prop

### 6b. Verify all blade types render correctly

Manually verify (or write a test) that each of the 12 blade types:
1. Can be opened via `openBlade(type, validProps)`
2. Renders correctly with its registration metadata
3. Shows the correct title in BladePanel and BladeStrip
4. Has a working back button (non-root blades)
5. Shows the error boundary on forced error (optional)

### 6c. Full type-check

Run `npx tsc --noEmit` — no new errors beyond the pre-existing TS2440.

### 6d. Update barrel exports

Ensure `src/components/blades/index.ts` only exports components that are consumed directly (not through the registry). The registry handles the blade-to-component mapping now.

### 6e. Verify bundle impact

Run `npm run build` and verify:
- The build succeeds without errors
- Run `ls -lh dist/assets/*.js | wc -l` to confirm 5+ separate JS chunks (indicating lazy blades are code-split)
- Main bundle size increase should be < 5KB (the registry + types add minimal code)
- Total bundle (all chunks) increase should be < 10KB

**Files modified**: Various cleanup across modified files
**Commit**: `refactor(20.1-06): final cleanup and verification`

**must_haves**:
- `npx tsc --noEmit` passes (except pre-existing TS2440)
- `npm run build` succeeds
- All 12 blade types functional

---

## Plan Dependencies

```
20.1-01 (BladePropsMap) ──┐
                          ├──> 20.1-03 (Registrations) ──> 20.1-04 (Replace switch)
20.1-02 (Registry infra) ─┤                                        │
                          │                                         v
                          └──> 20.1-05 (Navigation hook) ─────> 20.1-06 (Cleanup)
20.1-01 ──────────────────┘                                         ^
                                                         20.1-04 ──┘
```

**Execution waves**:
- Wave 1: 20.1-01, 20.1-02 (parallel)
- Wave 2: 20.1-03
- Wave 3: 20.1-04, 20.1-05 (parallel)
- Wave 4: 20.1-06

---

## Success Criteria Verification

| # | Criterion | Verified by |
|---|-----------|-------------|
| 1 | Adding a new blade type requires only 1-2 files | Plan 20.1-03: registration + component pattern |
| 2 | `pushBlade("commit-details", {})` is a compile error | Plan 20.1-01: generic pushBlade with BladePropsMap |
| 3 | Blade errors show recovery UI, not white screen | Plan 20.1-02: BladeErrorBoundary |
| 4 | Consistent loading/Suspense patterns | Plan 20.1-02: BladeLoadingFallback, 20.1-04: single Suspense in renderer |
| 5 | renderBlade switch replaced by registry | Plan 20.1-04: BladeRenderer + BladeContainer refactor |
| 6 | AnimatePresence exit animations work | Plan 20.1-04: moved outside map loop |

---

*Created: 2026-02-07*
*Phase: 20.1 — Blade Extensibility Refactoring*
*Plans: 6 (in 4 waves)*
