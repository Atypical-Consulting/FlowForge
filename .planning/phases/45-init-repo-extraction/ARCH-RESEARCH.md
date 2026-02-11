# Phase 45: Init Repo Extraction - Architecture Research

**Researched:** 2026-02-11
**Domain:** Extension extraction, blade registration, dual-context activation, WelcomeView integration, store migration
**Confidence:** HIGH

## Summary

Phase 45 extracts the Init Repo blade from a core blade registration (`src/blades/init-repo/`) into a toggleable built-in extension. Unlike previous extractions (Phases 38-44), Init Repo has a **unique dual-context requirement**: it must work both from WelcomeView (before any repository is open) AND from blade navigation (after repo open). This is architecturally significant because the extension system's `deactivateAll()` explicitly skips built-in extensions (`!ext.builtIn`), meaning built-in extensions survive repo close/open cycles -- exactly the behavior Init Repo needs.

The extraction involves:
1. Creating `src/extensions/init-repo/index.ts` with `onActivate`/`onDeactivate`
2. Moving the store from `src/blades/init-repo/store.ts` to the extension directory
3. Moving all Init Repo components to the extension directory
4. Removing the core blade registration (`src/blades/init-repo/registration.ts`)
5. Registering the blade via `api.registerBlade()` with `coreOverride: true` to preserve the `"init-repo"` blade type
6. Registering an Init Repo command in the command palette
7. Updating WelcomeView to display a fallback when the extension is disabled
8. Updating `_discovery.ts` to remove `"init-repo"` from EXPECTED_TYPES

**Primary recommendation:** Move the Init Repo store to the extension directory. Unlike worktrees (Phase 44) or gitflow (Phase 40), the Init Repo store has NO cross-slice dependencies -- it is a standalone `createBladeStore` with zero imports from GitOpsStore. All consumers are Init Repo components. The store is self-contained and should live with the extension.

---

## 1. Current Extension Architecture (Reference)

The FlowForge extension system is built on three pillars. See Phase 44 ARCH-RESEARCH for full details. Key recap:

**ExtensionHost** (`src/extensions/ExtensionHost.ts`):
- `registerBuiltIn(config)` -- Registers a bundled extension, creates synthetic manifest, activates immediately
- `activateExtension(id)` -- Creates `ExtensionAPI` instance, calls `activate(api)`
- `deactivateExtension(id)` -- Calls `onDeactivate()`, then `api.cleanup()`
- **Critical:** `deactivateAll()` at line 323 explicitly skips built-in extensions: `if (ext.status === "active" && !ext.builtIn)`. Built-in extensions remain active across repo close/open cycles.

**ExtensionAPI** (`src/extensions/ExtensionAPI.ts`):
- `registerBlade(config)` -- With `coreOverride: true`, blade type is registered as-is (no `ext:{id}:` prefix)
- `registerCommand(config)` -- Auto-namespaced to `ext:{id}:{cmd.id}`
- `cleanup()` -- Atomic removal of all registrations

**BladeRegistry** (`src/lib/bladeRegistry.ts`):
- Zustand store with `Map<string, BladeRegistration>`
- `register(config)` / `unregister(type)` / `unregisterBySource(source)`
- WelcomeView reads via `useBladeRegistry((s) => s.blades.get("init-repo"))`

### Current Built-In Extensions

| Extension | ID | Phase | UI Contributions |
|-----------|-----|-------|------------------|
| Content Viewers | `content-viewers` | 38 | 3 blade types (coreOverride) |
| Conventional Commits | `conventional-commits` | 39 | 2 blades (coreOverride), 1 toolbar, 2 commands |
| Gitflow | `gitflow` | 40 | 1 blade (coreOverride), 1 sidebar panel, 1 toolbar, 1 command |
| Worktrees | `worktrees` | 44 | 1 sidebar panel, 2 commands |
| GitHub | `github` | 34-36 | 7 blades, 5 commands, 4 toolbar, store subscriptions |

---

## 2. Current Init Repo Architecture

### File Inventory

```
src/blades/init-repo/
  index.ts                           -- Barrel export (1 line)
  registration.ts                    -- Core registerBlade() call (9 lines)
  store.ts                           -- Zustand store via createBladeStore (130 lines)
  InitRepoBlade.tsx                  -- Main blade component (82 lines)
  components/
    InitRepoForm.tsx                 -- Form with all init options (351 lines)
    InitRepoPreview.tsx              -- Live preview panel (274 lines)
    ProjectDetectionBanner.tsx       -- Auto-detected project type UI (53 lines)
    TemplateChips.tsx                -- Selected template chips (47 lines)
    TemplatePicker.tsx               -- Template browse/search UI (210 lines)
    CategoryFilter.tsx               -- Template category tabs (56 lines)
```

**Total:** 10 files, ~1,213 lines

### Registration (Current)

`src/blades/init-repo/registration.ts` (line 4-9):
```typescript
registerBlade<{ directoryPath: string }>({
  type: "init-repo",
  defaultTitle: "Initialize Repository",
  component: InitRepoBlade,
  singleton: true,
});
```

This is imported eagerly via `src/blades/_discovery.ts` (line 4):
```typescript
const modules = import.meta.glob(
  ["./*/registration.{ts,tsx}", "!./_shared/**"],
  { eager: true }
);
```

`_discovery.ts` also lists `"init-repo"` in EXPECTED_TYPES (line 20).

### Store Design

`src/blades/init-repo/store.ts` uses `createBladeStore` (from `src/stores/createBladeStore.ts`):

```typescript
export const useInitRepoStore = createBladeStore<InitRepoState>(
  "init-repo",
  (set) => ({ ... })
);
```

`createBladeStore` wraps `create()` + `devtools()` and registers the store for reset via `registerStoreForReset`. The store holds:

**State:** `directoryPath`, `defaultBranch`, `detectedTypes`, `selectedTemplates`, `templateContents`, `readmeEnabled`, `readmeName`, `readmeDescription`, `commitEnabled`, `commitMessage`, `activeSection`, `isInitializing`, `initError`

**Actions:** Setters for each field + `reset()` method

**Dependencies:** Zero cross-store calls. The store is completely self-contained. `InitRepoForm` calls `useRepositoryStore` and `useBladeNavigation` directly (not through the Init Repo store).

### WelcomeView Integration (INFRA-05 Pattern)

`src/components/WelcomeView.tsx` (lines 25, 119-151) uses BladeRegistry lookup:

```typescript
// Line 25: Read blade registration from registry
const initRepoRegistration = useBladeRegistry((s) => s.blades.get("init-repo"));

// Lines 119-151: Render the blade when user clicks "Set Up Repository"
if (showInitRepo && pendingInitPath) {
  if (!initRepoRegistration) {
    // Defensive fallback: blade not yet registered
    return <div>Preparing repository setup...</div>;
  }
  const InitComponent = initRepoRegistration.component;
  return (
    <Suspense fallback={...}>
      <InitComponent
        directoryPath={pendingInitPath}
        onCancel={() => setShowInitRepo(false)}
        onComplete={async (path) => { ... }}
      />
    </Suspense>
  );
}
```

The WelcomeView also shows a `GitInitBanner` (lines 255-261) when the user opens a folder that is NOT a git repo. This banner has a "Set Up Repository" button that triggers `setShowInitRepo(true)`.

### BladePropsMap Entry

`src/stores/bladeTypes.ts` (line 29):
```typescript
"init-repo": { directoryPath: string };
```

This type remains valid since we use `coreOverride: true`.

### Dependency Graph

Files that import from `src/blades/init-repo/`:

| Consumer | Imports |
|----------|---------|
| `src/blades/init-repo/registration.ts` | `InitRepoBlade` |
| `src/blades/init-repo/InitRepoBlade.tsx` | `useInitRepoStore`, `InitRepoForm`, `InitRepoPreview` |
| `src/blades/init-repo/components/InitRepoForm.tsx` | `useInitRepoStore` |
| `src/blades/init-repo/components/InitRepoPreview.tsx` | `useInitRepoStore` |
| `src/blades/init-repo/components/TemplateChips.tsx` | `useInitRepoStore` |
| `src/blades/init-repo/components/CategoryFilter.tsx` | `useInitRepoStore` |
| `src/blades/init-repo/components/TemplatePicker.tsx` | `useInitRepoStore` |
| `src/blades/init-repo/components/ProjectDetectionBanner.tsx` | `useInitRepoStore` |

**External consumers of Init Repo:** NONE. No file outside `src/blades/init-repo/` imports from Init Repo. The WelcomeView accesses it only through the BladeRegistry lookup (`useBladeRegistry((s) => s.blades.get("init-repo"))`).

### External Dependencies Used by Init Repo Components

| Dependency | Consumer File(s) |
|-----------|-----------------|
| `commands` (Tauri bindings) | `InitRepoBlade.tsx`, `InitRepoForm.tsx` |
| `useProjectDetection` (hook) | `InitRepoBlade.tsx` |
| `useGitignoreTemplateList` (hook) | `TemplatePicker.tsx` |
| `composeGitignore` (lib) | `InitRepoForm.tsx`, `InitRepoPreview.tsx` |
| `getCategoryForTemplate` (lib) | `TemplatePicker.tsx` |
| `GITIGNORE_CATEGORIES` (lib) | `CategoryFilter.tsx` |
| `getErrorMessage` (lib) | `InitRepoForm.tsx` |
| `useGitOpsStore` (store) | `InitRepoForm.tsx` (for `openRepository`) |
| `useRecentRepos` (hook) | `InitRepoForm.tsx` |
| `useBladeNavigation` (hook) | `InitRepoForm.tsx` |
| `SplitPaneLayout` (component) | `InitRepoBlade.tsx` |
| `Button` (UI component) | `InitRepoForm.tsx` |

All of these are shared core utilities/components. They remain in core after extraction.

---

## 3. Dual-Context Activation Analysis

### The Unique Challenge

Init Repo must work in two distinct contexts:

1. **WelcomeView context (pre-repo):** The user opens a folder that is NOT a git repo. WelcomeView shows a "This folder is not a Git repository" banner with a "Set Up Repository" button. Clicking it renders the Init Repo blade within WelcomeView (not in the blade stack).

2. **Blade navigation context (post-repo):** The Init Repo blade could be navigated to via blade stack (though currently not used this way from any core code -- only the command palette would invoke it).

### Why Built-In Extensions Solve This

The key architectural insight: `deactivateAll()` (ExtensionHost.ts:323-330) explicitly skips built-in extensions:

```typescript
deactivateAll: async () => {
  const extensions = get().extensions;
  for (const [id, ext] of extensions) {
    if (ext.status === "active" && !ext.builtIn) {
      await get().deactivateExtension(id);
    }
  }
},
```

Built-in extensions are registered in App.tsx's first `useEffect` (lines 63-103), which runs once on mount and is NOT gated by `status` (repo open). The second `useEffect` (lines 106-121) handles repo open/close but only calls `deactivateAll()` which skips built-ins.

**Result:** The Init Repo built-in extension is activated at app startup and stays active regardless of whether a repo is open. Its blade registration persists in the BladeRegistry across the entire app lifecycle.

### Registration Timing

```
App mounts
  -> First useEffect fires (line 50-103)
  -> registerBuiltIn({ id: "init-repo", ... }) called
  -> ExtensionHost.registerBuiltIn() creates ExtensionAPI
  -> activate(api) called
  -> api.registerBlade({ type: "init-repo", coreOverride: true, ... })
  -> BladeRegistry now has "init-repo" entry
  -> WelcomeView renders
  -> useBladeRegistry((s) => s.blades.get("init-repo")) returns the registration
  -> User can now click "Set Up Repository" to render InitRepoBlade
```

This timing is identical to the current flow where `registration.ts` is eagerly imported via `_discovery.ts`. The blade is registered before WelcomeView renders.

### Important: useEffect vs Eager Import Timing

Currently, `_discovery.ts` is imported at the top of `App.tsx` (line 7: `import "./blades/_discovery"`). This runs synchronously during module evaluation, BEFORE any React rendering. The `registerBuiltIn()` call happens inside `useEffect`, which runs AFTER the first render.

**Potential race condition?** WelcomeView's first render might see `initRepoRegistration` as `undefined` if the useEffect hasn't fired yet. However, WelcomeView already handles this (line 120-127):

```typescript
if (!initRepoRegistration) {
  return <div>Preparing repository setup...</div>;
}
```

And more importantly, `registerBuiltIn` is async and triggers a Zustand state update when the blade is registered. This causes WelcomeView to re-render with the registration available. Since the user cannot click "Set Up Repository" before the UI fully renders (framer-motion animations take ~300ms), the registration will be available before any user interaction.

**Verdict:** No timing issue. The existing defensive fallback in WelcomeView handles the async gap.

---

## 4. Blade Registration with coreOverride

### Pattern

The Init Repo extension MUST use `coreOverride: true` to preserve the `"init-repo"` blade type:

```typescript
api.registerBlade({
  type: "init-repo",
  title: "Initialize Repository",
  component: InitRepoBlade,
  singleton: true,
  coreOverride: true,  // <-- Preserves "init-repo" type (no ext: prefix)
});
```

Without `coreOverride`, the type would become `"ext:init-repo:init-repo"`, breaking WelcomeView's lookup (`s.blades.get("init-repo")`).

### Precedent

All previous blade extractions use `coreOverride: true`:
- Content Viewers (Phase 38): `viewer-markdown`, `viewer-code`, `viewer-3d`
- Conventional Commits (Phase 39): `conventional-commit`, `changelog`
- Gitflow (Phase 40): `gitflow-cheatsheet`

### BladePropsMap Compatibility

The `BladePropsMap` entry for `"init-repo"` stays unchanged in `src/stores/bladeTypes.ts`. The type system continues to work because `coreOverride` preserves the exact type string.

---

## 5. Store Migration Decision

### ADR: Move Store to Extension Directory

**Decision:** Move `src/blades/init-repo/store.ts` to `src/extensions/init-repo/store.ts`.

**Rationale:**

1. **Zero cross-store dependencies.** Unlike worktrees (`switchToWorktree` calls `openRepository()`) or gitflow (calls `loadBranches()`, `refreshRepoStatus()`), the Init Repo store has NO cross-store calls. It is entirely self-contained.

2. **All consumers are Init Repo components.** Every file that imports `useInitRepoStore` is an Init Repo component that will move to the extension directory:
   - `InitRepoBlade.tsx`
   - `InitRepoForm.tsx`
   - `InitRepoPreview.tsx`
   - `TemplateChips.tsx`
   - `CategoryFilter.tsx`
   - `TemplatePicker.tsx`
   - `ProjectDetectionBanner.tsx`

3. **No external consumers.** No file outside `src/blades/init-repo/` imports `useInitRepoStore`. The WelcomeView accesses Init Repo only through the BladeRegistry component reference.

4. **`createBladeStore` still works.** `createBladeStore` is a utility from `src/stores/createBladeStore.ts` -- it's not tied to the `src/blades/` directory. Importing it from `src/extensions/init-repo/store.ts` works identically.

5. **Extension isolation.** When the extension is disabled, the store module is still imported (it's bundled at build time), but no component renders using it, so it remains inert.

6. **Phase precedent: Conventional Commits.** The `ChangelogBlade` has its own store at `src/extensions/conventional-commits/blades/changelog/store.ts`. Extension-owned stores are an established pattern.

**Counter-argument:** Keeping the store at `src/blades/init-repo/store.ts` would reduce file moves. However, this leaves a partial Init Repo presence in the core `blades/` directory, which contradicts the extraction goal. The requirement INIT-06 explicitly states "Init Repo blade store moves to extension directory."

---

## 6. WelcomeView Fallback Design (INIT-04)

### Current Behavior

When WelcomeView detects a non-git folder, it shows a `GitInitBanner` with a "Set Up Repository" button. Clicking it renders the `InitRepoBlade` via BladeRegistry lookup.

### Fallback When Extension is Disabled

When the Init Repo extension is disabled:
- `useBladeRegistry((s) => s.blades.get("init-repo"))` returns `undefined`
- The `GitInitBanner` should still appear (non-git folder detection is core logic)
- But clicking "Set Up Repository" should show a simpler fallback

**Recommended fallback behavior:**

```
1. GitInitBanner still shows (unchanged)
2. When user clicks "Set Up Repository":
   a. If initRepoRegistration exists -> render InitRepoBlade (current behavior)
   b. If initRepoRegistration is undefined -> render a simple "Run git init" button
```

**Fallback UI design:**

```tsx
// When extension is disabled and user clicks "Set Up Repository":
<div className="h-[calc(100vh-3.5rem)] bg-ctp-base flex flex-col items-center justify-center gap-4">
  <FolderGit2 className="w-12 h-12 text-ctp-subtext0" />
  <h3 className="text-lg font-medium text-ctp-text">Initialize Repository</h3>
  <p className="text-sm text-ctp-subtext0 text-center max-w-md">
    The Init Repository extension is disabled. You can run a basic git init or enable
    the extension for full setup options.
  </p>
  <Button onClick={() => runBasicGitInit(pendingInitPath)} className="gap-2">
    <Terminal className="w-4 h-4" />
    Run git init
  </Button>
  <Button variant="ghost" onClick={() => setShowInitRepo(false)}>
    Cancel
  </Button>
</div>
```

The `runBasicGitInit` function calls `commands.gitInit(path, "main")` followed by `openRepository(path)`.

### Alternative: Inline Fallback in GitInitBanner

Instead of two modes for the "Set Up Repository" button, the `GitInitBanner` itself could detect the extension status and show different buttons:

- Extension enabled: "Set Up Repository" (opens full Init Repo blade)
- Extension disabled: "Run git init" (runs basic init inline)

This is simpler but changes the banner's responsibility. The recommended approach is to keep the banner unchanged and handle the fallback in WelcomeView's render logic.

### Implementation Location

The fallback logic goes entirely in `src/components/WelcomeView.tsx`. No changes to `GitInitBanner.tsx`.

---

## 7. Command Palette Registration (INIT-05)

### Command Design

The Init Repo extension should register a command in the command palette:

```typescript
api.registerCommand({
  id: "init-repository",
  title: "Initialize Repository",
  description: "Set up a new git repository with .gitignore, README, and initial commit",
  category: "Repository",
  icon: FolderGit2,
  keywords: ["init", "git", "new", "create", "repository", "setup"],
  action: () => {
    // Navigate to init-repo blade (requires a directory path)
    // This command may need to open a folder picker first
    openInitRepoFlow();
  },
  // Only enabled when NO repository is currently open
  enabled: () => !useGitOpsStore.getState().repoStatus,
});
```

### Directory Selection Flow

The Init Repo blade requires a `directoryPath` prop. When triggered from the command palette, the extension needs to:

1. Open a folder picker dialog (`open()` from `@tauri-apps/plugin-dialog`)
2. Check if the selected folder is already a git repo
3. If not a git repo, render the Init Repo blade with that path

This flow already exists in WelcomeView's `openDialog` callback. The command palette action should replicate this logic:

```typescript
async function openInitRepoFlow() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Folder to Initialize",
  });
  if (selected && typeof selected === "string") {
    const isRepo = await commands.isGitRepository(selected);
    if (isRepo.status === "ok" && !isRepo.data) {
      openBlade("init-repo", { directoryPath: selected });
    }
  }
}
```

### Visibility Consideration

The Init Repo command should ideally appear when no repo is open (WelcomeView context). However, the command palette might also be accessible when a repo IS open. The `enabled` predicate should consider this:

- **Option A:** Only enabled when no repo is open (`!repoStatus`). This prevents confusion about "initializing" when already in a repo.
- **Option B:** Always enabled. User can init a different folder while a repo is open.

**Recommendation:** Option A for initial implementation. The command's primary use case is from WelcomeView. Users who want to init a different folder can use the WelcomeView flow.

---

## 8. Extension Directory Structure

### Proposed Structure

```
src/extensions/init-repo/
  index.ts                                  -- onActivate/onDeactivate entry point
  store.ts                                  -- useInitRepoStore (moved from blades/)
  components/
    InitRepoBlade.tsx                       -- Main blade (moved)
    InitRepoForm.tsx                        -- Form panel (moved)
    InitRepoPreview.tsx                     -- Preview panel (moved)
    ProjectDetectionBanner.tsx              -- Detection UI (moved)
    TemplateChips.tsx                       -- Selected chips (moved)
    TemplatePicker.tsx                      -- Browser/search (moved)
    CategoryFilter.tsx                      -- Category tabs (moved)
    index.ts                               -- Barrel export
```

### Comparison with Existing Extensions

| Extension | Structure | Components | Store |
|-----------|-----------|------------|-------|
| Content Viewers | `index.ts` + `blades/` | 3 lazy blade components | None |
| Conventional Commits | `index.ts` + `blades/` + `components/` | 2 blade dirs + components | `blades/changelog/store.ts` |
| Gitflow | `index.ts` + `blades/` + `components/` | 1 blade + 6 components | None (slice in GitOpsStore) |
| Worktrees | `index.ts` + `components/` | 5 components | None (slice in GitOpsStore) |
| GitHub | `index.ts` + `blades/` + `components/` + `hooks/` | 7 blades + 10 components | `githubStore.ts` |
| **Init Repo** | **`index.ts` + `store.ts` + `components/`** | **7 components** | **`store.ts`** |

Init Repo follows the GitHub pattern of having a store file at the extension root level.

---

## 9. Extension Entry Point Design

### onActivate Implementation

```typescript
// src/extensions/init-repo/index.ts
import { FolderGit2 } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { InitRepoBlade } from "./components";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Register Init Repo blade with coreOverride to preserve "init-repo" type
  api.registerBlade({
    type: "init-repo",
    title: "Initialize Repository",
    component: InitRepoBlade,
    singleton: true,
    coreOverride: true,
  });

  // Register "Initialize Repository" command in palette
  api.registerCommand({
    id: "init-repository",
    title: "Initialize Repository",
    description: "Set up a new git repository with .gitignore, README, and initial commit",
    category: "Repository",
    icon: FolderGit2,
    keywords: ["init", "git", "new", "create", "repository", "setup"],
    action: async () => {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { commands } = await import("../../bindings");
      const { openBlade } = await import("../../lib/bladeOpener");

      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Folder to Initialize",
      });
      if (selected && typeof selected === "string") {
        const isRepo = await commands.isGitRepository(selected);
        if (isRepo.status === "ok" && !isRepo.data) {
          openBlade("init-repo", { directoryPath: selected });
        }
      }
    },
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
```

### Key Design Decisions

1. **No lazy import for InitRepoBlade:** Unlike content viewers or gitflow which lazy-load blade components, Init Repo is imported directly. The component is used from WelcomeView where React.lazy would require a Suspense boundary that WelcomeView already provides (line 133-148).

2. **Lazy imports in command action:** The command palette action lazy-imports `@tauri-apps/plugin-dialog`, `commands`, and `openBlade` to avoid pulling in the dialog SDK at extension load time. Since the command is rarely used, this is a good optimization.

3. **No sidebar panel contribution:** Init Repo has no sidebar presence. It is a blade-only + command-only extension.

4. **No toolbar contribution:** Init Repo does not appear in the toolbar. It is triggered from WelcomeView or the command palette.

---

## 10. Lifecycle Management

### Activation Flow

```
App.tsx mounts
  -> First useEffect fires
  -> registerBuiltIn({ id: "init-repo", name: "Init Repository", ... })
  -> ExtensionHost creates ExtensionAPI("init-repo")
  -> onActivate(api) called:
       api.registerBlade({ type: "init-repo", coreOverride: true, ... })
       api.registerCommand({ id: "init-repository", ... })
  -> BladeRegistry has "init-repo" entry
  -> CommandRegistry has "ext:init-repo:init-repository" entry
  -> WelcomeView renders with initRepoRegistration available
```

### Deactivation Flow (User Disables Extension)

```
ExtensionHost.deactivateExtension("init-repo")
  -> onDeactivate() called (no custom cleanup)
  -> api.cleanup():
       bladeRegistry.unregister("init-repo")
       commandRegistry.unregister("ext:init-repo:init-repository")
  -> BladeRegistry no longer has "init-repo"
  -> WelcomeView re-renders: initRepoRegistration is now undefined
  -> "Set Up Repository" button now shows fallback
  -> Command palette no longer shows "Initialize Repository"
```

### App Close/Open Cycle

Built-in extensions persist their disabled state via `persistDisabledExtensions()` (ExtensionHost.ts:52-63). If the user disables Init Repo, the disabled state is persisted to `tauri-plugin-store` under `"disabledExtensions"`.

On next app launch:
1. `registerBuiltIn()` is called, activating the extension immediately
2. BUT the second useEffect calls `activateAll()` which checks `loadDisabledExtensions()`
3. Wait -- `registerBuiltIn()` activates the extension BEFORE `activateAll()` runs

**Potential issue:** `registerBuiltIn()` always activates immediately (lines 336-401), regardless of persisted disabled state. If the user disabled Init Repo and restarts the app, it will be re-activated.

**Investigation:** Looking at the `activateExtension` flow (lines 186-208), a built-in extension with status "active" will NOT be re-activated (the guard at line 188 checks for "discovered", "disabled", or "deactivated" status). So the question is: does `registerBuiltIn` check persisted disabled state?

**Answer: No.** `registerBuiltIn()` does NOT check `loadDisabledExtensions()`. It always registers and activates. The `activateAll()` function handles disabled state, but it only operates on extensions with status "discovered" (line 312). Built-in extensions registered via `registerBuiltIn()` go directly to "active" status, bypassing the disabled check.

**This is a pre-existing architectural limitation** that affects ALL built-in extensions, not just Init Repo. If a user disables a built-in extension and restarts the app, it will be re-activated. This is acceptable for Phase 45 -- fixing it is a separate infrastructure concern.

### Re-enable Flow

```
ExtensionHost.activateExtension("init-repo")
  -> builtInConfigs.get("init-repo") returns stored config
  -> New ExtensionAPI("init-repo") instance created
  -> config.activate(api) called
  -> All registrations recreated
  -> BladeRegistry has "init-repo" again
  -> WelcomeView re-renders with full Init Repo blade available
```

---

## 11. File Change Summary

### Files to CREATE

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `src/extensions/init-repo/index.ts` | ~45 | Extension entry point |
| `src/extensions/init-repo/components/index.ts` | ~5 | Barrel export |

### Files to MOVE

| From | To |
|------|----|
| `src/blades/init-repo/store.ts` | `src/extensions/init-repo/store.ts` |
| `src/blades/init-repo/InitRepoBlade.tsx` | `src/extensions/init-repo/components/InitRepoBlade.tsx` |
| `src/blades/init-repo/components/InitRepoForm.tsx` | `src/extensions/init-repo/components/InitRepoForm.tsx` |
| `src/blades/init-repo/components/InitRepoPreview.tsx` | `src/extensions/init-repo/components/InitRepoPreview.tsx` |
| `src/blades/init-repo/components/ProjectDetectionBanner.tsx` | `src/extensions/init-repo/components/ProjectDetectionBanner.tsx` |
| `src/blades/init-repo/components/TemplateChips.tsx` | `src/extensions/init-repo/components/TemplateChips.tsx` |
| `src/blades/init-repo/components/TemplatePicker.tsx` | `src/extensions/init-repo/components/TemplatePicker.tsx` |
| `src/blades/init-repo/components/CategoryFilter.tsx` | `src/extensions/init-repo/components/CategoryFilter.tsx` |

### Files to MODIFY

| File | Change |
|------|--------|
| `src/components/WelcomeView.tsx` | Add fallback UI when Init Repo extension is disabled |
| `src/App.tsx` | Add `registerBuiltIn` call for "init-repo" extension |
| `src/blades/_discovery.ts` | Remove `"init-repo"` from EXPECTED_TYPES |
| `src/extensions/init-repo/store.ts` | Update import path for `createBladeStore` |
| `src/extensions/init-repo/components/InitRepoBlade.tsx` | Update import paths |
| `src/extensions/init-repo/components/InitRepoForm.tsx` | Update import paths |
| `src/extensions/init-repo/components/InitRepoPreview.tsx` | Update import paths |
| `src/extensions/init-repo/components/TemplatePicker.tsx` | Update import paths |
| `src/extensions/init-repo/components/CategoryFilter.tsx` | Update import paths |
| `src/extensions/init-repo/components/ProjectDetectionBanner.tsx` | Update import paths |
| `src/extensions/init-repo/components/TemplateChips.tsx` | Update import paths |

### Files to DELETE

| File | Reason |
|------|--------|
| `src/blades/init-repo/registration.ts` | Replaced by extension blade registration |
| `src/blades/init-repo/index.ts` | Old barrel export |
| `src/blades/init-repo/store.ts` | Moved to extension directory |
| `src/blades/init-repo/InitRepoBlade.tsx` | Moved to extension directory |
| `src/blades/init-repo/components/InitRepoForm.tsx` | Moved to extension directory |
| `src/blades/init-repo/components/InitRepoPreview.tsx` | Moved to extension directory |
| `src/blades/init-repo/components/ProjectDetectionBanner.tsx` | Moved to extension directory |
| `src/blades/init-repo/components/TemplateChips.tsx` | Moved to extension directory |
| `src/blades/init-repo/components/TemplatePicker.tsx` | Moved to extension directory |
| `src/blades/init-repo/components/CategoryFilter.tsx` | Moved to extension directory |

The entire `src/blades/init-repo/` directory should be removed after extraction.

### Files that STAY UNCHANGED

| File | Why |
|------|-----|
| `src/stores/bladeTypes.ts` | `"init-repo"` entry preserved by `coreOverride` |
| `src/stores/createBladeStore.ts` | Utility -- location independent |
| `src/hooks/useGitignoreTemplates.ts` | Shared hook -- no Init Repo coupling |
| `src/lib/gitignoreComposer.ts` | Shared utility |
| `src/lib/gitignoreCategories.ts` | Shared utility |
| `src/components/welcome/GitInitBanner.tsx` | Core UI -- unaffected by extraction |
| `src/components/layout/SplitPaneLayout.tsx` | Shared component |

---

## 12. Import Path Changes

When files move from `src/blades/init-repo/` to `src/extensions/init-repo/`, relative import paths change.

### Store File (`store.ts`)

| Old Import | New Import |
|-----------|-----------|
| `../../stores/createBladeStore` | `../../stores/createBladeStore` |

**Same!** `src/extensions/init-repo/` and `src/blades/init-repo/` are at the same depth relative to `src/`. So the store import path is unchanged.

### InitRepoBlade.tsx (moves to `components/InitRepoBlade.tsx`)

| Old Import | New Import |
|-----------|-----------|
| `../../bindings` | `../../../bindings` |
| `../../hooks/useGitignoreTemplates` | `../../../hooks/useGitignoreTemplates` |
| `./store` | `../store` |
| `../../components/layout/SplitPaneLayout` | `../../../components/layout/SplitPaneLayout` |
| `./components/InitRepoForm` | `./InitRepoForm` |
| `./components/InitRepoPreview` | `./InitRepoPreview` |

### Components (move from `src/blades/init-repo/components/` to `src/extensions/init-repo/components/`)

| Old Import | New Import |
|-----------|-----------|
| `../store` | `../store` |
| `../../../bindings` | `../../../bindings` |
| `../../../lib/errors` | `../../../lib/errors` |
| `../../../lib/gitignoreComposer` | `../../../lib/gitignoreComposer` |
| `../../../stores/domain/git-ops` | `../../../stores/domain/git-ops` |
| `../../../hooks/useRecentRepos` | `../../../hooks/useRecentRepos` |
| `../../../hooks/useBladeNavigation` | `../../../hooks/useBladeNavigation` |
| `../../../components/ui/button` | `../../../components/ui/button` |
| `../../../hooks/useGitignoreTemplates` | `../../../hooks/useGitignoreTemplates` |
| `../../../lib/gitignoreCategories` | `../../../lib/gitignoreCategories` |

**Same depth!** Since `src/extensions/init-repo/components/` is at the same depth as `src/blades/init-repo/components/`, all `../../../` imports remain unchanged. Only the store import and blade-level imports need path updates.

---

## 13. Risks and Mitigations

### Risk 1: useEffect Timing for Blade Registration (MEDIUM)

**What goes wrong:** `registerBuiltIn()` is called inside a `useEffect` hook in App.tsx. The blade registration happens after the first render. If WelcomeView renders before the useEffect fires, `initRepoRegistration` will be `undefined`.

**Mitigation:** WelcomeView already handles this case (line 120-127):
```typescript
if (!initRepoRegistration) {
  return <div>Preparing repository setup...</div>;
}
```

This defensive fallback was added as part of Phase 43 INFRA-05. The brief "Preparing repository setup..." flash (if visible at all) is acceptable. In practice, the useEffect fires before the user can interact with the UI.

**Confidence:** HIGH -- defensive fallback already exists and has been tested.

### Risk 2: Store Reset on Extension Disable (LOW)

**What goes wrong:** When the Init Repo extension is disabled, the store (`useInitRepoStore`) remains in memory with its last state. On re-enable, stale state might confuse the UI.

**Mitigation:** The `InitRepoBlade` component calls `reset()` in its `useEffect` cleanup (line 41-43):
```typescript
return () => {
  reset();
};
```

This resets the store when the blade unmounts. Additionally, the store is re-hydrated via `setDirectoryPath(directoryPath)` on every mount (line 33). Stale state is harmless -- the store will be reset and re-hydrated on next use.

For extra safety, the extension can add `api.onDispose(() => useInitRepoStore.getState().reset())` to reset the store when the extension is disabled. This follows the Conventional Commits pattern (Phase 39).

**Confidence:** HIGH -- existing cleanup pattern handles this.

### Risk 3: createBladeStore Registration (LOW)

**What goes wrong:** `createBladeStore` calls `registerStoreForReset(store)`, which adds the store to a global reset set. When the extension is disabled, the store remains registered for global reset but has no active consumers.

**Mitigation:** This is harmless. The store reset function simply calls `store.setState(store.getInitialState(), true)`, which is a no-op if no component subscribes to the store. The store stays in the reset set across the entire app lifecycle, which is the same behavior as before extraction.

**Confidence:** HIGH -- no behavioral change.

### Risk 4: Import Path Errors in Moved Files (MEDIUM)

**What goes wrong:** Relative import paths might be incorrectly updated when moving files.

**Mitigation:** TypeScript's `--noEmit` compilation will catch any broken imports immediately. The path analysis in Section 12 shows that most imports remain unchanged due to matching directory depth.

**Confidence:** HIGH -- TypeScript enforces correctness.

### Risk 5: _discovery.ts EXPECTED_TYPES Warning (LOW)

**What goes wrong:** If `"init-repo"` is not removed from `EXPECTED_TYPES` in `_discovery.ts`, a dev-mode warning will fire because the core blade registration no longer exists.

**Mitigation:** Remove `"init-repo"` from the EXPECTED_TYPES array in `_discovery.ts` (line 20). The blade is now registered by the extension, not by a `registration.ts` file.

**Confidence:** HIGH -- simple removal.

---

## 14. Graceful Degradation

### When Init Repo Extension is Disabled

| UI Surface | Expected Behavior | Mechanism |
|-----------|-------------------|-----------|
| WelcomeView "Set Up Repository" | Shows fallback "Run git init" button | `initRepoRegistration` is `undefined` |
| BladeRegistry | `"init-repo"` type not available | `api.cleanup()` unregisters blade |
| Command palette | "Initialize Repository" command disappears | `api.cleanup()` unregisters command |
| Store data | Remains in memory, inert | No component renders it |
| Core features | All fully functional | No dependency on Init Repo |

### When Extension is Re-enabled

| Behavior | Detail |
|----------|--------|
| Blade reappears in registry | `registerBlade()` re-registers; WelcomeView re-renders |
| Command reappears | `registerCommand()` re-registers |
| WelcomeView restored | Full Init Repo blade available again |
| No page reload needed | Zustand subscriptions drive re-renders |

---

## 15. Implementation Sequence

### Step 1: Create Extension Structure

1. Create `src/extensions/init-repo/index.ts` with `onActivate`/`onDeactivate`
2. Create `src/extensions/init-repo/components/index.ts` barrel export

### Step 2: Move Store

1. Move `src/blades/init-repo/store.ts` to `src/extensions/init-repo/store.ts`
2. Update import path for `createBladeStore` (no change needed due to matching depth)

### Step 3: Move Components

1. Move all 7 component files from `src/blades/init-repo/` to `src/extensions/init-repo/components/`
2. Update import paths in moved files (see Section 12)

### Step 4: Remove Core Registration

1. Delete `src/blades/init-repo/registration.ts`
2. Delete `src/blades/init-repo/index.ts`
3. Remove `"init-repo"` from EXPECTED_TYPES in `src/blades/_discovery.ts`
4. Delete the entire `src/blades/init-repo/` directory

### Step 5: Register in App.tsx

1. Add import: `import { onActivate as initRepoActivate, onDeactivate as initRepoDeactivate } from "./extensions/init-repo"`
2. Add `registerBuiltIn` call for "init-repo" extension

### Step 6: Update WelcomeView Fallback

1. Update WelcomeView to show fallback "Run git init" button when `initRepoRegistration` is undefined AND user clicks "Set Up Repository"

### Step 7: Verify

1. Extension active: Init Repo blade renders from WelcomeView, full setup flow works
2. Extension disabled: WelcomeView shows fallback, basic git init works
3. Extension re-enabled: Full blade available again
4. Command palette: "Initialize Repository" appears/disappears with extension state
5. TypeScript: `npx tsc --noEmit` passes (ignore pre-existing TS2440)
6. No Init Repo files in `src/blades/init-repo/`: directory should be empty/deleted

---

## Sources

### Primary (HIGH confidence) -- Codebase Analysis

- `src/extensions/ExtensionHost.ts` (407 lines) -- Full lifecycle, `registerBuiltIn()`, `deactivateAll()` skip built-in
- `src/extensions/ExtensionAPI.ts` (451 lines) -- `registerBlade()` with `coreOverride`, `registerCommand()`, `cleanup()`
- `src/extensions/extensionTypes.ts` (32 lines) -- `BuiltInExtensionConfig`, `ExtensionInfo`
- `src/lib/bladeRegistry.ts` (137 lines) -- `useBladeRegistry` Zustand store, register/unregister
- `src/lib/commandRegistry.ts` (178 lines) -- Command registry with source tracking
- `src/components/WelcomeView.tsx` (270 lines) -- BladeRegistry lookup, GitInitBanner, Suspense boundary
- `src/components/welcome/GitInitBanner.tsx` (49 lines) -- Non-git folder banner
- `src/blades/init-repo/registration.ts` (9 lines) -- Current core blade registration
- `src/blades/init-repo/store.ts` (130 lines) -- Self-contained Zustand store
- `src/blades/init-repo/InitRepoBlade.tsx` (82 lines) -- Main blade component
- `src/blades/init-repo/components/InitRepoForm.tsx` (351 lines) -- Form with external deps
- `src/blades/init-repo/components/InitRepoPreview.tsx` (274 lines) -- Preview panel
- `src/blades/_discovery.ts` (38 lines) -- Eager imports, EXPECTED_TYPES
- `src/stores/createBladeStore.ts` (14 lines) -- Store factory, registerStoreForReset
- `src/stores/bladeTypes.ts` (60 lines) -- BladePropsMap with "init-repo" entry
- `src/App.tsx` (169 lines) -- registerBuiltIn calls, useEffect timing

### Extension Reference Patterns (HIGH confidence)

- `src/extensions/worktrees/index.tsx` (69 lines) -- Phase 44: sidebar panel + commands
- `src/extensions/gitflow/index.ts` (66 lines) -- Phase 40: coreOverride blade + sidebar + commands
- `src/extensions/conventional-commits/index.ts` (84 lines) -- Phase 39: coreOverride blades + commands + onDispose
- `src/extensions/content-viewers/index.ts` (54 lines) -- Phase 38: coreOverride lazy blades
- `src/extensions/github/index.ts` (322 lines) -- Largest extension: eager imports, store subscriptions, toolbar

### Architecture Research (HIGH confidence)

- `.planning/phases/44-worktree-extraction/44-RESEARCH-ARCHITECTURE.md` -- Phase 44 patterns, ADR for store location, lifecycle docs

---

## Metadata

**Confidence breakdown:**
- Extension architecture: HIGH -- proven across 5 existing built-in extensions
- coreOverride blade registration: HIGH -- used by 4 extensions (content-viewers, conventional-commits, gitflow)
- Store migration: HIGH -- zero cross-store dependencies, all consumers co-located
- WelcomeView integration: HIGH -- INFRA-05 defensive fallback already exists
- Dual-context activation: HIGH -- `deactivateAll()` explicitly skips built-in extensions
- Import path analysis: HIGH -- matching directory depth minimizes changes
- Lifecycle cleanup: HIGH -- `ExtensionAPI.cleanup()` is exhaustively tested
- Graceful degradation: HIGH -- no core features depend on Init Repo

**Research date:** 2026-02-11
**Valid until:** 2026-03-13 (30 days -- stable patterns)
