# Domain Pitfalls: Extracting Topology, Worktrees, and Init Repo into Extensions

**Domain:** Extension extraction for Topology Graph, Worktree Management, Init Repo; Zustand registry migration
**Project:** FlowForge v1.7.0 (subsequent milestone after v1.6.0 extension platform)
**Researched:** 2026-02-11
**Overall confidence:** HIGH (based on deep codebase analysis and v1.6.0 extraction lessons)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken core workflows, or multi-week recovery.

---

### Pitfall 1: Topology Is a Navigation Process Root, Not Just a Blade

**What goes wrong:** Topology is not merely a blade registered in the blade registry -- it is one of two fundamental "process types" that define the entire navigation system. The XState navigation machine (`navigationMachine.ts`) has a hardcoded `ProcessType = "staging" | "topology"` enum. The `rootBladeForProcess()` function in `actions.ts` returns the `"topology-graph"` blade type when the process is `"topology"`. The `ProcessNavigation` component hardcodes two process tabs (Staging and Topology). When a developer extracts topology to an extension and the extension is disabled, the entire right side of the navigation breaks: users can still click the "Topology" tab, but the blade stack initializes with a blade type that has no registration, rendering nothing or throwing.

**Why it happens:** In v1.6.0, the extracted features (Gitflow, CC, Content Viewers) were all "leaf" features -- they contributed sidebar panels, blades, and commands, but none of them were structural to the navigation architecture. Topology is fundamentally different: it is a process root. The developer treats it like any other blade extraction and misses that it underpins the navigation state machine itself.

**Consequences:**
- Clicking "Topology" tab renders a blank panel or crashes because `BladeRenderer` looks up `"topology-graph"` and gets `undefined`
- The `Enter` keyboard shortcut (which opens commit details from selected topology commit) throws because `topologySelectedCommit` state no longer exists in the store
- The `defaultTab: "topology"` user setting in `GeneralSettings` sends `SWITCH_PROCESS` to the navigation actor on startup, which initializes the blade stack with a missing blade type
- Auto-refresh in `App.tsx` (lines 132-135) calls `topologyState.loadGraph()` which references a slice that was extracted

**Prevention:**
1. Topology MUST remain a core blade registration, even when extracted. Use `coreOverride: true` (like Gitflow cheatsheet and CC blade already do) so the blade type stays `"topology-graph"` not `"ext:topology:topology-graph"`. This preserves compatibility with the navigation machine.
2. The `TopologySlice` in `GitOpsStore` cannot simply be removed. It must remain as a thin facade or the extension must provide a replacement that the navigation machine can reference. Either: (a) keep the slice in core with the extension providing the UI, or (b) refactor `ProcessType` to be dynamic.
3. Do NOT make `ProcessType` dynamic in this milestone -- that is a navigation machine rewrite. Instead, keep topology as a "core-guaranteed" blade type where the extension provides the component but the blade registration always exists.
4. Add a fallback blade that renders "Topology extension is disabled. Enable it in Extension Manager." if the topology extension is deactivated but the user navigates to the process.

**Detection:** Disable the topology extension. Click the "Topology" tab. If the app crashes or shows blank content, the extraction broke the navigation root.

**Warning signs:** Any PR that removes `"topology-graph"` from `BladePropsMap` in `bladeTypes.ts`, or removes `TopologySlice` from `GitOpsStore` without providing a navigation-safe fallback.

**Phase:** Address first. This is the single most dangerous pitfall because topology is the most-used view and it is structural, not just feature-level.

---

### Pitfall 2: TopologySlice Cross-Store Access From App.tsx File Watcher

**What goes wrong:** `App.tsx` lines 130-136 contain a file watcher listener that directly accesses `useTopologyStore.getState()` to check if nodes are loaded and auto-refresh the graph:

```typescript
const topologyState = useTopologyStore.getState();
if (topologyState.nodes.length > 0) {
  topologyState.loadGraph();
}
```

This runs in core code, not in the topology extension. If `TopologySlice` is extracted from `GitOpsStore`, this code either (a) references a removed slice causing a runtime error, or (b) references a stale store that no longer holds topology state. Either way, the auto-refresh on file system changes -- which keeps the commit graph current when the user makes commits -- silently breaks.

**Why it happens:** The topology auto-refresh was added as a core concern (react to repository-changed Tauri events) rather than as a topology-internal concern. When extracting, the developer focuses on moving the blade and its components but does not audit App.tsx for cross-cutting references.

**Consequences:** The topology graph goes stale after commits, pushes, pulls. Users see outdated commit history until they manually navigate away and back. This is subtle -- no error, no crash, just incorrect data.

**Prevention:**
1. The topology extension's `onActivate()` must set up its own file watcher subscription using `api.onDispose()` for cleanup. The core `App.tsx` file watcher should NOT reference topology state.
2. Before extraction, audit ALL references to topology state outside the topology blade directory. Search for: `useTopologyStore`, `topologySelectedCommit`, `loadGraph`, `topologyState`.
3. The `useKeyboardShortcuts.ts` (line 224-231) also directly accesses `useTopologyStore.getState().topologySelectedCommit` for the Enter key handler. This must become extension-contributed (register a command that the Enter key invokes).
4. Use `gitHookBus` or the Tauri event listener pattern from the GitHub extension (`listen("repository-changed", ...)`) within the topology extension itself.

**Detection:** After extraction, make a commit while viewing the topology. If the graph does not auto-refresh within 2 seconds, the watcher hookup is broken.

**Warning signs:** `App.tsx` still importing `useTopologyStore` after extraction. Any core file referencing topology store state.

**Phase:** Address in the same phase as Pitfall 1 (topology extraction). These are inseparable.

---

### Pitfall 3: Worktree switchToWorktree() Calls openRepository() -- Store Entanglement

**What goes wrong:** The `worktrees.slice.ts` contains `switchToWorktree()` which calls `get().openRepository(path)`. `openRepository` is a method from `RepositorySlice` -- a different slice in the same `GitOpsStore`. This is the exact same cross-slice coupling pattern that made the v1.6.0 Gitflow extraction dangerous (ADR-2 lesson). When the worktree slice is extracted to a standalone store or extension, the `get().openRepository()` call breaks because the extracted store no longer has access to `RepositorySlice`.

**Why it happens:** `switchToWorktree` needs to change the active repository to the worktree's path. In the monolithic `GitOpsStore`, this is trivial -- just call another slice's method via `get()`. After extraction, this implicit coupling surfaces.

**Consequences:** The "Switch to Worktree" action silently fails. Users click it, nothing happens, no error shown. The worktree panel appears to work (list, create, delete all work) but the critical workflow of switching to a worktree is broken.

**Prevention:**
1. `switchToWorktree` should NOT call `openRepository` directly. Instead, it should emit a navigation/application event: `gitHookBus.emit("after", "worktree-switch", { path })` and the core `RepositorySlice` (or `App.tsx`) subscribes to handle the repository switch.
2. Alternatively, the worktree extension can import `useGitOpsStore` directly for this one call (built-in extensions CAN import core stores -- the GitHub extension does this). But this must be a deliberate decision, not an accidental coupling.
3. The `openInExplorer` method uses `import("@tauri-apps/plugin-opener")` which is fine for an extension. But ensure the dynamic import is preserved, not converted to a static import that would increase bundle coupling.

**Detection:** After extraction, click "Switch to Worktree" on a worktree in the sidebar. If the repository does not switch, the cross-slice call broke.

**Warning signs:** The extracted worktree store containing `get().openRepository` or `get().refreshRepoStatus` calls. Any `get()` call that references methods from other slices.

**Phase:** Address during worktree extraction. Must be resolved before the worktree sidebar panel can be contributed via extension.

---

### Pitfall 4: Worktree Sidebar Is Hardcoded With Dialog State Management in RepositoryView

**What goes wrong:** `RepositoryView.tsx` hardcodes the Worktree section (lines 188-209) with direct JSX rendering `<WorktreePanel onOpenDeleteDialog={...} />`. But critically, the worktree section has TWO associated dialogs (`CreateWorktreeDialog`, `DeleteWorktreeDialog`) whose open/close state is managed by `useState` hooks in `RepositoryView` itself (line 98-99: `showWorktreeDialog`, `worktreeToDelete`). When extracting worktrees to an extension sidebar panel, these dialog state hooks cannot stay in `RepositoryView` -- they must move to the extension. But the dialog rendering happens OUTSIDE the sidebar section (lines 231-239), as portal-like elements at the RepositoryView root.

**Why it happens:** Dialog state lives in the parent component (RepositoryView) that coordinates between the sidebar panel (WorktreePanel) and the dialogs (CreateWorktreeDialog, DeleteWorktreeDialog). In v1.6.0, the Gitflow extraction was simpler because Gitflow's dialogs were self-contained within GitflowPanel. Worktree's architecture splits state between the panel and the parent.

**Consequences:** If you naively move WorktreePanel into an extension sidebar contribution, the dialog triggers (`setShowWorktreeDialog`, `setWorktreeToDelete`) become undefined because they were callback props from RepositoryView. The create/delete worktree buttons in the sidebar either crash or do nothing.

**Prevention:**
1. Before extraction, refactor WorktreePanel to be self-contained: move `CreateWorktreeDialog` and `DeleteWorktreeDialog` INSIDE the WorktreePanel component (or a wrapper). Manage `showCreate`/`pendingDelete` state within the panel itself.
2. The "+" button in the sidebar section header (currently rendered by RepositoryView's `<details><summary>` block) must become part of the panel's `renderAction` callback in the `SidebarPanelConfig`.
3. Test the self-contained refactoring BEFORE the extension extraction. This is a safe, zero-risk refactoring that can be a separate commit.

**Detection:** After extraction, click the "+" button in the Worktrees sidebar section. If the Create Worktree dialog does not appear, the state management broke.

**Warning signs:** A PR that contributes worktrees as a sidebar panel but still has `showWorktreeDialog` state or `<CreateWorktreeDialog>` rendering in `RepositoryView.tsx`.

**Phase:** Address as a pre-extraction refactoring step. This should be done BEFORE the actual extension work begins.

---

### Pitfall 5: Init Repo Used In Two Contexts -- Blade AND Standalone Component in WelcomeView

**What goes wrong:** `InitRepoBlade` is used in TWO completely different rendering contexts:
1. As a registered blade (via `registration.ts`) rendered within the blade container when a repo is open
2. As a direct component import in `WelcomeView.tsx` (line 117-131) rendered standalone when NO repository is open and the user selects a non-git directory

Context 2 is the critical one. `WelcomeView.tsx` directly imports `InitRepoBlade` from `../blades/init-repo` and renders it with `onCancel` and `onComplete` callbacks. If Init Repo becomes an extension blade, this direct import in WelcomeView breaks because: (a) the component moves to `src/extensions/init-repo/`, (b) the extension may not be activated yet (extensions activate after repo open, but WelcomeView shows BEFORE repo open).

**Why it happens:** Init Repo serves a dual purpose -- it is both a blade for in-app use AND the first-run experience for new directories. The first-run context operates outside the extension lifecycle because extensions discover and activate after a repository is opened (see `App.tsx` lines 96-112).

**Consequences:** New users selecting a non-git directory see a broken or empty init screen. The first-run experience -- one of the most critical UX moments -- fails silently. The `onComplete` callback (which calls `openRepository` + `addRecentRepo`) never fires, leaving users stuck on the welcome screen.

**Prevention:**
1. Init Repo should NOT be a toggleable extension. It should either remain core or be a "non-disableable" built-in extension. The WelcomeView use case cannot degrade gracefully -- there is no meaningful fallback for "initialize a repository."
2. If extracting anyway, the Init Repo extension must be activated during app startup (before repo open), not during the normal extension discovery/activation cycle. This requires a separate activation path: `registerBuiltIn` already runs on mount in `App.tsx` (lines 62-93), which IS before repo open.
3. The WelcomeView should NOT import the component directly. Instead, it should use the blade registry to look up `"init-repo"` and render it. This way, the component source (core or extension) is transparent.
4. However, the blade registry lookup requires the extension to be registered. Since `registerBuiltIn` runs on mount and `onActivate` is called immediately for built-in extensions, this should work -- but ONLY if Init Repo is registered in the initial `registerBuiltIn` batch, not deferred to `activateAll()`.

**Detection:** Open FlowForge with no repo. Select a non-git directory. If the init repo form does not appear, the extraction broke the first-run flow.

**Warning signs:** The Init Repo extension's `onActivate` being called inside `activateAll()` (which runs after repo open) instead of `registerBuiltIn()` (which runs on mount). Or: `WelcomeView.tsx` still having a direct import from the old location after extraction.

**Phase:** Address last among the three extractions. Init Repo has the most nuanced lifecycle requirements.

---

## Moderate Pitfalls

Issues that cause multi-day delays or significant rework but not full rewrites.

---

### Pitfall 6: commandRegistry and previewRegistry Migration to Zustand Breaks Non-Reactive Consumers

**What goes wrong:** `commandRegistry.ts` and `previewRegistry.ts` are currently plain module-scoped Maps/arrays with imperative `registerCommand()`/`registerPreview()` functions. They are NOT Zustand stores. When migrating them to Zustand for reactive behavior (matching `bladeRegistry`, `toolbarRegistry`, `sidebarPanelRegistry`, `statusBarRegistry` which ARE Zustand stores), all consumers that call `getCommands()` or `getPreviewForFile()` imperatively (not in React render) will continue to work, BUT consumers that need reactivity (like the CommandPalette) may behave differently.

The specific danger: `commandRegistry.ts` uses a module-scoped `const commands = new Map<string, Command>()` (line 31). Multiple files import `registerCommand` at module load time during the side-effect import chain (`./commands` in `App.tsx` line 4). If the registry becomes a Zustand store, the registration calls must happen AFTER the store is initialized. With the module-scoped Map, initialization order does not matter because the Map exists at module parse time. With a Zustand store, if `create()` hasn't run yet when `registerCommand()` is called, the store does not exist.

**Why it happens:** The developer changes `const commands = new Map()` to `const useCommandRegistry = create(...)` but does not realize that side-effect imports execute in dependency order, not declaration order. The Zustand store may not be initialized when early side-effect imports run.

**Consequences:** Commands registered during module load (`./commands/toolbar-actions.ts`, `./commands/context-menu-items.ts`, `./commands/extensions.ts`) silently fail to register. The command palette shows zero commands. Or worse, some commands register and others don't, depending on bundler import order.

**Prevention:**
1. Keep backward-compatible function exports (`registerCommand()`, `getCommands()`, etc.) that delegate to the Zustand store, exactly as `bladeRegistry.ts` already does (lines 96-136). The external API does not change; only the internal storage becomes reactive.
2. Zustand's `create()` is synchronous and the store exists immediately when the module is loaded. As long as `commandRegistry.ts` is imported (not dynamically loaded), the store will be ready. Verify this by checking that `commandRegistry.ts` is in the static import chain, not lazy-loaded.
3. Run a dev-mode assertion after all side-effect imports complete (in `App.tsx` or a setup file): `if (getCommands().length === 0) console.error("No commands registered")`.
4. Migrate one registry at a time (command first, preview second). Do not migrate both simultaneously.

**Detection:** After migration, open the command palette. If it is empty or missing commands, the migration broke registration ordering.

**Warning signs:** The new Zustand-based registry using `export const useCommandRegistry = create(...)` without providing backward-compatible function wrappers that match the existing API signatures.

**Phase:** Address as a tech debt cleanup phase, before or independently of the feature extractions.

---

### Pitfall 7: previewRegistry Migration Breaks Staging Preview Cascade

**What goes wrong:** `previewRegistry.ts` is a plain array (`const registry: PreviewRegistration[] = []`) with a `registerPreview()` that pushes and sorts by priority. The staging blade calls `getPreviewForFile()` to determine how to render file previews. If this becomes a Zustand store, the staging blade must subscribe to the store to get reactive updates when new previews are registered (e.g., when a content viewer extension activates late).

The current code uses `registry.find()` on every render, which always reads the latest array. With Zustand, the selector-based subscription model means the staging blade must use the store correctly to avoid stale closures.

But the bigger risk: `previewRegistrations.ts` (imported by the staging blade) uses `import.meta.glob` to eagerly load all preview registration files. This is a core module. After content viewers were extracted to an extension in v1.6.0, the preview registrations for markdown, code, and 3D viewers were removed from the core glob and re-registered via the extension's `onActivate`. If the previewRegistry becomes Zustand-based, the reactive subscription in the staging blade must handle: (1) initial core registrations available immediately, (2) extension registrations arriving asynchronously after extension activation. The staging blade might render before extensions activate, showing all files as "text diff" for a flash before the correct viewer kicks in.

**Why it happens:** Module-scoped array: reads are always latest. Zustand store with selector: reads are snapshot-based. The developer migrates storage but does not add a `registrationTick` counter (like `toolbarRegistry.visibilityTick`) to force re-renders when new registrations arrive.

**Consequences:** Flash of incorrect content. Images briefly show as text diff. Markdown files briefly show as plaintext. The staging blade "flickers" on first load as extension previews register late.

**Prevention:**
1. Add a `registrationTick` counter to the preview registry store, incremented on every `registerPreview()` call. The staging blade subscribes to this tick to force re-evaluation.
2. Alternatively, keep previewRegistry as a plain module-scoped array (non-reactive). The reactivity benefit is minimal since preview registrations only change during extension activation/deactivation, not during normal usage. The existing v1.6.0 pattern works fine without Zustand here.
3. If migrating anyway, ensure the staging blade's preview resolution runs in a `useMemo` that depends on the registration tick.

**Detection:** Open the staging blade immediately after app launch. If file previews flash from "text diff" to the correct viewer, the async registration timing is visible.

**Warning signs:** previewRegistry becoming a Zustand store without a corresponding subscription in the staging blade, or without a `registrationTick` mechanism.

**Phase:** Address alongside or after commandRegistry migration. Consider deferring entirely -- the existing pattern works.

---

### Pitfall 8: Topology's branchClassifier Dependency Creates Shared Code Ownership Ambiguity

**What goes wrong:** `TopologyPanel.tsx` imports `classifyBranch` and `GitflowBranchType` from `../../lib/branchClassifier`. The topology extension uses this to colorize commit lanes by branch type (main=blue, feature=mauve, etc.). The `branchClassifier` module is also imported by 8 other files across the codebase: `BranchItem.tsx`, `BranchTypeBadge.tsx`, `BulkDeleteDialog.tsx`, `useBranches.ts`, `branchScopes.ts`, and 3 Gitflow extension files.

After topology extraction, `branchClassifier.ts` is consumed by both core (BranchItem, BranchTypeBadge) and two extensions (Gitflow, Topology). The question becomes: who owns `branchClassifier`? If it stays in `src/lib/` (core), that is fine for built-in extensions that can import core. But it sets a precedent where extensions depend on specific core utility modules, making those modules harder to refactor.

The real pitfall: if someone later refactors `branchClassifier` (e.g., making branch type configurable, adding new types), both the Gitflow AND Topology extensions break if they import directly from core. With two extension consumers, the blast radius of core utility changes doubles.

**Why it happens:** Shared utilities are the most common coupling vector in monolith-to-plugin extractions. The utility is "too small to duplicate, too shared to own."

**Consequences:** Not immediate breakage, but accumulated tech debt. Each core utility change requires updating multiple extensions. Over time, extensions accumulate undeclared dependencies on core internals.

**Prevention:**
1. Keep `branchClassifier.ts` in core (`src/lib/`). This is the right call. It is a pure utility with no side effects, no state, and no React components. Built-in extensions importing pure core utilities is acceptable and even expected (the existing GitHub extension imports `openBlade`, `queryClient`, etc.).
2. Document it as a "stable core API" -- changes to its interface must be treated as breaking. Add a JSDoc `@stable` annotation.
3. Do NOT duplicate the classifier into each extension. The v1.6.0 lessons explicitly warned against this (Pitfall 10: shim accumulation).
4. If the classifier becomes more complex in the future (user-configurable branch types), expose it through `ExtensionAPI.utils.classifyBranch()` which core provides and extensions consume through the API facade.

**Detection:** Run `madge --orphans src/lib/branchClassifier.ts` to see all dependents. If the count exceeds 10, consider whether the module should become a formal API surface.

**Warning signs:** A developer duplicating `classifyBranch` into the topology extension "to avoid the dependency." Or a PR changing `branchClassifier` without checking extension consumers.

**Phase:** Acknowledge during topology extraction. No action needed beyond documentation.

---

### Pitfall 9: _discovery.ts Exhaustiveness Check Does Not Know About Extension-Provided Core Blade Types

**What goes wrong:** After v1.6.0, `_discovery.ts` has an `EXPECTED_TYPES` array listing 12 blade types. Extensions using `coreOverride: true` register blade types that LOOK like core types (`"gitflow-cheatsheet"`, `"conventional-commit"`, `"changelog"`, `"viewer-markdown"`, `"viewer-code"`, `"viewer-3d"`). These are in `EXPECTED_TYPES` but their `registration.ts` files no longer exist in `src/blades/`. The exhaustiveness check already handles this because the check runs AFTER extension activation.

But when adding `"topology-graph"`, `"init-repo"`, and potentially worktree-related blade types to the extraction, the developer must update `EXPECTED_TYPES` in `_discovery.ts`. If `"topology-graph"` is removed from `EXPECTED_TYPES` but the extension's `coreOverride: true` registration happens before the check runs, there is no warning. But if the extension activation order changes (e.g., topology extension fails to activate), `"topology-graph"` silently disappears from the registry with no dev warning.

**Why it happens:** The exhaustiveness check was designed for a world where all blade types were registered synchronously via `import.meta.glob`. With `coreOverride` extensions, some "core" types are registered asynchronously during extension activation. The check may run at the wrong time.

**Consequences:** Dev-mode warning fatigue or missed warnings. A developer removes `"topology-graph"` from `EXPECTED_TYPES`, the topology extension fails to activate in some edge case, and nobody notices the blade is unregistered because the check was updated to not expect it.

**Prevention:**
1. Split `EXPECTED_TYPES` into `EXPECTED_CORE_TYPES` (registered by `src/blades/*/registration.ts` glob) and `EXPECTED_EXTENSION_TYPES` (registered by built-in extensions with `coreOverride`).
2. Run the extension type check AFTER `activateAll()` completes, not during module load. This ensures extension-provided core types are present.
3. Add `"topology-graph"` to `EXPECTED_EXTENSION_TYPES` when it moves to an extension. Keep it in `EXPECTED_CORE_TYPES` if it remains a core blade with extension-enhanced rendering.

**Detection:** In dev mode, intentionally break the topology extension's `onActivate` (throw error). Check if the dev console warns about the missing `"topology-graph"` blade type.

**Warning signs:** `EXPECTED_TYPES` being modified without updating the corresponding check timing logic.

**Phase:** Address during topology extraction as a small sub-task.

---

### Pitfall 10: Init Repo's useGitignoreTemplates Hook Uses react-query Keys That May Conflict

**What goes wrong:** `InitRepoBlade.tsx` uses `useProjectDetection(directoryPath)` from `hooks/useGitignoreTemplates`. This hook uses `@tanstack/react-query` with query keys like `["projectDetection", directoryPath]`. After extraction to an extension, the queryClient instance is shared (it is global, provided in `main.tsx`). If the extension is deactivated and reactivated, stale react-query cache entries from the previous activation persist, potentially showing outdated project detection results for a directory that changed.

More importantly, the `commands.getGitignoreTemplate(name)` call in `InitRepoBlade.tsx` (line 63-66) runs inside a `useEffect` without react-query, directly calling Tauri commands. This is a side-effect pattern that cannot be easily cleaned up on extension deactivation -- pending promises from `commands.getGitignoreTemplate` may resolve after the extension is deactivated, calling `setTemplateContent` on a store that has been reset.

**Why it happens:** The init-repo store uses `createBladeStore` (which auto-resets on blade unmount), but the `useEffect` for template fetching can outlive the component if the extension is deactivated while the effect is running.

**Consequences:** Console errors about state updates on unmounted components. Stale template data appearing in re-activated init-repo. Minor UX issues, not crashes.

**Prevention:**
1. The `useEffect` for template fetching should use an abort controller or a `mounted` flag to prevent state updates after unmount.
2. When extracting, ensure the init-repo store's `reset()` is called during `onDeactivate()`, not just on blade unmount.
3. The react-query keys are fine as long as the queryClient is global. No namespacing needed for built-in extensions.

**Detection:** Open init-repo, select a directory, quickly disable the init-repo extension. Check console for "state update on unmounted component" warnings.

**Warning signs:** `useEffect` callbacks that call `set()` on Zustand stores without checking if the component/extension is still active.

**Phase:** Minor. Address during init-repo extraction as a quality improvement.

---

## Minor Pitfalls

Issues that cause hours of debugging or minor UX problems.

---

### Pitfall 11: defaultTab "topology" Setting Breaks If Topology Extension Is Disabled

**What goes wrong:** `GeneralSettings.tsx` offers three default tab options: "changes", "history", "topology". `App.tsx` reads this setting on startup (lines 51-56) and sends `SWITCH_PROCESS` to the navigation actor if `defaultTab === "topology"`. If the user has `"topology"` selected but later disables the topology extension, the app attempts to switch to the topology process on every startup, initializing the blade stack with a potentially unregistered blade type.

**Why it happens:** The user preference persists in the Tauri store independently of extension state. The settings UI does not know which extensions are enabled.

**Consequences:** The app starts with a blank main panel every time until the user manually changes the default tab setting. Confusing for users who may not connect the topology extension being disabled with their default tab preference.

**Prevention:**
1. When the topology extension deactivates, check if `defaultTab === "topology"` and, if so, reset it to `"changes"` with a toast notification: "Default tab reset to Changes because Topology extension was disabled."
2. Alternatively, in `App.tsx`, verify the blade type exists in the registry before sending `SWITCH_PROCESS`. If not registered, fall back to `"staging"` and log a warning.
3. The GeneralSettings UI should conditionally show the "topology" option only when the topology extension is active.

**Detection:** Set default tab to "topology". Disable topology extension. Restart app. Verify the app falls back to "changes" gracefully.

**Warning signs:** `App.tsx` SWITCH_PROCESS logic not checking blade registry before switching.

**Phase:** Address during topology extraction.

---

### Pitfall 12: Worktree CreateWorktreeDialog Imports BranchSlice Directly

**What goes wrong:** `CreateWorktreeDialog.tsx` imports `useBranchStore` from `stores/domain/git-ops` to load and display the branch list in the branch selector dropdown (line 4, 25). If the worktree extension tries to be "pure" and avoid core store imports, this branch list access breaks. But branches are a core concept -- the worktree dialog genuinely needs them.

**Why it happens:** Worktrees are inherently cross-cutting: creating a worktree requires selecting a branch (BranchSlice), the worktree filesystem path (Tauri dialog), and worktree operations (WorktreeSlice). This is not a coupling mistake; it is a genuine domain dependency.

**Consequences:** If the developer tries to decouple the worktree extension from BranchSlice, they either duplicate branch loading logic (maintenance burden) or add a complex indirection layer (over-engineering).

**Prevention:**
1. Accept that built-in extensions can and should import core stores directly. The Gitflow extension already imports `useGitOpsStore` (via `useRepositoryStore`) in its `index.ts`. The GitHub extension imports from `stores/repository`. This is the established pattern.
2. Do NOT create a `api.getBranches()` method just for this one dialog. That adds API surface for a single consumer.
3. The import should be `useGitOpsStore` for `loadBranches` and `branchList`, which remains in core after worktree slice extraction.

**Detection:** After extraction, open the Create Worktree dialog. If the branch dropdown is empty, the branch data access broke.

**Warning signs:** An indirection layer or adapter being built solely to avoid importing core stores in the worktree extension.

**Phase:** Acknowledge during worktree extraction. No special action needed -- follow the established pattern.

---

### Pitfall 13: Init Repo createBladeStore Pattern May Conflict With Extension Lifecycle

**What goes wrong:** `useInitRepoStore` is created with `createBladeStore("init-repo", ...)`. The `createBladeStore` utility (defined in `stores/createBladeStore.ts`) creates a Zustand store that auto-resets when the blade unmounts. After extraction, the store lives inside the extension module. If the extension is deactivated while the init-repo blade is mounted (unlikely but possible via command palette), the store reset happens but the extension's cleanup runs after, potentially causing double-reset or orphaned subscriptions.

**Why it happens:** `createBladeStore` ties store lifecycle to React component lifecycle (via `useEffect` cleanup). Extension lifecycle is managed by `ExtensionHost.deactivateExtension()`. These are two different lifecycle systems that can race.

**Consequences:** Minor: potential console warnings about double-reset. The existing blade lifecycle cleanup (blade unmount on deactivation) should handle most cases because the blade is removed from the registry first.

**Prevention:**
1. Ensure that extension deactivation first removes the blade from the registry (which triggers unmount of any rendered blade, including its store cleanup), THEN calls `onDeactivate()`. This is already the order in `ExtensionAPI.cleanup()`.
2. Add an `onDeactivate` callback in the init-repo extension that explicitly calls `useInitRepoStore.getState().reset()` as a safety net.
3. This is a minor risk. The existing cleanup order handles it correctly in practice.

**Detection:** Mount init-repo blade, deactivate the init-repo extension via command palette. Check for console errors.

**Warning signs:** N/A. This is theoretical and low-risk.

**Phase:** Acknowledge. No special action needed.

---

### Pitfall 14: Topology layoutUtils.ts Imports branchClassifier At Module Level

**What goes wrong:** `layoutUtils.ts` imports `classifyBranch` and `BRANCH_HEX_COLORS` from `../../../lib/branchClassifier` at the top of the file. When this file moves into the topology extension, the import path changes to `../../../../lib/branchClassifier`. The deep relative path is fragile. More importantly, if the project ever introduces path aliases or moves the topology extension to a different directory structure, these deep relative imports break.

**Why it happens:** Extensions in `src/extensions/` are deeply nested. Importing from `src/lib/` requires traversing up 3-4 directories. Every extraction increases relative import depth.

**Consequences:** Build failures from incorrect relative paths. Developer spends time adjusting imports after moving files.

**Prevention:**
1. Use TypeScript path aliases. The `tsconfig.json` likely already has `"paths"` configured (or should have). Add `"@core/*": ["./src/*"]` so extension files import as `import { classifyBranch } from "@core/lib/branchClassifier"`.
2. If path aliases are not feasible, verify all import paths in moved files during extraction. Use `tsc --noEmit` after every file move.
3. Establish a convention: extensions import core utilities via `../../lib/` (from `src/extensions/{ext}/`) not via `../../../lib/` (from nested component directories within extensions).

**Detection:** `tsc --noEmit` after file moves.

**Warning signs:** Import paths with more than 3 `../` segments.

**Phase:** Address as a one-time project configuration update before extractions.

---

## Integration Pitfalls: Registry Migration to Zustand

---

### Integration Pitfall A: commandRegistry Migration Breaks Module-Load-Time Registrations

**What goes wrong:** Commands are registered via side-effect imports in `App.tsx`:
```typescript
import "./commands";                    // loads src/commands/index.ts
import "./commands/toolbar-actions";    // registers toolbar actions
import "./commands/context-menu-items"; // registers context menu items
```

Each file calls `registerCommand()` at module load time. If `commandRegistry` becomes a Zustand store, the `registerCommand()` wrapper function must delegate to `useCommandRegistry.getState().register()`. This works IF `useCommandRegistry` has been created (via `create()`) before these side-effect imports execute.

In the current import order: `App.tsx` imports `./commands` BEFORE importing any stores. If the commandRegistry store module is imported by `./commands`, the Zustand `create()` runs when the module loads, which is fine. But if a circular dependency prevents the module from loading, the store does not exist.

**Why it happens:** Zustand's `create()` is synchronous and runs at module load. The risk is not Zustand timing -- it is circular imports. If `commandRegistry.ts` imports from a module that imports back into commands, you get a circular reference that causes the store to be `undefined` when first accessed.

**Consequences:** Silent failure: `useCommandRegistry.getState()` returns the initial state with an empty Map, commands registered "successfully" but the store reference has since been replaced. Or: runtime error `Cannot read property 'getState' of undefined`.

**Prevention:**
1. Run `madge --circular src/lib/commandRegistry.ts` before and after migration. Zero circular references is required.
2. The migration should be a 1:1 replacement of the internal data structure. The external API (`registerCommand`, `getCommands`, `getCommandById`, etc.) stays identical. Consumers should not know the storage changed.
3. Follow the exact pattern used in `bladeRegistry.ts` (lines 36-94 for Zustand store, lines 96-136 for backward-compatible function wrappers). This is proven.
4. Add `devtools` middleware for debugging, matching the pattern in `toolbarRegistry.ts`.

**Detection:** After migration, verify `getCommands().length` in the browser console. Should match the pre-migration count (test with both numbers to confirm).

**Warning signs:** The migration changing the function signatures of `registerCommand`, `getCommands`, etc. These MUST remain backward-compatible.

**Phase:** Address as a standalone tech debt task, independent of feature extractions.

---

### Integration Pitfall B: Zustand Registry Map Equality Breaks React.memo Consumers

**What goes wrong:** When registries use `Map<string, T>` as the primary storage (as all existing Zustand registries do), every registration creates a new Map reference (`new Map(get().actions)`). Components that subscribe to the registry with a selector like `(s) => s.actions` will re-render on every registration, even if the specific items they care about did not change.

For the command palette (which consumes commandRegistry), this means: every extension activation (which registers commands) triggers a command palette re-render, even though the palette is closed. If 4 extensions register 20 commands total during activation, the palette component tree re-renders 20 times for no visible effect.

**Why it happens:** Zustand uses shallow comparison by default. A new Map is always !== the old Map, even if the entries are identical. Selectors that return the entire Map will always trigger re-renders.

**Consequences:** Performance degradation during extension activation. Noticeable on slower machines. Not a correctness issue, but a wasted render issue.

**Prevention:**
1. Consumers should use derived selectors, not raw Map access. Instead of `(s) => s.commands`, use `(s) => s.getFilteredCommands(query)` where the result is a new array only when the content actually changes.
2. Use `registrationTick` counter pattern for consumers that need to know "something changed" without subscribing to the full Map. The command palette can subscribe to `(s) => s.registrationTick` and re-derive its command list only when the tick changes.
3. For the commandRegistry migration specifically: the existing `getCommands()` function creates a new array on every call. Consumers already handle this. The migration to Zustand does not make this worse -- it just makes the re-render trigger explicit (Map reference change) rather than implicit (function call).

**Detection:** Use React DevTools Profiler. Enable "Record why each component rendered." Register an extension. Check if CommandPalette re-renders. It should only re-render when opened, not during extension activation.

**Warning signs:** Components subscribing to `(s) => s.commands` or `(s) => s.blades` directly instead of through filtered accessors.

**Phase:** Address alongside the commandRegistry migration.

---

### Integration Pitfall C: previewRegistry Lacks Source Tagging for Extension Cleanup

**What goes wrong:** The current `previewRegistry.ts` (a plain array) has no `source` field on `PreviewRegistration`. When content viewer extensions register previews, there is no way to remove them by source during extension deactivation. The existing code has `registerPreview()` but NO `unregisterPreview()` or `unregisterBySource()`.

In v1.6.0, this was handled by the content-viewers extension using `coreOverride: true` blade registrations, not preview registrations. But if a future extension wants to add a new file preview type (e.g., a PDF viewer extension), it needs `registerPreview()` with proper cleanup.

**Why it happens:** `previewRegistry.ts` was written before the extension system existed. It has no concept of sources or cleanup.

**Consequences:** Disabling a viewer extension leaves phantom preview registrations. File previews use the old viewer's matcher even though the component is gone. This causes React errors when the staging blade tries to render a preview component from a deactivated extension.

**Prevention:**
1. Add `source?: string` to `PreviewRegistration`.
2. Add `unregisterBySource(source: string)` that removes all entries matching the source.
3. Call `unregisterBySource` in `ExtensionAPI.cleanup()` alongside the other registry cleanups.
4. If migrating to Zustand, this comes free with the standard pattern. If keeping as plain array, add these two methods manually.

**Detection:** Register a preview via an extension, deactivate the extension, open a file that matched the extension's preview. If the staging blade crashes, cleanup is missing.

**Warning signs:** `ExtensionAPI.cleanup()` not having a previewRegistry cleanup step.

**Phase:** Address alongside registry migration or during content viewer tech debt cleanup.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Topology extraction | Navigation process root breakage (#1) | CRITICAL | coreOverride + fallback blade, keep TopologySlice facade |
| Topology extraction | App.tsx file watcher cross-store access (#2) | CRITICAL | Move auto-refresh into extension, audit all topology refs in core |
| Topology extraction | defaultTab "topology" persistence (#11) | MINOR | Fallback to "changes" if blade type missing |
| Topology extraction | branchClassifier shared ownership (#8) | MODERATE | Keep in core, document as stable API |
| Topology extraction | _discovery.ts expected types (#9) | MODERATE | Split into CORE and EXTENSION expected types |
| Worktree extraction | switchToWorktree cross-slice call (#3) | CRITICAL | Use gitHookBus or direct store import |
| Worktree extraction | Dialog state split across RepositoryView (#4) | CRITICAL | Self-contain dialogs in panel BEFORE extraction |
| Worktree extraction | BranchSlice import in CreateWorktreeDialog (#12) | MINOR | Accept built-in extension can import core stores |
| Init Repo extraction | Dual context blade + WelcomeView (#5) | CRITICAL | Non-disableable extension, early activation path |
| Init Repo extraction | createBladeStore lifecycle race (#13) | MINOR | Explicit reset in onDeactivate |
| Init Repo extraction | react-query cache + pending promises (#10) | MODERATE | Abort controller, mounted flag |
| Registry migration: command | Module-load registration timing (#6) | MODERATE | Follow bladeRegistry pattern, check circular imports |
| Registry migration: command | Map equality re-render storm (Int-B) | MODERATE | Derived selectors, registrationTick |
| Registry migration: preview | No source tagging or cleanup (Int-C) | MODERATE | Add source field, unregisterBySource |
| Registry migration: preview | Staging preview cascade flash (#7) | MODERATE | registrationTick or keep plain array |
| All phases | Deep relative import paths (#14) | MINOR | TypeScript path aliases |

---

## Extraction Difficulty Ranking

Based on analysis of coupling depth, consumer count, and architectural entanglement:

| Feature | Difficulty | Why | Recommended Order |
|---------|-----------|-----|-------------------|
| **Worktrees** | MEDIUM | Sidebar panel + two dialogs with split state management. Cross-slice call to openRepository. But limited scope -- 4 component files + 1 slice. | 1st |
| **Init Repo** | LOW-MEDIUM | Self-contained blade store, few external consumers. But dual-context usage (blade + WelcomeView) requires careful lifecycle handling. | 2nd |
| **Topology** | HIGH | Navigation process root. 18+ consumers across core. File watcher integration. Keyboard shortcut integration. Settings integration. branchClassifier shared dependency. | 3rd |

**Recommended extraction order:** Worktrees (simplest cross-slice decoupling, good warmup) -> Init Repo (self-contained but lifecycle nuance) -> Topology (hardest, requires navigation system awareness).

---

## "Looks Done But Isn't" Checklist for This Milestone

### Topology extraction completeness
- [ ] Navigation machine still works with topology extension disabled (fallback blade)
- [ ] `App.tsx` file watcher no longer references TopologySlice directly
- [ ] `useKeyboardShortcuts.ts` Enter key handler works via extension-contributed command
- [ ] `GeneralSettings.tsx` "topology" default tab option conditionally available
- [ ] `ProcessNavigation.tsx` handles disabled topology gracefully (greyed out or hidden)
- [ ] branchClassifier import path documented as stable core API
- [ ] _discovery.ts EXPECTED_TYPES updated

### Worktree extraction completeness
- [ ] WorktreePanel is self-contained with dialogs INSIDE (pre-extraction refactoring done)
- [ ] switchToWorktree uses indirect mechanism (event or direct store import), not cross-slice get()
- [ ] RepositoryView no longer has worktree-specific useState hooks or dialog rendering
- [ ] "+" button works via SidebarPanelConfig.renderAction
- [ ] Create and Delete dialogs accessible from the panel

### Init Repo extraction completeness
- [ ] WelcomeView renders init-repo via blade registry lookup, not direct import
- [ ] Extension activates during registerBuiltIn (before repo open), not activateAll
- [ ] Template fetching has abort/mounted guard
- [ ] Init-repo store reset called in onDeactivate
- [ ] First-run experience works identically to pre-extraction

### Registry migration completeness
- [ ] commandRegistry has Zustand store with backward-compatible function wrappers
- [ ] previewRegistry has source tagging and unregisterBySource
- [ ] No circular imports introduced (run madge --circular)
- [ ] All existing consumers work without modification
- [ ] Dev-mode assertion verifies registration count after startup

---

## Sources

### Internal Codebase (PRIMARY -- HIGH confidence)
- `src/machines/navigation/types.ts` -- ProcessType = "staging" | "topology" (hardcoded)
- `src/machines/navigation/actions.ts` -- rootBladeForProcess returns topology-graph blade
- `src/machines/navigation/navigationMachine.ts` -- XState FSM with SWITCH_PROCESS handling
- `src/blades/_shared/ProcessNavigation.tsx` -- Hardcoded PROCESSES array with staging + topology
- `src/stores/domain/git-ops/topology.slice.ts` -- TopologySlice in GitOpsStore (9-slice composite)
- `src/stores/domain/git-ops/worktrees.slice.ts` -- switchToWorktree calls get().openRepository()
- `src/stores/domain/git-ops/index.ts` -- GitOpsStore composition (critical for extraction planning)
- `src/components/RepositoryView.tsx` -- Hardcoded worktree sidebar with dialog state in parent
- `src/components/WelcomeView.tsx` -- Direct InitRepoBlade import for first-run context
- `src/blades/init-repo/store.ts` -- createBladeStore pattern for init-repo
- `src/hooks/useCommitGraph.ts` -- Topology hook consuming TopologySlice
- `src/hooks/useKeyboardShortcuts.ts` -- Enter key directly accesses topologySelectedCommit
- `src/App.tsx` -- File watcher directly accesses topology store; extension activation lifecycle
- `src/lib/commandRegistry.ts` -- Module-scoped Map, side-effect registration pattern
- `src/lib/previewRegistry.ts` -- Plain array, no source tagging, no cleanup
- `src/lib/bladeRegistry.ts` -- Reference pattern for Zustand migration (proven)
- `src/extensions/ExtensionAPI.ts` -- coreOverride pattern, cleanup() method
- `src/extensions/gitflow/index.ts` -- Reference: how v1.6.0 extraction used coreOverride
- `src/blades/_discovery.ts` -- EXPECTED_TYPES exhaustiveness check

### v1.6.0 Lessons Learned (HIGH confidence)
- `.planning/research/v1.6.0-PITFALLS.md` -- Extraction pitfalls from Gitflow/CC/Viewers
- `.planning/research/v1.6.0-ARCHITECTURE.md` -- Extension system architecture and patterns

### Zustand Documentation (HIGH confidence)
- Zustand create() is synchronous module-level initialization
- Zustand shallow comparison for selector-based subscriptions
- Zustand slices pattern and cross-slice access via get()
