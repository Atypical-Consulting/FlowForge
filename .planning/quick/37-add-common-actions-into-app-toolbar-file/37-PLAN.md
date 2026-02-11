---
phase: 37-add-common-actions-into-app-toolbar-file
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/menu-bar/menu-definitions.ts
  - src/components/menu-bar/useMenuBar.ts
  - src/components/menu-bar/MenuItem.tsx
  - src/components/menu-bar/MenuDivider.tsx
  - src/components/menu-bar/MenuDropdown.tsx
  - src/components/menu-bar/MenuBarItem.tsx
  - src/components/menu-bar/MenuBar.tsx
  - src/components/menu-bar/index.ts
  - src/commands/navigation.ts
  - src/components/Header.tsx
  - src/hooks/useKeyboardShortcuts.ts
autonomous: true

must_haves:
  truths:
    - "Menu bar with File, View, Repository, Branch labels is visible in the header between the app title and the repo/branch switchers"
    - "Clicking a menu label opens a dropdown with categorized actions"
    - "Menu items execute existing commands via executeCommand() from the command registry"
    - "Disabled items appear grayed out (not hidden) when no repo is open"
    - "Keyboard navigation works: ArrowLeft/Right between menus, ArrowUp/Down within dropdown, Enter to activate, Escape to close"
    - "Hover-to-switch works: when one menu is open, hovering another trigger opens it immediately"
    - "New keyboard shortcuts Cmd+N, Cmd+Shift+O, Cmd+1, Cmd+2, Cmd+B, Cmd+Shift+N are functional"
  artifacts:
    - path: "src/components/menu-bar/menu-definitions.ts"
      provides: "Static menu structure with 4 menus (File, View, Repository, Branch)"
      contains: "executeCommand"
    - path: "src/components/menu-bar/useMenuBar.ts"
      provides: "Shared hook managing open menu, highlighted index, keyboard navigation"
      exports: ["useMenuBar"]
    - path: "src/components/menu-bar/MenuBar.tsx"
      provides: "Top-level menu bar container with ARIA menubar role"
      exports: ["MenuBar"]
    - path: "src/components/menu-bar/MenuDropdown.tsx"
      provides: "Animated dropdown panel with framer-motion slideDown"
      exports: ["MenuDropdown"]
    - path: "src/components/menu-bar/MenuItem.tsx"
      provides: "Individual menu action row with icon, label, shortcut display"
      exports: ["MenuItem"]
    - path: "src/components/Header.tsx"
      provides: "Updated header layout with MenuBar inserted after app title"
      contains: "MenuBar"
  key_links:
    - from: "src/components/menu-bar/menu-definitions.ts"
      to: "src/lib/commandRegistry.ts"
      via: "executeCommand() calls referencing command IDs"
      pattern: "executeCommand"
    - from: "src/components/menu-bar/MenuBar.tsx"
      to: "src/components/Header.tsx"
      via: "imported and rendered inline"
      pattern: "<MenuBar"
    - from: "src/commands/navigation.ts"
      to: "src/machines/navigation/context.ts"
      via: "SWITCH_PROCESS event for show-changes and show-history commands"
      pattern: "SWITCH_PROCESS"
---

<objective>
Add a desktop-style menu bar to the FlowForge header with File, View, Repository, and Branch dropdown menus that provide discoverable access to all common actions.

Purpose: Users currently rely on the command palette (Cmd+K) or scattered toolbar buttons. A menu bar provides familiar, categorized access to all actions -- matching patterns from GitHub Desktop, GitKraken, and SourceTree.

Output: Complete menu bar component system with 4 dropdown menus, proper ARIA keyboard navigation, Catppuccin theming, and integration into the existing header layout.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/Header.tsx
@src/lib/commandRegistry.ts
@src/commands/navigation.ts
@src/commands/repository.ts
@src/commands/sync.ts
@src/commands/branches.ts
@src/commands/settings.ts
@src/commands/extensions.ts
@src/commands/toolbar-actions.ts
@src/commands/index.ts
@src/hooks/useKeyboardShortcuts.ts
@src/components/navigation/BranchSwitcher.tsx
@src/components/ui/ContextMenu.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Register new navigation commands and keyboard shortcuts</name>
  <files>
    src/commands/navigation.ts
    src/hooks/useKeyboardShortcuts.ts
  </files>
  <action>
**In `src/commands/navigation.ts`** -- add 3 new commands after the existing `command-palette` registration:

1. `show-changes` -- Navigation category, icon `FileText` from lucide-react:
   - Action: `getNavigationActor().send({ type: "SWITCH_PROCESS", process: "staging" })`
   - Import `getNavigationActor` from `../../machines/navigation/context`
   - `enabled: () => !!useRepositoryStore.getState().repoStatus` (import from `../../stores/domain/git-ops`)
   - shortcut: `mod+1`

2. `show-history` -- Navigation category, icon `History` from lucide-react:
   - Action: `getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" })`
   - `enabled: () => !!useRepositoryStore.getState().repoStatus`
   - shortcut: `mod+2`

3. `show-branches` -- Navigation category, icon `GitBranch` from lucide-react:
   - Action: `usePreferencesStore.getState().toggleNavBranchDropdown()` (import from `../../stores/domain/preferences`)
   - `enabled: () => !!useRepositoryStore.getState().repoStatus`
   - shortcut: `mod+b`

**In `src/hooks/useKeyboardShortcuts.ts`** -- add 6 new keyboard shortcuts within `useKeyboardShortcuts()`:

1. `mod+n` -- preventDefault, dispatch `new CustomEvent("init-repository-dialog")`. Note: this triggers the init-repo extension's registered command via `executeCommand("ext:init-repo:init-repository")`. Import `executeCommand` from `../lib/commandRegistry` and call it directly instead.
2. `mod+shift+o` -- preventDefault, dispatch `new CustomEvent("clone-repository-dialog")` (same event as clone-repository command)
3. `mod+1` -- preventDefault, enabled when `!!status`, send `SWITCH_PROCESS("staging")` to navigation actor
4. `mod+2` -- preventDefault, enabled when `!!status`, send `SWITCH_PROCESS("topology")` to navigation actor
5. `mod+b` -- preventDefault, enabled when `!!status`, call `executeCommand("show-branches")` (or inline: toggle branch dropdown from preferences store)
6. `mod+shift+n` -- preventDefault, enabled when `!!status`, dispatch `new CustomEvent("create-branch-dialog")` (same event as create-branch command)
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` -- no new type errors. Verify the new command IDs exist: search for `"show-changes"`, `"show-history"`, `"show-branches"` in navigation.ts.
  </verify>
  <done>
Six new keyboard shortcuts registered in useKeyboardShortcuts. Three new commands (`show-changes`, `show-history`, `show-branches`) registered in command registry and visible in Command Palette.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create menu definition types and static menu structure</name>
  <files>
    src/components/menu-bar/menu-definitions.ts
  </files>
  <action>
Create `src/components/menu-bar/menu-definitions.ts` with the following:

**Types:**
```typescript
import type { LucideIcon } from "lucide-react";

export interface MenuItemDef {
  type: "action";
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;        // Display-only shortcut hint (e.g., "mod+o")
  commandId: string;        // Command registry ID to execute
  enabled?: () => boolean;  // Override enabled check (falls back to command's enabled)
}

export interface MenuDividerDef {
  type: "divider";
  id: string;
}

export type MenuEntryDef = MenuItemDef | MenuDividerDef;

export interface MenuDef {
  id: string;
  label: string;
  items: MenuEntryDef[];
}
```

**Menu definitions array** (`export const menuDefinitions: MenuDef[]`):

**File menu** (id: "file"):
- New Repository... | icon: `FolderPlus` | shortcut: `mod+n` | commandId: `ext:init-repo:init-repository`
- Open Repository... | icon: `FolderOpen` | shortcut: `mod+o` | commandId: `open-repository`
- Clone Repository... | icon: `GitFork` | shortcut: `mod+shift+o` | commandId: `clone-repository`
- divider
- Close Repository | icon: `X` | commandId: `close-repository`
- divider
- Preferences... | icon: `Settings` | shortcut: `mod+,` | commandId: `open-settings`

**View menu** (id: "view"):
- Changes | icon: `FileText` | shortcut: `mod+1` | commandId: `show-changes`
- History | icon: `History` | shortcut: `mod+2` | commandId: `show-history`
- divider
- Browse Repository | icon: `FolderTree` | shortcut: `mod+b` | commandId: `show-branches` -- Actually wait, "Browse Repository" should reference a different action. Let me correct:
  - Show Branches | icon: `GitBranch` | shortcut: `mod+b` | commandId: `show-branches`
- divider
- Command Palette | icon: `Search` | shortcut: `mod+k` | commandId: `command-palette`
- Toggle Theme | icon: `Sun` | commandId: `toggle-theme`
- Extension Manager | icon: `Puzzle` | commandId: `open-extension-manager`

**Repository menu** (id: "repository"):
- Fetch | icon: `CloudDownload` | shortcut: `mod+shift+f` | commandId: `fetch`
- Pull | icon: `ArrowDown` | shortcut: `mod+shift+l` | commandId: `pull`
- Push | icon: `ArrowUp` | shortcut: `mod+shift+u` | commandId: `push`
- divider
- Stage All | icon: `FileCheck` | shortcut: `mod+shift+a` | commandId: `stage-all`
- Toggle Amend | icon: `RotateCcw` | shortcut: `mod+shift+m` | commandId: `toggle-amend`
- divider
- Refresh All | icon: `RefreshCw` | commandId: `refresh-all`

**Branch menu** (id: "branch"):
- New Branch... | icon: `GitBranch` | shortcut: `mod+shift+n` | commandId: `create-branch`

Import all icons from `lucide-react`. Each menu item's `commandId` must exactly match an existing registered command ID in the command registry.

Also export a helper function:
```typescript
export function getMenuItemCommand(item: MenuItemDef): Command | undefined {
  return getCommandById(item.commandId);
}
```
Import `getCommandById` from `../../lib/commandRegistry`.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` -- no type errors from the new file. Verify all `commandId` values match existing registered command IDs by searching the codebase.
  </verify>
  <done>
Static menu definitions file exists with 4 menus containing all specified items, proper types, and correct command ID references. No new registry or store needed -- purely declarative config.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create useMenuBar hook for state management and keyboard navigation</name>
  <files>
    src/components/menu-bar/useMenuBar.ts
  </files>
  <action>
Create `src/components/menu-bar/useMenuBar.ts` implementing the ARIA menubar keyboard pattern.

**State:**
- `activeMenu: string | null` -- which menu dropdown is currently open (menu id or null)
- `highlightedIndex: number` -- index of focused item within the open dropdown (-1 = none)

**Exported hook `useMenuBar(menuIds: string[])`** returns:
```typescript
interface UseMenuBarReturn {
  activeMenu: string | null;
  highlightedIndex: number;
  openMenu: (menuId: string) => void;
  closeMenu: () => void;
  toggleMenu: (menuId: string) => void;
  handleTriggerKeyDown: (e: React.KeyboardEvent, menuId: string) => void;
  handleItemKeyDown: (e: React.KeyboardEvent, itemCount: number) => void;
  handleTriggerMouseEnter: (menuId: string) => void;
  setHighlightedIndex: (index: number) => void;
}
```

**Behavior:**
- `openMenu(id)`: sets `activeMenu = id`, resets `highlightedIndex = 0`
- `closeMenu()`: sets `activeMenu = null`, `highlightedIndex = -1`
- `toggleMenu(id)`: if `activeMenu === id` then close, else open
- `handleTriggerMouseEnter(id)`: if `activeMenu !== null && activeMenu !== id`, open the new menu (hover-to-switch behavior; only switches when a menu is already open)
- `handleTriggerKeyDown(e, menuId)`:
  - `ArrowDown` / `Enter` / `Space`: prevent default, open menu
  - `ArrowRight`: prevent default, cycle to next menu trigger in `menuIds` (wrap around)
  - `ArrowLeft`: prevent default, cycle to previous menu trigger in `menuIds` (wrap around)
  - `Escape`: close menu
- `handleItemKeyDown(e, itemCount)`:
  - `ArrowDown`: prevent default, move highlight down (min clamped at 0, max at `itemCount - 1`)
  - `ArrowUp`: prevent default, move highlight up
  - `Enter` / `Space`: prevent default (the MenuItem component handles the actual click)
  - `Escape`: prevent default, close menu
  - `ArrowRight`: prevent default, cycle to next menu trigger (close current, open next)
  - `ArrowLeft`: prevent default, cycle to previous menu trigger
  - `Home`: highlight first item
  - `End`: highlight last item

**Click-outside handling:**
Add a `useEffect` that listens for `mousedown` on `document`. Accept a `containerRef: React.RefObject<HTMLElement>` parameter. If the click target is outside the container ref, close the menu. Only attach listener when `activeMenu !== null`.

The hook should also close the menu when the command palette opens. Add an effect watching `useUIStore.getState().paletteIsOpen` -- import from `../../stores/domain/ui-state`. When palette opens and a menu is active, close the menu. Use `useUIStore` Zustand subscription (via `useEffect` + `useUIStore.subscribe`) to react to palette open state changes.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` -- no type errors. Verify the hook exports correctly.
  </verify>
  <done>
`useMenuBar` hook manages open/close state, keyboard navigation between triggers and within dropdowns, hover-to-switch, click-outside dismissal, and auto-close when command palette opens.
  </done>
</task>

<task type="auto">
  <name>Task 4: Create MenuItem, MenuDivider, and MenuDropdown components</name>
  <files>
    src/components/menu-bar/MenuItem.tsx
    src/components/menu-bar/MenuDivider.tsx
    src/components/menu-bar/MenuDropdown.tsx
  </files>
  <action>
**`src/components/menu-bar/MenuItem.tsx`:**

A button element with `role="menuitem"`. Props:
```typescript
interface MenuItemProps {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  isHighlighted?: boolean;
  onClick: () => void;
}
```

Rendering:
- Full-width button: `w-full flex items-center gap-3 px-3 py-1.5 text-sm text-left transition-colors`
- Normal state: `text-ctp-text`
- Highlighted/hover: `bg-ctp-surface0` (apply when `isHighlighted` OR `:hover`)
- Disabled: `text-ctp-overlay0 cursor-default` with `aria-disabled="true"` -- do NOT use `disabled` attribute (so screen readers still see it), instead guard `onClick` with a disabled check
- Icon: `<Icon className="w-4 h-4 text-ctp-overlay1 shrink-0" />` (use `text-ctp-surface2` when disabled)
- Label: `<span className="flex-1">{label}</span>`
- Shortcut: `<span className="text-xs text-ctp-subtext0 font-mono ml-auto pl-4">{formatShortcut(shortcut)}</span>` -- import `formatShortcut` from `../../hooks/useKeyboardShortcuts`
- Use `cn()` from `../../lib/utils` for conditional classes
- When clicked (and not disabled): call `onClick()`

**`src/components/menu-bar/MenuDivider.tsx`:**

Simple: `<div role="separator" className="my-1 border-t border-ctp-surface0" />`

**`src/components/menu-bar/MenuDropdown.tsx`:**

An animated container using framer-motion `AnimatePresence` + `motion.div`. Props:
```typescript
interface MenuDropdownProps {
  items: MenuEntryDef[];
  highlightedIndex: number;
  onItemClick: (item: MenuItemDef) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSetHighlightedIndex: (index: number) => void;
}
```

Use `slideDown` variants matching the BranchSwitcher pattern:
```typescript
const slideDown = {
  hidden: { opacity: 0, y: -8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.15, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.1, ease: "easeIn" } },
};
```

Container styling: `absolute top-full left-0 z-50 mt-1 min-w-[220px] py-1 bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl shadow-black/20`

Add `role="menu"` to the container. Add `onKeyDown` handler to the container div.

For each item in `items`:
- If `type === "divider"`: render `<MenuDivider />`
- If `type === "action"`: render `<MenuItem />` with:
  - `disabled`: resolve from `getCommandById(item.commandId)?.enabled?.() ?? true` -- if the command has `enabled()` and it returns false, the item is disabled. Also check if the command exists at all.
  - `isHighlighted`: true when the item's action-index matches `highlightedIndex` (skip dividers when counting action indices)
  - `onClick`: calls `onItemClick(item)`
  - `onMouseEnter`: calls `onSetHighlightedIndex(actionIndex)` so mouse hover updates keyboard highlight

Import `getCommandById` from `../../lib/commandRegistry`.

Use `useReducedMotion()` from framer-motion. If reduced motion is preferred, set animation duration to 0.

Focus the dropdown container (or the first enabled menu item) on mount using a `useEffect` with a ref.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` -- no type errors. All three files compile cleanly.
  </verify>
  <done>
Three leaf components exist: MenuItem renders action rows with icon/label/shortcut/disabled states; MenuDivider renders separators; MenuDropdown renders an animated container that maps menu definition entries to the appropriate leaf components.
  </done>
</task>

<task type="auto">
  <name>Task 5: Create MenuBarItem and MenuBar container, wire into Header</name>
  <files>
    src/components/menu-bar/MenuBarItem.tsx
    src/components/menu-bar/MenuBar.tsx
    src/components/menu-bar/index.ts
    src/components/Header.tsx
  </files>
  <action>
**`src/components/menu-bar/MenuBarItem.tsx`:**

The trigger button for each menu. Props:
```typescript
interface MenuBarItemProps {
  label: string;
  menuId: string;
  isOpen: boolean;
  items: MenuEntryDef[];
  highlightedIndex: number;
  onToggle: () => void;
  onMouseEnter: () => void;
  onTriggerKeyDown: (e: React.KeyboardEvent) => void;
  onItemClick: (item: MenuItemDef) => void;
  onItemKeyDown: (e: React.KeyboardEvent) => void;
  onSetHighlightedIndex: (index: number) => void;
}
```

Renders a `<div className="relative">` containing:
1. A `<button>` trigger:
   - `role="menuitem"` (within the menubar context)
   - `aria-haspopup="menu"`
   - `aria-expanded={isOpen}`
   - `tabIndex={isOpen ? 0 : -1}` (roving tabindex -- the MenuBar will manage which trigger has tabIndex 0)
   - Classes: `px-3 py-1 text-sm rounded-md transition-colors`
   - Default: `text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text`
   - When open: `bg-ctp-surface0 text-ctp-text`
   - `onClick` -> `onToggle()`
   - `onMouseEnter` -> `onMouseEnter()`
   - `onKeyDown` -> `onTriggerKeyDown(e)`

2. Conditional `<AnimatePresence>` wrapping `<MenuDropdown>` when `isOpen` is true. Pass `items`, `highlightedIndex`, `onItemClick`, `onItemKeyDown`, and `onSetHighlightedIndex`.

**`src/components/menu-bar/MenuBar.tsx`:**

The top-level container. It:
1. Imports `menuDefinitions` from `./menu-definitions`
2. Creates a `containerRef = useRef<HTMLElement>(null)`
3. Calls `useMenuBar(menuDefinitions.map(m => m.id))` with the container ref
4. Renders:
```tsx
<nav ref={containerRef} role="menubar" aria-label="Application menu" className="flex items-center">
  {menuDefinitions.map(menu => (
    <MenuBarItem
      key={menu.id}
      label={menu.label}
      menuId={menu.id}
      isOpen={activeMenu === menu.id}
      items={menu.items}
      highlightedIndex={activeMenu === menu.id ? highlightedIndex : -1}
      onToggle={() => toggleMenu(menu.id)}
      onMouseEnter={() => handleTriggerMouseEnter(menu.id)}
      onTriggerKeyDown={(e) => handleTriggerKeyDown(e, menu.id)}
      onItemClick={(item) => { executeCommand(item.commandId); closeMenu(); }}
      onItemKeyDown={(e) => handleItemKeyDown(e, menu.items.filter(i => i.type === "action").length)}
      onSetHighlightedIndex={setHighlightedIndex}
    />
  ))}
</nav>
```

Import `executeCommand` from `../../lib/commandRegistry`.

For `onItemClick`: first close the menu, then execute the command. Guard with a check: only execute if the command exists and is enabled.

**Roving tabindex:** The first trigger in the menubar should have `tabIndex={0}`, all others `tabIndex={-1}`. When ArrowRight/Left moves focus, update which trigger has tabIndex 0. Manage this in MenuBar by tracking a `focusedTriggerIndex` state or by letting `useMenuBar` handle it. The simplest approach: pass a `tabIndex` prop to each `MenuBarItem` -- the one matching the current focused trigger index gets 0, others get -1. Default focused trigger index is 0.

**`src/components/menu-bar/index.ts`:**
```typescript
export { MenuBar } from "./MenuBar";
```

**`src/components/Header.tsx`:**

Import `MenuBar` from `./menu-bar`.

In the JSX, insert `<MenuBar />` after the `<h1>FlowForge</h1>` and its divider, but BEFORE the repo/branch switchers. The menu bar should be **always visible** (not gated behind `status`). Update the layout:

```tsx
<div className="flex items-center gap-2">
  <h1 className="text-lg font-semibold text-ctp-text">FlowForge</h1>
  <div className="w-px h-6 bg-ctp-surface1" />
  <MenuBar />
  {status && (
    <>
      <div className="w-px h-6 bg-ctp-surface1" />
      <RepoSwitcher onSelectRepo={handleRepoSwitch} />
      <BranchSwitcher onSelectBranch={handleBranchSwitch} />
    </>
  )}
  {status && <ProcessNavigation className="ml-4" />}
</div>
```

Note the divider between "FlowForge" and MenuBar is always visible, and a second divider between MenuBar and RepoSwitcher only appears when a repo is open.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` -- no type errors.
Run `npm run build 2>&1 | tail -20` -- build succeeds.
Verify by reading Header.tsx that `<MenuBar />` is rendered in the correct position.
  </verify>
  <done>
Complete menu bar system is integrated into the header. MenuBar renders 4 dropdown menus (File, View, Repository, Branch). Each menu item executes its mapped command via executeCommand(). Keyboard navigation follows ARIA menubar pattern. Hover-to-switch works between menus. Click-outside and Escape close open menus. Disabled items are grayed out when commands report disabled state. All 6 new keyboard shortcuts are registered and functional.
  </done>
</task>

</tasks>

<verification>
1. **Visual**: App header shows "FlowForge | File View Repository Branch | [RepoSwitcher] [BranchSwitcher] ..."
2. **Click File menu**: Dropdown shows New Repository, Open Repository, Clone Repository, Close Repository (grayed if no repo), Preferences -- with correct icons and shortcut hints
3. **Click View menu**: Shows Changes, History, Show Branches, Command Palette, Toggle Theme, Extension Manager
4. **Click Repository menu**: Shows Fetch, Pull, Push, Stage All, Toggle Amend, Refresh All -- all grayed when no repo open
5. **Click Branch menu**: Shows New Branch -- grayed when no repo open
6. **Keyboard**: Tab to menu bar, ArrowRight/Left between triggers, ArrowDown opens dropdown, ArrowUp/Down navigates items, Enter activates, Escape closes
7. **Hover-to-switch**: Open File, hover over View -- View opens immediately
8. **Shortcuts**: Cmd+N opens init-repo, Cmd+Shift+O opens clone dialog, Cmd+1 switches to Changes, Cmd+2 to History, Cmd+B opens branch dropdown, Cmd+Shift+N opens create branch dialog
9. **Command palette integration**: Opening Command Palette while a menu is open closes the menu
10. **Type-check**: `npx tsc --noEmit` passes (ignoring pre-existing bindings.ts error)
11. **Build**: `npm run build` succeeds
</verification>

<success_criteria>
- Menu bar is visible in header with 4 menu triggers: File, View, Repository, Branch
- All menu items correctly map to existing commands via executeCommand()
- Items are disabled (grayed, not hidden) when their command's enabled() returns false
- Full ARIA menubar keyboard navigation works (roving tabindex on triggers, arrow keys within dropdowns)
- Hover-to-switch between open menus works
- 6 new keyboard shortcuts (Cmd+N, Cmd+Shift+O, Cmd+1, Cmd+2, Cmd+B, Cmd+Shift+N) are functional
- 3 new commands (show-changes, show-history, show-branches) appear in Command Palette
- Catppuccin-themed styling matches existing dropdown patterns (BranchSwitcher, ContextMenu)
- slideDown animation with reduced-motion support
- Click-outside and Escape correctly dismiss open menus
- TypeScript compiles, app builds successfully
</success_criteria>

<output>
After completion, create `.planning/quick/37-add-common-actions-into-app-toolbar-file/37-SUMMARY.md`
</output>
