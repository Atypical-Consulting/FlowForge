# Phase 1: Foundation - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Application launches and can open Git repositories with type-safe Rust-React communication. Users can open repos via file picker, see recent repositories, and view current branch status. No staging, committing, or Git operations — those are Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Repository opening experience
- File picker is primary method (standard OS dialog)
- Drag-drop folder onto window as secondary method
- Validate on open: must be a Git repository (has .git), show clear error if not
- If repo has no commits yet (fresh init), still open it — show appropriate empty state

### Recent repositories list
- Show last 10 repositories (configurable later, but 10 is default)
- Each entry shows: folder name, full path (truncated middle if long), last opened timestamp
- Sort by most recently opened (most recent at top)
- One-click to reopen, right-click or hover for "Remove from list" option
- Persist across app restarts (local storage or config file)

### Status display
- Branch name and status appear in a header/toolbar area — always visible when repo is open
- Show current branch name prominently
- "Dirty" indicator: simple visual marker (dot, icon, or text) next to branch name
- Clean = no indicator or subtle checkmark; Dirty = yellow/orange dot or similar
- No need to show file counts in status bar — that's for the staging view in Phase 2

### First launch experience
- No onboarding wizard — developers don't need hand-holding
- Empty state shows: "Open a repository" button prominently, recent repos list (empty initially)
- Maybe a keyboard shortcut hint (Cmd/Ctrl+O) but nothing more
- Get out of the way fast — the app is a tool, not a tour

### Window and layout
- Single window application
- Remember window size and position across restarts
- Sensible default size (e.g., 1200x800) that works on most screens
- Standard window controls (minimize, maximize, close)

### Claude's Discretion
- Exact styling, colors, and spacing (follow modern desktop app conventions)
- Loading states and transitions
- Exact error message wording
- Config file format and location
- Any animations or micro-interactions

</decisions>

<specifics>
## Specific Ideas

- Target audience is developers familiar with Git — no need to explain what a branch is
- The app should feel fast and native, not like a wrapped web page
- Tauri was chosen specifically for small binary and native feel — honor that choice

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-03*
