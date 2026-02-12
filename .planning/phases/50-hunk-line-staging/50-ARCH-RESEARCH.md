# Phase 50: Hunk & Line Staging - Architecture Research

**Researched:** 2026-02-12
**Domain:** Git partial staging, Monaco Editor gutter decorations, Zustand state management, Tauri/Rust git2-rs index manipulation
**Confidence:** HIGH (codebase analysis, git2 APIs) / MEDIUM (Monaco gutter widget integration)
**Depends on:** Phase 49 (conflict resolution established Monaco gutter patterns and git2 index operation serialization)

---

## 1. Component Architecture

### 1.1 Current DiffBlade Component Tree

```
DiffBlade (src/core/blades/diff/DiffBlade.tsx)
  |-- DiffToolbar (toolbar with inline/side-by-side toggle, collapse, markdown preview, trailing slot)
  |-- DiffContent (Monaco DiffEditor wrapper with options, mount/dispose lifecycle)
  |-- DiffMarkdownPreview (alternative preview for .md files)
  |-- StagingDiffNavigation (prev/next file nav for staging mode, in trailing slot)
```

The `DiffBlade` receives a `DiffSource` prop:
```typescript
type DiffSource =
  | { mode: "staging"; filePath: string; staged: boolean }
  | { mode: "commit"; oid: string; filePath: string };
```

Hunk/line staging only applies when `source.mode === "staging"` and `source.staged === false` (unstaged changes). Staged diffs would use "unstage hunk/line" operations.

### 1.2 Current InlineDiffViewer (Staging Panel Preview)

The `InlineDiffViewer` in `src/core/blades/staging-changes/components/InlineDiffViewer.tsx` is a compact inline diff used in the staging panel's detail pane. It is a separate Monaco DiffEditor instance with `renderSideBySide: false` and `glyphMargin: false`. This component does NOT need full hunk staging controls -- it is a preview. However, a simplified "stage hunk" button in the gutter could be a stretch goal.

### 1.3 Recommended Component Architecture

Hunk/line staging should **enhance the existing DiffBlade**, not create a new blade. The rationale:

1. Users are already viewing diffs in DiffBlade when they want to stage hunks -- forcing a blade switch breaks flow.
2. Phase 49's ConflictResolutionBlade is a separate blade because conflict resolution is a different workflow (three-way merge). Hunk staging is an enhancement to the existing diff viewing workflow.
3. The `DiffSource` type already has `mode: "staging"` with `staged: boolean` -- this is the exact signal for when to show staging controls.

**New and modified components:**

```
DiffBlade (ENHANCED)
  |-- DiffToolbar (ENHANCED: add stage/unstage all hunks button when in staging mode)
  |-- DiffContent (ENHANCED: receive staging callbacks, pass to StagingDiffEditor)
  |   |-- StagingDiffEditor (NEW: wraps Monaco DiffEditor + gutter decorations)
  |   |   |-- HunkGutterWidget (NEW: stage/unstage button per hunk in glyph margin)
  |   |   |-- LineSelectionOverlay (NEW: handles line-range selection for line staging)
  |-- StagingDiffNavigation (existing, unchanged)

src/core/blades/diff/
  hooks/
    useDiffQuery.ts          (existing, unchanged)
    useDiffPreferences.ts    (existing, unchanged)
    useHunkStaging.ts        (NEW: hook wrapping staging operations and parsed hunks)
    useParsedDiff.ts         (NEW: parse diff into hunk structures for gutter placement)
  components/
    DiffContent.tsx          (ENHANCED: conditional switch to StagingDiffEditor)
    DiffToolbar.tsx          (ENHANCED: staging action buttons)
    StagingDiffEditor.tsx    (NEW: Monaco DiffEditor with gutter stage controls)
    HunkGutterWidget.tsx     (NEW: Monaco ViewZone/GlyphMargin decoration for stage button)
    LineCheckboxOverlay.tsx   (NEW: line-level checkbox overlays for line staging)
  lib/
    diffParser.ts            (NEW: parse unified diff into structured hunks with line mappings)
    patchBuilder.ts          (NEW: build git-apply-compatible patches from selected hunks/lines)
```

### 1.4 Why Not a Separate Extension?

Hunk staging is a **core Git workflow**, not an extension-quality feature. Every Git GUI (VS Code, GitKraken, Sublime Merge, Fork) provides hunk staging as a built-in capability. Making it an extension would:

- Create dependency issues (staging panel needs to know about hunk staging state)
- Add unnecessary indirection through the extension API
- Split diff viewing logic between core and extension

**Decision: Enhance core DiffBlade and add new Rust backend commands. No extension manifest needed.**

---

## 2. Data Flow Architecture

### 2.1 Current Diff Data Flow

```
Rust Backend                    Frontend
-----------                    --------
get_file_diff(path, staged)    useDiffQuery() -> react-query cache
  |                               |
  |- git2: diff_index_to_workdir  |- DiffBlade receives FileDiff
  |- git2: diff_tree_to_index     |- DiffContent gets old/new content strings
  |                               |- Monaco DiffEditor renders side-by-side
  |- returns FileDiff {           |
       oldContent,                |
       newContent,                |
       hunks: Vec<DiffHunk>,     |- hunks currently unused by frontend
       isBinary, language         |  (only old/new content strings used)
     }                            |
```

**Key insight:** The `DiffHunk` data is already returned by the Rust backend but is **not used** by the frontend. The hunks contain `oldStart`, `oldLines`, `newStart`, `newLines`, and `header` -- exactly the data needed to position gutter decorations.

### 2.2 Enhanced Data Flow for Hunk Staging

```
Rust Backend                    Frontend                          Monaco Editor
-----------                    --------                          ------------
get_file_diff()                useDiffQuery()                    DiffEditor
  |                               |                                  |
  |- returns FileDiff              |- DiffBlade gets FileDiff         |
  |   with hunks[]                |- useParsedDiff(hunks, content)   |
  |                               |   maps hunks to line ranges      |
  |                               |- useHunkStaging() manages        |
  |                               |   selected hunks/lines state     |
  |                               |                                  |
  |                               |- StagingDiffEditor renders       |
  |                               |   Monaco DiffEditor +            |- Glyph margin
  |                               |   gutter decorations             |  decorations
  |                               |                                  |- ViewZone widgets
  |                               |                                  |  for hunk headers
  |                               |                                  |- Line click handlers
  |                               |                                  |
stage_hunk(path, hunk_index)   <- user clicks stage hunk button    |
  |                               |                                  |
  |- builds patch from hunk       |- invalidates stagingStatus       |
  |- applies to index             |   and fileDiff queries           |
  |- writes index                 |- staging panel auto-refreshes    |
  |                               |                                  |
stage_lines(path, lines[])     <- user selects lines + stages      |
  |                               |                                  |
  |- builds patch from lines      |- same invalidation pattern       |
  |- applies to index             |                                  |
```

### 2.3 Staging State Location

**Decision: Staging operations are fire-and-forget -- no frontend staging state needed.**

Unlike conflict resolution (which needs a multi-step workflow store), hunk/line staging is an atomic operation:
1. User clicks "stage hunk" or selects lines
2. Frontend calls Rust backend command
3. Backend applies patch to index, returns success/error
4. Frontend invalidates `stagingStatus` and `fileDiff` queries
5. React-query refetches, UI updates

There is **no intermediate state** to manage. The only transient UI state is:
- Which lines are currently selected for line staging (component-local `useState`)
- Loading state during the Tauri command (react-query mutation state)

This means:
- **No new Zustand store** needed for staging operations
- **Component-local state** for line selection (ephemeral, lost on unmount -- which is correct)
- **react-query mutations** for staging operations (provides loading/error/success states)
- **Query invalidation** keeps staging panel in sync automatically

### 2.4 Keeping Staging Panel in Sync

The staging panel (`StagingPanel.tsx`) already polls `stagingStatus` every 2 seconds:
```typescript
const { data: result } = useQuery({
  queryKey: ["stagingStatus"],
  queryFn: () => commands.getStagingStatus(),
  refetchInterval: 2000,
});
```

Additionally, `App.tsx` listens for `repository-changed` Tauri events and invalidates `stagingStatus`:
```typescript
listen<{ paths: string[] }>("repository-changed", (event) => {
  queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
  queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
});
```

For hunk/line staging, we add **explicit invalidation after staging operations** (not relying on polling):

```typescript
const stageHunkMutation = useMutation({
  mutationFn: (args: { path: string; hunkIndex: number }) =>
    commands.stageHunk(args.path, args.hunkIndex),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    queryClient.invalidateQueries({ queryKey: ["fileDiff", filePath] });
  },
});
```

This provides **immediate** UI refresh (not waiting for 2-second poll), satisfying Success Criterion 3: "immediately reflected in the staging panel without requiring a manual refresh."

---

## 3. Rust Backend Design

### 3.1 git2-rs APIs for Partial Staging

git2-rs provides the following relevant APIs for partial staging:

| API | Purpose | Use Case |
|-----|---------|----------|
| `Repository::apply()` | Apply a diff to the repository | Apply hunk/line patch to index |
| `Diff::from_buffer()` | Create a Diff from raw unified diff bytes | Parse patch text into a Diff object |
| `Index::add_frombuffer()` | Add a file to index from in-memory content | Write computed staged content directly |
| `Repository::diff_index_to_workdir()` | Get diff between index and workdir | Source of hunk data |
| `Repository::diff_tree_to_index()` | Get diff between HEAD and index | Source of staged hunk data |
| `Diff::foreach()` | Iterate diff hunks and lines | Extract specific hunks/lines |

**Two approaches for applying partial diffs:**

#### Approach A: Patch Application via `Repository::apply()`
```rust
// Build a patch containing only the selected hunk(s)
// Apply it to the index using ApplyLocation::Index
let diff = repo.diff_index_to_workdir(None, Some(&mut opts))?;
// Filter to specific hunks, create new diff
repo.apply(&filtered_diff, ApplyLocation::Index, None)?;
```

**Pros:** Git-native patch semantics, handles context lines correctly.
**Cons:** git2's `apply()` is limited -- it does not support applying individual hunks from a multi-hunk diff directly. You need to construct a new Diff object containing only the desired hunks.

#### Approach B: Direct Index Manipulation via `Index::add_frombuffer()` (Recommended)
```rust
// 1. Read current index content for the file
// 2. Read current workdir content for the file
// 3. Compute the "partially staged" content:
//    - Start with index content (base)
//    - Apply only the selected hunk(s)/line(s) from workdir
// 4. Write the computed content to the index
let mut index = repo.index()?;
let entry = /* construct IndexEntry with correct mode, path, etc. */;
index.add_frombuffer(&entry, computed_content.as_bytes())?;
index.write()?;
```

**Pros:** Full control over the staged content, no patch format issues, handles all edge cases.
**Cons:** Requires computing the staged content manually (must apply hunks/lines correctly).

**Decision: Use Approach B (Index::add_frombuffer).** This is the approach used by `git add -p` under the hood. It gives us complete control and avoids the limitations of git2's `apply()` which does not natively support hunk-level filtering.

### 3.2 Proposed Rust Commands

```rust
// src-tauri/src/git/staging.rs (add to existing file)

/// A line range within a diff for partial staging.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffLineRange {
    /// 0-based hunk index within the file's diff
    pub hunk_index: u32,
    /// Line numbers within the hunk to include (1-based, relative to new file)
    /// If empty, the entire hunk is included.
    pub lines: Vec<u32>,
}

/// Stage specific hunks from a file's unstaged changes.
///
/// Reads the current index and workdir content, computes partial
/// staging by applying only the specified hunks, and writes the
/// result to the index.
#[tauri::command]
#[specta::specta]
pub async fn stage_hunk(
    path: String,
    hunk_index: u32,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> { ... }

/// Stage specific lines from a file's unstaged changes.
///
/// Similar to stage_hunk but applies only selected lines within
/// a hunk. Lines are specified as line numbers in the new (workdir)
/// content.
#[tauri::command]
#[specta::specta]
pub async fn stage_lines(
    path: String,
    line_ranges: Vec<DiffLineRange>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> { ... }

/// Unstage specific hunks from a file's staged changes.
///
/// Reverse of stage_hunk: reads HEAD and index content, removes
/// the specified hunk from the index, writing the result back.
#[tauri::command]
#[specta::specta]
pub async fn unstage_hunk(
    path: String,
    hunk_index: u32,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> { ... }

/// Unstage specific lines from a file's staged changes.
#[tauri::command]
#[specta::specta]
pub async fn unstage_lines(
    path: String,
    line_ranges: Vec<DiffLineRange>,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> { ... }
```

### 3.3 Partial Staging Algorithm (Core Logic)

The key algorithm for `stage_hunk` / `stage_lines`:

```
Input: file path, set of hunks/lines to stage
Output: new index entry with partially staged content

1. Get the current index content for the file (base for staging)
   - If file is new (untracked), base is empty
   - If file exists in index, read blob content

2. Get the full diff between index and workdir for the file
   - Parse into structured hunks with old/new line mappings

3. For each selected hunk/line:
   a. Identify the corresponding lines in the workdir content
   b. Identify the corresponding lines in the index content
   c. In the "result" buffer:
      - Keep index content for unselected regions
      - Replace with workdir content for selected hunks/lines

4. Handle edge cases:
   - Added files: base is empty, result is selected lines from workdir
   - Deleted files: staging deletion = removing from index
   - Renamed files: stage_hunk handles new path, old path cleanup

5. Write result to index:
   index.add_frombuffer(&entry, result.as_bytes())?;
   index.write()?;
```

For **unstaging**, the algorithm is reversed:
- Base is HEAD content (or empty for new files)
- Currently staged content is in the index
- Remove selected hunks from the index, reverting them to HEAD state

### 3.4 Error Handling

```rust
// New error variants for GitError enum
#[derive(Debug, Error, Serialize, Deserialize, Type, Clone)]
pub enum GitError {
    // ... existing variants ...

    #[error("Hunk index {0} out of range for file")]
    HunkOutOfRange(u32),

    #[error("Line {0} out of range in hunk {1}")]
    LineOutOfRange(u32, u32),

    #[error("Cannot partially stage a binary file")]
    BinaryPartialStaging,

    #[error("File has no unstaged changes: {0}")]
    NoUnstagedChanges(String),

    #[error("File has no staged changes: {0}")]
    NoStagedChanges(String),
}
```

### 3.5 Diff Line Information Enhancement

The current `DiffHunk` type lacks per-line information needed for line staging. We need an enhanced diff response:

```rust
/// A single line in a diff hunk.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    /// Line origin: '+' (addition), '-' (deletion), ' ' (context)
    pub origin: String,
    /// Line number in old file (None for additions)
    pub old_line_no: Option<u32>,
    /// Line number in new file (None for deletions)
    pub new_line_no: Option<u32>,
    /// The line content (without origin character)
    pub content: String,
}

/// Enhanced diff hunk with per-line information.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunkDetail {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header: String,
    pub lines: Vec<DiffLine>,
}

/// Enhanced file diff that includes per-line detail for staging.
/// Returned by a new command or as an opt-in enhancement to get_file_diff.
#[tauri::command]
#[specta::specta]
pub async fn get_file_diff_detailed(
    path: String,
    staged: bool,
    context_lines: u32,
    state: State<'_, RepositoryState>,
) -> Result<FileDiffDetailed, GitError> { ... }
```

The detailed line information is needed because:
1. Monaco line numbers don't directly correspond to hunk line offsets
2. Line staging needs to know which Monaco lines map to which diff additions/deletions
3. The gutter decorations need to distinguish between added, deleted, and context lines

---

## 4. Monaco Editor Integration

### 4.1 Gutter Decorations for Hunk Stage Controls

Monaco's DiffEditor provides the glyph margin (already enabled with `glyphMargin: true` in DiffContent.tsx). We can add decorations to indicate stageable regions:

```typescript
// Approach: Use Monaco's deltaDecorations API on the modified editor
const modifiedEditor = diffEditor.getModifiedEditor();

// Create decorations for each hunk
const decorations = hunks.map((hunk, index) => ({
  range: new monaco.Range(hunk.newStart, 1, hunk.newStart, 1),
  options: {
    isWholeLine: true,
    glyphMarginClassName: `hunk-stage-gutter hunk-${index}`,
    glyphMarginHoverMessage: { value: `Stage hunk ${index + 1}` },
  },
}));

modifiedEditor.deltaDecorations(previousDecorations, decorations);
```

However, Monaco's glyph margin decorations are **static icons/CSS**, not interactive buttons. For interactive controls, we need **ViewZones** or **Content Widgets**:

#### Option A: ViewZones for Hunk Headers (Recommended)
ViewZones inject DOM elements between editor lines. We can create a "Stage Hunk" button bar above each hunk:

```typescript
modifiedEditor.changeViewZones((accessor) => {
  for (const hunk of hunks) {
    accessor.addZone({
      afterLineNumber: hunk.newStart - 1, // Above the first line of the hunk
      heightInPx: 24,
      domNode: createHunkActionBar(hunk, index, onStageHunk),
    });
  }
});
```

The `createHunkActionBar` function creates a DOM element with "Stage Hunk" / "Unstage Hunk" buttons, styled to match the editor theme.

#### Option B: Overlay Widgets for Stage/Unstage Buttons
OverlayWidgets are absolutely positioned relative to the editor. Less ideal because they don't push content down and can overlap.

#### Option C: CSS-Only Glyph Margin with Click Handler
Combine glyph margin decoration (CSS icon) with a mousedown event listener on the editor to detect clicks in the glyph margin area.

**Decision: Use ViewZones (Option A) for hunk-level stage buttons, and glyph margin CSS decorations + click handler (Option C) for line-level stage indicators.**

### 4.2 Line-Level Click Handling

For line staging, users need to select individual lines. Approaches:

#### Sub-approach 1: Glyph Margin Checkboxes (VS Code Style)
Add a checkbox icon in the glyph margin for each added/modified line. Click toggles selection. A "Stage Selected Lines" button appears in the toolbar or ViewZone.

```typescript
// Add checkbox decorations for each added line
const lineDecorations = addedLines.map((line) => ({
  range: new monaco.Range(line.newLineNo, 1, line.newLineNo, 1),
  options: {
    glyphMarginClassName: selectedLines.has(line.newLineNo)
      ? 'line-staging-checkbox checked'
      : 'line-staging-checkbox',
  },
}));
```

#### Sub-approach 2: Line Range Selection via Mouse Drag
User clicks and drags in the margin to select a range of lines. Selected lines get a highlight decoration.

#### Sub-approach 3: Keyboard Shortcuts with Cursor Position
User positions cursor on a line and presses a shortcut (e.g., `S` key) to toggle that line for staging.

**Decision: Use Sub-approach 1 (glyph margin checkboxes) as primary, with Sub-approach 3 (keyboard shortcuts) as secondary.** This matches the VS Code and Sublime Merge patterns that users expect.

### 4.3 Monaco Editor Click Event Handling

Monaco provides `onMouseDown` event on editors, which includes the target element type:

```typescript
modifiedEditor.onMouseDown((e) => {
  if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
    const lineNumber = e.target.position?.lineNumber;
    if (lineNumber) {
      toggleLineSelection(lineNumber);
    }
  }
});
```

This allows us to detect clicks on the glyph margin and determine which line was clicked.

### 4.4 Performance with Large Diffs

Concerns and mitigations:

| Concern | Mitigation |
|---------|------------|
| Many ViewZones for files with 100+ hunks | Virtualize: only create ViewZones for hunks visible in the viewport. Use `onDidScrollChange` to manage. |
| Decoration re-creation on every selection change | Use `deltaDecorations` which diffs efficiently. Batch updates. |
| Re-parsing diff on every staging operation | Cache parsed hunks. Re-parse only when the `fileDiff` query data changes. |
| Large files (10K+ lines) with many added lines | Glyph margin decorations are lightweight CSS. No DOM elements per line. |

The existing `hideUnchangedRegions` option (already enabled) also helps by collapsing unchanged regions, reducing the visible line count.

---

## 5. Extension System Integration

### 5.1 Decision: Core Enhancement, Not Extension

As discussed in Section 1.4, hunk/line staging is a core feature. However, we should **leverage the extension system patterns** for:

- **Command registration:** Register "Stage Hunk at Cursor" and "Stage Selected Lines" in the command palette
- **Keyboard shortcut registration:** Register staging shortcuts
- **Toolbar actions:** "Stage All Hunks" / "Unstage All Hunks" buttons in DiffToolbar

These can be registered as core commands/shortcuts without going through the extension API, following the pattern in `src/core/lib/commandRegistry.ts`.

### 5.2 Integration with Existing Staging Panel

The staging panel needs **no modifications** for basic hunk/line staging. Here's why:

1. After staging a hunk, the file may appear in BOTH staged and unstaged sections (partially staged).
2. The existing `getStagingStatus()` already handles this: a file can have both `INDEX_MODIFIED` (staged) and `WT_MODIFIED` (unstaged) status flags simultaneously.
3. The staging panel will automatically show the file in both sections after query invalidation.
4. Clicking the file in either section opens DiffBlade with `staged: true` or `staged: false`.

The one enhancement to consider: the staging panel's `FileItem` could show a "partially staged" indicator (e.g., a half-filled circle icon) when a file appears in both staged and unstaged sections. This is a UX polish item, not a blocking requirement.

### 5.3 Command Palette Integration

```typescript
// Register in src/core/blades/diff/registration.tsx or a dedicated commands file
registerCommand({
  id: "diff.stageHunk",
  title: "Stage Hunk at Cursor",
  category: "Git",
  shortcut: "mod+shift+s",
  action: () => { /* get current hunk from DiffBlade context */ },
  enabled: () => { /* check if DiffBlade is active with staging mode */ },
});

registerCommand({
  id: "diff.stageSelectedLines",
  title: "Stage Selected Lines",
  category: "Git",
  shortcut: "mod+shift+l",
  action: () => { /* stage currently selected lines */ },
  enabled: () => { /* check if lines are selected in staging diff */ },
});
```

---

## 6. Extensibility & Refactoring Focus

### 6.1 Code That Needs Refactoring

#### 6.1.1 DiffContent.tsx -- Add Conditional Staging Editor

Currently `DiffContent` is a thin wrapper around `DiffEditor`. It needs to:
- Accept optional staging callbacks (`onStageHunk`, `onStageLines`)
- When staging callbacks are present, render `StagingDiffEditor` instead of plain `DiffEditor`
- Pass parsed hunk data to the staging editor

```typescript
// Before (current)
export function DiffContent({ original, modified, language, inline, ... }) {
  return <DiffEditor ... />;
}

// After (enhanced)
export function DiffContent({ original, modified, language, inline, stagingSource, ... }) {
  if (stagingSource) {
    return <StagingDiffEditor
      original={original}
      modified={modified}
      language={language}
      inline={inline}
      hunks={stagingSource.hunks}
      filePath={stagingSource.filePath}
      staged={stagingSource.staged}
    />;
  }
  return <DiffEditor ... />;
}
```

#### 6.1.2 DiffBlade.tsx -- Pass Hunk Data and Staging Callbacks

The `DiffBlade` needs to:
- Pass the `hunks` from `FileDiff` through to `DiffContent`
- Create staging mutation callbacks
- Handle the staging mode check

#### 6.1.3 useDiffQuery.ts -- Return Hunk Data

The hook already returns `FileDiff` which includes `hunks`, but the hunks aren't currently used by any component. The enhanced `get_file_diff_detailed` command returns per-line info. We can either:
- Add a new `useDiffDetailedQuery` hook
- Or enhance the existing `useDiffQuery` to optionally request detailed data

**Decision: Add a new `useDiffDetailedQuery` hook** that returns the detailed diff. The existing `useDiffQuery` stays unchanged (used by InlineDiffViewer and commit diffs). The new hook is only used by `StagingDiffEditor`.

### 6.2 Staging API Design for Future Features

The Rust backend API should be designed so future features can build on it:

```
Current Phase 50 API:
  stage_hunk(path, hunk_index)
  unstage_hunk(path, hunk_index)
  stage_lines(path, line_ranges)
  unstage_lines(path, line_ranges)
  get_file_diff_detailed(path, staged, context_lines)

Future-friendly extensions:
  - Interactive rebase line editing: reuses line-level diff parsing
  - Stash specific hunks: same hunk/line selection UI, different backend target
  - Discard hunk: same UI, calls `checkout_hunk` instead of `stage_hunk`
  - Patch export: same diff parsing, outputs to file instead of index
  - Blame-aware staging: correlate hunks with git blame for author info
```

### 6.3 Separation of Concerns

```
Layer 1: Diff Parsing (pure logic, no side effects)
  - diffParser.ts: parse FileDiff -> structured hunks with line mappings
  - patchBuilder.ts: build partial content from selected hunks/lines
  - These are pure functions, easily unit-testable

Layer 2: Staging Operations (Tauri IPC)
  - Rust commands: stage_hunk, unstage_hunk, stage_lines, unstage_lines
  - useHunkStaging hook: wraps mutations with invalidation
  - Handles loading/error states

Layer 3: Monaco UI (presentation)
  - StagingDiffEditor: creates ViewZones and decorations
  - HunkGutterWidget: renders stage/unstage button DOM
  - Line selection state: which lines are checked

Layer 4: Integration (wiring)
  - DiffBlade: decides when to enable staging mode
  - DiffContent: switches between plain and staging editor
  - Query invalidation: keeps staging panel in sync
```

### 6.4 Plugin Points for Custom Staging Behaviors

For extensibility, expose staging events through the `gitHookBus`:

```typescript
// Extensions can listen for staging events
api.onDidGit("stage-hunk", (context) => {
  // context: { filePath, hunkIndex, lineCount }
  // e.g., auto-commit extension, staging analytics
});

api.onWillGit("stage-hunk", (context) => {
  // Extensions can block/modify staging operations
  // e.g., lint check before staging, review requirement
  return { proceed: true };
});
```

This requires adding `"stage-hunk"` and `"stage-lines"` to the `GitOperation` type in `gitHookBus.ts`.

---

## 7. State Management Design

### 7.1 No New Zustand Store Needed

As discussed in Section 2.3, hunk/line staging is atomic and doesn't require a persistent store. The state model is:

```
Server State (Rust/git2):
  - Index content (the source of truth for what's staged)
  - Workdir content (what's on disk)
  - Managed entirely by git2

React-Query Cache:
  - stagingStatus: current staging state (auto-refreshes)
  - fileDiff: current diff for the viewed file (refetches on invalidation)
  - fileDiffDetailed: detailed diff with per-line info (refetches on invalidation)

Component-Local State (useState in StagingDiffEditor):
  - selectedLines: Set<number> -- lines checked for line staging
  - isStaging: boolean -- loading state during staging operation
  - expandedHunks: Set<number> -- which hunks have expanded line selection UI

No Zustand Store:
  - No intermediate "pending staging" state
  - No undo history needed (git itself is the undo mechanism -- unstage the hunk)
  - No cross-component state sharing (all staging UI is within DiffBlade)
```

### 7.2 Optimistic Updates vs Server-Confirmed State

**Decision: Server-confirmed state only (no optimistic updates).**

Rationale:
1. Staging operations are fast (index write is < 50ms typically)
2. Optimistic updates for diff content are dangerous -- showing wrong diff state could mislead users
3. The mutation + invalidation cycle is quick enough:
   - `stageHunk` Tauri command: ~20-50ms
   - Query invalidation + refetch: ~50-100ms
   - Total perceived latency: ~100-150ms (below the 200ms threshold for perceived instant)
4. If the staging operation fails, there's nothing to roll back in the UI

The mutation pattern:
```typescript
const stageHunkMutation = useMutation({
  mutationFn: ({ path, hunkIndex }: { path: string; hunkIndex: number }) =>
    commands.stageHunk(path, hunkIndex),
  onSuccess: () => {
    // Invalidate both staging status and the current diff
    queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    queryClient.invalidateQueries({ queryKey: ["fileDiff", filePath] });
    queryClient.invalidateQueries({ queryKey: ["fileDiffDetailed", filePath] });
  },
  onError: (error) => {
    toast.error(`Failed to stage hunk: ${error.message}`);
  },
});
```

### 7.3 Handling Concurrent Staging Operations

Scenario: User rapidly clicks "stage hunk" on multiple hunks.

**Risk:** Hunk indices shift after each staging operation. If hunk 3 is staged, what was hunk 4 becomes hunk 3. If a second staging command was in-flight targeting old hunk 4, it now stages the wrong hunk.

**Mitigation strategies:**

1. **Serial execution:** Disable all stage buttons while a staging operation is in-flight. Re-enable after the mutation settles and diff refetches. This is the safest approach.

2. **Hunk identification by content hash:** Instead of passing `hunk_index`, pass a content fingerprint (e.g., hash of hunk header + first line). The backend finds the matching hunk regardless of index shifts. More complex but allows rapid-fire staging.

3. **Queue-based staging:** Queue staging operations and execute them serially on the backend. Frontend shows all requested operations as pending.

**Decision: Use Strategy 1 (serial execution with button disable).** It's the simplest, safest, and the UX impact is minimal since each operation completes in ~100-150ms. The buttons are disabled for a barely perceptible moment.

Implementation:
```typescript
const isStaging = stageHunkMutation.isPending || unstageHunkMutation.isPending;

// In HunkGutterWidget:
<button
  disabled={isStaging}
  onClick={() => stageHunkMutation.mutate({ path, hunkIndex })}
>
  Stage Hunk
</button>
```

---

## 8. Detailed Diff Parser Design

### 8.1 Purpose

The `diffParser.ts` module bridges the gap between the raw `DiffHunk` data from the Rust backend and the Monaco line numbers needed for gutter decorations. It maps hunk boundaries to editor line numbers.

### 8.2 Hunk-to-Line Mapping

```typescript
// src/core/blades/diff/lib/diffParser.ts

export interface ParsedHunk {
  index: number;           // 0-based hunk index
  header: string;          // e.g., "@@ -10,5 +10,7 @@"
  oldStartLine: number;    // Line number in original (left) editor
  oldLineCount: number;    // Number of lines in original side
  newStartLine: number;    // Line number in modified (right) editor
  newLineCount: number;    // Number of lines in modified side
  // Detailed lines (from get_file_diff_detailed)
  lines: ParsedDiffLine[];
}

export interface ParsedDiffLine {
  origin: "+" | "-" | " ";     // addition, deletion, context
  oldLineNo: number | null;    // null for additions
  newLineNo: number | null;    // null for deletions
  content: string;
  // For line staging: is this line eligible for staging?
  stageable: boolean;          // true for "+" (addition) and "-" (deletion)
}

/**
 * Parse FileDiff hunks into structured data for Monaco decoration placement.
 * Maps hunk boundaries to editor line numbers.
 */
export function parseHunksForEditor(
  hunks: DiffHunk[],
  detailedHunks?: DiffHunkDetail[],
): ParsedHunk[] {
  return hunks.map((hunk, index) => ({
    index,
    header: hunk.header,
    oldStartLine: hunk.oldStart,
    oldLineCount: hunk.oldLines,
    newStartLine: hunk.newStart,
    newLineCount: hunk.newLines,
    lines: detailedHunks?.[index]?.lines.map((line) => ({
      origin: line.origin as "+" | "-" | " ",
      oldLineNo: line.oldLineNo ?? null,
      newLineNo: line.newLineNo ?? null,
      content: line.content,
      stageable: line.origin === "+" || line.origin === "-",
    })) ?? [],
  }));
}
```

### 8.3 Content Computation for Partial Staging

```typescript
// src/core/blades/diff/lib/patchBuilder.ts

/**
 * Compute the content that should be written to the index after
 * staging specific hunks from the workdir changes.
 *
 * @param indexContent - Current content in the index
 * @param workdirContent - Current content in the working directory
 * @param allHunks - All hunks in the diff
 * @param selectedHunkIndices - Which hunks to stage
 * @returns The computed content for the index
 */
export function computePartialStagingContent(
  indexContent: string,
  workdirContent: string,
  allHunks: ParsedHunk[],
  selectedHunkIndices: Set<number>,
): string {
  // This is computed on the Rust side for safety, but the algorithm is:
  // 1. Start with indexContent lines
  // 2. For each selected hunk, replace the corresponding region
  //    with the workdir content for that hunk
  // 3. Return the combined result
}
```

**Note:** The actual content computation MUST happen on the Rust side (backend) because:
- It needs to handle binary files, line endings, and encoding correctly
- It writes directly to the git index
- Frontend is untrusted for index manipulation

The TypeScript version above is for documentation/testing only. The Rust `stage_hunk` command handles the actual computation.

---

## 9. Keyboard Shortcut Design

### 9.1 Hunk Navigation and Staging Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Alt+Up` / `Alt+Down` | Navigate between hunks | When DiffBlade is focused in staging mode |
| `Mod+Shift+S` | Stage current hunk (at cursor position) | When cursor is within a hunk in staging diff |
| `Mod+Shift+U` | Unstage current hunk | When viewing staged diff |
| `Mod+Shift+L` | Stage selected lines | When lines are selected in the gutter |
| `Mod+Shift+A` | Stage all hunks in file | Shortcut for staging entire file's hunks |

### 9.2 Line Selection Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Space` | Toggle line selection at cursor | When in line selection mode |
| `Shift+Click` | Select range of lines | In glyph margin |
| `Mod+A` | Select all lines in current hunk | When cursor is within a hunk |
| `Escape` | Clear line selection | When lines are selected |

---

## 10. Testing Strategy

### 10.1 Rust Backend Tests

```rust
#[cfg(test)]
mod tests {
    // Test: stage_hunk with single hunk file
    // Test: stage_hunk with multi-hunk file (verify correct hunk staged)
    // Test: stage_lines with subset of added lines
    // Test: stage_hunk on new (untracked) file
    // Test: stage_hunk on deleted file
    // Test: unstage_hunk reverses staging
    // Test: stage_hunk with binary file returns error
    // Test: stage_hunk with out-of-range index returns error
    // Test: concurrent stage operations don't corrupt index
}
```

### 10.2 TypeScript Unit Tests

```typescript
// diffParser.test.ts
// - parseHunksForEditor correctly maps hunk boundaries
// - Handles empty hunks, single-line hunks, context-only hunks

// patchBuilder.test.ts
// - computePartialStagingContent applies correct hunks
// - Handles edge cases: first hunk, last hunk, adjacent hunks

// useHunkStaging.test.ts
// - Mutation invalidates correct query keys
// - Error handling shows toast
```

### 10.3 Integration Tests

```typescript
// StagingDiffEditor.test.tsx
// - Renders ViewZones for each hunk
// - Click on stage button triggers mutation
// - Line selection updates decorations
// - Buttons disabled during pending mutation
```

---

## Architecture Recommendations

### Top Design Decisions

1. **Enhance DiffBlade, don't create a new blade.** Hunk staging is a natural extension of diff viewing in staging mode. The `DiffSource.mode === "staging"` flag signals when to enable staging controls.

2. **Use `Index::add_frombuffer()` for backend implementation.** This gives full control over partially staged content and is the approach used by `git add -p` internally. Avoid `Repository::apply()` which has hunk-filtering limitations in git2.

3. **No new Zustand store.** Staging operations are atomic and use react-query mutations with automatic query invalidation. Line selection is component-local state.

4. **Server-confirmed state only, no optimistic updates.** Staging is fast enough (~100ms round-trip) that optimistic updates add complexity without meaningful UX benefit, and risk showing incorrect diff state.

5. **Serial staging execution with button disable.** Prevents hunk index shift bugs from concurrent operations. The ~100ms disable window is imperceptible.

6. **Monaco ViewZones for hunk buttons, glyph margin + click handler for line checkboxes.** ViewZones push content and integrate naturally. Glyph margin click handling is lightweight and scales to large files.

7. **New `get_file_diff_detailed` Rust command.** Returns per-line diff information needed for line staging. The existing `get_file_diff` stays unchanged for backward compatibility.

8. **Four new Rust commands: `stage_hunk`, `unstage_hunk`, `stage_lines`, `unstage_lines`.** Added to the existing `staging.rs` file. Registered in `lib.rs` command collection.

9. **Immediate query invalidation for sync.** After each staging operation, invalidate `stagingStatus` and `fileDiff` queries. This provides sub-200ms perceived refresh, exceeding the requirement for "immediately reflected."

10. **Core feature, not extension.** Register commands and shortcuts through core registries. The extension event bus gets new `stage-hunk`/`stage-lines` operations for extensibility.

### High-Level Component Diagram

```
                                    +--------------------------+
                                    |       DiffBlade.tsx      |
                                    |  (decides staging mode)  |
                                    +------+---+-------+------+
                                           |   |       |
                              +------------+   |       +----------+
                              |                |                  |
                    +---------v--------+    +--v---------+   +---v--------------+
                    |  DiffToolbar.tsx  |    | DiffContent|   | StagingDiff      |
                    |  (stage all btn) |    | .tsx       |   |  Navigation.tsx   |
                    +------------------+    +---+--------+   +------------------+
                                                |
                                    +-----------+-----------+
                                    |  (staging mode?)      |
                                    |                       |
                          +---------v--------+    +---------v----------+
                          | Plain DiffEditor |    | StagingDiffEditor  |
                          | (commit/no-stage)|    | (staging mode)     |
                          +------------------+    +---------+----------+
                                                            |
                                               +------------+----------+
                                               |            |          |
                                    +----------v--+ +-------v------+ +-v-----------+
                                    | HunkGutter  | | LineCheckbox | | ViewZone    |
                                    | Widget      | | Overlay      | | Hunk Header |
                                    | (stage btn) | | (line select)| | (info bar)  |
                                    +------+------+ +------+-------+ +------+------+
                                           |               |                |
                                    +------v---------------v----------------v------+
                                    |           useHunkStaging() hook               |
                                    |  - stageHunkMutation                         |
                                    |  - unstageHunkMutation                       |
                                    |  - stageLinesMutation                        |
                                    |  - query invalidation                        |
                                    +-------------------+--------------------------+
                                                        | Tauri IPC
                                    +-------------------v--------------------------+
                                    |            Rust Backend (staging.rs)          |
                                    |                                              |
                                    |  stage_hunk(path, hunk_index)                |
                                    |  unstage_hunk(path, hunk_index)              |
                                    |  stage_lines(path, line_ranges)              |
                                    |  unstage_lines(path, line_ranges)            |
                                    |  get_file_diff_detailed(path, staged, ctx)   |
                                    |                                              |
                                    |  Algorithm:                                  |
                                    |  1. Read index content (base)                |
                                    |  2. Parse diff into hunks                    |
                                    |  3. Compute partial content                  |
                                    |  4. Index::add_frombuffer(computed)           |
                                    |  5. Index::write()                           |
                                    +----------------------------------------------+

Data Flow (stage hunk):
  User Click -> HunkGutterWidget -> useHunkStaging.stageHunk()
    -> Tauri IPC: commands.stageHunk(path, index)
    -> Rust: compute partial content, write to index
    -> Return OK
    -> react-query: invalidate ["stagingStatus", "fileDiff", "fileDiffDetailed"]
    -> StagingPanel refetches status (file now partially staged)
    -> DiffBlade refetches diff (hunk disappears from unstaged diff)
    -> UI update complete (~100-150ms total)

State Ownership:
  +-------------------+------------------+------------------+
  | Git Index (Rust)  | React-Query      | Component State  |
  | Source of truth   | Cache layer      | UI-only          |
  +-------------------+------------------+------------------+
  | staged content    | stagingStatus    | selectedLines    |
  | workdir content   | fileDiff         | isStaging        |
  | hunk data         | fileDiffDetailed | expandedHunks    |
  +-------------------+------------------+------------------+
```

### Implementation Order

1. **Rust backend:** `get_file_diff_detailed`, `stage_hunk`, `unstage_hunk` commands
2. **Diff parser:** `diffParser.ts` and `patchBuilder.ts` pure logic + tests
3. **Staging hook:** `useHunkStaging.ts` with mutations and invalidation
4. **Monaco integration:** `StagingDiffEditor` with ViewZones for hunk buttons
5. **DiffBlade enhancement:** Conditional staging mode in `DiffContent`, toolbar actions
6. **Line staging:** `stage_lines`, `unstage_lines` commands + line checkbox UI
7. **Keyboard shortcuts:** Hunk navigation, stage/unstage shortcuts
8. **Polish:** Loading states, error handling, staging panel partial-stage indicator

---

## Sources

### Primary (HIGH confidence)
- FlowForge codebase: `src-tauri/src/git/staging.rs` -- existing staging commands pattern
- FlowForge codebase: `src-tauri/src/git/diff.rs` -- DiffHunk type, diff generation, blob reading
- FlowForge codebase: `src/core/blades/diff/DiffBlade.tsx` -- current DiffBlade component tree
- FlowForge codebase: `src/core/blades/diff/components/DiffContent.tsx` -- Monaco DiffEditor usage
- FlowForge codebase: `src/core/blades/staging-changes/StagingChangesBlade.tsx` -- staging query pattern
- FlowForge codebase: `src/core/blades/staging-changes/components/StagingPanel.tsx` -- staging panel refresh
- FlowForge codebase: `src/core/stores/domain/ui-state/staging.slice.ts` -- staging UI state
- FlowForge codebase: `src/extensions/conflict-resolution/store.ts` -- Phase 49 store pattern
- FlowForge codebase: `src/extensions/ExtensionAPI.ts` -- extension registration patterns
- FlowForge codebase: `src/App.tsx` -- repository-changed event handling
- FlowForge codebase: `src-tauri/Cargo.toml` -- git2 v0.20

### Secondary (MEDIUM confidence)
- git2-rs docs: `Repository::apply()`, `Index::add_frombuffer()`, `Diff::foreach()`
- Monaco Editor API: `deltaDecorations`, `changeViewZones`, `onMouseDown`, `MouseTargetType`
- Phase 49 research: `.planning/phases/49-inline-conflict-resolution/49-RESEARCH-ARCHITECTURE.md`

### Tertiary (LOW confidence)
- VS Code source control implementation (hunk staging UI patterns)
- Sublime Merge hunk staging (UX reference)
- `git add -p` source code (algorithm reference for partial staging)

---

## Metadata

**Confidence breakdown:**
- Component architecture: HIGH -- follows established DiffBlade patterns
- Data flow: HIGH -- react-query mutation + invalidation is well-proven in codebase
- Rust backend: HIGH -- git2 APIs documented, pattern follows existing staging.rs
- Monaco integration: MEDIUM -- ViewZones and glyph margin click handling are documented but require careful implementation
- Performance: MEDIUM -- large diff performance needs empirical validation
- State management: HIGH -- no-store approach eliminates complexity

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days -- stable domain, no fast-moving dependencies)
