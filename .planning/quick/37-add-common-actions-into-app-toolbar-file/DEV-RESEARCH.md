# Dev Research: Toolbar Menu Implementation

## 1. Current Toolbar Component Analysis

### Header Layout (`src/components/Header.tsx`)

The app header is a `<header>` element at `h-14` with:
- **Left side**: App title "FlowForge", repo switcher, branch switcher, process navigation
- **Right side**: `<Toolbar />` component (icon-only action buttons)

```
+------------------------------------------------------------------+
| FlowForge | [RepoSwitcher] [BranchSwitcher] [Nav] ... [Toolbar]  |
+------------------------------------------------------------------+
```

The new menu bar should be inserted **between** the app title and the repo/branch switchers. This creates the standard desktop app layout:

```
+------------------------------------------------------------------+
| FlowForge | File  View  Repository  Branch | [Repo] [Branch] ... |
+------------------------------------------------------------------+
```

### Existing Toolbar System (`src/lib/toolbarRegistry.ts`)

The toolbar uses a **registry pattern** with Zustand:
- `ToolbarAction` objects with `id`, `label`, `icon`, `group`, `priority`, `when()`, `execute()`, `isLoading()`
- Groups: `"navigation"`, `"git-actions"`, `"views"`, `"app"`
- Registered via side-effect imports in `src/commands/toolbar-actions.ts`
- Supports overflow menu, roving tabindex, visibility settings

The new menu bar is **not** a toolbar replacement. It is a **complementary component** that provides categorized dropdown menus. The existing icon toolbar stays on the right.

### Existing Dropdown Patterns

Two dropdown patterns already exist:

1. **BranchSwitcher** (`src/components/navigation/BranchSwitcher.tsx`):
   - Uses `AnimatePresence` + `motion.div` with `slideDown` variants
   - Click-outside dismissal via `document.addEventListener("click")`
   - Keyboard navigation with `ArrowUp`/`ArrowDown`/`Enter`/`Escape`
   - Container ref with `containerRef.current.contains()`

2. **ToolbarOverflowMenu** (`src/components/toolbar/ToolbarOverflowMenu.tsx`):
   - Simpler: `useState(open)` toggle
   - Click-outside via `mousedown` listener
   - Escape to close, returns focus to trigger
   - `role="menu"` + `role="menuitem"` pattern

3. **ContextMenu** (`src/components/ui/ContextMenu.tsx`):
   - Portal-based (`createPortal`)
   - Groups with dividers
   - `role="menu"` + `role="menuitem"`
   - Keyboard: Escape, focus-first on mount
   - Catppuccin styled: `bg-ctp-mantle border-ctp-surface0 rounded-lg shadow-xl`

## 2. Custom React Menus vs Tauri Native Menus

### Recommendation: Custom React Menus

**Rationale:**

1. **No existing Tauri menu setup**: `src-tauri/src/lib.rs` does not configure any native `Menu`. The app uses a standard Tauri window without native titlebar menus. Adding native menus would require Rust-side changes.

2. **Consistency**: All existing UI (toolbar, context menus, command palette) is custom React. A custom menu bar stays visually consistent with the Catppuccin theme.

3. **Extensibility**: The existing command/toolbar registries allow dynamic actions from extensions. Native menus cannot be updated reactively from React state.

4. **Cross-platform parity**: Custom menus look identical on macOS, Windows, and Linux. Native menus vary by platform.

5. **Existing patterns**: The codebase already has dropdown/menu patterns in `BranchSwitcher`, `ToolbarOverflowMenu`, and `ContextMenu` that can be reused.

**Trade-offs accepted:**
- Must implement keyboard navigation manually (but patterns exist)
- Must handle focus trapping (but patterns exist)
- No OS-level menu bar integration (acceptable for a Tauri app)

## 3. Component Structure

### Component Hierarchy

```
Header.tsx
  +-- MenuBar                    (new: horizontal menu bar container)
  |     +-- MenuBarItem          (new: "File", "View", etc. trigger)
  |     |     +-- MenuDropdown   (new: dropdown panel with items)
  |     |           +-- MenuItem (new: clickable action row)
  |     |           +-- MenuDivider (new: visual separator)
  |     +-- MenuBarItem
  |           +-- MenuDropdown
  |                 +-- MenuItem
  |                 +-- ...
  +-- RepoSwitcher
  +-- BranchSwitcher
  +-- Toolbar
```

### File Structure

```
src/components/menu-bar/
  MenuBar.tsx              # Container, manages which menu is open
  MenuBarItem.tsx          # Individual menu trigger button
  MenuDropdown.tsx         # Dropdown panel (animated, positioned)
  MenuItem.tsx             # Individual menu action (icon, label, shortcut)
  MenuDivider.tsx          # Horizontal separator line
  useMenuBar.ts            # Shared state hook (open menu, keyboard nav)
  menu-definitions.ts      # Static menu structure definitions
```

### Key Design Decisions

1. **State management**: Use local `useState` in `MenuBar` for which menu is open (no Zustand store needed). Pass down via context or props.

2. **Menu definitions**: Define menu structure in `menu-definitions.ts`, referencing `executeCommand()` from `commandRegistry` for actions. This keeps menu items DRY with command palette actions.

3. **Hover-to-switch**: When one menu is open and user hovers another trigger, switch immediately (standard desktop behavior).

4. **Single-open**: Only one dropdown can be open at a time.

## 4. Detailed Component Specifications

### MenuBar

```tsx
// Container with ARIA menubar role
// Manages: activeMenu state, click-outside, escape handling
<nav role="menubar" aria-label="Application menu" className="flex items-center">
  <MenuBarItem label="File" menuId="file" ... />
  <MenuBarItem label="View" menuId="view" ... />
  <MenuBarItem label="Repository" menuId="repository" ... />
  <MenuBarItem label="Branch" menuId="branch" ... />
</nav>
```

### MenuBarItem

```tsx
// Trigger button + conditional dropdown
<div className="relative">
  <button
    role="menuitem"
    aria-haspopup="menu"
    aria-expanded={isOpen}
    className="px-3 py-1.5 text-sm text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text rounded-md transition-colors"
    onClick={toggle}
    onMouseEnter={hoverSwitch}
  >
    {label}
  </button>
  <AnimatePresence>
    {isOpen && <MenuDropdown items={items} onClose={close} />}
  </AnimatePresence>
</div>
```

### MenuDropdown

```tsx
// Animated dropdown panel
<motion.div
  variants={slideDown}
  initial="hidden"
  animate="show"
  exit="exit"
  role="menu"
  className="absolute top-full left-0 z-50 mt-1 min-w-[220px] py-1
             bg-ctp-mantle border border-ctp-surface0 rounded-lg
             shadow-xl shadow-black/20 backdrop-blur-sm"
>
  {items.map(item =>
    item.type === "divider"
      ? <MenuDivider key={item.id} />
      : <MenuItem key={item.id} {...item} />
  )}
</motion.div>
```

### MenuItem

```tsx
// Action row with icon, label, shortcut, and disabled state
<button
  role="menuitem"
  disabled={disabled}
  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm
             text-ctp-text hover:bg-ctp-surface0 transition-colors
             disabled:opacity-50 disabled:pointer-events-none"
  onClick={() => { action(); onClose(); }}
>
  {Icon && <Icon className="w-4 h-4 text-ctp-overlay1 shrink-0" />}
  <span className="flex-1 text-left">{label}</span>
  {shortcut && (
    <span className="text-xs text-ctp-subtext0 font-mono ml-4">
      {formatShortcut(shortcut)}
    </span>
  )}
</button>
```

## 5. Styling Approach

### Catppuccin Token Usage

| Element | Token | Usage |
|---------|-------|-------|
| Menu trigger text | `text-ctp-subtext1` | Default state |
| Menu trigger hover | `hover:bg-ctp-surface0 hover:text-ctp-text` | Hover/active state |
| Menu trigger active | `bg-ctp-surface0 text-ctp-text` | When dropdown is open |
| Dropdown background | `bg-ctp-mantle` | Panel surface |
| Dropdown border | `border-ctp-surface0` | Panel border |
| Menu item text | `text-ctp-text` | Normal items |
| Menu item icon | `text-ctp-overlay1` | Leading icon |
| Menu item hover | `hover:bg-ctp-surface0` | Item hover state |
| Shortcut text | `text-ctp-subtext0 font-mono` | Keyboard shortcut hint |
| Divider | `border-ctp-surface0` | Group separator |
| Disabled item | `opacity-50` | Disabled state |
| Shadow | `shadow-xl shadow-black/20` | Depth indication |

### Design Consistency

The styling matches existing patterns from:
- `ToolbarOverflowMenu`: `bg-ctp-mantle/95 backdrop-blur-sm` dropdown
- `ContextMenu`: `min-w-48 py-1 rounded-lg shadow-xl`
- `BranchSwitcher`: `slideDown` animation variants

## 6. Animation and Transition Patterns

### Standard Slide-Down (reuse from BranchSwitcher/RepoSwitcher)

```typescript
const slideDown = {
  hidden: { opacity: 0, y: -8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.1, ease: "easeIn" },
  },
};
```

### Reduced Motion Support

The app uses `useReducedMotion()` from framer-motion (seen in `ShortcutTooltip`, `CommandPalette`). The menu should follow the same pattern:

```typescript
const shouldReduceMotion = useReducedMotion();
// If reduced motion, skip animation (duration: 0) or use simple fade
```

## 7. Keyboard Navigation Implementation

### ARIA Menubar Pattern (WAI-ARIA 1.2)

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Open menu / activate item |
| `Escape` | Close current menu, return focus to trigger |
| `ArrowRight` | Move to next menu trigger (with wrap) |
| `ArrowLeft` | Move to previous menu trigger (with wrap) |
| `ArrowDown` | Open menu / move to next item |
| `ArrowUp` | Move to previous item |
| `Home` | First menu item |
| `End` | Last menu item |

### Implementation Hook: `useMenuBar`

```typescript
interface UseMenuBarReturn {
  activeMenu: string | null;
  highlightedIndex: number;
  open: (menuId: string) => void;
  close: () => void;
  handleTriggerKeyDown: (e: React.KeyboardEvent, menuId: string) => void;
  handleItemKeyDown: (e: React.KeyboardEvent) => void;
}
```

This follows the same approach as:
- `useRovingTabindex` for the toolbar
- `handleKeyDown` in `BranchSwitcher`
- `handleKeyDown` in `CommandPalette`

## 8. Menu Structure and Action Mapping

### Connecting to Existing Commands

Menu items should call `executeCommand(id)` from `commandRegistry` wherever possible. This ensures:
- Same action logic as command palette
- Same `enabled()` checks
- No code duplication

### Menu Definitions

```typescript
// menu-definitions.ts
import type { LucideIcon } from "lucide-react";

export interface MenuItemDef {
  type: "action";
  id: string;           // maps to command registry ID
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  commandId?: string;    // if different from id
  action?: () => void;   // custom action if no command
  enabled?: () => boolean;
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

### Proposed Menu Contents

**File menu:**
| Item | Command ID | Shortcut | Notes |
|------|-----------|----------|-------|
| New Repository... | `init-repo` (new) | - | Opens init-repo blade |
| Add Local Repository... | `open-repository` | Cmd+O | Existing command |
| Clone Repository... | `clone-repository` | - | Existing command |
| --- | - | - | divider |
| Close Repository | `close-repository` | - | Existing, when repo open |
| --- | - | - | divider |
| Settings | `open-settings` | Cmd+, | Existing command |

**View menu:**
| Item | Command ID | Shortcut | Notes |
|------|-----------|----------|-------|
| Show Changes | `show-changes` (new) | - | Opens staging-changes blade |
| Show History | `show-history` (new) | - | Opens topology-graph blade |
| Show Branches List | `show-branches` (new) | - | Opens branches panel |
| --- | - | - | divider |
| Browse Repository | `browse-repo` | - | Existing toolbar action |
| --- | - | - | divider |
| Command Palette | `command-palette` | Cmd+K | Existing command |
| Extension Manager | `open-extension-manager` | - | Existing command |

**Repository menu:**
| Item | Command ID | Shortcut | Notes |
|------|-----------|----------|-------|
| Fetch | `fetch` | Cmd+Shift+F | Existing command |
| Pull | `pull` | Cmd+Shift+L | Existing command |
| Push | `push` | Cmd+Shift+U | Existing command |
| --- | - | - | divider |
| Stage All | `stage-all` | Cmd+Shift+A | Existing command |
| Toggle Amend | `toggle-amend` | Cmd+Shift+M | Existing command |
| --- | - | - | divider |
| Refresh All | `refresh-all` | - | Existing command |
| Reveal in Finder | custom | - | Existing toolbar action |

**Branch menu:**
| Item | Command ID | Shortcut | Notes |
|------|-----------|----------|-------|
| Create Branch... | `create-branch` | - | Existing command |
| --- | - | - | divider |
| Undo Last Operation | `undo` | - | Existing toolbar action (when available) |

## 9. Reusable Existing Components Identified

| Component | Reuse | How |
|-----------|-------|-----|
| `formatShortcut()` | Display shortcuts in menu items | Import from `useKeyboardShortcuts` |
| `executeCommand()` | Trigger actions | Import from `commandRegistry` |
| `slideDown` variants | Menu animation | Extract or duplicate from `BranchSwitcher` |
| `Button` | Not needed for menu items (custom styling preferred) | - |
| `cn()` | Conditional classnames | Import from `lib/utils` |
| `useReducedMotion()` | Respect OS motion preferences | Import from `framer-motion` |
| Lucide icons | Menu item icons | Same as command/toolbar icons |

## 10. Integration Points

### Header.tsx Modification

```tsx
// Current:
<div className="flex items-center gap-2">
  <h1>FlowForge</h1>
  {status && (
    <>
      <div className="w-px h-6 bg-ctp-surface1" />
      <RepoSwitcher ... />
      <BranchSwitcher ... />
    </>
  )}
</div>

// Proposed:
<div className="flex items-center gap-2">
  <h1>FlowForge</h1>
  <div className="w-px h-6 bg-ctp-surface1" />
  <MenuBar />                          {/* Always visible */}
  {status && (
    <>
      <div className="w-px h-6 bg-ctp-surface1" />
      <RepoSwitcher ... />
      <BranchSwitcher ... />
    </>
  )}
</div>
```

### z-index Layering

Current z-index hierarchy:
- Header: `z-50`
- Context menu: `z-[100]`
- Command palette: `z-50` (with backdrop)

Menu dropdown should use `z-50` (same level as header -- positioned absolutely from the header).

### Global Click-Outside

A single click-outside handler on `MenuBar` dismisses open menus. This avoids conflicts with the existing context menu and command palette handlers.

## 11. Testing Strategy

### Unit Tests

- `useMenuBar` hook: open/close state, keyboard navigation, hover-to-switch
- `MenuItem`: renders label, icon, shortcut; calls action; respects disabled
- Menu definitions: correct command IDs, all referenced commands exist

### Integration Tests

- Opening a menu via click
- Keyboard navigation through items
- Hover-to-switch between menus
- Escape closes menu and returns focus
- Menu items disabled when no repo open (enabled() check)
- Click-outside dismissal
- No interference with command palette or context menu

## 12. Implementation Order

1. **Create `useMenuBar` hook** -- state management and keyboard navigation
2. **Create `MenuItem` and `MenuDivider`** -- leaf components
3. **Create `MenuDropdown`** -- animated dropdown container
4. **Create `MenuBarItem`** -- trigger button with hover-to-switch
5. **Create `MenuBar`** -- container with all menu definitions
6. **Create `menu-definitions.ts`** -- static menu structure
7. **Register new commands** (show-changes, show-history, show-branches) in command registry
8. **Integrate into `Header.tsx`** -- insert MenuBar component
9. **Add tests**

## 13. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| z-index conflicts | Use same z-50 as header; dropdown is child of header |
| Click-outside conflicts with context menu | Context menu uses `z-[100]`, runs independently |
| Menu stays open when command palette opens | Listen for palette open state and close menu |
| Performance with many `enabled()` checks | Menu items are few (<30 total); no concern |
| Focus trap conflicts | Menu uses standard `role="menubar"` focus management; command palette and context menu manage their own |
