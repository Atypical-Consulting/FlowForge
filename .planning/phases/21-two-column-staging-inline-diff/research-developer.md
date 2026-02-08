# Phase 21 Developer Research: Two-Column Staging & Inline Diff

> Researcher: Expert Developer (Tauri v2 / React / Tailwind v4)
> Date: 2026-02-07
> Scope: Implementation details, technical patterns, code-level recommendations

---

## 1. Current Implementation Deep-Dive

### 1.1 Staging Component Architecture

The staging blade is a thin shell. All the logic lives in `StagingPanel`.

**`/src/components/blades/StagingChangesBlade.tsx`** (7 lines):
```tsx
export function StagingChangesBlade() {
  const { openStagingDiff } = useBladeNavigation();
  return <StagingPanel onFileSelect={openStagingDiff} />;
}
```

Registered at **`/src/components/blades/registrations/staging-changes.ts`**:
```ts
registerBlade({
  type: "staging-changes",
  defaultTitle: "Changes",
  component: StagingChangesBlade,
  wrapInPanel: false,   // <-- No BladePanel wrapper (no title bar)
  showBack: false,       // <-- No back button (root blade)
});
```

**Key observation:** `wrapInPanel: false` means the staging blade takes full control of its layout. This is exactly what we need -- the two-column layout will replace the content of this blade without needing to change the blade registration mechanism.

**`/src/components/staging/StagingPanel.tsx`** (268 lines):
- Uses `@tanstack/react-query` with `queryKey: ["stagingStatus"]` and `refetchInterval: 2000` (polls every 2s)
- Mutations: `stageAllMutation`, `unstageAllMutation`, `stageFolderMutation`, `unstageFolderMutation`
- Auto-select first file in `useEffect` (lines 62-74) -- this already exists and matches our Phase 21 requirement
- Renders either `FileTreeView` (tree mode) or `FileList` (flat mode)
- Each file section has header with count badge and "Stage All" / "Unstage All" button
- `onFileSelect` callback is passed down through all views to `FileItem`
- Currently: `onFileSelect` triggers `openStagingDiff()` which pushes a new blade (navigates away)

**`/src/components/staging/FileItem.tsx`** (124 lines):
- Selection state: `useStagingStore().selectedFile` compared by `file.path`
- Visual selection: `bg-ctp-blue/20 border-l-2 border-ctp-blue`
- On click: calls `selectFile(file, section)` on store, then `onFileSelect?.(file, section)`
- Stage/unstage button: hidden by default, shown on hover (`opacity-0 group-hover:opacity-100`)
- Status dot: color-coded circle overlay on the file type icon

**`/src/stores/staging.ts`** (24 lines):
```ts
interface StagingState {
  selectedFile: FileChange | null;
  selectedSection: "staged" | "unstaged" | "untracked" | null;
  viewMode: ViewMode;  // "tree" | "flat"
  selectFile: (file, section?) => void;
  setViewMode: (mode) => void;
}
```

**Important:** The store already tracks `selectedFile` and `selectedSection`. Phase 21 only needs to extend this with scroll position preservation for the expand/collapse flow.

### 1.2 DiffBlade & Monaco DiffEditor Integration

**`/src/components/blades/DiffBlade.tsx`** (126 lines):

```tsx
export type DiffSource =
  | { mode: "commit"; oid: string; filePath: string }
  | { mode: "staging"; filePath: string; staged: boolean };
```

Key Monaco configuration (lines 100-122):
```tsx
<DiffEditor
  original={diff.oldContent}
  modified={diff.newContent}
  language={diff.language}
  theme="flowforge-dark"
  options={{
    readOnly: true,
    renderSideBySide: !inline,
    originalEditable: false,
    automaticLayout: true,       // <-- Auto-resize on container change
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: "on",
    folding: true,
    wordWrap: "off",
    renderLineHighlight: "all",
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  }}
/>
```

The `@monaco-editor/react` package (v4.7.0) provides the `DiffEditor` component. The import on line 1: `import { DiffEditor } from "@monaco-editor/react"`.

**Diff data flow (staging mode):**
1. `DiffBlade` receives `source: { mode: "staging", filePath, staged }` as prop
2. `useQuery` calls `commands.getFileDiff(filePath, staged, contextLines=3)`
3. Tauri IPC invokes `get_file_diff` in Rust
4. Rust returns `FileDiff { path, oldContent, newContent, hunks, isBinary, language }`
5. Monaco receives `original` (old) and `modified` (new) as full file contents

**Critical for inline preview:** The query key is `["fileDiff", filePath, staged, contextLines]`. This means we can reuse the same cache when switching from inline to full-blade view. The `staleTime` for staging diffs is `undefined` (defaults to 0), so it re-fetches on mount. For inline preview, this is fine because the staging status already polls every 2s.

### 1.3 Monaco Theme Integration

**`/src/lib/monacoTheme.ts`** (53 lines):
- Custom `flowforge-dark` theme based on `vs-dark`
- Catppuccin Mocha color values hardcoded as hex (Monaco cannot use CSS vars)
- Diff-specific colors already defined:
  ```ts
  "diffEditor.insertedTextBackground": "#a6e3a120",
  "diffEditor.removedTextBackground": "#f38ba820",
  "diffEditor.insertedLineBackground": "#a6e3a115",
  "diffEditor.removedLineBackground": "#f38ba815",
  "diffEditorGutter.insertedLineBackground": "#a6e3a130",
  "diffEditorGutter.removedLineBackground": "#f38ba830",
  ```
- Theme is loaded once on import via `loader.init().then(...)` pattern
- Monaco CDN: `https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs`

### 1.4 ResizablePanel Implementation

**`/src/components/layout/ResizablePanelLayout.tsx`** (69 lines):

Uses `react-resizable-panels` v4.6.0 (already a dependency). The library exports `Group`, `Panel`, `Separator`.

```tsx
// Wrapper components:
ResizablePanelLayout  -> Group (with id, orientation)
ResizablePanel        -> Panel (with defaultSize, minSize, maxSize as percentage strings)
ResizeHandle          -> Separator (styled as w-1 draggable bar)
```

**Existing usage** in `/src/components/RepositoryView.tsx` (lines 43-166):
```tsx
<ResizablePanelLayout autoSaveId="repo-layout" direction="horizontal">
  <ResizablePanel id="sidebar" defaultSize={20} minSize={15} maxSize={30}>
    {/* Left sidebar content */}
  </ResizablePanel>
  <ResizeHandle />
  <ResizablePanel id="blades" defaultSize={80}>
    <BladeContainer />
  </ResizablePanel>
</ResizablePanelLayout>
```

**ResizeHandle styling:**
```tsx
<Separator
  className={cn(
    "w-1 bg-ctp-surface0 transition-colors cursor-col-resize",
    "data-[separator='hover']:bg-ctp-blue data-[separator='active']:bg-ctp-blue",
    className,
  )}
/>
```

Note: The `data-[separator=...]` attributes are how `react-resizable-panels` exposes hover/active states. The `autoSaveId` prop persists panel sizes to localStorage.

**For Phase 21:** We can nest another `ResizablePanelLayout` inside `StagingChangesBlade` with `autoSaveId="staging-split"`. This gives us persistent sizing for free.

### 1.5 Blade Navigation Pattern

**`/src/hooks/useBladeNavigation.ts`** (102 lines):

The `openStagingDiff` function (lines 71-89) currently:
1. Determines blade type from file extension (`bladeTypeForFile`)
2. For text files: pushes a `diff` blade with `{ source: { mode: "staging", filePath, staged } }`
3. For images: pushes a `viewer-image` blade
4. For other specializations: pushes appropriate viewer blade

**For Phase 21:** The inline diff panel will NOT call `openStagingDiff` (which pushes a blade). Instead, it will directly render a diff component. The "expand" button WILL call `openStagingDiff` to push the full blade.

**Blade Stack Model** (`/src/stores/blades.ts`):
- `bladeStack: TypedBlade[]` -- last element is the active (visible) blade
- `pushBlade` -- adds to stack, old blades show as strips on the left
- `popBlade` -- removes top blade, reveals previous
- `popToIndex` -- truncates stack to given index

**`/src/components/blades/BladeContainer.tsx`** (33 lines):
- Collapsed blades render as `BladeStrip` (10px-wide vertical strips with title)
- Active blade renders via `BladeRenderer` with `AnimatePresence` slide animation

### 1.6 Tailwind v4 Theme Configuration

**`/src/index.css`** (90 lines):
```css
@import "tailwindcss";
@import "@catppuccin/tailwindcss/mocha.css";

@theme {
    --font-sans: "Geist Variable", system-ui, ...;
    --font-mono: "JetBrains Mono Variable", ui-monospace, ...;
    --animate-dirty-pulse: dirty-pulse 2s ease-in-out infinite;
}
```

Custom animations are registered in the `@theme {}` block. To add new animations for Phase 21, we would add entries here.

CSS custom properties for Catppuccin are available as `--ctp-*` in both CSS and as `ctp-*` Tailwind utility classes (e.g., `bg-ctp-surface0`, `text-ctp-blue`).

### 1.7 Rust Backend: Diff Commands

**`/src-tauri/src/git/diff.rs`** (456 lines):

Two Tauri commands available:

1. **`get_file_diff(path, staged, context_lines)`** -- For staging diffs
   - Staged: compares HEAD tree to index
   - Unstaged: compares index to workdir
   - Returns full `FileDiff` with `oldContent`, `newContent`, `hunks`, `isBinary`, `language`

2. **`get_commit_file_diff(oid, path, context_lines)`** -- For commit diffs
   - Compares parent commit tree to the commit tree

Both operate on a single file path. There is no "batch diff" command, and none is needed. Each file diff is fetched independently and cached by React Query.

**Performance consideration:** `get_file_diff` opens the repo and reads the file content each time. For rapid file switching (keyboard navigation), we should rely on React Query's cache. With `staleTime: 0` (current default), re-fetching on each file switch is fine since it is a single file operation.

**No new Rust commands needed.** The existing `get_file_diff` command already supports the exact per-file diff we need for inline preview.

---

## 2. Monaco DiffEditor in Split Pane

### 2.1 automaticLayout Behavior

The `automaticLayout: true` option (already used in `DiffBlade`) uses a `ResizeObserver` internally to track container size changes. When the split pane resizes:
- Monaco detects the container width change via ResizeObserver
- Re-layouts within ~16ms (next animation frame)
- No manual `editor.layout()` call needed

This means dragging the resize handle will work smoothly with Monaco out of the box.

### 2.2 Configuration for Inline Preview

For the inline (constrained) preview, I recommend a subset of the current DiffBlade options:

```tsx
const INLINE_DIFF_OPTIONS: editor.IDiffEditorConstructionOptions = {
  readOnly: true,
  originalEditable: false,
  renderSideBySide: false,     // Always inline in the preview pane
  automaticLayout: true,
  scrollBeyondLastLine: false,
  minimap: { enabled: false },
  fontSize: 12,                 // Slightly smaller for constrained width
  lineNumbers: "on",
  folding: false,               // Save horizontal space
  wordWrap: "on",               // IMPORTANT: enable for narrow panels
  renderLineHighlight: "none",  // Less visual noise in preview
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
  overviewRulerBorder: false,
  renderOverviewRuler: false,   // Save space
  glyphMargin: false,           // Save horizontal space
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 3,
};
```

Key difference from full DiffBlade: `wordWrap: "on"` and `renderSideBySide: false` (always inline). No side-by-side toggle in the inline preview. Full blade retains the toggle.

### 2.3 Mount/Unmount vs Hide/Show Strategy

**Recommendation: Unmount and remount on file switch, but keep a single instance alive.**

Reasoning:
- Monaco DiffEditor is expensive to create (~50-100ms initial mount, ~150ms with CDN fetch)
- BUT: `@monaco-editor/react`'s `DiffEditor` component already handles model swapping efficiently
- When `original` and `modified` props change, the component updates models without destroying the editor
- The real cost is the initial mount; subsequent prop changes are cheap

**Strategy:**
1. Mount Monaco DiffEditor once when the first file is selected
2. Update `original`/`modified`/`language` props when selected file changes
3. Monaco swaps models internally (fast, ~5ms)
4. Only unmount when blade is destroyed

The React Query cache ensures diff data is available instantly for previously-viewed files.

### 2.4 Performance Budget

- File list: Up to ~500 files (rare but possible in large repos). Current implementation renders all items. Consider virtualizing in Phase 22 if needed.
- Monaco: Single instance, model-swapping. Memory: ~10MB for the editor + ~1MB per open model pair. Acceptable.
- Split pane resize: CSS-only, no JS layout calculations. Smooth.

---

## 3. Tailwind v4 Implementation Details

### 3.1 Two-Column Layout with react-resizable-panels

The split pane uses the existing `react-resizable-panels` library. No CSS Grid or custom Flexbox needed.

```tsx
<ResizablePanelLayout autoSaveId="staging-split" direction="horizontal">
  <ResizablePanel id="staging-files" defaultSize={40} minSize={20} maxSize={60}>
    {/* File list panel */}
  </ResizablePanel>
  <ResizeHandle />
  <ResizablePanel id="staging-diff" defaultSize={60} minSize={30}>
    {/* Diff preview panel */}
  </ResizablePanel>
</ResizablePanelLayout>
```

This nests inside the existing blade system. The outer `ResizablePanelLayout` (repo-layout) manages sidebar vs blades. The inner one manages file-list vs diff-preview.

### 3.2 ResizeHandle Styling

Reuse the existing `ResizeHandle` component from `/src/components/layout/ResizablePanelLayout.tsx`. It already uses Catppuccin tokens:
- Default: `bg-ctp-surface0`
- Hover: `bg-ctp-blue` (via `data-[separator='hover']`)
- Active/dragging: `bg-ctp-blue` (via `data-[separator='active']`)

### 3.3 Min-Width Constraints

In `react-resizable-panels`, min/max sizes are percentages. With the existing wrapper:

```tsx
<ResizablePanel id="staging-files" defaultSize={40} minSize={20} maxSize={60}>
```

This translates to `minSize="20%"` and `maxSize="60%"` via the existing conversion in `ResizablePanelLayout.tsx` (lines 41-44).

The blade container is roughly 80% of the window (the other 20% is the sidebar). If the window is 1440px, the blade area is ~1152px. A 20% minimum for the file list means ~230px, which is enough to show file names.

### 3.4 Proposed Tailwind Classes

**File list panel container:**
```
"flex flex-col h-full bg-ctp-base"
```

**Diff preview panel container:**
```
"flex flex-col h-full bg-ctp-crust"
```

**Diff panel header bar (with expand button):**
```
"flex items-center gap-2 px-3 py-1.5 border-b border-ctp-surface0 bg-ctp-crust shrink-0"
```

**Expand button:**
```
"p-1 rounded hover:bg-ctp-surface0 text-ctp-overlay1 hover:text-ctp-text transition-colors"
```

**Binary/image placeholder:**
```
"flex-1 flex flex-col items-center justify-center gap-3 bg-ctp-mantle"
```

---

## 4. Rust Backend Considerations

### 4.1 No New Commands Needed

The existing `get_file_diff(path, staged, context_lines)` command is exactly what the inline diff preview needs. It operates on a single file, which is the granularity we want.

The diff data already includes:
- `oldContent` / `newContent` -- full file contents for Monaco
- `isBinary` -- to show placeholder instead of Monaco
- `language` -- for syntax highlighting
- `hunks` -- not needed for Monaco (Monaco computes its own diff), but available

### 4.2 Caching Strategy

React Query handles caching on the frontend:
- Query key: `["fileDiff", filePath, staged, contextLines]`
- `staleTime: 0` (default) -- always refetches, but cache serves instantly during refetch
- For inline preview, consider `staleTime: 5000` (5s) to avoid redundant refetches when user is just browsing files

On the Rust side, no caching is needed. Each `get_file_diff` call is fast:
- Opens repo: ~1ms (already opened, just reopening the handle)
- Reads blob: ~1ms per file
- Computes diff: ~1-5ms depending on file size
- Total: ~5-10ms per file

### 4.3 Untracked Files

Untracked files have `staged: false` in the current model, but the diff behavior is different:
- Untracked files have no "old" content (they're new)
- The `get_file_diff` with `staged: false` for untracked files will show old content as empty string (from index, which doesn't have the file)
- The working directory content is the "new" content

This already works correctly. No special handling needed.

### 4.4 Binary File Detection

`FileDiff.isBinary` is set by the Rust backend when `delta.flags().is_binary()` is true. The `DiffBlade` already handles this:
```tsx
if (diff.isBinary) {
  return <div>Binary file - diff not available</div>;
}
```

For the inline preview, we need a more styled placeholder with a file type icon and "Binary file -- click to expand" text.

---

## 5. Keyboard Navigation Implementation

### 5.1 Current Keyboard Patterns

**`/src/hooks/useKeyboardShortcuts.ts`** uses `react-hotkeys-hook` v5.2.4:
```ts
useHotkeys("mod+shift+a", handler, { preventDefault: true, enabled: !!status });
```

Key patterns:
- `mod` = Cmd on Mac, Ctrl on Windows
- `enabled` flag for conditional activation
- `enableOnFormTags: false` to skip when focused on inputs

**Existing shortcuts:**
| Shortcut | Action |
|----------|--------|
| `mod+o` | Open repository |
| `mod+,` | Open settings |
| `mod+shift+a` | Stage all |
| `mod+shift+p` | Command palette |
| `escape` | Pop blade |
| `enter` | Open commit details (topology) |

### 5.2 Proposed File List Navigation Hook

Create a dedicated hook for file list keyboard navigation:

```tsx
// /src/hooks/useStagingKeyboard.ts

import { useHotkeys } from "react-hotkeys-hook";
import type { FileChange } from "../bindings";
import { useStagingStore } from "../stores/staging";

interface UseStagingKeyboardOptions {
  /** All files in display order (staged + unstaged + untracked) */
  allFiles: Array<{ file: FileChange; section: "staged" | "unstaged" | "untracked" }>;
  /** Whether the file list panel has focus */
  enabled: boolean;
  /** Callback when expand to full blade is triggered */
  onExpand?: () => void;
  /** Callback to stage/unstage the currently selected file */
  onToggleStage?: () => void;
}

export function useStagingKeyboard({
  allFiles,
  enabled,
  onExpand,
  onToggleStage,
}: UseStagingKeyboardOptions) {
  const { selectedFile, selectFile } = useStagingStore();

  const currentIndex = allFiles.findIndex(
    (item) => item.file.path === selectedFile?.path,
  );

  // Arrow Down - next file
  useHotkeys(
    "down",
    (e) => {
      e.preventDefault();
      if (currentIndex < allFiles.length - 1) {
        const next = allFiles[currentIndex + 1];
        selectFile(next.file, next.section);
      }
    },
    { enabled, enableOnFormTags: false },
    [currentIndex, allFiles],
  );

  // Arrow Up - previous file
  useHotkeys(
    "up",
    (e) => {
      e.preventDefault();
      if (currentIndex > 0) {
        const prev = allFiles[currentIndex - 1];
        selectFile(prev.file, prev.section);
      }
    },
    { enabled, enableOnFormTags: false },
    [currentIndex, allFiles],
  );

  // Enter - expand to full blade
  useHotkeys(
    "enter",
    (e) => {
      e.preventDefault();
      onExpand?.();
    },
    { enabled: enabled && !!selectedFile, enableOnFormTags: false },
    [selectedFile],
  );

  // Space - toggle stage/unstage
  useHotkeys(
    "space",
    (e) => {
      e.preventDefault();
      onToggleStage?.();
    },
    { enabled: enabled && !!selectedFile, enableOnFormTags: false },
    [selectedFile],
  );
}
```

### 5.3 Focus Management

The file list and diff preview are two distinct focus zones. When the file list is focused, arrow keys navigate files. When the diff preview is focused (user clicks into it), Monaco handles its own keyboard events.

**Strategy:**
- File list panel has `tabIndex={0}` and focus tracking via `onFocus`/`onBlur`
- A `useStagingKeyboard` hook is only `enabled` when the file list panel has focus
- `Tab` key moves focus from file list to diff preview and vice versa
- No conflict with global shortcuts (they use `mod+` modifiers, file nav uses plain arrow keys)

### 5.4 Key Binding Summary

| Key | Context | Action |
|-----|---------|--------|
| `ArrowUp` / `ArrowDown` | File list focused | Navigate files |
| `Enter` | File list focused, file selected | Expand to full diff blade |
| `Space` | File list focused, file selected | Stage/Unstage current file |
| `Escape` | Any | Pop blade (existing behavior) |
| `Tab` | File list focused | Move focus to diff panel |
| `Shift+Tab` | Diff panel focused | Move focus to file list |

---

## 6. Component Architecture & Extensibility

### 6.1 High-Level Component Tree

```
StagingChangesBlade
  |
  +-- StagingTwoColumnLayout (new)
       |
       +-- ResizablePanelLayout (autoSaveId="staging-split")
            |
            +-- ResizablePanel (40%, file list)
            |    |
            |    +-- StagingPanel (existing, modified to NOT call onFileSelect for blade push)
            |
            +-- ResizeHandle
            |
            +-- ResizablePanel (60%, diff preview)
                 |
                 +-- InlineDiffPanel (new)
                      |
                      +-- InlineDiffHeader (file name, expand button)
                      +-- InlineDiffContent (Monaco or placeholder)
```

### 6.2 New Component: `StagingTwoColumnLayout`

This replaces the current single-panel staging layout:

```tsx
// /src/components/staging/StagingTwoColumnLayout.tsx

import { Maximize2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { FileChange } from "../../bindings";
import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { useStagingStore } from "../../stores/staging";
import { ResizablePanelLayout, ResizablePanel, ResizeHandle } from "../layout";
import { InlineDiffPanel } from "./InlineDiffPanel";
import { StagingPanel } from "./StagingPanel";

export function StagingTwoColumnLayout() {
  const { selectedFile, selectedSection } = useStagingStore();
  const { openStagingDiff } = useBladeNavigation();

  // Handle file selection -- update store only, don't push blade
  const handleFileSelect = useCallback(
    (file: FileChange, section: "staged" | "unstaged" | "untracked") => {
      // File selection is handled by FileItem via useStagingStore.selectFile
      // No blade push here -- the inline diff panel reacts to store changes
    },
    [],
  );

  // Handle expand to full blade
  const handleExpand = useCallback(() => {
    if (selectedFile && selectedSection) {
      openStagingDiff(selectedFile, selectedSection);
    }
  }, [selectedFile, selectedSection, openStagingDiff]);

  return (
    <ResizablePanelLayout autoSaveId="staging-split" direction="horizontal">
      <ResizablePanel id="staging-files" defaultSize={40} minSize={20} maxSize={60}>
        <StagingPanel />  {/* No onFileSelect -- selection is store-driven */}
      </ResizablePanel>

      <ResizeHandle />

      <ResizablePanel id="staging-diff" defaultSize={60} minSize={30}>
        <InlineDiffPanel
          file={selectedFile}
          section={selectedSection}
          onExpand={handleExpand}
        />
      </ResizablePanel>
    </ResizablePanelLayout>
  );
}
```

### 6.3 New Component: `InlineDiffPanel`

```tsx
// /src/components/staging/InlineDiffPanel.tsx

import { DiffEditor } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { FileCode, Loader2, Maximize2 } from "lucide-react";
import type { FileChange } from "../../bindings";
import { commands } from "../../bindings";
import "../../lib/monacoTheme";
import { cn } from "../../lib/utils";
import { FileTypeIcon } from "../icons/FileTypeIcon";
import { Button } from "../ui/button";

// Inline-optimized Monaco options
const INLINE_DIFF_OPTIONS = {
  readOnly: true,
  originalEditable: false,
  renderSideBySide: false,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: "on",
  folding: false,
  wordWrap: "on",
  renderLineHighlight: "none",
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
  overviewRulerBorder: false,
  renderOverviewRuler: false,
  glyphMargin: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 3,
} as const;

interface InlineDiffPanelProps {
  file: FileChange | null;
  section: "staged" | "unstaged" | "untracked" | null;
  onExpand: () => void;
}

export function InlineDiffPanel({ file, section, onExpand }: InlineDiffPanelProps) {
  const staged = section === "staged";
  const contextLines = 3;

  const {
    data: result,
    isLoading,
  } = useQuery({
    queryKey: ["fileDiff", file?.path, staged, contextLines],
    queryFn: () => commands.getFileDiff(file!.path, staged, contextLines),
    enabled: !!file && isTextFile(file.path),
    staleTime: 5000, // 5s -- reduce refetches during keyboard navigation
  });

  // No file selected (shouldn't happen with auto-select, but defensive)
  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle text-ctp-overlay0 text-sm">
        Select a file to preview diff
      </div>
    );
  }

  // Non-text file placeholder
  if (!isTextFile(file.path)) {
    return (
      <div className="flex flex-col h-full">
        <InlineDiffHeader filePath={file.path} onExpand={onExpand} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-ctp-mantle">
          <FileTypeIcon path={file.path} className="w-10 h-10 text-ctp-overlay1" />
          <p className="text-sm text-ctp-overlay1">
            {isBinaryFile(file.path) ? "Binary file" : "Preview not available"}
          </p>
          <Button variant="outline" size="sm" onClick={onExpand}>
            <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
            Open in viewer
          </Button>
        </div>
      </div>
    );
  }

  const diff = result?.status === "ok" ? result.data : null;

  // Binary file detected by backend
  if (diff?.isBinary) {
    return (
      <div className="flex flex-col h-full">
        <InlineDiffHeader filePath={file.path} onExpand={onExpand} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-ctp-mantle">
          <FileTypeIcon path={file.path} className="w-10 h-10 text-ctp-overlay1" />
          <p className="text-sm text-ctp-overlay1">Binary file -- click to expand</p>
          <Button variant="outline" size="sm" onClick={onExpand}>
            <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
            Expand
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <InlineDiffHeader filePath={file.path} onExpand={onExpand} />
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full bg-ctp-mantle">
            <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
          </div>
        ) : diff ? (
          <DiffEditor
            original={diff.oldContent}
            modified={diff.newContent}
            language={diff.language}
            theme="flowforge-dark"
            options={INLINE_DIFF_OPTIONS}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-ctp-mantle text-ctp-red text-sm">
            Failed to load diff
          </div>
        )}
      </div>
    </div>
  );
}

function InlineDiffHeader({
  filePath,
  onExpand,
}: {
  filePath: string;
  onExpand: () => void;
}) {
  const lastSlash = filePath.lastIndexOf("/");
  const dir = lastSlash > -1 ? filePath.slice(0, lastSlash + 1) : "";
  const name = lastSlash > -1 ? filePath.slice(lastSlash + 1) : filePath;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
      <FileTypeIcon path={filePath} className="w-4 h-4 shrink-0" />
      <span className="text-sm truncate flex-1">
        {dir && <span className="text-ctp-overlay1">{dir}</span>}
        <span className="font-semibold text-ctp-text">{name}</span>
      </span>
      <button
        type="button"
        onClick={onExpand}
        className="p-1 rounded hover:bg-ctp-surface0 text-ctp-overlay1 hover:text-ctp-text transition-colors"
        title="Expand to full view"
        aria-label="Expand diff to full view"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// --- Utility functions ---

const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "json", "md", "mdx", "html", "css", "scss",
  "less", "py", "go", "java", "c", "h", "cpp", "hpp", "cc", "cxx", "cs",
  "rb", "php", "swift", "kt", "kts", "scala", "sql", "sh", "bash", "ps1",
  "yaml", "yml", "toml", "xml", "svg", "vue", "svelte", "graphql", "gql",
  "dockerfile", "makefile", "rs", "lua", "zig", "dart", "r", "m", "mm",
  "astro", "razor", "cshtml", "txt", "cfg", "ini", "env", "gitignore",
  "editorconfig", "prettierrc", "eslintrc",
]);

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp",
  "nupkg", "zip", "tar", "gz", "7z", "rar",
  "glb", "gltf", "obj", "fbx",
  "pdf", "doc", "docx", "xls", "xlsx",
  "mp3", "wav", "ogg", "mp4", "avi", "mov",
  "exe", "dll", "so", "dylib",
  "wasm", "woff", "woff2", "ttf", "otf", "eot",
]);

function getExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot > -1 ? path.slice(dot + 1).toLowerCase() : "";
}

function isTextFile(path: string): boolean {
  const ext = getExtension(path);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (BINARY_EXTENSIONS.has(ext)) return false;
  // If extension is unknown, assume text (Rust backend will detect binary)
  return true;
}

function isBinaryFile(path: string): boolean {
  return BINARY_EXTENSIONS.has(getExtension(path));
}
```

### 6.4 Modified `StagingChangesBlade`

```tsx
// /src/components/blades/StagingChangesBlade.tsx

import { StagingTwoColumnLayout } from "../staging/StagingTwoColumnLayout";

export function StagingChangesBlade() {
  return <StagingTwoColumnLayout />;
}
```

The blade becomes an even thinner wrapper.

### 6.5 Modified `StagingPanel` (Breaking Change Minimization)

The key change to `StagingPanel` is removing the `onFileSelect` callback from triggering a blade push. Instead, file selection is purely handled by the Zustand store.

**Minimal diff:**
- Remove the `onFileSelect` prop from `StagingPanel` interface
- FileItem already calls `selectFile()` on the store
- FileItem already calls `onFileSelect?.()` -- keep this for potential future use
- In `StagingTwoColumnLayout`, pass no `onFileSelect` -- or pass a no-op

Actually, the cleanest approach: **keep `onFileSelect` as optional** in `StagingPanel` (it already is). When it's not provided, clicking a file only updates the store (which the inline diff panel reacts to). When it's provided (like in the current code), it also triggers the callback.

No change needed to `StagingPanel.tsx` -- just don't pass `onFileSelect`. The auto-select logic already writes to the store.

### 6.6 Reusable `SplitPaneLayout` Pattern (Extensibility)

For future reuse (e.g., Phase 22 file browser + preview), extract a generic pattern:

```tsx
// /src/components/layout/SplitPaneLayout.tsx

import type { ReactNode } from "react";
import { ResizablePanelLayout, ResizablePanel, ResizeHandle } from "./ResizablePanelLayout";

interface SplitPaneLayoutProps {
  /** Unique ID for persisting panel sizes */
  autoSaveId: string;
  /** Left/list panel */
  listPanel: ReactNode;
  /** Right/preview panel */
  previewPanel: ReactNode;
  /** Default size of the list panel (percentage). Default: 40 */
  listDefaultSize?: number;
  /** Minimum size of the list panel (percentage). Default: 20 */
  listMinSize?: number;
  /** Maximum size of the list panel (percentage). Default: 60 */
  listMaxSize?: number;
}

export function SplitPaneLayout({
  autoSaveId,
  listPanel,
  previewPanel,
  listDefaultSize = 40,
  listMinSize = 20,
  listMaxSize = 60,
}: SplitPaneLayoutProps) {
  return (
    <ResizablePanelLayout autoSaveId={autoSaveId} direction="horizontal">
      <ResizablePanel
        id={`${autoSaveId}-list`}
        defaultSize={listDefaultSize}
        minSize={listMinSize}
        maxSize={listMaxSize}
      >
        {listPanel}
      </ResizablePanel>
      <ResizeHandle />
      <ResizablePanel
        id={`${autoSaveId}-preview`}
        defaultSize={100 - listDefaultSize}
        minSize={100 - listMaxSize}
      >
        {previewPanel}
      </ResizablePanel>
    </ResizablePanelLayout>
  );
}
```

This encapsulates the two-panel pattern with sensible defaults. Future blades can use it:

```tsx
// Phase 22 example:
<SplitPaneLayout
  autoSaveId="file-browser-split"
  listPanel={<FileBrowserTree />}
  previewPanel={<FilePreview />}
  listDefaultSize={30}
/>
```

### 6.7 Type-Safe Inline Preview Registry

For extensibility, create a registry that maps file types to preview components:

```tsx
// /src/components/staging/previewRegistry.ts

import type { ComponentType } from "react";
import type { FileChange } from "../../bindings";

export interface InlinePreviewProps {
  file: FileChange;
  section: "staged" | "unstaged" | "untracked" | null;
  onExpand: () => void;
}

type PreviewMatcher = (file: FileChange) => boolean;

interface RegisteredPreview {
  matcher: PreviewMatcher;
  component: ComponentType<InlinePreviewProps>;
  priority: number;
}

const previews: RegisteredPreview[] = [];

export function registerInlinePreview(
  matcher: PreviewMatcher,
  component: ComponentType<InlinePreviewProps>,
  priority = 0,
) {
  previews.push({ matcher, component, priority });
  previews.sort((a, b) => b.priority - a.priority);
}

export function getInlinePreview(
  file: FileChange,
): ComponentType<InlinePreviewProps> | null {
  for (const preview of previews) {
    if (preview.matcher(file)) {
      return preview.component;
    }
  }
  return null; // Falls through to default diff viewer
}
```

This mirrors the existing `ViewerRegistry` pattern at `/src/components/viewers/ViewerRegistry.ts`.

### 6.8 CVA Pattern for Panel Variants (Optional)

If we want consistent panel styling variants, we can define a CVA pattern:

```tsx
import { cva } from "class-variance-authority";

const panelVariants = cva("flex flex-col h-full", {
  variants: {
    role: {
      list: "bg-ctp-base",
      preview: "bg-ctp-crust",
    },
    border: {
      none: "",
      right: "border-r border-ctp-surface0",
      left: "border-l border-ctp-surface0",
    },
  },
  defaultVariants: {
    role: "list",
    border: "none",
  },
});
```

However, for Phase 21 this adds complexity without much benefit. The styling is simple enough to inline. Recommend deferring CVA patterns to when there are 3+ panel variants.

---

## 7. Framer Motion Integration

### 7.1 Existing Animation Patterns

**`/src/lib/animations.ts`** defines shared variants:
- `bladeSlideIn`: `{ x: 40, opacity: 0 }` -> `{ x: 0, opacity: 1 }`
- `fadeIn`, `fadeInUp`, `fadeInScale`: Standard opacity transitions
- `staggerContainer` / `staggerItem`: For list entry animations
- `tabContent`: `{ x: 10, opacity: 0 }` -> `{ x: 0, opacity: 1 }`

**`/src/components/blades/BladeContainer.tsx`** uses `AnimatePresence mode="popLayout"` with `motion.div`:
```tsx
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
```

### 7.2 Expand-to-Full-Blade Transition

When the user clicks the expand button or presses Enter, a new blade is pushed on the stack. The existing `BladeContainer` animation handles this:
1. The staging two-column blade collapses to a `BladeStrip` (10px wide)
2. The full diff blade slides in from the right

**No additional Framer Motion code needed for the expand transition.** The existing blade stack animation covers it.

### 7.3 Inline Diff Panel Content Transition

When the selected file changes, the diff content should transition smoothly:

```tsx
import { AnimatePresence, motion } from "framer-motion";

// Inside InlineDiffPanel, wrap the diff content:
<AnimatePresence mode="wait">
  <motion.div
    key={file.path}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    className="flex-1 min-h-0"
  >
    {/* Monaco DiffEditor or placeholder */}
  </motion.div>
</AnimatePresence>
```

**CAUTION:** Wrapping Monaco in `AnimatePresence` will cause mount/unmount on each file change. This defeats the model-swapping optimization. Better approach:

```tsx
// Don't animate Monaco mount/unmount. Instead, animate an overlay:
<div className="flex-1 min-h-0 relative">
  {diff && (
    <DiffEditor
      original={diff.oldContent}
      modified={diff.newContent}
      language={diff.language}
      theme="flowforge-dark"
      options={INLINE_DIFF_OPTIONS}
    />
  )}
  <AnimatePresence>
    {isLoading && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="absolute inset-0 flex items-center justify-center bg-ctp-mantle/80"
      >
        <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

This keeps Monaco mounted while showing a loading overlay during fetch.

### 7.4 File List Section Animations

When a file moves from "Changes" to "Staged Changes" (or vice versa), it should animate. Use `layoutId` from Framer Motion:

```tsx
// In FileItem, add layoutId:
<motion.div
  layoutId={`file-${file.path}`}
  layout
  transition={{ type: "spring", stiffness: 500, damping: 30 }}
  className={cn("flex items-center cursor-pointer group", ...)}
>
  {/* file item content */}
</motion.div>
```

This enables smooth layout animations when files move between sections. However, this requires wrapping the sections in a `LayoutGroup`:

```tsx
import { LayoutGroup } from "framer-motion";

<LayoutGroup>
  <FileList title="Staged Changes" files={staged} section="staged" />
  <FileList title="Changes" files={unstaged} section="unstaged" />
  <FileList title="Untracked Files" files={untracked} section="untracked" />
</LayoutGroup>
```

**Recommendation:** Defer `layoutId` animation to a polish pass. The initial implementation should focus on correctness. Adding layout animations later is easy and low-risk.

### 7.5 Drag Handle Animation

No specific animation needed for the drag handle. The existing CSS `transition-colors` on `ResizeHandle` provides smooth color transitions on hover/active. The drag itself is handled by `react-resizable-panels` natively with no animation (instant response).

---

## 8. Full Diff Blade: Next/Prev File Navigation

### 8.1 Context Decision

From CONTEXT.md: "File navigation in full-screen: next/prev arrows without going back"

This means the full diff blade (when expanded from inline) should have navigation arrows to switch between files without popping back to the two-column view.

### 8.2 Implementation Approach

The full diff blade needs to know the list of files. Two options:

**Option A: Pass file list through blade props**
Add to `BladePropsMap`:
```ts
"diff": {
  source: DiffSource;
  fileList?: Array<{ path: string; section: "staged" | "unstaged" | "untracked" }>;
};
```

Pros: Self-contained, no external dependencies
Cons: Blade props get serialized; large file lists could be wasteful

**Option B: Read file list from staging store**
The `useStagingStore` already has the query data available. The full diff blade can subscribe to it.

```tsx
// In DiffBlade, when source.mode === "staging":
const { data: statusResult } = useQuery({
  queryKey: ["stagingStatus"],
  queryFn: () => commands.getStagingStatus(),
});

// Build flat file list from status
const allFiles = useMemo(() => {
  if (!statusResult || statusResult.status !== "ok") return [];
  const s = statusResult.data;
  return [
    ...s.staged.map(f => ({ file: f, section: "staged" as const })),
    ...s.unstaged.map(f => ({ file: f, section: "unstaged" as const })),
    ...s.untracked.map(f => ({ file: f, section: "untracked" as const })),
  ];
}, [statusResult]);
```

**Recommendation: Option B.** The staging status is already cached by React Query (with 2s polling). Reading it from the diff blade adds no overhead. It also stays in sync if files change while the diff blade is open.

### 8.3 Next/Prev Navigation in DiffBlade

Add to the diff blade header:

```tsx
import { ChevronLeft, ChevronRight } from "lucide-react";

// In DiffBlade, add next/prev when source is staging mode:
function DiffBladeNavigation({
  currentPath,
  allFiles,
  onNavigate,
}: {
  currentPath: string;
  allFiles: Array<{ file: FileChange; section: string }>;
  onNavigate: (file: FileChange, section: string) => void;
}) {
  const currentIndex = allFiles.findIndex(f => f.file.path === currentPath);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allFiles.length - 1;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => hasPrev && onNavigate(allFiles[currentIndex - 1].file, allFiles[currentIndex - 1].section)}
        className="p-1 rounded hover:bg-ctp-surface0 disabled:opacity-30 disabled:cursor-default"
        aria-label="Previous file"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs text-ctp-overlay0">
        {currentIndex + 1} / {allFiles.length}
      </span>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => hasNext && onNavigate(allFiles[currentIndex + 1].file, allFiles[currentIndex + 1].section)}
        className="p-1 rounded hover:bg-ctp-surface0 disabled:opacity-30 disabled:cursor-default"
        aria-label="Next file"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
```

To navigate, use `replaceBlade` (not `pushBlade`) to swap the current diff blade for the next file's diff blade without growing the stack:

```tsx
const handleNavigate = (file: FileChange, section: string) => {
  store.replaceBlade({
    type: "diff",
    title: file.path.split("/").pop() || file.path,
    props: {
      source: { mode: "staging", filePath: file.path, staged: section === "staged" },
    },
  });
  // Also update staging store selection
  useStagingStore.getState().selectFile(file, section);
};
```

The `replaceBlade` function already exists in the blade store (line 82-88 of `/src/stores/blades.ts`).

### 8.4 Keyboard Shortcuts in Full Diff Blade

```tsx
useHotkeys("alt+up", () => navigatePrev(), { enabled: hasPrev });
useHotkeys("alt+down", () => navigateNext(), { enabled: hasNext });
```

Using `alt+up/down` to avoid conflict with Monaco's own up/down keys.

---

## 9. State Preservation on Back

### 9.1 File Selection Preservation

When the user expands to full blade then presses back:
1. The full diff blade is popped from the stack
2. The staging two-column blade is revealed
3. The staging store still has `selectedFile` set to the file they were viewing
4. The inline diff panel immediately shows the diff for that file

**This works out of the box.** The Zustand staging store persists across blade push/pop since it's global state, not blade-local state.

### 9.2 Scroll Position Preservation

Preserving scroll position in the file list when returning from full blade:

**Strategy:** The file list scroll container maintains its scroll position naturally because:
1. The staging blade is not unmounted when a blade is pushed on top
2. The `BladeContainer` keeps it as a `BladeStrip` (collapsed but not destroyed)
3. When `popBlade` is called, the staging blade re-expands

**Wait, actually:** The `BladeContainer` renders `bladeStack.slice(0, -1)` as `BladeStrip`s and only the last blade via `BladeRenderer`. This means the staging blade component IS unmounted and replaced by a `BladeStrip` when a diff blade is pushed.

**Revised strategy:** Store scroll position in the staging Zustand store:

```ts
// Add to StagingState:
interface StagingState {
  // ... existing fields
  fileListScrollTop: number;
  setFileListScrollTop: (top: number) => void;
}
```

In `StagingPanel`, capture scroll position before unmount:
```tsx
const scrollRef = useRef<HTMLDivElement>(null);
const { fileListScrollTop, setFileListScrollTop } = useStagingStore();

// Restore scroll on mount
useEffect(() => {
  if (scrollRef.current && fileListScrollTop > 0) {
    scrollRef.current.scrollTop = fileListScrollTop;
  }
}, []);

// Save scroll on unmount
useEffect(() => {
  const el = scrollRef.current;
  return () => {
    if (el) setFileListScrollTop(el.scrollTop);
  };
}, [setFileListScrollTop]);

// Apply ref:
<div ref={scrollRef} className="flex-1 overflow-y-auto">
  {/* file lists */}
</div>
```

### 9.3 Monaco Scroll Position

Monaco scroll position in the inline diff cannot be preserved across unmount/remount (Monaco creates a new instance). This is acceptable since the inline preview is meant for quick scanning. The full diff blade (if expanded) would need separate scroll preservation if desired.

---

## 10. Implementation Plan Summary

### Phase 21 File Changes

| File | Action | Description |
|------|--------|-------------|
| `/src/components/staging/StagingTwoColumnLayout.tsx` | **CREATE** | New two-column layout component |
| `/src/components/staging/InlineDiffPanel.tsx` | **CREATE** | New inline diff preview component |
| `/src/components/staging/InlineDiffHeader.tsx` | **CREATE** (or inline) | Header with file name + expand button |
| `/src/hooks/useStagingKeyboard.ts` | **CREATE** | Keyboard navigation hook |
| `/src/components/blades/StagingChangesBlade.tsx` | **MODIFY** | Replace `StagingPanel` with `StagingTwoColumnLayout` |
| `/src/stores/staging.ts` | **MODIFY** | Add `fileListScrollTop` for scroll preservation |
| `/src/components/blades/DiffBlade.tsx` | **MODIFY** | Add next/prev navigation for staging mode |
| `/src/components/blades/registrations/diff.tsx` | **MODIFY** | Add `renderTrailing` for next/prev buttons |
| `/src/lib/animations.ts` | **MODIFY** | Add `diffPanelFade` variant (optional) |
| `/src/components/layout/SplitPaneLayout.tsx` | **CREATE** (optional) | Reusable split pane (defer if not needed yet) |

### Files NOT Changed

| File | Reason |
|------|--------|
| `/src/components/staging/StagingPanel.tsx` | No changes needed -- `onFileSelect` is already optional |
| `/src/components/staging/FileItem.tsx` | No changes needed -- already writes to store |
| `/src/components/staging/FileList.tsx` | No changes needed |
| `/src/components/staging/FileTreeView.tsx` | No changes needed |
| `/src/lib/monacoTheme.ts` | No changes needed |
| `/src/components/layout/ResizablePanelLayout.tsx` | No changes needed |
| `/src-tauri/src/git/diff.rs` | No changes needed -- existing commands sufficient |
| `/src-tauri/src/git/staging.rs` | No changes needed |
| `/src/stores/bladeTypes.ts` | No changes needed -- diff blade type already exists |

### Dependencies

No new npm packages or Rust crates needed. All required libraries are already installed:
- `react-resizable-panels` v4.6.0
- `@monaco-editor/react` v4.7.0
- `react-hotkeys-hook` v5.2.4
- `framer-motion` v12.31.0
- `lucide-react` (for `Maximize2`, `ChevronLeft`, `ChevronRight` icons)

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Monaco performance in narrow panel | Low | `automaticLayout: true` handles resizing; `wordWrap: "on"` prevents horizontal scroll |
| File list scroll jank during keyboard nav | Low | React Query cache provides instant data; Monaco model swap is ~5ms |
| Conflict between file nav keys and Monaco keys | Low | File nav only active when file list panel has focus |
| Staging poll (2s) causing diff flicker | Medium | Use `staleTime: 5000` for diff query to avoid unnecessary refetches |
| Large file lists (500+ files) | Low | Defer virtualization to Phase 22 if needed; current rendering is fast for typical usage |

---

## 11. Key Technical Decisions

1. **Monaco stays as single instance per file change** -- Prop updates swap models, no remount
2. **`react-resizable-panels` for split pane** -- Already in the codebase, consistent with existing layout
3. **No new Rust commands** -- `get_file_diff` covers all inline preview needs
4. **Store-driven selection** -- `useStagingStore.selectedFile` drives both file list highlight and diff preview
5. **`replaceBlade` for next/prev in full view** -- Swaps blade without growing stack
6. **Scroll preservation via Zustand** -- Save/restore `scrollTop` across blade push/pop cycles
7. **`wordWrap: "on"` in inline preview** -- Prevents horizontal scroll in narrow panels
8. **`staleTime: 5000` for inline diff queries** -- Reduces unnecessary refetches during rapid file switching
9. **No `AnimatePresence` around Monaco** -- Avoid mount/unmount; use loading overlay instead
10. **`autoSaveId="staging-split"` for persistent panel sizes** -- User's resize preference persists across sessions
