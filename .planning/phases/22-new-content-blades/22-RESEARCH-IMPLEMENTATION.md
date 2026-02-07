# Phase 22: Implementation Research

## 1. react-markdown Integration

### Import Pattern and Plugin Configuration

All packages are **already installed** at the required versions:
- `react-markdown@10.1.0` (already in `package.json`)
- `remark-gfm@4.0.1` (already in `package.json`)
- `rehype-highlight@7.0.2` (already in `package.json`)

**New packages to install:**
- `rehype-sanitize@6.0.0` (not yet installed)
- `@catppuccin/highlightjs@1.0.1` (not yet installed)

```tsx
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// Import Catppuccin Mocha highlight.js theme CSS
import "@catppuccin/highlightjs/css/catppuccin-mocha.css";
```

### Full Component Setup

```tsx
// ViewerMarkdownBlade.tsx
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "@catppuccin/highlightjs/css/catppuccin-mocha.css";

<Markdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[
    rehypeHighlight,
    [rehypeSanitize, {
      ...defaultSchema,
      // Allow class names for highlight.js (hljs-*)
      attributes: {
        ...defaultSchema.attributes,
        code: [
          ...(defaultSchema.attributes?.code || []),
          ["className", /^hljs-/, /^language-/],
        ],
        span: [
          ...(defaultSchema.attributes?.span || []),
          ["className", /^hljs-/],
        ],
      },
    }],
  ]}
  components={customComponents}
  urlTransform={customUrlTransform}
>
  {markdownContent}
</Markdown>
```

**Important: Plugin order matters.** `rehype-highlight` must come before `rehype-sanitize` so that highlight.js class names are already applied before sanitization. The sanitize schema must explicitly allow `hljs-*` class names or they will be stripped.

### react-markdown v10 API Notes

Version 10 exports three components:
- `Markdown` (synchronous, default) -- use this one
- `MarkdownAsync` (server-side async plugin support)
- `MarkdownHooks` (client-side async via hooks)

Since we use no async plugins, `Markdown` is the correct choice.

### Custom Component Overrides

```tsx
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  // Headings with Catppuccin styling
  h1: ({ children, ...props }) => (
    <h1 className="text-2xl font-bold text-ctp-text mt-6 mb-3 pb-2 border-b border-ctp-surface1" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-xl font-semibold text-ctp-text mt-5 mb-2 pb-1 border-b border-ctp-surface0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-lg font-semibold text-ctp-subtext1 mt-4 mb-2" {...props}>
      {children}
    </h3>
  ),

  // Paragraphs
  p: ({ children, ...props }) => (
    <p className="text-sm text-ctp-text leading-relaxed mb-3" {...props}>
      {children}
    </p>
  ),

  // Tables with Catppuccin styling
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-ctp-surface0 text-ctp-subtext1" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className="px-3 py-2 text-left font-medium border border-ctp-surface1" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-3 py-2 border border-ctp-surface0 text-ctp-subtext0" {...props}>
      {children}
    </td>
  ),

  // Code blocks (rehype-highlight adds hljs classes)
  pre: ({ children, ...props }) => (
    <pre className="bg-ctp-crust rounded-md p-4 my-3 overflow-x-auto text-sm" {...props}>
      {children}
    </pre>
  ),
  code: ({ children, className, ...props }) => {
    const isBlock = className?.startsWith("hljs") || className?.startsWith("language-");
    if (isBlock) {
      // Block code - rehype-highlight handles syntax coloring
      return <code className={cn("font-mono", className)} {...props}>{children}</code>;
    }
    // Inline code
    return (
      <code className="bg-ctp-surface0 text-ctp-peach px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
        {children}
      </code>
    );
  },

  // Blockquote
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-4 border-ctp-blue pl-4 my-3 text-ctp-subtext0 italic" {...props}>
      {children}
    </blockquote>
  ),

  // Lists
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-6 mb-3 space-y-1 text-sm text-ctp-text" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-6 mb-3 space-y-1 text-sm text-ctp-text" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-ctp-subtext1" {...props}>{children}</li>
  ),

  // Horizontal rule
  hr: (props) => <hr className="my-6 border-ctp-surface1" {...props} />,

  // Strong/em
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-ctp-text" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-ctp-subtext1" {...props}>{children}</em>
  ),

  // Custom link handler (see below)
  a: MarkdownLink,

  // Custom image handler (see below)
  img: MarkdownImage,
};
```

### Custom Link Handling

Three behaviors based on link target:
1. External URLs (https://) --> Tauri shell API to open in system browser
2. Relative `.md` links --> replace current blade with new markdown viewer
3. Other relative links --> open repo browser at that path

```tsx
import { openUrl } from "@tauri-apps/plugin-opener";

function MarkdownLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const store = useBladeStore();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!href) return;

    if (href.startsWith("http://") || href.startsWith("https://")) {
      // External link -> system browser via Tauri opener plugin
      await openUrl(href);
    } else if (href.endsWith(".md") || href.endsWith(".mdx")) {
      // Relative markdown link -> replace blade with new markdown viewer
      const resolvedPath = resolveRelativePath(currentFilePath, href);
      store.replaceBlade({
        type: "viewer-markdown",
        title: resolvedPath.split("/").pop() || "Markdown",
        props: { filePath: resolvedPath },
      });
    } else {
      // Other relative link -> open repo browser
      const resolvedPath = resolveRelativePath(currentFilePath, href);
      store.pushBlade({
        type: "repo-browser",
        title: resolvedPath.split("/").pop() || "Browser",
        props: { path: resolvedPath },
      });
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="text-ctp-blue hover:text-ctp-sapphire underline underline-offset-2 cursor-pointer"
      {...props}
    >
      {children}
    </a>
  );
}

// Helper: resolve relative paths against current file directory
function resolveRelativePath(currentFile: string, relativePath: string): string {
  const dir = currentFile.includes("/")
    ? currentFile.substring(0, currentFile.lastIndexOf("/"))
    : "";
  const parts = (dir ? `${dir}/${relativePath}` : relativePath).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== "." && part !== "") resolved.push(part);
  }
  return resolved.join("/");
}
```

### Custom Image Handling

Images are fetched from git HEAD via `read_repo_file`, converted to base64 data URLs:

```tsx
function MarkdownImage({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!src || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
      // External or data URL -- use directly
      setImageSrc(src || null);
      setLoading(false);
      return;
    }

    // Relative path -- fetch from git
    let cancelled = false;
    const load = async () => {
      const resolvedPath = resolveRelativePath(currentFilePath, src);
      const result = await commands.readRepoFile(resolvedPath);
      if (cancelled) return;
      if (result.status === "ok" && result.data.isBinary) {
        // Binary file: content is base64 encoded
        const ext = resolvedPath.split(".").pop()?.toLowerCase() || "png";
        const mime = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
        setImageSrc(`data:${mime};base64,${result.data.content}`);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [src]);

  if (loading) return <span className="inline-block w-4 h-4 animate-spin rounded-full border-2 border-ctp-overlay0 border-t-transparent" />;
  if (!imageSrc) return <span className="text-ctp-overlay0 text-xs">[image: {alt}]</span>;

  return (
    <img
      src={imageSrc}
      alt={alt}
      className="max-w-full rounded my-2"
      {...props}
    />
  );
}
```

**Note**: The `readRepoFile` Rust command returns binary files as base64-encoded content (see `src-tauri/src/git/browse.rs` line 163-165). SVG files are NOT detected as binary (no null bytes), so SVG content comes back as text. The image component needs to handle both cases.

---

## 2. Tauri v2 Shell API (Opening External URLs)

### Already Configured

The opener plugin is **already installed and configured**:
- `@tauri-apps/plugin-opener@^2.5.3` in `package.json`
- `tauri_plugin_opener::init()` in `src-tauri/src/lib.rs` (line 159)
- `"opener:default"` in capabilities (`src-tauri/capabilities/default.json` line 8)

### Usage Pattern

```tsx
import { openUrl } from "@tauri-apps/plugin-opener";

// Open URL in system default browser
await openUrl("https://github.com");

// Open with specific app (optional)
await openUrl("https://github.com", "firefox");
```

### Existing Codebase Usage

The opener plugin is already used in the worktrees store:
- **File**: `src/stores/worktrees.ts` line 68
- **Pattern**: Dynamic import `await import("@tauri-apps/plugin-opener")`
- Uses `revealItemInDir(path)` (different function, same plugin)

For the markdown link handler, either import statically at the top level (since the ViewerMarkdownBlade is already lazy-loaded) or use the same dynamic import pattern.

### No Additional Tauri Configuration Needed

CSP is set to `null` (disabled) in `src-tauri/tauri.conf.json`, so no CSP changes are needed for external URL opening.

---

## 3. @google/model-viewer Integration

### Package Status

Already installed: `@google/model-viewer@4.1.0`

### TypeScript Type Declarations

The package ships with `.d.ts` files in `lib/` and declares:
```ts
// node_modules/@google/model-viewer/lib/model-viewer.d.ts
declare global {
  interface HTMLElementTagNameMap {
    'model-viewer': ModelViewerElement;
  }
}
```

However, it does NOT declare `JSX.IntrinsicElements`, which is needed for React/JSX usage. A custom type declaration file is required.

### Required Type Declaration

Create `src/types/model-viewer.d.ts`:
```ts
import type { ModelViewerElement } from "@google/model-viewer";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        Partial<ModelViewerElement> & {
          src?: string;
          alt?: string;
          "camera-controls"?: boolean;
          "auto-rotate"?: boolean;
          "shadow-intensity"?: string;
          "environment-image"?: string;
          exposure?: string;
          style?: React.CSSProperties;
          class?: string;
          onLoad?: (e: Event) => void;
          onError?: (e: Event) => void;
          onProgress?: (e: CustomEvent<{ totalProgress: number }>) => void;
        },
        HTMLElement
      >;
    }
  }
}
```

### Model Loading Pipeline

The full pipeline for loading 3D models from git:

```tsx
import "@google/model-viewer"; // Register the web component

function Viewer3dBlade({ filePath }: { filePath: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    const load = async () => {
      setLoading(true);
      setError(null);

      const result = await commands.readRepoFile(filePath);
      if (cancelled) return;

      if (result.status !== "ok") {
        setError("Failed to load model file");
        setLoading(false);
        return;
      }

      const { content, isBinary } = result.data;

      // Model files (.glb/.gltf) are binary, so content is base64
      if (!isBinary) {
        setError("Unexpected text content for 3D model");
        setLoading(false);
        return;
      }

      // Decode base64 to ArrayBuffer
      const binaryString = atob(content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob URL
      const ext = filePath.split(".").pop()?.toLowerCase();
      const mime = ext === "gltf" ? "model/gltf+json" : "model/gltf-binary";
      const blob = new Blob([bytes.buffer], { type: mime });
      url = URL.createObjectURL(blob);

      if (!cancelled) {
        setBlobUrl(url);
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [filePath]);

  // WebGL context loss handling
  const viewerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const canvas = viewer.shadowRoot?.querySelector("canvas");
    if (!canvas) return;

    const handleContextLost = () => setContextLost(true);
    const handleContextRestored = () => setContextLost(false);

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [blobUrl]); // Re-attach when blob changes

  if (contextLost) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-ctp-mantle gap-4">
        <Box className="w-12 h-12 text-ctp-overlay0" />
        <p className="text-sm text-ctp-subtext0">3D rendering context lost</p>
        <Button variant="outline" size="sm" onClick={() => setContextLost(false)}>
          Reload 3D View
        </Button>
      </div>
    );
  }

  return (
    <model-viewer
      ref={viewerRef}
      src={blobUrl}
      alt={filePath.split("/").pop() || "3D Model"}
      camera-controls
      auto-rotate
      shadow-intensity="1"
      environment-image="neutral"
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(to bottom, var(--ctp-base), var(--ctp-mantle))`,
      }}
    />
  );
}
```

### Progress Events

```tsx
// Attach via ref after mount
useEffect(() => {
  const el = viewerRef.current;
  if (!el) return;

  const onProgress = (e: CustomEvent<{ totalProgress: number }>) => {
    setProgress(e.detail.totalProgress); // 0 to 1
  };
  el.addEventListener("progress", onProgress as EventListener);
  return () => el.removeEventListener("progress", onProgress as EventListener);
}, []);
```

### Important Notes

- `@google/model-viewer` **must** be imported as a side-effect to register the custom element: `import "@google/model-viewer";`
- The web component uses Shadow DOM -- accessing internal canvas for WebGL context requires `shadowRoot.querySelector("canvas")`
- model-viewer v4.x bundles Three.js internally. Bundle size is significant (~500KB gzipped). The Viewer3dBlade is lazy-loaded which mitigates this.
- `.glb` files are binary (single container), `.gltf` files may reference external resources (textures, buffers). For Phase 22, only `.glb` is fully reliable since we load from a single blob URL.

---

## 4. Monaco Editor (Read-Only Mode for viewer-code)

### Existing Usage

Monaco is used in three places:
- `src/lib/monacoTheme.ts` -- theme definition and CDN configuration
- `src/components/blades/DiffBlade.tsx` -- `DiffEditor` component
- `src/components/staging/InlineDiffViewer.tsx` -- `DiffEditor` for inline preview

### Available Exports from @monaco-editor/react

```ts
export { Editor, DiffEditor, useMonaco, loader } from "@monaco-editor/react";
export type { EditorProps, OnMount, OnChange, OnValidate, Monaco } from "@monaco-editor/react";
```

The `Editor` component (non-diff) is available but **not yet used** in the codebase. This is what viewer-code needs.

### viewer-code Implementation Pattern

```tsx
import { Editor, type OnMount } from "@monaco-editor/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { commands } from "../../bindings";
import "../../lib/monacoTheme"; // Reuse existing theme registration

interface ViewerCodeBladeProps {
  filePath: string;
}

export function ViewerCodeBlade({ filePath }: ViewerCodeBladeProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await commands.readRepoFile(filePath);
      if (cancelled) return;
      if (result.status === "ok" && !result.data.isBinary) {
        setContent(result.data.content);
      } else if (result.status === "ok" && result.data.isBinary) {
        setError("Binary file - preview not available");
      } else {
        setError("Failed to load file");
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
      </div>
    );
  }

  if (error || content === null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <p className="text-ctp-overlay1 text-sm">{error || "No content"}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0">
      <Editor
        value={content}
        path={filePath} // Monaco uses path for language auto-detection
        theme="flowforge-dark"
        options={{
          readOnly: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          folding: true,
          wordWrap: "off",
          renderLineHighlight: "all",
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
      />
    </div>
  );
}
```

### Language Auto-Detection

Monaco Editor has **built-in** language detection from file paths/extensions. When using the `@monaco-editor/react` `Editor` component:

- The `path` prop creates an internal model with that URI. Monaco's language registry automatically maps file extensions to languages.
- For example: `path="src/App.tsx"` --> TypeScript React, `path="Cargo.toml"` --> TOML.
- This is the simplest approach: just pass the file path to the `path` prop.

Alternative manual approach using `language` prop with a utility:
```ts
function getMonacoLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const MAP: Record<string, string> = {
    ts: "typescript", tsx: "typescriptreact",
    js: "javascript", jsx: "javascriptreact",
    json: "json", md: "markdown", css: "css",
    html: "html", xml: "xml", yaml: "yaml", yml: "yaml",
    py: "python", rs: "rust", go: "go", java: "java",
    sh: "shell", bash: "shell", toml: "ini",
    // ... etc
  };
  return MAP[ext] || "plaintext";
}
```

**Recommendation**: Use the `path` prop approach. It is simpler and uses Monaco's comprehensive built-in mapping. No need for a manual extension map.

### Theme Sharing

The theme is already defined in `src/lib/monacoTheme.ts` as `"flowforge-dark"`. Import this module to ensure the theme is registered before Monaco renders:

```tsx
import "../../lib/monacoTheme"; // Triggers theme registration side-effect
```

Both `DiffBlade` and `ViewerCodeBlade` use the same theme name `"flowforge-dark"`.

### Monaco CDN Configuration

Monaco is loaded via CDN (configured in `monacoTheme.ts`):
```ts
loader.config({
  paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs" },
});
```

This means Monaco is **not bundled** -- it is fetched from CDN at runtime. Adding the `Editor` component adds no additional bundle size beyond the thin React wrapper from `@monaco-editor/react`.

---

## 5. Tailwind v4 Patterns for Markdown Styling

### Two Approaches: @tailwindcss/typography vs Custom Components

**Option A: @tailwindcss/typography plugin (prose classes)**

```css
/* In src/index.css */
@plugin "@tailwindcss/typography";
```

Then in the component:
```tsx
<div className="prose prose-sm prose-invert max-w-none">
  <Markdown>{content}</Markdown>
</div>
```

**Problem**: The `prose` classes use their own color palette. Customizing them to match Catppuccin `--ctp-*` tokens requires significant overrides, which defeats the purpose.

**Option B: Custom component overrides (RECOMMENDED)**

Since react-markdown supports `components` prop, we can apply Tailwind classes directly to each element type. This gives us:
- Full control over Catppuccin color tokens
- No extra dependency
- No need to override prose defaults
- Consistent with how the rest of the app is styled

**Decision: Use Option B (custom components)**. No need to install `@tailwindcss/typography`.

### Wrapper Container

```tsx
<div className="p-6 overflow-y-auto h-full text-ctp-text">
  <div className="max-w-3xl mx-auto">
    <Markdown ...>{content}</Markdown>
  </div>
</div>
```

### Catppuccin Color Token Reference

From `src/index.css`, the tokens are imported from `@catppuccin/tailwindcss/mocha.css`. Usage:

| Element | Token | Class |
|---------|-------|-------|
| Body text | ctp-text | `text-ctp-text` |
| Subdued text | ctp-subtext0/1 | `text-ctp-subtext0` |
| Links | ctp-blue | `text-ctp-blue` |
| Inline code | ctp-peach on ctp-surface0 | `text-ctp-peach bg-ctp-surface0` |
| Blockquote border | ctp-blue | `border-ctp-blue` |
| Table header bg | ctp-surface0 | `bg-ctp-surface0` |
| Table border | ctp-surface1 | `border-ctp-surface1` |
| Code block bg | ctp-crust | `bg-ctp-crust` |
| Headings | ctp-text | `text-ctp-text` |
| Heading border | ctp-surface1 | `border-ctp-surface1` |
| HR | ctp-surface1 | `border-ctp-surface1` |

### Custom Animations in @theme Block

Current animations defined in `src/index.css`:
```css
@theme {
  --animate-dirty-pulse: dirty-pulse 2s ease-in-out infinite;
}
```

For Phase 22 loading states, use the existing `animate-spin` (Tailwind built-in) as already done throughout the codebase. No new custom animations needed for loading.

For the "You are here" indicator on the gitflow cheatsheet, consider adding:
```css
@theme {
  --animate-gentle-pulse: gentle-pulse 3s ease-in-out infinite;
}

@keyframes gentle-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

Or use `framer-motion` for the indicator animation to stay consistent with the rest of the app.

---

## 6. Rust API: list_repo_files and read_repo_file

### Command Signatures (from `src-tauri/src/git/browse.rs`)

#### list_repo_files

```rust
pub async fn list_repo_files(
    path: String,
    state: State<'_, RepositoryState>,
) -> Result<Vec<RepoFileEntry>, GitError>
```

**Behavior**:
- Pass empty string `""` for root directory
- Returns directories first, then files, both sorted alphabetically (case-insensitive)
- Reads from **HEAD commit tree** (not working directory)
- Returns empty vec for unborn branches

#### read_repo_file

```rust
pub async fn read_repo_file(
    file_path: String,
    state: State<'_, RepositoryState>,
) -> Result<RepoFileContent, GitError>
```

**Behavior**:
- Reads from **HEAD commit tree** (not working directory)
- Binary detection: checks first 8000 bytes for null byte (`\0`)
- Binary files: content is **base64-encoded** string
- Text files: content is **UTF-8** string (with lossy conversion)
- Returns `EmptyRepository` error for unborn branches

### TypeScript Bindings (from `src/bindings.ts`)

```ts
// Types
export type RepoFileEntry = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;  // u32 in Rust -> number in TS
};

export type RepoFileContent = {
  content: string;
  isBinary: boolean;
  size: number;  // u32 in Rust -> number in TS
};

// Commands (on the commands object)
commands.listRepoFiles(path: string): Promise<Result<RepoFileEntry[], GitError>>
commands.readRepoFile(filePath: string): Promise<Result<RepoFileContent, GitError>>
```

### Result Handling Pattern (established in codebase)

```ts
const result = await commands.readRepoFile(filePath);
if (result.status === "ok") {
  const { content, isBinary, size } = result.data;
  // ... use data
} else {
  const errorMsg = getErrorMessage(result.error);
  // ... handle error
}
```

### Performance Considerations

- **Large files**: `size` field (u32) can be checked before loading content. Consider showing a warning for files > 1MB.
- **Large directories**: `list_repo_files` returns all entries at once. For Phase 22 this is acceptable (deferred: virtualization).
- **Binary base64 overhead**: base64 encoding adds ~33% to the data size. A 10MB binary file becomes ~13.3MB of base64 text over IPC.

### Other Relevant File Commands

For images, there are also:
```ts
commands.getFileBase64(filePath: string): Promise<Result<string, GitError>>
// Returns data URI like "data:image/png;base64,..."
// Reads from working tree (not HEAD)

commands.getCommitFileBase64(oid: string, filePath: string): Promise<Result<string, GitError>>
// Same but from a specific commit
```

These return complete data URIs (with MIME prefix), unlike `readRepoFile` which returns raw base64. For the markdown viewer's image handler, either API can work -- but `readRepoFile` is more consistent since the markdown content itself comes from HEAD.

---

## 7. SVG Diagram for Gitflow Cheatsheet

### React Component Pattern

```tsx
interface GitflowDiagramProps {
  highlightedLane?: "main" | "develop" | "feature" | "release" | "hotfix";
}

function GitflowDiagram({ highlightedLane }: GitflowDiagramProps) {
  const laneColors = {
    main: "var(--ctp-red)",
    develop: "var(--ctp-blue)",
    feature: "var(--ctp-green)",
    release: "var(--ctp-peach)",
    hotfix: "var(--ctp-mauve)",
  };

  return (
    <svg
      viewBox="0 0 800 400"
      className="w-full h-auto"
      role="img"
      aria-label="Gitflow branching diagram"
    >
      {/* Lane backgrounds */}
      {Object.entries(laneColors).map(([lane, color]) => (
        <g key={lane} opacity={highlightedLane === lane ? 1 : 0.4}>
          <line
            x1={50} y1={laneY[lane]} x2={750} y2={laneY[lane]}
            stroke={color}
            strokeWidth={highlightedLane === lane ? 3 : 2}
          />
          <text
            x={20} y={laneY[lane] + 4}
            fill={color}
            fontSize={12}
            fontWeight={highlightedLane === lane ? "bold" : "normal"}
          >
            {lane}
          </text>
        </g>
      ))}

      {/* "You are here" indicator */}
      {highlightedLane && (
        <g className="motion-safe:animate-gentle-pulse">
          <circle
            cx={youAreHereX}
            cy={laneY[highlightedLane]}
            r={8}
            fill={laneColors[highlightedLane]}
            opacity={0.3}
          />
          <circle
            cx={youAreHereX}
            cy={laneY[highlightedLane]}
            r={4}
            fill={laneColors[highlightedLane]}
          />
        </g>
      )}
    </svg>
  );
}
```

### Using Catppuccin Tokens in SVG

SVG `fill` and `stroke` attributes accept CSS `var()` references:
```tsx
<circle fill="var(--ctp-blue)" stroke="var(--ctp-surface1)" />
<line stroke="var(--ctp-green)" />
<text fill="var(--ctp-text)" />
```

This works because Catppuccin tokens are defined as CSS custom properties on the root element.

### Responsive SVG Sizing

Use `viewBox` + `className="w-full h-auto"`:
```tsx
<svg viewBox="0 0 800 400" className="w-full h-auto max-h-[300px]">
```

This scales the SVG proportionally within the blade container.

### "You are here" Animation Options

**Option 1: CSS animation (simpler, recommended)**
```css
@keyframes gentle-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```
Use: `className="motion-safe:animate-gentle-pulse"` (respects prefers-reduced-motion)

**Option 2: framer-motion**
```tsx
<motion.circle
  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
  transition={{ duration: 2, repeat: Infinity }}
/>
```
Better for complex multi-step animations but overkill for a simple pulse.

**Recommendation**: Use CSS animation. Keep it consistent with `motion-safe:` prefix pattern already used in the codebase for `animate-spin` and `animate-dirty-pulse`.

### Branch Type Classification

```ts
type BranchType = "main" | "develop" | "feature" | "release" | "hotfix" | "other";

function classifyBranch(branchName: string): BranchType {
  if (branchName === "main" || branchName === "master") return "main";
  if (branchName === "develop" || branchName === "development") return "develop";
  if (branchName.startsWith("feature/")) return "feature";
  if (branchName.startsWith("release/")) return "release";
  if (branchName.startsWith("hotfix/")) return "hotfix";
  return "other";
}
```

---

## 8. Dependency Installation and Configuration

### New Packages to Install

```bash
npm install rehype-sanitize@6.0.0 @catppuccin/highlightjs@1.0.1
```

That's it. All other packages are already installed:

| Package | Version | Status |
|---------|---------|--------|
| `react-markdown` | `^10.1.0` | Already installed |
| `remark-gfm` | `^4.0.1` | Already installed |
| `rehype-highlight` | `^7.0.2` | Already installed |
| `@google/model-viewer` | `^4.1.0` | Already installed |
| `@monaco-editor/react` | `^4.7.0` | Already installed |
| `rehype-sanitize` | `6.0.0` | **NEW -- needs install** |
| `@catppuccin/highlightjs` | `1.0.1` | **NEW -- needs install** |

### TypeScript Configuration Changes

**New file needed**: `src/types/model-viewer.d.ts` for JSX IntrinsicElements augmentation.

Ensure it is within the `"include": ["src"]` path in `tsconfig.json` -- it already is since `src/types/` is under `src/`.

### Tailwind v4 Configuration Changes

**None required.** No new plugins. No new content paths (all blade components are in `src/components/blades/`). Optionally add the `gentle-pulse` animation to the `@theme {}` block in `src/index.css`.

### highlight.js Catppuccin Theme

The `@catppuccin/highlightjs` package provides CSS files at:
- `@catppuccin/highlightjs/css/catppuccin-mocha.css`

This is a pure CSS file that styles `.hljs` and `.hljs-*` classes. Import it in the ViewerMarkdownBlade:
```tsx
import "@catppuccin/highlightjs/css/catppuccin-mocha.css";
```

`rehype-highlight` adds `hljs` class names to code blocks. The CSS import colors them.

---

## 9. Performance and Bundle Size

### Bundle Size Estimates

| Package | Size (gzipped) | Lazy-loaded? |
|---------|---------------|--------------|
| `react-markdown` + unified pipeline | ~30KB | Yes (ViewerMarkdownBlade is lazy) |
| `remark-gfm` | ~5KB | Yes (imported with markdown blade) |
| `rehype-highlight` | ~3KB | Yes |
| `rehype-sanitize` | ~3KB | Yes |
| `highlight.js` (auto-pulled by rehype-highlight) | ~30KB (common languages) | Yes |
| `@catppuccin/highlightjs/css/catppuccin-mocha.css` | ~2KB | Yes |
| `@google/model-viewer` (includes Three.js) | ~500KB | Yes (Viewer3dBlade is lazy) |
| `@monaco-editor/react` (thin wrapper) | ~5KB | Already loaded (DiffBlade uses it) |
| Monaco Editor (CDN) | 0KB (CDN loaded) | Runtime CDN fetch |

### Lazy Loading Strategy

All viewer blades are already lazy-loaded via `React.lazy()` in their registration files:

```ts
// src/components/blades/registrations/viewer-markdown.ts
const ViewerMarkdownBlade = lazy(() =>
  import("../ViewerMarkdownBlade").then((m) => ({ default: m.ViewerMarkdownBlade }))
);
```

This means `react-markdown`, `remark-gfm`, `rehype-highlight`, `rehype-sanitize`, `highlight.js`, and the CSS theme are all code-split into a separate chunk that loads **only when a user opens a markdown file**.

Similarly, `@google/model-viewer` (and its bundled Three.js) are only loaded when opening a `.glb`/`.gltf` file.

### highlight.js Language Subsetting

`rehype-highlight` uses highlight.js under the hood. By default, it auto-detects languages and loads common ones. It does NOT load all 200+ languages. For Phase 22 this is fine.

If bundle size becomes a concern later, you can configure highlight.js to only support specific languages:
```tsx
import rehypeHighlight from "rehype-highlight";
import langTypeScript from "highlight.js/lib/languages/typescript";

// Register specific languages only
[rehypeHighlight, { languages: { typescript: langTypeScript } }]
```

**Recommendation**: Use the default auto-detection for now. Optimize later if needed.

### Code Splitting Boundaries

Current code splitting is sufficient:
1. **ViewerMarkdownBlade chunk**: react-markdown + plugins + highlight.js CSS
2. **Viewer3dBlade chunk**: @google/model-viewer + Three.js
3. **ViewerCodeBlade chunk**: (new) shares Monaco with DiffBlade (already loaded in most flows)
4. **RepoBrowserBlade chunk**: lightweight (just file listing UI)
5. **GitflowCheatsheetBlade chunk**: lightweight (SVG + text)

No additional Vite config changes needed -- `React.lazy()` + dynamic imports handle code splitting automatically.

---

## 10. Current Codebase Patterns

### Blade Component File Organization

All blade components live in `src/components/blades/`:
- Component file: `ViewerMarkdownBlade.tsx`
- Registration file: `registrations/viewer-markdown.ts`
- Registration barrel: `registrations/index.ts` (imports all registrations)

### Blade Registration Pattern

```ts
// src/components/blades/registrations/viewer-markdown.ts
import { lazy } from "react";
import { registerBlade } from "../../../lib/bladeRegistry";

const ViewerMarkdownBlade = lazy(() =>
  import("../ViewerMarkdownBlade").then((m) => ({
    default: m.ViewerMarkdownBlade,
  })),
);

registerBlade<{ filePath: string }>({
  type: "viewer-markdown",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Markdown",
  component: ViewerMarkdownBlade,
  lazy: true,
});
```

Key registration options:
- `lazy: true` -- wraps in `<Suspense>` with `<BladeLoadingFallback />`
- `wrapInPanel: false` -- skips the BladePanel header (used by staging-changes root)
- `showBack: false` -- hides back button
- `renderTitleContent` -- custom JSX for the title bar
- `renderTrailing` -- trailing element in the title bar

### Adding a New Blade Type (viewer-code)

Three changes required:

1. **Add to BladePropsMap** (`src/stores/bladeTypes.ts`):
```ts
"viewer-code": { filePath: string };
```

2. **Create component** (`src/components/blades/ViewerCodeBlade.tsx`)

3. **Create registration** (`src/components/blades/registrations/viewer-code.ts`):
```ts
import { lazy } from "react";
import { registerBlade } from "../../../lib/bladeRegistry";

const ViewerCodeBlade = lazy(() =>
  import("../ViewerCodeBlade").then((m) => ({
    default: m.ViewerCodeBlade,
  })),
);

registerBlade<{ filePath: string }>({
  type: "viewer-code",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Code",
  component: ViewerCodeBlade,
  lazy: true,
});
```

4. **Import in barrel** (`src/components/blades/registrations/index.ts`):
```ts
import "./viewer-code";
```

5. **Update fileTypeUtils** (`src/lib/fileTypeUtils.ts`):
Add `viewer-code` as fallback for text files in the repo browser dispatch (distinct from "diff" which is for staging/commit diffs).

### Hook Usage Patterns

```tsx
// Access blade navigation
const { openBlade, openDiff, goBack } = useBladeNavigation();

// Access blade store directly
const store = useBladeStore();
store.pushBlade({ type: "viewer-markdown", title: "README.md", props: { filePath: "README.md" } });
store.replaceBlade({ ... }); // Replace top blade (for in-place navigation)
store.popBlade(); // Go back

// Data fetching
const { data, isLoading, error } = useQuery({
  queryKey: ["repoFiles", path],
  queryFn: () => commands.listRepoFiles(path),
});
```

### Loading State Pattern

All blades use the same pattern:
```tsx
if (isLoading) {
  return (
    <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
      <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
    </div>
  );
}
```

For lazy-loaded blades, the `BladeRenderer` wraps them in `<Suspense>` with `<BladeLoadingFallback />`.

### Error State Pattern

```tsx
if (error || !result || result.status === "error") {
  return (
    <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
      <p className="text-ctp-red text-sm">Failed to load ...</p>
    </div>
  );
}
```

### Error Boundary

Every blade is wrapped in `<BladeErrorBoundary>` by `BladeRenderer.tsx`. This catches runtime errors and shows a retry/go-back UI.

### framer-motion Usage

- `BladeContainer.tsx`: `AnimatePresence` + `motion.div` for blade transitions
- Standard variants in `src/lib/animations.ts`: `bladeSlideIn`, `fadeIn`, `fadeInUp`, etc.
- `MotionConfig reducedMotion="user"` is set at the app root (`src/main.tsx`)

### Existing Utility Functions to Reuse

| Utility | File | Purpose |
|---------|------|---------|
| `cn()` | `src/lib/utils.ts` | Merge Tailwind classes (clsx + tailwind-merge) |
| `getErrorMessage()` | `src/lib/errors.ts` | Extract message from GitError/GitflowError |
| `bladeTypeForFile()` | `src/lib/fileTypeUtils.ts` | Map file extension to blade type |
| `isBinaryFile()` | `src/lib/fileTypeUtils.ts` | Check if file extension is binary |
| `debounce()` | `src/lib/utils.ts` | Debounce function calls |
| `openBlade()` | `src/lib/bladeOpener.ts` | Open blade from non-React contexts |

---

## Quick Reference

### Files to Modify (Existing)

| File | Change |
|------|--------|
| `src/stores/bladeTypes.ts` | Add `"viewer-code": { filePath: string }` to BladePropsMap |
| `src/components/blades/ViewerMarkdownBlade.tsx` | Replace placeholder with full implementation |
| `src/components/blades/Viewer3dBlade.tsx` | Replace placeholder with model-viewer implementation |
| `src/components/blades/RepoBrowserBlade.tsx` | Replace placeholder with file browser implementation |
| `src/components/blades/GitflowCheatsheetBlade.tsx` | Replace placeholder with SVG diagram + guide |
| `src/components/blades/DiffBlade.tsx` | Add markdown toggle button for `.md` files |
| `src/components/blades/registrations/index.ts` | Add `import "./viewer-code"` |
| `src/lib/fileTypeUtils.ts` | Update dispatch logic for viewer-code |
| `src/index.css` | Optionally add `gentle-pulse` animation |
| `package.json` | Add rehype-sanitize, @catppuccin/highlightjs |

### Files to Create (New)

| File | Purpose |
|------|--------|
| `src/components/blades/ViewerCodeBlade.tsx` | Monaco read-only file viewer |
| `src/components/blades/registrations/viewer-code.ts` | Registration for viewer-code |
| `src/types/model-viewer.d.ts` | JSX type declarations for model-viewer |
| `src/components/gitflow/GitflowDiagram.tsx` | SVG diagram component |
| `src/components/gitflow/GitflowGuide.tsx` | Branch type cards and descriptions |
| `src/lib/branchClassifier.ts` | Branch name to type classification |
| `src/lib/markdownComponents.tsx` | Shared markdown component overrides |
| `src/lib/resolveRelativePath.ts` | Path resolution utility for markdown links |

### Key Import Patterns

```tsx
// Markdown rendering
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "@catppuccin/highlightjs/css/catppuccin-mocha.css";

// 3D model viewer
import "@google/model-viewer";
import type { ModelViewerElement } from "@google/model-viewer";

// Monaco read-only editor
import { Editor } from "@monaco-editor/react";
import "../../lib/monacoTheme";

// Tauri opener
import { openUrl } from "@tauri-apps/plugin-opener";

// Existing bindings
import { commands } from "../../bindings";
import type { RepoFileEntry, RepoFileContent } from "../../bindings";
```

### Install Command

```bash
npm install rehype-sanitize@6.0.0 @catppuccin/highlightjs@1.0.1
```

### Blade Type Dispatch (for repo browser)

```
.md, .mdx           -> viewer-markdown
.png, .jpg, .jpeg,
.gif, .webp, .svg,
.ico, .bmp           -> viewer-image
.glb, .gltf          -> viewer-3d
.nupkg               -> viewer-nupkg
(text files)          -> viewer-code    [NEW]
(binary, unrecognized)-> info card      [inline in repo-browser]
```

---

## RESEARCH COMPLETE
