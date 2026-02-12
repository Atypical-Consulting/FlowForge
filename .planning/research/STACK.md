# Technology Stack

**Project:** FlowForge v1.8.0 -- Enhanced UX (Diff Viewer, Conflict Resolution, Git Insights, Workspace Layouts, Author Avatars, Commit Heatmaps)
**Researched:** 2026-02-12

## Scope

This document covers ONLY the stack additions/changes needed for:
1. Collapsible diff regions and word-level diff highlighting
2. Line-level staging (hunk selection)
3. Three-way merge conflict resolution
4. Commit activity charts and contributor breakdown
5. Workspace layout presets and focus mode
6. Author avatars from Gravatar/GitHub
7. Commit heat map visualization

Existing stack is validated and unchanged: Tauri 2.x, React 19, TypeScript 5.9, Tailwind v4, Catppuccin, XState v5, Zustand 5, React Query v5, Monaco Editor 0.55.1, @monaco-editor/react 4.7.0, framer-motion, react-resizable-panels 4.6.2, react-virtuoso, lucide-react, react-hotkeys-hook, class-variance-authority, @xyflow/react, dagre-d3-es, three.js.

---

## Recommended Stack Additions

### 1. Collapsible Diff Regions -- NO NEW DEPENDENCY

**What:** Collapsible unchanged regions in the diff viewer, so large files show only changed hunks with expandable context.

**Why no dependency:** Monaco Editor 0.55.1 (already installed) has built-in `hideUnchangedRegions` support on the DiffEditor. Verified directly from `node_modules/monaco-editor/monaco.d.ts` lines 4097-4102:

```typescript
hideUnchangedRegions?: {
  enabled?: boolean;
  revealLineCount?: number;    // Lines shown when expanding
  minimumLineCount?: number;   // Minimum unchanged lines before collapsing
  contextLineCount?: number;   // Context lines shown around changes
};
```

**Integration:** Add these options to the existing `MONACO_COMMON_OPTIONS` in `src/core/lib/monacoConfig.ts` and pass them to the DiffEditor in `DiffBlade.tsx`. The existing DiffBlade already uses `@monaco-editor/react`'s `DiffEditor` component with an `options` prop -- just extend the options object.

**Confidence:** HIGH -- verified from installed `monaco-editor@0.55.1` type definitions.

---

### 2. Word-Level Diff Highlighting -- NO NEW DEPENDENCY

**What:** Character/word-level inline highlighting within changed lines (showing exactly which words changed, not just which lines).

**Why no dependency:** Monaco Editor 0.55.1's DiffEditor already renders word-level (character-level) diff highlighting by default when using the `'advanced'` diff algorithm. The installed version supports:

```typescript
diffAlgorithm?: 'legacy' | 'advanced';  // 'advanced' enables word-level diffs
experimental?: {
  showMoves?: boolean;           // Highlight moved code blocks
  showEmptyDecorations?: boolean;
  useTrueInlineView?: boolean;   // Tighter inline rendering
};
```

**Integration:** Set `diffAlgorithm: 'advanced'` in the DiffEditor options. The `experimental.showMoves` option adds visual indicators for code that was moved rather than added/deleted. The existing `monacoTheme.ts` already defines `diffEditor.insertedTextBackground` and `diffEditor.removedTextBackground` colors with Catppuccin tokens for word-level highlighting.

For custom word-level highlighting beyond Monaco's built-in diff (e.g., in a custom diff viewer), Monaco's `createDecorationsCollection` API with `inlineClassName` can apply CSS classes to specific character ranges. No external diff library needed.

**Confidence:** HIGH -- verified from installed type definitions and existing theme configuration.

---

### 3. Line-Level Staging (Hunk Selection) -- NO NEW FRONTEND DEPENDENCY (Rust backend work required)

**What:** Allow users to stage individual hunks or line ranges, not just whole files.

**Why no frontend dependency:** The frontend already has:
- DiffEditor with full `DiffHunk` data (`oldStart`, `oldLines`, `newStart`, `newLines`, `header`) from the Rust backend
- Monaco's `glyphMarginClassName` and `marginClassName` decorations for adding clickable stage/unstage buttons per hunk
- Monaco's `createDecorationsCollection` API for selectable line ranges

**Backend requirement:** The Rust backend currently only has `stage_file` and `unstage_file` commands. Hunk-level staging requires new Tauri commands:
- `stage_hunk(path, hunk_index)` -- stage a specific hunk using `git2`'s `Diff::foreach` with line callbacks
- `stage_lines(path, start_line, end_line)` -- stage specific line ranges by constructing a partial patch

The `git2` crate supports this through `Repository::apply()` with a custom `Diff` object containing only the selected hunks. The existing `DiffHunk` struct in `src-tauri/src/git/diff.rs` already captures the hunk boundaries needed.

**Frontend integration approach:**
1. Add glyph margin decorations to the DiffEditor's modified editor via `onMount` callback
2. Use Monaco's `editor.onMouseDown` to detect clicks on hunk margin decorations
3. Call new Tauri commands via the generated bindings

**Confidence:** HIGH for frontend (verified Monaco APIs), MEDIUM for backend (git2 patch application approach needs implementation verification).

---

### 4. Three-Way Merge Conflict Resolution -- NO NEW DEPENDENCY

**What:** Visual three-pane merge editor showing base, ours, theirs, and an editable result pane.

**Why no dependency:** Monaco Editor does NOT have a built-in three-way merge component (confirmed via GitHub issue [#3268](https://github.com/microsoft/monaco-editor/issues/3268)). However, the approach is to compose multiple Monaco Editor instances:

**Architecture:**
```
+------------------+------------------+
|  Ours (readonly) | Theirs (readonly)|
+------------------+------------------+
|        Result (editable)            |
+-------------------------------------+
```

- Three `Editor` instances from `@monaco-editor/react` (already installed)
- Decorations API for conflict region highlighting (markers for `<<<<<<<`, `=======`, `>>>>>>>`)
- `react-resizable-panels` (already installed, v4.6.2) for the split pane layout
- Custom conflict resolution logic: parse conflict markers, present choices, write result

**Backend requirement:** New Tauri commands needed:
- `get_conflict_file(path)` -- return the three versions (base, ours, theirs) using `git2::Index::conflicts()`
- `resolve_conflict(path, resolution)` -- write the resolved content and mark the conflict as resolved via `git2::Index::add_path()`

The existing `mergeMachine.ts` (XState) already handles the `idle -> merging -> conflicted` flow and stores `conflicts: string[]`. The new UI extends the `conflicted` state with a resolution workflow.

**Confidence:** HIGH for the approach, MEDIUM for implementation complexity (three-pane sync is non-trivial).

---

### 5. Commit Activity Charts -- @visx/shape + @visx/scale + @visx/axis + @visx/group

**What:** Commit frequency bar charts, contributor breakdown pie/donut charts, code change area charts.

**Why visx:** Use `@visx` (by Airbnb) because:
- Tree-shakable: import only the packages you need, keeping bundle size minimal (~5-15KB per package gzipped)
- Low-level D3 primitives wrapped in React components -- fits FlowForge's custom UI approach
- SVG-based rendering matches existing topology panel (which uses inline SVGs)
- No runtime CSS dependencies -- styles via Tailwind classes on SVG elements
- Actively maintained (latest releases in 2024-2025)

**Why NOT Recharts/Nivo/Chart.js:**
- Recharts: Higher-level API with opinionated styling, harder to match Catppuccin theme
- Nivo: Large dependency tree, heavier bundle, more than needed for simple charts
- Chart.js: Canvas-based, doesn't match SVG approach used elsewhere in FlowForge

**Required packages:**

| Package | Purpose | Approx Size (gzipped) |
|---------|---------|----------------------|
| `@visx/shape` | Bar, Line, Area, Pie components | ~5KB |
| `@visx/scale` | D3 scale wrappers (linear, band, ordinal) | ~3KB |
| `@visx/axis` | Axis rendering for time/value axes | ~4KB |
| `@visx/group` | SVG `<g>` wrapper with transform helpers | ~1KB |
| `@visx/tooltip` | Hover tooltips for data points | ~3KB |
| `@visx/responsive` | `ParentSize` wrapper for responsive charts | ~2KB |

**Total estimated addition:** ~18KB gzipped (tree-shaken).

**Integration:** Charts render in a new "Insights" blade/tab. Data comes from the existing `getCommitHistory` command which already returns `authorName`, `authorEmail`, `timestampMs` per commit. Aggregation (group by day/week, count per author) happens client-side in React Query select transforms.

**Confidence:** MEDIUM -- visx API verified via official docs and npm, but exact bundle sizes are estimates based on bundlephobia data from earlier versions.

---

### 6. Commit Heat Map -- @visx/heatmap (OR custom SVG)

**What:** GitHub-style contribution calendar showing commit density per day over the past year.

**Two approaches considered:**

**Option A: `@visx/heatmap` (RECOMMENDED)**
- Consistent with the visx stack used for other charts
- Provides `HeatmapRect` and `HeatmapCircle` components
- Requires `@visx/scale` (already added above) for color scaling
- ~4KB gzipped additional

**Option B: `react-calendar-heatmap`**
- Purpose-built GitHub contribution graph clone
- Simpler API but introduces a separate styling system
- Hasn't been updated frequently
- Would be an additional styling paradigm to maintain

**Recommendation:** Use `@visx/heatmap` because it shares the visx ecosystem with the activity charts, uses SVG primitives that can be styled with Catppuccin colors directly, and avoids introducing a one-off dependency.

**Integration:** Renders in the Insights blade alongside activity charts. Data source is the same `getCommitHistory` aggregated by date.

**Confidence:** MEDIUM -- visx heatmap API verified via npm docs.

---

### 7. Workspace Layout Presets and Focus Mode -- NO NEW DEPENDENCY

**What:** Save/restore panel layout configurations (e.g., "Review Mode" with wide diff, "Commit Mode" with wide staging panel), plus a "Focus Mode" that collapses sidebar.

**Why no dependency:** `react-resizable-panels` v4.6.2 (already installed) exposes a full imperative API:

```typescript
// From installed react-resizable-panels type definitions:
groupRef: {
  getLayout: () => { [panelId: string]: string };
  setLayout: (layout: { [panelId: string]: string }, units?: "percentages" | "pixels") => void;
};
```

**Integration:**
1. Create a `WorkspacePreset` type: `{ id: string; name: string; layout: Record<string, string> }`
2. Store presets in the existing `@tauri-apps/plugin-store` (already used for settings via `settings.slice.ts`)
3. Add a `workspace` section to the existing `Settings` interface in `settings.slice.ts`
4. Use `useRef<ImperativePanelGroupHandle>()` on the `Group` component in `ResizablePanelLayout.tsx`
5. Focus mode = `setLayout({ sidebar: "0%", blades: "100%" })` with a toggle hotkey

The existing `RepositoryView.tsx` already uses `ResizablePanelLayout` with `autoSaveId="repo-layout"` and named panels (`sidebar`, `blades`). The imperative API hooks directly into this.

**Confidence:** HIGH -- imperative API verified from installed type definitions.

---

### 8. Author Avatars from Gravatar/GitHub -- NO NEW DEPENDENCY

**What:** Show author avatars next to commits in the history list and insights dashboard.

**Why no dependency:**
- Gravatar URLs are deterministic: `https://www.gravatar.com/avatar/{SHA256_HASH}?s={SIZE}&d=identicon`
- SHA-256 hashing is built into the browser's Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`)
- No need for `md5` or any hashing library -- Gravatar now supports SHA-256 (preferred over MD5)
- The existing `UserAvatar` component in `src/extensions/github/components/UserAvatar.tsx` already handles image loading with fallback to initials

**Integration:**
1. Create a `useGravatarUrl(email: string, size?: number)` hook:
   ```typescript
   async function gravatarUrl(email: string, size = 40): Promise<string> {
     const normalized = email.trim().toLowerCase();
     const msgBuffer = new TextEncoder().encode(normalized);
     const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
     const hashArray = Array.from(new Uint8Array(hashBuffer));
     const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
     return `https://www.gravatar.com/avatar/${hashHex}?s=${size}&d=identicon`;
   }
   ```
2. The existing `CommitSummary` type already includes `authorEmail` -- no backend changes needed
3. Reuse/generalize the `UserAvatar` component from the GitHub extension (move to core or create a shared variant)

**For GitHub avatars:** The existing GitHub extension already fetches `authorAvatarUrl` for PR/Issue authors. For commits by GitHub users, the GitHub API can resolve email-to-avatar, but Gravatar is simpler and works offline (with cached images).

**Confidence:** HIGH -- Web Crypto API is universally available, Gravatar API is stable and documented.

---

## Summary: What to Install

### New npm Dependencies

```bash
# Charting (visx packages -- tree-shakable, only import what you use)
npm install @visx/shape @visx/scale @visx/axis @visx/group @visx/tooltip @visx/responsive @visx/heatmap
```

**That's it.** Seven `@visx/*` packages for charting and heatmaps. Everything else uses existing dependencies or built-in browser/Monaco APIs.

### New Rust/Backend Work (no new crates)

The `git2` crate (already a dependency) provides all the primitives needed:

| Feature | Backend Command Needed | git2 API |
|---------|----------------------|----------|
| Hunk staging | `stage_hunk(path, hunk_index)` | `Repository::apply()` with constructed `Diff` |
| Line staging | `stage_lines(path, start, end)` | Construct partial patch, apply to index |
| Conflict file retrieval | `get_conflict_file(path)` | `Index::conflicts()`, `Index::get_path(_, stage)` |
| Conflict resolution | `resolve_conflict(path, content)` | Write file + `Index::add_path()` + `Index::write()` |
| Commit stats aggregation | (optional) `get_commit_stats(since, until)` | `Revwalk` + `Commit` iteration (already used by `get_commit_history`) |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Charting | @visx/* (7 packages) | Recharts | Recharts is higher-level with opinionated styling; harder to match Catppuccin; larger footprint for what we need |
| Charting | @visx/* | Nivo | Heavy dependency tree (~200KB+); more chart types than needed; runtime CSS |
| Charting | @visx/* | Chart.js + react-chartjs-2 | Canvas-based (FlowForge uses SVG everywhere else); doesn't compose with React as cleanly |
| Heatmap | @visx/heatmap | react-calendar-heatmap | Separate styling system; introduces a one-off dependency outside the visx ecosystem |
| Word diff | Monaco built-in | diff-match-patch | Monaco already handles character-level diff highlighting in its DiffEditor; adding diff-match-patch would duplicate functionality |
| Merge editor | 3x Monaco Editor instances | CodeMirror merge view | Would introduce an entirely new editor alongside Monaco; massive duplication |
| Avatars | Web Crypto SHA-256 | md5 npm package | MD5 is deprecated by Gravatar; Web Crypto is built-in and more secure |
| Layout presets | react-resizable-panels imperative API | Custom CSS layout system | Already using react-resizable-panels; its imperative API does exactly what we need |
| Hunk staging backend | git2 Repository::apply() | Shell out to `git add -p` | git2 is already used; shelling out is fragile and platform-dependent |

---

## What NOT to Add

| Library | Reason to Skip |
|---------|---------------|
| `diff-match-patch` | Monaco DiffEditor handles word-level diffs natively with `diffAlgorithm: 'advanced'` |
| `md5` | Gravatar supports SHA-256; browser Web Crypto API handles hashing |
| `react-calendar-heatmap` | @visx/heatmap covers this within the visx ecosystem |
| `recharts` / `nivo` / `chart.js` | @visx is lighter and more composable for our needs |
| `@radix-ui/react-tooltip` | @visx/tooltip handles chart tooltips; existing custom tooltips cover the rest |
| Any CSS-in-JS library | Tailwind v4 handles all styling; visx works with inline styles on SVG elements |
| `codemirror` / `@codemirror/merge` | Would duplicate Monaco Editor; use multiple Monaco instances instead |

---

## Version Matrix

| Package | Version to Install | React 19 Compatible | Notes |
|---------|-------------------|---------------------|-------|
| `@visx/shape` | `^3.12` | Yes | Peer dep: react >=16 |
| `@visx/scale` | `^3.12` | Yes | Wrapper around d3-scale |
| `@visx/axis` | `^3.12` | Yes | Depends on @visx/scale |
| `@visx/group` | `^3.12` | Yes | Minimal SVG helper |
| `@visx/tooltip` | `^3.12` | Yes | Portal-based tooltips |
| `@visx/responsive` | `^3.12` | Yes | ParentSize observer |
| `@visx/heatmap` | `^3.12` | Yes | HeatmapRect/Circle |

All `@visx` packages use the same version scheme (`3.x`). Pin to `^3.12` for consistency.

---

## Integration Points with Existing Stack

| Existing Component | How New Features Connect |
|-------------------|-------------------------|
| `monacoConfig.ts` | Add `hideUnchangedRegions`, `diffAlgorithm: 'advanced'`, `experimental.showMoves` options |
| `monacoTheme.ts` | Already has Catppuccin diff colors; no changes needed |
| `DiffBlade.tsx` | Pass enhanced options to DiffEditor; add hunk staging UI via glyph margin decorations |
| `InlineDiffViewer.tsx` | Same enhanced options for the inline preview |
| `mergeMachine.ts` | Extend `conflicted` state with resolution sub-states (`reviewing`, `resolving`, `resolved`) |
| `settings.slice.ts` | Add `workspace: { presets: WorkspacePreset[], activePreset: string | null }` to Settings |
| `ResizablePanelLayout.tsx` | Expose `groupRef` for imperative `setLayout` calls; add preset selector UI |
| `RepositoryView.tsx` | Wire up workspace preset controls; add focus mode toggle |
| `CommitHistory.tsx` | Add Gravatar avatars next to commit entries; data already has `authorEmail` |
| `StagingChangesBlade.tsx` | Hunk-level staging controls in the diff preview area |
| `UserAvatar.tsx` (GitHub ext) | Generalize to core `AuthorAvatar` component that handles both GitHub URLs and Gravatar |
| Topology panel | Commit heatmap can share the same data pipeline as the commit graph |

---

## Sources

- Monaco Editor 0.55.1 type definitions: `node_modules/monaco-editor/monaco.d.ts` (local, verified)
- [Monaco Editor IDiffEditorBaseOptions API](https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IDiffEditorBaseOptions.html)
- [Monaco Editor 3-way merge feature request #3268](https://github.com/microsoft/monaco-editor/issues/3268)
- [Monaco Editor hideUnchangedRegions issue #4196](https://github.com/microsoft/monaco-editor/issues/4196)
- [visx GitHub repository](https://github.com/airbnb/visx)
- [@visx/heatmap on npm](https://www.npmjs.com/package/@visx/heatmap)
- [react-resizable-panels imperative API](https://react-resizable-panels.vercel.app/examples/imperative-panel-group-api)
- [Gravatar SHA-256 hashing documentation](https://docs.gravatar.com/rest/hash/)
- [Web Crypto API for SHA-256](https://coolaj86.com/articles/hashing-with-the-web-crypto-api.html)
- [Git interactive staging](https://git-scm.com/book/en/v2/Git-Tools-Interactive-Staging)
- react-resizable-panels v4.6.2 type definitions: `node_modules/react-resizable-panels/dist/react-resizable-panels.d.ts` (local, verified)
