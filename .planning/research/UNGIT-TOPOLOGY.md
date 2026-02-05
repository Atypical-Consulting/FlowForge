# Ungit Topology Research

**Project:** FlowForge v1.1.0 - Topology Visualization Enhancement
**Researched:** 2026-02-05
**Confidence:** HIGH (source code examined)

## Executive Summary

Ungit is a web-based Git client that provides an intuitive commit graph visualization. Its key differentiators are:
1. **Vertical layout** with the current branch anchored on the left
2. **Inline commit details** that expand below selected nodes
3. **Simple branch ordering** that fans commits horizontally by branch
4. **Deterministic hash-based colors** for consistent branch identification

FlowForge can adopt several patterns while adapting others to fit its Gitflow-enforced model.

---

## Visual Design

### Layout Strategy

Ungit uses a **vertical, top-to-bottom** graph layout:

- **Y-axis:** Time flows downward (newest commits at top)
- **X-axis:** Branch "lanes" spread rightward based on branch order
- **Fixed anchor:** HEAD ancestors are pinned at x=610, creating a visual "spine"

```
Source: components/graph/git-node.js

For HEAD ancestors:
- x = 610 (fixed)
- y = 120 + (120 * ancestorIndex)
- radius = 30px (larger for emphasis)

For other branches:
- x = 610 + (90 * branchOrder)
- y = position of node above + 60px
- radius = 15px (smaller)
```

### Node Sizing

| Node Type | Radius | Emphasis |
|-----------|--------|----------|
| HEAD ancestors | 30px | Primary focus |
| Other commits | 15px | Secondary |
| Selected/highlighted | Accented ring | Visual feedback |

### Graph Dimensions

The graph canvas scales dynamically:
- **Width:** `1000 + (highestBranchOrder * 90)`
- **Height:** Based on last node position + 80px padding

### Key Visual Patterns

1. **Spine-based layout:** Current branch forms a vertical spine; other branches fan out
2. **Proportional spacing:** 120px between HEAD ancestors, 60px for others
3. **Visual hierarchy:** Larger nodes for important commits, smaller for context

---

## Interaction Model

### Selection Behavior

```
Source: components/graph/selectable.js

Selection is centralized through graph.currentActionContext():
- Clicking a node sets it as currentActionContext
- Only one node can be selected at a time
- Clicking the same node again deselects it
- Selection state propagates via observables
```

### Click Behaviors

| Action | Result |
|--------|--------|
| Click commit node | Select node, show commit details inline |
| Click selected node | Deselect node, hide details |
| Hover over edge | Highlight connected nodes |
| Hover over node | Show preview state |

### Commit Actions on Selection

When a commit is selected, Ungit shows contextual actions:
- **Rebase** - Reposition commits
- **Merge** - Merge branches
- **Reset** - Reset to this commit
- **Cherry-pick** - Apply commit to current branch
- **Revert** - Create revert commit

Actions are visualized with preview paths showing the result.

---

## Branch Representation

### Color Assignment

```javascript
Source: components/graph/git-ref.js

// Colors are deterministic via MD5 hash of branch name
_colorFromHashOfString(string) {
  return `#${md5(string).toString().slice(0, 6)}`;
}
```

**Implications:**
- Same branch always gets same color (session-independent)
- Colors are pseudo-random but consistent
- No semantic meaning (unlike FlowForge's Gitflow colors)

### Branch Labels

Branch refs are displayed:
- **Position:** Attached to the commit they point to
- **Icons:** Globe for remote, git-branch for local, tag icon for tags
- **Sizing:** Current branch uses 26px icons, others use 18px
- **Limit:** Configurable `numRefsToShow` (default: 5)

### Merge Commits

Merge commits have multiple parent edges:
- Standard edges drawn between commit and each parent
- No special visual treatment for merge commits themselves
- Edge colors inherit from source node's branch color

---

## Commit Details Display

### Display Strategy: Inline Expansion

```
Source: components/commit/commit.html, commit.less

Unlike side-panel approaches, Ungit expands commit details
INLINE below the graph node. This maintains spatial context.
```

### Information Shown

| Field | Display |
|-------|---------|
| Author | Gravatar + name + email link |
| Title | First 72 chars of message |
| Timestamp | Relative ("2 hours ago") + absolute on hover |
| SHA | First 8 characters, click to copy |
| Changes | +additions / -deletions counts |
| Parents | Clickable links to parent commits |
| Files | List with status colors (green=added, red=deleted, yellow=modified) |

### Diff Integration

- Diffs load lazily when commit is selected
- Two display modes: unified and side-by-side
- File tree with status colors

---

## Technical Implementation

### Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Knockout.js (MVVM) |
| Graphics | SVG for edges, HTML for nodes |
| Animation | Snap.svg's mina library (elastic easing, 750ms) |
| Server | Node.js + Express |

### Key Algorithms

**1. Branch Ordering (computeNode)**
- Assigns branchOrder to each node bottom-up
- Allocates slots to parallel branches

**2. HEAD Ancestry Marking**
- Separate traversal marks commits descending from HEAD
- Gives priority positioning to current branch path
- Enables the "spine" layout pattern

### Performance Optimizations

**1. Pagination**
- Default 25 commits per load
- Scroll-triggered lazy loading
- No virtualization (all loaded nodes stay in DOM)

**2. Debounced Updates**
- File watcher events batched at 500ms
- Prevents rapid-fire re-renders

---

## Recommendations for FlowForge

### Patterns to ADOPT

| Pattern | Why | Implementation Notes |
|---------|-----|---------------------|
| **Inline commit details** | Maintains spatial context, reduces context switching | Expand below selected node instead of side panel |
| **Fixed spine layout** | Creates visual anchor, easier to follow history | Keep main/develop as fixed left lanes |
| **Commit details on click** | Utilizes empty center panel | Show diff, files, metadata inline |
| **Paginated loading** | Already implemented, matches Ungit | Continue using commit batches |

### Patterns to ADAPT

| Pattern | Adaptation | Rationale |
|---------|------------|-----------|
| **Hash-based colors** | Keep Gitflow semantic colors | FlowForge's color scheme has meaning (main=peach, develop=green, etc.) |
| **Branch ordering algorithm** | Use column-based Gitflow lanes | Ungit's fan-out doesn't match Gitflow's structured lanes |
| **Elastic animation** | Use subtle spring instead | May feel too playful for professional tool |

### Patterns to SKIP

| Pattern | Reason |
|---------|--------|
| **Drag-and-drop branch operations** | Gitflow enforces specific merge patterns; freestyle merging contradicts philosophy |
| **Multiple action hover menus** | Gitflow operations are constrained; simpler action set needed |

### Concrete Recommendations

**1. Rework Topology Layout**

Current FlowForge uses dagre. Consider switching to elkjs for better horizontal/vertical control:

```typescript
// Gitflow-aware lane positioning
const LANE_X = {
  main: 100,
  hotfix: 200,
  release: 300,
  develop: 400,
  feature: 500, // +100 per concurrent feature
};
```

**2. Implement Inline Details Panel**

When commit selected, show details in the center panel (currently empty):
- Commit metadata (author, date, SHA)
- File list with change status
- Diff viewer (reuse existing Monaco component)

**3. Selection State Enhancement**

- Hover preview (show brief info without full selection)
- Edge highlighting on node hover
- Keyboard navigation (up/down arrows)

---

## Sources

- [Ungit GitHub Repository](https://github.com/FredrikNoren/ungit) - Primary source
- `components/graph/graph.js` - Graph orchestration
- `components/graph/git-node.js` - Node positioning/rendering
- `components/graph/git-ref.js` - Branch label rendering
- `components/graph/selectable.js` - Selection management
- `components/commit/commit.js` - Commit details
