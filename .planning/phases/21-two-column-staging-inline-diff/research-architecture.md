# Phase 21: Two-Column Staging & Inline Diff -- Architecture Research

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Component Architecture for Two-Column Layout](#2-component-architecture-for-two-column-layout)
3. [State Management Design](#3-state-management-design)
4. [Extensibility Patterns](#4-extensibility-patterns)
5. [Integration with Blade System](#5-integration-with-blade-system)
6. [Performance Considerations](#6-performance-considerations)
7. [Implementation Plan Summary](#7-implementation-plan-summary)

---

## 1. Current Architecture Analysis

### 1.1 Component Tree (Current State)

```
RepositoryView
  |
  +-- ResizablePanelLayout (autoSaveId="repo-layout", horizontal)
  |     |
  |     +-- ResizablePanel (id="sidebar", 20%, min 15%, max 30%)
  |     |     +-- BranchList, StashList, TagList, GitflowPanel, WorktreePanel
  |     |     +-- CommitForm (pinned to bottom)
  |     |
  |     +-- ResizeHandle
  |     |
  |     +-- ResizablePanel (id="blades", 80%)
  |           +-- BladeContainer
  |                 +-- BladeStrip[] (collapsed background blades)
  |                 +-- AnimatePresence > motion.div
  |                       +-- BladeRenderer (activeBlade)
  |                             +-- BladePanel (title bar + back button)
  |                                   +-- [blade component]
```

When `activeProcess === "staging"` and the blade stack has only the root blade:

```
BladeRenderer
  +-- [NO BladePanel wrapping - wrapInPanel: false]
  +-- StagingChangesBlade
        +-- StagingPanel (onFileSelect = openStagingDiff)
              +-- FileTreeSearch
              +-- FileTreeView / FileList (3 sections: staged, unstaged, untracked)
                    +-- FileItem (per file, with stage/unstage button)
```

When a user clicks a file, `openStagingDiff()` pushes a new blade onto the stack:

```
BladeContainer
  +-- BladeStrip (title="Changes")     <- collapsed staging blade
  +-- BladeRenderer                    <- active diff blade
        +-- BladePanel (title="filename.tsx", showBack=true)
              +-- DiffBlade
                    +-- DiffEditor toolbar (inline/side-by-side toggle)
                    +-- Monaco DiffEditor
```

### 1.2 Key Files and Their Responsibilities

| File | Path | Responsibility |
|------|------|----------------|
| `StagingChangesBlade` | `src/components/blades/StagingChangesBlade.tsx` | Thin wrapper: connects `StagingPanel` to blade navigation |
| `StagingPanel` | `src/components/staging/StagingPanel.tsx` | Full staging UI: search, view toggle, 3 file sections, mutations |
| `FileItem` | `src/components/staging/FileItem.tsx` | Single file row: icon, status dot, +/- stats, stage/unstage button |
| `FileTreeView` | `src/components/staging/FileTreeView.tsx` | Tree-mode file rendering with folder nodes and indent guides |
| `FileList` | `src/components/staging/FileList.tsx` | Flat-mode file rendering with collapsible sections |
| `DiffBlade` | `src/components/blades/DiffBlade.tsx` | Full diff viewer: Monaco DiffEditor with toolbar |
| `useStagingStore` | `src/stores/staging.ts` | Zustand store: `selectedFile`, `selectedSection`, `viewMode` |
| `useBladeNavigation` | `src/hooks/useBladeNavigation.ts` | Hook: `openBlade()`, `openStagingDiff()`, `openDiff()`, `goBack()` |
| `useBladeStore` | `src/stores/blades.ts` | Zustand store: blade stack, push/pop/replace/reset |
| `BladeRenderer` | `src/components/blades/BladeRenderer.tsx` | Resolves blade type -> registration -> renders component |
| `BladePanel` | `src/components/blades/BladePanel.tsx` | Title bar wrapper with back button and trailing slot |
| `bladeRegistry` | `src/lib/bladeRegistry.ts` | Registry map: type -> {component, title, lazy, wrapInPanel, etc.} |
| `bladeTypes` | `src/stores/bladeTypes.ts` | `BladePropsMap` interface: type-safe props per blade type |
| `ResizablePanelLayout` | `src/components/layout/ResizablePanelLayout.tsx` | Wrapper around `react-resizable-panels` (Group, Panel, Separator) |

### 1.3 Data Flow

```
getStagingStatus() ----[react-query, 2s poll]----> StagingPanel
  returns: { staged: FileChange[], unstaged: FileChange[], untracked: FileChange[] }

getFileDiff(path, staged, contextLines) ----[react-query]----> DiffBlade
  returns: { path, oldContent, newContent, hunks, isBinary, language }

User clicks file:
  FileItem.handleSelect() -> selectFile(file, section) [staging store]
                           -> onFileSelect(file, section) [prop callback]
                                -> openStagingDiff(file, section) [blade nav hook]
                                     -> pushBlade("diff", { source: { mode: "staging", ... } })
```

### 1.4 Existing Staging Store Shape

```typescript
interface StagingState {
  selectedFile: FileChange | null;
  selectedSection: "staged" | "unstaged" | "untracked" | null;
  viewMode: "tree" | "flat";
  selectFile: (file, section?) => void;
  setViewMode: (mode) => void;
}
```

The store already tracks `selectedFile` and `selectedSection`. Currently, selecting a file ALSO pushes a new blade (navigates away). In Phase 21, selecting a file will instead update the inline diff panel.

### 1.5 Existing Resizable Panel Infrastructure

The app uses `react-resizable-panels` v4.6.0 via wrapper components:

- `ResizablePanelLayout` wraps `Group` with `autoSaveId` for persistence
- `ResizablePanel` wraps `Panel` with percentage-based sizing
- `ResizeHandle` wraps `Separator` with Catppuccin-themed styling

These wrappers are already used for the sidebar/blades split in `RepositoryView`. They are fully reusable for the two-column staging layout.

### 1.6 Blade Registration System

Adding a blade requires:
1. A component file in `src/components/blades/`
2. A props entry in `BladePropsMap` (`src/stores/bladeTypes.ts`)
3. A registration file in `src/components/blades/registrations/`
4. An import in the barrel `src/components/blades/registrations/index.ts`

The staging-changes blade is registered with `wrapInPanel: false` and `showBack: false` -- it manages its own chrome. This is important: the two-column layout will also need to manage its own title bar (or opt out of BladePanel).

---

## 2. Component Architecture for Two-Column Layout

### 2.1 Design Decision: Refactor StagingChangesBlade In-Place

The `StagingChangesBlade` should be refactored to contain the two-column layout directly. It will continue to use `wrapInPanel: false` in the blade registration and manage its own layout chrome.

Rationale:
- The staging blade is already the root blade for the staging process -- no need for a new blade type.
- The `BladePropsMap` entry for `"staging-changes"` takes `Record<string, never>` (no props) -- this stays the same.
- The change is internal: from single-column `StagingPanel` to a split-pane `StagingPanel` + `InlineDiffPanel`.

### 2.2 Proposed Component Hierarchy

```
StagingChangesBlade                      [src/components/blades/StagingChangesBlade.tsx]
  |
  +-- SplitPaneLayout                    [src/components/layout/SplitPaneLayout.tsx] (NEW - generic)
  |     |
  |     +-- PRIMARY PANEL (40%)
  |     |     +-- StagingPanel           [src/components/staging/StagingPanel.tsx] (MODIFIED)
  |     |           +-- FileTreeSearch
  |     |           +-- FileTreeView / FileList
  |     |                 +-- FileItem (MODIFIED: no longer calls openStagingDiff)
  |     |
  |     +-- ResizeHandle
  |     |
  |     +-- DETAIL PANEL (60%)
  |           +-- StagingDiffPreview     [src/components/staging/StagingDiffPreview.tsx] (NEW)
  |                 +-- DiffPreviewHeader (filename, expand button, nav arrows)
  |                 +-- InlineDiffViewer  [src/components/staging/InlineDiffViewer.tsx] (NEW)
  |                 |     +-- Monaco DiffEditor (reused from DiffBlade pattern)
  |                 +-- OR BinaryFilePlaceholder
  |                 +-- OR NonTextFilePlaceholder
```

### 2.3 New and Modified Files

#### NEW Files

| File | Location | Responsibility |
|------|----------|----------------|
| `SplitPaneLayout` | `src/components/layout/SplitPaneLayout.tsx` | Generic two-column list+detail layout, reusable by other blades |
| `StagingDiffPreview` | `src/components/staging/StagingDiffPreview.tsx` | Orchestrates diff preview: header, viewer, placeholders, expand action |
| `InlineDiffViewer` | `src/components/staging/InlineDiffViewer.tsx` | Monaco DiffEditor in compact mode, extracted for reuse |
| `DiffPreviewHeader` | `src/components/staging/DiffPreviewHeader.tsx` | Filename path display, expand button, prev/next navigation |
| `NonTextPlaceholder` | `src/components/staging/NonTextPlaceholder.tsx` | Placeholder for binary/image/non-text files with "click to expand" |
| `useStagingKeyboard` | `src/hooks/useStagingKeyboard.ts` | Arrow-key navigation through file list, keyboard stage/unstage |

#### MODIFIED Files

| File | Change |
|------|--------|
| `StagingChangesBlade.tsx` | Replace single `StagingPanel` with `SplitPaneLayout` containing `StagingPanel` + `StagingDiffPreview` |
| `StagingPanel.tsx` | Remove `onFileSelect` prop callback (no longer pushes blades). Selection now only updates store. |
| `FileItem.tsx` | `handleSelect()` only calls `selectFile()` -- no longer calls `onFileSelect` to push a blade. Add `isActive` visual treatment for current diff target. |
| `staging.ts` (store) | Add `scrollPositionMap`, `fileNavigation` helpers, expand state fields (see Section 3) |

### 2.4 Detailed Component Contracts

#### `SplitPaneLayout` (Generic, Reusable)

```typescript
// src/components/layout/SplitPaneLayout.tsx

interface SplitPaneLayoutProps {
  /** Unique ID for persisting panel sizes to localStorage */
  autoSaveId: string;
  /** Default size of the primary (left) panel, as percentage. Default: 40 */
  primaryDefaultSize?: number;
  /** Minimum size of the primary panel, as percentage. Default: 20 */
  primaryMinSize?: number;
  /** Maximum size of the primary panel, as percentage. Default: 60 */
  primaryMaxSize?: number;
  /** Content for the primary (left) panel */
  primary: ReactNode;
  /** Content for the detail (right) panel */
  detail: ReactNode;
}
```

This wraps `ResizablePanelLayout`, `ResizablePanel`, and `ResizeHandle` into a single semantic component for the list+detail pattern. It can be reused by any blade that needs a split view (e.g., future repo-browser blade).

#### `StagingDiffPreview`

```typescript
// src/components/staging/StagingDiffPreview.tsx

interface StagingDiffPreviewProps {
  /** Currently selected file (from staging store) */
  file: FileChange;
  /** Which section the file is in */
  section: "staged" | "unstaged" | "untracked";
  /** Callback to expand to full-blade diff view */
  onExpand: () => void;
  /** Callback to navigate to next/previous file */
  onNavigateFile: (direction: "next" | "prev") => void;
  /** Whether prev/next navigation is available */
  hasPrev: boolean;
  hasNext: boolean;
}
```

This component decides what to render based on the file type:
- Text files -> `InlineDiffViewer` with Monaco DiffEditor
- Binary files -> `NonTextPlaceholder` with file type icon
- Image files -> `NonTextPlaceholder` with image icon
- Other specialized types (`.nupkg`, `.md`, `.glb`) -> `NonTextPlaceholder` with "click to expand"

The file-type check reuses the same logic as `bladeTypeForFile()` in `useBladeNavigation.ts`. That function should be extracted to a shared utility.

#### `InlineDiffViewer`

```typescript
// src/components/staging/InlineDiffViewer.tsx

interface InlineDiffViewerProps {
  /** Diff source configuration (same type as DiffBlade) */
  source: DiffSource;
}
```

This is essentially the body of `DiffBlade` extracted into a standalone component. It uses `useQuery` with the same query key pattern (`["fileDiff", path, staged, contextLines]`) to fetch diff data, then renders Monaco DiffEditor. The toolbar is simplified (no side-by-side toggle in inline preview -- always inline mode to save space).

#### `DiffPreviewHeader`

```typescript
// src/components/staging/DiffPreviewHeader.tsx

interface DiffPreviewHeaderProps {
  filePath: string;
  onExpand: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}
```

Renders: `[<] [>]  path/to/file.tsx  [expand icon]`

### 2.5 ASCII Layout Diagram

```
+-----------------------------------------------------------------------+
| BladeContainer (no BladePanel wrapper for staging-changes)            |
+-----------------------------------------------------------------------+
| StagingChangesBlade                                                   |
| +-------------------------------+---+-------------------------------+ |
| |        StagingPanel           | R |     StagingDiffPreview        | |
| |        (40%)                  | e |     (60%)                     | |
| | +---------------------------+ | s | +---------------------------+ | |
| | | FileTreeSearch            | | i | | DiffPreviewHeader         | | |
| | +---------------------------+ | z | | [<] [>] src/App.tsx [^]   | | |
| | | Staged Changes (2)        | | e | +---------------------------+ | |
| | |   src/lib/foo.ts     [x]  | |   | |                           | | |
| | |   src/App.tsx        [x]  | | H | |  InlineDiffViewer         | | |
| | +---------------------------+ | a | |  (Monaco DiffEditor)      | | |
| | | Changes (3)               | | n | |                           | | |
| | |   src/main.ts        [+]  | | d | |  - import { Foo }        | | |
| | |   src/utils.ts       [+]  | | l | |  + import { Bar }        | | |
| | |   README.md          [+]  | | e | |  ...                     | | |
| | +---------------------------+ |   | |                           | | |
| | | Untracked (1)             | |   | |                           | | |
| | |   .env.example       [+]  | |   | |                           | | |
| | +---------------------------+ |   | +---------------------------+ | |
| +-------------------------------+---+-------------------------------+ |
+-----------------------------------------------------------------------+
```

---

## 3. State Management Design

### 3.1 Extended Staging Store

The existing `useStagingStore` needs expansion. Here is the proposed new shape:

```typescript
// src/stores/staging.ts

import { create } from "zustand";
import type { FileChange } from "../bindings";

type ViewMode = "tree" | "flat";
type Section = "staged" | "unstaged" | "untracked";

interface StagingState {
  // --- Existing ---
  selectedFile: FileChange | null;
  selectedSection: Section | null;
  viewMode: ViewMode;

  // --- New for Phase 21 ---
  /** Map of filePath -> scroll position (for diff panel preservation) */
  scrollPositions: Record<string, number>;

  // --- Actions (existing) ---
  selectFile: (file: FileChange | null, section?: Section) => void;
  setViewMode: (mode: ViewMode) => void;

  // --- Actions (new for Phase 21) ---
  /** Save the scroll position for the currently-viewed diff */
  saveScrollPosition: (filePath: string, scrollTop: number) => void;
  /** Clear all saved scroll positions (e.g., on process switch) */
  clearScrollPositions: () => void;
}
```

### 3.2 Selected File: Where It Lives and Why

The selected file state stays in `useStagingStore` (not in component-local state and not in the blade store). Reasons:

1. **Persistence across stage/unstage**: When a file is staged, it moves from "unstaged" to "staged" in the data from `getStagingStatus()`. The staging store's `selectedFile` preserves selection by file path. The query re-fetches every 2 seconds, and the store keeps pointing at the same file regardless of which section it lands in.

2. **Persistence when returning from full-blade diff**: When the user expands to a full DiffBlade and then presses Back, the blade stack pops back to `staging-changes`. The `useStagingStore` still has the selected file, so the two-column layout immediately shows the correct diff.

3. **Not in blade store**: The blade store's `TypedBlade.props` for `staging-changes` is `Record<string, never>` -- no props. Storing selection there would require changing the blade type contract, which is unnecessary since `useStagingStore` already exists for this purpose.

### 3.3 Handling Stage/Unstage While Viewing

Current `FileItem` calls `selectFile(file, section)` then `onFileSelect(file, section)`. In the new design:

1. `FileItem.handleSelect()` only calls `selectFile(file, section)`.
2. The stage/unstage button (`handleAction`) calls the mutation. On mutation success, `queryClient.invalidateQueries(["stagingStatus"])` triggers a refetch.
3. The `StagingPanel` has a `useEffect` that reconciles `selectedFile` after status changes:

```typescript
// After staging status refetch, find the selected file in the new data
useEffect(() => {
  if (!selectedFile) return;
  const filePath = selectedFile.path;

  // Find which section the file is in now
  if (status.staged.some(f => f.path === filePath)) {
    selectFile(status.staged.find(f => f.path === filePath)!, "staged");
  } else if (status.unstaged.some(f => f.path === filePath)) {
    selectFile(status.unstaged.find(f => f.path === filePath)!, "unstaged");
  } else if (status.untracked.some(f => f.path === filePath)) {
    selectFile(status.untracked.find(f => f.path === filePath)!, "untracked");
  }
  // If file is no longer in any section (e.g., discarded), keep selection -- diff will show empty
}, [status]);
```

### 3.4 Diff Data Fetching

The `InlineDiffViewer` reuses the exact same `useQuery` pattern as `DiffBlade`:

```typescript
const queryKey = ["fileDiff", filePath, staged, contextLines];
const queryFn = () => commands.getFileDiff(filePath, staged, contextLines);
```

This means:
- The query cache is shared. If the user expands to full DiffBlade and comes back, the data is already cached.
- The `staleTime` for staging diffs is `undefined` (default), so it refetches on re-mount but uses cache while fresh.
- No new Tauri commands needed.

**Important nuance for `staged` parameter**: When the user stages/unstages a file, the `staged` boolean must flip accordingly. The `InlineDiffViewer` derives `staged` from `selectedSection`:

```typescript
const staged = selectedSection === "staged";
```

For untracked files, `staged = false` is correct (they show as new files vs empty).

### 3.5 Scroll Position Preservation

When the user clicks "expand" to go to full DiffBlade:
1. Before pushing the blade, save the current Monaco editor scroll position via `saveScrollPosition(filePath, scrollTop)` in the staging store.
2. When popping back, the `InlineDiffViewer` reads `scrollPositions[filePath]` and restores it via `editor.setScrollTop()` in a `useEffect` after the editor mounts.

Implementation detail: Monaco's `DiffEditor` exposes the modified editor via `onMount` callback. We capture the editor instance ref and read/write scroll position from it.

### 3.6 File List Ordering and Navigation

Files must maintain a stable, predictable order for keyboard navigation:

```typescript
// Build a flat ordered list of all files for navigation
function buildNavigableFileList(status: StagingStatus): Array<{ file: FileChange; section: Section }> {
  return [
    ...status.staged.map(f => ({ file: f, section: "staged" as const })),
    ...status.unstaged.map(f => ({ file: f, section: "unstaged" as const })),
    ...status.untracked.map(f => ({ file: f, section: "untracked" as const })),
  ];
}
```

This ordering (staged -> unstaged -> untracked) matches the visual order. Within each section, files are ordered by path (alphabetical), which is the current behavior from the backend.

### 3.7 Keyboard Navigation

The `useStagingKeyboard` hook handles:

| Key | Action |
|-----|--------|
| `ArrowDown` / `j` | Select next file in list, diff updates immediately |
| `ArrowUp` / `k` | Select previous file in list, diff updates immediately |
| `Enter` | Expand to full DiffBlade |
| `Space` | Stage/unstage the currently selected file |

```typescript
// src/hooks/useStagingKeyboard.ts

export function useStagingKeyboard(
  fileList: Array<{ file: FileChange; section: Section }>,
  onExpand: () => void,
  onToggleStage: (file: FileChange, section: Section) => void,
) {
  const { selectedFile, selectFile } = useStagingStore();

  useHotkeys("down,j", () => {
    const currentIndex = fileList.findIndex(
      (entry) => entry.file.path === selectedFile?.path,
    );
    const nextIndex = Math.min(currentIndex + 1, fileList.length - 1);
    const next = fileList[nextIndex];
    if (next) selectFile(next.file, next.section);
  }, { enableOnFormTags: false });

  useHotkeys("up,k", () => {
    const currentIndex = fileList.findIndex(
      (entry) => entry.file.path === selectedFile?.path,
    );
    const prevIndex = Math.max(currentIndex - 1, 0);
    const prev = fileList[prevIndex];
    if (prev) selectFile(prev.file, prev.section);
  }, { enableOnFormTags: false });

  useHotkeys("enter", () => { onExpand(); }, { enableOnFormTags: false });
  useHotkeys("space", () => {
    if (selectedFile && selectedSection) {
      onToggleStage(selectedFile, selectedSection);
    }
  }, { enableOnFormTags: false, preventDefault: true });
}
```

---

## 4. Extensibility Patterns (FOCUS AREA)

### 4.1 Generic `SplitPaneLayout` Component

This is the core reusable building block. It encapsulates the `react-resizable-panels` setup into a semantic "list + detail" layout:

```typescript
// src/components/layout/SplitPaneLayout.tsx

import { Group, Panel, Separator } from "react-resizable-panels";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface SplitPaneLayoutProps {
  autoSaveId: string;
  primaryDefaultSize?: number;  // default: 40
  primaryMinSize?: number;      // default: 20
  primaryMaxSize?: number;      // default: 60
  detailMinSize?: number;       // default: 30
  primary: ReactNode;
  detail: ReactNode;
  className?: string;
}

export function SplitPaneLayout({
  autoSaveId,
  primaryDefaultSize = 40,
  primaryMinSize = 20,
  primaryMaxSize = 60,
  detailMinSize = 30,
  primary,
  detail,
  className,
}: SplitPaneLayoutProps) {
  return (
    <Group
      id={autoSaveId}
      orientation="horizontal"
      className={cn("h-full w-full", className)}
    >
      <Panel
        id={`${autoSaveId}-primary`}
        defaultSize={`${primaryDefaultSize}%`}
        minSize={`${primaryMinSize}%`}
        maxSize={`${primaryMaxSize}%`}
        className="overflow-clip"
      >
        {primary}
      </Panel>
      <Separator
        className={cn(
          "w-1 bg-ctp-surface0 transition-colors cursor-col-resize",
          "data-[separator='hover']:bg-ctp-blue data-[separator='active']:bg-ctp-blue",
        )}
      />
      <Panel
        id={`${autoSaveId}-detail`}
        minSize={`${detailMinSize}%`}
        className="overflow-clip"
      >
        {detail}
      </Panel>
    </Group>
  );
}
```

Future reuse candidates:
- **Repo Browser Blade** (Phase 22): file tree on left, file content on right
- **Commit Details Blade**: file list on left, diff preview on right (currently pushes a new blade)
- **Settings Blade**: categories on left, settings panel on right

### 4.2 Preview Panel Registry

Just as blades have a registry (`bladeRegistry.ts`), file previews should have a registry that maps file types to preview components. This allows new preview types to be added without modifying the `StagingDiffPreview` switch logic.

```typescript
// src/lib/previewRegistry.ts

import type { ComponentType } from "react";
import type { DiffSource } from "../components/blades/DiffBlade";
import type { FileChange } from "../bindings";

/**
 * What kind of preview to render for a file type.
 *
 * - "inline-diff": Full Monaco DiffEditor (for text files)
 * - "placeholder": Icon + message + "click to expand" (for binary, images, etc.)
 * - "custom": A custom inline preview component
 */
export type PreviewMode = "inline-diff" | "placeholder" | "custom";

export interface PreviewRegistration {
  /** Unique key for this preview type */
  key: string;
  /** Function to test if this registration handles the file */
  matches: (filePath: string) => boolean;
  /** What mode to use */
  mode: PreviewMode;
  /** For "placeholder" mode: icon component and message */
  placeholder?: {
    icon: ComponentType<{ className?: string }>;
    message: string;
  };
  /** For "custom" mode: the component to render inline */
  component?: ComponentType<{ file: FileChange; source: DiffSource }>;
  /** Priority for matching (higher = checked first). Default: 0 */
  priority?: number;
}

const registry: PreviewRegistration[] = [];

export function registerPreview(config: PreviewRegistration): void {
  registry.push(config);
  registry.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function getPreviewForFile(filePath: string): PreviewRegistration | undefined {
  return registry.find((r) => r.matches(filePath));
}
```

Default registrations:

```typescript
// src/components/staging/previewRegistrations.ts

import { FileImage, FileArchive, FileCode, File } from "lucide-react";
import { registerPreview } from "../../lib/previewRegistry";

// Binary files (catch-all for known binary extensions)
registerPreview({
  key: "binary",
  matches: (path) => /\.(exe|dll|so|dylib|bin|dat|wasm)$/i.test(path),
  mode: "placeholder",
  placeholder: {
    icon: File,
    message: "Binary file -- click to expand",
  },
  priority: 10,
});

// Image files
registerPreview({
  key: "image",
  matches: (path) => /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i.test(path),
  mode: "placeholder",
  placeholder: {
    icon: FileImage,
    message: "Image file -- click to expand for preview",
  },
  priority: 10,
});

// Archive/package files
registerPreview({
  key: "nupkg",
  matches: (path) => /\.nupkg$/i.test(path),
  mode: "placeholder",
  placeholder: {
    icon: FileArchive,
    message: "NuGet package -- click to expand",
  },
  priority: 10,
});

// 3D model files
registerPreview({
  key: "3d",
  matches: (path) => /\.(glb|gltf)$/i.test(path),
  mode: "placeholder",
  placeholder: {
    icon: FileCode,
    message: "3D model -- click to expand for viewer",
  },
  priority: 10,
});

// Default: text diff (lowest priority, matches everything)
registerPreview({
  key: "text-diff",
  matches: () => true,
  mode: "inline-diff",
  priority: -100,
});
```

The `StagingDiffPreview` uses the registry:

```typescript
const preview = getPreviewForFile(file.path);

if (preview?.mode === "placeholder") {
  return <NonTextPlaceholder icon={preview.placeholder.icon} message={preview.placeholder.message} onExpand={onExpand} />;
}
if (preview?.mode === "custom" && preview.component) {
  return <preview.component file={file} source={source} />;
}
// Default: inline-diff
return <InlineDiffViewer source={source} />;
```

### 4.3 Extract `bladeTypeForFile` as Shared Utility

The function `bladeTypeForFile()` in `useBladeNavigation.ts` determines which blade type to use for a file. The preview registry needs similar logic. To avoid duplication:

```typescript
// src/lib/fileTypeUtils.ts

/** Returns the blade type appropriate for a file extension */
export function bladeTypeForFile(filePath: string): BladeType { ... }

/** Returns whether a file can be shown as an inline text diff */
export function isTextDiffable(filePath: string): boolean {
  return bladeTypeForFile(filePath) === "diff";
}
```

### 4.4 Generic "Expand to Full Blade" Pattern

The "expand to full blade" action should be a reusable pattern:

```typescript
// src/hooks/useExpandToFullBlade.ts

import { useBladeNavigation } from "./useBladeNavigation";
import type { FileChange } from "../bindings";
import type { DiffSource } from "../components/blades/DiffBlade";

/**
 * Returns a function that pushes the appropriate full-blade viewer
 * for the given file, reusing the existing file-routing logic.
 */
export function useExpandToFullBlade() {
  const { openStagingDiff } = useBladeNavigation();

  function expand(file: FileChange, section: "staged" | "unstaged" | "untracked") {
    openStagingDiff(file, section);
  }

  return { expand };
}
```

This simply delegates to `openStagingDiff` which already does file-type routing. The staging blade's expand button calls `expand(selectedFile, selectedSection)`.

### 4.5 Reusable Pattern Summary

```
+---------------------------+     +---------------------------+
|   SplitPaneLayout         |     |   PreviewRegistry         |
|   (layout/SplitPane...)   |     |   (lib/previewRegistry)   |
|                           |     |                           |
|   Generic list+detail     |     |   Maps file extensions    |
|   two-column layout       |     |   to preview renderers    |
|   with resizable panels   |     |   (inline-diff, placeholder,
|                           |     |    custom)                |
+---------------------------+     +---------------------------+
           |                                 |
           |  used by                        |  used by
           v                                 v
+---------------------------+     +---------------------------+
|   StagingChangesBlade     |     |   StagingDiffPreview      |
|   (Phase 21)              |     |   (decides what to render)|
+---------------------------+     +---------------------------+
|   RepoBrowserBlade        |     |   Future custom previews  |
|   (Phase 22, future)      |     |   (audio waveform, etc.) |
+---------------------------+     +---------------------------+
```

---

## 5. Integration with Blade System

### 5.1 Two-Column Staging and the Blade Stack

The two-column layout lives entirely WITHIN the `staging-changes` root blade. It does NOT push a new blade when a file is selected. The blade stack stays at depth 1:

```
Blade Stack (normal state):
  [0] { type: "staging-changes", id: "root", props: {} }
      ^--- active blade, rendered as StagingChangesBlade
           which internally contains SplitPaneLayout
```

Only when the user clicks "expand" does a new blade get pushed:

```
Blade Stack (after expand):
  [0] { type: "staging-changes", id: "root", props: {} }   <- collapsed BladeStrip
  [1] { type: "diff", id: "xxx", props: { source: {...} }} <- active DiffBlade
```

### 5.2 Expand: Pushing the Full DiffBlade

When the user clicks the expand button in `DiffPreviewHeader`:

```typescript
function handleExpand() {
  const { selectedFile, selectedSection, saveScrollPosition } = useStagingStore.getState();
  if (!selectedFile || !selectedSection) return;

  // 1. Save scroll position before navigating away
  if (editorRef.current) {
    saveScrollPosition(selectedFile.path, editorRef.current.getScrollTop());
  }

  // 2. Push the full blade via existing navigation
  openStagingDiff(selectedFile, selectedSection);
}
```

This reuses `openStagingDiff` from `useBladeNavigation`, which already routes to the correct blade type (diff, viewer-image, viewer-markdown, etc.).

### 5.3 State Preservation on Back

When the user presses Back (or Escape) from the full DiffBlade:
1. `popBlade()` is called, removing the DiffBlade from the stack.
2. `staging-changes` becomes the active blade again.
3. `StagingChangesBlade` re-renders with `SplitPaneLayout`.
4. `useStagingStore` still has `selectedFile` and `selectedSection` set.
5. The diff panel immediately shows the same file.
6. Scroll position is restored from `scrollPositions[filePath]` via Monaco's `setScrollTop()`.

No changes to the blade store are needed. The staging store acts as the persistence layer.

### 5.4 File Navigation in Full-Screen DiffBlade

The CONTEXT.md specifies: "next/prev arrows in the full-screen diff blade to navigate files without going back." This requires the full DiffBlade to know about the staging file list.

Approach: Add optional `navigation` props to the diff blade registration:

```typescript
// Extend BladePropsMap for the diff type
"diff": {
  source: DiffSource;
  navigation?: {
    /** Ordered list of all navigable files */
    files: Array<{ file: FileChange; section: "staged" | "unstaged" | "untracked" }>;
    /** Index of current file in the list */
    currentIndex: number;
  };
};
```

When `navigation` is present, `DiffBlade` renders prev/next arrows in its header. Clicking next/prev calls `replaceBlade` with the new file's diff source.

However, this adds complexity to the `DiffBlade` props. A cleaner alternative:

**Alternative (recommended)**: Create a `StagingDiffBlade` wrapper that extends `DiffBlade` with navigation. This keeps the generic `DiffBlade` simple:

```typescript
// No new blade type needed. Instead, modify openStagingDiff to pass navigation data.
// The DiffBlade already has renderTrailing in its registration -- use that.
```

Actually, the cleanest approach is to leverage the blade registration's `renderTrailing` hook. The diff registration already supports `renderTrailing`. We can make `openStagingDiff` pass navigation metadata and render prev/next buttons in the trailing slot.

**Recommended approach**: Store the navigation context in the staging store, not in blade props. The DiffBlade is unmodified. Instead, create a tiny `StagingDiffNavigation` component that reads from `useStagingStore` and renders prev/next arrows. This component is placed in the `renderTrailing` slot only when the diff is opened from staging context.

This is a detail that can be refined during implementation. For Phase 21, the core requirement is prev/next navigation -- the exact mechanism (blade props vs store-based) is an implementation choice. The store-based approach is recommended because it avoids modifying `BladePropsMap`.

### 5.5 Should the Staging Blade Store State in the Blade Stack Entry?

**No.** The staging blade's props remain `Record<string, never>`. All stateful data (selected file, scroll positions, view mode) lives in `useStagingStore`, which is a Zustand store that persists across blade stack changes. This is consistent with how `useTopologyStore` works for the topology process -- it stores `selectedCommit` separately from the blade stack.

---

## 6. Performance Considerations

### 6.1 Monaco DiffEditor in a Smaller Panel

The Monaco DiffEditor will run in a panel that is approximately 60% of the blade area (which is 80% of the window). On a 1440px-wide screen, this is roughly `1440 * 0.8 * 0.6 = 691px`. This is well within Monaco's comfort zone.

Key settings for the inline preview:

```typescript
{
  readOnly: true,
  renderSideBySide: false,       // Always inline in the preview panel
  automaticLayout: true,          // Critical: auto-resize when panel resizes
  minimap: { enabled: false },    // Save horizontal space
  scrollBeyondLastLine: false,
  fontSize: 12,                   // Slightly smaller for compact view
  lineNumbers: "on",
  folding: false,                 // Save space, simplify
  wordWrap: "off",
  renderLineHighlight: "none",    // Less visual noise
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
}
```

`automaticLayout: true` is essential because `react-resizable-panels` will change the container width during drag. Monaco must re-measure its container.

### 6.2 Lazy Loading the Diff

The diff should be loaded on-demand when a file is selected, not preloaded for all files. This is already the natural behavior with `useQuery`:

```typescript
// InlineDiffViewer renders with the selected file's source
// useQuery fires when the component mounts or source changes
const { data, isLoading } = useQuery({
  queryKey: ["fileDiff", source.filePath, source.staged, 3],
  queryFn: () => commands.getFileDiff(source.filePath, source.staged, 3),
  staleTime: 5000,  // Cache for 5 seconds to avoid flicker on rapid selection changes
});
```

When the user navigates between files with arrow keys, each new file triggers a new query. The previous file's data is cached by react-query and available instantly if the user navigates back.

### 6.3 Debouncing Rapid File Selection

If the user holds down an arrow key, we should not fire a diff query for every intermediate file. Options:

1. **react-query deduplication**: Already handles concurrent requests to the same key. But different files have different keys, so multiple queries would fire.
2. **Debounce selection in the hook**: Add a 150ms debounce to the diff query's `enabled` flag:

```typescript
// In InlineDiffViewer
const [debouncedSource, setDebouncedSource] = useState(source);

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSource(source), 150);
  return () => clearTimeout(timer);
}, [source.filePath, source.staged]);

const { data, isLoading } = useQuery({
  queryKey: ["fileDiff", debouncedSource.filePath, debouncedSource.staged, 3],
  queryFn: () => commands.getFileDiff(debouncedSource.filePath, debouncedSource.staged, 3),
});
```

This means Monaco will only fetch diffs for files the user "settles on" for 150ms+. During rapid navigation, the previous diff stays visible (no flicker).

### 6.4 File List Virtualization

For large repos with hundreds of changed files, the file list should be virtualized. However, this is a separate concern from Phase 21's core feature. The current `FileTreeView` renders all files directly.

**Recommendation**: Defer virtualization to a follow-up phase. The tree view with collapsible folders naturally reduces the visible DOM nodes. For Phase 21, test with a realistic upper bound (e.g., 200 changed files) and optimize if needed.

If virtualization is needed later, use `@tanstack/react-virtual` which is already in the dependency tree (via `@tanstack/react-query`). Actually, `react-virtual` is a separate package. Check if it's needed.

### 6.5 Monaco Instance Lifecycle

The Monaco DiffEditor creates a heavy instance. When the user selects a different file, we should NOT destroy and recreate the editor. Instead, update the `original` and `modified` props, which Monaco handles efficiently by diffing the new content.

The `@monaco-editor/react` `DiffEditor` component already handles this -- it updates the models when props change rather than recreating the editor. No special handling needed.

### 6.6 Memoization Strategy

```typescript
// StagingChangesBlade -- memoize the StagingPanel to prevent re-renders when only diff changes
const MemoizedStagingPanel = React.memo(StagingPanel);

// StagingDiffPreview -- memoize the InlineDiffViewer to prevent re-renders when only header changes
const MemoizedInlineDiffViewer = React.memo(InlineDiffViewer);
```

The `SplitPaneLayout` itself does not need memoization since it receives `ReactNode` children and `react-resizable-panels` handles its own internal state.

---

## 7. Implementation Plan Summary

### Phase 21 File Inventory

```
NEW FILES:
  src/components/layout/SplitPaneLayout.tsx           -- Generic two-column layout
  src/components/staging/StagingDiffPreview.tsx        -- Diff preview orchestrator
  src/components/staging/InlineDiffViewer.tsx          -- Monaco DiffEditor wrapper for inline
  src/components/staging/DiffPreviewHeader.tsx         -- Header with filename, expand, nav
  src/components/staging/NonTextPlaceholder.tsx        -- Placeholder for non-text files
  src/lib/previewRegistry.ts                          -- Preview type registry
  src/components/staging/previewRegistrations.ts       -- Default preview registrations
  src/lib/fileTypeUtils.ts                            -- Shared file-type detection utilities
  src/hooks/useStagingKeyboard.ts                     -- Keyboard navigation for staging

MODIFIED FILES:
  src/components/blades/StagingChangesBlade.tsx        -- Use SplitPaneLayout
  src/components/staging/StagingPanel.tsx              -- Remove onFileSelect, add reconciliation
  src/components/staging/FileItem.tsx                  -- Selection-only (no blade push)
  src/stores/staging.ts                               -- Add scrollPositions, navigation helpers
  src/components/layout/index.ts                       -- Export SplitPaneLayout
```

### Dependency Graph

```
previewRegistry.ts (standalone, no deps)
     |
     +--- previewRegistrations.ts (imports previewRegistry + lucide icons)
     |
fileTypeUtils.ts (extracts from useBladeNavigation.ts)
     |
SplitPaneLayout.tsx (standalone, wraps react-resizable-panels)
     |
NonTextPlaceholder.tsx (standalone UI component)
     |
InlineDiffViewer.tsx (depends on: bindings, monacoTheme, DiffSource type)
     |
DiffPreviewHeader.tsx (standalone UI component)
     |
StagingDiffPreview.tsx (depends on: InlineDiffViewer, DiffPreviewHeader,
     |                   NonTextPlaceholder, previewRegistry)
     |
useStagingKeyboard.ts (depends on: staging store, react-hotkeys-hook)
     |
staging.ts (store modification)
     |
StagingPanel.tsx (modified: selection reconciliation)
     |
FileItem.tsx (modified: selection-only behavior)
     |
StagingChangesBlade.tsx (depends on everything above)
```

### Suggested Implementation Order

1. `SplitPaneLayout` -- pure layout, testable independently
2. `staging.ts` store changes -- add `scrollPositions`, `saveScrollPosition`, `clearScrollPositions`
3. `fileTypeUtils.ts` -- extract `bladeTypeForFile` and add `isTextDiffable`
4. `previewRegistry.ts` + `previewRegistrations.ts` -- registry infrastructure
5. `NonTextPlaceholder.tsx` -- simple placeholder component
6. `InlineDiffViewer.tsx` -- Monaco DiffEditor in compact mode
7. `DiffPreviewHeader.tsx` -- header bar with expand and nav buttons
8. `StagingDiffPreview.tsx` -- orchestrator that combines the above
9. `FileItem.tsx` modification -- selection-only (remove blade push)
10. `StagingPanel.tsx` modification -- reconciliation effect, remove `onFileSelect`
11. `StagingChangesBlade.tsx` -- wire up `SplitPaneLayout` with both panels
12. `useStagingKeyboard.ts` -- keyboard navigation
13. Full DiffBlade prev/next navigation (optional, can be a sub-phase)

---

*Research completed: 2026-02-07*
*Phase: 21 -- Two-Column Staging & Inline Diff*
*Researcher: Architecture Agent*
