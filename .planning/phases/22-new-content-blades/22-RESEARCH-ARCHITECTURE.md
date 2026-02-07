# Phase 22: Architecture Research — Extensibility & Refactoring

> **Question**: What architectural patterns and refactoring opportunities should we leverage to make Phase 22's content blades maximally extensible, and how do we enforce that extensibility for future blade types?

---

## 1. Current Blade Registry Architecture (Phase 20.1 Output)

### 1.1 How Blade Types Are Registered

The blade system has three layers:

**Layer 1 — Type Map** (`src/stores/bladeTypes.ts`):
```ts
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
export type BladeType = keyof BladePropsMap;
```

`BladeType` is derived from `BladePropsMap` keys — single source of truth.

**Layer 2 — Runtime Registry** (`src/lib/bladeRegistry.ts`):
```ts
export interface BladeRegistration<TProps = Record<string, never>> {
  type: string;              // matched against BladeType at call sites
  defaultTitle: string | ((props: TProps) => string);
  component: ComponentType<TProps> | LazyExoticComponent<ComponentType<TProps>>;
  lazy?: boolean;
  wrapInPanel?: boolean;     // default true
  showBack?: boolean;        // default true
  renderTitleContent?: (props: TProps) => ReactNode;
  renderTrailing?: (props: TProps, ctx: BladeRenderContext) => ReactNode;
}
const registry = new Map<string, BladeRegistration<any>>();
```

Note: The `type` field in `BladeRegistration` is typed as `string`, not `BladeType`. This is a **type-safety gap** — you can register a blade type that does not exist in `BladePropsMap` without a compile error.

**Layer 3 — Per-blade Registration Files** (`src/components/blades/registrations/*.ts`):

Each blade type has a dedicated registration file that calls `registerBlade()`. These are barrel-imported in `registrations/index.ts`, which is side-effect-imported in `App.tsx`:

```ts
// registrations/index.ts
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

### 1.2 How Blades Are Rendered

`BladeContainer` reads `bladeStack` from the Zustand store and renders the active blade (last in stack) via `BladeRenderer`. Collapsed blades are shown as `BladeStrip` side tabs.

```
BladeContainer → BladeRenderer → [BladeErrorBoundary → [Suspense → Component]]
                                  ↓ (if wrapInPanel)
                                  BladePanel (header bar + children)
```

`BladeRenderer` flow:
1. Look up `BladeRegistration` from the runtime registry by `blade.type`
2. Instantiate the component with `blade.props`
3. If `lazy: true`, wrap in `<Suspense>` with `BladeLoadingFallback`
4. Always wrap in `BladeErrorBoundary`
5. If `wrapInPanel !== false`, wrap in `BladePanel` (header bar with title, back button, optional trailing content)

### 1.3 How Blades Are Pushed/Popped (Zustand Store)

`src/stores/blades.ts` — `useBladeStore`:

| Action | Behavior |
|--------|----------|
| `pushBlade` | Appends to `bladeStack` with a `crypto.randomUUID()` id |
| `popBlade` | Removes last blade (min 1) |
| `popToIndex` | Slices stack to `index + 1` |
| `replaceBlade` | Replaces the last blade |
| `resetStack` | Returns to root blade for current process |
| `setProcess` | Switches between "staging" and "topology" root blades |

### 1.4 Type-Safe Opening

`useBladeNavigation` hook (`src/hooks/useBladeNavigation.ts`) provides type-safe `openBlade<K extends BladeType>()` — the compiler enforces correct props per blade type at call sites. It also has convenience methods `openDiff()` and `openStagingDiff()` that use `bladeTypeForFile()` for file dispatch.

### 1.5 Cost to Add a New Blade Type Today

Adding a new blade type (e.g., `viewer-code`) requires touching **4 files**:

| Step | File | Change |
|------|------|--------|
| 1 | `src/stores/bladeTypes.ts` | Add entry to `BladePropsMap` |
| 2 | `src/components/blades/ViewerCodeBlade.tsx` | Create the component |
| 3 | `src/components/blades/registrations/viewer-code.ts` | Create registration file with `registerBlade()` |
| 4 | `src/components/blades/registrations/index.ts` | Add `import "./viewer-code"` |

This is already a good pattern. However, **Step 4 is easy to forget** and causes silent failure (blade type exists in the type system but renders "Unknown blade" at runtime). This is a key extensibility gap to address.

---

## 2. Extensibility Refactoring Opportunities

### 2.1 Content Blade Base Pattern

**Problem**: Viewer blades (image, nupkg, markdown, code, 3d) all follow a similar structure:
1. Toolbar/header row (icon, file path, action buttons)
2. Loading state
3. Error state
4. Main content area

Currently, each blade reinvents this pattern independently. Compare `ViewerImageBlade` (loading/error/toolbar inline) with `DiffBlade` (same pattern, different implementation). The `BladePanel` provides a header but not the internal toolbar or loading/error patterns.

**Proposal — `ContentBlade` wrapper component**:

```tsx
interface ContentBladeProps {
  filePath: string;
  icon: ReactNode;
  toolbar?: ReactNode;        // Additional toolbar content (toggle buttons, etc.)
  isLoading: boolean;
  error: string | null;
  emptyMessage?: string;      // Shown when content is null but no error
  children: ReactNode;        // Main content
}

function ContentBlade({ filePath, icon, toolbar, isLoading, error, children }: ContentBladeProps) {
  if (isLoading) return <CenteredSpinner />;
  if (error) return <ErrorCard message={error} filePath={filePath} />;
  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
        {icon}
        <span className="text-sm text-ctp-subtext1 truncate flex-1">{filePath}</span>
        {toolbar}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
```

**Impact**: Reduces boilerplate in every viewer blade by ~30 lines. Standardizes loading/error/toolbar UX across all content blades. Existing blades (`ViewerImageBlade`, `DiffBlade`) can be migrated incrementally.

### 2.2 File Viewer Abstraction

**Problem**: `viewer-markdown`, `viewer-code`, and `viewer-image` all share a "load file from repo at HEAD, then render" pattern. Each will use `commands.readRepoFile()` with the same loading/error/binary detection logic.

**Proposal — `useRepoFile` hook**:

```ts
function useRepoFile(filePath: string) {
  return useQuery({
    queryKey: ["repoFile", filePath],
    queryFn: () => commands.readRepoFile(filePath),
    staleTime: 60_000,
  });
}
```

This is simple but provides consistent caching and stale-time policies across all file viewers. The `RepoFileContent` type from bindings already provides `{ content: string; isBinary: boolean; size: number }`.

### 2.3 Smart File Dispatch — Current State

Currently in `src/lib/fileTypeUtils.ts`:

```ts
export function bladeTypeForFile(filePath: string): BladeType {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".nupkg")) return "viewer-nupkg";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || /* ... */) return "viewer-image";
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return "viewer-markdown";
  if (lower.endsWith(".glb") || lower.endsWith(".gltf")) return "viewer-3d";
  return "diff";
}
```

**Problems**:
1. Hard-coded if/else chain — not extensible without editing this function
2. Default fallback is `"diff"`, but Phase 22 adds `"viewer-code"` for text files in the repo browser
3. No centralized extension-to-type mapping
4. No type safety preventing mapping to a non-existent blade type

This is addressed in Section 6 (File Dispatch Registry).

### 2.4 Blade Header Actions

The current `BladeRegistration` supports `renderTrailing` for per-blade header actions. This is already being used by `diff` registration:

```tsx
// registrations/diff.tsx
registerBlade<{ source: DiffSource }>({
  type: "diff",
  renderTitleContent: (props) => { /* path display */ },
});
```

**Gap**: `renderTrailing` receives `(props, ctx)` but `ctx` only has `goBack`. Phase 22 blades need:
- **DiffBlade**: Markdown toggle button in the header
- **Viewer3dBlade**: Metadata panel toggle in the header
- **RepoBrowserBlade**: Breadcrumb path in the title area

**Proposal**: Extend `BladeRenderContext` rather than over-engineering:

```ts
export interface BladeRenderContext {
  goBack: () => void;
  bladeId: string;      // for keying local state
  bladeType: BladeType; // for conditional logic
}
```

The `renderTrailing` + `renderTitleContent` pattern is sufficient. The DiffBlade toggle can be implemented by either:
- (A) Putting the toggle in the DiffBlade component's own internal toolbar (not the panel header) — **recommended**, since the toggle is a content concern, not a navigation concern
- (B) Using `renderTrailing` in the registration — works but adds complexity

**Recommendation**: Keep blade-specific UI inside the blade component, not in registration metadata. The DiffBlade already has an internal toolbar row where the inline/side-by-side toggle lives. The markdown toggle belongs in the same row.

---

## 3. Component Composition Patterns

### 3.1 Markdown Rendering Pipeline

**Dependencies (already in package.json)**:
- `react-markdown` ^10.1.0
- `remark-gfm` ^4.0.1
- `rehype-highlight` ^7.0.2

**Missing dependency**: `rehype-sanitize` (not yet installed)

**Proposed reusable component** — `MarkdownRenderer`:

```tsx
// src/components/markdown/MarkdownRenderer.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";

interface MarkdownRendererProps {
  content: string;
  onLinkClick?: (href: string) => void;
  className?: string;
}
```

This component is reused in:
1. `ViewerMarkdownBlade` — standalone markdown file rendering
2. `DiffBlade` — markdown toggle preview (shows `newContent` rendered)
3. Potentially `GitflowCheatsheetBlade` — if any markdown content is used

**highlight.js Catppuccin theme**: Use `highlight.js/styles/base16/catppuccin-mocha.css` or create a custom CSS file using `--ctp-*` tokens for consistency.

### 3.2 Shared Monaco Configuration

Currently, the Monaco theme is defined in `src/lib/monacoTheme.ts` and loaded via CDN (`monaco-editor@0.45.0`). The theme `"flowforge-dark"` is registered once on import.

**Reuse points**:
- `DiffBlade` uses `<DiffEditor>` with specific options
- `viewer-code` will use `<Editor>` (read-only) with the same theme
- Both need: `theme: "flowforge-dark"`, same font size, same scrollbar config

**Proposal — shared Monaco options constant**:

```ts
// src/lib/monacoConfig.ts
export const MONACO_COMMON_OPTIONS = {
  readOnly: true,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: "on" as const,
  folding: true,
  wordWrap: "off" as const,
  renderLineHighlight: "all" as const,
  scrollbar: {
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
} as const;

export const MONACO_THEME = "flowforge-dark";
```

### 3.3 Model-Viewer Web Component Integration

`@google/model-viewer` is already in `package.json` (^4.1.0). It's a web component (`<model-viewer>`) that needs:
1. **Import side effect**: `import "@google/model-viewer"` to register the custom element
2. **TypeScript types**: Declare the JSX intrinsic element for `<model-viewer>`
3. **React integration**: Web components work in React 19 natively (custom element props are passed through)

**Proposed type declaration**:

```ts
// src/types/model-viewer.d.ts
declare namespace JSX {
  interface IntrinsicElements {
    "model-viewer": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        "camera-controls"?: boolean;
        "auto-rotate"?: boolean;
        "shadow-intensity"?: string;
        loading?: "auto" | "lazy" | "eager";
        style?: React.CSSProperties;
      },
      HTMLElement
    >;
  }
}
```

---

## 4. State Management Architecture

### 4.1 Repo Browser Navigation State

The repo browser needs:
- **Current path**: which directory is being displayed
- **Breadcrumb segments**: derived from current path (computable, not stored)

**Recommendation: Local component state** (via `useState` or blade props).

The repo browser blade already has `path?: string` in `BladePropsMap`. When navigating into a folder, use `replaceBlade` with the new path — the path IS the state, stored in the blade stack. When clicking a file, use `pushBlade` to open a viewer. Breadcrumbs are derived from `path.split("/")`.

No Zustand store needed.

### 4.2 Gitflow Cheatsheet State

The gitflow cheatsheet needs:
- **Current branch name + type**: Available from `useGitflowStore` (`GitflowStatus.currentBranch`, `GitflowStatus.context.state`)
- **Which lane is highlighted**: Derived from branch type classification
- **Action suggestions**: Derived from `GitflowStatus` flags (`canStartFeature`, `canFinishFeature`, etc.)

**Recommendation: No new store**. Consume `useGitflowStore` and `useRepositoryStore` directly. All state is derived.

### 4.3 Diff Toggle State (Markdown Preview)

- **Per-blade toggle**: Whether showing diff view or markdown preview
- **Scope**: Resets when navigating away (no persistence needed)

**Recommendation: `useState` inside `DiffBlade`**. A simple `const [showPreview, setShowPreview] = useState(false)` is sufficient.

### 4.4 Summary

| State | Storage | Rationale |
|-------|---------|-----------|
| Repo browser path | `BladePropsMap.path` via `replaceBlade` | Path is already in blade props |
| Repo browser breadcrumbs | Derived from path | Pure computation |
| Gitflow branch type | `useGitflowStore` | Already exists |
| Gitflow action suggestions | Derived from `GitflowStatus` | Pure computation |
| Diff markdown toggle | `useState` | Transient, per-blade-instance |
| 3D metadata panel toggle | `useState` | Transient, per-blade-instance |

---

## 5. Dependency Loading Strategy

### 5.1 Current Dependencies (Already Installed)

| Package | In package.json | Bundle Impact |
|---------|----------------|---------------|
| `react-markdown` | Yes (^10.1.0) | ~45 KB gzipped (+ remark/rehype ecosystem) |
| `remark-gfm` | Yes (^4.0.1) | ~10 KB gzipped |
| `rehype-highlight` | Yes (^7.0.2) | ~5 KB gzipped (wrapper only) |
| `@google/model-viewer` | Yes (^4.1.0) | ~180 KB gzipped (heavy!) |

### 5.2 Missing Dependencies to Install

| Package | Purpose | Estimated Size |
|---------|---------|---------------|
| `rehype-sanitize` | XSS protection for markdown | ~5 KB gzipped |
| `highlight.js` | Code syntax highlighting (used by rehype-highlight) | ~30 KB gzipped (core + auto-detect, tree-shakeable) |

Note: `highlight.js` is a peer dependency of `rehype-highlight`. It may already be pulled in transitively — verify with `npm ls highlight.js`.

### 5.3 Lazy Loading Strategy

The current architecture already supports `lazy: true` in blade registrations. Phase 22 blades are already lazily loaded:

```ts
// registrations/viewer-markdown.ts
const ViewerMarkdownBlade = lazy(() =>
  import("../ViewerMarkdownBlade").then((m) => ({ default: m.ViewerMarkdownBlade })),
);
registerBlade<{ filePath: string }>({
  type: "viewer-markdown",
  component: ViewerMarkdownBlade,
  lazy: true,
});
```

**This means `react-markdown`, `remark-gfm`, `rehype-highlight`, and `rehype-sanitize` will only be loaded when a user opens a markdown file** — they are imported inside `ViewerMarkdownBlade.tsx` and the dynamic import creates a separate chunk.

**Critical: `@google/model-viewer`** (~180 KB) must be lazy-loaded. The current `Viewer3dBlade` registration already uses `lazy: true`. The actual `import "@google/model-viewer"` side effect must happen inside the `Viewer3dBlade.tsx` component file, not at the top level.

**`viewer-code` blade** (new): Should also be `lazy: true` since it imports Monaco Editor components. Monaco is already CDN-loaded, so the main bundle cost is the wrapper component only.

### 5.4 Vite Code Splitting

Vite automatically code-splits `React.lazy()` dynamic imports into separate chunks. No additional configuration is needed in `vite.config.ts`. The `optimizeDeps.include` for `dagre-d3-es` is specific to the topology graph — no equivalent needed for Phase 22 deps.

### 5.5 highlight.js Theme Strategy

**Option A** — Import a pre-built Catppuccin CSS theme:
```ts
import "highlight.js/styles/base16/catppuccin-mocha.css";
```
Pros: Zero maintenance. Cons: May not perfectly match `--ctp-*` tokens.

**Option B** — Custom CSS using `--ctp-*` variables:
```css
.hljs { color: var(--ctp-text); background: var(--ctp-crust); }
.hljs-keyword { color: var(--ctp-mauve); }
.hljs-string { color: var(--ctp-green); }
/* ... matches monacoTheme.ts token colors */
```
Pros: Pixel-perfect match with Monaco and app theme. Cons: Maintenance cost.

**Recommendation**: Option B. The Monaco theme in `monacoTheme.ts` already defines the exact color mapping. A custom `highlight-catppuccin.css` file (~30 lines) ensures consistency between Monaco-rendered code (DiffBlade, viewer-code) and highlight.js-rendered code (markdown code blocks).

---

## 6. File Dispatch Registry (Key Extensibility Point)

### 6.1 Current Problems

The current `bladeTypeForFile()` in `fileTypeUtils.ts`:
1. Is a hard-coded if/else chain
2. Returns `"diff"` as the catch-all (wrong for repo browser context where `"viewer-code"` is needed)
3. Adding a new file type mapping requires editing the function body
4. No type safety on the return value's relationship to extension

### 6.2 Proposed Design — Declarative File Dispatch Map

```ts
// src/lib/fileDispatch.ts
import type { BladeType } from "../stores/bladeTypes";

/**
 * File extension to blade type mapping.
 *
 * Adding a new mapping is a single line. The BladeType constraint
 * ensures the target blade type exists in BladePropsMap.
 */
const FILE_DISPATCH_MAP: ReadonlyMap<string, BladeType> = new Map([
  // Images
  ["png", "viewer-image"],
  ["jpg", "viewer-image"],
  ["jpeg", "viewer-image"],
  ["gif", "viewer-image"],
  ["webp", "viewer-image"],
  ["svg", "viewer-image"],
  ["ico", "viewer-image"],
  ["bmp", "viewer-image"],

  // Markdown
  ["md", "viewer-markdown"],
  ["mdx", "viewer-markdown"],

  // 3D models
  ["glb", "viewer-3d"],
  ["gltf", "viewer-3d"],

  // Packages
  ["nupkg", "viewer-nupkg"],
]);

/**
 * Extensions known to be binary (no text fallback).
 * Files with these extensions that aren't in FILE_DISPATCH_MAP
 * get a "binary info" card instead of a code viewer.
 */
const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  "exe", "dll", "so", "dylib", "bin", "dat", "wasm",
  "zip", "tar", "gz", "7z", "rar",
  "pdf", "doc", "docx", "xls", "xlsx",
  "mp3", "wav", "ogg", "mp4", "avi", "mov",
  "woff", "woff2", "ttf", "otf", "eot",
  "obj", "fbx", "stl",
]);

function getExtension(filePath: string): string {
  return filePath.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Determine the blade type for a file, with context-aware fallback.
 *
 * @param filePath - file path
 * @param context  - "diff" for staging/commit context, "browse" for repo browser
 * @returns the blade type to open
 */
export function bladeTypeForFile(
  filePath: string,
  context: "diff" | "browse" = "diff",
): BladeType {
  const ext = getExtension(filePath);
  const mapped = FILE_DISPATCH_MAP.get(ext);
  if (mapped) return mapped;

  // Context-aware fallback
  if (context === "browse") {
    return BINARY_EXTENSIONS.has(ext) ? "viewer-code" : "viewer-code";
    // Note: viewer-code handles binary detection internally via isBinary flag
  }

  return "diff"; // Staging/commit context defaults to diff view
}

/**
 * Check if a file has a specialized viewer (not diff or code fallback).
 */
export function hasSpecializedViewer(filePath: string): boolean {
  const ext = getExtension(filePath);
  return FILE_DISPATCH_MAP.has(ext);
}
```

### 6.3 Type Safety Guarantee

The key type safety comes from:

```ts
const FILE_DISPATCH_MAP: ReadonlyMap<string, BladeType> = new Map([...]);
```

If you write `["xyz", "viewer-nonexistent"]`, TypeScript will error because `"viewer-nonexistent"` is not assignable to `BladeType`. **Adding a new file type mapping requires the target blade type to exist in `BladePropsMap`.**

### 6.4 Extensibility for Future Phases

To support a new file type (e.g., `.pdf` viewer in a future phase):

1. Add `"viewer-pdf": { filePath: string }` to `BladePropsMap` (1 line)
2. Create `ViewerPdfBlade.tsx`
3. Create `registrations/viewer-pdf.ts`
4. Add `import "./viewer-pdf"` to `registrations/index.ts`
5. Add `["pdf", "viewer-pdf"]` to `FILE_DISPATCH_MAP` (1 line)

Steps 1-4 are the existing "add a blade type" flow. Step 5 is a single declarative line — no logic to modify.

---

## 7. Cross-Blade Communication

### 7.1 Current Data Flow Patterns

Blades communicate through:
1. **Props** — passed via `BladePropsMap` at push time
2. **Shared Zustand stores** — `useStagingStore`, `useRepositoryStore`, `useGitflowStore`
3. **Blade stack operations** — `pushBlade`, `replaceBlade` from `useBladeNavigation`

There is **no direct blade-to-blade pub/sub or event system**. Blades are independent.

### 7.2 Phase 22 Cross-Blade Flows

**Repo Browser -> Viewer Blade** (file path):
- User clicks a file in repo browser
- Repo browser calls `pushBlade({ type: bladeTypeForFile(path, "browse"), props: { filePath: path } })`
- The viewer blade receives `filePath` as a prop
- No cross-blade communication needed — data flows through blade props

**Repo Browser -> Repo Browser** (directory navigation):
- User clicks a folder
- Repo browser calls `replaceBlade({ type: "repo-browser", props: { path: newPath } })`
- The "same" blade type re-renders with new path
- Back button pops to previous blade on stack (could be a parent directory or the blade that opened the browser)

**DiffBlade -> Markdown Preview** (file content):
- The DiffBlade already has `diff.newContent` from the query
- Markdown toggle simply renders `<MarkdownRenderer content={diff.newContent} />` instead of Monaco
- No cross-blade communication — the data is already inside the blade

**Markdown Viewer -> Repo Browser** (relative link navigation):
- User clicks a relative link in rendered markdown (e.g., `./docs/API.md`)
- The `MarkdownRenderer.onLinkClick` callback resolves the relative path against the current file's directory
- If target is `.md` → `replaceBlade("viewer-markdown", { filePath: resolvedPath })`
- If target is a directory → `pushBlade("repo-browser", { path: resolvedPath })`
- If target is another file type → `pushBlade(bladeTypeForFile(resolvedPath, "browse"), ...)`

### 7.3 Pattern Summary

All Phase 22 cross-blade communication is handled by **blade stack operations with typed props**. No new communication mechanism is needed. This is a strength of the architecture — blades are decoupled and communicate through the blade stack, which is the single source of truth.

---

## 8. Enforcing Extensibility Patterns

### 8.1 Current Type Safety Gaps

**Gap 1 — `BladeRegistration.type` is `string`, not `BladeType`**:
```ts
// Current: no compile error if you register a non-existent type
registerBlade({ type: "nonexistent", ... }); // compiles fine!
```

**Fix**: Constrain the `type` field:
```ts
export interface BladeRegistration<TProps = Record<string, never>> {
  type: BladeType;  // was: string
  // ...
}
```

This creates a compile-time guarantee that every runtime registration corresponds to a type in `BladePropsMap`.

**Gap 2 — No compile-time check that all `BladePropsMap` entries have registrations**:

You can add a type to `BladePropsMap` but forget to create a registration file. The blade renders "Unknown blade" at runtime.

**Fix — Exhaustiveness check** (development-time):

```ts
// src/components/blades/registrations/index.ts
import { getAllBladeTypes } from "../../../lib/bladeRegistry";
import type { BladeType } from "../../../stores/bladeTypes";

// After all imports, verify in dev mode
if (import.meta.env.DEV) {
  const EXPECTED_TYPES: BladeType[] = [
    "staging-changes", "topology-graph", "commit-details", "diff",
    "viewer-nupkg", "viewer-image", "viewer-markdown", "viewer-3d",
    "viewer-code", "repo-browser", "settings", "changelog", "gitflow-cheatsheet",
  ];
  const registered = new Set(getAllBladeTypes());
  const missing = EXPECTED_TYPES.filter(t => !registered.has(t));
  if (missing.length > 0) {
    console.error(`[BladeRegistry] Missing registrations for: ${missing.join(", ")}`);
  }
}
```

This is a dev-only assertion, not a type-level guarantee. For a fully type-safe approach, we would need a more elaborate factory pattern — but the runtime check is pragmatic and sufficient.

**Gap 3 — `registrations/index.ts` must be manually updated**:

This barrel file must have an import for every blade. Forgetting to add the import is the most common mistake.

**Mitigation options**:
- (A) Dev-time exhaustiveness check (see Gap 2 fix above)
- (B) Auto-generation script that scans `registrations/*.ts` and generates the barrel
- (C) Switch to a glob import pattern (Vite supports `import.meta.glob`)

**Recommendation**: Option A is the lowest-friction fix. Option C is elegant but changes the loading pattern:

```ts
// registrations/index.ts — auto-import all registration files
const modules = import.meta.glob("./*.ts", { eager: true });
// Side effects of each module (registerBlade calls) execute on import
```

This eliminates the need to manually update the barrel file. When a new `.ts` file is added to `registrations/`, it's automatically imported.

### 8.2 Proposed "Add a New Blade Type" Checklist (Developer Documentation)

Rather than a markdown README (which falls out of date), embed the checklist as a TypeScript comment in `BladePropsMap`:

```ts
/**
 * Central map: blade type -> required props.
 *
 * TO ADD A NEW BLADE TYPE:
 * 1. Add an entry to this interface
 * 2. Create the component in src/components/blades/YourBlade.tsx
 * 3. Create src/components/blades/registrations/your-type.ts with registerBlade()
 * 4. If file-type-based: add mapping in src/lib/fileDispatch.ts
 *
 * The dev-mode exhaustiveness check will warn if step 3 is forgotten.
 */
export interface BladePropsMap { ... }
```

### 8.3 Extensibility Contract

Phase 22 should establish these guarantees:

| Contract | Mechanism | Enforcement |
|----------|-----------|-------------|
| Every blade type has a `BladePropsMap` entry | `BladeType = keyof BladePropsMap` | Compile-time |
| Every `registerBlade` call targets a valid type | `BladeRegistration.type: BladeType` | Compile-time (with proposed fix) |
| Every `BladePropsMap` entry has a runtime registration | Dev-mode exhaustiveness check | Runtime (dev only) |
| File dispatch targets valid blade types | `Map<string, BladeType>` | Compile-time |
| Adding a file type mapping requires the blade to exist | `BladeType` constraint on map values | Compile-time |
| Blade components are lazy-loaded | `lazy: true` in registration | Convention (enforced by review) |
| All blades get error boundary + Suspense | `BladeRenderer` wrapping logic | Automatic (architecture) |

---

## 9. Detailed Refactoring Proposals

### 9.1 Before/After: BladeRegistration Type Safety

**Before** (`src/lib/bladeRegistry.ts`):
```ts
export interface BladeRegistration<TProps = Record<string, never>> {
  type: string;  // <-- any string accepted
  // ...
}
```

**After**:
```ts
import type { BladeType } from "../stores/bladeTypes";

export interface BladeRegistration<TProps = Record<string, never>> {
  type: BladeType;  // <-- must be a valid blade type
  // ...
}
```

**Impact**: 0 runtime changes. All existing registrations already use valid types, so no existing code breaks.

### 9.2 Before/After: Auto-Import Registrations

**Before** (`src/components/blades/registrations/index.ts`):
```ts
import "./staging-changes";
import "./topology-graph";
// ... manual list ...
import "./gitflow-cheatsheet";
```

**After**:
```ts
// Auto-import all registration modules in this directory
const modules = import.meta.glob("./*.ts", { eager: true });
// Each module's top-level registerBlade() call executes on import

if (import.meta.env.DEV) {
  // Exhaustiveness check
  import("../../../lib/bladeRegistry").then(({ getAllBladeTypes }) => {
    const registered = getAllBladeTypes();
    console.debug(`[BladeRegistry] ${registered.length} blade types registered:`, registered);
  });
}
```

**Impact**: Future blade types are auto-discovered. No more forgetting to add an import.

### 9.3 Before/After: File Dispatch

**Before** (`src/lib/fileTypeUtils.ts`):
```ts
export function bladeTypeForFile(filePath: string): BladeType {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".nupkg")) return "viewer-nupkg";
  if (lower.endsWith(".png") || ...) return "viewer-image";
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return "viewer-markdown";
  if (lower.endsWith(".glb") || lower.endsWith(".gltf")) return "viewer-3d";
  return "diff";
}
```

**After** (`src/lib/fileDispatch.ts`):
```ts
const FILE_DISPATCH: ReadonlyMap<string, BladeType> = new Map([
  ["png", "viewer-image"], ["jpg", "viewer-image"], ["jpeg", "viewer-image"],
  ["gif", "viewer-image"], ["webp", "viewer-image"], ["svg", "viewer-image"],
  ["ico", "viewer-image"], ["bmp", "viewer-image"],
  ["md", "viewer-markdown"], ["mdx", "viewer-markdown"],
  ["glb", "viewer-3d"], ["gltf", "viewer-3d"],
  ["nupkg", "viewer-nupkg"],
]);

export function bladeTypeForFile(filePath: string, context: "diff" | "browse" = "diff"): BladeType {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return FILE_DISPATCH.get(ext) ?? (context === "browse" ? "viewer-code" : "diff");
}
```

**Impact**: Adding a new file type = adding 1 line to the Map. Type-safe. Context-aware fallback.

### 9.4 New Shared Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `useRepoFile(filePath)` | `src/hooks/useRepoFile.ts` | Shared query for loading file content from HEAD |
| `MarkdownRenderer` | `src/components/markdown/MarkdownRenderer.tsx` | Reusable markdown rendering with plugins |
| `ContentBlade` | `src/components/blades/ContentBlade.tsx` | Shared wrapper for file viewer blades |
| `MONACO_COMMON_OPTIONS` | `src/lib/monacoConfig.ts` | Shared Monaco editor options |
| `highlight-catppuccin.css` | `src/styles/highlight-catppuccin.css` | Catppuccin theme for highlight.js |

---

## 10. New Blade Type: `viewer-code`

### 10.1 Registration

Add to `BladePropsMap`:
```ts
"viewer-code": { filePath: string };
```

Registration:
```ts
// registrations/viewer-code.ts
const ViewerCodeBlade = lazy(() =>
  import("../ViewerCodeBlade").then((m) => ({ default: m.ViewerCodeBlade })),
);
registerBlade<{ filePath: string }>({
  type: "viewer-code",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Code",
  component: ViewerCodeBlade,
  lazy: true,
});
```

### 10.2 Component Structure

```tsx
// ViewerCodeBlade.tsx
function ViewerCodeBlade({ filePath }: { filePath: string }) {
  const { data, isLoading, error } = useRepoFile(filePath);
  // Uses Monaco <Editor> in read-only mode
  // Language detected from file extension (Monaco's built-in detection)
  // Theme: "flowforge-dark"
  // Options: MONACO_COMMON_OPTIONS
}
```

### 10.3 Language Detection

Monaco has built-in language detection by file extension. Use `monaco.editor.getModel()?.getLanguageId()` or pass the extension-based language directly. For the `viewer-code` blade, derive language from `filePath`:

```ts
function languageFromPath(filePath: string): string | undefined {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescriptreact",
    js: "javascript", jsx: "javascriptreact",
    rs: "rust", py: "python", go: "go",
    json: "json", yaml: "yaml", yml: "yaml",
    toml: "toml", css: "css", html: "html",
    // ... etc
  };
  return ext ? map[ext] : undefined;
}
```

Alternatively, pass the file path to Monaco and let it auto-detect via `@monaco-editor/react`'s `language` prop with `undefined` (it uses the file extension heuristic internally).

---

## 11. DiffBlade Markdown Toggle Extension

### 11.1 Implementation Approach

The DiffBlade already has an internal toolbar row (line 182-203 in `DiffBlade.tsx`). The markdown toggle is a natural addition:

```tsx
// Inside DiffBlade component
const isMarkdown = source.filePath?.endsWith(".md") || source.filePath?.endsWith(".mdx");
const [showPreview, setShowPreview] = useState(false);

// In the toolbar row, alongside the inline/side-by-side toggle:
{isMarkdown && (
  <Button variant="ghost" size="sm" onClick={() => setShowPreview(v => !v)}>
    {showPreview ? <Code className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    <span className="text-xs ml-1.5">
      {showPreview ? "Diff" : "Preview"}
    </span>
  </Button>
)}

// In the content area:
{showPreview ? (
  <div className="flex-1 min-h-0 overflow-auto p-4">
    <MarkdownRenderer content={diff.newContent} />
  </div>
) : (
  <DiffEditor ... />
)}
```

### 11.2 Lazy Loading Consideration

The `MarkdownRenderer` import inside `DiffBlade` would pull `react-markdown` and plugins into the DiffBlade's chunk. Since DiffBlade is already lazy-loaded, this only affects users who open diffs.

To further optimize, lazy-load the markdown renderer only when the toggle is activated:

```tsx
const MarkdownRenderer = lazy(() =>
  import("../markdown/MarkdownRenderer").then(m => ({ default: m.MarkdownRenderer }))
);

// Render only when toggled
{showPreview && (
  <Suspense fallback={<BladeLoadingFallback />}>
    <MarkdownRenderer content={diff.newContent} />
  </Suspense>
)}
```

This way, `react-markdown` (45 KB gzipped) is only loaded when a user actually toggles the markdown preview on a `.md` file diff.

---

## 12. Existing Viewer Registry vs. Blade Registry

### 12.1 Two Registry Systems

There is an older `ViewerRegistry` in `src/components/viewers/ViewerRegistry.ts`:

```ts
export interface ViewerProps {
  file: FileChange;
  section: "staged" | "unstaged" | "untracked" | null;
}
type ViewerMatcher = (file: FileChange) => boolean;
```

This is a separate registry from the blade registry, used specifically for the `NugetPackageViewer` in the staging context. It operates at a lower level (component within a blade, not a blade itself).

### 12.2 Relationship

- **Blade registry**: Maps blade types to full-page blade components with panel wrapping
- **Viewer registry**: Maps file patterns to inline viewer components for the staging panel

These serve different purposes. The `ViewerNupkgBlade` wraps `NugetPackageViewer` for the blade context:

```tsx
export function ViewerNupkgBlade({ filePath }: ViewerNupkgBladeProps) {
  const file: FileChange = { path: filePath, status: "modified", additions: null, deletions: null };
  return <NugetPackageViewer file={file} section={null} />;
}
```

**Recommendation**: Keep both registries. They solve different problems. The blade registry is for Phase 22. The viewer registry may evolve independently for inline staging previews.

---

## 13. Dependencies Summary

### 13.1 Already Installed (No Action)

| Package | Version | Used By |
|---------|---------|---------|
| `react-markdown` | ^10.1.0 | ViewerMarkdownBlade, DiffBlade toggle |
| `remark-gfm` | ^4.0.1 | MarkdownRenderer plugin |
| `rehype-highlight` | ^7.0.2 | MarkdownRenderer plugin |
| `@google/model-viewer` | ^4.1.0 | Viewer3dBlade |
| `@monaco-editor/react` | ^4.7.0 | ViewerCodeBlade, DiffBlade |

### 13.2 Need to Install

| Package | Purpose | Estimated Size |
|---------|---------|---------------|
| `rehype-sanitize` | XSS protection for markdown | ~5 KB gzipped |

### 13.3 Verify Transitive

| Package | Status | Notes |
|---------|--------|-------|
| `highlight.js` | Likely transitive via `rehype-highlight` | Verify with `npm ls highlight.js` |

### 13.4 Bundle Size Impact

| Blade | Additional JS (approx gzipped) | Loaded When |
|-------|-------------------------------|-------------|
| viewer-markdown | ~60 KB (react-markdown + remark-gfm + rehype-* + highlight.js subset) | User opens `.md` file |
| viewer-3d | ~180 KB (model-viewer) | User opens `.glb`/`.gltf` file |
| viewer-code | ~5 KB (Monaco wrapper only; Monaco itself is CDN-loaded) | User opens text file from repo browser |
| gitflow-cheatsheet | ~2 KB (static SVG + layout) | User opens cheatsheet |
| repo-browser | ~3 KB (file list + breadcrumbs) | User opens repo browser |

Total potential additional JS: ~250 KB gzipped, but **all lazy-loaded per blade** — zero impact on initial load.

---

## 14. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `@google/model-viewer` WebGL context loss | Medium | Blade crashes | Error boundary catches; add retry button per CONTEXT decisions |
| `react-markdown` XSS via unsanitized HTML | Low (with rehype-sanitize) | Security | Install and configure `rehype-sanitize` with GitHub schema |
| Large markdown files causing performance issues | Low | UX (sluggish) | Virtualized rendering deferred; file size warning for >500 KB |
| Monaco CDN unavailable (offline) | Medium | Viewer-code and DiffBlade blank | Consider bundling Monaco locally in future phase |
| highlight.js language detection mismatch | Low | Wrong syntax colors | Use explicit language hints from file extension |
| Barrel file forgotten for new registrations | Medium | Silent runtime failure | Auto-import via `import.meta.glob` (see 9.2) |

---

## RESEARCH COMPLETE
