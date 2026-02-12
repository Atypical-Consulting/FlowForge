# Phase 50: Hunk & Line Staging -- Developer Research

## Table of Contents

1. [Existing Codebase Analysis](#1-existing-codebase-analysis)
2. [Rust / git2-rs Implementation](#2-rust--git2-rs-implementation)
3. [Tauri Command Design](#3-tauri-command-design)
4. [React Component Implementation](#4-react-component-implementation)
5. [Tailwind v4 & Theme Patterns](#5-tailwind-v4--theme-patterns)
6. [Refactoring for Extensibility](#6-refactoring-for-extensibility)
7. [Testing Strategy](#7-testing-strategy)
8. [Implementation Recommendations](#implementation-recommendations)

---

## 1. Existing Codebase Analysis

### 1.1 Current Staging Pipeline (Rust)

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src-tauri/src/git/staging.rs`

The current staging module provides whole-file operations only:

| Command | Signature | Description |
|---------|-----------|-------------|
| `stage_file` | `(path: String, state: State<RepositoryState>) -> Result<(), GitError>` | `index.add_path()` or `index.remove_path()` |
| `unstage_file` | `(path: String, state: State<RepositoryState>) -> Result<(), GitError>` | `repo.reset_default()` against HEAD |
| `stage_files` | `(paths: Vec<String>, state: State<RepositoryState>) -> Result<(), GitError>` | Batch via `index.add_all()` + `index.update_all()` |
| `unstage_files` | `(paths: Vec<String>, state: State<RepositoryState>) -> Result<(), GitError>` | Batch via `repo.reset_default()` |
| `stage_all` / `unstage_all` | `(state: State<RepositoryState>) -> Result<(), GitError>` | Global `["*"]` pathspec |

Key patterns observed:
- All commands use `tokio::task::spawn_blocking` + `git2::Repository::open(&path)` per invocation
- Index is opened, mutated, and written within a single blocking closure
- Error handling converts `git2::Error` via `From<git2::Error> for GitError`
- Unborn branch edge case handled by checking `ErrorCode::UnbornBranch`

### 1.2 Current Diff Pipeline (Rust)

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src-tauri/src/git/diff.rs`

The existing `DiffHunk` struct captures hunk metadata but **no line-level content**:

```rust
pub struct DiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header: String,
}
```

The `get_file_diff` command returns `FileDiff` containing:
- `old_content` / `new_content` -- full file text (used by Monaco DiffEditor)
- `hunks: Vec<DiffHunk>` -- hunk ranges (metadata only)
- `is_binary` / `language`

Two diff sources:
- **Staged**: `get_staged_diff()` -- `repo.diff_tree_to_index(head_tree, None, opts)`
- **Unstaged**: `get_unstaged_diff()` -- `repo.diff_index_to_workdir(None, opts)`

Helper: `get_blob_content(repo, tree, path)` retrieves blob as UTF-8 string.

### 1.3 Current Frontend Diff Display

**DiffBlade** (`/Users/phmatray/Repositories/github-phm/FlowForge/src/core/blades/diff/DiffBlade.tsx`):
- Uses `@monaco-editor/react` `DiffEditor` component
- Supports inline and side-by-side modes via `renderSideBySide` option
- `glyphMargin: true` is already set in `DiffContent.tsx` options
- Collapse unchanged regions enabled via `hideUnchangedRegions`
- `useDiffQuery` hook (`/Users/phmatray/Repositories/github-phm/FlowForge/src/core/blades/diff/hooks/useDiffQuery.ts`) wraps the Tauri command call

**InlineDiffViewer** (`/Users/phmatray/Repositories/github-phm/FlowForge/src/core/blades/staging-changes/components/InlineDiffViewer.tsx`):
- Compact diff preview inside the staging panel
- `glyphMargin: false` -- no margin space for controls currently
- 150ms debounce on file path changes for keyboard navigation perf
- Uses `useQuery` with `staleTime: 5000` and `refetchInterval` on staging status

**StagingChangesBlade** (`/Users/phmatray/Repositories/github-phm/FlowForge/src/core/blades/staging-changes/StagingChangesBlade.tsx`):
- `SplitPaneLayout` with file list (StagingPanel) and diff preview (StagingDiffPreview)
- `useQuery(["stagingStatus"])` with `refetchInterval: 2000` for auto-refresh
- Stage/unstage triggers `queryClient.invalidateQueries({ queryKey: ["stagingStatus"] })`
- Keyboard shortcuts: up/down/j/k for navigation, Enter for expand, Space for toggle stage

### 1.4 Phase 49 Patterns Established

From the conflict resolution extension (`/Users/phmatray/Repositories/github-phm/FlowForge/src/extensions/conflict-resolution/`):

**Hunk-level actions**: `ConflictHunkActions` component renders per-hunk resolution buttons. Each hunk has `id`, `startLine`, `endLine`, `resolution` state. This exact pattern can be adapted for staging hunks.

**git2 index operations**: Phase 49 demonstrated safe index manipulation with:
```rust
let mut index = repo.index()?;
index.add_path(Path::new(&path))?;
index.write()?;
```

**Extension architecture**: Conflict resolution is a built-in extension registered via `onActivate(api)` with blade, toolbar, command, and git hook registrations. Auto-cleanup via `api.cleanup()`.

**Store pattern**: `useConflictStore` (Zustand) holds per-file state with hunks, undo stack, and resolution status. This mirrors what a hunk staging store would need.

### 1.5 Monaco Editor Configuration

**Theme**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/core/lib/monacoTheme.ts`
- Custom `flowforge-dark` theme with Catppuccin Mocha colors
- Already defines diff-specific colors:
  - `diffEditor.insertedTextBackground`: `#a6e3a140` (ctp-green 25%)
  - `diffEditor.removedTextBackground`: `#f38ba840` (ctp-red 25%)
  - `diffEditor.insertedLineBackground`: `#a6e3a110` (ctp-green 6%)
  - `diffEditorGutter.insertedLineBackground`: `#a6e3a130` (ctp-green 18%)

**Shared config**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/core/lib/monacoConfig.ts`
- `MONACO_COMMON_OPTIONS` with `readOnly: true`, `glyphMargin` enabled in DiffContent

### 1.6 TypeScript Bindings

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/bindings.ts` (auto-generated by tauri-specta)

Key types from bindings:
```typescript
export type DiffHunk = {
  oldStart: number; oldLines: number;
  newStart: number; newLines: number;
  header: string
}
export type FileDiff = {
  path: string; oldContent: string; newContent: string;
  hunks: DiffHunk[]; isBinary: boolean; language: string
}
export type FileChange = {
  path: string; status: FileStatus;
  additions: number | null; deletions: number | null
}
export type StagingStatus = {
  staged: FileChange[]; unstaged: FileChange[];
  untracked: FileChange[]
}
```

---

## 2. Rust / git2-rs Implementation

### 2.1 Partial Staging Strategy

git2-rs (v0.20, matching our `Cargo.toml`) provides the core primitives:

#### Option A: `Repository::apply()` with `ApplyLocation::Index` (RECOMMENDED)

```rust
use git2::{ApplyLocation, ApplyOptions, Diff, Patch, Repository};

// 1. Generate a diff for the target file
// 2. Build a filtered patch containing only selected hunks/lines
// 3. Apply the patch to the index
repo.apply(&filtered_diff, ApplyLocation::Index, Some(&mut apply_opts))?;
```

Key API surface:
- `Repository::apply(diff, location, options)` -- applies a diff to workdir, index, or both
- `ApplyLocation::Index` -- targets only the git index (staging area)
- `ApplyOptions::hunk_callback(cb)` -- filter which hunks to apply (returns `bool`)
- `ApplyOptions::delta_callback(cb)` -- filter which files to apply (returns `bool`)
- `Patch::from_diff(diff, idx)` -- extract a single-file patch from a multi-file diff
- `Patch::from_buffers(old, old_path, new, new_path, opts)` -- create patch from content

#### Option B: Manual blob creation + index entry replacement

```rust
// 1. Read original content from HEAD/index
// 2. Construct new content by applying selected hunks/lines
// 3. Create blob from new content: repo.blob(new_content.as_bytes())
// 4. Update index entry: index.add_frombuffer(&entry, new_content.as_bytes())
// 5. Write index: index.write()
```

This is more manual but gives complete control over line-level granularity.

#### Decision: Hybrid approach

- **For hunk staging**: Use `Repository::apply()` with `ApplyOptions::hunk_callback` to filter hunks. This is the cleanest API and delegates line-level patching to libgit2.
- **For line staging**: Use manual content construction since `apply()` operates at hunk granularity. Build modified content by selectively including/excluding lines from each hunk, then write via `index.add_frombuffer()`.

### 2.2 Hunk Staging Implementation

```rust
/// Stage specific hunks of a file.
///
/// Applies only the selected hunks to the index, leaving other hunks unstaged.
pub async fn stage_hunks(
    path: String,
    hunk_indices: Vec<usize>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Generate diff: index -> workdir for this file
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(&path);
        let diff = repo.diff_index_to_workdir(None, Some(&mut diff_opts))?;

        // Create apply options with hunk filter
        let hunk_set: std::collections::HashSet<usize> = hunk_indices.into_iter().collect();
        let mut current_hunk: usize = 0;

        let mut apply_opts = git2::ApplyOptions::new();
        apply_opts.hunk_callback(move |_hunk| {
            let include = hunk_set.contains(&current_hunk);
            current_hunk += 1;
            include
        });

        // Apply filtered diff to index
        repo.apply(&diff, git2::ApplyLocation::Index, Some(&mut apply_opts))?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

### 2.3 Unstage Hunk Implementation

Unstaging hunks requires the reverse operation: applying the inverse of selected hunks from the HEAD->index diff back to the index.

```rust
/// Unstage specific hunks of a file.
///
/// Reverse-applies the selected hunks from the index, restoring them to HEAD state.
pub async fn unstage_hunks(
    path: String,
    hunk_indices: Vec<usize>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Generate diff: HEAD -> index for this file
        let head_tree = repo.head()?.peel_to_tree()?;
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(&path);
        let diff = repo.diff_tree_to_index(
            Some(&head_tree), None, Some(&mut diff_opts)
        )?;

        // We need the REVERSE diff to unstage: apply the inverse
        // Option: generate diff from index->HEAD (swap old/new)
        // git2 supports diff reversal internally
        let hunk_set: std::collections::HashSet<usize> = hunk_indices.into_iter().collect();
        let mut current_hunk: usize = 0;

        let mut apply_opts = git2::ApplyOptions::new();
        apply_opts.hunk_callback(move |_hunk| {
            let include = hunk_set.contains(&current_hunk);
            current_hunk += 1;
            include
        });

        // For unstaging, we need to manually reconstruct the index content
        // by reverting selected hunks back to HEAD state
        // Alternative: use manual blob approach for unstaging
        stage_hunks_manual(&repo, &path, &diff, &hunk_set, /* reverse */ true)?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

### 2.4 Line Staging Implementation (Manual Approach)

Line staging cannot use `Repository::apply()` hunk callbacks since those work at hunk granularity. Instead, we construct modified content manually:

```rust
/// Stage specific lines within a file's diff.
///
/// Lines are identified by their position in the new (modified) content.
/// Only additions and deletions within the specified line range are staged.
pub async fn stage_lines(
    path: String,
    line_ranges: Vec<LineRange>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> {
    // 1. Get the current index content (base for staging)
    // 2. Get the workdir content (source of changes)
    // 3. Generate the diff hunks between index and workdir
    // 4. For each hunk, selectively include lines that fall within line_ranges
    // 5. Construct new content from index content + selected changes
    // 6. Write new blob and update index entry
    // ...
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LineRange {
    pub start: u32,  // 1-based line number in the modified side
    pub end: u32,    // inclusive
}
```

The manual content construction algorithm:

```
For each hunk in diff:
  For each line in hunk:
    If line is CONTEXT -> always include in result
    If line is ADDITION:
      If line number is in selected_ranges -> include in result
      Else -> skip (don't stage this addition)
    If line is DELETION:
      If line number is in selected_ranges -> skip (stage the deletion)
      Else -> include original line (don't stage this deletion)
```

### 2.5 Enhanced DiffHunk for Frontend

The current `DiffHunk` struct lacks line-level detail needed by the UI. We need an enriched version:

```rust
/// A diff line with its origin type and content.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub origin: DiffLineOrigin,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DiffLineOrigin {
    Context,
    Addition,
    Deletion,
    // Header lines not needed for staging
}

/// Enhanced hunk with per-line detail for interactive staging.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunkDetail {
    pub index: usize,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header: String,
    pub lines: Vec<DiffLine>,
}
```

We can either:
1. **Extend `get_file_diff`** to include line-level data (breaking change to `FileDiff`)
2. **Add a new command** `get_file_diff_detailed` that returns enriched data
3. **Add line data to `DiffHunk`** as an optional field

**Recommendation**: Option 3 -- add `lines: Vec<DiffLine>` as an optional field to `DiffHunk` (empty by default for perf), and create a separate `get_file_diff_hunks` command for the interactive staging view that populates lines. This avoids breaking existing consumers.

### 2.6 Error Recovery

- All index mutations happen within a single `spawn_blocking` closure
- If `repo.apply()` fails, the index is untouched (atomic operation in libgit2)
- For manual blob approach, call `index.write()` only after all entries are updated
- Consider `index.read(true)?` to force-reload index if concurrent access is detected
- Return specific error variants: `HunkIndexOutOfRange`, `LineRangeInvalid`, `BinaryFileUnsupported`

---

## 3. Tauri Command Design

### 3.1 Command Signatures

Following existing patterns from `staging.rs` and `conflict.rs`:

```rust
// In src-tauri/src/git/staging.rs (extend existing file)

#[tauri::command]
#[specta::specta]
pub async fn stage_hunks(
    path: String,
    hunk_indices: Vec<u32>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> { ... }

#[tauri::command]
#[specta::specta]
pub async fn unstage_hunks(
    path: String,
    hunk_indices: Vec<u32>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> { ... }

#[tauri::command]
#[specta::specta]
pub async fn stage_lines(
    path: String,
    line_ranges: Vec<LineRange>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> { ... }

#[tauri::command]
#[specta::specta]
pub async fn unstage_lines(
    path: String,
    line_ranges: Vec<LineRange>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> { ... }

// In src-tauri/src/git/diff.rs (new command)

#[tauri::command]
#[specta::specta]
pub async fn get_file_diff_hunks(
    path: String,
    staged: bool,
    state: State<'_, RepositoryState>,
) -> Result<Vec<DiffHunkDetail>, GitError> { ... }
```

### 3.2 IPC Serialization Types

New types needed (all derive `Serialize, Deserialize, Type` for specta):

```rust
// LineRange: identifies a contiguous range of lines to stage/unstage
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}
```

Corresponding TypeScript (auto-generated):
```typescript
export type LineRange = { start: number; end: number }
export type DiffLineOrigin = "context" | "addition" | "deletion"
export type DiffLine = {
  origin: DiffLineOrigin;
  oldLineno: number | null;
  newLineno: number | null;
  content: string;
}
export type DiffHunkDetail = {
  index: number;
  oldStart: number; oldLines: number;
  newStart: number; newLines: number;
  header: string;
  lines: DiffLine[];
}
```

### 3.3 Command Registration

In `/Users/phmatray/Repositories/github-phm/FlowForge/src-tauri/src/lib.rs`, add to `collect_commands!`:

```rust
// Hunk/line staging commands
stage_hunks,
unstage_hunks,
stage_lines,
unstage_lines,
// Detailed diff command
get_file_diff_hunks,
```

And update the import block:
```rust
use git::staging::{
    get_staging_status, stage_all, stage_file, stage_files,
    stage_hunks, stage_lines,        // NEW
    unstage_all, unstage_file, unstage_files,
    unstage_hunks, unstage_lines,    // NEW
};
use git::diff::{
    get_commit_file_base64, get_commit_file_diff,
    get_file_base64, get_file_diff,
    get_file_diff_hunks,             // NEW
};
```

### 3.4 Bindings Generation

Running `cargo build` in dev mode auto-generates TypeScript bindings via:
```rust
builder.export(Typescript::default(), "../src/bindings.ts")
```
No manual TypeScript work needed -- tauri-specta handles this.

---

## 4. React Component Implementation

### 4.1 Component Architecture

```
DiffBlade (existing, enhanced)
  +-- DiffToolbar (existing, enhanced with hunk/line staging toggle)
  +-- DiffContent (existing, enhanced with gutter controls)
  |     +-- Monaco DiffEditor (existing)
  |     +-- HunkGutterWidget (NEW - overlay positioned over Monaco gutter)
  |     +-- LineSelectionOverlay (NEW - clickable line gutters)
  +-- HunkStagingBar (NEW - hunk action bar below toolbar)
  +-- StagingDiffNavigation (existing)

StagingChangesBlade (existing, enhanced)
  +-- StagingPanel (existing)
  |     +-- FileItem (existing, enhanced with partial-stage indicator)
  +-- StagingDiffPreview (existing, enhanced)
        +-- InlineDiffViewer (existing, enhanced with mini hunk controls)
```

### 4.2 Monaco DiffEditor Gutter Approach

Monaco's DiffEditor provides two sub-editors (original and modified). For hunk/line staging, we need interactive elements in the gutter area.

**Challenge**: Monaco's glyph margin decorations are visual-only (CSS classes), not interactive widgets. The `IContentWidget` and `IOverlayWidget` APIs provide interactivity but sit on top of editor content, not in the gutter margin.

**Solution approaches**:

#### Approach A: Glyph Margin Decorations + Click Handler (RECOMMENDED)

```typescript
// 1. Add glyph margin decorations marking hunk boundaries
editor.getModifiedEditor().createDecorationsCollection([
  {
    range: new monaco.Range(hunk.newStart, 1, hunk.newStart, 1),
    options: {
      glyphMarginClassName: 'hunk-stage-glyph',
      glyphMarginHoverMessage: { value: 'Click to stage this hunk' },
    },
  },
]);

// 2. Listen for glyph margin clicks
editor.getModifiedEditor().onMouseDown((e) => {
  if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
    const lineNumber = e.target.position?.lineNumber;
    // Determine which hunk this line belongs to
    // Trigger stage/unstage
  }
});
```

The CSS class `hunk-stage-glyph` can render a + or - icon via `::before` pseudo-element using Tailwind/CSS. This is similar to how VS Code's `git add -p` UI works in the gutter.

#### Approach B: Overlay Widgets Positioned Over Gutter

Place React-rendered buttons as overlay widgets aligned to hunk header lines. More flexible but harder to keep aligned during scrolling.

#### Approach C: Custom Hunk Action Bar (Simpler Alternative)

Similar to Phase 49's `ConflictHunkActions` component -- render hunk controls outside the Monaco editor in a toolbar/panel:

```tsx
<HunkStagingBar
  hunks={hunks}
  onStageHunk={(idx) => stageHunks(filePath, [idx])}
  onUnstageHunk={(idx) => unstageHunks(filePath, [idx])}
  onStageAllHunks={() => stageFile(filePath)}
/>
```

**Recommendation**: Use Approach A (glyph decorations + click handler) for the primary in-editor experience, with Approach C as a complementary action bar for discoverability and accessibility.

### 4.3 Line Selection UI

For line-level staging, users need to select specific lines:

```typescript
// Track selected lines in state
const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());

// Line decoration for selected lines
const decorations = Array.from(selectedLines).map(line => ({
  range: new monaco.Range(line, 1, line, 1),
  options: {
    isWholeLine: true,
    className: 'line-selected-for-staging',
    glyphMarginClassName: 'line-stage-checkbox',
  },
}));

// Click handler on line numbers or glyph margin
editor.getModifiedEditor().onMouseDown((e) => {
  if (
    e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
    e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
  ) {
    const line = e.target.position?.lineNumber;
    if (line) toggleLineSelection(line);
  }
});
```

Keyboard shortcuts for line selection:
- `Shift+Click` on line number: range selection
- `Ctrl/Cmd+Click` on line number: toggle individual line
- `Ctrl/Cmd+Shift+S`: stage selected lines
- `Ctrl/Cmd+Shift+U`: unstage selected lines

### 4.4 React State Management

Create a new Zustand slice or dedicated store for hunk/line staging state:

```typescript
// src/core/stores/domain/ui-state/hunk-staging.slice.ts

interface HunkStagingSlice {
  // Active file context
  activeFilePath: string | null;
  activeStaged: boolean;

  // Hunk metadata from backend
  hunks: DiffHunkDetail[];

  // UI selection state
  selectedHunks: Set<number>;     // hunk indices
  selectedLines: Set<number>;     // line numbers in modified editor

  // Actions
  setHunks: (hunks: DiffHunkDetail[]) => void;
  toggleHunkSelection: (index: number) => void;
  toggleLineSelection: (lineNumber: number) => void;
  selectLineRange: (start: number, end: number) => void;
  clearSelections: () => void;

  // Staging actions (call Tauri commands)
  stageSelectedHunks: () => Promise<void>;
  unstageSelectedHunks: () => Promise<void>;
  stageSelectedLines: () => Promise<void>;
  unstageSelectedLines: () => Promise<void>;
}
```

### 4.5 Query Invalidation for Immediate Reflection

After any staging operation, invalidate relevant queries:

```typescript
const queryClient = useQueryClient();

async function stageHunk(filePath: string, hunkIndex: number) {
  await commands.stageHunks(filePath, [hunkIndex]);
  // Invalidate both staging status and diff data
  queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
  queryClient.invalidateQueries({ queryKey: ["fileDiff", filePath] });
  queryClient.invalidateQueries({ queryKey: ["fileDiffHunks", filePath] });
}
```

The existing `refetchInterval: 2000` on staging status provides a safety net, but explicit invalidation gives immediate feedback.

### 4.6 Performance Considerations

- **Large diffs**: `DiffHunkDetail` with line data can be large. Use `staleTime` to avoid redundant fetches.
- **Monaco decorations**: Batch decoration updates using `createDecorationsCollection()` (replaces old deltaDecorations API). Only update on hunk data change.
- **Debouncing**: The existing 150ms debounce on InlineDiffViewer file path changes should be preserved. Hunk staging actions should be debounced separately (e.g., 100ms for rapid multi-hunk staging).
- **Memoization**: Memoize hunk-to-line-range mapping with `useMemo`. Memoize decoration arrays.

---

## 5. Tailwind v4 & Theme Patterns

### 5.1 Existing Theme Structure

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/index.css`

```css
@import "tailwindcss";
@import "@catppuccin/tailwindcss/mocha.css";

@theme {
    --font-sans: "Geist Variable", system-ui, ...;
    --font-mono: "JetBrains Mono Variable", ...;
    --animate-dirty-pulse: dirty-pulse 2s ease-in-out infinite;
    --animate-gentle-pulse: gentle-pulse 3s ease-in-out infinite;
}
```

### 5.2 New Theme Additions for Hunk Staging

Add staging-specific animation for visual feedback:

```css
@theme {
    /* existing entries... */
    --animate-stage-flash: stage-flash 0.3s ease-out;
}

@keyframes stage-flash {
    0% { background-color: rgb(166 227 161 / 0.3); }   /* ctp-green/30 */
    100% { background-color: transparent; }
}
```

### 5.3 Monaco Gutter Styling

Monaco glyph margin decorations use CSS classes. Add to `index.css`:

```css
/* Hunk staging gutter controls */
.hunk-stage-glyph::before {
    content: '+';
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    font-size: 14px;
    font-weight: bold;
    color: var(--catppuccin-color-green);
    background: rgb(166 227 161 / 0.15);
    cursor: pointer;
    transition: background 0.15s;
}
.hunk-stage-glyph:hover::before {
    background: rgb(166 227 161 / 0.3);
}

.hunk-unstage-glyph::before {
    content: '-';
    color: var(--catppuccin-color-red);
    background: rgb(243 139 168 / 0.15);
    /* same structure as above */
}

/* Line selection indicators */
.line-stage-checkbox::before {
    content: '';
    display: block;
    width: 12px;
    height: 12px;
    border: 1.5px solid var(--catppuccin-color-overlay1);
    border-radius: 2px;
    margin: 2px;
    cursor: pointer;
}
.line-stage-checkbox.selected::before {
    background: var(--catppuccin-color-blue);
    border-color: var(--catppuccin-color-blue);
}

/* Selected line highlight */
.line-selected-for-staging {
    background: rgb(137 180 250 / 0.1) !important;  /* ctp-blue/10 */
}
```

### 5.4 Catppuccin Token Usage Map

| UI Element | Color Token | Usage |
|------------|-------------|-------|
| Stage hunk button | `ctp-green` | Glyph icon, hover bg |
| Unstage hunk button | `ctp-red` | Glyph icon, hover bg |
| Selected line highlight | `ctp-blue/10` | Line background |
| Line checkbox border | `ctp-overlay1` | Unselected state |
| Line checkbox fill | `ctp-blue` | Selected state |
| Hunk header text | `ctp-subtext0` | `@@ -10,5 +10,7 @@` |
| Stage flash animation | `ctp-green/30` | Success feedback |
| Partial stage indicator | `ctp-yellow` | File list badge |

---

## 6. Refactoring for Extensibility

### 6.1 Diff Module Refactoring

The current `diff.rs` has duplicated hunk-extraction logic across `get_staged_diff`, `get_unstaged_diff`, and `get_commit_file_diff`. Extract a shared helper:

```rust
// src-tauri/src/git/diff.rs - New helper

/// Extract hunks (and optionally lines) from a git2::Diff.
fn extract_hunks(
    diff: &git2::Diff,
    include_lines: bool,
) -> Result<(Vec<DiffHunk>, Vec<DiffHunkDetail>, bool), GitError> {
    let mut is_binary = false;
    let mut hunks = Vec::new();
    let mut detailed_hunks = Vec::new();
    let mut hunk_index = 0;

    diff.foreach(
        &mut |delta, _| {
            if delta.flags().is_binary() { is_binary = true; }
            true
        },
        None,
        Some(&mut |_delta, hunk| {
            hunks.push(DiffHunk {
                old_start: hunk.old_start(),
                old_lines: hunk.old_lines(),
                new_start: hunk.new_start(),
                new_lines: hunk.new_lines(),
                header: String::from_utf8_lossy(hunk.header()).to_string(),
            });
            if include_lines {
                detailed_hunks.push(DiffHunkDetail {
                    index: hunk_index,
                    old_start: hunk.old_start(),
                    old_lines: hunk.old_lines(),
                    new_start: hunk.new_start(),
                    new_lines: hunk.new_lines(),
                    header: String::from_utf8_lossy(hunk.header()).to_string(),
                    lines: Vec::new(),
                });
            }
            hunk_index += 1;
            true
        }),
        if include_lines {
            Some(&mut |_delta, hunk, line| {
                if let Some(detail) = detailed_hunks.last_mut() {
                    detail.lines.push(DiffLine {
                        origin: match line.origin() {
                            '+' => DiffLineOrigin::Addition,
                            '-' => DiffLineOrigin::Deletion,
                            _ => DiffLineOrigin::Context,
                        },
                        old_lineno: line.old_lineno(),
                        new_lineno: line.new_lineno(),
                        content: String::from_utf8_lossy(line.content()).to_string(),
                    });
                }
                true
            })
        } else {
            None
        },
    )?;

    Ok((hunks, detailed_hunks, is_binary))
}
```

### 6.2 Staging Module Refactoring

Extract shared staging infrastructure:

```rust
// src-tauri/src/git/staging.rs - Internal helpers

/// Open repository and get path, or return error.
/// Reduces boilerplate across all staging commands.
async fn with_repo<F, T>(
    state: &State<'_, RepositoryState>,
    f: F,
) -> Result<T, GitError>
where
    F: FnOnce(git2::Repository, &std::path::Path) -> Result<T, GitError> + Send + 'static,
    T: Send + 'static,
{
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        f(repo, &repo_path)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

This eliminates the repeated open-repository-in-spawn-blocking boilerplate.

### 6.3 Frontend Refactoring Targets

#### Extract `useStagingActions` Hook

Currently, stage/unstage mutations are duplicated across `StagingPanel`, `FileItem`, and `StagingChangesBlade`. Create a shared hook:

```typescript
// src/core/blades/staging-changes/hooks/useStagingActions.ts

export function useStagingActions() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
  }, [queryClient]);

  const stageFile = useMutation({
    mutationFn: (path: string) => commands.stageFile(path),
    onSuccess: invalidate,
  });

  const unstageFile = useMutation({
    mutationFn: (path: string) => commands.unstageFile(path),
    onSuccess: invalidate,
  });

  const stageHunks = useMutation({
    mutationFn: ({ path, indices }: { path: string; indices: number[] }) =>
      commands.stageHunks(path, indices),
    onSuccess: invalidate,
  });

  // ... unstageHunks, stageLines, unstageLines

  return { stageFile, unstageFile, stageHunks, /* ... */ };
}
```

#### Extract Diff Data Utilities

Move hunk-to-line-range mapping to a utility module:

```typescript
// src/core/lib/diffUtils.ts

export function findHunkForLine(
  hunks: DiffHunkDetail[],
  lineNumber: number,
): DiffHunkDetail | undefined {
  return hunks.find(h =>
    lineNumber >= h.newStart && lineNumber < h.newStart + h.newLines
  );
}

export function linesToRanges(lines: Set<number>): LineRange[] {
  // Consolidate adjacent line numbers into contiguous ranges
  const sorted = Array.from(lines).sort((a, b) => a - b);
  const ranges: LineRange[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push({ start, end });
      start = sorted[i];
      end = sorted[i];
    }
  }
  if (start !== undefined) ranges.push({ start, end });
  return ranges;
}
```

### 6.4 Extension System Decision

**Should hunk staging be an extension?**

No. Hunk staging is core Git staging functionality, not an optional add-on. The arguments:

1. It directly modifies `staging.rs` and `diff.rs` -- core Rust modules
2. It enhances existing `DiffBlade` and `StagingChangesBlade` -- core UI
3. No external dependencies or optional features
4. All users of a Git client expect this functionality

However, the **UI controls** could be designed with extensibility in mind:
- Hunk action buttons use a registry pattern so extensions can add custom actions
- Line selection state is exposed via the UI store for potential extension consumption

---

## 7. Testing Strategy

### 7.1 Rust Unit Tests

Add to `src-tauri/src/git/staging.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn setup_repo() -> (TempDir, git2::Repository) {
        let dir = TempDir::new().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();

        // Create initial commit
        let mut index = repo.index().unwrap();
        fs::write(dir.path().join("file.txt"), "line1\nline2\nline3\n").unwrap();
        index.add_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();

        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = repo.signature().unwrap_or_else(|_|
            git2::Signature::now("Test", "test@test.com").unwrap()
        );
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[]).unwrap();

        (dir, repo)
    }

    #[test]
    fn test_stage_single_hunk() { /* ... */ }

    #[test]
    fn test_stage_hunk_out_of_range_returns_error() { /* ... */ }

    #[test]
    fn test_unstage_hunk_reverts_to_head() { /* ... */ }

    #[test]
    fn test_stage_lines_addition_only() { /* ... */ }

    #[test]
    fn test_stage_lines_deletion_only() { /* ... */ }

    #[test]
    fn test_stage_lines_mixed_changes() { /* ... */ }

    #[test]
    fn test_binary_file_returns_error() { /* ... */ }

    #[test]
    fn test_untracked_file_returns_error() { /* ... */ }

    #[test]
    fn test_conflicted_file_returns_error() { /* ... */ }

    #[test]
    fn test_empty_hunk_indices_is_noop() { /* ... */ }
}
```

### 7.2 React Component Tests

**DiffBlade with hunk controls** (`DiffBlade.test.tsx`):

```typescript
describe("DiffBlade hunk staging", () => {
  it("renders hunk stage buttons in glyph margin", async () => { /* ... */ });
  it("calls stageHunks when hunk glyph is clicked", async () => { /* ... */ });
  it("shows stage flash animation on success", async () => { /* ... */ });
  it("disables hunk controls for commit-mode diffs", async () => { /* ... */ });
  it("updates decorations after staging invalidation", async () => { /* ... */ });
});
```

**Line selection tests**:

```typescript
describe("DiffBlade line staging", () => {
  it("toggles line selection on line number click", async () => { /* ... */ });
  it("supports shift-click range selection", async () => { /* ... */ });
  it("calls stageLines with correct ranges", async () => { /* ... */ });
  it("clears selection after successful staging", async () => { /* ... */ });
});
```

### 7.3 Mock Strategies

For Monaco in tests (following existing pattern from `DiffBlade.test.tsx`):

```typescript
vi.mock("@monaco-editor/react", () => ({
  DiffEditor: ({ onMount }: any) => {
    // Simulate mount with mock editor API
    React.useEffect(() => {
      if (onMount) {
        onMount({
          getModifiedEditor: () => ({
            onMouseDown: vi.fn(),
            createDecorationsCollection: vi.fn(() => ({
              set: vi.fn(),
              clear: vi.fn(),
            })),
            setScrollTop: vi.fn(),
            onDidScrollChange: vi.fn(() => ({ dispose: vi.fn() })),
          }),
          getOriginalEditor: () => ({
            onMouseDown: vi.fn(),
          }),
          dispose: vi.fn(),
        });
      }
    }, []);
    return <div data-testid="mock-diff-editor" />;
  },
}));
```

For Tauri commands (extending existing mock pattern):

```typescript
const mockCommands = vi.hoisted(() => ({
  // ... existing mocks ...
  stageHunks: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  unstageHunks: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  stageLines: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  unstageLines: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  getFileDiffHunks: vi.fn().mockResolvedValue({
    status: "ok",
    data: [{
      index: 0, oldStart: 1, oldLines: 3, newStart: 1, newLines: 4,
      header: "@@ -1,3 +1,4 @@",
      lines: [
        { origin: "context", oldLineno: 1, newLineno: 1, content: "line1\n" },
        { origin: "addition", oldLineno: null, newLineno: 2, content: "new line\n" },
        { origin: "context", oldLineno: 2, newLineno: 3, content: "line2\n" },
        { origin: "context", oldLineno: 3, newLineno: 4, content: "line3\n" },
      ],
    }],
  }),
}));
```

### 7.4 Edge Cases to Test

| Case | Expected Behavior |
|------|-------------------|
| Binary file | Return `BinaryFileUnsupported` error |
| Empty hunk indices `[]` | No-op, return Ok |
| Hunk index out of range | Return `HunkIndexOutOfRange` error |
| Line range spanning multiple hunks | Stage lines from all affected hunks |
| File not in diff (no changes) | Return `NotFound` error |
| Conflicted file | Return error (cannot partially stage conflicts) |
| Renamed file | Use new path; ensure old path is handled |
| Unborn branch (no HEAD) | Handle like `unstage_file` for unborn branch case |
| Concurrent staging operations | Index locking via git2 ensures safety |
| File deleted in workdir | Handle via index.remove_path |
| Large file (>1MB) with many hunks | Performance test; ensure no UI freeze |

---

## Implementation Recommendations

### Top Technical Decisions

1. **Use `Repository::apply()` with `ApplyLocation::Index` for hunk staging** -- it is the most idiomatic git2 approach and handles edge cases (newline normalization, rename detection) automatically. Reserve manual blob construction only for line-level staging where hunk callbacks are insufficient.

2. **Do NOT make this an extension** -- hunk/line staging is core Git functionality. Implement in `staging.rs` and `diff.rs` directly, with UI in the existing `DiffBlade` and `StagingChangesBlade`.

3. **Add a new `get_file_diff_hunks` command** rather than modifying `get_file_diff` -- this avoids a breaking change to the existing `FileDiff` type and keeps the lightweight diff path for the staging panel's inline preview. Only the full DiffBlade needs line-level data.

4. **Use Monaco glyph margin decorations + click handlers** for hunk controls -- this is the lightest-weight approach that works within Monaco's API. Supplement with a `HunkStagingBar` component for accessibility and discoverability.

5. **Create a `useStagingActions` hook** to centralize all staging mutations with consistent query invalidation, replacing the duplicated mutation setup across `StagingPanel`, `FileItem`, and `StagingChangesBlade`.

6. **Line staging uses manual content construction** on the Rust side -- `index.add_frombuffer()` with programmatically constructed content. This gives exact control over which lines are included.

7. **Invalidate both `stagingStatus` and `fileDiff` queries** after any hunk/line staging operation for immediate UI reflection (Success Criterion 3).

### Refactoring Checklist

#### Rust Backend

- [ ] Extract `extract_hunks()` helper from duplicated diff.foreach patterns in `diff.rs`
- [ ] Extract `with_repo()` helper to reduce boilerplate in `staging.rs`
- [ ] Add `DiffHunkDetail`, `DiffLine`, `DiffLineOrigin`, `LineRange` types to `diff.rs`
- [ ] Implement `stage_hunks` command in `staging.rs`
- [ ] Implement `unstage_hunks` command in `staging.rs`
- [ ] Implement `stage_lines` command in `staging.rs`
- [ ] Implement `unstage_lines` command in `staging.rs`
- [ ] Implement `get_file_diff_hunks` command in `diff.rs`
- [ ] Add new error variants: `HunkIndexOutOfRange`, `LineRangeInvalid`, `BinaryFileUnsupported`
- [ ] Register all new commands in `lib.rs`
- [ ] Write Rust unit tests with `tempfile::TempDir`

#### Frontend

- [ ] Create `useStagingActions` hook extracting shared staging mutations
- [ ] Create `src/core/lib/diffUtils.ts` with `findHunkForLine`, `linesToRanges`
- [ ] Add `hunk-staging.slice.ts` to ui-state store (selectedHunks, selectedLines)
- [ ] Enhance `DiffContent.tsx` with glyph margin click handlers and decorations
- [ ] Create `HunkStagingBar` component with stage/unstage hunk buttons
- [ ] Add line selection UI with shift-click range support in `DiffContent.tsx`
- [ ] Add keyboard shortcuts: `Ctrl+Shift+S` (stage), `Ctrl+Shift+U` (unstage)
- [ ] Update `DiffToolbar.tsx` with hunk/line staging mode toggle
- [ ] Add partial-stage indicator to `FileItem.tsx` (yellow dot for partially staged)
- [ ] Add stage flash animation CSS to `index.css`
- [ ] Add Monaco gutter CSS classes to `index.css`
- [ ] Update query invalidation to include `fileDiff` and `fileDiffHunks` keys
- [ ] Write React component tests for hunk controls and line selection
- [ ] Write integration-style tests for the full staging flow

#### CSS/Theme

- [ ] Add `--animate-stage-flash` to `@theme {}` block
- [ ] Add `.hunk-stage-glyph`, `.hunk-unstage-glyph` gutter styles
- [ ] Add `.line-stage-checkbox`, `.line-selected-for-staging` styles
- [ ] Use Monaco theme colors for gutter control backgrounds

### File Map (Expected Changes)

| File | Action |
|------|--------|
| `src-tauri/src/git/staging.rs` | MODIFY - add 4 new commands + helpers |
| `src-tauri/src/git/diff.rs` | MODIFY - add types, `get_file_diff_hunks`, `extract_hunks` |
| `src-tauri/src/git/error.rs` | MODIFY - add new error variants |
| `src-tauri/src/git/mod.rs` | NO CHANGE (staging and diff modules already registered) |
| `src-tauri/src/lib.rs` | MODIFY - register new commands |
| `src/bindings.ts` | AUTO-GENERATED |
| `src/core/blades/diff/components/DiffContent.tsx` | MODIFY - add gutter controls |
| `src/core/blades/diff/DiffBlade.tsx` | MODIFY - add hunk staging bar |
| `src/core/blades/diff/components/DiffToolbar.tsx` | MODIFY - staging mode toggle |
| `src/core/blades/staging-changes/components/FileItem.tsx` | MODIFY - partial indicator |
| `src/core/blades/staging-changes/components/InlineDiffViewer.tsx` | MODIFY - mini controls |
| `src/core/blades/staging-changes/hooks/useStagingActions.ts` | CREATE |
| `src/core/stores/domain/ui-state/hunk-staging.slice.ts` | CREATE |
| `src/core/lib/diffUtils.ts` | CREATE |
| `src/index.css` | MODIFY - gutter CSS, animations |

### Implementation Order (Suggested)

1. **Plan 1**: Rust backend -- types, `get_file_diff_hunks`, `stage_hunks`, `unstage_hunks` + tests
2. **Plan 2**: Rust backend -- `stage_lines`, `unstage_lines` + refactoring helpers + tests
3. **Plan 3**: Frontend -- `useStagingActions` hook, hunk staging store, `HunkStagingBar` component, DiffContent gutter decorations + click handlers, query invalidation
4. **Plan 4**: Frontend -- line selection UI, keyboard shortcuts, CSS theme additions, partial-stage indicator, tests
5. **Plan 5**: Integration testing, edge case fixes, UAT

---

*Research completed: 2026-02-12*
*Phase dependency: Phase 49 (inline conflict resolution) -- patterns for gutter decorations, git2 index operations, hunk-level actions*
