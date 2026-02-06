# Phase 15: Topology - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Ungit-style topology visualization with commit details and history diff viewing. Includes a blade-based layout rework for the main content area, replacing the current fixed 3-panel layout with a scalable process-based navigation model. Fixes v1.0 tech debt (topology auto-refresh after commits).

</domain>

<decisions>
## Implementation Decisions

### Graph visual style
- Gitflow semantic lane colors: main=blue, develop=green, feature=purple, release=orange, hotfix=red
- Ungit-style commit badges: rounded rectangles showing conventional commit type icon + commit subject
- Branch labels in a fixed column header row above the graph (not inline on lanes)
- Top-to-bottom flow: newest commits at top, scroll down for history
- Straight angled merge lines between branches (not curved Bezier)
- Colored lane columns: each Gitflow lane has a faint background tint matching its semantic color

### Blade-based layout (Azure Portal pattern)
- Replace current 3-panel layout with a blade navigation model
- Left sidebar stays fixed (branches, stashes, tags)
- Main area uses blades — panels that slide in from the right
- Two root blade processes: **Staging** (changes → stage → commit) and **Topology** (graph → commit → diff)
- Process entry points in header bar with icon + text labels (scalable for future processes)
- When a new blade opens, previous blade compresses to a narrow strip (title + back arrow)

### Commit details blade
- Full details: author, date, full SHA, commit message, parent SHAs
- File tree of changed files with change type indicators (added/modified/deleted)
- Togglable between directory tree view and flat list view (matching existing Changes panel UX)
- Per-file stats with GitHub-style colored bars (+/- insertion/deletion counts)

### Diff viewing
- Unified diff by default with toggle to switch to side-by-side
- Full syntax highlighting for code files
- File navigation driven by the commit details blade — select file in tree, diff blade opens
- Changed hunks shown by default with expandable context (click to reveal surrounding lines)

### Interaction & navigation
- Scroll + zoom on the topology graph (wheel/pinch zoom)
- Keyboard shortcuts: arrow keys to move between commits, Enter to open details, Escape to close blade, J/K for scroll
- Topology auto-refreshes after commits (fixes v1.0 tech debt)

### Claude's Discretion
- Rendering technology (SVG vs Canvas vs HTML/CSS)
- Exact commit badge sizing and typography
- Zoom level range and default
- Blade transition animations and timing
- Syntax highlighting library choice
- How to handle very long commit histories (virtualization approach)

</decisions>

<specifics>
## Specific Ideas

- "Blades like on Azure" — the drill-down navigation pattern where each new panel slides in from the right and previous panels compress to narrow strips
- Two distinct processes: Staging (creation flow) and Topology (inspection flow), each with their own blade chain
- Header process navigation should be scalable — designed so future processes (Worktrees, Settings, etc.) can be added without layout changes
- File tree in commit details should match the existing Changes view toggle (tree/flat) for UX consistency
- Conventional commit type icons on graph nodes leverage FlowForge's enforced conventional commits

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-topology*
*Context gathered: 2026-02-06*
