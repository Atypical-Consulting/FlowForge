# Phase 23: Branch Management - Expert Developer Research

**Researched:** 2026-02-08
**Domain:** Tauri v2 / Rust git2 / React / Tailwind v4 implementation for branch management
**Confidence:** HIGH (verified against codebase + Context7 documentation)

## Summary

Phase 23 introduces branch management features (recent tracking, pinning, scope selector, bulk deletion, feature-branch coloring, and contextual clone) on top of an already well-structured codebase. The existing patterns are strong: `tauri-plugin-store` for persistence, `zustand` stores for state, `framer-motion` for animations, and `class-variance-authority` (CVA) for component variants. The key technical challenges are: (1) extracting checkout timestamps from git reflog on the Rust side, (2) implementing batch branch deletion with error aggregation, (3) building a keyboard-accessible segmented control, and (4) unifying two separate color mapping systems (branchClassifier.ts for the sidebar vs layoutUtils.ts for the topology graph).

A critical finding: the project already has a functional `navigationStore` with `recentBranchesPerRepo` and `pinnedRepoPaths` persisted via `tauri-plugin-store`. The BranchSwitcher already renders a "Recent" section. Phase 23 should extend these existing patterns rather than build new infrastructure.

**Primary recommendation:** Extend the existing Rust branch commands and React stores with new capabilities. Do NOT create parallel systems. Use the existing `navigationStore` as the persistence backbone, add a new Rust command for reflog-based recent branches, and build new UI components following the established CVA + framer-motion patterns.

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `git2` (Rust) | 0.20 | All Git operations: reflog, branch CRUD, merge-base checks | In Cargo.toml |
| `tauri-plugin-store` | ^2 | Persistent JSON storage for pins, preferences | In Cargo.toml + package.json |
| `zustand` | ^5 | React state management for branch/navigation stores | In package.json |
| `framer-motion` | ^12.31.0 | AnimatePresence, layout animations, list transitions | In package.json |
| `class-variance-authority` | ^0.7.1 | Component variant definitions (Button, Dialog, etc.) | In package.json |
| `lucide-react` | ^0.563 | Icon set (GitBranch, Pin, Trash2, Check, etc.) | In package.json |
| `chrono` (Rust) | 0.4 | Timestamp formatting (already a dependency) | In Cargo.toml |

### Supporting (Already Available)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tailwind-merge` | ^3.4.0 | Merge conflicting Tailwind classes | Used via `cn()` utility |
| `react-hotkeys-hook` | ^5.2.4 | Keyboard shortcut binding | For bulk-select shortcuts |
| `react-virtuoso` | ^4.18.1 | Virtualized lists | If branch list exceeds ~100 items |

### No New Dependencies Needed

All Phase 23 features can be built with existing dependencies. No new npm or cargo packages required.

## Architecture Patterns

### Recommended File Structure

```
src-tauri/src/git/
  branch.rs           # Extended: add batch_delete_branches, get_recent_checkouts
  graph.rs            # Modified: unify BranchType coloring

src/
  stores/
    branches.ts       # Extended: bulk delete, selection state
    navigation.ts     # Extended: pin branches (not just repos), timestamps
  lib/
    branchClassifier.ts  # Modified: change feature color to mauve/purple
  components/
    branches/
      BranchList.tsx        # Refactored: sections (Quick Access, Recent, All)
      BranchItem.tsx        # Extended: pin icon, checkbox, branch-type color
      BranchScopeSelector.tsx  # NEW: Local/Remote/Last Used segmented control
      BranchBulkActions.tsx    # NEW: bulk delete toolbar
      BranchQuickAccess.tsx    # NEW: pinned + recent collapsible sections
    ui/
      SegmentedControl.tsx  # NEW: reusable segmented control component
```

### Pattern 1: Reflog-Based Recent Branch Tracking (Rust/git2)

**What:** Parse HEAD reflog to extract checkout timestamps and branch names.
**When to use:** BRANCH-01 (recent branches with timestamps).
**Confidence:** HIGH - verified against git2 0.20 API via Context7.

The git2 `Reflog` API provides `ReflogEntry` objects with `.committer().when().seconds()` for timestamps and `.message()` for checkout context. Reflog entries for checkouts have messages like `"checkout: moving from main to feature/x"`.

```rust
// Source: git2 docs (Context7 /websites/docs_rs-git2)
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecentBranch {
    pub name: String,
    /// Unix timestamp in milliseconds (for JS Date compatibility)
    pub last_checkout_ms: f64,
}

/// Get recently checked-out branches by parsing HEAD reflog.
#[tauri::command]
#[specta::specta]
pub async fn get_recent_checkouts(
    limit: Option<usize>,
    state: State<'_, RepositoryState>,
) -> Result<Vec<RecentBranch>, GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;
    let max = limit.unwrap_or(10);

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let reflog = repo.reflog("HEAD")
            .map_err(|e| GitError::OperationFailed(e.message().to_string()))?;

        let mut seen = std::collections::HashSet::new();
        let mut recent = Vec::new();

        for entry in reflog.iter() {
            let msg = entry.message().unwrap_or("");
            // Reflog checkout messages: "checkout: moving from X to Y"
            if let Some(branch_name) = msg
                .strip_prefix("checkout: moving from ")
                .and_then(|rest| rest.rsplit(" to ").next())
            {
                if seen.insert(branch_name.to_string()) {
                    let timestamp_secs = entry.committer().when().seconds();
                    recent.push(RecentBranch {
                        name: branch_name.to_string(),
                        last_checkout_ms: (timestamp_secs as f64) * 1000.0,
                    });
                    if recent.len() >= max {
                        break;
                    }
                }
            }
        }

        Ok(recent)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

**Key insight:** The reflog message format is `"checkout: moving from <old_branch> to <new_branch>"`. We extract the target branch (after "to"). The `entry.committer().when().seconds()` gives epoch seconds. Multiply by 1000 for JS millisecond timestamps.

**Important edge cases:**
- Detached HEAD checkouts will have commit hashes instead of branch names -- filter these out
- The reflog has a finite size (default: 90 days / 1000 entries) -- adequate for recent branches
- Branches may have been deleted since checkout -- frontend should cross-reference with existing branches

### Pattern 2: Batch Branch Deletion with Error Aggregation (Rust/git2)

**What:** Delete multiple branches in a single Tauri command with per-branch error reporting.
**When to use:** BRANCH-04 (bulk delete merged branches).
**Confidence:** HIGH - git2 `Branch::delete()` is straightforward per Context7.

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BranchDeleteResult {
    pub name: String,
    pub deleted: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BatchDeleteResult {
    pub results: Vec<BranchDeleteResult>,
    pub total_deleted: u32,
    pub total_failed: u32,
}

/// Delete multiple branches in a batch. Continues on individual failures.
#[tauri::command]
#[specta::specta]
pub async fn batch_delete_branches(
    branch_names: Vec<String>,
    force: bool,
    state: State<'_, RepositoryState>,
) -> Result<BatchDeleteResult, GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let head_commit = repo.head()?.peel_to_commit()?;

        let mut results = Vec::with_capacity(branch_names.len());
        let mut total_deleted = 0u32;
        let mut total_failed = 0u32;

        for name in &branch_names {
            let result = (|| -> Result<(), GitError> {
                let mut branch = repo.find_branch(name, git2::BranchType::Local)
                    .map_err(|_| GitError::BranchNotFound(name.clone()))?;

                if branch.is_head() {
                    return Err(GitError::CannotDeleteCurrentBranch);
                }

                if !force {
                    let branch_commit = branch.get().peel_to_commit()?;
                    let merge_base = repo.merge_base(head_commit.id(), branch_commit.id())?;
                    if merge_base != branch_commit.id() {
                        return Err(GitError::BranchNotMerged(name.clone()));
                    }
                }

                branch.delete()?;
                Ok(())
            })();

            match result {
                Ok(()) => {
                    total_deleted += 1;
                    results.push(BranchDeleteResult {
                        name: name.clone(),
                        deleted: true,
                        error: None,
                    });
                }
                Err(e) => {
                    total_failed += 1;
                    results.push(BranchDeleteResult {
                        name: name.clone(),
                        deleted: false,
                        error: Some(e.to_string()),
                    });
                }
            }
        }

        Ok(BatchDeleteResult { results, total_deleted, total_failed })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

**Design decisions:**
- **No transaction rollback**: Git branch deletion is a simple ref delete; there is no transaction semantics in git2. Each deletion is independent. If branch 3 of 5 fails, branches 1-2 are already deleted, 4-5 still proceed. This is the expected git behavior.
- **Error aggregation**: Return per-branch success/failure so the UI can show exactly which branches failed and why.
- **Protected branch enforcement happens on the frontend** before sending the list (see Pattern 3). The Rust layer is a dumb executor; the React layer enforces policy.

### Pattern 3: Gitflow Branch Protection (Hybrid Rust + Frontend)

**What:** Identify branches that should never be bulk-deleted.
**When to use:** BRANCH-04 (Gitflow protection in bulk delete).
**Confidence:** HIGH - verified against existing `gitflow/init.rs` codebase.

The codebase already has `get_gitflow_config()` in `src-tauri/src/gitflow/init.rs` which reads Gitflow branch configuration from `.git/config`. This is the authoritative source for protected branch names.

**Approach: Configurable, not hardcoded.**

The Gitflow config already defines `main_branch` and `develop_branch` dynamically (could be "main", "master", "production", etc.). Protection logic should use this config, not hardcoded names.

```typescript
// Frontend: build protection set from gitflow status
function getProtectedBranches(gitflowConfig?: GitflowConfig): Set<string> {
  const protected = new Set<string>();
  // Always protect main/master patterns
  protected.add("main");
  protected.add("master");
  protected.add("develop");

  // If Gitflow is configured, also protect custom names
  if (gitflowConfig) {
    protected.add(gitflowConfig.mainBranch);
    protected.add(gitflowConfig.developBranch);
  }

  return protected;
}

// Filter branches before sending to batch_delete_branches
function filterDeletable(branches: BranchInfo[], protected: Set<string>): BranchInfo[] {
  return branches.filter(b =>
    !b.isHead &&              // Cannot delete HEAD
    b.isMerged &&             // Only merged branches
    !protected.has(b.name)    // Not protected
  );
}
```

**Why frontend enforcement:** The Rust backend already has safety checks (cannot delete HEAD, merge check). Adding a protection list to the Rust layer would require passing config down or duplicating it. Keeping the protection filter in React allows the UI to visually distinguish protected branches (lock icon, grayed out checkboxes) before the user even attempts deletion.

### Pattern 4: Persistent Storage for Branch Pins (tauri-plugin-store)

**What:** Store pinned branches per repository using the existing store infrastructure.
**When to use:** BRANCH-02 (pin/favorite branches).
**Confidence:** HIGH - the pattern is already established in `navigation.ts`.

The codebase already has a working persistence pattern in `src/stores/navigation.ts` with `pinnedRepoPaths` and `recentBranchesPerRepo`. Branch pinning follows the exact same pattern.

```typescript
// Extend navigationStore (src/stores/navigation.ts)
interface NavigationState {
  // ... existing fields ...
  pinnedBranchesPerRepo: Record<string, string[]>;

  // ... existing actions ...
  pinBranch: (repoPath: string, branchName: string) => Promise<void>;
  unpinBranch: (repoPath: string, branchName: string) => Promise<void>;
  getPinnedBranches: (repoPath: string) => string[];
}
```

The store key would be `"nav-pinned-branches"` stored in `flowforge-settings.json`. The `autoSave` feature with debounce is available (Context7 verified) but the existing code uses explicit `store.save()` after each write -- maintain this pattern for consistency.

**Note on store capabilities verified via Context7:**
- `Store.load('file.json', { defaults: {...}, autoSave: true })` -- supports default values and auto-save with 100ms debounce
- `LazyStore` -- defers loading until first access (potential optimization)
- `store.onKeyChange(key, callback)` -- reactive listeners for cross-component sync
- Current codebase uses `Store.load()` with explicit `.save()` calls -- keep this pattern

### Pattern 5: Segmented Control Component (CVA + Tailwind v4)

**What:** Reusable segmented control (tab-like selector) for Local/Remote/Last Used views.
**When to use:** BRANCH-03 (unified scope selector).
**Confidence:** HIGH - follows established CVA patterns in `button.tsx` and `dialog.tsx`.

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const segmentedControlVariants = cva(
  "inline-flex items-center rounded-lg bg-ctp-surface0 p-0.5",
  {
    variants: {
      size: {
        sm: "text-xs",
        default: "text-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const segmentVariants = cva(
  "relative px-3 py-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ctp-overlay0",
  {
    variants: {
      active: {
        true: "bg-ctp-surface1 text-ctp-text shadow-sm",
        false: "text-ctp-overlay1 hover:text-ctp-subtext0",
      },
    },
  }
);

interface SegmentedControlProps<T extends string>
  extends VariantProps<typeof segmentedControlVariants> {
  segments: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  size,
  className,
}: SegmentedControlProps<T>) {
  // Keyboard navigation: left/right arrows cycle through segments
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (index + 1) % segments.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (index - 1 + segments.length) % segments.length;
    }
    if (nextIndex !== index) {
      onChange(segments[nextIndex].value);
    }
  };

  return (
    <div
      role="tablist"
      className={cn(segmentedControlVariants({ size }), className)}
    >
      {segments.map((segment, i) => (
        <button
          key={segment.value}
          type="button"
          role="tab"
          aria-selected={value === segment.value}
          tabIndex={value === segment.value ? 0 : -1}
          onClick={() => onChange(segment.value)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className={segmentVariants({ active: value === segment.value })}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
```

**Accessibility (WCAG 2.1 AA):**
- Uses `role="tablist"` + `role="tab"` + `aria-selected`
- Roving tabindex: only active segment is focusable (`tabIndex={0}`), others are `tabIndex={-1}`
- Arrow keys cycle through segments (standard WAI-ARIA tabs pattern)
- Focus ring uses `focus-visible:ring-1 focus-visible:ring-ctp-overlay0` (matches existing pattern)

### Pattern 6: Multi-Select List with Shift-Click Range Select

**What:** Add checkbox selection to branch list without breaking existing click-to-checkout.
**When to use:** BRANCH-04 (multi-select for bulk delete).
**Confidence:** HIGH - standard React pattern.

```typescript
// Selection state hook
function useBranchSelection(branches: BranchInfo[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);

  const toggleSelect = useCallback((name: string, shiftKey: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);

      if (shiftKey && lastSelected) {
        // Range select: select all between lastSelected and name
        const names = branches.map(b => b.name);
        const start = names.indexOf(lastSelected);
        const end = names.indexOf(name);
        const [from, to] = start < end ? [start, end] : [end, start];
        for (let i = from; i <= to; i++) {
          next.add(names[i]);
        }
      } else {
        // Toggle individual
        if (next.has(name)) {
          next.delete(name);
        } else {
          next.add(name);
        }
      }

      return next;
    });
    setLastSelected(name);
  }, [branches, lastSelected]);

  const selectAll = useCallback((branchNames: string[]) => {
    setSelected(new Set(branchNames));
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setSelectionMode(false);
  }, []);

  return {
    selected,
    selectionMode,
    setSelectionMode,
    toggleSelect,
    selectAll,
    clearSelection,
  };
}
```

**Critical UX decision:** Selection mode is separate from normal mode. In normal mode, clicking a branch triggers checkout (existing behavior). In selection mode (entered via toolbar button or Ctrl+Click), clicking toggles selection. This prevents accidental checkouts when trying to multi-select.

### Pattern 7: Branch Type Color Token Unification

**What:** Change feature branch color from green to purple/mauve, and unify the two separate color mapping systems.
**When to use:** BRANCH-05 (feature branch tags in purple).
**Confidence:** HIGH - direct codebase analysis.

**Current state -- TWO separate color systems exist:**

1. **`src/lib/branchClassifier.ts`** -- Used by Gitflow cheatsheet sidebar
   - `BRANCH_TYPE_COLORS`: CSS variable values (`var(--catppuccin-color-green)` for feature)
   - `BRANCH_TYPE_TW`: Tailwind class names (`ctp-green` for feature)

2. **`src/components/topology/layoutUtils.ts`** -- Used by topology graph
   - `BRANCH_HEX_COLORS`: Raw hex colors (`#cba6f7` for feature -- already mauve!)
   - `BRANCH_BADGE_STYLES`: Tailwind classes (`border-ctp-mauve` for feature -- already mauve!)
   - `BRANCH_RING_COLORS`: Tailwind ring classes (`ring-ctp-mauve` for feature -- already mauve!)

**Key finding:** The topology graph already uses mauve/purple for feature branches! Only the branchClassifier (sidebar) still uses green. This means the change is minimal:

```typescript
// branchClassifier.ts -- CHANGE ONLY THESE TWO MAPS:
export const BRANCH_TYPE_COLORS: Record<GitflowBranchType, string> = {
  main: "var(--catppuccin-color-red)",
  develop: "var(--catppuccin-color-blue)",
  feature: "var(--catppuccin-color-mauve)",  // was: green
  release: "var(--catppuccin-color-peach)",
  hotfix: "var(--catppuccin-color-mauve)",    // CONFLICT: hotfix was also mauve!
  other: "var(--catppuccin-color-overlay1)",
};

export const BRANCH_TYPE_TW: Record<GitflowBranchType, string> = {
  main: "ctp-red",
  develop: "ctp-blue",
  feature: "ctp-mauve",   // was: ctp-green
  release: "ctp-peach",
  hotfix: "ctp-mauve",    // CONFLICT
  other: "ctp-overlay1",
};
```

**Color conflict resolution:** Both the topology `BRANCH_HEX_COLORS` and the requirement say feature = purple. But in the topology, hotfix = `#f38ba8` (red), while in branchClassifier, hotfix = mauve. The topology colors are correct and should be the authority. Proposed unified mapping:

| Branch Type | Catppuccin Color | Hex (Mocha) | Tailwind Class |
|-------------|-----------------|-------------|----------------|
| main        | red             | #f38ba8     | ctp-red        |
| develop     | blue            | #89b4fa     | ctp-blue       |
| feature     | mauve (purple)  | #cba6f7     | ctp-mauve      |
| release     | peach (orange)  | #fab387     | ctp-peach      |
| hotfix      | red             | #f38ba8     | ctp-red        |
| other       | overlay1 (gray) | #6c7086     | ctp-overlay1   |

**Wait -- hotfix and main are both red.** Looking at topology `BRANCH_HEX_COLORS`, main = `#89b4fa` (blue), develop = `#a6e3a1` (green). This is DIFFERENT from branchClassifier where main = red, develop = blue. The two systems are completely inconsistent!

**Recommended resolution for Phase 23:** Create a single source of truth:

```typescript
// src/lib/branchColors.ts -- NEW single source of truth
import type { BranchType } from "../bindings";

export const BRANCH_COLORS: Record<BranchType, {
  hex: string;          // For SVG rendering
  cssVar: string;       // For dynamic inline styles
  twText: string;       // For Tailwind text-* classes
  twBg: string;         // For Tailwind bg-* classes
  twBorder: string;     // For Tailwind border-* classes
  twRing: string;       // For Tailwind ring-* classes
}> = {
  main:    { hex: "#f38ba8", cssVar: "var(--catppuccin-color-red)",      twText: "text-ctp-red",      twBg: "bg-ctp-red",      twBorder: "border-ctp-red",      twRing: "ring-ctp-red" },
  develop: { hex: "#89b4fa", cssVar: "var(--catppuccin-color-blue)",     twText: "text-ctp-blue",     twBg: "bg-ctp-blue",     twBorder: "border-ctp-blue",     twRing: "ring-ctp-blue" },
  feature: { hex: "#cba6f7", cssVar: "var(--catppuccin-color-mauve)",    twText: "text-ctp-mauve",    twBg: "bg-ctp-mauve",    twBorder: "border-ctp-mauve",    twRing: "ring-ctp-mauve" },
  release: { hex: "#fab387", cssVar: "var(--catppuccin-color-peach)",    twText: "text-ctp-peach",    twBg: "bg-ctp-peach",    twBorder: "border-ctp-peach",    twRing: "ring-ctp-peach" },
  hotfix:  { hex: "#eba0ac", cssVar: "var(--catppuccin-color-maroon)",   twText: "text-ctp-maroon",   twBg: "bg-ctp-maroon",   twBorder: "border-ctp-maroon",   twRing: "ring-ctp-maroon" },
  other:   { hex: "#6c7086", cssVar: "var(--catppuccin-color-overlay1)", twText: "text-ctp-overlay1", twBg: "bg-ctp-overlay1", twBorder: "border-ctp-overlay1", twRing: "ring-ctp-overlay1" },
};
```

Then both `branchClassifier.ts` and `layoutUtils.ts` import from this single source.

### Pattern 8: Collapsible Sections with framer-motion

**What:** Animated collapsible sections for "Quick Access" (pinned) and "Recent" branch sections.
**When to use:** BRANCH-01 and BRANCH-02 (Quick Access / Recent sections in branch list).
**Confidence:** HIGH - framer-motion layout animations verified via Context7 (motion.dev docs).

```typescript
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ctp-overlay0 uppercase tracking-wider hover:text-ctp-subtext0 transition-colors"
        aria-expanded={isOpen}
      >
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight className="w-3 h-3" />
        </motion.span>
        {title}
        {count !== undefined && (
          <span className="text-ctp-overlay0 font-normal">({count})</span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Critical detail:** `height: "auto"` animation is supported by framer-motion (verified via Context7 motion.dev docs). The `overflow: "hidden"` on the container prevents content from leaking during collapse. Use `initial={false}` on AnimatePresence to prevent animation on first render when `defaultOpen={true}`.

### Anti-Patterns to Avoid

- **Duplicating branch type color definitions.** Currently two separate systems exist (branchClassifier.ts and layoutUtils.ts). DO NOT add a third. Unify into a single source of truth first.
- **Storing recent branches client-side only.** The frontend `navigationStore` already tracks recent branches, but it relies on the user calling `addRecentBranch` manually. The reflog-based Rust command is more reliable because it catches checkouts from CLI, other tools, etc.
- **Making protected branch logic configurable in a settings UI.** Gitflow config already defines protected branches. Don't create a separate configuration surface. Read the Gitflow config.
- **Using `git2::BranchType::Local` filter then re-opening the repo for each deletion in batch mode.** Open the repo once, iterate over deletions. The current codebase pattern already does this correctly (see `list_all_branches` opening once).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recent branch tracking | Custom timestamp storage | Git reflog parsing | Reflog captures ALL checkouts (CLI, GUI, other tools), not just app-mediated ones |
| Persistent preferences | Custom JSON file I/O | `tauri-plugin-store` | Already integrated, handles atomic writes, supports reactive listeners |
| Segmented control | Custom div+onClick styling | CVA-based component with WAI-ARIA tabs pattern | Accessibility, keyboard nav, consistent with existing codebase patterns |
| Animated list enter/exit | CSS animations with classList | framer-motion `AnimatePresence` | Already in the project, handles mount/unmount lifecycle that CSS cannot |
| Color token system | Manual hex/class lookups per-component | Centralized color record indexed by BranchType | Prevents the current divergence between sidebar and topology colors |

## Common Pitfalls

### Pitfall 1: Reflog Message Format Fragility

**What goes wrong:** Reflog messages like `"checkout: moving from main to feature/x"` are not part of the git specification. They are a convention of the git CLI.
**Why it happens:** The git2 library (libgit2) produces the same format, but edge cases exist: detached HEAD checkouts produce messages with commit hashes, not branch names; initial clone produces no checkout entry.
**How to avoid:** Always validate that the extracted branch name is a valid branch name (not a hex hash) and cross-reference against existing branches. Use `git2::Branch::name_is_valid()` or check against known branches.
**Warning signs:** "Recent branches" showing commit hashes or branch names that no longer exist.

### Pitfall 2: Checkbox Selection vs Click-to-Checkout Conflict

**What goes wrong:** Adding checkboxes to branch items creates ambiguity. Does clicking the row toggle selection or trigger checkout?
**Why it happens:** Two interaction modes sharing the same UI surface.
**How to avoid:** Use an explicit "Selection Mode" toggle. In normal mode, clicking a branch checks it out (existing behavior). In selection mode, clicking toggles the checkbox. The selection mode is entered via a toolbar button or via Ctrl+Click as a shortcut.
**Warning signs:** Users accidentally checking out branches when trying to select for bulk delete, or vice versa.

### Pitfall 3: Color System Divergence

**What goes wrong:** The branchClassifier uses different colors than the topology graph for the same branch types. Feature branches appear green in the sidebar but purple in the graph.
**Why it happens:** Two independent color mapping systems were created at different times with different color assignments.
**How to avoid:** Create a single `branchColors.ts` module that both systems import from. Delete the duplicate constants from `branchClassifier.ts` and `layoutUtils.ts`.
**Warning signs:** A branch appearing as one color in the sidebar and a different color in the topology view.

### Pitfall 4: Batch Delete with No Confirmation

**What goes wrong:** User accidentally deletes branches they intended to keep.
**Why it happens:** Bulk operations are destructive and irreversible (git reflog can recover, but only via CLI).
**How to avoid:** Always show a confirmation dialog listing exactly which branches will be deleted. Show protected branches as non-selectable. Require explicit confirmation text or checkbox for unmerged branches.
**Warning signs:** Support requests about accidentally deleted branches.

### Pitfall 5: Store Persistence Race Conditions

**What goes wrong:** Multiple rapid pin/unpin operations can result in stale data being written.
**Why it happens:** The existing pattern reads state, modifies, then writes. Two concurrent async operations can read the same initial state.
**How to avoid:** The existing `zustand` store serializes state mutations through `set`. As long as `set` is called before `await store.save()`, the in-memory state is always up-to-date. The save to disk is best-effort. Keep the existing pattern of `set({...})` then `await store.save()`.
**Warning signs:** Pinned branches disappearing after rapid pin/unpin toggling.

## Code Examples

### Example 1: Extending BranchInfo with Branch Type (Rust)

The current `BranchInfo` struct does not include branch type classification. Adding it enables frontend components to show color-coded branch types without re-classifying on the client side.

```rust
// In src-tauri/src/git/branch.rs
use crate::git::graph::{BranchType, classify_branch};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub last_commit_oid: String,
    pub last_commit_message: String,
    pub is_merged: Option<bool>,
    pub is_remote: bool,
    pub remote_name: Option<String>,
    // NEW: Branch type for color coding
    pub branch_type: BranchType,
}

// In the list_branches function, when creating BranchInfo:
branches.push(BranchInfo {
    name: name.clone(),
    is_head,
    last_commit_oid,
    last_commit_message,
    is_merged,
    is_remote: false,
    remote_name: None,
    branch_type: classify_branch(&name),
});
```

### Example 2: Branch Pin Toggle with Optimistic UI

```typescript
// In a BranchItem component
function PinButton({ repoPath, branchName }: { repoPath: string; branchName: string }) {
  const { getPinnedBranches, pinBranch, unpinBranch } = useNavigationStore();
  const isPinned = getPinnedBranches(repoPath).includes(branchName);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger row click (checkout)
    if (isPinned) {
      await unpinBranch(repoPath, branchName);
    } else {
      await pinBranch(repoPath, branchName);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "p-1 rounded transition-colors",
        isPinned
          ? "text-ctp-yellow hover:text-ctp-yellow/80"
          : "text-ctp-overlay0 hover:text-ctp-subtext0 opacity-0 group-hover:opacity-100"
      )}
      title={isPinned ? "Unpin branch" : "Pin branch"}
      aria-label={isPinned ? `Unpin ${branchName}` : `Pin ${branchName}`}
    >
      <Pin className={cn("w-3.5 h-3.5", isPinned && "fill-current")} />
    </button>
  );
}
```

### Example 3: Scope Selector Usage

```typescript
type BranchScope = "local" | "remote" | "recent";

function BranchPanel() {
  const [scope, setScope] = useState<BranchScope>("local");

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-ctp-surface0">
        <SegmentedControl
          segments={[
            { value: "local", label: "Local" },
            { value: "remote", label: "Remote" },
            { value: "recent", label: "Recent" },
          ]}
          value={scope}
          onChange={setScope}
          size="sm"
        />
      </div>
      {/* Branch list filtered by scope */}
    </div>
  );
}
```

### Example 4: Registering New Tauri Commands

```rust
// In src-tauri/src/lib.rs, add to collect_commands![]
// Branch commands
list_branches,
create_branch,
checkout_branch,
delete_branch,
list_all_branches,
checkout_remote_branch,
batch_delete_branches,    // NEW
get_recent_checkouts,     // NEW
```

After adding, the `tauri-specta` auto-generates TypeScript bindings in `src/bindings.ts` on next dev build.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` (standalone) | `motion` (from `motion/react`) | framer-motion v11+ | Import path changed; FlowForge still uses `framer-motion` import -- works but could be modernized |
| `Store.load()` manual save | `LazyStore` with autoSave | tauri-plugin-store v2 | Could simplify persistence code; current explicit save pattern is also fine |
| Two color systems | Should be one | Phase 23 | Reduces bugs, enables consistent feature-branch purple |

**Deprecated/outdated:**
- `framer-motion` package name: The library is now officially called `motion` with import from `motion/react`. However, the `framer-motion` package still works and re-exports everything. FlowForge uses `framer-motion@^12.31.0` which is the latest. No action needed, but new imports could use `motion/react` for forward compatibility.

## Open Questions

1. **Feature vs Hotfix color distinction**
   - What we know: The requirement says "feature branches should be purple". Currently topology uses mauve for feature (correct) and red for hotfix. But branchClassifier uses mauve for hotfix and green for feature.
   - What's unclear: Should hotfix be red (matching topology) or maroon (to distinguish from main which is also red in the unified proposal)?
   - Recommendation: Use maroon (`#eba0ac`, `ctp-maroon`) for hotfix and red for main. This gives all 6 types distinct colors. Verify with the design intent.

2. **Clone button scope**
   - What we know: BRANCH-06 requires a "contextual clone button" but details are sparse.
   - What's unclear: Clone from where? Is this "clone from remote branch URL" or "copy branch name to clipboard" or "create worktree from branch"?
   - Recommendation: Defer detailed research until requirement is clarified. The codebase already has `clone_repository` command in Rust.

3. **Branch list performance at scale**
   - What we know: `react-virtuoso` is already a dependency for virtualized lists.
   - What's unclear: At what branch count does the current non-virtualized list become slow? Typical repos have <50 branches; monorepos can have thousands.
   - Recommendation: Start non-virtualized (current approach). Add virtualization only if profiling shows degradation beyond 100 branches.

## Sources

### Primary (HIGH confidence)
- `/websites/docs_rs-git2` (Context7) -- git2 Reflog, ReflogEntry, Signature, Time, Branch APIs
- `/tauri-apps/plugins-workspace` (Context7) -- tauri-plugin-store Store/LazyStore APIs, listeners
- `/websites/motion_dev` (Context7) -- framer-motion AnimatePresence, layout animations, height:auto
- Codebase analysis:
  - `/Users/phmatray/.../src-tauri/src/git/branch.rs` -- Current branch commands
  - `/Users/phmatray/.../src-tauri/src/git/graph.rs` -- BranchType enum, classify_branch, color maps
  - `/Users/phmatray/.../src-tauri/src/git/undo.rs` -- Existing reflog parsing pattern
  - `/Users/phmatray/.../src-tauri/src/gitflow/init.rs` -- GitflowConfig, protected branches
  - `/Users/phmatray/.../src/stores/navigation.ts` -- Existing persistence pattern
  - `/Users/phmatray/.../src/stores/branches.ts` -- Existing branch store
  - `/Users/phmatray/.../src/lib/branchClassifier.ts` -- Color system 1
  - `/Users/phmatray/.../src/components/topology/layoutUtils.ts` -- Color system 2
  - `/Users/phmatray/.../src/components/navigation/BranchSwitcher.tsx` -- Existing recent branches UI
  - `/Users/phmatray/.../src/components/ui/button.tsx` -- CVA pattern reference
  - `/Users/phmatray/.../src/lib/animations.ts` -- framer-motion variant patterns

### Secondary (MEDIUM confidence)
- Git reflog message format convention -- consistent across git CLI and libgit2, but not formally specified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in the project, verified versions
- Architecture patterns: HIGH -- Direct extension of existing patterns with verified APIs
- Pitfalls: HIGH -- Identified from codebase analysis (color divergence is real, visible in code)
- Rust/git2 API: HIGH -- All APIs verified via Context7 docs.rs documentation
- React/motion patterns: HIGH -- Verified via Context7 motion.dev docs + existing codebase usage

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days -- stack is stable, no fast-moving dependencies)
