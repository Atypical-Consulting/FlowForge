---
status: diagnosed
trigger: "Gitflow SVG diagram -- invisible rows and wrong style (round 5)"
created: 2026-02-08T00:00:00Z
updated: 2026-02-08T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- two distinct root causes identified (see Resolution)
test: n/a -- investigation complete
expecting: n/a
next_action: Implement gitgraph-style redesign

## Symptoms

expected: All five branch lanes (main, develop, feature, release, hotfix) should be visible as distinct horizontal rows with straight-line connections between them (typical gitgraph style)
actual: (1) Feature/release/hotfix branches render as curved arcs, not as separate horizontal lane rows -- making them look like "invisible rows" because they have no horizontal line of their own. (2) The visual style uses cubic Bezier curves instead of the expected mermaid-gitgraph straight-line style.
errors: No console errors -- this is a visual/design issue, not a runtime bug
reproduction: Open the Gitflow cheatsheet blade, observe the SVG diagram
started: After plan 22-22 introduced arc-based design; plan 22-24 kept arcs

## Eliminated

- hypothesis: CSS variable names are wrong (e.g. --ctp-* vs --catppuccin-color-*)
  evidence: branchClassifier.ts uses `var(--catppuccin-color-red)` etc., and mocha.css defines these variables correctly under both `:root` (latte) and `@variant dark { :root { ... } }` (mocha). All six color variables (red, blue, green, peach, mauve, overlay1) plus mantle and surface0 are properly defined. Plan 22-17 already fixed the --ctp-* naming issue.
  timestamp: 2026-02-08

- hypothesis: SVG marker elements fail to resolve CSS var() in fill attributes
  evidence: While SVG markers can have issues with CSS variable inheritance in some edge cases, this would only affect arrowheads, not entire branch lanes. The main and develop lanes (which also use CSS vars) render correctly, confirming CSS var() resolution works in this SVG context.
  timestamp: 2026-02-08

- hypothesis: Elements are outside the viewBox and get clipped
  evidence: viewBox is `0 0 900 340`. MAIN_Y=50, DEVELOP_Y=200, FEATURE_ARC_Y=280, RELEASE_ARC_Y=125, HOTFIX_ARC_Y=125. All Y values plus labels fit within 0-340. Feature label at Y=302 (280+22) is within bounds. Version labels at Y=24 (50-26) are within bounds.
  timestamp: 2026-02-08

## Evidence

- timestamp: 2026-02-08
  checked: GitflowDiagram.tsx SVG structure
  found: Only `main` and `develop` have horizontal `<line>` elements (permanent lanes at Y=50 and Y=200). Feature, release, and hotfix are rendered ONLY as cubic Bezier `<path>` curves (FLOW_CURVES array) connecting to/from the permanent lanes, plus commit dots at fixed Y positions. There are NO horizontal lines for feature/release/hotfix.
  implication: The "invisible rows" complaint is because feature/release/hotfix have no horizontal lane line -- they only have curved arcs. A user expecting a gitgraph-style diagram with 5 horizontal rows sees only 2 rows.

- timestamp: 2026-02-08
  checked: FLOW_CURVES array structure
  found: 8 cubic Bezier curves using `C` (curveTo) SVG commands. Feature has 2 curves (branch-out + merge-back), release has 3 (branch-out + merge-to-main + merge-to-develop), hotfix has 3 (branch-out + merge-to-main + merge-to-develop). All use cubic Bezier control points creating smooth arcs.
  implication: The entire short-lived branch visualization is arc-based. This is fundamentally different from mermaid gitgraph style, which uses straight horizontal lines per branch with vertical/diagonal straight connectors.

- timestamp: 2026-02-08
  checked: branchClassifier.ts BRANCH_TYPE_COLORS
  found: All CSS variable names match the catppuccin mocha.css definitions exactly: `var(--catppuccin-color-red)`, `var(--catppuccin-color-blue)`, `var(--catppuccin-color-green)`, `var(--catppuccin-color-peach)`, `var(--catppuccin-color-mauve)`, `var(--catppuccin-color-overlay1)`. These resolve to hex colors like #f38ba8 (red/mocha), #89b4fa (blue/mocha), etc.
  implication: Colors are correct. The problem is NOT color-related.

- timestamp: 2026-02-08
  checked: index.css @theme block and catppuccin import
  found: `@import "@catppuccin/tailwindcss/mocha.css"` provides all `--catppuccin-color-*` variables. The `@theme` block adds custom fonts and animations but does NOT override color variables. The mocha.css file uses `@variant dark { :root { ... } }` for dark theme colors, and `.mocha` class in index.css sets `color-scheme: dark`.
  implication: Theme setup is correct.

- timestamp: 2026-02-08
  checked: Mermaid gitgraph visual style (reference implementation)
  found: Mermaid gitgraph uses: (1) Each branch gets its own horizontal row/lane with a straight horizontal line. (2) Commits are circles placed ON the horizontal line. (3) Branch creation and merge connections use straight vertical or diagonal lines connecting between rows. (4) No curved arcs. (5) Branch labels appear on the left side of each lane. (6) In LR (left-to-right) orientation, branches stack vertically with main at top.
  implication: The current FlowForge implementation needs a fundamental redesign to match this style.

- timestamp: 2026-02-08
  checked: Current layout geometry
  found: Release (Y=125) and hotfix (Y=125) arcs share the SAME Y position between main (Y=50) and develop (Y=200). Their commit dots and labels occupy the same vertical space, separated only by X position. In a gitgraph-style redesign, each branch needs its own dedicated Y row.
  implication: The redesign must allocate 5 distinct Y positions for 5 branch types.

## Resolution

root_cause: |
  **Two interrelated root causes:**

  **ROOT CAUSE 1 -- "Invisible rows":**
  Feature, release, and hotfix branches have NO horizontal lane lines. They are rendered
  only as curved arcs (cubic Bezier paths in FLOW_CURVES) that branch from and merge back
  into the main/develop horizontal lines. A user expecting 5 visible horizontal rows
  (as in a standard gitgraph) sees only 2 (main and develop). The short-lived branches
  appear as swooping curves between the permanent lanes, not as distinct rows. This makes
  them feel "invisible" as rows -- they exist only as transient arcs.

  **ROOT CAUSE 2 -- Wrong visual style:**
  The SVG uses cubic Bezier curves (`C` commands) for all branch/merge connections,
  creating smooth swooping arcs. The user expects mermaid-gitgraph style: straight
  horizontal lines per branch with vertical or angled straight-line connectors for
  branch creation and merge operations. The current arc-based design was introduced in
  plan 22-22 and kept in plan 22-24's redesign.

  Both root causes share the same fix: redesign the SVG to use the mermaid gitgraph
  layout paradigm.

fix: |
  NOT YET APPLIED -- Design recommendation below.

verification: |
  NOT YET VERIFIED

files_changed: []

---

## Design Recommendation: Gitgraph-Style Redesign

### Target Visual Style (Mermaid Gitgraph)

```
  main:     ----o-----------o---------o-----o---------o----
                            |         |               |
  hotfix:                   |         |     o---o     |
                            |         |         |     |
  release:                  |     o---o---o     |     |
                            |     |             |     |
  develop:  ----o---o---o---o---o-----------o---o---o-o----
                    |                       |
  feature:          o---o---o---o           |
```

Each branch = its own horizontal line at a dedicated Y position.
Connections between branches = straight vertical lines or 2-segment L-shaped lines.

### Proposed Layout Constants

```typescript
// 5 horizontal lanes, evenly spaced
const LANE_Y = {
  main:    40,
  hotfix:  90,
  release: 140,
  develop: 190,
  feature: 240,
} as const;

const LANE_X_START = 100;
const LANE_X_END   = 850;
const SVG_WIDTH    = 950;
const SVG_HEIGHT   = 290;
```

### Proposed SVG Structure

1. **Five horizontal `<line>` elements** -- one per branch type, each with its own color and Y position. ALL branches get a permanent horizontal line.

2. **Commit dots** -- `<circle>` elements placed ON the horizontal lines at specific X positions, same as current but on the correct Y lane.

3. **Branch/merge connectors** -- Replace all cubic Bezier `<path>` elements with straight-line connectors:
   - **Branch-out:** Vertical `<line>` from source lane Y down/up to target lane Y at the same X position.
   - **Merge-back:** Vertical `<line>` from source lane Y to target lane Y at the merge X position.
   - Alternatively, use 2-segment polylines for angled connections: horizontal segment + vertical segment (L-shaped).

4. **Branch labels** -- `<text>` on the left side of each lane (same as current for main/develop, add for feature/release/hotfix).

5. **Short-lived branch lines** -- Feature, release, and hotfix horizontal lines should only span from branch-point-X to merge-point-X (not the full width), to show they are temporary:
   ```typescript
   // Feature: partial horizontal line from branch to merge
   <line x1={FEATURE_BRANCH_X} y1={LANE_Y.feature}
         x2={FEATURE_MERGE_X}  y2={LANE_Y.feature}
         stroke={BRANCH_TYPE_COLORS.feature} strokeWidth={2.5}
         strokeDasharray="6 3" /> // Optional: dashed to indicate ephemeral
   ```

6. **Vertical connectors** (replacing Bezier curves):
   ```typescript
   // Branch-out: develop -> feature (straight vertical line)
   <line x1={FEATURE_BRANCH_X} y1={LANE_Y.develop}
         x2={FEATURE_BRANCH_X} y2={LANE_Y.feature}
         stroke={BRANCH_TYPE_COLORS.feature} strokeWidth={2} />

   // Merge-back: feature -> develop (straight vertical line)
   <line x1={FEATURE_MERGE_X} y1={LANE_Y.feature}
         x2={FEATURE_MERGE_X} y2={LANE_Y.develop}
         stroke={BRANCH_TYPE_COLORS.feature} strokeWidth={2} />
   ```

7. **Connection dots at junctions** -- Place small circles at branch/merge points on BOTH the source and target lanes to mark the connection points.

### Key Differences from Current Implementation

| Aspect | Current (Arc-Based) | Proposed (Gitgraph) |
|--------|---------------------|---------------------|
| Short-lived branches | Curved arcs, no horizontal line | Horizontal line segment + vertical connectors |
| Branch connections | Cubic Bezier curves (C command) | Straight vertical `<line>` elements |
| Number of horizontal rows | 2 (main, develop) | 5 (main, hotfix, release, develop, feature) |
| Feature/release/hotfix visibility | Arcs between lanes | Distinct horizontal rows |
| FLOW_CURVES array | 8 Bezier paths | Replace with CONNECTORS array of straight lines |
| Arrowheads | On curve endpoints | On vertical connector endpoints (or omit) |

### Files to Modify

- `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/gitflow/GitflowDiagram.tsx` -- Complete SVG restructuring
- `/Users/phmatray/Repositories/github-phm/FlowForge/src/lib/branchClassifier.ts` -- No changes needed (colors are correct)
- `/Users/phmatray/Repositories/github-phm/FlowForge/src/index.css` -- No changes needed (theme is correct)

### INDICATOR_Y Update

The `INDICATOR_Y` record must be updated to use the new lane Y positions:
```typescript
const INDICATOR_Y: Record<string, number> = {
  main:    LANE_Y.main,
  develop: LANE_Y.develop,
  feature: LANE_Y.feature,
  release: LANE_Y.release,
  hotfix:  LANE_Y.hotfix,
};
```
