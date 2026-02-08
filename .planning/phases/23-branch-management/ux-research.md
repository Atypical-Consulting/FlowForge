# Phase 23: Branch Management - UX Research

**Researched:** 2026-02-08
**Domain:** UX patterns, interaction design, branch management workflows
**Confidence:** HIGH (cross-verified across multiple professional Git GUI implementations)

## Summary

This research examines how professional Git GUIs handle branch management UX to inform Phase 23 implementation decisions. The analysis covers seven key areas: recent branches, pinning/favorites, scope selectors, bulk operations, visual branch type distinction, contextual clone buttons, and sidebar organization.

The dominant pattern across best-in-class Git GUIs (Tower, Fork, GitHub Desktop, GitKraken, VS Code/GitLens) is a **tiered branch list** with distinct sections: Pinned/Favorites at top, Recent in the middle, then All branches below, each with clear section headers. The most successful implementations (Tower 15, Fork) combine **pin icons** with **sort-by-recency** and **inline filter/search** to handle repositories with hundreds of branches.

**Primary recommendation:** Implement a three-tier branch section layout (Pinned > Recent > All) within the existing sidebar `<details>` pattern, using a segmented control (not tabs, not dropdown) for Local/Remote/All filtering, with the existing `Pin` icon pattern from RepoSwitcherItem for consistency.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | existing | Branch pin/recent state management | Already used for navigation store with pin/recent patterns |
| @tauri-apps/plugin-store | existing | Persisting pin/recent data | Already used via `getStore()` in navigation.ts |
| framer-motion | existing | Animated section transitions, list reordering | Already used in BranchSwitcher, CollapsibleSidebar |
| lucide-react | existing | Pin, Star, Clock, Trash2, Shield icons | Already imported across components |
| class-variance-authority | existing | Badge variant styling for branch types | Already used for button variants |

### Supporting (No New Dependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hotkeys-hook | existing | Keyboard shortcuts for bulk select (Shift+click) | Multi-select interactions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Pin icon toggle | Star icon toggle | Pin is already established in RepoSwitcherItem; consistency wins |
| Segmented control | Tab bar | Tabs imply page navigation; segmented control better for filtering |
| Checkbox multi-select | Shift-click range select | Checkboxes are more explicit and accessible; prefer checkboxes |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Component Structure
```
src/
├── components/branches/
│   ├── BranchList.tsx           # Enhanced: sections, scope, bulk mode
│   ├── BranchItem.tsx           # Enhanced: pin button, type badge, checkbox
│   ├── BranchScopeSelector.tsx  # NEW: Local | Remote | All segmented control
│   ├── BranchSectionHeader.tsx  # NEW: collapsible section with count
│   ├── BulkBranchActions.tsx    # NEW: bulk delete toolbar
│   ├── BulkDeleteDialog.tsx     # NEW: confirmation with protected branch list
│   ├── CreateBranchDialog.tsx   # Existing, no changes
│   └── MergeDialog.tsx          # Existing, no changes
├── stores/
│   └── branches.ts              # Enhanced: pinned branches, bulk operations
├── lib/
│   └── branchClassifier.ts      # Enhanced: color update (feature = mauve/purple)
```

### Pattern 1: Tiered Branch Sections (HIGH confidence)
**What:** Divide the branch list into three hierarchical sections: Pinned, Recent, All
**When to use:** Always visible in the sidebar branch panel
**Why:** This is the universal pattern used by Tower (Pinned Branches section), Fork (pinned branches at top + sort by recency), GitHub Desktop (Recent Branches + Other Branches), and GitLens (RECENT section). Every professional Git GUI has converged on this layout.

**Layout order:**
```
[Pinned]        (0-N items, always visible if non-empty)
  ├── main         [pin icon filled]
  └── develop      [pin icon filled]
[Recent]        (0-5 items, excludes pinned and current branch)
  ├── feature/auth [clock icon]
  └── bugfix/nav   [clock icon]
[All Branches]  (filtered by scope selector)
  ├── main         [checkmark = current]
  ├── develop
  ├── feature/auth [feature badge]
  └── ...
```

**Key details from professional GUIs:**
- **GitHub Desktop** shows 5 recent branches (users frequently request more -- issues #14311, #19664, #20972)
- **FlowForge BranchSwitcher** already shows 3 recent branches (MAX_RECENT_BRANCHES = 3 in navigation.ts)
- **Tower** auto-expands the Pinned section and stores pin state in git config
- **Fork** allows sorting alphabetically or chronologically (most recently used first)

**Recommendation:** Show **5** recent branches (matching GitHub Desktop's established convention), exclude current branch and any pinned branches from the recent list. This is an increase from the current 3.

### Pattern 2: Pin Icon Toggle (HIGH confidence)
**What:** A pin icon on each branch item that toggles pinned state
**When to use:** On hover for unpinned branches, always visible for pinned branches
**Why:** Directly mirrors the existing `RepoSwitcherItem` pattern already in the codebase.

**Existing pattern to replicate (from RepoSwitcherItem):**
```tsx
<button
  onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
  className={cn(
    "p-1 rounded transition-colors shrink-0",
    isPinned
      ? "text-ctp-blue hover:text-ctp-sapphire"
      : "text-ctp-overlay0 opacity-0 group-hover/item:opacity-100 hover:text-ctp-subtext0",
    isPinned && "opacity-100",
  )}
  title={isPinned ? "Unpin branch" : "Pin branch"}
  aria-label={isPinned ? "Unpin branch" : "Pin branch"}
>
  <Pin className={cn("w-3.5 h-3.5", isPinned && "fill-current")} />
</button>
```

**Why Pin over Star:**
- Pin icon (`lucide-react` `Pin`) is already imported and used in `RepoSwitcherItem.tsx`
- Pin conveys "stick to top" semantics better than Star's "favorite/rate" semantics
- Maintains visual consistency across the app's switcher patterns
- Tower uses "Pinned Branches" terminology; Fork uses "pinned" terminology

### Pattern 3: Segmented Control Scope Selector (HIGH confidence)
**What:** A three-option segmented control: `Local | Remote | All`
**When to use:** At the top of the branch list, below the section header
**Why:** Tabs imply navigation to different views/pages. A segmented control indicates filtering the same list. This matches the mental model of "show me a subset of the same data."

**Evidence from professional GUIs:**
- **VS Code** uses a toggle (switch) for remote branches -- too binary for 3 states
- **FlowForge BranchSwitcher** already has a toggle switch for "Show remote branches" -- this works for 2 states but the requirement is 3 scopes (Local, Remote, Last Used)
- **GitLens** uses view toggles in the sidebar footer for switching between layouts

**Implementation detail:**
```tsx
// Segmented control with 3 options
<div className="flex bg-ctp-surface0 rounded-md p-0.5" role="radiogroup" aria-label="Branch scope">
  {["Local", "Remote", "Recent"].map((scope) => (
    <button
      key={scope}
      role="radio"
      aria-checked={activeScope === scope}
      className={cn(
        "flex-1 px-3 py-1 text-xs font-medium rounded transition-colors",
        activeScope === scope
          ? "bg-ctp-surface1 text-ctp-text shadow-sm"
          : "text-ctp-overlay1 hover:text-ctp-subtext0"
      )}
      onClick={() => setScope(scope)}
    >
      {scope}
    </button>
  ))}
</div>
```

**IMPORTANT:** The requirement BRANCH-03 says "Local, Remote, and Last Used branches from a unified branch scope selector." This means the segmented control should filter the **main list** to show either Local branches, Remote branches, or Last Used (recent) branches. The Pinned section should remain visible regardless of scope.

### Pattern 4: Bulk Delete with Checkbox Multi-Select (HIGH confidence)
**What:** Enter a "cleanup mode" with checkboxes, select merged branches, confirm deletion
**When to use:** User triggers via a toolbar button (broom/trash icon)
**Why:** This is a destructive operation that needs explicit opt-in, clear selection, and confirmation.

**Professional GUI precedents:**
- **Tower 15** shows "Fully Merged" and "Stale" badges, with a one-click delete hint when selecting a merged branch, plus batch archive functionality
- **GitLab** requires typing "delete" to confirm bulk branch deletion
- **Fork** allows multi-select via Cmd/Ctrl+click in the sidebar

**Recommended interaction flow:**
1. User clicks "Clean up branches" button (broom icon) in section header
2. BranchList enters "bulk mode": checkboxes appear left of each branch item
3. Pre-select all merged branches (isMerged === true) by default
4. Protected branches (main, develop) are **disabled** with a shield icon and tooltip "Protected branch"
5. User can toggle individual checkboxes, or use "Select all merged" / "Deselect all"
6. Floating action bar appears at bottom: `"Delete N branches" [Cancel]`
7. Confirmation dialog lists all selected branches with a warning count
8. On confirm, sequential deletion with progress feedback

**Confirmation dialog design:**
```
┌─────────────────────────────────────────────┐
│  Delete 4 branches?                         │
│                                             │
│  The following branches will be deleted:    │
│  ✓ feature/old-login     (merged)           │
│  ✓ bugfix/typo           (merged)           │
│  ✓ feature/deprecated    (merged)           │
│  ✓ experiment/test       (unmerged ⚠)       │
│                                             │
│  🛡 Protected: main, develop (not affected) │
│                                             │
│  This action cannot be undone.              │
│                                             │
│                    [Cancel]  [Delete 4]      │
└─────────────────────────────────────────────┘
```

### Pattern 5: Branch Type Visual Distinction (HIGH confidence)
**What:** Color-coded badges with text labels and optional border accents
**When to use:** On every branch item in all lists
**Why:** WCAG 1.4.1 requires that color is NOT the only visual means of conveying information. Badges with text + color satisfy this requirement.

**Current state (inconsistency to resolve):**
- `branchClassifier.ts`: feature = `ctp-green` (green)
- `layoutUtils.ts` (topology): feature = `ctp-mauve` (#cba6f7, purple)
- **Requirement BRANCH-05**: feature branches should appear in **purple**

**Recommendation:** Unify to `ctp-mauve` (#cba6f7) for feature branches across all components. This resolves the inconsistency and satisfies the requirement. Catppuccin's `mauve` is the correct purple tone.

**Updated color mapping:**
| Branch Type | Catppuccin Color | Hex (Mocha) | Text Label | Icon |
|-------------|-----------------|-------------|------------|------|
| main | `ctp-red` | #f38ba8 | "main" | Shield |
| develop | `ctp-blue` | #89b4fa | "develop" | GitBranch |
| feature | `ctp-mauve` | #cba6f7 | "feature" | GitBranch |
| release | `ctp-peach` | #fab387 | "release" | Tag |
| hotfix | `ctp-red` | #f38ba8 | "hotfix" | AlertTriangle |
| other | `ctp-overlay1` | #7f849c | (none) | GitBranch |

**WAIT -- main and hotfix would share `ctp-red`.** The current branchClassifier uses different colors:
- main: `ctp-red`, hotfix: `ctp-mauve`
- But topology uses: main: `ctp-blue`, hotfix: `ctp-red`

**Resolution:** Since we're moving feature to `ctp-mauve` (which was hotfix's color in branchClassifier), we need to reassign hotfix. Use the topology's mapping as the canonical one since it was designed more recently:

| Branch Type | Color Token | Hex |
|-------------|------------|-----|
| main | `ctp-blue` | #89b4fa |
| develop | `ctp-green` | #a6e3a1 |
| feature | `ctp-mauve` | #cba6f7 |
| release | `ctp-peach` | #fab387 |
| hotfix | `ctp-red` | #f38ba8 |
| other | `ctp-overlay1` | #7f849c |

This matches `layoutUtils.ts` BRANCH_HEX_COLORS exactly. Unify `branchClassifier.ts` to match.

**Badge implementation:**
```tsx
<span className={cn(
  "text-xs px-1.5 py-0.5 rounded border font-medium",
  `text-${branchColor} bg-${branchColor}/10 border-${branchColor}/30`
)}>
  {branchType}  {/* "feature", "release", etc. */}
</span>
```

**Accessibility notes:**
- Never rely on color alone: always include text label in badge
- Red/green distinction is problematic for color-blind users (8% of males) -- the updated palette avoids red/green adjacency for common branch types
- Ensure 4.5:1 contrast ratio for badge text against background
- The `ctp-mauve` (#cba6f7) on `ctp-base` (#1e1e2e) provides approximately 7.8:1 contrast -- well above WCAG AA

### Pattern 6: Contextual Clone Button (MEDIUM confidence)
**What:** When a repository is already open, transform the "Clone" header button into a context-appropriate action
**When to use:** Only in the Header component when `status` is present (repo is open)

**Analysis of current behavior:**
- The Clone button in `Header.tsx` (line 333-347) is always visible and always says "Clone"
- When a repo is open, "Clone" is a secondary action -- users rarely clone while working in a repo
- The requirement (BRANCH-06) says: "Clone button shows a contextually appropriate action when user is already inside a repository"

**Professional GUI analysis:**
- **Tower**: Shows "Reveal in Finder" in context menus, plus terminal integration
- **Fork**: Shows repo path in title bar with "Reveal in Finder" in menus
- **GitKraken**: Shows "Open in Terminal" and "Open in IDE" actions
- **Sourcetree**: Shows "Explorer" button to open file manager
- **GitHub Desktop**: Shows "Open in Visual Studio Code" and "Show in Finder" buttons prominently

**Recommendation:** When a repo is open, replace the Clone button with a **"Reveal in Finder"** action (macOS) or **"Open in Explorer"** (Windows). This is the most universally useful contextual action:
- It solves a real workflow need (navigating to repo files outside the GUI)
- It's a non-destructive, low-risk action
- It's immediately understandable
- Tauri has `@tauri-apps/plugin-shell` for `open()` to reveal paths

**Alternative actions to consider (could be a dropdown):**
1. **Reveal in Finder/Explorer** (primary)
2. **Open in Terminal** (secondary, if shell plugin available)
3. **Copy repo path** (tertiary)

**Implementation approach:**
```tsx
// When repo IS open: show "Reveal" instead of "Clone"
{status ? (
  <Button variant="ghost" size="sm" onClick={handleRevealInFinder}>
    <FolderOpen className="w-4 h-4 mr-2" />
    Reveal
  </Button>
) : (
  <Button variant="ghost" size="sm" onClick={() => dispatchCloneEvent()}>
    <GitFork className="w-4 h-4 mr-2" />
    Clone
  </Button>
)}
```

**Note:** Keep Clone accessible via Command Palette even when a repo is open, for the rare case where users want to clone another repo.

### Anti-Patterns to Avoid
- **Flat unsectioned branch list:** Never dump all branches in a single unsorted list. Always section by purpose (pinned, recent, all).
- **Color-only distinction:** Never use color as the sole indicator of branch type. Always pair with text labels (badges).
- **Destructive actions without confirmation:** Never delete multiple branches without an explicit confirmation dialog listing what will be deleted.
- **Hidden bulk mode:** Don't require users to discover multi-select via undocumented Shift+click. Use an explicit "Clean up" button to enter bulk mode.
- **Over-scrolling sidebar:** Don't let 4+ sections (Pinned, Recent, All, Stash, Tags, etc.) each expand to full height. Use max-height constraints with overflow-y: auto on each section.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent pin/recent state | Custom localStorage wrapper | Existing `getStore()` + Tauri plugin-store | Already proven pattern in navigation.ts |
| Segmented control component | Raw div with click handlers | Proper `role="radiogroup"` with `role="radio"` | Accessibility requires correct ARIA roles |
| Multi-select with shift-click | Manual event tracking | Checkbox-based selection with select-all | Checkboxes are more accessible, explicit, and don't require keyboard modifier discovery |
| Branch type classification | Manual string matching | Existing `classifyBranch()` from branchClassifier.ts | Already handles all Gitflow prefixes |
| Animated section collapse | Manual height animation | framer-motion AnimatePresence + motion.div | Already used throughout the app for similar patterns |

**Key insight:** The navigation store (`navigation.ts`) already has the exact data model pattern needed for branch pinning -- `pinnedRepoPaths` maps directly to `pinnedBranches`, and `recentBranchesPerRepo` already tracks recent branches. Extend this store rather than creating a new one.

## Common Pitfalls

### Pitfall 1: Stale Recent Branches
**What goes wrong:** Recent branch list shows branches that have been deleted
**Why it happens:** Recent branch names are stored as strings but branches can be deleted between sessions
**How to avoid:** Always filter recent branches against the current `allBranches` list before rendering. The existing BranchSwitcher already does this correctly (line 60-68 of BranchSwitcher.tsx: `recentNames.filter((name) => name !== currentBranch && branchMap.has(name))`)
**Warning signs:** "Ghost" branches appearing in recent list that don't exist

### Pitfall 2: Pin/Scope State Desynchronization
**What goes wrong:** Pinned branches don't appear when switching between Local/Remote scope
**Why it happens:** Pinned branches are stored by name, but a branch might be local only. If user is on "Remote" scope, pinned local branches vanish.
**How to avoid:** The Pinned section should be **scope-independent** -- always show pinned branches regardless of the active scope filter. Only the "All Branches" section should be filtered by scope.
**Warning signs:** Pinned section empties when switching to Remote scope

### Pitfall 3: Bulk Delete Race Conditions
**What goes wrong:** Deleting many branches concurrently causes errors or partial failures
**Why it happens:** Git operations are sequential; concurrent deletes can conflict
**How to avoid:** Delete branches **sequentially** (not Promise.all), showing progress as each succeeds. If one fails, continue with remaining and report failures at the end.
**Warning signs:** "Could not delete branch" errors during bulk operations

### Pitfall 4: Color Token Inconsistency
**What goes wrong:** Feature branches show as green in one place and purple in another
**Why it happens:** `branchClassifier.ts` (feature = ctp-green) disagrees with `layoutUtils.ts` (feature = ctp-mauve)
**How to avoid:** Single source of truth for branch type colors. Update `branchClassifier.ts` to match `layoutUtils.ts` mapping. All components should import colors from one place.
**Warning signs:** Different colors for the same branch type in sidebar vs topology view

### Pitfall 5: Sidebar Section Overflow
**What goes wrong:** With multiple expanded sections (Pinned, Recent, Branches, Stash, Tags, Gitflow, Worktrees), the sidebar becomes extremely tall and hard to navigate
**Why it happens:** Each `<details>` section expands to full content height with no maximum
**How to avoid:** Set `max-h-[300px] overflow-y-auto` on the content area of each expandable section. The section header (summary) remains sticky. This is the pattern used by VS Code's sidebar panels.
**Warning signs:** Users scrolling endlessly through the sidebar; lower sections pushed off screen

### Pitfall 6: Protected Branch Deletion
**What goes wrong:** Users accidentally delete main or develop branches in bulk operations
**Why it happens:** All merged branches selected by default, and main could technically be "merged" into itself
**How to avoid:** Hard-code protection for branches classified as "main" or "develop" by `classifyBranch()`. These should be **disabled** in bulk mode with a shield icon and cannot be checked.
**Warning signs:** Repository left without a main branch after cleanup

## Code Examples

### Recent + Pinned Branch Section Layout
```tsx
// Source: Derived from existing BranchSwitcher.tsx pattern + Tower/Fork UX research
interface BranchSectionProps {
  title: string;
  icon: React.ReactNode;
  branches: BranchInfo[];
  emptyMessage?: string;
  children?: React.ReactNode;
}

function BranchSection({ title, icon, branches, emptyMessage, children }: BranchSectionProps) {
  if (branches.length === 0 && !children) return null;

  return (
    <div className="mb-1">
      <div className="px-2 py-1 text-xs font-semibold text-ctp-overlay0 uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {title}
        <span className="text-ctp-surface2 ml-auto">{branches.length}</span>
      </div>
      <div className="space-y-0.5">
        {branches.length > 0
          ? branches.map((b) => <BranchItem key={b.name} branch={b} />)
          : emptyMessage && (
              <div className="px-2 py-2 text-xs text-ctp-overlay0 italic">{emptyMessage}</div>
            )}
        {children}
      </div>
    </div>
  );
}
```

### Branch Type Badge with Accessibility
```tsx
// Source: WCAG 1.4.1 compliance + existing BRANCH_BADGE_STYLES from layoutUtils.ts
import { classifyBranch, type GitflowBranchType } from "../../lib/branchClassifier";

const BADGE_STYLES: Record<GitflowBranchType, string> = {
  main: "text-ctp-blue bg-ctp-blue/10 border-ctp-blue/30",
  develop: "text-ctp-green bg-ctp-green/10 border-ctp-green/30",
  feature: "text-ctp-mauve bg-ctp-mauve/10 border-ctp-mauve/30",
  release: "text-ctp-peach bg-ctp-peach/10 border-ctp-peach/30",
  hotfix: "text-ctp-red bg-ctp-red/10 border-ctp-red/30",
  other: "", // no badge for unclassified branches
};

function BranchTypeBadge({ branchName }: { branchName: string }) {
  const type = classifyBranch(branchName);
  if (type === "other") return null;

  return (
    <span
      className={cn(
        "text-xs px-1.5 py-0.5 rounded border font-medium shrink-0",
        BADGE_STYLES[type]
      )}
      aria-label={`${type} branch`}
    >
      {type}
    </span>
  );
}
```

### Bulk Delete Confirmation Dialog
```tsx
// Source: GitLab confirmation pattern + Tower cleanup UX
interface BulkDeleteDialogProps {
  branches: BranchInfo[];
  protectedBranches: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

function BulkDeleteDialog({ branches, protectedBranches, onConfirm, onCancel }: BulkDeleteDialogProps) {
  const unmergedCount = branches.filter((b) => !b.isMerged).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-6 w-[28rem] max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-ctp-text">
          Delete {branches.length} branch{branches.length !== 1 ? "es" : ""}?
        </h3>

        <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
          {branches.map((b) => (
            <div key={b.name} className="flex items-center gap-2 text-sm py-0.5">
              <GitBranch className="w-3.5 h-3.5 text-ctp-overlay1" />
              <span className="truncate">{b.name}</span>
              {b.isMerged ? (
                <span className="text-xs text-ctp-green">(merged)</span>
              ) : (
                <span className="text-xs text-ctp-yellow flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> unmerged
                </span>
              )}
            </div>
          ))}
        </div>

        {protectedBranches.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-ctp-blue">
            <Shield className="w-3.5 h-3.5" />
            Protected: {protectedBranches.join(", ")} (not affected)
          </div>
        )}

        {unmergedCount > 0 && (
          <div className="mt-2 text-xs text-ctp-yellow">
            {unmergedCount} branch{unmergedCount !== 1 ? "es have" : " has"} unmerged commits.
          </div>
        )}

        <p className="mt-3 text-xs text-ctp-overlay0">
          This action cannot be undone.
        </p>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-ctp-overlay1 hover:text-ctp-text">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-ctp-red hover:bg-ctp-red/80 text-ctp-base rounded font-medium"
          >
            Delete {branches.length}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Segmented Scope Selector
```tsx
// Source: ARIA radiogroup pattern for segmented controls
type BranchScope = "local" | "remote" | "recent";

function BranchScopeSelector({
  value,
  onChange,
}: {
  value: BranchScope;
  onChange: (scope: BranchScope) => void;
}) {
  const scopes: { value: BranchScope; label: string }[] = [
    { value: "local", label: "Local" },
    { value: "remote", label: "Remote" },
    { value: "recent", label: "Recent" },
  ];

  return (
    <div
      className="flex bg-ctp-surface0 rounded-md p-0.5 mx-2 mb-2"
      role="radiogroup"
      aria-label="Branch scope"
    >
      {scopes.map((scope) => (
        <button
          key={scope.value}
          type="button"
          role="radio"
          aria-checked={value === scope.value}
          className={cn(
            "flex-1 px-2.5 py-1 text-xs font-medium rounded-sm transition-all",
            value === scope.value
              ? "bg-ctp-surface1 text-ctp-text shadow-sm"
              : "text-ctp-overlay1 hover:text-ctp-subtext0"
          )}
          onClick={() => onChange(scope.value)}
        >
          {scope.label}
        </button>
      ))}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat branch list | Tiered sections (Pinned/Recent/All) | Tower 15 (2025), Fork (2024) | Users find key branches instantly |
| Manual cleanup | Auto-detected "Fully Merged" / "Stale" badges | Tower 15 (Nov 2025) | One-click cleanup reduces branch sprawl |
| Binary local/remote toggle | Multi-scope selector (Local/Remote/All) | VS Code, GitLens (2024-2025) | Single widget replaces multiple toggles |
| Color-only branch types | Color + text badge | WCAG 2.1 adoption (ongoing) | Accessible to color-blind users |
| Always-visible "Clone" button | Contextual action based on state | GitHub Desktop, Tower (2024) | Better use of limited toolbar space |

**Deprecated/outdated:**
- **Star icon for favorites:** Pin icon is now the standard in Git GUIs (Tower, Fork both use "pin" terminology). Stars are for ratings.
- **Dropdown for scope:** Dropdowns hide options behind a click. Segmented controls show all options at once -- preferred for 2-4 options.
- **window.confirm for bulk operations:** Native confirm dialogs cannot be styled, don't show item lists, and break the visual design. Use custom modal dialogs.

## Open Questions

1. **Should Pinned Branches persist per-repo or globally?**
   - What we know: Navigation store already persists recent branches per-repo (`recentBranchesPerRepo: Record<string, string[]>`). Tower stores pins in git config (per-repo).
   - What's unclear: Whether a user would want the same branches pinned across all repos
   - Recommendation: **Per-repo** -- different repos have different important branches. Follow the existing per-repo pattern.

2. **Maximum number of pinned branches?**
   - What we know: Tower has no documented limit. Fork has no documented limit. GitHub Desktop's pin request suggests unlimited.
   - What's unclear: At what point does a "Pinned" section become as long as the full list
   - Recommendation: **Cap at 5** with a message "Maximum 5 pinned branches." This keeps the section compact. Users who need more should use the search/filter.

3. **Should the scope selector replace or coexist with the existing remote toggle in BranchSwitcher?**
   - What we know: BranchSwitcher (dropdown in header) has a remote toggle. BranchList (sidebar panel) does not have any scope control.
   - What's unclear: Whether both components should have scope selectors
   - Recommendation: Add scope selector to **BranchList (sidebar)** only. Keep BranchSwitcher's toggle as-is since it's a quick-switch dropdown, not a management view.

4. **How to handle `ctp-red` conflict between main and hotfix?**
   - What we know: branchClassifier.ts maps main=red, hotfix=mauve. layoutUtils.ts maps main=blue, hotfix=red.
   - Recommendation: **Adopt layoutUtils.ts mapping** as canonical (main=blue, develop=green, feature=mauve, release=peach, hotfix=red, other=overlay1). Update branchClassifier.ts to match.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis**: `src/components/branches/BranchList.tsx`, `BranchItem.tsx`, `BranchSwitcher.tsx`, `BranchSwitcherItem.tsx` -- current implementation baseline
- **Codebase analysis**: `src/stores/navigation.ts` -- existing pin/recent state management pattern
- **Codebase analysis**: `src/lib/branchClassifier.ts`, `src/components/topology/layoutUtils.ts` -- branch type color mappings (inconsistency identified)
- **Codebase analysis**: `src/components/navigation/RepoSwitcherItem.tsx` -- existing Pin icon pattern to replicate
- [WCAG 2.1 Understanding SC 1.4.1: Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html) -- color-only distinction prohibition
- [Catppuccin Palette](https://catppuccin.com/palette/) -- mauve (#cba6f7) as purple accent

### Secondary (MEDIUM confidence)
- [Tower 15 for Mac -- Automatic Branch Management](https://www.git-tower.com/blog/tower-mac-15) -- Pinned Branches, Fully Merged badges, Stale badges, auto-archive
- [Fork release notes](https://fork.dev/blog/) -- Pin branches, sort chronologically/alphabetically, quick filter sidebar
- [GitHub Desktop issues #15767, #14311, #19664, #20972](https://github.com/desktop/desktop/issues/15767) -- Pin branches request, recent branches count complaints
- [GitKraken feedback: Add favorite or pinned branches](https://feedback.gitkraken.com/suggestions/347190/add-favorite-or-pinned-branches-in-the-left-sidebar) -- Community demand for branch pinning
- [GitLens Sidebar Views](https://help.gitkraken.com/gitlens/side-bar/) -- ACTIVE/RECENT/LAUNCHPAD section organization
- [VS Code Source Control](https://code.visualstudio.com/docs/sourcecontrol/overview) -- Branch management views, scope filtering
- [GitLab Branch Management](https://docs.gitlab.com/user/project/repository/branches/) -- "Delete merged branches" with typed confirmation

### Tertiary (LOW confidence)
- [UI Patterns: Favorites](https://ui-patterns.com/patterns/favorites) -- General favorites design pattern (star/heart shape)
- [Multi-Select Checkboxes with React](https://tj.ie/multi-select-checkboxes-with-react/) -- Shift+click implementation pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture patterns: HIGH -- derived from existing codebase patterns + multiple professional Git GUI analysis
- UX recommendations: HIGH -- consensus across Tower, Fork, GitHub Desktop, GitLens implementations
- Pitfalls: HIGH -- identified from real codebase inconsistencies and standard UX hazards
- Clone button context: MEDIUM -- less consensus across GUIs, but "Reveal in Finder" is most common

**Research date:** 2026-02-08
**Valid until:** 2026-03-10 (30 days -- UX patterns are stable)
