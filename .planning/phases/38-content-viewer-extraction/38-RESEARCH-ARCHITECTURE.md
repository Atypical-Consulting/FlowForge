# Phase 38: Content Viewer Extraction - Architecture Research

**Researched:** 2026-02-10
**Domain:** Extension system, viewer component extraction, file dispatch, dependency isolation
**Confidence:** HIGH

## Summary

Phase 38 extracts the markdown preview, Monaco code viewer, and Three.js 3D viewer from core blade registrations into a single built-in `content-viewers` extension, with graceful fallback to plain text when disabled. The codebase is well-structured for this extraction -- viewer blades are already isolated in `src/blades/viewer-{type}/` with clean interfaces, and the extension system (Phase 37) provides a robust `registerBuiltIn()` + `ExtensionAPI` foundation. The primary architectural challenge is making `fileDispatch.ts` extension-aware so that file-type-to-blade-type resolution respects extension state.

The extraction touches four systems: (1) blade registration moves from `registration.ts` side-effect files to the extension's `onActivate()`, (2) file dispatch moves from a static `ReadonlyMap` to an overlay pattern with extension precedence, (3) the `_discovery.ts` exhaustiveness check updates to exclude extracted blade types, and (4) fallback logic in `RepoBrowserBlade.tsx` and `useBladeNavigation.ts` degrades gracefully when viewer blades are unregistered.

**Primary recommendation:** Create a single `content-viewers` built-in extension at `src/extensions/content-viewers/index.ts` that registers all three viewer blade types and their file dispatch mappings during `onActivate()`. Add a `contributeFileViewer()` method to `ExtensionAPI` for file-type-to-blade mapping with source tracking. The core `bladeTypeForFile()` function checks the extension overlay first, then falls back to a plain-text viewer when no mapping exists.

---

## Standard Stack

### Core (Already in Dependencies)

| Library | Version | Purpose | Used By |
|---------|---------|---------|---------|
| `react-markdown` | ^10.1.0 | Markdown rendering | `ViewerMarkdownBlade`, `DiffBlade`, GitHub extension |
| `remark-gfm` | ^4.0.1 | GitHub Flavored Markdown | `MarkdownRenderer` |
| `rehype-highlight` | ^7.0.2 | Syntax highlighting in markdown | `MarkdownRenderer` |
| `rehype-sanitize` | ^6.0.0 | XSS protection | `MarkdownRenderer` |
| `@catppuccin/highlightjs` | ^1.0.1 | Theme for syntax highlighting | `MarkdownRenderer` |
| `@monaco-editor/react` | ^4.7.0 | Code editor component | `ViewerCodeBlade`, `DiffBlade` |
| `monaco-editor` | ^0.55.1 | Monaco core (dev dep) | `ViewerCodeBlade`, `DiffBlade` |
| `three` | ^0.182.0 | 3D rendering engine | `Viewer3dBlade` |
| `@types/three` | ^0.182.0 | Three.js types | `Viewer3dBlade` |

### Supporting (Already in Dependencies)

| Library | Version | Purpose | Used By |
|---------|---------|---------|---------|
| `zustand` | ^5 | State management, registries | `ExtensionHost`, all registries |
| `@tanstack/react-query` | ^5 | Data fetching with caching | `useRepoFile` hook |
| `lucide-react` | ^0.563 | Icons | All viewer blades |

### No New Dependencies Required

Phase 38 requires zero new npm packages. All viewer dependencies already exist in `package.json`. The extraction is purely structural -- moving registration logic from core to extension.

---

## Architecture Patterns

### 1. Current Viewer Component Dependency Graph

```
src/blades/viewer-markdown/
  ViewerMarkdownBlade.tsx
    -> useRepoFile (hooks/useRepoFile.ts -> @tanstack/react-query, bindings)
    -> MarkdownRenderer (components/markdown/MarkdownRenderer.tsx)
       -> react-markdown, remark-gfm, rehype-highlight, rehype-sanitize
       -> markdownComponents.tsx -> CopyCodeButton, MarkdownLink, MarkdownImage
    -> BladeContentLoading, BladeContentError, BladeContentEmpty (blades/_shared/)
  registration.ts
    -> registerBlade (lib/bladeRegistry.ts)
    -> renderPathBreadcrumb (lib/bladeUtils.tsx)

src/blades/viewer-code/
  ViewerCodeBlade.tsx
    -> useRepoFile (hooks/useRepoFile.ts)
    -> @monaco-editor/react (Editor)
    -> MONACO_COMMON_OPTIONS, MONACO_THEME (lib/monacoConfig.ts)
    -> lib/monacoTheme.ts (side-effect import)
    -> BladeContentLoading, BladeContentError, BladeContentEmpty (blades/_shared/)
  registration.ts
    -> registerBlade (lib/bladeRegistry.ts)
    -> renderPathBreadcrumb (lib/bladeUtils.tsx)

src/blades/viewer-3d/
  Viewer3dBlade.tsx
    -> three (THREE, GLTFLoader, OrbitControls)
    -> commands (bindings -- readRepoFile)
    -> getErrorMessage (lib/errors.ts)
    -> BladeContentLoading, BladeContentError, BladeContentEmpty (blades/_shared/)
  registration.ts
    -> registerBlade (lib/bladeRegistry.ts)
    -> renderPathBreadcrumb (lib/bladeUtils.tsx)
```

**Key observation:** All three viewer blades share the same interface pattern: `{ filePath: string }` props, lazy-loaded registration, and reliance on `blades/_shared/` components. Their unique dependencies are isolated: `react-markdown` ecosystem for markdown, `@monaco-editor/react` for code, `three` for 3D.

### 2. Current Blade Registration Pipeline

```
App.tsx
  -> import "./blades/_discovery"

_discovery.ts
  -> import.meta.glob("./*/registration.{ts,tsx}", { eager: true })
  -> Each registration.ts calls registerBlade() as a side effect
  -> Dev-mode exhaustiveness check against EXPECTED_TYPES list

BladeRenderer.tsx
  -> getBladeRegistration(blade.type)
  -> Renders reg.component with blade.props
  -> Wraps in Suspense if reg.lazy
  -> Wraps in BladeErrorBoundary
  -> Wraps in BladePanel if reg.wrapInPanel !== false
```

**Registration flow:** At app startup, `_discovery.ts` eagerly imports all `registration.ts` files via Vite's `import.meta.glob`. Each registration file calls `registerBlade()` on the module-level blade registry Map. `BladeRenderer` then looks up registrations at render time.

### 3. Current File Dispatch Pipeline

```
fileDispatch.ts
  FILE_DISPATCH_MAP: ReadonlyMap<string, BladeType>
    "md" -> "viewer-markdown"
    "mdx" -> "viewer-markdown"
    "glb" -> "viewer-3d"
    "gltf" -> "viewer-3d"
    "png/jpg/..." -> "viewer-image"
    "nupkg" -> "viewer-nupkg"

  bladeTypeForFile(filePath, context)
    -> Check FILE_DISPATCH_MAP for extension
    -> Fallback: context === "browse" ? "viewer-code" : "diff"

Consumers:
  RepoBrowserBlade.tsx -> bladeTypeForFile(path, "browse")
  useBladeNavigation.ts -> bladeTypeForFile(filePath) [default "diff" context]
```

**Critical issue:** `FILE_DISPATCH_MAP` is a `ReadonlyMap` -- immutable, not extensible. Phase 37's architecture research recommended refactoring to an overlay pattern, but this was NOT implemented. Phase 38 must do this refactoring.

### 4. Extension System Architecture (Phase 37)

```
ExtensionHost (Zustand store)
  registerBuiltIn(config: BuiltInExtensionConfig)
    -> Creates synthetic manifest
    -> Marks as "discovered", builtIn: true
    -> Creates ExtensionAPI instance
    -> Calls config.activate(api)
    -> Stores api + module for deactivation

ExtensionAPI (class, per-extension instance)
  registerBlade(config)     -> namespaced as "ext:{id}:{type}"
  registerCommand(config)   -> namespaced as "ext:{id}:{id}"
  contributeToolbar(config) -> namespaced as "ext:{id}:{id}"
  contributeContextMenu(config)
  contributeSidebarPanel(config)
  contributeStatusBar(config)
  onDidGit(operation, handler)
  onWillGit(operation, handler)
  onDispose(disposable)
  cleanup()  -> Removes ALL registrations atomically

App.tsx: registerBuiltIn() called in useEffect on mount
  -> Currently only "github" is registered
```

**Key gap for Phase 38:** `ExtensionAPI` has `registerBlade()` but NO method for contributing file-type-to-blade mappings. The extension can register blade types, but there is no way for it to tell the file dispatch system "when a user opens a .md file, use my blade type." This requires a new API method.

### 5. GitHub Extension as Reference Pattern

The GitHub extension (`src/extensions/github/index.ts`) is the only existing built-in extension and serves as the definitive reference for Phase 38:

```typescript
export async function onActivate(api: ExtensionAPI): Promise<void> {
  await ensureComponents();  // Lazy load all blade components

  api.registerBlade({ type: "sign-in", title: "GitHub Sign In", component: GitHubAuthBlade!, ... });
  api.registerBlade({ type: "account", ... });
  // ... 7 blade registrations

  api.registerCommand({ id: "sign-in", title: "Sign in to GitHub", ... });
  // ... 5 command registrations

  api.contributeToolbar({ id: "github-status", ... });
  // ... 4 toolbar contributions

  // Store subscriptions with onDispose NOT used (manual cleanup in onDeactivate)
}

export function onDeactivate(): void {
  cancelGitHubPolling();
  queryClient.removeQueries({ queryKey: ["ext:github"] });
  // Manual unsubscribes
}
```

**Differences for content-viewers:** GitHub extension registers entirely new blade types. Content-viewers REPLACES existing core blade types (viewer-markdown, viewer-code, viewer-3d) with extension-namespaced versions. This means the core blade types must be removed from `_discovery.ts` and the file dispatch map must point to extension blade types.

---

## Architectural Design: Extension-Contributed Viewers

### Pattern A: Extension Registers Blade Types + File Dispatch Mappings

This is the recommended pattern. The content-viewers extension:

1. Registers blade types via `api.registerBlade()` (namespaced as `ext:content-viewers:viewer-markdown`, etc.)
2. Registers file dispatch mappings via a new `api.contributeFileViewer()` method
3. On deactivation, all mappings are automatically cleaned up via `api.cleanup()`
4. `bladeTypeForFile()` checks extension overlay first, falls back to "viewer-code" (plain text) when no mapping exists

```typescript
// src/extensions/content-viewers/index.ts (simplified)
export async function onActivate(api: ExtensionAPI): Promise<void> {
  const { ViewerMarkdownBlade } = await import("./blades/ViewerMarkdownBlade");
  const { ViewerCodeBlade } = await import("./blades/ViewerCodeBlade");
  const { Viewer3dBlade } = await import("./blades/Viewer3dBlade");

  api.registerBlade({
    type: "viewer-markdown",
    title: (props) => props.filePath.split("/").pop() || "Markdown",
    component: ViewerMarkdownBlade,
    lazy: true,
    renderTitleContent: (props) => renderPathBreadcrumb(props.filePath),
  });

  api.registerBlade({
    type: "viewer-code",
    title: (props) => props.filePath.split("/").pop() || "Code",
    component: ViewerCodeBlade,
    lazy: true,
    renderTitleContent: (props) => renderPathBreadcrumb(props.filePath),
  });

  api.registerBlade({
    type: "viewer-3d",
    title: (props) => props.filePath.split("/").pop() || "3D Model",
    component: Viewer3dBlade,
    lazy: true,
    renderTitleContent: (props) => renderPathBreadcrumb(props.filePath),
  });

  // Register file type mappings
  api.contributeFileViewer({ extensions: ["md", "mdx"], bladeType: "viewer-markdown" });
  api.contributeFileViewer({ extensions: ["glb", "gltf"], bladeType: "viewer-3d" });
  // viewer-code is the browse-context default -- no explicit mapping needed
}
```

### File Dispatch Overlay Architecture

```typescript
// src/lib/fileDispatch.ts (refactored)

// Core dispatch -- immutable, always present as lowest-priority fallback
const CORE_DISPATCH = new Map<string, BladeType>([
  // Images remain in core (not part of content-viewers)
  ["png", "viewer-image"],
  ["jpg", "viewer-image"],
  // ... image extensions
  ["nupkg", "viewer-nupkg"],
]);

// Extension overlay -- mutable, managed by ExtensionAPI
interface FileViewerEntry {
  bladeType: string;
  source: string;
}
const extensionOverlay = new Map<string, FileViewerEntry>();

export function registerFileViewer(ext: string, bladeType: string, source: string): void {
  extensionOverlay.set(ext, { bladeType, source });
}

export function unregisterFileViewersBySource(source: string): void {
  for (const [ext, entry] of extensionOverlay) {
    if (entry.source === source) extensionOverlay.delete(ext);
  }
}

export function bladeTypeForFile(filePath: string, context: "diff" | "browse" = "diff"): BladeType {
  const ext = getExtension(filePath);

  // 1. Extension overlay takes precedence
  const overlay = extensionOverlay.get(ext);
  if (overlay) return overlay.bladeType as BladeType;

  // 2. Core dispatch (images, nupkg)
  const core = CORE_DISPATCH.get(ext);
  if (core) return core;

  // 3. Fallback -- plain text (viewer-code if registered, else "diff")
  if (context === "browse") return "viewer-code" as BladeType;
  return "diff";
}
```

### Blade Type Naming Strategy

**Option 1: Extension-namespaced types** (`ext:content-viewers:viewer-markdown`)
- Follows the established convention from GitHub extension
- BladePropsMap would need updating
- File dispatch returns namespaced types

**Option 2: Core blade type names stay the same** (`viewer-markdown`)
- The extension registers with `type: "viewer-markdown"` but the ExtensionAPI namespaces it to `ext:content-viewers:viewer-markdown`
- File dispatch overlay maps to the namespaced type
- RepoBrowserBlade and useBladeNavigation use the namespaced types from dispatch

**Recommendation: Option 2 (namespaced internally, transparent externally).** The ExtensionAPI already namespaces blade types automatically (`ext:${this.extensionId}:${config.type}`). File dispatch overlay stores the namespaced type. Consumer code (`RepoBrowserBlade`, `useBladeNavigation`) uses `bladeTypeForFile()` which returns whatever type is registered -- they do not hardcode blade type strings.

**HOWEVER:** `useBladeNavigation.ts` currently hardcodes blade type checks:
```typescript
if (type === "diff" || type === "viewer-markdown") {
  openBlade("diff", { source: ... });
} else if (type === "viewer-image") {
  openBlade("viewer-image", { filePath, oid });
}
```

This hardcoding must be refactored. The file dispatch should return the correct blade type directly, and consumer code should not need to know which specific viewer types exist.

---

## Dependency Isolation Analysis

### Viewer-Specific Dependencies (Candidates for Lazy Loading)

| Dependency | Size (approx) | Used By | Shared With Core? |
|-----------|---------------|---------|-------------------|
| `react-markdown` | ~50KB | ViewerMarkdownBlade, MarkdownRenderer | YES - DiffBlade, GitHub extension |
| `remark-gfm` | ~20KB | MarkdownRenderer | YES - via MarkdownRenderer |
| `rehype-highlight` | ~15KB | MarkdownRenderer | YES - via MarkdownRenderer |
| `rehype-sanitize` | ~10KB | MarkdownRenderer | YES - via MarkdownRenderer |
| `@catppuccin/highlightjs` | ~5KB CSS | MarkdownRenderer | YES - via MarkdownRenderer |
| `@monaco-editor/react` | ~250KB+ | ViewerCodeBlade | YES - DiffBlade, InlineDiffViewer |
| `three` | ~600KB+ | Viewer3dBlade | NO - exclusively viewer-3d |

### Critical Cross-Dependency: MarkdownRenderer

`MarkdownRenderer` is used by:
1. `ViewerMarkdownBlade` (content-viewers extension candidate)
2. `DiffBlade` (core blade -- lazy import of MarkdownRenderer)
3. GitHub extension: `PullRequestDetailBlade`, `IssueDetailBlade`, `CommentCard`

**Implication:** `MarkdownRenderer` and its dependencies (`react-markdown`, `remark-gfm`, `rehype-*`) MUST remain in the shared core (`src/components/markdown/`). They cannot be isolated to the content-viewers extension because DiffBlade and GitHub extension depend on them independently.

### Critical Cross-Dependency: Monaco Editor

`@monaco-editor/react` is used by:
1. `ViewerCodeBlade` (content-viewers extension candidate)
2. `DiffBlade` (core blade -- `DiffEditor` component)
3. `InlineDiffViewer` in staging changes

**Implication:** Monaco Editor dependencies MUST remain in shared dependencies. They cannot be isolated to the content-viewers extension.

### Truly Isolatable Dependency: Three.js

`three` (and its loaders/controls) is ONLY used by `Viewer3dBlade`. If the content-viewers extension is disabled, Three.js code is never loaded (already lazy via the `registration.ts` lazy import pattern). This is the only dependency that can be truly isolated.

### Lazy Loading Strategy

All three viewer blade components are already lazily loaded:
```typescript
// Current registration.ts pattern
const ViewerMarkdownBlade = lazy(() =>
  import("./ViewerMarkdownBlade").then(m => ({ default: m.ViewerMarkdownBlade }))
);
```

When moved to the extension, the same lazy pattern applies through `ensureComponents()` (like the GitHub extension) or direct lazy imports in `onActivate()`. The extension's `onActivate()` itself can use dynamic imports:

```typescript
export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Components loaded lazily on first blade render, not during activation
  const ViewerMarkdownBlade = lazy(() => import("../../blades/viewer-markdown/ViewerMarkdownBlade").then(...));
  const ViewerCodeBlade = lazy(() => import("../../blades/viewer-code/ViewerCodeBlade").then(...));
  const Viewer3dBlade = lazy(() => import("../../blades/viewer-3d/Viewer3dBlade").then(...));

  api.registerBlade({ type: "viewer-markdown", component: ViewerMarkdownBlade, lazy: true, ... });
  // ...
}
```

**Key insight:** Moving the viewer blades to an extension does NOT change the lazy loading behavior. The blades were already lazy-loaded via `React.lazy()`. What changes is the registration PATH: from `_discovery.ts` -> `registration.ts` -> `registerBlade()` (core) to `App.tsx` -> `registerBuiltIn()` -> `onActivate()` -> `api.registerBlade()` (extension).

---

## Circular Dependency Risk Analysis

### Current Import Direction

```
blades/viewer-markdown/ -> hooks/useRepoFile -> bindings
                        -> components/markdown/MarkdownRenderer -> react-markdown ecosystem
                        -> blades/_shared/ (BladeContentLoading, etc.)
                        -> lib/bladeUtils (renderPathBreadcrumb)

blades/viewer-code/     -> hooks/useRepoFile -> bindings
                        -> @monaco-editor/react
                        -> lib/monacoConfig, lib/monacoTheme
                        -> blades/_shared/

blades/viewer-3d/       -> three ecosystem
                        -> bindings (commands.readRepoFile)
                        -> lib/errors
                        -> blades/_shared/
```

All arrows point FROM blade modules TO shared/lib modules. No circular dependencies exist.

### After Extraction to Extension

```
extensions/content-viewers/index.ts
  -> blades/viewer-markdown/ViewerMarkdownBlade (dynamic import)
  -> blades/viewer-code/ViewerCodeBlade (dynamic import)
  -> blades/viewer-3d/Viewer3dBlade (dynamic import)
  -> lib/bladeUtils (renderPathBreadcrumb) for registration config
  -> extensions/ExtensionAPI (type import only)
```

**No circular dependency risk.** The extension module imports FROM blade modules and lib modules. The blade modules do NOT import from the extension. The direction is strictly one-way.

### Potential Risk: blades/_shared/ Used by Extension Blades

Extension blade components import from `blades/_shared/` (BladeContentLoading, BladeContentError, BladeContentEmpty). These are core UI primitives, not extension-specific. This import is SAFE -- it follows the same pattern as the GitHub extension, which imports `BladeContentLoading` etc. from `blades/_shared/`.

### Potential Risk: bladeTypes.ts Still Lists Viewer Types

`BladePropsMap` in `stores/bladeTypes.ts` currently includes:
```typescript
"viewer-markdown": { filePath: string };
"viewer-3d": { filePath: string };
"viewer-code": { filePath: string };
```

After extraction, these types are registered by the extension as `ext:content-viewers:viewer-markdown`, etc. The core `BladePropsMap` should either:
- **Option A:** Remove the viewer entries (breaking type safety for hardcoded references)
- **Option B:** Keep them as documentation / fallback type definitions

**Recommendation: Option A** -- remove them from `BladePropsMap`. Any code that hardcodes `"viewer-markdown"` must be refactored to use `bladeTypeForFile()` instead. The extension blade types follow the `ExtensionBladeType` pattern (`ext:${string}:${string}`).

---

## Graceful Degradation Design

### When Content-Viewers Extension Is Disabled

1. **File dispatch overlay is empty** -- `bladeTypeForFile()` finds no overlay entry for `.md`, `.glb`, `.gltf`, etc.
2. **Core dispatch still has image mappings** -- images continue to work (not part of content-viewers)
3. **Browse context fallback** -- `bladeTypeForFile(path, "browse")` returns `"viewer-code"` (core blade)
4. **But `viewer-code` blade is also provided by content-viewers** -- this is a problem!

**The fallback viewer must be a core blade, not an extension blade.**

### Plain Text Fallback Architecture

A new minimal `viewer-plaintext` core blade is needed:
- Always registered (not part of any extension)
- Displays file content as plain monospaced text (no Monaco, no syntax highlighting)
- Used as the browse-context fallback when `viewer-code` is not registered

```typescript
// src/blades/viewer-plaintext/ViewerPlaintextBlade.tsx
export function ViewerPlaintextBlade({ filePath }: { filePath: string }) {
  const { data, isLoading, error } = useRepoFile(filePath);
  // ... loading/error states ...
  return (
    <pre className="flex-1 overflow-auto p-4 bg-ctp-base text-ctp-text text-sm font-mono whitespace-pre">
      {data.content}
    </pre>
  );
}
```

This blade:
- Has NO heavy dependencies (no Monaco, no react-markdown, no Three.js)
- Uses only `useRepoFile` hook and basic HTML `<pre>` tag
- Provides a functional but minimal file viewing experience
- Is the core's "last resort" when no extension provides a richer viewer

### Updated Fallback Chain

```
bladeTypeForFile(filePath, context):
  1. Check extension overlay (from content-viewers or other extensions)
  2. Check core dispatch (images, nupkg)
  3. context === "browse" ? "viewer-plaintext" : "diff"
```

### RepoBrowserBlade Refactoring

Current `openFile` method hardcodes blade type checks:
```typescript
if (bladeType === "viewer-image") { ... }
else if (bladeType === "viewer-markdown") { ... }
else if (bladeType === "viewer-3d") { ... }
else { pushBlade({ type: "viewer-code", ... }); }
```

After refactoring:
```typescript
const openFile = (entry: RepoFileEntry) => {
  if (entry.isDir) { navigateToDirectory(entry.path); return; }
  const bladeType = bladeTypeForFile(entry.path, "browse");
  pushBlade({ type: bladeType, title: entry.name, props: { filePath: entry.path } });
};
```

All viewer blades accept `{ filePath: string }` as props, so the dispatch is uniform. The specific blade type (viewer-markdown, viewer-code, viewer-plaintext, etc.) is determined by `bladeTypeForFile()` which consults the extension overlay.

### useBladeNavigation Refactoring

Similarly, `openDiff` and `openStagingDiff` hardcode type checks. These should be simplified:
```typescript
function openDiff(oid: string, filePath: string) {
  const type = bladeTypeForFile(filePath);
  if (type === "diff") {
    openBlade("diff", { source: { mode: "commit", oid, filePath } });
  } else if (type === "viewer-image") {
    openBlade("viewer-image", { filePath, oid });
  } else {
    // All other viewers (markdown, code, 3d, plaintext)
    openBlade(type, { filePath });
  }
}
```

**Note:** The `viewer-markdown` -> `diff` redirect (showing diff view instead of standalone markdown) for staging context is a design decision. After extraction, markdown files in diff context should still show the DiffBlade (which has its own markdown preview toggle). The file dispatch context parameter handles this.

---

## ExtensionAPI Surface Expansion

### New Method: contributeFileViewer()

```typescript
export interface ExtensionFileViewerConfig {
  /** File extensions to handle (without dots), e.g. ["md", "mdx"] */
  extensions: string[];
  /** The blade type to open (will be auto-namespaced to ext:{id}:{bladeType}) */
  bladeType: string;
}

class ExtensionAPI {
  // ... existing methods ...

  contributeFileViewer(config: ExtensionFileViewerConfig): void {
    const namespacedBladeType = `ext:${this.extensionId}:${config.bladeType}`;
    for (const ext of config.extensions) {
      registerFileViewer(ext, namespacedBladeType, `ext:${this.extensionId}`);
    }
    this.registeredFileViewers.push(...config.extensions);
  }
}
```

The `cleanup()` method adds:
```typescript
unregisterFileViewersBySource(`ext:${this.extensionId}`);
```

### Alternatively: Use ExtensionAPI.onDispose()

Instead of a dedicated method, the extension could use `onDispose()`:
```typescript
export async function onActivate(api: ExtensionAPI): Promise<void> {
  registerFileViewer("md", "ext:content-viewers:viewer-markdown", "ext:content-viewers");
  api.onDispose(() => unregisterFileViewersBySource("ext:content-viewers"));
}
```

**Recommendation: Dedicated method (`contributeFileViewer`).** It is more declarative, auto-namespaces consistently, and integrates with the existing tracking/cleanup pattern. The `onDispose()` approach would work but requires manual source tagging and is error-prone.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plain text viewer | A new Monaco-based plain text viewer | Simple `<pre>` tag with `useRepoFile` | The whole point of fallback is avoiding heavy deps |
| File type detection | Custom MIME type detection | Extension-based dispatch (string matching) | File extensions are sufficient for known viewer types |
| Viewer registry | A separate ViewerRegistry Zustand store | `fileDispatch.ts` overlay + blade registry | The overlay pattern reuses existing infrastructure |
| Dynamic blade loading | Custom module loader | `React.lazy()` + dynamic import | React's built-in code splitting is sufficient |

**Key insight:** The `ViewerRegistry.ts` at `src/components/viewers/ViewerRegistry.ts` is a legacy pattern that predates the blade system. It should NOT be used as the basis for the new viewer contribution system. The blade registry + file dispatch overlay is the correct architecture.

---

## Common Pitfalls

### Pitfall 1: Forgetting to Update _discovery.ts EXPECTED_TYPES

**What goes wrong:** After moving viewer blade registrations to the extension, `_discovery.ts` still expects `viewer-markdown`, `viewer-code`, and `viewer-3d` in its exhaustiveness check. Dev console shows warnings about missing registrations.
**Why it happens:** The exhaustiveness check is a hardcoded list that must be manually updated.
**How to avoid:** Remove the extracted blade types from EXPECTED_TYPES in `_discovery.ts`. The extension registers them dynamically, outside the `_discovery.ts` scan.
**Warning signs:** Console warnings about "Missing registrations" in dev mode.

### Pitfall 2: DiffBlade Markdown Preview Breaks When Extension Is Disabled

**What goes wrong:** `DiffBlade.tsx` lazy-imports `MarkdownRenderer` for its markdown preview toggle. This is NOT affected by the content-viewers extension being disabled, because `MarkdownRenderer` is a shared component in `src/components/markdown/`, not an extension-provided component. However, the `isMarkdown` check in DiffBlade uses filename extension matching, not the file dispatch system.
**Why it matters:** This is actually safe -- DiffBlade's markdown preview is independent of the content-viewers extension. But it must be documented to prevent confusion.
**How to avoid:** Do NOT move `MarkdownRenderer` into the content-viewers extension. Keep it in `src/components/markdown/` as shared infrastructure.

### Pitfall 3: RepoBrowserBlade Hardcoded Type Checks

**What goes wrong:** `RepoBrowserBlade.tsx` has a cascading `if/else if` that checks for specific blade types (`viewer-image`, `viewer-markdown`, `viewer-3d`, `viewer-nupkg`). After extraction, the type strings change to `ext:content-viewers:viewer-markdown`, breaking the conditionals.
**Why it happens:** The code was written before the extension system existed, using hardcoded core blade type strings.
**How to avoid:** Refactor `RepoBrowserBlade.openFile()` to use `bladeTypeForFile()` as a single dispatch point. All viewer blade types accept `{ filePath: string }` props, so no type-specific branching is needed.
**Warning signs:** Opening a file in repo browser shows "Unknown blade" error.

### Pitfall 4: useBladeNavigation Hardcoded viewer-markdown Check

**What goes wrong:** `useBladeNavigation.ts` lines 55 and 77 check `type === "viewer-markdown"` to redirect markdown files to the diff blade in staging context. After extraction, the type is `ext:content-viewers:viewer-markdown`, so this check fails. Markdown files in staging context would open the viewer instead of the diff view.
**Why it happens:** Same as Pitfall 3 -- hardcoded type strings.
**How to avoid:** The `bladeTypeForFile()` function already handles context: in "diff" context, it returns "diff" for markdown files (because markdown is mapped in the extension overlay, but the function respects context). The staging context check in `useBladeNavigation` can use the context parameter instead of checking blade type names.

### Pitfall 5: Extension Registration Timing with registerBuiltIn

**What goes wrong:** `registerBuiltIn()` is called in `App.tsx`'s `useEffect`, which runs after the first render. If the user navigates to a file before the effect runs, the viewer blade types are not yet registered.
**Why it happens:** `useEffect` runs asynchronously after render. The extension activation is async (awaiting dynamic imports).
**How to avoid:** Register content-viewers early -- before GitHub extension. The content-viewers extension has no async setup requirements, so activation is near-instant (just function calls to `registerBlade` + `registerFileViewer`). Component loading is deferred via `React.lazy()`.
**Warning signs:** Flash of "Unknown blade" on first navigation, then correct viewer after re-render.

### Pitfall 6: BladePropsMap Type Safety After Extraction

**What goes wrong:** Code that references `BladePropsMap["viewer-markdown"]` for type safety breaks when the key is removed from the interface.
**Why it happens:** TypeScript type narrowing depends on the discriminated union in `BladePropsMap`.
**How to avoid:** Identify all direct references to the extracted blade type keys in TypeScript code. Most are in `useBladeNavigation.ts` and `RepoBrowserBlade.tsx`, which must be refactored anyway. The dynamic `bladeTypeForFile()` dispatch avoids the need for type-safe blade type references in consumer code.
**Warning signs:** TypeScript compilation errors referencing missing keys in `BladePropsMap`.

---

## Code Examples

### Content-Viewers Extension Entry Point

```typescript
// src/extensions/content-viewers/index.ts
import { lazy } from "react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { renderPathBreadcrumb } from "../../lib/bladeUtils";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component imports -- loaded on first render, not during activation
  const ViewerMarkdownBlade = lazy(() =>
    import("../../blades/viewer-markdown/ViewerMarkdownBlade").then(m => ({
      default: m.ViewerMarkdownBlade,
    }))
  );
  const ViewerCodeBlade = lazy(() =>
    import("../../blades/viewer-code/ViewerCodeBlade").then(m => ({
      default: m.ViewerCodeBlade,
    }))
  );
  const Viewer3dBlade = lazy(() =>
    import("../../blades/viewer-3d/Viewer3dBlade").then(m => ({
      default: m.Viewer3dBlade,
    }))
  );

  // Register blade types
  api.registerBlade({
    type: "viewer-markdown",
    title: (props: { filePath: string }) => props.filePath.split("/").pop() || "Markdown",
    component: ViewerMarkdownBlade,
    lazy: true,
    renderTitleContent: (props: { filePath: string }) => renderPathBreadcrumb(props.filePath),
  });

  api.registerBlade({
    type: "viewer-code",
    title: (props: { filePath: string }) => props.filePath.split("/").pop() || "Code",
    component: ViewerCodeBlade,
    lazy: true,
    renderTitleContent: (props: { filePath: string }) => renderPathBreadcrumb(props.filePath),
  });

  api.registerBlade({
    type: "viewer-3d",
    title: (props: { filePath: string }) => props.filePath.split("/").pop() || "3D Model",
    component: Viewer3dBlade,
    lazy: true,
    renderTitleContent: (props: { filePath: string }) => renderPathBreadcrumb(props.filePath),
  });

  // Register file type -> viewer mappings
  api.contributeFileViewer({ extensions: ["md", "mdx"], bladeType: "viewer-markdown" });
  api.contributeFileViewer({ extensions: ["glb", "gltf"], bladeType: "viewer-3d" });
  // viewer-code is the default for browse context -- registered as a dispatch default
}

export function onDeactivate(): void {
  // No special cleanup needed -- api.cleanup() handles all registrations
}
```

### Registration in App.tsx

```typescript
// In App.tsx useEffect
import { onActivate as contentViewersActivate, onDeactivate as contentViewersDeactivate } from "./extensions/content-viewers";

registerBuiltIn({
  id: "content-viewers",
  name: "Content Viewers",
  version: "1.0.0",
  activate: contentViewersActivate,
  deactivate: contentViewersDeactivate,
});

registerBuiltIn({
  id: "github",
  name: "GitHub Integration",
  version: "1.0.0",
  activate: githubActivate,
  deactivate: githubDeactivate,
});
```

### Plain Text Fallback Blade

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
  if (!data || data.isBinary) {
    return <BladeContentEmpty icon={FileText} message={data?.isBinary ? "Binary file" : "File not found"} detail={filePath} />;
  }

  return (
    <pre className="flex-1 overflow-auto p-4 bg-ctp-base text-ctp-text text-sm font-mono whitespace-pre leading-relaxed">
      {data.content}
    </pre>
  );
}
```

---

## Recommended Project Structure After Extraction

```
src/
├── extensions/
│   ├── content-viewers/
│   │   └── index.ts                  # onActivate/onDeactivate (NEW)
│   ├── github/
│   │   ├── index.ts                  # (existing)
│   │   └── blades/...                # (existing)
│   ├── ExtensionAPI.ts               # + contributeFileViewer() (MODIFIED)
│   ├── ExtensionHost.ts              # (unchanged)
│   └── extensionTypes.ts             # (unchanged)
├── blades/
│   ├── _discovery.ts                 # Remove viewer types from EXPECTED_TYPES (MODIFIED)
│   ├── _shared/                      # (unchanged -- shared by all blades)
│   ├── viewer-markdown/              # (KEPT -- components stay, registration.ts DELETED)
│   │   ├── ViewerMarkdownBlade.tsx   # (unchanged)
│   │   └── index.ts                  # (updated)
│   ├── viewer-code/                  # (KEPT -- components stay, registration.ts DELETED)
│   │   ├── ViewerCodeBlade.tsx       # (unchanged)
│   │   └── index.ts                  # (updated)
│   ├── viewer-3d/                    # (KEPT -- components stay, registration.ts DELETED)
│   │   ├── Viewer3dBlade.tsx         # (unchanged)
│   │   └── index.ts                  # (updated)
│   ├── viewer-plaintext/             # (NEW -- core fallback viewer)
│   │   ├── ViewerPlaintextBlade.tsx
│   │   ├── registration.ts
│   │   └── index.ts
│   └── repo-browser/                 # (MODIFIED -- remove hardcoded type checks)
├── lib/
│   ├── fileDispatch.ts               # (MODIFIED -- add overlay pattern)
│   └── bladeUtils.tsx                # (unchanged -- shared utility)
├── hooks/
│   └── useBladeNavigation.ts         # (MODIFIED -- remove hardcoded type checks)
├── stores/
│   └── bladeTypes.ts                 # (MODIFIED -- remove extracted types, add viewer-plaintext)
└── components/
    └── markdown/                     # (unchanged -- shared by core + extensions)
```

### What MOVES

| Component | From | To |
|-----------|------|-----|
| Viewer blade registration logic | `blades/viewer-{type}/registration.ts` | `extensions/content-viewers/index.ts` |
| File dispatch mappings (md, mdx, glb, gltf) | `lib/fileDispatch.ts` (static map) | `extensions/content-viewers/index.ts` (via API) |

### What STAYS

| Component | Location | Why |
|-----------|----------|-----|
| `ViewerMarkdownBlade.tsx` | `blades/viewer-markdown/` | Component is imported by extension; staying avoids unnecessary file moves |
| `ViewerCodeBlade.tsx` | `blades/viewer-code/` | Same reason |
| `Viewer3dBlade.tsx` | `blades/viewer-3d/` | Same reason |
| `MarkdownRenderer` | `components/markdown/` | Shared by DiffBlade and GitHub extension |
| `monacoConfig.ts`, `monacoTheme.ts` | `lib/` | Shared by DiffBlade |
| `useRepoFile` hook | `hooks/` | Shared core hook |
| `BladeContent*` components | `blades/_shared/` | Shared core components |

### What Is DELETED

| File | Why |
|------|-----|
| `blades/viewer-markdown/registration.ts` | Registration moves to extension |
| `blades/viewer-code/registration.ts` | Registration moves to extension |
| `blades/viewer-3d/registration.ts` | Registration moves to extension |

### What Is CREATED

| File | Purpose |
|------|---------|
| `extensions/content-viewers/index.ts` | Extension entry point |
| `blades/viewer-plaintext/ViewerPlaintextBlade.tsx` | Fallback viewer |
| `blades/viewer-plaintext/registration.ts` | Core registration |

---

## Open Questions

1. **Should viewer-image and viewer-nupkg also be in the content-viewers extension?**
   - What we know: The phase description says "Markdown, code, and 3D viewers". Image viewer is simpler (no heavy deps). Nupkg is niche.
   - What's unclear: Whether the user wants all content viewers extracted or just the three specified.
   - Recommendation: Extract only the three specified viewers (markdown, code, 3D) per requirements VIEW-01, VIEW-02, VIEW-03. Leave image and nupkg in core. This reduces scope and keeps the image viewer always available.

2. **Should the extension blade components physically move to `extensions/content-viewers/blades/`?**
   - What we know: The GitHub extension keeps its blade components in `extensions/github/blades/`. This establishes a pattern.
   - What's unclear: Whether moving the blade component files adds value or just creates churn.
   - Recommendation: Keep blade component files in `src/blades/viewer-{type}/` for Phase 38. The extension dynamically imports them. Moving files is optional follow-up work. This minimizes diff size and avoids import path updates across test files.

3. **How does `viewer-code` as default browse fallback interact with the extension overlay?**
   - What we know: Currently `bladeTypeForFile()` returns `"viewer-code"` for any unmapped file in browse context. After extraction, `viewer-code` is an extension blade type.
   - Recommendation: Change the browse-context default from `"viewer-code"` to `"viewer-plaintext"` (core). If content-viewers is active, it should explicitly map common source file extensions OR register `viewer-code` as the browse default via a separate mechanism. Alternatively, if `viewer-code` blade is registered (extension active), use it; if not, fall back to `viewer-plaintext`.

4. **Should file dispatch be reactive (Zustand store) or a simple module-level Map?**
   - What we know: `bladeTypeForFile()` is called during event handlers (button clicks), not during rendering. Reactivity is not required for the dispatch itself.
   - Recommendation: Use a simple module-level Map overlay (like the current pattern). No Zustand store needed. The dispatch is called imperatively, not subscribed to reactively.

---

## Sources

### Primary (HIGH confidence) -- Codebase Analysis

- `src/blades/viewer-markdown/ViewerMarkdownBlade.tsx` -- Markdown viewer implementation and dependencies
- `src/blades/viewer-code/ViewerCodeBlade.tsx` -- Code viewer implementation, Monaco dependency
- `src/blades/viewer-3d/Viewer3dBlade.tsx` -- 3D viewer implementation, Three.js dependency
- `src/blades/_discovery.ts` -- Blade auto-discovery via import.meta.glob
- `src/blades/viewer-{type}/registration.ts` -- Current registration pattern (5 files)
- `src/lib/bladeRegistry.ts` -- Core blade registry Map with source tracking
- `src/lib/fileDispatch.ts` -- File-type-to-blade-type dispatch (static ReadonlyMap)
- `src/blades/_shared/BladeRenderer.tsx` -- Blade rendering pipeline
- `src/stores/bladeTypes.ts` -- BladePropsMap discriminated union
- `src/extensions/ExtensionAPI.ts` -- Extension API facade (registerBlade, cleanup)
- `src/extensions/ExtensionHost.ts` -- Extension lifecycle (registerBuiltIn, activate/deactivate)
- `src/extensions/github/index.ts` -- Reference built-in extension (onActivate/onDeactivate pattern)
- `src/blades/repo-browser/RepoBrowserBlade.tsx` -- File dispatch consumer with hardcoded checks
- `src/hooks/useBladeNavigation.ts` -- Navigation hook with hardcoded blade type checks
- `src/blades/diff/DiffBlade.tsx` -- Cross-dependency: lazy MarkdownRenderer + Monaco DiffEditor
- `src/components/markdown/MarkdownRenderer.tsx` -- Shared markdown component (used by core + extensions)
- `src/lib/bladeOpener.ts` -- Programmatic blade opening
- `src/App.tsx` -- Extension registration in useEffect, _discovery import
- `src/extensions/__tests__/ExtensionAPI.test.ts` -- Extension API test patterns

### Architecture Research (HIGH confidence)

- `.planning/phases/37-extension-platform-foundation/37-ARCHITECTURE-RESEARCH.md` -- Phase 37 architecture patterns, file dispatch refactoring recommendation, dependency inversion strategy
- `.planning/ROADMAP.md` -- Phase 38 scope, success criteria, plan stubs
- `.planning/REQUIREMENTS.md` -- VIEW-01 through VIEW-04 and DEGR-04 requirements

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies verified from package.json, all import paths verified from source
- Architecture: HIGH -- patterns derived from codebase analysis of existing extension system and blade system
- Pitfalls: HIGH -- each pitfall identified by tracing actual code paths through hardcoded references
- Dependency isolation: HIGH -- cross-references verified by grep across entire src/ tree

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain -- internal refactoring, no external API changes)
