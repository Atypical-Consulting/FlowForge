# Architecture Patterns: Blade Expansion for v1.3.0

**Domain:** Blade-centric navigation expansion for Tauri + React Git client
**Researched:** 2026-02-07
**Confidence:** HIGH (based on direct codebase analysis of existing architecture)

---

## Current Architecture Snapshot

### Blade System (src/stores/blades.ts, ~79 lines)

The blade store is a clean Zustand store with stack-based navigation:

```
ProcessType: "staging" | "topology"
BladeType: "staging-changes" | "topology-graph" | "commit-details" | "diff" | "viewer-nupkg" | "viewer-image"

BladeState {
  activeProcess: ProcessType
  bladeStack: Blade[]
  setProcess(process) -> resets stack to root blade for process
  pushBlade(blade) -> appends to stack with crypto.randomUUID()
  popBlade() -> removes last (guards against popping root)
  popToIndex(index) -> truncates stack to index+1
  replaceBlade(blade) -> replaces last blade
  resetStack() -> resets to root blade for current process
}
```

Key design property: `setProcess()` completely resets the stack. Each process owns its own root blade. Blades pushed on top are "drill-in" views (commit-details, diff, viewer-*).

### Rendering Pipeline

```
App.tsx
  -> Header (contains ProcessNavigation buttons: staging | topology)
  -> RepositoryView
       -> ResizablePanelLayout (horizontal)
            -> sidebar (20%, branches/stash/tags/gitflow/worktrees + CommitForm at bottom)
            -> BladeContainer (80%)
                 -> for each blade in stack:
                      if not active: render BladeStrip (collapsed 40px vertical tab)
                      if active: render via renderBlade(blade) switch statement
```

The `renderBlade` callback lives in `RepositoryView.tsx` as a `useCallback` with a switch statement over `blade.type`. This is the single integration point for all new blade types.

### Modal System (current)

Three features currently use modals (Dialog component with fixed-position overlay):

| Modal | Trigger | Store | Mounted In |
|-------|---------|-------|------------|
| SettingsWindow | `openSettings()` via settings store | `useSettingsStore` (isOpen, activeCategory) | App.tsx (global) |
| ChangelogDialog | `openDialog()` via changelog store | `useChangelogStore` (isDialogOpen) | App.tsx (global) |
| ConventionalCommitModal | `setShowModal(true)` via local state | None (props: open, onOpenChange, onCommit) | CommitForm.tsx |

### IPC Pattern (Rust backend)

All Tauri commands follow this pattern:
1. Get `RepositoryState` (holds path, not git2::Repository -- thread safety)
2. `spawn_blocking` with fresh `git2::Repository::open()` per operation
3. Return typed results via `tauri-specta` auto-generated bindings

Existing file-content retrieval:
- `get_file_diff(path, staged, context_lines)` -> FileDiff with old/new content
- `get_commit_file_diff(oid, path, context_lines)` -> FileDiff
- `get_file_base64(file_path)` -> data URI for binary files in working tree
- `get_commit_file_base64(oid, file_path)` -> data URI for binary files at commit

**No generic "read file content" command exists.** The diff module reads file content but always in diff context. A repo file browser needs a new command.

---

## Recommended Architecture for v1.3.0

### Decision 1: Settings as a Blade (NOT a third root process)

**Recommendation: Keep settings as a blade, not a process. Use `pushBlade` with a "settings" type.**

Rationale:
- Adding a third process (`"settings"`) to ProcessType would make settings structurally parallel to staging/topology, which it is not. Settings is a utility surface, not a workflow.
- The process model means `setProcess("settings")` would reset the blade stack and show a settings root blade. This loses the user's blade context -- they cannot quickly check a setting and return to their diff.
- A process also adds a third tab to ProcessNavigation in the header, taking up horizontal space for something used infrequently.

**Instead:** Settings should be a blade that pushes onto the current stack via `pushBlade({ type: "settings" })`. The user can pop back with the existing back button. The settings blade replaces the modal overlay with an inline panel.

Store change: Remove `isOpen` from `useSettingsStore`. The `activeCategory` stays (it is internal settings navigation state). Opening settings becomes `pushBlade({ type: "settings", title: "Settings", props: { category: "general" } })`.

Header change: The settings button in `Header.tsx` changes from `openSettings()` to `pushBlade({ type: "settings", ... })`.

**Alternative considered:** A third process. Rejected because settings is not a persistent workspace -- it is a transient drill-in. Processes are long-lived workspaces (staging area, topology view).

### Decision 2: Modal-to-Blade Conversion Strategy

**Recommendation: Convert all three modals to blades, but with different approaches based on their coupling.**

#### Settings: Direct blade conversion

The SettingsWindow has self-contained tabbed navigation (general, git, integrations, appearance). It already looks like a blade panel -- a left sidebar with tabs and a content area. The conversion is straightforward:

- New blade type: `"settings"`
- New component: `SettingsBlade.tsx` (wraps existing AppearanceSettings, GeneralSettings, etc.)
- Remove: Dialog/DialogContent wrapper from SettingsWindow
- Remove: `isOpen`/`openSettings`/`closeSettings` from settings store
- The `activeCategory` stays in the store (persists across opens)
- Props: `{ category?: SettingsCategory }` (optional, defaults to store value)

**Integration point:** `renderBlade` switch case in RepositoryView + BladePanel wrapper with back button.

#### Changelog: Direct blade conversion

ChangelogDialog is already stateful via `useChangelogStore`. The Dialog wrapper is thin.

- New blade type: `"changelog"`
- New component: `ChangelogBlade.tsx` (wraps existing ChangelogPreview + generation form)
- Remove: Dialog/DialogContent wrapper from ChangelogDialog
- Remove: `isDialogOpen`/`openDialog`/`closeDialog` from changelog store
- Props: `{}` (state lives in store)

**Integration point:** `renderBlade` switch case + BladePanel wrapper.

#### Conventional Commit: Inline within staging blade (NOT a separate blade)

**This is the tricky one.** The ConventionalCommitModal is triggered from CommitForm, which is in the sidebar (bottom of left panel). The modal overlays the entire screen. Converting to a blade would put the commit composer in the blade area (right 80%), but the CommitForm is in the sidebar (left 20%).

**Recommendation: Keep ConventionalCommitForm in the sidebar, but expand it inline instead of opening a modal.** Rationale:
- The commit form belongs near the staging context (staged files list)
- Moving it to a blade means the user looks at a full-width commit form while their staging list is in a collapsed BladeStrip -- poor UX
- The two-column staging layout (Decision 5) will make inline expansion natural

**If inline expansion is not feasible** due to sidebar space constraints, the fallback is a blade with type `"commit-composer"` that shows the ConventionalCommitForm in the blade area. But this should be the last resort.

### Decision 3: New Blade Type Registry

**Recommendation: Extend BladeType union and renderBlade switch in one batch.**

New blade types to add:

```typescript
export type BladeType =
  // Existing
  | "staging-changes"
  | "topology-graph"
  | "commit-details"
  | "diff"
  | "viewer-nupkg"
  | "viewer-image"
  // New - v1.3.0
  | "settings"
  | "changelog"
  | "markdown-preview"
  | "viewer-3d"
  | "repo-browser"
  | "gitflow-cheatsheet"
  | "commit-composer";    // fallback if inline doesn't work
```

Each new blade type needs:
1. A `*Blade.tsx` component in `src/components/blades/`
2. A case in the `renderBlade` switch in `RepositoryView.tsx`
3. An export in `src/components/blades/index.ts`
4. A navigation helper in `useBladeNavigation.ts` (for those triggered programmatically)

### Decision 4: Markdown Preview Blade

**Recommendation: Add a toggle within the diff blade for `.md` files, AND support a standalone markdown-preview blade for the repo browser.**

Two usage scenarios require different approaches:

**Scenario A -- Diff context:** User clicks a `.md` file from commit details or staging. They see the diff. A "Preview" toggle button in the BladePanel trailing slot switches between diff view and rendered markdown. This is a toggle within the existing diff blade, not a separate blade type.

**Scenario B -- Repo browser context:** User browses repository files and opens a `.md` file. There is no diff context. A standalone `markdown-preview` blade renders the file content.

Data flow for Scenario A:
1. DiffBlade already receives `source` props with filePath
2. DiffBlade already has `new_content` from the diff fetch
3. Add a `showPreview` local state toggle
4. When toggled, render `<MarkdownPreview content={newContent} />` instead of Monaco DiffEditor

Data flow for Scenario B:
1. RepoBrowserBlade opens a `.md` file
2. Pushes `{ type: "markdown-preview", props: { filePath, content } }` or fetches via `read_repo_file`
3. MarkdownPreviewBlade renders with `react-markdown`

### Decision 5: Two-Column Staging Layout

**Recommendation: Split the `staging-changes` blade into a two-column layout: file list (left) + diff preview (right).**

Current flow: StagingChangesBlade shows StagingPanel (file list only). Clicking a file pushes a new diff blade. User loses sight of the file list.

Proposed flow: StagingChangesBlade contains a horizontal ResizablePanelLayout:
- Left panel: StagingPanel (file list, existing component)
- Right panel: Inline diff viewer (DiffBlade content, reused)

This means:
- **StagingChangesBlade.tsx** becomes the orchestrator component
- `onFileSelect` no longer calls `pushBlade` -- instead, it updates local state to show the diff inline
- The existing DiffBlade component is reused (it already accepts `source` props)
- The file list and diff are visible simultaneously

**State management:** The selected file state moves from the blade store (push/pop) to local component state within StagingChangesBlade. The staging store's `selectedFile` already tracks this -- reuse it.

**Component structure:**
```
StagingChangesBlade
  -> ResizablePanelLayout (horizontal, autoSaveId="staging-columns")
       -> StagingPanel (onFileSelect updates staging store selectedFile)
       -> InlineDiffPanel (conditionally rendered when file selected)
            -> DiffBlade (reused) OR ViewerImageBlade OR ViewerNupkgBlade
```

**Important:** The old behavior (push a diff blade for full-screen) should remain available. Add an "expand" button on the inline diff that pushes the full diff blade onto the stack. This gives users both quick inline preview and full-screen deep dive.

### Decision 6: Repository File Browser

**Recommendation: New blade type `"repo-browser"` with new Rust backend commands for file listing and reading.**

This requires new backend work:

**New Rust command: `list_repo_files`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn list_repo_files(
    path: Option<String>,  // subdirectory path, None = root
    state: State<'_, RepositoryState>,
) -> Result<Vec<RepoFileEntry>, GitError>
```

Where `RepoFileEntry` is:
```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoFileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub extension: Option<String>,
}
```

**New Rust command: `read_repo_file`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn read_repo_file(
    file_path: String,
    state: State<'_, RepositoryState>,
) -> Result<FileContent, GitError>
```

Where `FileContent` uses a tagged enum:
```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FileContent {
    Text { content: String, language: String },
    Binary { data_uri: String },
}
```

This follows the existing pattern in diff.rs (`detect_language`, `mime_from_extension`, base64 encoding).

**Frontend component:** `RepoBrowserBlade.tsx` with:
- Directory tree (reuse tree-building logic from FileTreeBlade)
- File preview panel (text files in Monaco read-only, images via img tag)
- Breadcrumb navigation within the browser
- Clicking a file opens the appropriate viewer blade (diff for text, viewer-image, viewer-3d, markdown-preview)

**Navigation:** Add to `useBladeNavigation`:
```typescript
const openRepoBrowser = (path?: string) => {
  store.pushBlade({
    type: "repo-browser",
    title: "Files",
    props: { path: path ?? "" },
  });
};
```

### Decision 7: 3D Viewer Blade

**Recommendation: Use BabylonJS viewer for `.glb`/`.gltf`/`.fbx`/`.obj` files, lazy-loaded.**

Data flow:
1. `bladeTypeForFile()` returns `"viewer-3d"` for 3D model extensions
2. Blade pushes with props `{ filePath, oid? }`
3. Component fetches binary content via `get_file_base64` or `get_commit_file_base64`
4. Converts base64 data URI to blob URL
5. Passes to BabylonJS SceneLoader

**Dependency:** `@babylonjs/core` and `@babylonjs/loaders` (~2-3MB gzipped). This is significant.

**Recommendation: Lazy-load BabylonJS.** Use `React.lazy()` + Suspense to only load the 3D engine when a 3D file is actually opened. This avoids bloating the main bundle.

```typescript
const Viewer3DBlade = React.lazy(() => import("./Viewer3DBlade"));
```

In `renderBlade`:
```typescript
case "viewer-3d":
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Viewer3DBlade ... />
    </Suspense>
  );
```

### Decision 8: Branch Management Hub

**Recommendation: Sidebar enhancement, not a blade.**

The branch management hub (local, remote, last-used, cleanup) is contextual navigation data -- it belongs in the sidebar alongside the existing BranchList, StashList, and TagList sections.

Reasons:
- Branch operations (checkout, delete, create) are quick actions, not deep inspections
- A blade would compete with the user's current work context
- The sidebar already has a "Branches" section with the BranchList component

**Enhancement plan:**
1. Enhance the existing `<details>` Branches section in RepositoryView's sidebar
2. Add sub-tabs or filter within BranchList: "Local" | "Remote" | "Recent"
3. Add branch cleanup actions (delete merged branches) inline
4. Show last-used timestamps (data already in `useNavigationStore.recentBranchesPerRepo`)
5. Feature branch tags displayed in purple (style enhancement in BranchList)

### Decision 9: GitFlow Cheatsheet Blade

**Recommendation: Static content blade, no backend needed.**

- New blade type: `"gitflow-cheatsheet"`
- Content: Hardcoded JSX with Gitflow diagrams, workflow descriptions, and command references
- Trigger: Button in GitflowPanel sidebar section, or command palette action
- No IPC needed -- purely frontend

### Decision 10: `useBladeNavigation` Hook Extension

The hook needs new navigation helpers for the expanded blade set:

```typescript
// Existing
openCommitDetails(oid: string)
openDiff(oid: string, filePath: string)
openStagingDiff(file: FileChange, section: string)
goBack()
goToRoot()

// New
openSettings(category?: SettingsCategory)
openChangelog()
openRepoBrowser(path?: string)
openGitflowCheatsheet()
```

The `bladeTypeForFile()` function also needs updating:
```typescript
function bladeTypeForFile(filePath: string): BladeType {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".nupkg")) return "viewer-nupkg";
  if (IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))) return "viewer-image";
  if (MODEL_3D_EXTENSIONS.some(ext => lower.endsWith(ext))) return "viewer-3d";
  // .md files stay as "diff" when in diff context; markdown preview is a toggle
  return "diff";
}
```

---

## Component Inventory

### New Components (create)

| Component | Path | Purpose |
|-----------|------|---------|
| SettingsBlade | `src/components/blades/SettingsBlade.tsx` | Settings as blade (wraps existing settings panels) |
| ChangelogBlade | `src/components/blades/ChangelogBlade.tsx` | Changelog generation as blade |
| RepoBrowserBlade | `src/components/blades/RepoBrowserBlade.tsx` | Repository file browser |
| Viewer3DBlade | `src/components/blades/Viewer3DBlade.tsx` | 3D model viewer (lazy-loaded) |
| GitflowCheatsheetBlade | `src/components/blades/GitflowCheatsheetBlade.tsx` | Static Gitflow reference |
| InlineDiffPanel | `src/components/staging/InlineDiffPanel.tsx` | Inline diff viewer for two-column staging |
| MarkdownPreview | `src/components/viewers/MarkdownPreview.tsx` | Markdown rendering component (shared) |
| MarkdownPreviewBlade | `src/components/blades/MarkdownPreviewBlade.tsx` | Standalone markdown viewer blade |

### Modified Components

| Component | Changes |
|-----------|---------|
| `src/stores/blades.ts` | Extend BladeType union with 7 new types |
| `src/components/RepositoryView.tsx` | Add cases to renderBlade switch for each new type |
| `src/hooks/useBladeNavigation.ts` | Add new navigation helpers, extend bladeTypeForFile |
| `src/components/blades/index.ts` | Export new blade components |
| `src/components/blades/StagingChangesBlade.tsx` | Rewrite for two-column layout with ResizablePanelLayout |
| `src/components/blades/DiffBlade.tsx` | Add markdown preview toggle for .md files |
| `src/stores/settings.ts` | Remove isOpen/openSettings/closeSettings |
| `src/stores/changelogStore.ts` | Remove isDialogOpen/openDialog/closeDialog |
| `src/components/Header.tsx` | Change settings/changelog triggers to use blade push |
| `src/App.tsx` | Remove ChangelogDialog and SettingsWindow mounts |
| `src/components/branches/BranchList.tsx` | Add local/remote/recent filter tabs, cleanup actions |
| `src/components/commit/CommitForm.tsx` | Inline ConventionalCommitForm expansion (remove modal trigger) |
| `src/components/commit/ConventionalCommitModal.tsx` | Remove (replaced by inline expansion) |

### New Rust Backend

| File | Purpose |
|------|---------|
| `src-tauri/src/git/browser.rs` | `list_repo_files` and `read_repo_file` commands |
| `src-tauri/src/git/mod.rs` | Add `pub mod browser;` |
| `src-tauri/src/lib.rs` | Register `list_repo_files` and `read_repo_file` commands |

### Removed After Migration

| Component | Reason |
|-----------|--------|
| `src/components/settings/SettingsWindow.tsx` | Replaced by SettingsBlade (sub-panels survive) |
| `src/components/changelog/ChangelogDialog.tsx` | Replaced by ChangelogBlade (ChangelogPreview survives) |
| `src/components/commit/ConventionalCommitModal.tsx` | Replaced by inline expansion in CommitForm |

---

## Data Flow Diagrams

### Modal-to-Blade State Migration

**Before (Settings):**
```
Header button -> useSettingsStore.openSettings() -> sets isOpen=true
  -> SettingsWindow reads isOpen from store -> renders Dialog overlay
  -> Close: Dialog.onOpenChange(false) -> closeSettings() -> isOpen=false
```

**After (Settings):**
```
Header button -> useBladeStore.pushBlade({ type: "settings" })
  -> BladeContainer renders SettingsBlade as active blade
  -> Back: useBladeStore.popBlade() -> blade removed from stack
  -> activeCategory persists in settings store for next open
```

**Before (Changelog):**
```
Header button -> useChangelogStore.openDialog() -> isDialogOpen=true
  -> ChangelogDialog reads isDialogOpen -> renders Dialog overlay
  -> Close: closeDialog() + reset() -> isDialogOpen=false
```

**After (Changelog):**
```
Header button -> useBladeStore.pushBlade({ type: "changelog" })
  -> BladeContainer renders ChangelogBlade
  -> ChangelogBlade uses useChangelogStore for generation state
  -> Back: popBlade() (changelog store state persists until explicit reset)
  -> ChangelogBlade useEffect cleanup calls reset() on unmount
```

### Repo Browser Data Flow

```
User triggers "Browse Files" (command palette or sidebar action)
  -> pushBlade({ type: "repo-browser", props: { path: "" } })
  -> RepoBrowserBlade mounts
  -> useQuery(["repoFiles", path], () => commands.listRepoFiles(path))
  -> Rust: list_repo_files reads working directory via std::fs
  -> Returns Vec<RepoFileEntry> to frontend
  -> User clicks directory -> updates path prop, re-fetches
  -> User clicks file:
     -> Text file: commands.readRepoFile(path)
        -> Rust: reads file, detects language, returns FileContent::Text
        -> Frontend: Monaco Editor (read-only) for code, MarkdownPreview for .md
     -> Image file: commands.getFileBase64(path) (existing command)
        -> Frontend: img tag with data URI
     -> 3D model: pushBlade({ type: "viewer-3d", props: { filePath } })
```

### Two-Column Staging Data Flow

```
StagingChangesBlade (redesigned)
  -> ResizablePanelLayout (horizontal)
       -> Left: StagingPanel (unchanged component)
            -> onFileSelect(file, section) -> useStagingStore.selectFile()
       -> Right: InlineDiffPanel
            -> Reads selectedFile from useStagingStore
            -> Determines viewer type via bladeTypeForFile
            -> Renders DiffBlade / ViewerImageBlade / ViewerNupkgBlade inline
            -> "Expand" button -> pushBlade(full diff blade) for full-screen

Key change: StagingPanel.onFileSelect no longer triggers pushBlade.
Instead it updates staging store. Blade push is optional (expand button).
```

---

## Suggested Build Order

Based on dependencies and risk analysis:

### Phase A: Blade Type Infrastructure (Foundation)

**Do first.** All subsequent work depends on this.

1. Extend `BladeType` union in blades.ts with all new types
2. Add empty case stubs in renderBlade switch (return placeholder divs)
3. Extend `useBladeNavigation` with new helpers (openSettings, openChangelog, etc.)
4. Update `bladeTypeForFile` for 3D model extensions

**Risk: LOW.** Additive changes only, no breaking modifications. Existing blade types untouched.

### Phase B: Modal-to-Blade Conversions (Quick Wins)

**Do second.** Removes modal infrastructure, proves the blade expansion pattern works.

1. SettingsBlade -- most self-contained, has its own store for category state
2. ChangelogBlade -- small, stateful store already exists
3. Remove SettingsWindow and ChangelogDialog from App.tsx
4. Update Header.tsx to use blade push instead of store open
5. Update settings store (remove isOpen/openSettings/closeSettings)
6. Update changelog store (remove isDialogOpen/openDialog/closeDialog)
7. Inline ConventionalCommitForm expansion in CommitForm (remove modal)

**Risk: LOW-MEDIUM.** The settings keyboard shortcut `mod+,` currently calls `openSettings()`. This needs rewiring to `pushBlade`. The changelog store's `reset()` behavior needs care -- ensure it triggers on blade unmount via useEffect cleanup.

**Important subtlety:** Modals auto-reset on close (component unmounts). Blades in a stack stay mounted (only behind BladeStrips, which do NOT render blade content -- they are separate button components). However, when popped from the stack, the blade component unmounts. Use `useEffect` cleanup to reset changelog store state on unmount.

### Phase C: Two-Column Staging (High-Value UX)

**Do third.** Major UX improvement, self-contained within StagingChangesBlade.

1. Redesign StagingChangesBlade with ResizablePanelLayout (reuse `autoSaveId` pattern)
2. Create InlineDiffPanel wrapper component
3. Wire to useStagingStore's existing selectedFile state
4. Add "expand to full blade" button on inline diff
5. Keep backward compatibility (push-blade still works from expand button)

**Risk: MEDIUM.** This changes a core interaction pattern. The StagingPanel's `onFileSelect` callback contract changes -- it must support both inline preview and full-blade navigation. Test with keyboard navigation. The ResizablePanelLayout is already used in RepositoryView so the pattern is proven.

### Phase D: New Content Blades (Feature Expansion)

**Do fourth.** Each is independent, can be parallelized.

1. GitflowCheatsheetBlade (pure frontend, zero risk, no dependencies)
2. MarkdownPreview component + DiffBlade toggle for .md files (small scope)
3. RepoBrowserBlade + Rust backend commands (new IPC, medium risk)
   - Create `src-tauri/src/git/browser.rs` with `list_repo_files` and `read_repo_file`
   - Register in lib.rs
   - Build frontend RepoBrowserBlade with directory tree and file preview
4. Viewer3DBlade with BabylonJS (new dependency, lazy-loaded, medium risk)
   - `npm install @babylonjs/core @babylonjs/loaders`
   - React.lazy + Suspense wrapper
   - Extend bladeTypeForFile for 3D extensions

**Risk varies:** Cheatsheet is trivial. Markdown is low risk. Repo browser requires new Rust code (follow existing patterns in diff.rs -- the `detect_language` and `mime_from_extension` functions can be moved to a shared module). 3D viewer introduces a large dependency but lazy-loading mitigates bundle impact.

### Phase E: Branch Management Enhancement (Sidebar Polish)

**Do last.** Incremental improvement to existing sidebar, lowest priority.

1. Add local/remote/recent filter tabs to BranchList
2. Feature branch purple tags (CSS/style change)
3. Branch cleanup actions (delete merged branches)
4. Last-used timestamps from navigation store data

**Risk: LOW.** Additive changes to existing BranchList component. No architectural changes.

---

## Anti-Patterns to Avoid

### 1. Process Proliferation

**Do NOT** add more root processes unless they represent genuinely separate workspaces. The process model (staging, topology) represents distinct user activities. Settings, changelog, and file browsing are contextual drill-ins, not workspaces.

**Warning sign:** If you find yourself adding process-specific root blades that do not have drill-in children, it is probably a pushBlade, not a setProcess.

### 2. Blade State Leaks on Unmount

**Do NOT** rely on blade component mount/unmount for state cleanup without explicit useEffect cleanup. When a blade is popped from the stack, it unmounts. But if the blade component does not clean up its store state (e.g., changelog generation state), reopening the blade shows stale data.

**Prevention:** Add `useEffect(() => { return () => store.reset(); }, [])` in blade components that use external stores with generation/form state.

### 3. renderBlade Switch Bloat

**Do NOT** let the renderBlade switch in RepositoryView grow unbounded without structure. With 13+ blade types, consider extracting to a blade registry object.

**Prevention after migration:** Extract to a registry pattern:
```typescript
const BLADE_REGISTRY: Record<BladeType, (blade: Blade, goBack: () => void) => ReactNode> = {
  "staging-changes": () => <StagingChangesBlade />,
  "settings": () => <BladePanel title="Settings" showBack onBack={goBack}><SettingsBlade /></BladePanel>,
  // ...
};
```

The switch works fine for 13 cases, but the registry is cleaner for 20+. This is a refactor opportunity, not a blocker for v1.3.

### 4. Tight Coupling Between Sidebar and Blade Area

**Do NOT** create bidirectional dependencies between sidebar components and blade content. The current architecture is clean: sidebar triggers blade pushes via `useBladeNavigation`, blades read their own data. The two-column staging layout introduces a potential coupling point (sidebar file list controls blade-area diff display within the same blade). Keep the data flow unidirectional through the staging store.

### 5. Eager Loading Heavy Dependencies

**Do NOT** import BabylonJS at the top level of any commonly-used module. The 3D viewer is a rare-use feature. Eager loading it adds ~2-3MB to the initial bundle.

**Prevention:** `React.lazy()` + dynamic `import()`. Never import `@babylonjs/*` in any file that is part of the main chunk.

---

## Scalability Considerations

| Concern | Current (6 blade types) | After v1.3 (13 blade types) | Future (20+ types) |
|---------|-------------------------|------------------------------|---------------------|
| renderBlade switch | 6 cases, manageable | 13 cases, still fine | Extract to registry pattern |
| BladeType union | Simple union | Growing but typed | Consider discriminated unions with per-type props |
| useBladeNavigation | 5 helpers | 10+ helpers | Group by category (viewers, tools, navigation) |
| Bundle size | ~2MB | ~2.5MB main + ~3MB lazy 3D | Keep lazy-loading discipline |
| Rust commands | 50+ commands | 52+ (add browser commands) | Follow existing module pattern |
| Blade props | Untyped `Record<string, unknown>` | Same but more usage | Consider typed props per blade type |

### Future Consideration: Typed Blade Props

The current `Blade` interface uses `props: Record<string, unknown>`, requiring casts in renderBlade. A future improvement would be a discriminated union:

```typescript
type TypedBlade =
  | { type: "settings"; props: { category?: SettingsCategory } }
  | { type: "diff"; props: { mode: "commit"; oid: string; filePath: string } | { mode: "staging"; filePath: string; staged: boolean } }
  | { type: "repo-browser"; props: { path: string } }
  // ...
```

This is NOT required for v1.3 but becomes increasingly valuable as blade types grow. The current cast approach works for 13 types.

---

## Quality Gate Verification

- [x] Integration points clearly identified (renderBlade switch, useBladeNavigation hook, Header triggers, App.tsx modal mounts)
- [x] New vs modified components explicit (8 new components, 13 modified, 2 new Rust files)
- [x] Build order considers existing dependencies (infrastructure first, then conversions, then new features)
- [x] Data flow changes documented (modal-to-blade state, repo browser IPC, two-column staging)
- [x] Anti-patterns identified with prevention strategies

---

## Sources

All findings verified against source files (HIGH confidence):

- `src/stores/blades.ts` -- Blade store architecture (79 lines)
- `src/components/RepositoryView.tsx` -- renderBlade integration point (294 lines)
- `src/hooks/useBladeNavigation.ts` -- Navigation pattern (71 lines)
- `src/components/blades/BladeContainer.tsx` -- Rendering pipeline (46 lines)
- `src/components/blades/BladePanel.tsx` -- Panel wrapper (45 lines)
- `src/components/blades/BladeStrip.tsx` -- Collapsed blade tab (23 lines)
- `src/components/blades/ProcessNavigation.tsx` -- Process tab bar (37 lines)
- `src/components/blades/StagingChangesBlade.tsx` -- Current staging blade (7 lines)
- `src/components/settings/SettingsWindow.tsx` -- Settings modal to convert (123 lines)
- `src/stores/settings.ts` -- Settings store with isOpen state (107 lines)
- `src/stores/changelogStore.ts` -- Changelog store with isDialogOpen (88 lines)
- `src/components/changelog/ChangelogDialog.tsx` -- Changelog modal to convert (129 lines)
- `src/components/commit/CommitForm.tsx` -- ConventionalCommit modal trigger (283 lines)
- `src/components/commit/ConventionalCommitModal.tsx` -- Modal wrapper (36 lines)
- `src/components/commit/ConventionalCommitForm.tsx` -- Form content (202 lines)
- `src-tauri/src/git/diff.rs` -- File content retrieval patterns (457 lines)
- `src-tauri/src/git/repository.rs` -- RepositoryState pattern (159 lines)
- `src-tauri/src/lib.rs` -- Command registration (174 lines)
- `src/App.tsx` -- Global modal mount points (82 lines)
- `src/components/Header.tsx` -- Settings/changelog triggers (370 lines)
