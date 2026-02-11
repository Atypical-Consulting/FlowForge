# Phase 45: Init Repo Extraction - UX Research

**Researched:** 2026-02-11
**Domain:** WelcomeView user flow, Init Repo blade lifecycle, pre-repository extension activation, fallback UX, command palette integration, graceful degradation
**Confidence:** HIGH
**Researcher:** UX Specialist

---

## 1. Current State Analysis

### 1.1 Init Repo Blade Inventory

The Init Repo feature consists of a rich blade with split-pane layout, form, and preview:

| File | Purpose | Lines |
|------|---------|-------|
| `src/blades/init-repo/InitRepoBlade.tsx` | Split-pane blade: form + preview, project detection, template loading | 83 |
| `src/blades/init-repo/components/InitRepoForm.tsx` | Form: branch name, .gitignore templates, README config, initial commit | 351 |
| `src/blades/init-repo/components/InitRepoPreview.tsx` | Context-aware preview panel: .gitignore, README, commit summary | 275 |
| `src/blades/init-repo/components/TemplateChips.tsx` | Selected template chips with remove/reorder | -- |
| `src/blades/init-repo/components/TemplatePicker.tsx` | Template browser with category filter | -- |
| `src/blades/init-repo/components/CategoryFilter.tsx` | Category sidebar for template picker | -- |
| `src/blades/init-repo/components/ProjectDetectionBanner.tsx` | Auto-detected project type banner | -- |
| `src/blades/init-repo/store.ts` | Zustand store via `createBladeStore("init-repo", ...)` | 131 |
| `src/blades/init-repo/registration.ts` | Core blade registration: type "init-repo", singleton | 9 |
| `src/blades/init-repo/index.ts` | Barrel export | 1 |

### 1.2 Current Registration Mechanism

The Init Repo blade is registered in `src/blades/init-repo/registration.ts` via the core `registerBlade()` function:

```typescript
registerBlade<{ directoryPath: string }>({
  type: "init-repo",
  defaultTitle: "Initialize Repository",
  component: InitRepoBlade,
  singleton: true,
});
```

This registration is loaded via `src/blades/_discovery.ts` using Vite's `import.meta.glob()`. The blade type `"init-repo"` is listed in `EXPECTED_TYPES` for dev-mode exhaustiveness checking, and in `BladePropsMap` in `src/stores/bladeTypes.ts`.

### 1.3 Current User Flow: Opening a Non-Git Directory

The Init Repo feature activates in a **pre-repository context** -- this is the key differentiator from all other extension extractions (Worktrees, Gitflow, etc. require an open repository).

**Flow diagram:**

```
User opens WelcomeView (no repo)
  |
  +-> Clicks "Open Repository" (or drops folder)
  |     |
  |     +-> Tauri dialog -> selects directory
  |           |
  |           +-> commands.isGitRepository(path) -> TRUE
  |           |     -> openRepository(path) -- normal flow
  |           |
  |           +-> commands.isGitRepository(path) -> FALSE
  |                 -> setPendingInitPath(path)
  |                 -> GitInitBanner appears in WelcomeView
  |                       |
  |                       +-> User clicks "Set Up Repository"
  |                       |     -> setShowInitRepo(true)
  |                       |     -> WelcomeView renders InitRepoBlade via BladeRegistry lookup
  |                       |     -> User configures and clicks "Initialize Repository"
  |                       |     -> onComplete: openRepository(path)
  |                       |
  |                       +-> User clicks "Dismiss"
  |                             -> setPendingInitPath(null)
  |                             -> Banner disappears
```

### 1.4 WelcomeView's BladeRegistry Lookup

WelcomeView already performs a BladeRegistry lookup for the init-repo blade (line 25):

```typescript
const initRepoRegistration = useBladeRegistry((s) => s.blades.get("init-repo"));
```

When `showInitRepo` is true and `pendingInitPath` is set, it renders the blade component:

```typescript
if (showInitRepo && pendingInitPath) {
  if (!initRepoRegistration) {
    // Defensive fallback: blade not yet registered (race condition guard)
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-ctp-base flex items-center justify-center">
        <p className="text-ctp-subtext0">Preparing repository setup...</p>
      </div>
    );
  }
  const InitComponent = initRepoRegistration.component;
  return (
    <div className="h-[calc(100vh-3.5rem)] bg-ctp-base">
      <Suspense fallback={...}>
        <InitComponent
          directoryPath={pendingInitPath}
          onCancel={() => setShowInitRepo(false)}
          onComplete={async (path: string) => {
            await openRepository(path);
            await addRecentRepo(path);
            setShowInitRepo(false);
            setPendingInitPath(null);
          }}
        />
      </Suspense>
    </div>
  );
}
```

**Critical observation:** WelcomeView already uses the BladeRegistry pattern (not a direct import). This means the transition to extension-based registration is architecturally smooth -- the consumer code needs minimal changes.

### 1.5 GitInitBanner Component

The `GitInitBanner` component (`src/components/welcome/GitInitBanner.tsx`) serves as the prompt when a non-Git directory is detected:

- Appears with `fadeInUp` animation (framer-motion)
- Shows folder name and description: "This folder is not a Git repository"
- Two actions: "Set Up Repository" (primary) and "Dismiss" (ghost)
- Uses `role="region"` with `aria-label="Git repository initialization"` for accessibility
- Icons: `GitBranch` (indicator) + `FolderGit2` (action button)

This component is rendered by WelcomeView and does NOT directly depend on the Init Repo blade. It only triggers state changes (`onSetup` -> `setShowInitRepo(true)`).

### 1.6 Pre-Repository Context: The Unique Challenge

Unlike all other extracted extensions (Worktrees, Gitflow, Content Viewers, etc.), the Init Repo extension must activate **before any repository is open**. This is because:

1. The blade is used FROM the WelcomeView (pre-repository state)
2. `commands.isGitRepository()` returns false for the selected directory
3. The user needs the Init Repo blade to TURN the directory INTO a repository

**Current extension activation flow:**
- Built-in extensions are registered in `App.tsx useEffect()` via `registerBuiltIn()`
- `registerBuiltIn()` calls `activate()` immediately -- this is the "early activation" path
- External extensions are discovered and activated after `openRepository()` via `discoverExtensions()` + `activateAll()`

Since `registerBuiltIn()` activates immediately during `App.tsx` mount (before any repository is opened), the Init Repo extension will naturally activate early enough. **No special activation timing is needed.**

---

## 2. Fallback UX Design: Extension Disabled

### 2.1 Scenario: Init Repo Extension Disabled

When the Init Repo extension is disabled via the Extension Manager:
1. The `"init-repo"` blade type is unregistered from BladeRegistry
2. `useBladeRegistry((s) => s.blades.get("init-repo"))` returns `undefined`
3. WelcomeView's `initRepoRegistration` becomes `null/undefined`
4. The Init Repo command disappears from the command palette

### 2.2 Recommended Fallback UX

When `initRepoRegistration` is undefined AND the user has a `pendingInitPath`, the GitInitBanner should adapt to show a minimal fallback instead of the full Init Repo blade.

**Design: Replace GitInitBanner's "Set Up Repository" button with "Run git init" when extension is disabled**

```
+-------------------------------------------------------+
| [GitBranch icon]                                       |
| This folder is not a Git repository                    |
| Initialize "my-project" to start tracking changes.     |
|                                                        |
| [Run git init]  [Dismiss]                              |
|                                                        |
| [info icon] Enable the Init Repo extension for         |
| .gitignore templates, README setup, and more.          |
+-------------------------------------------------------+
```

**Rationale for this approach:**

1. **Minimal but functional:** Users can still initialize a repository with a single click. The core `git init` operation does not require the extension -- only the rich setup experience (templates, README, etc.) does.

2. **Informative without being blocking:** A subtle info text explains that richer functionality is available by enabling the extension. This follows the principle of progressive disclosure.

3. **Not an error state:** The fallback is not presented as an error or warning. It is a degraded but perfectly valid path. The button uses the standard primary variant, not a warning style.

4. **Matches Catppuccin Mocha theme:** Uses `text-ctp-subtext0` for the info text, `bg-ctp-surface0/50` for the banner, consistent with existing WelcomeView patterns.

### 2.3 Fallback Button Behavior

The "Run git init" fallback button should:
1. Call `commands.gitInit(pendingInitPath, "main")` with default branch name
2. On success, call `openRepository(pendingInitPath)` and `addRecentRepo(pendingInitPath)`
3. Show a loading spinner during initialization (same `Loader2` icon pattern)
4. Handle errors with the existing error display in WelcomeView

This is simpler than the full Init Repo blade (no templates, no README, no initial commit) but provides the essential functionality.

### 2.4 Fallback vs. Full Experience Comparison

| Feature | Full (Extension Enabled) | Fallback (Extension Disabled) |
|---------|-------------------------|-------------------------------|
| git init | Yes, with branch name choice | Yes, default "main" branch |
| .gitignore templates | Yes, with template browser + preview | No |
| README.md generation | Yes, with name + description | No |
| Initial commit | Yes, optional with message | No |
| Project type detection | Yes, auto-recommends templates | No |
| Split-pane layout | Yes, form + preview | No (single button) |
| Cancel action | Yes, back to WelcomeView | Yes, dismiss banner |

### 2.5 Implementation Location

The fallback logic should live in WelcomeView itself, not in a separate component. The conditional rendering is:

```typescript
// Extension enabled: show GitInitBanner with "Set Up Repository"
// Extension disabled: show modified GitInitBanner with "Run git init" + info text
{pendingInitPath && !error && !showInitRepo && (
  initRepoRegistration ? (
    <GitInitBanner
      path={pendingInitPath}
      onDismiss={() => setPendingInitPath(null)}
      onSetup={() => setShowInitRepo(true)}
    />
  ) : (
    <GitInitFallbackBanner
      path={pendingInitPath}
      onDismiss={() => setPendingInitPath(null)}
      onInit={handleQuickInit}
    />
  )
)}
```

Alternatively, the GitInitBanner component could accept an `extensionAvailable` prop and render the appropriate variant internally. This keeps the conditional logic simpler in WelcomeView.

---

## 3. Command Palette Integration

### 3.1 Init Repo Command Design

The Init Repo extension should register a command in the palette:

```typescript
api.registerCommand({
  id: "init-repo",
  title: "Initialize Repository",
  description: "Set up a new Git repository with .gitignore, README, and initial commit",
  category: "Repository",
  icon: FolderGit2,
  keywords: ["init", "initialize", "create", "new", "repository", "git init"],
  action: () => {
    // Open directory picker, then navigate to Init Repo blade
    // Same flow as WelcomeView's openDialog but targeting init
  },
  enabled: () => {
    // Available when no repository is open (WelcomeView context)
    // OR always available (user can init a subdirectory)
    return true;
  },
});
```

**Category decision:** Use `"Repository"` (existing core category) rather than creating a new category. The `git init` operation is a core repository operation, and grouping it with other Repository commands (Open, Clone) maintains semantic consistency.

### 3.2 Command Appear/Disappear Behavior

| Extension State | Command Palette | Behavior |
|----------------|-----------------|----------|
| Active | "Initialize Repository" visible | User can trigger init flow |
| Disabled | "Initialize Repository" hidden | Command unregistered via `api.cleanup()` |
| Re-enabled | "Initialize Repository" reappears | Re-registered via `onActivate()` |

The command registration follows the same pattern as Worktrees (`"Create Worktree"`, `"Refresh Worktrees"`) -- commands are registered in `onActivate()` and automatically cleaned up by `ExtensionAPI.cleanup()` during deactivation.

### 3.3 Command Palette UX for Pre-Repository Context

A special consideration: the command palette is accessible from WelcomeView via the keyboard shortcut (Cmd+K / Ctrl+K). When the user invokes "Initialize Repository" from the palette:

1. Open the Tauri directory picker dialog
2. If the selected directory is already a git repo, show a toast: "This directory is already a Git repository"
3. If not a git repo, set `pendingInitPath` and `showInitRepo` to enter the Init Repo blade

This mirrors the existing "Open Repository" flow but is targeted at initialization.

---

## 4. Accessibility Considerations

### 4.1 Fallback Banner Accessibility

The fallback "Run git init" banner must maintain the same accessibility level as GitInitBanner:

- `role="region"` with `aria-label="Git repository initialization"` on the container
- The "Run git init" button uses a standard `<Button>` component (natively keyboard-accessible)
- The info text about enabling the extension should use `aria-describedby` or be associated via proximity
- Loading state should be announced: use `aria-busy="true"` on the button during initialization
- Error display should use `role="alert"` for screen reader announcement

### 4.2 Init Repo Blade Accessibility (Existing)

The current Init Repo blade has reasonable accessibility:

- Form inputs use `<label>` elements with `htmlFor` attributes
- Collapsible sections use `<button>` with `<ChevronDown>` icon (keyboard-operable)
- Template picker uses `aria-expanded` attribute on the toggle button
- Checkboxes for README and initial commit are standard `<input type="checkbox">`

**Gap:** The `.gitignore Configuration`, `README.md`, and `Initial Commit` collapsible sections use `<button>` elements but lack `aria-expanded` attributes (except the template picker toggle). This is a pre-existing issue not caused by the extraction.

### 4.3 Extension Toggle Accessibility in Extension Manager

The ToggleSwitch component used in ExtensionCard already includes:
- `aria-label={`Toggle ${extension.name}`}` for screen readers
- Visual loading state during toggle
- Toast notification on state change (`"Init Repo enabled"` / `"Init Repo disabled"`)

No additional accessibility work needed for the toggle mechanism.

### 4.4 Focus Management During Transitions

When the Init Repo extension is disabled mid-session:
- If the Init Repo blade is currently displayed in WelcomeView, the blade component will unmount
- WelcomeView should return to its default state (showing Open Repository / Clone buttons)
- Focus should return to the WelcomeView container -- this happens naturally via React's unmount/remount cycle

When the fallback banner appears:
- Focus does NOT automatically move to the fallback banner (it appears contextually, not as a dialog)
- Users navigate to it via Tab key or mouse click
- This matches the current GitInitBanner behavior

---

## 5. Graceful Degradation Analysis

### 5.1 Pre-Repository Extensions: The Init Repo Precedent

Init Repo is the **first extension** in FlowForge that serves a pre-repository context. All other extensions (Worktrees, Gitflow, Content Viewers, Conventional Commits, GitHub) operate within the RepositoryView after a repo is opened.

This creates a unique degradation scenario:

| Scenario | Extension Active | Extension Disabled |
|----------|-----------------|-------------------|
| WelcomeView: no pending init | No visible difference | No visible difference |
| WelcomeView: pending init path | GitInitBanner with "Set Up Repository" -> full blade | GitInitFallbackBanner with "Run git init" -> direct init |
| WelcomeView: showing Init Repo blade | Full split-pane form + preview | N/A (blade can't be shown without registration) |
| Command palette: init command | "Initialize Repository" visible | Command hidden |
| Blade navigation: push "init-repo" | Blade renders normally | Blade not found in registry (BladeHost handles gracefully) |

### 5.2 Mid-Session Disable: Init Repo Blade Active

If a user is currently viewing the Init Repo blade (the full form) and disables the Init Repo extension:

1. `deactivateExtension("init-repo-ext")` runs
2. `api.cleanup()` unregisters the `"init-repo"` blade from BladeRegistry
3. WelcomeView's `initRepoRegistration` becomes undefined
4. The `showInitRepo && pendingInitPath` condition still holds, but `initRepoRegistration` is falsy
5. WelcomeView shows the defensive fallback: "Preparing repository setup..." text

**Issue:** The current defensive fallback ("Preparing repository setup...") was designed for a brief race condition, not for a permanent disabled state. After extraction, this fallback should be updated:

**Recommended change:** When `showInitRepo` is true but `initRepoRegistration` is undefined, reset the state:
- Set `showInitRepo` to false
- Keep `pendingInitPath` so the fallback banner appears
- Show a toast: "Init Repo extension was disabled"

This ensures the user doesn't get stuck on a loading screen.

### 5.3 Comparison with Worktree Extension Degradation (Phase 44)

| Aspect | Worktrees (Phase 44) | Init Repo (Phase 45) |
|--------|---------------------|---------------------|
| Context | Repository open (RepositoryView) | No repository (WelcomeView) |
| UI location | Sidebar panel | Full-screen blade from WelcomeView |
| Degradation | Panel disappears from sidebar | Banner changes from "Set Up" to "Run git init" |
| Data persistence | worktreeList stays in store | No persistent data (store resets on unmount) |
| Fallback functionality | None (worktrees just hidden) | Basic git init (no templates/README) |
| User impact | Moderate (lose worktree management UI) | Low (core init still works) |

Init Repo has **better** degradation than Worktrees because the fallback provides actual functionality (running git init), whereas disabling Worktrees removes all worktree management capabilities.

### 5.4 Re-Enabling the Extension

When a user re-enables the Init Repo extension:

1. `activateExtension("init-repo-ext")` runs
2. `onActivate(api)` registers the blade and command
3. If `pendingInitPath` is set, the fallback banner is immediately replaced by the full GitInitBanner with "Set Up Repository"
4. No data refresh needed (unlike Worktrees which reload worktree list)

The transition is instant because the blade registration is synchronous (no async data loading).

---

## 6. UX Consistency with Phase 44 Patterns

### 6.1 Extension Entry Point Pattern

Phase 44 established the pattern with `src/extensions/worktrees/index.tsx`:
- Export `onActivate(api: ExtensionAPI)` and `onDeactivate()`
- Register contributions via ExtensionAPI methods
- Use `coreOverride: true` for blade types that replace core registrations

Init Repo should follow the same pattern, with the key difference that it registers a **blade** (via `api.registerBlade()`) rather than a **sidebar panel** (via `api.contributeSidebarPanel()`).

### 6.2 Blade Registration with coreOverride

The Init Repo blade uses the type `"init-repo"` (a core blade type). To maintain backward compatibility with WelcomeView's `useBladeRegistry((s) => s.blades.get("init-repo"))`, the extension must register with `coreOverride: true`:

```typescript
api.registerBlade({
  type: "init-repo",
  title: "Initialize Repository",
  component: InitRepoBlade,
  singleton: true,
  coreOverride: true,
});
```

Without `coreOverride`, the blade type would become `"ext:init-repo-ext:init-repo"`, breaking the WelcomeView lookup.

### 6.3 Store Migration: Extension Directory

The Init Repo store (`src/blades/init-repo/store.ts`) uses `createBladeStore("init-repo", ...)`. Per INIT-06, this store should move to the extension directory.

**UX impact of store migration:** None. The store is internal to the Init Repo blade components. No external consumers reference it. The move is purely organizational.

### 6.4 Registration File Cleanup

Currently, `src/blades/init-repo/registration.ts` performs the core blade registration. After extraction:
- This file should be **removed** (the extension's `onActivate` handles registration)
- `src/blades/_discovery.ts` should remove `"init-repo"` from `EXPECTED_TYPES` (or the check should exclude extension-registered types)
- `src/stores/bladeTypes.ts` can keep `"init-repo"` in `BladePropsMap` since the type string remains the same (via `coreOverride`)

---

## 7. WelcomeView Integration Points

### 7.1 Current WelcomeView Rendering Logic

WelcomeView has three main rendering states:

1. **Init Repo blade active:** `showInitRepo && pendingInitPath` -- renders full blade
2. **GitInitBanner visible:** `pendingInitPath && !error && !showInitRepo` -- renders prompt
3. **Default view:** Welcome message, Open/Clone buttons, Recent repos

### 7.2 Updated Rendering Logic After Extraction

```
showInitRepo && pendingInitPath && initRepoRegistration
  -> Render Init Repo blade via BladeRegistry (existing code)

showInitRepo && pendingInitPath && !initRepoRegistration
  -> Reset showInitRepo, show fallback banner (NEW behavior)

pendingInitPath && !error && !showInitRepo && initRepoRegistration
  -> GitInitBanner with "Set Up Repository" (existing)

pendingInitPath && !error && !showInitRepo && !initRepoRegistration
  -> GitInitFallbackBanner with "Run git init" (NEW component)

Default
  -> Welcome view (existing)
```

### 7.3 GitInitFallbackBanner Design Specification

**Visual design (Catppuccin Mocha):**

```
Container: bg-ctp-surface0/50 backdrop-blur-sm border-ctp-surface1 rounded-lg p-4
Animation: fadeInUp (framer-motion, matching GitInitBanner)

[GitBranch icon (ctp-blue)] This folder is not a Git repository
                            Initialize "[folderName]" as a Git repository.

[Button: "Run git init" (primary, sm)]  [Button: "Dismiss" (ghost, sm)]

[Info icon (ctp-overlay0)] Tip: Enable the Init Repo extension in Settings > Extensions
                           for .gitignore templates, README setup, and more.
```

**Key design decisions:**

1. **Same container styling as GitInitBanner** -- `bg-ctp-surface0/50 backdrop-blur-sm border border-ctp-surface1 rounded-lg` ensures visual consistency

2. **Button text "Run git init"** rather than "Initialize Repository" -- differentiates from the full experience and sets accurate expectations (just git init, nothing more)

3. **Info text placement** -- Below the action buttons, using `text-ctp-overlay0 text-xs`. Subtle enough to not distract but informative for users wondering where the rich setup went

4. **No link to Extension Manager** -- The info text mentions "Settings > Extensions" by name but does not include a clickable link. This avoids navigation complexity in the WelcomeView context (where blade navigation is not active)

5. **Loading state** -- During git init, button shows `<Loader2 className="w-4 h-4 animate-spin" />` with text "Initializing..." (matches InitRepoForm pattern)

---

## 8. Risk Areas

### 8.1 High Risk

| Risk | Impact | Mitigation | Confidence |
|------|--------|------------|------------|
| Init Repo blade not available when needed from WelcomeView | User cannot set up repository from selected directory | Extension activates via `registerBuiltIn()` in App.tsx mount, which runs before WelcomeView renders. Activation is synchronous for built-in extensions. | HIGH |
| WelcomeView stuck on "Preparing repository setup..." when extension disabled | User sees permanent loading state instead of fallback | Add `useEffect` that resets `showInitRepo` when `initRepoRegistration` becomes undefined | HIGH |
| Removing `registration.ts` breaks `_discovery.ts` exhaustiveness check | Dev-mode console warning about missing "init-repo" registration | Remove "init-repo" from `EXPECTED_TYPES` array, or add an exception for extension-registered types | HIGH |

### 8.2 Medium Risk

| Risk | Impact | Mitigation | Confidence |
|------|--------|------------|------------|
| Store import paths break when moving store.ts to extension directory | Components fail to import `useInitRepoStore` | Update all import paths in Init Repo components; verify no external consumers exist | HIGH |
| `createBladeStore` is imported from core in the extension store | Circular dependency concern | `createBladeStore` is a utility; importing it from extension is fine (same as `createBladeStore` in other extensions) | HIGH |
| Command palette "Initialize Repository" action requires directory picker | UX for invoking from palette may feel disconnected from WelcomeView flow | The command opens the same Tauri directory dialog; if a non-git directory is selected, it navigates to the Init Repo blade. Natural flow. | MEDIUM |

### 8.3 Low Risk

| Risk | Impact | Mitigation | Confidence |
|------|--------|------------|------------|
| GitInitFallbackBanner "Run git init" creates bare repo without .gitignore | User starts with no .gitignore | This is expected degraded behavior; the info text explains how to get the full experience | HIGH |
| Extension disable/re-enable while InitRepoForm has unsaved data | User loses form state (template selections, README config) | The store resets on blade unmount already (existing `reset()` in useEffect cleanup). This is acceptable. | HIGH |
| HMR in dev mode re-registers blade causing brief flicker | Development inconvenience only | `clearCoreRegistry()` in HMR dispose handles this; extension-registered blades persist across HMR | MEDIUM |

### 8.4 Unique Init Repo Risk: Activation Timing

Unlike other extensions that activate after a repository is opened, Init Repo must be available **before** any repository exists. This is the most critical risk area.

**Analysis of activation timing:**

```
App.tsx mount
  |
  +-> useEffect runs
  |     |
  |     +-> initTheme(), initSettings(), etc.
  |     +-> registerBuiltIn({ id: "init-repo-ext", ... })
  |           |
  |           +-> Sets status: "discovered" in store
  |           +-> Creates ExtensionAPI instance
  |           +-> Calls activate(api) -- SYNCHRONOUS registration
  |           +-> Sets status: "active"
  |           |
  |           At this point, "init-repo" blade is in BladeRegistry
  |
  +-> App renders
        |
        +-> status is null (no repo open)
        +-> Renders WelcomeView
              |
              +-> useBladeRegistry((s) => s.blades.get("init-repo"))
              +-> initRepoRegistration is DEFINED (extension already active)
```

**Conclusion:** The `registerBuiltIn()` call in `useEffect` runs before the initial render of WelcomeView's children that depend on `initRepoRegistration`. React batches state updates, so by the time WelcomeView subscribes to the BladeRegistry, the Init Repo blade is already registered.

**Edge case:** If `registerBuiltIn()` is async and the `activate()` function does async work, there could be a brief moment where the blade is not registered. The existing defensive fallback ("Preparing repository setup...") handles this case. After extraction, this should be improved to show the fallback banner instead.

---

## 9. Summary of UX Recommendations

1. **Register Init Repo blade with `coreOverride: true`** to preserve the `"init-repo"` type string that WelcomeView looks up

2. **Create GitInitFallbackBanner component** for when the extension is disabled -- provides basic "Run git init" functionality with an info tip about enabling the extension

3. **Update WelcomeView** to handle the disabled-extension case:
   - Show GitInitFallbackBanner instead of GitInitBanner when `initRepoRegistration` is undefined
   - Reset `showInitRepo` if the extension is disabled while the blade is active

4. **Register "Initialize Repository" command** in the palette under the "Repository" category

5. **Move store to extension directory** (pure organizational change, no UX impact)

6. **Remove `registration.ts`** and update `_discovery.ts` EXPECTED_TYPES

7. **Maintain existing WelcomeView Suspense boundary** for the Init Repo blade component

8. **Use `registerBuiltIn()` in App.tsx** for early activation (before repository open)

9. **Preserve GitInitBanner component** as-is -- it works well and requires no changes for the enabled-extension path

10. **Test mid-session disable scenario** to ensure WelcomeView recovers gracefully from blade unmount

---

## 10. Sources

### Primary (HIGH confidence -- direct code analysis)

- `src/components/WelcomeView.tsx:17-270` -- WelcomeView with Init Repo integration
- `src/components/WelcomeView.tsx:25` -- BladeRegistry lookup for "init-repo"
- `src/components/WelcomeView.tsx:119-152` -- Init Repo blade rendering with Suspense
- `src/components/WelcomeView.tsx:255-261` -- GitInitBanner conditional rendering
- `src/components/welcome/GitInitBanner.tsx:1-49` -- Init banner with Set Up / Dismiss
- `src/components/welcome/AnimatedGradientBg.tsx` -- Background gradient component
- `src/blades/init-repo/InitRepoBlade.tsx:1-83` -- Split-pane blade with form + preview
- `src/blades/init-repo/components/InitRepoForm.tsx:1-351` -- Form with git init, templates, README, commit
- `src/blades/init-repo/components/InitRepoPreview.tsx:1-275` -- Context-aware preview panel
- `src/blades/init-repo/store.ts:1-131` -- Zustand blade store with full state
- `src/blades/init-repo/registration.ts:1-9` -- Core blade registration (to be replaced)
- `src/blades/_discovery.ts:1-39` -- Vite glob discovery with EXPECTED_TYPES
- `src/stores/bladeTypes.ts:29` -- BladePropsMap entry for "init-repo"

### Secondary (HIGH confidence -- established patterns)

- `src/extensions/ExtensionAPI.ts:165-176` -- `registerBlade()` with `coreOverride` support
- `src/extensions/ExtensionHost.ts:336-402` -- `registerBuiltIn()` activation flow
- `src/extensions/worktrees/index.tsx:1-69` -- Worktrees extension pattern (Phase 44)
- `src/lib/bladeRegistry.ts:1-137` -- BladeRegistry with register/unregister/unregisterBySource
- `src/lib/commandRegistry.ts:1-178` -- CommandRegistry with category ordering
- `src/App.tsx:63-103` -- Built-in extension registration block
- `src/blades/extension-manager/components/ExtensionCard.tsx:1-144` -- Extension toggle UX
- `.planning/phases/44-worktree-extraction/44-RESEARCH-UX.md` -- Phase 44 UX patterns

---

## Metadata

**Confidence breakdown:**
- Current Init Repo UX flow: HIGH -- exhaustive code analysis of all components
- WelcomeView integration: HIGH -- direct code reading of rendering logic
- Fallback UX design: HIGH -- follows established patterns, simple implementation
- Command palette integration: HIGH -- verified against existing command registry
- Activation timing: HIGH -- traced through App.tsx -> registerBuiltIn -> ExtensionAPI flow
- Graceful degradation: HIGH -- analyzed all enable/disable/re-enable scenarios
- Accessibility: HIGH -- verified existing ARIA attributes and keyboard navigation
- Comparison with Phase 44: HIGH -- direct code comparison with worktrees extraction
- Risk analysis: HIGH -- based on direct dependency analysis and activation flow tracing

**Research date:** 2026-02-11
**Valid until:** 2026-03-13 (stable internal architecture)
