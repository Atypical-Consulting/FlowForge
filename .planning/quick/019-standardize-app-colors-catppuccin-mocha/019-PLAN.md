---
phase: quick-019
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/index.css
  - src/components/viewers/DiffViewer.tsx
  - src/components/topology/layoutUtils.ts
  - src/components/topology/CommitEdge.tsx
  - src/components/RecentRepos.tsx
  - src/components/commit/CommitForm.tsx
  - src/components/changelog/ChangelogPreview.tsx
  - src/components/commit/ValidationErrors.tsx
  - src/components/changelog/ChangelogDialog.tsx
  - src/components/commit/BreakingChangeSection.tsx
  - src/components/commit/CommitDetails.tsx
  - src/components/staging/FileItem.tsx
  - src/components/staging/FileList.tsx
  - src/components/sync/SyncProgress.tsx
  - src/components/stash/StashItem.tsx
  - src/components/stash/StashList.tsx
  - src/components/stash/StashDialog.tsx
  - src/components/branches/BranchItem.tsx
  - src/components/branches/BranchList.tsx
  - src/components/branches/CreateBranchDialog.tsx
  - src/components/branches/MergeDialog.tsx
  - src/components/tags/TagItem.tsx
  - src/components/tags/TagList.tsx
  - src/components/tags/CreateTagDialog.tsx
  - src/components/topology/TopologyCommitDetails.tsx
  - src/components/viewers/FileViewer.tsx
  - src/components/viewers/NugetPackageViewer.tsx
  - src/components/gitflow/GitflowPanel.tsx
  - src/components/gitflow/StartFlowDialog.tsx
  - src/components/gitflow/FinishFlowDialog.tsx
autonomous: true

must_haves:
  truths:
    - "All UI colors use Catppuccin Mocha palette exclusively"
    - "No hardcoded hex values outside Catppuccin palette exist in source"
    - "No Tailwind gray-*, blue-*, red-*, green-*, yellow-* classes exist"
    - "Monaco editor theme uses Catppuccin colors"
    - "Topology visualization uses ctp-* CSS variables"
  artifacts:
    - path: "src/index.css"
      provides: "Global CSS without non-Catppuccin colors"
      contains: "var(--ctp-"
    - path: "src/components/viewers/DiffViewer.tsx"
      provides: "Monaco theme with Catppuccin colors"
      contains: "ctp-"
    - path: "src/components/topology/layoutUtils.ts"
      provides: "Branch colors using CSS variables"
      contains: "var(--ctp-"
  key_links:
    - from: "All .tsx components"
      to: "Catppuccin CSS variables"
      via: "ctp-* Tailwind classes"
      pattern: "ctp-(text|subtext|overlay|surface|base|mantle|crust|rosewater|flamingo|pink|mauve|red|maroon|peach|yellow|green|teal|sky|sapphire|blue|lavender)"
---

<objective>
Standardize all application colors to use exclusively the Catppuccin Mocha palette.

Purpose: Ensure visual consistency across the entire application by eliminating hardcoded hex colors and non-Catppuccin Tailwind classes in favor of the established ctp-* design system.

Output: All source files using only Catppuccin Mocha colors via ctp-* Tailwind classes and --ctp-* CSS variables.
</objective>

<context>
The project already uses @catppuccin/tailwindcss with mocha.css imported in index.css.
Available color classes follow the pattern: text-ctp-*, bg-ctp-*, border-ctp-*

Color mapping reference (Tailwind default -> Catppuccin Mocha):
- gray-950/900 -> ctp-crust/ctp-mantle/ctp-base
- gray-800 -> ctp-surface0
- gray-700 -> ctp-surface1
- gray-600 -> ctp-surface2
- gray-500 -> ctp-overlay0
- gray-400 -> ctp-overlay1/ctp-overlay2
- gray-300/200 -> ctp-subtext0/ctp-subtext1/ctp-text
- blue-500/400 -> ctp-blue/ctp-sapphire
- red-500/400 -> ctp-red/ctp-maroon
- green-500/400 -> ctp-green/ctp-teal
- yellow-500/400 -> ctp-yellow/ctp-peach
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace Monaco editor and topology hardcoded hex colors</name>
  <files>
    src/components/viewers/DiffViewer.tsx
    src/components/topology/layoutUtils.ts
    src/components/topology/CommitEdge.tsx
    src/components/topology/TopologyPanel.tsx
  </files>
  <action>
    Replace all hardcoded hex colors in these files with Catppuccin CSS variables.
    
    For DiffViewer.tsx Monaco theme (lines 25-45), use CSS var() syntax:
    - editor.background: var(--ctp-crust) 
    - editor.foreground: var(--ctp-text)
    - editor.lineHighlightBackground: var(--ctp-surface0) with transparency
    - editor.selectionBackground: var(--ctp-blue) with transparency
    - editorLineNumber.foreground: var(--ctp-overlay0)
    - editorCursor.foreground: var(--ctp-blue)
    - diffEditor.insertedTextBackground: var(--ctp-green) with transparency
    - diffEditor.removedTextBackground: var(--ctp-red) with transparency
    
    For layoutUtils.ts BRANCH_COLORS (lines 91-96):
    - main: "var(--ctp-peach)"
    - develop: "var(--ctp-green)"
    - feature: "var(--ctp-blue)"
    - release: "var(--ctp-mauve)"
    - hotfix: "var(--ctp-red)"
    - other: "var(--ctp-overlay0)"
    
    For CommitEdge.tsx branchTypeColors (lines 8-13): same mapping as layoutUtils.ts
    
    For TopologyPanel.tsx line 137: already uses var(--ctp-surface0), verify no other issues
  </action>
  <verify>grep -r "#[0-9a-fA-F]\{3,8\}" src/components/viewers/DiffViewer.tsx src/components/topology/ returns no matches (except comments)</verify>
  <done>Monaco editor and topology visualization use only Catppuccin CSS variables</done>
</task>

<task type="auto">
  <name>Task 2: Replace Tailwind gray/color classes in component files (batch 1)</name>
  <files>
    src/components/RecentRepos.tsx
    src/components/commit/CommitForm.tsx
    src/components/commit/ValidationErrors.tsx
    src/components/commit/BreakingChangeSection.tsx
    src/components/commit/CommitDetails.tsx
    src/components/changelog/ChangelogPreview.tsx
    src/components/changelog/ChangelogDialog.tsx
    src/components/staging/FileItem.tsx
    src/components/staging/FileList.tsx
    src/components/sync/SyncProgress.tsx
  </files>
  <action>
    Replace Tailwind color classes with Catppuccin equivalents in all listed files.
    
    Standard replacements:
    - text-gray-500 -> text-ctp-overlay0
    - text-gray-400 -> text-ctp-overlay1 or text-ctp-subtext0
    - text-gray-300 -> text-ctp-subtext1 or text-ctp-text
    - text-gray-200 -> text-ctp-text
    - bg-gray-950 -> bg-ctp-crust
    - bg-gray-900 -> bg-ctp-mantle
    - bg-gray-800 -> bg-ctp-surface0
    - bg-gray-800/50 -> bg-ctp-surface0/50
    - border-gray-800 -> border-ctp-surface0
    - border-gray-700 -> border-ctp-surface1
    - border-gray-600 -> border-ctp-surface2
    - text-blue-500/400 -> text-ctp-blue or text-ctp-sapphire
    - text-red-500/400 -> text-ctp-red or text-ctp-maroon
    - text-green-500/400 -> text-ctp-green or text-ctp-teal
    - text-yellow-500/400 -> text-ctp-yellow or text-ctp-peach
    - bg-red-500/10 -> bg-ctp-red/10
    - bg-green-500/10 -> bg-ctp-green/10
    - border-red-500/20 -> border-ctp-red/20
    - border-green-500/20 -> border-ctp-green/20
    - hover:bg-gray-800 -> hover:bg-ctp-surface0
    - hover:text-red-400 -> hover:text-ctp-red
    - focus:ring-blue-500 -> focus:ring-ctp-blue
  </action>
  <verify>grep -E "text-gray-|bg-gray-|border-gray-|text-blue-|text-red-|text-green-|text-yellow-|bg-blue-|bg-red-|bg-green-" for each file returns no matches</verify>
  <done>First batch of components use only ctp-* color classes</done>
</task>

<task type="auto">
  <name>Task 3: Replace Tailwind gray/color classes in component files (batch 2)</name>
  <files>
    src/components/stash/StashItem.tsx
    src/components/stash/StashList.tsx
    src/components/stash/StashDialog.tsx
    src/components/branches/BranchItem.tsx
    src/components/branches/BranchList.tsx
    src/components/branches/CreateBranchDialog.tsx
    src/components/branches/MergeDialog.tsx
    src/components/tags/TagItem.tsx
    src/components/tags/TagList.tsx
    src/components/tags/CreateTagDialog.tsx
    src/components/topology/TopologyCommitDetails.tsx
    src/components/viewers/FileViewer.tsx
    src/components/viewers/NugetPackageViewer.tsx
    src/components/gitflow/GitflowPanel.tsx
    src/components/gitflow/StartFlowDialog.tsx
    src/components/gitflow/FinishFlowDialog.tsx
  </files>
  <action>
    Apply same color class replacements as Task 2 to remaining component files.
    
    Use identical mapping:
    - gray-* -> ctp-crust/mantle/base/surface0-2/overlay0-2/subtext0-1/text
    - blue-* -> ctp-blue/sapphire
    - red-* -> ctp-red/maroon  
    - green-* -> ctp-green/teal
    - yellow-* -> ctp-yellow/peach
    
    Pay attention to context - use semantic colors appropriately:
    - Error states: ctp-red
    - Success states: ctp-green
    - Warning states: ctp-yellow or ctp-peach
    - Info/links: ctp-blue or ctp-sapphire
    - Muted text: ctp-overlay0/1
    - Normal text: ctp-text or ctp-subtext1
  </action>
  <verify>
    Run: grep -rE "text-gray-|bg-gray-|border-gray-|text-blue-|text-red-|text-green-|text-yellow-|bg-blue-|bg-red-|bg-green-" src/components/
    Expected: No matches found
  </verify>
  <done>All component files use exclusively ctp-* Tailwind classes for colors</done>
</task>

</tasks>

<verification>
1. grep -rE "#[0-9a-fA-F]{3,8}" src/ --include="*.tsx" --include="*.ts" --include="*.css" | grep -v node_modules | grep -v "\.svg" | grep -v "// ctp-" - should only show SVG assets (already using Catppuccin hex values)
2. grep -rE "text-gray-|bg-gray-|border-gray-|text-blue-|bg-blue-|text-red-|bg-red-|text-green-|bg-green-|text-yellow-" src/ - should return no matches
3. npm run build - should complete without errors
4. Visual inspection: Launch app and verify colors are consistent Catppuccin Mocha theme
</verification>

<success_criteria>
- Zero non-Catppuccin hex codes in TypeScript/CSS source files (excluding SVG assets)
- Zero Tailwind gray-*, blue-*, red-*, green-*, yellow-* classes in source
- All colors use ctp-* Tailwind classes or --ctp-* CSS variables
- Application builds successfully
- Visual appearance maintains intended contrast and readability
</success_criteria>

<output>
After completion, create `.planning/quick/019-standardize-app-colors-catppuccin-mocha/019-SUMMARY.md`
</output>
