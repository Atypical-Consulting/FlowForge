# Phase 49: Inline Conflict Resolution - Synthesized Research

**Researched:** 2026-02-12
**Sources:** 3 parallel research agents (UX, Architecture, Implementation)
**Confidence:** HIGH

## Key Consensus Across All Researchers

### 1. Two-Pane-Plus-Result Layout (Unanimous)
All three researchers converge on the VS Code / GitKraken pattern:
- **Top:** Ours (read-only) | Theirs (read-only) side-by-side using Monaco DiffEditor
- **Bottom:** Editable result panel using Monaco Editor
- Use existing `ResizablePanelLayout` for the vertical/horizontal splits

### 2. No New Dependencies (Unanimous)
All required functionality exists in the current stack:
- Monaco Editor ^0.55.1 + @monaco-editor/react ^4.7.0
- Zustand ^5, XState ^5.26.0, @tanstack/react-query ^5
- react-resizable-panels, lucide-react, framer-motion, CVA
- git2 0.20 (Rust) for backend conflict API

### 3. Per-Hunk Action Buttons (Unanimous)
- "Accept Ours" / "Accept Theirs" / "Accept Both" buttons per conflict hunk
- Rendered as Monaco IContentWidget or overlay components
- Catppuccin-themed: blue for ours, mauve for theirs, green for both

### 4. Built-In Extension Pattern (Architecture + UX)
- Implement as built-in extension at `src/extensions/conflict-resolution/`
- Register blade, toolbar badge, commands via ExtensionAPI
- Follow patterns from conventional-commits, gitflow extensions

### 5. Per-File State with Independent Undo (Unanimous)
- `Map<string, ConflictFile>` in Zustand store
- Each file has own undo/redo stack
- Supports concurrent multi-file resolution

### 6. Rust Backend: 3-4 New Tauri Commands (Implementation + Architecture)
- `get_conflict_entries` / `list_conflict_files` — list all conflicted paths
- `get_conflict_file_content` — read ours/theirs/base from git2 index stages
- `resolve_conflict_file` — write resolved content + stage file
- Use `index.conflict_get(path)` and `index.get_path(path, stage)` APIs

## Key Architectural Decisions

### Conflict Content Strategy
- **Primary:** Use git2 index-based reading (stages 1/2/3) for clean ours/theirs/base content
- **Secondary:** Frontend TypeScript parser for working directory conflict markers (needed for result editor hunk identification)
- Both researchers agree: git2 index gives authoritative, clean content; marker parsing is for UI hunk mapping

### Where to Place Code
**Architecture researcher recommends (adopted):**
```
src/extensions/conflict-resolution/
  index.ts                      # Extension entry
  store.ts                      # Zustand store
  types.ts                      # TypeScript types
  lib/
    conflictParser.ts           # Frontend conflict marker parser
  blades/
    ConflictResolutionBlade.tsx  # Main blade
    components/                  # Sub-components
    hooks/                       # Data + state hooks

src-tauri/src/git/conflict.rs   # New Rust conflict commands
```

### State Machine Integration
- Existing merge machine already has `conflicted` state
- Add `RESOLVE_ALL` transition when all files resolved
- Don't auto-commit — show "Complete Merge" button

### Key Types
```typescript
type ResolutionChoice = "ours" | "theirs" | "both" | "custom";
type FileResolutionStatus = "unresolved" | "partially-resolved" | "resolved" | "staged";

interface ConflictHunk {
  id: string;
  startLine: number;
  endLine: number;
  oursContent: string;
  theirsContent: string;
  baseContent?: string;
  resolution: ResolutionChoice | null;
}

interface ConflictFile {
  path: string;
  status: FileResolutionStatus;
  hunks: ConflictHunk[];
  oursFullContent: string;
  theirsFullContent: string;
  baseFullContent: string;
  undoStack: UndoEntry[];
}
```

## Common Pitfalls (Combined from all researchers)

1. **Missing conflict sides:** ancestor/ours/theirs can be None (add/add, delete/modify)
2. **Monaco memory leaks:** Dispose editors on unmount (follow Phase 48 DiffContent pattern)
3. **Race conditions in write+stage:** Sequential await, disable button during operation
4. **Scroll sync jank:** Use source-of-truth pattern, requestAnimationFrame debouncing
5. **Lost progress on navigation:** Store state in Zustand, not component state
6. **Binary file conflicts:** Detect via `blob.is_binary()`, show simplified UI
7. **CRLF line endings:** Normalize before parsing
8. **Stale data after external changes:** Poll with refetchInterval: 2000ms

## Extensibility Design (Focus Area)

### Extension Points
1. **ConflictProvider interface:** Abstract data source for merge/rebase/cherry-pick
2. **ResolutionStrategy pattern:** Pluggable resolution algorithms
3. **Blade registration:** coreOverride pattern for future replacement
4. **Event bus:** conflict:file-opened, conflict:hunk-resolved, conflict:file-resolved
5. **Compound component pattern:** Composable ConflictDiffView, ConflictResultEditor, ConflictHunkActions

### Integration Points
- StagingBlade: Add "Conflicted" section with distinct red icons
- Toolbar: Conflict count badge via toolbar registry
- Command palette: "Open Conflict Resolution", "Resolve All Ours/Theirs"
- File tree: AlertTriangle icon for conflicted files
- Merge machine: RESOLVE_ALL transition

## Accessibility (from UX researcher)
- Keyboard shortcuts: Alt+F5 next conflict, Ctrl+Shift+1/2/3 accept ours/theirs/both
- ARIA labels on all panes and action buttons
- aria-live="polite" for conflict count updates
- 4.5:1+ contrast ratios verified for Catppuccin colors

## Open Questions Resolved
1. **Start result with "ours" content** (VS Code convention)
2. **Scope to merge conflicts only** (defer rebase to future)
3. **Separate blade, not StagingBlade mode** (needs screen real estate)
4. **Always-editable result pane** (manual edits mark hunk as "custom")
5. **No base pane by default** (data model supports it, UI defers)

## Detailed Research Files
- `49-RESEARCH-UX.md` — Full UX patterns, accessibility, VS Code/GitKraken analysis
- `49-RESEARCH-ARCHITECTURE.md` — Extension system, state machine, data flow, error handling
- `49-RESEARCH-IMPLEMENTATION.md` — git2 API, Monaco patterns, Tauri commands, code examples
