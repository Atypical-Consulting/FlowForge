# Architecture Research: Extension System Mapping for Toolbar Menus

## 1. Extension System Architecture Overview

### 1.1 Extension Host (`src/extensions/ExtensionHost.ts`)

The extension system is built on a **Zustand store** (`useExtensionHost`) that manages extension lifecycle:

- **Discovery**: Scans `{repoPath}/.flowforge/extensions/` for manifest files (user extensions)
- **Built-in Registration**: `registerBuiltIn(config)` registers bundled extensions
- **Activation**: Creates an `ExtensionAPI` facade per extension, calls `onActivate(api)`
- **Deactivation**: Calls `onDeactivate()`, then `api.cleanup()` for atomic unregistration
- **Status Flow**: `discovered -> activating -> active` (or `error` / `disabled`)

**Key Design**: Extensions never access registries directly. All contributions go through the `ExtensionAPI` facade, which namespaces IDs as `ext:{extensionId}:{itemId}` and tracks all registrations for cleanup.

### 1.2 ExtensionAPI Facade (`src/extensions/ExtensionAPI.ts`)

Each extension receives its own `ExtensionAPI` instance. Available contribution points:

| Method | Registry | Namespacing |
|--------|----------|-------------|
| `registerBlade(config)` | `bladeRegistry` | `ext:{extId}:{type}` (or raw if `coreOverride`) |
| `registerCommand(config)` | `commandRegistry` | `ext:{extId}:{id}` |
| `contributeToolbar(config)` | `toolbarRegistry` | `ext:{extId}:{id}` |
| `contributeContextMenu(config)` | `contextMenuRegistry` | `ext:{extId}:{id}` |
| `contributeSidebarPanel(config)` | `sidebarPanelRegistry` | `ext:{extId}:{id}` |
| `contributeStatusBar(config)` | `statusBarRegistry` | `ext:{extId}:{id}` |
| `onDidGit(op, handler)` | `gitHookBus` | N/A |
| `onWillGit(op, handler)` | `gitHookBus` | N/A |
| `onDidNavigate(handler)` | Navigation actor subscription | N/A |
| `events.emit/on` | `extensionEventBus` | `ext:{extId}:{event}` |
| `settings.get/set` | `tauri-plugin-store` | `ext:{extId}:settings:{key}` |

### 1.3 Existing Registry Architecture

All registries follow the same Zustand store pattern:

```
register(item) -> Map<id, item>
unregister(id) -> delete from Map
unregisterBySource(source) -> bulk delete by source tag
```

Each registry has:
- **Type-safe interfaces** for registration configs
- **Source tracking** (`"core"` or `"ext:{extId}"`)
- **Visibility conditions** via `when()` callbacks
- **Priority-based ordering** for display

---

## 2. Command System Analysis

### 2.1 Command Registry (`src/lib/commandRegistry.ts`)

The command registry is the **central action catalog**. Commands are surfaced in the Command Palette and can be invoked programmatically via `executeCommand(id)`.

**Command interface**:
```typescript
interface Command {
  id: string;
  title: string;
  description?: string;
  category: CommandCategory;  // "Repository" | "Branches" | "Sync" | ... | string
  shortcut?: string;
  icon?: LucideIcon;
  action: () => void | Promise<void>;
  enabled?: () => boolean;
  keywords?: string[];
  source?: string;  // "core" or "ext:{extensionId}"
}
```

**Core categories**: Navigation, Repository, Sync, Branches, Stash, Tags, Worktrees, Settings (ordered).

### 2.2 Existing Core Commands (`src/commands/`)

| File | Commands Registered |
|------|---------------------|
| `repository.ts` | `open-repository`, `close-repository`, `clone-repository`, `refresh-all` |
| `sync.ts` | `push`, `pull`, `fetch`, `stage-all`, `toggle-amend` |
| `branches.ts` | `create-branch` |
| `navigation.ts` | `command-palette` |
| `settings.ts` | `open-settings`, `toggle-theme` |
| `extensions.ts` | `open-extension-manager` |

### 2.3 Extension-Contributed Commands

| Extension | Commands |
|-----------|----------|
| `init-repo` | `ext:init-repo:init-repository` |
| `github` | `ext:github:sign-in`, `ext:github:sign-out`, `ext:github:open-pull-requests`, `ext:github:open-issues`, `ext:github:create-pull-request` |
| `conventional-commits` | `ext:conventional-commits:generate-changelog`, `ext:conventional-commits:open-conventional-commit` |
| `gitflow` | `ext:gitflow:open-gitflow-cheatsheet` |
| `worktrees` | `ext:worktrees:create-worktree`, `ext:worktrees:refresh-worktrees` |

### 2.4 Command Palette (`src/components/command-palette/CommandPalette.tsx`)

The palette reads from `useCommandRegistry`, filters by `enabled()`, groups by category, and supports fuzzy search. This is the primary discovery mechanism for actions.

---

## 3. Toolbar System Analysis

### 3.1 Current Toolbar Architecture

The current toolbar (`src/components/toolbar/Toolbar.tsx`) renders from `useToolbarRegistry`:

**Groups** (left to right): `navigation` | `git-actions` | `views` | `app`

**Core toolbar actions** (`src/commands/toolbar-actions.ts`):
- **App**: `tb:open-repo`, `tb:settings`, `tb:command-palette`, `tb:theme-toggle`
- **Git Actions**: `tb:undo`, `tb:refresh-all`, `tb:fetch`, `tb:pull`, `tb:push`
- **Views**: `tb:repo-browser`
- **Navigation**: `tb:close-repo`, `tb:reveal-in-finder`, `tb:clone-repo`

### 3.2 Toolbar Action Interface

```typescript
interface ToolbarAction {
  id: string;
  label: string;
  icon: LucideIcon;
  group: ToolbarGroup;       // "navigation" | "git-actions" | "views" | "app"
  priority: number;          // Higher = more important = collapses last
  shortcut?: string;
  when?: () => boolean;      // Visibility condition
  execute: () => void | Promise<void>;
  isLoading?: () => boolean;
  source?: string;           // "core" or "ext:{extId}"
  badge?: () => number | string | null;
  renderCustom?: (action, tabIndex) => ReactNode;
}
```

---

## 4. Blade & Navigation System

### 4.1 Blade Registry (`src/lib/bladeRegistry.ts`)

Blades are the primary content panels. The blade registry maps `type -> component + metadata`.

**Core blade types** (`src/stores/bladeTypes.ts`):
`staging-changes`, `topology-graph`, `commit-details`, `diff`, `viewer-*`, `repo-browser`, `settings`, `changelog`, `gitflow-cheatsheet`, `init-repo`, `conventional-commit`, `extension-manager`, `extension-detail`

### 4.2 Navigation Machine (`src/machines/navigation/navigationMachine.ts`)

XState machine managing blade navigation:
- **Processes**: `staging` | `topology` (root blade types)
- **Events**: `PUSH_BLADE`, `POP_BLADE`, `POP_TO_INDEX`, `REPLACE_BLADE`, `RESET_STACK`, `SWITCH_PROCESS`
- **Dirty state**: Tracks unsaved changes and confirms before destructive navigation
- **`openBlade(type, props)`**: Convenience function that resolves title from registry and sends `PUSH_BLADE`

### 4.3 Process Navigation

The `ProcessNavigation` component allows switching between "Changes" (staging) and "History" (topology) views. This maps to `SWITCH_PROCESS` events.

---

## 5. Recommended Architecture for Menu Contribution Points

### 5.1 Approach: Menu Bar as a New Registry

Create a new `menuBarRegistry` following the existing registry pattern. This is the cleanest approach because:

1. **Consistent pattern**: Follows `toolbarRegistry`, `contextMenuRegistry`, `commandRegistry`
2. **Extension-friendly**: Extensions can contribute menu items via `api.contributeMenu()`
3. **Dynamic**: Menu items respond to `when()` visibility conditions
4. **Separates concerns**: Menu structure is independent of toolbar/palette

### 5.2 Proposed Menu Registry Design

```typescript
export type MenuBarLocation = "file" | "view" | "repository" | "branch";

export interface MenuBarItem {
  id: string;
  label: string;
  menu: MenuBarLocation;
  icon?: LucideIcon;
  shortcut?: string;
  group?: string;            // For visual separator groups within a menu
  priority?: number;         // Order within group
  when?: () => boolean;      // Visibility condition
  enabled?: () => boolean;   // Grayed-out condition
  execute: () => void | Promise<void>;
  source?: string;           // "core" or "ext:{extId}"
}
```

### 5.3 Alternative: Reuse Command Registry with Menu Metadata

Instead of a new registry, annotate existing commands with menu placement:

```typescript
interface Command {
  // ... existing fields ...
  menuPlacement?: {
    menu: MenuBarLocation;
    group?: string;
    priority?: number;
  };
}
```

**Pros**: No new registry, commands automatically appear in palette AND menus.
**Cons**: Not all menu items are commands (some are structural), and it couples menu layout to command registration.

### 5.4 Recommendation: Hybrid Approach

**Use the existing command registry as the single source of truth for actions**, but add a thin menu configuration layer that maps command IDs to menu positions:

```typescript
// src/lib/menuBarConfig.ts
interface MenuBarEntry {
  commandId: string;         // Reference to registered command
  menu: MenuBarLocation;
  group: string;             // For grouping with separators
  priority: number;          // Order within group
  overrideLabel?: string;    // Menu-specific label (optional)
}
```

This approach:
- Reuses `enabled()`, `shortcut`, `icon`, and `action` from the command registry
- Allows menu-specific grouping and ordering
- Keeps menu structure declarative and easy to maintain
- Extensions can contribute by both registering a command AND adding a menu entry

---

## 6. Menu Item to Command/Action Mapping

### 6.1 File Menu

| Menu Item | Command ID | Extension | Status | Notes |
|-----------|-----------|-----------|--------|-------|
| New Repository | `ext:init-repo:init-repository` | `init-repo` | Exists | Opens folder picker, then init-repo blade |
| Add Local Repository... | `open-repository` | Core | Exists | `Cmd+O`, opens folder picker |
| Clone Repository... | `clone-repository` | Core | Exists | Opens clone dialog |

### 6.2 View Menu

| Menu Item | Command ID | Extension | Status | Notes |
|-----------|-----------|-----------|--------|-------|
| Show Changes | `show-changes` | Core | **New** | `SWITCH_PROCESS("staging")` |
| Show History | `show-history` | Core | **New** | `SWITCH_PROCESS("topology")` |
| Show Branches List | `show-branches` | Core | **New** | Opens sidebar branches panel or focuses it |

### 6.3 Repository Menu

| Menu Item | Command ID | Extension | Status | Notes |
|-----------|-----------|-----------|--------|-------|
| Fetch | `fetch` | Core | Exists | `Cmd+Shift+F` |
| Pull | `pull` | Core | Exists | `Cmd+Shift+L` |
| Push | `push` | Core | Exists | `Cmd+Shift+U` |
| Stage All | `stage-all` | Core | Exists | `Cmd+Shift+A` |
| Refresh All | `refresh-all` | Core | Exists | Reload branches/stashes/tags |
| Close Repository | `close-repository` | Core | Exists | Close current repo |
| Reveal in File Manager | `reveal-in-finder` | Core | **New** | Already in toolbar but not command |

### 6.4 Branch Menu

| Menu Item | Command ID | Extension | Status | Notes |
|-----------|-----------|-----------|--------|-------|
| Create Branch | `create-branch` | Core | Exists | Opens create branch dialog |

---

## 7. State Management for Menu Enable/Disable

### 7.1 Existing Pattern: `enabled()` Callbacks

The command registry already supports `enabled?: () => boolean`. This pattern should be reused:

```typescript
// Most commands check if a repo is open
enabled: () => !!useRepositoryStore.getState().repoStatus
```

### 7.2 Menu-Specific Visibility

For the menu bar, items need both:
- **`when()`**: Should the item appear at all? (e.g., hide GitHub items if extension disabled)
- **`enabled()`**: Is the item clickable? (e.g., gray out "Push" when no repo open)

The toolbar already implements this dual pattern via `when()` on toolbar actions and `enabled()` on commands.

### 7.3 State Dependencies

| Condition | Store | Selector |
|-----------|-------|----------|
| Repo is open | `useGitOpsStore` | `!!repoStatus` |
| Has remote | `useGitOpsStore` | `repoStatus?.remotes.length > 0` |
| Has staged changes | Query / staging store | staging status |
| Is on staging view | Navigation machine | `activeProcess === "staging"` |
| Is on history view | Navigation machine | `activeProcess === "topology"` |
| Branch exists | `useGitOpsStore` | `branches.length > 0` |

---

## 8. Integration with Existing Systems

### 8.1 Menu Bar Placement in Layout

The `Header` component (`src/components/Header.tsx`) currently renders:
```
[FlowForge logo] [RepoSwitcher] [BranchSwitcher] [ProcessNavigation] ... [Toolbar]
```

The menu bar should be added **between the logo and the repo switcher**, or as a **separate row below the header**:

**Option A: Inline in header** (macOS-style, after the app title)
```
[FlowForge] [File|View|Repository|Branch] [RepoSwitcher] [BranchSwitcher] ... [Toolbar]
```

**Option B: Dedicated menu bar row** (Windows/Linux-style)
```
[File|View|Repository|Branch]                    <- new row
[FlowForge] [RepoSwitcher] [BranchSwitcher] ... [Toolbar]
```

**Recommendation**: Option A (inline) for space efficiency, consistent with modern desktop app patterns.

### 8.2 Keyboard Accelerators

Existing keyboard shortcuts are managed via `react-hotkeys-hook` and the `shortcut` field on commands/toolbar actions. Menu items should display these shortcuts in the menu but NOT register additional hotkey handlers (avoid duplicates).

### 8.3 WelcomeView State

When no repo is open, the menu bar should still show but with most items disabled:
- **File menu**: All items available (Open, Clone, New Repository)
- **View menu**: Disabled (no process to switch)
- **Repository menu**: Disabled (no repo context)
- **Branch menu**: Disabled (no repo context)

This matches the existing `when()` / `enabled()` patterns.

### 8.4 Extension Contribution to Menus

Extensions should be able to add items to existing menus. For example, the GitHub extension might add "Create Pull Request" to the Repository menu:

```typescript
// In github extension's onActivate:
api.contributeMenu({
  id: "create-pr-menu",
  commandId: "ext:github:create-pull-request",
  menu: "repository",
  group: "github",
  priority: 10,
});
```

This requires adding `contributeMenu()` to `ExtensionAPI` alongside the existing contribution methods.

---

## 9. Architecture Diagram

```
                    ┌─────────────────────┐
                    │   Menu Bar Component │
                    │   (reads registry)   │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  Menu Bar Registry   │   ← NEW
                    │  menuBarRegistry.ts  │
                    └─────────┬───────────┘
                              │ references
                    ┌─────────▼───────────┐
                    │  Command Registry    │   ← EXISTING
                    │  commandRegistry.ts  │
                    └─────────┬───────────┘
                              │ execute
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌────────────┐  ┌────────────┐  ┌────────────┐
       │  openBlade  │  │  store     │  │  dialog    │
       │  (navigate) │  │  actions   │  │  events    │
       └────────────┘  └────────────┘  └────────────┘
```

---

## 10. Summary of New Commands Needed

| Command ID | Category | Action | Shortcut |
|------------|----------|--------|----------|
| `show-changes` | Navigation | `SWITCH_PROCESS("staging")` | `Cmd+1` (suggested) |
| `show-history` | Navigation | `SWITCH_PROCESS("topology")` | `Cmd+2` (suggested) |
| `show-branches` | Navigation | Focus/expand branches sidebar panel | `Cmd+3` (suggested) |
| `reveal-in-finder` | Repository | Open OS file manager at repo path | None (toolbar-only today) |

All other menu actions already have registered commands that can be reused directly.

---

## 11. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/menuBarRegistry.ts` | **Create** | New registry store for menu bar configuration |
| `src/extensions/ExtensionAPI.ts` | **Modify** | Add `contributeMenu()` method |
| `src/components/menu-bar/MenuBar.tsx` | **Create** | Menu bar UI component |
| `src/components/menu-bar/MenuBarDropdown.tsx` | **Create** | Individual dropdown menu |
| `src/components/menu-bar/MenuBarItem.tsx` | **Create** | Single menu item (icon, label, shortcut) |
| `src/components/Header.tsx` | **Modify** | Integrate MenuBar into header layout |
| `src/commands/navigation.ts` | **Modify** | Register `show-changes`, `show-history`, `show-branches` |
| `src/commands/repository.ts` | **Modify** | Register `reveal-in-finder` as command |
| `src/commands/menu-items.ts` | **Create** | Core menu bar entries configuration |
