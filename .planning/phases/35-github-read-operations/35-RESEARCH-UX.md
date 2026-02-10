# Phase 35: GitHub Read Operations - UX Research

**Researched:** 2026-02-10
**Domain:** UX patterns for GitHub PR/issue browsing in a blade-based desktop app
**Perspective:** UX specialist (1 of 3 researchers; others cover technical architecture and expert development)
**Confidence:** HIGH

## Summary

This research examines how FlowForge should present GitHub pull requests and issues within its existing blade-based UI architecture. The codebase already has well-established patterns -- `BladePanel` with title/trailing, `BladeContainer` with animated transitions, `BladeStrip` for collapsed breadcrumbs, `BladeContentLoading`/`BladeContentError`/`BladeContentEmpty` for states, `Skeleton` for shimmer loading, `EmptyState` for zero-data, and `SplitPaneLayout` for master/detail views. The key design challenge is not inventing new patterns but extending existing ones to handle remote API data (paginated lists, filter bars, status indicators) while keeping the component architecture generic enough for non-GitHub extensions to reuse.

Analysis of VS Code's GitHub Pull Requests extension, GitKraken's Launchpad, Tower's PR view, and GitHub Desktop reveals a converging set of UX patterns: (1) categorized list views with status-based filtering ("Open/Closed/Merged" or "Waiting for review/Assigned/Created by me"), (2) list items showing title + compact metadata row (author, timestamp, label pills, CI status dot), (3) detail views organized as scrollable pages with header card, markdown body, and comments timeline, and (4) toolbar actions that appear conditionally based on authentication and remote detection.

The extensibility mandate means list blades, filter bars, status indicators, and detail sections should be built as generic, composable primitives that happen to be used by GitHub first but can be consumed by any future extension (e.g., GitLab, Azure DevOps, Jira).

**Primary recommendation:** Build a reusable `ExtensionListBlade` pattern (filter bar + virtualized list + item renderer) and an `ExtensionDetailBlade` pattern (header card + markdown body + timeline), both living in shared component space, then compose the GitHub-specific blades from these primitives.

## UX Patterns from Competitive Analysis

### Pattern 1: Categorized List with Status Tabs
**Source:** VS Code GitHub PRs, GitKraken Launchpad, GitHub.com
**Confidence:** HIGH (multiple sources agree)

Every major tool uses a segmented control or tab bar at the top of the PR/issue list for quick status filtering:

| Tool | PR Categories | Issue Categories |
|------|--------------|------------------|
| VS Code | "Waiting For My Review", "Assigned To Me", "Created By Me" (customizable) | Similar query-based categories |
| GitKraken | "Mine", "Created by Me", "Assigned to Me", "Needs my review" | "Mine", "Created by Me", "Assigned to Me", "Mentioned" |
| GitHub.com | "Open", "Closed" tabs with search syntax | "Open", "Closed" tabs |
| Tower | "All", filtered by integration | Via repository scope |

**Recommendation for FlowForge:** Use a simpler model for v1. Primary filter is **state tabs** ("Open" / "Closed" / "Merged" for PRs; "Open" / "Closed" for issues) using the existing `role="tablist"` pattern from `CategoryFilter.tsx`. This is the most impactful single filter. Additional filters (author, label, assignee) are secondary -- surface them behind a filter icon or inline dropdown, not as permanent tabs.

### Pattern 2: List Item Information Density
**Source:** VS Code, GitKraken, GitHub.com, Tower
**Confidence:** HIGH

PR and issue list items follow a consistent two-line layout across all tools:

```
Line 1: [StatusIcon] Title text (truncated)                     [CI dots]
Line 2: #number  author  "3h ago"  [label] [label]  [reviewer avatars]
```

**PR list item must show:**
- Status icon (open/closed/merged) with semantic color (green/red/purple)
- Title (truncated, single line)
- PR number
- Author name
- Relative timestamp
- CI check summary indicator (green dot / yellow dot / red dot / gray dot)
- Draft indicator (when applicable)

**Issue list item must show:**
- Status icon (open/closed) with semantic color
- Title (truncated, single line)
- Issue number
- Labels as colored pills (max 2-3 visible, "+N" overflow)
- Assignee avatar or name
- Relative timestamp

**Recommendation:** Follow the exact pattern already established in `CommitHistory.tsx` -- a `Virtuoso` list with `button` elements, two-line layout, `truncate` on title, metadata row beneath. The list item component should accept a generic "metadata slot" and "trailing slot" so extensions can customize what appears.

### Pattern 3: List-to-Detail Navigation via Blade Push
**Source:** Existing FlowForge codebase (CommitHistory -> CommitDetailsBlade)
**Confidence:** HIGH (verified in codebase)

The existing pattern is already correct: clicking a list item calls `openBlade("ext:github:pr-detail", { owner, repo, number })` which pushes a new blade onto the stack. The previous list blade collapses to a `BladeStrip`. This matches the master/detail UX in VS Code (click PR in tree -> opens detail webview) and Tower (click PR in list -> shows detail pane).

**Critical UX detail:** Use the React `key` prop pattern on the detail blade component (keyed by PR/issue number) so that state resets cleanly when navigating between items, preventing stale data display.

**Recommendation:** Do NOT use `SplitPaneLayout` for PR/issue browsing. The blade stack already provides the master-detail metaphor perfectly -- the list blade is the master, the detail blade is the detail. SplitPaneLayout is appropriate for staging changes (where you want side-by-side preview), but for GitHub data the blade push is cleaner and matches how `CommitHistory` -> `CommitDetailsBlade` already works.

### Pattern 4: PR Detail Blade Information Hierarchy
**Source:** GitHub.com conversation tab, Tower PR view, GitKraken
**Confidence:** HIGH

The PR detail view should follow a clear top-to-bottom information hierarchy:

```
1. STATUS HEADER BAR
   [Open/Closed/Merged icon+badge]  #1234  "feat: add dark mode support"
   branch-name -> main   |  by @author  |  opened 3 days ago

2. CI / STATUS CHECKS SECTION (if present)
   [green] Build: passing     [green] Tests: passing
   [red]   Lint: failing      [yellow] Deploy: pending

3. SIDEBAR METADATA (right column or inline section)
   Reviewers: @alice (approved), @bob (pending)
   Labels: [bug] [priority:high]
   Milestone: v2.0

4. DESCRIPTION (markdown rendered)
   Full PR description rendered with MarkdownRenderer

5. COMMENTS TIMELINE
   Comment 1: @alice - 2 days ago
   [rendered markdown]
   ---
   Comment 2: @bob - 1 day ago
   [rendered markdown]
```

**Recommendation:** Structure the detail blade as a scrollable column with distinct sections separated by borders (`border-b border-ctp-surface0`), matching the pattern in `GitHubAccountBlade.tsx`. Use the existing `MarkdownRenderer` component for description and comment bodies. The status checks section should use colored dots (green/yellow/red) matching the `GitHubStatusButton.tsx` traffic-light pattern already in the codebase.

### Pattern 5: Issue Detail Blade (Simpler Variant)
**Source:** GitHub.com, VS Code
**Confidence:** HIGH

Issue detail is a simplified version of PR detail -- no CI checks, no merge target, no reviewers:

```
1. STATUS HEADER BAR
   [Open/Closed icon+badge]  #567  "Bug: crashes on startup"
   by @author  |  opened 5 days ago

2. METADATA SECTION
   Labels: [bug] [priority:high]
   Assignees: @alice, @bob
   Milestone: v2.0

3. DESCRIPTION (markdown rendered)

4. COMMENTS TIMELINE
```

**Recommendation:** Compose from the same section components used in PR detail. The header, metadata, description, and timeline sections should be reusable across both PR and issue detail blades.

## Extensibility-First Component Architecture

### Recommended Shared Component Hierarchy

The key insight for extensibility is that PR lists, issue lists, and future extension lists (GitLab MRs, Jira tickets, etc.) share the same UX skeleton. Build generic primitives, then compose.

```
src/components/extension-list/          # NEW: reusable list primitives
  ExtensionListLayout.tsx               # Filter bar + virtualized list container
  ExtensionListItem.tsx                 # Generic two-line list item with slots
  ExtensionListFilterBar.tsx            # State tabs + search input + filter popover
  ExtensionListSkeleton.tsx             # Skeleton for list loading state
  ExtensionListEmpty.tsx                # Empty state for filtered/unfiltered lists

src/components/extension-detail/        # NEW: reusable detail primitives
  DetailHeaderCard.tsx                  # Status badge + title + metadata row
  DetailSection.tsx                     # Collapsible/static section with title
  DetailTimeline.tsx                    # Chronological comment/event timeline
  DetailTimelineItem.tsx               # Single timeline entry (avatar + markdown + time)
  DetailMetadataRow.tsx                 # Key-value metadata (Labels:, Assignees:, etc.)
  StatusCheckList.tsx                   # CI/check status indicators

src/extensions/github/blades/          # GitHub-specific compositions
  GitHubPRListBlade.tsx                # Composes ExtensionListLayout
  GitHubPRDetailBlade.tsx              # Composes detail primitives
  GitHubIssueListBlade.tsx             # Composes ExtensionListLayout
  GitHubIssueDetailBlade.tsx           # Composes detail primitives
```

### Pattern: Generic List Item with Render Slots

Instead of building GitHub-specific list items, build a generic `ExtensionListItem` that accepts render slots:

```tsx
interface ExtensionListItemProps {
  /** Primary text (title) */
  title: string;
  /** Unique identifier displayed as badge (e.g., "#123") */
  identifier?: string;
  /** Status indicator (colored dot + label) */
  status?: { color: string; label: string };
  /** Leading icon or avatar */
  leading?: ReactNode;
  /** Trailing indicators (CI dots, avatars) */
  trailing?: ReactNode;
  /** Metadata line below title (author, timestamp, etc.) */
  metadata?: ReactNode;
  /** Tag pills (labels, categories) */
  tags?: Array<{ label: string; color?: string }>;
  /** Click handler */
  onClick: () => void;
  /** Whether this item is currently selected */
  isSelected?: boolean;
}
```

This component renders the two-line layout described in Pattern 2 but is completely agnostic to GitHub. A GitLab extension could use the same component with MR-specific metadata.

### Pattern: Generic Filter Bar with Extensible Filters

```tsx
interface FilterBarConfig {
  /** State/status tabs (e.g., Open/Closed/Merged) */
  stateTabs: Array<{ id: string; label: string; count?: number }>;
  /** Whether to show a search input */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Additional filter dropdowns */
  filters?: Array<{
    id: string;
    label: string;
    options: Array<{ value: string; label: string }>;
    multi?: boolean;
  }>;
}
```

The filter bar component follows the existing `CategoryFilter.tsx` pattern (horizontal scrolling `role="tablist"` with rounded pills) but adds an optional search input and filter popovers.

## Toolbar Action UX (TB-07)

### How Extension Toolbar Actions Should Appear

The existing `ToolbarAction` system with `when()` conditions is exactly right. For Phase 35, the GitHub extension should contribute two new toolbar actions:

| Action | Icon | Group | When Visible | Priority |
|--------|------|-------|-------------|----------|
| "Pull Requests" | `GitPullRequest` | `views` | `isAuthenticated && hasGitHubRemote` | 50 |
| "Issues" | `CircleDot` | `views` | `isAuthenticated && hasGitHubRemote` | 45 |

**Visual cues for extension vs core actions:**
- Use the same `ToolbarButton` styling as core actions -- NO visual distinction needed. The toolbar should feel unified. Users don't care whether a button is from core or an extension.
- The `when()` condition handles contextual visibility: these buttons only appear when the user is authenticated AND a GitHub remote is detected in the current repo.
- Priority values (50, 45) place them after core view actions but before app-level actions.

**Recommendation:** Do NOT add a separate "GitHub" submenu or group separator. PR/Issue buttons should appear inline with other view actions (topology, staging, etc.) in the `views` toolbar group. This normalizes GitHub features as first-class citizens rather than "add-ons."

### Discoverability When Not Authenticated

When the user is not authenticated, these toolbar buttons are hidden (via `when()` returning false). The existing `GitHubStatusButton` (always visible in the `app` group) serves as the entry point to authentication. After authenticating and detecting a remote, the PR/Issue buttons appear.

To improve discoverability, after successful authentication and remote detection, show a one-time toast: "GitHub connected: You can now browse Pull Requests and Issues from the toolbar."

## Filter and Search UX

### State Filter (Primary)

Use horizontal pill tabs matching `CategoryFilter.tsx`:

```
[Open (12)] [Closed (45)] [Merged (23)]    [Search icon] [Filter icon]
```

- Active tab gets `bg-ctp-blue/20 text-ctp-blue border-ctp-blue/30`
- Inactive tabs get `bg-ctp-surface0 text-ctp-subtext1 border-ctp-surface1`
- Show counts in parentheses when available (aids decision-making)
- Default: "Open" tab selected

### Search Input (Secondary)

Place a compact search input that slides open when the search icon is clicked, or always visible if space permits:

```
[magnifying glass icon] Search pull requests...    [x clear]
```

- Use existing input styling: `bg-ctp-surface0 border border-ctp-surface1 rounded`
- Search is client-side filtering of already-fetched results for immediate response
- Searches title text (case-insensitive substring match)
- Clear button appears when text is entered

### Advanced Filters (Tertiary)

Behind a filter icon button that opens a dropdown/popover:

- **Author:** Dropdown of unique authors from current results
- **Label:** Multi-select of available labels with colored dots
- **Assignee:** For issues only, dropdown of assignees
- **Reviewer:** For PRs only, dropdown of reviewers
- **Sort:** "Newest first" (default), "Oldest first", "Most commented", "Recently updated"

Active filters show as dismissible pills below the tab bar:

```
[Open (12)] [Closed (45)] [Merged (23)]    [Search] [Filter]
[x author:octocat] [x label:bug]          [Clear all]
```

**Recommendation for v1:** Implement only state tabs + search input. Label/author/assignee filters are v2 polish. The search covers 80% of filtering needs. This matches how CommitHistory works today (search + list, no advanced filters).

## Loading States and Empty States

### Loading State: Skeleton Loaders

**Recommendation:** Use skeleton loaders (NOT spinners) for list views. This matches the existing `CommitHistory.tsx` pattern which already uses `Skeleton` components to render 6 placeholder rows during initial load.

```tsx
// List skeleton: 6 rows matching list item structure
<div className="p-3 space-y-2">
  {Array.from({ length: 6 }).map((_, i) => (
    <div key={`skeleton-${i}`} className="flex items-start gap-2 px-3 py-2">
      <Skeleton className="w-4 h-4 rounded-full shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-12 h-3 shrink-0" />
    </div>
  ))}
</div>
```

**When skeleton vs spinner:**
- **List initial load:** Skeleton (multiple elements loading, shape preview is valuable)
- **Detail blade initial load:** Spinner via `BladeContentLoading` (single content area, skeleton layout is unknown before data arrives)
- **Filter change / tab switch:** Brief delay (300ms threshold), then spinner inline. Do NOT re-show skeletons for filter changes -- it causes layout thrashing
- **Load more (pagination):** Footer spinner (matches `CommitHistory.tsx` Virtuoso footer)
- **Background refresh:** No indicator unless it takes >2 seconds, then subtle inline spinner

### Empty States

Use the existing `EmptyState` component with context-appropriate messaging:

| Scenario | Icon | Title | Description | Action |
|----------|------|-------|-------------|--------|
| No PRs exist | `GitPullRequest` | "No pull requests" | "This repository has no open pull requests." | "View on GitHub" (opens browser) |
| No issues exist | `CircleDot` | "No issues" | "This repository has no open issues." | "View on GitHub" |
| Filter yields no results | `Search` | "No matching results" | "Try adjusting your filters or search terms." | "Clear filters" (resets) |
| No GitHub remote | `Github` | "No GitHub repository" | "This repository doesn't have a GitHub remote." | None |
| Not authenticated | `Github` | "Not signed in" | "Sign in to GitHub to browse pull requests and issues." | "Sign In" (opens auth blade) |

### Error States

Use `BladeContentError` for API failures with contextual messages:

| Error | Message | Detail | Retry? |
|-------|---------|--------|--------|
| Network error | "Failed to load pull requests" | "Check your internet connection and try again." | Yes |
| API rate limit | "GitHub API rate limit exceeded" | "Rate limit resets at {time}. You have {remaining} requests remaining." | Yes (with note about wait) |
| 404 / repo not found | "Repository not found" | "The repository {owner}/{repo} may have been deleted or made private." | No |
| Auth expired | "Authentication expired" | "Your GitHub token has expired. Please sign in again." | "Sign In" button instead of retry |

## Accessibility Considerations

### Keyboard Navigation

**List blade keyboard behavior** (following existing patterns in the codebase):

1. **Tab** into the filter bar, arrow keys between tabs (existing `role="tablist"` pattern)
2. **Tab** into the search input
3. **Tab** into the list area
4. **Arrow Up/Down** to navigate between list items (using roving tabindex, matching the toolbar pattern in `useRovingTabindex`)
5. **Enter** to open the selected item (pushes detail blade)
6. **Escape** while in search to clear search text, or while in list to return focus to filter bar

**Detail blade keyboard behavior:**

1. Back button is first focusable element (existing `BladePanel` `showBack` pattern)
2. **Tab** through interactive elements: external links, "Open on GitHub" button, etc.
3. **Escape** to go back (not implemented globally -- consider but may conflict with other uses)

### Screen Reader Announcements

Follow the existing `BladeContainer.tsx` pattern with `aria-live="polite"` regions:

```tsx
// When list data loads
<div aria-live="polite" className="sr-only">
  {`${filteredCount} pull requests, showing ${activeTab} items`}
</div>

// When filter changes
<div aria-live="polite" className="sr-only">
  {`Filter changed to ${activeTab}. ${filteredCount} results.`}
</div>
```

**List items should announce:**
- PR/Issue number and title
- Status (open/closed/merged)
- CI check status for PRs ("all checks passing" / "1 of 3 checks failing")

```tsx
<button
  aria-label={`Pull request #${pr.number}: ${pr.title}. ${pr.state}. ${ciSummary}.`}
  onClick={() => openDetail(pr.number)}
>
```

### Status Indicator Accessibility

CI status dots (colored circles) must have text alternatives:

```tsx
// BAD: color alone conveys meaning
<span className="w-2 h-2 rounded-full bg-ctp-green" />

// GOOD: includes screen reader text
<span className="w-2 h-2 rounded-full bg-ctp-green" aria-hidden="true" />
<span className="sr-only">All checks passing</span>
```

This pattern is already used correctly in `GitHubStatusButton.tsx` where `aria-hidden="true"` is applied to the colored dot and the full tooltip serves as `aria-label`.

### Focus Management

When pushing a detail blade from the list:
- Focus should move to the detail blade content (existing behavior from `BladeContainer` animation)
- Screen reader announces "Opened Pull Request #123: {title}" (existing `aria-live` pattern in `BladeContainer`)
- When popping back to list, focus should return to the previously selected list item (needs explicit implementation via `popToIndex` callback)

When returning to the list blade after viewing a detail:
- The previously selected item should have visual "last-visited" indicator (subtle background or left border, similar to `bg-ctp-blue/20` used for selected commits)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtualized list | Custom scroll handler | `react-virtuoso` (already in project) | Handles variable-height items, infinite scroll, footer |
| Markdown rendering | Custom parser | `MarkdownRenderer` (already exists) | Already handles GFM, code highlighting, images, links |
| Loading skeletons | Custom shimmer | `Skeleton` component (already exists) | Consistent animation, respects `prefers-reduced-motion` |
| Empty states | Custom placeholder | `EmptyState` component (already exists) | Consistent layout and action button pattern |
| Error states | Custom error display | `BladeContentError` (already exists) | Consistent error icon, message, retry button pattern |
| Relative timestamps | Custom date formatting | Existing `formatTimestamp` pattern from `CommitHistory` | Already handles minutes/hours/days/date fallback |
| Filter tabs | Custom toggle group | Existing `CategoryFilter.tsx` pattern | Already has correct ARIA, styling, hover states |

**Key insight:** FlowForge already has 90% of the UI primitives needed. The task is composition and extension-point design, not building from scratch.

## Common Pitfalls

### Pitfall 1: Non-Paginated API Calls
**What goes wrong:** Fetching all PRs/issues at once, causing slow initial load and wasted API quota
**Why it happens:** GitHub's REST API returns 30 items by default, but repos can have thousands
**How to avoid:** Use TanStack Query's `useInfiniteQuery` (already used in `CommitHistory.tsx`) with GitHub's `per_page` + `page` pagination. Fetch 30 items per page.
**Warning signs:** List takes >2 seconds to appear, rate limit warnings on large repos

### Pitfall 2: Over-Fetching on Filter Change
**What goes wrong:** Making new API calls for every tab switch (Open/Closed/Merged)
**Why it happens:** Treating each filter state as a separate query
**How to avoid:** Fetch open PRs by default. Only fetch closed/merged when the user switches to that tab (lazy fetch). Cache results per filter state with TanStack Query. Use `staleTime` of ~60 seconds so rapid tab switches don't re-fetch.
**Warning signs:** Loading spinner on every tab switch, rapid API consumption

### Pitfall 3: Layout Shift on Data Load
**What goes wrong:** Content jumps when skeleton is replaced by real data
**Why it happens:** Skeleton rows are a different height than real list items
**How to avoid:** Match skeleton item height exactly to real item height. Use the same padding, gap, and line heights. The `CommitHistory.tsx` skeleton pattern gets this right.
**Warning signs:** Visible jump/flash when data loads, scrollbar position changes

### Pitfall 4: Stale Detail View After Navigation
**What goes wrong:** Returning to a detail blade shows outdated data
**Why it happens:** Detail blade doesn't re-fetch when becoming visible again
**How to avoid:** Use TanStack Query's `staleTime` + automatic background refetch on window focus. The detail blade query should have a reasonable `staleTime` (30 seconds) so it refetches if the user navigates away and back.
**Warning signs:** Comments count doesn't update, CI status is stuck

### Pitfall 5: Missing Key Prop on Detail Blade
**What goes wrong:** Navigating from PR #1 detail to PR #2 detail shows PR #1 data briefly
**Why it happens:** React reuses the component instance, old state persists during new data fetch
**How to avoid:** Use `key={pr.number}` on the detail component (or the blade registration handles this via blade ID). The blade stack already uses unique IDs, so this should work, but verify.
**Warning signs:** Flash of old content when opening a different PR/issue

### Pitfall 6: Color-Only Status Indicators
**What goes wrong:** Colorblind users cannot distinguish CI pass/fail/pending
**Why it happens:** Using only green/yellow/red dots without icons or text
**How to avoid:** Pair each color with a distinct icon (check, clock, X) and/or shape. Include `aria-label` or `sr-only` text.
**Warning signs:** Accessibility audit failures, user reports of indistinguishable indicators

### Pitfall 7: GitHub-Specific Components in Shared Space
**What goes wrong:** Building list/detail components tightly coupled to GitHub API types
**Why it happens:** Fastest path is to hard-code GitHub response shapes into components
**How to avoid:** Define generic interfaces (`ExtensionListItemProps`, `FilterBarConfig`) that any extension can implement. GitHub-specific mapping happens in the extension, not the shared components.
**Warning signs:** Importing `github/*` types in `components/` directory

## Code Examples (Aligned to Existing Codebase Patterns)

### List Blade with Filter Tabs and Virtualized List

```tsx
// Pattern based on CommitHistory.tsx + CategoryFilter.tsx
// Source: existing codebase patterns

function PRListBlade() {
  const [activeTab, setActiveTab] = useState<"open" | "closed" | "merged">("open");
  const [search, setSearch] = useState("");
  const { openBlade } = useBladeNavigation();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["github", "prs", owner, repo, activeTab],
      queryFn: ({ pageParam = 1 }) => fetchPRs(owner, repo, activeTab, pageParam),
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length === 30 ? allPages.flat().length / 30 + 1 : undefined,
      initialPageParam: 1,
      staleTime: 60_000, // 60 seconds
    });

  const prs = data?.pages.flat() ?? [];
  const filtered = search
    ? prs.filter(pr => pr.title.toLowerCase().includes(search.toLowerCase()))
    : prs;

  return (
    <div className="flex flex-col h-full">
      {/* Screen reader announcement */}
      <div aria-live="polite" className="sr-only">
        {`${filtered.length} ${activeTab} pull requests`}
      </div>

      {/* Filter bar */}
      <div className="px-3 py-2 border-b border-ctp-surface0 space-y-2">
        <div className="flex gap-2" role="tablist" aria-label="Pull request status">
          {(["open", "closed", "merged"] as const).map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors capitalize",
                activeTab === tab
                  ? "bg-ctp-blue/20 text-ctp-blue border-ctp-blue/30"
                  : "bg-ctp-surface0 text-ctp-subtext1 border-ctp-surface1 hover:bg-ctp-surface1"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <CommitSearch value={search} onChange={setSearch} />
      </div>

      {/* List */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<GitPullRequest />} title="No pull requests" description="..." />
        ) : (
          <Virtuoso
            data={filtered}
            endReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
            itemContent={(_, pr) => (
              <PRListItem pr={pr} onClick={() => openBlade("ext:github:pr-detail", { number: pr.number })} />
            )}
            components={{
              Footer: () => isFetchingNextPage ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-ctp-subtext0" />
                </div>
              ) : null,
            }}
          />
        )}
      </div>
    </div>
  );
}
```

### PR List Item with Status and CI Indicators

```tsx
// Pattern based on CommitHistory list item styling
// Source: existing codebase patterns

function PRListItem({ pr, onClick }: { pr: PRSummary; onClick: () => void }) {
  const stateIcon = pr.state === "open"
    ? { icon: GitPullRequest, color: "text-ctp-green" }
    : pr.state === "merged"
    ? { icon: GitMerge, color: "text-ctp-mauve" }
    : { icon: GitPullRequestClosed, color: "text-ctp-red" };

  const Icon = stateIcon.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 cursor-pointer border-b border-ctp-surface0 hover:bg-ctp-surface0/50 transition-colors"
      aria-label={`Pull request #${pr.number}: ${pr.title}. ${pr.state}. ${pr.checksDescription}.`}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", stateIcon.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm text-ctp-text truncate flex-1">{pr.title}</p>
            {pr.draft && (
              <span className="text-[10px] px-1.5 py-0.5 bg-ctp-surface1 text-ctp-overlay0 rounded-full shrink-0">
                Draft
              </span>
            )}
            <CIStatusDot status={pr.checksStatus} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-ctp-overlay0">
            <span className="text-ctp-subtext0">#{pr.number}</span>
            <span>{pr.author}</span>
            <span>{formatTimestamp(pr.updatedAt)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
```

### CI Status Dot Component (Reusable)

```tsx
// Follows the traffic light pattern from GitHubStatusButton.tsx
// Source: existing codebase pattern

type ChecksStatus = "success" | "failure" | "pending" | "neutral" | "none";

function CIStatusDot({ status }: { status: ChecksStatus }) {
  if (status === "none") return null;

  const config: Record<ChecksStatus, { color: string; icon: LucideIcon; label: string }> = {
    success: { color: "bg-ctp-green", icon: Check, label: "All checks passing" },
    failure: { color: "bg-ctp-red", icon: X, label: "Checks failing" },
    pending: { color: "bg-ctp-yellow", icon: Clock, label: "Checks pending" },
    neutral: { color: "bg-ctp-overlay0", icon: Minus, label: "Checks neutral" },
    none: { color: "", icon: Minus, label: "" },
  };

  const { color, icon: StatusIcon, label } = config[status];

  return (
    <span className="relative shrink-0" title={label}>
      <StatusIcon className={cn("w-3.5 h-3.5", color.replace("bg-", "text-"))} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
```

### Detail Blade Header Card

```tsx
// Pattern based on CommitDetailsBlade metadata card
// Source: existing codebase pattern

function DetailHeaderCard({ pr }: { pr: PRDetail }) {
  return (
    <div className="px-6 py-4 border-b border-ctp-surface0">
      {/* Status + Title */}
      <div className="flex items-start gap-3">
        <PRStateIcon state={pr.state} className="w-5 h-5 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-medium text-ctp-text">{pr.title}</h2>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-ctp-overlay0">
            <span className="text-ctp-subtext0 font-medium">#{pr.number}</span>
            <span>{pr.head} -> {pr.base}</span>
            <span>by @{pr.author}</span>
            <span>{formatTimestamp(pr.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Spinner for all loading | Skeleton for lists, spinner for single items | 2023+ | Better perceived performance |
| Fixed filter dropdowns | Pill-based tabs + contextual popovers | 2024+ | Faster access to common filters |
| Separate extension UI areas | Extensions contribute to shared toolbar/views | VS Code model, 2022+ | Unified experience |
| Color-only status indicators | Icon + color + text for status | WCAG 2.2, 2023+ | Accessibility compliance |
| Custom list rendering | Virtualized lists (react-virtuoso) | 2021+ | Performance with large datasets |

## Open Questions

1. **Should PR and Issue lists be separate blades or tabs within one blade?**
   - What we know: VS Code uses separate tree view sections. GitKraken uses tabs ("PRs" / "Issues") within one view. Tower uses separate sections.
   - What's unclear: Which approach better fits the blade metaphor
   - Recommendation: Separate blades accessed via separate toolbar buttons. This is simpler to implement, keeps each blade focused, and aligns with how the codebase already separates concerns (staging blade, topology blade, etc.). Users will have dedicated "Pull Requests" and "Issues" toolbar buttons.

2. **How many PRs/issues should be fetched per page?**
   - What we know: GitHub API default is 30, max is 100 per page. CommitHistory uses PAGE_SIZE=50.
   - What's unclear: Optimal balance between initial load speed and API quota usage
   - Recommendation: Use 30 per page (GitHub default). This gives fast initial load and reasonable scroll depth before pagination triggers. At 30/page with 60s staleTime, a user browsing casually uses ~10-15 API calls per session.

3. **Should we show PR file changes in the detail blade?**
   - What we know: GitHub.com shows a "Files changed" tab. Tower shows changesets. VS Code shows file diffs inline.
   - What's unclear: Whether the existing `FileTreeBlade` component could be reused, or if this is scope creep for Phase 35
   - Recommendation: Defer file changes to a later phase. Phase 35 scope is "description, comments, and status checks." File diffs would require additional API calls and a diff viewer -- that is Phase 36+ territory.

4. **Label color rendering: how to handle arbitrary hex colors from GitHub?**
   - What we know: GitHub labels have arbitrary hex color codes. The Catppuccin theme uses its own palette.
   - What's unclear: Whether to use GitHub's label colors directly or map them to Catppuccin palette
   - Recommendation: Use GitHub's label colors directly for the label pill background (with `opacity: 0.2` for background, full color for text/border). This preserves the visual identity of labels that teams have already customized. Apply `rounded-full px-2 py-0.5 text-[10px]` styling consistent with existing badge patterns.

## Sources

### Primary (HIGH confidence)
- **FlowForge codebase** - Direct inspection of `BladeContainer`, `BladePanel`, `BladeContentLoading`, `BladeContentError`, `BladeContentEmpty`, `EmptyState`, `Skeleton`, `CommitHistory`, `CommitDetailsBlade`, `StagingChangesBlade`, `CategoryFilter`, `ToolbarRegistry`, `ExtensionAPI`, `GitHubStore`, `GitHubAuthBlade`, `GitHubAccountBlade`, `GitHubStatusButton`
- **W3C ARIA APG** - Keyboard interface practices (https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- **GitLab Pajamas Design System** - Skeleton loader guidelines (https://design.gitlab.com/components/skeleton-loader/)

### Secondary (MEDIUM confidence)
- **VS Code GitHub PR Extension** - UX patterns and query-based categories (https://code.visualstudio.com/docs/sourcecontrol/github)
- **GitKraken PR/Issue Interface** - Filter categories and detail view structure (https://help.gitkraken.com/gitkraken-desktop/pull-requests/)
- **Tower Git Client** - PR conversation view and list layout (https://www.git-tower.com/help/guides/pull-requests/working-with-prs/windows)
- **React Master/Detail Pattern** - Key prop pattern for clean state resets (https://seanconnolly.dev/react-master-detail-pattern)

### Tertiary (LOW confidence)
- **Filter UI best practices** - General filter design patterns (https://bricxlabs.com/blogs/universal-search-and-filters-ui)
- **Skeleton vs Spinner** - Loading state UX guidelines (https://medium.com/productboard-engineering/spinners-versus-skeletons-in-the-battle-of-hasting)

## Metadata

**Confidence breakdown:**
- List blade UX patterns: HIGH - Verified against 4+ competitive products and existing codebase patterns
- Detail blade information hierarchy: HIGH - Consistent across GitHub.com, GitKraken, Tower, VS Code
- Toolbar action UX: HIGH - Existing codebase pattern with `when()` conditions works perfectly
- Filter/search UX: HIGH - Well-established patterns in existing `CategoryFilter` and `CommitSearch`
- Extensibility architecture: MEDIUM - Component structure is sound but needs validation during implementation
- Accessibility patterns: HIGH - Based on W3C ARIA APG and existing codebase patterns
- Loading/empty/error states: HIGH - All primitive components already exist in codebase

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days - UX patterns are stable)
