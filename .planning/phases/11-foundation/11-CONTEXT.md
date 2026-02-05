# Phase 11: Foundation - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver toast notifications for Git operation feedback, a settings window for user preferences, and fix layout issues (left panel icon overlap, Conventional Commits panel positioning). This phase establishes the UI foundation that subsequent phases build upon.

</domain>

<decisions>
## Implementation Decisions

### Layout Fixes
- Compact spacing in left panel (minimal padding, maximize visible items, VS Code sidebar style)
- Commit panel moved to bottom of left panel (GitHub Desktop style)
- Conventional Commits type/scope selection opens as modal on click
- Equal shrink behavior when window resized (both panels shrink proportionally)
- Enforce minimum panel widths to prevent unusable states

### Toast Design
- Position: bottom-right corner, stacks upward
- Stacking: show up to 3 toasts visible, older ones fade out
- Visual style: minimal card with colored status icon (checkmark, X, etc.) and text
- Success toasts show progress bar countdown before auto-dismiss
- Auto-dismiss timeout: 5 seconds for success toasts
- Error toasts persist until user dismisses

### Toast Content
- One-liner format with key info (e.g., "Committed: fix login bug")
- Error toasts include "Retry" button when applicable (network errors, push failures)
- Commit success toast includes "Push now" action button

### Settings Organization
- Access via: menu bar item + keyboard shortcut (Ctrl+,) + header gear icon
- Layout: sidebar categories on left, content on right (VS Code style)
- Categories: General, Git, Appearance
- Changes apply immediately (no Save/Cancel buttons)

### Claude's Discretion
- Exact minimum panel widths
- Toast animation timing and easing
- Settings window dimensions
- Icon choices for toast status types
- Specific settings to expose in each category

</decisions>

<specifics>
## Specific Ideas

- Commit panel positioning inspired by GitHub Desktop (bottom of left panel)
- Left panel density similar to VS Code sidebar
- Settings layout follows VS Code pattern (sidebar categories)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-foundation*
*Context gathered: 2026-02-05*
