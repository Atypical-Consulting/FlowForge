# Phase 27 UX Research: Init Repo Blade

**Researcher**: UX Analysis Agent
**Date**: 2026-02-08
**Requirements**: INIT-01 through INIT-10

---

## Table of Contents

1. [Competitive Analysis](#1-competitive-analysis)
2. [User Flow Analysis](#2-user-flow-analysis)
3. [Form Layout Recommendation](#3-form-layout-recommendation)
4. [Template Discovery Interaction Patterns](#4-template-discovery-interaction-patterns)
5. [Error States and Edge Cases](#5-error-states-and-edge-cases)
6. [Accessibility Considerations](#6-accessibility-considerations)
7. [Layout Specification](#7-layout-specification)
8. [Summary of Recommendations](#8-summary-of-recommendations)

---

## 1. Competitive Analysis

### 1.1 GitHub Desktop

**What it does:**
- Single dialog with fields: Name, Description, Local Path, Git Ignore (dropdown), License (dropdown), checkbox "Initialize this repository with a README"
- The .gitignore dropdown is a flat, single-select list of ~130 templates fetched from the GitHub API
- No preview of template contents
- No multi-select composition (one template only)
- No project type detection

**What works well:**
- Simple, approachable -- a user can initialize in under 10 seconds
- README option is prominent and defaults to on (good practice)
- The Git Ignore dropdown supports type-ahead filtering

**What is missing:**
- Single .gitignore template only -- cannot combine Node + macOS + JetBrains
- No preview of what rules the template contains before committing
- No smart recommendations based on project contents
- No category browsing -- 130+ items in a flat dropdown is overwhelming

### 1.2 GitKraken

**What it does:**
- Init dialog with: Repository Name, Path, .gitignore template (dropdown), License template (dropdown)
- Single-select dropdown for templates
- Includes a "None" option for no .gitignore

**What works well:**
- Clean, focused dialog
- Path auto-population from selected folder

**What is missing:**
- No composition of multiple templates
- No template preview
- No project detection
- No category organization -- flat list only
- User feedback indicates frustration with missing templates and inability to add custom ones

### 1.3 VS Code

**What it does:**
- "Initialize Repository" button in the Source Control panel when no repo is detected
- Single click initializes with no further configuration
- No .gitignore template selection at all
- No README generation
- No branch name choice (uses git's configured default)

**What works well:**
- Zero friction for power users who want to init quickly and configure manually
- Auto-detection of non-repo folders is seamless

**What is missing:**
- No scaffolding whatsoever -- misses the opportunity to help users set up properly
- Users must manually create .gitignore, README, etc. after init
- No guidance for beginners

### 1.4 SourceTree

**What it does:**
- "Create" tab with: Destination Path, Name, Type (Git/Mercurial)
- No .gitignore template selection during init
- .gitignore management is post-init only (right-click files to ignore)

**What works well:**
- Post-init .gitignore via right-click is contextually useful

**What is missing:**
- No scaffolding at init time
- No template picker of any kind

### 1.5 Competitive Gap Summary

| Feature | GitHub Desktop | GitKraken | VS Code | SourceTree | **FlowForge (Goal)** |
|---|---|---|---|---|---|
| .gitignore templates | Single-select dropdown | Single-select dropdown | None | None | **Multi-select picker with search, categories, preview** |
| Template preview | No | No | N/A | N/A | **Yes -- inline preview panel** |
| Multi-template composition | No | No | N/A | N/A | **Yes -- compose and merge** |
| Project type detection | No | No | No | No | **Yes -- smart recommendations** |
| Category browsing | No | No | N/A | N/A | **Yes -- grouped by type** |
| README generation | Checkbox | No | No | No | **Yes -- with metadata** |
| Branch name choice | No (uses default) | No | No | No | **Yes -- editable with smart default** |
| Initial commit | Implicit | Implicit | No | No | **Explicit opt-in** |
| Offline support | Yes (bundled) | Yes (bundled) | N/A | N/A | **Yes -- bundled fallback** |

**FlowForge's opportunity**: Every competitor treats init as a throwaway dialog. FlowForge can differentiate by making initialization a first-class experience that sets up projects correctly from the start.

---

## 2. User Flow Analysis

### 2.1 Entry Points

There are two distinct entry points into the Init Repo flow:

**Entry Point A: From WelcomeView (existing pattern)**
The current `GitInitBanner` component (`/Users/phmatray/Repositories/github-phm/FlowForge/src/components/welcome/GitInitBanner.tsx`) already handles the case where a user opens a non-git folder. Currently it shows a minimal inline banner with a "Set default branch to main" checkbox and an Initialize button.

The new flow should replace this banner with a button that opens the full Init Repo blade. The path is already captured in `pendingInitPath` state.

**Entry Point B: From the Welcome View as a primary action**
Add an "Init Repository" button alongside the existing "Open Repository" and "Clone Repository" buttons. This allows users to proactively create a new repo without first encountering the "not a repository" detection flow.

### 2.2 Complete User Journey

```
[User selects a folder or clicks "Init Repository"]
    |
    v
[Init Repo Blade opens -- full-width]
    |
    v
[Phase 1: CORE CONFIGURATION -- always visible]
    |-- Directory path (pre-filled, editable via browse button)
    |-- Default branch name (pre-filled from git config, editable)
    |
    v
[Phase 2: PROJECT SCAFFOLDING -- collapsible sections, all expanded by default]
    |
    |-- [.gitignore Section]
    |   |-- Smart recommendations shown first (if project detected)
    |   |-- Quick-pick chips for common templates
    |   |-- "Browse all templates" expands the full picker
    |   |-- Selected templates shown as removable chips
    |   |-- Preview panel shows merged output
    |   |
    |-- [README.md Section]
    |   |-- Toggle: "Generate README.md"
    |   |-- If on: Project name field (auto-detected from folder)
    |   |-- Optional description textarea
    |   |
    |-- [Initial Commit Section]
    |   |-- Toggle: "Create initial commit with generated files"
    |   |-- If on: Commit message field (pre-filled: "Initial commit")
    |
    v
[Phase 3: CONFIRMATION]
    |-- Summary of what will be created
    |-- "Initialize" primary action button
    |-- "Cancel" secondary action
    |
    v
[Success: Auto-opens the repository in FlowForge]
```

### 2.3 Decision Points

| Decision | Required? | Default | Notes |
|---|---|---|---|
| Directory path | Required | Pre-filled from entry point | Editable via OS folder picker |
| Branch name | Required | From `init.defaultBranch` git config, or "main" | Input with placeholder |
| .gitignore templates | Optional | Smart recommendations pre-selected | Can be empty |
| README.md | Optional | Off | Toggle on to generate |
| Initial commit | Optional | On (if any files will be generated) | Toggle |
| Commit message | Optional | "Initial commit" | Only shown when initial commit is on |

### 2.4 Rationale: Single-Page vs Wizard

Based on NNGroup's progressive disclosure research, a **single-page layout with collapsible sections** is optimal here because:

1. **Steps are interdependent** -- the user may want to see how their .gitignore choice affects the initial commit summary
2. **Total decision count is low** -- roughly 5-6 decisions, well within single-page cognitive load
3. **Cross-referencing is needed** -- seeing the directory path while choosing templates helps mental mapping
4. **Wizard fatigue** -- multi-step wizards for what is conceptually a single "init" action feels heavyweight
5. **Consistency with existing patterns** -- SettingsBlade uses a single-page approach with sections. The Init Repo blade should feel similar in density.

---

## 3. Form Layout Recommendation

### 3.1 Overall Structure: Two-Column Split Pane

Reuse the existing `SplitPaneLayout` component from `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/layout/SplitPaneLayout.tsx`.

**Left column (55% default):** Configuration form with collapsible sections
**Right column (45% default):** Context-sensitive preview panel

This mirrors the `StagingChangesBlade` pattern where the left panel has the file list and the right panel shows a diff preview.

```
+------------------------------------------------------+
|  BladePanel title: "Initialize Repository"     [Back] |
+------------------------------------------------------+
|                    |                                   |
| [FORM SECTIONS]   |  [PREVIEW PANEL]                 |
|                    |                                   |
| Directory:         |  .gitignore Preview              |
| /path/to/folder    |  -------------------------------- |
|                    |  # Node.gitignore                |
| Branch: [main   ] |  node_modules/                   |
|                    |  .npm                            |
| --- .gitignore --- |  *.tgz                           |
| Recommendations:   |                                   |
| [Node] [macOS]     |  # macOS.gitignore               |
|                    |  .DS_Store                        |
| Selected: [Node x] |  .AppleDouble                    |
|  [macOS x]         |  ...                             |
|                    |                                   |
| [Browse templates] |                                   |
|                    |                                   |
| --- README.md ---  |  (or README preview when that    |
| [ ] Generate       |   section is focused)            |
|                    |                                   |
| --- Commit ---     |                                   |
| [x] Initial commit |                                   |
|                    |                                   |
| [Cancel] [Init]    |                                   |
+------------------------------------------------------+
```

### 3.2 Form Sections (Left Column)

**Section 1: Core Configuration** (not collapsible -- always visible)
- Directory path: read-only display with folder icon + browse button (reuse pattern from CloneForm)
- Branch name: `Input` component with placeholder "main", pre-filled from git config via `commands.getGitGlobalConfig()`
- Folder analysis badge: "Detected: Node.js project" or "Empty directory" shown as a subtle badge

**Section 2: .gitignore Configuration** (collapsible, expanded by default)
- Smart recommendations row (if project detected): chip-style buttons for recommended templates, pre-selected
- Selected templates area: horizontal list of removable chips (see Section 4 for details)
- "Browse all templates" button opens an inline template picker (not a modal) that expands below
- When template picker is open, right column shows the selected template's raw content
- When template picker is closed, right column shows the merged .gitignore preview

**Section 3: README.md** (collapsible, collapsed by default)
- Toggle switch: "Generate README.md"
- When expanded: Project name input (auto-filled from folder name), description textarea (optional)
- Right column shows the README preview in markdown when this section is focused

**Section 4: Initial Commit** (collapsible, collapsed by default)
- Toggle switch: "Create initial commit"
- When expanded: Commit message input (pre-filled: "Initial commit")
- Only meaningful when at least one file will be generated (.gitignore or README)
- Auto-enables when .gitignore or README is configured

### 3.3 Preview Panel (Right Column)

The preview panel is **context-sensitive** -- it shows content relevant to the currently active form section:

| Active Section | Preview Shows |
|---|---|
| .gitignore (template picker closed) | Merged .gitignore content preview |
| .gitignore (template picker open, template hovered/selected) | Single template raw content |
| README.md | Rendered markdown preview of generated README |
| Initial Commit | Summary: list of files that will be created |
| No section active / Core config | Summary overview of all planned actions |

This context-switching should use framer-motion crossfade animations to feel smooth, matching the existing `AnimatePresence` patterns in the blade system.

### 3.4 Action Bar (Bottom of Left Column)

Fixed to the bottom of the form area (sticky positioning):
- **Cancel** button (ghost variant, left-aligned)
- **Initialize Repository** button (default/primary variant, right-aligned)
- Loading state uses the existing Button `loading` and `loadingText` props: "Initializing..."

---

## 4. Template Discovery Interaction Patterns

### 4.1 Data Source Architecture

**Online (163+ templates):** Fetch from GitHub API `GET /gitignore/templates` and `GET /gitignore/templates/{name}` for content. Cache responses in memory (React Query with `staleTime: Infinity` for the session).

**Offline fallback (bundled, 18 templates):**
Embed as static JSON in the frontend bundle. Suggested top-18:
1. **Languages**: Node, Python, Java, C++, C#, Go, Rust, Ruby, Swift, Kotlin
2. **Frameworks**: Unity, UnrealEngine, Android, Flutter
3. **Editors/OS**: JetBrains, VisualStudio, macOS, Windows

### 4.2 Category Organization

The GitHub API returns a flat list. FlowForge should add client-side categorization:

```typescript
interface GitignoreCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  templates: string[]; // template names from API
}

const categories: GitignoreCategory[] = [
  { id: "recommended", label: "Recommended", icon: Sparkles, templates: [] }, // dynamic
  { id: "languages",   label: "Languages",   icon: Code,     templates: ["Node", "Python", "Java", ...] },
  { id: "frameworks",  label: "Frameworks",   icon: Layers,   templates: ["Angular", "Rails", "Django", ...] },
  { id: "editors",     label: "Editors/IDEs", icon: Monitor,  templates: ["JetBrains", "VisualStudio", ...] },
  { id: "os",          label: "Operating Systems", icon: Laptop, templates: ["macOS", "Windows", "Linux"] },
  { id: "other",       label: "Other",        icon: MoreHorizontal, templates: [...] },
];
```

The "Recommended" category is populated dynamically based on project detection (INIT-09).

### 4.3 Template Picker Layout (Inline Expansion)

When the user clicks "Browse all templates", the template picker expands **inline below the .gitignore section**, not as a modal or separate blade. This maintains context and follows progressive disclosure.

```
+------------------------------------------+
| Search: [___________________________] Q  |
|                                          |
| [Recommended] [Languages] [Frameworks]  |
| [Editors/IDEs] [OS] [Other]             |
|                                          |
| +--------------------------------------+ |
| | [ ] Node            [eye icon]       | |
| | [x] Python          [eye icon]       | |
| | [ ] Java            [eye icon]       | |
| | [ ] C++             [eye icon]       | |
| | [ ] C#              [eye icon]       | |
| | [ ] Go              [eye icon]       | |
| | ...                                  | |
| +--------------------------------------+ |
|                                          |
| [Done - 2 selected]                     |
+------------------------------------------+
```

**Key interactions:**

1. **Search input** (top): Filters across all categories. Debounced 150ms. Clears category filter when typing.
2. **Category tabs** (horizontal scrollable): Filter chips, not exclusive -- clicking a category shows only that category's templates. "All" shows everything.
3. **Template list**: Scrollable virtual list (important for 163 items). Each row:
   - Checkbox for multi-select
   - Template name
   - Eye icon button to preview in the right column
   - Already-selected items shown with a filled checkbox and blue background accent
4. **Preview on hover/click**: Clicking the eye icon (or arrow key to a template) shows its raw content in the right preview panel.
5. **"Done" button**: Collapses the picker. Badge shows count of selected templates.

### 4.4 Selected Templates Display (Chip Composition Area)

Above the "Browse all templates" button, selected templates appear as removable chips:

```
Selected .gitignore templates:
[Node x] [macOS x] [JetBrains x]       [Clear all]
```

**Chip behavior:**
- Click the "x" to remove a template
- Chips have a subtle drag handle for reordering (affects merge order)
- "Clear all" link appears when 2+ templates are selected
- Chips use `bg-ctp-blue/20 text-ctp-blue border border-ctp-blue/30` for selected state
- Chip remove button: `hover:bg-ctp-red/20` with X icon

**Merge order matters**: The .gitignore output concatenates templates in chip order. Each section is commented with the template name:

```gitignore
# === Node ===
node_modules/
.npm
...

# === macOS ===
.DS_Store
.AppleDouble
...
```

### 4.5 Smart Recommendations (INIT-09)

**Detection method**: After the directory path is set, scan for marker files:

| Marker File | Detected Project Type | Recommended Templates |
|---|---|---|
| `package.json` | Node.js | Node |
| `Cargo.toml` | Rust | Rust |
| `go.mod` | Go | Go |
| `requirements.txt` / `pyproject.toml` / `setup.py` | Python | Python |
| `pom.xml` / `build.gradle` | Java/JVM | Java, Gradle/Maven |
| `*.csproj` / `*.sln` | C# / .NET | VisualStudio |
| `*.xcodeproj` / `Package.swift` | Swift/iOS | Swift, Xcode |
| `pubspec.yaml` | Flutter/Dart | Flutter |
| `composer.json` | PHP | Composer |
| `.idea/` directory | JetBrains IDE detected | JetBrains |
| `.vscode/` directory | VS Code detected | VisualStudioCode |

The detection runs as a Tauri command (new `detect_project_type` Rust command) that returns a list of detected types. This is fast (just filesystem existence checks) and works offline.

**Display**: Recommendations appear as a highlighted row above the template picker:

```
Detected: Node.js project
Recommended: [+ Node] [+ macOS] [+ JetBrains]
```

The "+" chips are one-click to add. If the user has already added them, they show as already-selected (filled, no "+" prefix). The recommendation is non-intrusive -- it is a suggestion, not an auto-selection. However, the recommended templates should be **pre-selected by default** when the blade first opens, with a clear visual indication that the user can remove them. This follows the principle of smart defaults that save time for the 80% case.

---

## 5. Error States and Edge Cases

### 5.1 Directory Already Has .git

**Detection**: Check for `.git` directory existence before opening the blade.
**Behavior**: Show an inline warning banner at the top of the form:
```
! This directory is already a Git repository.
  Initializing again will have no effect.
  [Open Existing Repository] [Cancel]
```
The "Initialize" button should be disabled in this state.

### 5.2 No Write Permissions

**Detection**: Attempt a test write (e.g., create and delete a temp file) or check permissions via Rust.
**Behavior**: Show error banner:
```
! Cannot write to this directory. Check folder permissions.
```
Disable the Initialize button. Use `bg-ctp-red/10 border border-ctp-red/30` error styling consistent with existing error patterns in `WelcomeView`.

### 5.3 Offline Mode

**Detection**: Failed fetch to `api.github.com/gitignore/templates` (network error or timeout).
**Behavior**:
- Silently fall back to bundled templates (18 templates)
- Show a subtle info badge: "Offline -- showing bundled templates (18 of 163)"
- The badge uses `bg-ctp-yellow/10 text-ctp-yellow` warning styling
- If the user clicks "Try reconnecting", re-attempt the API fetch
- The bundled fallback should be comprehensive enough that most users never notice

### 5.4 Empty Directory vs Directory with Existing Files

**Empty directory:**
- Recommendation engine has nothing to detect
- Show a hint: "Tip: Select a .gitignore template matching your project type"
- "Recommended" category is hidden (no data to recommend from)

**Directory with existing files:**
- Detection engine scans marker files and populates recommendations
- Show detected project type badge
- If files exist but no recognizable project type: show generic recommendations (macOS, Windows, JetBrains, VisualStudioCode)

### 5.5 Initialization Failure

**After the user clicks Initialize:**
- Show loading state on the button ("Initializing...")
- If `commands.gitInit()` returns an error:
  - Parse the error type from `GitError` (PathNotFound, InvalidPath, PathExists, OperationFailed)
  - Show inline error message below the action bar with icon (AlertCircle)
  - Keep the form state intact so the user can correct and retry
  - Use the existing error display pattern from `GitInitBanner`

### 5.6 Very Long Template List Scroll Performance

With 163+ templates, rendering all in a flat list can be sluggish.
- Use a virtualized list (react-window or native CSS `content-visibility: auto`)
- Show a skeleton loading state while templates are being fetched
- Render in batches if using the non-virtualized approach

---

## 6. Accessibility Considerations

### 6.1 Keyboard Navigation

**Overall blade navigation:**
- `Tab` / `Shift+Tab`: Move between form fields in natural order
- `Escape`: Close the blade (go back), consistent with blade system behavior

**Template picker:**
- `Tab` into the search field from the form
- `ArrowDown` / `ArrowUp`: Navigate the template list
- `Space`: Toggle template selection (checkbox)
- `Enter` on a template: Toggle select AND show preview in right panel
- `Tab` from the list: Move to "Done" button
- `Home` / `End`: Jump to first/last template in the visible list

**Chip area (selected templates):**
- `ArrowLeft` / `ArrowRight`: Move focus between chips
- `Delete` / `Backspace`: Remove the focused chip
- `Escape`: Return focus to the template list or search

**Category tabs:**
- `ArrowLeft` / `ArrowRight`: Move between category tabs
- `Enter` / `Space`: Activate the focused tab

These patterns follow the existing keyboard navigation in `SettingsBlade` (lines 62-89 of `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/blades/SettingsBlade.tsx`), which already implements ArrowUp/ArrowDown/Home/End for tab navigation.

### 6.2 ARIA Roles and Labels

**Template picker container:**
```html
<div role="region" aria-label="Gitignore template selection">
```

**Search input:**
```html
<input role="searchbox" aria-label="Search gitignore templates"
       aria-describedby="template-count" />
<span id="template-count" class="sr-only">
  163 templates available, 2 selected
</span>
```

**Category tabs:**
```html
<div role="tablist" aria-label="Template categories" aria-orientation="horizontal">
  <button role="tab" aria-selected="true" aria-controls="panel-languages">Languages</button>
  ...
</div>
```

**Template list:**
```html
<ul role="listbox" aria-label="Gitignore templates" aria-multiselectable="true">
  <li role="option" aria-selected="true">Node</li>
  <li role="option" aria-selected="false">Python</li>
  ...
</ul>
```

**Selected chips area:**
```html
<div role="group" aria-label="Selected templates">
  <span role="listitem">
    Node
    <button aria-label="Remove Node template">x</button>
  </span>
  ...
</div>
```

**Preview panel:**
```html
<div role="region" aria-label="Template preview" aria-live="polite">
  <!-- Content changes announced to screen readers -->
</div>
```

### 6.3 Focus Management

1. **Blade open**: Auto-focus the first interactive element (directory path browse button or branch name input)
2. **Template picker open**: Auto-focus the search input
3. **Template picker close**: Return focus to the "Browse all templates" button
4. **Chip removal**: Focus moves to the next chip, or back to the template picker if no chips remain
5. **Initialization success**: Focus moves to the newly opened repository view (handled by navigation system)
6. **Error state**: Focus moves to the error message region

### 6.4 Screen Reader Announcements

Use `aria-live="polite"` regions for:
- Template selection changes: "Node template added. 2 templates selected."
- Template removal: "Node template removed. 1 template selected."
- Smart recommendations: "Detected Node.js project. 3 templates recommended."
- Initialization progress: "Initializing repository... Repository initialized successfully."
- Error messages: read error text automatically via the live region

### 6.5 Reduced Motion

All framer-motion animations in the blade (section expand/collapse, chip add/remove, preview crossfade) must respect `useReducedMotion()`. The existing `BladeContainer` already calls `useReducedMotion()` and passes `{ duration: 0 }` when motion should be reduced. New animations should follow this pattern.

### 6.6 Color Contrast

All interactive elements must meet WCAG 2.1 AA contrast ratios (4.5:1 for normal text, 3:1 for large text). The Catppuccin Mocha theme generally meets this, but specific combinations to verify:
- `ctp-subtext0` on `ctp-base` background (information text)
- `ctp-blue` chip text on `ctp-blue/20` background (selected templates)
- `ctp-overlay0` placeholder text on `ctp-surface0` input background

---

## 7. Layout Specification

### 7.1 Blade Registration

Add to `BladePropsMap` in `/Users/phmatray/Repositories/github-phm/FlowForge/src/stores/bladeTypes.ts`:

```typescript
"init-repo": { directoryPath: string };
```

Registration configuration:
```typescript
{
  type: "init-repo",
  defaultTitle: "Initialize Repository",
  component: InitRepoBlade,
  lazy: true,
  wrapInPanel: true,
  showBack: true,
  singleton: true, // only one init blade at a time
}
```

### 7.2 Component Hierarchy

```
InitRepoBlade (full-width blade)
  +-- SplitPaneLayout (autoSaveId="init-repo-split", 55/45 default)
       |
       +-- [Primary] InitRepoForm
       |    +-- CoreConfigSection
       |    |    +-- DirectoryPathField
       |    |    +-- BranchNameField
       |    |    +-- ProjectDetectionBadge
       |    |
       |    +-- CollapsibleSection: ".gitignore"
       |    |    +-- SmartRecommendations
       |    |    +-- SelectedTemplateChips
       |    |    +-- TemplatePicker (inline, expandable)
       |    |         +-- TemplateSearchInput
       |    |         +-- CategoryTabs
       |    |         +-- TemplateList (virtualized)
       |    |
       |    +-- CollapsibleSection: "README.md"
       |    |    +-- Toggle + ProjectNameInput + DescriptionTextarea
       |    |
       |    +-- CollapsibleSection: "Initial Commit"
       |    |    +-- Toggle + CommitMessageInput
       |    |
       |    +-- ActionBar (sticky bottom)
       |         +-- CancelButton + InitializeButton
       |
       +-- [Detail] InitRepoPreview
            +-- PreviewHeader (shows what is being previewed)
            +-- PreviewContent (code block for .gitignore, markdown for README)
            +-- EmptyState (when nothing to preview)
```

### 7.3 Responsive Behavior

**Full-width blade (> 900px):** Two-column split pane as described above.
**Narrow blade (< 900px):** Stack vertically -- form on top, preview below. The preview becomes a collapsible "Preview" section at the bottom of the form. Alternatively, use a toggle to switch between "Configure" and "Preview" modes.

### 7.4 Dimensions and Spacing

Follow existing patterns from SettingsBlade and GitSettings:
- Section headers: `text-lg font-medium text-ctp-text mb-4`
- Field labels: `text-sm font-medium text-ctp-subtext1 mb-2` (via SettingsField component)
- Field descriptions: `text-xs text-ctp-subtext0 mb-2`
- Section dividers: `border-t border-ctp-surface1` with `space-y-6` between sections
- Input fields: reuse the `Input` component from `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/ui/input.tsx`
- Padding: `p-6` on the form container (matching SettingsBlade's panel padding)

---

## 8. Summary of Recommendations

### Design Principles

1. **Smart defaults, not blank slates** -- Pre-fill branch name from git config, pre-select recommended templates, auto-detect project type. The goal is that most users can click "Initialize" immediately after opening the blade.

2. **Progressive disclosure, not a wizard** -- Show core config always. Let advanced options (template browsing, README, commit message) be discoverable but not mandatory. Collapsible sections keep the form scannable.

3. **Preview-driven confidence** -- The right preview panel eliminates the "what will this actually create?" anxiety. Users can see the exact .gitignore content before committing to it.

4. **Composition over selection** -- Multi-template .gitignore is FlowForge's key differentiator. Make adding and removing templates feel lightweight (chips, not a form resubmission).

5. **Offline-first resilience** -- The bundled fallback ensures the feature works without internet. Degrade gracefully and communicate clearly.

### Implementation Priority

| Priority | Requirement | Complexity | Notes |
|---|---|---|---|
| P0 | INIT-01: Init Repo blade | Medium | Core blade structure, form, action |
| P0 | INIT-06: Branch name | Low | Single input, pre-filled from git config |
| P1 | INIT-02: Search/filter templates | Medium | API fetch, search, list rendering |
| P1 | INIT-04: Multi-template composition | Medium | Chip system, merge logic |
| P1 | INIT-10: Category browsing | Low | Client-side categorization of API data |
| P1 | INIT-03: Template preview | Low | Right column preview, already planned in layout |
| P1 | INIT-05: Offline fallback | Low | Static JSON bundle, fallback logic |
| P2 | INIT-07: README generation | Low | Toggle + two inputs + string template |
| P2 | INIT-08: Initial commit | Low | Toggle + input, calls existing git commands |
| P2 | INIT-09: Smart recommendations | Medium | New Rust command for file detection |

### Key Technical Decisions for Implementation

1. **New Rust command needed**: `detect_project_type(path: String) -> Vec<ProjectType>` -- scans directory for marker files
2. **Blade type**: Register as `"init-repo"` in `BladePropsMap` with `{ directoryPath: string }` props
3. **Template data**: React Query with `queryKey: ["gitignore-templates"]`, fetch from GitHub API, fallback to bundled
4. **Template content caching**: Individual template content cached per session with React Query
5. **State management**: Local component state (not Zustand) -- this is a transient form, not persistent app state
6. **Entry point modification**: Update `GitInitBanner` to open the Init Repo blade instead of inline init. Add "Init Repository" button to WelcomeView.

---

## Sources

- [GitHub Gitignore Templates Repository](https://github.com/github/gitignore)
- [GitHub REST API -- Gitignore Templates](https://docs.github.com/en/rest/gitignore/gitignore)
- [GitHub Desktop -- Creating Your First Repository](https://docs.github.com/en/desktop/overview/creating-your-first-repository-using-github-desktop)
- [GitHub Desktop Issue #275 -- Create new repos with gitignore/license/README](https://github.com/desktop/desktop/issues/275)
- [GitKraken -- Open, Clone, and Init](https://support.gitkraken.com/working-with-repositories/open-clone-init)
- [GitKraken Feedback -- Save custom .gitignore template](https://feedback.gitkraken.com/suggestions/269422/save-custom-gitignore-template-for-new-projects)
- [VS Code -- Source Control Overview](https://code.visualstudio.com/docs/sourcecontrol/overview)
- [SourceTree -- Create a Local Repository](https://confluence.atlassian.com/get-started-with-sourcetree/create-a-local-repository-847359103.html)
- [NNGroup -- Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [Material Design 3 -- Chips](https://m3.material.io/components/chips/guidelines)
- [CMS Design System -- Filter Chip Accessibility](https://design.cms.gov/components/filter-chip/)
- [Telerik -- MultiSelect Accessibility](https://www.telerik.com/design-system/docs/components/multiselect/accessibility/)
