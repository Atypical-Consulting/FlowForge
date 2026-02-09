# FlowForge UX/UI — Remaining User Stories

User stories extracted from [UX-UI-IMPROVEMENTS.md](./UX-UI-IMPROVEMENTS.md) for all features that are **not yet implemented** or **partially implemented**.

---

## Summary

| ID | Epic | Story Count | Priority | Effort |
|----|------|-------------|----------|--------|
| E1 | Enhanced Diff Viewer | 6 | High | High |
| E2 | Branch & Commit Visualization | 3 | Medium | Medium |
| E3 | Welcome Screen Enhancement | 3 | Medium | Low |
| E4 | Inline Conflict Resolution | 5 | Medium | High |
| E5 | Git Insights Dashboard | 4 | Low | High |
| E6 | Customizable Workspace Layouts | 4 | Low | Medium |
| **Total** | | **25** | | |

---

## E1 — Enhanced Diff Viewer

*Existing: split/unified view toggle, Monaco integration, file navigation, markdown preview.*

### E1-US01: Collapsible Unchanged Regions

**As a** developer reviewing a diff,
**I want** unchanged code blocks to be collapsed by default,
**So that** I can focus on the actual changes without scrolling through unmodified lines.

**Acceptance Criteria:**
- [ ] Consecutive unchanged lines beyond a configurable threshold (e.g., 8 lines) are collapsed
- [ ] A "Show N unchanged lines" expander is displayed in place of collapsed blocks
- [ ] Clicking the expander reveals the hidden lines inline
- [ ] Context lines (3 above and below each change) remain visible at boundaries
- [ ] Collapsing/expanding preserves scroll position

**Effort:** 3-4 days

---

### E1-US02: Line-Level Staging (Hunk Selection)

**As a** developer preparing a commit,
**I want** to stage individual lines or hunks from within the diff viewer,
**So that** I can create focused, atomic commits without staging entire files.

**Acceptance Criteria:**
- [ ] Each changed line displays a clickable gutter control (+/- button or checkbox)
- [ ] Clicking a line control toggles its staged/unstaged state
- [ ] Hunk headers provide a "Stage hunk" / "Unstage hunk" action
- [ ] Staged and unstaged lines are visually distinct (e.g., background tint)
- [ ] Changes to staging are reflected immediately in the staging panel
- [ ] Keyboard shortcut to stage/unstage the line at cursor position

**Effort:** 2 weeks

---

### E1-US03: Word-Level Diff Highlighting

**As a** developer reviewing a diff,
**I want** changed words within a line to be highlighted,
**So that** I can quickly identify exactly what changed without comparing full lines character by character.

**Acceptance Criteria:**
- [ ] Within modified lines, changed words/tokens are highlighted with a distinct background
- [ ] Additions and deletions use different highlight colors (green/red tints)
- [ ] Unchanged portions of a line remain at normal contrast
- [ ] Highlighting works in both split and unified view modes

**Effort:** 2-3 days

---

### E1-US04: Semantic Change Highlighting

**As a** developer reviewing a diff,
**I want** renamed variables or functions to be visually linked,
**So that** I can distinguish renames from logic changes at a glance.

**Acceptance Criteria:**
- [ ] Renamed identifiers are highlighted differently from structural changes
- [ ] Unchanged syntax (brackets, keywords) is dimmed relative to meaningful changes
- [ ] Works for common languages (TypeScript, JavaScript, Rust at minimum)

**Effort:** 1 week

---

### E1-US05: Diff View Preference Persistence

**As a** user,
**I want** my preferred diff view mode (split or unified) to persist across sessions,
**So that** I don't have to switch modes every time I open the app.

**Acceptance Criteria:**
- [ ] Selected view mode is saved to local storage or app settings
- [ ] Preference is restored on next app launch
- [ ] Preference applies to all files by default

**Effort:** 0.5 day

---

### E1-US06: Markdown Preview for Diff

**As a** developer editing documentation,
**I want** a rendered markdown preview alongside the diff,
**So that** I can see the visual impact of my changes to `.md` files.

**Acceptance Criteria:**
- [ ] Markdown files show a "Preview" toggle in the diff toolbar
- [ ] Preview renders the new version with changed sections highlighted
- [ ] Preview updates live as staged content changes

*Note: Basic markdown preview already exists — this story covers enriching it with change highlighting.*

**Effort:** 2 days

---

## E2 — Branch & Commit Visualization

*Existing: branch color coding, node differentiation, animated HEAD indicator, glow filter.*

### E2-US01: Author Avatars

**As a** developer browsing commit history,
**I want** to see author avatars next to commits,
**So that** I can quickly identify who made each change.

**Acceptance Criteria:**
- [ ] Author avatar is displayed on commit nodes in the topology view
- [ ] Author avatar is displayed in the history list
- [ ] Avatars are fetched from Gravatar (via email hash) or GitHub API
- [ ] Fallback to initials with a deterministic background color when no avatar is available
- [ ] Avatars are cached locally to avoid repeated network requests
- [ ] Graceful degradation when offline (show initials fallback)

**Effort:** 3-4 days

---

### E2-US02: Commit Heat Map

**As a** developer exploring repository history,
**I want** commits to be colored by recency,
**So that** I can visually identify areas of recent activity vs. stale code.

**Acceptance Criteria:**
- [ ] Commit nodes in the topology view have color intensity based on age
- [ ] Recent commits appear at full saturation, older commits fade progressively
- [ ] A legend or tooltip explains the time-to-color mapping
- [ ] Heat map can be toggled on/off to revert to default colors
- [ ] Respects `prefers-reduced-motion` (no animated transitions)

**Effort:** 2-3 days

---

### E2-US03: Commit Node Tooltips

**As a** developer viewing the topology graph,
**I want** to hover over a commit node and see its details,
**So that** I can get commit info without navigating away from the graph.

**Acceptance Criteria:**
- [ ] Hovering a commit node shows a tooltip with: hash (short), author, date, subject line
- [ ] Tooltip appears after a short delay (300ms) and follows Catppuccin styling
- [ ] Tooltip disappears when the cursor moves away
- [ ] Keyboard focus on a node also triggers the tooltip

**Effort:** 1-2 days

---

## E3 — Welcome Screen Enhancement

*Existing: repository cards, drag-drop, animated gradient background, time-based display.*

### E3-US01: Pinned Repositories

**As a** user with many repositories,
**I want** to pin my most-used repositories to the top of the welcome screen,
**So that** I can access them instantly without scrolling.

**Acceptance Criteria:**
- [ ] Each repository card has a pin/star toggle button
- [ ] Pinned repositories appear in a separate "Pinned" section above recent repos
- [ ] Pin state persists across app restarts (stored in local settings)
- [ ] Pinned repos maintain their own sort order (most recently pinned first, or drag-to-reorder)
- [ ] Unpinning moves the repo back to the "Recent" section

**Effort:** 2-3 days

---

### E3-US02: Repository Health Indicators

**As a** user viewing the welcome screen,
**I want** to see the sync status of each repository at a glance,
**So that** I know which repos need attention before opening them.

**Acceptance Criteria:**
- [ ] Each repository card displays a colored status dot
- [ ] Green dot: clean working tree, up to date with remote
- [ ] Yellow dot: uncommitted local changes
- [ ] Red dot: behind remote (new commits available)
- [ ] Blue arrow: ahead of remote (local commits to push)
- [ ] Status is fetched asynchronously and does not block card rendering
- [ ] Tooltip on the dot explains the status in plain language

**Effort:** 2-3 days

---

### E3-US03: Repository Quick Actions

**As a** user on the welcome screen,
**I want** quick action buttons on each repository card,
**So that** I can perform common operations (open in terminal, remove from recents) without opening the repo first.

**Acceptance Criteria:**
- [ ] Hovering a repository card reveals action buttons (Open, Terminal, Remove)
- [ ] "Open" opens the repository in FlowForge
- [ ] "Terminal" opens the system terminal at the repo path
- [ ] "Remove" removes the repo from recents (with confirmation)
- [ ] Actions are accessible via keyboard (focus card, then Tab to actions)

**Effort:** 1-2 days

---

## E4 — Inline Conflict Resolution

*Existing: MergeDialog lists conflicted files but has no inline resolution UI.*

### E4-US01: Conflict Detection UI

**As a** developer who just triggered a merge with conflicts,
**I want** conflicted files to be clearly marked in the file tree and staging panel,
**So that** I can immediately see which files need my attention.

**Acceptance Criteria:**
- [ ] Conflicted files display a red warning icon in the file tree
- [ ] A conflict count badge appears in the header/toolbar
- [ ] Staging panel offers a "Conflicts" filter to show only conflicted files
- [ ] Conflict state updates automatically when files are resolved

**Effort:** 2-3 days

---

### E4-US02: Three-Way Merge View

**As a** developer resolving a merge conflict,
**I want** to see "ours", "base", and "theirs" versions side by side,
**So that** I can understand the full context of the conflict and make informed resolution decisions.

**Acceptance Criteria:**
- [ ] Clicking a conflicted file opens a three-panel view: Ours | Base | Theirs
- [ ] Conflict regions are highlighted with distinct colors per side
- [ ] A fourth "Result" panel shows the merged output
- [ ] Scroll positions are synchronized across panels
- [ ] Panels can be individually resized

**Effort:** 2 weeks

---

### E4-US03: One-Click Conflict Resolution

**As a** developer resolving a simple conflict,
**I want** one-click buttons to accept "ours", "theirs", or "both",
**So that** I can resolve straightforward conflicts quickly without manual editing.

**Acceptance Criteria:**
- [ ] Each conflict hunk displays "Accept Ours", "Accept Theirs", "Accept Both" buttons
- [ ] "Accept Both" concatenates both sides in the order: ours then theirs
- [ ] Clicking a resolution button updates the result panel immediately
- [ ] All conflict markers are removed from the resolved output
- [ ] Undo is available for each resolution action

**Effort:** 3-4 days

---

### E4-US04: Manual Conflict Editing

**As a** developer resolving a complex conflict,
**I want** to manually edit the merged result with a live preview,
**So that** I can craft a custom resolution that combines elements from both sides.

**Acceptance Criteria:**
- [ ] The result panel is editable (Monaco Editor)
- [ ] Edits are reflected in real-time
- [ ] Syntax highlighting and IntelliSense remain active during editing
- [ ] A "Reset" button reverts the result to the conflicted state

**Effort:** 2-3 days

---

### E4-US05: Mark File as Resolved

**As a** developer who has resolved all conflicts in a file,
**I want** to mark the file as resolved,
**So that** it moves out of the conflict list and becomes ready to stage.

**Acceptance Criteria:**
- [ ] A "Mark as Resolved" button appears when all conflict hunks in a file are resolved
- [ ] Marking as resolved stages the file and removes the conflict indicator
- [ ] If unresolved conflict markers remain in the file, a warning is shown before allowing resolution
- [ ] A "Mark All Resolved" action is available when all files are individually resolved
- [ ] Toast notification confirms resolution: "Resolved: path/to/file.ts"

**Effort:** 1-2 days

---

## E5 — Git Insights Dashboard

*New view — not started.*

### E5-US01: Commit Activity Chart

**As a** developer or team lead,
**I want** to see a chart of commit frequency over the last 30 days,
**So that** I can understand the development pace and identify slow/busy periods.

**Acceptance Criteria:**
- [ ] A bar or area chart displays daily commit counts for the last 30 days
- [ ] Hovering a bar shows the exact count and date
- [ ] The chart uses Catppuccin accent colors
- [ ] The time range is configurable (7 days, 30 days, 90 days)
- [ ] The chart is responsive and scales with panel width

**Effort:** 3-4 days

---

### E5-US02: Contributor Breakdown

**As a** developer working in a team,
**I want** to see contributor statistics,
**So that** I can understand the distribution of work across team members.

**Acceptance Criteria:**
- [ ] A list or chart shows each contributor's commit count and percentage
- [ ] Contributors are sorted by activity (most active first)
- [ ] Each contributor row shows avatar (or initials), name, and email
- [ ] Clicking a contributor filters the commit history to their commits

**Effort:** 2-3 days

---

### E5-US03: Branch Health Overview

**As a** developer managing multiple branches,
**I want** to see which branches are stale or active,
**So that** I can clean up old branches and focus on active work.

**Acceptance Criteria:**
- [ ] A table lists all branches with: name, last commit date, author, ahead/behind counts
- [ ] Branches are flagged as "stale" if no commits in the last 30 days
- [ ] Stale branches are visually dimmed or tagged with a warning badge
- [ ] Quick actions: delete branch, switch to branch
- [ ] Sortable by name, date, or staleness

**Effort:** 3-4 days

---

### E5-US04: Repository Stats Cards

**As a** user opening the insights dashboard,
**I want** to see key repository stats at a glance,
**So that** I get a quick overview without reading charts.

**Acceptance Criteria:**
- [ ] Stats cards display: total commits, active branches, contributors, repo age, largest files
- [ ] Cards use Catppuccin surface colors with accent highlights
- [ ] Values update on refresh or when the dashboard is opened
- [ ] Cards are laid out in a responsive grid

**Effort:** 1-2 days

---

## E6 — Customizable Workspace Layouts

*Existing: resizable panels via ResizablePanelLayout. No presets or focus mode.*

### E6-US01: Layout Presets

**As a** user who switches between different workflows,
**I want** to select from predefined layout presets,
**So that** I can instantly optimize my workspace for the task at hand.

**Acceptance Criteria:**
- [ ] A layout menu in the toolbar offers presets: Review, Commit, Explore, Focus
- [ ] "Review Mode" expands the diff panel and narrows staging
- [ ] "Commit Mode" expands staging and the commit form
- [ ] "Explore Mode" expands the topology view
- [ ] "Focus Mode" maximizes a single panel
- [ ] Selecting a preset animates the panel transition smoothly
- [ ] The active preset is indicated in the menu

**Effort:** 3-4 days

---

### E6-US02: Focus Mode

**As a** developer doing a deep code review,
**I want** to maximize a single panel to fullscreen,
**So that** I can eliminate distractions and focus on the content.

**Acceptance Criteria:**
- [ ] Double-clicking a panel header maximizes it to fill the workspace
- [ ] `Esc` exits focus mode and restores the previous layout
- [ ] A subtle indicator shows which panel is in focus mode
- [ ] Focus mode works for all panels: staging, diff, topology, history
- [ ] Panel content re-renders to use the full available space

**Effort:** 2-3 days

---

### E6-US03: Panel Visibility Toggles

**As a** user who doesn't need all panels at once,
**I want** to toggle individual panels on and off,
**So that** I can reduce visual noise and reclaim screen space.

**Acceptance Criteria:**
- [ ] A "Panels" menu or toolbar section lists all available panels with toggle switches
- [ ] Toggling a panel off collapses it with a smooth animation
- [ ] Remaining panels redistribute the available space
- [ ] Panel visibility state persists across sessions
- [ ] A "Reset layout" option restores all panels to their default state

**Effort:** 2-3 days

---

### E6-US04: Layout Persistence

**As a** user who customized panel sizes,
**I want** my layout to be remembered across sessions,
**So that** I don't have to resize panels every time I open the app.

**Acceptance Criteria:**
- [ ] Panel sizes (percentages) are saved to local storage on resize
- [ ] On app launch, panels restore to their last saved sizes
- [ ] Each layout preset can be independently customized and saved
- [ ] A "Reset to default" option clears saved layout and restores factory sizes

**Effort:** 1-2 days

---

## Prioritization Recommendation

### Next Sprint (Highest Impact)

1. **E1-US01** — Collapsible unchanged regions (high impact, medium effort)
2. **E1-US03** — Word-level diff highlighting (high impact, low effort)
3. **E1-US05** — Diff view preference persistence (quick win)
4. **E3-US01** — Pinned repositories (quality of life)

### Following Sprint

5. **E1-US02** — Line-level staging (very high impact, high effort)
6. **E4-US01** — Conflict detection UI (unlocks the conflict resolution epic)
7. **E2-US01** — Author avatars (visual polish)
8. **E3-US02** — Repository health indicators (welcome screen polish)

### Later

9. **E4-US02 through E4-US05** — Full conflict resolution (high effort, very high impact)
10. **E6-US01 through E6-US04** — Workspace layouts (medium impact)
11. **E5-US01 through E5-US04** — Insights dashboard (lower priority)
12. **E1-US04** — Semantic change highlighting (advanced, dependent on language parsing)

---

*Extracted from UX-UI-IMPROVEMENTS.md v2.0*
*Created: February 2026*
