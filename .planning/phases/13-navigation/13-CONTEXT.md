# Phase 13: Navigation - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Repository and branch switcher in the top bar. Users can quickly switch between recently opened repositories and branches without leaving the main view. No new repo opening workflows — switcher works with already-known repos only.

</domain>

<decisions>
## Implementation Decisions

### Repository Switcher
- List populated from both recent repos and pinned favorites
- Pinned repos appear at the top, recent repos (up to 5) below
- Each entry shows: repository name (folder name) + abbreviated file path
- No "Open repository..." action in the dropdown — opening new repos uses existing menu/welcome page
- Repo list persisted across sessions

### Branch Switcher
- Top section: 3 most recently checked-out branches
- Below: full list of local branches
- Local branches shown by default, with a toggle to also show remote branches
- Checking out a remote branch creates a local tracking branch
- Search field filters as you type (live filtering across all sections)

### Top Bar Layout
- Integrate into the existing header, replacing/reorganizing current content
- Repo and branch as distinct blocks/pills on the left side (GitHub Desktop style)
- Git branch icon displayed next to the branch name
- Chevron dropdown indicator appears only on hover
- Existing controls (settings, etc.) pushed to the right side of the same bar
- Dropdown panels are slide-down style (like GitHub Desktop), not floating popovers

### Switching Behavior
- Dirty working tree: offer to stash changes before switching ("Stash and switch" / "Cancel")
- App remembers last active branch per repo — restoring it when switching back
- Subtle toast notification after switching repos ("Switched to RepoName")
- Toast also on branch switch for consistency

### Claude's Discretion
- Loading state approach during repo/branch switch (spinner placement, duration)
- Exact slide-down panel dimensions and animation
- Keyboard navigation within dropdowns
- How pinning/unpinning repos works (icon, gesture)
- Search field placeholder text and behavior when no results

</decisions>

<specifics>
## Specific Ideas

- "Like GitHub Desktop with blocks for repository and branch" — distinct pill/block elements, each clearly its own clickable area
- Subtle buttons that look like labels until hovered — not overly prominent, blends with the bar
- Slide-down panels (GitHub Desktop's branch switcher style) rather than small floating dropdowns

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-navigation*
*Context gathered: 2026-02-06*
