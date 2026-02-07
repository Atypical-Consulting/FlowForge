# Phase 18: Command Palette & Discoverability - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a registry-based command palette overlay (Ctrl/Cmd+Shift+P) that lets users discover and invoke registered actions via fuzzy search. Add keyboard shortcut tooltips to toolbar buttons. The registry architecture enables future extensibility but only core commands ship in this phase.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All areas below were delegated to Claude. The user trusts the builder to make reasonable choices aligned with existing codebase patterns.

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
- Cmd/Shift+P opens palette (rebind current push shortcut to avoid conflict — push keeps Cmd+Shift+P with palette getting a different trigger, OR palette takes priority and push moves)
- Note: Current `Cmd+Shift+P` is Push. Palette should use `Cmd+Shift+P` (industry standard) and Push should move to `Cmd+P` or another binding — Claude decides based on conflict analysis
- Arrow keys navigate results, Enter executes selected, Escape closes
- Selected result highlighted with accent color
- After execution: palette closes immediately
- No recent commands history in v1 — keep it simple

#### Shortcut Tooltips
- Apply `ShortcutTooltip` (already exists) to all toolbar buttons that have associated shortcuts
- Use existing `formatShortcut()` for platform-aware display (Mac symbols vs Windows text)
- Standard tooltip delay (~300-500ms), no custom behavior needed — leverage what's already built
- Buttons without shortcuts just show the action name (no shortcut portion)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The user delegated all decisions to Claude.

Key codebase patterns to follow:
- Existing `ShortcutTooltip` component for tooltip behavior
- Existing `formatShortcut()` utility for cross-platform shortcut display
- Existing dialog/overlay animation patterns (framer-motion, AnimatePresence)
- `react-hotkeys-hook` for keyboard shortcut registration
- Catppuccin theme tokens (`--ctp-*`) for all colors

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-command-palette-discoverability*
*Context gathered: 2026-02-07*
