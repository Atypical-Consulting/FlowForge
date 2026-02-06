# Phase 15: Topology - Research

**Researched:** 2026-02-06
**Domain:** Git topology visualization, blade-based layout, diff viewing, graph rendering
**Confidence:** HIGH

## Summary

This phase rewrites the topology visualization from the current React Flow + dagre implementation to an Ungit-style commit graph with Gitflow semantic lane colors, replaces the fixed 3-panel layout with a blade-based navigation model (Azure Portal pattern), adds full commit details with file tree and diff viewing, and fixes the topology auto-refresh tech debt.

The existing codebase already has a working topology with React Flow (@xyflow/react v12), dagre-d3-es for layout, and a Zustand topology store with pagination. The current DiffViewer uses Monaco Editor's DiffEditor component with a custom Catppuccin theme. The key challenge is the architectural shift from the 3-panel `ResizablePanelLayout` to a blade-based process navigation model, while simultaneously upgrading the graph visual style and adding historical commit diff support.

**Primary recommendation:** Keep React Flow for the topology graph (it already handles pan/zoom/virtual rendering well), restyle commit nodes to Ungit-style rounded-rectangle badges, replace the 3-panel layout with a blade container using framer-motion `AnimatePresence` for slide-in transitions, and add a new Tauri `get_commit_file_diff` command for historical diffs reusing the existing Monaco DiffEditor.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Gitflow semantic lane colors: main=blue, develop=green, feature=purple, release=orange, hotfix=red
- Ungit-style commit badges: rounded rectangles showing conventional commit type icon + commit subject
- Branch labels in a fixed column header row above the graph (not inline on lanes)
- Top-to-bottom flow: newest commits at top, scroll down for history
- Straight angled merge lines between branches (not curved Bezier)
- Colored lane columns: each Gitflow lane has a faint background tint matching its semantic color
- Replace current 3-panel layout with a blade navigation model
- Left sidebar stays fixed (branches, stashes, tags)
- Main area uses blades -- panels that slide in from the right
- Two root blade processes: Staging (changes -> stage -> commit) and Topology (graph -> commit -> diff)
- Process entry points in header bar with icon + text labels (scalable for future processes)
- When a new blade opens, previous blade compresses to a narrow strip (title + back arrow)
- Commit details blade: author, date, full SHA, commit message, parent SHAs
- File tree of changed files with change type indicators (added/modified/deleted)
- Togglable between directory tree view and flat list view (matching existing Changes panel UX)
- Per-file stats with GitHub-style colored bars (+/- insertion/deletion counts)
- Unified diff by default with toggle to switch to side-by-side
- Full syntax highlighting for code files
- File navigation driven by the commit details blade -- select file in tree, diff blade opens
- Changed hunks shown by default with expandable context
- Scroll + zoom on the topology graph (wheel/pinch zoom)
- Keyboard shortcuts: arrow keys to move between commits, Enter to open details, Escape to close blade, J/K for scroll
- Topology auto-refreshes after commits (fixes v1.0 tech debt)

### Claude's Discretion
- Rendering technology (SVG vs Canvas vs HTML/CSS)
- Exact commit badge sizing and typography
- Zoom level range and default
- Blade transition animations and timing
- Syntax highlighting library choice
- How to handle very long commit histories (virtualization approach)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/react | ^12.10.0 | Graph rendering with pan/zoom/virtual viewport | Already in use, handles commit DAG well, custom nodes/edges |
| dagre-d3-es | ^7.0.14 | Hierarchical DAG layout | Already in use, produces TB layout for topology |
| @monaco-editor/react | ^4.7.0 | Diff viewing with syntax highlighting | Already in use with custom Catppuccin theme |
| framer-motion | ^12.31.0 | Blade slide-in/out animations | Already in use for FadeIn, AnimatedList, edge animations |
| react-virtuoso | ^4.18.1 | Virtualized scrolling for long lists | Already in use in CommitHistory |
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcuts | Already in use for global shortcuts |
| zustand | ^5 | State management for blade/process navigation | Already in use for all stores |
| lucide-react | ^0.563 | Conventional commit type icons on badges | Already in use, TYPE_ICONS map exists |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | ^0.7.1 | Variant-based styling for badges/blades | Badge style variants per branch type |
| react-resizable-panels | ^4.6.0 | Resizable blade widths (optional) | Could enhance blade UX, already imported |
| @tanstack/react-query | ^5 | Data fetching for commit details/diffs | Already used for commitDetails, stagingStatus |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Flow | Custom SVG rendering | More control over Ungit-style, but loses pan/zoom/virtual viewport for free; not worth rebuilding |
| React Flow | HTML/CSS grid for lanes | Simpler for column-based layout, but loses interactive graph features (zoom, pan, selection) |
| Monaco DiffEditor | react-diff-viewer-continued | Lighter weight, but Monaco is already loaded and has superior syntax highlighting |
| dagre | elkjs | Better layout quality for complex graphs, but heavier (~200KB) and dagre works fine |

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    blades/                    # NEW - Blade navigation system
      BladeContainer.tsx       # Manages blade stack with AnimatePresence
      BladePanel.tsx           # Individual blade wrapper (slide-in animation)
      BladeStrip.tsx           # Compressed blade (narrow strip with title + back arrow)
      ProcessNavigation.tsx    # Header bar process entry points
    topology/                  # REWORK existing topology
      TopologyGraph.tsx        # Graph canvas (replaces TopologyPanel.tsx)
      CommitBadge.tsx          # Ungit-style rounded rect badge (replaces CommitNode.tsx)
      BranchEdge.tsx           # Straight angled merge lines (replaces CommitEdge.tsx)
      LaneHeader.tsx           # Fixed column header row with branch labels
      LaneBackground.tsx       # Colored lane background tints
      layoutUtils.ts           # REWORK - lane-based layout with fixed columns
    commit/
      CommitDetailsBlade.tsx   # NEW - Full commit details as a blade
      FileTreeBlade.tsx        # NEW - File tree with tree/flat toggle
      DiffBlade.tsx            # NEW - Diff viewer as a blade
    staging/
      StagingBlade.tsx         # REWORK - Staging panel as blade chain
  stores/
    blades.ts                  # NEW - Blade stack state management
    topology.ts                # REWORK - Add auto-refresh, color mapping
  hooks/
    useCommitGraph.ts          # REWORK - Add auto-refresh after commits
    useBladeNavigation.ts      # NEW - Blade open/close/compress logic
```

### Pattern 1: Blade Navigation Stack
**What:** A stack-based navigation model where each action pushes a new blade panel from the right, compressing previous blades to narrow strips.
**When to use:** Any drill-down navigation (graph -> commit -> file -> diff)

```typescript
// stores/blades.ts
interface Blade {
  id: string;
  type: 'staging-changes' | 'staging-commit' | 'topology-graph' | 'topology-commit' | 'topology-diff';
  title: string;
  props: Record<string, unknown>;
}

interface BladeState {
  activeProcess: 'staging' | 'topology';
  bladeStack: Blade[];
  
  // Actions
  setProcess: (process: 'staging' | 'topology') => void;
  pushBlade: (blade: Blade) => void;
  popBlade: () => void;
  popToIndex: (index: number) => void;
  resetStack: () => void;
}
```

```typescript
// components/blades/BladeContainer.tsx
import { AnimatePresence, motion } from "framer-motion";

export function BladeContainer({ blades }: { blades: Blade[] }) {
  return (
    <div className="flex h-full overflow-hidden">
      <AnimatePresence mode="popLayout">
        {blades.map((blade, index) => {
          const isLast = index === blades.length - 1;
          return isLast ? (
            <motion.div
              key={blade.id}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex-1 min-w-0"
            >
              <BladePanel blade={blade} />
            </motion.div>
          ) : (
            <BladeStrip
              key={blade.id}
              blade={blade}
              onExpand={() => popToIndex(index)}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

### Pattern 2: Gitflow Semantic Lane Colors (UPDATED)
**What:** The locked decision changes the color mapping from the current implementation.
**Current vs New mapping:**

| Branch Type | Current Color | New Color (Locked) | Catppuccin Token |
|-------------|---------------|---------------------|------------------|
| main | ctp-peach (orange) | blue | ctp-blue |
| develop | ctp-green | green | ctp-green |
| feature | ctp-blue | purple | ctp-mauve |
| release | ctp-mauve (purple) | orange | ctp-peach |
| hotfix | ctp-red | red | ctp-red |
| other | ctp-overlay0 | gray | ctp-overlay0 |

This is essentially swapping main<->release and feature<->release from the current mapping. The Catppuccin palette mappings:
- blue -> `ctp-blue` (#89b4fa)
- green -> `ctp-green` (#a6e3a1)  
- purple -> `ctp-mauve` (#cba6f7)
- orange -> `ctp-peach` (#fab387)
- red -> `ctp-red` (#f38ba8)

### Pattern 3: Ungit-Style Commit Badges with Straight Edges
**What:** Replace the current card-style CommitNode with a compact rounded-rectangle badge showing conventional commit type icon + subject text. Edges use straight angled lines instead of smooth step paths.

```typescript
// Commit badge: ~180px wide, ~36px tall
// [icon] feat: add login page    abc1234
// Rounded corners, colored border matching lane, subtle fill
// Conventional commit type parsed from message subject

function parseCommitType(message: string): CommitType | null {
  const match = message.match(/^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+?\))?(!)?:/);
  return match ? match[1] as CommitType : null;
}
```

For edges, replace `getSmoothStepPath` with custom SVG path that creates straight angled lines:
```typescript
// Straight angled merge line: vertical down from source, horizontal to target column, vertical down to target
function getAngledPath(sourceX, sourceY, targetX, targetY) {
  const midY = sourceY + (targetY - sourceY) * 0.5;
  if (sourceX === targetX) {
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }
  return `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
}
```

### Pattern 4: Topology Auto-Refresh After Commits
**What:** The existing `repository-changed` event listener in App.tsx invalidates `commitHistory` queries but does NOT refresh the topology graph. This is the v1.0 tech debt to fix.

```typescript
// In App.tsx, the existing listener:
listen<{ paths: string[] }>("repository-changed", (event) => {
  queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
  queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
  queryClient.invalidateQueries({ queryKey: ["repositoryStatus"] });
  loadUndoInfo();
  // MISSING: topology refresh - need to add:
  // topologyStore.getState().loadGraph();
});
```

The fix involves calling `useTopologyStore.getState().loadGraph()` inside the repository-changed event handler. This should be debounced to avoid rapid refreshes during batch operations.

### Anti-Patterns to Avoid
- **Don't rebuild pan/zoom/viewport from scratch:** React Flow already handles this with virtual rendering. Customizing nodes/edges within React Flow is far simpler than reimplementing these features.
- **Don't use Canvas for the graph:** SVG (via React Flow) allows CSS styling with Catppuccin tokens, React component composition for nodes, and accessibility. Canvas loses all of these.
- **Don't nest Monaco editors in blades:** Monaco is heavy (~2MB). Only mount ONE DiffEditor at a time in the diff blade. Unmount when blade closes.
- **Don't compute layout on every render:** Memoize dagre layout computation with `useMemo` keyed on nodes/edges data. The current code already does this correctly.
- **Don't animate all edges simultaneously:** The current staggered animation (0.02s delay per edge) is good for initial load, but should be skipped on auto-refresh to avoid visual noise.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph pan/zoom/viewport | Custom SVG transform math | React Flow's built-in viewport | Handles pinch zoom, wheel zoom, keyboard nav, minimap |
| DAG layout algorithm | Custom lane assignment | dagre-d3-es (already installed) | Handles complex merge patterns, crossing minimization |
| Diff rendering | Custom line-by-line diff | Monaco DiffEditor (already installed) | Syntax highlighting, inline/side-by-side toggle, gutter decorations |
| Slide-in animations | CSS transitions manually | framer-motion AnimatePresence | Handles enter/exit animations, layout shifts, spring physics |
| Virtualized scrolling | Intersection observer DIY | react-virtuoso (already installed) | Variable height items, infinite scroll, grouping |
| Keyboard navigation | addEventListener manually | react-hotkeys-hook (already installed) | Scope management, modifier keys, platform detection |
| Conventional commit parsing | Regex from scratch | Reuse from backend TypeSuggestion | Backend already has `suggest_commit_type` with full parsing |

**Key insight:** This phase's complexity comes from the LAYOUT ARCHITECTURE CHANGE (3-panel -> blades), not from any single library choice. Every library needed is already installed. The work is architectural wiring and component composition.

## Common Pitfalls

### Pitfall 1: Blade State Desync with URL/History
**What goes wrong:** Users can't use browser back/forward to navigate blade stack, or refreshing loses blade state.
**Why it happens:** Blade stack is pure ephemeral React state, not synced to URL or persisted.
**How to avoid:** For a Tauri desktop app, URL routing is less critical. Use Zustand store for blade stack. Escape key and explicit back buttons are the primary navigation. Do NOT try to sync with URL -- it adds complexity for no benefit in a desktop app.
**Warning signs:** If someone suggests `react-router` integration for blade navigation.

### Pitfall 2: Monaco DiffEditor Memory Leak on Rapid Blade Open/Close
**What goes wrong:** Opening and closing diff blades rapidly causes Monaco instances to pile up, consuming memory.
**Why it happens:** Monaco editor instances are heavyweight and take time to dispose.
**How to avoid:** Use a single DiffEditor instance that updates its `original`/`modified` props, rather than mounting/unmounting. Keep the DiffEditor mounted in the blade container and conditionally render content. Use React Query's `queryKey` to cache diff data so re-opening the same file is instant.
**Warning signs:** Memory growing when switching between files in diff view.

### Pitfall 3: Dagre Layout Instability on Graph Updates
**What goes wrong:** When new commits are added (auto-refresh), the entire graph re-layouts and nodes jump to new positions, disorienting the user.
**Why it happens:** Dagre treats each layout as fresh computation with no concept of "previous positions."
**How to avoid:** When refreshing, preserve the viewport position (React Flow's `getViewport()`/`setViewport()`). For incremental updates, prepend new nodes and only re-layout the changed portion. Consider diffing the old and new node arrays to minimize layout disruption.
**Warning signs:** Graph visually "jumps" after auto-refresh.

### Pitfall 4: Lane Column Width with Variable Branch Counts
**What goes wrong:** When there are many active branches (10+ feature branches), the graph becomes too wide and the lane columns squeeze nodes.
**Why it happens:** Fixed-width lanes don't scale when branch count is variable.
**How to avoid:** Use dagre's `nodesep` parameter to control minimum lane width. Set a minimum node width constraint. Allow horizontal scrolling when branch count exceeds viewport width. The "colored lane background tint" should extend to the full viewport height but only render for lanes that have active commits.
**Warning signs:** Overlapping nodes or edges crossing through nodes.

### Pitfall 5: Blade Container Flex Layout Breaking
**What goes wrong:** When blades are added/removed, the flex container miscalculates widths and blades overflow or collapse.
**Why it happens:** AnimatePresence with layout animations can conflict with flex sizing.
**How to avoid:** Use fixed widths for compressed blade strips (e.g., `w-12`) and `flex-1 min-w-0` for the active blade. Test with 1, 2, 3, and 4 blades deep to verify layout stability.
**Warning signs:** Blades overflowing the container or active blade not filling available space.

### Pitfall 6: Missing Backend Command for Historical Commit Diffs
**What goes wrong:** The diff blade can't show diffs for historical commits because the only diff command (`get_file_diff`) works on staging (HEAD vs index, index vs workdir).
**Why it happens:** Phase 05 only implemented staging diffs, not arbitrary commit-to-parent diffs.
**How to avoid:** Implement a new Rust Tauri command `get_commit_file_diff(oid: String, path: String)` that diffs a specific file between a commit and its first parent. This follows the same pattern as `get_file_diff` but uses `diff_tree_to_tree` with the commit's tree and parent's tree.
**Warning signs:** Clicking a file in commit details shows nothing or errors.

## Code Examples

Verified patterns from the existing codebase and official sources:

### New Tauri Command: get_commit_file_diff
```rust
// src-tauri/src/git/diff.rs - NEW COMMAND
// Pattern follows existing get_file_diff

#[tauri::command]
#[specta::specta]
pub async fn get_commit_file_diff(
    oid: String,
    path: String,
    context_lines: u32,
    state: State<'_, RepositoryState>,
) -> Result<FileDiff, GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;
    
    let language = detect_language(&path);
    
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let commit_oid = git2::Oid::from_str(&oid)
            .map_err(|e| GitError::OperationFailed(format!("Invalid OID: {}", e)))?;
        let commit = repo.find_commit(commit_oid)?;
        let commit_tree = commit.tree()?;
        
        let parent_tree = if commit.parent_count() > 0 {
            Some(commit.parent(0)?.tree()?)
        } else {
            None
        };
        
        // Get old content from parent tree
        let old_content = match parent_tree.as_ref() {
            Some(tree) => get_blob_content(&repo, tree, &path)?,
            None => String::new(),
        };
        
        // Get new content from commit tree
        let new_content = get_blob_content(&repo, &commit_tree, &path)?;
        
        // Generate hunks
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.context_lines(context_lines).pathspec(&path);
        let diff = repo.diff_tree_to_tree(
            parent_tree.as_ref(), Some(&commit_tree), Some(&mut diff_opts)
        )?;
        
        let mut hunks = Vec::new();
        let mut is_binary = false;
        diff.foreach(
            &mut |delta, _| { if delta.flags().is_binary() { is_binary = true; } true },
            None,
            Some(&mut |_delta, hunk| {
                hunks.push(DiffHunk {
                    old_start: hunk.old_start(),
                    old_lines: hunk.old_lines(),
                    new_start: hunk.new_start(),
                    new_lines: hunk.new_lines(),
                    header: String::from_utf8_lossy(hunk.header()).to_string(),
                });
                true
            }),
            None,
        )?;
        
        Ok(FileDiff { path, old_content, new_content, hunks, is_binary, language })
    }).await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

### Blade Container with AnimatePresence
```typescript
// Source: framer-motion AnimatePresence docs + existing project animation patterns

import { AnimatePresence, motion } from "framer-motion";

const bladeSlideIn = {
  initial: { x: "100%", opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: "100%", opacity: 0 },
};

const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

// BladeStrip: compressed previous blade
function BladeStrip({ title, onExpand }: { title: string; onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      className="w-10 shrink-0 border-r border-ctp-surface0 bg-ctp-base hover:bg-ctp-surface0 flex flex-col items-center py-3 gap-2"
    >
      <ChevronLeft className="w-4 h-4 text-ctp-overlay1" />
      <span className="text-xs text-ctp-subtext0 [writing-mode:vertical-lr] rotate-180">
        {title}
      </span>
    </button>
  );
}
```

### Straight Angled Edge Path (replacing getSmoothStepPath)
```typescript
// Custom edge for Ungit-style straight angled merge lines
// Replaces the current CommitEdge.tsx which uses getSmoothStepPath

function getAngledEdgePath(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
): string {
  if (sourceX === targetX) {
    // Same column: straight vertical line
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }
  // Different columns: vertical -> horizontal -> vertical
  const midY = sourceY + (targetY - sourceY) * 0.5;
  return `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
}
```

### Ungit-Style Commit Badge Node
```typescript
// Replaces current CommitNode.tsx
// Compact: ~180-220px wide, ~36-40px tall
// Shows: [TypeIcon] message_subject      [shortOid]

const COMMIT_TYPE_ICONS: Record<string, React.ElementType> = {
  feat: Sparkles, fix: Bug, docs: FileText, style: Paintbrush,
  refactor: Hammer, perf: Zap, test: TestTube, chore: Settings,
  ci: Rocket, build: Package, revert: Undo,
};

function parseConventionalType(message: string): string | null {
  const match = message.match(
    /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+?\))?(!)?:/
  );
  return match ? match[1] : null;
}
```

### Process Navigation Header
```typescript
// Header process entry points (scalable for future processes)
const PROCESSES = [
  { id: 'staging', label: 'Staging', icon: Files, description: 'Stage and commit changes' },
  { id: 'topology', label: 'Topology', icon: Network, description: 'Browse commit history' },
  // Future: { id: 'worktrees', label: 'Worktrees', icon: FolderGit2, description: 'Manage worktrees' },
  // Future: { id: 'settings', label: 'Settings', icon: Settings, description: 'Configure FlowForge' },
] as const;
```

## State of the Art

| Old Approach (Current v1.0) | New Approach (Phase 15) | Impact |
|-----|-----|--------|
| 3-panel resizable layout (sidebar + middle tabs + right content) | Blade-based process navigation (sidebar + blade stack) | Major UX improvement: drill-down flows become linear blade chains instead of tab-switching |
| Topology as a tab in middle panel, details in right panel | Topology as root blade, commit/diff as stacked blades | Better context: user sees the path they followed (graph -> commit -> diff) |
| No auto-refresh after commits | Event-driven topology refresh on `repository-changed` | Fixes v1.0 tech debt: topology always shows latest state |
| Staging diff only (HEAD vs index, index vs workdir) | Both staging diff AND historical commit diff | New capability: view diff for any file in any historical commit |
| Smooth step path edges (Bezier curves) | Straight angled merge lines | Matches Ungit visual style per locked decision |
| Card-style commit nodes (220x60px) | Compact badge-style nodes (~180x36px) with type icons | More compact graph, conventional commit type visible at a glance |
| main=peach, feature=blue, release=mauve | main=blue, feature=purple(mauve), release=orange(peach) | Color mapping change per locked decision |

## Discretion Recommendations

### Rendering Technology: Keep React Flow (SVG-based)
**Recommendation:** Continue using @xyflow/react (React Flow v12) for the topology graph.
**Reasoning:** React Flow renders SVG elements, which allows full CSS styling with Catppuccin tokens, React component nodes, and native browser accessibility. The library already handles pan/zoom, virtual viewport (only renders visible nodes), keyboard navigation, and minimap. Switching to Canvas would lose all of these for no performance benefit at the scale of git commit graphs (typically <1000 visible nodes). Custom SVG from scratch would require reimplementing viewport management, selection, and interaction handling.
**Confidence:** HIGH

### Commit Badge Sizing and Typography
**Recommendation:** Badge dimensions of 200px wide x 40px tall. Font: 12px JetBrains Mono for shortOid, 13px Geist for message subject. Type icon at 14x14px. Internal padding 8px horizontal, 6px vertical.
**Reasoning:** The current CommitNode is 220x60px with substantial vertical space. The Ungit style is more compact. 200x40 provides enough space for a type icon + truncated subject + short OID while being visually compact enough for dense graphs. Both fonts are already loaded in the project.
**Confidence:** MEDIUM (may need visual tuning during implementation)

### Zoom Level Range and Default
**Recommendation:** Min zoom 0.1, max zoom 2.0, default zoom to fit view with 0.2 padding (matching current settings). Add zoom-to-fit button in toolbar.
**Reasoning:** The current React Flow config already uses these exact values (`minZoom={0.1} maxZoom={2} fitView fitViewOptions={{ padding: 0.2 }}`). These work well and there's no reason to change them.
**Confidence:** HIGH

### Blade Transition Animations and Timing
**Recommendation:** Spring animation with stiffness=300, damping=30 for blade slide-in. Duration approximately 300ms. Blade strip compression should be instant (no animation). Exit animation mirrors enter (slide out to right).
**Reasoning:** The existing project uses similar spring parameters for UI interactions (see `lib/animations.ts` springTransition: stiffness=500, damping=30). Slightly lower stiffness (300 vs 500) gives a more fluid feel appropriate for larger panel transitions. The existing `easeTransition` at 200ms is too fast for a panel-sized element.
**Confidence:** MEDIUM

### Syntax Highlighting Library: Monaco DiffEditor (Keep Current)
**Recommendation:** Continue using @monaco-editor/react DiffEditor for all diff viewing (both staging and historical).
**Reasoning:** Monaco is already loaded in the bundle (~2MB), has a custom `flowforge-dark` Catppuccin theme defined, supports unified and side-by-side modes, and provides full syntax highlighting for 40+ languages. Adding a second diff library (like react-diff-viewer-continued) would increase bundle size with no benefit. The only change needed is feeding it historical commit diff data from the new `get_commit_file_diff` command.
**Confidence:** HIGH

### Virtualization for Long Commit Histories
**Recommendation:** Use React Flow's built-in virtual rendering (`onlyRenderVisibleElements` is the default in v12) for the graph viewport. Continue using react-virtuoso for the file list in commit details blade. Maintain the existing pagination model (100 initial commits, 50 per load-more) from the topology store.
**Reasoning:** React Flow already only renders nodes visible in the viewport, which handles 1000+ commits well. The pagination model in the topology store (`INITIAL_LIMIT = 100`, `LOAD_MORE_AMOUNT = 50`) provides incremental loading. For very large repos, the "Load More" button at the bottom of the graph (already implemented) is the right UX. Adding infinite scroll to React Flow would be more complex than beneficial.
**Confidence:** HIGH

## Open Questions

1. **Lane Column Assignment Algorithm Stability**
   - What we know: The current `assign_lanes` function in `graph.rs` uses a simple column assignment based on parent relationships. The Ungit-style with "colored lane columns with faint background tint" implies fixed, persistent lane positions per branch.
   - What's unclear: Whether the current algorithm produces stable enough lane assignments that branches always appear in the same column across refreshes. The "branch labels in a fixed column header row" requires consistent column positions.
   - Recommendation: Test the current algorithm with a multi-branch Gitflow repo. If lanes shift on refresh, enhance the algorithm to prioritize: main=column 0, develop=column 1, then features by creation order. This may require backend changes.

2. **Blade Width Distribution**
   - What we know: Active blade gets `flex-1`, compressed strips get `w-10` (40px). The sidebar is fixed at 20% of viewport.
   - What's unclear: When 3+ blades are open (e.g., graph strip + commit strip + diff panel), the remaining width may be too narrow for the diff viewer to be usable.
   - Recommendation: Set a minimum width for the active blade (e.g., 400px). If the viewport can't accommodate all strips + minimum blade width, hide the oldest strips entirely and show a breadcrumb count.

3. **Conventional Commit Type Parsing on Commit Badges**
   - What we know: The badge should show a conventional commit type icon. The backend's `suggest_commit_type` command does inference, but the graph nodes only carry `message` (first line of commit message).
   - What's unclear: Whether to parse the conventional commit type on the frontend from the message string, or add it to the GraphNode struct from the backend.
   - Recommendation: Parse on the frontend with a simple regex (shown in code examples above). This avoids changing the backend graph API and the parsing is trivial for conventional commit format. Non-conventional commits show no type icon.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `src/components/topology/`, `src/stores/topology.ts`, `src-tauri/src/git/graph.rs`, `src-tauri/src/git/diff.rs`, `src-tauri/src/git/history.rs`
- Context7 /websites/reactflow_dev - Custom nodes, custom edges, React Flow v12 API
- Context7 /websites/motion_dev - AnimatePresence, layout animations, shared layout transitions
- Previous Phase 05 research at `.planning/phases/05-topology-visualization/05-RESEARCH.md`

### Secondary (MEDIUM confidence)
- [CommitGraph React component](https://github.com/liuliu-dev/CommitGraph) - Interactive commit graph with pagination
- [react-commits-graph](https://github.com/jsdf/react-commits-graph) - SVG-based git commit graph rendering
- [git-graph-drawing collection](https://github.com/indigane/git-graph-drawing) - Survey of graph drawing approaches
- [Framer Motion layout animations blog](https://blog.maximeheckel.com/posts/framer-motion-layout-animations/) - Advanced AnimatePresence patterns

### Tertiary (LOW confidence)
- [Ungit source code](https://github.com/FredrikNoren/ungit) - Reference for visual style (not for code reuse)
- [@gitgraph/react](https://www.npmjs.com/package/@gitgraph/react) - Archived, not recommended for use

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in active use
- Architecture (blades): HIGH - framer-motion AnimatePresence + Zustand is well-proven pattern
- Architecture (graph restyle): HIGH - React Flow custom nodes/edges is documented and already working
- Backend (commit diff): HIGH - Follows exact same pattern as existing get_file_diff
- Pitfalls: HIGH - Identified from direct codebase analysis of existing code
- Color mapping: HIGH - Direct Catppuccin token mapping from locked decisions
- Discretion recommendations: MEDIUM - Badge sizing and animation timing need visual validation

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable stack, no expected breaking changes)
