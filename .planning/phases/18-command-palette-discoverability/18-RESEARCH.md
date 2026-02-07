# Phase 18: Command Palette & Discoverability - Synthesized Research

**Researched:** 2026-02-07
**Domain:** Command registry architecture, palette overlay UI, keyboard shortcuts, fuzzy search
**Confidence:** HIGH
**Sources:** 3 parallel researchers (UX, Architecture, Expert Developer)

## Summary

Three researchers investigated Phase 18 from different angles: UX & interaction design, technical architecture & extensibility, and expert implementation (Tauri/React/Tailwind v4). All three converged on the same core approach: build a custom command palette using existing codebase patterns (framer-motion overlays, react-hotkeys-hook, Zustand stores, ViewerRegistry pattern), with a module-level typed command registry that enables trivial extensibility.

The codebase already has 80% of the building blocks. The main new work is: (1) command registry data structure, (2) fuzzy search utility, (3) palette overlay UI component, and (4) extending ShortcutTooltip coverage.

**Primary recommendation:** Build a `commandRegistry.ts` module-level typed array following ViewerRegistry.ts pattern. Create a `CommandPalette` overlay component (NOT reusing Dialog — palette needs different UX). Use a custom hand-rolled fuzzy matcher (sufficient for ~13 commands). Refactor `useKeyboardShortcuts.ts` to use the registry. Reassign Push from `Cmd+Shift+P` to `Cmd+Shift+U`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All areas were delegated to Claude's Discretion. No hard locked decisions from the user.

### Claude's Discretion

#### Palette Appearance & Layout
- Centered overlay similar to VS Code command palette — top-center positioning, ~500-600px wide
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
- Arrow keys navigate results, Enter executes selected, Escape closes
- Selected result highlighted with accent color
- After execution: palette closes immediately
- No recent commands history in v1 — keep it simple

#### Shortcut Tooltips
- Apply `ShortcutTooltip` (already exists) to all toolbar buttons that have associated shortcuts
- Use existing `formatShortcut()` for platform-aware display (Mac symbols vs Windows text)
- Standard tooltip delay (~300-500ms)
- Buttons without shortcuts just show the action name (no shortcut portion)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Standard Stack

### Core (Already in Project — No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcut registration | Already used for all shortcuts in useKeyboardShortcuts.ts |
| framer-motion | ^12.31.0 | Overlay animations (AnimatePresence, motion) | Already used for all dialogs, tooltips, and transitions |
| zustand | ^5 | Palette open/close state | Already used for all stores |
| lucide-react | ^0.563 | Command icons | Already used for all icons |
| class-variance-authority | ^0.7.1 | Variant-based component styling | Already used for Button, Dialog |

### No New Dependencies Needed
| Problem | Don't Add | Why |
|---------|-----------|-----|
| Fuzzy search | fuse.js / microfuzz | Only ~13 commands; custom 30-line scorer is sufficient, no bundle impact |
| Command palette UI | cmdk / kbar | React 19 compatibility risk via Radix; project has all building blocks |

**Researcher consensus:** 2 of 3 researchers recommend hand-rolled fuzzy search. For ~13 commands, a simple tiered scorer (exact > starts-with > substring > subsequence) is faster to implement and has zero bundle impact.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── commandRegistry.ts      # Command type + registry functions (pure logic)
│   └── fuzzySearch.ts           # Fuzzy match scoring and highlighting
├── commands/
│   ├── index.ts                 # Barrel: imports and registers all commands
│   ├── repository.ts            # Open, Close, Clone, Changelog, Refresh
│   ├── sync.ts                  # Push, Pull, Fetch, Stage All, Toggle Amend
│   ├── branches.ts              # Create Branch
│   ├── navigation.ts            # Command Palette (open self)
│   └── settings.ts              # Settings, Theme Toggle
├── stores/
│   └── commandPalette.ts        # Zustand store: isOpen, query, selectedIndex
├── hooks/
│   └── useKeyboardShortcuts.ts  # REFACTORED: reads registry, binds shortcuts
├── components/
│   └── command-palette/
│       ├── CommandPalette.tsx    # Root overlay component
│       ├── CommandPaletteItem.tsx # Single result row
│       └── index.ts             # Barrel export
```

### Pattern 1: Module-Level Registry (NOT a Zustand Store)
**What:** A typed array of command objects at module scope, with register/get functions.
**Why NOT Zustand:** Commands are static declarations registered at startup. They don't change reactively. Using a plain module with exported functions is simpler and more performant. Only palette UI state (isOpen, query, selectedIndex) belongs in Zustand.
**Precedent:** `ViewerRegistry.ts` already uses this exact pattern (matcher + component + priority).

```typescript
// src/lib/commandRegistry.ts
export interface Command {
  id: string;
  title: string;
  description?: string;
  category: CommandCategory;
  shortcut?: string;          // react-hotkeys-hook format: "mod+shift+p"
  icon?: LucideIcon;
  action: () => void | Promise<void>;
  enabled?: () => boolean;    // Dynamic predicate — reads store state at call time
  hidden?: () => boolean;     // Dynamic visibility predicate
  keywords?: string[];        // Additional search terms
}

const commands: Command[] = [];

export function registerCommand(cmd: Command): void { ... }
export function getCommands(): Command[] { ... }
export function getEnabledCommands(): Command[] { ... }
```

### Pattern 2: Store-Based Action Pattern (for commands)
**What:** Command actions call `useXxxStore.getState().someAction()` inside closures.
**Precedent:** Already proven by `toast.success()` in `src/stores/toast.ts` and blade-pop in `useKeyboardShortcuts.ts`.
**Implication:** No React hooks needed inside the registry module. Commands that trigger existing functionality use CustomEvent dispatches (e.g., `"open-repository-dialog"`).

### Pattern 3: ARIA Combobox for Palette (Accessibility)
**What:** Input with `role="combobox"` + results list with `role="listbox"` + `aria-activedescendant` for visual focus tracking.
**Why:** WAI-ARIA APG Combobox is the canonical accessible pattern. Use `aria-activedescendant` (NOT DOM focus movement) so users can keep typing while arrowing through results.
**Screen reader:** Announce result count via `aria-live="polite"`, announce selected item via `aria-activedescendant`.

### Pattern 4: Focus Restoration
Save `document.activeElement` before opening palette, restore on close. Same pattern as existing dialog focus management.

### Anti-Patterns to Avoid
- **Moving DOM focus to each result item** — breaks typing, causes screen reader interruptions
- **Animating individual result items** — makes filtering feel sluggish
- **Using `role="dialog"` for the palette** — use combobox + listbox
- **Debouncing search input** — with <30 items, filtering is instant
- **Using Zustand for the command list** — commands are static, not reactive

## Shortcut System Analysis

### Current Shortcut Map
| Shortcut | Action | Location | Condition |
|----------|--------|----------|-----------|
| `mod+o` | Open repository | useKeyboardShortcuts | Always |
| `mod+,` | Open settings | useKeyboardShortcuts | Always |
| `mod+shift+a` | Stage all | useKeyboardShortcuts | Repo open |
| `mod+shift+p` | Push (**CONFLICT**) | useKeyboardShortcuts | Repo open |
| `mod+shift+l` | Pull | useKeyboardShortcuts | Repo open |
| `mod+shift+f` | Fetch | useKeyboardShortcuts | Repo open |
| `mod+shift+m` | Toggle amend | useKeyboardShortcuts | Repo open |
| `escape` | Pop blade stack | useKeyboardShortcuts | Blade depth > 1 |
| `enter` | Open commit details | useKeyboardShortcuts | Topology selected |

### CRITICAL: Shortcut Conflict Resolution
**All 3 researchers agree:** `Cmd+Shift+P` must go to the command palette (industry standard). Push should be reassigned to `Cmd+Shift+U` ("Upload" mnemonic).

**Files requiring update:**
1. `src/hooks/useKeyboardShortcuts.ts` — change shortcut binding
2. `src/components/sync/SyncButtons.tsx` — update ShortcutTooltip display
3. JSDoc comment in useKeyboardShortcuts.ts

### Escape Key Conflict
The blade-pop handler uses `enableOnFormTags: false`, which naturally yields to the palette's focused input field. But for safety, the palette's Escape handler should `stopPropagation()`. Check `useCommandPaletteStore.getState().isOpen` in the blade handler as a guard.

## Action Handler Inventory (Commands to Register)

| ID | Title | Category | Current Shortcut | New Shortcut | Requires Repo |
|----|-------|----------|-----------------|--------------|---------------|
| `open-repository` | Open Repository | Repository | `mod+o` | `mod+o` | No |
| `close-repository` | Close Repository | Repository | — | — | Yes |
| `clone-repository` | Clone Repository | Repository | — | — | No |
| `open-settings` | Settings | Settings | `mod+,` | `mod+,` | No |
| `push` | Push | Sync | `mod+shift+p` | `mod+shift+u` | Yes |
| `pull` | Pull | Sync | `mod+shift+l` | `mod+shift+l` | Yes |
| `fetch` | Fetch | Sync | `mod+shift+f` | `mod+shift+f` | Yes |
| `stage-all` | Stage All | Sync | `mod+shift+a` | `mod+shift+a` | Yes |
| `toggle-amend` | Toggle Amend | Sync | `mod+shift+m` | `mod+shift+m` | Yes |
| `create-branch` | Create Branch | Branches | — | — | Yes |
| `generate-changelog` | Generate Changelog | Repository | — | — | Yes |
| `refresh-all` | Refresh All | Repository | — | — | Yes |
| `toggle-theme` | Toggle Theme | Settings | — | — | No |
| `command-palette` | Command Palette | Navigation | — | `mod+shift+p` | No |

## Fuzzy Search Strategy

**Consensus: Custom hand-rolled scorer (no external dependency)**

```typescript
// Tiered scoring: exact (100) > starts-with (80) > substring (60) > description (40) > fuzzy (20)
interface ScoredCommand {
  command: Command;
  score: number;
  matchedRanges: [number, number][];  // For highlight rendering
}
```

The algorithm matches against title first (higher weight) then description. Returns matched character ranges for highlighting in the UI. For ~13 commands this runs in microseconds — no debouncing needed.

## Palette UI Specifications

### Positioning & Sizing
- **Position:** `fixed top-[15%] left-1/2 -translate-x-1/2 z-50`
- **Width:** `w-[560px] max-w-[90vw]`
- NOT dialog-center (top-1/2) — palette anchors to top-center

### Styling (Catppuccin)
| Element | Classes |
|---------|---------|
| Container | `bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl overflow-hidden` |
| Input area | `bg-ctp-surface0 border-b border-ctp-surface0` |
| Normal item | `text-ctp-subtext1 hover:bg-ctp-surface1/50` |
| Selected item | `bg-ctp-blue/15 text-ctp-text` |
| Category label | `text-xs text-ctp-overlay0 uppercase tracking-wider` |
| Shortcut badge | `bg-ctp-surface0/80 text-ctp-subtext0 font-mono text-[10px]` |
| Match highlight | `text-ctp-blue font-medium` |

### Animation Timing (all 3 researchers agree)
| Property | Enter | Exit |
|----------|-------|------|
| Opacity | 0 → 1, 150ms ease-out | 1 → 0, 100ms ease-in |
| Scale | 0.98 → 1, 150ms ease-out | 1 → 0.98, 100ms ease-in |
| TranslateY | -8px → 0, 150ms ease-out | 0 → -8px, 100ms ease-in |

### Keyboard Navigation
| Key | Action |
|-----|--------|
| `Cmd+Shift+P` | Open/toggle palette |
| `Escape` | Close palette, restore previous focus |
| `Arrow Down` | Move to next item (wrap at end) |
| `Arrow Up` | Move to previous item (wrap at top) |
| `Enter` | Execute selected command, close |
| `Tab` | Prevent default (trap focus) |
| Any printable | Types into search input |

### Accessibility (WCAG 2.1 AA)
- Input: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-autocomplete="list"`
- Results list: `role="listbox"`, `aria-label="Commands"`
- Each result: `role="option"`, unique `id`, `aria-selected`
- Result count announced via `aria-live="polite"` status element
- Reduced motion: use `useReducedMotion()` — instant appear/disappear (opacity only)

## Refactoring Plan for Extensibility

### Current Problem: Scattered, Duplicated Action Handlers
- Push mutation exists in 3 files (useKeyboardShortcuts, SyncButtons, CommitForm)
- Actions scattered across Header, WelcomeView, SyncButtons, useKeyboardShortcuts
- Shortcuts hardcoded in a monolithic hook
- No central registry for discoverability

### Refactored Architecture
1. **Registry centralizes command definitions** — single source of truth for what commands exist, their shortcuts, icons, and actions
2. **Category files organize commands** — `src/commands/repository.ts`, `sync.ts`, etc. — each imports only the stores it needs
3. **useKeyboardShortcuts reads from registry** — iterates commands with shortcuts, binds them with useHotkeys
4. **Palette reads from registry** — filters enabled commands, displays with fuzzy search
5. **ShortcutTooltips read from registry** — consistent shortcut display everywhere

### Adding a Command in Future = One Function Call
```typescript
registerCommand({
  id: "my-new-command",
  title: "My New Command",
  category: "Repository",
  action: () => { /* do something */ },
  enabled: () => true,
});
```
The command automatically appears in the palette, gets a keyboard shortcut if specified, and respects enabled/disabled state. No changes to palette, shortcuts, or UI needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Platform shortcut display | Custom detection | `formatShortcut()` | Already handles Mac vs Windows |
| Tooltip behavior | Custom hover timer | `ShortcutTooltip` | Already has delay, positioning, animation |
| Overlay backdrop | Custom backdrop | dialog.tsx pattern | Already has blur, opacity, click-outside |
| Shortcut binding | Manual addEventListener | `useHotkeys` | Handles modifiers, scopes, form tags |
| Animation enter/exit | CSS transitions | framer-motion `AnimatePresence` | Handles unmount animation, reduced motion |

## Common Pitfalls

### 1. Escape Key Conflict
Palette Escape vs blade-pop Escape. **Solution:** Palette's input has focus, blade-pop uses `enableOnFormTags: false`, so it naturally yields. Add `stopPropagation()` for safety.

### 2. Cmd+Shift+P Conflict
Must reassign Push BEFORE registering palette shortcut. Update 2-3 files.

### 3. Focus Trap Escape
Tab must not escape palette. `preventDefault` on Tab/Shift+Tab.

### 4. Stale Command State
`enabled()` and `hidden()` must be functions that read store state at call time, never cached values. Evaluate at render time when building filtered list.

### 5. Command Actions Needing React Context
Push/Pull/Fetch use `useMutation`. **Solution:** Command actions use `document.dispatchEvent(new CustomEvent(...))` bridge (already used for "open-repository-dialog") or call store methods via `getState()`. Components owning mutations listen and trigger.

### 6. Shortcut Display Inconsistency
Palette and tooltips must both use `formatShortcut()` and `parseKeys()` from ShortcutTooltip for rendering `<kbd>` elements. Extract `parseKeys` as shared utility.

## Dependency Map

### Files to CREATE
| File | Purpose |
|------|---------|
| `src/lib/commandRegistry.ts` | Command type + registry functions |
| `src/lib/fuzzySearch.ts` | Fuzzy search + scoring utility |
| `src/commands/index.ts` | Barrel — imports all command registrations |
| `src/commands/repository.ts` | Open, Close, Clone, Changelog, Refresh |
| `src/commands/sync.ts` | Push, Pull, Fetch, Stage All, Toggle Amend |
| `src/commands/branches.ts` | Create Branch |
| `src/commands/navigation.ts` | Command Palette (self-referential) |
| `src/commands/settings.ts` | Settings, Theme Toggle |
| `src/stores/commandPalette.ts` | Palette UI state |
| `src/components/command-palette/CommandPalette.tsx` | Main overlay component |
| `src/components/command-palette/CommandPaletteItem.tsx` | Result row |
| `src/components/command-palette/index.ts` | Barrel export |

### Files to MODIFY
| File | Changes |
|------|---------|
| `src/App.tsx` | Import commands registration, render CommandPalette |
| `src/hooks/useKeyboardShortcuts.ts` | Reassign Push shortcut, add palette toggle, refactor to read from registry |
| `src/components/sync/SyncButtons.tsx` | Update Push shortcut display |
| `src/components/Header.tsx` | Add ShortcutTooltip to more toolbar buttons |

## Open Questions

1. **WelcomeView CustomEvent bridge** — Keep CustomEvents for now (works, low risk). Note as tech debt for future cleanup.
2. **Sync loading state from palette** — No progress spinner when Push/Pull/Fetch triggered from palette. Toast feedback sufficient for v1.
3. **Push shortcut `Cmd+Shift+U`** — Verify no OS-level conflicts on macOS/Windows.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of 20+ files
- W3C WAI-ARIA APG Combobox Pattern specification
- Context7 react-hotkeys-hook documentation
- Context7 fuse.js documentation (for comparison)

### Secondary (MEDIUM confidence)
- VS Code, Sublime Text, Raycast as reference implementations
- cmdk, microfuzz GitHub repositories
- Superhuman blog on command palette design

---
**Research date:** 2026-02-07
**Valid until:** 2026-03-09 (30 days — stable domain)
**Researchers:** UX & Interaction Design, Technical Architecture & Extensibility, Expert Developer (Tauri/React/Tailwind v4)
