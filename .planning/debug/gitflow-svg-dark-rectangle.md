---
status: diagnosed
trigger: "Gitflow cheatsheet SVG diagram renders as dark rectangle with missing path colors"
created: 2026-02-08T00:00:00Z
updated: 2026-02-08T00:00:00Z
---

## Current Focus

hypothesis: BRANCH_TYPE_COLORS uses var(--ctp-*) CSS variables that do not exist; the actual variables are --catppuccin-color-*
test: Searched compiled CSS output for --ctp-red — does not exist; only --catppuccin-color-red exists
expecting: var(--ctp-red) resolves to nothing, SVG stroke/fill become transparent/default
next_action: Report root cause

## Symptoms

expected: SVG diagram should show colored branch lanes (red for main, blue for develop, etc.) on a dark background
actual: SVG renders as a big dark rectangle with no visible lanes, dots, or labels
errors: None (silent failure — CSS var() returns empty/initial when undefined)
reproduction: Open Gitflow cheatsheet blade in FlowForge
started: Since feature was introduced (colors were never correct)

## Eliminated

(none needed — root cause found on first hypothesis)

## Evidence

- timestamp: 2026-02-08T00:01:00Z
  checked: BRANCH_TYPE_COLORS in src/lib/branchClassifier.ts
  found: Colors defined as var(--ctp-red), var(--ctp-blue), var(--ctp-green), var(--ctp-peach), var(--ctp-mauve), var(--ctp-overlay1)
  implication: These CSS custom property names are used for SVG stroke/fill attributes

- timestamp: 2026-02-08T00:02:00Z
  checked: @catppuccin/tailwindcss/mocha.css @theme block
  found: Theme defines --color-ctp-red: var(--catppuccin-color-red) inside @theme inline block. No --ctp-red variable exists anywhere.
  implication: Tailwind v4 @theme variables use --color-* prefix; the bare --ctp-* names do not exist as CSS custom properties

- timestamp: 2026-02-08T00:03:00Z
  checked: Compiled CSS output (dist/assets/index-CYoz5eCk.css)
  found: Tailwind compiles bg-ctp-red to background-color:var(--catppuccin-color-red). The intermediate --color-ctp-red is compiled away. The bare --ctp-red never appears as a defined variable.
  implication: var(--ctp-red) in inline SVG attributes resolves to empty string (undefined CSS variable)

- timestamp: 2026-02-08T00:04:00Z
  checked: SVG background rect in GitflowDiagram.tsx line 47
  found: fill="var(--ctp-mantle)" — also uses non-existent variable
  implication: Background rect fills with initial value (black by default for SVG fill), which creates the "dark rectangle" appearance

- timestamp: 2026-02-08T00:05:00Z
  checked: index.css React Flow control styles (lines 30-68)
  found: Same pattern — var(--ctp-mantle), var(--ctp-surface0), var(--ctp-text) etc. all use non-existent variables
  implication: This is a project-wide issue affecting ALL direct var(--ctp-*) references, not just the SVG diagram

## Resolution

root_cause: |
  CSS variable name mismatch between code references and actual Catppuccin theme definitions.

  The code uses: var(--ctp-red), var(--ctp-blue), var(--ctp-mantle), etc.
  The actual CSS variables are: --catppuccin-color-red, --catppuccin-color-blue, --catppuccin-color-mantle, etc.

  In Tailwind v4 with @catppuccin/tailwindcss, the @theme block registers --color-ctp-red: var(--catppuccin-color-red).
  Tailwind utility classes (bg-ctp-red, text-ctp-blue) work correctly because Tailwind compiles them
  to reference --catppuccin-color-red directly. But when code uses var(--ctp-red) in inline styles
  or SVG attributes, this variable simply does not exist in the CSS. The browser treats undefined
  CSS variables as invalid, causing SVG fill/stroke to fall back to defaults (black fill, no stroke).

  Result: The SVG background rect fills black (default SVG fill), and all lane lines, dots, labels,
  and merge paths get no visible color — producing a solid dark rectangle.

fix: empty
verification: empty
files_changed: []
