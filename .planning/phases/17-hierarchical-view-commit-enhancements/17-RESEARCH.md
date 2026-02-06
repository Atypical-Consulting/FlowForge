# Phase 17: Hierarchical View & Commit Enhancements - Research

**Researched:** 2026-02-06
**Domain:** React UI components (file tree staging, conventional commit theming, changelog icons)
**Confidence:** HIGH

## Summary

This phase enhances two existing capabilities: (1) the hierarchical staging tree to support folder-level stage/unstage with proper indeterminate states, uniform icon spacing, and (2) color-coded conventional commit type icons applied consistently across the topology graph, commit history, changelog preview, and generated changelog markdown.

The codebase already has mature implementations for all four areas being enhanced. The hierarchical `FileTreeView` component builds a tree from file paths, the `TypeSelector` already defines `TYPE_ICONS` and `TYPE_COLORS` mappings for all 11 commit types, and the Rust backend generates changelog markdown via Tera templates. The work is purely additive -- extending existing patterns rather than introducing new architectural concepts.

**Primary recommendation:** Extract the existing `TYPE_ICONS` and `TYPE_COLORS` maps from `TypeSelector.tsx` into a shared module (e.g., `src/lib/commit-type-theme.ts`) so they can be consumed by `CommitBadge`, `CommitHistory`, `ChangelogPreview`, and any future consumers without duplication. For folder staging, add a new Rust `stage_files` (batch) command that accepts a `Vec<String>` of paths, then use it from the frontend when staging/unstaging folders.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
No locked decisions -- all areas deferred to Claude's discretion.

### Claude's Discretion
All areas deferred to Claude's judgment. The following guidance applies:

**Folder staging behavior:**
- Folder stage/unstage button should toggle all files within that folder
- Mixed state (some staged, some not) should show a partial/indeterminate indicator
- Clicking stage on a partially-staged folder stages all remaining unstaged files
- Clicking unstage on a partially-staged folder unstages all staged files

**Tree layout & spacing:**
- Uniform icon widths across all nesting depths -- use fixed-width icon containers
- Consistent icon-to-text spacing regardless of file type icon
- Follow existing indentation patterns in the codebase

**Commit type color scheme:**
- Map conventional commit types to Catppuccin palette colors already in the theme
- Colors should be distinct and recognizable at a glance
- Apply consistently: topology graph, commit lists, changelogs, anywhere commit types appear

**Changelog commit icons:**
- Include the colored commit type icon inline next to each changelog entry
- Keep it subtle -- icon + text, not badges or separate columns

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

No new libraries needed. This phase uses the existing stack exclusively.

### Core (Already Installed)
| Library | Purpose | Relevant Usage |
|---------|---------|----------------|
| React 18 | UI framework | All components |
| Tailwind CSS v4 | Utility CSS | `ctp-*` color tokens, spacing |
| @catppuccin/tailwindcss | Theme tokens | `--color-ctp-*` CSS custom properties |
| lucide-react | Icons | `Sparkles`, `Bug`, `FileText`, etc. for commit types |
| framer-motion | Animations | TypeSelector grid buttons (whileHover/whileTap) |
| class-variance-authority | Variant styling | Button component variants |
| zustand | State management | `useStagingStore`, `useConventionalStore` |
| @tanstack/react-query | Data fetching | `stagingStatus` query with 2s refetch |
| Tauri v2 (Rust) | Backend commands | `stage_file`, `unstage_file`, `stage_all` |
| git2 (Rust) | Git operations | Index manipulation for staging |
| tera (Rust) | Templating | Changelog markdown generation |

### Not Needed
| Library | Why Not |
|---------|---------|
| react-checkbox-tree | Overkill -- existing tree is simple enough to extend |
| any indeterminate checkbox library | Native HTML `indeterminate` property + Tailwind suffices |

## Architecture Patterns

### Current File Structure (Relevant Files)
```
src/
  components/
    staging/
      StagingPanel.tsx       # Top-level staging view (tree/flat toggle)
      FileTreeView.tsx       # Hierarchical tree builder + TreeNode renderer
      FileItem.tsx           # Individual file row (stage/unstage per file)
      FileList.tsx           # Flat list view
      FileTreeSearch.tsx     # Search/filter input
    topology/
      CommitBadge.tsx        # Topology graph commit badge (has ICON_MAP)
      layoutUtils.ts         # parseConventionalType(), branch colors
    commit/
      TypeSelector.tsx       # TYPE_ICONS + TYPE_COLORS (commit form)
      CommitHistory.tsx      # Commit list (uses generic GitCommit icon)
      CommitDetails.tsx      # Commit detail view (no commit type awareness)
    changelog/
      ChangelogPreview.tsx   # Rendered changelog (no commit type icons)
      ChangelogDialog.tsx    # Dialog wrapper
    icons/
      FileTypeIcon.tsx       # File type icon component (w-4 h-4 shrink-0)
  stores/
    staging.ts               # viewMode, selectedFile state
    conventional.ts          # COMMIT_TYPES, COMMIT_TYPE_LABELS, form state
    changelogStore.ts        # Changelog generation state
  lib/
    file-icons.ts            # File extension -> icon mapping
src-tauri/src/git/
    staging.rs               # stage_file, unstage_file, stage_all, unstage_all
    changelog.rs             # generate_changelog (Tera templates)
    conventional.rs          # CommitType enum, validation, inference
```

### Pattern 1: Shared Commit Type Theme Module (NEW)
**What:** Extract `TYPE_ICONS` and `TYPE_COLORS` into a shared module
**Why:** Currently duplicated between `TypeSelector.tsx` (has both icons and colors) and `CommitBadge.tsx` (has only icons, no colors). CommitHistory and ChangelogPreview have neither.
**Location:** `src/lib/commit-type-theme.ts`
**Structure:**
```typescript
// src/lib/commit-type-theme.ts
import type { ElementType } from "react";
import {
  Bug, FileText, Hammer, Package, Paintbrush,
  Rocket, Settings, Sparkles, TestTube, Undo, Zap,
} from "lucide-react";

export type ConventionalCommitType =
  | "feat" | "fix" | "docs" | "style" | "refactor"
  | "perf" | "test" | "chore" | "ci" | "build" | "revert";

export const COMMIT_TYPE_ICONS: Record<ConventionalCommitType, ElementType> = {
  feat: Sparkles,
  fix: Bug,
  docs: FileText,
  style: Paintbrush,
  refactor: Hammer,
  perf: Zap,
  test: TestTube,
  chore: Settings,
  ci: Rocket,
  build: Package,
  revert: Undo,
};

// Catppuccin color classes for each commit type
export const COMMIT_TYPE_COLORS: Record<ConventionalCommitType, string> = {
  feat: "text-ctp-green",
  fix: "text-ctp-red",
  docs: "text-ctp-blue",
  style: "text-ctp-pink",
  refactor: "text-ctp-peach",
  perf: "text-ctp-yellow",
  test: "text-ctp-teal",
  chore: "text-ctp-lavender",
  ci: "text-ctp-sky",
  build: "text-ctp-maroon",
  revert: "text-ctp-mauve",
};

// Badge-style colors (icon color + background + border)
export const COMMIT_TYPE_BADGE_COLORS: Record<ConventionalCommitType, string> = {
  feat: "text-ctp-green bg-ctp-green/10 border-ctp-green/30",
  fix: "text-ctp-red bg-ctp-red/10 border-ctp-red/30",
  docs: "text-ctp-blue bg-ctp-blue/10 border-ctp-blue/30",
  style: "text-ctp-pink bg-ctp-pink/10 border-ctp-pink/30",
  refactor: "text-ctp-peach bg-ctp-peach/10 border-ctp-peach/30",
  perf: "text-ctp-yellow bg-ctp-yellow/10 border-ctp-yellow/30",
  test: "text-ctp-teal bg-ctp-teal/10 border-ctp-teal/30",
  chore: "text-ctp-lavender bg-ctp-lavender/10 border-ctp-lavender/30",
  ci: "text-ctp-sky bg-ctp-sky/10 border-ctp-sky/30",
  build: "text-ctp-maroon bg-ctp-maroon/10 border-ctp-maroon/30",
  revert: "text-ctp-mauve bg-ctp-mauve/10 border-ctp-mauve/30",
};
```
This matches the exact color mapping already used in `TypeSelector.tsx` (line-by-line identical), making it a direct extraction, not a new design.

### Pattern 2: Folder Stage/Unstage in Tree View
**What:** Add stage/unstage buttons to folder nodes in `FileTreeView.tsx`
**How it works:**
1. `TreeNode` for directories gets a hover-visible stage/unstage button (like `FileItem` has)
2. Determine folder staging state: `all-staged`, `none-staged`, `partial` (mixed)
3. For the staging section view, this info comes from comparing the folder's files against which section they are in
4. The `FileTreeView` already receives a `section` prop ("staged" / "unstaged" / "untracked") and `files` -- but to know mixed state, it needs awareness of files in OTHER sections too

**Key architectural insight:** Currently `StagingPanel` renders three separate `FileTreeView` instances (one for staged, one for unstaged, one for untracked). A folder may have files across multiple sections. For folder-level staging to work correctly:
- The "unstaged" section's tree needs to know which of its folder's files are also in the "staged" section (for partial indicator)
- OR, simpler: each `FileTreeView` only shows files in its section, and the stage/unstage button on a folder stages/unstages ALL files within that folder IN THAT SECTION
- This simpler approach matches the user's requirements: "Clicking stage on a partially-staged folder stages all remaining unstaged files" -- that folder only appears in the unstaged section with the remaining files

**Decision: Use the simpler per-section approach.** A folder in the "Changes" (unstaged) section shows only unstaged files. Clicking "stage" on it stages all files in that folder. If some files from that folder are already staged, they won't appear in this section at all.

### Pattern 3: Batch Stage Command (NEW Rust Command)
**What:** A new `stage_files` Tauri command that accepts multiple paths
**Why:** Currently only `stage_file` (single) and `stage_all` exist. Folder staging needs to stage multiple specific files in one operation.
**Implementation:**
```rust
#[tauri::command]
#[specta::specta]
pub async fn stage_files(paths: Vec<String>, state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let mut index = repo.index()?;

        for path in &paths {
            let file_path = Path::new(path);
            let full_path = repo_path.join(file_path);
            if full_path.exists() {
                index.add_path(file_path)?;
            } else {
                index.remove_path(file_path)?;
            }
        }

        index.write()?;
        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```
Similarly, `unstage_files` for batch unstaging.

### Pattern 4: Uniform Icon Spacing in Tree
**What:** Fixed-width icon containers at every nesting depth
**Current problem:** `FileTreeView.tsx` uses `gap-1` between chevron, icon, and text with dynamic padding. `FileItem.tsx` uses `gap-2` with different padding. The inconsistency causes misalignment between folder rows and file rows.
**Solution:** Use a consistent icon container strategy:
```
[indent padding][chevron-container: w-4][icon-container: w-4][gap-1.5][text]
```
- Chevron container: `w-4 flex items-center justify-center` (empty for leaf files)
- Icon container: `w-4 flex items-center justify-center` (FileTypeIcon or FolderIcon)
- Fixed gap between icon and text: `gap-1.5`
- Indent: `paddingLeft: depth * 16px` (consistent step)

### Pattern 5: Changelog Template Enhancement (Rust)
**What:** Add commit type emoji/marker to the Tera changelog templates
**Current templates:** Plain markdown with `- **scope:** description` format
**Enhanced templates should add:** A type indicator prefix. Since changelogs are markdown, the approach is to include a Unicode character or text marker for each type.
**Two options:**
1. **Emoji approach** (visual in rendered markdown): `- :sparkles: **scope:** description`
2. **Text label approach** (works in plain text): `- [feat] **scope:** description`

**Recommendation:** Use a simple mapping in the Rust template. The `CommitGroup` already has `commit_type` field. Add a custom Tera filter or include the type in the template context. The frontend `ChangelogPreview` can then render these with colored icons by parsing the commit type from each group.

For the frontend preview specifically: since the `ChangelogOutput` struct already returns structured `groups` with `commit_type`, the `ChangelogPreview` component can render rich icons directly from the data -- no need to parse markdown. The markdown template only needs a simple text marker for clipboard/export use.

### Anti-Patterns to Avoid
- **Don't pass all files to every TreeView:** Each `FileTreeView` should only receive files for its section. Mixed state at the folder level is unnecessary complexity since each section is rendered independently.
- **Don't call `stageFile` N times for a folder:** Use a single batch command to avoid N separate git operations and N separate query invalidations.
- **Don't hardcode colors in each component:** Use the shared theme module.
- **Don't modify the Rust `ChangelogCommit` struct just for icons:** The icon rendering is a frontend concern. The Rust template just needs a text marker.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Indeterminate checkbox visual | Custom SVG icon | CSS `[data-state="indeterminate"]` pattern or a `Minus` Lucide icon | Well-established pattern, accessible |
| Batch git staging | Loop calling `stageFile` N times | Single `stage_files` Rust command with `Vec<String>` | Atomicity, performance (one index write) |
| Commit type color mapping | Per-component constants | Shared `src/lib/commit-type-theme.ts` module | Already exists (duplicated), just extract |
| Changelog icons in markdown | Custom markdown renderer | Tera template with emoji/label + structured `groups` data for frontend rendering | Separation of concerns |

## Common Pitfalls

### Pitfall 1: Query Invalidation Storm
**What goes wrong:** Calling `stageFile` per file in a folder triggers N mutations, each invalidating `["stagingStatus"]`, causing N refetches during the operation.
**Why it happens:** The current `FileItem` calls `commands.stageFile(file.path)` with individual mutation + invalidation.
**How to avoid:** Implement a batch `stage_files` command and call it once per folder action. Invalidate queries once after the batch completes.
**Warning signs:** UI flickers or freezes when staging a folder with many files.

### Pitfall 2: Tree Expansion State Loss on Re-render
**What goes wrong:** When `stagingStatus` refetches (every 2s), the tree re-renders and may lose expanded/collapsed state of folders.
**Why it happens:** `FileTreeView` builds the tree in `useMemo` from `filteredFiles`. The `TreeNode` component uses local `useState(true)` for expansion.
**How to avoid:** The current approach (useState per TreeNode) actually survives re-renders as long as React reconciles correctly by key. The `key={node.path}` ensures stable identity. Monitor this but it should be fine.

### Pitfall 3: Inconsistent Commit Type Parsing
**What goes wrong:** Different components parse commit types differently, leading to some recognizing a type while others don't.
**Why it happens:** `layoutUtils.ts` has its own `parseConventionalType()` regex. The Rust backend uses `git-conventional` crate.
**How to avoid:** Use the existing `parseConventionalType()` from `layoutUtils.ts` everywhere on the frontend. It already handles all 11 types with proper regex.

### Pitfall 4: Icon Width Inconsistency with SVG File Icons
**What goes wrong:** SVG file type icons from `src/assets/icons/file-types/` have varying intrinsic sizes, causing misalignment even with `w-4 h-4`.
**Why it happens:** The `FileTypeIcon` component applies `w-4 h-4 shrink-0` but the SVG viewBox sizes may differ.
**How to avoid:** Ensure the icon container is a fixed-width flex container (`w-4 flex items-center justify-center`) rather than relying on the icon's own sizing. The `shrink-0` is already there but a container is more robust.

### Pitfall 5: Changelog Template Must Stay Backend-Renderable
**What goes wrong:** Adding frontend-specific markup (like React component references) to the Tera template.
**Why it happens:** Temptation to embed HTML/JSX in the changelog markdown.
**How to avoid:** The markdown template should use plain text markers (emoji or `[type]` labels). The `ChangelogPreview` component renders rich icons from the structured `groups` data, NOT from parsing the markdown string.

## Code Examples

### Example 1: Folder Node with Stage/Unstage Button (TreeNode Enhancement)
```typescript
// In FileTreeView.tsx - Enhanced TreeNode for directories
function TreeNode({ node, section, depth, onFileSelect, onStageFolder }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);

  if (!node.isDirectory && node.file) {
    return (
      <div className="relative">
        <IndentGuides depth={depth} />
        <FileItem
          file={node.file}
          section={section}
          depth={depth}
          showFilenameOnly
          onFileSelect={onFileSelect}
        />
      </div>
    );
  }

  const childNodes = Array.from(node.children.values());
  // Collect all files recursively for folder staging
  const allFiles = collectAllFiles(node);

  return (
    <div>
      <div className="relative group">
        <IndentGuides depth={depth} />
        <div
          className={cn(
            "flex items-center px-2 py-1",
            "hover:bg-ctp-surface0/50 text-sm text-ctp-subtext0 w-full",
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {/* Fixed-width chevron container */}
          <button
            type="button"
            className="w-4 flex items-center justify-center shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          {/* Fixed-width icon container */}
          <div className="w-4 flex items-center justify-center shrink-0 ml-1">
            <FileTypeIcon path={node.path} isDirectory isOpen={expanded} />
          </div>
          <span className="ml-1.5 flex-1 truncate">{node.name}</span>
          {/* Stage/Unstage button - visible on hover */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStageFolder?.(allFiles.map(f => f.path));
            }}
            className={cn(
              "opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity shrink-0",
              section === "staged"
                ? "hover:bg-ctp-red/20 text-ctp-red"
                : "hover:bg-ctp-green/20 text-ctp-green",
            )}
            title={section === "staged" ? "Unstage folder" : "Stage folder"}
          >
            {section === "staged" ? (
              <X className="w-3 h-3" />
            ) : (
              <Check className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
      {expanded && (
        <div>
          {childNodes.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              section={section}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              onStageFolder={onStageFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to collect all leaf files from a tree node
function collectAllFiles(node: FileTreeNode): FileChange[] {
  const files: FileChange[] = [];
  if (node.file) files.push(node.file);
  for (const child of node.children.values()) {
    files.push(...collectAllFiles(child));
  }
  return files;
}
```

### Example 2: CommitTypeIcon Shared Component
```typescript
// src/components/icons/CommitTypeIcon.tsx
import { GitCommit } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  COMMIT_TYPE_COLORS,
  COMMIT_TYPE_ICONS,
  type ConventionalCommitType,
} from "../../lib/commit-type-theme";
import { parseConventionalType } from "../topology/layoutUtils";

interface CommitTypeIconProps {
  /** Either pass a commit type directly or a commit message to parse */
  commitType?: ConventionalCommitType;
  message?: string;
  className?: string;
  /** If true, apply the type's color. If false, use inherited color */
  colored?: boolean;
}

export function CommitTypeIcon({
  commitType,
  message,
  className,
  colored = true,
}: CommitTypeIconProps) {
  const type = commitType || (message ? parseConventionalType(message) : null);
  const Icon = type && COMMIT_TYPE_ICONS[type as ConventionalCommitType]
    ? COMMIT_TYPE_ICONS[type as ConventionalCommitType]
    : GitCommit;
  const colorClass = type && colored
    ? COMMIT_TYPE_COLORS[type as ConventionalCommitType]
    : undefined;

  return <Icon className={cn("w-4 h-4 shrink-0", colorClass, className)} />;
}
```

### Example 3: Enhanced CommitBadge with Colored Icons
```typescript
// In CommitBadge.tsx - use shared theme
import { COMMIT_TYPE_COLORS, COMMIT_TYPE_ICONS } from "../../lib/commit-type-theme";

// Replace existing ICON_MAP with:
const Icon = (commitType && COMMIT_TYPE_ICONS[commitType as ConventionalCommitType]) || GitCommit;
const iconColor = commitType
  ? COMMIT_TYPE_COLORS[commitType as ConventionalCommitType]
  : "text-ctp-overlay1";

// In JSX:
<Icon className={cn("w-3 h-3 shrink-0", iconColor)} />
```

### Example 4: Enhanced CommitHistory with Colored Icons
```typescript
// In CommitHistory.tsx - add commit type awareness
import { CommitTypeIcon } from "../icons/CommitTypeIcon";

// Replace the generic GitCommit icon in the Virtuoso itemContent:
<CommitTypeIcon message={commit.messageSubject} className="w-4 h-4 mt-0.5" />
```

### Example 5: ChangelogPreview with Colored Group Headers and Commit Icons
```typescript
// In ChangelogPreview.tsx - render rich icons from structured data
import { CommitTypeIcon } from "../icons/CommitTypeIcon";
import { COMMIT_TYPE_COLORS } from "../../lib/commit-type-theme";

// In the group breakdown section:
{changelog.groups.map((group) => (
  <div key={group.commitType}>
    <h4 className="flex items-center gap-2 text-sm font-medium text-ctp-subtext1 mb-1">
      <CommitTypeIcon commitType={group.commitType} className="w-4 h-4" />
      <span>{group.title}</span>
    </h4>
    {group.commits.map((commit) => (
      <div key={commit.hash} className="flex items-center gap-2 text-sm py-0.5 pl-6">
        <CommitTypeIcon commitType={group.commitType} className="w-3 h-3" />
        <span className="text-ctp-subtext1">
          {commit.scope && <strong>{commit.scope}: </strong>}
          {commit.description}
        </span>
      </div>
    ))}
  </div>
))}
```

### Example 6: Tera Template with Emoji Markers
```rust
// In changelog.rs - Enhanced template with emoji
const DEFAULT_TEMPLATE: &str = r#"# Changelog

{% for group in groups %}
## {{ group.emoji }} {{ group.title }}

{% for commit in group.commits %}
- {% if commit.scope %}**{{ commit.scope }}:** {% endif %}{{ commit.description }}{% if commit.breaking %} **BREAKING**{% endif %} ([{{ commit.hash }}])
{% endfor %}

{% endfor %}
"#;

// Add emoji field to CommitGroup:
fn get_type_emoji(commit_type: &str) -> &'static str {
    match commit_type {
        "feat" => "\u{2728}",    // sparkles
        "fix" => "\u{1F41B}",    // bug
        "docs" => "\u{1F4DD}",   // memo
        "style" => "\u{1F3A8}",  // artist palette
        "refactor" => "\u{1F528}", // hammer
        "perf" => "\u{26A1}",    // zap
        "test" => "\u{1F9EA}",   // test tube
        "chore" => "\u{2699}\u{FE0F}", // gear
        "ci" => "\u{1F680}",     // rocket
        "build" => "\u{1F4E6}",  // package
        "revert" => "\u{21A9}\u{FE0F}", // reverse arrow
        _ => "\u{1F4CB}",        // clipboard
    }
}
```

## State of the Art

| Current State | Enhancement | Impact |
|--------------|-------------|--------|
| Files can only be staged individually or all-at-once | Folder-level batch stage/unstage | Granular control without tedium |
| CommitBadge icons are monochrome `text-ctp-overlay1` | Color per commit type using Catppuccin palette | Instant visual identification of commit types in topology |
| CommitHistory uses generic `GitCommit` icon for all commits | Colored CommitTypeIcon per commit | Rich commit type information in history |
| ChangelogPreview shows plain text breakdown | Colored icons per group and per commit | Visual changelog preview |
| Generated changelog markdown has no type indicators | Emoji prefix per group section | Better markdown rendering |
| Tree icons have inconsistent widths due to gap/padding variance | Fixed-width icon containers with uniform spacing | Clean, aligned tree at all depths |
| TYPE_ICONS defined in TypeSelector, ICON_MAP in CommitBadge | Shared `commit-type-theme.ts` module | Single source of truth |

## Catppuccin Color Mapping for Commit Types

Available accent colors in the Catppuccin Mocha palette (all available as `ctp-*` Tailwind classes):

| Color Token | Hex (Mocha) | Commit Type | Rationale |
|-------------|-------------|-------------|-----------|
| `ctp-green` | #a6e3a1 | feat | Green = new/growth, universally associated with features |
| `ctp-red` | #f38ba8 | fix | Red = bugs/errors, strong association |
| `ctp-blue` | #89b4fa | docs | Blue = information/documentation |
| `ctp-pink` | #f5c2e7 | style | Pink = aesthetic/visual changes |
| `ctp-peach` | #fab387 | refactor | Peach/orange = restructuring, change |
| `ctp-yellow` | #f9e2af | perf | Yellow = lightning/speed optimization |
| `ctp-teal` | #94e2d5 | test | Teal = testing/verification (distinct from green) |
| `ctp-lavender` | #b4befe | chore | Lavender = subtle/maintenance |
| `ctp-sky` | #89dceb | ci | Sky = cloud/pipeline |
| `ctp-maroon` | #eba0ac | build | Maroon = building/construction |
| `ctp-mauve` | #cba6f7 | revert | Mauve/purple = undo/reverse |

This is the exact same mapping already used in `TypeSelector.tsx` (verified line-by-line). The colors are all distinct and recognizable at a glance across both Mocha (dark) and Latte (light) flavors.

Remaining unused accent colors (available for future use): `ctp-rosewater`, `ctp-flamingo`, `ctp-sapphire`.

## Existing Duplication to Consolidate

Currently, commit type icon mappings exist in THREE separate locations:

1. **`src/components/commit/TypeSelector.tsx`** -- `TYPE_ICONS` (11 entries) + `TYPE_COLORS` (11 entries with bg/border)
2. **`src/components/topology/CommitBadge.tsx`** -- `ICON_MAP` (11 entries, same icons, NO colors)
3. **`src/components/topology/layoutUtils.ts`** -- `parseConventionalType()` (regex parser)

All three use the same 11 Lucide icons in the same mapping. Phase 17 MUST consolidate these into a single shared module before adding more consumers.

## Files That Need Modification

### Frontend (React/TypeScript)
| File | Change | Requirement |
|------|--------|-------------|
| **NEW** `src/lib/commit-type-theme.ts` | Shared type icons, colors, parsing | CCMT-01 |
| **NEW** `src/components/icons/CommitTypeIcon.tsx` | Reusable commit type icon component | CCMT-01 |
| `src/components/staging/FileTreeView.tsx` | Add folder stage/unstage buttons, fix icon spacing | UIPX-03, UIPX-04 |
| `src/components/staging/FileItem.tsx` | Align icon spacing with tree | UIPX-04 |
| `src/components/staging/StagingPanel.tsx` | Wire folder staging callbacks | UIPX-03 |
| `src/components/topology/CommitBadge.tsx` | Use shared theme, apply colors | CCMT-01 |
| `src/components/commit/TypeSelector.tsx` | Import from shared theme | CCMT-01 |
| `src/components/commit/CommitHistory.tsx` | Replace GitCommit with CommitTypeIcon | CCMT-01 |
| `src/components/changelog/ChangelogPreview.tsx` | Add colored icons to preview | CCMT-02 |
| `src/stores/staging.ts` | (Minor) No change needed - viewMode/selection already handled |

### Backend (Rust)
| File | Change | Requirement |
|------|--------|-------------|
| `src-tauri/src/git/staging.rs` | Add `stage_files` and `unstage_files` batch commands | UIPX-03 |
| `src-tauri/src/lib.rs` | Register new commands | UIPX-03 |
| `src-tauri/src/git/changelog.rs` | Add emoji to changelog templates, add emoji field to CommitGroup | CCMT-02 |

### Auto-generated
| File | Change | Requirement |
|------|--------|-------------|
| `src/bindings.ts` | Auto-regenerated after Rust changes (specta) | UIPX-03, CCMT-02 |

## Open Questions

1. **Emoji in markdown changelog vs text labels**
   - What we know: The Tera template generates markdown. Emoji render well in GitHub/GitLab markdown. Text labels `[feat]` are more universal.
   - What's unclear: User preference for emoji vs text in exported changelogs.
   - Recommendation: Use emoji -- it's visually consistent with the colored icons in the app, and renders well in modern markdown renderers. The frontend preview renders from structured data anyway.

2. **Partial state indicator: Minus icon vs indeterminate checkbox**
   - What we know: The user said "partial/indeterminate indicator" for mixed-state folders.
   - What's unclear: Exact visual treatment.
   - Recommendation: Use a `Minus` Lucide icon in the same position as the `Check`/`X` stage button, with `text-ctp-yellow` to indicate partial state. This is consistent with how indeterminate checkboxes are typically rendered and doesn't require a real checkbox element.
   - Note: This is only relevant if a folder view were to show across sections. In the per-section approach, every folder in a section is fully stageable/unstageable within that section. The partial indicator is primarily visual feedback, not functional state.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: Direct reading of all files listed in the Architecture Patterns section
- `@catppuccin/tailwindcss/mocha.css`: 18 accent color tokens verified
- `TypeSelector.tsx` lines 26-47: Existing TYPE_ICONS and TYPE_COLORS mappings (exact source of truth)
- `staging.rs`: Full Tauri command implementations for stage/unstage operations
- `changelog.rs`: Tera template structure, CommitGroup/ChangelogCommit data model

### Secondary (MEDIUM confidence)
- HTML `indeterminate` property for checkbox elements (well-documented web standard)
- git2 Rust crate `Index::add_path` supports batch operations within a single index write

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, existing codebase fully analyzed
- Architecture: HIGH - Direct extraction/extension of existing patterns
- Pitfalls: HIGH - Based on actual code analysis (query invalidation, tree re-rendering)
- Color mapping: HIGH - Identical to existing TypeSelector.tsx implementation

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable domain, no external dependency changes expected)
