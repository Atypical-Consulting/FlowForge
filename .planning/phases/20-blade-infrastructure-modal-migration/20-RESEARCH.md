# Phase 20: Blade Infrastructure & Modal Migration - Research

**Researched:** 2026-02-07
**Domain:** React blade navigation system, modal-to-blade migration, Tauri Rust IPC commands
**Confidence:** HIGH

## Summary

This research covers the current blade system architecture, all three modal implementations targeted for migration (SettingsWindow, ChangelogDialog, ConventionalCommitModal), and the Rust command pattern for adding new repo file browsing commands. The codebase has a clean, well-established blade system with a Zustand store, push/pop navigation, a BladeContainer with animated transitions, and BladeStrip breadcrumbs for collapsed blades. All three modals use the custom `Dialog`/`DialogContent` UI component and are mounted at the App.tsx level (Settings, Changelog) or inline in CommitForm (ConventionalCommit).

The migration path is straightforward: extend `BladeType` union, add `renderBlade` switch cases, create new blade components that reuse the existing inner content (settings tabs, changelog form/preview, conventional commit form), and remove the modal mounts. The conventional commit is a special case -- the requirement says "inline in the commit form" rather than a separate blade, so the form should be embedded directly in the CommitForm area, not requiring a blade push.

**Primary recommendation:** Extend the existing blade system incrementally -- add types first, then blade components wrapping existing inner content, then update triggers, then remove modals. The ConventionalCommitForm should be embedded inline in CommitForm, not as a blade.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5 | Blade store state management | Already used for all stores |
| framer-motion | ^12.31.0 | Blade transition animations | Already used in BladeContainer |
| react | ^19.2.4 | React.lazy for lazy-loading | Built-in, no extra dep |
| lucide-react | ^0.563 | Icons for blade headers | Already used throughout |

### New Dependencies Required (INFRA-04)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-markdown | latest | Markdown rendering in viewer-markdown blade | Changelog preview, markdown file viewing |
| remark-gfm | latest | GitHub Flavored Markdown support | Tables, task lists, strikethrough in markdown |
| rehype-highlight | latest | Syntax highlighting in markdown code blocks | Code blocks in markdown viewer |
| @google/model-viewer | latest | 3D model viewing in viewer-3d blade | .glb/.gltf file preview |

### Rust Dependencies (Already Sufficient)
| Library | Version | Purpose |
|---------|---------|---------|
| git2 | 0.20 | Repository file listing and reading |
| serde | 1 | Serialization for new command responses |
| specta | =2.0.0-rc.22 | Type-safe bindings generation |
| tauri-specta | 2.0.0-rc.21 | Command registration |
| base64 | 0.22 | Binary file content encoding |

**Installation:**
```bash
npm install react-markdown remark-gfm rehype-highlight @google/model-viewer
```

No new Rust crate dependencies are needed -- `git2` already supports tree traversal and blob reading.

## Architecture Patterns

### Current Blade System Architecture

```
src/
  stores/
    blades.ts              # BladeType union, Blade interface, BladeState store
  hooks/
    useBladeNavigation.ts  # Navigation helpers (openCommitDetails, openDiff, etc.)
  components/
    blades/
      BladeContainer.tsx   # Renders blade stack with strip + active blade
      BladePanel.tsx       # Wrapper with title bar, back button, trailing actions
      BladeStrip.tsx       # Collapsed blade indicator (vertical text, expand button)
      ProcessNavigation.tsx # Staging/Topology process switcher
      StagingChangesBlade.tsx  # Root blade for staging process
      TopologyRootBlade.tsx    # Root blade for topology process
      CommitDetailsBlade.tsx   # Commit details viewer
      DiffBlade.tsx            # File diff viewer
      FileTreeBlade.tsx        # File tree for commit details
      ViewerImageBlade.tsx     # Image file viewer
      ViewerNupkgBlade.tsx     # NuGet package viewer
      index.ts                 # Barrel exports
```

### Blade System Flow

1. **BladeType union** (blades.ts:3-9) defines all valid blade types as string literals
2. **Blade interface** (blades.ts:13-18) has `id`, `type`, `title`, `props`
3. **BladeState store** (blades.ts:20-78) manages `bladeStack` array with push/pop/replace/popToIndex
4. **BladeContainer** (BladeContainer.tsx) iterates stack: collapsed blades render as `BladeStrip`, active (last) blade renders via `renderBlade` callback
5. **RepositoryView** (RepositoryView.tsx:55-152) defines `renderBlade` switch statement mapping BladeType to components
6. **useBladeNavigation** (useBladeNavigation.ts) provides typed helpers that call `store.pushBlade()`

### Pattern for Adding a New Blade Type

```typescript
// 1. Add to BladeType union in stores/blades.ts
export type BladeType =
  | "staging-changes"
  | "topology-graph"
  | "commit-details"
  | "diff"
  | "viewer-nupkg"
  | "viewer-image"
  | "settings"          // NEW
  | "changelog"         // NEW
  | "viewer-markdown"   // NEW
  | "viewer-3d"         // NEW
  | "repo-browser"      // NEW
  | "gitflow-cheatsheet"; // NEW

// 2. Add renderBlade case in RepositoryView.tsx
case "settings":
  return (
    <BladePanel title="Settings" showBack onBack={goBack}>
      <SettingsBlade />
    </BladePanel>
  );

// 3. Add navigation helper in useBladeNavigation.ts
const openSettings = () => {
  store.pushBlade({
    type: "settings",
    title: "Settings",
    props: {},
  });
};

// 4. Create blade component in src/components/blades/
// 5. Export from blades/index.ts
```

### Lazy Loading Pattern (INFRA-04)

The new viewer dependencies should be lazy-loaded since they are large and rarely needed:

```typescript
// In RepositoryView.tsx or a dedicated lazy-imports file
const MarkdownViewerBlade = React.lazy(() =>
  import("./blades/ViewerMarkdownBlade").then(m => ({ default: m.ViewerMarkdownBlade }))
);

const ModelViewerBlade = React.lazy(() =>
  import("./blades/Viewer3dBlade").then(m => ({ default: m.Viewer3dBlade }))
);

// In renderBlade, wrap with Suspense:
case "viewer-markdown":
  return (
    <BladePanel title={blade.title} showBack onBack={goBack}>
      <Suspense fallback={<BladeLoadingSpinner />}>
        <MarkdownViewerBlade filePath={String(blade.props.filePath)} />
      </Suspense>
    </BladePanel>
  );
```

### Rust Command Pattern for New Commands

Every Rust command follows this pattern (based on diff.rs, commands.rs):

```rust
// 1. Define response struct with Serialize, Deserialize, Type, camelCase
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

// 2. Define command with #[tauri::command] and #[specta::specta]
#[tauri::command]
#[specta::specta]
pub async fn list_repo_files(
    path: String,           // relative path within repo
    state: State<'_, RepositoryState>,
) -> Result<Vec<RepoFileEntry>, GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    // Use spawn_blocking for git2 operations
    tokio::task::spawn_blocking(move || {
        // ... git2 operations
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

// 3. Register in lib.rs collect_commands![] macro
// 4. Import in lib.rs use statement
// 5. Add module to git/mod.rs if new file
```

### Anti-Patterns to Avoid

- **Do NOT keep modal and blade versions simultaneously** -- migrate fully, then remove modal mounts
- **Do NOT add new state stores for blade open/close** -- use the existing bladeStore push/pop mechanism
- **Do NOT put ConventionalCommitForm in a blade** -- the requirement says "inline in the commit form", meaning embedded directly in CommitForm.tsx, not pushed as a blade
- **Do NOT import heavy dependencies eagerly** -- react-markdown, rehype-highlight, and @google/model-viewer must be React.lazy loaded

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom parser | react-markdown + remark-gfm + rehype-highlight | Edge cases in GFM, security (XSS), code highlighting |
| 3D model viewing | WebGL viewer | @google/model-viewer web component | Camera controls, lighting, format support |
| Blade navigation | New routing system | Existing bladeStore push/pop | Already proven, animated, supports strips |
| File tree browsing | Custom fs traversal | git2 tree walking | Handles .gitignore, submodules, bare repos |
| Settings persistence | localStorage | Existing tauri-plugin-store | Already used by settings store |

## Common Pitfalls

### Pitfall 1: Settings Store Still Controls Modal Open State
**What goes wrong:** The `useSettingsStore` has `isOpen`, `openSettings()`, `closeSettings()` that control modal visibility. If you just add a blade but still call `openSettings()`, the old modal will try to render too.
**Why it happens:** The Header, keyboard shortcuts, and command palette all call `useSettingsStore.getState().openSettings()`.
**How to avoid:** Change `openSettings()` to push the settings blade instead of setting `isOpen: true`. Update all trigger points (Header.tsx line 52, useKeyboardShortcuts.ts line 28/109-114, commands/settings.ts line 14).
**Warning signs:** Settings appearing as both a modal overlay AND a blade simultaneously.

### Pitfall 2: Changelog Store Dialog State
**What goes wrong:** `useChangelogStore` has `isDialogOpen`, `openDialog()`, `closeDialog()`. Same issue as Settings.
**Why it happens:** Header.tsx line 51 uses `openDialog` directly.
**How to avoid:** Change `openDialog` to push a changelog blade. The store can keep `isDialogOpen` for backward compat during transition but the dialog component should be removed from App.tsx.
**Warning signs:** Changelog appearing as both modal and blade.

### Pitfall 3: ConventionalCommitModal Has Commit Callback
**What goes wrong:** The modal receives `onCommit` callback and `disabled` prop from CommitForm. If you just inline the form, the callback wiring might break.
**Why it happens:** CommitForm.tsx line 126-128 defines `handleConventionalCommit` and passes it as `onCommit` prop.
**How to avoid:** When inlining ConventionalCommitForm directly in CommitForm, keep the same callback pattern. The form's `onCommit` and `onCancel` props remain, just no dialog wrapper.
**Warning signs:** Conventional commits not actually committing.

### Pitfall 4: Blade Stack Overflow for Non-Navigable Blades
**What goes wrong:** Settings blade pushed onto the staging/topology stack means pressing back goes to Settings instead of the expected previous blade.
**Why it happens:** Settings is not a "child" of staging or topology, it's a global action.
**How to avoid:** When opening settings/changelog blade, either (a) reset stack and push settings as root, or (b) push on top of current stack and ensure back navigation works naturally. Option (b) is more intuitive -- user clicks Settings, sees it on top, clicks back to return.
**Warning signs:** Confusing navigation flow.

### Pitfall 5: React.lazy Requires Default Export
**What goes wrong:** `React.lazy(() => import("./Foo"))` expects the module to have a `default` export.
**Why it happens:** Named exports need the `.then(m => ({ default: m.NamedExport }))` pattern.
**How to avoid:** Either use default exports in blade components or use the `.then()` remapping.
**Warning signs:** Runtime error: "Element type is invalid".

### Pitfall 6: Git Tree Traversal for File Browsing
**What goes wrong:** Listing files at HEAD fails on empty repositories or detached HEAD states.
**Why it happens:** `repo.head()` returns `UnbornBranch` error on fresh repos.
**How to avoid:** Handle the `UnbornBranch` case explicitly in `list_repo_files`, returning empty list.
**Warning signs:** Crash when opening repo browser on fresh repos.

## Code Examples

### Current BladeType Extension Point
```typescript
// Source: src/stores/blades.ts lines 3-9
export type BladeType =
  | "staging-changes"
  | "topology-graph"
  | "commit-details"
  | "diff"
  | "viewer-nupkg"
  | "viewer-image";
```

### Current renderBlade Switch Statement
```typescript
// Source: src/components/RepositoryView.tsx lines 55-152
const renderBlade = useCallback(
  (blade: Blade) => {
    switch (blade.type) {
      case "staging-changes":
        return <StagingChangesBlade />;
      case "topology-graph":
        return <TopologyRootBlade />;
      case "commit-details":
        return (
          <BladePanel title="Commit" showBack onBack={goBack}>
            <CommitDetailsBlade oid={String(blade.props.oid)} />
          </BladePanel>
        );
      // ... other cases ...
      default:
        return <div>Unknown blade type</div>;
    }
  },
  [goBack, diffInline],
);
```

### Current useBladeNavigation Helpers
```typescript
// Source: src/hooks/useBladeNavigation.ts lines 22-71
export function useBladeNavigation() {
  const store = useBladeStore();

  const openCommitDetails = (oid: string) => {
    store.pushBlade({
      type: "commit-details",
      title: "Commit",
      props: { oid },
    });
  };
  // ... other helpers ...
  return {
    ...store,
    openCommitDetails,
    openDiff,
    openStagingDiff,
    goBack,
    goToRoot,
  };
}
```

### Settings Modal Trigger Points
```typescript
// Source: src/components/Header.tsx line 52
const openSettings = useSettingsStore((s) => s.openSettings);
// Header.tsx line 257 - button click
<Button variant="ghost" size="sm" onClick={openSettings}>

// Source: src/hooks/useKeyboardShortcuts.ts line 28, 108-115
const openSettings = useSettingsStore((s) => s.openSettings);
useHotkeys("mod+,", (e) => {
  e.preventDefault();
  openSettings();
}, { preventDefault: true });

// Source: src/commands/settings.ts line 14
action: () => {
  useSettingsStore.getState().openSettings();
},
```

### Changelog Modal Trigger Point
```typescript
// Source: src/components/Header.tsx line 51
const openChangelog = useChangelogStore((s) => s.openDialog);
// Header.tsx line 300 - button click
<Button variant="ghost" size="sm" onClick={openChangelog}>
```

### ConventionalCommit Modal Usage
```typescript
// Source: src/components/commit/CommitForm.tsx lines 162-189
{useConventional ? (
  <div className="space-y-3">
    <Button onClick={() => setShowModal(true)} ...>
      Write commit message...
    </Button>
    <ConventionalCommitModal
      open={showModal}
      onOpenChange={setShowModal}
      onCommit={handleConventionalCommit}
      disabled={commitMutation.isPending || !hasStagedFiles}
    />
  </div>
) : (
  /* Simple commit form */
)}
```

### Modal Mounts in App.tsx
```typescript
// Source: src/App.tsx lines 74-76
<ChangelogDialog />
<SettingsWindow />
```
Note: ConventionalCommitModal is NOT in App.tsx, it's inside CommitForm.tsx.

### Rust Command Pattern (File Reading)
```rust
// Source: src-tauri/src/git/diff.rs lines 362-379
#[tauri::command]
#[specta::specta]
pub async fn get_file_base64(
    file_path: String,
    state: State<'_, RepositoryState>,
) -> Result<String, GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;
    let abs_path = repo_path.join(&file_path);
    let data = tokio::fs::read(&abs_path).await
        .map_err(|e| GitError::OperationFailed(format!("Failed to read file: {}", e)))?;
    let mime = mime_from_extension(&file_path);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}
```

### Rust Command Registration
```rust
// Source: src-tauri/src/lib.rs lines 52-137
let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
    // ... existing commands ...
    // Add new commands here:
    // list_repo_files,
    // read_repo_file,
]);
```

## Detailed File Modification Map

### Files to MODIFY

| File | Lines | Change |
|------|-------|--------|
| `src/stores/blades.ts` | 3-9 | Add 7 new types to BladeType union |
| `src/hooks/useBladeNavigation.ts` | 22-71 | Add openSettings, openChangelog, openRepoBrowser, openGitflowCheatsheet helpers |
| `src/components/RepositoryView.tsx` | 55-152 | Add 7 new cases to renderBlade switch, add React.lazy imports |
| `src/components/blades/index.ts` | all | Export new blade components |
| `src/components/commit/CommitForm.tsx` | 145-189 | Replace ConventionalCommitModal with inline ConventionalCommitForm |
| `src/components/Header.tsx` | 51-52, 256-260, 297-305 | Change openSettings and openChangelog to use blade navigation |
| `src/hooks/useKeyboardShortcuts.ts` | 28, 108-115 | Change openSettings to push blade |
| `src/commands/settings.ts` | 13-15 | Change action to push settings blade |
| `src/App.tsx` | 9-10, 74-75 | Remove ChangelogDialog and SettingsWindow imports and mounts |
| `src-tauri/src/lib.rs` | 6-35, 52-137 | Add imports and register list_repo_files, read_repo_file |
| `src-tauri/src/git/mod.rs` | all | Add `pub mod browse;` (or similar) |

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/components/blades/SettingsBlade.tsx` | Settings as a blade (reuses existing settings tab components) |
| `src/components/blades/ChangelogBlade.tsx` | Changelog as a blade (reuses ChangelogPreview and form logic) |
| `src/components/blades/ViewerMarkdownBlade.tsx` | Markdown file viewer (lazy-loaded react-markdown) |
| `src/components/blades/Viewer3dBlade.tsx` | 3D model viewer (lazy-loaded @google/model-viewer) |
| `src/components/blades/RepoBrowserBlade.tsx` | Repository file browser |
| `src/components/blades/GitflowCheatsheetBlade.tsx` | Gitflow cheatsheet reference |
| `src-tauri/src/git/browse.rs` | Rust commands for list_repo_files, read_repo_file |

### Files to REMOVE (or gut)

| File | Action |
|------|--------|
| `src/components/settings/SettingsWindow.tsx` | Remove Dialog wrapper, keep inner content or refactor to SettingsBlade |
| `src/components/changelog/ChangelogDialog.tsx` | Remove Dialog wrapper, keep inner content or refactor to ChangelogBlade |
| `src/components/commit/ConventionalCommitModal.tsx` | Delete entirely (form is already separate in ConventionalCommitForm.tsx) |

## Settings Store Adaptation

The `useSettingsStore` currently manages modal open/close state:

```typescript
// Current: src/stores/settings.ts lines 26-33
interface SettingsState {
  isOpen: boolean;              // Controls modal visibility
  activeCategory: SettingsCategory;
  settings: Settings;
  openSettings: () => void;     // Sets isOpen: true
  closeSettings: () => void;    // Sets isOpen: false
  // ...
}
```

**Strategy:** Remove `isOpen`, `openSettings`, `closeSettings` from the settings store. Replace all call sites with blade navigation:

```typescript
// New approach: use useBladeNavigation().openSettings()
// or direct: useBladeStore.getState().pushBlade({ type: "settings", ... })
```

The `activeCategory` and settings data should remain in the store -- only the open/close state moves to the blade system.

Similarly for `useChangelogStore`, remove `isDialogOpen`, `openDialog`, `closeDialog`.

## Conventional Commit Inline Strategy

The ConventionalCommitForm component is already standalone (src/components/commit/ConventionalCommitForm.tsx). It accepts:
- `onCommit: (message: string) => void`
- `onCancel?: () => void`
- `disabled?: boolean`

The ConventionalCommitModal (src/components/commit/ConventionalCommitModal.tsx) is just a thin Dialog wrapper around ConventionalCommitForm. The inline strategy:

1. In CommitForm.tsx, when `useConventional` is true, render ConventionalCommitForm directly instead of a button that opens a modal
2. The form is taller than the simple textarea, so the commit area in the left sidebar may need to be scrollable or the form may need compact styling
3. Keep the same `onCommit={handleConventionalCommit}` callback wiring
4. Add an `onCancel` that toggles `useConventional` back to false
5. Delete ConventionalCommitModal.tsx entirely

## Repo Browser Rust Commands

Two new commands needed, following existing patterns in diff.rs:

### list_repo_files
- Input: `path: String` (relative directory path, empty string for root)
- Input: `ref_name: Option<String>` (branch/tag/commit, None for working tree)
- Output: `Vec<RepoFileEntry>` with `name`, `path`, `is_dir`, `size`
- Pattern: Use `repo.head()?.peel_to_tree()?.get_path()` for tree walking, or `std::fs::read_dir()` for working tree

### read_repo_file
- Input: `file_path: String` (relative path), `ref_name: Option<String>`
- Output: `String` (file content) or base64 for binary
- Pattern: Similar to `get_blob_content()` in diff.rs line 439-456
- For working tree: similar to `get_file_base64()` in diff.rs line 362-379

Both commands use `RepositoryState` to get the repo path, and `spawn_blocking` for git2 operations.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Modal dialogs for settings/changelog | Blade-based panels with push/pop navigation | Consistent UX, no overlay blocking main UI |
| ConventionalCommit in separate modal | Inline in commit form area | Faster workflow, less context switching |
| Eagerly loaded viewer deps | React.lazy with Suspense | Smaller initial bundle, faster startup |

## Open Questions

1. **Blade for settings: global or process-scoped?**
   - Settings is not related to staging or topology process. Currently `setProcess()` resets the blade stack. Opening settings should probably push on top of current stack regardless of process.
   - Recommendation: Push settings blade on top of current stack. Back returns to previous blade.

2. **Compact ConventionalCommitForm for inline use?**
   - The current form has type selector, scope autocomplete, description, body, breaking change, validation, preview, and action buttons. This is large for the left sidebar.
   - Recommendation: Create a compact variant or make the sidebar section scrollable when conventional mode is active.

3. **Should the old stores keep isOpen/isDialogOpen?**
   - Removing these from stores breaks the interface contract. But keeping them unused is confusing.
   - Recommendation: Remove them. It is a clean break. Update all consumers.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all referenced files
- `src/stores/blades.ts` - BladeType, Blade interface, BladeState
- `src/hooks/useBladeNavigation.ts` - Navigation helpers pattern
- `src/components/blades/BladeContainer.tsx` - Rendering pattern
- `src/components/RepositoryView.tsx` - renderBlade switch
- `src/components/settings/SettingsWindow.tsx` - Settings modal implementation
- `src/components/changelog/ChangelogDialog.tsx` - Changelog modal implementation
- `src/components/commit/ConventionalCommitModal.tsx` - Conventional commit modal
- `src/components/commit/CommitForm.tsx` - Modal trigger for conventional commits
- `src/components/Header.tsx` - Settings and changelog trigger points
- `src/hooks/useKeyboardShortcuts.ts` - Keyboard shortcut trigger for settings
- `src/commands/settings.ts` - Command palette trigger for settings
- `src/App.tsx` - Modal mount points
- `src-tauri/src/lib.rs` - Command registration
- `src-tauri/src/git/diff.rs` - Rust command patterns for file reading
- `src-tauri/src/git/commands.rs` - Repository state access pattern
- `src-tauri/src/git/repository.rs` - RepositoryState, get_path()
- `src-tauri/src/git/error.rs` - GitError enum
- `src-tauri/src/git/mod.rs` - Module structure

### Secondary (MEDIUM confidence)
- React.lazy documentation for lazy loading pattern
- @google/model-viewer for 3D viewing (well-established web component by Google)

### Tertiary (LOW confidence)
- Exact latest versions of react-markdown, remark-gfm, rehype-highlight, @google/model-viewer (need to verify at install time)

## Metadata

**Confidence breakdown:**
- Blade system architecture: HIGH - direct codebase analysis, all files read
- Modal implementations: HIGH - all three modals fully read and understood
- Trigger points: HIGH - all trigger locations identified with line numbers
- Rust command patterns: HIGH - existing patterns thoroughly analyzed
- New dependency versions: LOW - need to verify at install time
- Lazy loading pattern: MEDIUM - standard React pattern, not yet used in this codebase

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (stable patterns, no external API changes expected)
