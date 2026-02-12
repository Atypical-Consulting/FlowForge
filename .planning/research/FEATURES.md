# Feature Landscape: Enhanced Diff, Conflict Resolution, Insights & UX

**Domain:** Desktop Git Client UI/UX Enhancement
**Researched:** 2026-02-12
**Competitive Baseline:** VS Code, GitKraken, Fork, Sublime Merge, Tower, SmartGit

## Table Stakes

Features users expect from a professional Git client. Missing = product feels incomplete compared to competitors.

| Feature | Why Expected | Complexity | Existing Foundation | Notes |
|---------|--------------|------------|---------------------|-------|
| Collapsible unchanged diff regions | VS Code, Sublime Merge, Fork all collapse unchanged code by default since 2023. Users reviewing large diffs need to focus on changes, not scroll through 500 unchanged lines. | **Low** | Monaco DiffEditor already supports `hideUnchangedRegions` option. `DiffBlade.tsx` passes options to `<DiffEditor>` but does not enable this. | One-liner config change with optional UX toggle. Monaco API: `{ hideUnchangedRegions: { enabled: true, contextLineCount: 3, minimumLineCount: 3, revealLineCount: 20 } }`. Breadcrumbs show which symbols are collapsed. Edges are draggable to reveal more. |
| Word-level diff highlighting | Sublime Merge, GitKraken, Fork all show character/word-level inline highlights within changed lines. Without this, users see entire lines colored but cannot quickly identify which part of a long line changed. | **Low** | Monaco DiffEditor provides word-level highlighting by default. Current `MONACO_COMMON_OPTIONS` does not disable it, so this may already be partially working. Verify `renderIndicators: true` and `ignoreTrimWhitespace` behavior. | Verify current behavior. May only need CSS refinement to make word-level highlights more visible within the Catppuccin theme. Monaco uses `diffEditor.insertedTextBackground` / `diffEditor.removedTextBackground` for word-level colors. |
| Author avatars in commit history | GitKraken, Tower, GitExtensions, SourceGit all show Gravatar or GitHub avatars next to commits. Text-only commit lists feel generic and make it harder to visually scan for specific authors. | **Medium** | `UserAvatar.tsx` component exists in the GitHub extension (uses GitHub avatar URLs). `CommitHistory.tsx` shows `authorName` text but no avatar. `authorEmail` is available in `CommitSummary`. | Gravatar URL is deterministic: `https://gravatar.com/avatar/{md5(email.trim().toLowerCase())}?s=32&d=retro`. Cache avatars per email. Add to `CommitHistory` item rows. Reuse `UserAvatar` pattern with fallback initials. |

## Differentiators

Features that set FlowForge apart from competitors. Not universally expected, but highly valued by power users.

| Feature | Value Proposition | Complexity | Existing Foundation | Notes |
|---------|-------------------|------------|---------------------|-------|
| Hunk-level staging | Stage individual hunks from the diff view. GitKraken and Fork support this; VS Code has partial support. Allows precise commit crafting without command-line `git add -p`. | **High** | Rust backend has `DiffHunk` struct with `old_start`, `old_lines`, `new_start`, `new_lines`, `header`. Frontend only has file-level `stageFile`/`unstageFile` commands. No `stageHunk` or `stageLine` backend commands exist. | Requires: (1) new Rust command `stage_hunk(file_path, hunk_header)` using `git2` `Repository::apply()` with partial patch, (2) UI gutter buttons per hunk in diff view, (3) careful handling of hunk boundaries when adjacent hunks are partially staged. GitKraken shows green "+" in left gutter on hover per hunk. |
| Line-level staging | Stage individual lines within a hunk. VS Code supports this via right-click context menu. Finer granularity than hunk staging. | **Very High** | Same gap as hunk staging, plus requires constructing custom patches with specific line ranges. No existing line-level staging infrastructure. | Requires: (1) Rust command `stage_lines(file_path, line_ranges)` that constructs a custom unified diff patch, (2) Monaco gutter decorations with click handlers using `glyphMarginClassName`, (3) shift-click multi-select for line ranges. Recommend deferring after hunk staging is proven. |
| Three-way merge conflict resolution | Inline conflict resolution with base/ours/theirs panels. VS Code's merge editor (since v1.69) shows Incoming (left) + Current (right) + Result (bottom). GitKraken shows three versions with checkboxes per hunk. | **Very High** | `MergeDialog.tsx` lists conflicted files but says "Resolve conflicts manually." `FileStatus::Conflicted` exists in Rust. No merge resolution UI exists. | Full implementation needs: (1) Rust command to read base/ours/theirs versions of conflicted file, (2) new `ConflictResolutionBlade` with three Monaco editors (left=incoming, right=current, bottom=result), (3) "Accept Current" / "Accept Incoming" / "Accept Both" buttons per conflict region, (4) "Mark Resolved" action that stages the file. VS Code community feedback: many users preferred the old inline markers over the new 3-pane editor. Consider offering both. |
| Git insights dashboard with charts | Analytics view showing commit frequency, contributor breakdown, code churn over time. GitKraken Insights is a separate premium product. No desktop Git client ships this built-in as a first-class feature. | **High** | No existing analytics infrastructure. `getCommitHistory` returns paginated `CommitSummary` objects with `authorName`, `authorEmail`, `timestampMs`. Would need bulk data extraction. | Unique differentiator -- no competitor ships this as a built-in local feature (GitKraken Insights is cloud-based). Needs: (1) Rust command to extract commit statistics (commits per day/week, author breakdown, file churn), (2) chart library (Recharts for simplicity or Nivo for aesthetics), (3) new `InsightsBlade`. Data should be computed in Rust for performance on large repos. |
| Commit heat map (contribution calendar) | GitHub-style calendar heat map showing commit activity. Satisfying visual that gives at-a-glance repo health. | **Medium** | No existing heat map. `timestampMs` is available on commits. | Use `react-calendar-heatmap` (SVG-based, 600+ npm weekly downloads, GitHub-inspired) or `@uiw/react-heat-map` (more actively maintained, lightweight). Data: aggregate `timestampMs` into day buckets from commit history. Part of the insights dashboard. |
| Workspace layout presets | Save/restore panel configurations (e.g., "Review Mode" with large diff + small file list, "Staging Mode" with balanced split). GitKraken has column customization per repo; no competitor has named presets. | **Medium** | `react-resizable-panels` with `autoSaveId` already persists panel sizes. `ResizablePanelLayout` wraps this. Preferences store (`settings.slice.ts`) has persistence infrastructure via `@tauri-apps/plugin-store`. | Needs: (1) named preset definitions stored in preferences, (2) preset selector UI (dropdown or command palette entries), (3) apply preset by programmatically setting panel sizes. `react-resizable-panels` supports imperative `setPanelSize()` via refs. Novel differentiator. |
| Welcome screen with pinned repos and health indicators | Pin favorite repos to welcome screen with at-a-glance status (dirty/clean, branch name, last commit age). Goes beyond basic "recent repos" list. | **Medium** | `RecentRepos.tsx` shows recent repos with name, path, timestamp. `navigation.slice.ts` already has `pinRepo`/`unpinRepo`/`isRepoPinned`. No health indicator data on welcome screen. | Pinning infrastructure exists. Needs: (1) lightweight Rust command to check repo health without fully opening (is it dirty? current branch? last commit date?), (2) visual indicators (green dot = clean, yellow = dirty, red = detached HEAD), (3) pin/unpin toggle on repo cards. Partially built -- mostly UI + one new backend command. |

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| AI-powered conflict resolution | GitKraken added AI merge in 2025 but it requires cloud API calls, which conflicts with FlowForge's local-first architecture. Adds complexity, external dependency, and privacy concerns. | Build excellent manual three-way merge UX first. AI can be a future extension. |
| Full GitHub-style social features | Pull request review comments, code review assignments, etc. belong in the existing GitHub extension, not in the core diff viewer. | Keep GitHub-specific features in the `github` extension. Core diff enhancements should work for any repo. |
| Real-time collaboration | No professional desktop Git client offers this. Git itself is not designed for real-time sync. | Focus on single-user workflow excellence. |
| Code churn alerts / burnout detection | GitKraken Insights offers team-level metrics. Adding notifications about "too many commits" or "working late" crosses into surveillance territory. | Show data, don't interpret it judgmentally. Let users draw their own conclusions from charts. |
| Custom diff algorithms | Sublime Merge offers `diff_algorithm` preference (patience, histogram, etc.). Niche feature that affects very few users. | Use git2's default algorithm. Add as a preference later if requested. |
| Drag-and-drop panel rearrangement | Complex implementation for minimal gain. Named presets achieve the same goal more reliably. | Implement named workspace presets with fixed panel positions. |

## Feature Dependencies

```
Collapsible Unchanged Diff Regions
  (no dependencies -- standalone Monaco config)

Word-Level Diff Highlighting
  (no dependencies -- verify existing Monaco behavior)

Author Avatars in Commit History
  (no dependencies -- Gravatar URL is deterministic from email)

Hunk-Level Staging
  --> Requires: New Rust backend command (stage_hunk)
  --> Requires: Diff hunk boundary data (already in DiffHunk struct)
  --> Blocks: Line-Level Staging (build hunk first, then refine to lines)

Line-Level Staging
  --> Requires: Hunk-Level Staging foundation
  --> Requires: New Rust backend command (stage_lines with custom patch)

Three-Way Merge Conflict Resolution
  --> Requires: New Rust backend commands (read base/ours/theirs)
  --> Requires: New blade type (ConflictResolutionBlade)
  --> Benefits from: Word-level diff highlighting (to show conflicts clearly)

Git Insights Dashboard
  --> Requires: New Rust backend command (commit_statistics)
  --> Requires: Chart library (Recharts or Nivo)
  --> Contains: Commit Heat Map (sub-feature of dashboard)

Commit Heat Map
  --> Requires: Git Insights Dashboard (container)
  --> Requires: react-calendar-heatmap or @uiw/react-heat-map

Workspace Layout Presets
  --> Requires: Preferences store integration (already exists)
  --> Requires: Imperative panel resize API (react-resizable-panels supports this)

Welcome Screen Enhancements
  --> Requires: New Rust backend command (quick repo health check)
  --> Benefits from: Existing pinRepo/unpinRepo in navigation.slice.ts
```

## Detailed UX Patterns from Professional Git Clients

### 1. Collapsible Unchanged Diff Regions

**VS Code (since v1.81):** Unchanged regions collapse automatically with breadcrumbs showing which symbols/functions are hidden. Collapsed block edges are draggable to reveal more context. Toggle via map icon in editor gutter. Setting: `diffEditor.hideUnchangedRegions.enabled`.

**Sublime Merge:** Click-and-drag on hunk edges to add/remove context lines. Double-click edge to increase context by a few lines. Only shows hunks + context lines by default.

**Fork:** Shows context lines around changes. Expandable "..." indicators between hunks to reveal more unchanged code.

**Recommendation for FlowForge:** Enable Monaco's built-in `hideUnchangedRegions` with a toolbar toggle. Default to enabled. Show 3 context lines. Add a "Show All" button in the diff toolbar for cases where users need full context.

### 2. Hunk-Level and Line-Level Staging

**GitKraken:** Hover over added lines reveals green "+" in left margin for line staging. Right-click for hunk staging. Checkbox per hunk. Keyboard shortcuts requested but not yet implemented.

**VS Code:** Right-click context menu in diff gutter: "Stage Selected Ranges", "Unstage Selected Ranges". GitLens extension adds hover "+" button. VS Code 2023+ supports staging from the inline diff editor.

**Fork:** Side-by-side diff shows hunk stage/discard buttons. Users can stage one hunk at a time but line-level is more limited. Feature request for batch staging across hunks.

**Sublime Merge:** Right-click on hunk header for stage/discard. Individual line staging via right-click on specific lines.

**Recommendation for FlowForge:** Phase 1: hunk-level staging with prominent buttons per hunk (not hidden behind right-click). Phase 2: line-level via shift-click selection + context menu. Use Monaco glyph margin decorations for interactive stage buttons.

### 3. Word-Level Diff Highlighting

**Sublime Merge:** Character-level diff highlighting is built-in. Syntax highlighting within diffs.

**VS Code / Monaco:** Word-level highlighting is the default behavior in the DiffEditor. Changed words within a line get a distinct background color. Controlled by `diffEditor.renderIndicators` and inherent diffing algorithm.

**GitKraken:** Highlights changed portions within lines with a brighter background shade.

**Recommendation for FlowForge:** Verify Monaco's default word-level highlighting renders correctly with the `flowforge-dark` theme. Tune `diffEditor.insertedTextBackground` and `diffEditor.removedTextBackground` theme tokens for Catppuccin palette visibility. May need no code changes, just theme adjustments.

### 4. Three-Way Merge Conflict Resolution

**VS Code (since v1.69):** Three-pane layout: Incoming (left, read-only) + Current (right, read-only) + Result (bottom, editable). Checkboxes per conflict to accept current/incoming/both. "Accept Combination" button for smart merge. Community backlash when 3-pane became default -- many users preferred the old inline `<<<<<<<` / `>>>>>>>` markers.

**GitKraken:** Three versions with synchronized scrolling. Checkboxes per hunk. Output panel at bottom for live preview. Can type directly in output box. 2025: AI auto-resolve button (cloud-based).

**SmartGit:** Side-by-side with base in center. Shows only actual conflicts, not already-resolved diffs (reduces noise vs VS Code approach).

**Fork:** Built-in merge conflict resolver. Three-way view with accept buttons.

**Recommendation for FlowForge:** Start with VS Code's layout pattern (incoming left, current right, result bottom) but learn from criticisms: (1) also offer an inline mode showing conflict markers with inline accept/reject buttons, (2) only show actual conflicts, not resolved regions (SmartGit's approach), (3) make the result panel editable so users can manually fix. Provide keyboard shortcuts for accept/reject.

### 5. Workspace Layout Presets

**GitKraken:** Saves column widths/order per repo. Sections in left panel are resizable and maximizable (double-click header). Per-repo persistence but no named presets.

**Tower:** Fixed layout with configurable panels. No named presets.

**VS Code:** Has "Editor Layout" presets (single, side-by-side, grid) but these are editor layouts, not Git-specific.

**No competitor offers named Git workspace presets.** This is a genuine differentiator.

**Recommendation for FlowForge:** Implement 3-4 built-in presets: (1) "Default" -- balanced panels, (2) "Review" -- large diff area with minimal file list, (3) "Staging" -- large file list with inline diff preview, (4) "Focused" -- single panel with no side panels. Store in preferences. Apply via command palette or toolbar dropdown. Allow saving custom presets.

### 6. Git Insights Dashboard

**GitKraken Insights:** Cloud-based premium product. PR metrics, cycle time, deployment frequency, code review metrics. Stacked bar charts for PR open time per repo. Not available locally.

**No desktop Git client ships built-in local analytics.** This is FlowForge's strongest potential differentiator.

**Common analytics patterns from standalone tools:**
- Commit frequency over time (line chart or bar chart)
- Author contribution breakdown (pie chart or stacked bar)
- File churn heat map (treemap showing most-changed files)
- Day-of-week / hour-of-day activity matrix
- Lines added/deleted over time (area chart)

**Recommendation for FlowForge:** Build an `InsightsBlade` as an extension with: (1) time-range selector (last 30/90/365 days), (2) commit frequency line chart, (3) author breakdown donut chart, (4) top changed files table, (5) commit heat map calendar. All computed locally from git log data.

### 7. Welcome Screen with Pinned Repos and Health Indicators

**GitKraken:** Recent and Favorite repos at top of Repositories section. Workspaces for grouping repos. No health indicators on the landing page.

**GitHub Desktop:** Recent repos list with last-updated timestamp. No pinning or health checks.

**RepoBar (menubar tool):** Shows CI status, issues count, PR count, latest release per pinned repo. Good model for at-a-glance health.

**Recommendation for FlowForge:** Extend `RecentRepos.tsx` to show: (1) pin toggle (star icon, using existing `pinRepo`), (2) pinned repos section above recent repos, (3) health dot (green=clean, yellow=uncommitted changes, red=merge conflict), (4) current branch name badge, (5) last commit relative time. The health check should be lightweight -- just `git status --porcelain` equivalent via a new fast Rust command that does not fully open the repo.

### 8. Author Avatars in Commit History

**Tower:** Gravatar-based avatars from commit email.
**GitKraken:** GitHub avatar if connected, otherwise Gravatar fallback.
**GitExtensions:** Configurable avatar source under Appearance settings.
**SourceGit:** Downloads and caches avatars locally.

**Recommendation for FlowForge:** Use Gravatar with `?d=retro` (generates unique geometric patterns as fallback -- no broken images). MD5 hash the lowercase trimmed email. Cache avatar URLs in memory (Map<email, url>). Show 20x20px circular avatar in `CommitHistory` item rows. Reuse the `UserAvatar` pattern from the GitHub extension but make it email-based (not GitHub-specific).

### 9. Commit Heat Map

**GitHub:** The iconic contribution calendar. Green squares, 52 weeks, intensity based on commit count per day.

**react-calendar-heatmap:** SVG-based React component. Accepts `startDate`, `endDate`, `values` array of `{date, count}`. Customizable via `classForValue` for Catppuccin theming.

**@uiw/react-heat-map:** More actively maintained alternative. Similar API. Supports custom colors via props.

**Recommendation for FlowForge:** Use `@uiw/react-heat-map` for its better maintenance status and more flexible color API (easier to integrate Catppuccin palette). Show last 365 days. Color scale: `ctp-surface0` (0 commits) through `ctp-green` intensities. Tooltip on hover showing date and commit count. Part of the Insights Dashboard.

## MVP Recommendation

### Must-Have (Phase 1 -- Low Hanging Fruit)

These can ship quickly with minimal backend changes:

1. **Collapsible unchanged diff regions** -- One Monaco option change + toolbar toggle. Massive UX improvement for large diffs.
2. **Word-level diff highlighting verification** -- Verify and tune theme colors. May be zero code changes.
3. **Welcome screen pinned repos** -- Pin infrastructure exists. Add visual section + pin toggle.

### Should-Have (Phase 2 -- Medium Effort)

4. **Author avatars in commit history** -- Gravatar integration with cache. Medium effort, high visual impact.
5. **Workspace layout presets** -- Unique differentiator. Medium effort using existing panel infrastructure.
6. **Welcome screen health indicators** -- One new lightweight Rust command + UI badges.

### Ambitious (Phase 3 -- Major Features)

7. **Hunk-level staging** -- New Rust backend command + gutter UI. Core workflow improvement.
8. **Git insights dashboard + commit heat map** -- New extension, chart library, bulk data extraction. Strong differentiator.

### Defer to Later Milestone

9. **Line-level staging** -- Depends on hunk staging. Very complex patch construction.
10. **Three-way merge conflict resolution** -- Massive scope. Three Monaco editors + conflict parsing + resolution state machine. Ship separately.

## Complexity Estimates

| Feature | Frontend | Backend | Total | Risk |
|---------|----------|---------|-------|------|
| Collapsible diff regions | 2h | 0h | 2h | Low |
| Word-level diff highlights | 2h | 0h | 2h | Low |
| Author avatars | 4h | 0h | 4h | Low |
| Welcome screen pins | 4h | 0h | 4h | Low |
| Welcome screen health | 4h | 4h | 8h | Low |
| Workspace layout presets | 8h | 0h | 8h | Medium |
| Hunk-level staging | 12h | 16h | 28h | High |
| Insights dashboard + heat map | 16h | 12h | 28h | Medium |
| Line-level staging | 16h | 20h | 36h | Very High |
| Three-way merge resolution | 24h | 16h | 40h | Very High |

## Sources

### Official Documentation
- [Monaco DiffEditor API - IDiffEditorBaseOptions](https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IDiffEditorBaseOptions.html) -- HIGH confidence
- [Monaco hideUnchangedRegions configuration](https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IDiffEditorConstructionOptions.html) -- HIGH confidence
- [VS Code v1.81 release notes (collapse unchanged regions)](https://code.visualstudio.com/updates/v1_81) -- HIGH confidence
- [VS Code Merge Editor docs](https://code.visualstudio.com/docs/sourcecontrol/merge-conflicts) -- HIGH confidence

### Git Client Feature References
- [GitKraken staging documentation](https://help.gitkraken.com/gitkraken-desktop/staging/) -- HIGH confidence
- [GitKraken merge conflict resolution tool](https://www.gitkraken.com/features/merge-conflict-resolution-tool) -- HIGH confidence
- [GitKraken Insights](https://help.gitkraken.com/gk-dev/gk-dev-insights/) -- HIGH confidence
- [Tower Gravatar integration](https://www.git-tower.com/help/guides/faq-and-tips/faq/gravatars/windows) -- HIGH confidence
- [Fork git client](https://git-fork.com/) -- MEDIUM confidence (limited public docs)
- [Sublime Merge diff context](https://www.sublimemerge.com/docs/diff_context) -- HIGH confidence
- [SmartGit conflict resolution](https://www.smartgit.dev/features/conflict-resolution/) -- MEDIUM confidence

### Libraries
- [react-calendar-heatmap](https://www.npmjs.com/package/react-calendar-heatmap) -- HIGH confidence
- [@uiw/react-heat-map](https://www.npmjs.com/package/@uiw/react-heat-map) -- HIGH confidence
- [Recharts](https://recharts.org/) -- HIGH confidence
- [Nivo](https://nivo.rocks/) -- HIGH confidence

### Community Discussions
- [VS Code three-way merge UX exploration (Issue #146091)](https://github.com/microsoft/vscode/issues/146091) -- MEDIUM confidence
- [VS Code hide unchanged regions (Issue #190837)](https://github.com/microsoft/vscode/issues/190837) -- MEDIUM confidence
- [GitKraken layout customization feedback](https://feedback.gitkraken.com/suggestions/530349/user-configurable-client-panels-and-layout) -- MEDIUM confidence
- [Three-way merge best practices essay](https://www.eseth.org/2020/mergetools.html) -- MEDIUM confidence
- [Monaco hideUnchangedRegions bug report confirming API](https://github.com/microsoft/monaco-editor/issues/4196) -- HIGH confidence
