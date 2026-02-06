# Phase 17: Hierarchical View & Commit Enhancements - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve the existing hierarchical staging tree with folder-level stage/unstage actions and uniform icon spacing. Add color-coded conventional commit type icons throughout the app and in generated changelogs. No new views or features — enhancing two existing capabilities.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All areas deferred to Claude's judgment. The following guidance applies:

**Folder staging behavior:**
- Folder stage/unstage button should toggle all files within that folder
- Mixed state (some staged, some not) should show a partial/indeterminate indicator
- Clicking stage on a partially-staged folder stages all remaining unstaged files
- Clicking unstage on a partially-staged folder unstages all staged files

**Tree layout & spacing:**
- Uniform icon widths across all nesting depths — use fixed-width icon containers
- Consistent icon-to-text spacing regardless of file type icon
- Follow existing indentation patterns in the codebase

**Commit type color scheme:**
- Map conventional commit types to Catppuccin palette colors already in the theme
- Colors should be distinct and recognizable at a glance
- Apply consistently: topology graph, commit lists, changelogs, anywhere commit types appear

**Changelog commit icons:**
- Include the colored commit type icon inline next to each changelog entry
- Keep it subtle — icon + text, not badges or separate columns

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing Catppuccin theme tokens and codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-hierarchical-view-commit-enhancements*
*Context gathered: 2026-02-06*
