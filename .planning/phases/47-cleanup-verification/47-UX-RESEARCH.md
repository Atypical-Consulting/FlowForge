# Phase 47: Cleanup & Verification - UX Research

**Researched:** 2026-02-11
**Domain:** Extension system UX, toggle behavior, documentation, cleanup impact
**Confidence:** HIGH (based on direct codebase investigation)

## Summary

Phase 47 is a cleanup and verification phase that must ensure extension toggling feels polished, the Extension Manager scales to 13+ built-in extensions, developer documentation is exemplary, and old scaffolding removal causes zero user-facing regressions. The UX stakes are moderate but meaningful: toggle cycles expose the seams between core and extension code, and any rough edges (jarring layout shifts, ghost state, unclear fallbacks) erode user trust in the extension system as a first-class architectural feature.

The most significant UX finding is that the toggle experience already has a solid foundation -- BladeRenderer shows a graceful fallback when an extension is disabled, ProcessNavigation auto-hides the Topology tab and falls back to staging, and the sidebar panel registry cleanly removes panels on deactivation. However, there are gaps: no transition animations on toggle, core components import UI primitives (ToggleSwitch, PermissionBadge) from the GitHub extension (a coupling smell), and the 3 new extensions (topology, worktrees, init-repo) lack toggle tests entirely. The `_discovery.ts` EXPECTED_TYPES list is flat -- it does not distinguish core from extension blade types.

**Primary recommendation:** Split EXPECTED_TYPES into CORE_TYPES and EXTENSION_TYPES, add toggle tests for all 3 new extensions following the established gitflow/github test pattern, add topology README documentation, and relocate ToggleSwitch/PermissionBadge from `extensions/github/components` to `core/components/ui`.

## UX Research: Phase 47 Cleanup & Verification

### Toggle Experience Patterns

**Confidence: HIGH** (verified through direct code reading)

#### Current Toggle Architecture

The toggle experience is orchestrated across multiple layers:

1. **ExtensionCard** (`src/core/blades/extension-manager/components/ExtensionCard.tsx`): Shows a ToggleSwitch with loading spinner during toggle. Calls `activateExtension`/`deactivateExtension` from the ExtensionHost store. Shows toast notification on success ("X enabled"/"X disabled").

2. **ExtensionHost** (`src/extensions/ExtensionHost.ts`): Manages the full lifecycle -- `activateExtension` creates a fresh `ExtensionAPI`, calls `activate()`, stores refs. `deactivateExtension` calls `onDeactivate()`, then `api.cleanup()` which atomically removes all registrations (blades, commands, toolbar, sidebar, status bar, machines, event bus, git hooks, disposables in LIFO order).

3. **ExtensionAPI.cleanup()** (`src/extensions/ExtensionAPI.ts`): The cleanup is thorough -- 8 distinct cleanup phases, each wrapped in try/catch to prevent cascade failures. Registration arrays are reset to empty after cleanup.

4. **BladeRenderer** (`src/core/blades/_shared/BladeRenderer.tsx`): When a blade type is unregistered (extension disabled), it shows a graceful fallback:
   ```
   [Puzzle icon]
   "This content requires an extension that is currently disabled."
   [Open Extension Manager link]
   ```
   This is reactive -- `useBladeRegistry((s) => s.blades.get(blade.type))` re-evaluates when the registry changes.

5. **ProcessNavigation** (`src/core/blades/_shared/ProcessNavigation.tsx`): Dynamically hides the Topology tab when `topology-graph` blade is not registered. Auto-redirects to staging if user is on topology when it gets disabled.

6. **rootBladeForProcess** (`src/core/machines/navigation/actions.ts`): Falls back to `commit-list-fallback` blade when topology-graph is not registered. This ensures the history process always has a valid root blade.

#### UX Strengths

- **Graceful degradation**: BladeRenderer shows an actionable message, not a crash or blank screen
- **Reactive UI**: Sidebar panels, toolbar actions, and process tabs disappear/appear immediately on toggle
- **State persistence**: Disabled extension IDs persist to tauri-plugin-store, surviving app restarts
- **Toast feedback**: Users get clear "enabled"/"disabled" notifications
- **Loading state**: ToggleSwitch shows a spinner during async activation/deactivation

#### UX Gaps

1. **No transition animations**: When toggling an extension that contributes sidebar panels (e.g., worktrees), the panel instantly appears/disappears. No fade, slide, or collapse animation. This can feel jarring, especially in the sidebar where layout shifts are visible.

2. **No confirmation for disable**: Disabling an extension that owns the currently-viewed blade (e.g., disabling topology while viewing it) silently replaces the content with the fallback. The user gets a toast but no pre-toggle warning. This is acceptable for built-in extensions but could be confusing for first-time users.

3. **Core commands still registered for disabled extensions**: The `show-history` command in `src/core/commands/navigation.ts` checks `blades.has("topology-graph")` before navigating but remains visible in the command palette. The command silently does nothing when topology is disabled. It should either hide or show a disabled state.

4. **Keyboard shortcut `mod+2` conflict**: When topology is disabled, the core `mod+2` shortcut (in `useKeyboardShortcuts.ts`) guards against it with `blades.has("topology-graph")`, but the topology extension also registers its own `mod+2` shortcut for "Show History". When the extension is active, there could be a duplicate shortcut registration.

5. **deactivateAll skips built-in extensions**: The `deactivateAll` method explicitly filters out `ext.builtIn` -- users cannot bulk-disable built-in extensions. This is intentional but should be documented, and the UI should make this clear (perhaps a tooltip explaining why a "Disable All" button does not affect built-in extensions).

#### Topology Toggle Edge Case

The topology toggle has the most complex UX because it involves a process switch:
- **Disable while viewing**: ProcessNavigation detects `activeProcess === "topology" && !blades.has("topology-graph")` and auto-switches to staging. The user sees the staging view instead.
- **Re-enable**: The topology tab reappears in ProcessNavigation. No auto-switch occurs -- user must click it.
- **Fallback blade**: `commit-list-fallback` is a core blade that provides a simple commit list when topology is disabled. It is always registered (via `src/core/blades/commit-list-fallback/registration.ts`).

#### Worktrees Toggle Edge Case

Worktrees contribute a sidebar panel. When disabled:
- The panel disappears from the sidebar (sidebarPanelRegistry.unregisterBySource removes it)
- The "Create Worktree" and "Refresh Worktrees" commands disappear from the palette
- Worktree data remains in `useGitOpsStore` (TOPO-08 pattern: store data survives extension deactivation)
- Re-enable: panel reappears, badge recalculates from existing store data

#### Init-Repo Toggle Edge Case

Init-repo contributes a blade and a command:
- **Disable while viewing init-repo blade**: BladeRenderer shows the "extension disabled" fallback
- The `onDispose` callback resets `useInitRepoStore`, clearing any in-progress form state
- Re-enable: blade type re-registers, user can open it fresh (form state is reset)

### Extension Manager UX

**Confidence: HIGH** (verified through direct code reading)

#### Current Layout

The Extension Manager (`src/core/blades/extension-manager/ExtensionManagerBlade.tsx`) presents extensions in this hierarchy:

1. **Search bar** at top with install button
2. **Installed** section (non-built-in extensions)
3. **Category-grouped built-in sections** using `groupExtensionsByCategory()`:
   - Source Control (conventional-commits, topology, worktrees)
   - Viewers (viewer-3d, viewer-code, viewer-image, viewer-markdown, viewer-nupkg, viewer-plaintext)
   - Integration (github)
   - Workflow (gitflow)
   - Setup (init-repo, welcome-screen)

Each category gets an icon, label, and count badge. Extensions within categories are sorted alphabetically.

#### Category System

The category system (`src/extensions/extensionCategories.ts`) maps extension IDs to categories:

| Category | Extensions | Icon |
|----------|-----------|------|
| Source Control | conventional-commits, topology, worktrees | GitBranch |
| Viewers | viewer-3d, viewer-code, viewer-image, viewer-markdown, viewer-nupkg, viewer-plaintext | Eye |
| Integration | github | Globe |
| Workflow | gitflow | Workflow |
| Setup | init-repo, welcome-screen | FolderOpen |

**Current count: 13 built-in extensions** across 5 categories. This is already a well-organized layout.

#### UX Observations

1. **Category distribution is uneven**: Viewers has 6 extensions, Source Control has 3, and Integration/Workflow each have only 1. This creates visual imbalance -- the Viewers section dominates the list.

2. **No category collapsibility**: With 13+ extensions, the list requires scrolling. Adding collapse/expand per category would help users focus on relevant sections.

3. **Search works well**: Filters by both name and description. Returns immediate results.

4. **ExtensionCard UX is consistent**: Every card shows name, version, built-in badge, description, contribution counts (blades, commands, toolbar), permission badges, toggle switch, and detail chevron. Clicking the card opens the detail blade.

5. **Extension Detail blade is comprehensive**: Shows live contributions (from registries, not just manifest), README documentation (via `extensionReadme.ts` glob loader), status badge, trust level badge, API version, and enable/disable actions.

6. **No "required" indicator**: Some extensions (like welcome-screen) are essentially required for basic functionality. There is no way to indicate this to users, and nothing prevents disabling them.

#### Component Coupling Issue

**Critical finding**: Core UI components import directly from the GitHub extension:
```
src/core/blades/extension-manager/components/ExtensionCard.tsx:
  import { ToggleSwitch } from "../../../../extensions/github/components/ToggleSwitch";
  import { PermissionBadge } from "../../../../extensions/github/components/PermissionBadge";

src/core/blades/extension-detail/ExtensionDetailBlade.tsx:
  import { ToggleSwitch } from "../../../extensions/github/components/ToggleSwitch";

src/core/blades/extension-manager/components/InstallExtensionDialog.tsx:
  import { PermissionBadge } from "../../../../extensions/github/components/PermissionBadge";
```

This means:
- If the GitHub extension is disabled, the ToggleSwitch and PermissionBadge components are still loaded (they are statically imported, not dynamically loaded from the extension API)
- Core functionality (Extension Manager) depends on extension code -- an architectural violation
- These components are generic UI primitives that belong in `src/core/components/ui/`

### Documentation UX

**Confidence: HIGH** (verified through direct code reading)

#### Current Documentation Pattern

Each extension has a README.md that is loaded via `extensionReadme.ts` using Vite's `import.meta.glob`:
```typescript
const readmeFiles = import.meta.glob<string>("./*/README.md", {
  query: "?raw", import: "default", eager: true,
});
```

The README is rendered in the Extension Detail blade using a `MarkdownRenderer` component inside a scrollable container (max 500px height).

#### README Structure Convention

Existing READMEs follow a consistent pattern (verified across conventional-commits, worktrees, init-repo, github, gitflow, welcome-screen):

```markdown
# Extension Name

[1-2 paragraph description]

## File Structure
[Tree diagram of extension directory]

## Blades
[Table: Type | Title | Singleton | Description]

## Commands
[Table: ID | Title | Category | Description]

## Toolbar Actions
[Table: ID | Label | Group | Priority]

## Sidebar Panels (if applicable)
[Table: ID | Title | Default Open]

## Hooks & Stores (if applicable)
[Description of state management]

<details>
<summary>Extension Directory Convention</summary>
[Standard extension directory template]
</details>
```

#### Missing Documentation

- **Topology extension has NO README.md** -- it is the only newly extracted extension without documentation. This is a gap that Phase 47 must fill.
- Worktrees and init-repo already have complete READMs from their extraction phases.

#### Documentation UX for New Contributors

The READMEs serve dual purposes:
1. **In-app documentation**: Rendered in the Extension Detail blade for users
2. **Developer documentation**: File structure and API surface for contributors

For new contributors, the most helpful documentation elements are:
- **File structure tree**: Shows where to find things
- **Contribution tables**: Quick reference for what the extension registers
- **Extension Directory Convention section**: The template at the bottom showing the standard structure

What is **missing** for developer documentation:
1. **How to create a new extension**: No top-level guide explaining the lifecycle (register -> activate -> deactivate -> cleanup)
2. **API reference**: No documentation of `ExtensionAPI` methods beyond JSDoc comments in the source
3. **Toggle behavior contract**: No documentation explaining what should happen when enable/disable is toggled (cleanup expectations, state persistence rules, fallback patterns)
4. **coreOverride documentation**: The `coreOverride` flag on blade registration is used by topology, init-repo, conventional-commits, gitflow, and welcome-screen to register blade types without the `ext:` prefix, but this pattern and its implications are not documented

### Test Scenario Coverage

**Confidence: HIGH** (verified through direct code reading)

#### Existing Test Patterns

| Extension | Test File | Tests | Toggle Coverage |
|-----------|-----------|-------|-----------------|
| ExtensionHost | `__tests__/ExtensionHost.test.ts` | registerBuiltIn, deactivation, re-activation, error recovery | YES - full cycle |
| ExtensionAPI | `__tests__/ExtensionAPI.test.ts` | Registration/cleanup for all contribution types | YES - cleanup coverage |
| GitHub | `__tests__/github.test.ts` | Blade/command/toolbar registration, cleanup, deactivation | YES |
| Conventional Commits | `__tests__/conventional-commits.test.ts` | Blade registration, coreOverride, cleanup | PARTIAL - no re-activation |
| Gitflow | `__tests__/gitflow.test.ts` | Blade/sidebar/toolbar registration, cleanup | PARTIAL - no re-activation |
| Viewer-* | `__tests__/viewer-*.test.ts` | Blade registration, cleanup | PARTIAL |
| **Topology** | **NONE in __tests__/** | Only `TopologyRootBlade.test.tsx` (component test) | **NO** |
| **Worktrees** | **NONE** | No test files at all | **NO** |
| **Init-Repo** | **NONE** | No test files at all | **NO** |

#### Required Toggle Test Scenarios

For each of the 3 new extensions, tests should cover:

**Activation Tests:**
1. `onActivate(api)` registers expected contributions (blades, commands, sidebar panels, toolbar actions)
2. coreOverride blade types are registered without `ext:` prefix (topology, init-repo)
3. Blade registration metadata is correct (lazy, singleton, source)
4. Commands have correct category, icon, enabled conditions

**Cleanup Tests:**
5. `api.cleanup()` removes all registered blade types
6. `api.cleanup()` removes all registered commands
7. `api.cleanup()` removes sidebar panels (worktrees)
8. `api.cleanup()` fires disposables (topology file watcher unlisten, init-repo store reset)

**Deactivation Tests:**
9. `onDeactivate()` does not throw (all 3 are no-ops, cleanup handled by ExtensionAPI)

**Re-Activation Tests (CRITICAL for toggle UX):**
10. After cleanup + re-activation, all contributions re-register correctly
11. No duplicate registrations after toggle cycle
12. State is fresh (e.g., init-repo store reset on disable, topology data persists)

**Edge Case Tests:**
13. Topology: `rootBladeForProcess("topology")` returns `commit-list-fallback` when topology-graph is not registered
14. Topology: ProcessNavigation hides topology tab when blade is unregistered
15. Worktrees: Badge function works correctly when store has data but extension was re-enabled

#### Test Pattern to Follow

The gitflow test (`__tests__/gitflow.test.ts`) is the best template because it tests:
- Blade registration with coreOverride
- Sidebar panel registration with priority and defaultOpen
- Toolbar action registration
- Cleanup removes all registrations
- onDeactivate is a no-op

For topology, the test should additionally mock:
- `@tauri-apps/api/event` (listen function for file watcher)
- `@tauri-apps/plugin-store` (for defaultTab setting)
- Navigation actor (for SWITCH_PROCESS)

### Extensibility UX Patterns

**Confidence: HIGH** (verified through direct code reading)

#### What Makes Extensions Feel First-Class

1. **Registry-driven UI**: All contribution points (blades, commands, toolbar, sidebar, status bar, context menu) are dynamically rendered from registry stores. Extensions don't "inject" into hardcoded layouts -- they register into the same system core features use.

2. **coreOverride pattern**: Built-in extensions that replace core blade types use `coreOverride: true` to register without the `ext:` prefix. This means the blade type `topology-graph` works identically whether it's a core blade or an extension blade. Navigation code doesn't need to know the difference.

3. **Source tracking**: Every registration stores `source: "ext:{extensionId}"` for atomic cleanup. This is consistent across all 7 registry types.

4. **Category system**: Extensions are organized by functional category, not by built-in vs. third-party. This treats all extensions as peers.

5. **Live contribution inspection**: The Extension Detail blade shows contributions from live registries (not just manifest declarations), so users see exactly what an active extension is contributing to the UI.

#### What Undermines First-Class Status

1. **UI components in extension directories**: ToggleSwitch and PermissionBadge live in `extensions/github/components/` but are used by core. This creates a dependency from core -> extension, which is backwards. If GitHub extension code were ever removed, the Extension Manager would break.

2. **Hardcoded process types**: `ProcessNavigation` hardcodes `ALL_PROCESSES = ["staging", "topology"]`. If another extension wanted to contribute a top-level process, it cannot. Processes are not extensible.

3. **EXPECTED_TYPES is flat**: `_discovery.ts` lists all expected blade types in one array with no distinction between core blades and extension-contributed blades. When an extension is disabled, its blade types are legitimately missing from the registry, but the dev-mode check still warns about them.

4. **deactivateAll excludes built-in**: The bulk deactivation intentionally skips `builtIn: true` extensions, but the UI has no "Disable All" button anyway, so this is not user-facing.

5. **No "essential extension" concept**: Extensions like `welcome-screen` (needed for initial app state) and `commit-list-fallback` (needed as topology fallback) have no way to be marked as undisableable.

### Recommendations for Planning

#### CLEAN-01: Empty Source Directory Removal

**Finding**: No empty directories exist at old blade/component locations. The topology-graph, init-repo, and worktree blade directories have already been removed during Phases 43-46. The `src/core/blades/` directory contains only active core blades.

**Recommendation**: Verify with a script that no empty directories exist. This requirement may already be satisfied. Focus verification on:
- `src/core/blades/` -- confirmed clean
- Any lingering imports referencing old paths (grep for old import paths)
- Any dead code in core that referenced extracted components

#### CLEAN-02: _discovery.ts EXPECTED_TYPES Split

**Finding**: `_discovery.ts` has a flat `EXPECTED_TYPES` array with 9 entries:
```typescript
const EXPECTED_TYPES: string[] = [
  "staging-changes", "commit-list-fallback", "commit-details", "diff",
  "branch-manager", "repo-browser", "settings",
  "extension-manager", "extension-detail",
];
```

These are all core blade types. Extension-contributed blade types (topology-graph, init-repo, conventional-commit, changelog, gitflow-cheatsheet, welcome-screen) are NOT in this list. However, the list previously included types that have been extracted but are no longer core.

**Recommendation**: Split into two constants:
```typescript
const CORE_BLADE_TYPES: string[] = [
  "staging-changes", "commit-list-fallback", "commit-details", "diff",
  "branch-manager", "repo-browser", "settings",
  "extension-manager", "extension-detail",
];

const EXTENSION_BLADE_TYPES: string[] = [
  "topology-graph", "init-repo",
  "conventional-commit", "changelog",
  "gitflow-cheatsheet", "welcome-screen",
  // Viewer blades are opened dynamically, not checked here
];
```

The dev-mode check should only warn about missing CORE types. Extension types should only be checked when the corresponding extension is active.

#### CLEAN-03: Toggle Tests for 3 New Extensions

**Finding**: No toggle tests exist for topology, worktrees, or init-repo. The existing test patterns (gitflow.test.ts, github.test.ts, conventional-commits.test.ts) provide a clear template.

**Recommendation**: Create three test files:
1. `__tests__/topology.test.ts` -- test blade (coreOverride), command, disposable (file watcher), store setting interaction
2. `__tests__/worktrees.test.ts` -- test sidebar panel, 2 commands, badge function
3. `__tests__/init-repo.test.ts` -- test blade (coreOverride), command, disposable (store reset)

Each must cover: registration, metadata verification, cleanup, onDeactivate no-op, and re-activation after cleanup.

#### CLEAN-04: Extension Developer Documentation

**Finding**: Topology extension has NO README.md. Worktrees and init-repo already have complete READMEs. All other built-in extensions have READMEs.

**Recommendation**:
1. Create `src/extensions/topology/README.md` following the established convention pattern
2. The README should document: file structure, blade (topology-graph, coreOverride, singleton), command (show-topology, mod+2), disposables (file watcher, defaultTab setting), and the commit-list-fallback relationship

#### Additional UX Recommendations (Beyond Requirements)

**P1 - Relocate shared UI components**: Move `ToggleSwitch` and `PermissionBadge` from `extensions/github/components/` to `core/components/ui/`. Update 4 import paths in core files. This removes the core->extension dependency and is pure refactoring with no user-visible change.

**P2 - Animate sidebar panel toggle**: Use framer-motion (already in the project) to add a slide/fade transition when sidebar panels appear/disappear on extension toggle. This makes the toggle experience feel intentional rather than abrupt.

**P3 - Show "extension disabled" in command palette**: When topology is disabled, the "Show History" command in `src/core/commands/navigation.ts` should either be hidden or show a disabled state with a tooltip explaining why. Currently it silently does nothing.

## Architecture Patterns

### Extension Lifecycle Pattern
```
registerBuiltIn(config)
  -> status: "discovered"
  -> activate(api)
  -> api.registerBlade(), api.registerCommand(), etc.
  -> status: "active"

deactivateExtension(id)
  -> onDeactivate()
  -> api.cleanup() [8-phase cleanup]
  -> status: "disabled"
  -> persistDisabledExtensions()

activateExtension(id) [re-activation]
  -> status: "activating"
  -> builtInConfig.activate(new ExtensionAPI(id))
  -> status: "active"
  -> persistDisabledExtensions()
```

### Toggle-Safe Extension Pattern
```typescript
// Good: State that survives toggle (store data remains)
export async function onActivate(api: ExtensionAPI): Promise<void> {
  api.contributeSidebarPanel({ /* ... */ });
  api.registerCommand({ /* ... */ });
}

// Good: Disposable cleanup (event listeners, subscriptions)
api.onDispose(() => unlisten());

// Good: Store reset on disable (prevents ghost state)
api.onDispose(() => useMyStore.getState().reset());

// Bad: Module-level state that leaks across toggle cycles
let moduleVar = null; // Persists after deactivation!
```

## Common Pitfalls

### Pitfall 1: Ghost State After Toggle
**What goes wrong:** Extension stores retain data from the previous activation, causing stale UI on re-enable.
**Why it happens:** Zustand stores are module-level singletons that outlive extension lifecycle.
**How to avoid:** Register a disposable that resets the store: `api.onDispose(() => store.getState().reset())`. Init-repo does this correctly. Topology intentionally does NOT reset (topology data persists by design -- TOPO-08).
**Warning signs:** After disable+enable, the extension shows data from before the toggle.

### Pitfall 2: Duplicate Registration on Re-enable
**What goes wrong:** Re-activating an extension creates duplicate blade types or commands.
**Why it happens:** `api.cleanup()` wasn't called before re-activation, or the module-level Maps in ExtensionHost weren't cleared.
**How to avoid:** The ExtensionHost already handles this correctly -- it deletes from `extensionApis` and `extensionModules` Maps during deactivation, and `activateExtension` creates a fresh `ExtensionAPI` instance.
**Warning signs:** Two entries in the command palette or toolbar after toggle.

### Pitfall 3: coreOverride Blade Left in Stack
**What goes wrong:** User is viewing a coreOverride blade (e.g., topology-graph) when the extension is disabled. The blade remains in the navigation stack but BladeRenderer shows the fallback.
**Why it happens:** The navigation machine's blade stack is not pruned when blades are unregistered.
**How to avoid:** For process root blades (topology), ProcessNavigation already handles this with the auto-switch effect. For non-root blades (init-repo), the fallback message in BladeRenderer is the correct behavior -- user can navigate back.
**Warning signs:** Stale blade entries in the stack after toggle.

## Sources

### Primary (HIGH confidence)
- Direct codebase reading of all files referenced above
- `src/extensions/ExtensionHost.ts` -- full lifecycle management
- `src/extensions/ExtensionAPI.ts` -- 549 lines, complete registration/cleanup API
- `src/core/blades/_shared/BladeRenderer.tsx` -- fallback behavior
- `src/core/blades/_shared/ProcessNavigation.tsx` -- topology tab visibility
- `src/core/machines/navigation/actions.ts` -- rootBladeForProcess fallback
- `src/extensions/__tests__/*.test.ts` -- existing test patterns
- `src/extensions/*/README.md` -- documentation conventions

## Metadata

**Confidence breakdown:**
- Toggle experience: HIGH -- verified through code reading of all involved components
- Extension Manager UX: HIGH -- verified through direct component reading
- Documentation UX: HIGH -- verified all README files exist/missing
- Test coverage: HIGH -- enumerated all test files, confirmed gaps
- Extensibility patterns: HIGH -- traced registry system end-to-end

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable internal architecture)

## RESEARCH COMPLETE
