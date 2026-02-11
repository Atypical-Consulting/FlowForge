# Phase 46: Topology Extraction - UX Research

**Researched:** 2026-02-11
**Domain:** Process tab navigation, fallback commit list, settings degradation, keyboard shortcut lifecycle, Extension Manager display, graceful enable/disable UX
**Confidence:** HIGH
**Researcher:** UX Specialist

---

## Summary

The topology extraction (Phase 46) is the most UX-consequential extraction in v1.7.0 because topology owns a **process tab** -- a top-level navigation concept in the XState navigation machine. Unlike worktrees (sidebar panel) or init-repo (blade), disabling topology removes an entire navigation destination. This research documents how every UX surface must degrade gracefully when topology is disabled.

The current codebase already has strong foundations for this: `ProcessNavigation.tsx` already filters the topology tab based on BladeRegistry presence, the settings system has a `defaultTab` with "topology" as an option, and keyboard shortcuts for `Cmd+2` (Show History) are registered in the global `useKeyboardShortcuts` hook.

**Primary recommendation:** Register the topology graph blade via `api.registerBlade()` with `coreOverride: true`, move the `Cmd+2` shortcut and "Show History" command into extension-contributed commands, create a simple fallback commit list blade that auto-registers as the root blade for the "topology" process when the extension is disabled, and ensure settings `defaultTab` falls back to "changes" when topology is disabled.

---

## 1. Current UX Analysis

### 1.1 Topology in the Application Architecture

Topology is deeply woven into FlowForge's navigation model:

| Surface | Location | Current State |
|---------|----------|---------------|
| Process tab | `ProcessNavigation.tsx` (line 10-13) | Two processes: "staging" and "topology" |
| Navigation machine | `navigationMachine.ts` context.activeProcess | `ProcessType = "staging" \| "topology"` |
| Root blade mapping | `actions.ts:rootBladeForProcess()` | "topology" -> `{ type: "topology-graph" }` |
| Blade registration | `topology-graph/registration.ts` | Core blade: type "topology-graph" |
| Keyboard shortcut | `useKeyboardShortcuts.ts` (line 252-262) | `Cmd+2` sends `SWITCH_PROCESS: "topology"` |
| Command palette | `navigation.ts` (line 33-44) | "Show History" command sends `SWITCH_PROCESS: "topology"` |
| Menu bar | `menu-definitions.ts` (line 104-111) | View > History (Cmd+2) via `show-history` command |
| Settings | `settings.slice.ts` (line 15) | `defaultTab: "changes" \| "history" \| "topology"` |
| Settings UI | `GeneralSettings.tsx` (line 3-7) | Three radio-style buttons: Changes, History, Topology |
| File watcher | `App.tsx` (line 265-289) | Auto-refreshes topology when nodes.length > 0 |
| Topology data | `topology.slice.ts` | Zustand slice in GitOpsStore (stays per TOPO-08) |
| Enter key shortcut | `useKeyboardShortcuts.ts` (line 289-303) | Opens commit details for selected topology commit |

### 1.2 The TopologyRootBlade Component

The topology blade (`TopologyRootBlade.tsx`) has its own internal sub-navigation:

```
+----------------------------------+
| [Graph] [History]                |  <- Internal sub-tabs
+----------------------------------+
|                                  |
|  Graph view (TopologyPanel)      |  <- Default: SVG topology graph
|    OR                            |
|  History view (CommitHistory)    |  <- Simple list view
|                                  |
+----------------------------------+
```

The "History" sub-tab inside TopologyRootBlade already renders `CommitHistory` -- the exact same component that will serve as the fallback when the topology extension is disabled. This is a natural reuse.

### 1.3 ProcessNavigation Component (The Process Tab Bar)

`ProcessNavigation.tsx` already has dynamic visibility logic:

```typescript
const ALL_PROCESSES = [
  { id: "staging" as ProcessType, label: "Staging", icon: Files },
  { id: "topology" as ProcessType, label: "Topology", icon: Network },
];

const visibleProcesses = useMemo(
  () => ALL_PROCESSES.filter((p) => p.id === "staging" || blades.has("topology-graph")),
  [blades],
);

useEffect(() => {
  if (activeProcess === "topology" && !blades.has("topology-graph")) {
    actorRef.send({ type: "SWITCH_PROCESS", process: "staging" });
  }
}, [activeProcess, blades, actorRef]);
```

**Critical observation:** ProcessNavigation already checks `blades.has("topology-graph")` to determine whether to show the topology tab. When the topology extension is disabled and the "topology-graph" blade is unregistered, the tab will automatically hide. And if the user was on the topology tab, it auto-switches to staging. This is exactly the behavior TOPO-04 requires.

### 1.4 File Watcher Auto-Refresh (Current Location)

In `App.tsx` (lines 265-289), the file watcher listener includes:

```typescript
// Auto-refresh topology if it has been loaded
const topologyState = useTopologyStore.getState();
if (topologyState.nodes.length > 0) {
  topologyState.loadGraph();
}
```

This topology-specific refresh is currently in App.tsx's global scope. Per TOPO-05, it must move into the topology extension's lifecycle. When the extension is disabled, this listener should not exist (no orphaned event listeners).

---

## 2. Fallback UX Design

### 2.1 The Fallback Commit List Blade

When the topology extension is disabled, the navigation machine can still receive `SWITCH_PROCESS: "topology"` events (from stale state, deep links, etc.). The `rootBladeForProcess("topology")` returns `{ type: "topology-graph" }`, but that blade type will not be registered.

**Two design options for the fallback:**

**Option A: Hide the topology process entirely (TOPO-04 approach)**

ProcessNavigation already hides the topology tab when the blade is not registered. The navigation machine auto-redirects to staging. This means:
- Only one process tab visible: "Staging"
- No fallback commit list needed
- The "history" sub-tab functionality is simply unavailable

**Option B: Keep the process tab, show a simple commit list fallback**

Register a lightweight "topology-graph" blade (without the graph, just the commit list) as a core fallback. When the full extension is active, it overrides this with the rich graph. When disabled, the core fallback remains.

**Recommended: Combination approach (matches requirements TOPO-03 + TOPO-04)**

Per the requirements:
- TOPO-03: "Simple commit list fallback blade renders when Topology extension disabled"
- TOPO-04: "Process tab hides when Topology extension disabled"

These are complementary: the process tab hides (so users do not navigate to topology via the tab bar), but if `rootBladeForProcess("topology")` is somehow invoked, a fallback blade prevents a crash.

**Fallback blade design:**

```
+------------------------------------------+
| Commit History                           |
+------------------------------------------+
| [Search commits...]                      |
| [Author filter dropdown]                 |
+------------------------------------------+
|  fix: resolve merge conflict       abc123|
|    John Doe - 2h ago                     |
|  feat: add user dashboard          def456|
|    Jane Smith - 5h ago                   |
|  ...                                     |
+------------------------------------------+
```

This is simply the `CommitHistory` component wrapped in a blade -- identical to the "History" sub-tab inside TopologyRootBlade. It provides full commit browsing (search, author filter, infinite scroll, commit detail navigation) without the topology graph visualization.

### 2.2 Fallback Blade Implementation Pattern

Following the Phase 45 (Init Repo) pattern where `WelcomeView` checks `blades.has("init-repo")` and shows a fallback:

The fallback approach for topology should be:
1. The extension registers `topology-graph` blade with `coreOverride: true` (same type as core registration)
2. Remove the core `registration.ts` for topology-graph
3. Register a lightweight `commit-list-fallback` blade as the default root for the "topology" process
4. OR: Keep the `rootBladeForProcess("topology")` mapping pointing to `"topology-graph"` and have the BladeRenderer show a fallback when the blade type is not found

**Simplest approach (recommended):** Keep the core `topology-graph/registration.ts` but change it to render the simple `CommitHistory` component (the fallback). The extension then overrides this with the full `TopologyRootBlade` via `coreOverride: true`. When the extension is disabled, the core fallback remains.

Wait -- that would conflict since `registerBlade()` and the extension `api.registerBlade()` both use the same key. The correct pattern is:

1. Remove `topology-graph/registration.ts`
2. The extension registers `topology-graph` blade type with `coreOverride: true`
3. Create a separate core registration for a lightweight `commit-list` blade type
4. Update `rootBladeForProcess("topology")` to use "commit-list" when "topology-graph" is not available
5. OR: The extension registers the blade on activate; when disabled, `rootBladeForProcess` returns a type that resolves to the fallback

**Cleanest approach (matching existing patterns):**

Keep the core `topology-graph/registration.ts` pointing to a simple `CommitHistoryFallbackBlade` component. The extension registers `topology-graph` with `coreOverride: true` -- since `registerBlade()` in BladeRegistry uses `Map.set()`, the extension's registration overwrites the core one. When the extension is deactivated, `api.cleanup()` unregisters the extension's blade, revealing the core fallback underneath.

**Problem:** `api.cleanup()` calls `unregisterBlade("topology-graph")` which removes it entirely from the Map. The core registration is not preserved.

**Correct approach:** Two separate blade types.

1. Keep core registration `topology-graph` pointing to a `CommitHistoryFallbackBlade`
2. Extension registers its rich topology via `coreOverride: true` on `topology-graph` (overwrites core)
3. On deactivation, `unregisterBlade("topology-graph")` removes the extension's version
4. The core version is gone too (Map.delete)

This is the same problem. The solution is:

**Use `registerBlade` with a source distinction.** Looking at the cleanup code:

```typescript
// ExtensionAPI.cleanup():
for (const type of this.registeredBlades) {
  unregisterBlade(type);
}
```

And `unregisterBlade` simply deletes from the Map. There is no "restore previous" mechanism.

**Final recommended approach:**

1. Remove `topology-graph/registration.ts` entirely
2. Extension registers `topology-graph` blade with `coreOverride: true`
3. When extension is disabled, `topology-graph` is unregistered
4. `ProcessNavigation` already detects `!blades.has("topology-graph")` and hides the tab
5. `rootBladeForProcess("topology")` still returns `{ type: "topology-graph" }` but the BladeRenderer must handle a missing registration gracefully
6. For TOPO-03 (fallback commit list): Create a separate core blade `"commit-history"` that wraps `CommitHistory`. `rootBladeForProcess("topology")` returns this type when topology-graph is not in registry.

Actually, looking at `rootBladeForProcess` -- it is a pure function that does not access the registry. It simply returns a static blade descriptor. To make it dynamic:

**Recommended: Make rootBladeForProcess registry-aware.**

```typescript
export function rootBladeForProcess(process: ProcessType): TypedBlade {
  if (process === "staging") {
    return { id: "root", type: "staging-changes", title: "Changes", props: {} };
  }
  // Check if topology-graph blade is registered (extension active)
  const hasTopology = useBladeRegistry.getState().blades.has("topology-graph");
  if (hasTopology) {
    return { id: "root", type: "topology-graph", title: "Topology", props: {} };
  }
  // Fallback: simple commit list
  return { id: "root", type: "commit-history-fallback", title: "History", props: {} };
}
```

Register `commit-history-fallback` as a core blade in `_discovery.ts`.

### 2.3 Fallback Blade Component Design

The fallback blade should be minimal -- just the `CommitHistory` component with blade navigation for commit details:

```typescript
function CommitHistoryFallbackBlade() {
  const { openBlade } = useBladeNavigation();
  const openCommitDetails = (oid: string) => openBlade("commit-details", { oid });

  return (
    <div className="flex flex-col h-full">
      <CommitHistory onCommitSelect={openCommitDetails} />
    </div>
  );
}
```

**UX characteristics:**
- No sub-tabs (graph/history toggle is gone -- only history)
- Full commit search and author filter (inherited from CommitHistory)
- Infinite scroll for commit pagination
- Click to open commit details blade
- Context menu on commits (inherited from CommitHistory)
- Virtualized list (react-virtuoso) for performance

### 2.4 Fallback vs. Full Experience Comparison

| Feature | Full (Extension Enabled) | Fallback (Extension Disabled) |
|---------|-------------------------|-------------------------------|
| Process tab visible | Yes ("Topology" tab) | No (tab hidden) |
| Topology graph visualization | Yes (SVG lane-based graph) | No |
| Commit list view | Yes (sub-tab "History") | Yes (full-screen, same component) |
| Commit search | Yes | Yes |
| Author filter | Yes | Yes |
| Commit details navigation | Yes | Yes |
| Commit context menu | Yes | Yes |
| Lane headers | Yes | No |
| Branch classification | Yes (Gitflow lane colors) | No |
| Load More pagination | Yes (graph + list) | Yes (list only) |
| File watcher auto-refresh | Yes (via extension lifecycle) | No |
| Keyboard shortcut Cmd+2 | Yes (switches to topology process) | No (shortcut unregistered) |
| Enter key on commit | Yes (opens details) | Depends on implementation |
| Settings "default tab: topology" | Yes | Falls back to "changes" |

---

## 3. Tab Navigation Impact

### 3.1 Process Tab Visibility

When topology extension is **enabled**:
```
+-----------+-----------+
| Staging   | Topology  |    <- Two process tabs
+-----------+-----------+
```

When topology extension is **disabled**:
```
+-----------+
| Staging   |                <- Single process tab
+-----------+
```

This is handled entirely by `ProcessNavigation.tsx`'s existing `visibleProcesses` filter. No code changes needed for hiding the tab.

### 3.2 Focus and Transition Behavior

**Scenario: User is on Topology tab, disables extension in Extension Manager**

1. User navigates to Extension Manager blade (pushed on top of topology process stack)
2. User toggles topology extension OFF
3. `deactivateExtension("topology")` runs
4. `api.cleanup()` unregisters `topology-graph` blade
5. `ProcessNavigation`'s `useEffect` fires: `activeProcess === "topology" && !blades.has("topology-graph")`
6. Auto-switches to staging: `actorRef.send({ type: "SWITCH_PROCESS", process: "staging" })`
7. Blade stack resets to `[rootBladeForProcess("staging")]` = staging-changes
8. Extension Manager blade is popped (stack reset)
9. User sees the staging view

**UX issue:** The Extension Manager blade is lost when the process switches. The user just toggled an extension and is now on a completely different view.

**Mitigation:** The Extension Manager is typically opened as a blade on top of the staging process (via command palette or menu). If the user opens it from the staging process, the auto-switch to staging preserves the staging root but still resets the stack (losing the Extension Manager blade).

**Recommended improvement:** Instead of `SWITCH_PROCESS` (which resets the stack), the auto-switch could use `PUSH_BLADE` to navigate to staging root while preserving the Extension Manager context. However, this would create a mixed state (topology process with staging root blade). The simpler approach is to accept the stack reset and show a toast: "Topology extension disabled. Switched to Changes view."

### 3.3 Keyboard Navigation of Process Tabs

Process tabs are standard `<button>` elements with `onClick` handlers. Keyboard navigation (Tab key) cycles through them. With only one process tab visible, the Tab key simply focuses the single "Staging" button.

No accessibility regression: the tab bar adapts naturally.

### 3.4 Tab Order for Keyboard Users

Current tab order (both processes visible):
```
[Staging button] -> [Topology button] -> [sidebar content]
```

With topology disabled:
```
[Staging button] -> [sidebar content]
```

This is a natural reduction. Screen readers will announce one fewer button. No confusion.

---

## 4. Settings Degradation

### 4.1 The defaultTab Setting

The settings slice defines:
```typescript
export interface GeneralSettings {
  defaultTab: "changes" | "history" | "topology";
}
```

Default value: `"changes"`.

The GeneralSettings UI shows three options: Changes, History, Topology.

### 4.2 Current Default Tab Application

In `App.tsx` (lines 136-139):
```typescript
const defaultTab = settings.general.defaultTab;
if (defaultTab === "topology" || defaultTab === "history") {
  getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
}
```

Both "topology" and "history" map to the same process: "topology". This is because the topology root blade has sub-tabs for "graph" and "history".

### 4.3 When Topology Extension is Disabled

If the user had `defaultTab: "topology"` and then disables the topology extension:

1. On next app startup, `initSettings()` loads `defaultTab: "topology"` from store
2. App.tsx sends `SWITCH_PROCESS: "topology"`
3. Navigation machine sets `activeProcess: "topology"`
4. `rootBladeForProcess("topology")` returns fallback commit list (or topology-graph which is not registered)
5. ProcessNavigation detects `!blades.has("topology-graph")` and switches to staging
6. The user's stored preference is silently overridden

**Problems:**
- Flash of fallback before auto-redirect to staging
- User's preference is not updated in the store (it still says "topology")
- Re-enabling the extension restores the preference (which could be surprising)

### 4.4 Recommended Settings Degradation (TOPO-07)

**Option A: Silent fallback (minimal change)**

In `App.tsx`, check if topology extension is active before honoring the default tab:
```typescript
const defaultTab = settings.general.defaultTab;
const topologyAvailable = useBladeRegistry.getState().blades.has("topology-graph");
if ((defaultTab === "topology" || defaultTab === "history") && topologyAvailable) {
  getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
}
```

If topology is not available, the default ("staging") is used. The stored preference is preserved for when the extension is re-enabled.

**Option B: Persistent fallback with notification**

Same as Option A, plus show a toast on first boot when the fallback triggers: "Topology extension is disabled. Using Changes as default view."

**Option C: Reset the preference in the store**

When the topology extension is deactivated, update the setting:
```typescript
// In topology extension's onDeactivate:
const settings = useSettingsStore.getState();
if (settings.settingsData.general.defaultTab === "topology" ||
    settings.settingsData.general.defaultTab === "history") {
  settings.updateSetting("general", "defaultTab", "changes");
}
```

This is invasive and would surprise users who re-enable the extension.

**Recommendation: Option A (silent fallback, preserve stored preference).**

Rationale:
- User intent is preserved: they chose topology as default, and it will be restored when re-enabled
- No surprise preference changes
- Minimal code change
- Consistent with how web apps handle missing features (fallback silently)

### 4.5 Settings UI When Extension is Disabled

The GeneralSettings component currently shows three hardcoded options: Changes, History, Topology.

When the topology extension is disabled, the "History" and "Topology" options should either:
- **Disable with tooltip:** Show as greyed out with a tooltip "Enable the Topology extension to use this option"
- **Hide entirely:** Only show "Changes" option

**Recommendation: Disable with tooltip.**

This is more informative than hiding. The user can see that the option exists but is unavailable, and understands why. This follows the principle of making system state visible.

```typescript
const tabOptions = [
  { value: "changes", label: "Changes", requiresTopology: false },
  { value: "history", label: "History", requiresTopology: true },
  { value: "topology", label: "Topology", requiresTopology: true },
];

// In the render:
const topologyAvailable = useBladeRegistry((s) => s.blades.has("topology-graph"));

{tabOptions.map((option) => {
  const disabled = option.requiresTopology && !topologyAvailable;
  return (
    <button
      key={option.value}
      disabled={disabled}
      title={disabled ? "Enable the Topology extension to use this option" : undefined}
      onClick={() => !disabled && updateSetting("general", "defaultTab", option.value)}
      className={cn(
        "px-4 py-2 rounded-md text-sm transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        // ...existing active/inactive styles
      )}
    >
      {option.label}
    </button>
  );
})}
```

---

## 5. Keyboard Shortcut Lifecycle

### 5.1 Current Topology Shortcuts

| Shortcut | Current Location | Action | TOPO Impact |
|----------|-----------------|--------|-------------|
| `Cmd+2` | `useKeyboardShortcuts.ts` (line 252) | `SWITCH_PROCESS: "topology"` | Must move to extension (TOPO-06) |
| `Enter` | `useKeyboardShortcuts.ts` (line 289) | Open commit details for selected topology commit | Must move to extension |
| `Cmd+2` | `navigation.ts:show-history` command | Same as above (command palette route) | Must move to extension |

### 5.2 Moving Shortcuts to Extension-Contributed Commands

The topology extension should register these via `api.registerCommand()`:

```typescript
api.registerCommand({
  id: "show-history",
  title: "Show History",
  description: "Switch to the topology (history) view",
  category: "Navigation",
  shortcut: "mod+2",
  icon: History,
  action: () => {
    getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
  },
  enabled: () => !!useGitOpsStore.getState().repoStatus,
});
```

**What happens to the shortcut when the extension is disabled:**
1. `api.cleanup()` calls `unregisterCommand("ext:topology:show-history")`
2. The command is removed from the command registry
3. The `Cmd+2` shortcut is no longer registered
4. The command palette no longer shows "Show History"
5. The menu bar still shows "History" under View menu (static definition) but the command does nothing

### 5.3 Shortcut Discoverability Concerns

**Problem:** `Cmd+2` currently works unconditionally (when a repo is open). Users who have built muscle memory for `Cmd+2` will find it stops working when topology is disabled. There is no visual feedback when pressing `Cmd+2` -- it simply does nothing.

**Mitigation options:**

1. **Toast on unrecognized shortcut:** Show a brief toast "Topology extension is disabled" when `Cmd+2` is pressed and the extension is inactive. This requires a global shortcut handler that checks for disabled-extension shortcuts.

2. **Keep a stub shortcut in core:** Register a lightweight "show-history" command in core that checks if topology is available and shows a toast if not:
   ```typescript
   registerCommand({
     id: "show-history",
     title: "Show History",
     shortcut: "mod+2",
     action: () => {
       if (useBladeRegistry.getState().blades.has("topology-graph")) {
         getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
       } else {
         toast.info("Enable the Topology extension to use History view");
       }
     },
   });
   ```
   This keeps the shortcut always registered but with graceful degradation.

3. **Do nothing:** Accept that `Cmd+2` becomes unbound. Advanced users who disable extensions understand that features are removed.

**Recommendation: Option 2 (stub command in core).**

Rationale:
- Provides feedback instead of silence
- `Cmd+2` is a prominent, documented shortcut (in menus, tooltips)
- Matches VS Code's pattern where shortcuts for disabled extensions show "Extension is not enabled"
- The stub command is registered in `navigation.ts` and the extension can override it via `coreOverride`-style command replacement (or simply: the extension replaces the action with the real navigation)

**Implementation detail:** The extension's command registration with the same `id` would need to overwrite the core command. Looking at `registerCommand()`, it uses `Map.set()` which overwrites. When the extension deactivates, it calls `unregisterCommand("ext:topology:show-history")` -- but that is namespaced. The core command `"show-history"` would remain.

So the correct approach is: keep the core `"show-history"` command in `navigation.ts` but make it registry-aware (check if topology-graph blade exists). The extension does NOT re-register this command; instead, it just registers the blade, and the core command automatically works when the blade is present.

### 5.4 Enter Key on Selected Commit

The `Enter` key shortcut currently checks:
```typescript
ctx.activeProcess === "topology" &&
topologyStore.topologySelectedCommit &&
ctx.bladeStack.length === 1
```

This should move to the topology extension's lifecycle. When the extension is disabled:
- `activeProcess` will be "staging" (auto-redirected)
- The condition `activeProcess === "topology"` will never be true
- So the Enter shortcut effectively becomes a no-op for topology
- No harm in leaving it in core, but it's cleaner to move it into the extension

### 5.5 Menu Bar Static Definitions

The `menu-definitions.ts` file has:
```typescript
{ id: "view-history", label: "History", icon: History, shortcut: "mod+2", commandId: "show-history" }
```

This is a static definition. Even when the topology extension is disabled, "History" appears in the View menu. Clicking it invokes `executeCommand("show-history")` which either navigates to topology (if enabled) or shows a toast (with the stub approach).

**Options:**
1. **Leave the menu item always visible:** With the stub command, clicking it shows a toast. This is acceptable -- the menu reflects what shortcuts are available, and the toast explains why it does not work.
2. **Dynamically hide the menu item:** Make menu definitions reactive to extension state. This is more complex and not consistent with how most desktop apps handle menus.

**Recommendation: Leave the menu item visible.** The stub command provides adequate feedback.

---

## 6. Extension Manager Display

### 6.1 Current Extension Count

Currently, App.tsx registers **12** built-in extensions:
1. viewer-code
2. viewer-markdown
3. viewer-3d
4. conventional-commits
5. gitflow
6. worktrees
7. init-repo
8. github
9. viewer-image
10. viewer-nupkg
11. viewer-plaintext
12. welcome-screen

After adding topology, there will be **13** built-in extensions.

TOPO-09 mentions "7 independently toggleable built-in extensions" -- this likely refers to the non-viewer extensions that users would meaningfully toggle (topology, conventional-commits, gitflow, worktrees, init-repo, github, welcome-screen). The viewers are more utility-like.

### 6.2 Extension Category for Topology

Looking at `extensionCategories.ts`, the topology extension should be categorized as `"source-control"`:

```typescript
// Add to EXTENSION_CATEGORIES:
"topology": "source-control",
```

This groups it with "conventional-commits" and "worktrees" -- all Git-related features.

### 6.3 Extension Card Display

The topology extension card in the Extension Manager would show:

```
+-------------------------------------------+
| Topology Graph                      v1.0.0 |
| Built-in                           [ON/OFF] |
| Visualize commit history as a lane graph   |
+-------------------------------------------+
```

The card uses `ExtensionCard` component with:
- Toggle switch (ToggleSwitch component)
- "Built-in" badge
- Version number
- Description from manifest

### 6.4 Toggle UX: Disabling Topology

When the user toggles topology OFF:

1. **Toggle animation:** ToggleSwitch shows loading state (spinning indicator)
2. **Deactivation:** `deactivateExtension("topology")` runs
3. **Toast:** "Topology Graph disabled" (existing `toast.info()` call in ExtensionCard)
4. **Process tab disappears:** If the user was on topology, auto-switch to staging
5. **Settings degrade:** defaultTab falls back silently
6. **Shortcuts degrade:** `Cmd+2` shows toast instead of navigating
7. **File watcher stops refreshing topology:** No orphaned listeners

When the user toggles topology back ON:

1. **Toggle animation:** ToggleSwitch shows loading state
2. **Activation:** `activateExtension("topology")` runs
3. **Toast:** "Topology Graph enabled"
4. **Process tab reappears:** "Topology" tab visible in ProcessNavigation
5. **Settings restore:** defaultTab works again (if user had "topology" stored)
6. **Shortcuts restore:** `Cmd+2` navigates to topology
7. **File watcher resumes:** Extension registers the listener

### 6.5 Special Considerations for Topology in Extension Manager

Unlike other extensions (which add UI), topology **removes core-level navigation** when disabled. The Extension Manager should surface this:

**Option A: Warning badge on the toggle:**
Show a small info icon next to the toggle: "Disabling will hide the Topology tab and History shortcut (Cmd+2)"

**Option B: Confirmation dialog:**
When toggling topology OFF, show a brief confirmation: "Disabling Topology will hide the graph view and History shortcut. You can still view commit history from the Changes view. Continue?"

**Option C: No special treatment:**
Treat it the same as any other extension toggle. The toast "Topology Graph disabled" is sufficient.

**Recommendation: Option C (no special treatment).**

Rationale:
- All built-in extensions have equal standing
- The toggle is easily reversible
- A confirmation dialog adds friction for a low-stakes action
- Consistency: worktrees, gitflow, etc. don't show confirmations either

---

## 7. Patterns from Phase 44 (Worktree) and Phase 45 (Init Repo)

### 7.1 Phase 44 Established Patterns

| Pattern | Worktree Application | Topology Application |
|---------|---------------------|---------------------|
| `registerBuiltIn()` in App.tsx | `id: "worktrees"` | `id: "topology"` |
| `contributeSidebarPanel()` | Sidebar panel with priority 69 | NOT applicable (topology is a process, not a panel) |
| `registerCommand()` | "Create Worktree", "Refresh Worktrees" | "Show History", open commit details |
| `coreOverride: true` | Not used (new panel, not overriding core) | **Required** for blade type "topology-graph" |
| DOM CustomEvent for cross-component communication | `worktree:open-create-dialog` | Not needed |
| Cleanup via `api.cleanup()` | Automatic unregistration of sidebar panel, commands | Automatic unregistration of blade, commands |
| Data slice stays in core | `worktrees.slice.ts` in GitOpsStore | `topology.slice.ts` in GitOpsStore (TOPO-08) |

### 7.2 Phase 45 Established Patterns

| Pattern | Init Repo Application | Topology Application |
|---------|----------------------|---------------------|
| `coreOverride: true` on `registerBlade()` | `type: "init-repo"` preserved for WelcomeView lookup | `type: "topology-graph"` preserved for `rootBladeForProcess` |
| Fallback UI when extension disabled | `GitInitFallbackBanner` with "Run git init" | `CommitHistoryFallbackBlade` with simple commit list |
| BladeRegistry lookup for conditional rendering | `blades.has("init-repo")` in WelcomeView | `blades.has("topology-graph")` in ProcessNavigation |
| Command palette command | "Initialize Repository" under "Repository" category | "Show History" under "Navigation" category |
| Pre-repository activation | registerBuiltIn activates before repo open | Same (topology must register blade at app startup) |
| Store cleanup on deactivate | `api.onDispose(() => store.reset())` | `api.onDispose(() => resetTopology())` optional |

### 7.3 Novel Patterns Unique to Phase 46

| Pattern | Why It Is New | Approach |
|---------|--------------|----------|
| Process tab hiding | No prior extraction removed a top-level navigation target | ProcessNavigation already handles this via BladeRegistry lookup |
| Settings fallback | No prior extraction had a settings preference that depends on the extension | Silent fallback: check registry before honoring defaultTab |
| Keyboard shortcut lifecycle | Prior extractions added new commands; topology MOVES existing core shortcuts | Keep stub command in core, extension overrides behavior when active |
| File watcher migration | Prior extractions did not move global event listeners | Extension uses `api.onDispose()` to register/cleanup Tauri listener |
| Root blade substitution | rootBladeForProcess was always static | Make it registry-aware (check for topology-graph) |

---

## 8. Recommendations

### 8.1 Fallback Commit List (TOPO-03)

1. Create a new core blade `commit-history-fallback` with a simple `CommitHistory` wrapper component
2. Register it in a new `core/blades/commit-history-fallback/registration.ts`
3. Update `rootBladeForProcess("topology")` to return `"commit-history-fallback"` when `"topology-graph"` is not in the BladeRegistry
4. Add `"commit-history-fallback"` to `BladePropsMap` in `bladeTypes.ts`
5. The fallback blade wraps the existing `CommitHistory` component with blade navigation for commit details

### 8.2 Process Tab Hiding (TOPO-04)

No code changes needed in `ProcessNavigation.tsx` -- it already handles this.

Ensure the auto-switch `useEffect` fires a toast: "Topology disabled. Switched to Changes view." This provides feedback to the user about the automatic navigation.

### 8.3 File Watcher Migration (TOPO-05)

Move the topology auto-refresh from `App.tsx` into the extension's `onActivate`:

```typescript
// In topology extension onActivate:
const unlisten = listen<{ paths: string[] }>("repository-changed", (event) => {
  const topologyState = useGitOpsStore.getState();
  if (topologyState.nodes.length > 0) {
    topologyState.loadGraph();
  }
});

api.onDispose(async () => {
  const fn = await unlisten;
  fn();
});
```

Remove the topology-specific lines from `App.tsx`'s file watcher listener.

### 8.4 Keyboard Shortcut as Extension Command (TOPO-06)

1. Modify the core `"show-history"` command in `navigation.ts` to be registry-aware:
   - If `topology-graph` blade is registered, navigate to topology
   - If not, show toast "Enable Topology extension for History view"
2. Move the `Cmd+2` hotkey from `useKeyboardShortcuts.ts` into the `"show-history"` command (it already has `shortcut: "mod+2"`)
3. The core hook `useKeyboardShortcuts` should still register the shortcut, but it should use `executeCommand("show-history")` instead of directly sending `SWITCH_PROCESS`
4. Move the `Enter` key handler (topology commit details) into the extension lifecycle

### 8.5 Settings Default Tab Fallback (TOPO-07)

1. In `App.tsx`, add a BladeRegistry check before honoring `defaultTab`:
   ```typescript
   const topologyAvailable = useBladeRegistry.getState().blades.has("topology-graph");
   if ((defaultTab === "topology" || defaultTab === "history") && topologyAvailable) {
     getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
   }
   ```
2. In `GeneralSettings.tsx`, disable the "History" and "Topology" options when topology-graph is not registered, with a tooltip explaining why
3. Do NOT reset the stored preference -- preserve it for re-enabling

### 8.6 Topology Data Slice Stability (TOPO-08)

`topology.slice.ts` stays in `GitOpsStore`. No changes needed. The extension consumes the store, it does not own the data.

### 8.7 Extension Manager Display (TOPO-09)

1. Add `"topology": "source-control"` to `EXTENSION_CATEGORIES`
2. Register via `registerBuiltIn()` in App.tsx with `id: "topology"`, `name: "Topology Graph"`, `version: "1.0.0"`
3. Extension manifest description: "Visualize commit history as an interactive lane-based graph"
4. No special toggle behavior -- consistent with all other built-in extensions

### 8.8 Extension Entry Point Structure

```
src/extensions/topology/
  index.ts          -- onActivate / onDeactivate
  manifest.json     -- Extension metadata
  README.md         -- Extension documentation
```

The existing component files stay in place:
- `src/core/blades/topology-graph/TopologyRootBlade.tsx` -- imported by extension
- `src/core/blades/topology-graph/components/` -- all topology components stay
- `src/core/hooks/useCommitGraph.ts` -- stays in core (used by topology components)

Only the registration mechanism changes: from core `registration.ts` to extension `api.registerBlade()`.

---

## 9. Common Pitfalls

### Pitfall 1: rootBladeForProcess Returns Unregistered Blade Type

**What goes wrong:** The navigation machine switches to "topology" process, `rootBladeForProcess` returns `{ type: "topology-graph" }`, but the blade is not registered (extension disabled). BladeRenderer cannot find the component and either crashes or shows a blank screen.

**How to avoid:** Make `rootBladeForProcess` registry-aware, returning the fallback blade type when topology-graph is not available. OR: Add a catch-all in BladeRenderer that shows a minimal "Blade not found" fallback.

**Warning signs:** White screen or console error when pressing `Cmd+2` with topology disabled.

### Pitfall 2: File Watcher Listener Leaks After Deactivation

**What goes wrong:** The topology extension registers a Tauri event listener in `onActivate` but fails to clean it up in `onDeactivate` or `api.onDispose()`. After disabling the extension, the listener continues firing and calls `loadGraph()` on every file change, wasting resources.

**How to avoid:** Use `api.onDispose()` to store the unlisten function. Verify by disabling the extension and checking console for "repository-changed" handler activity.

**Warning signs:** Console logs showing topology refresh after extension is disabled; unnecessary Rust IPC calls.

### Pitfall 3: defaultTab "topology" Causes Infinite Redirect Loop

**What goes wrong:** App.tsx sends `SWITCH_PROCESS: "topology"`, ProcessNavigation detects no blade and switches back to "staging", but the defaultTab logic runs again on next render, sending `SWITCH_PROCESS: "topology"` again.

**How to avoid:** The defaultTab logic in `App.tsx` runs in `initSettings().then()` inside a `useEffect` -- it only fires once on mount. There is no loop risk because it is not a reactive render-time check. But verify this assumption.

**Warning signs:** Rapid process tab flickering on app startup with `defaultTab: "topology"` and topology disabled.

### Pitfall 4: Duplicate Command Registration

**What goes wrong:** The extension registers a "show-history" command via `api.registerCommand()`, but the core `navigation.ts` already registers a "show-history" command. Two commands with similar (but differently namespaced) IDs appear in the palette.

**How to avoid:** Use one of two strategies:
- (A) Keep "show-history" in core, make it registry-aware (recommended)
- (B) Remove from core, add to extension with `coreOverride`-style command registration

The recommended approach (A) means the extension does NOT register a duplicate command. The extension only registers the blade and the file watcher listener.

### Pitfall 5: Not Removing the Core registration.ts

**What goes wrong:** Both core `registration.ts` and extension `api.registerBlade()` register `topology-graph`. On activation, the extension overwrites the core registration. On deactivation, it unregisters, removing both. The core registration is gone permanently until page reload.

**How to avoid:** Remove `src/core/blades/topology-graph/registration.ts` entirely. Update `_discovery.ts` EXPECTED_TYPES to remove `"topology-graph"`. The extension owns this blade type.

### Pitfall 6: Settings UI Shows Stale State

**What goes wrong:** User disables topology extension, but GeneralSettings still shows "Topology" as an active option (not greyed out). User selects "Topology" as default tab. On next startup, the preference is ignored.

**How to avoid:** GeneralSettings must subscribe to BladeRegistry to check if `topology-graph` is registered, and disable the options accordingly.

---

## 10. Open Questions

### 10.1 Should the Fallback Commit List Be a Process or Just a Hidden Blade?

**What we know:** TOPO-03 says "simple commit list fallback blade renders" and TOPO-04 says "process tab hides." These seem contradictory -- if the tab hides, when does the fallback render?

**Resolution:** The fallback blade is the root blade for the "topology" process in the navigation machine's internal state. Even though the process tab is hidden, the machine can still be in the "topology" process state (e.g., from a stale preference or deep link). The fallback prevents a crash. Users never see it in normal operation because ProcessNavigation auto-redirects to staging.

### 10.2 Should the Enter Key Shortcut Move to the Extension?

**What we know:** The Enter key handler is topology-specific (checks `activeProcess === "topology"`). When topology is disabled, `activeProcess` will never be "topology" (auto-redirected), so the handler is harmless but dead code.

**Recommendation:** Move it to the extension for code cleanliness, even though leaving it in core is technically safe.

### 10.3 How Should the Menu Bar Handle Disabled Extensions?

**What we know:** `menu-definitions.ts` is static. The "View > History" item references `show-history` command. With the stub approach, clicking it shows a toast.

**What is unclear:** Should we make menu definitions reactive? This would be a significant refactor for a small UX improvement.

**Recommendation:** Leave menu definitions static. The toast feedback is sufficient.

---

## 11. Sources

### Primary (HIGH confidence -- direct code analysis)

- `src/core/blades/_shared/ProcessNavigation.tsx:10-54` -- Process tab bar with topology visibility check
- `src/core/machines/navigation/types.ts:6` -- ProcessType = "staging" | "topology"
- `src/core/machines/navigation/navigationMachine.ts:105-113` -- SWITCH_PROCESS action
- `src/core/machines/navigation/actions.ts:1-18` -- rootBladeForProcess() with static topology mapping
- `src/core/blades/topology-graph/TopologyRootBlade.tsx:1-55` -- Root blade with graph/history sub-tabs
- `src/core/blades/topology-graph/registration.ts:1-10` -- Core blade registration
- `src/core/blades/topology-graph/components/TopologyPanel.tsx:1-188` -- SVG graph panel
- `src/core/blades/topology-graph/components/TopologyEmptyState.tsx:1-47` -- Empty state with "Go to Changes"
- `src/core/components/commit/CommitHistory.tsx:1-236` -- Commit list component (fallback candidate)
- `src/core/hooks/useKeyboardShortcuts.ts:252-303` -- Cmd+2, Enter shortcuts for topology
- `src/core/commands/navigation.ts:33-44` -- "show-history" command registration
- `src/core/stores/domain/preferences/settings.slice.ts:14-16` -- defaultTab type definition
- `src/core/blades/settings/components/GeneralSettings.tsx:1-45` -- Default tab UI
- `src/App.tsx:136-139` -- defaultTab application on startup
- `src/App.tsx:265-289` -- File watcher with topology auto-refresh
- `src/core/stores/domain/git-ops/topology.slice.ts:1-102` -- Topology data slice
- `src/core/hooks/useCommitGraph.ts:1-45` -- useCommitGraph hook
- `src/core/components/menu-bar/menu-definitions.ts:104-111` -- View > History menu item
- `src/extensions/ExtensionHost.ts:336-402` -- registerBuiltIn lifecycle
- `src/extensions/ExtensionAPI.ts:155-548` -- Full API surface including registerBlade, registerCommand, onDispose, cleanup
- `src/core/lib/bladeRegistry.ts:1-137` -- BladeRegistry with register/unregister
- `src/core/stores/bladeTypes.ts:14-62` -- BladePropsMap with "topology-graph" entry
- `src/core/blades/extension-manager/components/ExtensionCard.tsx:1-144` -- Extension toggle UX
- `src/extensions/extensionCategories.ts:1-72` -- Category grouping for Extension Manager

### Secondary (HIGH confidence -- established patterns from prior phases)

- `src/extensions/worktrees/index.tsx:1-69` -- Phase 44 worktree extension (sidebar panel pattern)
- `src/extensions/init-repo/index.ts:1-56` -- Phase 45 init-repo extension (blade + coreOverride pattern)
- `src/extensions/gitflow/index.ts:1-66` -- Gitflow extension (blade + sidebar + toolbar + command)
- `src/extensions/welcome-screen/index.ts:1-19` -- Welcome screen extension (blade + coreOverride)
- `.planning/phases/44-worktree-extraction/44-RESEARCH-UX.md` -- Phase 44 UX research
- `.planning/phases/45-init-repo-extraction/UX-RESEARCH.md` -- Phase 45 UX research

---

## Metadata

**Confidence breakdown:**
- Current topology UX inventory: HIGH -- exhaustive code analysis of all 15+ files
- Process tab navigation impact: HIGH -- ProcessNavigation already has the required logic
- Fallback commit list design: HIGH -- reuses existing CommitHistory component
- Settings degradation: HIGH -- traced through initSettings -> defaultTab -> SWITCH_PROCESS flow
- Keyboard shortcut lifecycle: HIGH -- verified registration/cleanup in ExtensionAPI
- Extension Manager display: HIGH -- follows established patterns from 12 existing built-in extensions
- File watcher migration: HIGH -- clear scope (move topology refresh from App.tsx to extension)
- Pitfall analysis: HIGH -- based on Phase 44/45 lessons and direct dependency analysis
- Open questions: MEDIUM -- some design decisions need validation during implementation

**Research date:** 2026-02-11
**Valid until:** 2026-03-13 (stable internal architecture)
