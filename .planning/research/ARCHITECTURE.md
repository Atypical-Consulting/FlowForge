# Architecture Patterns: v1.8.0 UI/UX Enhancement Features

**Domain:** Desktop Git client UI/UX enhancements (diff viewer, conflict resolution, insights, layouts, welcome screen, branch visualization)
**Researched:** 2026-02-12
**Overall confidence:** HIGH (based on direct codebase analysis + verified external sources)

---

## Table of Contents

1. [Existing Architecture Summary](#existing-architecture-summary)
2. [Question 1: Where Do New Rust Commands Go?](#question-1-where-do-new-rust-commands-go)
3. [Question 2: How Do New Blades Fit the Blade Registry?](#question-2-how-do-new-blades-fit-the-blade-registry)
4. [Question 3: How Does Line-Level Staging Interact with GitOps Store?](#question-3-how-does-line-level-staging-interact-with-gitops-store)
5. [Question 4: How Do Workspace Layout Presets Integrate with Preferences?](#question-4-how-do-workspace-layout-presets-integrate-with-preferences)
6. [Question 5: Should Insights Dashboard Be Extension or Core?](#question-5-should-insights-dashboard-be-extension-or-core)
7. [Question 6: How Does Three-Way Merge Work with Monaco Editor?](#question-6-how-does-three-way-merge-work-with-monaco-editor)
8. [Question 7: What New Data Flows for Avatars and Heat Maps?](#question-7-what-new-data-flows-for-avatars-and-heat-maps)
9. [Component Inventory: New vs Modified](#component-inventory-new-vs-modified)
10. [Recommended Build Order](#recommended-build-order)

---

## Existing Architecture Summary

Before diving into integration points, here is the relevant architecture:

### Rust Backend (`src-tauri/src/git/`)
- **Module-per-domain:** `diff.rs`, `merge.rs`, `staging.rs`, `history.rs`, `graph.rs`, etc.
- Each module exports `#[tauri::command]` + `#[specta::specta]` functions
- All commands registered in `lib.rs` via `collect_commands![]`
- Specta auto-generates TypeScript bindings to `src/bindings.ts`
- All commands receive `State<'_, RepositoryState>` for repo access
- Heavy operations use `tokio::task::spawn_blocking` for git2 calls

### Frontend Architecture
- **Navigation:** XState v5 `navigationMachine` with `ProcessType = "staging" | "topology"` and blade stack (push/pop/replace/reset)
- **Blades:** 9 core blades + 13 extension blades, registered via `registerBlade()` in `registration.ts` files or `ExtensionAPI.registerBlade()`
- **Stores:** 3 domain stores (`useGitOpsStore`, `useUIStore`, `usePreferencesStore`) composed of slices
- **Data fetching:** `@tanstack/react-query` for all Tauri command calls, with query key invalidation on `repository-changed` events
- **Extensions:** 13 built-in extensions registered in `App.tsx` via `registerBuiltIn()`, each with `onActivate(api)` / `onDeactivate()` lifecycle

### Key Patterns
- Core blades register in `src/core/blades/{name}/registration.ts` (auto-discovered by `_discovery.ts` via `import.meta.glob`)
- Extension blades register with `coreOverride: true` to use bare type names (no `ext:` prefix)
- Monaco `DiffEditor` used for all diff viewing (inline + side-by-side toggle)
- `SplitPaneLayout` wraps `react-resizable-panels` with `autoSaveId` for persistence
- Preferences persist via `tauri-plugin-store` to `settings.json`

---

## Question 1: Where Do New Rust Commands Go?

### Conflict Resolution Commands

**Location:** `src-tauri/src/git/merge.rs` (extend existing module)

The existing `merge.rs` already has `merge_branch`, `get_merge_status`, and `abort_merge`. New conflict resolution commands belong here because they are part of the merge workflow.

**New commands to add to `merge.rs`:**

```rust
/// Get the three-way content (base, ours, theirs) for a conflicted file.
/// Uses git2 IndexConflicts iterator to access conflict entries,
/// then reads blob content for each stage.
#[tauri::command]
#[specta::specta]
pub async fn get_conflict_file(
    path: String,
    state: State<'_, RepositoryState>,
) -> Result<ConflictFile, GitError> { ... }

/// Resolve a conflict by writing chosen content to the working tree
/// and marking it as resolved in the index.
#[tauri::command]
#[specta::specta]
pub async fn resolve_conflict(
    path: String,
    resolution: ConflictResolution, // enum: Ours | Theirs | Custom(String)
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> { ... }

/// Complete the merge after all conflicts are resolved.
/// Creates the merge commit.
#[tauri::command]
#[specta::specta]
pub async fn complete_merge(
    message: String,
    state: State<'_, RepositoryState>,
) -> Result<MergeResult, GitError> { ... }
```

**New types for `merge.rs`:**

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFile {
    pub path: String,
    pub base_content: String,     // ancestor
    pub ours_content: String,     // current branch
    pub theirs_content: String,   // incoming branch
    pub language: String,
    pub is_binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ConflictResolution {
    Ours,
    Theirs,
    Custom { content: String },
}
```

**Implementation detail (HIGH confidence):** git2-rs exposes `Index::conflicts()` which returns an `IndexConflicts` iterator yielding `IndexConflict { ancestor, our, their }` entries. Each entry contains an `IndexEntry` with an `id` (Oid) that can be used with `Repository::find_blob()` to get the blob content. This is how the three-way content is extracted.

### Git Insights Commands

**Location:** New file `src-tauri/src/git/insights.rs`

Insights data (author stats, commit frequency, file heat maps) is a distinct domain from existing modules. Creating a new module follows the established pattern.

**New commands for `insights.rs`:**

```rust
/// Get commit frequency over time (commits per day/week/month).
#[tauri::command]
#[specta::specta]
pub async fn get_commit_frequency(
    period: FrequencyPeriod, // Day | Week | Month
    limit: u32,              // how many periods back
    state: State<'_, RepositoryState>,
) -> Result<Vec<FrequencyPoint>, GitError> { ... }

/// Get author contribution statistics.
#[tauri::command]
#[specta::specta]
pub async fn get_author_stats(
    limit: u32,
    state: State<'_, RepositoryState>,
) -> Result<Vec<AuthorStats>, GitError> { ... }

/// Get file change frequency (heat map data).
#[tauri::command]
#[specta::specta]
pub async fn get_file_heat_map(
    limit: u32,
    state: State<'_, RepositoryState>,
) -> Result<Vec<FileHeatEntry>, GitError> { ... }
```

**Registration in `lib.rs`:** Add the new commands to `collect_commands![]` and the new `use` imports at the top. Follow the existing section-based organization with a comment like `// Insights commands`.

### Line-Level Staging Commands

**Location:** `src-tauri/src/git/staging.rs` (extend existing module)

**New command:**

```rust
/// Stage specific hunks from a file's diff.
/// Applies selected hunks to the index without staging the entire file.
#[tauri::command]
#[specta::specta]
pub async fn stage_hunks(
    path: String,
    hunk_indices: Vec<u32>, // which hunks (0-indexed) to stage
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> { ... }
```

**Implementation approach:** Use `git2::Repository::apply()` with a diff containing only selected hunks, applied to the index. This is the same approach used by `git add -p` under the hood. Alternatively, construct a patch from selected hunks and use `git2::Diff::from_buffer()` + `Repository::apply_to_tree()`.

---

## Question 2: How Do New Blades Fit the Blade Registry?

### Merge Conflict View Blade

**Type:** Core blade (not extension) -- conflict resolution is fundamental Git functionality.

**Registration:** Create `src/core/blades/merge-conflict/registration.ts`:

```typescript
import { lazy } from "react";
import { registerBlade } from "../../lib/bladeRegistry";

const MergeConflictBlade = lazy(() =>
  import("./MergeConflictBlade").then((m) => ({ default: m.MergeConflictBlade }))
);

registerBlade<{ sourceBranch: string }>({
  type: "merge-conflict",
  defaultTitle: "Merge Conflicts",
  component: MergeConflictBlade,
  lazy: true,
  wrapInPanel: false, // full-width layout like staging-changes
  showBack: true,
});
```

**Add to `BladePropsMap`:**
```typescript
"merge-conflict": { sourceBranch: string };
```

**Add to `_discovery.ts` CORE_BLADE_TYPES array:**
```typescript
"merge-conflict"
```

**Navigation flow:** When `merge_branch` returns `has_conflicts: true`, the staging blade (or a merge trigger) navigates:
```typescript
getNavigationActor().send({
  type: "PUSH_BLADE",
  bladeType: "merge-conflict",
  title: `Merge Conflicts (${sourceBranch})`,
  props: { sourceBranch },
});
```

### Insights Dashboard Blade

**Type:** Extension blade (see Question 5 for rationale).

**Registration:** Via `ExtensionAPI.registerBlade()` in `src/extensions/insights/index.ts`:

```typescript
api.registerBlade({
  type: "insights-dashboard",
  title: "Insights",
  component: InsightsDashboardBlade,
  singleton: true,
  lazy: true,
  wrapInPanel: false,
  coreOverride: true, // uses bare type name since it's a built-in extension
});
```

**Add to `BladePropsMap`:**
```typescript
"insights-dashboard": Record<string, never>;
```

**Add to `_discovery.ts` EXTENSION_BLADE_TYPES array:**
```typescript
"insights-dashboard"
```

### Conflict Detail Blade (single file)

**Type:** Core blade -- pushed from the merge conflict list when user selects a file.

```typescript
"conflict-detail": { path: string; sourceBranch: string };
```

This blade shows the three-way merge editor for a single file. It is pushed from the merge-conflict blade:
```typescript
pushBlade({
  type: "conflict-detail",
  title: fileName,
  props: { path: file.path, sourceBranch },
});
```

**Registration:** Create `src/core/blades/conflict-detail/registration.ts`:

```typescript
import { lazy } from "react";
import { registerBlade } from "../../lib/bladeRegistry";
import { renderPathBreadcrumb } from "../../lib/bladeUtils";

const ConflictDetailBlade = lazy(() =>
  import("./ConflictDetailBlade").then((m) => ({ default: m.ConflictDetailBlade }))
);

registerBlade<{ path: string; sourceBranch: string }>({
  type: "conflict-detail",
  defaultTitle: "Resolve Conflict",
  component: ConflictDetailBlade,
  lazy: true,
  renderTitleContent: (props) => renderPathBreadcrumb(props.path),
});
```

---

## Question 3: How Does Line-Level Staging Interact with GitOps Store?

### Current Flow

1. `StagingChangesBlade` uses `react-query` with `["stagingStatus"]` key to call `commands.getStagingStatus()`
2. User clicks stage/unstage -> calls `commands.stageFile()` / `commands.unstageFile()`
3. Query invalidation triggers re-fetch of staging status
4. Diff preview uses `["fileDiff", path, staged, contextLines]` query key

### Line-Level (Hunk) Staging Integration

**No new Zustand state needed.** The hunk staging interaction is entirely within the diff viewer component and the Tauri commands.

**Data flow for hunk staging:**

```
User sees diff in InlineDiffViewer or DiffBlade
  -> Hunks rendered with per-hunk stage/unstage checkboxes
  -> User toggles hunk(s)
  -> Frontend calls commands.stageHunks(path, [hunkIndex1, hunkIndex2])
  -> Invalidate ["stagingStatus"] and ["fileDiff", path, ...] queries
  -> UI refreshes automatically via react-query
```

**UI integration point:** The `InlineDiffViewer` component (in `staging-changes/components/`) already receives `filePath` and `staged` props and renders a `DiffEditor`. The enhancement adds gutter decorations (checkboxes or stage/unstage buttons) beside each hunk header.

**Monaco Editor integration for hunk actions:**
- Use `editor.deltaDecorations()` to add gutter glyphs at hunk start lines
- Or use an overlay widget positioned at each `DiffHunk.newStart` line
- The existing `DiffHunk` data (from `FileDiff.hunks`) already provides `oldStart`, `oldLines`, `newStart`, `newLines` -- sufficient for identifying hunks

**The UIStore StagingSlice does NOT need changes** because hunk selection state is ephemeral (lives in React component state, not in Zustand). The staging status query provides the source of truth.

---

## Question 4: How Do Workspace Layout Presets Integrate with Preferences?

### Current Layout Architecture

The app uses `react-resizable-panels` with `autoSaveId` for persistence. The `SplitPaneLayout` component wraps this:

```typescript
<ResizablePanelLayout autoSaveId="staging-split" direction="horizontal">
```

Panel sizes are auto-persisted to localStorage keyed by `autoSaveId`.

### Workspace Layout Presets: New Preferences Slice

**Add a new `workspace.slice.ts` to the Preferences store:**

File: `src/core/stores/domain/preferences/workspace.slice.ts`

```typescript
export type WorkspacePreset = "default" | "wide-diff" | "compact" | "review" | "custom";

export interface WorkspaceLayout {
  sidebarWidth: number;       // percentage
  primaryPanelSize: number;   // percentage for split panes
  showSidebar: boolean;
  sidebarCollapsedPanels: string[];
}

export interface WorkspaceSlice {
  workspaceActivePreset: WorkspacePreset;
  workspaceLayouts: Record<WorkspacePreset, WorkspaceLayout>;
  workspaceCustomLayouts: Record<string, WorkspaceLayout>; // user-created
  setWorkspacePreset: (preset: WorkspacePreset) => Promise<void>;
  saveCustomLayout: (name: string, layout: WorkspaceLayout) => Promise<void>;
  deleteCustomLayout: (name: string) => Promise<void>;
  initWorkspace: () => Promise<void>;
}
```

**Add to PreferencesStore composition:**

```typescript
// In src/core/stores/domain/preferences/index.ts
export type PreferencesStore = SettingsSlice &
  ThemeSlice &
  NavigationSlice &
  BranchMetadataSlice &
  ReviewChecklistSlice &
  WorkspaceSlice; // NEW
```

**Integration with react-resizable-panels:**

The `ResizablePanelLayout` component currently uses `autoSaveId` which persists to localStorage. To support presets:

1. Create a `useWorkspaceLayout` hook that reads `workspaceActivePreset` from the Preferences store
2. When preset changes, imperatively call `PanelGroup.setLayout()` (react-resizable-panels exposes this via imperative handle)
3. The `autoSaveId` mechanism stays for per-session persistence; presets override it on activation

**Preset application flow:**
```
User selects preset (toolbar or command palette)
  -> usePreferencesStore.setWorkspacePreset("wide-diff")
  -> Persists to tauri-plugin-store
  -> Triggers re-render of layout components
  -> PanelGroup refs receive new sizes via imperative API
  -> localStorage auto-save picks up the new sizes
```

**This does NOT require changes to react-resizable-panels itself.** The library's imperative API (`PanelGroupOnLayout` callback + ref-based `setLayout()`) supports programmatic resizing.

---

## Question 5: Should Insights Dashboard Be Extension or Core?

### Decision: Built-in Extension

**Rationale:**

| Factor | Extension | Core | Winner |
|--------|-----------|------|--------|
| User can disable it | Yes | No | Extension |
| Depends on Git operations | Uses existing commands | Would use same | Neutral |
| Needs new Rust commands | Yes (insights.rs) | Same | Neutral |
| Affects navigation machine | No new ProcessType needed | Would need ProcessType | Extension |
| Follows existing pattern | Like topology, gitflow, github | Like staging-changes | Extension |
| Impact if removed | Dashboard gone, app works | N/A | Extension |
| Complexity | registerBlade + sidebar panel | Blade + ProcessType + nav changes | Extension is simpler |

**The topology extension is the exact precedent.** It registers a blade with `coreOverride: true`, contributes a sidebar panel, adds commands, and uses data from the GitOps store. The insights dashboard follows the same pattern.

**Implementation pattern (following topology extension):**

```
src/extensions/insights/
  index.ts              # onActivate / onDeactivate
  blades/
    InsightsDashboardBlade.tsx
    components/
      CommitFrequencyChart.tsx
      AuthorContributions.tsx
      FileHeatMap.tsx
  hooks/
    useInsightsData.ts  # react-query hooks for insights commands
```

**Registration in `App.tsx`:**
```typescript
registerBuiltIn({
  id: "insights",
  name: "Git Insights",
  version: "1.0.0",
  activate: insightsActivate,
  deactivate: insightsDeactivate,
});
```

**Navigation access:** Via command palette command + optional sidebar panel + optional toolbar action. The extension registers these through `ExtensionAPI`:
- `api.registerCommand({ id: "show-insights", ... })`
- `api.contributeSidebarPanel({ id: "insights-summary", ... })`
- `api.contributeToolbar({ id: "insights-btn", ... })`

**The insights dashboard does NOT need a new ProcessType.** It can be pushed as a blade from any process:
```typescript
getNavigationActor().send({
  type: "PUSH_BLADE",
  bladeType: "insights-dashboard",
  title: "Insights",
  props: {},
});
```

---

## Question 6: How Does Three-Way Merge View Work with Monaco Editor?

### The Problem

Monaco Editor does NOT expose a three-way merge editor API (HIGH confidence). VS Code's three-column merge editor is internal to VS Code and not available through Monaco's public API. This has been a requested feature since 2022 (GitHub Issue #3268) and remains unimplemented as of 2026.

### Recommended Architecture: Custom Two-Pane + Result Layout with Monaco

**Do NOT try to use a single Monaco instance for three-way merge.** Instead, build a custom layout with multiple Monaco editors.

**Recommended approach (two-pane diff + editable result):**

```
+------------------------------------------------------------------+
|  [Accept Ours | Accept Theirs | Manual Edit | Done]              |
+------------------------------------------------------------------+
|  DiffEditor: ours (left, original) vs theirs (right, modified)   |
|  (read-only -- shows what's different between the two sides)     |
+------------------------------------------------------------------+
|  Result Editor (editable) -- starts with ours content            |
|  User can manually edit, or accept ours/theirs wholesale         |
+------------------------------------------------------------------+
```

This approach uses 2 Monaco instances (one DiffEditor + one regular Editor) instead of 4 separate editors, reducing memory pressure significantly. It is the approach used by GitKraken, Sublime Merge, and other desktop Git clients.

**Implementation using existing components:**

```typescript
// ConflictDetailBlade.tsx
function ConflictDetailBlade({ path, sourceBranch }: Props) {
  const { data } = useQuery({
    queryKey: ["conflictFile", path],
    queryFn: () => commands.getConflictFile(path),
  });

  const [resultContent, setResultContent] = useState(data?.oursContent ?? "");

  return (
    <div className="flex flex-col h-full">
      <ConflictToolbar
        onAcceptOurs={() => setResultContent(data.oursContent)}
        onAcceptTheirs={() => setResultContent(data.theirsContent)}
        onResolve={() =>
          commands.resolveConflict(path, { Custom: { content: resultContent } })
        }
      />

      <ResizablePanelLayout autoSaveId="conflict-editor" direction="vertical">
        {/* Top: read-only diff showing ours vs theirs */}
        <ResizablePanel id="conflict-diff" defaultSize={50} minSize={20}>
          <DiffEditor
            original={data.oursContent}
            modified={data.theirsContent}
            language={data.language}
            theme={MONACO_THEME}
            options={{
              ...MONACO_COMMON_OPTIONS,
              readOnly: true,
              originalEditable: false,
              renderSideBySide: true,
            }}
          />
        </ResizablePanel>
        <ResizeHandle />
        {/* Bottom: editable result */}
        <ResizablePanel id="conflict-result" defaultSize={50} minSize={20}>
          <div className="flex flex-col h-full">
            <div className="px-3 py-1 border-b border-ctp-surface0 bg-ctp-crust text-xs text-ctp-subtext0">
              Result (editable)
            </div>
            <Editor
              value={resultContent}
              onChange={(v) => setResultContent(v ?? "")}
              language={data.language}
              theme={MONACO_THEME}
              options={MONACO_COMMON_OPTIONS}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelLayout>
    </div>
  );
}
```

**Optional full three-pane view (advanced, not MVP):** If the full base/ours/theirs view is desired, add a collapsible "Base" pane above the diff:

```
+------------------------------------------------------------------+
|  [Show Base | Accept Ours | Accept Theirs | Done]                |
+------------------------------------------------------------------+
|  [Base content - collapsible, read-only]                         |
+------------------------------------------------------------------+
|  DiffEditor: ours (left) vs theirs (right) -- read-only         |
+------------------------------------------------------------------+
|  Result Editor (editable)                                        |
+------------------------------------------------------------------+
```

### Per-Hunk Accept in Merge View

To support accepting individual hunks from ours/theirs:
1. Parse the diff hunks from the DiffEditor or use the `DiffHunk` data from the Rust backend
2. Add inline "Accept" buttons as Monaco glyph margin decorations or overlay widgets
3. On click, splice the selected hunk's content into the result editor at the corresponding line position

---

## Question 7: What New Data Flows for Avatars and Heat Maps?

### Author Avatars via Gravatar

**Architecture:** Frontend-only, no Rust changes needed.

**Data flow:**
```
CommitSummary.authorEmail (from existing Rust commands)
  -> SHA256 hash of trimmed, lowercased email
  -> Construct URL: https://gravatar.com/avatar/${hash}?d=identicon&s=32
  -> <img> tag with fallback to identicon
```

**Implementation as a shared component:**

```typescript
// src/core/components/ui/AuthorAvatar.tsx

interface AuthorAvatarProps {
  email: string;
  size?: number;
  className?: string;
}

export function AuthorAvatar({ email, size = 32, className }: AuthorAvatarProps) {
  const url = useGravatarUrl(email, size);
  return <img src={url} alt="" className={className} loading="lazy" />;
}

// Hook with memoized SHA-256 hash computation
function useGravatarUrl(email: string, size: number): string {
  const [url, setUrl] = useState(fallbackUrl(size));

  useEffect(() => {
    const normalized = email.trim().toLowerCase();
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized))
      .then(buf => {
        const hash = Array.from(new Uint8Array(buf))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");
        setUrl(`https://gravatar.com/avatar/${hash}?d=identicon&s=${size}`);
      });
  }, [email, size]);

  return url;
}
```

**Gravatar URL generation (HIGH confidence):** Per Gravatar docs, the process is:
1. Trim whitespace, lowercase the email
2. SHA-256 hash the email string
3. URL: `https://gravatar.com/avatar/${hash}?d=identicon&s=${size}`

**Important:** Gravatar uses SHA-256 (not MD5). The `SubtleCrypto` API available in the Tauri webview handles this.

**Caching strategy:** Browser image cache handles this automatically. The `loading="lazy"` attribute prevents loading avatars for off-screen commits. No react-query needed -- just an `<img>` tag.

**Places to integrate `AuthorAvatar`:**
- `CommitDetailsBlade` (author info section)
- Topology graph commit nodes (small avatar circle)
- Insights dashboard author stats
- Commit list items (optional, may be too dense)

### Commit Heat Maps

**Data flow:**
```
Rust: get_file_heat_map(limit)
  -> walks recent N commits
  -> counts file change frequency
  -> returns Vec<FileHeatEntry { path, change_count, last_changed_ms }>

Frontend: InsightsDashboardBlade
  -> useQuery(["fileHeatMap", limit], () => commands.getFileHeatMap(limit))
  -> Render as treemap or heatmap grid
```

**Visualization component:** Use a simple CSS grid or SVG-based treemap. No heavy charting library needed. Cells colored by change frequency using Catppuccin palette colors:

```typescript
function getHeatColor(intensity: number): string {
  // intensity is 0-1, maps to catppuccin colors
  if (intensity > 0.8) return "var(--ctp-red)";
  if (intensity > 0.6) return "var(--ctp-peach)";
  if (intensity > 0.4) return "var(--ctp-yellow)";
  if (intensity > 0.2) return "var(--ctp-green)";
  return "var(--ctp-overlay0)";
}
```

### Commit Frequency Chart

**Data flow:**
```
Rust: get_commit_frequency(period, limit)
  -> walks commits, buckets by time period
  -> returns Vec<FrequencyPoint { timestamp_ms, count }>

Frontend: CommitFrequencyChart component
  -> useQuery(["commitFrequency", period, limit], ...)
  -> Render as SVG sparkline or bar chart
```

**No charting library recommendation.** For the simple bar/sparkline charts needed, custom SVG is preferable to adding a dependency like recharts or chart.js. The data is simple (timestamp + count pairs) and the visualization is straightforward.

---

## Component Inventory: New vs Modified

### NEW Components

| Component | Location | Type | Purpose |
|-----------|----------|------|---------|
| `MergeConflictBlade` | `src/core/blades/merge-conflict/` | Core blade | List conflicted files, trigger resolution |
| `ConflictDetailBlade` | `src/core/blades/conflict-detail/` | Core blade | Two-pane diff + editable result for single file |
| `ConflictToolbar` | `src/core/blades/conflict-detail/components/` | Component | Accept ours/theirs/manual actions |
| `AuthorAvatar` | `src/core/components/ui/` | Shared | Gravatar avatar display |
| `InsightsDashboardBlade` | `src/extensions/insights/blades/` | Extension blade | Dashboard with charts and stats |
| `CommitFrequencyChart` | `src/extensions/insights/blades/components/` | Component | SVG bar chart |
| `AuthorContributions` | `src/extensions/insights/blades/components/` | Component | Author stats table with avatars |
| `FileHeatMap` | `src/extensions/insights/blades/components/` | Component | Treemap of file changes |
| `workspace.slice.ts` | `src/core/stores/domain/preferences/` | Store slice | Layout preset state |
| `insights.rs` | `src-tauri/src/git/` | Rust module | Insights data commands |

### MODIFIED Components

| Component | Location | Change |
|-----------|----------|--------|
| `merge.rs` | `src-tauri/src/git/` | Add `get_conflict_file`, `resolve_conflict`, `complete_merge` |
| `staging.rs` | `src-tauri/src/git/` | Add `stage_hunks` command |
| `lib.rs` | `src-tauri/src/` | Register new commands in `collect_commands![]` |
| `bladeTypes.ts` | `src/core/stores/` | Add `merge-conflict`, `conflict-detail`, `insights-dashboard` to `BladePropsMap` |
| `_discovery.ts` | `src/core/blades/` | Add new types to CORE_BLADE_TYPES / EXTENSION_BLADE_TYPES arrays |
| `App.tsx` | `src/` | Register insights built-in extension |
| `PreferencesStore` | `src/core/stores/domain/preferences/` | Compose new `WorkspaceSlice` |
| `InlineDiffViewer` | `src/core/blades/staging-changes/components/` | Add hunk-level stage/unstage actions |
| `DiffBlade` | `src/core/blades/diff/` | Add hunk-level actions for non-staging diffs |
| `StagingChangesBlade` | `src/core/blades/staging-changes/` | Detect merge state, show merge conflict entry point |
| `WelcomeBlade` | `src/extensions/welcome-screen/blades/` | Add any welcome screen enhancements |
| `settings.slice.ts` | `src/core/stores/domain/preferences/` | Add `"workspace"` to `SettingsCategory` if workspace settings go in Settings blade |

### NEW Rust Types (auto-generated to bindings.ts)

| Type | Module |
|------|--------|
| `ConflictFile` | `merge.rs` |
| `ConflictResolution` | `merge.rs` |
| `FrequencyPeriod` | `insights.rs` |
| `FrequencyPoint` | `insights.rs` |
| `AuthorStats` | `insights.rs` |
| `FileHeatEntry` | `insights.rs` |

---

## Recommended Build Order

Dependencies determine the build order. Each phase should be independently shippable.

### Phase 1: Foundation -- Conflict Resolution Backend + Merge View

**Why first:** The three-way merge view requires new Rust commands that other features do not depend on. It is the most complex feature and should be tackled first while the architecture is fresh.

**Build sequence:**
1. `merge.rs` -- Add `ConflictFile`, `ConflictResolution` types + `get_conflict_file`, `resolve_conflict`, `complete_merge` commands
2. `lib.rs` -- Register new commands
3. `bladeTypes.ts` -- Add `merge-conflict` and `conflict-detail`
4. `merge-conflict/registration.ts` + `MergeConflictBlade.tsx` -- List view of conflicted files
5. `conflict-detail/registration.ts` + `ConflictDetailBlade.tsx` -- Two-pane merge editor
6. Wire `StagingChangesBlade` to detect merge state and offer entry to merge-conflict blade

**Dependencies satisfied:** `merge.rs` (existing) -> new types -> new blades -> StagingChangesBlade integration

### Phase 2: Enhanced Diff Viewer + Line-Level Staging

**Why second:** Builds on existing diff infrastructure. Hunk staging is the highest-value UX improvement and uses the same Monaco DiffEditor patterns as the merge view.

**Build sequence:**
1. `staging.rs` -- Add `stage_hunks` command
2. `lib.rs` -- Register command
3. Enhance `InlineDiffViewer` with hunk action buttons (gutter decorations or overlay widgets)
4. Enhance `DiffBlade` with hunk action buttons
5. Wire up query invalidation for hunk staging

**Dependencies satisfied:** existing `staging.rs` -> new command -> existing `InlineDiffViewer` enhancement

### Phase 3: Git Insights Dashboard Extension

**Why third:** Independent of other features. New Rust module + new extension. No dependencies on Phase 1 or 2.

**Build sequence:**
1. `insights.rs` -- All three commands (`get_commit_frequency`, `get_author_stats`, `get_file_heat_map`)
2. `lib.rs` -- Register commands
3. `AuthorAvatar` shared component (used by insights and later by other views)
4. `src/extensions/insights/` -- Extension skeleton with `onActivate`/`onDeactivate`
5. `InsightsDashboardBlade` with sub-components
6. Register in `App.tsx`

**Dependencies satisfied:** none (self-contained module)

### Phase 4: Workspace Layout Presets

**Why fourth:** Pure frontend, no Rust changes. Builds on existing react-resizable-panels infrastructure.

**Build sequence:**
1. `workspace.slice.ts` -- Preferences slice
2. Add to `PreferencesStore` composition + `initAllPreferences`
3. `useWorkspaceLayout` hook
4. Integrate with `SplitPaneLayout` and `ResizablePanelLayout` (imperative `setLayout()` calls)
5. Add preset selector UI (toolbar action or settings blade section)

**Dependencies satisfied:** existing `PreferencesStore` -> new slice -> existing layout components

### Phase 5: Welcome Screen + Branch Visualization Enhancements

**Why last:** These are polish features that enhance existing views without structural changes.

**Build sequence:**
1. Welcome screen enhancements (existing extension blade modification)
2. Branch visualization improvements in topology graph (existing extension)
3. Avatar integration in commit list and topology nodes

**Dependencies satisfied:** Phase 3 (AuthorAvatar component) must be complete for avatar integration

---

## Architecture Diagrams

### Data Flow: Conflict Resolution

```
                    +-----------------+
                    |  merge_branch() |
                    +--------+--------+
                             |
                    has_conflicts: true
                             |
                    +--------v--------+
                    | MergeConflictBlade|
                    | (lists files)    |
                    +--------+--------+
                             |
                    user selects file
                             |
                    +--------v-----------+
                    | ConflictDetailBlade  |
                    | (diff + result)     |
                    +---+--------+-------+
                        |        |
        get_conflict_file()      |
                        |        |
           DiffEditor (read-only)
           ours (left) vs theirs (right)
                        |
           Editor (editable: result)
                        |
           resolve_conflict(path, Custom{content})
                        |
           invalidate ["mergeStatus"] + ["stagingStatus"]
                        |
           all resolved? -> complete_merge(message)
```

### Data Flow: Insights Dashboard

```
                    +------------------+
                    | insights.rs      |
                    | (new Rust module)|
                    +------------------+
                    | get_commit_frequency()  --> Vec<FrequencyPoint>
                    | get_author_stats()      --> Vec<AuthorStats>
                    | get_file_heat_map()     --> Vec<FileHeatEntry>
                    +------------------+
                             |
                    Tauri IPC (specta bindings)
                             |
                    +------------------+
                    | react-query hooks|
                    | in extension     |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
    CommitFrequencyChart  AuthorContribs  FileHeatMap
         (SVG bars)     (table+avatars)  (CSS treemap)
```

### Store Composition After Changes

```
useGitOpsStore (resets on repo close)
  |- RepositorySlice    (existing)
  |- BranchSlice        (existing)
  |- TagSlice           (existing)
  |- StashSlice         (existing)
  |- WorktreeSlice      (existing)
  |- GitflowSlice       (existing)
  |- UndoSlice          (existing)
  |- TopologySlice      (existing)
  |- CloneSlice         (existing)
  (NO new slices -- merge state comes from react-query, not store)

useUIStore (resets on repo close)
  |- StagingSlice       (existing, unchanged)
  |- CommandPaletteSlice (existing)
  (NO new slices -- merge conflict UI state is blade-local)

usePreferencesStore (survives repo switches)
  |- SettingsSlice       (existing, minor SettingsCategory addition)
  |- ThemeSlice          (existing)
  |- NavigationSlice     (existing)
  |- BranchMetadataSlice (existing)
  |- ReviewChecklistSlice (existing)
  |- WorkspaceSlice      (NEW -- layout presets)
```

**Design principle:** New merge/conflict state does NOT go into GitOpsStore. It is fetched on-demand via react-query (`["mergeStatus"]`, `["conflictFile", path]`). This follows the existing pattern where diff data and staging status are query-based, not store-based. Only the topology graph (which needs to accumulate paginated data) uses the store.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Putting Conflict State in Zustand
**What:** Adding `mergeConflicts`, `selectedConflict`, `conflictResolutions` to GitOpsStore.
**Why bad:** Duplicates react-query cache, creates stale state bugs, bloats store reset logic.
**Instead:** Use react-query for all conflict data. The merge status is polled, conflict file content is fetched on-demand.

### Anti-Pattern 2: Making Insights a Core Process Type
**What:** Adding `"insights"` to `ProcessType = "staging" | "topology" | "insights"`.
**Why bad:** Forces navigation machine changes, sidebar restructure, URL-like routing changes. Disproportionate complexity for a dashboard view.
**Instead:** Push insights blade from any process. It is a leaf blade, not a root process.

### Anti-Pattern 3: Single Monaco Instance for Three-Way Merge
**What:** Trying to use one Monaco editor with custom rendering for base/ours/theirs.
**Why bad:** Monaco's API does not support three-way diff. Hacking around it with decorations is fragile and unmaintainable.
**Instead:** Use the DiffEditor (ours vs theirs) + a separate editable Editor (result) in a `ResizablePanelLayout`.

### Anti-Pattern 4: Charting Library for Simple Visualizations
**What:** Adding recharts, chart.js, or d3 for the insights dashboard.
**Why bad:** Adds 50-200KB to bundle for what amounts to bar charts and treemaps. Creates version conflicts and maintenance burden.
**Instead:** Custom SVG components using Catppuccin theme colors. The data shapes are simple (array of {label, value} pairs).

### Anti-Pattern 5: Storing Layout Presets in localStorage Directly
**What:** Bypassing the Preferences store and writing preset data to localStorage.
**Why bad:** Inconsistent with the rest of the settings system (tauri-plugin-store). Won't survive app data migration. Can't be backed up or synced.
**Instead:** Use the same `getStore()` + `store.set()`/`store.save()` pattern used by all other preferences slices.

### Anti-Pattern 6: New Zustand Slice Per Feature
**What:** Adding a MergeSlice to GitOpsStore for conflict state, an InsightsSlice for dashboard data, etc.
**Why bad:** The GitOpsStore already has 9 slices. Adding more for data that is better served by react-query creates unnecessary coupling. The store should hold persistent state, not server state.
**Instead:** Use react-query for all data that comes from Tauri commands. Only add to Zustand if the data needs to persist across blade navigations or be shared between distant components without prop drilling.

---

## Scalability Considerations

| Concern | Small repos (<1K commits) | Medium repos (10K commits) | Large repos (100K+ commits) |
|---------|--------------------------|---------------------------|----------------------------|
| Insights computation | <100ms | 500ms-2s | 5-30s, needs pagination/caching |
| Conflict file loading | Instant | Instant | Instant (per-file) |
| Avatar loading | All visible | Lazy load | Lazy load + LRU cache |
| Heat map data | Full scan | Sample recent 1K | Sample recent 1K |
| Hunk staging | <50ms | <50ms | <100ms (per-file operation) |
| Workspace preset switching | Instant (CSS-only) | Instant | Instant |

**Mitigation for large repos:** The `get_commit_frequency` and `get_author_stats` commands should accept a `limit` parameter (already specified above) and walk only the most recent N commits. The Rust backend handles pagination efficiently via `revwalk.take(limit)`.

---

## Sources

### Verified Sources (HIGH confidence)
- [Monaco Editor 3-way merge request (Issue #3268)](https://github.com/microsoft/monaco-editor/issues/3268) -- confirms 3-way merge editor is not available in Monaco public API
- [Monaco Editor merge conflict highlighting (Issue #1529)](https://github.com/microsoft/monaco-editor/issues/1529) -- community workarounds documented
- [git2-rs Index API (docs.rs)](https://docs.rs/git2/latest/git2/struct.Index.html) -- `Index::conflicts()` returns `IndexConflicts` iterator with `ancestor`/`our`/`their` entries
- [git2-rs merge.rs source](https://github.com/rust-lang/git2-rs/blob/master/src/merge.rs) -- `MergeFileResult` with `content()` and `is_automergeable()`
- [Gravatar API hash documentation](https://docs.gravatar.com/api/avatars/hash/) -- SHA-256 hash, trimmed lowercase email
- [react-resizable-panels README](https://github.com/bvaughn/react-resizable-panels) -- `autoSaveId` persistence, imperative `setLayout()` API
- Direct codebase analysis of FlowForge (41K+ LOC TypeScript, 11K+ Rust) -- all integration points verified against actual code
