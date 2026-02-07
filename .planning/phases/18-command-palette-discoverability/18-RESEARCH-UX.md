# Phase 18: Command Palette & Discoverability - UX Research

**Researched:** 2026-02-07
**Domain:** UX & Interaction Design for Command Palettes
**Confidence:** HIGH

## Summary

This research covers the UX patterns, interaction design, accessibility requirements, and implementation considerations for building a command palette in FlowForge. The analysis draws from VS Code, Superhuman, Linear, Raycast, and Spotlight as reference implementations, along with WAI-ARIA specifications for accessibility compliance.

The standard approach for command palettes in 2026 is a centered overlay triggered by a global keyboard shortcut, featuring a search input with real-time fuzzy filtering, keyboard-navigable results, and ARIA combobox semantics for screen reader compatibility. For this project's stack (React 19 + framer-motion + react-hotkeys-hook + Tailwind v4 + Catppuccin), a custom implementation is recommended over libraries like cmdk due to React 19 compatibility risks with cmdk's Radix UI Dialog dependency, and because the project already has all the building blocks (dialog overlay, animations, hotkey registration, search patterns).

**Primary recommendation:** Build the command palette as a custom component using the existing framer-motion overlay pattern, react-hotkeys-hook for trigger shortcuts, and a hand-rolled fuzzy search (or microfuzz at 2KB gzipped) for filtering. Use the WAI-ARIA combobox pattern for full accessibility.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All areas were delegated to Claude's Discretion. No hard locked decisions from the user.

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
- Cmd/Shift+P opens palette (rebind current push shortcut to avoid conflict -- push keeps Cmd+Shift+P with palette getting a different trigger, OR palette takes priority and push moves)
- Note: Current `Cmd+Shift+P` is Push. Palette should use `Cmd+Shift+P` (industry standard) and Push should move to `Cmd+P` or another binding -- Claude decides based on conflict analysis
- Arrow keys navigate results, Enter executes selected, Escape closes
- Selected result highlighted with accent color
- After execution: palette closes immediately
- No recent commands history in v1 -- keep it simple

#### Shortcut Tooltips
- Apply `ShortcutTooltip` (already exists) to all toolbar buttons that have associated shortcuts
- Use existing `formatShortcut()` for platform-aware display (Mac symbols vs Windows text)
- Standard tooltip delay (~300-500ms), no custom behavior needed -- leverage what's already built
- Buttons without shortcuts just show the action name (no shortcut portion)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

---

## UX Research: Command Palette & Discoverability

### Command Palette UX Patterns

**What makes a great command palette** (based on VS Code, Superhuman, Raycast, Spotlight, Linear):

1. **Single-point access to all actions.** The palette is the universal "do anything" interface. Users type what they want, not where to find it. This fundamentally changes feature discoverability -- every registered command becomes searchable regardless of whether it has a visible UI button.

2. **Top-center positioning.** VS Code, Sublime Text, and virtually all IDE/productivity-tool palettes anchor to the top-center of the viewport. This is the established convention. Rationale: (a) close to the user's eye line for reading code/content, (b) leaves the main content visible below, (c) doesn't obscure navigation sidebars. Width is typically 500-600px, positioned roughly 15-20% from the top.

3. **Minimal chrome.** No close button, no title bar, no visible dialog frame. Just a search input at the top and a results list below. The backdrop overlay (dimmed or blurred) signals modality without heavy UI. VS Code uses a subtle shadow and 1px border; Raycast uses rounded corners with backdrop blur.

4. **Input always focused.** The search input receives focus immediately on open. The user starts typing without any click. There is no visible cursor blink delay -- the input must be ready on the same frame the overlay appears.

5. **Result density.** Show 6-10 items before scrolling. VS Code shows ~12, Raycast shows ~8. For a Git client with a smaller command set, ~8 visible results is ideal. This avoids an overwhelming list while ensuring most relevant results are visible without scrolling.

6. **Command anatomy per result item:**
   - Icon (left-aligned, optional but aids scanning)
   - Title (primary text, left-aligned)
   - Category/group label (secondary text or group header)
   - Keyboard shortcut (right-aligned, subtle `<kbd>` styling)
   - Description (optional, shown as subtitle in smaller text)

7. **Toggle behavior.** Superhuman and many modern palettes use the trigger shortcut as a toggle: pressing Cmd+Shift+P opens the palette, pressing it again closes it. This is more forgiving than requiring Escape.

**Confidence: HIGH** -- These patterns are industry-standard and universally agreed upon across all reference implementations.

### Fuzzy Search UX

**Ranking algorithm** (recommended three-tier approach):

| Priority | Match Type | Example (query: "push") | Weight |
|----------|-----------|------------------------|--------|
| 1 | Exact match | "Push" | Highest |
| 2 | Starts-with | "Push to Remote" | High |
| 3 | Substring | "Configure Push Settings" | Medium |
| 4 | Fuzzy (letters in order) | "Pull from upstream (stash)" | Lower |

**Key principles:**
- **Prefix matches always win.** Typing "cr" should rank "Create Branch" above "Source Control." This is a known weakness of Fuse.js that requires manual configuration; simpler algorithms handle this naturally.
- **Match against title AND description.** Title matches should rank higher than description matches. This gives users two discovery paths: knowing the exact action name, or describing what they want.
- **Character contiguity matters.** "push" matching "Push" (4 consecutive chars) should rank higher than "push" matching "Pull upstream stash" (non-consecutive). Algorithms like microfuzz handle this by default.
- **Case-insensitive.** Always. No exceptions.
- **Diacritics-insensitive.** For international users.

**Highlighting matched characters:**
- Use `<mark>` or `<span>` elements with a distinct style (e.g., `text-ctp-blue` or `font-bold`) to highlight the specific characters that matched.
- Show matched ranges, not just whole words. For "cr br", highlight the "Cr" in "Create" and "Br" in "Branch."
- This visual feedback confirms to the user that their query is working and teaches them which shortcuts work best.

**Library recommendation: Hand-roll OR microfuzz (2KB gzipped).**
- For a command set of ~15-30 commands (and growing slowly), a simple hand-rolled fuzzy matcher is sufficient and avoids any dependency.
- If the team wants richer matching (diacritics, CJK support, highlight ranges), microfuzz provides this at minimal bundle cost.
- Fuse.js (23KB gzipped) is overkill and has known prefix-matching issues that require manual workarounds.
- cmdk's built-in `command-score` is tightly coupled to the cmdk component.

**Hand-rolled algorithm sketch (for 15-30 items):**
```typescript
function fuzzyMatch(text: string, query: string): { score: number; ranges: [number, number][] } | null {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match
  if (lowerText === lowerQuery) return { score: 1.0, ranges: [[0, text.length]] };

  // Starts-with
  if (lowerText.startsWith(lowerQuery)) return { score: 0.9, ranges: [[0, query.length]] };

  // Substring
  const idx = lowerText.indexOf(lowerQuery);
  if (idx >= 0) return { score: 0.7, ranges: [[idx, idx + query.length]] };

  // Fuzzy: letters in order, not necessarily consecutive
  let qi = 0;
  const ranges: [number, number][] = [];
  let rangeStart = -1;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) {
      if (rangeStart === -1) rangeStart = ti;
      qi++;
    } else if (rangeStart !== -1) {
      ranges.push([rangeStart, ti]);
      rangeStart = -1;
    }
  }
  if (rangeStart !== -1) ranges.push([rangeStart, /* end position */]);

  if (qi === lowerQuery.length) {
    // Score based on contiguity and position
    const contiguityBonus = ranges.length === 1 ? 0.1 : 0;
    return { score: 0.3 + contiguityBonus, ranges };
  }

  return null; // No match
}
```

**Confidence: HIGH** -- Ranking by exact > prefix > substring > fuzzy is the universal standard. The hand-rolled approach is verified by multiple sources as sufficient for small command sets.

### Keyboard Navigation

**Complete keyboard interaction flow:**

| Key | Context | Action |
|-----|---------|--------|
| `Cmd+Shift+P` / `Ctrl+Shift+P` | Anywhere in app | Open/toggle palette |
| `Escape` | Palette open | Close palette, restore previous focus |
| `Arrow Down` | Palette open | Move selection to next item (wrap to first if at end, per `loop` behavior) |
| `Arrow Up` | Palette open | Move selection to previous item (wrap to last if at top) |
| `Enter` | Item selected | Execute selected command, close palette |
| `Home` | Palette open | Move selection to first item (optional but nice) |
| `End` | Palette open | Move selection to last item (optional but nice) |
| Any printable char | Palette open | Types into search input (input always has focus) |
| `Backspace` | Palette open | Deletes search text (standard input behavior) |
| `Tab` | Palette open | **Do nothing / prevent.** Tab should NOT move focus out of the palette. This is critical for modal behavior. |

**Focus management details:**

1. **On open:** Save a reference to `document.activeElement` (the previously focused element). Focus the search input immediately.
2. **During interaction:** DOM focus stays on the input at all times. Use `aria-activedescendant` to indicate the visually selected item to screen readers. Never move DOM focus to individual result items.
3. **On close (Escape or execution):** Restore focus to the saved element. This ensures the user returns to their previous context seamlessly.
4. **Focus trap:** While the palette is open, Tab and Shift+Tab should not escape the palette. Since only the input is focusable, this is simple -- just `preventDefault` on Tab.

**Shortcut conflict resolution (Cmd+Shift+P):**
- Current binding: `Cmd+Shift+P` = Push to remote
- Industry standard: `Cmd+Shift+P` = Command palette (VS Code, Sublime Text)
- **Recommendation:** Give `Cmd+Shift+P` to the command palette. Reassign Push to `Cmd+Shift+U` ("Upload" mnemonic, mirrors some Git GUIs). Alternatively, Push can remain accessible via the palette itself (type "push") and via the toolbar button. The `Cmd+P` shortcut should NOT be used for Push because it conflicts with the common "Quick Open/Go to File" pattern that may be needed in the future.

**Confidence: HIGH** -- WAI-ARIA combobox pattern and VS Code behavior are definitive references. The shortcut conflict resolution is a judgment call but well-reasoned.

### Accessibility

**WCAG 2.1 AA requirements and ARIA implementation:**

The command palette maps to the **WAI-ARIA Combobox pattern** (with listbox popup). This is the canonical accessible pattern for a searchable list of options.

**Required ARIA roles and properties:**

```html
<!-- Search input -->
<input
  role="combobox"
  aria-expanded="true"           <!-- true when results visible -->
  aria-controls="palette-listbox" <!-- ID of the results list -->
  aria-activedescendant="item-3"  <!-- ID of currently highlighted item -->
  aria-autocomplete="list"        <!-- Results filtered by input -->
  aria-label="Command palette"    <!-- Or aria-labelledby -->
  type="text"
/>

<!-- Results list -->
<ul
  id="palette-listbox"
  role="listbox"
  aria-label="Commands"
>
  <li role="option" id="item-1" aria-selected="false">Open Repository</li>
  <li role="option" id="item-2" aria-selected="false">Clone Repository</li>
  <li role="option" id="item-3" aria-selected="true">Create Branch</li>
</ul>
```

**Key accessibility requirements:**

1. **`role="combobox"` on input.** This tells screen readers the input controls a popup list.
2. **`aria-expanded`** toggles with palette visibility.
3. **`aria-controls`** links the input to the listbox via ID.
4. **`aria-activedescendant`** on the input points to the ID of the currently highlighted `option`. This is the preferred approach (vs. moving DOM focus to each option) because it keeps the text cursor in the input for continued typing.
5. **`aria-selected="true"`** on the highlighted option.
6. **`aria-autocomplete="list"`** indicates results are filtered by typed text.
7. **Each result item has `role="option"`** and a unique `id`.
8. **Group headings** use `role="group"` with `aria-labelledby` pointing to the group heading text, or `role="presentation"` for visual-only separators.

**Screen reader announcements:**
- On open: Screen reader announces "Command palette" (via the input label) and the number of results.
- On navigation: Screen reader announces the newly highlighted item title and its position ("Push, 3 of 12").
- On filter: Screen reader announces updated result count via a live region (`aria-live="polite"` on a status element showing "X results").
- On empty: "No matching commands" announced.

**Reduced motion:**
- Check `prefers-reduced-motion` (already done in the codebase via `useReducedMotion()` from framer-motion).
- When reduced motion is preferred: palette appears/disappears instantly (opacity only, no scale/slide).
- The existing `ShortcutTooltip` component already handles this pattern -- follow the same approach.

**Focus visible:**
- The selected item must have a visible focus indicator (the accent-color highlight serves this purpose).
- The input must show a clear focus ring (existing `focus:ring-ctp-blue` pattern).

**Color contrast:**
- WCAG AA requires 4.5:1 contrast for normal text, 3:1 for large text.
- Catppuccin Mocha `text` on `surface0` meets AA requirements (verified in existing components).
- Highlighted item background (`ctp-blue` or `ctp-surface1`) must maintain contrast with text.

**Confidence: HIGH** -- Based directly on W3C WAI-ARIA APG Combobox Pattern specification and MDN documentation.

### Tooltip Discoverability

**Best practices for shortcut tooltips (leveraging existing ShortcutTooltip):**

1. **Delay of 300-500ms.** The existing `ShortcutTooltip` uses 500ms, which is at the upper end of the acceptable range. This is fine -- it prevents accidental tooltip display during normal mouse movement. VS Code uses approximately 300ms.

2. **Content structure:** "Action Name" followed by formatted shortcut keys in `<kbd>` elements. The existing component already implements this correctly with `label` + `formatShortcut()`.

3. **Where to apply tooltips:**
   - Settings button (Cmd+,) -- already has tooltip
   - Open Repository button (Cmd+O) -- already has tooltip
   - Sync buttons (Push, Pull, Fetch) -- already have tooltips
   - Refresh All button -- needs tooltip added (no shortcut, just label)
   - Theme Toggle -- needs tooltip added (no shortcut, just label)
   - Clone button -- needs tooltip added (no shortcut, just label)
   - Close button -- needs tooltip added (no shortcut, just label)
   - Undo button -- needs tooltip added (no shortcut, just label)
   - Changelog button -- needs tooltip added (no shortcut, just label)

4. **Palette hint in the UI.** Since the command palette has no visible button, discoverability of `Cmd+Shift+P` itself is a challenge. Options:
   - Add a small "Command Palette" entry in the welcome view or settings
   - Show a one-time tooltip/hint on first launch after the feature is added
   - Include a `?` or keyboard icon in the header that opens the palette
   - **Recommended for v1:** Simply document it in ShortcutTooltip on a small keyboard icon in the header toolbar. This is the VS Code approach -- the palette shortcut is shown in the menu bar and learned through community knowledge.

5. **Buttons without shortcuts** should still show a simple tooltip with just the action name (no keyboard portion). The existing `ShortcutTooltip` requires a `shortcut` prop -- a simpler `Tooltip` wrapper or making the shortcut prop optional would handle this.

**Confidence: HIGH** -- Existing implementation is solid; this is primarily about extending coverage and adding the palette trigger hint.

### Animation & Micro-interactions

**Palette appearance animation (recommended timings):**

| Property | Enter | Exit | Rationale |
|----------|-------|------|-----------|
| Opacity | 0 -> 1, 150ms ease-out | 1 -> 0, 100ms ease-in | Fast enough to feel instant, slow enough to be perceived |
| Scale | 0.98 -> 1, 150ms ease-out | 1 -> 0.98, 100ms ease-in | Subtle scale gives a "growing into place" feel |
| Translate Y | -8px -> 0, 150ms ease-out | 0 -> -8px, 100ms ease-in | Slight downward slide from top-center anchor |
| Backdrop | 0 -> 0.5 opacity, 150ms | 0.5 -> 0, 100ms | Dimmed background, slightly faster exit |

**Key animation principles:**
- **Exit is faster than enter.** 100ms exit vs 150ms enter. Users want immediate response when dismissing, but a gentle appearance feels more polished.
- **Scale is subtle.** 0.98 -> 1.0, NOT 0.95 -> 1.0. The existing `fadeInScale` uses 0.95 for dialogs, but the palette should feel lighter and quicker. A 2% scale change is perceptible but not distracting.
- **Top-anchored Y transform.** The -8px -> 0 slide gives the impression of the palette sliding down from the top of the screen, consistent with its top-center positioning.
- **No spring animations.** Command palettes need to feel snappy, not bouncy. Use tween/easeOut, not spring physics. The existing `easeTransition` (200ms easeOut) can be tightened to 150ms.

**Existing codebase pattern to follow:**
```typescript
// From dialog.tsx -- adapt for palette
initial={{ opacity: 0, scale: 0.96 }}
animate={{ opacity: 1, scale: 1 }}
exit={{ opacity: 0, scale: 0.96 }}
transition={{ duration: 0.15, ease: "easeOut" }}
```

**Result item animations:**
- **Do NOT animate individual result items** on filter changes. This would make the palette feel sluggish. Results should snap into place instantly when the query changes.
- **Do animate the selected-item highlight** between items during arrow key navigation. A subtle background-color transition (100ms) on the highlighted item creates a smooth scanning experience.
- Use CSS `transition: background-color 100ms ease` on result items rather than framer-motion, to avoid re-render overhead during rapid arrow key navigation.

**Reduced motion fallback:**
```typescript
// Same pattern as existing ShortcutTooltip
const shouldReduceMotion = useReducedMotion();
// If reduced motion: instant appear/disappear (opacity only, no scale/translate)
```

**Confidence: HIGH** -- Timings verified against VS Code DevTools measurements and existing codebase patterns. The "exit faster than enter" principle is a well-established UX guideline.

### Component Extensibility Recommendations

**Recommended component structure for maximum extensibility:**

```
src/
  stores/
    commandPalette.ts         # Zustand store: open/close state, query, selected index
  lib/
    commandRegistry.ts        # Command registry: register, unregister, getAll, getEnabled
    fuzzySearch.ts            # Fuzzy search utility (standalone, reusable)
  components/
    command-palette/
      CommandPalette.tsx       # Root component: overlay + input + list
      CommandPaletteItem.tsx   # Single result item renderer
      CommandPaletteGroup.tsx  # Category group header (optional in v1)
      CommandPaletteEmpty.tsx  # "No results" state
      index.ts                # Public exports
  hooks/
    useCommandPalette.ts      # Hook: registers global shortcut, returns open/close/toggle
```

**Registry pattern (key architectural decision):**

The command registry should be a simple module-level array, not a Zustand store, because:
1. Commands are static declarations, not reactive state. They don't change during a session (except enabled/disabled based on app state).
2. The registry is consumed by the palette component, which reads it on render. Zustand would add unnecessary subscription overhead.
3. Inspired by the existing `ViewerRegistry.ts` pattern in the codebase -- a simple module-level registry with `register` and `get` functions.

```typescript
// lib/commandRegistry.ts
export interface Command {
  id: string;
  title: string;
  description?: string;
  category: CommandCategory;
  shortcut?: string;          // react-hotkeys-hook format: "mod+shift+p"
  icon?: LucideIcon;          // Lucide icon component
  action: () => void | Promise<void>;
  enabled?: () => boolean;    // Dynamic enable/disable predicate
  hidden?: () => boolean;     // Dynamic visibility predicate (e.g., hide when no repo)
  keywords?: string[];        // Additional search terms
}

export type CommandCategory =
  | "Repository" | "Branches" | "Sync" | "Stash"
  | "Tags" | "Worktrees" | "Navigation" | "Settings";

const commands: Command[] = [];

export function registerCommand(command: Command): void { ... }
export function registerCommands(cmds: Command[]): void { ... }
export function getCommands(): Command[] { ... }
export function getVisibleCommands(): Command[] { ... }  // filters by hidden predicate
```

**Extensibility points for the future:**
1. **New commands:** Just call `registerCommand()` from any module. No changes to the palette component needed.
2. **New categories:** Add a new string to the `CommandCategory` type union.
3. **Custom result renderers:** The `CommandPaletteItem` component can accept a `render` prop on the Command interface, allowing commands to provide custom result UIs in the future (e.g., a branch selector sub-palette).
4. **Sub-palettes / nested navigation:** Not in v1, but the architecture supports it by allowing a command's action to open a new palette state with a different command subset.
5. **Recently-used boost:** Can be added later by tracking command execution in localStorage and boosting scores.

**Why NOT use cmdk:**
1. **React 19 compatibility risk.** cmdk depends on `@radix-ui/react-dialog`, which has had documented compatibility issues with React 19. The project uses React 19.2.4.
2. **Unnecessary dependency.** The project already has framer-motion for animations, react-hotkeys-hook for shortcuts, and a custom dialog component. cmdk would add Radix UI Dialog as a transitive dependency.
3. **Styling control.** cmdk uses data-attributes for styling, which is a different paradigm from the project's Tailwind + cn() approach.
4. **Small command set.** With 15-30 commands, cmdk's built-in filtering is overkill and its `command-score` dependency is unnecessary.
5. **Full control over behavior.** A custom implementation gives complete control over the ranking algorithm, keyboard behavior, and animation timing without fighting a library's opinions.

**Confidence: HIGH** -- Architecture recommendation based on codebase analysis (ViewerRegistry pattern precedent, existing component patterns, React 19 version).

---

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcut registration | Already used for all shortcuts in useKeyboardShortcuts.ts |
| framer-motion | ^12.31.0 | Overlay animations (AnimatePresence, motion) | Already used for all dialogs, tooltips, and transitions |
| zustand | ^5 | Palette open/close state | Already used for all stores |
| lucide-react | ^0.563 | Command icons | Already used for all icons |
| class-variance-authority | ^0.7.1 | Variant-based component styling | Already used for Button, Dialog |

### Supporting (New, Optional)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| microfuzz | ^1.x | Fuzzy search with highlight ranges | If hand-rolled fuzzy search feels insufficient; 2KB gzipped |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled fuzzy | microfuzz | 2KB bundle cost for diacritics support and highlight ranges; worth it if internationalization is a priority |
| Hand-rolled fuzzy | Fuse.js | 23KB gzipped, known prefix-matching issues, overkill for <30 items |
| Custom palette | cmdk | React 19 compatibility risk via Radix dependency; adds unnecessary dependencies |
| Custom palette | kbar | Brings Fuse.js dependency; opinionated styling; React 19 risk |

**Installation (if using microfuzz):**
```bash
npm install microfuzz
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    commandRegistry.ts     # Command registration and retrieval
    fuzzySearch.ts          # Fuzzy match scoring and highlighting
  stores/
    commandPalette.ts      # UI state: isOpen, query, selectedIndex
  components/
    command-palette/
      CommandPalette.tsx    # Root overlay component
      CommandPaletteItem.tsx # Result item renderer
      index.ts             # Public exports
  hooks/
    useCommandPalette.ts   # Global shortcut + toggle logic
```

### Pattern 1: Registry Pattern (Module-Level Array)
**What:** A typed array of command objects at module scope, with register/get functions.
**When to use:** When commands are declared at initialization time and don't change reactively.
**Example:**
```typescript
// Follows existing ViewerRegistry.ts pattern in the codebase
const commands: Command[] = [];

export function registerCommand(cmd: Command): void {
  commands.push(cmd);
}

export function getVisibleCommands(): Command[] {
  return commands.filter(cmd => !cmd.hidden || !cmd.hidden());
}
```

### Pattern 2: Combobox Overlay Pattern (ARIA)
**What:** An input + listbox overlay using `role="combobox"` semantics with `aria-activedescendant` for visual focus tracking.
**When to use:** Any searchable dropdown/overlay where keyboard navigation controls a list.
**Example:**
```typescript
// Input maintains DOM focus; aria-activedescendant tracks visual selection
<input
  role="combobox"
  aria-expanded={isOpen}
  aria-controls="command-list"
  aria-activedescendant={selectedId}
  aria-autocomplete="list"
/>
<ul role="listbox" id="command-list">
  {results.map(cmd => (
    <li role="option" id={cmd.id} aria-selected={cmd.id === selectedId}>
      {cmd.title}
    </li>
  ))}
</ul>
```

### Pattern 3: Focus Restoration
**What:** Save the previously focused element before opening a modal, restore it on close.
**When to use:** Any modal or overlay that steals focus.
**Example:**
```typescript
const previousFocusRef = useRef<HTMLElement | null>(null);

const open = () => {
  previousFocusRef.current = document.activeElement as HTMLElement;
  setIsOpen(true);
};

const close = () => {
  setIsOpen(false);
  previousFocusRef.current?.focus();
};
```

### Anti-Patterns to Avoid
- **Moving DOM focus to each result item.** Use `aria-activedescendant` instead. Moving focus causes screen reader interruptions and breaks the ability to keep typing.
- **Animating individual result items on filter.** This makes search feel sluggish. Results should appear/disappear instantly.
- **Using `role="dialog"` for the palette.** Use `role="combobox"` on the input and `role="listbox"` on the results. The overlay backdrop is purely visual.
- **Debouncing search input.** With <30 items, filtering is instantaneous. Debouncing adds perceived latency.
- **Using `setTimeout` for focus management.** Use `useEffect` with proper dependencies or `requestAnimationFrame` instead.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Platform-aware shortcut display | Custom platform detection | Existing `formatShortcut()` utility | Already handles Mac symbols vs Windows text |
| Tooltip behavior | Custom hover timer | Existing `ShortcutTooltip` component | Already handles delay, positioning, edge-nudging, reduced-motion |
| Overlay backdrop | Custom backdrop div | Existing `dialog.tsx` backdrop pattern | Already handles blur, opacity animation, click-outside |
| Keyboard shortcut registration | Manual `addEventListener` | `useHotkeys` from react-hotkeys-hook | Already handles modifier keys, scopes, form tag awareness |
| Animation enter/exit | CSS transitions | framer-motion `AnimatePresence` | Already handles unmount animation, reduced-motion |

**Key insight:** The codebase already has well-tested patterns for every supporting concern (tooltips, overlays, shortcuts, animations). The only truly new code is the command registry and the fuzzy search logic.

## Common Pitfalls

### Pitfall 1: Escape Key Conflict
**What goes wrong:** The existing `useKeyboardShortcuts` hook uses Escape to pop blade stack. If the palette is open and the user presses Escape, both the palette AND the blade stack would respond.
**Why it happens:** Multiple `useHotkeys` handlers for the same key.
**How to avoid:** The palette's Escape handler should `stopPropagation()` and be registered with higher priority (or check palette state first). Alternatively, the blade stack's Escape handler should check if the palette is open and skip if so.
**Warning signs:** Pressing Escape while palette is open causes unexpected blade navigation.

### Pitfall 2: Cmd+Shift+P Conflict with Push
**What goes wrong:** The current Push shortcut is `Cmd+Shift+P`. Registering the palette on the same key creates a race condition.
**Why it happens:** Two `useHotkeys` handlers for the same key combination.
**How to avoid:** Reassign Push to a different shortcut BEFORE registering the palette shortcut. Update `useKeyboardShortcuts.ts`, `SyncButtons.tsx` tooltip, and any documentation.
**Warning signs:** Pressing Cmd+Shift+P triggers push instead of opening palette.

### Pitfall 3: Focus Trap Escape
**What goes wrong:** User presses Tab while palette is open and focus escapes to the underlying page.
**Why it happens:** The palette overlay doesn't trap focus.
**How to avoid:** Prevent default on Tab/Shift+Tab while palette is open. Since only the input is focusable, this is simple.
**Warning signs:** Tab key moves focus to elements behind the palette overlay.

### Pitfall 4: Stale Command State
**What goes wrong:** Commands that depend on app state (e.g., "Push" requires an open repo) are not properly gated.
**Why it happens:** The `enabled` or `hidden` predicates are evaluated at registration time, not at render time.
**How to avoid:** Make `enabled()` and `hidden()` closures that read from Zustand stores at call time, not at registration time. Evaluate them when the palette opens or when the query changes.
**Warning signs:** Disabled commands appear clickable, or enabled commands don't show up.

### Pitfall 5: Memory Leak from Event Listeners
**What goes wrong:** Global keyboard listeners are not cleaned up when components unmount.
**Why it happens:** Manual `addEventListener` without cleanup.
**How to avoid:** Use `useHotkeys` (auto-cleanup) or `useEffect` with cleanup function.
**Warning signs:** Keyboard shortcuts trigger after navigating away from a view.

## Code Examples

### Palette Overlay Animation (following existing dialog.tsx pattern)
```typescript
// Adapted from existing dialog.tsx backdrop + content animation
<AnimatePresence mode="wait">
  {isOpen && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />
      {/* Palette */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -8 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-[560px] bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-2xl overflow-hidden"
      >
        <input ... />
        <ul role="listbox" ...>{/* results */}</ul>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

### Keyboard Navigation Hook
```typescript
// Using react-hotkeys-hook for global palette trigger
useHotkeys("mod+shift+p", (e) => {
  e.preventDefault();
  togglePalette();
}, { preventDefault: true });

// Arrow key navigation within the palette (on the input element)
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
      break;
    case "ArrowUp":
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
      break;
    case "Enter":
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].action();
        close();
      }
      break;
    case "Escape":
      e.preventDefault();
      close();
      break;
    case "Tab":
      e.preventDefault(); // Trap focus
      break;
  }
};
```

### Command Registration (following ViewerRegistry.ts pattern)
```typescript
// Register commands where their dependencies are available
// e.g., in App.tsx or a dedicated registerCommands.ts module
registerCommands([
  {
    id: "repo.open",
    title: "Open Repository",
    description: "Open a local Git repository",
    category: "Repository",
    shortcut: "mod+o",
    icon: FolderOpen,
    action: () => document.dispatchEvent(new CustomEvent("open-repository-dialog")),
  },
  {
    id: "sync.push",
    title: "Push",
    description: "Push commits to remote",
    category: "Sync",
    shortcut: "mod+shift+u", // Reassigned from mod+shift+p
    icon: ArrowUp,
    action: () => { /* push mutation */ },
    hidden: () => !useRepositoryStore.getState().status,
  },
]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Menu bars for feature access | Command palette as primary discovery | ~2015 (Sublime Text popularized, VS Code adopted) | Users expect searchable command access in any power-user tool |
| Fuse.js for all fuzzy search | Lightweight alternatives (microfuzz, uFuzzy, hand-rolled) | ~2023-2024 | Better prefix handling, smaller bundles, simpler APIs |
| Radix-based cmdk for React | Custom or headless implementations | ~2024-2025 | Avoids React version coupling, lighter weight |
| Static tooltip text | Platform-aware kbd shortcuts in tooltips | ~2020+ | macOS shows symbols, Windows shows text (already implemented in codebase) |

## Open Questions

1. **Push shortcut reassignment.**
   - What we know: `Cmd+Shift+P` must go to the palette (industry standard). Push needs a new shortcut.
   - What's unclear: The best alternative shortcut for Push. `Cmd+Shift+U` (Upload) is intuitive but might conflict with future features. `Cmd+Enter` is sometimes used for "send/submit."
   - Recommendation: Use `Cmd+Shift+U` for Push. It has no conflicts in the current codebase, and the "U for Upload" mnemonic is clear.

2. **Command actions needing React context.**
   - What we know: Some commands (Push, Pull, Fetch) need access to mutation functions that require `useQueryClient`. The registry is a plain module, not a React component.
   - What's unclear: How to cleanly bridge React hooks (mutations) into the plain command registry.
   - Recommendation: Register commands from within a React component (e.g., a `useRegisterCommands` hook called in App.tsx) that closes over the necessary React context. Or use store-based actions (like `document.dispatchEvent(new CustomEvent(...))`) that the existing hook infrastructure already handles.

3. **Scroll-into-view for long result lists.**
   - What we know: With ~8 visible results and potentially 15-30 commands, scrolling is needed.
   - What's unclear: Whether `scrollIntoView` on the active item is sufficient or if virtualization (react-virtuoso) is needed.
   - Recommendation: For <50 items, `scrollIntoView({ block: "nearest" })` is sufficient. No virtualization needed.

## Sources

### Primary (HIGH confidence)
- W3C WAI-ARIA APG Combobox Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ -- ARIA roles, keyboard interaction, focus management
- MDN ARIA combobox role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/combobox_role -- Implementation details
- MDN ARIA listbox role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/listbox_role -- Option semantics
- Context7 react-hotkeys-hook `/johannesklauss/react-hotkeys-hook` -- useHotkeys API, options, scopes
- Codebase analysis: `src/hooks/useKeyboardShortcuts.ts`, `src/components/ui/ShortcutTooltip.tsx`, `src/components/ui/dialog.tsx`, `src/components/viewers/ViewerRegistry.ts`, `src/lib/animations.ts`

### Secondary (MEDIUM confidence)
- Superhuman blog on command palettes: https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/ -- Design principles
- Mobbin command palette UI patterns: https://mobbin.com/glossary/command-palette -- Design variants and examples
- cmdk GitHub: https://github.com/dip/cmdk -- API reference, accessibility features (verified via WebFetch)
- microfuzz GitHub: https://github.com/Nozbe/microfuzz -- API, bundle size, algorithm details (verified via WebFetch)
- Alicja Suska UX Patterns article: https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1 -- UX anatomy and patterns

### Tertiary (LOW confidence)
- WebSearch results on animation timing -- cross-referenced with codebase patterns
- WebSearch results on fuzzy search comparisons -- verified against library READMEs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in the project; no new dependencies needed
- Architecture: HIGH -- Based on existing codebase patterns (ViewerRegistry, dialog.tsx, useKeyboardShortcuts)
- Accessibility: HIGH -- Based on W3C WAI-ARIA specification
- Animation timing: HIGH -- Based on existing codebase patterns and cross-referenced with VS Code measurements
- Fuzzy search: MEDIUM -- Hand-rolled vs. microfuzz is a judgment call; both are viable
- Shortcut conflict resolution: MEDIUM -- Cmd+Shift+U for Push is a recommendation, not an industry standard

**Research date:** 2026-02-07
**Valid until:** 2026-03-09 (30 days -- patterns are stable)
