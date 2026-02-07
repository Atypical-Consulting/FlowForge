# Phase 18: Command Palette & Discoverability - Architecture Research

**Researched:** 2026-02-07
**Domain:** Command registry architecture, keyboard shortcuts, fuzzy search overlay UI
**Confidence:** HIGH
**Researcher:** Technical Architecture & Extensibility

## Summary

This research analyzes the FlowForge codebase for implementing a command palette with a typed registry pattern. The existing codebase uses a single `useKeyboardShortcuts` hook that colocates all shortcut logic (including mutation definitions for push/pull/fetch/stage), communicates via CustomEvents, and scatters action handlers across Header, WelcomeView, and SyncButtons. There is a clear opportunity to centralize all actions into a command registry that serves as the single source of truth for both the palette and shortcut binding, eliminating duplication and enabling trivial extensibility.

The codebase already has a registry pattern precedent in `ViewerRegistry.ts` (matcher + component + priority), an existing `ShortcutTooltip` component with `formatShortcut()` utility, and dialog/overlay primitives using framer-motion's AnimatePresence. The BranchSwitcher component provides a near-exact UX pattern for the command palette (search input + keyboard-navigable list + dropdown overlay).

**Primary recommendation:** Build a `commandRegistry.ts` module that exports a typed array of command definitions. Create a `useCommandPalette` Zustand store for open/close state. Build the palette as a new overlay component rendered at the App level. Refactor `useKeyboardShortcuts.ts` to read from the registry. Use a custom lightweight fuzzy matcher (no external dependency needed for this scale).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

All areas were delegated to Claude's discretion. No hard-locked decisions exist.

### Claude's Discretion

#### Palette Appearance & Layout
- Centered overlay similar to VS Code command palette -- top-center positioning, ~500-600px wide
- Use existing dialog/overlay pattern (framer-motion, backdrop blur) but adapted for palette UX (no dialog chrome, just input + results list)
- Show ~8 visible results before scrolling, with fuzzy-matched text highlighted
- Catppuccin-themed: surface0 background, text color, subtle border, consistent with existing dialog styling
- Animate in with existing `fadeInScale` or similar pattern from `animations.ts`

#### Command Registry & Categories
- Create a typed command registry (array of command objects with id, title, description, category, shortcut, action, icon, enabled predicate)
- Categories: Repository, Branches, Sync, Stash, Tags, Worktrees, Navigation, Settings
- Initial commands: Open Repo, Close Repo, Clone, Settings, Push, Pull, Fetch, Stage All, Toggle Amend, Create Branch, Generate Changelog, Refresh All, theme toggle
- Search matches against title and description with fuzzy matching
- Results ordered by: exact match > starts-with > fuzzy match, with recently-used boost if straightforward
- Commands that require an open repository should be hidden/disabled when no repo is open

#### Interaction & Keyboard Flow
- Cmd/Shift+P opens palette (need to resolve conflict with current Push shortcut)
- Arrow keys navigate results, Enter executes selected, Escape closes
- No recent commands history in v1

#### Shortcut Tooltips
- Apply `ShortcutTooltip` to all toolbar buttons with associated shortcuts
- Use existing `formatShortcut()` for platform-aware display
- Standard tooltip delay (~300-500ms)

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.

</user_constraints>

---

## Architecture Research: Command Registry & Extensibility

### Current Codebase Analysis

#### Existing Patterns for Actions, Shortcuts, Dialogs, and Overlays

**Shortcut Registration Pattern (`src/hooks/useKeyboardShortcuts.ts`):**
- Single monolithic hook that registers all global keyboard shortcuts using `react-hotkeys-hook`'s `useHotkeys()`
- Contains inline `useMutation()` definitions for push, pull, fetch, and stage-all operations
- Uses `document.dispatchEvent(new CustomEvent(...))` for cross-component communication:
  - `"open-repository-dialog"` -- consumed by WelcomeView
  - `"clone-repository-dialog"` -- consumed by WelcomeView
  - `"toggle-amend"` -- consumed by CommitForm
- Called once at App level: `useKeyboardShortcuts()` in `App.tsx`
- Also exports `formatShortcut()` utility (used by 4 files)

**Action Handler Locations (scattered):**
- `Header.tsx`: handleOpenRepo, handleClose, handleRefreshAll, handleUndo, handleRepoSwitch, handleBranchSwitch, openChangelog, openSettings
- `SyncButtons.tsx`: pushMutation, pullMutation, fetchMutation (DUPLICATED from useKeyboardShortcuts)
- `CommitForm.tsx`: commitMutation, pushMutation (DUPLICATED again)
- `WelcomeView.tsx`: openDialog (open repo), clone form toggle
- `useKeyboardShortcuts.ts`: stageAllMutation, pushMutation, pullMutation, fetchMutation
- Store methods: `useRepositoryStore.openRepository()`, `useRepositoryStore.closeRepository()`, `useSettingsStore.openSettings()`, `useChangelogStore.openDialog()`, `useThemeStore.setTheme()`, `useBranchStore.createBranch()`

**Dialog/Overlay Pattern:**
- Custom `Dialog` component (`src/components/ui/dialog.tsx`) using framer-motion AnimatePresence
- Pattern: context-based open/close state, backdrop overlay click-to-dismiss, Escape key handling, auto-focus
- Used by: SettingsWindow, ChangelogDialog, ConventionalCommitModal, CreateBranchDialog, CreateWorktreeDialog, etc.
- All dialogs follow: `Dialog open={isOpen} onOpenChange={...}` -> `DialogContent` -> children

**Dropdown/Palette-like Pattern (closest UX precedent):**
- `BranchSwitcher.tsx`: search input + keyboard-navigable filtered list + AnimatePresence dropdown
- Already implements: search filtering, arrow key navigation, Enter to select, Escape to close, highlighted index tracking
- This component is the closest architectural precedent for the command palette UX

**Existing Registry Pattern:**
- `ViewerRegistry.ts`: `registerViewer(matcher, component, priority)` with `getViewerForFile(file)` lookup
- Simple array-based registry, sorted by priority -- applicable pattern for command registry

**Animation Patterns (`src/lib/animations.ts`):**
- `fadeInScale`: `{ opacity: 0, scale: 0.95 }` -> `{ opacity: 1, scale: 1 }` -- ideal for palette entrance
- `staggerContainer` + `staggerItem`: for animating result list items
- `fadeIn`: simple opacity fade for backdrop

### Shortcut System Audit

**Current Shortcut Map:**

| Shortcut | Action | Location | Condition |
|----------|--------|----------|-----------|
| `mod+o` | Open repository dialog | useKeyboardShortcuts | Always |
| `mod+,` | Open settings | useKeyboardShortcuts | Always |
| `mod+shift+a` | Stage all files | useKeyboardShortcuts | Repo open |
| `mod+shift+p` | Push to remote | useKeyboardShortcuts | Repo open |
| `mod+shift+l` | Pull from remote | useKeyboardShortcuts | Repo open |
| `mod+shift+f` | Fetch from remote | useKeyboardShortcuts | Repo open |
| `mod+shift+m` | Toggle amend commit | useKeyboardShortcuts | Repo open |
| `escape` | Pop blade stack | useKeyboardShortcuts | Blade depth > 1 |
| `enter` | Open commit details | useKeyboardShortcuts | Topology selected |

**Conflict Analysis -- `Cmd+Shift+P`:**
- Currently bound to Push.
- Industry standard for command palette: `Cmd+Shift+P` (VS Code, Sublime, JetBrains)
- **Recommendation:** Reassign Push to `Cmd+Shift+U` ("Upload" mnemonic) or `Cmd+Shift+K` and give `Cmd+Shift+P` to the palette. This matches user expectation for discoverability.
- Alternative: Use `Cmd+K` as palette trigger (GitHub, Linear pattern). But `Cmd+Shift+P` is more standard for a "command palette" specifically.

**What Needs to Change:**
1. Shortcut definitions should move into command objects in the registry
2. `useKeyboardShortcuts.ts` should be refactored to iterate over registry commands and call `useHotkeys()` per command
3. The `formatShortcut()` utility stays as-is but moves to a shared location (or stays where it is -- it's already imported cross-file)
4. CustomEvent dispatches (`open-repository-dialog`, `clone-repository-dialog`, `toggle-amend`) should be replaced by direct action calls from the registry

### Action Handler Inventory

Commands to register (from CONTEXT.md + codebase analysis):

| ID | Title | Description | Category | Current Shortcut | New Shortcut | Current Location | Requires Repo |
|----|-------|-------------|----------|-----------------|--------------|-----------------|---------------|
| `open-repository` | Open Repository | Open a local Git repository | Repository | `mod+o` | `mod+o` | Header.handleOpenRepo, WelcomeView.openDialog | No |
| `close-repository` | Close Repository | Close the current repository | Repository | -- | -- | Header.handleClose | Yes |
| `clone-repository` | Clone Repository | Clone a remote repository | Repository | -- | -- | Header (CustomEvent), WelcomeView | No |
| `open-settings` | Settings | Open application settings | Settings | `mod+,` | `mod+,` | useSettingsStore.openSettings | No |
| `push` | Push | Push commits to remote | Sync | `mod+shift+p` | `mod+shift+u` | useKeyboardShortcuts, SyncButtons | Yes |
| `pull` | Pull | Pull changes from remote | Sync | `mod+shift+l` | `mod+shift+l` | useKeyboardShortcuts, SyncButtons | Yes |
| `fetch` | Fetch | Fetch updates from remote | Sync | `mod+shift+f` | `mod+shift+f` | useKeyboardShortcuts, SyncButtons | Yes |
| `stage-all` | Stage All | Stage all changes for commit | Sync | `mod+shift+a` | `mod+shift+a` | useKeyboardShortcuts, StagingPanel | Yes |
| `toggle-amend` | Toggle Amend | Toggle amend mode for commit | Sync | `mod+shift+m` | `mod+shift+m` | useKeyboardShortcuts (CustomEvent) | Yes |
| `create-branch` | Create Branch | Create a new Git branch | Branches | -- | -- | RepositoryView state | Yes |
| `generate-changelog` | Generate Changelog | Generate a changelog from commits | Repository | -- | -- | Header (openChangelog) | Yes |
| `refresh-all` | Refresh All | Refresh branches, stashes, and tags | Repository | -- | -- | Header.handleRefreshAll | Yes |
| `toggle-theme` | Toggle Theme | Cycle through light/dark/system themes | Settings | -- | -- | ThemeToggle | No |
| `command-palette` | Command Palette | Open the command palette | Navigation | -- | `mod+shift+p` | NEW | No |

### Command Registry Design

**Command Interface:**

```typescript
// src/lib/commandRegistry.ts

import type { LucideIcon } from "lucide-react";

export type CommandCategory =
  | "Repository"
  | "Branches"
  | "Sync"
  | "Stash"
  | "Tags"
  | "Worktrees"
  | "Navigation"
  | "Settings";

export interface Command {
  /** Unique identifier, kebab-case (e.g., "open-repository") */
  id: string;
  /** Display title in palette (e.g., "Open Repository") */
  title: string;
  /** Optional description shown below title */
  description?: string;
  /** Category for grouping in palette results */
  category: CommandCategory;
  /** Keyboard shortcut in react-hotkeys-hook format (e.g., "mod+shift+p") */
  shortcut?: string;
  /** Lucide icon component reference */
  icon?: LucideIcon;
  /** The action to execute when command is invoked */
  action: () => void | Promise<void>;
  /**
   * Whether the command is currently available.
   * Evaluated dynamically -- reads from store state.
   * If returns false, command is hidden from palette and shortcut is disabled.
   */
  enabled: () => boolean;
}
```

**Registry Module:**

```typescript
// src/lib/commandRegistry.ts

const commands: Command[] = [];

export function registerCommand(command: Command): void {
  // Prevent duplicate IDs
  const existing = commands.findIndex((c) => c.id === command.id);
  if (existing >= 0) {
    commands[existing] = command;
  } else {
    commands.push(command);
  }
}

export function getCommands(): Command[] {
  return commands;
}

export function getEnabledCommands(): Command[] {
  return commands.filter((c) => c.enabled());
}

export function getCommandById(id: string): Command | undefined {
  return commands.find((c) => c.id === id);
}

export function executeCommand(id: string): void {
  const cmd = commands.find((c) => c.id === id);
  if (cmd && cmd.enabled()) {
    cmd.action();
  }
}
```

**Registration Pattern (commands defined in a separate file):**

```typescript
// src/commands/index.ts -- registers all commands

import { FolderOpen, X, GitFork, Settings, ArrowUp, ArrowDown,
         CloudDownload, FileCheck, RotateCcw, GitBranch, FileText,
         RefreshCw, Sun, Search } from "lucide-react";
import { registerCommand } from "../lib/commandRegistry";
import { useRepositoryStore } from "../stores/repository";
import { useSettingsStore } from "../stores/settings";
import { useChangelogStore } from "../stores/changelogStore";
import { useThemeStore } from "../stores/theme";
// ... other imports

function hasOpenRepo(): boolean {
  return useRepositoryStore.getState().status !== null;
}

function always(): boolean {
  return true;
}

// Repository commands
registerCommand({
  id: "open-repository",
  title: "Open Repository",
  description: "Open a local Git repository folder",
  category: "Repository",
  shortcut: "mod+o",
  icon: FolderOpen,
  action: () => {
    document.dispatchEvent(new CustomEvent("open-repository-dialog"));
  },
  enabled: always,
});

// ... more commands
```

**Key Design Decision -- `action` closures access stores directly:**

Command actions will call `useXxxStore.getState().someMethod()` inside their closures. This avoids needing React context or hooks inside the registry. This is the exact pattern already used by the `toast` helper in `src/stores/toast.ts`:

```typescript
export const toast = {
  success: (message: string) => {
    return useToastStore.getState().addToast({ type: "success", message });
  },
};
```

### Extensibility Architecture

**Adding a New Command in Future Phases:**

1. Import `registerCommand` from `src/lib/commandRegistry.ts`
2. Call `registerCommand({ id, title, category, action, enabled })` -- one function call
3. Done. The command automatically appears in the palette, gets a shortcut if specified, and respects enabled/disabled state.

**File structure:**

```
src/
├── lib/
│   └── commandRegistry.ts      # Command type + registry functions (pure logic)
├── commands/
│   ├── index.ts                 # Barrel -- imports and registers all commands
│   ├── repository.ts            # Open, Close, Clone, Changelog, Refresh
│   ├── sync.ts                  # Push, Pull, Fetch, Stage All, Toggle Amend
│   ├── branches.ts              # Create Branch
│   ├── navigation.ts            # Command Palette (self-referential)
│   └── settings.ts              # Settings, Theme Toggle
├── stores/
│   └── commandPalette.ts        # Zustand store: isOpen, open(), close(), query
├── hooks/
│   └── useKeyboardShortcuts.ts  # REFACTORED: reads registry, binds shortcuts
├── components/
│   └── command-palette/
│       ├── CommandPalette.tsx    # Main overlay component
│       ├── CommandPaletteInput.tsx   # Search input
│       └── CommandPaletteItem.tsx    # Single result row
```

**Why separate command files per category:**
- Each file imports only the stores it needs (no circular dependency risk)
- Easy to locate commands when debugging
- New phases add a new file or append to existing category file
- The barrel `commands/index.ts` imports all, which is called once at app startup

**Registration Timing:**
- `commands/index.ts` must be imported early in the app lifecycle (in `main.tsx` or `App.tsx`)
- Since commands use `getState()` (not hooks), they can be registered at module load time
- The `enabled()` predicate is evaluated lazily at invocation time, so store state is always current

### Refactoring Plan

**Phase 1: Create Registry Infrastructure (non-breaking)**

1. Create `src/lib/commandRegistry.ts` with types and registry functions
2. Create `src/commands/*.ts` files registering all commands
3. Create `src/stores/commandPalette.ts` Zustand store
4. Import `src/commands/index.ts` in `App.tsx` or `main.tsx`

**Phase 2: Refactor useKeyboardShortcuts (minimal changes)**

Current `useKeyboardShortcuts.ts` has:
- 7 `useHotkeys()` calls with inline logic
- 4 `useMutation()` definitions (push, pull, fetch, stageAll)
- Returns loading states `{ isStaging, isPushing, isPulling, isFetching }`

Refactored approach:
- Replace individual `useHotkeys()` calls with a loop over `getCommands().filter(c => c.shortcut)`
- The mutations for sync operations (push/pull/fetch) need careful handling because the current hook returns loading states consumed by UI
- **Recommendation:** Keep the `useMutation` loading state logic in the existing hook for now (or move to SyncButtons which already has its own mutations). The registry command's `action()` calls the same underlying store/command but does NOT provide loading feedback to the UI. The sync buttons continue to use their own mutations for progress display.
- Remove the duplicated mutation definitions from useKeyboardShortcuts -- the shortcut action just calls the same code path as SyncButtons
- Remove CustomEvent dispatches for `open-repository-dialog` and `toggle-amend` where possible (but keep them for WelcomeView which still needs to listen)

**Phase 3: Build Command Palette UI (new component)**

1. `CommandPalette.tsx` -- overlay with search, results, keyboard nav
2. Render in `App.tsx` alongside other global overlays (ChangelogDialog, SettingsWindow, ToastContainer)

**Phase 4: Extend ShortcutTooltips (enhancement)**

Apply `ShortcutTooltip` to all toolbar buttons that have commands with shortcuts. Most are already wrapped (settings, sync buttons). Add to:
- Refresh All button in Header
- Generate Changelog button in Header
- Any other buttons gaining shortcuts

**Duplication to Eliminate:**

| Code | Current Locations | After Refactor |
|------|-------------------|----------------|
| Push mutation | useKeyboardShortcuts, SyncButtons, CommitForm | SyncButtons (UI), registry command calls same path |
| Pull mutation | useKeyboardShortcuts, SyncButtons | SyncButtons (UI), registry command calls same path |
| Fetch mutation | useKeyboardShortcuts, SyncButtons | SyncButtons (UI), registry command calls same path |
| StageAll mutation | useKeyboardShortcuts, StagingPanel | Registry command, StagingPanel keeps its own for UI |
| Open repo logic | Header, WelcomeView, useKeyboardShortcuts | Registry command (CustomEvent bridge for WelcomeView) |

### State Management Integration

**New Store: `src/stores/commandPalette.ts`**

```typescript
import { create } from "zustand";

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;

  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;
  resetState: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  isOpen: false,
  query: "",
  selectedIndex: 0,

  open: () => set({ isOpen: true, query: "", selectedIndex: 0 }),
  close: () => set({ isOpen: false, query: "", selectedIndex: 0 }),
  toggle: () =>
    set((state) =>
      state.isOpen
        ? { isOpen: false, query: "", selectedIndex: 0 }
        : { isOpen: true, query: "", selectedIndex: 0 }
    ),
  setQuery: (query) => set({ query, selectedIndex: 0 }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
  resetState: () => set({ query: "", selectedIndex: 0 }),
}));
```

**How command `enabled()` predicates integrate with stores:**

```typescript
// In command registration:
enabled: () => useRepositoryStore.getState().status !== null,
```

This works because `getState()` is synchronous and reads the latest Zustand state at call time. No subscriptions needed. The palette evaluates `enabled()` when rendering results, so it's always fresh.

**Store interaction pattern:**
- Command actions: `useXxxStore.getState().someAction()` (imperative, outside React)
- Palette UI: `useCommandPaletteStore()` (reactive, inside React)
- Command predicates: `useXxxStore.getState().someValue` (synchronous read)
- This matches the existing `toast.success()` pattern perfectly

### Fuzzy Search Strategy

**Recommendation: Custom lightweight fuzzy match -- do NOT add fuse.js.**

Rationale:
- Only ~13 commands to search across
- Search fields are short strings (title + description)
- The desired ranking (exact > starts-with > fuzzy) is simple to implement
- Adding fuse.js for 13 items is overkill and adds a dependency
- The BranchSwitcher already uses simple `includes()` filtering

**Proposed search algorithm:**

```typescript
interface ScoredCommand {
  command: Command;
  score: number;
  matchedRanges: Array<[number, number]>; // for highlight
}

function searchCommands(query: string, commands: Command[]): ScoredCommand[] {
  if (!query.trim()) return commands.map(c => ({ command: c, score: 0, matchedRanges: [] }));

  const q = query.toLowerCase();

  return commands
    .map((command) => {
      const title = command.title.toLowerCase();
      const desc = (command.description || "").toLowerCase();

      // Exact match in title
      if (title === q) return { command, score: 100, matchedRanges: [[0, q.length]] as [number, number][] };
      // Starts with
      if (title.startsWith(q)) return { command, score: 80, matchedRanges: [[0, q.length]] as [number, number][] };
      // Contains in title
      const titleIdx = title.indexOf(q);
      if (titleIdx >= 0) return { command, score: 60, matchedRanges: [[titleIdx, titleIdx + q.length]] as [number, number][] };
      // Contains in description
      if (desc.includes(q)) return { command, score: 40, matchedRanges: [] };
      // Fuzzy: all query chars appear in order
      const ranges = fuzzyMatch(q, title);
      if (ranges) return { command, score: 20, matchedRanges: ranges };

      return null;
    })
    .filter((r): r is ScoredCommand => r !== null)
    .sort((a, b) => b.score - a.score);
}

function fuzzyMatch(query: string, text: string): [number, number][] | null {
  // Simple subsequence match with range tracking
  const ranges: [number, number][] = [];
  let qi = 0;
  let rangeStart = -1;

  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      if (rangeStart === -1) rangeStart = ti;
      qi++;
    } else if (rangeStart !== -1) {
      ranges.push([rangeStart, ti]);
      rangeStart = -1;
    }
  }

  if (qi < query.length) return null; // Not all chars matched
  if (rangeStart !== -1) ranges.push([rangeStart, rangeStart + 1]);
  return ranges;
}
```

### Dependency Map

**Files to CREATE (new):**

| File | Purpose |
|------|---------|
| `src/lib/commandRegistry.ts` | Command type, registry functions |
| `src/commands/index.ts` | Barrel: imports all command registrations |
| `src/commands/repository.ts` | Open, Close, Clone, Changelog, Refresh commands |
| `src/commands/sync.ts` | Push, Pull, Fetch, Stage All, Toggle Amend commands |
| `src/commands/branches.ts` | Create Branch command |
| `src/commands/navigation.ts` | Command Palette (open self) command |
| `src/commands/settings.ts` | Settings, Theme Toggle commands |
| `src/stores/commandPalette.ts` | Palette open/close/query state |
| `src/components/command-palette/CommandPalette.tsx` | Main overlay component |
| `src/components/command-palette/CommandPaletteInput.tsx` | Search input |
| `src/components/command-palette/CommandPaletteItem.tsx` | Result row |
| `src/components/command-palette/index.ts` | Barrel export |
| `src/lib/fuzzySearch.ts` | Fuzzy search + scoring utility |

**Files to MODIFY (existing):**

| File | Changes |
|------|---------|
| `src/App.tsx` | Import commands registration, render CommandPalette overlay |
| `src/hooks/useKeyboardShortcuts.ts` | Refactor to read from registry for shortcut bindings; add palette toggle shortcut; reassign Push shortcut |
| `src/components/Header.tsx` | Add ShortcutTooltip to Refresh All and Changelog buttons; potential simplification of action handlers |
| `src/components/sync/SyncButtons.tsx` | Update Push shortcut display from `mod+shift+P` to new binding |
| `src/components/staging/StagingPanel.tsx` | No change needed (already uses formatShortcut inline) |

**Files UNCHANGED:**

All store files remain unchanged. Command actions call into stores via `getState()`, so stores don't need to know about the registry.

### Recommendations

#### 1. Push Shortcut Reassignment (HIGH confidence)

**Current:** `Cmd+Shift+P` = Push
**Proposed:** `Cmd+Shift+P` = Command Palette; Push moves to `Cmd+Shift+U` (Upload mnemonic)

Rationale: Every major editor uses `Cmd+Shift+P` for the command palette. Users will instinctively try this. Push's current shortcut is displayed in the ShortcutTooltip -- just update the tooltip and the binding. The "U" for upload is a reasonable mnemonic.

#### 2. No External Fuzzy Search Library (HIGH confidence)

With ~13 commands, a hand-rolled scoring function (exact > starts-with > contains > subsequence) is faster to implement, has zero bundle impact, and is trivially testable. If the command count grows to 50+, fuse.js can be added later with no architecture change.

#### 3. Command Actions Use `getState()` Pattern (HIGH confidence)

This is already proven in the codebase (`toast.success()`, `useBladeStore.getState().popBlade()` in the keyboard shortcuts). It avoids the need for React context or hooks in the registry module.

#### 4. Keep Mutations in UI Components (HIGH confidence)

The sync mutations (push/pull/fetch) need loading state for spinner UI in SyncButtons. The registry command's `action()` should invoke the same operation but does NOT need to track loading state. SyncButtons keeps its own `useMutation` for UI feedback. The keyboard shortcut just triggers the same action. This avoids complex state sharing.

#### 5. Palette Overlay Renders at App Level (HIGH confidence)

Render `<CommandPalette />` in `App.tsx` alongside `<ChangelogDialog />`, `<SettingsWindow />`, and `<ToastContainer />`. This ensures it's always available regardless of which view (Welcome vs Repository) is active.

#### 6. Registry is a Plain Module, Not a Store (HIGH confidence)

The command list is static at runtime (registered at app startup, never changes). It does not need to be reactive. Using a plain module with exported functions (`getCommands()`, `registerCommand()`) is simpler and more performant than putting it in Zustand. Only the palette UI state (isOpen, query, selectedIndex) belongs in a Zustand store.

#### 7. Escape Key Conflict Resolution (MEDIUM confidence)

Current Escape behavior: closes current blade (if depth > 1). The palette should take priority when open: Escape closes palette first, blades only close if palette is not open. This is handled by checking `useCommandPaletteStore.getState().isOpen` before the blade Escape handler fires, or by having the palette component `stopPropagation` on its own Escape handler.

#### 8. Incremental Delivery Strategy

The implementation can be delivered incrementally:
1. **First:** Registry + command registration (no UI change, fully testable)
2. **Second:** Refactor useKeyboardShortcuts to use registry (shortcuts work same as before)
3. **Third:** Build CommandPalette UI component
4. **Fourth:** Connect palette to registry, add ShortcutTooltips

This minimizes risk and allows verification at each step.

---

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcut binding | Already used; supports scopes, enabled predicate, form tag handling |
| zustand | ^5 | State management for palette | Already used for all stores |
| framer-motion | ^12.31.0 | Overlay animation | Already used for all dialogs/overlays |
| lucide-react | ^0.563 | Icons for commands | Already used throughout |
| class-variance-authority | ^0.7.1 | Component variants | Already used for Button, Dialog, Input |

### No New Dependencies Needed

| Problem | Don't Add | Why |
|---------|-----------|-----|
| Fuzzy search | fuse.js / flexsearch | Only ~13 commands; custom scorer is 30 lines |
| Command palette UI | cmdk / kbar | Full custom build matches existing patterns better |

## Common Pitfalls

### Pitfall 1: Shortcut Conflicts with Palette Open
**What goes wrong:** Palette opens on `Cmd+Shift+P`, but if the old Push binding still exists, both fire.
**How to avoid:** Ensure the Push shortcut is rebound BEFORE the palette shortcut is registered. In the refactored `useKeyboardShortcuts`, process commands from the registry where the shortcut map has already been updated.

### Pitfall 2: Command Actions Calling Hooks
**What goes wrong:** Trying to use `useMutation()` or `useQueryClient()` inside command action closures.
**How to avoid:** Command actions MUST use imperative patterns only: `useXxxStore.getState()`, `commands.someApi()`, `document.dispatchEvent()`. No React hooks.

### Pitfall 3: Stale `enabled()` Predicates
**What goes wrong:** If `enabled()` is evaluated once at registration and cached, it becomes stale.
**How to avoid:** Always call `enabled()` fresh when rendering palette results or checking shortcut availability. Never cache the result.

### Pitfall 4: Focus Trap in Palette
**What goes wrong:** Opening the palette doesn't focus the search input; keyboard navigation doesn't work.
**How to avoid:** Use `autoFocus` on the search input (like SwitcherSearch does). Ensure the palette container handles keyboard events (arrow keys, Enter, Escape) directly.

### Pitfall 5: Palette Not Closing After Action Execution
**What goes wrong:** User selects a command, it executes, but palette stays open.
**How to avoid:** After `executeCommand()`, always call `useCommandPaletteStore.getState().close()`.

## Open Questions

1. **CustomEvent bridge for WelcomeView:** The `open-repository-dialog` and `clone-repository-dialog` events are consumed by WelcomeView which mounts/unmounts. After refactoring, should WelcomeView subscribe to a store action instead of DOM events? This is a nice-to-have cleanup but not strictly necessary for Phase 18. Recommend keeping CustomEvents for now and noting it as tech debt.

2. **Sync operation loading state:** When Push/Pull/Fetch are triggered from the command palette (not from the SyncButtons), there's no progress indicator visible. The toast notifications handle success/error. For v1, this is acceptable -- the user gets toast feedback. Future improvement could surface a global progress indicator.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files listed in Dependency Map section
- `/johannesklauss/react-hotkeys-hook` Context7 docs -- useHotkeys API, options, scopes
- `/websites/fusejs_io` Context7 docs -- confirmed fuse.js is overkill for this use case

### Secondary (MEDIUM confidence)
- VS Code command palette UX as reference for interaction design (industry standard)
- Existing ViewerRegistry.ts as architecture precedent for registry pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in the project, no new deps
- Architecture: HIGH -- registry pattern verified against existing codebase patterns (ViewerRegistry, toast module)
- Pitfalls: HIGH -- identified from direct analysis of current shortcut/mutation duplication
- Fuzzy search: HIGH -- custom implementation verified sufficient for command count

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (stable -- no fast-moving dependencies)
