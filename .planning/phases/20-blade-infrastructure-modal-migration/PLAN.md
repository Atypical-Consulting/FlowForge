# Phase 20: Blade Infrastructure & Modal Migration — Execution Plan

**Goal**: Users interact with settings, changelogs, and commit composition through blades instead of modal dialogs, with all new blade types registered and routable

**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, BLADE-01, BLADE-02, BLADE-03, BLADE-04

---

## Plan 20-01: Install New Dependencies

**Covers**: INFRA-04 (partial — install packages, lazy loading comes in 20-07)

**Tasks**:
1. `npm install react-markdown remark-gfm rehype-highlight @google/model-viewer`
2. Verify packages appear in `package.json`
3. No imports yet — just availability for later plans

**Files modified**: `package.json`, `package-lock.json`

**Commit**: `feat(20-01): install viewer dependencies for markdown and 3D blades`

---

## Plan 20-02: Extend Blade Type System

**Covers**: INFRA-01, INFRA-02 (partial), INFRA-03

**Tasks**:

### 2a. Extend BladeType union (`src/stores/blades.ts:3-9`)
Add 7 new types to the union:
```typescript
export type BladeType =
  | "staging-changes"
  | "topology-graph"
  | "commit-details"
  | "diff"
  | "viewer-nupkg"
  | "viewer-image"
  | "settings"
  | "changelog"
  | "viewer-markdown"
  | "viewer-3d"
  | "repo-browser"
  | "gitflow-cheatsheet";
```

### 2b. Add navigation helpers (`src/hooks/useBladeNavigation.ts`)
Add new helpers after existing ones (line ~60):
```typescript
const openSettings = () => {
  store.pushBlade({ type: "settings", title: "Settings", props: {} });
};

const openChangelog = () => {
  store.pushBlade({ type: "changelog", title: "Changelog", props: {} });
};

const openRepoBrowser = (path?: string) => {
  store.pushBlade({
    type: "repo-browser",
    title: "Repository Browser",
    props: { path: path || "" },
  });
};

const openGitflowCheatsheet = () => {
  store.pushBlade({
    type: "gitflow-cheatsheet",
    title: "Gitflow Guide",
    props: {},
  });
};

const openMarkdownViewer = (filePath: string) => {
  store.pushBlade({
    type: "viewer-markdown",
    title: filePath.split("/").pop() || "Markdown",
    props: { filePath },
  });
};

const openModelViewer = (filePath: string) => {
  store.pushBlade({
    type: "viewer-3d",
    title: filePath.split("/").pop() || "3D Model",
    props: { filePath },
  });
};
```

Also update `bladeTypeForFile` to route `.md`/`.mdx` to `"viewer-markdown"` and `.glb`/`.gltf` to `"viewer-3d"`.

Return all new helpers from the hook.

### 2c. Add renderBlade placeholder cases (`src/components/RepositoryView.tsx:55-152`)
Add cases for all 7 new types. For this plan, use simple placeholder content for Phase 22+ blades. Settings/Changelog will be replaced in 20-04/20-06.

```typescript
case "settings":
  return (
    <BladePanel title="Settings" showBack onBack={goBack}>
      <div className="p-4 text-ctp-subtext0">Settings blade coming...</div>
    </BladePanel>
  );
case "changelog":
  return (
    <BladePanel title="Changelog" showBack onBack={goBack}>
      <div className="p-4 text-ctp-subtext0">Changelog blade coming...</div>
    </BladePanel>
  );
case "viewer-markdown":
  return (
    <BladePanel title={blade.title} showBack onBack={goBack}>
      <div className="p-4 text-ctp-subtext0">Markdown viewer coming...</div>
    </BladePanel>
  );
case "viewer-3d":
  return (
    <BladePanel title={blade.title} showBack onBack={goBack}>
      <div className="p-4 text-ctp-subtext0">3D viewer coming...</div>
    </BladePanel>
  );
case "repo-browser":
  return (
    <BladePanel title="Repository Browser" showBack onBack={goBack}>
      <div className="p-4 text-ctp-subtext0">Repo browser coming...</div>
    </BladePanel>
  );
case "gitflow-cheatsheet":
  return (
    <BladePanel title="Gitflow Guide" showBack onBack={goBack}>
      <div className="p-4 text-ctp-subtext0">Gitflow guide coming...</div>
    </BladePanel>
  );
```

**Files modified**: `src/stores/blades.ts`, `src/hooks/useBladeNavigation.ts`, `src/components/RepositoryView.tsx`

**Commit**: `feat(20-02): extend blade type system with 7 new blade types`

---

## Plan 20-03: Rust Commands for Repo File Browsing

**Covers**: INFRA-05

**Tasks**:

### 3a. Create `src-tauri/src/git/browse.rs`
Two new commands:

**`list_repo_files`** — List files/directories in a repo path at HEAD:
- Input: `path: String` (relative dir path, empty for root)
- Output: `Vec<RepoFileEntry>` with `name`, `path`, `is_dir`, `size`
- Uses `repo.head()?.peel_to_tree()` then walks the tree
- Handle `UnbornBranch` by returning empty list
- Sort: directories first, then alphabetically

**`read_repo_file`** — Read file content at HEAD:
- Input: `file_path: String` (relative path)
- Output: `RepoFileContent` with `content: String`, `is_binary: bool`, `size: u64`
- Uses `repo.head()?.peel_to_tree()?.get_path()` then blob
- Binary detection: check first 8000 bytes for null byte
- Binary files: return base64 content
- Text files: return UTF-8 string

### 3b. Register module (`src-tauri/src/git/mod.rs`)
Add `pub mod browse;`

### 3c. Register commands (`src-tauri/src/lib.rs`)
Add imports and register in `collect_commands![]`:
```rust
use git::browse::{list_repo_files, read_repo_file};
// In collect_commands![]
list_repo_files,
read_repo_file,
```

### 3d. Regenerate bindings
Run `cargo build` in dev mode to trigger tauri-specta binding generation.

**Files created**: `src-tauri/src/git/browse.rs`
**Files modified**: `src-tauri/src/git/mod.rs`, `src-tauri/src/lib.rs`
**Auto-generated**: `src/bindings.ts`

**Commit**: `feat(20-03): add Rust commands for repo file browsing`

---

## Plan 20-04: Settings Blade Migration

**Covers**: BLADE-01

**Tasks**:

### 4a. Create `src/components/blades/SettingsBlade.tsx`
Extract the inner content from `SettingsWindow.tsx` (the tabbed layout, lines 79-120) into a standalone blade component. Remove the `Dialog`/`DialogContent` wrapper.

The blade component:
- Uses `useSettingsStore` for `activeCategory`, `setCategory`
- Renders the same tab navigation + panel layout
- Does NOT use `isOpen`/`closeSettings` — the blade store handles open/close
- Full-height layout to fill the blade panel

### 4b. Update `RepositoryView.tsx` renderBlade
Replace the placeholder settings case with:
```typescript
case "settings":
  return (
    <BladePanel title="Settings" showBack onBack={goBack}>
      <SettingsBlade />
    </BladePanel>
  );
```
Import `SettingsBlade`.

### 4c. Redirect all settings trigger points to blade navigation

**Header.tsx** (line 52): Change from `useSettingsStore((s) => s.openSettings)` to using `useBladeStore.getState().pushBlade({ type: "settings", ... })` or import from `useBladeNavigation`.

**useKeyboardShortcuts.ts** (line 28, 108-115): Change `openSettings()` to push blade.

**commands/settings.ts** (line 13-15): Change action to push blade.

### 4d. Clean settings store (`src/stores/settings.ts`)
Remove `isOpen`, `openSettings`, `closeSettings` from the store interface and implementation. Keep `activeCategory`, `setCategory`, `settings`, `updateSetting`, `initSettings`.

### 4e. Export from barrel (`src/components/blades/index.ts`)
Add `export { SettingsBlade } from "./SettingsBlade";`

**Files created**: `src/components/blades/SettingsBlade.tsx`
**Files modified**: `src/components/RepositoryView.tsx`, `src/components/Header.tsx`, `src/hooks/useKeyboardShortcuts.ts`, `src/commands/settings.ts`, `src/stores/settings.ts`, `src/components/blades/index.ts`

**Commit**: `feat(20-04): migrate settings from modal to blade`

---

## Plan 20-05: Conventional Commit Inline Migration

**Covers**: BLADE-02

**Tasks**:

### 5a. Update `CommitForm.tsx` (`src/components/commit/CommitForm.tsx:162-189`)
Replace the "Write commit message..." button + `ConventionalCommitModal` with direct inline rendering of `ConventionalCommitForm`:

```typescript
{useConventional ? (
  <div className="space-y-3 max-h-[60vh] overflow-y-auto">
    <ConventionalCommitForm
      onCommit={handleConventionalCommit}
      onCancel={() => setUseConventional(false)}
      disabled={commitMutation.isPending || !hasStagedFiles}
    />
    {!hasStagedFiles && (
      <p className="text-xs text-ctp-overlay0 text-center">
        No staged changes to commit
      </p>
    )}
  </div>
) : (
  /* Simple commit form — unchanged */
)}
```

Key changes:
- Remove `showModal` state and `setShowModal` calls
- Import `ConventionalCommitForm` instead of `ConventionalCommitModal`
- `onCancel` toggles `useConventional` back to false
- Wrap in scrollable container since the form is tall
- Keep the same `handleConventionalCommit` callback

### 5b. Remove `ConventionalCommitModal.tsx`
Delete `src/components/commit/ConventionalCommitModal.tsx` entirely.

### 5c. Update barrel export if needed
Check if `ConventionalCommitModal` is exported from any barrel file. Remove if so.

**Files modified**: `src/components/commit/CommitForm.tsx`
**Files deleted**: `src/components/commit/ConventionalCommitModal.tsx`

**Commit**: `feat(20-05): inline conventional commit form in sidebar`

---

## Plan 20-06: Changelog Blade Migration

**Covers**: BLADE-03

**Tasks**:

### 6a. Create `src/components/blades/ChangelogBlade.tsx`
Extract the inner content from `ChangelogDialog.tsx` (the form + preview, lines 40-125) into a standalone blade component. Remove the `Dialog`/`DialogContent`/`DialogHeader` wrapper.

The blade component:
- Uses `useChangelogStore` for all state (refs, version, generate, reset, changelog, error, isGenerating)
- Renders the options form + ChangelogPreview directly
- "Done" button calls `goBack()` from blade navigation + `reset()`
- Same layout as dialog content, adapted to fill blade panel width

### 6b. Update `RepositoryView.tsx` renderBlade
Replace the placeholder changelog case with:
```typescript
case "changelog":
  return (
    <BladePanel title="Generate Changelog" showBack onBack={goBack}>
      <ChangelogBlade />
    </BladePanel>
  );
```
Import `ChangelogBlade`.

### 6c. Redirect changelog trigger point
**Header.tsx** (line 51, 296-305): Change from `useChangelogStore((s) => s.openDialog)` to pushing a changelog blade.

### 6d. Clean changelog store (`src/stores/changelogStore.ts`)
Remove `isDialogOpen`, `openDialog`, `closeDialog` from the store. The blade store handles open/close.

### 6e. Export from barrel
Add `export { ChangelogBlade } from "./ChangelogBlade";`

**Files created**: `src/components/blades/ChangelogBlade.tsx`
**Files modified**: `src/components/RepositoryView.tsx`, `src/components/Header.tsx`, `src/stores/changelogStore.ts`, `src/components/blades/index.ts`

**Commit**: `feat(20-06): migrate changelog from modal to blade`

---

## Plan 20-07: Lazy-Loaded Placeholder Blades for Phase 22+ Types

**Covers**: INFRA-04, INFRA-02 (complete)

**Tasks**:

### 7a. Create placeholder blade components
Create minimal components that will be completed in Phase 22:

- `src/components/blades/ViewerMarkdownBlade.tsx` — Shows "Markdown viewer" with file path
- `src/components/blades/Viewer3dBlade.tsx` — Shows "3D model viewer" with file path
- `src/components/blades/RepoBrowserBlade.tsx` — Shows "Repository Browser" placeholder
- `src/components/blades/GitflowCheatsheetBlade.tsx` — Shows "Gitflow Guide" placeholder

Each is a simple component for now (no heavy imports). Phase 22 will add the real content.

### 7b. Set up React.lazy pattern in RepositoryView.tsx
Replace the inline placeholders from 20-02 with React.lazy imports:

```typescript
const ViewerMarkdownBlade = lazy(() =>
  import("./blades/ViewerMarkdownBlade").then(m => ({ default: m.ViewerMarkdownBlade }))
);
const Viewer3dBlade = lazy(() =>
  import("./blades/Viewer3dBlade").then(m => ({ default: m.Viewer3dBlade }))
);
const RepoBrowserBlade = lazy(() =>
  import("./blades/RepoBrowserBlade").then(m => ({ default: m.RepoBrowserBlade }))
);
const GitflowCheatsheetBlade = lazy(() =>
  import("./blades/GitflowCheatsheetBlade").then(m => ({ default: m.GitflowCheatsheetBlade }))
);
```

Wrap with `<Suspense>` in renderBlade cases:
```typescript
case "viewer-markdown":
  return (
    <BladePanel title={blade.title} showBack onBack={goBack}>
      <Suspense fallback={<div className="p-4 text-ctp-subtext0">Loading...</div>}>
        <ViewerMarkdownBlade filePath={String(blade.props.filePath)} />
      </Suspense>
    </BladePanel>
  );
```

### 7c. Export from barrel
Add all 4 new components to `src/components/blades/index.ts`.

**Files created**: `src/components/blades/ViewerMarkdownBlade.tsx`, `src/components/blades/Viewer3dBlade.tsx`, `src/components/blades/RepoBrowserBlade.tsx`, `src/components/blades/GitflowCheatsheetBlade.tsx`
**Files modified**: `src/components/RepositoryView.tsx`, `src/components/blades/index.ts`

**Commit**: `feat(20-07): add lazy-loaded placeholder blades for Phase 22 types`

---

## Plan 20-08: Remove Modal Mounts & Final Cleanup

**Covers**: BLADE-04

**Tasks**:

### 8a. Remove modal mounts from `App.tsx`
Remove lines 74-75:
```typescript
<ChangelogDialog />
<SettingsWindow />
```
Remove corresponding imports (lines 9-10):
```typescript
import { ChangelogDialog } from "./components/changelog";
import { SettingsWindow } from "./components/settings";
```
Also remove `import { useSettingsStore } from "./stores/settings";` if no longer used (check if `initSettings` is still used — YES it is, keep the import).

### 8b. Delete or gut modal wrapper files
- Delete `src/components/settings/SettingsWindow.tsx` — inner content now lives in SettingsBlade
- Delete `src/components/changelog/ChangelogDialog.tsx` — inner content now lives in ChangelogBlade
- `ConventionalCommitModal.tsx` was already deleted in Plan 20-05

### 8c. Update barrel exports for settings and changelog
Check `src/components/settings/index.ts` and `src/components/changelog/index.ts` — remove exports for deleted files. Keep exports for inner components (AppearanceSettings, GeneralSettings, etc. for settings; ChangelogPreview for changelog).

### 8d. Verify no remaining references
Search for `SettingsWindow`, `ChangelogDialog`, `ConventionalCommitModal` across the codebase. All references should be gone.

### 8e. Type-check and test
Run `npx tsc --noEmit` to verify no type errors (except the pre-existing TS2440 in bindings.ts).

**Files modified**: `src/App.tsx`, `src/components/settings/index.ts`, `src/components/changelog/index.ts`
**Files deleted**: `src/components/settings/SettingsWindow.tsx`, `src/components/changelog/ChangelogDialog.tsx`

**Commit**: `feat(20-08): remove all modal mounts from App.tsx`

---

## Plan Dependencies

```
20-01 ──────────────────────────────────────────────> (independent, do first)
20-02 ──────────┬─> 20-04 (Settings blade)
                ├─> 20-05 (Conventional inline)
                ├─> 20-06 (Changelog blade)
                └─> 20-07 (Placeholder blades)
20-03 ──────────────────────────────────────────────> (independent, do after 20-02)
20-04 + 20-05 + 20-06 + 20-07 ──────> 20-08 (cleanup)
```

**Execution order**: 20-01 → 20-02 → 20-03 → 20-04 → 20-05 → 20-06 → 20-07 → 20-08

Plans 20-04, 20-05, 20-06 can run in any order after 20-02 completes.

---

## Success Criteria Verification

| # | Criterion | Verified by |
|---|-----------|-------------|
| 1 | Settings appears as blade with back-navigation via blade strip | Plan 20-04: SettingsBlade + Header trigger redirected |
| 2 | Conventional commit inline in commit form | Plan 20-05: ConventionalCommitForm embedded directly |
| 3 | Changelog as blade with push/pop navigation | Plan 20-06: ChangelogBlade + Header trigger redirected |
| 4 | App.tsx has zero modal mounts | Plan 20-08: ChangelogDialog + SettingsWindow removed |
| 5 | All 7 new blade types registered | Plan 20-02 (types) + 20-04/06/07 (components) |

---

*Created: 2026-02-07*
*Phase: 20 — Blade Infrastructure & Modal Migration*
*Plans: 8*
