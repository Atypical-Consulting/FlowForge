# Phase 38: Content Viewer Extraction -- Implementation Research

**Researched:** 2026-02-10
**Domain:** Extension-based content viewers (Markdown, Code, 3D)
**Confidence:** HIGH
**Focus:** Refactoring to enforce extensibility -- concrete file paths, component analysis, extraction strategy

---

## Summary

Phase 38 extracts the three content viewers (Markdown preview, Monaco code viewer, Three.js 3D model viewer) from core blade registrations into a single built-in extension called `content-viewers`. The extension system infrastructure from Phases 33-37 provides all the building blocks: `ExtensionAPI.registerBlade()`, `ExtensionHost.registerBuiltIn()`, the blade registry with source-based cleanup, and lazy loading via `React.lazy()`. The key challenge is that the `MarkdownRenderer` component is shared with DiffBlade and the GitHub extension, so it must remain in core. The viewer blades themselves are self-contained and can be moved cleanly. The `fileDispatch.ts` system needs to become extension-overlay-aware so the content-viewers extension can register its file type mappings, with graceful fallback when disabled.

The total code surface to extract is approximately 1,970 lines across 29 files, but the actual extraction is structurally simple: all three viewer blades already accept a `{ filePath: string }` props interface, use `useRepoFile()` for data loading, and register via `registerBlade()`. The transformation from core blade registration to extension-contributed blade registration follows the exact pattern established by the GitHub extension (314 lines, Phase 33-36).

**Primary recommendation:** Move the three viewer blade directories into `src/extensions/content-viewers/blades/`, create an `onActivate()` that registers the blades via `api.registerBlade()` and file dispatch entries via a new `api.registerFileDispatch()` method, and add a plain-text fallback blade that activates when the extension is disabled.

---

## 1. Current Implementation Inventory

### 1.1 Markdown Viewer

| File | Lines | Key Exports | Role |
|------|-------|-------------|------|
| `src/blades/viewer-markdown/ViewerMarkdownBlade.tsx` | 61 | `ViewerMarkdownBlade` | Main component: loads file via `useRepoFile()`, renders `<MarkdownRenderer>` |
| `src/blades/viewer-markdown/registration.ts` | 17 | (side effect) | Core blade registration with `React.lazy()` |
| `src/blades/viewer-markdown/index.ts` | 1 | barrel | Re-exports component |
| `src/blades/viewer-markdown/ViewerMarkdownBlade.test.tsx` | 21 | test | Smoke test with mocked bindings |

**Dependencies used by ViewerMarkdownBlade:**
- `useRepoFile()` hook (core, `src/hooks/useRepoFile.ts`, 27 lines)
- `MarkdownRenderer` component (core, `src/components/markdown/MarkdownRenderer.tsx`, 69 lines)
- `BladeContentLoading`, `BladeContentError`, `BladeContentEmpty` (core shared blade components)
- `lucide-react` (FileText icon)

**MarkdownRenderer sub-components (ALL remain in core -- shared with DiffBlade and GitHub extension):**

| File | Lines | Used By |
|------|-------|---------|
| `src/components/markdown/MarkdownRenderer.tsx` | 69 | ViewerMarkdownBlade, DiffBlade (lazy), GitHub PR/Issue blades |
| `src/components/markdown/markdownComponents.tsx` | 236 | MarkdownRenderer |
| `src/components/markdown/MarkdownLink.tsx` | 64 | markdownComponents |
| `src/components/markdown/MarkdownImage.tsx` | 102 | markdownComponents |
| `src/components/markdown/CopyCodeButton.tsx` | 39 | markdownComponents |

**Critical finding:** `MarkdownRenderer` is imported by:
1. `ViewerMarkdownBlade` (target of extraction)
2. `DiffBlade` via `React.lazy()` (core, must NOT be moved)
3. `PullRequestDetailBlade`, `IssueDetailBlade`, `CommentCard` in GitHub extension (already extension, imports from `../../../components/markdown/`)

**Decision: MarkdownRenderer stays in core.** Moving it would break DiffBlade and require the GitHub extension to cross-import from content-viewers. The ViewerMarkdownBlade will import it from `../../components/markdown/` (relative path changes when blade moves).

**Markdown npm dependencies (all remain in package.json -- shared):**
- `react-markdown` ^10.1.0
- `remark-gfm` ^4.0.1
- `rehype-highlight` ^7.0.2
- `rehype-sanitize` ^6.0.0
- `@catppuccin/highlightjs` ^1.0.1

### 1.2 Code Viewer (Monaco)

| File | Lines | Key Exports | Role |
|------|-------|-------------|------|
| `src/blades/viewer-code/ViewerCodeBlade.tsx` | 70 | `ViewerCodeBlade` | Monaco Editor in read-only mode, binary file detection |
| `src/blades/viewer-code/registration.ts` | 17 | (side effect) | Core blade registration with `React.lazy()` |
| `src/blades/viewer-code/index.ts` | 1 | barrel | Re-exports component |
| `src/blades/viewer-code/ViewerCodeBlade.test.tsx` | 30 | test | Smoke test with mocked Monaco |

**Dependencies used by ViewerCodeBlade:**
- `@monaco-editor/react` `Editor` component (npm, ^4.7.0)
- `MONACO_COMMON_OPTIONS`, `MONACO_THEME` from `src/lib/monacoConfig.ts` (23 lines)
- `src/lib/monacoTheme.ts` (49 lines) -- side-effect import that defines the Catppuccin theme
- `src/lib/monacoWorkers.ts` (13 lines) -- worker config
- `useRepoFile()` hook (core)
- `BladeContentLoading`, `BladeContentError`, `BladeContentEmpty` (core shared)
- `lucide-react` (FileCode icon)

**Critical finding:** Monaco config files are shared with DiffBlade:
- `DiffBlade.tsx` imports `MONACO_COMMON_OPTIONS`, `MONACO_THEME` from `monacoConfig.ts`
- `DiffBlade.tsx` imports `monacoTheme.ts` as side effect

**Decision: monacoConfig.ts, monacoTheme.ts, monacoWorkers.ts stay in core.** They are shared with DiffBlade. ViewerCodeBlade will import them from `../../lib/monacoConfig` (path adjusts after move).

**Monaco npm dependencies (remain in package.json -- shared with DiffBlade):**
- `@monaco-editor/react` ^4.7.0
- `monaco-editor` ^0.55.1 (devDependency, used for types + worker bundling)

**Bundle size consideration:** Monaco Editor is the single largest JS dependency (~3MB before tree-shaking). It is already lazy-loaded via `React.lazy()` in registration.ts. The extension pattern maintains this lazy loading because `ensureComponents()` uses dynamic `import()`.

### 1.3 3D Model Viewer (Three.js)

| File | Lines | Key Exports | Role |
|------|-------|-------------|------|
| `src/blades/viewer-3d/Viewer3dBlade.tsx` | 506 | `Viewer3dBlade` | Full Three.js scene: WebGL renderer, GLTF/GLB loader, OrbitControls, resize observer, context loss handling |
| `src/blades/viewer-3d/registration.ts` | 17 | (side effect) | Core blade registration with `React.lazy()` |
| `src/blades/viewer-3d/index.ts` | 2 | barrel (comment only) |
| `src/blades/viewer-3d/Viewer3dBlade.test.tsx` | 81 | test | Smoke test with comprehensive Three.js mocks |

**Dependencies used by Viewer3dBlade:**
- `three` ^0.182.0 (THREE, WebGLRenderer, Scene, Camera, Box3, etc.)
- `three/examples/jsm/loaders/GLTFLoader.js`
- `three/examples/jsm/controls/OrbitControls.js`
- `@types/three` ^0.182.0 (devDependency)
- `commands.readRepoFile()` directly (NOT via useRepoFile hook -- manual ArrayBuffer handling for binary GLB)
- `getErrorMessage()` from `src/lib/errors.ts`
- `BladeContentLoading`, `BladeContentError`, `BladeContentEmpty` (core shared)
- `lucide-react` (Box, Info, RotateCcw icons)

**Unique characteristics:**
- Does NOT use `useRepoFile()` -- manually calls `commands.readRepoFile()` to get binary content as base64
- Manages its own loading/error state (not react-query)
- Has complex WebGL lifecycle: context loss/restore handlers, ResizeObserver, animation frame loop
- Hardcodes Catppuccin color for Three.js scene background: `new THREE.Color(0x1e1e2e)` (ctp-base)
- Shows first-time interaction hint via localStorage

**Three.js npm dependencies (move to extension-only if no other consumer exists):**
- `three` ^0.182.0
- `@types/three` ^0.182.0

**Critical finding:** `three` is used ONLY by Viewer3dBlade. No other file imports from `three`. This means if the content-viewers extension is disabled, `three` will not be loaded at all (already lazy via `React.lazy()`). Good for bundle size.

### 1.4 Additional Viewer Blades (NOT in scope for extraction)

| Viewer | Lines | Reason to Keep in Core |
|--------|-------|----------------------|
| `viewer-image` (84 lines) | Uses core Tauri commands (getFileBase64, getCommitFileBase64) | Image viewing is a fundamental file operation. Discussed below. |
| `viewer-nupkg` (18 lines blade + 196 components/viewers) | NuGet-specific, uses Tauri `fetchNugetInfo` command | Could be extracted later but is orthogonal to Phase 38 scope. |

**Recommendation on viewer-image:** The phase requirements say "Opening a source file launches the Monaco code viewer" and "Opening a .gltf/.glb file launches the 3D model viewer" but does NOT mention image viewer. The image viewer should stay as a core blade because:
1. It is used by `openDiff()` and `openStagingDiff()` in `useBladeNavigation.ts` directly (lines 57-58, 83-84)
2. Image preview is a fundamental git operation (viewing binary changes)
3. It has no heavy external dependencies (no library like Three.js or Monaco)

### 1.5 Supporting Registries

| File | Lines | Role | Impact |
|------|-------|------|--------|
| `src/lib/fileDispatch.ts` | 85 | Maps file extensions to blade types | Must become extensible for extension registration |
| `src/lib/previewRegistry.ts` | 30 | Maps file paths to inline diff preview modes | Used by staging-changes blade, not by content viewers |
| `src/components/viewers/ViewerRegistry.ts` | 37 | Generic viewer matcher (unused by the 3 target viewers) | Not impacted |
| `src/lib/fileTypeUtils.ts` | 9 | Re-exports from fileDispatch | Not impacted directly |
| `src/blades/staging-changes/components/previewRegistrations.ts` | 58 | Registers preview placeholders for binary/image/3D | May need adjustment if 3D preview becomes extension-aware |

---

## 2. Extension Registration Pattern (GitHub Extension Template)

### 2.1 File Structure

```
src/extensions/github/
  index.ts              -- onActivate(api), onDeactivate(), ensureComponents()
  githubStore.ts        -- Zustand store for GitHub-specific state
  types.ts              -- TypeScript types
  blades/
    GitHubAuthBlade.tsx
    GitHubAccountBlade.tsx
    PullRequestListBlade.tsx
    PullRequestDetailBlade.tsx
    IssueListBlade.tsx
    IssueDetailBlade.tsx
    CreatePullRequestBlade.tsx
  components/
    GitHubStatusButton.tsx
    CommentCard.tsx
    ... (9 more components)
  hooks/
    useGitHubQuery.ts
    useGitHubMutation.ts
```

### 2.2 Registration Call (App.tsx, line 59-65)

```typescript
registerBuiltIn({
  id: "github",
  name: "GitHub Integration",
  version: "1.0.0",
  activate: githubActivate,
  deactivate: githubDeactivate,
});
```

### 2.3 Activation Pattern (github/index.ts)

Key pattern elements:
1. **Lazy component loading** via `ensureComponents()` with dynamic `import()` (lines 23-65)
2. **Blade registration** via `api.registerBlade()` with type, title, component, singleton, wrapInPanel, showBack (lines 72-133)
3. **Command registration** via `api.registerCommand()` with id, title, category, icon, action, enabled (lines 136-190)
4. **Toolbar contribution** via `api.contributeToolbar()` with id, label, icon, group, priority, when, execute, renderCustom (lines 193-258)
5. **Store subscriptions** tracked for manual cleanup (lines 265-292)
6. **Deactivation** cancels polling, clears query cache, unsubscribes store watchers (lines 300-322)

### 2.4 Blade Namespacing

Extension blades get namespaced types: `ext:github:sign-in`, `ext:github:account`, etc.

The `openBlade()` function (in `src/lib/bladeOpener.ts`) accepts both core and extension blade types. It resolves the title from the blade registration and sends a `PUSH_BLADE` event to the navigation state machine.

### 2.5 Key Difference for Content Viewers

The GitHub extension registers its own NEW blade types (sign-in, account, pull-requests, etc.). The content-viewers extension must **replace existing core blade types** (viewer-markdown, viewer-code, viewer-3d). This creates two challenges:

1. **BladePropsMap type safety:** Core blade types are defined in `src/stores/bladeTypes.ts`. If `viewer-markdown` becomes `ext:content-viewers:viewer-markdown`, all type-safe references to `"viewer-markdown"` in core code break.

2. **fileDispatch mapping:** `fileDispatch.ts` maps `.md` -> `"viewer-markdown"`. If the blade type changes, the dispatch needs to change too.

**Solution -- Dual registration strategy:**
- The content-viewers extension registers blades under their ORIGINAL core names (NOT namespaced). This is a special privilege for built-in extensions that replace core functionality.
- Add a `skipNamespacing?: boolean` option to `ExtensionAPI.registerBlade()` for trusted built-in extensions, OR register via direct `registerBlade()` (bypassing ExtensionAPI namespacing) inside the extension.
- Alternative (simpler): the extension registers file dispatch overlay entries that map to `ext:content-viewers:markdown` etc., and `fileDispatch` returns extension blade types. This requires updating `BladePropsMap` to accept the extension types, which it already does via the `ExtensionBladeType` union.

**Recommended approach:** Use the ExtensionAPI normally (namespaced types like `ext:content-viewers:markdown`), and have `fileDispatch.ts` support an extension overlay map. When the extension is disabled, the overlay entries are removed, and `fileDispatch` falls back to a plain-text viewer blade (also core, always registered).

---

## 3. Blade System Implementation Details

### 3.1 openBlade() Flow

```
1. openBlade(type, props, title?)           -- src/lib/bladeOpener.ts
2.   -> getBladeRegistration(type)          -- src/lib/bladeRegistry.ts (Map lookup)
3.   -> resolve title from registration
4.   -> getNavigationActor().send({ type: "PUSH_BLADE", bladeType, title, props })
5.   -> XState navigation machine adds blade to stack
6.   -> BladeRenderer renders the blade       -- src/blades/_shared/BladeRenderer.tsx
7.     -> getBladeRegistration(blade.type)   -- lookup component
8.     -> <Component {...props} />            -- render with Suspense if lazy
```

### 3.2 BladeRegistration Interface

```typescript
interface BladeRegistration<TProps> {
  type: string;                    // "viewer-markdown" or "ext:content-viewers:markdown"
  defaultTitle: string | ((props: TProps) => string);
  component: ComponentType<TProps> | LazyExoticComponent<ComponentType<TProps>>;
  lazy?: boolean;                  // wrap in Suspense
  wrapInPanel?: boolean;           // wrap in BladePanel header
  showBack?: boolean;              // show back button
  singleton?: boolean;             // only one instance in stack
  renderTitleContent?: (props: TProps) => ReactNode;
  renderTrailing?: (props: TProps, ctx: BladeRenderContext) => ReactNode;
  source?: string;                 // "core" or "ext:{extensionId}"
}
```

### 3.3 BladePropsMap Type System

```typescript
// src/stores/bladeTypes.ts
interface BladePropsMap {
  "viewer-markdown": { filePath: string };
  "viewer-3d": { filePath: string };
  "viewer-code": { filePath: string };
  // ... other core types
}

type CoreBladeType = keyof BladePropsMap;
type ExtensionBladeType = `ext:${string}:${string}`;
type BladeType = CoreBladeType | ExtensionBladeType;
```

### 3.4 Blade Discovery System

`src/blades/_discovery.ts` uses `import.meta.glob()` to auto-discover all `registration.ts` files under `src/blades/*/`. It has a dev-mode exhaustiveness check against `EXPECTED_TYPES`:

```typescript
const EXPECTED_TYPES: string[] = [
  "staging-changes", "topology-graph", "commit-details", "diff",
  "viewer-nupkg", "viewer-image", "viewer-markdown", "viewer-3d",
  "viewer-code", "repo-browser", "settings", "changelog",
  "gitflow-cheatsheet", "init-repo", "conventional-commit", "extension-manager",
];
```

When viewers move to the extension, their registration.ts files are removed from `src/blades/`, and the `EXPECTED_TYPES` array must be updated to remove `"viewer-markdown"`, `"viewer-3d"`, `"viewer-code"`.

---

## 4. React Component Extraction Analysis

### 4.1 ViewerMarkdownBlade

**Props:** `{ filePath: string }`
**Hooks/stores used:**
- `useRepoFile(filePath)` -- core hook, react-query
- `useRef<HTMLDivElement>` -- focus management
- `useEffect` -- focus on mount

**What changes for extension:**
- Import paths for `MarkdownRenderer`, `BladeContentLoading/Error/Empty`, `useRepoFile` change to `../../../components/...`, `../../../blades/_shared/...`, `../../../hooks/...`
- Registration moves from `registration.ts` (auto-discovered) to `onActivate()` in extension index
- Component file moves from `src/blades/viewer-markdown/` to `src/extensions/content-viewers/blades/`

**Tailwind v4 considerations:** Uses `bg-ctp-base`, `p-6`, `max-w-3xl`, `outline-none` -- all standard utilities. No custom animations. No `@theme` dependencies.

### 4.2 ViewerCodeBlade

**Props:** `{ filePath: string }`
**Hooks/stores used:**
- `useRepoFile(filePath)` -- core hook
- No state management hooks

**What changes for extension:**
- Import paths for `@monaco-editor/react`, `monacoConfig`, `monacoTheme`, shared blade components change
- Side-effect import `../../lib/monacoTheme` must be preserved (registers Monaco theme)
- `formatFileSize()` is a local utility (no extraction needed)

**Tailwind v4 considerations:** `bg-ctp-mantle`, `text-ctp-overlay0`, `text-ctp-subtext0` -- standard tokens. No custom animations.

### 4.3 Viewer3dBlade

**Props:** `{ filePath: string }`
**Hooks/stores used:**
- `commands.readRepoFile()` -- direct Tauri binding (NOT useRepoFile)
- `getErrorMessage()` from `src/lib/errors.ts`
- Complex useState/useRef/useCallback/useEffect for Three.js lifecycle
- `localStorage` for hint tracking

**What changes for extension:**
- Import paths for `commands`, `getErrorMessage`, shared blade components change
- `disposeMaterial()` and `formatFileSize()` are local utilities
- The Three.js scene background color `0x1e1e2e` is hardcoded Catppuccin base -- remains fine

**Tailwind v4 considerations:** Uses `bg-ctp-mantle`, `bg-ctp-crust/90`, `backdrop-blur-sm`, `animate-pulse`, `motion-safe:animate-[fadeOut_0.3s_ease-out_3.5s_forwards]`. The custom `fadeOut` animation must be verified against the `@theme {}` block in CSS.

---

## 5. FileDispatch Extensibility Design

### 5.1 Current Architecture

```typescript
// src/lib/fileDispatch.ts -- IMMUTABLE
const FILE_DISPATCH_MAP: ReadonlyMap<string, BladeType> = new Map([
  ["md", "viewer-markdown"],
  ["mdx", "viewer-markdown"],
  ["glb", "viewer-3d"],
  ["gltf", "viewer-3d"],
  // ... images, nupkg
]);
```

### 5.2 Required Change: Extension Overlay

```typescript
// Extension overlay (mutable, added/removed by extensions)
interface FileDispatchEntry {
  bladeType: string;
  source: string;  // "ext:content-viewers" for cleanup
}

const extensionDispatch = new Map<string, FileDispatchEntry>();

export function registerFileDispatch(
  extensions: string[],
  bladeType: string,
  source: string,
): void {
  for (const ext of extensions) {
    extensionDispatch.set(ext, { bladeType, source });
  }
}

export function unregisterFileDispatchBySource(source: string): void {
  for (const [ext, entry] of extensionDispatch) {
    if (entry.source === source) {
      extensionDispatch.delete(ext);
    }
  }
}

export function bladeTypeForFile(
  filePath: string,
  context: "diff" | "browse" = "diff",
): BladeType {
  const ext = getExtension(filePath);

  // Extension overlay takes precedence
  const extEntry = extensionDispatch.get(ext);
  if (extEntry) return extEntry.bladeType as BladeType;

  // Core dispatch (images, nupkg -- always available)
  const coreMapped = CORE_DISPATCH.get(ext);
  if (coreMapped) return coreMapped;

  // Context-aware fallback
  if (context === "browse") return "viewer-code";
  return "diff";
}
```

### 5.3 What Stays in CORE_DISPATCH

| Extension | Blade Type | Why Core |
|-----------|-----------|----------|
| png, jpg, jpeg, gif, webp, svg, ico, bmp | `viewer-image` | Used by useBladeNavigation directly |
| nupkg | `viewer-nupkg` | No heavy deps, stays in core |

### 5.4 What Moves to Extension Overlay

| Extension | Blade Type (Extension) | Registered By |
|-----------|----------------------|---------------|
| md, mdx | `ext:content-viewers:markdown` | content-viewers onActivate |
| glb, gltf | `ext:content-viewers:3d` | content-viewers onActivate |
| (default browse) | `ext:content-viewers:code` | content-viewers onActivate |

### 5.5 Fallback Behavior (Extension Disabled)

When content-viewers is disabled:
- `.md` files: No extension overlay match, no core dispatch match, falls back to `"diff"` (diff context) or `"viewer-code"` (browse context). **Problem:** `"viewer-code"` is now also gone.
- Solution: Add a `"viewer-plaintext"` core blade that shows raw text without Monaco. This is the "plain text display" fallback required by success criterion #4.
- Alternative (simpler): Keep `"viewer-code"` as a CORE blade type in `BladePropsMap` but have its registration come from the extension. When the extension is disabled and someone tries to open a code file, `BladeRenderer` shows "Unknown blade: viewer-code" fallback. This is NOT graceful.

**Recommended fallback design:**

1. Add a minimal `viewer-plaintext` core blade (always registered) that shows file content in a `<pre>` tag with line numbers. ~30 lines of code.
2. When content-viewers extension is disabled:
   - `fileDispatch` overlay entries are removed by `unregisterFileDispatchBySource()`
   - `.md` files in browse context -> fallback chain -> `viewer-plaintext` (was `viewer-code`)
   - Source files in browse context -> `viewer-plaintext`
   - `.glb/.gltf` files -> binary detection -> placeholder
3. The `bladeTypeForFile()` browse fallback changes from `"viewer-code"` to `"viewer-plaintext"`

### 5.6 Impact on useBladeNavigation

`src/hooks/useBladeNavigation.ts` calls `bladeTypeForFile()` and has hardcoded blade type checks:

```typescript
// Lines 55-57 in openDiff():
if (type === "diff" || type === "viewer-markdown") {
  openBlade("diff", { source: { mode: "commit", oid, filePath } }, title);
}
```

When `viewer-markdown` moves to extension, `bladeTypeForFile()` returns `"ext:content-viewers:markdown"`. The condition `type === "viewer-markdown"` would fail. **Fix:** Change the check to use a helper function or check if the type starts with a known pattern, or better yet, update `bladeTypeForFile()` to return a semantic category alongside the blade type.

**Simpler fix:** Keep `"viewer-markdown"`, `"viewer-code"`, `"viewer-3d"` as CORE blade type names in `BladePropsMap`, but have their registrations come from the extension (without namespacing). The extension uses a special `registerCoreOverrideBlade()` or passes `source: "ext:content-viewers"` to `registerBlade()` directly (bypassing ExtensionAPI namespacing).

**Recommendation: Non-namespaced blade registration for core replacement extensions.**

Add a flag to `ExtensionBladeConfig`:

```typescript
interface ExtensionBladeConfig {
  // ... existing fields
  /** If true, blade type is NOT prefixed with ext:{extensionId}: */
  coreOverride?: boolean;
}
```

This way:
- `api.registerBlade({ type: "markdown", ... })` normally becomes `ext:content-viewers:markdown`
- `api.registerBlade({ type: "viewer-markdown", coreOverride: true, ... })` registers as `viewer-markdown` exactly
- The source tag is still `"ext:content-viewers"` for cleanup
- `fileDispatch.ts` does NOT need to change at all
- `BladePropsMap` does NOT need to change
- `useBladeNavigation.ts` does NOT need to change
- When extension is disabled, `cleanup()` removes the blade registrations
- `BladeRenderer` shows "Unknown blade" for that type, which we replace with the `viewer-plaintext` fallback

**This is the cleanest approach with minimum code changes.**

---

## 6. Proposed File Structure

### 6.1 New Files to Create

```
src/extensions/content-viewers/
  index.ts                           -- onActivate(api), onDeactivate()
  blades/
    ViewerMarkdownBlade.tsx          -- MOVED from src/blades/viewer-markdown/
    ViewerCodeBlade.tsx              -- MOVED from src/blades/viewer-code/
    Viewer3dBlade.tsx                -- MOVED from src/blades/viewer-3d/

src/blades/viewer-plaintext/
  ViewerPlaintextBlade.tsx           -- NEW: ~40 lines, <pre> with line numbers
  registration.ts                    -- NEW: core registration
  ViewerPlaintextBlade.test.tsx      -- NEW: smoke test
```

### 6.2 Files to Delete

```
src/blades/viewer-markdown/ViewerMarkdownBlade.tsx
src/blades/viewer-markdown/registration.ts
src/blades/viewer-markdown/index.ts
src/blades/viewer-markdown/ViewerMarkdownBlade.test.tsx

src/blades/viewer-code/ViewerCodeBlade.tsx
src/blades/viewer-code/registration.ts
src/blades/viewer-code/index.ts
src/blades/viewer-code/ViewerCodeBlade.test.tsx

src/blades/viewer-3d/Viewer3dBlade.tsx
src/blades/viewer-3d/registration.ts
src/blades/viewer-3d/index.ts
src/blades/viewer-3d/Viewer3dBlade.test.tsx
```

### 6.3 Files to Modify

| File | Change |
|------|--------|
| `src/blades/_discovery.ts` | Remove `viewer-markdown`, `viewer-3d`, `viewer-code` from `EXPECTED_TYPES` |
| `src/stores/bladeTypes.ts` | Add `"viewer-plaintext": { filePath: string }` to BladePropsMap |
| `src/lib/fileDispatch.ts` | Change browse fallback from `"viewer-code"` to `"viewer-plaintext"` |
| `src/extensions/ExtensionAPI.ts` | Add `coreOverride?: boolean` to `ExtensionBladeConfig`, implement non-namespaced registration |
| `src/App.tsx` | Add `registerBuiltIn()` call for content-viewers extension |
| `src/blades/_shared/BladeRenderer.tsx` | Improve "Unknown blade" fallback to show file path and offer plain text view |

### 6.4 Files That Do NOT Change

- `src/components/markdown/*` (stays in core)
- `src/lib/monacoConfig.ts`, `monacoTheme.ts`, `monacoWorkers.ts` (stay in core, shared with DiffBlade)
- `src/lib/previewRegistry.ts` (not impacted)
- `src/hooks/useRepoFile.ts` (stays in core)
- `src/hooks/useBladeNavigation.ts` (blade type names unchanged due to coreOverride)
- `src/blades/viewer-image/*` (stays in core)
- `src/blades/viewer-nupkg/*` (stays in core)

---

## 7. Extension Entry Point Design

### 7.1 content-viewers/index.ts

```typescript
import type { ExtensionAPI } from "../ExtensionAPI";

let ViewerMarkdownBlade: React.ComponentType<any> | null = null;
let ViewerCodeBlade: React.ComponentType<any> | null = null;
let Viewer3dBlade: React.ComponentType<any> | null = null;

async function ensureComponents(): Promise<void> {
  if (!ViewerMarkdownBlade) {
    const mod = await import("./blades/ViewerMarkdownBlade");
    ViewerMarkdownBlade = mod.ViewerMarkdownBlade;
  }
  if (!ViewerCodeBlade) {
    const mod = await import("./blades/ViewerCodeBlade");
    ViewerCodeBlade = mod.ViewerCodeBlade;
  }
  if (!Viewer3dBlade) {
    const mod = await import("./blades/Viewer3dBlade");
    Viewer3dBlade = mod.Viewer3dBlade;
  }
}

export async function onActivate(api: ExtensionAPI): Promise<void> {
  await ensureComponents();

  // Register blades with coreOverride to preserve existing blade type names
  api.registerBlade({
    type: "viewer-markdown",
    title: "Markdown Preview",
    component: ViewerMarkdownBlade!,
    coreOverride: true,
  });

  api.registerBlade({
    type: "viewer-code",
    title: "Code Viewer",
    component: ViewerCodeBlade!,
    coreOverride: true,
  });

  api.registerBlade({
    type: "viewer-3d",
    title: "3D Model Viewer",
    component: Viewer3dBlade!,
    coreOverride: true,
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles blade unregistration
}
```

### 7.2 Registration in App.tsx

```typescript
import {
  onActivate as contentViewersActivate,
  onDeactivate as contentViewersDeactivate,
} from "./extensions/content-viewers";

// In useEffect:
registerBuiltIn({
  id: "content-viewers",
  name: "Content Viewers",
  version: "1.0.0",
  activate: contentViewersActivate,
  deactivate: contentViewersDeactivate,
});
```

---

## 8. Testing Patterns

### 8.1 Existing Viewer Tests

All three viewer tests follow the same pattern:
1. Mock `commands.readRepoFile` via `vi.hoisted()` + `vi.mock()`
2. Mock heavy dependencies (Monaco, Three.js) with stubs
3. Render with `render()` from `test-utils/render.tsx`
4. Assert `container.firstChild` is not null (smoke test)

### 8.2 Test File Moves

Tests move alongside their components:

```
src/extensions/content-viewers/__tests__/
  ViewerMarkdownBlade.test.tsx
  ViewerCodeBlade.test.tsx
  Viewer3dBlade.test.tsx
  content-viewers-extension.test.ts   -- NEW: extension lifecycle test
```

### 8.3 New Extension Lifecycle Test

Following the pattern from `src/extensions/__tests__/ExtensionAPI.test.ts`:

```typescript
describe("content-viewers extension", () => {
  it("registers three blade types on activation", async () => {
    const api = new ExtensionAPI("content-viewers");
    await onActivate(api);

    expect(getBladeRegistration("viewer-markdown")).toBeDefined();
    expect(getBladeRegistration("viewer-code")).toBeDefined();
    expect(getBladeRegistration("viewer-3d")).toBeDefined();
  });

  it("unregisters all blade types on cleanup", async () => {
    const api = new ExtensionAPI("content-viewers");
    await onActivate(api);
    api.cleanup();

    expect(getBladeRegistration("viewer-markdown")).toBeUndefined();
    expect(getBladeRegistration("viewer-code")).toBeUndefined();
    expect(getBladeRegistration("viewer-3d")).toBeUndefined();
  });

  it("falls back to viewer-plaintext when extension disabled", () => {
    // Verify fileDispatch returns "viewer-plaintext" for .ts files in browse context
    // when no extension overlay is registered
    expect(bladeTypeForFile("test.ts", "browse")).toBe("viewer-plaintext");
  });

  it("falls back to diff for .md files in diff context when extension disabled", () => {
    expect(bladeTypeForFile("README.md", "diff")).toBe("diff");
  });
});
```

### 8.4 Monaco Mock (from ViewerCodeBlade.test.tsx)

```typescript
vi.mock("@monaco-editor/react", () => ({
  default: () => <div data-testid="mock-monaco-editor" />,
  Editor: () => <div data-testid="mock-monaco-editor" />,
  loader: {
    config: vi.fn(),
    init: vi.fn().mockResolvedValue({ editor: { defineTheme: vi.fn() } }),
  },
}));
```

### 8.5 Three.js Mock (from Viewer3dBlade.test.tsx)

Comprehensive mock of `three`, `GLTFLoader`, and `OrbitControls` -- 55 lines. This mock must move with the test.

---

## 9. Performance Considerations

### 9.1 Bundle Size Impact

| Dependency | Approx Size | Lazy Loaded? | Shared? |
|-----------|-------------|-------------|---------|
| `three` | ~600KB min+gz | Yes (React.lazy in registration) | No -- only Viewer3dBlade |
| `@monaco-editor/react` + `monaco-editor` | ~3MB | Yes (React.lazy in registration) | Yes -- shared with DiffBlade |
| `react-markdown` + plugins | ~100KB | No (imported by MarkdownRenderer) | Yes -- stays in core |

### 9.2 Lazy Loading Strategy

Currently, all three viewer blades use `React.lazy()` in their `registration.ts` files:

```typescript
const ViewerCodeBlade = lazy(() =>
  import("./ViewerCodeBlade").then((m) => ({ default: m.ViewerCodeBlade })),
);
```

In the extension pattern, lazy loading happens at two levels:
1. **Extension activation:** `ensureComponents()` uses dynamic `import()` -- loads component modules when extension activates
2. **Blade rendering:** `BladeRenderer` wraps lazy components in `<Suspense>` with `<BladeLoadingFallback />`

**Post-extraction:** The `React.lazy()` in the old `registration.ts` is no longer needed because the extension's `ensureComponents()` handles the lazy import. However, for consistency with the GitHub extension pattern, the extension should still use `ensureComponents()` with dynamic imports (not `React.lazy()`). The `lazy: true` flag in the blade registration config should NOT be set, because the component is already resolved by the time `registerBlade` is called.

Wait -- this needs careful analysis. Looking at the GitHub extension:
- Components are loaded via `await import()` in `ensureComponents()`
- Blade registration passes the already-resolved component: `component: GitHubAuthBlade!`
- No `lazy: true` flag is set
- `BladeRenderer` does NOT wrap in Suspense (since `reg.lazy` is falsy)

But for content viewers, the heavy dependencies (Monaco, Three.js) should still be lazy-loaded. The component modules themselves import these heavy deps at the top level.

**Solution:** Use `React.lazy()` in the extension for the heavy components:

```typescript
const ViewerCodeBlade = lazy(() =>
  import("./blades/ViewerCodeBlade").then(m => ({ default: m.ViewerCodeBlade }))
);

export async function onActivate(api: ExtensionAPI): Promise<void> {
  api.registerBlade({
    type: "viewer-code",
    title: "Code Viewer",
    component: ViewerCodeBlade,  // LazyExoticComponent
    lazy: true,                  // Tell BladeRenderer to wrap in Suspense
    coreOverride: true,
  });
}
```

This avoids the `ensureComponents()` pattern (which eagerly loads all modules on activation) and preserves the current lazy loading behavior. The component is only loaded when a user actually opens a code file.

### 9.3 Tauri-Specific Considerations

- WebGL context is managed by the Tauri webview (wry/WebKit on macOS, WebView2 on Windows). Three.js works identically in Tauri and browser.
- Monaco Editor web workers are configured in `monacoWorkers.ts` using Vite's `?worker` import. This stays in core and is not affected by the extraction.
- `commands.readRepoFile()` is a Tauri IPC call -- available to extensions since they run in the same process.

---

## 10. ExtensionAPI Change: coreOverride

### 10.1 Minimal Implementation

In `src/extensions/ExtensionAPI.ts`, modify `registerBlade()`:

```typescript
registerBlade(config: ExtensionBladeConfig): void {
  const namespacedType = config.coreOverride
    ? config.type
    : `ext:${this.extensionId}:${config.type}`;

  registerBlade({
    ...config,
    type: namespacedType,
    defaultTitle: config.title,
    source: `ext:${this.extensionId}`,
  });
  this.registeredBlades.push(namespacedType);
}
```

### 10.2 Cleanup Still Works

Because `this.registeredBlades` tracks the actual registered type (whether namespaced or not), `cleanup()` calls `unregisterBlade(type)` with the correct key:

```typescript
// In cleanup():
for (const type of this.registeredBlades) {
  unregisterBlade(type);  // "viewer-markdown" (not namespaced)
}
```

### 10.3 Type Safety

Add to `ExtensionBladeConfig`:

```typescript
export interface ExtensionBladeConfig {
  type: string;
  title: string;
  component: ComponentType<any>;
  singleton?: boolean;
  lazy?: boolean;
  wrapInPanel?: boolean;
  showBack?: boolean;
  renderTitleContent?: (props: any) => ReactNode;
  renderTrailing?: (props: any, ctx: BladeRenderContext) => ReactNode;
  /** If true, blade type is registered without ext:{extensionId}: prefix.
   *  Use for built-in extensions that replace core blade types. */
  coreOverride?: boolean;
}
```

---

## 11. Common Pitfalls

### Pitfall 1: MarkdownRenderer Circular Import
**What goes wrong:** Moving MarkdownRenderer into the content-viewers extension breaks DiffBlade and GitHub extension.
**Why it happens:** Multiple core and extension components depend on MarkdownRenderer.
**How to avoid:** MarkdownRenderer stays in `src/components/markdown/`. Only the ViewerMarkdownBlade (which is a thin wrapper) moves.
**Warning signs:** Import errors in DiffBlade or GitHub extension after extraction.

### Pitfall 2: Monaco Theme Not Registered
**What goes wrong:** Code viewer shows unstyled Monaco editor (wrong colors).
**Why it happens:** `monacoTheme.ts` is a side-effect import. If the import chain changes, the theme might not be registered before Monaco renders.
**How to avoid:** The ViewerCodeBlade must import `../../lib/monacoTheme` (path changes after move). Verify the import is present.
**Warning signs:** White/default-theme Monaco editor in the code viewer.

### Pitfall 3: Lost Lazy Loading for Three.js
**What goes wrong:** The entire `three` library is loaded on app startup instead of on-demand.
**Why it happens:** Using `ensureComponents()` (GitHub pattern) loads all extension components eagerly at activation. For Three.js (600KB), this is unacceptable.
**How to avoid:** Use `React.lazy()` for Viewer3dBlade in the extension's `onActivate()`, with `lazy: true` in the blade registration config.
**Warning signs:** Slow app startup, large initial bundle in devtools Network panel.

### Pitfall 4: BladePropsMap Type Breakage
**What goes wrong:** TypeScript errors everywhere that references `"viewer-markdown"`, `"viewer-code"`, `"viewer-3d"`.
**Why it happens:** If blade types are namespaced, they no longer match `CoreBladeType`.
**How to avoid:** Use `coreOverride: true` to keep the original blade type names.
**Warning signs:** TypeScript compile errors in `useBladeNavigation.ts`, `RepoBrowserBlade.tsx`.

### Pitfall 5: _discovery.ts Warning Spam
**What goes wrong:** Dev console shows `[BladeRegistry] Missing registrations: viewer-markdown, viewer-3d, viewer-code`.
**Why it happens:** The blade types are now registered by the extension (during activation) not by eager `registration.ts` (during import.meta.glob). The discovery check runs before extension activation.
**How to avoid:** Remove the three viewer types from `EXPECTED_TYPES` in `_discovery.ts`.
**Warning signs:** Console warnings during development.

### Pitfall 6: No Fallback When Extension Disabled
**What goes wrong:** User opens a .ts file with content-viewers disabled and sees "Unknown blade: viewer-code".
**Why it happens:** `fileDispatch.ts` returns `"viewer-code"` as browse fallback, but the blade is not registered.
**How to avoid:** Create `viewer-plaintext` core blade, change fileDispatch browse fallback to `"viewer-plaintext"`.
**Warning signs:** "Unknown blade" error messages when opening files with extension disabled.

---

## 12. Implementation Order

```
Plan 38-01: Foundation (fileDispatch extensibility + viewer-plaintext fallback)
  1. Add `coreOverride?: boolean` to ExtensionBladeConfig
  2. Implement non-namespaced registration in ExtensionAPI.registerBlade()
  3. Create viewer-plaintext blade (core, always available)
  4. Change fileDispatch.ts browse fallback from "viewer-code" to "viewer-plaintext"
  5. Add "viewer-plaintext" to BladePropsMap
  6. Add "viewer-plaintext" to EXPECTED_TYPES in _discovery.ts
  7. Tests: coreOverride registration, viewer-plaintext rendering, fileDispatch fallback

Plan 38-02: Content Viewers Extension
  1. Create src/extensions/content-viewers/index.ts
  2. Move ViewerMarkdownBlade.tsx (update imports)
  3. Move ViewerCodeBlade.tsx (update imports, preserve monacoTheme import)
  4. Move Viewer3dBlade.tsx (update imports)
  5. Register in App.tsx as built-in extension
  6. Remove old registration.ts files from src/blades/viewer-{markdown,code,3d}/
  7. Remove old directories (viewer-markdown, viewer-code, viewer-3d from src/blades/)
  8. Update _discovery.ts EXPECTED_TYPES
  9. Remove viewer-markdown, viewer-3d, viewer-code from CORE_DISPATCH in fileDispatch.ts
     (these are now registered by the extension)
  10. Tests: extension lifecycle, blade registration/unregistration, move existing tests

Plan 38-03: Graceful Fallback + Integration
  1. Verify disabling content-viewers extension falls back to viewer-plaintext
  2. Verify re-enabling content-viewers extension restores all three viewers
  3. Improve BladeRenderer "unknown blade" fallback message
  4. End-to-end test: open .md, .ts, .glb files with extension on/off
  5. Verify MarkdownRenderer still works in DiffBlade and GitHub extension
  6. Verify Monaco theme still works in DiffBlade
```

---

## 13. Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blade type resolution | Custom type mapping layer | Existing `bladeRegistry` + `coreOverride` flag | Registry already handles type lookup, source cleanup |
| Lazy loading | Custom module loader | `React.lazy()` + `Suspense` | Already proven in the codebase, works with Vite |
| Extension cleanup | Manual cleanup tracking | `ExtensionAPI.cleanup()` with source-based unregister | Already handles blade, command, toolbar cleanup atomically |
| Plain text rendering | Build a full text editor | Simple `<pre>` with line numbers | The fallback is intentionally minimal; Monaco is the rich viewer |

---

## 14. Code Examples

### 14.1 coreOverride Registration

```typescript
// In ExtensionAPI.registerBlade()
registerBlade(config: ExtensionBladeConfig): void {
  const namespacedType = config.coreOverride
    ? config.type
    : `ext:${this.extensionId}:${config.type}`;

  registerBlade({
    ...config,
    type: namespacedType,
    defaultTitle: config.title,
    source: `ext:${this.extensionId}`,
  });
  this.registeredBlades.push(namespacedType);
}
```

### 14.2 ViewerPlaintextBlade (Fallback)

```typescript
// src/blades/viewer-plaintext/ViewerPlaintextBlade.tsx
import { FileText } from "lucide-react";
import { useRepoFile } from "../../hooks/useRepoFile";
import { BladeContentLoading } from "../_shared/BladeContentLoading";
import { BladeContentError } from "../_shared/BladeContentError";
import { BladeContentEmpty } from "../_shared/BladeContentEmpty";

interface ViewerPlaintextBladeProps {
  filePath: string;
}

export function ViewerPlaintextBlade({ filePath }: ViewerPlaintextBladeProps) {
  const { data, isLoading, error, refetch } = useRepoFile(filePath);

  if (isLoading) return <BladeContentLoading />;
  if (error) return <BladeContentError message="Failed to load file" detail={error.message} onRetry={() => refetch()} />;
  if (!data || data.isBinary) return <BladeContentEmpty icon={FileText} message="Binary or missing file" detail={filePath} />;

  const lines = data.content.split("\n");
  return (
    <div className="flex-1 overflow-auto h-full bg-ctp-crust font-mono text-sm">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="hover:bg-ctp-surface0/30">
              <td className="px-3 py-0 text-right text-ctp-overlay0 select-none w-12 shrink-0">
                {i + 1}
              </td>
              <td className="px-3 py-0 text-ctp-text whitespace-pre">
                {line || "\u00A0"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 14.3 Extension onActivate with Lazy Loading

```typescript
// src/extensions/content-viewers/index.ts
import { lazy } from "react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { renderPathBreadcrumb } from "../../lib/bladeUtils";

const ViewerMarkdownBlade = lazy(() =>
  import("./blades/ViewerMarkdownBlade").then(m => ({ default: m.ViewerMarkdownBlade }))
);
const ViewerCodeBlade = lazy(() =>
  import("./blades/ViewerCodeBlade").then(m => ({ default: m.ViewerCodeBlade }))
);
const Viewer3dBlade = lazy(() =>
  import("./blades/Viewer3dBlade").then(m => ({ default: m.Viewer3dBlade }))
);

export async function onActivate(api: ExtensionAPI): Promise<void> {
  api.registerBlade({
    type: "viewer-markdown",
    title: "Markdown Preview",
    component: ViewerMarkdownBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: any) => renderPathBreadcrumb(props.filePath),
  });

  api.registerBlade({
    type: "viewer-code",
    title: "Code Viewer",
    component: ViewerCodeBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: any) => renderPathBreadcrumb(props.filePath),
  });

  api.registerBlade({
    type: "viewer-3d",
    title: "3D Model Viewer",
    component: Viewer3dBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: any) => renderPathBreadcrumb(props.filePath),
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed
}
```

---

## 15. Open Questions

### 1. Should viewer-image also be extracted?
- **What we know:** Phase requirements mention .md, source, and .gltf/.glb but not images. Image viewer has no heavy dependencies. It is referenced directly in `useBladeNavigation.ts`.
- **What's unclear:** Whether the requirement "Content Viewer Extraction" implies ALL viewers or just the three heavy ones.
- **Recommendation:** Keep viewer-image in core for Phase 38. Extract later if needed.

### 2. Should viewer-nupkg be extracted?
- **What we know:** NugetPackageViewer uses a Tauri command and `@tanstack/react-query`. It is niche (.nupkg files only).
- **What's unclear:** Whether it belongs in content-viewers or a separate nupkg extension.
- **Recommendation:** Keep in core for Phase 38. Consider separate extraction later.

### 3. Should the fileDispatch overlay be a full registry (Zustand)?
- **What we know:** Phase 37 architecture research recommended making fileDispatch extensible with overlay maps. The current implementation is a simple `ReadonlyMap`.
- **What's unclear:** Whether reactive state (Zustand) is needed for fileDispatch or if a simple mutable Map suffices.
- **Recommendation:** Simple mutable Map with source tracking. FileDispatch is read during blade opening (imperative), not during rendering (reactive). No Zustand needed.

---

## Sources

### Primary (HIGH confidence -- codebase analysis)
- `src/extensions/github/index.ts` (314 lines) -- Reference built-in extension with full lifecycle
- `src/extensions/ExtensionAPI.ts` (332 lines) -- Current API facade with all registration methods
- `src/extensions/ExtensionHost.ts` (403 lines) -- registerBuiltIn, activate/deactivate lifecycle
- `src/blades/viewer-markdown/ViewerMarkdownBlade.tsx` (61 lines) -- Target component
- `src/blades/viewer-code/ViewerCodeBlade.tsx` (70 lines) -- Target component
- `src/blades/viewer-3d/Viewer3dBlade.tsx` (506 lines) -- Target component
- `src/blades/_discovery.ts` (39 lines) -- Blade auto-discovery and exhaustiveness check
- `src/blades/_shared/BladeRenderer.tsx` (55 lines) -- Blade rendering pipeline
- `src/lib/bladeRegistry.ts` (67 lines) -- Blade registration with source-based cleanup
- `src/lib/fileDispatch.ts` (85 lines) -- File extension to blade type mapping
- `src/lib/bladeOpener.ts` (30 lines) -- openBlade() implementation
- `src/stores/bladeTypes.ts` (57 lines) -- BladePropsMap type system
- `src/hooks/useBladeNavigation.ts` (164 lines) -- Navigation with hardcoded blade type references
- `src/App.tsx` (132 lines) -- Built-in extension registration point
- `src/components/markdown/MarkdownRenderer.tsx` (69 lines) -- Shared component (stays in core)

### Secondary (HIGH confidence -- Phase 37 architecture research)
- `.planning/phases/37-extension-platform-foundation/37-ARCHITECTURE-RESEARCH.md` -- Registry patterns, extensibility enforcement, fileDispatch refactoring recommendation
- `.planning/phases/37-extension-platform-foundation/37-RESEARCH.md` -- Synthesis of 3-agent research

### Tertiary (HIGH confidence -- npm packages)
- `package.json` -- Current dependency versions (three ^0.182.0, @monaco-editor/react ^4.7.0, react-markdown ^10.1.0)

---

## Metadata

**Confidence breakdown:**
- Current implementation inventory: HIGH -- every file read and analyzed with line counts
- Extension registration pattern: HIGH -- GitHub extension is a proven working template
- Blade system details: HIGH -- full flow traced from openBlade to BladeRenderer
- Component extraction: HIGH -- all props, hooks, imports catalogued
- Testing patterns: HIGH -- existing test patterns documented with mock strategies
- Performance considerations: HIGH -- lazy loading strategy verified, bundle sizes noted

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable codebase, internal refactoring)
