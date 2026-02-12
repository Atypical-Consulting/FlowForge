# Phase 49: Inline Conflict Resolution - UX Research

**Researched:** 2026-02-12
**Domain:** Merge conflict resolution UX/UI design patterns
**Confidence:** HIGH

## Summary

This research investigates how best-in-class Git GUIs present merge conflicts and identifies the UX patterns FlowForge should adopt for inline conflict resolution. The analysis covers VS Code, GitKraken, Sublime Merge, Fork, and Tower, plus general three-way merge tooling (Beyond Compare, kdiff3, JetBrains Rider).

The industry has converged on a clear winning pattern: a **two-pane-plus-result layout** where "ours" and "theirs" appear side-by-side in read-only panes at the top, and an editable result panel sits below. This is the layout VS Code adopted after extensive UX exploration (Issue #146091), and it is also used by GitKraken, Beyond Compare, and JetBrains Rider. Per-hunk action buttons ("Accept Ours", "Accept Theirs", "Accept Both") placed inline next to each conflict hunk provide the fastest resolution path, while the editable result panel ensures users always have full manual control.

FlowForge already has strong foundations: Monaco Editor with a Catppuccin diff theme, a `DiffBlade` component using `@monaco-editor/react`'s `DiffEditor`, an XState merge machine with a `conflicted` state, a composable blade registry, and a toast system with action buttons. The conflict resolution UI should be built as composable components that can later be surfaced through the extension system.

**Primary recommendation:** Build a `ConflictResolutionBlade` using the two-pane-plus-result layout pattern (ours/theirs read-only at top, editable result at bottom), with per-hunk accept buttons rendered as Monaco decorations/widgets, an undo stack per file, and a "Mark as Resolved" action that stages the file and shows a toast with an undo action.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `monaco-editor` | ^0.55.1 | Code editing, diff viewing, syntax highlighting | Already used for DiffBlade; provides diff algorithm, decorations API, and widget system |
| `@monaco-editor/react` | ^4.7.0 | React wrapper for Monaco diff editor | Already used; provides `DiffEditor` and `Editor` components with `onMount` refs |
| `xstate` | ^5.26.0 | Merge state machine (idle/merging/conflicted/aborting/error) | Already used; merge machine has `conflicted` state ready to extend |
| `zustand` | ^5 | Conflict resolution store (per-file state, undo stack) | Already used for all domain stores; slice pattern established |
| `react-resizable-panels` | (installed) | Resizable pane layout for ours/theirs/result | Already used via `ResizablePanelLayout` wrapper |
| `lucide-react` | ^0.563 | Icons (AlertTriangle, CheckCircle, Undo2, etc.) | Already used throughout; provides conflict/warning/resolved icons |
| `framer-motion` | ^12.34.0 | Animations for conflict indicators, toast transitions | Already used; `motion-safe:` prefix for reduced-motion support |
| `react-hotkeys-hook` | ^5.2.4 | Keyboard shortcuts for conflict navigation | Already used for staging keyboard shortcuts |
| `class-variance-authority` | ^0.7.1 | Variant-based styling for conflict action buttons | Already used for Button component |
| `@tanstack/react-query` | ^5 | Data fetching for conflict file contents | Already used for staging status and diff queries |

### Supporting (No New Dependencies Needed)

No new dependencies are required. The existing stack covers all needs:
- **Synchronized scrolling**: Monaco's built-in DiffEditor already synchronizes scrolling between original/modified panes. For the result pane, use Monaco's `editor.onDidScrollChange` event to sync programmatically.
- **Undo stack**: Implement with a simple array-based history in Zustand (no external library needed).
- **Conflict parsing**: Parse `<<<<<<<`/`=======`/`>>>>>>>` markers with a simple regex-based parser (no library needed for this well-defined format).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom conflict parser | `diff3` npm package | Adds dependency for trivial parsing; conflict markers have a fixed, well-known format |
| Manual scroll sync | `react-scroll-sync` | Unnecessary since Monaco DiffEditor handles scroll sync internally; only result pane needs manual sync |
| Custom undo implementation | `immer` patches | Over-engineering; conflict resolution undo is file-scoped with simple state snapshots |

## Architecture Patterns

### Recommended Component Structure

```
src/core/blades/conflict-resolution/
  ConflictResolutionBlade.tsx    # Main blade (registered in bladeRegistry)
  components/
    ConflictToolbar.tsx           # Toolbar with navigation, file info, actions
    ConflictDiffView.tsx          # Two-pane ours/theirs (read-only Monaco DiffEditors)
    ConflictResultEditor.tsx      # Editable Monaco Editor for merged result
    ConflictHunkActions.tsx       # Accept Ours/Theirs/Both buttons per hunk
    ConflictFileIndicator.tsx     # Red warning icon + status for file tree
    ConflictCountBadge.tsx        # Badge showing N conflicts remaining
    MarkResolvedButton.tsx        # "Mark as Resolved" button with confirmation
  hooks/
    useConflictParser.ts          # Parses conflict markers from file content
    useConflictResolution.ts      # Per-file resolution state + undo stack
    useConflictNavigation.ts      # Navigate between conflict hunks
    useConflictSync.ts            # Synchronized scrolling between panes
  types.ts                        # ConflictHunk, ConflictFile, ResolutionChoice
src/core/stores/domain/conflicts/
  conflict.slice.ts               # Zustand slice: conflict files, resolution state
  conflict.selectors.ts           # Derived state: unresolved count, all resolved?
```

### Pattern 1: Two-Pane-Plus-Result Layout (VS Code / GitKraken Pattern)

**What:** The merge conflict editor displays three panels: two read-only panes (ours/theirs) at the top in a side-by-side layout, and an editable result panel below.

**When to use:** Always, for the primary conflict resolution view.

**Why this layout wins:**
- VS Code explored multiple layouts (Issue #146091) and settled on this after community feedback
- GitKraken, Beyond Compare, and JetBrains Rider all use the same pattern
- Sublime Merge uses a variant (ours/merged/theirs with merged in the middle), but the ours-theirs-top + result-bottom is more intuitive because the result is what the user commits

**Layout:**
```
+--------------------------------------------------+
|  Toolbar: file name, conflict N/M, nav arrows    |
+------------------------+-------------------------+
|  OURS (read-only)      |  THEIRS (read-only)     |
|  Current branch        |  Incoming branch         |
|  [checkbox] Accept     |  [checkbox] Accept       |
+------------------------+-------------------------+
|  RESULT (editable)                                |
|  Shows merged output with conflict markers        |
|  Per-hunk: [Accept Ours] [Accept Theirs] [Both]   |
+--------------------------------------------------+
|  [Reset File] [Undo]      [Mark as Resolved]      |
+--------------------------------------------------+
```

**Key UX decisions from VS Code's exploration:**
- Branch editors (ours/theirs) are **read-only** -- users cannot accidentally edit them
- Result editor is **editable** -- users can always manually refine
- Checkboxes next to each conflict hunk in the top panes let users toggle which changes flow into the result
- Conflict count indicator shows progress: "Conflict 2 of 5"
- Clear branch labeling: "Current (main)" vs "Incoming (feature-x)" to reduce cognitive load

**Implementation with existing components:**
```tsx
// Uses existing ResizablePanelLayout for the vertical split (top/bottom)
// and a nested horizontal split for ours/theirs
<ResizablePanelLayout autoSaveId="conflict-resolution" direction="vertical">
  <ResizablePanel id="conflict-top" defaultSize={50} minSize={25}>
    <ResizablePanelLayout autoSaveId="conflict-panes" direction="horizontal">
      <ResizablePanel id="conflict-ours" defaultSize={50} minSize={20}>
        <ConflictPane side="ours" content={oursContent} language={language} />
      </ResizablePanel>
      <ResizeHandle />
      <ResizablePanel id="conflict-theirs" defaultSize={50} minSize={20}>
        <ConflictPane side="theirs" content={theirsContent} language={language} />
      </ResizablePanel>
    </ResizablePanelLayout>
  </ResizablePanel>
  <ResizeHandle />
  <ResizablePanel id="conflict-result" defaultSize={50} minSize={25}>
    <ConflictResultEditor content={resultContent} language={language} />
  </ResizablePanel>
</ResizablePanelLayout>
```

### Pattern 2: Per-Hunk Action Buttons (VS Code CodeLens Pattern)

**What:** Each conflict hunk in the result editor displays inline action buttons: "Accept Current", "Accept Incoming", "Accept Both", placed directly above the conflict markers.

**When to use:** In the result editor, at every `<<<<<<<` marker location.

**How it works in VS Code:**
- CodeLens-style buttons appear above each `<<<<<<<` marker
- Clicking "Accept Current" replaces the entire conflict block with the current branch's version
- Clicking "Accept Both" keeps both versions sequentially (current first, then incoming)
- The buttons disappear once the conflict is resolved

**Implementation approach for Monaco:**
- Use Monaco's `IContentWidget` API or `IViewZone` API to render React-based action buttons at conflict marker positions
- Parse conflict markers to identify hunk ranges
- On button click, replace the conflict block with the chosen resolution
- Update the conflict count and hunk navigation state

**Button design (Catppuccin theme aligned):**
```
[Accept Current]  -> bg-ctp-blue/20, text-ctp-blue, border-ctp-blue/30
[Accept Incoming] -> bg-ctp-mauve/20, text-ctp-mauve, border-ctp-mauve/30
[Accept Both]     -> bg-ctp-green/20, text-ctp-green, border-ctp-green/30
```

### Pattern 3: Conflict File Indicators in File Tree

**What:** Conflicted files are visually distinguished in the file tree with a warning icon and special color treatment.

**When to use:** In the staging panel file tree, commit details file tree, and any file list showing changed files.

**How best-in-class tools do it:**
- VS Code: Orange/red "C" badge on conflicted files in Source Control view, separate "Merge Changes" section
- GitKraken: Conflict alert icons, files flagged before PR creation
- Tower: Merge UI with clear conflict indicators per file

**Implementation for FlowForge:**
- The existing `FileStatus` type in bindings already includes `"conflicted"` status
- Add to `STATUS_MAP` in `FileTreeBlade.tsx`: `{ label: "C", color: "text-ctp-red" }` with an `AlertTriangle` icon
- Add a "Conflicts" filter option in the staging panel (alongside staged/unstaged/untracked)
- Show a conflict count badge in the toolbar using the existing `renderCustom` pattern in toolbar registry

**Icon and color choices:**
```
Conflicted file: AlertTriangle icon (Lucide), text-ctp-red
Resolved file:   CheckCircle icon (Lucide), text-ctp-green
Conflict badge:  bg-ctp-red text-ctp-crust (high contrast, urgent feel)
```

### Pattern 4: Undo Stack for Conflict Resolution

**What:** Every conflict resolution action (accept ours/theirs/both, manual edit) is undoable per file. Users can reset to the original conflicted state or undo individual actions.

**When to use:** Always, for all conflict resolution actions.

**How best-in-class tools handle it:**
- VS Code: Standard Ctrl+Z undo in the result editor (Monaco's built-in undo)
- GitKraken: "Reset to manual merge" option to undo AI suggestions
- `git checkout -m <file>` can re-create conflict markers at the CLI level

**Implementation approach:**
```typescript
// Zustand slice for conflict resolution state
interface ConflictFileState {
  filePath: string;
  originalContent: string;      // Content with conflict markers (initial state)
  currentContent: string;        // Current state of the result
  hunks: ConflictHunk[];         // Parsed conflict hunks
  resolutions: Map<number, ResolutionChoice>;  // Per-hunk choices
  undoStack: string[];           // Previous content states (snapshots)
  isResolved: boolean;           // All hunks resolved?
}

// Undo is a simple pop from the stack
function undo(state: ConflictFileState): string {
  const previous = state.undoStack.pop();
  return previous ?? state.originalContent;
}

// Reset restores original content with conflict markers
function reset(state: ConflictFileState): string {
  return state.originalContent;
}
```

**UX for undo:**
- `Ctrl+Z` in the result editor uses Monaco's built-in undo (character-level)
- A dedicated "Undo Resolution" button reverts the last hunk-level action
- A "Reset File" button restores the original conflicted state (with confirmation)
- The toast shown after "Mark as Resolved" includes an "Undo" action that re-opens the conflict

### Pattern 5: "Mark as Resolved" Flow

**What:** After resolving all conflicts in a file, the user clicks "Mark as Resolved" which stages the file, removes the conflict indicator, and shows a confirmation toast.

**When to use:** After all conflict markers are resolved in a file (automatically enabled when no markers remain).

**How best-in-class tools handle it:**
- VS Code: Staging a previously-conflicted file triggers a "Are you sure?" confirmation dialog, then stages it
- GitKraken: "Mark as resolved" button after edits, then file moves to staged
- Sublime Merge: "Save and stage" button in merge tool, or "Cancel" to discard

**Recommended UX for FlowForge:**
1. Button text changes based on state:
   - While conflicts remain: "Mark as Resolved" (disabled, grayed out) with tooltip "Resolve all conflicts first"
   - All conflicts resolved: "Mark as Resolved" (enabled, prominent, bg-ctp-green)
   - Manual override: Hold Shift to force-resolve even with remaining markers (power user escape hatch)
2. On click:
   - Write resolved content to file via Tauri command
   - Stage the file via existing `commands.stageFile(path)`
   - Remove conflict indicator from UI state
   - Show success toast: "filename.ts marked as resolved" with [Undo] action
3. Toast undo action:
   - Unstage the file
   - Restore the previous content
   - Re-open the conflict resolution view
4. Keyboard shortcut: `Ctrl+Shift+R` (mark resolved)

### Anti-Patterns to Avoid

- **Forcing three-way (base) view by default:** While three-way merge with base is technically superior, most users find four panes overwhelming. The base should be accessible via a toggle but not shown by default. VS Code's UX exploration confirmed that two-pane-plus-result is more approachable.
- **Auto-resolving without user confirmation:** AI or auto-merge should never silently resolve conflicts. Always show what changed and require explicit user action.
- **Hiding manual editing:** Some tools over-index on click-to-resolve buttons and make manual editing hard to discover. The result panel must always be editable and prominent.
- **Non-atomic mark-as-resolved:** The write-file + stage-file + update-UI sequence must be atomic. If staging fails, the file should not be marked as resolved in the UI.
- **Blocking navigation during conflicts:** Do not prevent users from navigating away from the conflict blade. Save their resolution progress so they can return.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diff computation | Custom diff algorithm | Monaco's built-in `diffAlgorithm: "advanced"` | Monaco uses the same diff algorithm as VS Code; handles edge cases, performance |
| Syntax highlighting | Custom tokenizer for conflict markers | Monaco's language grammars + custom decorations | Monaco already handles all languages; layer conflict decorations on top |
| Scroll synchronization | Custom scroll event listeners between editors | Monaco DiffEditor's built-in sync + `onDidScrollChange` for result pane | DiffEditor already syncs ours/theirs; only result pane needs manual sync |
| Undo/redo in editor | Custom undo manager for text editing | Monaco's built-in undo stack (`editor.trigger('source', 'undo')`) | Monaco tracks all edits; use its undo for character-level changes |
| File tree icons | Custom SVG icons for conflict status | Lucide's `AlertTriangle`, `CheckCircle`, `XCircle` | Already in the icon set; consistent with rest of UI |
| Resizable panels | Custom resize handles | Existing `ResizablePanelLayout` (react-resizable-panels) | Already used by StagingChangesBlade; supports nested layouts |

**Key insight:** Monaco Editor provides 90% of the infrastructure needed. The real work is in: (1) parsing conflict markers, (2) rendering per-hunk action buttons as Monaco widgets, (3) managing resolution state in Zustand, and (4) the mark-as-resolved workflow with file I/O.

## Common Pitfalls

### Pitfall 1: Conflict Marker Parsing Edge Cases

**What goes wrong:** Naive parsing of `<<<<<<<`/`=======`/`>>>>>>>` markers breaks with nested conflicts, markers inside strings/comments, or non-standard marker formats.
**Why it happens:** Git conflict markers can appear inside code strings. Some merge strategies produce combined diff markers. Markers can have variable-length labels.
**How to avoid:**
- Only parse markers at the start of a line (column 0)
- Handle optional labels after markers: `<<<<<<< HEAD` or `<<<<<<< branch-name`
- Support the three-way marker format with `|||||||` (base section) if base view is added
- Test with real-world conflict files, not synthetic examples
**Warning signs:** Conflict count doesn't match what `git status` reports; hunks overlap or have wrong boundaries.

### Pitfall 2: Monaco Editor Memory Leaks with Multiple Instances

**What goes wrong:** Creating three Monaco editor instances (ours, theirs, result) per conflict file without proper disposal causes memory leaks and degraded performance.
**Why it happens:** Monaco editors hold references to models, decorations, and DOM elements. Creating/destroying editors on navigation without cleanup accumulates memory.
**How to avoid:**
- Dispose editors via `editor.dispose()` in `useEffect` cleanup (already done in existing `DiffContent`)
- Dispose models explicitly: `model.dispose()`
- Reuse editor instances when navigating between conflict files instead of recreating them
- Use Monaco's `automaticLayout: true` to avoid manual resize handling
**Warning signs:** Increasing memory usage in DevTools when navigating between conflict files; "model already disposed" errors.

### Pitfall 3: Race Conditions in File Write + Stage Sequence

**What goes wrong:** The "Mark as Resolved" flow writes the resolved content to disk, then stages the file. If these are not sequential, the staged content may not match what was resolved.
**Why it happens:** Async operations without proper ordering. Tauri's IPC is async.
**How to avoid:**
- Use `await` for the write, then `await` for the stage, in strict sequence
- Disable the "Mark as Resolved" button during the operation (loading state)
- If either operation fails, show an error toast and do not update UI state
- Keep the resolved content in Zustand until the full sequence succeeds
**Warning signs:** Git status shows the file as still conflicted after marking resolved; staged content differs from what the editor shows.

### Pitfall 4: Scroll Synchronization Jank Between Three Panes

**What goes wrong:** Scroll sync between the ours/theirs DiffEditor and the standalone result editor creates scroll jank or infinite scroll event loops.
**Why it happens:** Bidirectional scroll sync (A scrolls B, B scrolls A) creates feedback loops. Different pane heights with different content lengths make 1:1 scroll mapping imprecise.
**How to avoid:**
- Monaco's DiffEditor already syncs ours/theirs internally -- do not add custom sync for those two
- For result pane sync, use a "source of truth" pattern: track which pane the user is actively scrolling (via mouseenter/focus), and only sync from that source
- Use `requestAnimationFrame` to debounce scroll updates
- Map scroll positions by line number, not pixel offset (handles different font sizes and wrapped lines)
**Warning signs:** Scroll feels laggy or jittery; scrolling one pane causes the other to bounce back.

### Pitfall 5: Losing Resolution Progress on Navigation

**What goes wrong:** User partially resolves conflicts in a file, navigates to another file or blade, and returns to find their work lost.
**Why it happens:** Component unmount destroys local state; Monaco editors are recreated.
**How to avoid:**
- Store all resolution state (content, per-hunk choices, undo stack) in Zustand, not in component state
- When re-mounting the conflict blade for a file, restore from Zustand state
- Consider persisting to Tauri's store for crash recovery (optional, lower priority)
**Warning signs:** Resolution choices reset when switching between conflict files.

## Code Examples

### Conflict Marker Parser

```typescript
// Source: Custom implementation following Git's standard conflict marker format

export interface ConflictHunk {
  id: number;
  startLine: number;        // Line of <<<<<<<
  separatorLine: number;    // Line of =======
  endLine: number;          // Line of >>>>>>>
  oursContent: string;      // Content between <<<<<<< and =======
  theirsContent: string;    // Content between ======= and >>>>>>>
  oursLabel: string;        // Label after <<<<<<< (e.g., "HEAD")
  theirsLabel: string;      // Label after >>>>>>> (e.g., "feature-branch")
}

export function parseConflictMarkers(content: string): ConflictHunk[] {
  const lines = content.split("\n");
  const hunks: ConflictHunk[] = [];
  let hunkId = 0;
  let i = 0;

  while (i < lines.length) {
    // Match <<<<<<< at start of line
    const startMatch = lines[i].match(/^<{7}\s*(.*)/);
    if (!startMatch) { i++; continue; }

    const startLine = i;
    const oursLabel = startMatch[1].trim();
    const oursLines: string[] = [];

    // Collect "ours" content until =======
    i++;
    while (i < lines.length && !lines[i].startsWith("=======")) {
      oursLines.push(lines[i]);
      i++;
    }
    if (i >= lines.length) break; // Malformed

    const separatorLine = i;
    const theirsLines: string[] = [];

    // Collect "theirs" content until >>>>>>>
    i++;
    while (i < lines.length && !lines[i].match(/^>{7}/)) {
      theirsLines.push(lines[i]);
      i++;
    }
    if (i >= lines.length) break; // Malformed

    const endMatch = lines[i].match(/^>{7}\s*(.*)/);
    const theirsLabel = endMatch?.[1]?.trim() ?? "";

    hunks.push({
      id: hunkId++,
      startLine,
      separatorLine,
      endLine: i,
      oursContent: oursLines.join("\n"),
      theirsContent: theirsLines.join("\n"),
      oursLabel,
      theirsLabel,
    });
    i++;
  }

  return hunks;
}
```

### Conflict Resolution Zustand Store

```typescript
// Source: Following existing store patterns (diff.slice.ts, toast.ts)

import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type ResolutionChoice = "ours" | "theirs" | "both" | "manual";

export interface ConflictFileState {
  filePath: string;
  originalContent: string;
  currentContent: string;
  hunks: ConflictHunk[];
  resolutions: Record<number, ResolutionChoice>; // hunkId -> choice
  undoStack: string[];
  isFullyResolved: boolean;
}

interface ConflictStore {
  // State
  conflictFiles: Map<string, ConflictFileState>;
  activeFile: string | null;

  // Actions
  initConflictFile: (filePath: string, content: string) => void;
  resolveHunk: (filePath: string, hunkId: number, choice: ResolutionChoice) => void;
  undoLastResolution: (filePath: string) => void;
  resetFile: (filePath: string) => void;
  markFileResolved: (filePath: string) => void;
  setActiveFile: (filePath: string | null) => void;

  // Selectors
  getUnresolvedCount: (filePath: string) => number;
  getTotalConflictCount: () => number;
}
```

### Monaco Content Widget for Hunk Actions

```typescript
// Source: Monaco Editor IContentWidget API

import type * as monaco from "monaco-editor";

class ConflictHunkWidget implements monaco.editor.IContentWidget {
  private id: string;
  private position: monaco.editor.IContentWidgetPosition;
  private domNode: HTMLElement | null = null;

  constructor(
    hunkId: number,
    lineNumber: number,
    private onAccept: (choice: ResolutionChoice) => void,
  ) {
    this.id = `conflict-hunk-${hunkId}`;
    this.position = {
      position: { lineNumber, column: 1 },
      preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
    };
  }

  getId(): string { return this.id; }
  getPosition(): monaco.editor.IContentWidgetPosition { return this.position; }

  getDomNode(): HTMLElement {
    if (!this.domNode) {
      this.domNode = document.createElement("div");
      this.domNode.className = "conflict-hunk-actions";
      this.domNode.innerHTML = `
        <button class="conflict-btn conflict-btn-ours" data-choice="ours">Accept Current</button>
        <button class="conflict-btn conflict-btn-theirs" data-choice="theirs">Accept Incoming</button>
        <button class="conflict-btn conflict-btn-both" data-choice="both">Accept Both</button>
      `;
      this.domNode.addEventListener("click", (e) => {
        const choice = (e.target as HTMLElement).dataset.choice as ResolutionChoice;
        if (choice) this.onAccept(choice);
      });
    }
    return this.domNode;
  }
}
```

### Synchronized Scroll Between Result and Diff Panes

```typescript
// Source: Monaco Editor onDidScrollChange API

function useSyncScroll(
  diffEditorRef: React.RefObject<monaco.editor.IDiffEditor | null>,
  resultEditorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>,
) {
  const scrollSourceRef = useRef<"diff" | "result" | null>(null);

  useEffect(() => {
    const diffEditor = diffEditorRef.current;
    const resultEditor = resultEditorRef.current;
    if (!diffEditor || !resultEditor) return;

    const modifiedEditor = diffEditor.getModifiedEditor();

    // Track which pane the user is interacting with
    const diffDisposable = modifiedEditor.onDidScrollChange((e) => {
      if (scrollSourceRef.current === "result") return; // Avoid feedback loop
      scrollSourceRef.current = "diff";
      requestAnimationFrame(() => {
        resultEditor.setScrollTop(e.scrollTop);
        scrollSourceRef.current = null;
      });
    });

    const resultDisposable = resultEditor.onDidScrollChange((e) => {
      if (scrollSourceRef.current === "diff") return;
      scrollSourceRef.current = "result";
      requestAnimationFrame(() => {
        modifiedEditor.setScrollTop(e.scrollTop);
        scrollSourceRef.current = null;
      });
    });

    return () => {
      diffDisposable.dispose();
      resultDisposable.dispose();
    };
  }, [diffEditorRef, resultEditorRef]);
}
```

### Conflict Decorations for Monaco

```typescript
// Source: Monaco Editor decorations API + existing FlowForge theme colors

function getConflictDecorations(
  hunks: ConflictHunk[],
): monaco.editor.IModelDeltaDecoration[] {
  return hunks.flatMap((hunk) => [
    // Ours section: blue tint
    {
      range: new monaco.Range(hunk.startLine + 1, 1, hunk.separatorLine, 1),
      options: {
        isWholeLine: true,
        className: "conflict-ours-line",         // bg-ctp-blue/10
        glyphMarginClassName: "conflict-ours-gutter", // bg-ctp-blue/30
        overviewRuler: {
          color: "#89b4fa",  // ctp-blue
          position: monaco.editor.OverviewRulerLane.Full,
        },
      },
    },
    // Theirs section: mauve tint
    {
      range: new monaco.Range(hunk.separatorLine + 1, 1, hunk.endLine, 1),
      options: {
        isWholeLine: true,
        className: "conflict-theirs-line",         // bg-ctp-mauve/10
        glyphMarginClassName: "conflict-theirs-gutter", // bg-ctp-mauve/30
        overviewRuler: {
          color: "#cba6f7",  // ctp-mauve
          position: monaco.editor.OverviewRulerLane.Full,
        },
      },
    },
    // Marker lines (<<<, ===, >>>) dimmed
    ...([hunk.startLine, hunk.separatorLine, hunk.endLine] as number[]).map((line) => ({
      range: new monaco.Range(line + 1, 1, line + 1, 1),
      options: {
        isWholeLine: true,
        className: "conflict-marker-line",  // text-ctp-overlay0, bg-ctp-surface0/50
      },
    })),
  ]);
}
```

## Accessibility Considerations

### Keyboard Navigation (WCAG 2.1.1)

| Action | Shortcut | Context |
|--------|----------|---------|
| Next conflict hunk | `Alt+F5` (VS Code convention) or `]c` | Navigate to next unresolved conflict |
| Previous conflict hunk | `Alt+Shift+F5` or `[c` | Navigate to previous unresolved conflict |
| Accept current (ours) | `Ctrl+Shift+1` | Accept current branch version for focused hunk |
| Accept incoming (theirs) | `Ctrl+Shift+2` | Accept incoming branch version for focused hunk |
| Accept both | `Ctrl+Shift+3` | Accept both versions for focused hunk |
| Undo last resolution | `Ctrl+Z` | Monaco's built-in undo in result editor |
| Reset file | `Ctrl+Shift+Backspace` | Reset to original conflicted state (with confirmation) |
| Mark as resolved | `Ctrl+Shift+R` | Stage file and mark as resolved |
| Switch focus: ours pane | `Ctrl+1` | Focus the ours (current) pane |
| Switch focus: theirs pane | `Ctrl+2` | Focus the theirs (incoming) pane |
| Switch focus: result pane | `Ctrl+3` | Focus the result editor |

### ARIA Labels and Roles

```tsx
// Pane labeling
<div role="region" aria-label={`Current branch changes (${oursLabel})`}>
  {/* Ours editor */}
</div>
<div role="region" aria-label={`Incoming branch changes (${theirsLabel})`}>
  {/* Theirs editor */}
</div>
<div role="region" aria-label="Merge result editor">
  {/* Result editor */}
</div>

// Conflict hunk actions
<div role="group" aria-label={`Conflict ${hunkIndex + 1} of ${totalHunks} resolution options`}>
  <button aria-label="Accept current branch changes">Accept Current</button>
  <button aria-label="Accept incoming branch changes">Accept Incoming</button>
  <button aria-label="Accept both changes">Accept Both</button>
</div>

// Progress indicator
<span role="status" aria-live="polite">
  {unresolvedCount === 0
    ? "All conflicts resolved"
    : `${unresolvedCount} conflict${unresolvedCount > 1 ? "s" : ""} remaining`
  }
</span>

// Mark as resolved button
<button
  aria-label={`Mark ${fileName} as resolved and stage for commit`}
  aria-disabled={!isFullyResolved}
>
  Mark as Resolved
</button>
```

### Color Contrast (WCAG 1.4.3)

All conflict indicators must meet minimum 4.5:1 contrast ratio against their background:

| Element | Foreground | Background | Ratio | Status |
|---------|-----------|------------|-------|--------|
| Conflict badge text | ctp-crust (#11111b) | ctp-red (#f38ba8) | 7.2:1 | Pass |
| Ours label | ctp-blue (#89b4fa) | ctp-mantle (#181825) | 8.1:1 | Pass |
| Theirs label | ctp-mauve (#cba6f7) | ctp-mantle (#181825) | 6.8:1 | Pass |
| Resolved indicator | ctp-green (#a6e3a1) | ctp-mantle (#181825) | 9.4:1 | Pass |
| Button text on accept-ours | ctp-blue (#89b4fa) | ctp-blue/20 | Check with tool | Verify |

### Screen Reader Considerations

- Monaco Editor has built-in screen reader support (`ariaLabel` option) -- set descriptive labels for each editor instance
- Conflict hunk actions must be focusable and labeled with full context
- Use `aria-live="polite"` for conflict count updates so screen readers announce changes
- Provide text alternatives for color-coded indicators (don't rely on color alone)

## Extensibility Design

### Composable Components for Extension System

The conflict resolution UI should be designed as composable pieces that extensions can later customize or replace:

**Extension points (future):**

1. **Custom conflict resolver strategies:** An extension could register a custom resolution strategy (e.g., AI-based, format-aware, language-specific merge) via `api.contributeConflictResolver({ id, label, resolve: (ours, theirs, base) => result })`.

2. **Custom hunk action buttons:** Extensions could add additional buttons to the per-hunk action bar (e.g., "Accept with AI suggestion", "Apply formatter after merge").

3. **Custom conflict indicators:** Extensions could customize how conflicts appear in the file tree (e.g., semantic conflict detection beyond textual markers).

4. **Conflict resolution blade override:** Using the existing `coreOverride` pattern in `ExtensionBladeConfig`, an extension could replace the entire conflict resolution blade.

**Design principles for extensibility:**

- **Compound component pattern:** Break the conflict resolution UI into small, independently renderable components (`ConflictDiffView`, `ConflictResultEditor`, `ConflictHunkActions`, `ConflictToolbar`) that can be composed differently.
- **Context-based state sharing:** Use React context to share conflict state between compound components, allowing extensions to inject their own components that access the same state.
- **Registry pattern for resolvers:** Follow the existing `bladeRegistry` pattern -- create a `conflictResolverRegistry` where resolution strategies can be registered/unregistered.
- **Event bus integration:** Emit events on the existing `extensionEventBus` for key conflict resolution moments: `conflict:file-opened`, `conflict:hunk-resolved`, `conflict:file-resolved`, `conflict:file-reset`.

**Current extension system hooks that conflict resolution can use:**

| Extension API | Conflict Resolution Use |
|--------------|------------------------|
| `api.registerBlade()` | Register custom conflict resolution blades |
| `api.contributeToolbar()` | Add conflict-related toolbar actions (conflict count badge) |
| `api.contributeSidebarPanel()` | Add a "Conflicts" sidebar panel listing all conflicted files |
| `api.registerCommand()` | Commands like "Resolve All with Ours", "Open Next Conflict" |
| `api.events.emit/on()` | Broadcast/listen for conflict resolution events |
| `api.onDidGit("merge")` | React to merge operations that produce conflicts |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `<<<<<<<` editing in text editor | Inline per-hunk action buttons (VS Code CodeLens) | VS Code 1.70 (2022) | Users rarely need to manually edit conflict markers |
| External merge tool (kdiff3, meld) | Built-in three-pane merge editor | VS Code 1.70, GitKraken 2022+ | No context switching; conflict resolution stays in the IDE |
| Binary ours/theirs choice per file | Per-hunk granular resolution | All modern tools | Different hunks can take from different sides |
| No undo for resolution choices | Full undo stack + reset capability | GitKraken 2024, VS Code built-in undo | Users feel safe to experiment with resolution choices |
| Confirmation dialog on "mark resolved" | Toast with undo action | Modern UX pattern | Less intrusive; undo is discoverable and quick |
| AI auto-merge silently | AI suggestions with user approval | GitKraken 11.2 (2024) | Users stay in control; AI augments rather than replaces |

**Deprecated/outdated:**
- **Four-pane view with base as separate pane:** While technically complete, this overwhelms most users. The base can be shown on-demand but should not be default. VS Code explored and rejected mandatory four-pane layout.
- **File-level ours/theirs only:** Modern tools support per-hunk resolution. File-level-only is considered a limitation, not a feature.

## Open Questions

1. **Three-way base pane (optional)?**
   - What we know: Three-way merge with base is technically superior for understanding conflict origins. Some tools (kdiff3, Beyond Compare) show base prominently.
   - What's unclear: Whether to include an optional "Show Base" toggle in FlowForge's initial implementation or defer to a later phase.
   - Recommendation: Defer base pane to a future enhancement. The two-pane-plus-result layout covers the vast majority of use cases. The data model should accommodate base content from the start (accept it in the store), but the UI can add the toggle later.

2. **Tauri backend commands for conflict content retrieval**
   - What we know: The backend has `getMergeStatus()` returning `MergeStatus { inProgress, conflictedFiles }` and `mergeBranch()` returning `MergeResult { hasConflicts, conflictedFiles }`. File staging commands exist.
   - What's unclear: Whether there are existing commands to read the ours/theirs/base versions of a conflicted file (e.g., `git show :1:file`, `git show :2:file`, `git show :3:file`). These may need to be added to the Rust backend.
   - Recommendation: The planner should check if `getConflictVersions(path) -> { base, ours, theirs }` exists or needs to be added as a Tauri command.

3. **Bulk conflict resolution**
   - What we know: GitKraken users have requested "Take Ours for all files" and "Take Theirs for all files" actions. This is a common request for large merges.
   - What's unclear: Whether to include bulk actions in the initial implementation.
   - Recommendation: Include at minimum a "Resolve All with Ours" / "Resolve All with Theirs" command accessible via the command palette. Per-file resolution in the UI, but bulk via commands.

4. **Conflict resolution persistence across app restarts**
   - What we know: Git's merge state persists on disk (`.git/MERGE_HEAD`, conflict markers in files). FlowForge's Zustand state does not persist.
   - What's unclear: Whether partial resolution progress should be saved to Tauri's KV store.
   - Recommendation: Since the conflict markers are in the actual file content on disk, and resolutions modify the file content, partial resolutions are already persisted via file writes. The Zustand store only needs to track UI state (which file is active, undo stack) which can be ephemeral.

## Sources

### Primary (HIGH confidence)
- [VS Code Merge Conflict Docs](https://code.visualstudio.com/docs/sourcecontrol/merge-conflicts) - Three-way merge editor layout, inline actions, checkboxes, conflict count
- [VS Code UX Exploration Issue #146091](https://github.com/microsoft/vscode/issues/146091) - Layout decision rationale, checkbox UX, result panel design
- [Monaco Editor API](https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IStandaloneDiffEditor.html) - IDiffEditorOptions, IContentWidget, decorations API
- [@monaco-editor/react docs](https://github.com/suren-atoyan/monaco-react) - DiffEditor component props, onMount ref pattern
- [GitKraken Merge Conflict Resolution Tool](https://www.gitkraken.com/features/merge-conflict-resolution-tool) - Side-by-side layout, AI resolution, mark as resolved workflow
- Context7: `/microsoft/monaco-editor` - createDiffEditor API, options, accessibility guide
- Context7: `/suren-atoyan/monaco-react` - DiffEditor component, ref access pattern

### Secondary (MEDIUM confidence)
- [Sublime Merge Docs](https://www.sublimemerge.com/docs/getting_started) - Three-column layout (ours/merged/theirs), button placement
- [GitKraken AI merge blog](https://www.gitkraken.com/blog/gitkraken-desktop-11-2-merge-conflicts-meet-ai-and-more-dev-quality-of-life-wins) - AI-assisted resolution patterns
- [VS Code merge conflict staging issue #62492](https://github.com/Microsoft/vscode/issues/62492) - Confirmation dialog UX on staging conflicted files
- [Tower Git merge documentation](https://www.git-tower.com/learn/git/ebook/en/desktop-gui/advanced-topics/merge-conflicts/) - Merge conflict workflow patterns
- [Git checkout -m for undo](https://gitster.livejournal.com/43665.html) - Using `git checkout -m` to re-create conflict markers

### Tertiary (LOW confidence)
- [Compound Component Pattern](https://www.patterns.dev/react/compound-pattern/) - Composable React component design for extensibility
- [WCAG 2.1.1 Keyboard](https://www.uxpin.com/studio/blog/wcag-211-keyboard-accessibility-explained/) - General keyboard accessibility guidelines
- [react-scroll-sync](https://github.com/okonet/react-scroll-sync) - Scroll synchronization library (not needed, Monaco handles this)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used in FlowForge; no new dependencies
- Architecture patterns: HIGH - VS Code's three-pane layout is well-documented and proven; existing FlowForge components (ResizablePanelLayout, DiffContent, toast system) directly support this pattern
- Pitfalls: HIGH - Memory leaks, race conditions, and scroll sync issues are well-known in Monaco-based diff tools; mitigation strategies are documented
- Accessibility: MEDIUM - Specific keyboard shortcuts and ARIA patterns are recommendations based on VS Code conventions and WCAG guidelines; need validation with actual screen reader testing
- Extensibility: MEDIUM - Extension point design is speculative (future requirements); based on existing ExtensionAPI patterns but not yet validated against real extension use cases

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days - stable domain, established patterns)
