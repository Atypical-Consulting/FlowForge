# Phase 49: Inline Conflict Resolution - Architecture Research

**Researched:** 2026-02-12
**Domain:** Git conflict detection, parsing, resolution UI, Zustand state management, Tauri/Rust backend, Monaco Editor
**Confidence:** HIGH (codebase analysis) / MEDIUM (conflict parsing specifics)

## Summary

Phase 49 introduces inline merge conflict resolution within FlowForge, replacing the current "Resolve conflicts manually, then stage and commit" placeholder in `MergeDialog.tsx`. The system must detect conflicted files from the Rust backend, parse conflict markers on the frontend, present a three-pane UI (ours / theirs / result) using Monaco editors, and allow per-hunk resolution with undo support.

The architecture must be **modular and extension-friendly**, following the established patterns in `src/extensions/`. The conflict resolution system should be implemented as a **built-in extension** (`src/extensions/conflict-resolution/`) that registers blades, toolbar contributions, sidebar panels, and commands through the `ExtensionAPI`. This mirrors the pattern used by `conventional-commits`, `gitflow`, and `github` extensions.

**Primary recommendation:** Implement as a built-in extension with a dedicated Zustand store, new Rust backend commands for conflict content retrieval and resolution, and a `ConflictResolutionBlade` registered through the extension system. Parse conflict markers on the frontend (not Rust) for flexibility and to enable live editing.

---

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@monaco-editor/react` | (current) | Editor and DiffEditor components for ours/theirs/result panes | Already used for DiffBlade, ViewerCodeBlade |
| `zustand` | (current) | Conflict resolution state store with undo history | Established pattern across all domain stores |
| `@tanstack/react-query` | (current) | Data fetching for conflict file content and merge status | Used by staging, diff, and all data-fetching components |
| `xstate` | (current) | Merge machine already has `conflicted` state | Existing merge state machine handles conflict lifecycle |
| `git2` (Rust) | (current) | Backend conflict detection, content retrieval, resolution | Already provides `index.conflicts()`, `merge_branch`, `get_merge_status` |
| `lucide-react` | (current) | Icons for conflict indicators, toolbar actions | Project standard |

### Supporting (No New Dependencies)

No new npm or Cargo dependencies are needed. All functionality can be built with the existing stack.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Frontend conflict parsing | Rust-side parsing | Rust parsing is more reliable but makes live editing harder; frontend parsing allows real-time re-evaluation as user edits |
| Custom three-pane layout | Single Monaco merge editor | Monaco has no built-in 3-way merge editor; must compose from individual Editor/DiffEditor instances |
| Separate conflict store | Extend UI-state store | Dedicated store is cleaner; conflict resolution is complex enough to warrant its own Zustand store |
| XState for per-file state | Zustand with enum states | XState adds complexity for what is essentially a linear state progression per file; Zustand with discriminated union states is simpler |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/extensions/conflict-resolution/
  index.ts                          # Extension entry: onActivate/onDeactivate
  store.ts                          # Zustand store: useConflictResolutionStore
  types.ts                          # ConflictFile, ConflictHunk, ResolutionChoice, etc.
  lib/
    conflictParser.ts               # Parse <<<<<<< ======= >>>>>>> markers
    conflictParser.test.ts          # Parser unit tests (edge cases)
  blades/
    ConflictResolutionBlade.tsx     # Main blade: three-pane UI
    components/
      ConflictFileList.tsx          # Sidebar: list of conflicted files with status
      ConflictHunkView.tsx          # Single hunk: ours/theirs + accept buttons
      ConflictResultEditor.tsx      # Editable Monaco editor for merged result
      ConflictDiffPanes.tsx         # Side-by-side ours vs theirs (read-only)
      ConflictToolbar.tsx           # Accept all ours/theirs, reset, mark resolved
    hooks/
      useConflictFiles.ts           # react-query hook for conflict data
      useConflictResolution.ts      # Hook wrapping store actions

src-tauri/src/git/conflict.rs       # NEW: Rust commands for conflict content
```

### Pattern 1: Built-In Extension Registration

**What:** Register conflict resolution as a built-in extension using `ExtensionAPI`.
**When to use:** For all UI contributions (blade, toolbar, sidebar, commands).
**Source:** Established pattern from `src/extensions/conventional-commits/index.ts`.

```typescript
// src/extensions/conflict-resolution/index.ts
import { lazy } from "react";
import { AlertTriangle } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { openBlade } from "../../core/lib/bladeOpener";
import { useConflictResolutionStore } from "./store";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const ConflictResolutionBlade = lazy(() =>
    import("./blades/ConflictResolutionBlade").then((m) => ({
      default: m.ConflictResolutionBlade,
    }))
  );

  // Register blade with coreOverride (no ext: prefix)
  api.registerBlade({
    type: "conflict-resolution",
    title: "Resolve Conflicts",
    component: ConflictResolutionBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
  });

  // Toolbar badge showing conflict count
  api.contributeToolbar({
    id: "conflicts",
    label: "Resolve Conflicts",
    icon: AlertTriangle,
    group: "git-actions",
    priority: 85, // High priority during merge
    when: () => useConflictResolutionStore.getState().hasConflicts,
    badge: () => {
      const count = useConflictResolutionStore.getState().conflictCount;
      return count > 0 ? count : null;
    },
    execute: () => openBlade("conflict-resolution", {}),
  });

  // Command palette entries
  api.registerCommand({
    id: "open-conflict-resolution",
    title: "Open Conflict Resolution",
    category: "Git",
    icon: AlertTriangle,
    action: () => openBlade("conflict-resolution", {}),
    enabled: () => useConflictResolutionStore.getState().hasConflicts,
  });

  // Listen for merge events to auto-detect conflicts
  api.onDidGit("merge", () => {
    useConflictResolutionStore.getState().refreshConflicts();
  });

  // Cleanup on disable
  api.onDispose(() => {
    useConflictResolutionStore.getState().reset();
  });
}
```

### Pattern 2: Conflict Resolution State Machine (Per-File)

**What:** Each conflicted file progresses through states: `unresolved` -> `partially-resolved` -> `resolved` -> `staged`.
**When to use:** Tracking per-file resolution progress.

```typescript
// src/extensions/conflict-resolution/types.ts

/** Individual conflict hunk parsed from markers */
export interface ConflictHunk {
  id: string;                        // Unique ID for this hunk
  startLine: number;                 // Line number of <<<<<<< in working file
  endLine: number;                   // Line number of >>>>>>> in working file
  oursContent: string;               // Content between <<<<<<< and =======
  theirsContent: string;             // Content between ======= and >>>>>>>
  baseContent?: string;              // Content between ||||||| and ======= (diff3 style)
  oursLabel: string;                 // Label after <<<<<<< (e.g., "HEAD")
  theirsLabel: string;               // Label after >>>>>>> (e.g., "feature-branch")
  resolution: ResolutionChoice | null; // null = unresolved
  customContent?: string;            // Set when user manually edits
}

export type ResolutionChoice = "ours" | "theirs" | "both" | "custom";

/** Per-file resolution state */
export type FileResolutionStatus =
  | "unresolved"          // No hunks resolved yet
  | "partially-resolved"  // Some hunks resolved, some not
  | "resolved"            // All hunks resolved (ready to mark as resolved)
  | "staged";             // File staged after resolution

export interface ConflictFile {
  path: string;
  status: FileResolutionStatus;
  hunks: ConflictHunk[];
  oursFullContent: string;    // Full "ours" version from git index stage 2
  theirsFullContent: string;  // Full "theirs" version from git index stage 3
  baseFullContent: string;    // Full "base" version from git index stage 1
  workingContent: string;     // Current working tree content (with markers)
  resolvedContent: string;    // Computed resolved content (rebuilt from hunks)
  language: string;           // Monaco language ID
  undoStack: UndoEntry[];     // Per-file undo history
  redoStack: UndoEntry[];     // Per-file redo history
}

export interface UndoEntry {
  hunkId: string;
  previousResolution: ResolutionChoice | null;
  previousCustomContent?: string;
}
```

### Pattern 3: Conflict Parser

**What:** Frontend parser for git conflict markers with edge case handling.
**When to use:** Parsing working tree file content to extract conflict hunks.

```typescript
// src/extensions/conflict-resolution/lib/conflictParser.ts

const CONFLICT_START = /^<{7}\s*(.*)/;   // <<<<<<< HEAD
const CONFLICT_BASE = /^\|{7}\s*(.*)/;    // ||||||| merged common ancestors (diff3)
const CONFLICT_SEP = /^={7}$/;            // =======
const CONFLICT_END = /^>{7}\s*(.*)/;      // >>>>>>> feature-branch

export interface ParsedConflict {
  hunks: ConflictHunk[];
  nonConflictRegions: Array<{ startLine: number; endLine: number; content: string }>;
  hasParseErrors: boolean;
  errors: string[];
}

export function parseConflictMarkers(content: string): ParsedConflict {
  const lines = content.split("\n");
  const hunks: ConflictHunk[] = [];
  const errors: string[] = [];
  let hunkIndex = 0;
  let i = 0;

  while (i < lines.length) {
    const startMatch = lines[i].match(CONFLICT_START);
    if (!startMatch) { i++; continue; }

    const hunkStartLine = i;
    const oursLabel = startMatch[1] || "HEAD";
    const oursLines: string[] = [];
    const baseLines: string[] = [];
    const theirsLines: string[] = [];
    let theirsLabel = "";
    let section: "ours" | "base" | "theirs" = "ours";
    let hasBase = false;
    i++;

    while (i < lines.length) {
      if (lines[i].match(CONFLICT_BASE)) {
        section = "base";
        hasBase = true;
        i++; continue;
      }
      if (lines[i].match(CONFLICT_SEP)) {
        section = "theirs";
        i++; continue;
      }
      const endMatch = lines[i].match(CONFLICT_END);
      if (endMatch) {
        theirsLabel = endMatch[1] || "incoming";
        break;
      }
      if (section === "ours") oursLines.push(lines[i]);
      else if (section === "base") baseLines.push(lines[i]);
      else theirsLines.push(lines[i]);
      i++;
    }

    if (i >= lines.length) {
      errors.push(`Unterminated conflict marker starting at line ${hunkStartLine + 1}`);
      break;
    }

    hunks.push({
      id: `hunk-${hunkIndex++}`,
      startLine: hunkStartLine,
      endLine: i,
      oursContent: oursLines.join("\n"),
      theirsContent: theirsLines.join("\n"),
      baseContent: hasBase ? baseLines.join("\n") : undefined,
      oursLabel,
      theirsLabel,
      resolution: null,
      customContent: undefined,
    });
    i++;
  }

  return { hunks, nonConflictRegions: [], hasParseErrors: errors.length > 0, errors };
}
```

### Pattern 4: Zustand Store with Undo History

**What:** Dedicated conflict resolution store managing multi-file state with per-file undo.
**When to use:** Central state management for the conflict resolution workflow.
**Source:** Pattern from `createBladeStore` in `src/core/stores/createBladeStore.ts`.

```typescript
// src/extensions/conflict-resolution/store.ts
import { createBladeStore } from "../../core/stores/createBladeStore";

interface ConflictResolutionState {
  // File state
  files: Map<string, ConflictFile>;
  activeFilePath: string | null;
  hasConflicts: boolean;
  conflictCount: number;

  // Actions
  refreshConflicts: () => Promise<void>;
  loadFileConflicts: (path: string) => Promise<void>;
  resolveHunk: (filePath: string, hunkId: string, choice: ResolutionChoice) => void;
  setCustomResolution: (filePath: string, hunkId: string, content: string) => void;
  undoResolution: (filePath: string) => void;
  redoResolution: (filePath: string) => void;
  markFileResolved: (filePath: string) => Promise<void>;
  acceptAllOurs: (filePath: string) => void;
  acceptAllTheirs: (filePath: string) => void;
  resetFile: (filePath: string) => void;
  setActiveFile: (path: string | null) => void;
  reset: () => void;
}
```

### Pattern 5: Rust Backend Conflict Content Commands

**What:** New Tauri commands to retrieve individual conflict versions (ours/theirs/base) from git index stages.
**When to use:** Loading conflict data for display in the resolution UI.

```rust
// src-tauri/src/git/conflict.rs

/// Content for each side of a conflict.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFileContent {
    pub path: String,
    pub ours_content: String,       // Index stage 2
    pub theirs_content: String,     // Index stage 3
    pub base_content: String,       // Index stage 1 (merge base)
    pub working_content: String,    // Working tree (with markers)
    pub is_binary: bool,
    pub language: String,
    pub conflict_type: ConflictType,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ConflictType {
    BothModified,          // Most common: both sides modified the same file
    DeleteModify,          // One side deleted, other modified
    ModifyDelete,          // Reverse
    BothAdded,             // Both sides added a file with the same name
}

/// Get the content of a conflicted file from all three git index stages.
#[tauri::command]
#[specta::specta]
pub async fn get_conflict_file_content(
    path: String,
    state: State<'_, RepositoryState>,
) -> Result<ConflictFileContent, GitError> {
    // Read index stages 1 (base), 2 (ours), 3 (theirs)
    // Read working tree content
    // Detect conflict type from which stages are present
}

/// Write resolved content to the working tree file.
#[tauri::command]
#[specta::specta]
pub async fn write_resolved_content(
    path: String,
    content: String,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    // Write content to working tree file
    // Does NOT stage -- that's a separate step via existing stage_file
}

/// Get all conflicted file paths from the current merge state.
#[tauri::command]
#[specta::specta]
pub async fn list_conflict_files(
    state: State<'_, RepositoryState>,
) -> Result<Vec<ConflictFileInfo>, GitError> {
    // Uses repo.index().conflicts() iterator
    // Returns paths + conflict types
}
```

### Anti-Patterns to Avoid

- **Monolithic ConflictResolutionBlade:** Do NOT put all logic in one component. Follow the Phase 48 decomposition pattern (DiffBlade -> DiffContent + DiffToolbar + hooks).
- **Parsing conflicts in Rust only:** The frontend needs to re-parse after manual edits. Keep the parser in TypeScript.
- **Global undo store:** Undo must be per-file. A global undo stack would mix resolutions across files.
- **Modifying DiffBlade directly:** Conflict resolution should be a separate blade, not a mode of DiffBlade. DiffBlade shows committed/staged diffs; conflict resolution is a different workflow.
- **Bypassing the extension system:** All UI registrations (blade, toolbar, commands) must go through `ExtensionAPI`, not direct registry calls.
- **Storing resolved content only in Zustand:** Must persist to working tree via Rust backend. Zustand is in-memory only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conflict marker parsing | Regex on raw text | Structured parser with state machine | Edge cases: nested markers, diff3 format, unterminated markers, CRLF |
| File staging after resolution | Custom index manipulation | Existing `commands.stageFile()` | Already handles all edge cases including deletions |
| Merge status detection | Polling or manual checks | Existing `commands.getMergeStatus()` + merge machine `conflicted` state | Already returns `inProgress` + `conflictedFiles` |
| Side-by-side diff view | Custom diff renderer | Monaco `DiffEditor` (read-only) for ours vs theirs comparison | Syntax highlighting, word-level diffs, scrolling all built-in |
| Editable result editor | ContentEditable or textarea | Monaco `Editor` with `readOnly: false` | Syntax highlighting, undo/redo, search, etc. |
| Toast notifications | Custom notification system | Existing `toast.success()` / `toast.error()` from `src/core/stores/toast.ts` | Already styled and positioned |

**Key insight:** The existing codebase provides 80% of the infrastructure. The merge machine already has a `conflicted` state. The staging system already handles `FileStatus.Conflicted`. The extension system provides all registration points. The main new work is: (1) Rust commands for conflict content retrieval, (2) conflict marker parser, (3) resolution UI components, (4) resolution store with undo.

---

## Common Pitfalls

### Pitfall 1: Conflict Markers Inside Code Strings

**What goes wrong:** A file might contain `<<<<<<<` inside a string literal or comment, causing false positive parsing.
**Why it happens:** Naive line-by-line regex matching.
**How to avoid:** Only parse conflict markers that appear at the start of a line (column 0) with exactly 7 repeated characters. Git always generates markers at column 0.
**Warning signs:** Parser tests pass for simple cases but fail for files containing git-related documentation or string constants with conflict-marker-like content.

### Pitfall 2: CRLF vs LF Line Endings

**What goes wrong:** Conflict marker regex fails to match when file uses CRLF line endings.
**Why it happens:** `\r` character before `\n` not stripped before matching.
**How to avoid:** Normalize line endings before parsing. Use `content.replace(/\r\n/g, "\n")` as first step.
**Warning signs:** Conflicts detected on macOS/Linux but not on Windows test repos.

### Pitfall 3: Binary File Conflicts

**What goes wrong:** Attempting to parse binary file content as text crashes or produces garbled output.
**Why it happens:** git marks binary files as conflicted but does NOT insert conflict markers.
**How to avoid:** Check `is_binary` flag from Rust backend before attempting to parse. Show "Binary file conflict - choose ours or theirs" UI instead.
**Warning signs:** Files with `.png`, `.jpg`, `.woff` extensions appearing in conflict list with parse errors.

### Pitfall 4: Delete/Modify Conflicts

**What goes wrong:** UI shows empty "ours" or "theirs" pane because one side deleted the file.
**Why it happens:** Index stage 2 or 3 is missing (the file was deleted on that side).
**How to avoid:** Detect `ConflictType::DeleteModify` in Rust backend. Show specialized UI: "This file was deleted on branch X, modified on branch Y. Keep modified version or delete?"
**Warning signs:** Empty editor panes with no content to compare.

### Pitfall 5: Stale Conflict Data After External Changes

**What goes wrong:** User resolves conflicts in external editor or terminal, but FlowForge UI still shows old conflict state.
**Why it happens:** No file watcher invalidation for conflict data.
**How to avoid:** Invalidate conflict queries on file system change events (existing `watcher.rs` emits events). Use `refetchInterval` on conflict queries similar to `stagingStatus` (2000ms).
**Warning signs:** "Mark as resolved" fails because file no longer has conflict markers.

### Pitfall 6: Monaco Editor Memory Leaks

**What goes wrong:** Opening multiple conflict files without proper cleanup causes memory bloat.
**Why it happens:** Monaco editor instances not disposed on unmount.
**How to avoid:** Follow the Phase 48 pattern in `DiffContent.tsx` - store editor ref, call `editor.dispose()` in cleanup useEffect.
**Warning signs:** Memory usage climbing with each file switch, browser tab eventually becoming unresponsive.

### Pitfall 7: Concurrent Resolution Race Conditions

**What goes wrong:** Two conflicted files being resolved simultaneously cause store updates to conflict.
**Why it happens:** Single active file path in store, but user might switch between files rapidly.
**How to avoid:** Use `Map<string, ConflictFile>` keyed by file path. Each file has independent state. Active file is just a pointer, not the source of truth.
**Warning signs:** Resolving hunks in file A unexpectedly modifies file B's state.

---

## Code Examples

### Reading Conflict Content from Git Index Stages (Rust)

```rust
// Source: git2-rs IndexConflict struct + existing FlowForge diff.rs patterns
fn get_conflict_content(
    repo: &git2::Repository,
    file_path: &str,
    repo_path: &std::path::Path,
) -> Result<ConflictFileContent, GitError> {
    let index = repo.index()?;
    let language = detect_language(file_path);

    // Index stages: 1 = base, 2 = ours, 3 = theirs
    let base_content = match index.get_path(std::path::Path::new(file_path), 1) {
        Some(entry) => {
            let blob = repo.find_blob(entry.id)?;
            if blob.is_binary() {
                return Ok(ConflictFileContent {
                    path: file_path.to_string(),
                    is_binary: true,
                    // ... other fields empty
                });
            }
            String::from_utf8_lossy(blob.content()).to_string()
        }
        None => String::new(),
    };

    let ours_content = match index.get_path(std::path::Path::new(file_path), 2) {
        Some(entry) => {
            let blob = repo.find_blob(entry.id)?;
            String::from_utf8_lossy(blob.content()).to_string()
        }
        None => String::new(),
    };

    let theirs_content = match index.get_path(std::path::Path::new(file_path), 3) {
        Some(entry) => {
            let blob = repo.find_blob(entry.id)?;
            String::from_utf8_lossy(blob.content()).to_string()
        }
        None => String::new(),
    };

    // Working tree content (has conflict markers)
    let working_path = repo_path.join(file_path);
    let working_content = std::fs::read_to_string(&working_path)
        .unwrap_or_default();

    // Determine conflict type
    let conflict_type = match (ours_content.is_empty(), theirs_content.is_empty()) {
        (true, false) => ConflictType::DeleteModify,
        (false, true) => ConflictType::ModifyDelete,
        (true, true) => ConflictType::BothAdded,
        (false, false) => ConflictType::BothModified,
    };

    Ok(ConflictFileContent {
        path: file_path.to_string(),
        ours_content,
        theirs_content,
        base_content,
        working_content,
        is_binary: false,
        language,
        conflict_type,
    })
}
```

### Rebuilding Resolved Content from Hunks

```typescript
// Source: FlowForge codebase patterns
export function buildResolvedContent(
  originalContent: string,
  hunks: ConflictHunk[],
): string {
  const lines = originalContent.split("\n");
  const result: string[] = [];
  let lineIndex = 0;

  // Sort hunks by startLine to process in order
  const sorted = [...hunks].sort((a, b) => a.startLine - b.startLine);

  for (const hunk of sorted) {
    // Add non-conflict lines before this hunk
    while (lineIndex < hunk.startLine) {
      result.push(lines[lineIndex]);
      lineIndex++;
    }

    // Add resolved content for this hunk
    if (hunk.resolution === null) {
      // Unresolved: keep original conflict markers
      while (lineIndex <= hunk.endLine) {
        result.push(lines[lineIndex]);
        lineIndex++;
      }
    } else if (hunk.resolution === "custom" && hunk.customContent !== undefined) {
      result.push(...hunk.customContent.split("\n"));
      lineIndex = hunk.endLine + 1;
    } else if (hunk.resolution === "ours") {
      result.push(...hunk.oursContent.split("\n"));
      lineIndex = hunk.endLine + 1;
    } else if (hunk.resolution === "theirs") {
      result.push(...hunk.theirsContent.split("\n"));
      lineIndex = hunk.endLine + 1;
    } else if (hunk.resolution === "both") {
      result.push(...hunk.oursContent.split("\n"));
      result.push(...hunk.theirsContent.split("\n"));
      lineIndex = hunk.endLine + 1;
    }
  }

  // Add remaining lines after last hunk
  while (lineIndex < lines.length) {
    result.push(lines[lineIndex]);
    lineIndex++;
  }

  return result.join("\n");
}
```

### Integration with Existing Merge Machine

```typescript
// The existing merge machine already handles the conflicted state.
// Phase 49 extends the "conflicted" state with a RESOLVE_FILE event.
//
// Current (src/core/machines/merge/mergeMachine.ts):
//   conflicted: {
//     on: {
//       ABORT: "aborting",
//     },
//   }
//
// Phase 49 adds:
//   conflicted: {
//     on: {
//       ABORT: "aborting",
//       RESOLVE_ALL: {  // All conflicts resolved, create merge commit
//         target: "idle",
//         guard: "allFilesResolved",
//         actions: ["clearState", "emitMergeDid"],
//       },
//     },
//   }
```

### BladePropsMap Registration

```typescript
// Add to src/core/stores/bladeTypes.ts
export interface BladePropsMap {
  // ... existing entries ...
  "conflict-resolution": Record<string, never>;
}
```

---

## Integration Points with Existing Systems

### 1. StagingBlade Integration

The `StagingPanel` (`src/core/blades/staging-changes/components/StagingPanel.tsx`) already receives `FileStatus.Conflicted` files in the `unstaged` array from `get_staging_status()`. Currently, these files show as regular modified files. Phase 49 should:

- Add a "Conflicted" section in `StagingPanel` (between Staged and Changes sections)
- Give conflicted files a distinct red icon with `AlertTriangle` overlay
- Clicking a conflicted file opens `ConflictResolutionBlade` instead of `DiffBlade`
- The existing `FileItem.tsx` `getStatusDot()` function already returns `"Unknown"` for the `"conflicted"` status -- this needs updating

### 2. DiffBlade Integration (Phase 48)

The refactored `DiffBlade` from Phase 48 provides composable components:
- `DiffContent.tsx` -- Monaco DiffEditor wrapper with proper lifecycle
- `DiffToolbar.tsx` -- Slot-based toolbar with `trailing` prop

The conflict resolution blade should reuse `DiffContent` for the ours-vs-theirs comparison pane (read-only). The result editor uses a standard `Editor` (not `DiffEditor`) since it's editable.

### 3. Toolbar Integration

The toolbar badge for conflict count uses the existing `ToolbarAction.badge` callback pattern. The `when()` condition checks the conflict store for `hasConflicts`. This naturally shows/hides the button.

### 4. Git Hook Bus Integration

The extension registers `onDidGit("merge", ...)` to automatically refresh conflicts after a merge operation. This triggers `refreshConflicts()` in the store.

### 5. File Watcher Integration

The existing `watcher.rs` emits file change events. The conflict queries should use `refetchInterval: 2000` (same as staging status) to catch external changes. On refetch, if a file is no longer conflicted (resolved externally), it should be removed from the conflict store.

---

## Data Flow

```
                        ┌───────────────────────────────┐
                        │     Rust Backend (Tauri)       │
                        │                                │
                        │  merge.rs                      │
                        │    merge_branch() ──────────── │ ── returns MergeResult
                        │    get_merge_status() ──────── │ ── returns MergeStatus
                        │    abort_merge()               │
                        │                                │
                        │  conflict.rs (NEW)             │
                        │    list_conflict_files() ───── │ ── returns Vec<ConflictFileInfo>
                        │    get_conflict_file_content()  │ ── returns ConflictFileContent
                        │    write_resolved_content() ── │ ── writes to working tree
                        │                                │
                        │  staging.rs                    │
                        │    stage_file() ────────────── │ ── stages resolved file
                        │    get_staging_status() ────── │ ── includes Conflicted status
                        └───────────┬───────────────────┘
                                    │ IPC (Tauri commands)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        React Frontend                                    │
│                                                                          │
│  ┌─────────────────┐     ┌──────────────────────┐     ┌───────────────┐ │
│  │  Merge Machine   │────▶│  Conflict Store       │────▶│  Resolution    │ │
│  │  (XState)        │     │  (Zustand)            │     │  Blade (UI)    │ │
│  │                  │     │                       │     │                │ │
│  │  idle            │     │  files: Map<path,     │     │  ConflictDiff  │ │
│  │  merging         │     │    ConflictFile>      │     │   Panes        │ │
│  │  conflicted ◄────│     │  activeFilePath       │     │  ConflictResult│ │
│  │  aborting        │     │  hasConflicts          │     │   Editor       │ │
│  │  error           │     │                       │     │  ConflictFile  │ │
│  └──────────────────┘     │  resolveHunk()        │     │   List         │ │
│                            │  undoResolution()     │     │  ConflictTool  │ │
│                            │  markFileResolved()   │     │   bar          │ │
│                            │  refreshConflicts()   │     │                │ │
│                            └──────────────────────┘     └───────────────┘ │
│                                                                          │
│  ┌─────────────────┐                                                     │
│  │  Staging Panel   │ ── shows "Conflicted" section                      │
│  │  Toolbar         │ ── shows conflict count badge                      │
│  │  Command Palette │ ── "Open Conflict Resolution" command              │
│  └─────────────────┘                                                     │
└──────────────────────────────────────────────────────────────────────────┘

Resolution Flow:
1. User clicks "Accept Ours" on a hunk
2. store.resolveHunk(filePath, hunkId, "ours") called
3. Store updates hunk.resolution = "ours", pushes undo entry
4. Store recomputes resolvedContent via buildResolvedContent()
5. Result editor re-renders with new content
6. Repeat for all hunks
7. User clicks "Mark as Resolved"
8. store.markFileResolved(filePath):
   a. commands.writeResolvedContent(filePath, resolvedContent) -- writes to disk
   b. commands.stageFile(filePath) -- stages the resolved file
   c. Updates file status to "staged"
   d. Shows toast: "File resolved and staged"
9. If all files resolved: merge can be completed
```

---

## Concurrent Conflict Resolution

Multiple files can be resolved simultaneously because:

1. **State is per-file:** The `files` Map in the store keyed by path means each file has independent state.
2. **Active file is a view concern:** `activeFilePath` just controls which file is displayed; resolving one file doesn't affect another.
3. **Undo is per-file:** Each `ConflictFile` has its own `undoStack` and `redoStack`.
4. **Backend operations are file-scoped:** `write_resolved_content` and `stage_file` operate on individual files.

The user can:
- Resolve hunks in file A
- Switch to file B and resolve hunks there
- Switch back to file A and continue resolving
- Mark files as resolved in any order

---

## Error Boundaries and Recovery

### Scenario: Write Fails Mid-Resolution

If `commands.writeResolvedContent()` fails:
- Show error toast with the specific error
- Keep the ConflictFile in "resolved" status (not "staged")
- User can retry via "Mark as Resolved" button
- The store state is not corrupted because the write happens after resolution

### Scenario: Stage Fails After Write

If `commands.stageFile()` fails after successful write:
- The resolved content is already on disk (safe)
- Show error toast
- User can manually stage via the staging panel
- The file appears as "modified" in staging (content is resolved, just not staged)

### Scenario: User Navigates Away Mid-Resolution

If user closes the conflict resolution blade with partially resolved files:
- State persists in the Zustand store (memory only)
- Re-opening the blade restores previous resolution progress
- If the app is restarted, state is lost -- working tree still has conflict markers
- Consider: Warn user via `onWillGit("checkout", ...)` if unresolved conflicts exist

### Scenario: External Resolution

If user resolves conflicts in an external tool while FlowForge is open:
- The 2-second polling on conflict queries detects the change
- If a file no longer has conflict markers, remove from conflict store
- If file is no longer in `index.conflicts()`, mark as externally resolved
- Show toast: "File X was resolved externally"

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text-only conflict resolution | Three-pane visual merge (VS Code, JetBrains) | ~2020 | Users expect visual merge, not marker editing |
| External merge tool launch | Inline resolution in the git client | VS Code 2022, GitKraken 2019 | No context switching needed |
| Full-file ours/theirs only | Per-hunk resolution with "both" option | Standard since ~2018 | Fine-grained control over merge results |
| No undo in merge tools | Per-action undo/redo | VS Code 2022 | Reduces fear of wrong resolution choices |

**Current best practice (VS Code, GitKraken, Sublime Merge):**
- Inline codelens-style "Accept Current / Accept Incoming / Accept Both" buttons above each conflict hunk
- Editable result pane below or beside the comparison
- Per-hunk resolution with live preview of the merged result
- Undo/redo per file
- "Mark as resolved" stages the file

---

## Open Questions

1. **diff3 vs merge conflict style**
   - What we know: Git supports both `merge` (default, no base content shown) and `diff3` (includes base content between `|||||||` and `=======`) conflict styles.
   - What's unclear: Should we support diff3 format parsing? It provides more context but complicates the parser.
   - Recommendation: Support both in the parser. Detect `|||||||` markers and extract base content when present. The base content is also available from git index stage 1, so it's always accessible regardless of marker format.

2. **Should conflict resolution be a separate blade or a mode of StagingBlade?**
   - What we know: VS Code integrates conflict resolution into the source control panel. GitKraken uses a separate view.
   - What's unclear: User expectation for FlowForge.
   - Recommendation: Separate blade. The three-pane layout needs significant screen real estate. The staging blade is already complex. Use a sidebar panel in the conflict blade for the file list.

3. **How to handle the merge commit after all conflicts are resolved?**
   - What we know: The existing merge machine has `conflicted` state but no `RESOLVE_ALL` transition.
   - What's unclear: Should the merge commit be automatic or require explicit user action?
   - Recommendation: Explicit action. After all files are resolved and staged, show a "Complete Merge" button that calls `commands.createCommit()` with the merge message. This matches `git merge` workflow where the user must `git commit` after resolving.

4. **Monaco Editor "readOnly" vs "editable" for result pane**
   - What we know: CONF-04 requires "Manual editing in Monaco Editor with syntax highlighting and Reset button."
   - What's unclear: Should the result pane always be editable, or only when user chooses "custom" resolution?
   - Recommendation: Always editable. The result pane shows the computed resolution, but user can freely edit. Any manual edit marks the hunk as "custom" resolution. This matches VS Code behavior.

---

## Sources

### Primary (HIGH confidence)
- FlowForge codebase analysis: `src/extensions/ExtensionAPI.ts` -- extension registration API
- FlowForge codebase analysis: `src/extensions/conventional-commits/index.ts` -- built-in extension pattern
- FlowForge codebase analysis: `src-tauri/src/git/merge.rs` -- existing merge commands and types
- FlowForge codebase analysis: `src-tauri/src/git/staging.rs` -- FileStatus::Conflicted already defined
- FlowForge codebase analysis: `src-tauri/src/git/diff.rs` -- pattern for reading blob content from index
- FlowForge codebase analysis: `src/core/machines/merge/mergeMachine.ts` -- existing merge state machine
- FlowForge codebase analysis: `src/core/blades/diff/` -- Phase 48 decomposed DiffBlade
- FlowForge codebase analysis: `src/core/stores/createBladeStore.ts` -- store factory pattern
- FlowForge codebase analysis: `src/core/lib/bladeRegistry.ts` -- blade registration system
- FlowForge codebase analysis: `src/core/lib/toolbarRegistry.ts` -- toolbar contribution system
- [git2-rs IndexConflict](https://docs.rs/git2/latest/git2/struct.IndexConflict.html) -- Rust conflict entry API
- [git2-rs index.rs source](https://github.com/rust-lang/git2-rs/blob/master/src/index.rs) -- index stage reading

### Secondary (MEDIUM confidence)
- [Git Advanced Merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging) -- conflict marker format documentation
- [@monaco-editor/react](https://www.npmjs.com/package/@monaco-editor/react) -- Editor/DiffEditor component API
- Phase 48 research (`.planning/phases/48-diff-viewer-foundations/48-RESEARCH.md`) -- DiffBlade refactoring patterns, Monaco configuration

### Tertiary (LOW confidence)
- [Monaco merge conflict patterns](https://gist.github.com/0xdevalias/2fc3d66875dcc76d5408ce324824deab) -- general notes on editor conflict resolution approaches

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in the project, no new dependencies
- Architecture: HIGH -- extension system patterns are well-established and documented in codebase
- Conflict parsing: MEDIUM -- standard git conflict marker format is well-documented, but edge cases (diff3, nested, CRLF) need thorough testing
- Rust backend: HIGH -- git2 IndexConflict API is documented, pattern follows existing merge.rs and diff.rs
- Pitfalls: MEDIUM -- based on common git tool development challenges and codebase patterns

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days -- stable domain, no fast-moving dependencies)
