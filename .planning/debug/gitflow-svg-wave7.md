---
status: diagnosed
trigger: "Gitflow cheatsheet SVG diagram has colors that are too dark and strange curves -- not a good representation of branches"
created: 2026-02-08T12:00:00Z
updated: 2026-02-08T12:00:00Z
---

## Current Focus

hypothesis: Multiple compounding issues -- dark background absorbs pastel colors, non-highlighted lanes at 0.4 opacity become near-invisible, SVG path geometry uses diagonal quadratic Bezier curves instead of smooth S-curves typical of git graph tools, and the flat horizontal-lane layout lacks the vertical flow / commit progression expected of a GitKraken-style graph
test: Analyzed SVG source, CSS variable values, and path geometry math
expecting: Root causes confirmed through code analysis
next_action: Report diagnosis with fix recommendations

## Symptoms

expected: Bright, clearly visible colored branch lanes with smooth merge/branch curves resembling a GitKraken-style commit graph
actual: Colors appear "too dark" and unreadable; curves look "strange" and don't resemble a proper git graph
errors: None (visual/aesthetic issue, not a runtime error)
reproduction: Open Gitflow cheatsheet blade in FlowForge
started: After plan 22-17 fix replaced var(--ctp-*) with var(--catppuccin-color-*) -- colors now resolve but look wrong

## Eliminated

(No hypotheses eliminated -- root causes confirmed on analysis)

## Evidence

- timestamp: 2026-02-08T12:01:00Z
  checked: Catppuccin Mocha color values in mocha.css
  found: |
    In Mocha theme (dark mode), the actual resolved hex values are:
    - --catppuccin-color-mantle: #181825 (SVG background) -- extremely dark navy-black
    - --catppuccin-color-red: #f38ba8 (main lane) -- pastel pink-red
    - --catppuccin-color-blue: #89b4fa (develop lane) -- pastel blue
    - --catppuccin-color-green: #a6e3a1 (feature lane) -- pastel green
    - --catppuccin-color-peach: #fab387 (release lane) -- pastel peach
    - --catppuccin-color-mauve: #cba6f7 (hotfix lane) -- pastel purple
  implication: |
    The Catppuccin Mocha accent colors are PASTEL (light, desaturated) -- they should appear bright on dark backgrounds.
    The colors themselves are NOT too dark. The issue is opacity and context.

- timestamp: 2026-02-08T12:02:00Z
  checked: Opacity values in GitflowDiagram.tsx
  found: |
    Line 56: Non-highlighted lanes render at opacity={0.4}
    Lines 105,113,123,131,141,149: Branch/merge paths render at opacity={0.3} (non-highlighted) or 0.8 (highlighted)
    This means when no lane is highlighted (branchType === "other" or no match), ALL lanes show at 40% opacity.
    When a lane IS highlighted, the other 4 lanes all drop to 40% opacity.
    The merge/branch paths drop to 30% opacity when not highlighted.
  implication: |
    40% opacity of #f38ba8 on #181825 background produces an effective color of roughly #6a3a48 -- a muddy dark rose.
    40% opacity of #89b4fa on #181825 produces roughly #3c4f6f -- a very dark blue.
    This is the PRIMARY CAUSE of "too dark" -- most of the diagram is at 0.3-0.4 opacity on a near-black background.

- timestamp: 2026-02-08T12:03:00Z
  checked: SVG path geometry for branch/merge curves (lines 99-150)
  found: |
    All branch/merge connections use quadratic Bezier curves (Q command):

    Feature branch-out: "M 250 270 Q 250 305 300 340"
      - Starts at develop (y=270), control point at (250,305), ends at feature (y=340)
      - This creates a curve that goes straight down then bends right -- an awkward diagonal

    Feature merge-back: "M 550 340 Q 600 305 600 270"
      - Starts at feature (y=340), control point at (600,305), ends at develop (y=270)
      - Same awkward diagonal going up-right

    Release branch-out: "M 350 270 Q 350 200 400 130"
      - Huge jump from develop (y=270) to release (y=130) -- 140px vertical, only 50px horizontal
      - Creates a steep near-vertical diagonal, not a smooth curve

    Hotfix branch-out: "M 400 200 Q 400 130 450 60"
      - Same issue: steep diagonal from main (y=200) to hotfix (y=60)

    ALL paths use strokeDasharray="4 4" (dashed) and strokeWidth=1.5 (thin)
  implication: |
    PROBLEM 1 - GEOMETRY: Quadratic Bezier with a single control point cannot produce smooth S-curves.
    Git graph tools (GitKraken, etc.) use cubic Bezier (C command) with two control points to
    create smooth S-shaped transitions between lanes. The Q curves here produce sharp-looking arcs.

    PROBLEM 2 - STEEPNESS: The vertical lane spacing (70px between lanes) combined with small
    horizontal offsets (50-75px) creates very steep angles. GitKraken uses gentler curves that
    span more horizontal distance.

    PROBLEM 3 - DASH PATTERN: The 4px dash-gap pattern on thin 1.5px strokes makes the curves
    harder to see and gives them a "sketchy" feel, unlike the solid smooth lines in GitKraken.

- timestamp: 2026-02-08T12:04:00Z
  checked: Overall SVG layout architecture
  found: |
    Current layout:
    - 5 horizontal lanes at fixed Y positions (60, 130, 200, 270, 340)
    - Each lane has 4 commit dots at fixed X positions (200, 350, 500, 650)
    - Branch/merge paths connect between lanes at arbitrary positions
    - Labels on left side at x=15
    - "You are here" indicator at x=700

    GitKraken-style layout characteristics:
    - Vertical flow (time goes top-to-bottom or left-to-right)
    - Branches fork from specific commits (circles/dots)
    - Merge arrows clearly show direction
    - Smooth cubic bezier S-curves between lane positions
    - Bright saturated colors at full opacity
    - Solid lines (not dashed) for branch paths
    - Merge commits shown as dots where lines converge
    - Clear visual hierarchy: main branch is prominent
  implication: |
    The current diagram is a "swim lane" style showing branches as parallel horizontal lines
    with cross-lane connections. This is fundamentally different from a commit graph.
    While the swim lane approach is valid for a CHEATSHEET (showing the conceptual model),
    the curves between lanes need to look clean and smooth to be readable.

- timestamp: 2026-02-08T12:05:00Z
  checked: SVG background and container context
  found: |
    - SVG background: <rect fill="var(--catppuccin-color-mantle)"> = #181825 (near-black)
    - Container: <div className="shrink-0"> -- no padding/border around SVG
    - Parent: <div className="bg-ctp-base"> = #1e1e2e (also very dark)
    - The SVG mantle background (#181825) is slightly darker than the page base (#1e1e2e)
  implication: |
    The background is appropriate for a dark theme, but the combination of near-black
    background + low opacity lanes creates poor contrast. The background itself is not
    the problem -- the opacity is.

## Resolution

root_cause: |
  THREE COMPOUNDING ROOT CAUSES:

  1. EXCESSIVE OPACITY REDUCTION (Primary "too dark" cause)
     Non-highlighted lanes render at opacity=0.4, merge/branch paths at opacity=0.3.
     On the #181825 (near-black) background, 40% opacity reduces the already-pastel
     Catppuccin Mocha accent colors to muddy, nearly invisible shades:
     - #f38ba8 at 40% on #181825 => effective ~#6a3a48 (dark muddy rose)
     - #89b4fa at 40% on #181825 => effective ~#3c4f6f (dark muddy blue)
     - #a6e3a1 at 40% on #181825 => effective ~#4e6148 (dark muddy green)
     When viewing the cheatsheet on a non-gitflow branch (type="other"), ALL lanes
     show at this reduced opacity, making the entire diagram look dark.

  2. POOR CURVE GEOMETRY ("strange curves" cause)
     All 6 branch/merge paths use quadratic Bezier curves (SVG Q command) with a single
     control point. This produces simple arcs, not the smooth S-shaped transitions used
     by GitKraken and other git graph tools. Additionally:
     - The vertical span (70-140px) vs horizontal offset (50-75px) ratio creates
       steep, almost-vertical diagonals
     - strokeDasharray="4 4" with strokeWidth=1.5 makes curves look sketchy/faint
     - No arrow markers or merge-point indicators to show flow direction

  3. FLAT LAYOUT LACKS COMMIT FLOW CONTEXT
     The diagram places 4 generic dots per lane at fixed positions. There's no visual
     connection between the dots and the branch/merge paths. The branch-out curve
     starts at x=250 on develop but the nearest dot is at x=200, so the fork doesn't
     visually originate from a commit. Same for merges. This disconnection makes the
     branch/merge curves feel arbitrary rather than part of a coherent flow.

fix: |
  RECOMMENDED FIXES:

  A. Fix opacity (HIGH PRIORITY -- addresses "too dark"):
     - Raise non-highlighted lane opacity from 0.4 to 0.65-0.7
     - Raise non-highlighted path opacity from 0.3 to 0.5
     - Keep highlighted lane at opacity=1.0 with glow (current behavior is good)
     - Alternative: use semi-transparent versions of colors instead of opacity
       (e.g., color-mix() or explicit hex with alpha) for more predictable rendering

  B. Fix curve geometry (HIGH PRIORITY -- addresses "strange curves"):
     - Replace quadratic Bezier (Q) with cubic Bezier (C) for smooth S-curves
     - Use horizontal-first-then-vertical pattern:
       Current (steep diagonal): M 250 270 Q 250 305 300 340
       Better (smooth S-curve):  M 250 270 C 275 270, 300 340, 300 340
       Or even better with proper S:
         M 250 270 C 250 270, 250 340, 300 340
     - Increase horizontal span of curves (use more X distance for transitions)
     - Remove strokeDasharray -- use solid lines for branch paths
     - Increase strokeWidth from 1.5 to 2.0-2.5 for better visibility
     - Add small circle markers at branch/merge points (where curve meets lane)

  C. Improve commit dot placement (MEDIUM PRIORITY):
     - Align branch-out and merge-back curves to originate/terminate at commit dots
     - Use different dot sizes or fill vs outline to distinguish branch/merge commits
     - Consider adding a filled diamond or double-circle for merge commits

  D. Optional enhancements for GitKraken style:
     - Add subtle lane background strips (very low opacity color bands)
     - Add directional arrow markers on branch/merge paths
     - Add a time axis indicator (left=earlier, right=later)
     - Consider version labels on main lane dots (v1.0, v2.0)

  FILES TO CHANGE:
  - src/components/gitflow/GitflowDiagram.tsx (all visual changes)
  - src/lib/branchClassifier.ts (no changes needed -- colors are correct)

verification: |
  Manual visual inspection needed:
  1. Open Gitflow cheatsheet blade
  2. Verify all 5 lanes are clearly visible and distinguishable
  3. Verify branch/merge curves are smooth S-shapes, not steep diagonals
  4. Test with different highlighted lanes (be on main, develop, feature branches)
  5. Test with no highlight (non-gitflow branch name)
  6. Compare visual quality to GitKraken commit graph screenshots

files_changed: []
