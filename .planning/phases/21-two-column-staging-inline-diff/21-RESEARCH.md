# Phase 21: Two-Column Staging & Inline Diff - Research

**Researched:** 2026-02-07
**Domain:** React split-pane UI, Monaco DiffEditor, keyboard navigation, extensible component architecture
**Confidence:** HIGH
**Research Method:** 3-agent parallel research (UX specialist, architecture specialist, expert developer)

## Summary

Phase 21 transforms the staging blade from a full-width file list (that pushes a new blade on file click) into a two-column split-pane layout with an inline diff preview. The research was conducted by three specialized agents exploring UX patterns, component architecture, and implementation details in parallel.

Key findings:
- The existing codebase is **exceptionally well-prepared** for this change: `react-resizable-panels` is already integrated, Monaco DiffEditor is configured with Catppuccin theming, the staging store already tracks `selectedFile`/`selectedSection`, and the blade registration with `wrapInPanel: false` gives full layout control.
- **No new Rust commands or npm packages needed.** Everything required is already installed and working.
- The refactoring focus yields a reusable `SplitPaneLayout` component and a `previewRegistry` pattern that future blades (repo-browser, commit-details) can leverage.
- GitKraken's instant-diff-on-select model is the UX gold standard to follow, improved with keyboard navigation (Sublime Merge style) and tree view support.

**Primary recommendation:** Refactor `StagingChangesBlade` in-place to contain a nested `ResizablePanelLayout` with file list (40%) and inline diff preview (60%). Selection stays in `useStagingStore`. Expand delegates to existing `openStagingDiff()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 1. File Selection Behavior
| Decision | Choice |
|----------|--------|
| Auto-select on load | **Yes** — first file auto-selected, diff shown immediately (no empty state) |
| Stage/unstage while viewing | **Keep showing same file** — diff stays visible, file moves between sections in the list |
| Last file staged/unstaged | Same file stays visible in its new section |
| Keyboard navigation | **Yes** — arrow keys move selection through the file list, diff updates immediately |

#### 2. Layout Split & Responsiveness
| Decision | Choice |
|----------|--------|
| Default column ratio | **40% file list / 60% diff preview** |
| Resizable | **Yes** — drag handle between columns (consistent with existing left sidebar pattern) |
| Narrow behavior | **Proportional shrink** — both columns shrink, no layout collapse |
| Min widths | Apply reasonable minimums to keep both panels usable |

#### 3. Inline Diff ↔ Full Blade Transition
| Decision | Choice |
|----------|--------|
| Expand action | **Push new blade** on top of staging — back returns to two-column view with same file selected |
| Expand button position | **Small icon in top-right corner** of the diff panel (maximize-style icon) |
| State preservation on back | Yes — same file selected, same scroll position ideally |
| File navigation in full-screen | **Yes** — next/prev arrows in the full-screen diff blade to navigate files without going back |

#### 4. Diff Preview Scope
| Decision | Choice |
|----------|--------|
| Inline viewer scope | **Text diffs only** — non-text files show a "click to expand" prompt in the inline panel |
| Diff engine | **Monaco DiffEditor** — same editor as full-screen blade for consistent experience |
| Binary files | Show placeholder with file type icon and "Binary file — click to expand" |
| Image files | Show placeholder, not inline preview — expand to see specialized viewer |

### Claude's Discretion
No explicit discretion areas documented. Implementation details are at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)
None captured during discussion.
</user_constraints>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-resizable-panels` | 4.6.0 | Split-pane layout with drag resize | Already used for sidebar/blade split; `autoSaveId` persists sizes |
| `@monaco-editor/react` | 4.7.0 | Monaco DiffEditor for inline diff | Already used in DiffBlade; Catppuccin theme configured |
| `react-hotkeys-hook` | 5.2.4 | Keyboard shortcut management | Already used throughout app for global shortcuts |
| `framer-motion` | 12.31.0 | Blade transition animations | Already used in BladeContainer; AnimatePresence for push/pop |
| `lucide-react` | latest | Icons (Maximize2, ChevronLeft/Right) | Already used throughout app |

### No New Dependencies
All required libraries are already in `package.json`. No new npm packages or Rust crates needed.

## Architecture Patterns

### Current Component Tree (Before Phase 21)
```
StagingChangesBlade (wrapInPanel: false, showBack: false)
  └── StagingPanel (onFileSelect → openStagingDiff → pushBlade)
        ├── FileTreeSearch
        ├── Section: Staged Changes → FileTreeView/FileList → FileItem
        ├── Section: Changes → FileTreeView/FileList → FileItem
        └── Section: Untracked → FileTreeView/FileList → FileItem
```
On file click: pushes full DiffBlade (navigates away from file list).

### Target Component Tree (After Phase 21)
```
StagingChangesBlade
  └── ResizablePanelLayout (autoSaveId="staging-split")
        ├── ResizablePanel (40%, id="staging-files")
        │     └── StagingPanel (NO onFileSelect — selection is store-driven)
        │           ├── FileTreeSearch
        │           ├── Section: Staged → FileTreeView/FileList → FileItem
        │           ├── Section: Changes → FileTreeView/FileList → FileItem
        │           └── Section: Untracked → FileTreeView/FileList → FileItem
        │
        ├── ResizeHandle
        │
        └── ResizablePanel (60%, id="staging-diff")
              └── StagingDiffPreview
                    ├── DiffPreviewHeader (file path, expand button)
                    ├── InlineDiffViewer (Monaco DiffEditor) — for text files
                    └── NonTextPlaceholder — for binary/image/other files
```

### Pattern 1: Store-Driven Selection
**What:** File selection state lives in `useStagingStore` (Zustand), not in component state or blade props.
**Why:** Persists across stage/unstage mutations, blade push/pop (expand/back), and query refetches.
**Key insight:** `useStagingStore.selectedFile` already exists and is written by `FileItem.handleSelect()`. Phase 21 simply stops the blade push that currently follows selection.

### Pattern 2: Nested ResizablePanelLayout
**What:** The staging blade nests a second `ResizablePanelLayout` inside the blade container.
**Why:** The outer layout (sidebar/blades) and inner layout (file-list/diff) are independent concerns. `autoSaveId` gives each persistent sizing.
**Layout:** `repo-layout` (outer) → `staging-split` (inner). Both use the same `ResizeHandle` component with Catppuccin styling.

### Pattern 3: Reusable Preview Registry
**What:** A `previewRegistry` maps file extensions to preview modes (inline-diff, placeholder, custom).
**Why:** Mirrors the blade registry pattern. New preview types can be added without modifying the `StagingDiffPreview` component.
**Registrations:** text-diff (default), binary (placeholder), image (placeholder), 3D model (placeholder), archive (placeholder).

### Pattern 4: Expand via Existing Blade Navigation
**What:** The "expand to full blade" button calls `openStagingDiff()` which already handles file-type routing.
**Why:** No new blade types needed. The existing diff/viewer blades handle all file types. Back-navigation pops to the staging blade, which restores from the staging store.

### Anti-Patterns to Avoid
- **Don't create a new blade type for the two-column layout.** Refactor `staging-changes` in-place.
- **Don't wrap Monaco in AnimatePresence.** This causes mount/unmount which destroys the editor instance. Use a loading overlay instead.
- **Don't virtualize the file list yet.** Defer to Phase 22 if needed — current rendering handles typical repo sizes.
- **Don't use `role="tree"` for ARIA.** The interaction model is flat single-select; use `role="listbox"` with `role="option"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable split pane | Custom drag handler + CSS | `react-resizable-panels` v4.6.0 | Already in codebase; handles persistence, a11y, touch events |
| Diff computation | Custom text diff | Monaco DiffEditor `renderSideBySide: false` | Already configured with Catppuccin theme; handles large files |
| File type detection | Custom extension parser | Extract `bladeTypeForFile()` from `useBladeNavigation.ts` | Already handles all file types with correct blade routing |
| Keyboard shortcuts | Raw `addEventListener` | `react-hotkeys-hook` v5.2.4 | Already used for all app shortcuts; handles modifier keys, conflicts |
| Panel size persistence | Custom localStorage code | `react-resizable-panels` `autoSaveId` | Built-in; handles edge cases like window resize |

## Common Pitfalls

### Pitfall 1: Monaco in AnimatePresence
**What goes wrong:** Wrapping Monaco DiffEditor in `AnimatePresence` causes full mount/unmount on file switch, destroying the editor instance (~100ms re-creation cost, flicker).
**How to avoid:** Keep Monaco mounted; update `original`/`modified` props. Show a loading overlay with `AnimatePresence` separately.

### Pitfall 2: Staging Poll Causing Diff Flicker
**What goes wrong:** Staging status polls every 2s. If the diff query has `staleTime: 0`, each status refetch could trigger a diff refetch, causing brief flicker.
**How to avoid:** Set `staleTime: 5000` for inline diff queries. Use `keepPreviousData: true` to show the old diff while the new one loads.

### Pitfall 3: File Selection Lost After Stage/Unstage
**What goes wrong:** Staging a file moves it from "Changes" to "Staged Changes" in the data. If selection tracking uses array index, the selection jumps.
**How to avoid:** Track selection by file path (`selectedFile.path`), not by index. After status refetch, reconcile by finding the file's new section.

### Pitfall 4: Keyboard Conflict Between File List and Monaco
**What goes wrong:** Arrow keys intended for file navigation are captured by Monaco when it has focus.
**How to avoid:** Only enable file-list keyboard shortcuts when the file list panel has focus. Use `enabled` flag on `useHotkeys`. Tab moves focus between panels.

### Pitfall 5: Scroll Position Lost on Blade Pop
**What goes wrong:** When a diff blade is pushed, the staging blade is unmounted (replaced by BladeStrip). File list scroll position is lost.
**How to avoid:** Save `fileListScrollTop` to `useStagingStore` before unmount. Restore on remount via `useEffect` + `scrollRef.current.scrollTop`.

## Code Examples

### Monaco DiffEditor Configuration (Inline Preview)
```typescript
const INLINE_DIFF_OPTIONS: editor.IDiffEditorConstructionOptions = {
  readOnly: true,
  originalEditable: false,
  renderSideBySide: false,     // Always inline in preview
  automaticLayout: true,       // Auto-resize on panel drag
  scrollBeyondLastLine: false,
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: "on",
  folding: false,
  wordWrap: "on",              // Prevent horizontal scroll in narrow panel
  renderLineHighlight: "none",
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
  overviewRulerBorder: false,
  renderOverviewRuler: false,
  glyphMargin: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 3,
};
```

### Keyboard Navigation Hook
```typescript
function useStagingKeyboard(options: {
  allFiles: Array<{ file: FileChange; section: Section }>;
  enabled: boolean;
  onExpand?: () => void;
  onToggleStage?: () => void;
}) {
  const { selectedFile, selectFile } = useStagingStore();
  const currentIndex = allFiles.findIndex(item => item.file.path === selectedFile?.path);

  useHotkeys("down", () => { /* select next file */ }, { enabled });
  useHotkeys("up", () => { /* select prev file */ }, { enabled });
  useHotkeys("enter", () => onExpand?.(), { enabled: enabled && !!selectedFile });
  useHotkeys("space", () => onToggleStage?.(), { enabled: enabled && !!selectedFile, preventDefault: true });
}
```

### File Selection Reconciliation After Stage/Unstage
```typescript
useEffect(() => {
  if (!selectedFile) return;
  const filePath = selectedFile.path;
  if (status.staged.some(f => f.path === filePath)) {
    selectFile(status.staged.find(f => f.path === filePath)!, "staged");
  } else if (status.unstaged.some(f => f.path === filePath)) {
    selectFile(status.unstaged.find(f => f.path === filePath)!, "unstaged");
  } else if (status.untracked.some(f => f.path === filePath)) {
    selectFile(status.untracked.find(f => f.path === filePath)!, "untracked");
  }
}, [status]);
```

### Next/Prev File Navigation in Full Diff Blade
```typescript
// Use replaceBlade (not pushBlade) to swap without growing the stack
const handleNavigate = (file: FileChange, section: string) => {
  store.replaceBlade({
    type: "diff",
    title: file.path.split("/").pop() || file.path,
    props: {
      source: { mode: "staging", filePath: file.path, staged: section === "staged" },
    },
  });
  useStagingStore.getState().selectFile(file, section);
};
```

## State Management Design

### Extended Staging Store
```typescript
interface StagingState {
  // Existing
  selectedFile: FileChange | null;
  selectedSection: "staged" | "unstaged" | "untracked" | null;
  viewMode: "tree" | "flat";
  selectFile: (file, section?) => void;
  setViewMode: (mode) => void;

  // New for Phase 21
  scrollPositions: Record<string, number>;  // filePath -> Monaco scrollTop
  fileListScrollTop: number;                // file list container scrollTop
  saveScrollPosition: (filePath: string, scrollTop: number) => void;
  setFileListScrollTop: (top: number) => void;
  clearScrollPositions: () => void;
}
```

### Diff Data Flow
```
selectedFile (store) → InlineDiffViewer → useQuery(["fileDiff", path, staged, 3])
                                                ↓
                                        commands.getFileDiff(path, staged, 3) [Tauri IPC]
                                                ↓
                                        get_file_diff() [Rust, ~5-10ms per file]
                                                ↓
                                        FileDiff { oldContent, newContent, isBinary, language }
                                                ↓
                                        Monaco DiffEditor renders inline diff
```

## Accessibility

### ARIA Structure
- Outer: `role="region" aria-label="Staging view"`
- File list panels: `role="listbox" aria-label="Staged changes"` (per section)
- File items: `role="option" aria-selected="true/false"`
- Resize handle: `role="separator" aria-orientation="vertical"` (handled by react-resizable-panels)
- Diff panel: `role="region" aria-label="Diff preview"`
- No focus traps (non-modal split view)

### Key Accessibility Requirements
- Tab moves focus between file list and diff panels
- Arrow keys navigate files when file list is focused
- Screen reader announces file selections via `aria-live="polite"`
- Stage/unstage announced via `aria-live="polite"` status region
- `motion-safe:` prefix on blade animations respects `prefers-reduced-motion`
- Color not sole indicator of file status (border + text labels)

## File Inventory

### New Files (9)
| File | Purpose |
|------|---------|
| `src/components/layout/SplitPaneLayout.tsx` | Generic reusable two-column layout |
| `src/components/staging/StagingDiffPreview.tsx` | Orchestrates diff preview: routes to viewer or placeholder |
| `src/components/staging/InlineDiffViewer.tsx` | Monaco DiffEditor in compact inline mode |
| `src/components/staging/DiffPreviewHeader.tsx` | Header bar with file path, expand button |
| `src/components/staging/NonTextPlaceholder.tsx` | Placeholder for binary/image/non-text files |
| `src/lib/previewRegistry.ts` | Registry mapping file types to preview components |
| `src/components/staging/previewRegistrations.ts` | Default preview type registrations |
| `src/lib/fileTypeUtils.ts` | Shared file-type detection (extracted from useBladeNavigation) |
| `src/hooks/useStagingKeyboard.ts` | Keyboard navigation for file list |

### Modified Files (5)
| File | Change |
|------|--------|
| `src/components/blades/StagingChangesBlade.tsx` | Replace single `StagingPanel` with `SplitPaneLayout` + `StagingDiffPreview` |
| `src/components/staging/StagingPanel.tsx` | Remove `onFileSelect` blade-push behavior; add selection reconciliation |
| `src/components/staging/FileItem.tsx` | Selection-only (no blade push); add `isActive` visual for current diff target |
| `src/stores/staging.ts` | Add `scrollPositions`, `fileListScrollTop`, navigation helpers |
| `src/components/blades/DiffBlade.tsx` | Add next/prev file navigation for staging mode |

### Unchanged Files
- No Rust backend changes needed (`get_file_diff` already sufficient)
- No new blade types needed (refactor in-place)
- No blade registry changes needed
- No new dependencies needed

## Competitive Analysis Summary

| Feature | VS Code | GitKraken | Sublime Merge | Fork | Tower | **FlowForge** |
|---------|---------|-----------|---------------|------|-------|---------------|
| Split pane staging | No | Yes | Yes | Yes | Yes | **Yes** |
| Instant diff on select | Yes | Yes | Yes | Yes | Yes | **Yes** |
| Tree view in file list | Yes | No | No | Yes | No | **Yes** |
| Keyboard navigation | Good | Poor | Excellent | Good | Good | **Excellent** |
| Expand to full diff | Tab-based | New window | N/A | N/A | N/A | **Push blade** |
| Resize handle | N/A | Hidden | Visible | Visible | Visible | **Visible** |

## Open Questions

1. **Debounce duration for rapid keyboard navigation:** 150ms recommended but may need tuning during implementation.
2. **File list virtualization threshold:** Defer to Phase 22 unless testing reveals performance issues with 200+ files.
3. **Monaco scroll position restoration:** Best-effort on inline preview (Monaco recreates on mount). May not be pixel-perfect.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All 15+ relevant source files read and analyzed by architecture and developer agents
- `react-resizable-panels` v4.6.0 API: Verified via existing usage in `ResizablePanelLayout.tsx`
- `@monaco-editor/react` v4.7.0 API: Verified via existing usage in `DiffBlade.tsx`
- `react-hotkeys-hook` v5.2.4 API: Verified via existing usage in `useKeyboardShortcuts.ts`

### Secondary (MEDIUM confidence)
- Competitive analysis of Git GUIs (GitKraken, Sublime Merge, Fork, Tower, SourceTree, VS Code)
- Monaco DiffEditor `automaticLayout` behavior with ResizeObserver

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in codebase and working
- Architecture: HIGH — based on thorough codebase exploration by architecture agent
- Implementation: HIGH — developer agent verified every file path and API signature
- UX patterns: MEDIUM — based on competitive analysis and general UX principles
- Performance: HIGH — Monaco in 60% panel (~700px) is well within comfort zone

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (stable codebase, no framework upgrades planned)

## Detailed Research Files

For deeper analysis on specific topics, see the individual research files:
- `research-ux.md` — Competitive analysis, interaction patterns, accessibility, keyboard UX
- `research-architecture.md` — Component hierarchy, state management, extensibility patterns, blade integration
- `research-developer.md` — Monaco API, Tailwind v4, Rust backend, code-level implementation details
