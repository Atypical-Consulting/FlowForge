# Phase 18: Command Palette & Discoverability - Implementation Research

**Researched:** 2026-02-07
**Domain:** React overlay component, command registry, fuzzy search, keyboard shortcut system
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all areas delegated to Claude's discretion.

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
- Initial commands to register: Open Repo, Close Repo, Clone, Settings, Push, Pull, Fetch, Stage All, Toggle Amend, Create Branch, Generate Changelog, Refresh All, theme toggle
- Search matches against title and description with fuzzy matching
- Results ordered by: exact match > starts-with > fuzzy match, with recently-used boost if straightforward to implement
- Commands that require an open repository should be hidden/disabled when no repo is open

#### Interaction & Keyboard Flow
- Cmd/Shift+P opens palette (rebind current push shortcut to avoid conflict)
- Note: Current `Cmd+Shift+P` is Push. Palette should use `Cmd+Shift+P` (industry standard) and Push should move to another binding
- Arrow keys navigate results, Enter executes selected, Escape closes
- Selected result highlighted with accent color
- After execution: palette closes immediately
- No recent commands history in v1

#### Shortcut Tooltips
- Apply `ShortcutTooltip` (already exists) to all toolbar buttons that have associated shortcuts
- Use existing `formatShortcut()` for platform-aware display
- Standard tooltip delay (~300-500ms)
- Buttons without shortcuts just show the action name

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Summary

This phase implements two features: (1) a VS Code-style command palette overlay and (2) extending shortcut tooltips to all toolbar buttons. The codebase already has all the foundational pieces: `dialog.tsx` provides the overlay/backdrop/animation pattern, `ShortcutTooltip` handles tooltip display, `formatShortcut()` does platform-aware shortcut formatting, `react-hotkeys-hook` manages keyboard shortcuts, and `framer-motion` provides animation primitives. The main new work is the command registry data structure, the palette UI component, and a lightweight fuzzy search.

A critical finding is the **shortcut conflict**: `mod+shift+p` is currently bound to Push (in `useKeyboardShortcuts.ts` and displayed in `SyncButtons.tsx`). The command palette needs this binding (industry standard). Push must be reassigned -- the recommendation is `mod+shift+u` ("Upload" mnemonic, not currently used).

**Primary recommendation:** Build a Zustand-based command registry store, a custom palette overlay component (not reusing Dialog since palette UX is fundamentally different), fuse.js for fuzzy search, and extend existing ShortcutTooltip to remaining toolbar buttons.

## Implementation Research: Expert Developer Analysis

### Existing Component Patterns

#### Dialog System (`src/components/ui/dialog.tsx`)
**Confidence: HIGH** (directly read from codebase)

The existing dialog uses:
- `DialogContext` with `open` / `onOpenChange` pattern
- `AnimatePresence mode="wait"` wrapping both overlay and content
- **Overlay:** `motion.div` with `bg-black/50 backdrop-blur-sm`, fade in/out (0.15s)
- **Content:** `motion.div` with `opacity: 0, scale: 0.96` -> `opacity: 1, scale: 1` (0.15s easeOut)
- Positioned: `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50`
- Background: `bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl`
- Escape key handling via `document.addEventListener("keydown")`
- Auto-focus first focusable element on open
- CVA variants for size (sm, default, lg)

**For the command palette:** Do NOT reuse Dialog directly. The palette needs top-center positioning (not centered), no close button, no header/footer chrome, and the input field is integral to the overlay. Build a dedicated `CommandPalette` component that borrows the same animation/overlay patterns.

#### Dropdown Pattern (`src/components/navigation/BranchSwitcher.tsx`)
**Confidence: HIGH**

The BranchSwitcher provides an excellent reference for the palette's keyboard navigation:
- `highlightedIndex` state with ArrowUp/ArrowDown/Enter/Escape handling
- `SwitcherSearch` component for inline search input
- Click-outside dismissal via `document.addEventListener("click")`
- `AnimatePresence` with custom `slideDown` variants
- Section headers with `text-xs font-semibold text-ctp-overlay0 uppercase tracking-wider`
- Item highlighting: `bg-ctp-surface1 text-ctp-text` vs `text-ctp-subtext1 hover:bg-ctp-surface1/50`

#### ScopeAutocomplete (`src/components/commit/ScopeAutocomplete.tsx`)
**Confidence: HIGH**

Provides a pattern for input + dropdown with keyboard navigation:
- Uses `highlightedIndex` with ArrowDown/ArrowUp/Enter/Escape
- Click-outside handling with mousedown/mouseup refs for blur timing
- Dropdown positioned with `absolute z-10 w-full mt-1`

### Animation Patterns

**Confidence: HIGH** (directly read from `src/lib/animations.ts`)

#### Available Animation Variants
| Name | Initial | Animate | Use Case |
|------|---------|---------|----------|
| `fadeInScale` | `opacity:0, scale:0.95` | `opacity:1, scale:1` (0.2s easeOut) | Best fit for palette open |
| `fadeIn` | `opacity:0` | `opacity:1` (0.2s) | Overlay backdrop |
| `slideInLeft` | `opacity:0, x:-10` | `opacity:1, x:0` (0.2s easeOut) | Sidebar items |
| `staggerContainer` / `staggerItem` | stagger 0.05s delay | `opacity:1, y:0` | Result list animation |
| `bladeSlideIn` | `x:40, opacity:0` | `x:0, opacity:1` (0.2s) | Panel slide-in |

#### Recommended for Command Palette
- **Overlay backdrop:** Inline `initial={{ opacity: 0 }} animate={{ opacity: 1 }}` (matches dialog.tsx)
- **Palette panel:** Use `fadeInScale` variant or inline equivalent with slightly faster timing (0.15s to feel snappy)
- **Result items:** Do NOT animate individual items (performance concern with re-renders during search). Use `AnimatePresence` only for the palette container itself.

#### Standard Transitions
```typescript
// From src/lib/animations.ts
export const easeTransition: Transition = {
  type: "tween",
  ease: "easeOut",
  duration: 0.2,
};
```

#### Reduced Motion Support
The `ShortcutTooltip` component already demonstrates the pattern: use `useReducedMotion()` from framer-motion and render a static `<div>` instead of `<motion.div>` when reduced motion is preferred. The Skeleton component uses `motion-safe:animate-pulse`. Apply the same pattern to the palette.

### Keyboard Shortcut System

**Confidence: HIGH** (directly read from codebase)

#### Current Architecture (`src/hooks/useKeyboardShortcuts.ts`)
- All shortcuts registered in a single `useKeyboardShortcuts()` hook called from `App.tsx`
- Uses `useHotkeys` from `react-hotkeys-hook@5.2.4`
- Pattern: `useHotkeys("mod+shift+key", handler, { preventDefault: true, enabled: !!status })`
- `mod` maps to Cmd on Mac, Ctrl on Windows
- No scope system currently used -- all shortcuts are global

#### Current Shortcut Registry
| Shortcut | Action | File |
|----------|--------|------|
| `mod+o` | Open repository | useKeyboardShortcuts.ts |
| `mod+,` | Open settings | useKeyboardShortcuts.ts |
| `mod+shift+a` | Stage all | useKeyboardShortcuts.ts |
| `mod+shift+p` | Push **CONFLICT** | useKeyboardShortcuts.ts |
| `mod+shift+l` | Pull | useKeyboardShortcuts.ts |
| `mod+shift+f` | Fetch | useKeyboardShortcuts.ts |
| `mod+shift+m` | Toggle amend | useKeyboardShortcuts.ts |
| `escape` | Pop blade stack | useKeyboardShortcuts.ts |
| `enter` | Open commit details | useKeyboardShortcuts.ts |

#### Shortcut Conflict Resolution
**CRITICAL:** `mod+shift+p` is currently Push. The palette needs this binding.

**Recommendation:** Reassign Push to `mod+shift+u` ("Upload" mnemonic). This:
- Is not currently used in the app
- Has a reasonable mnemonic (Upload = Push)
- Does not conflict with any browser shortcuts
- Must be updated in THREE places:
  1. `src/hooks/useKeyboardShortcuts.ts` (line 129)
  2. `src/components/sync/SyncButtons.tsx` (line 129, ShortcutTooltip)
  3. JSDoc comment in useKeyboardShortcuts.ts (line 18)

#### react-hotkeys-hook Scope System
**Confidence: HIGH** (verified via Context7)

The library supports scopes via `HotkeysProvider`:
```tsx
<HotkeysProvider initiallyActiveScopes={['global']}>
  <App />
</HotkeysProvider>
```

However, the current codebase does NOT use scopes. Adding scopes would require wrapping the app in `HotkeysProvider` and refactoring all existing `useHotkeys` calls. **For this phase, do not introduce scopes.** Instead:
- Register the palette shortcut (`mod+shift+p`) in `useKeyboardShortcuts.ts`
- When palette is open, the palette component handles Escape/ArrowUp/ArrowDown/Enter internally via its own `onKeyDown` handler (same pattern as BranchSwitcher)
- The palette's Escape handler should close the palette before the blade-pop Escape handler fires. Since the palette uses a focused input and the blade-pop uses `enableOnFormTags: false`, there is a natural priority.

#### formatShortcut() Utility
```typescript
// src/hooks/useKeyboardShortcuts.ts
export function formatShortcut(shortcut: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return shortcut
    .replace("mod", isMac ? "cmd-symbol" : "Ctrl")
    .replace("shift", isMac ? "shift-symbol" : "Shift")
    .replace("alt", isMac ? "option-symbol" : "Alt")
    .replace(/\+/g, isMac ? "" : "+");
}
```
This is already used by `ShortcutTooltip`. Command registry entries should store shortcuts in `react-hotkeys-hook` format (e.g., `"mod+shift+p"`) and use `formatShortcut()` for display.

### Store Patterns

**Confidence: HIGH** (directly read from multiple stores)

#### Zustand Store Architecture
All stores follow the same pattern:
```typescript
import { create } from "zustand";

interface SomeState {
  // State
  someValue: string;
  isLoading: boolean;

  // Actions
  doSomething: () => void;
}

export const useSomeStore = create<SomeState>((set, get) => ({
  someValue: "",
  isLoading: false,

  doSomething: () => {
    set({ someValue: "new" });
  },
}));
```

#### Key Patterns Observed
- **No middleware:** None of the stores use persist, devtools, or immer middleware
- **Direct state access:** `useSomeStore.getState()` used for reading state outside React (e.g., in useKeyboardShortcuts.ts line 179)
- **Selector pattern:** Components use `useStore((s) => s.field)` for selective re-renders
- **External API pattern:** The `toast` store exports a plain object (`toast.success()`, `toast.error()`) for use outside components. This is the pattern to follow for the command registry.
- **Persisted stores** use `getStore()` from `src/lib/store.ts` to access `@tauri-apps/plugin-store`

#### Recommended Command Store Structure
```typescript
// src/stores/commandPalette.ts
import { create } from "zustand";

export interface Command {
  id: string;
  title: string;
  description?: string;
  category: string;
  shortcut?: string;       // react-hotkeys-hook format
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void | Promise<void>;
  enabled?: () => boolean;  // Dynamic check (e.g., repo must be open)
  keywords?: string[];       // Additional search terms
}

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  commands: Command[];

  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;
  registerCommands: (commands: Command[]) => void;
  executeSelected: () => void;
}
```

### Tailwind v4 & Theme System

**Confidence: HIGH** (directly read from `src/index.css`)

#### CSS Architecture
```css
@import "tailwindcss";
@import "@catppuccin/tailwindcss/mocha.css";

@theme {
    --font-sans: "Geist Variable", system-ui, ...;
    --font-mono: "JetBrains Mono Variable", ...;
    --animate-dirty-pulse: dirty-pulse 2s ease-in-out infinite;
}
```

#### Catppuccin Color Tokens (used as `bg-ctp-*`, `text-ctp-*`, `border-ctp-*`)
| Token | Usage in Palette |
|-------|-----------------|
| `ctp-base` | App background |
| `ctp-mantle` | Dialog/overlay backgrounds (darker than base) |
| `ctp-surface0` | Input backgrounds, borders, item hover bg |
| `ctp-surface1` | Secondary borders, highlighted item bg |
| `ctp-text` | Primary text |
| `ctp-subtext0` | Secondary text (descriptions) |
| `ctp-subtext1` | Tertiary text |
| `ctp-overlay0` | Placeholder text, muted elements |
| `ctp-blue` | Accent color, focus rings, selected items |
| `ctp-green` | Success states |
| `ctp-red` | Error states |

#### Recommended Palette Styling
```
Container: bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl
Input area: bg-ctp-surface0 border-b border-ctp-surface0
Result item: hover:bg-ctp-surface0/50
Selected item: bg-ctp-blue/15 text-ctp-text (or bg-ctp-surface1)
Category label: text-xs text-ctp-overlay0 uppercase tracking-wider
Shortcut badge: bg-ctp-surface0/80 text-ctp-subtext0 font-mono text-[10px]
Highlight match: text-ctp-blue font-medium (for fuzzy-matched characters)
```

#### Animation Registration
Custom keyframe animations are registered in the `@theme {}` block:
```css
@theme {
    --animate-dirty-pulse: dirty-pulse 2s ease-in-out infinite;
}
```
No new CSS keyframe animations are needed for the palette -- framer-motion handles all animations inline.

### Fuzzy Search Options

**Confidence: HIGH** (Context7 verified for fuse.js + codebase analysis)

#### Recommendation: fuse.js

| Library | Size (gzip) | Deps | Highlighting | Pros | Cons |
|---------|------------|------|-------------|------|------|
| **fuse.js** | ~5KB | 0 | `includeMatches` option | Industry standard, well-maintained, zero deps, built-in match indices | Slightly heavier than custom |
| uFuzzy | ~3KB | 0 | Built-in | Faster for large datasets | Less established, different API |
| Custom | 0 | 0 | Manual | No dependency | Reinventing wheel, edge cases |

**Use fuse.js.** Rationale:
1. Zero dependencies (matches project's lean dependency approach)
2. `includeMatches: true` returns character indices for highlighting -- exactly what the palette needs
3. For ~20-50 commands, performance is a non-issue
4. Threshold/scoring is configurable
5. Can search across multiple fields (`title`, `description`, `keywords`)

**Installation:** `npm install fuse.js`

**Recommended Configuration:**
```typescript
import Fuse from "fuse.js";

const fuse = new Fuse(commands, {
  keys: [
    { name: "title", weight: 2 },
    { name: "description", weight: 1 },
    { name: "keywords", weight: 1.5 },
  ],
  threshold: 0.4,         // Moderate fuzziness
  includeMatches: true,   // For highlight indices
  includeScore: true,     // For sorting
  ignoreLocation: true,   // Match anywhere in string
  minMatchCharLength: 2,  // Don't match single chars
});
```

**Highlight rendering pattern:**
```typescript
function highlightMatches(text: string, indices: readonly [number, number][]): ReactNode {
  if (!indices?.length) return text;

  const result: ReactNode[] = [];
  let lastIndex = 0;

  for (const [start, end] of indices) {
    if (start > lastIndex) {
      result.push(text.slice(lastIndex, start));
    }
    result.push(
      <span key={start} className="text-ctp-blue font-medium">
        {text.slice(start, end + 1)}
      </span>
    );
    lastIndex = end + 1;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}
```

### Reusable Components Inventory

**Confidence: HIGH** (directly verified from codebase)

| Component | Path | Reusable For |
|-----------|------|-------------|
| `ShortcutTooltip` | `src/components/ui/ShortcutTooltip.tsx` | Wrapping toolbar buttons with shortcut hints |
| `Button` | `src/components/ui/button.tsx` | CVA variants (ghost, outline, etc.) |
| `Input` | `src/components/ui/input.tsx` | Styled input with CVA size variants |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | "No results" state in palette |
| `Skeleton` | `src/components/ui/Skeleton.tsx` | Loading states |
| `cn()` | `src/lib/utils.ts` | Class merging utility (clsx + tailwind-merge) |
| `debounce()` | `src/lib/utils.ts` | Search input debouncing |
| `formatShortcut()` | `src/hooks/useKeyboardShortcuts.ts` | Platform-aware shortcut display |
| `AnimatedList` / `AnimatedListItem` | `src/components/animations/AnimatedList.tsx` | Staggered list animations (may not be suitable for search results due to re-render frequency) |
| `FadeIn` | `src/components/animations/FadeIn.tsx` | Container fade-in wrapper |
| Lucide icons | Package dependency | All command icons |
| `react-virtuoso` `Virtuoso` | Package dependency | Virtual scrolling (not needed for ~50 commands) |

#### Lucide Icons for Commands
Current icons in use that map to commands:
- `FolderOpen` - Open Repo
- `GitFork` - Clone
- `Settings` - Settings
- `ArrowUp` - Push
- `ArrowDown` - Pull
- `CloudDownload` - Fetch
- `RefreshCw` - Refresh
- `FileText` - Changelog
- `Undo2` - Undo
- `GitBranch` - Branches
- `Palette` - Appearance (from SettingsWindow)
- `Search` - Search (generic)

### Tauri Considerations

**Confidence: MEDIUM** (based on codebase patterns and general Tauri knowledge)

#### No Global Shortcut Needed
The command palette shortcut (`mod+shift+p`) is a web-level shortcut handled by `react-hotkeys-hook`. Tauri does not intercept standard keyboard shortcuts in the webview. No Tauri-specific shortcut registration is needed.

#### Window Focus
The command palette is a UI overlay within the webview, not a separate Tauri window. No window management needed.

#### Custom Events Pattern
The codebase uses `document.dispatchEvent(new CustomEvent("event-name"))` for cross-component communication (e.g., `"open-repository-dialog"`, `"clone-repository-dialog"`, `"toggle-amend"`). The command palette's `open/close/toggle` should use direct Zustand store calls instead (cleaner pattern), but commands that trigger existing functionality should use the same CustomEvent pattern where that's how the action is already triggered.

#### Tauri Event Listener
`App.tsx` already listens to Tauri events via `listen()` from `@tauri-apps/api/event`. No changes needed for the command palette.

### Performance Considerations

**Confidence: HIGH**

#### Search Debouncing
For ~20-50 commands, debouncing is NOT needed. Fuse.js searching 50 items is sub-millisecond. Filter synchronously on every keystroke for instant feedback.

If the command list grows significantly (100+), add debouncing using the existing `debounce()` utility from `src/lib/utils.ts` with 100-150ms delay.

#### Virtual Scrolling
**Not needed.** With ~50 commands and showing 8 visible results, the DOM has at most ~50 result elements. `react-virtuoso` (already in deps) is overkill here and adds complexity for scroll-into-view behavior with keyboard navigation.

#### Render Optimization
- Use `useMemo` for filtered/sorted command results
- The `enabled` predicates on commands should be lightweight (reading Zustand store state, which is synchronous)
- Avoid re-creating the Fuse instance on every render -- memoize it or create it in the store
- Individual result items should be simple `<div>` elements, not wrapped in `motion.div` (no per-item animation during search filtering)

#### Re-render Prevention
- Use the Zustand selector pattern: `useCommandPaletteStore((s) => s.isOpen)` to avoid re-rendering components that only care about one field
- The palette should be rendered at the App level (like SettingsWindow and ChangelogDialog) but will only mount its content when `isOpen` is true

### Common Pitfalls

#### Pitfall 1: Escape Key Conflicts
**What goes wrong:** Pressing Escape in the command palette also triggers the blade-pop handler in `useKeyboardShortcuts.ts`.
**Why it happens:** Both handlers listen for Escape globally.
**How to avoid:** The palette should handle Escape in its own `onKeyDown` on the input/container element and call `e.stopPropagation()`. The existing blade-pop handler uses `enableOnFormTags: false`, so if focus is on the palette input, the blade handler won't fire. But for safety, the palette's Escape handler should also check `isOpen` state.
**Warning signs:** Pressing Escape in the palette also pops a blade.

#### Pitfall 2: Focus Trap
**What goes wrong:** Focus escapes the palette, or focus is not restored when palette closes.
**Why it happens:** No focus management.
**How to avoid:**
- Auto-focus the input when palette opens (existing dialog pattern)
- Store `document.activeElement` before opening, restore on close
- The palette input should receive focus immediately on open

#### Pitfall 3: Stale Command State
**What goes wrong:** Command `enabled` predicates return stale values.
**Why it happens:** Commands are registered once but state changes.
**How to avoid:** `enabled` should be a function that reads current state (`useRepositoryStore.getState().status`), not a captured value. Evaluate `enabled()` at render time when building the filtered list.

#### Pitfall 4: Shortcut Display in Results vs Tooltips
**What goes wrong:** Shortcut appears differently in palette results vs tooltips.
**Why it happens:** Different formatting code paths.
**How to avoid:** Both the palette result shortcut display AND the ShortcutTooltip should use the same `formatShortcut()` function and `parseKeys()` from ShortcutTooltip.tsx for rendering `<kbd>` elements.

### Concrete Implementation Recommendations

#### File Structure
```
src/
  stores/
    commandPalette.ts          # Zustand store: isOpen, query, selectedIndex
  lib/
    commandRegistry.ts          # Command definitions, categories, registry array
  components/
    command-palette/
      CommandPalette.tsx         # Main overlay component
      CommandPaletteInput.tsx    # Search input with icon
      CommandPaletteResults.tsx  # Results list
      CommandPaletteItem.tsx     # Individual result row
      HighlightedText.tsx        # Fuzzy match highlighting
  hooks/
    useKeyboardShortcuts.ts     # MODIFIED: add palette toggle, reassign push
```

#### Implementation Order
1. **Install fuse.js** (`npm install fuse.js`)
2. **Reassign Push shortcut** from `mod+shift+p` to `mod+shift+u` in:
   - `src/hooks/useKeyboardShortcuts.ts`
   - `src/components/sync/SyncButtons.tsx`
3. **Create command registry** (`src/lib/commandRegistry.ts`):
   - Define `Command` type
   - Define `CommandCategory` type
   - Create `getCommands()` function that builds the full command list
   - Each command has: id, title, description, category, shortcut, icon, action, enabled, keywords
4. **Create command palette store** (`src/stores/commandPalette.ts`):
   - `isOpen`, `query`, `selectedIndex` state
   - `open()`, `close()`, `toggle()`, `setQuery()`, `setSelectedIndex()`, `executeSelected()` actions
5. **Build palette UI components** (follow dialog.tsx overlay pattern but top-center positioned):
   - `CommandPalette.tsx`: Overlay + AnimatePresence + motion.div
   - Input: Search icon + text input (similar to SwitcherSearch pattern)
   - Results: Filtered, scored, grouped by category
   - Item: Icon + title (highlighted) + description + shortcut badge
   - Empty state: "No commands match" message
6. **Register palette in App.tsx** (alongside ChangelogDialog and SettingsWindow)
7. **Add palette shortcut** (`mod+shift+p`) in `useKeyboardShortcuts.ts`
8. **Extend ShortcutTooltip** to remaining toolbar buttons in Header.tsx

#### Palette Positioning (top-center, not dialog-center)
```css
/* Unlike dialog which uses top-1/2 -translate-y-1/2 */
fixed top-[15%] left-1/2 -translate-x-1/2 z-50
w-[560px] max-w-[90vw]
```

#### Command Registration Pattern
```typescript
// src/lib/commandRegistry.ts
import {
  FolderOpen, GitFork, Settings, ArrowUp, ArrowDown,
  CloudDownload, RefreshCw, FileText, GitBranch,
  Plus, Tag, Archive, Sun, Moon
} from "lucide-react";

export function getCommands(): Command[] {
  const status = useRepositoryStore.getState().status;
  const hasRepo = !!status;

  return [
    {
      id: "open-repo",
      title: "Open Repository",
      description: "Open a Git repository from your filesystem",
      category: "Repository",
      shortcut: "mod+o",
      icon: FolderOpen,
      action: () => document.dispatchEvent(new CustomEvent("open-repository-dialog")),
      keywords: ["folder", "directory"],
    },
    {
      id: "push",
      title: "Push to Remote",
      description: "Push commits to the remote repository",
      category: "Sync",
      shortcut: "mod+shift+u",  // REASSIGNED from mod+shift+p
      icon: ArrowUp,
      action: () => { /* trigger push mutation */ },
      enabled: () => !!useRepositoryStore.getState().status,
      keywords: ["upload", "remote"],
    },
    // ... more commands
  ];
}
```

#### Keyboard Navigation in Palette
Follow the exact pattern from `BranchSwitcher.tsx`:
```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
      break;
    case "ArrowUp":
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      break;
    case "Enter":
      e.preventDefault();
      if (selectedIndex >= 0) executeCommand(filteredCommands[selectedIndex]);
      break;
    case "Escape":
      e.preventDefault();
      close();
      break;
  }
};
```

#### Scroll-into-view for Keyboard Navigation
When the highlighted index changes via arrow keys, ensure the selected item scrolls into view:
```typescript
useEffect(() => {
  const el = document.querySelector(`[data-command-index="${selectedIndex}"]`);
  el?.scrollIntoView({ block: "nearest" });
}, [selectedIndex]);
```

#### Shortcut Badge Component (reuse ShortcutTooltip's parseKeys)
```typescript
// In CommandPaletteItem.tsx
function ShortcutBadge({ shortcut }: { shortcut: string }) {
  const formatted = formatShortcut(shortcut);
  const keys = parseKeys(formatted); // from ShortcutTooltip
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((key, i) => (
        <kbd
          key={`${key}-${i}`}
          className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[10px] font-mono font-medium rounded bg-ctp-surface0/80 text-ctp-subtext0"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
```
Note: `parseKeys` is currently not exported from ShortcutTooltip. It should be extracted to a shared utility (or the ShortcutTooltip module should export it).

#### Toolbar Buttons Needing ShortcutTooltip
Currently in `Header.tsx`, these buttons have shortcuts but lack `ShortcutTooltip`:
- Stage All button (not visible in Header, but shortcut exists: `mod+shift+a`)
- Toggle Amend button (not in Header, but shortcut exists: `mod+shift+m`)

Buttons in SyncButtons.tsx already have ShortcutTooltip:
- Fetch (`mod+shift+f`) -- already wrapped
- Pull (`mod+shift+l`) -- already wrapped
- Push (`mod+shift+p` -> will become `mod+shift+u`) -- already wrapped

Buttons in Header.tsx:
- Settings (`mod+,`) -- already wrapped
- Open Repository (`mod+o`) -- already wrapped

Buttons that could benefit from tooltip (no shortcut, just label):
- Undo -- could show tooltip with action name
- Refresh All -- could show tooltip with action name
- Changelog -- could show tooltip with action name
- Clone -- could show tooltip with action name
- Close -- could show tooltip with action name

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fuse.js | latest | Fuzzy text search | Zero deps, includeMatches for highlighting, industry standard |
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcuts | Already in project |
| framer-motion | ^12.31.0 | Overlay animations | Already in project |
| zustand | ^5 | Command palette state | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.563 | Command icons | Already in project, provides all needed icons |
| class-variance-authority | ^0.7.1 | Variant styling | Already in project, for any new CVA-based components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fuse.js | uFuzzy | Slightly smaller, but less established API, fewer docs |
| fuse.js | Custom filter | No dependency but reinvents highlighting, scoring, fuzzy matching |
| fuse.js | cmdk library | Full command palette component, but opinionated UX that may conflict with existing patterns |

**Installation:**
```bash
npm install fuse.js
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy text matching | Custom fuzzy algorithm | fuse.js | Handles Unicode, scoring, match indices, configurable thresholds |
| Platform-aware shortcut display | New formatter | Existing `formatShortcut()` | Already handles Mac vs Windows |
| Tooltip with shortcut | New tooltip component | Existing `ShortcutTooltip` | Already has delay, positioning, animation, edge clamping |
| Class merging | String concatenation | Existing `cn()` (clsx + twMerge) | Handles Tailwind class conflicts |

**Key insight:** The codebase already has 80% of the building blocks. The main new code is the command registry data structure and the palette overlay UI.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom command menus | cmdk-style palette overlay | 2021+ (VS Code popularized) | Industry standard UX pattern |
| Heavyweight search (Algolia, etc.) | Client-side fuzzy (fuse.js) | N/A for small datasets | No server needed for <1000 items |
| Global shortcut registration via native API | Web-level shortcuts via react-hotkeys-hook | Tauri v2 | Simpler, no native code needed |

## Open Questions

1. **Command actions that need React context (mutations):**
   - What we know: Some commands (Push, Pull, Fetch) use `useMutation` which requires React Query context
   - What's unclear: How to invoke these from a static command registry
   - Recommendation: Commands like Push/Pull/Fetch should dispatch CustomEvents (like "open-repository-dialog" pattern), and the component that owns the mutation listens for the event. Alternatively, store mutation functions in refs accessible to the registry.

2. **Recently-used command boost:**
   - What we know: Context says "recently-used boost if straightforward"
   - Recommendation: Skip for v1 as explicitly stated in context ("No recent commands history in v1"). Can be added later by persisting last-used timestamps in the store.

## Sources

### Primary (HIGH confidence)
- Codebase direct analysis: `src/components/ui/dialog.tsx`, `src/components/ui/ShortcutTooltip.tsx`, `src/hooks/useKeyboardShortcuts.ts`, `src/lib/animations.ts`, `src/index.css`, `src/stores/*.ts`, `src/App.tsx`
- Context7 `/websites/fusejs_io` - fuse.js options, scoring, includeMatches
- Context7 `/johannesklauss/react-hotkeys-hook` - scopes, useHotkeys options, enableOnFormTags

### Secondary (MEDIUM confidence)
- Tauri v2 webview keyboard handling (based on codebase patterns showing no Tauri-level shortcut registration)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - fuse.js verified via Context7, all other libs already in project
- Architecture: HIGH - patterns directly observed in codebase, not speculated
- Pitfalls: HIGH - identified from real code (Escape conflict, focus management, stale state)
- Shortcut conflict: HIGH - directly verified `mod+shift+p` is Push in two source files

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (stable domain, no fast-moving dependencies)
