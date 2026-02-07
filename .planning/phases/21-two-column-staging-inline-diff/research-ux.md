# Phase 21 UX Research: Two-Column Staging & Inline Diff

## 1. Competitive Analysis

### VS Code Source Control
- **Layout**: Single-column file list in the sidebar (Explorer-width panel); clicking a file opens the diff in the editor area (full width). No true two-column staging view unless the user manually arranges editor groups.
- **What works**: Keyboard-first workflow. `Ctrl+Enter` commits, inline stage/unstage icons on hover, checkboxes for multi-select. The diff opens in the standard editor tab, so it inherits all editor keybindings and features.
- **What doesn't**: Clicking a file navigates away from the file list. Users lose context and must click back. There is no split-pane staging view out of the box.
- **Takeaway for FlowForge**: VS Code's inline stage/unstage-on-hover pattern (the `+` and `-` icons) is the gold standard for single-file actions. Adopt this pattern directly.

### GitKraken
- **Layout**: Two-column split in the staging panel. Left column shows Staged/Unstaged/Untracked sections. Right column shows the diff of the selected file. The diff panel updates instantly on file selection.
- **What works**: The diff is always visible. Dragging files between sections is intuitive. Section headers have "Stage All" and "Unstage All" buttons. The selected file highlight uses a blue left-border accent (similar to FlowForge's current `border-l-2 border-ctp-blue`).
- **What doesn't**: The file list column has no tree view -- only flat paths. Long paths get truncated without a good tooltip. The resize handle is hard to discover.
- **Takeaway for FlowForge**: Adopt GitKraken's instant-diff-on-select model. Improve on their flat-only list by supporting tree view (FlowForge already has this).

### Sublime Merge
- **Layout**: Master-detail with file list on the left and diff on the right. The diff panel is the dominant area (~65-70%).
- **What works**: Hunk-level staging directly in the diff view. The file list is extremely compact (filename only, no path shown unless hovered). Keyboard navigation is fluid -- arrow keys in file list, Tab moves to diff.
- **What doesn't**: The file list feels cramped when many files are changed. No explicit "sections" for staged vs unstaged; they use inline badges instead.
- **Takeaway for FlowForge**: The compact file-name-only display in the tree view is important for the 40% column. Sublime Merge's Tab-to-switch-panels is the right focus model.

### Fork (macOS)
- **Layout**: Three-panel: file list (left), diff (center), and commit form (right). The file list has collapsible Staged/Unstaged sections with checkboxes.
- **What works**: Checkbox-based staging is fast. The file list shows only filenames in tree mode and full paths in flat mode. The diff panel preserves scroll position when switching between staged/unstaged views of the same file.
- **What doesn't**: Three panels feel crowded on smaller screens. The commit form is always visible, eating horizontal space.
- **Takeaway for FlowForge**: Fork's scroll-position-preservation is critical to implement. FlowForge already has the commit form in the left sidebar, so the two-column layout avoids Fork's crowding problem.

### Tower
- **Layout**: Two-column staging with a resizable split. Left panel has Working Copy and Staging Area tabs. Right panel shows diff.
- **What works**: The resize handle is a visible 4px bar with a hover state. Double-clicking the handle resets to default ratio. The diff panel header shows the file path with breadcrumb-style segments.
- **What doesn't**: The tab-based staging/working separation means users must switch tabs to see both staged and unstaged files.
- **Takeaway for FlowForge**: Adopt Tower's visible resize handle with hover state (FlowForge's `ResizeHandle` already does this). The double-click-to-reset feature is worth adding. Avoid Tower's tab separation -- FlowForge's three-section approach is better.

### SourceTree
- **Layout**: Two-column with file list on left, diff on right. Collapsible sections for Staged and Unstaged.
- **What works**: Search/filter at the top of the file list. Status badges are color-coded dots. The diff panel has a toolbar for switching between inline and side-by-side.
- **What doesn't**: The diff takes a moment to load when switching files, with no loading indicator. Keyboard navigation is poor -- no arrow key support in the file list.
- **Takeaway for FlowForge**: Always show a loading state during diff fetch. Ensure keyboard navigation works from day one -- it is not a nice-to-have.

### Competitive Summary Table

| Feature | VS Code | GitKraken | Sublime Merge | Fork | Tower | SourceTree | **FlowForge (target)** |
|---------|---------|-----------|---------------|------|-------|------------|------------------------|
| Split pane staging | No | Yes | Yes | Yes | Yes | Yes | **Yes** |
| Instant diff on select | Yes | Yes | Yes | Yes | Yes | Slow | **Yes** |
| Tree view in file list | Yes | No | No | Yes | No | No | **Yes** |
| Keyboard navigation | Good | Poor | Excellent | Good | Good | Poor | **Excellent** |
| Hunk staging in inline diff | No | No | Yes | No | No | No | **Deferred** |
| Resize handle | N/A | Hidden | Visible | Visible | Visible | Hidden | **Visible** |
| Expand to full diff | Tab-based | New window | N/A | N/A | N/A | N/A | **Push blade** |

---

## 2. Interaction Patterns for File List + Diff Side-by-Side

### File List Sections in the 40% Column

**Section structure**: Keep the existing three sections (Staged Changes, Changes, Untracked Files) as-is. They already have the right visual hierarchy. Specific adaptations for the narrower 40% column:

- **Make all sections collapsible.** Use the existing `ChevronDown`/`ChevronRight` toggle pattern already present in `FileList.tsx`. The tree view's `FileTreeView` section headers do not currently have collapse toggles at the section level -- add them. Default all populated sections to expanded.
- **Collapse empty sections entirely.** Do not render section headers for empty sections (the current code already does this with the `files.length === 0` guard).
- **Persist collapse state** in the `useStagingStore` so that returning from a full-screen diff blade restores the user's preferred section layout.

**Section header design for narrow column:**
- Left-align the section title with badge count.
- Right-align the "Stage All" / "Unstage All" button.
- Keep the header as a single row. Do not stack or wrap.

### Handling Long File Paths

**Tree view (default):**
- Display filename only (the existing `showFilenameOnly` prop on `FileItem`).
- Show the full path in a tooltip on hover (use `title` attribute or a custom tooltip component).
- Path depth is communicated by indentation via the tree structure.
- Truncate filenames with `truncate` (already applied via `text-sm text-ctp-text truncate` class).

**Flat view:**
- Use the "dim directory / bold filename" pattern already established in the diff blade title renderer. Specifically: render the directory portion in `text-ctp-overlay1` and the filename in `font-semibold text-ctp-text`.
- Truncate from the left (show `...src/components/StagingPanel.tsx` rather than `src/components/StagingPan...`). Implement this with `direction: rtl` and `text-overflow: ellipsis` on the path container, or use a custom truncation function that preserves the filename + one parent directory.
- Show the full path in a tooltip on hover.

### Selected File Indication

- Use the existing pattern: `bg-ctp-blue/20 border-l-2 border-ctp-blue` (already in `FileItem.tsx`).
- Add `aria-selected="true"` to the selected item.
- Ensure the selected item scrolls into view when changed programmatically (e.g., after arrow key navigation). Use `scrollIntoView({ block: 'nearest' })`.
- Do not use a checkbox or radio pattern -- the selection is single-select and click-based, so the visual highlight is sufficient.

### File List Width Behavior

- The file list panel has `minSize={20}` (as a percentage of the blade container).
- The search/filter bar at the top stays fixed (it already uses `shrink-0` behavior via border-b positioning).
- The stage/unstage action button on each file item stays visible on hover. In the narrow column, keep it at `w-6 h-6` (the current `p-1` with `w-3 h-3` icon is fine).

---

## 3. Keyboard Navigation UX

### Arrow Key Behavior Across Sections

Treat the three sections (Staged, Changes, Untracked) as one continuous virtual list for keyboard navigation purposes.

**Down arrow:**
- Move selection to the next file in the current section.
- If at the last file in a section, jump to the first file in the next non-empty section.
- If at the last file overall, wrap to the first file (wrap-around).

**Up arrow:**
- Mirror of down arrow. Move to previous file, cross section boundaries, wrap at the top.

**Section collapse interaction:**
- Arrow keys skip collapsed sections entirely.
- If the user collapses the section containing the currently selected file, move selection to the first file in the next visible section (prefer downward).

**Implementation approach:**
- Build a flat array of all visible files in section order: `[...stagedFiles, ...unstagedFiles, ...untrackedFiles]`, filtering out files in collapsed sections.
- Track the current index. Arrow keys increment/decrement the index.
- Update `useStagingStore.selectFile()` on each navigation.

### Tab / Focus Management

- **Tab** moves focus from the file list panel to the diff preview panel.
- **Shift+Tab** moves focus back from diff to file list.
- When the file list panel has focus, arrow keys navigate files.
- When the diff panel has focus, Monaco's built-in keyboard navigation applies (arrow keys scroll, Ctrl+G goes to line, etc.).
- Use `role="listbox"` on the file list container and `role="option"` on each file item (see Accessibility section below).
- On initial load, focus the file list panel automatically so the user can immediately start navigating with arrows.

### Keyboard Shortcuts for Stage/Unstage While Viewing

| Shortcut | Action | Context |
|----------|--------|---------|
| `Space` | Toggle stage/unstage for the currently selected file | File list has focus |
| `Cmd/Ctrl+Shift+A` | Stage all (already exists) | Global |
| `Enter` | Expand diff to full-screen blade | File list has focus |
| `Escape` | Return from full-screen diff to split view (already exists) | Full-screen diff blade |
| `Cmd/Ctrl+Enter` | Expand diff to full-screen blade (alternative) | Either panel has focus |

**Space for stage/unstage rationale**: Space is the standard toggle key for selected items in list interfaces (macOS Finder, VS Code, most file managers). It does not conflict with any existing shortcut.

### Focus Management When a File Moves Between Sections

When the user stages or unstages the currently selected file:

1. The file moves from one section to another (e.g., Changes -> Staged Changes).
2. **Keep the same file selected.** The `useStagingStore.selectedFile` stays the same; only `selectedSection` updates.
3. The file list re-renders with the file in its new section.
4. **Scroll the new position into view** using `scrollIntoView({ block: 'nearest' })`.
5. The diff panel stays on the same file. The diff query key changes (the `staged` boolean flips), so the diff re-fetches, but the file path remains constant.

Implementation detail: After a stage/unstage mutation succeeds and the query refetches, compare the `selectedFile.path` against the new staging status lists to determine which section it now belongs to, then call `selectFile(file, newSection)`.

---

## 4. Diff Panel Empty/Loading/Error States

### Loading State

- Show a centered `Loader2` spinner with `animate-spin` (consistent with the existing `DiffBlade` loading state).
- Add a subtle text label below: "Loading diff..." in `text-ctp-overlay1 text-xs`.
- The loading state should appear within 100ms of file selection to avoid a blank flash. Use React's `useTransition` or a minimum display time.
- **Do not show a skeleton loader** for the diff panel. The Monaco editor has a complex layout that skeleton cannot meaningfully approximate. A simple centered spinner is cleaner.

### No Diff Available (Binary Files, New Untracked Files)

**Binary files:**
- Show a centered placeholder: file type icon (from `FileTypeIcon`), the filename in `text-ctp-text text-sm font-medium`, the text "Binary file" in `text-ctp-overlay1 text-xs`, and a button "Open in Full View" styled with `variant="outline"`.
- The button triggers the same expand-to-blade action as the maximize icon.

**New untracked files (no previous version to diff against):**
- Show the file content as a full "added" diff (all lines green). The existing Monaco DiffEditor handles this correctly when `oldContent` is empty. No special state needed.

**Image files:**
- Show a centered placeholder: image icon (from Lucide `ImageIcon`), the filename, "Image file" label, and "Open in Full View" button.
- Do not render an inline thumbnail. The image viewer blade handles this.

**Empty files:**
- Show a centered message: "Empty file" in `text-ctp-overlay1 text-sm`.

### Large Diffs (Performance)

- **Monaco DiffEditor handles large files well** up to ~50,000 lines thanks to virtualized rendering.
- For files over 10,000 changed lines, show a warning bar above the diff: "Large diff (N lines changed). Rendering may be slow." Style: `bg-ctp-yellow/10 text-ctp-yellow text-xs px-3 py-1`.
- **Do not truncate diffs.** Always show the full diff. Truncation leads to confusion about what changed.
- Set `automaticLayout: true` (already set) so Monaco adapts when the panel resizes.
- Use `scrollBeyondLastLine: false` (already set) to prevent wasted space.

### Error State

- Match the existing DiffBlade error pattern: centered red text "Failed to load diff" in `text-ctp-red text-sm`.
- Add a "Retry" button below using `variant="ghost"` that re-triggers the query.
- Log the error details to the console for debugging.

---

## 5. Transition UX: Inline to Full Blade

### Expand Animation

When the user clicks the maximize icon or presses `Enter`:

1. **Push a new blade** onto the blade stack using `openStagingDiff()` (the existing function already does this).
2. The `BladeContainer`'s `AnimatePresence` handles the slide-in animation: `{ x: 40, opacity: 0 }` -> `{ x: 0, opacity: 1 }` over 200ms.
3. The staging blade collapses into a `BladeStrip` (the vertical tab on the left) showing "Changes" as the label.
4. No additional animation is needed beyond what the blade system already provides.

**Maximize icon placement:** Top-right corner of the diff panel, inside the diff toolbar (the bar that currently shows the inline/side-by-side toggle in `DiffBlade`). Use `Maximize2` from Lucide (the expand-arrows icon). Size: `w-4 h-4`. Style: `text-ctp-overlay1 hover:text-ctp-text`.

### Back Navigation from Full to Split View

When the user clicks the back button or presses `Escape`:

1. The blade system pops the diff blade (existing behavior).
2. The staging blade re-renders with the two-column layout.
3. **The same file must be selected.** The `useStagingStore.selectedFile` persists across blade transitions because it is in a Zustand store (not component state). This works out of the box.
4. **Scroll position in the file list** should be preserved. Since the `StagingPanel` is the root blade and never unmounts (it just gets covered by the BladeStrip), React preserves the DOM and scroll state automatically.

### Scroll Position Preservation in the Diff Panel

- **Best-effort, not guaranteed.** When the inline diff panel re-mounts after returning from full-screen, the Monaco editor re-renders from scratch. The same file will be loaded, but scroll position resets to the top.
- **Recommended approach**: Store the scroll position in the staging store (`diffScrollTop: number`) before expanding. On re-mount, use `editor.setScrollTop(savedScrollTop)` via the Monaco `onMount` callback.
- This is a polish item. Implement it if time allows, but do not block the phase on it.

### File Navigation in Full-Screen Diff

- Add "Previous file" and "Next file" buttons to the full-screen diff blade's title bar (in the `renderTrailing` slot).
- Use `ChevronLeft` and `ChevronRight` icons from Lucide, each `w-4 h-4`.
- The navigation order follows the same flat list used for arrow-key navigation: `[...staged, ...unstaged, ...untracked]`.
- When navigating, replace the current blade (using `store.replaceBlade()`) rather than push+pop, so the animation is a cross-fade rather than a slide.
- Show the current position: "3 of 12" in `text-ctp-overlay1 text-xs` between the arrows.
- Keyboard shortcuts in full-screen diff: `Alt+Up` for previous file, `Alt+Down` for next file (matches VS Code convention).

---

## 6. Accessibility Considerations

### Two-Panel Layout ARIA Structure

```
<div role="region" aria-label="Staging view">
  <div role="region" aria-label="Changed files">
    <!-- file list panel -->
  </div>
  <div role="separator" aria-orientation="vertical" aria-label="Resize handle" />
  <div role="region" aria-label="Diff preview">
    <!-- diff panel -->
  </div>
</div>
```

- Use `role="region"` with `aria-label` on each panel so screen readers can identify them with landmark navigation.
- The resize handle should have `role="separator"` with `aria-orientation="vertical"` and `aria-valuenow` / `aria-valuemin` / `aria-valuemax` for the current split ratio. The `react-resizable-panels` library handles this.

### File List ARIA Roles

Use the **listbox** pattern (not tree), even when displaying tree view. Rationale: the tree view is a visual grouping aid, but the interaction model is a flat single-select list. Using `role="tree"` would require implementing full tree keyboard semantics (expand/collapse with right/left arrows), which conflicts with the continuous-list navigation model.

```
<div role="listbox" aria-label="Staged changes" aria-multiselectable="false">
  <div role="option" aria-selected="true" tabindex="0">file.tsx</div>
  <div role="option" aria-selected="false" tabindex="-1">other.ts</div>
</div>
```

- Each section (Staged, Changes, Untracked) is a separate `role="listbox"` with its own `aria-label`.
- The selected file has `aria-selected="true"` and `tabindex="0"`. All others have `tabindex="-1"`.
- When a file is staged/unstaged, announce the action with `aria-live="polite"` on a visually hidden status region: "file.tsx staged" or "file.tsx unstaged".

### Focus Management

- **Do not use a focus trap** on either panel. Focus traps are for modal dialogs. The two-panel layout is a non-modal split view where the user must be able to move freely between panels with Tab.
- When the component mounts, set initial focus on the first file in the list using `useEffect` + `ref.focus()`.
- After stage/unstage, return focus to the file that was acted on (it moved sections but stays selected).

### Screen Reader Announcements

- When the selected file changes (via arrow keys or click), announce the new file: "Selected: filename.tsx, modified, in Changes section." Use `aria-live="assertive"` on a visually hidden element or rely on the `aria-selected` change.
- When the diff loads, announce: "Diff loaded for filename.tsx." Use `aria-live="polite"`.
- When expanding to full-screen: "Expanded diff view for filename.tsx."

### Color and Contrast

- The status dots (`bg-ctp-green`, `bg-ctp-red`, `bg-ctp-yellow`, `bg-ctp-blue`) must not be the sole indicator of file status. The existing design pairs each dot with a text label (via `title` attribute) and the `+N -N` change count. This is sufficient.
- The selected file highlight (`bg-ctp-blue/20`) combined with the `border-l-2 border-ctp-blue` provides a non-color-only visual indicator (the border is a structural change). This meets WCAG 1.4.1.

### Reduced Motion

- Wrap the blade transition animations with `motion-safe:` where possible.
- The `AnimatePresence` animation in `BladeContainer` should respect `prefers-reduced-motion`. Add a check: if reduced motion is preferred, set `transition.duration` to `0`.
- The resize handle hover state (`bg-ctp-blue`) uses `transition-colors`, which is fine -- color transitions are not problematic for motion sensitivity.

---

## 7. Extensibility: Reusable Split-Pane Pattern

### Component Architecture

Create a generic `SplitPaneBlade` component that can be used by any blade type needing a master-detail layout.

```typescript
interface SplitPaneBladeProps {
  /** Unique ID for persisting resize state via react-resizable-panels */
  autoSaveId: string;
  /** Default size of the left panel as a percentage (default: 40) */
  defaultLeftSize?: number;
  /** Minimum size of the left panel as a percentage (default: 20) */
  minLeftSize?: number;
  /** Minimum size of the right panel as a percentage (default: 30) */
  minRightSize?: number;
  /** Content for the left (master) panel */
  masterPanel: ReactNode;
  /** Content for the right (detail) panel */
  detailPanel: ReactNode;
  /** ARIA label for the master panel region */
  masterLabel: string;
  /** ARIA label for the detail panel region */
  detailLabel: string;
}
```

This component wraps `ResizablePanelLayout` + two `ResizablePanel`s + `ResizeHandle` with the correct ARIA attributes and default sizes.

### Where This Pattern Applies

| Blade Type | Master Panel | Detail Panel |
|------------|-------------|-------------|
| `staging-changes` (Phase 21) | File list (Staged/Changes/Untracked) | Inline diff preview |
| `repo-browser` (future) | File/folder tree | File content preview |
| `commit-details` (future enhancement) | Changed files list | Diff for selected file |
| `stash-details` (future) | Stashed files list | Diff for selected file |

### Abstraction Boundaries

**The `SplitPaneBlade` component should NOT:**
- Know about file types, sections, or staging logic.
- Handle keyboard navigation between panels (that is the consumer's responsibility).
- Manage selection state.

**The `SplitPaneBlade` component SHOULD:**
- Handle the resize layout, persistence, and minimum sizes.
- Provide the correct ARIA landmark structure.
- Accept a `className` prop for the outer container.
- Forward the `ResizablePanelLayout` `autoSaveId` so resize state persists per blade type.

### File List Abstraction

The `StagingPanel` component currently mixes layout concerns (being the full blade content) with data concerns (fetching staging status, managing mutations). Refactor into:

1. **`StagingFileList`** -- the pure file list UI (sections, search, tree/flat toggle). Receives data as props. Emits `onFileSelect`, `onStage`, `onUnstage` callbacks. This component can be rendered inside the `SplitPaneBlade`'s master panel.
2. **`StagingChangesBlade`** -- the blade that composes `SplitPaneBlade` with `StagingFileList` as master and an inline diff component as detail.

This separation means `StagingFileList` can be reused in contexts like a commit-details blade where you want to show a file list of changed files with a diff preview.

### Inline Diff Component

Create an `InlineDiffPreview` component that is a lighter version of `DiffBlade`:

- Same Monaco DiffEditor setup.
- No inline/side-by-side toggle (always inline in the preview -- the full blade has the toggle).
- Adds the maximize button in the top-right corner.
- Handles the binary/image/non-text placeholder states.
- Accepts `source: DiffSource` as a prop plus an `onExpand` callback.

This component is distinct from `DiffBlade` because:
- It has different toolbar content (maximize button, no mode toggle).
- It is not a standalone blade -- it is a child of the staging blade.
- It may have different Monaco options (e.g., `minimap: { enabled: false }`, smaller font size).

---

## 8. Implementation Priorities

Based on the analysis above, here is the recommended build order:

### Phase 21.1 -- Core Split Layout (Must Have)
1. Create `SplitPaneBlade` generic component.
2. Refactor `StagingChangesBlade` to use `SplitPaneBlade` with file list as master, placeholder as detail.
3. Create `InlineDiffPreview` component with Monaco DiffEditor.
4. Wire file selection -> diff preview (auto-select first file on load).
5. Add maximize button to expand to full diff blade.

### Phase 21.2 -- Keyboard Navigation (Must Have)
1. Implement arrow key navigation across sections.
2. Add Space to toggle stage/unstage.
3. Add Tab to move focus between panels.
4. Add Enter to expand to full blade.
5. Wire `Alt+Up` / `Alt+Down` for file navigation in full-screen diff.

### Phase 21.3 -- Polish (Should Have)
1. File path truncation (left-truncation in flat view).
2. Binary/image placeholder states.
3. Loading spinner with label.
4. Large diff warning bar.
5. Error retry button.
6. "N of M" file position indicator in full-screen diff.
7. Scroll position preservation (best-effort).

### Phase 21.4 -- Accessibility Audit (Should Have)
1. ARIA roles and labels.
2. Screen reader announcements for stage/unstage.
3. Reduced motion support.
4. Focus management on mount and after actions.

---

## 9. Detailed Component Wiring

### Data Flow Diagram

```
StagingChangesBlade
  |
  +-- SplitPaneBlade (layout only)
  |     |
  |     +-- [Master] StagingFileList
  |     |     |-- FileTreeSearch
  |     |     |-- Section: Staged Changes
  |     |     |     |-- FileTreeView / FileList
  |     |     |-- Section: Changes
  |     |     |     |-- FileTreeView / FileList
  |     |     |-- Section: Untracked Files
  |     |           |-- FileTreeView / FileList
  |     |
  |     +-- [Detail] InlineDiffPreview
  |           |-- Toolbar (maximize button)
  |           |-- Monaco DiffEditor
  |           |-- OR: Placeholder (binary/image/empty)
  |
  +-- useStagingStore (selectedFile, selectedSection, viewMode)
  +-- useQuery("stagingStatus") (file lists)
  +-- useQuery("fileDiff") (diff content, keyed to selectedFile)
```

### State Management

The `useStagingStore` already has the right shape. Extend it minimally:

```typescript
interface StagingState {
  selectedFile: FileChange | null;
  selectedSection: "staged" | "unstaged" | "untracked" | null;
  viewMode: ViewMode;
  collapsedSections: Set<string>;  // NEW: track collapsed sections
  diffScrollTop: number;           // NEW: preserve scroll position
  selectFile: (...) => void;
  setViewMode: (...) => void;
  toggleSection: (section: string) => void;  // NEW
  setDiffScrollTop: (top: number) => void;   // NEW
}
```

### Query Strategy for the Inline Diff

- Use the same `useQuery` pattern as `DiffBlade` but inside the `InlineDiffPreview` component.
- The query key includes the file path, staged boolean, and context lines: `["fileDiff", filePath, staged, contextLines]`.
- Set `staleTime: 0` for staging diffs (working tree changes frequently).
- When `selectedFile` changes, the old query stays cached and the new one fetches. This means switching between two files is instant on the second visit (cache hit).
- Use `keepPreviousData: true` (or `placeholderData` in TanStack Query v5) so the old diff stays visible while the new one loads, preventing a blank flash.

---

## 10. Visual Specifications

### Resize Handle

- Width: 4px (`w-1` in Tailwind, matching existing `ResizeHandle`).
- Default: `bg-ctp-surface0`.
- Hover: `bg-ctp-blue`.
- Active (dragging): `bg-ctp-blue`.
- Cursor: `cursor-col-resize`.
- The existing `ResizeHandle` component already implements this. Reuse it directly.

### Diff Panel Toolbar

- Height: 32px (`h-8`).
- Background: `bg-ctp-crust`.
- Border: `border-b border-ctp-surface0`.
- Left side: file path in the dim-directory/bold-filename pattern.
- Right side: maximize button (`Maximize2` icon).
- This is a new component (`DiffPreviewToolbar`), not the same as the `DiffBlade` toolbar (which has the inline/side-by-side toggle).

### Selected File in File List

- Background: `bg-ctp-blue/20`.
- Left border: `border-l-2 border-ctp-blue`.
- Text color: unchanged (`text-ctp-text`).
- Transition: `transition-colors` for smooth selection changes.
- This matches the existing `FileItem` selected state exactly.

### Section Headers

- Font: `text-sm font-medium text-ctp-subtext1`.
- Badge: `text-xs text-ctp-overlay0 bg-ctp-surface0 px-1.5 py-0.5 rounded`.
- Action button: `text-xs text-ctp-subtext0 hover:text-ctp-text`.
- These match the existing staging panel headers exactly.

---

*Created: 2026-02-07*
*Phase: 21 -- Two-Column Staging & Inline Diff*
*Author: UX & Interaction Design Research*
