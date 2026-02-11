# Quick Task 43: Extension Preview README + Extension Manager Categories

## What Changed

### New Files
- **`src/extensions/extensionReadme.ts`** — Uses `import.meta.glob` with `?raw` to statically bundle all extension README.md files at build time. Exports `getExtensionReadme(extensionId)` returning markdown string or null.
- **`src/extensions/extensionCategories.ts`** — Defines 5 extension categories (Source Control, Viewers, Integration, Workflow, Setup) with metadata, per-extension mapping, and `groupExtensionsByCategory()` utility.

### Modified Files
- **`src/core/blades/extension-detail/ExtensionDetailBlade.tsx`** — Added "Documentation" section that renders the extension's README.md using `MarkdownRenderer` in a scrollable container (max 500px). Extensions without a README show no section.
- **`src/core/blades/extension-manager/ExtensionManagerBlade.tsx`** — Replaced flat "Built-in" section with category-based grouping. Each category shows an icon (GitBranch, Eye, Globe, Workflow, FolderOpen), label, and count badge. Search filters across all categories.

## Commits
1. `956eccb` — feat(quick-43): add extension README loader and category mapping modules
2. `4e13a87` — feat(quick-43): render extension README in detail blade
3. `64f36ce` — feat(quick-43): categorize extensions in Extension Manager

## Verification
- TypeScript: `npx tsc --noEmit` passes (no new errors)
- All 8 built-in extensions have README.md files and are mapped to categories
