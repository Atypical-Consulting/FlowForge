---
phase: quick-43
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/extensions/extensionReadme.ts
  - src/extensions/extensionCategories.ts
  - src/core/blades/extension-detail/ExtensionDetailBlade.tsx
  - src/core/blades/extension-manager/ExtensionManagerBlade.tsx
autonomous: true

must_haves:
  truths:
    - "Extension detail blade shows the rendered README.md content for that extension"
    - "Extension manager groups extensions by category instead of only built-in vs installed"
    - "Extensions without a README show a graceful empty state"
  artifacts:
    - path: "src/extensions/extensionReadme.ts"
      provides: "Static import map of all extension README.md files"
    - path: "src/extensions/extensionCategories.ts"
      provides: "Category definitions and extension-to-category mapping"
    - path: "src/core/blades/extension-detail/ExtensionDetailBlade.tsx"
      provides: "README rendering section in extension preview"
    - path: "src/core/blades/extension-manager/ExtensionManagerBlade.tsx"
      provides: "Category-based extension grouping"
  key_links:
    - from: "src/core/blades/extension-detail/ExtensionDetailBlade.tsx"
      to: "src/extensions/extensionReadme.ts"
      via: "import getExtensionReadme"
      pattern: "getExtensionReadme"
    - from: "src/core/blades/extension-detail/ExtensionDetailBlade.tsx"
      to: "src/core/components/markdown/MarkdownRenderer.tsx"
      via: "import MarkdownRenderer"
      pattern: "MarkdownRenderer"
    - from: "src/core/blades/extension-manager/ExtensionManagerBlade.tsx"
      to: "src/extensions/extensionCategories.ts"
      via: "import getExtensionCategory"
      pattern: "getExtensionCategory"
---

<objective>
Add README rendering to the extension detail blade and categorize extensions in the extension manager.

Purpose: When a user clicks into an extension's detail view, they should see the extension's README rendered as rich markdown. The extension manager should group extensions by functional category (Source Control, Viewers, Integration, Workflow, Setup) rather than just "Built-in" vs "Installed", giving users a clearer picture of what each extension does.

Output: Updated ExtensionDetailBlade with README section, updated ExtensionManagerBlade with category grouping, two new utility modules for README loading and category mapping.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/core/blades/extension-detail/ExtensionDetailBlade.tsx
@src/core/blades/extension-manager/ExtensionManagerBlade.tsx
@src/core/blades/extension-manager/components/ExtensionCard.tsx
@src/core/components/markdown/MarkdownRenderer.tsx
@src/extensions/extensionTypes.ts
@src/extensions/ExtensionHost.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create extension README loader and category mapping modules</name>
  <files>
    src/extensions/extensionReadme.ts
    src/extensions/extensionCategories.ts
  </files>
  <action>
Create `src/extensions/extensionReadme.ts`:
- Use `import.meta.glob("./*/README.md", { query: "?raw", import: "default", eager: true })` to statically import all README.md files from extension directories at build time.
- The glob returns `Record<string, string>` where keys are like `./github/README.md` and values are raw markdown content.
- Export a function `getExtensionReadme(extensionId: string): string | null` that extracts the ID from the glob key pattern (`./{id}/README.md`) and returns the matching content or null.

Create `src/extensions/extensionCategories.ts`:
- Define a `ExtensionCategory` type with values: `"source-control"`, `"viewers"`, `"integration"`, `"workflow"`, `"setup"`.
- Define a `CATEGORY_META` record mapping each category to `{ label: string; icon: string; order: number }`:
  - `source-control`: label "Source Control", order 1
  - `viewers`: label "Viewers", order 2
  - `integration`: label "Integration", order 3
  - `workflow`: label "Workflow", order 4
  - `setup`: label "Setup", order 5
- Define a `EXTENSION_CATEGORIES` record mapping extension IDs to categories:
  - `conventional-commits` -> `source-control`
  - `gitflow` -> `workflow`
  - `github` -> `integration`
  - `init-repo` -> `setup`
  - `viewer-3d` -> `viewers`
  - `viewer-code` -> `viewers`
  - `viewer-markdown` -> `viewers`
  - `worktrees` -> `source-control`
- Export `getExtensionCategory(extensionId: string): ExtensionCategory` defaulting to `"workflow"` for unknown extensions.
- Export `getCategoryMeta(category: ExtensionCategory): { label: string; order: number }`.
- Export `groupExtensionsByCategory(extensions: ExtensionInfo[]): Map<ExtensionCategory, ExtensionInfo[]>` that groups and sorts categories by order, and extensions within each category alphabetically by name.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v 'bindings.ts'` -- no new type errors.
Verify the glob pattern resolves: check that `import.meta.glob` pattern matches actual README.md file locations.
  </verify>
  <done>
Both modules exist, type-check cleanly, extensionReadme.ts can load README content by extension ID, extensionCategories.ts provides category mapping and grouping utility.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add README rendering to ExtensionDetailBlade</name>
  <files>
    src/core/blades/extension-detail/ExtensionDetailBlade.tsx
  </files>
  <action>
Modify `ExtensionDetailBlade.tsx` to render the extension's README:

1. Import `getExtensionReadme` from `../../../extensions/extensionReadme`.
2. Import `MarkdownRenderer` from `../../components/markdown/MarkdownRenderer`.
3. Import `BookOpen` from `lucide-react` (for the section icon).
4. After the existing "Actions" section at the bottom, add a new section:
   - Call `getExtensionReadme(extensionId)` to get the markdown content.
   - If content is not null, render a new `<Section title="Documentation" icon={BookOpen}>` containing `<MarkdownRenderer content={readmeContent} className="prose-sm" />`.
   - The MarkdownRenderer should be wrapped in a div with `max-h-[500px] overflow-y-auto` to prevent the README from dominating the blade, with a subtle top border for visual separation.
   - If content is null, do not render the section at all (graceful empty state).
5. Move the "Actions" div (the enable/disable/uninstall buttons at the bottom) to remain the very last element, so the order is: Header -> Status -> Error -> Permissions -> Live Contributions -> Manifest Contributions -> Documentation -> Actions.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v 'bindings.ts'` -- no new type errors.
Visually inspect: open the app, navigate to Extension Manager, click any extension (e.g., GitHub Integration) and confirm the README renders below the contributions sections.
  </verify>
  <done>
Extension detail blade displays rendered README.md content with proper markdown formatting, syntax highlighting, and scrollable container. Extensions without README show no documentation section.
  </done>
</task>

<task type="auto">
  <name>Task 3: Categorize extensions in ExtensionManagerBlade</name>
  <files>
    src/core/blades/extension-manager/ExtensionManagerBlade.tsx
  </files>
  <action>
Modify `ExtensionManagerBlade.tsx` to group extensions by category:

1. Import `groupExtensionsByCategory`, `getCategoryMeta`, and `type ExtensionCategory` from `../../../extensions/extensionCategories`.
2. Import `GitBranch`, `Eye`, `Globe`, `Workflow`, `FolderOpen` from `lucide-react` for category icons.
3. Define a local `CATEGORY_ICONS` map: `source-control` -> GitBranch, `viewers` -> Eye, `integration` -> Globe, `workflow` -> Workflow, `setup` -> FolderOpen.
4. Replace the existing `useMemo` that splits into `builtInExts` / `installedExts` with a new `useMemo` that:
   - Converts extensions Map to array and applies search filter (same logic).
   - Separates into `installedExts` (non-built-in) and `builtInExts` (built-in).
   - Calls `groupExtensionsByCategory(builtInExts)` to get `categorizedBuiltIn: Map<ExtensionCategory, ExtensionInfo[]>`.
   - Returns `{ installedExts, categorizedBuiltIn }`.
5. Replace the "Built-in" section in the JSX with a loop over `categorizedBuiltIn` entries (already sorted by category order from the grouping function):
   - For each `[category, exts]` entry, render a `<section>` with:
     - `<h3>` showing the category icon (from CATEGORY_ICONS), the category label (from getCategoryMeta), and the count badge (same style as existing).
     - The list of `<ExtensionCard>` components for that category's extensions.
6. Keep the "Installed" section at the top (unchanged, for user-installed non-built-in extensions).
7. Keep the empty state logic (show when no extensions match search).
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v 'bindings.ts'` -- no new type errors.
Visually inspect: open the Extension Manager blade and confirm extensions are grouped under category headings (Source Control, Viewers, Integration, Workflow, Setup) with appropriate icons and counts.
  </verify>
  <done>
Extension Manager displays extensions grouped by functional category with icons, labels, and counts. Search still filters across all categories. Installed (non-built-in) extensions remain in their own section at the top.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit 2>&1 | grep -v 'bindings.ts'` passes with no new errors
- Extension Detail Blade: clicking any extension in the manager shows its README rendered as markdown below the contributions sections
- Extension Manager Blade: built-in extensions are grouped by category (Source Control, Viewers, Integration, Workflow, Setup) instead of a flat "Built-in" list
- Search in Extension Manager still works across all categories
- Extensions without README files show no documentation section (no crash, no empty section)
</verification>

<success_criteria>
- README content renders in extension detail with full markdown formatting (headings, tables, code blocks, lists)
- Extension manager shows 5 category groups for built-in extensions with icons and counts
- No TypeScript errors introduced
- No visual regressions in existing extension card or detail layout
</success_criteria>

<output>
After completion, create `.planning/quick/43-extension-preview-should-render-readme-f/43-SUMMARY.md`
</output>
