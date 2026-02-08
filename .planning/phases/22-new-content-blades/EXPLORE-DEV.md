# Phase 22 — Expert Dev Exploration Report

## 1. Tauri Bindings for File Reading

### What EXISTS

Both commands are **already registered and working** in `src/bindings.ts`:

- **`commands.readRepoFile(filePath: string)`** → `Promise<Result<RepoFileContent, GitError>>`
  - `RepoFileContent = { content: string; isBinary: boolean; size: number }`
  - Text files: UTF-8 content string
  - Binary files: base64-encoded content string
  - Binary detection: checks first 8000 bytes for null byte
  - Reads from HEAD commit tree (not working directory)

- **`commands.listRepoFiles(path: string)`** → `Promise<Result<RepoFileEntry[], GitError>>`
  - `RepoFileEntry = { name: string; path: string; isDir: boolean; size: number }`
  - Pass `""` for root directory
  - Returns dirs first, then files, both sorted alphabetically

- **`commands.getFileBase64(filePath: string)`** → `Promise<Result<string, GitError>>`
  - Returns a data URI like `data:image/png;base64,...` from working tree

- **`commands.getCommitFileBase64(oid: string, filePath: string)`** → `Promise<Result<string, GitError>>`
  - Same but from a specific commit

### Plans assume correctly

- `readRepoFile` exists with the signature the plans expect ✅
- `listRepoFiles` exists with the signature the plans expect ✅
- Binary detection is built-in ✅

### Notes for implementation

- `readRepoFile` reads from **HEAD** (committed tree), NOT the working directory. This is correct for the repo browser (browse committed files at HEAD).
- For markdown rendering of images, `readRepoFile` will return base64 for binary files — the 3D viewer plan correctly identifies the need to decode base64 to ArrayBuffer for blob URLs.

---

## 2. Tauri Backend Commands (Rust)

### File organization

Commands are in `src-tauri/src/git/browse.rs`:
- `list_repo_files` — navigates the commit tree at HEAD
- `read_repo_file` — extracts blob content from HEAD tree

Both are registered in `src-tauri/src/lib.rs` line 136-137:
```rust
// Browse commands
list_repo_files,
read_repo_file,
```

### What plans assume correctly

- Browse commands exist and are registered ✅
- No new Rust commands needed for Phase 22 ✅
- Binary detection uses null-byte check in first 8000 bytes ✅

### Potential issue: Large file handling

`read_repo_file` reads the entire blob into memory. For very large files in 3D model loading, this could be an issue. The current `size` field is `u32`, capping at ~4GB which is fine for typical repo files. No immediate concern but worth noting.

---

## 3. Monaco Integration

### Current state

**Monaco DiffEditor** is used in `src/components/blades/DiffBlade.tsx`:
- Import: `import { DiffEditor } from "@monaco-editor/react"`
- Theme: `"flowforge-dark"` (registered in `monacoTheme.ts`)
- CDN loader configured at `https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs`

**Theme registration** in `src/lib/monacoTheme.ts`:
- Custom Catppuccin Mocha theme with syntax highlighting rules
- Diff editor colors (inserted/removed backgrounds and gutters)
- Registered via `loader.init().then(monaco => monaco.editor.defineTheme(...))`
- Side-effect import: `import "../../lib/monacoTheme"` (in DiffBlade.tsx)

**Current DiffBlade Monaco options**:
```ts
{
  readOnly: true,
  renderSideBySide: !inline,
  originalEditable: false,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: "on",
  folding: true,
  wordWrap: "off",
  renderLineHighlight: "all",
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
}
```

### What plans assume correctly

- Monaco is already installed (`@monaco-editor/react@^4.7.0`) ✅
- Theme is Catppuccin Mocha compatible ✅
- The `monacoTheme.ts` side-effect import pattern exists ✅
- Plan 22-02's `MONACO_COMMON_OPTIONS` correctly mirrors existing DiffBlade options ✅

### Notes for viewer-code blade

- `viewer-code` will use `Editor` (not `DiffEditor`) from `@monaco-editor/react`
- Language auto-detection: Monaco's `editor.setModelLanguage()` or pass `language` prop. Monaco auto-detects from file extension if using the correct model URI.
- The theme `"flowforge-dark"` is already defined — just import `monacoTheme.ts` as side-effect.

---

## 4. React Query Usage Patterns

### Query key conventions (from codebase analysis)

| Query Key | Component | Pattern |
|-----------|-----------|---------|
| `["stagingStatus"]` | StagingPanel, DiffBlade, etc. | Simple string key |
| `["commitHistory"]` | CommitHistory | Simple string key |
| `["repositoryStatus"]` | Header | Simple string key |
| `["remotes"]` | SyncButtons | Simple string key |
| `["commitDetails", oid]` | CommitDetails | Entity + ID |
| `["commitSearch", query]` | CommitHistory | Entity + parameter |
| `["fileDiff", path, staged, contextLines]` | InlineDiffViewer, DiffBlade | Entity + params tuple |
| `["commitFileDiff", oid, path, contextLines]` | DiffBlade | Entity + params tuple |
| `["nuget-package", id]` | NugetPackageViewer | Entity + ID |
| `["lastCommitMessage"]` | CommitForm | Simple string key |

### Patterns used

- `useQuery` for data fetching with caching
- `useMutation` for write operations (stage, unstage, push, pull, fetch, commit)
- `useQueryClient()` for manual invalidation after mutations
- `useInfiniteQuery` for paginated commit history
- `staleTime` used selectively (commit diffs get 60s, staging diffs use default)
- Error handling: check `result.status === "ok"` pattern (from Tauri Result type)

### Plan 22-02's `useRepoFile` hook

The plan proposes `queryKey: ["repoFile", filePath]` with `staleTime: 60_000` — this is **consistent** with existing patterns ✅.

---

## 5. Package.json Dependencies

### Already installed (no action needed)

| Package | Version | Used by |
|---------|---------|---------|
| `@monaco-editor/react` | `^4.7.0` | DiffBlade |
| `react-markdown` | `^10.1.0` | (not yet used — placeholder) |
| `remark-gfm` | `^4.0.1` | (not yet used — placeholder) |
| `rehype-highlight` | `^7.0.2` | (not yet used — placeholder) |
| `@google/model-viewer` | `^4.1.0` | (not yet used — placeholder) |
| `@tanstack/react-query` | `^5` | Many components |
| `framer-motion` | `^12.31.0` | BladeContainer, etc. |

### Need to install

| Package | Version | Plan | Purpose |
|---------|---------|------|---------|
| `rehype-sanitize` | `^6.0.0` | 22-03 | XSS protection for markdown |
| `@catppuccin/highlightjs` | `^1.0.1` | 22-03 | Catppuccin syntax highlighting theme |

### IMPORTANT: Plan 22-CONTEXT lists dependencies incorrectly

The context document says "Install new dependencies: react-markdown, remark-gfm, rehype-highlight, rehype-sanitize, @google/model-viewer, highlight.js (Catppuccin theme)". However, **react-markdown, remark-gfm, rehype-highlight, and @google/model-viewer are ALREADY installed**. Only `rehype-sanitize` and `@catppuccin/highlightjs` need to be installed. Plan 22-03 correctly identifies this (only installs the two new ones) ✅.

### Concern: `@catppuccin/highlightjs` package

Plan 22-03 specifies `@catppuccin/highlightjs@1.0.1` and CSS import path `@catppuccin/highlightjs/css/catppuccin-mocha.css`. **Verify this package exists on npm and has that CSS path** before executing. The `@catppuccin` org has packages like `@catppuccin/tailwindcss` (already installed), so the highlightjs package likely exists but the exact version and CSS path should be verified at install time.

---

## 6. Tailwind v4 Theme

### Current `@theme` block in `src/index.css`

```css
@theme {
    --font-sans: "Geist Variable", system-ui, ...;
    --font-mono: "JetBrains Mono Variable", ui-monospace, ...;
    --animate-dirty-pulse: dirty-pulse 2s ease-in-out infinite;
}
```

### Animation pattern confirmed

- Register in `@theme {}` block as `--animate-{name}: keyframe duration easing iteration` ✅
- Use as `animate-{name}` class in Tailwind ✅
- `motion-safe:` prefix for reduced-motion support ✅
- Existing example: `--animate-dirty-pulse` with `@keyframes dirty-pulse`

### Plan 22-03's `gentle-pulse` animation

Plan correctly follows the existing pattern:
- Adds `--animate-gentle-pulse: gentle-pulse 3s ease-in-out infinite` to `@theme` block ✅
- Adds `@keyframes gentle-pulse` after existing keyframes ✅

### Catppuccin tokens

- Color tokens via `--ctp-*` CSS custom properties from `@catppuccin/tailwindcss/mocha.css`
- Used as `text-ctp-text`, `bg-ctp-mantle`, `border-ctp-surface0`, etc.
- Theme switching: `.mocha` (dark) and `.latte` (light) classes on `<html>`
- Currently only dark mode (mocha) is active

---

## 7. File Type Utilities

### Current `src/lib/fileTypeUtils.ts`

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

### What plans correctly identify

- The if/else chain needs to become a declarative Map ✅
- Default return is `"diff"` — needs context-aware fallback (`"diff"` vs `"viewer-code"`) ✅
- `isBinaryFile` uses a `BINARY_EXTENSIONS` Set ✅

### Plan 22-01 Task 4-5 approach

Creates `fileDispatch.ts` with `Map<string, BladeType>` and a `context` parameter. The old `fileTypeUtils.ts` becomes a re-export shim. This is correct and backward-compatible ✅.

### Caller analysis

`bladeTypeForFile` is imported in:
- `src/hooks/useBladeNavigation.ts` — uses 1-arg call (default context "diff") ✅
- `src/lib/fileTypeUtils.ts` — defines it (will become re-export)

No other callers. The backward-compatible 1-arg signature is safe ✅.

---

## 8. TypeScript Config

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

### Key observations

- **No path aliases in tsconfig**: The `@/` alias is defined in `vite.config.ts` (`resolve.alias: { "@": "/src" }`) but NOT in tsconfig. Plans that use `../` relative imports are correct. If any plan uses `@/` imports, they'll work at runtime (Vite) but may not type-check unless tsconfig is updated.
- **`"include": ["src"]`**: Any `.d.ts` files in `src/types/` will be automatically included ✅
- **No `src/types/` directory currently exists**: Plan 22-03 creates `src/types/model-viewer.d.ts` — the directory needs to be created first.
- **`"strict": true`**: All plans must handle null/undefined properly ✅
- **Pre-existing TS2440 error**: In `src/bindings.ts` line 1493 — ignore this as documented in MEMORY.md ✅

---

## 9. Existing Viewer Blade Implementations

### All Phase 22 target blades are currently **placeholders**:

| Blade | File | Status |
|-------|------|--------|
| `ViewerMarkdownBlade` | `src/components/blades/ViewerMarkdownBlade.tsx` | Placeholder (shows "Coming in Phase 22") |
| `Viewer3dBlade` | `src/components/blades/Viewer3dBlade.tsx` | Placeholder (shows "Coming in Phase 22") |
| `RepoBrowserBlade` | `src/components/blades/RepoBrowserBlade.tsx` | Placeholder (shows "Coming in Phase 22") |
| `GitflowCheatsheetBlade` | `src/components/blades/GitflowCheatsheetBlade.tsx` | Placeholder (shows "Coming in Phase 22") |

### Already functional viewer blades (reference implementations):

| Blade | File | Status | Notes |
|-------|------|--------|-------|
| `ViewerImageBlade` | `src/components/blades/ViewerImageBlade.tsx` | **Fully functional** | Uses `getFileBase64`/`getCommitFileBase64`, manual loading state |
| `ViewerNupkgBlade` | `src/components/blades/ViewerNupkgBlade.tsx` | **Fully functional** | Uses `useQuery` with custom NuGet parsing |
| `DiffBlade` | `src/components/blades/DiffBlade.tsx` | **Fully functional** | Monaco DiffEditor, inline/side-by-side toggle, staging navigation |

### Blade registration patterns

Two patterns exist:
1. **Eager registration** (simple components): `import Component` then `registerBlade(...)` directly
   - Used by: `viewer-image`, `viewer-nupkg`
2. **Lazy registration** (heavy components): `lazy(() => import(...))` then `registerBlade({ ..., lazy: true })`
   - Used by: `viewer-markdown`, `viewer-3d`, `repo-browser`, `gitflow-cheatsheet`

Plans correctly follow the lazy pattern for new content blades ✅.

### Blade system architecture

- **BladePropsMap** (`src/stores/bladeTypes.ts`): Central type-safe prop map. All Phase 22 blade types already have entries ✅ (except `viewer-code` which Plan 22-01 adds).
- **BladeRegistry** (`src/lib/bladeRegistry.ts`): Runtime Map<string, registration>. Plans correctly identify the `string` vs `BladeType` gap.
- **BladeOpener** (`src/lib/bladeOpener.ts`): Non-hook blade opener with singleton guard. Has duplicated SINGLETON_TYPES array.
- **useBladeNavigation** (`src/hooks/useBladeNavigation.ts`): Hook-based blade opener. Also has duplicated SINGLETON_TYPES array.
- **BladeContainer** (`src/components/blades/BladeContainer.tsx`): AnimatePresence-based stack renderer.
- **BladeRenderer** (`src/components/blades/BladeRenderer.tsx`): Registration lookup → Suspense → ErrorBoundary → BladePanel.
- **Registrations barrel** (`src/components/blades/registrations/index.ts`): Manual import list of all registration files.

---

## 10. Cross-Cutting Observations

### Import.meta.glob support

Plan 22-01 proposes using `import.meta.glob` to auto-discover registration files. This is a **Vite feature** and the project uses Vite (`vite@^7.3.1`). No existing usage of `import.meta.glob` in the codebase, but it's fully supported ✅.

**Caveat**: The glob `["./*.ts", "!./index.ts"]` will match `.ts` files only. All current registration files ARE `.ts` files ✅. If someone creates a `.tsx` registration file, it won't be discovered — plans should use `"./*.ts"` pattern only (registration files don't contain JSX).

### `cn()` utility

Plan 22-02 uses `cn()` from `src/lib/utils.ts` in the `BladeToolbar` component. This utility exists ✅ (uses `clsx` + `tailwind-merge`).

### `sr-only` CSS class

Plan 22-02's ARIA live region uses `className="sr-only"`. This is a Tailwind v4 utility class that visually hides content but keeps it accessible. Currently used in `CommandPalette.tsx` ✅.

### Duplicate SINGLETON_TYPES arrays

Both `src/lib/bladeOpener.ts` and `src/hooks/useBladeNavigation.ts` define the same `SINGLETON_TYPES` array. Plans don't address this duplication — it's a minor cleanup opportunity but not blocking.

### No existing `src/types/` directory

Plan 22-03 creates `src/types/model-viewer.d.ts`. The `src/types/` directory doesn't exist yet and needs to be created. TypeScript will pick it up automatically since `tsconfig.json` includes all of `src/` ✅.

---

## Summary: Plan Accuracy Assessment

### Correctly assumed by plans

1. `readRepoFile` and `listRepoFiles` Tauri commands exist ✅
2. Monaco is configured with Catppuccin theme ✅
3. All Phase 22 blade types have BladePropsMap entries (except viewer-code) ✅
4. All Phase 22 target blades are placeholders ready to be replaced ✅
5. Tailwind v4 animation registration pattern ✅
6. React Query patterns and query key conventions ✅
7. Lazy loading pattern for heavy blades ✅
8. `cn()` utility available ✅
9. Project uses ESM (`"type": "module"`) ✅
10. Most Phase 22 dependencies already installed ✅

### Incorrectly assumed or needs attention

1. **22-CONTEXT.md** lists react-markdown, remark-gfm, rehype-highlight, @google/model-viewer as needing install — they're already in package.json. Plan 22-03 correctly handles this (only installs the 2 new ones).
2. **`@catppuccin/highlightjs`** — verify exact package name, version, and CSS import path at npm. Could be `@catppuccin/highlight.js` or similar.
3. **No `src/types/` directory** — Plan 22-03 should create the directory when creating `model-viewer.d.ts`.
4. **`import.meta.glob` pattern** — should be `"./*.ts"` not `"./*.tsx"` since registration files are pure TS.

### No new Rust backend work needed

All required Tauri commands (`readRepoFile`, `listRepoFiles`, `getFileBase64`, `getCommitFileBase64`) already exist. Phase 22 is purely frontend.

---

*Generated: 2026-02-07*
*Explorer: Expert Dev — Tauri/React/TW4 Implementation Feasibility*
