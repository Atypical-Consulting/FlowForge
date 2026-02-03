# Phase 2: Core Git - Staging & Commits - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

User can view changes, stage/unstage files, commit, and sync with remotes. This covers the daily Git workflow: seeing what changed, preparing commits, writing commit messages, and synchronizing with remote repositories. Branch operations and Gitflow workflows are separate phases.

</domain>

<decisions>
## Implementation Decisions

### File List Presentation
- Tree view as default, with flat list toggle available
- Group files by status: Staged, Unstaged (Modified), Untracked — in that order
- Each file shows: status icon (M/A/D/R/U), relative path, +/- line count when available
- Clicking a file selects it and shows diff in adjacent panel
- Checkbox or click-to-stage interaction (standard Git client pattern)

### Diff Viewing Experience
- Inline diff as default (unified diff format)
- Side-by-side available as toggle for users who prefer it
- Syntax highlighting based on file extension
- 3 lines of context by default
- Hunk-level staging supported — stage individual chunks, not just whole files
- Line-level staging as stretch goal (note: complex, may defer)

### Commit Flow
- Commit message area with subject/body split (blank line separator)
- Subject line: soft limit indicator at 50 chars, hard warning at 72
- Body: no limit, but encourage wrapping at 72 for terminal compatibility
- Amend checkbox to modify last commit (only when no new staged changes conflict)
- No template support in v1 — conventional commits (Phase 6) will handle structured messages

### Sync Operations UI
- Push/Pull/Fetch as distinct buttons in toolbar
- Progress indicator for long operations (spinner + operation name)
- Pre-push: show commits that will be pushed (outgoing)
- Pre-pull: show commits that will be pulled (incoming) via fetch preview
- Conflict state: clear indicator when pull would cause conflicts, suggest stash or commit first
- Fast-forward vs merge: default to fast-forward when possible, show merge indicator when not

### History View
- Linear commit list (not graph — that's Phase 5)
- Each commit shows: short hash, subject line, author, relative time
- Click to expand and see full message + changed files
- Pagination or virtual scroll for large histories

### Claude's Discretion
- Exact styling, spacing, and visual polish
- Loading states and skeleton designs
- Error message wording and retry UX
- Keyboard shortcut assignments (will be standardized in Phase 8)
- Animation and transition choices

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The patterns should feel familiar to users of GitKraken, Fork, or Sublime Merge.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-core-git-staging-commits*
*Context gathered: 2026-02-04*
