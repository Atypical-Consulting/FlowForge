# Phase 22: Research Synthesis — New Content Blades

**Research team**: UX Specialist, Software Architect, Expert Developer (Tauri/React/Tailwind)
**Date**: 2026-02-07

This document synthesizes findings from three parallel research streams. Full details in:
- `22-RESEARCH-UX.md` — interaction patterns, accessibility, shared UX
- `22-RESEARCH-ARCHITECTURE.md` — extensibility, refactoring, type safety
- `22-RESEARCH-IMPLEMENTATION.md` — library integrations, Tauri APIs, code patterns

---

## Key Findings Summary

### 1. Dependencies (Minimal New Installs)

Only **2 new packages** needed:
```bash
npm install rehype-sanitize@6.0.0 @catppuccin/highlightjs@1.0.1
```

Everything else is already installed: react-markdown, remark-gfm, rehype-highlight, @google/model-viewer, @monaco-editor/react, @tauri-apps/plugin-opener.

### 2. Type Safety Gaps to Fix (Extensibility Refactoring)

| Gap | Fix | Impact |
|-----|-----|--------|
| `BladeRegistration.type` is `string`, not `BladeType` | Change to `type: BladeType` | Compile-time enforcement, 0 runtime changes |
| Barrel file `registrations/index.ts` requires manual update | Switch to `import.meta.glob("./*.ts", { eager: true })` | Auto-discovers new registrations |
| `bladeTypeForFile()` is a hard-coded if/else chain | Replace with declarative `Map<string, BladeType>` + context-aware fallback | 1 line to add new file types |
| No dev-time check for missing registrations | Add dev-mode exhaustiveness check | Catches forgotten registrations |

### 3. Shared Utilities to Extract

| Utility | Purpose | Reused By |
|---------|---------|-----------|
| `useRepoFile(filePath)` hook | `@tanstack/react-query` wrapper for `readRepoFile` | viewer-markdown, viewer-code, viewer-3d, viewer-image |
| `MarkdownRenderer` component | react-markdown + plugins pipeline | ViewerMarkdownBlade, DiffBlade toggle |
| `BladeContentLoading` | Standardized loading spinner | All content blades |
| `BladeContentError` | Standardized error with retry | All content blades |
| `BladeContentEmpty` | Standardized empty state | All content blades |
| `BladeToolbar` | Sub-header toolbar strip | DiffBlade, RepoBrowser breadcrumbs |
| `renderPathTitle()` | Path/filename split for blade headers | All file viewer registrations |
| `MONACO_COMMON_OPTIONS` | Shared Monaco editor config | DiffBlade, ViewerCodeBlade |
| `resolveRelativePath()` | Resolve relative paths for markdown links | MarkdownRenderer |
| `classifyBranch()` | Branch name → gitflow type | GitflowCheatsheetBlade |

### 4. State Management (No New Stores)

| State | Storage | Rationale |
|-------|---------|-----------|
| Repo browser path | `BladePropsMap.path` via `replaceBlade` | Path is blade props |
| Breadcrumbs | Derived from path | Pure computation |
| Gitflow state | `useGitflowStore` + `useRepositoryStore` | Already exists |
| Diff toggle | `useState` inside DiffBlade | Transient |
| 3D metadata toggle | `useState` inside Viewer3dBlade | Transient |

### 5. New Blade Type: viewer-code

4 files to create/modify:
1. Add `"viewer-code": { filePath: string }` to `BladePropsMap`
2. Create `ViewerCodeBlade.tsx` — Monaco `<Editor>` in read-only mode, language auto-detection via `path` prop
3. Create `registrations/viewer-code.ts` — lazy registration
4. Add import to barrel (or auto-discovered via `import.meta.glob`)

### 6. File Dispatch Registry (Key Extensibility Point)

Replace `bladeTypeForFile()` if/else chain with a declarative `Map<string, BladeType>`:
- Type-safe: map values constrained to `BladeType`
- Context-aware fallback: `"diff"` context → falls back to `"diff"`, `"browse"` context → falls back to `"viewer-code"`
- 1 line to add a new file type mapping

### 7. Markdown Rendering Pipeline

```
react-markdown + remark-gfm + rehype-highlight + rehype-sanitize
```

- **Plugin order**: rehype-highlight BEFORE rehype-sanitize (highlight first, then sanitize allowing `hljs-*` classes)
- **Custom components**: Tailwind v4 classes via `components` prop (NOT @tailwindcss/typography)
- **Link handling**: Custom `<a>` component — external → `openUrl()`, `.md` → `replaceBlade`, other → `pushBlade` repo-browser
- **Image handling**: Custom `<img>` component — resolve relative paths → `readRepoFile` → base64 data URL
- **Code blocks**: Copy button on all `<pre>` elements (always visible)

### 8. 3D Model Viewer Pipeline

```
readRepoFile (base64) → atob → Uint8Array → Blob → createObjectURL → <model-viewer src={blobUrl}>
```

- Custom `src/types/model-viewer.d.ts` needed for JSX types
- Progress bar (not spinner) using model-viewer progress events
- WebGL context loss: listen on shadow DOM canvas, show retry button
- Cleanup blob URL on unmount

### 9. Diff-to-Markdown Toggle

- Segmented control in DiffBlade's existing internal toolbar (after inline/side-by-side toggle)
- Only visible for `.md`/`.mdx` files
- `useState(false)` — no persistence, always defaults to diff view
- Lazy-load `MarkdownRenderer` inside DiffBlade for optimal code splitting

### 10. Accessibility Requirements (WCAG 2.1 AA)

- ARIA live region in `BladeContainer` for blade transition announcements
- Repo browser: `role="listbox"`, arrow key navigation, `aria-current="page"` on breadcrumbs
- Markdown: `tabIndex={-1}` on container for focus management after link navigation
- 3D viewer: `alt` attribute, `aria-busy` during loading, `role="alert"` on failure
- Color: Use `text-ctp-overlay1` minimum for meaningful text (overlay0 is borderline)

### 11. Bundle Size Impact

| Blade | Additional JS (gzipped) | Loaded When |
|-------|------------------------|-------------|
| viewer-markdown | ~70KB | User opens .md file |
| viewer-3d | ~500KB | User opens .glb/.gltf |
| viewer-code | ~5KB | User opens text file from browser |
| gitflow-cheatsheet | ~2KB | User opens cheatsheet |
| repo-browser | ~3KB | User opens browser |

All lazy-loaded — **zero impact on initial load**.

---

## Existing Infrastructure (from Phase 20/20.1)

- Blade registry: `BladePropsMap` → `registerBlade()` → `BladeRenderer` → `BladeErrorBoundary` + `Suspense`
- Rust commands: `listRepoFiles(path)` and `readRepoFile(filePath)` — read from HEAD, binary detection, base64 for binary
- Tauri opener: `openUrl()` from `@tauri-apps/plugin-opener` — already configured
- Monaco: CDN-loaded, `"flowforge-dark"` theme in `monacoTheme.ts`
- Placeholder blade components exist for all 4 Phase 22 blade types
- Lazy loading via `React.lazy()` in registration files — Vite auto-splits

---

## RESEARCH COMPLETE
