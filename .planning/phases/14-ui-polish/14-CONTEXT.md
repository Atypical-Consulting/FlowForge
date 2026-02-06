# Phase 14: UI Polish - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the application feel polished with helpful empty states, loading feedback, keyboard shortcut tooltips, and visual refinements (frosted glass headers, dirty state pulse). This phase enhances existing UI — no new features or capabilities.

</domain>

<decisions>
## Implementation Decisions

### Empty states design
- Line art illustrations style — custom line-art drawings (like GitHub's empty repo page or Linear's empty views)
- Friendly casual tone for guidance text — warm and encouraging (e.g., "Nothing stashed! Stash changes when you need a clean slate.")
- Panels that need empty states: changes, stashes, tags, and commit history (new repo)
- CTAs (action buttons) at Claude's discretion per panel — add where they make sense, skip where redundant

### Loading & spinners
- Spinners appear inside buttons, replacing button text/icon during operation
- Buttons become disabled + show spinner + change label text (e.g., "Push" → "Pushing...")
- All async operations get loading states — consistent behavior everywhere
- Panels use skeleton loaders (shimmer/placeholder shapes matching content layout) during initial data fetch

### Tooltip & shortcut hints
- Keyboard shortcuts displayed as styled key badges (rounded key cap styling, like VS Code tooltips)
- Tooltips only appear on buttons that have a keyboard shortcut — not all buttons
- Medium hover delay (500ms) before showing tooltips
- Auto-detect OS and show platform-correct shortcuts (⌘ on macOS, Ctrl on Windows/Linux)

### Visual effects & animation
- Frosted glass on panel headers: medium intensity (16-20px blur) — distinctly glassmorphic, like iOS control center
- Dirty state pulse: gentle glow pulse — soft color glow that fades in/out on the indicator dot
- Tasteful transitions throughout — smooth transitions on panel changes, dropdown open/close, toast enter/exit
- Respect OS prefers-reduced-motion setting — disable animations when enabled

### Claude's Discretion
- Which empty state panels get CTA buttons vs text-only
- Exact line art illustration designs
- Specific skeleton loader shapes per panel
- Animation timing curves and durations
- Exact frosted glass color/opacity values

</decisions>

<specifics>
## Specific Ideas

- Empty states should feel like Linear's empty views — clean line art, not clipart
- Button loading pattern inspired by GitHub's merge button behavior
- Tooltip key badges styled like VS Code's shortcut hints
- Frosted glass headers should feel like iOS control center (medium blur, distinctly glass)
- Overall motion should feel alive but not busy — tasteful, not decorative

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-ui-polish*
*Context gathered: 2026-02-06*
