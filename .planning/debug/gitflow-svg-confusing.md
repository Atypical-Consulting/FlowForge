---
status: diagnosed
trigger: "Gitflow SVG diagram is ugly and incomprehensible - reading graph is confusing"
created: 2026-02-08T00:00:00Z
updated: 2026-02-08T00:00:00Z
---

## Current Focus

hypothesis: The diagram suffers from multiple layout/design issues that compound into visual confusion
test: Structural analysis of SVG coordinates, curve paths, and visual hierarchy
expecting: Specific geometric and design flaws that explain the "ugly and incomprehensible" complaint
next_action: Document all findings and provide concrete improvement suggestions

## Symptoms

expected: A clear, readable Gitflow branching diagram showing how branches relate
actual: Diagram is "ugly and incomprehensible" - reading the graph is confusing
errors: No runtime errors - this is a UX/visual design issue
reproduction: Open GitflowCheatsheetBlade to see the diagram
started: After plan 22-22 redesign with cubic Bezier curves

## Evidence

- timestamp: 2026-02-08
  checked: LANE_Y positions and viewBox dimensions
  found: |
    ViewBox is 800x400. Five lanes at Y=60,130,200,270,340.
    Lane spacing is 70px uniform. Lines run from x=120 to x=750.
    Labels at x=15. This creates a very wide, moderately tall rectangle.
  implication: Proportions are reasonable but lanes are closely packed.

- timestamp: 2026-02-08
  checked: FLOW_CURVES paths and their geometric relationships
  found: |
    7 curves total, many overlapping in X range 350-650.
    Curves cross each other visually (release and hotfix paths intersect).
    Multiple curves share endpoints or near-endpoints on the same lane.
    Release branch-out goes UP from develop(270) to release(130) - counterintuitive.
    Hotfix branch-out goes UP from main(200) to hotfix(60) - also counterintuitive.
  implication: Upward branching contradicts standard gitflow visual convention.

- timestamp: 2026-02-08
  checked: Standard gitflow diagram conventions (nvie, Atlassian, draw.io)
  found: |
    The canonical nvie diagram uses VERTICAL time axis (top=past, bottom=future)
    with horizontal branching. Most modern adaptations use horizontal time axis
    with main/develop as the central "spine" and branches going up OR down.
    The key insight: main is ALWAYS at the top, feature at the bottom.
    The standard order top-to-bottom is: hotfix, main, release, develop, feature.
  implication: Current layout has main in the MIDDLE (Y=200), which is non-standard.

- timestamp: 2026-02-08
  checked: Curve crossing and visual clutter analysis
  found: |
    Release branch-out: develop(450,270) -> release(400,130) - goes LEFT and UP
    Release merge to main: release(550,130) -> main(500,200) - goes LEFT and DOWN
    Hotfix merge to develop: hotfix(550,60) -> develop(700,270) - long diagonal
    These curves cross each other in the middle zone (x=400-600).
    No arrowheads indicate direction - impossible to tell branch from merge.
  implication: Without direction indicators, the diagram is just a tangle of curves.

- timestamp: 2026-02-08
  checked: Color and opacity choices
  found: |
    Non-highlighted curves at opacity 0.55 - quite faded on dark background.
    Non-highlighted lanes at opacity 0.7.
    All curves are same strokeWidth 2.5 regardless of importance.
    Connection dots (r=3) are tiny and don't clearly show branch/merge points.
  implication: Low contrast makes the diagram hard to read at a glance.

## Resolution

root_cause: |
  Multiple compounding design issues make the diagram confusing:

  1. NO DIRECTION INDICATORS: Curves have no arrowheads. Branch-out and merge-back
     look identical. The viewer cannot tell which direction flow goes.

  2. COUNTERINTUITIVE VERTICAL ORDERING: Main is in the middle (Y=200) instead of
     at the top. The standard convention (nvie, Atlassian) places main at top,
     develop below it, feature at bottom. Current order (top to bottom) is:
     hotfix, release, main, develop, feature. This makes release and hotfix
     appear to branch UPWARD from develop/main, which is visually confusing.

  3. CURVE CROSSING SPAGHETTI: Seven Bezier curves in a tight X range (350-650)
     create a tangled mess in the center. Curves from different branch types
     cross each other without any visual separation. The release-merge-to-develop
     curve and the hotfix-merge-to-develop curve overlap extensively.

  4. LOW CONTRAST: Non-active elements at 0.55-0.7 opacity on a dark (mantle)
     background are hard to see. The diagram should be fully readable even
     without highlighting.

  5. NO TEMPORAL MARKERS: There's no indication of time progression. Standard
     gitflow diagrams show version tags (v1.0, v2.0) on main and timing cues.
     Without these, the commit dots are meaningless circles.

  6. CRAMPED CENTER: All branching and merging happens in x=300-700, but lanes
     extend from x=120 to x=750. The interesting parts are squeezed together
     while lane endpoints have wasted space.

  7. FEATURE/RELEASE ARE SHORT-LIVED BUT SHOWN AS FULL LANES: Feature and
     release branches should visually appear as temporary - branching off and
     merging back. Instead they appear as permanent lanes identical to main
     and develop, which misrepresents the gitflow model.

fix: Not applied (diagnosis only)
verification: N/A
files_changed: []
