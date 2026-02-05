# Phase 12: Workflows - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can clone repositories, initialize Gitflow on plain repos, and amend commits with message reload. Three distinct workflows: Clone (by URL with progress), Gitflow Init (on non-Gitflow repos with branch configuration), and Amend (with previous message pre-fill).

</domain>

<decisions>
## Implementation Decisions

### Clone Experience
- Progress displays inline on welcome page (no modal)
- Destination folder: default location from settings + native folder picker to change
- After clone completes: auto-open the cloned repository
- Clone errors: display via toast notification

### Gitflow Init Flow
- Init option only appears when repo is not Gitflow (lacks develop/Gitflow structure)
- UI: modal dialog with branch name fields
- Branch names: full customization (main, develop, feature/, release/, hotfix/ prefixes)
- Default branch names: detect repo's main branch (main or master), standard names for others
- Existing develop branch: warn and confirm (ask if user wants to use existing or rename)
- Validation: strict (valid git ref characters + no conflicts with existing branches)
- After init: switch to develop branch automatically
- Push to remote: checkbox asking user "Push develop to remote?"

### Amend Workflow
- Trigger: checkbox in commit form ("Amend previous commit")
- Pre-fill: both subject and body from previous commit
- Confirmation: dialog before executing ("Amend will rewrite the last commit. Continue?")
- Message conflict: if user has typed text then checks amend, ask whether to load previous message

### Entry Points
- Clone: welcome page + File menu (File > Clone Repository)
- Gitflow Init: Git menu (Git > Initialize Gitflow) + button in left panel sidebar when repo isn't Gitflow
- Amend: checkbox in commit form, also available in conventional commits modal
- Keyboard shortcuts: Cmd/Ctrl+Shift+A to toggle amend (no shortcut for clone or Gitflow init)

### Claude's Discretion
- Clone progress bar implementation details
- Exact toast messages for errors
- Sidebar button styling for Gitflow init
- Amend checkbox positioning within form

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-workflows*
*Context gathered: 2026-02-05*
