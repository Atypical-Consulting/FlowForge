# Phase 49: Inline Conflict Resolution - Research

**Researched:** 2026-02-12
**Domain:** Git merge conflict detection (Rust/git2) + Monaco Editor conflict resolution UI (React/TypeScript)
**Confidence:** HIGH

## Summary

This phase adds the ability to resolve merge conflicts entirely within FlowForge, replacing the current "resolve conflicts manually" message (MergeDialog.tsx line 112) with a full inline resolution experience. The codebase already has strong foundations: the Rust backend already detects conflicts via `index.has_conflicts()` and iterates `IndexConflict` entries (merge.rs lines 134-162), the `FileStatus::Conflicted` variant exists in staging.rs, and the merge state machine already tracks a `conflicted` state with the list of conflicted file paths.

The primary technical challenge is reading the three conflict versions (ancestor/ours/theirs) from the git2 index and delivering them to the frontend, then building a Monaco-based merge resolution UI that lets users pick resolutions per hunk. The existing DiffBlade decomposition from Phase 48 provides composable building blocks (DiffContent, DiffToolbar, DiffMarkdownPreview) that the ConflictBlade can reuse.

**Primary recommendation:** Build 4 new Tauri commands (`get_conflict_entries`, `get_conflict_file_content`, `resolve_conflict_file`, `mark_conflict_resolved`), a `ConflictBlade` composed from existing DiffBlade primitives plus a new editable result editor, and a Zustand conflict store with undo stack. Structure as core blade initially, with interface boundaries that allow future extraction to an extension.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| git2 | 0.20 | Conflict detection via `Index::conflicts()`, `Index::conflict_get()`, blob content reading | Already used throughout backend; has full conflict API |
| @monaco-editor/react | ^4.7.0 | DiffEditor for ours/theirs view, Editor for result panel | Already used for DiffBlade and InlineDiffViewer |
| monaco-editor | ^0.55.1 | Decorations, content widgets, diff algorithm | Already bundled and themed |
| zustand | ^5 | Conflict resolution state, undo stack | Project standard state management |
| @tanstack/react-query | ^5 | Fetching conflict data from Tauri commands | Project standard data fetching |
| xstate | ^5.26.0 | Merge machine already has `conflicted` state | Extend existing merge machine |
| framer-motion | ^12.34.0 | Resolution action animations | Project standard animation |
| lucide-react | (latest) | Conflict icons (AlertTriangle, Check, GitMerge, etc.) | Project standard icons |
| class-variance-authority | ^0.7.1 | Variant-driven conflict status styling | Already used for UI components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcuts for conflict navigation | Accept ours/theirs/both via keyboard |
| tauri-specta | 2.0.0-rc.21 | Auto-generate TypeScript bindings for new commands | Required for new Tauri commands |

### No New Dependencies Needed
All required functionality is available through existing dependencies. Monaco Editor natively supports diff viewing, decorations, content widgets, and editable editors. git2 0.20 has the full conflict resolution API.

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/git/
├── merge.rs           # Existing: add get_conflict_entries, get_conflict_file_content
├── conflict.rs        # NEW: resolve_conflict_file, mark_conflict_resolved
├── error.rs           # Add ConflictResolutionFailed, FileNotConflicted variants
└── mod.rs             # Export new conflict module

src/core/blades/conflict/
├── index.ts                      # Re-exports
├── registration.tsx              # registerBlade for "conflict-resolution"
├── ConflictBlade.tsx             # Main blade: toolbar + two-pane diff + result editor
├── types.ts                      # ConflictSource, ConflictHunk, ConflictResolution types
├── components/
│   ├── ConflictToolbar.tsx       # Navigation, accept all ours/theirs, file counter
│   ├── ConflictDiffPane.tsx      # Ours vs Theirs DiffEditor (read-only)
│   ├── ConflictResultEditor.tsx  # Editable Monaco editor for resolution result
│   ├── ConflictHunkActions.tsx   # Accept Ours/Theirs/Both buttons per hunk
│   └── ConflictFileIndicator.tsx # Red warning icon component for file tree
├── hooks/
│   ├── useConflictQuery.ts       # react-query hook for conflict data
│   └── useConflictResolution.ts  # Hook managing resolution state + undo
└── store/
    └── conflictStore.ts          # Zustand store: conflict state, undo stack, resolution tracking

src/core/stores/bladeTypes.ts     # Add "conflict-resolution" entry
```

### Pattern 1: Reading Conflict Content via git2 Index
**What:** Use `index.conflict_get(path)` to get `IndexConflict` with ancestor/ours/theirs `IndexEntry`, then read blob content via `repo.find_blob(entry.id)`.
**When to use:** When a file is in conflicted state and user opens it for resolution.
**Example:**
```rust
// Source: git2 docs - IndexConflict, verified via Context7 /websites/docs_rs-git2
pub struct ConflictFileContent {
    pub path: String,
    pub ancestor_content: Option<String>,
    pub ours_content: String,
    pub theirs_content: String,
    pub is_binary: bool,
    pub language: String,
}

fn get_conflict_content(
    repo: &git2::Repository,
    file_path: &str,
) -> Result<ConflictFileContent, GitError> {
    let index = repo.index()?;
    let conflict = index.conflict_get(Path::new(file_path))
        .map_err(|_| GitError::NotFound(format!("No conflict for: {}", file_path)))?;

    let ancestor_content = conflict.ancestor
        .and_then(|entry| {
            repo.find_blob(entry.id).ok()
                .filter(|b| !b.is_binary())
                .map(|b| String::from_utf8_lossy(b.content()).to_string())
        });

    let ours_content = conflict.our
        .map(|entry| {
            let blob = repo.find_blob(entry.id)?;
            if blob.is_binary() {
                return Err(GitError::OperationFailed("Binary file conflict".into()));
            }
            Ok(String::from_utf8_lossy(blob.content()).to_string())
        })
        .transpose()?
        .unwrap_or_default();

    let theirs_content = conflict.their
        .map(|entry| {
            let blob = repo.find_blob(entry.id)?;
            if blob.is_binary() {
                return Err(GitError::OperationFailed("Binary file conflict".into()));
            }
            Ok(String::from_utf8_lossy(blob.content()).to_string())
        })
        .transpose()?
        .unwrap_or_default();

    Ok(ConflictFileContent {
        path: file_path.to_string(),
        ancestor_content,
        ours_content,
        theirs_content,
        is_binary: false,
        language: detect_language(file_path),
    })
}
```

### Pattern 2: Resolving a Conflict by Writing File and Staging
**What:** Write the resolved content to the working directory file, then use `index.add_path()` to stage it (which removes the conflict entry from the index).
**When to use:** When user clicks "Mark as Resolved" after accepting hunks.
**Example:**
```rust
// Source: git2 Index::add_path documentation
fn resolve_conflict_file(
    repo: &git2::Repository,
    file_path: &str,
    resolved_content: &str,
) -> Result<(), GitError> {
    let repo_root = repo.workdir()
        .ok_or_else(|| GitError::Internal("Bare repository".into()))?;
    let full_path = repo_root.join(file_path);

    // Write resolved content to working directory
    std::fs::write(&full_path, resolved_content)
        .map_err(|e| GitError::OperationFailed(format!("Failed to write: {}", e)))?;

    // Stage the file - this removes the conflict entry from the index
    let mut index = repo.index()?;
    index.add_path(Path::new(file_path))?;
    index.write()?;

    Ok(())
}
```

### Pattern 3: ConflictBlade Composition from DiffBlade Primitives
**What:** Reuse DiffToolbar, DiffContent patterns but with three-way layout: ours/theirs diff on top, editable result editor below.
**When to use:** Building the conflict resolution blade.
**Example:**
```tsx
// Pattern following existing DiffBlade.tsx structure
export function ConflictBlade({ source }: ConflictBladeProps) {
  const { data, isLoading } = useConflictQuery(source.filePath);
  const { resolvedContent, acceptOurs, acceptTheirs, acceptBoth, undo, canUndo } =
    useConflictResolution(data);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <ConflictToolbar
        filePath={source.filePath}
        canUndo={canUndo}
        onUndo={undo}
        onAcceptAllOurs={() => acceptOurs("all")}
        onAcceptAllTheirs={() => acceptTheirs("all")}
      />
      <div className="flex-1 flex flex-col min-h-0">
        {/* Two-pane diff: ours vs theirs (read-only) */}
        <div className="flex-1 min-h-0">
          <DiffContent
            original={data.oursContent}
            modified={data.theirsContent}
            language={data.language}
            inline={false}
            collapseUnchanged={true}
          />
        </div>
        {/* Editable result panel */}
        <div className="flex-1 min-h-0 border-t border-ctp-surface0">
          <ConflictResultEditor
            value={resolvedContent}
            language={data.language}
            onChange={setResolvedContent}
          />
        </div>
      </div>
    </div>
  );
}
```

### Pattern 4: Undo Stack for Conflict Resolutions
**What:** Zustand store with action history allowing undo/redo of resolution choices.
**When to use:** Every time a user accepts ours/theirs/both or edits the result.
**Example:**
```typescript
// Following createBladeStore pattern from src/core/stores/createBladeStore.ts
interface ConflictResolutionState {
  // Per-file resolution tracking
  resolutions: Map<string, {
    resolvedContent: string;
    unresolvedHunks: number;
    totalHunks: number;
    status: "unresolved" | "partial" | "resolved";
  }>;
  // Undo stack per file
  undoStacks: Map<string, string[]>; // stack of previous content states
  redoStacks: Map<string, string[]>;
  // Actions
  setResolution: (filePath: string, content: string) => void;
  undo: (filePath: string) => void;
  redo: (filePath: string) => void;
  markResolved: (filePath: string) => void;
  reset: () => void;
}
```

### Pattern 5: Blade Registration (Following Existing Pattern)
**What:** Register ConflictBlade in the blade registry with proper types.
**Example:**
```typescript
// bladeTypes.ts addition
"conflict-resolution": { filePath: string };

// registration.tsx
registerBlade<{ filePath: string }>({
  type: "conflict-resolution",
  defaultTitle: "Resolve Conflict",
  component: ConflictBlade,
  lazy: true,
  renderTitleContent: (props) => renderPathBreadcrumb(props.filePath),
});
```

### Anti-Patterns to Avoid
- **Parsing conflict markers from file content:** Do NOT regex-parse `<<<<<<<`/`=======`/`>>>>>>>` markers. Use git2's `index.conflict_get()` which gives clean ancestor/ours/theirs blobs. Marker parsing is fragile and breaks on nested conflicts or binary content.
- **Sharing git2::Repository across threads:** The project already handles this correctly (see repository.rs line 28 comment). Always open a fresh handle inside `spawn_blocking`.
- **Storing full file content in Zustand:** For large files, only store the resolution decisions (which hunks accepted), not full content blobs. Reconstruct on demand.
- **Using a single Monaco DiffEditor for three-way merge:** Monaco DiffEditor only supports two-way diff. Use DiffEditor for ours-vs-theirs comparison and a separate Editor instance for the result panel.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conflict detection | Custom file parsing | `git2::Index::conflicts()` + `conflict_get()` | Handles add/add, modify/modify, delete/modify correctly |
| Diff algorithm | Custom line diffing | Monaco's built-in `diffAlgorithm: "advanced"` | Handles word-level, line-level, moved code detection |
| Binary file detection | Extension-based check | `git2::Blob::is_binary()` | Uses libgit2's heuristic (null byte check in first 8000 bytes) |
| Syntax highlighting | Language detection | Existing `detect_language()` in diff.rs | Already maps 30+ extensions |
| Scroll synchronization | Manual scroll event wiring | Monaco DiffEditor's built-in sync | Already handles proportional scrolling |
| Conflict marker parsing | Regex-based parser | git2 index-based conflict entries | Markers are ambiguous; index entries are authoritative |

**Key insight:** git2's conflict API gives clean, separate versions of conflicted files. This is fundamentally better than parsing conflict markers from the working directory file, which is lossy and fragile.

## Common Pitfalls

### Pitfall 1: Conflict Entries May Have Missing Sides
**What goes wrong:** Assuming all three sides (ancestor, ours, theirs) always exist. In add/add conflicts, ancestor is `None`. In delete/modify conflicts, one side is `None`.
**Why it happens:** Conflicts arise from different scenarios - not just both-modified.
**How to avoid:** Always handle `Option<IndexEntry>` for all three fields. Show "File does not exist in this version" placeholder when a side is None.
**Warning signs:** `unwrap()` calls on `conflict.ancestor`, `conflict.our`, or `conflict.their`.

### Pitfall 2: Staging a Conflicted File Removes Conflict State
**What goes wrong:** Calling `index.add_path()` on a conflicted file clears ALL conflict entries for that path. If you stage prematurely, the conflict is "resolved" even if the content is wrong.
**Why it happens:** Git's design - staging a file is the mechanism for marking conflicts resolved.
**How to avoid:** Only call `index.add_path()` when user explicitly clicks "Mark as Resolved". Show confirmation if there are unresolved hunks.
**Warning signs:** Tests pass but resolved files still contain conflict markers.

### Pitfall 3: Monaco DiffEditor Does Not Support Three-Way Merge
**What goes wrong:** Trying to create a three-pane merge view using Monaco DiffEditor.
**Why it happens:** Monaco DiffEditor is inherently two-pane (original vs modified).
**How to avoid:** Use the pattern: DiffEditor (read-only, ours vs theirs) + separate Editor (editable, for result). The result editor starts with the working directory content (which has conflict markers) and gets updated as user resolves hunks.
**Warning signs:** Attempting to pass three models to DiffEditor.

### Pitfall 4: Working Directory File Has Conflict Markers
**What goes wrong:** Reading the workdir file and showing raw `<<<<<<<` markers to the user as the starting point.
**Why it happens:** After a conflicted merge, git writes conflict markers into the working directory file.
**How to avoid:** Read clean ours/theirs from the git index (via `conflict_get()`), present those in the DiffEditor. For the result editor, either start blank and let user pick hunks, or start with one side (e.g., "ours") and let user selectively pull from "theirs".
**Warning signs:** User sees raw conflict markers in the result editor.

### Pitfall 5: Large Files with Many Conflicts
**What goes wrong:** Performance issues when a file has 100+ conflict hunks.
**Why it happens:** Each hunk needs decoration, zone widget, and state tracking.
**How to avoid:** Virtualize conflict hunk rendering. Use Monaco's built-in `hideUnchangedRegions` to collapse non-conflicted sections. Lazy-compute decorations for visible hunks only.
**Warning signs:** UI freezes when opening large conflicted files.

### Pitfall 6: Multiple Files in Conflict - State Management
**What goes wrong:** Resolution state for file A bleeds into file B, or navigating between files loses progress.
**Why it happens:** Single global state instead of per-file state.
**How to avoid:** Key all state by file path in the Zustand store. The `resolutions` Map pattern (Pattern 4 above) handles this.
**Warning signs:** Resolving a hunk in one file marks hunks resolved in another.

## Code Examples

### Tauri Command: List Conflicted Files with Details
```rust
// Source: Existing pattern from merge.rs get_merge_status + git2 IndexConflict docs
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictEntry {
    pub path: String,
    pub has_ancestor: bool,
    pub has_ours: bool,
    pub has_theirs: bool,
    pub is_binary: bool,
}

#[tauri::command]
#[specta::specta]
pub async fn get_conflict_entries(
    state: State<'_, RepositoryState>,
) -> Result<Vec<ConflictEntry>, GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".into()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let index = repo.index()?;
        let mut entries = Vec::new();

        for conflict in index.conflicts()? {
            let conflict = conflict?;
            let path = conflict.our.as_ref()
                .or(conflict.their.as_ref())
                .or(conflict.ancestor.as_ref())
                .map(|e| String::from_utf8_lossy(&e.path).to_string())
                .unwrap_or_default();

            let is_binary = [&conflict.ancestor, &conflict.our, &conflict.their]
                .iter()
                .filter_map(|e| e.as_ref())
                .any(|entry| {
                    repo.find_blob(entry.id)
                        .map(|b| b.is_binary())
                        .unwrap_or(false)
                });

            entries.push(ConflictEntry {
                path,
                has_ancestor: conflict.ancestor.is_some(),
                has_ours: conflict.our.is_some(),
                has_theirs: conflict.their.is_some(),
                is_binary,
            });
        }

        Ok(entries)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

### Tauri Command: Get Conflict File Content (Three Versions)
```rust
// Source: git2 Index::conflict_get + Blob content reading pattern from diff.rs
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFileContent {
    pub path: String,
    pub ancestor_content: Option<String>,
    pub ours_content: String,
    pub theirs_content: String,
    pub is_binary: bool,
    pub language: String,
}

#[tauri::command]
#[specta::specta]
pub async fn get_conflict_file_content(
    path: String,
    state: State<'_, RepositoryState>,
) -> Result<ConflictFileContent, GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".into()))?;

    let file_path = path.clone();
    let language = detect_language(&path);

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let index = repo.index()?;
        let conflict = index.conflict_get(Path::new(&file_path))
            .map_err(|_| GitError::NotFound(
                format!("No conflict entry for: {}", file_path)
            ))?;

        // Read blob content helper
        let read_entry = |entry: &Option<git2::IndexEntry>| -> Result<Option<String>, GitError> {
            match entry {
                Some(e) => {
                    let blob = repo.find_blob(e.id)?;
                    if blob.is_binary() {
                        Ok(None)
                    } else {
                        Ok(Some(String::from_utf8_lossy(blob.content()).to_string()))
                    }
                }
                None => Ok(None),
            }
        };

        let ancestor = read_entry(&conflict.ancestor)?;
        let ours = read_entry(&conflict.our)?;
        let theirs = read_entry(&conflict.their)?;

        let is_binary = ours.is_none() && conflict.our.is_some();

        Ok(ConflictFileContent {
            path: file_path,
            ancestor_content: ancestor,
            ours_content: ours.unwrap_or_default(),
            theirs_content: theirs.unwrap_or_default(),
            is_binary,
            language,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

### Tauri Command: Write Resolution and Stage
```rust
// Source: Pattern from staging.rs stage_file + fs::write
#[tauri::command]
#[specta::specta]
pub async fn resolve_conflict_file(
    path: String,
    resolved_content: String,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".into()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let workdir = repo.workdir()
            .ok_or_else(|| GitError::Internal("Bare repository".into()))?;

        // Write resolved content
        let full_path = workdir.join(&path);
        std::fs::write(&full_path, &resolved_content)
            .map_err(|e| GitError::OperationFailed(
                format!("Failed to write resolved file: {}", e)
            ))?;

        // Stage the file (removes conflict entry)
        let mut index = repo.index()?;
        index.add_path(Path::new(&path))?;
        index.write()?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

### React: ConflictBlade Opening from MergeDialog
```tsx
// Source: Following existing blade navigation pattern
// In MergeDialog.tsx, add a button to open conflict resolution:
import { useNavigationStore } from "../../../stores/navigation";

function handleOpenConflict(filePath: string) {
  navigationStore.push({
    type: "conflict-resolution",
    title: `Resolve: ${filePath}`,
    props: { filePath },
  });
}

// In the conflicted files list:
{result.conflictedFiles.map((file) => (
  <li key={file} className="flex items-center gap-2">
    <span className="text-ctp-red">{file}</span>
    <button
      type="button"
      onClick={() => handleOpenConflict(file)}
      className="text-xs text-ctp-blue hover:underline"
    >
      Resolve
    </button>
  </li>
))}
```

### Monaco: Editable Result Editor with Conflict Decorations
```tsx
// Source: Monaco Editor decorations API + existing DiffContent pattern
import { Editor, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

interface ConflictResultEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  conflictRanges?: Array<{
    startLine: number;
    endLine: number;
    status: "ours" | "theirs" | "both" | "unresolved";
  }>;
}

export function ConflictResultEditor({
  value, language, onChange, conflictRanges
}: ConflictResultEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    updateDecorations(editor, conflictRanges);
  };

  // Update decorations when conflict ranges change
  useEffect(() => {
    if (editorRef.current && conflictRanges) {
      updateDecorations(editorRef.current, conflictRanges);
    }
  }, [conflictRanges]);

  return (
    <Editor
      value={value}
      language={language}
      theme="flowforge-dark"
      onChange={(v) => onChange(v ?? "")}
      options={{
        ...MONACO_COMMON_OPTIONS,
        readOnly: false,  // Editable!
        glyphMargin: true,
      }}
      onMount={handleMount}
    />
  );
}

function updateDecorations(
  editor: monaco.editor.IStandaloneCodeEditor,
  ranges?: ConflictResultEditorProps["conflictRanges"],
) {
  if (!ranges) return;
  const decorations = ranges.map((range) => ({
    range: new monaco.Range(range.startLine, 1, range.endLine, 1),
    options: {
      isWholeLine: true,
      className: range.status === "unresolved"
        ? "conflict-unresolved-bg"    // bg-ctp-red/10
        : "conflict-resolved-bg",     // bg-ctp-green/10
      glyphMarginClassName: range.status === "unresolved"
        ? "conflict-unresolved-glyph" // red dot
        : "conflict-resolved-glyph",  // green check
    },
  }));
  // Use createDecorationsCollection for clean management
  editor.createDecorationsCollection(decorations);
}
```

### Catppuccin Conflict Colors
```css
/* Add to index.css or a dedicated conflict.css */
/* Conflict resolution decoration classes for Monaco */
.conflict-unresolved-bg {
  background: rgba(243, 139, 168, 0.1); /* ctp-red at 10% */
}
.conflict-resolved-bg {
  background: rgba(166, 227, 161, 0.1); /* ctp-green at 10% */
}
.conflict-partial-bg {
  background: rgba(249, 226, 175, 0.1); /* ctp-yellow at 10% */
}
.conflict-unresolved-glyph {
  background: #f38ba8; /* ctp-red */
  border-radius: 50%;
  width: 8px !important;
  height: 8px !important;
  margin: auto;
}
.conflict-resolved-glyph {
  background: #a6e3a1; /* ctp-green */
  border-radius: 50%;
  width: 8px !important;
  height: 8px !important;
  margin: auto;
}
```

### Toast on Resolution Complete
```typescript
// Source: Existing toast pattern from src/core/stores/toast.ts
import { toast } from "../../stores/toast";

function handleMarkResolved(filePath: string) {
  resolveConflictFile(filePath, resolvedContent).then(() => {
    toast.success(`Resolved: ${filePath.split("/").pop()}`);
    // Invalidate staging query to refresh file list
    queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    queryClient.invalidateQueries({ queryKey: ["mergeStatus"] });
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parse conflict markers from file | Use git2 index-based conflict API | Always best practice | Clean three-way content, no parsing bugs |
| External merge tools (meld, kdiff3) | Inline editor resolution | VS Code pioneered ~2017 | No context switching, faster resolution |
| Full three-pane Monaco | Two-pane diff + editable result | Monaco DiffEditor limitation | Practical constraint, works well in practice |
| Global undo (Ctrl+Z in editor) | Per-hunk undo stack in state | Modern merge UIs | Better UX, targeted undo |

**Deprecated/outdated:**
- Monaco's old `IEditorDecorationsCollection` API using `deltaDecorations()` - replaced by `createDecorationsCollection()` in recent versions
- `editor.getModel().deltaDecorations()` - use the collection-based API instead

## Extensibility Considerations

### Interface Boundaries for Future Extension Extraction

The conflict resolution feature should be built with clear interface boundaries:

1. **ConflictProvider interface:** Abstract the conflict data source so it could be swapped (e.g., for rebase conflicts, cherry-pick conflicts):
```typescript
interface ConflictProvider {
  getConflictEntries(): Promise<ConflictEntry[]>;
  getConflictContent(path: string): Promise<ConflictFileContent>;
  resolveFile(path: string, content: string): Promise<void>;
}
```

2. **Resolution strategy pattern:** Allow different resolution strategies to be plugged in:
```typescript
interface ResolutionStrategy {
  id: string;
  label: string;
  icon: LucideIcon;
  apply(ours: string, theirs: string, ancestor?: string): string;
}
```

3. **Blade registration via extension API:** The ConflictBlade could be registered as a `coreOverride` extension blade, following the pattern in ExtensionAPI.ts (line 184).

### How Phase 48 DiffBlade Enables This

Phase 48 decomposed DiffBlade into:
- `DiffContent` - Reusable Monaco DiffEditor wrapper with options
- `DiffToolbar` - Composable toolbar with leading/trailing slots
- `DiffMarkdownPreview` - Separate preview component
- `useDiffQuery` - Data fetching hook
- `useDiffPreferences` - Preferences hook

ConflictBlade reuses:
- `DiffContent` for the ours-vs-theirs read-only comparison pane
- `DiffToolbar` pattern for ConflictToolbar (similar structure, different actions)
- `MONACO_COMMON_OPTIONS` and `MONACO_THEME` for consistent editor configuration
- The blade registration pattern from `registration.tsx`

## Open Questions

1. **Hunk Detection Strategy**
   - What we know: git2 provides full file content for each side, not individual hunks
   - What's unclear: Best algorithm to identify individual conflict hunks from two complete file versions
   - Recommendation: Use Monaco's `getLineChanges()` from DiffEditor to identify hunk boundaries programmatically, then map action buttons to those ranges. This leverages Monaco's built-in diff algorithm rather than implementing our own.

2. **Result Editor Initial Content**
   - What we know: Working directory has conflict markers, git2 index has clean versions
   - What's unclear: Should result editor start with "ours" content, empty, or working dir content?
   - Recommendation: Start with "ours" content as the base. This follows VS Code's convention and gives users a reasonable starting point. Each hunk can then be individually replaced with "theirs" or "both" versions.

3. **Conflict Resolution During Rebase**
   - What we know: `repo.state()` returns `RepositoryState::Rebase*` during rebase
   - What's unclear: Whether the same conflict API works identically during rebase vs merge
   - Recommendation: Scope Phase 49 to merge conflicts only. The `ConflictProvider` interface pattern allows adding rebase support later without changing the UI. Check `repo.state() == RepositoryState::Merge` as a precondition.

4. **Performance Threshold for Large Files**
   - What we know: Monaco handles files up to ~100K lines well; git2 blob reading is fast
   - What's unclear: At what point should we show a warning or degrade gracefully?
   - Recommendation: Show a warning banner for files > 10,000 lines. Disable real-time decoration updates for files > 50,000 lines and use on-demand rendering instead.

## Sources

### Primary (HIGH confidence)
- `/websites/docs_rs-git2` (Context7) - IndexConflict, IndexEntry, Index::conflicts(), Index::conflict_get()
- `/microsoft/monaco-editor` (Context7) - DiffEditor creation, decorations API, content widgets
- `/suren-atoyan/monaco-react` (Context7) - DiffEditor React component props, onMount, getModifiedEditor/getOriginalEditor
- Existing codebase: `src-tauri/src/git/merge.rs` - Already uses index.conflicts() and IndexConflict
- Existing codebase: `src-tauri/src/git/diff.rs` - `detect_language()`, `get_blob_content()`, `FileDiff` pattern
- Existing codebase: `src-tauri/src/git/staging.rs` - `stage_file()`, `FileStatus::Conflicted`
- Existing codebase: `src/core/blades/diff/` - DiffBlade decomposition, DiffContent, DiffToolbar
- Existing codebase: `src/core/machines/merge/` - mergeMachine with "conflicted" state

### Secondary (MEDIUM confidence)
- Monaco Editor diff theme colors verified against existing `monacoTheme.ts` - confirmed working pattern
- Catppuccin color hex values verified against existing `index.css` theme variables

### Tertiary (LOW confidence)
- Performance thresholds (10K/50K line limits) - based on general Monaco performance characteristics, not benchmarked in this project

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, APIs verified via Context7 and existing code
- Architecture: HIGH - Follows established blade/store/command patterns with clear code examples
- Pitfalls: HIGH - Based on git2 API semantics (verified) and Monaco limitations (verified)
- Extensibility: MEDIUM - Interface patterns are reasonable but haven't been validated against extension system constraints

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days - stable libraries, well-understood APIs)
