# Phase 45: Init Repo Extraction -- Developer Research

## 1. Current Init Repo Code -- Complete Inventory

### 1.1 File Listing

All files live under `src/blades/init-repo/`:

| File | Role | Lines |
|------|------|-------|
| `index.ts` | Re-exports `InitRepoBlade` component | 1 |
| `registration.ts` | Calls `registerBlade()` with type `"init-repo"` | 9 |
| `InitRepoBlade.tsx` | Root component: hydrates store, fetches templates, renders split-pane | 82 |
| `store.ts` | Zustand blade store via `createBladeStore("init-repo", ...)` | 130 |
| `components/InitRepoForm.tsx` | Form with sections: config, .gitignore, README, commit + action bar | 351 |
| `components/InitRepoPreview.tsx` | Right-side preview panel with 4 section views + AnimatePresence | 274 |
| `components/TemplatePicker.tsx` | Template browser with search, category filter, keyboard nav | 210 |
| `components/TemplateChips.tsx` | Selected template chips with remove/clear actions | 47 |
| `components/CategoryFilter.tsx` | Category tab bar for template filtering | 56 |
| `components/ProjectDetectionBanner.tsx` | Auto-detection banner showing recommended templates | 53 |

### 1.2 Component Architecture

```
InitRepoBlade (root)
  +-- SplitPaneLayout (autoSaveId="init-repo-split")
       |-- primary: InitRepoForm
       |    +-- ProjectDetectionBanner
       |    +-- TemplateChips
       |    +-- TemplatePicker
       |    |    +-- CategoryFilter
       |    +-- README section (inline)
       |    +-- Commit section (inline)
       |    +-- Action bar (Cancel / Initialize)
       |-- detail: InitRepoPreview
            +-- GitignorePreview (local component)
            +-- ReadmePreview (local component)
            +-- CommitPreview (local component)
            +-- SummaryPreview (local component)
```

### 1.3 InitRepoBlade Props

```ts
interface InitRepoBladeProps {
  directoryPath: string;
  onCancel?: () => void;
  onComplete?: (path: string) => void;
}
```

### 1.4 Store Definition

The store uses `createBladeStore` (Zustand + devtools + auto-reset-on-unmount):

**State fields:**
- Core: `directoryPath`, `defaultBranch`
- Detection: `detectedTypes[]`, `isDetecting`
- Gitignore: `selectedTemplates[]`, `templateContents{}`, `isLoadingTemplates`, `templateSource`, `searchQuery`, `activeCategory`, `isPickerOpen`
- README: `readmeEnabled`, `readmeName`, `readmeDescription`
- Commit: `commitEnabled`, `commitMessage`
- UI: `activeSection` (union of "gitignore" | "readme" | "commit" | "summary")
- Progress: `isInitializing`, `initError`
- 24 action methods

**Important:** Uses `createBladeStore` from `src/stores/createBladeStore.ts` which wraps Zustand `create()` with `devtools` middleware and auto-registers for reset via `registerStoreForReset()`.

### 1.5 Registration Details

Current registration (`src/blades/init-repo/registration.ts`):
```ts
registerBlade<{ directoryPath: string }>({
  type: "init-repo",
  defaultTitle: "Initialize Repository",
  component: InitRepoBlade,
  singleton: true,
});
```

This is a **direct `registerBlade()` call** (core registration), not via `ExtensionAPI`. It gets picked up by `src/blades/_discovery.ts` via `import.meta.glob("./*/registration.{ts,tsx}")`.

---

## 2. Tauri/Rust Commands Used by Init Repo

### 2.1 Commands Invoked Directly

| TS Function | Rust Function | File | Purpose |
|---|---|---|---|
| `commands.gitInit(path, defaultBranch)` | `git_init(path, default_branch)` | `src-tauri/src/git/init.rs:31` | Create `.git/` directory with specified branch |
| `commands.writeInitFiles(path, files[])` | `write_init_files(path, files)` | `src-tauri/src/git/gitignore.rs:354` | Write `.gitignore`, `README.md` to directory |
| `commands.stageAll()` | (staging module) | `src-tauri/src/git/staging.rs` | Stage all files for initial commit |
| `commands.createCommit(message, amend)` | (commit module) | `src-tauri/src/git/commit.rs` | Create initial commit |
| `commands.getGitignoreTemplate(name)` | `get_gitignore_template(name)` | `src-tauri/src/git/gitignore.rs:202` | Fetch template content (GitHub API / bundled) |
| `commands.isGitRepository(path)` | `is_git_repository(path)` | `src-tauri/src/git/commands.rs:56` | Check if directory has `.git/` |

### 2.2 Commands Used via React Query Hooks

| Hook | Tauri Command | Source |
|---|---|---|
| `useGitignoreTemplateList()` | `commands.listGitignoreTemplates()` | `src/hooks/useGitignoreTemplates.ts` |
| `useProjectDetection(path)` | `commands.detectProjectType(path)` | `src/hooks/useGitignoreTemplates.ts` |

### 2.3 Note on Command Availability

All these commands are **always available** regardless of whether a repository is open. They operate on filesystem paths, not the currently-open repo. This is critical for Init Repo which runs **before** any repo is open.

---

## 3. Phase 44 Reference -- Worktrees Extension Pattern

### 3.1 File Structure

```
src/extensions/worktrees/
  index.tsx              -- Entry point: onActivate(), onDeactivate()
  components/
    index.ts             -- Re-exports WorktreeSidebarPanel
    WorktreeSidebarPanel.tsx
    WorktreePanel.tsx
    WorktreeItem.tsx
    CreateWorktreeDialog.tsx
    DeleteWorktreeDialog.tsx
```

### 3.2 Entry Point Pattern

```ts
// src/extensions/worktrees/index.tsx
import type { ExtensionAPI } from "../ExtensionAPI";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // 1. Contribute sidebar panel
  api.contributeSidebarPanel({ ... });

  // 2. Register commands in palette
  api.registerCommand({ ... });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
```

### 3.3 Key Observations for Init Repo Extraction

1. **No blade registration** in worktrees -- it only uses sidebar panels and commands. But other extensions (conventional-commits, content-viewers, gitflow) register blades with `coreOverride: true`.

2. **`coreOverride: true`** pattern (from conventional-commits/index.ts):
   ```ts
   api.registerBlade({
     type: "conventional-commit",  // keeps original type, no ext: prefix
     title: "Conventional Commit",
     component: ConventionalCommitBlade,
     lazy: true,
     singleton: true,
     coreOverride: true,
   });
   ```

3. **Lazy loading** pattern used by conventional-commits, content-viewers, and gitflow:
   ```ts
   const MyBlade = lazy(() =>
     import("./blades/MyBlade").then((m) => ({ default: m.MyBlade }))
   );
   ```

4. **Store cleanup** pattern (conventional-commits):
   ```ts
   api.onDispose(() => {
     useConventionalStore.getState().reset();
   });
   ```

### 3.4 App.tsx Registration Pattern

Built-in extensions are registered in `App.tsx` via `registerBuiltIn()`:

```ts
import { onActivate as worktreesActivate, onDeactivate as worktreesDeactivate } from "./extensions/worktrees";

registerBuiltIn({
  id: "worktrees",
  name: "Worktrees",
  version: "1.0.0",
  activate: worktreesActivate,
  deactivate: worktreesDeactivate,
});
```

`registerBuiltIn()` immediately activates the extension by:
1. Creating a synthetic manifest
2. Registering it as `"discovered"` in the extensions store
3. Instantiating `new ExtensionAPI(id)`
4. Calling `activate(api)`
5. Setting status to `"active"`

---

## 4. WelcomeView -- Current Init Repo Integration

### 4.1 How WelcomeView Renders Init Repo

`src/components/WelcomeView.tsx` already uses `BladeRegistry` lookup:

```ts
const initRepoRegistration = useBladeRegistry((s) => s.blades.get("init-repo"));
```

When `showInitRepo && pendingInitPath`:
1. Checks if `initRepoRegistration` exists (fallback message if not)
2. Gets `InitComponent = initRepoRegistration.component`
3. Renders `<InitComponent directoryPath={pendingInitPath} onCancel={...} onComplete={...} />`

### 4.2 GitInitBanner

`src/components/welcome/GitInitBanner.tsx` renders when:
- A non-git directory is selected (`pendingInitPath` is set)
- No error
- User hasn't clicked "Set Up Repository" yet (`!showInitRepo`)

Shows: "This folder is not a Git repository" with "Set Up Repository" button.

### 4.3 Critical Timing Issue

Currently, init-repo blade is registered via `src/blades/_discovery.ts` which is imported at the top of `App.tsx`:
```ts
import "./blades/_discovery";
```

This runs **synchronously during module evaluation**, so the blade is available immediately. When converted to an extension, `registerBuiltIn()` is called inside a `useEffect`, which runs **after the first render**. However, `registerBuiltIn()` calls `activate(api)` which is `async`, so the blade registration happens slightly after mount.

The existing code has a race condition guard:
```tsx
if (!initRepoRegistration) {
  return <div>Preparing repository setup...</div>;
}
```

This is adequate -- the blade will appear once the extension activates and the store updates.

### 4.4 INIT-04: Fallback When Extension Disabled

When the init-repo extension is disabled, `initRepoRegistration` will be `undefined` (blade unregistered during cleanup). The WelcomeView needs to show a simple "Run git init" fallback button instead of the full Init Repo blade.

Current code shows "Preparing repository setup..." -- this needs to change to distinguish between "loading" and "disabled":

**Option A:** Check extension status in the host store
```ts
const initRepoExt = useExtensionHost((s) => s.extensions.get("init-repo"));
const isDisabled = initRepoExt?.status === "disabled" || initRepoExt?.status === "deactivated";
```

**Option B:** Simply render a minimal fallback whenever `initRepoRegistration` is null and `showInitRepo` is true. The fallback calls `commands.gitInit()` directly.

---

## 5. Import Analysis -- All References to Init Repo

### 5.1 Files Referencing Init Repo

| File | What it references | How |
|---|---|---|
| `src/blades/init-repo/index.ts` | `InitRepoBlade` | Re-export |
| `src/blades/init-repo/registration.ts` | `InitRepoBlade`, `registerBlade` | Core blade registration |
| `src/blades/init-repo/InitRepoBlade.tsx` | `useInitRepoStore`, `SplitPaneLayout`, `InitRepoForm`, `InitRepoPreview` | Main component |
| `src/blades/init-repo/store.ts` | `createBladeStore` | Store definition |
| `src/blades/init-repo/components/InitRepoForm.tsx` | `useInitRepoStore`, `commands`, `composeGitignore`, `useGitOpsStore`, `useRecentRepos`, `useBladeNavigation`, `Button`, sub-components | Form logic |
| `src/blades/init-repo/components/InitRepoPreview.tsx` | `useInitRepoStore`, `composeGitignore` | Preview rendering |
| `src/blades/init-repo/components/TemplatePicker.tsx` | `useInitRepoStore`, `useGitignoreTemplateList`, `getCategoryForTemplate`, `CategoryFilter` | Template browser |
| `src/blades/init-repo/components/TemplateChips.tsx` | `useInitRepoStore` | Selected chips |
| `src/blades/init-repo/components/CategoryFilter.tsx` | `useInitRepoStore`, `GITIGNORE_CATEGORIES` | Category tabs |
| `src/blades/init-repo/components/ProjectDetectionBanner.tsx` | `useInitRepoStore` | Detection UI |
| `src/blades/_discovery.ts` | `"init-repo"` string literal | Expected types list |
| `src/stores/bladeTypes.ts` | `"init-repo": { directoryPath: string }` | Type definition |
| `src/components/WelcomeView.tsx` | `useBladeRegistry` with `"init-repo"` key | Runtime blade lookup |

### 5.2 External Dependencies (shared code used by Init Repo)

| Import | Source | Shared? |
|---|---|---|
| `commands` (bindings) | `src/bindings.ts` | Shared -- global bindings |
| `useProjectDetection`, `useGitignoreTemplateList` | `src/hooks/useGitignoreTemplates.ts` | Shared hooks |
| `getCategoryForTemplate`, `GITIGNORE_CATEGORIES` | `src/lib/gitignoreCategories.ts` | Shared lib |
| `composeGitignore` | `src/lib/gitignoreComposer.ts` | Shared lib |
| `getErrorMessage` | `src/lib/errors.ts` | Shared lib |
| `SplitPaneLayout` | `src/components/layout/SplitPaneLayout.tsx` | Shared component |
| `Button` | `src/components/ui/button.tsx` | Shared component |
| `useGitOpsStore` (openRepository) | `src/stores/domain/git-ops.ts` | Shared store |
| `useRecentRepos` (addRecentRepo) | `src/hooks/useRecentRepos.ts` | Shared hook |
| `useBladeNavigation` (goBack) | `src/hooks/useBladeNavigation.ts` | Shared hook |
| `createBladeStore` | `src/stores/createBladeStore.ts` | Shared utility |

**All of these remain in their current locations.** The extension will import them via relative paths from the `src/extensions/init-repo/` directory.

---

## 6. Extension Entry Point Design

### 6.1 Activation Pattern

Following the established pattern (conventional-commits is the closest model):

```ts
// src/extensions/init-repo/index.ts
import { lazy } from "react";
import { FolderGit2 } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { openBlade } from "../../lib/bladeOpener";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const InitRepoBlade = lazy(() =>
    import("./InitRepoBlade").then((m) => ({ default: m.InitRepoBlade }))
  );

  // Register blade with coreOverride to preserve "init-repo" type
  api.registerBlade({
    type: "init-repo",
    title: "Initialize Repository",
    component: InitRepoBlade,
    singleton: true,
    lazy: true,
    coreOverride: true,
  });

  // Register command in palette
  api.registerCommand({
    id: "init-repo",
    title: "Initialize Repository",
    description: "Set up a new Git repository with templates",
    category: "Repository",
    icon: FolderGit2,
    keywords: ["init", "initialize", "new", "repository", "git"],
    action: () => {
      // This command could open a directory picker, then open the blade
      // Or dispatch a custom event that WelcomeView listens for
    },
    // No `enabled` check needed -- this works before repo is open
  });

  // Reset store on dispose to prevent ghost state
  api.onDispose(() => {
    const { useInitRepoStore } = await import("./store");
    useInitRepoStore.getState().reset();
  });
}

export function onDeactivate(): void {
  // api.cleanup() handles all unregistrations
}
```

### 6.2 Early Activation Requirement (INIT-01)

Init Repo must activate **before any repo is open** because WelcomeView needs it.

Current activation flow in `App.tsx`:
```
useEffect (mount) -> registerBuiltIn() for each extension -> immediate activation
```

`registerBuiltIn()` calls `activate(api)` immediately (not waiting for repo open). This is exactly what Init Repo needs.

The second `useEffect` that depends on `status` (repo open) handles `discoverExtensions` + `activateAll()` for filesystem extensions. Built-in extensions are already active before this.

**No changes needed to the activation timing** -- `registerBuiltIn()` already activates immediately at mount.

---

## 7. Tailwind / Catppuccin Classes Used

### 7.1 Color Tokens

| Token | Usage |
|---|---|
| `ctp-base` | Main background, button text |
| `ctp-mantle` | Preview panel background |
| `ctp-surface0` | Input backgrounds, section headers, chips |
| `ctp-surface1` | Borders, hover states |
| `ctp-surface2` | Checkbox borders |
| `ctp-text` | Primary text |
| `ctp-subtext0` | Secondary text, labels, icons |
| `ctp-subtext1` | Tertiary text |
| `ctp-overlay0` | Placeholder text |
| `ctp-blue` | Primary accent, selected state, focus rings, detection banner |
| `ctp-blue/10`, `/20`, `/30`, `/50` | Blue opacity variants |
| `ctp-green` | Success/active state (commit preview, summary) |
| `ctp-green/10`, `/30` | Green opacity variants |
| `ctp-red` | Error state |
| `ctp-red/20` | Red opacity for delete hover |
| `ctp-yellow/10`, `/30` | Warning (offline bundled templates) |

### 7.2 Animations

- `animate-pulse` (Tailwind built-in) -- skeleton loading
- `animate-spin` (Tailwind built-in) -- loading spinner
- `framer-motion` `AnimatePresence` + `motion.div` -- section transitions in preview (opacity fade, 150ms)

### 7.3 Layout Classes

- `SplitPaneLayout` -- horizontal split with resize handle
- `h-full flex flex-col` -- full-height column layout
- `overflow-y-auto` -- scrollable form content
- `sticky bottom-0` -- fixed action bar
- `max-h-80` -- template list max height
- `space-y-*` -- vertical spacing throughout

No custom `@theme` animations are used. All animations are built-in Tailwind or framer-motion.

---

## 8. File Manifest -- Required Changes

### 8.1 Files to MOVE (from `src/blades/init-repo/` to `src/extensions/init-repo/`)

| Source | Destination |
|---|---|
| `src/blades/init-repo/InitRepoBlade.tsx` | `src/extensions/init-repo/InitRepoBlade.tsx` |
| `src/blades/init-repo/store.ts` | `src/extensions/init-repo/store.ts` |
| `src/blades/init-repo/components/InitRepoForm.tsx` | `src/extensions/init-repo/components/InitRepoForm.tsx` |
| `src/blades/init-repo/components/InitRepoPreview.tsx` | `src/extensions/init-repo/components/InitRepoPreview.tsx` |
| `src/blades/init-repo/components/TemplatePicker.tsx` | `src/extensions/init-repo/components/TemplatePicker.tsx` |
| `src/blades/init-repo/components/TemplateChips.tsx` | `src/extensions/init-repo/components/TemplateChips.tsx` |
| `src/blades/init-repo/components/CategoryFilter.tsx` | `src/extensions/init-repo/components/CategoryFilter.tsx` |
| `src/blades/init-repo/components/ProjectDetectionBanner.tsx` | `src/extensions/init-repo/components/ProjectDetectionBanner.tsx` |

### 8.2 Files to CREATE

| File | Purpose |
|---|---|
| `src/extensions/init-repo/index.ts` | Extension entry point: `onActivate()`, `onDeactivate()` |
| `src/extensions/init-repo/components/index.ts` | Component re-exports (optional, for consistency with worktrees pattern) |

### 8.3 Files to MODIFY

| File | Changes |
|---|---|
| `src/App.tsx` | Add `import { onActivate as initRepoActivate, onDeactivate as initRepoDeactivate } from "./extensions/init-repo"` and add `registerBuiltIn({ id: "init-repo", ... })` call |
| `src/blades/_discovery.ts` | Remove `"init-repo"` from `EXPECTED_TYPES` array |
| `src/components/WelcomeView.tsx` | Add fallback "Run git init" button when extension is disabled; check extension host status to distinguish "loading" vs "disabled" |

### 8.4 Files to DELETE

| File | Reason |
|---|---|
| `src/blades/init-repo/index.ts` | Replaced by extension entry point |
| `src/blades/init-repo/registration.ts` | Registration now handled in extension's `onActivate()` |
| `src/blades/init-repo/` directory | Entire directory empty after moves |

### 8.5 Files to KEEP UNCHANGED

| File | Reason |
|---|---|
| `src/stores/bladeTypes.ts` | `"init-repo"` type definition stays (still a core blade type via `coreOverride`) |
| `src/hooks/useGitignoreTemplates.ts` | Shared hooks, not moved |
| `src/lib/gitignoreComposer.ts` | Shared lib, not moved |
| `src/lib/gitignoreCategories.ts` | Shared lib, not moved |
| `src/components/welcome/GitInitBanner.tsx` | Stays in welcome components |
| `src/components/layout/SplitPaneLayout.tsx` | Shared component |

---

## 9. Import Path Updates After Move

All moved files need import path adjustments. The depth changes from `../../` (from `src/blades/init-repo/`) to `../../` (from `src/extensions/init-repo/`) -- they happen to be at the same depth, so most import paths remain identical.

However, sub-components in `src/extensions/init-repo/components/` currently use `../../../` to reach `src/` root. After the move they will still use `../../../` since the directory structure is parallel:

- Before: `src/blades/init-repo/components/X.tsx` -> `../../../bindings` = `src/bindings`
- After: `src/extensions/init-repo/components/X.tsx` -> `../../../bindings` = `src/bindings`

**No import path changes needed in moved component files.** The relative depths are identical.

The only import change is in `InitRepoBlade.tsx`:
- Before: `import { commands } from "../../bindings"` (from `src/blades/init-repo/`)
- After: `import { commands } from "../../bindings"` (from `src/extensions/init-repo/`)

**Same relative path.** Confirmed -- no import path updates required.

The store import changes:
- Before: `import { createBladeStore } from "../../stores/createBladeStore"`
- After: `import { createBladeStore } from "../../stores/createBladeStore"`

Also the same. Both `src/blades/` and `src/extensions/` are direct children of `src/`.

---

## 10. WelcomeView Fallback Design (INIT-04)

When the Init Repo extension is disabled, `WelcomeView` should show a minimal fallback. Here is the proposed approach:

```tsx
// In WelcomeView.tsx
const initRepoRegistration = useBladeRegistry((s) => s.blades.get("init-repo"));
const initRepoExt = useExtensionHost((s) => s.extensions.get("init-repo"));
const isInitRepoDisabled = initRepoExt?.status === "disabled" || initRepoExt?.status === "deactivated";

// When showInitRepo && pendingInitPath:
if (!initRepoRegistration) {
  if (isInitRepoDisabled) {
    // FALLBACK: Simple "Run git init" button
    return <MinimalGitInitFallback
      path={pendingInitPath}
      onCancel={() => setShowInitRepo(false)}
      onComplete={async (path) => { /* open repo */ }}
    />;
  }
  // Still loading -- show spinner
  return <div>Preparing repository setup...</div>;
}
```

The fallback component is a simple button that calls `commands.gitInit(path, "main")` directly -- no templates, no README, just bare `git init`.

---

## 11. Command Palette Registration (INIT-05)

The extension should register an "Initialize Repository" command. However, there is a UX question: this command is useful **before** a repo is open (from WelcomeView). Most command palette commands use `enabled: () => !!repoStatus` to hide themselves when no repo is open.

For Init Repo, the command should be visible when **no repo is open**:

```ts
api.registerCommand({
  id: "init-repo",
  title: "Initialize Repository",
  description: "Set up a new Git repository with .gitignore templates and README",
  category: "Repository",
  icon: FolderGit2,
  keywords: ["init", "initialize", "new", "repository", "git", "create"],
  action: async () => {
    // Open directory picker, then dispatch event or navigate
    const selected = await open({ directory: true, multiple: false, title: "Select directory" });
    if (selected && typeof selected === "string") {
      // Dispatch custom event that WelcomeView listens for
      document.dispatchEvent(new CustomEvent("init-repo:open", { detail: { path: selected } }));
    }
  },
  // No `enabled` guard -- available even without open repo
});
```

---

## 12. Extension Host Considerations

### 12.1 `registerBuiltIn()` Flow

1. Stores config in `builtInConfigs` Map
2. Creates synthetic manifest with `main: "(built-in)"`
3. Sets status to `"discovered"` with `builtIn: true`
4. Creates `new ExtensionAPI(id)`
5. Calls `activate(api)`
6. Sets status to `"active"`

### 12.2 Deactivation Persists

When a user disables a built-in extension:
1. `deactivateExtension(id)` calls `api.cleanup()` -> unregisters blade
2. Status set to `"disabled"`
3. Persisted to `tauri-plugin-store` under `disabledExtensions`
4. On next app launch, `registerBuiltIn()` re-registers, then checks `loadDisabledExtensions()` during `activateAll()`

**Wait** -- actually there is a subtlety. `registerBuiltIn()` always activates immediately. The `disabledExtensions` persistence is checked in `activateAll()` which is called for filesystem extensions after repo open. For built-in extensions, `registerBuiltIn()` bypasses this check and always activates.

Looking at `registerBuiltIn()` more carefully: it calls `activate(api)` unconditionally. The disabled state is only respected when re-activating via `activateExtension()` (which checks status).

**This means:** If a user disables a built-in extension and restarts the app, `registerBuiltIn()` will re-activate it. This is existing behavior for all built-in extensions, not specific to Init Repo. (It may be a bug to fix separately, or intentional.)

### 12.3 `deactivateAll()` Skips Built-ins

```ts
deactivateAll: async () => {
  for (const [id, ext] of extensions) {
    if (ext.status === "active" && !ext.builtIn) {
      await get().deactivateExtension(id);
    }
  }
}
```

Built-in extensions are **not** deactivated when repo closes. This is correct for Init Repo since it needs to be available in WelcomeView (no repo open).

---

## 13. Summary of Key Decisions

| Decision | Recommendation | Rationale |
|---|---|---|
| Blade type | Keep `"init-repo"` via `coreOverride: true` | WelcomeView already looks up `"init-repo"` in blade registry |
| Lazy loading | Yes, use `lazy()` wrapper | Matches content-viewers/conventional-commits pattern |
| Store location | Move to `src/extensions/init-repo/store.ts` | INIT-06 requirement |
| Import paths | No changes needed | Same directory depth (`src/extensions/` vs `src/blades/`) |
| Activation timing | `registerBuiltIn()` in `App.tsx` mount effect | Already activates before first render completes |
| Fallback | Check extension host status for disabled vs loading | Distinct UX for "extension disabled" vs "still loading" |
| Command palette | Register with no `enabled` guard | Available before repo open |
| Store cleanup | Use `api.onDispose()` to call `reset()` | Matches conventional-commits pattern |
