# UX Research: Toolbar Menus for FlowForge

## 1. Executive Summary

FlowForge currently has a flat icon-only toolbar on the right side of the header bar. Users access commands through the Command Palette (`Cmd+Shift+P` / `Cmd+K`) or individual toolbar buttons. There is no menu bar.

This research recommends adding a desktop-style **menu bar** between the app title and the repo/branch switchers, providing discoverability for all available actions organized into logical groups: **File**, **Edit**, **View**, **Repository**, and **Branch**.

---

## 2. Current Navigation Landscape

### 2.1 Header Layout (src/components/Header.tsx)

```
[FlowForge] | [RepoSwitcher] [BranchSwitcher] [ProcessNavigation] ---- [Toolbar icons]
```

- Left side: App title, repo switcher, branch switcher, process tabs (Staging/Topology)
- Right side: Flat toolbar with icon buttons grouped by intent (navigation, git-actions, views, app)

### 2.2 Existing Command Sources

| Source | File | Commands |
|--------|------|----------|
| Core Commands | `src/commands/repository.ts` | Open Repo, Close Repo, Clone Repo, Refresh All |
| Core Commands | `src/commands/sync.ts` | Push, Pull, Fetch, Stage All, Toggle Amend |
| Core Commands | `src/commands/branches.ts` | Create Branch |
| Core Commands | `src/commands/navigation.ts` | Command Palette |
| Core Commands | `src/commands/settings.ts` | Open Settings, Toggle Theme |
| Core Commands | `src/commands/extensions.ts` | Extension Manager |
| Toolbar Actions | `src/commands/toolbar-actions.ts` | Open Repo, Settings, Command Palette, Theme, Undo, Refresh All, Fetch, Pull, Push, Browse Repository, Close Repo, Reveal in Finder, Clone Repo |
| Extension: GitHub | `src/extensions/github/index.ts` | Sign In, Sign Out, View PRs, View Issues, Create PR |
| Extension: Gitflow | `src/extensions/gitflow/index.ts` | Gitflow Cheatsheet |
| Extension: Worktrees | `src/extensions/worktrees/index.tsx` | Create Worktree, Refresh Worktrees |
| Extension: Conv. Commits | `src/extensions/conventional-commits/index.ts` | Generate Changelog, Open CC Composer |
| Extension: Init Repo | `src/extensions/init-repo/index.ts` | Initialize Repository |

### 2.3 Existing Keyboard Shortcuts (src/hooks/useKeyboardShortcuts.ts)

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+O` | Open Repository | Always |
| `Cmd+,` | Open Settings | Always |
| `Cmd+Shift+A` | Stage All | Repo open |
| `Cmd+K` / `Cmd+Shift+P` | Command Palette | Always |
| `Cmd+Shift+U` | Push | Repo open |
| `Cmd+Shift+L` | Pull | Repo open |
| `Cmd+Shift+F` | Fetch | Repo open |
| `Cmd+Shift+M` | Toggle Amend | Repo open |
| `Escape` | Pop Blade / Close Palette | Always |
| `Backspace` | Navigate Back | Always |
| `Enter` | Open Commit Details | Topology view |

### 2.4 Existing Toolbar Groups (src/lib/toolbarRegistry.ts)

Render order: `navigation` -> `git-actions` -> `views` -> `app`

Each group has visual dividers between them. Actions have `when()` conditions for visibility and `priority` for collapse ordering.

---

## 3. Competitive Analysis

### 3.1 GitHub Desktop Menu Structure

- **File**: New Repository, Add Local Repository, Clone Repository, Options/Preferences
- **Edit**: Undo, Redo, Cut, Copy, Paste, Select All, Find
- **View**: Changes, History, Repository List, Branches, Full Screen, Zoom
- **Repository**: Push, Pull, Fetch, Remove, Open in Shell, Show in Finder, Repository Settings
- **Branch**: New Branch, Rename, Delete, Compare, Merge into Current, Rebase, Update from Default Branch

### 3.2 GitKraken Menu Structure

- **File**: New Tab, New Window, Init Repo, Open Repo, Clone Repo, Preferences
- **Edit**: Undo, Redo, Cut, Copy, Paste, Find, Select All
- **View**: Themes, Layout, Column, Zoom
- **Repository**: Open in Terminal, Open in Finder, Fetch All, Pull, Push, Stash, Pop Stash
- **Branch**: Create, Checkout, Delete, Merge, Rebase
- **Help**: About, Release Notes, Documentation, Support

### 3.3 SourceTree Menu Structure

- **File**: New, Clone, Open, Settings
- **Edit**: Undo, Redo, Cut, Copy, Paste, Find
- **View**: Show/Hide Sidebar, Columns, Log, File Status
- **Repository**: Fetch, Pull, Push, Stash, Apply Stash, Refresh, Terminal, Finder
- **Actions**: Commit, Stage All, Unstage All, Discard, Branch, Merge, Rebase, Tag, Cherry-pick
- **Help**: About, Documentation

### 3.4 Common Patterns Across All Three

1. **File** always includes repo creation/opening and app preferences
2. **View** controls what panels/sections are visible
3. **Repository** groups remote sync operations (fetch/pull/push) and repo-level actions
4. **Branch** groups branch CRUD and merge/rebase operations
5. Disabled items are shown but grayed out (not hidden) when repo is closed
6. Keyboard accelerators displayed right-aligned in each menu item
7. Separator lines group related items within each menu

---

## 4. Recommended Menu Hierarchy

### 4.1 File Menu

| Menu Item | Shortcut | Action | Maps To | When |
|-----------|----------|--------|---------|------|
| New Repository... | `Cmd+N` | Open init-repo blade | `ext:init-repo:init-repository` | Always |
| Open Repository... | `Cmd+O` | Open file dialog | `open-repository` / `tb:open-repo` | Always |
| Clone Repository... | `Cmd+Shift+O` | Open clone dialog | `clone-repository` / `tb:clone-repo` | Always |
| --- | | | | |
| Close Repository | | Close current repo | `close-repository` / `tb:close-repo` | Repo open |
| --- | | | | |
| Preferences... | `Cmd+,` | Open settings blade | `open-settings` / `tb:settings` | Always |

**Rationale**: Follows GitHub Desktop convention. Groups repo lifecycle (create/open/close) with app preferences. "New Repository" maps to init-repo extension command. Clone gets `Cmd+Shift+O` to mirror GitHub Desktop without conflicting with `Cmd+O`.

### 4.2 Edit Menu

| Menu Item | Shortcut | Action | Maps To | When |
|-----------|----------|--------|---------|------|
| Undo | `Cmd+Z` | Git undo (last operation) | `tb:undo` | Repo open + canUndo |
| --- | | | | |
| Find... | `Cmd+Shift+P` | Open command palette | `command-palette` / `tb:command-palette` | Always |

**Rationale**: Edit menu is minimal since FlowForge is not a text editor. Git Undo maps naturally here. Command Palette acts as the universal "Find" for actions.

### 4.3 View Menu

| Menu Item | Shortcut | Action | Maps To | When |
|-----------|----------|--------|---------|------|
| Changes | `Cmd+1` | Switch to Staging process | `SWITCH_PROCESS(staging)` | Repo open |
| History | `Cmd+2` | Switch to Topology process | `SWITCH_PROCESS(topology)` | Repo open |
| --- | | | | |
| Browse Repository | `Cmd+B` | Open repo browser blade | `tb:repo-browser` | Repo open |
| --- | | | | |
| Reveal in File Manager | | Open OS file manager | `tb:reveal-in-finder` | Repo open |
| --- | | | | |
| Toggle Theme | | Cycle dark/light/system | `toggle-theme` | Always |
| Extension Manager | | Open extension manager | `open-extension-manager` | Always |

**Rationale**: View menu controls what you see. "Changes" and "History" map to the existing `ProcessNavigation` process switching. Numbered shortcuts (`Cmd+1/2`) follow the convention from GitHub Desktop. Browse Repository opens the file tree blade. Reveal in Finder opens the OS file manager.

### 4.4 Repository Menu

| Menu Item | Shortcut | Action | Maps To | When |
|-----------|----------|--------|---------|------|
| Fetch | `Cmd+Shift+F` | Fetch from origin | `fetch` / `tb:fetch` | Repo open |
| Pull | `Cmd+Shift+L` | Pull from origin | `pull` / `tb:pull` | Repo open |
| Push | `Cmd+Shift+U` | Push to origin | `push` / `tb:push` | Repo open |
| --- | | | | |
| Stage All | `Cmd+Shift+A` | Stage all changes | `stage-all` | Repo open |
| Toggle Amend | `Cmd+Shift+M` | Toggle amend mode | `toggle-amend` | Repo open |
| --- | | | | |
| Refresh All | | Reload branches/stashes/tags | `refresh-all` / `tb:refresh-all` | Repo open |
| --- | | | | |
| *GitHub submenu* | | | | |
| View Pull Requests | | Open PRs blade | `ext:github:open-pull-requests` | GitHub signed in |
| View Issues | | Open issues blade | `ext:github:open-issues` | GitHub signed in |
| Create Pull Request | | Open create-PR blade | `ext:github:create-pull-request` | GitHub signed in |

**Rationale**: Groups remote sync (fetch/pull/push), staging operations, and repository-level tools. GitHub actions appear in a submenu since they come from an extension. Ordering follows the sync workflow: fetch first to see what changed, pull to get changes, push to share.

### 4.5 Branch Menu

| Menu Item | Shortcut | Action | Maps To | When |
|-----------|----------|--------|---------|------|
| New Branch... | `Cmd+Shift+N` | Open create branch dialog | `create-branch` | Repo open |
| --- | | | | |
| Gitflow Cheatsheet | | Open Gitflow reference | `ext:gitflow:open-gitflow-cheatsheet` | Repo open + ext enabled |

**Rationale**: Branch menu starts minimal. The BranchSwitcher already handles checkout. More branch operations (rename, delete, merge, rebase) can be added as they are implemented. Gitflow reference is context-appropriate here.

---

## 5. Interaction Patterns

### 5.1 Opening a Menu

- **Click**: Click menu label to open dropdown. Click again (or click elsewhere) to close.
- **Hover**: When a menu is already open, hovering over adjacent menu labels opens them immediately (menu "slides" between items).
- **Keyboard**: `Alt+<underlined letter>` opens the menu (e.g., `Alt+F` for File on Windows/Linux). On macOS, use `F10` or a custom key to focus the menu bar, then arrow keys.

### 5.2 Navigating Within a Menu

- **Arrow Down / Arrow Up**: Move focus between items
- **Enter / Space**: Activate the focused item
- **Escape**: Close the menu and return focus to the trigger
- **Arrow Right**: If a submenu exists, open it. If at top-level, move to the next menu.
- **Arrow Left**: Close submenu. If at top-level, move to the previous menu.
- **Home / End**: Jump to first/last item
- **Type-ahead**: Type a letter to jump to the next item starting with that letter

### 5.3 Menu Item States

| State | Visual | Behavior |
|-------|--------|----------|
| Default | Normal text, left icon (optional) | Clickable |
| Hover / Focus | Background highlight (`bg-ctp-surface0`) | Pre-click |
| Active / Pressed | Slightly darker background | During click |
| Disabled | Muted text (`text-ctp-overlay0`), no hover effect | Non-interactive, shown for discoverability |
| Loading | Spinner icon replaces normal icon | For async actions (fetch/pull/push) |
| Separator | Horizontal rule (`border-ctp-surface1`) | Visual grouping |

### 5.4 Menu Rendering

Each menu item should display:
```
[Icon]  Label                    Shortcut
```

- **Icon**: 16x16 (`w-4 h-4`), left-aligned, using Lucide icons matching toolbar icons
- **Label**: Primary text, left-aligned after icon
- **Shortcut**: Right-aligned, muted color (`text-ctp-overlay0`), using `formatShortcut()` from `useKeyboardShortcuts.ts`
- **Submenu indicator**: Right chevron icon for items with submenus

### 5.5 Menu Positioning

- Menus drop down from the menu bar, aligned to the left edge of the trigger label
- If a menu would overflow the right edge of the window, align to the right edge of the trigger instead
- Submenus open to the right by default, flipping left if they would overflow
- Menu width: minimum 200px, maximum 320px, auto-sized to content

---

## 6. Accessibility Requirements (WCAG 2.1 AA)

### 6.1 ARIA Roles and Properties

```html
<nav role="menubar" aria-label="Application menu">
  <button role="menuitem" aria-haspopup="true" aria-expanded="false">
    File
  </button>
  <div role="menu" aria-label="File">
    <button role="menuitem">New Repository...</button>
    <div role="separator" />
    <button role="menuitem" aria-disabled="true">Close Repository</button>
    <button role="menuitem" aria-haspopup="true">GitHub</button><!-- submenu -->
  </div>
</nav>
```

### 6.2 Required ARIA Attributes

| Element | Role | Required Attributes |
|---------|------|---------------------|
| Menu bar container | `menubar` | `aria-label="Application menu"`, `aria-orientation="horizontal"` |
| Top-level trigger | `menuitem` (within menubar) | `aria-haspopup="true"`, `aria-expanded` |
| Dropdown panel | `menu` | `aria-label={menuName}` |
| Menu item | `menuitem` | `aria-disabled` when disabled, `aria-haspopup` for submenus |
| Separator | `separator` | none |
| Loading indicator | | `aria-busy="true"`, live region for status announcements |

### 6.3 Focus Management

1. When a menu opens, focus moves to the first enabled item
2. When a menu closes, focus returns to the trigger button
3. Tab key should move focus out of the menu (close it) to the next focusable element
4. Roving tabindex within the menu bar: only one trigger is in tab order at a time

### 6.4 Color Contrast

- All text must meet 4.5:1 contrast ratio against background
- Disabled items still need 3:1 contrast (use `text-ctp-overlay0` which meets this)
- Focus indicator: 2px outline or ring (`ring-2 ring-ctp-blue`) with 3:1 contrast
- Keyboard shortcut text: `text-ctp-overlay0` on `bg-ctp-mantle` background

### 6.5 Motion

- Menu open/close animations should respect `prefers-reduced-motion`
- Use `motion-safe:` prefix for any Framer Motion animations
- Transition duration: 100-150ms for open, 75-100ms for close (instant when reduced motion)

---

## 7. Visual Design Specifications

### 7.1 Menu Bar Placement

The menu bar sits between the app title and the repo/branch switchers:

```
[FlowForge] [File] [Edit] [View] [Repository] [Branch] | [RepoSwitcher] [BranchSwitcher] [ProcessNav] ---- [Toolbar]
```

This follows the macOS/Windows convention where the menu bar is the first interactive element after the app title.

### 7.2 Menu Bar Styling

```
Trigger labels:
  - Font: text-sm (14px)
  - Color: text-ctp-subtext0 (default), text-ctp-text (hover/active)
  - Padding: px-3 py-1.5
  - Background: transparent (default), bg-ctp-surface0 (hover), bg-ctp-surface1 (active/expanded)
  - Border-radius: rounded-md
  - Transition: colors 150ms
```

### 7.3 Dropdown Panel Styling

```
Container:
  - Background: bg-ctp-mantle
  - Border: border border-ctp-surface0
  - Border-radius: rounded-lg
  - Shadow: shadow-xl
  - Padding: py-1
  - Min-width: 200px
  - Max-width: 320px

Menu item:
  - Font: text-sm
  - Color: text-ctp-text (enabled), text-ctp-overlay0 (disabled)
  - Padding: px-3 py-1.5
  - Background: bg-ctp-surface0 (hover/focus)
  - Icon: w-4 h-4 text-ctp-subtext0, mr-3
  - Shortcut: text-xs text-ctp-overlay0, ml-auto pl-8

Separator:
  - Border: border-t border-ctp-surface1
  - Margin: my-1
```

### 7.4 Dropdown Animation

```
Open: opacity 0->1, translateY -4px->0, scale 0.98->1 (100ms ease-out)
Close: opacity 1->0, translateY 0->-4px (75ms ease-in)
```

---

## 8. Menu-to-Command Mapping Summary

This table shows how every proposed menu item maps to existing infrastructure:

| Menu | Item | Command Registry ID | Toolbar Registry ID | Keyboard Shortcut Hook |
|------|------|--------------------|--------------------|----------------------|
| File | New Repository | `ext:init-repo:init-repository` | -- | new: `Cmd+N` |
| File | Open Repository | `open-repository` | `tb:open-repo` | `useHotkeys("mod+o")` |
| File | Clone Repository | `clone-repository` | `tb:clone-repo` | new: `Cmd+Shift+O` |
| File | Close Repository | `close-repository` | `tb:close-repo` | -- |
| File | Preferences | `open-settings` | `tb:settings` | `useHotkeys("mod+,")` |
| Edit | Undo | -- | `tb:undo` | -- |
| Edit | Find (Palette) | `command-palette` | `tb:command-palette` | `useHotkeys("mod+shift+p")` |
| View | Changes | -- (direct event) | -- | new: `Cmd+1` |
| View | History | -- (direct event) | -- | new: `Cmd+2` |
| View | Browse Repository | -- | `tb:repo-browser` | new: `Cmd+B` |
| View | Reveal in Finder | -- | `tb:reveal-in-finder` | -- |
| View | Toggle Theme | `toggle-theme` | `tb:theme-toggle` | -- |
| View | Extension Manager | `open-extension-manager` | -- | -- |
| Repo | Fetch | `fetch` | `tb:fetch` | `useHotkeys("mod+shift+f")` |
| Repo | Pull | `pull` | `tb:pull` | `useHotkeys("mod+shift+l")` |
| Repo | Push | `push` | `tb:push` | `useHotkeys("mod+shift+u")` |
| Repo | Stage All | `stage-all` | -- | `useHotkeys("mod+shift+a")` |
| Repo | Toggle Amend | `toggle-amend` | -- | `useHotkeys("mod+shift+m")` |
| Repo | Refresh All | `refresh-all` | `tb:refresh-all` | -- |
| Repo | GitHub > PRs | `ext:github:open-pull-requests` | -- | -- |
| Repo | GitHub > Issues | `ext:github:open-issues` | -- | -- |
| Repo | GitHub > Create PR | `ext:github:create-pull-request` | -- | -- |
| Branch | New Branch | `create-branch` | -- | new: `Cmd+Shift+N` |
| Branch | Gitflow Cheatsheet | `ext:gitflow:open-gitflow-cheatsheet` | -- | -- |

---

## 9. New Keyboard Shortcuts Proposed

| Shortcut | Action | Rationale |
|----------|--------|-----------|
| `Cmd+N` | New Repository | Standard "New" shortcut, matches GitHub Desktop |
| `Cmd+Shift+O` | Clone Repository | "Open from remote" variant, matches GitHub Desktop |
| `Cmd+1` | Show Changes (Staging) | Tab switching convention (browsers, VS Code, GitHub Desktop) |
| `Cmd+2` | Show History (Topology) | Same tab switching convention |
| `Cmd+B` | Browse Repository | "B" for Browse, similar to VS Code sidebar toggle |
| `Cmd+Shift+N` | New Branch | Standard "New" + Shift, matches GitHub Desktop |

**Conflict check**: None of these conflict with existing shortcuts in `useKeyboardShortcuts.ts` or `useStagingKeyboard.ts`. `Cmd+N` may conflict with the browser's "new window" but Tauri captures this before the webview.

---

## 10. Extension Integration

### 10.1 How Extensions Add Menu Items

Extensions currently contribute via:
- `api.registerCommand()` -> command palette entries
- `api.contributeToolbar()` -> toolbar buttons

For menu items, extensions should use a new `api.contributeMenuItem()` method or reuse the existing command registry with a `menu` property specifying placement:

```ts
// Option A: Explicit menu contribution
api.contributeMenuItem({
  menu: "repository",
  group: "github",  // submenu
  label: "View Pull Requests",
  icon: GitPullRequest,
  action: () => { ... },
  enabled: () => isAuthenticated,
  shortcut: "mod+shift+r",
});

// Option B: Annotate existing command with menu placement
api.registerCommand({
  id: "open-pull-requests",
  title: "View Pull Requests",
  category: "GitHub",
  menu: { parent: "repository", group: "github", priority: 10 },
  ...
});
```

**Recommendation**: Option B (annotate commands) is preferred because it avoids duplicating action definitions. The menu system reads from the command registry and toolbar registry, adding menu-specific metadata.

### 10.2 Extension Menu Ordering

- Core items come first within each menu
- Extension items are grouped into submenus named after the extension category
- Within a submenu, items are ordered by priority (higher first)
- If an extension only has 1-2 items, they may be inlined without a submenu

---

## 11. Interaction with Existing Toolbar

The menu bar and toolbar serve complementary purposes:

| Aspect | Menu Bar | Toolbar |
|--------|----------|---------|
| Purpose | Discoverability, full action catalog | Quick access to frequent actions |
| Visibility | Always visible | Collapses on narrow windows |
| Icons | Optional, left of label | Primary (icon-only) |
| Shortcuts | Displayed alongside label | Shown in tooltip |
| State | Disabled items shown grayed | Hidden via `when()` |

**Key decision**: The toolbar should remain unchanged. The menu bar is additive. Both can trigger the same underlying commands. This mirrors GitHub Desktop where the toolbar has push/pull/fetch buttons AND the Repository menu has the same items.

---

## 12. Edge Cases and Special Behaviors

### 12.1 No Repository Open

When no repository is open:
- **File** menu: New/Open/Clone enabled, Close disabled
- **Edit** menu: Undo disabled, Find always enabled
- **View** menu: Changes/History/Browse/Reveal disabled; Theme/Extensions enabled
- **Repository** menu: All items disabled
- **Branch** menu: All items disabled

Items should be disabled (not hidden) so users discover what features exist.

### 12.2 Loading States

For async operations (Fetch, Pull, Push):
- Show a spinner icon replacing the normal icon
- Append "..." to the label (e.g., "Fetching...")
- Disable the item while loading
- Announce completion via `aria-live` region

### 12.3 Extension Not Enabled

If an extension is disabled, its contributed menu items should not appear. This uses the same `when()` / `enabled()` pattern already in the command registry. The GitHub submenu disappears entirely if the GitHub extension is disabled.

### 12.4 macOS vs Windows/Linux

- macOS: Use native-style keyboard modifier symbols (Cmd, Shift, Option)
- Windows/Linux: Use text abbreviations (Ctrl+, Shift+, Alt+)
- The existing `formatShortcut()` function in `useKeyboardShortcuts.ts` already handles this

---

## 13. Implementation Priorities

### Phase 1: Core Menu Bar (MVP)
1. Add `<MenuBar>` component between title and repo switcher in Header
2. Implement File and View menus with existing commands
3. Keyboard navigation (arrow keys, Enter, Escape)
4. ARIA roles and focus management

### Phase 2: Repository and Branch Menus
1. Repository menu with fetch/pull/push/stage/refresh
2. Branch menu with create branch
3. Disabled states for repo-closed context
4. Loading states for async operations

### Phase 3: Extension Integration
1. GitHub submenu in Repository
2. Gitflow item in Branch
3. Extension API for contributing menu items
4. Dynamic menu updates on extension enable/disable

### Phase 4: Polish
1. Animations with reduced-motion support
2. Type-ahead search within open menu
3. Menu item badges (e.g., PR count from GitHub extension)
4. Persistent menu state preferences (if any menus should remember collapsed state)
