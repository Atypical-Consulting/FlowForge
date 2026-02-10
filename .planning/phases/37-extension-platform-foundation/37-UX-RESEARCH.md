# Phase 37: Extension Platform Foundation -- UX Research

**Researched:** 2026-02-10
**Focus:** How extension-contributed UI surfaces (context menus, sidebar panels, status bar widgets) should look, behave, and feel native within FlowForge's Catppuccin-themed desktop Git client.

---

## 1. Summary of Findings

FlowForge Phase 37 introduces three new UI surfaces where extensions can contribute visible elements: context menus on right-click, sidebar panels in the repository view, and a status bar at the bottom of the window. The core UX challenge is making extension-contributed UI feel indistinguishable from core UI while maintaining scalability as extensions grow.

**Key conclusions:**

1. **Context menus** should use a grouped-with-separators model (not submenus) for up to 7 items per group. Extension items appear in a dedicated group below core actions, separated by a visual divider. Items are sorted by priority within groups.

2. **Sidebar panels** should be contributed as collapsible `<details>` sections that are visually identical to existing core sections (Branches, Stashes, Tags, etc.). Extensions cannot distinguish themselves visually from core -- this is intentional for cohesion. Panel ordering uses a priority number, with core sections occupying fixed priority bands.

3. **Status bar** should be a new thin bar at the bottom of the window, using Catppuccin `ctp-mantle` background (matching the header). Left side holds workspace-scoped items (branch, sync status, active flow), right side holds contextual items (extension indicators, line endings, encoding). Items are text-first, icon-sparse, and clicking navigates to relevant detail.

4. **Extension cohesion** is enforced through design constraints: extensions must use Lucide icons, Catppuccin color tokens, and standardized spacing. No custom colors in the status bar. No custom fonts. The design system acts as a guardrail.

5. **Scalability safeguards** prevent UI degradation: context menus overflow into a "More Actions..." submenu above 7 items, sidebar panels can be hidden/reordered by the user, and status bar items have a priority-based truncation system.

---

## 2. Context Menu UX

### 2.1 Research: How Other Tools Handle This

**VS Code** uses a well-established pattern:
- Context menus are scoped to locations (editor, file explorer, terminal tab, etc.)
- Items are organized into predefined groups with `@order` suffixes for priority
- The `navigation` group always appears at the top
- Extension items typically land in their own group, separated by dividers
- A `when` clause controls visibility per item
- Sub-menus are reserved for large groups (7+ related items)
- Reference: [VS Code Context Menu Guidelines](https://code.visualstudio.com/api/ux-guidelines/context-menus)

**JetBrains IDEs** follow a similar model:
- Context menus are location-scoped (editor, project tree, VCS log)
- Plugin-contributed actions register into named groups with ordering anchors (`before`, `after`)
- Core actions always come first; plugin actions appear in a separate section
- Heavy use of separators to distinguish core from extension actions

**GitHub Desktop** has minimal context menus:
- Right-click on branches shows checkout, delete, rename
- No extension system, so no extension items
- Simple, flat menu with no grouping needed

**GitKraken** uses context menus on branches and commits:
- Right-click menus are relatively long (10-15 items)
- Grouped by operation type (branch ops, remote ops, copy, etc.)
- No extension system for context menus currently
- Reference: [GitKraken Interface](https://help.gitkraken.com/gitkraken-desktop/interface/)

**Nielsen Norman Group** guidelines (applicable to all context menus):
- Context menus should contain secondary/supporting actions, not primary ones
- Group related actions together to reduce cognitive load
- Avoid single-action menus (wasteful interaction cost)
- Always provide keyboard accessibility (arrow keys, Enter, Escape)
- Reference: [NNGroup Contextual Menus](https://www.nngroup.com/articles/contextual-menus-guidelines/)

### 2.2 FlowForge Context Menu Locations

Based on the current UI, context menus are needed at these locations where extensions would contribute items:

| Location ID | Trigger Element | Context Data | Example Core Actions | Example Extension Actions |
|-------------|----------------|-------------|---------------------|--------------------------|
| `branch-list` | BranchItem row | `branchName`, `isHead`, `branchType` | Checkout, Merge, Delete, Copy name | Gitflow: Start Feature, GitHub: Create PR |
| `commit-list` | CommitHistory row | `commitOid`, `shortOid`, `messageSubject` | View details, Copy SHA, Cherry-pick | GitHub: View on GitHub, CC: Analyze type |
| `tag-list` | TagItem row | `tagName`, `isAnnotated` | Delete, Copy name | GitHub: Create release from tag |
| `stash-list` | StashItem row | `stashIndex`, `message` | Apply, Pop, Drop | (none expected initially) |
| `file-tree` | FileTreeBlade items | `filePath`, `fileStatus` | Stage, Unstage, Discard, Open | Viewers: Open with..., GitHub: View blame |
| `blade-tab` | BladeStrip tab | `bladeType`, `bladeId` | Close, Close others, Pin | (none expected initially) |

### 2.3 Grouping Model

Context menu items should be organized into **named groups** separated by visual dividers. Groups render in a fixed order, with core groups always appearing before extension groups.

```
Group Order (top to bottom):
  1. "navigation"    -- Primary actions (Checkout, Open, View Details)
  2. "modification"  -- Mutating actions (Merge, Delete, Rename, Stage)
  3. "clipboard"     -- Copy operations (Copy name, Copy SHA, Copy path)
  4. "extension"     -- Extension-contributed actions (sorted by priority)
```

Within each group, items are sorted by `priority` (higher = first). Items with the same priority sort alphabetically by label.

**Why this model over submenus:**
- FlowForge is a Git client, not an IDE. Context menus will have 5-15 items, not 30+
- Submenus add interaction cost (hover to expand, careful mouse tracking)
- Flat menus with clear group separators are faster to scan
- VS Code only uses submenus when a single extension contributes 7+ items to one location

### 2.4 Extension Item Placement

Extension items are placed in the `"extension"` group by default. Extensions can optionally specify a custom group name to create their own named group, which renders after core groups but can be ordered relative to other extension groups via priority.

If an extension contributes more than 5 items to a single location, those items should automatically collapse into a submenu labeled with the extension's display name (e.g., "Gitflow >" containing "Start Feature", "Start Release", etc.). This prevents a single chatty extension from dominating the menu.

### 2.5 Visual Design

```
+------------------------------------------+
|  Switch to branch           Ctrl+Click   |  <- "navigation" group
|  View branch history                     |
+------------------------------------------+  <- separator
|  Merge into current                      |  <- "modification" group
|  Delete branch                  Del      |
+------------------------------------------+  <- separator
|  Copy branch name              Ctrl+C    |  <- "clipboard" group
+------------------------------------------+  <- separator
|  Start Feature from here                 |  <- "extension" group (Gitflow)
|  Create Pull Request                     |  <- "extension" group (GitHub)
+------------------------------------------+
```

**Styling (Catppuccin Mocha):**
- Background: `ctp-base` (or `ctp-mantle` for a slightly darker panel feel)
- Hover: `ctp-surface0` with `ctp-text` foreground
- Text: `ctp-text` for labels, `ctp-overlay0` for keyboard shortcuts
- Separator: 1px `ctp-surface0` horizontal line
- Icon: 16x16 Lucide icon, `ctp-overlay1` color (matches sidebar icon treatment)
- Disabled items: `ctp-overlay0` text with 50% opacity, non-interactive
- Danger items (Delete, Discard): `ctp-red` text on hover only (not at rest)
- Border: 1px `ctp-surface0`, rounded-lg (8px), shadow-lg for elevation
- Min width: 200px, max width: 320px

### 2.6 Keyboard Accessibility

Context menus must follow the [WAI-ARIA Menu Pattern](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/):

| Key | Action |
|-----|--------|
| Right-click / Shift+F10 | Open context menu at element |
| Arrow Down | Move focus to next item (wraps to top) |
| Arrow Up | Move focus to previous item (wraps to bottom) |
| Enter / Space | Activate focused item |
| Escape | Close menu, return focus to trigger element |
| Home | Move focus to first item |
| End | Move focus to last item |
| Type-ahead | Jump to item starting with typed character |

ARIA attributes:
- Menu container: `role="menu"`, `aria-label="Context menu for {location}"`
- Menu items: `role="menuitem"`, `aria-disabled` when disabled
- Separators: `role="separator"`
- Submenus: `role="menuitem"` + `aria-haspopup="true"` + `aria-expanded`

### 2.7 Recommendations for FlowForge

1. **Build a generic `<ContextMenu>` component** that accepts items from the registry, renders groups with separators, and handles keyboard navigation. This component is reused by all locations.

2. **Use `onContextMenu` event** on trigger elements (BranchItem, CommitHistory rows, etc.) to open the menu. Pass the context data (branch name, commit OID, etc.) to the registry filter.

3. **Limit to 4 named groups** initially (navigation, modification, clipboard, extension). Extensions can create custom groups for Phase 40+ when real patterns emerge.

4. **Auto-collapse extension items** into a submenu when a single extension contributes >5 items to one location. Display the extension name as the submenu label.

5. **Show keyboard shortcut hints** inline (right-aligned, `ctp-overlay0` text) for actions that have registered shortcuts.

6. **Dismiss on click-outside** and on Escape. Return focus to the element that opened the menu.

---

## 3. Sidebar Panel UX

### 3.1 Research: How Other Tools Handle This

**VS Code Sidebar:**
- Extensions contribute "View Containers" (sidebar icons) and "Views" (collapsible tree sections within)
- Each View Container typically hosts 1-5 views
- Views are collapsible, drag-reorderable, and can be hidden via the "..." menu
- View Containers can have toolbar actions (icon buttons in the title bar)
- A single View Container per extension is the recommended maximum
- Reference: [VS Code Sidebars](https://code.visualstudio.com/api/ux-guidelines/sidebars), [VS Code Views](https://code.visualstudio.com/api/ux-guidelines/views)

**GitKraken:**
- Left panel has fixed sections: Local, Remote, Stash, Tags
- Sections are collapsible with a disclosure triangle
- No extension-contributed sidebar content
- Users have requested customizable panels for reordering
- Reference: [GitKraken Customizable Panel Request](https://feedback.gitkraken.com/suggestions/197834/customizable-left-panel)

**JetBrains IDEs:**
- "Tool Windows" are panels docked to edges (left, bottom, right)
- Plugins contribute tool windows via extension points
- Each tool window has its own icon in the sidebar gutter
- Tool windows can be floating, docked, or tabbed
- Reference: [IntelliJ Tool Windows](https://plugins.jetbrains.com/docs/intellij/tool-windows.html)

**GitHub Desktop:**
- Two-panel layout with no sidebar sections
- Branches and history as tabs within panels
- No extension system

### 3.2 Current FlowForge Sidebar Structure

The current sidebar in `RepositoryView.tsx` uses native HTML `<details>` elements for collapsible sections:

```
Sidebar (20% width, 15-30% resizable)
  +-- Branches (open by default)
  |     Header: GitBranch icon + "Branches" + [+] button
  |     Content: <BranchList />
  +-- Stashes (closed by default)
  |     Header: Archive icon + "Stashes" + [+] button
  |     Content: <StashList />
  +-- Tags (closed by default)
  |     Header: Tag icon + "Tags" + [+] button
  |     Content: <TagList />
  +-- Gitflow (closed by default)
  |     Header: GitMerge icon + "Gitflow"
  |     Content: <GitflowPanel />
  +-- Worktrees (closed by default)
  |     Header: FolderGit2 icon + "Worktrees" + [+] button
  |     Content: <WorktreePanel />
  +-- CommitForm (fixed at bottom, not collapsible)
```

Each section follows a consistent pattern:
- `border-b border-ctp-surface0` separator
- Summary with `p-3`, hover highlight, icon + label + optional action button
- Sticky headers with `backdrop-blur-lg` for scrolling
- Content renders below when expanded

### 3.3 Extension Panel Integration Strategy

**Principle: Extension panels are visually identical to core panels.** There should be zero visual differentiation between a core "Branches" section and an extension-contributed "Gitflow" section. Users should not need to know or care which panels come from extensions.

This is different from VS Code's approach where extensions get their own View Container with a separate icon. FlowForge's sidebar is simpler -- it is a single scrollable list of sections, not a tabbed container system. Extension panels integrate directly into this list.

**Priority-based ordering:**

Core sections occupy reserved priority bands. Extension sections slot in between based on their declared priority:

| Priority Band | Section | Source |
|--------------|---------|--------|
| 100 | Branches | Core |
| 90 | Stashes | Core |
| 80 | Tags | Core |
| 70 | (reserved for future core) | -- |
| 60 | Remotes (future) | Core |
| 50 | Worktrees | Core |
| 40 | Gitflow | Extension (Phase 40) |
| 30-10 | Extension panels | Extensions |

Extensions register with `priority: number`. Higher priority = renders higher in the sidebar. Core sections have fixed priorities that extensions cannot override. If two sections have the same priority, they sort alphabetically by title.

### 3.4 Panel Configuration

Each `SidebarPanelConfig` should support:

```typescript
interface SidebarPanelConfig {
  id: string;                        // Namespaced by ExtensionAPI
  title: string;                     // Displayed in header
  icon: LucideIcon;                  // 16x16 icon in header
  component: ComponentType<any>;     // Panel content
  priority: number;                  // Ordering (higher = higher in list)
  when?: () => boolean;              // Visibility condition
  defaultOpen?: boolean;             // Initial collapsed state (default: false)
  headerActions?: HeaderAction[];    // Optional action buttons in header
  badge?: () => string | number | null; // Optional badge (e.g., PR count)
  source?: string;                   // "ext:{extensionId}" for cleanup
}

interface HeaderAction {
  icon: LucideIcon;
  label: string;                     // Tooltip text
  onClick: () => void;
}
```

### 3.5 Visual Design

Extension panels render identically to core panels. The `<details>` pattern remains:

```
+-- [icon] Panel Title         [action] --+  <- sticky header
|  border-b border-ctp-surface0           |
|                                         |
|  Panel content rendered by extension    |
|  component. Uses standard spacing,      |
|  colors, and typography from the        |
|  design system.                         |
|                                         |
+-----------------------------------------+
```

**Header styling (same as existing sections):**
- `p-3` padding
- `cursor-pointer hover:bg-ctp-surface0/50`
- `select-none` to prevent text selection on toggle
- `sticky top-0 z-10 bg-ctp-base/70 backdrop-blur-lg`
- Icon: `w-4 h-4` Lucide icon
- Title: `font-semibold text-sm flex-1`
- Action buttons: `p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text`

**Badge (optional):**
A small count badge next to the title for panels that need to show a count (e.g., "Pull Requests (3)"):
- `text-xs font-medium px-1.5 py-0.5 rounded-full bg-ctp-surface1 text-ctp-subtext0`
- Badge updates reactively when the badge function's return value changes

### 3.6 Overflow and Scalability

**At 5-8 panels (current + near-term):**
All panels visible in the scrollable sidebar. No overflow handling needed. This is the expected state for FlowForge v1.6.0 (Branches, Stashes, Tags, Worktrees, Gitflow, possibly GitHub PRs).

**At 8-12 panels:**
The sidebar becomes tall. Mitigations:
- Default most extension panels to `defaultOpen: false` (collapsed)
- User can reorder panels via drag-and-drop (future, not Phase 37)
- Panels with `when: () => false` are hidden entirely, not just collapsed

**At 12+ panels (future concern):**
- Add a "Manage Sidebar" option (gear icon at sidebar top) to show/hide panels
- Hidden panels are fully removed from the DOM, not just `display: none`
- Store panel visibility preferences per-user in settings

### 3.7 Recommendations for FlowForge

1. **Refactor `RepositoryView.tsx`** to read panels from `SidebarPanelRegistry` instead of hardcoding `<details>` blocks. Core sections (Branches, Stashes, Tags, Worktrees) register themselves as panels during app initialization, just like extensions.

2. **Core panels register first** in a setup module (before extension activation), guaranteeing their priority bands are occupied. Extensions cannot claim priorities above 70 (enforced by ExtensionAPI clamping).

3. **Keep CommitForm pinned** at the bottom of the sidebar, outside the scrollable panel list. It is not a collapsible panel and should not be in the registry.

4. **Do not visually distinguish extension panels.** No "extension" badge, no different background, no icon overlay. The user experience should be that all panels are first-class sidebar citizens.

5. **`when()` condition re-evaluation** should use the same `visibilityTick` pattern from `ToolbarRegistry` to force re-renders when conditions change.

6. **Panel header actions** (the `[+]` buttons on Branches, Stashes, Tags) move into the `headerActions` array of the panel config. This standardizes the pattern for extensions.

---

## 4. Status Bar UX

### 4.1 Research: How Other Tools Handle This

**VS Code Status Bar:**
- Thin horizontal bar at the very bottom of the window
- Two zones: left (workspace-scoped) and right (editor-scoped)
- Left side: branch name, sync status, problems count, debug status
- Right side: language mode, encoding, line ending, cursor position
- Extensions contribute via `createStatusBarItem(alignment, priority)`
- Priority determines order within each zone (higher = closer to the respective edge)
- Items can have click handlers, tooltips, background colors (sparingly), and icons
- Guidelines: restrict to 1 item per extension, use brief text, no custom colors unless critical
- Reference: [VS Code Status Bar](https://code.visualstudio.com/api/ux-guidelines/status-bar)

**JetBrains Status Bar:**
- Bottom bar with similar left/right zones
- Left: VCS branch, run configurations, process status
- Right: encoding, line separator, file position, memory indicator
- Plugin widgets register via `StatusBarWidgetFactory`
- Widgets are text-based, icon-optional, clickable
- "Due to prominent presentation and limited space, should be used only for information or settings that are relevant enough to be always shown"
- Reference: [IntelliJ Status Bar Widgets](https://plugins.jetbrains.com/docs/intellij/status-bar-widgets.html)

**GitKraken:**
- Bottom bar showing: current branch, remote tracking info, pull/push buttons
- Integrated with the commit graph footer
- No extension-contributed status bar items

**GitHub Desktop:**
- No visible status bar
- Branch info is in the header
- Sync status shown as buttons in the toolbar

### 4.2 FlowForge Status Bar Design

FlowForge currently has **no status bar**. The app layout is:
```
+-----------------------------------+
|  Header (h-14, ctp-mantle bg)     |
+-----------------------------------+
|  RepositoryView (flex-1)          |
|  [sidebar | blade container]      |
+-----------------------------------+
```

Adding a status bar creates:
```
+-----------------------------------+
|  Header (h-14, ctp-mantle bg)     |
+-----------------------------------+
|  RepositoryView (flex-1, min-h-0) |
|  [sidebar | blade container]      |
+-----------------------------------+
|  StatusBar (h-7, ctp-mantle bg)   |
+-----------------------------------+
```

### 4.3 Layout Zones

```
+--[LEFT ZONE]--------------------[RIGHT ZONE]--+
| branch  sync  [ext items] ...  [ext items]  enc |
+------------------------------------------------+
```

**Left zone** (workspace-scoped, read left to right):
- Core: Current branch name with icon (always visible when repo open)
- Core: Sync status (ahead/behind counts, sync in progress spinner)
- Extension: Gitflow active flow indicator ("Feature: login-page")
- Extension: Other workspace-scoped extension items

**Right zone** (contextual/secondary, read right to left):
- Extension: GitHub auth status indicator
- Extension: Other extension status indicators
- Core: Encoding, line endings (future, if an editor is added)
- Core: Version/about info (optional)

**Priority within zones:**
- Higher priority number = closer to the outer edge (left-most in left zone, right-most in right zone)
- Core items use priority 90-100 to anchor at the edges
- Extensions use priority 10-80

### 4.4 Visual Design

**Dimensions:**
- Height: `h-7` (28px) -- thin, unobtrusive, matching VS Code and JetBrains proportions
- Full width of the application window
- Fixed at the bottom, never scrolls

**Colors (Catppuccin Mocha):**
- Background: `ctp-mantle` (matches header for visual bookending)
- Border top: 1px `ctp-surface0` (matches header's bottom border)
- Text: `ctp-subtext0` (slightly muted, secondary information)
- Text on hover: `ctp-text`
- Icon: `ctp-overlay1`, 14x14 (slightly smaller than sidebar icons)
- Active/highlight: `ctp-blue` for current branch, `ctp-green` for sync OK

**Item styling:**
```
Each item:
  px-2.5 py-1
  text-xs font-medium
  cursor-pointer (if clickable)
  hover:bg-ctp-surface0/50
  rounded (within the bar, subtle hover highlight)
  flex items-center gap-1.5
  truncate (prevent text overflow)
```

**Separator between zones:**
- No explicit separator line. Left items align-start, right items align-end, with `flex-1` spacer between.
- If the bar gets crowded, items on the right truncate first (lower priority = truncates first).

**Example rendering:**

```
[GitBranch 14px] main  |  2 ahead, 1 behind  |  Feature: login    [GitHub icon] Connected
^--- left zone, priority descending ---^                ^--- right zone, priority descending ---^
```

The `|` separators are thin vertical dividers (`w-px h-3.5 bg-ctp-surface1`) between items, rendered when adjacent items exist.

### 4.5 Interaction

**Click handlers:**
- Clicking an item executes its `execute()` function
- Branch name click: opens branch switcher or branch list
- Sync status click: triggers sync operation
- Gitflow status click: opens Gitflow panel or details
- GitHub status click: opens GitHub account blade

**Tooltips:**
- Each item should have a tooltip with more detail
- Branch: "Current branch: main (2 commits ahead of origin/main)"
- Gitflow: "Active Gitflow: Feature 'login-page' (from develop)"
- Tooltip uses the standard `ShortcutTooltip` component pattern

**No background colors:** Following VS Code guidelines, status bar items should NOT use custom background colors except for critical warnings (e.g., merge conflict state). Background color changes to the entire bar (like VS Code's orange for debugging) could be considered for future "modes" but are out of scope for Phase 37.

### 4.6 Status Bar Item Config

```typescript
interface StatusBarItemConfig {
  id: string;                        // Namespaced by ExtensionAPI
  alignment: "left" | "right";       // Zone
  priority: number;                  // Position within zone
  text?: string | (() => string);    // Static or reactive text
  icon?: LucideIcon;                 // Optional icon before text
  tooltip?: string | (() => string); // Hover tooltip
  when?: () => boolean;              // Visibility condition
  execute?: () => void | Promise<void>; // Click handler
  renderCustom?: (tabIndex: number) => ReactNode; // Full custom render
  source?: string;                   // Cleanup tracking
}
```

Extensions can use either `text` + `icon` (simple items rendered by the StatusBar component) or `renderCustom` (full control, for complex widgets). `renderCustom` is the escape hatch but extensions should prefer `text` + `icon` for consistency.

### 4.7 Recommendations for FlowForge

1. **Add StatusBar component** in `App.tsx`, below the `<main>` area, inside the `flex flex-col h-screen` container. It renders only when a repository is open.

2. **Core status bar items register during app init** (before extension activation):
   - Branch name (left, priority 100)
   - Sync status (left, priority 90)

3. **Reserve priority bands** for core items (90-100) to prevent extensions from pushing core items around.

4. **One item per extension** is the guideline, not a hard limit. The registry should accept multiple items but the documentation should recommend restraint.

5. **Truncation strategy:** If the status bar overflows, items with the lowest priority in each zone are hidden first. A small "..." indicator appears if items are hidden (clicking it shows a popup with all items).

6. **No status bar in Welcome view.** The status bar should only appear when a repository is open, managed by its parent rendering condition in `App.tsx`.

---

## 5. Extension UI Cohesion

### 5.1 The Core Principle

**Extension-contributed UI must be indistinguishable from core UI.** The user should never think "this looks different because it came from an extension." This is achieved through design constraints, not guidelines -- the extension API limits what extensions can do.

### 5.2 Design Token Requirements

All extension-contributed components must use Catppuccin CSS tokens:

| Token Category | Required Tokens | Usage |
|---------------|----------------|-------|
| **Backgrounds** | `ctp-base`, `ctp-mantle`, `ctp-surface0`, `ctp-surface1` | Panel backgrounds, hover states |
| **Text** | `ctp-text`, `ctp-subtext0`, `ctp-subtext1`, `ctp-overlay0`, `ctp-overlay1` | Primary, secondary, tertiary text |
| **Borders** | `ctp-surface0`, `ctp-surface1` | Dividers, panel borders |
| **Accents** | `ctp-blue`, `ctp-green`, `ctp-red`, `ctp-yellow`, `ctp-mauve` | Selection, success, error, warning, accent |
| **Interactive** | `hover:bg-ctp-surface0/50`, `hover:text-ctp-text` | Hover states |

Extensions receive these tokens through the standard Tailwind CSS utility classes. Since FlowForge uses Tailwind v4 with Catppuccin, all tokens are available globally. No extension-specific theming is needed.

### 5.3 Icon Requirements

- **Source:** Lucide React only. Extensions must use icons from the `lucide-react` package.
- **Sizes:** Follow established patterns:
  - Sidebar headers: `w-4 h-4`
  - List item icons: `w-3.5 h-3.5`
  - Status bar icons: `w-3.5 h-3.5`
  - Context menu icons: `w-4 h-4`
  - Toolbar buttons: `w-4 h-4`
- **Colors:** Icons inherit text color. Never hardcode icon fill colors.
- **Why Lucide-only:** Consistency. Mixed icon sets (Material, FontAwesome, etc.) create visual dissonance. Lucide is already used throughout FlowForge (100+ component files import from lucide-react).

### 5.4 Spacing Constraints

All extension components should follow FlowForge's spacing system (Tailwind defaults):

| Context | Padding | Gap |
|---------|---------|-----|
| Sidebar panel header | `p-3` | `gap-2` |
| Sidebar panel content | `px-2 py-1` per item | `gap-1.5` |
| Context menu items | `px-3 py-2` | `gap-2` |
| Status bar items | `px-2.5 py-1` | `gap-1.5` |
| List items | `px-2 py-1` | `gap-1.5` |

### 5.5 Typography

| Context | Classes |
|---------|---------|
| Section titles | `font-semibold text-sm` |
| List item primary | `text-sm font-medium` |
| List item secondary | `text-xs text-ctp-overlay0` |
| Status bar text | `text-xs font-medium` |
| Context menu items | `text-sm` |
| Badges/counts | `text-xs font-medium` |
| Monospace (SHA, paths) | `font-mono` |

### 5.6 Animation and Motion

- Use `transition-opacity` and `transition-colors` for hover effects (not transform)
- Loading spinners: `animate-spin` on Lucide `Loader2` icon
- Collapsible sections: handled by native `<details>` element (no custom animation)
- Use `motion-safe:` prefix for any decorative animation to respect OS reduced-motion preference
- Avoid `framer-motion` in extension components for sidebar panels and status bar items (too heavy for small UI elements)

### 5.7 Component Guidelines for Extension Authors

**Do:**
- Use Tailwind utility classes with `ctp-*` tokens
- Use `cn()` utility from `src/lib/utils` for conditional class merging
- Follow the existing pattern of `group` / `group-hover:opacity-100` for reveal-on-hover actions
- Use `truncate` on text that might overflow
- Provide `title` attributes on all interactive elements for tooltip/accessibility
- Use `type="button"` on all `<button>` elements to prevent accidental form submission

**Do not:**
- Import custom CSS files or use `<style>` tags
- Use inline styles (`style={{ }}`)
- Use `position: fixed` or `position: absolute` (except for dropdowns/menus)
- Create custom scrollbars or override browser defaults
- Use `z-index` values above 40 (reserved for overlays, dialogs, toasts)
- Import icon libraries other than `lucide-react`

---

## 6. Extensibility Safeguards

### 6.1 Too Many Context Menu Items

**Problem:** If 5 extensions each contribute 3 items to `branch-list`, the context menu has 15 extension items plus core items = 20+ items total.

**Safeguards:**

1. **Per-extension submenu threshold:** When a single extension contributes >5 items to one location, those items auto-collapse into a submenu: `"ExtensionName >" -> [items]`.

2. **Total item cap:** If total items (across all extensions) for a location exceeds 15, the lowest-priority extension items are moved into a "More Actions..." submenu at the bottom.

3. **`when()` filtering:** Items whose `when()` returns false are not rendered at all (not grayed out, fully hidden). This dramatically reduces context menu length in practice.

4. **Group-based hiding:** If an entire group has zero visible items, its separator is also hidden.

### 6.2 Too Many Sidebar Panels

**Problem:** 10 extensions each contributing a sidebar panel = 10 extra collapsible sections.

**Safeguards:**

1. **Default collapsed:** Extension panels default to `defaultOpen: false`. The sidebar starts clean.

2. **`when()` filtering:** Panels whose `when()` returns false do not render. Panels can self-hide when irrelevant (e.g., Gitflow panel hides when Gitflow is not initialized).

3. **User toggle (future):** A "Manage Sidebar" button (gear icon in sidebar header) lets users show/hide specific panels. Preference persisted in settings.

4. **Priority clamping:** ExtensionAPI clamps panel priority to 1-69 (core occupies 70-100). Extensions cannot push themselves above core sections without explicit user reordering.

### 6.3 Too Many Status Bar Items

**Problem:** Each extension contributes 1-2 status bar items. At 10 extensions, that is 10-20 items in a narrow bar.

**Safeguards:**

1. **One-item-recommended:** Documentation strongly recommends 1 item per extension. The API allows more but guidelines discourage it.

2. **Priority-based truncation:** When the status bar overflows, items with the lowest priority in each zone are hidden first. A small overflow indicator ("..." or count badge) appears.

3. **`when()` filtering:** Items hide themselves when irrelevant (e.g., Gitflow status hides when no flow is active).

4. **Text brevity enforcement:** The `text` field should be at most 30 characters. The StatusBar component truncates longer text with an ellipsis.

5. **No custom backgrounds:** Extensions cannot color their status bar items differently. This prevents visual chaos.

### 6.4 Ordering Stability

**Problem:** Two extensions register items with the same priority. Order changes unpredictably between sessions.

**Safeguard:** When priorities are equal, items sort by extension ID (alphabetical). This is deterministic and stable. The same extension set always produces the same visual order.

### 6.5 Lifecycle Safety

**Problem:** An extension registers UI contributions during activation but crashes or fails to clean up.

**Safeguards:**

1. **ExtensionAPI.cleanup()** is called during deactivation AND on activation failure. All registrations tracked by the API instance are removed atomically.

2. **Source-based cleanup:** All new registries (ContextMenu, SidebarPanel, StatusBar) support `unregisterBySource(source)`, matching the ToolbarRegistry pattern.

3. **`onDispose` callbacks** (PLAT-05) fire during deactivation, allowing extensions to clean up subscriptions, timers, and external resources.

4. **Render safety:** If an extension's panel component throws during render, a React Error Boundary catches it and shows a fallback ("Panel failed to load") without crashing the entire sidebar.

### 6.6 Performance

**Problem:** Many `when()` functions evaluated on every render cycle.

**Safeguards:**

1. **`visibilityTick` pattern:** Same as ToolbarRegistry. The `when()` functions are only re-evaluated when `refreshVisibility()` is called or when a subscribed store value changes.

2. **`useMemo` for filtered lists:** The StatusBar, ContextMenu, and Sidebar components memoize their filtered/sorted item lists.

3. **Lazy panel rendering:** Sidebar panels that are collapsed (`<details>` is closed) do not render their content component. React does not mount the component until the panel is opened.

4. **Context menu is ephemeral:** The ContextMenu component mounts on right-click and unmounts on close. Items are filtered once when the menu opens, not on every frame.

---

## 7. Specific Recommendations for FlowForge Phase 37

### 7.1 Implementation Priorities

Phase 37 has three plans (37-01, 37-02, 37-03). Here is how UX concerns map to each:

**Plan 37-01 (Registries):**
- Create `ContextMenuRegistry`, `SidebarPanelRegistry`, `StatusBarRegistry` as Zustand stores
- Follow the `ToolbarRegistry` pattern exactly: `Map<string, Item>`, immutable updates, `source` tagging, `unregisterBySource()`, `devtools` middleware
- Create `GitHookBus` as a plain class (not Zustand -- it is a pub/sub bus, not reactive state)
- Define TypeScript interfaces for all config types with the constraints documented in this research

**Plan 37-02 (UI Surfaces):**
- Build `<ContextMenu />` component with grouped rendering, keyboard navigation, and ARIA attributes
- Refactor `RepositoryView.tsx` to read panels from `SidebarPanelRegistry` while registering core panels (Branches, Stashes, Tags, Worktrees) as panel configs
- Build `<StatusBar />` component with left/right zones, priority-based ordering, and truncation
- Wire `ContextMenu` into `BranchItem`, `TagItem`, `StashItem`, `CommitHistory` rows, and file tree items via `onContextMenu`

**Plan 37-03 (ExtensionAPI + onDispose):**
- Add `contributeContextMenu()`, `contributeSidebarPanel()`, `contributeStatusBar()`, `registerGitHook()` to ExtensionAPI
- Add `onDispose(callback)` method that collects cleanup callbacks
- Update `cleanup()` to call all registered dispose callbacks, then unregister all contributions
- Priority clamping: sidebar panels capped at 1-69, status bar items at 1-89

### 7.2 What NOT to Build in Phase 37

- **Drag-to-reorder sidebar panels:** Useful but not necessary for Phase 37. Core panels have fixed priorities, and the initial extension count is low.
- **User-configurable panel visibility:** The "Manage Sidebar" gear button is a Phase 40+ concern. For now, `when()` conditions handle visibility.
- **Context menu keyboard shortcut execution:** The context menu shows shortcut hints, but the shortcuts themselves are registered through the command registry (already exists). No duplicate shortcut handling needed.
- **Status bar background color modes:** VS Code changes the entire status bar color for debug mode. FlowForge has no equivalent mode system. Defer to future phases.
- **Animated status bar transitions:** Items appearing/disappearing should be instant, not animated. The status bar is informational, not decorative.

### 7.3 Verification Against Success Criteria

| Success Criteria | UX Design Coverage |
|-----------------|-------------------|
| 1. Right-clicking on file/branch/commit shows extension context menu items | Section 2: Full context menu design with locations, grouping, keyboard nav |
| 2. Extension registers sidebar panel that renders alongside core sections | Section 3: Panel registry, priority ordering, visual consistency |
| 3. Extension contributes status bar widget with live state | Section 4: StatusBar component, zones, reactivity through `when()` + renderCustom |
| 4. Extension receives git operation events | Section 4 of architecture doc (GitHookBus); UX impact is indirect (enables reactive status bar updates) |
| 5. onDispose callbacks fire during deactivation | Section 6.5: Lifecycle safety; no direct UX surface but prevents zombie UI |

### 7.4 Catppuccin Theme Compliance Checklist

For each new UI surface, verify:

- [ ] Background uses `ctp-base`, `ctp-mantle`, or `ctp-surface0` only
- [ ] Text uses `ctp-text`, `ctp-subtext*`, or `ctp-overlay*` only
- [ ] Borders use `ctp-surface0` or `ctp-surface1` only
- [ ] Accent colors limited to `ctp-blue`, `ctp-green`, `ctp-red`, `ctp-yellow`, `ctp-mauve`
- [ ] No hardcoded hex/rgb/hsl values
- [ ] Icons sourced from `lucide-react` only
- [ ] Font sizes use Tailwind `text-xs`, `text-sm`, `text-base` only
- [ ] Hover states use `hover:bg-ctp-surface0/50` pattern
- [ ] Focus states visible and use `focus:ring-2 ring-ctp-blue` or equivalent
- [ ] Components render correctly in both Mocha (dark) and Latte (light) themes

### 7.5 Accessibility Checklist

- [ ] Context menu has full keyboard navigation (Arrow, Enter, Escape, Home, End)
- [ ] Context menu items have `role="menuitem"`, container has `role="menu"`
- [ ] Context menu can be triggered via Shift+F10 (keyboard equivalent of right-click)
- [ ] Sidebar panel headers are focusable and toggleable via Enter/Space
- [ ] Status bar items have `role="status"` or appropriate ARIA role
- [ ] All interactive elements have `aria-label` or visible label
- [ ] Focus is trapped within context menu when open
- [ ] Focus returns to trigger element when context menu closes
- [ ] Color is never the sole indicator of state (always paired with text or icon)

---

## Sources

### Extension System Patterns
- [VS Code Context Menu Guidelines](https://code.visualstudio.com/api/ux-guidelines/context-menus)
- [VS Code Status Bar Guidelines](https://code.visualstudio.com/api/ux-guidelines/status-bar)
- [VS Code Sidebar Guidelines](https://code.visualstudio.com/api/ux-guidelines/sidebars)
- [VS Code Views Guidelines](https://code.visualstudio.com/api/ux-guidelines/views)
- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
- [IntelliJ Status Bar Widgets](https://plugins.jetbrains.com/docs/intellij/status-bar-widgets.html)
- [IntelliJ Tool Windows](https://plugins.jetbrains.com/docs/intellij/tool-windows.html)

### Git Client UI Reference
- [GitKraken Desktop Interface](https://help.gitkraken.com/gitkraken-desktop/interface/)
- [GitKraken Customizable Panel Request](https://feedback.gitkraken.com/suggestions/197834/customizable-left-panel)

### UX Best Practices
- [NNGroup: Designing Effective Contextual Menus](https://www.nngroup.com/articles/contextual-menus-guidelines/)
- [W3C WAI-ARIA Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [W3C WAI Application Menus](https://www.w3.org/WAI/tutorials/menus/application-menus/)

### Internal Codebase (Primary Reference)
- `src/extensions/ExtensionAPI.ts` -- Current extension API facade pattern
- `src/extensions/github/index.ts` -- Reference built-in extension with toolbar, blades, commands
- `src/lib/toolbarRegistry.ts` -- Reference Zustand registry pattern (template for new registries)
- `src/lib/commandRegistry.ts` -- Command registry with source tagging and category ordering
- `src/components/RepositoryView.tsx` -- Current hardcoded sidebar layout
- `src/components/branches/BranchItem.tsx` -- Current branch list item (no context menu)
- `src/components/toolbar/Toolbar.tsx` -- Registry-driven toolbar with grouping and overflow
- `src/App.tsx` -- Application layout structure (where StatusBar will be added)
- `src/index.css` -- Catppuccin theme tokens and custom animations

---
*Research completed: 2026-02-10*
*Covers: PLAT-01 (context menus), PLAT-02 (sidebar panels), PLAT-03 (status bar), PLAT-06 (expanded API)*
*UX aspects of PLAT-04 (git hooks) and PLAT-05 (onDispose) are addressed in lifecycle safety (Section 6.5)*
