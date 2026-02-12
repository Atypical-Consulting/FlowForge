# Phase 50 UX Research: Hunk & Line Staging

## 1. UX Patterns in Existing Git GUIs

### Sublime Merge
- **Best-in-class hunk/line staging.** The diff view shows hunk headers with "Stage Hunk" / "Discard Hunk" buttons that appear on hover or keyboard focus. Line-level staging is done by selecting one or more lines and then clicking "Stage Lines" (the button label changes dynamically based on selection).
- **Gutter buttons appear on hover** over a hunk. A focused hunk (keyboard cursor inside it) also shows the buttons. There is a known UX issue: if both mouse hover and keyboard focus land on different hunks simultaneously, two sets of buttons appear, creating ambiguity about which hunk keyboard shortcuts will act on.
- **What works well**: The dynamic button label ("Stage Hunk" vs "Stage Lines") is highly discoverable. The context line drag handles let users expand/collapse context around hunks. Navigation between hunks via keyboard (`Tab` / `Shift+Tab`) is fluid.
- **What frustrates**: The hover-vs-focus ambiguity. The buttons can overlap content in dense diffs. No visual indicator of partially staged files in the file list itself.
- **Takeaway for FlowForge**: Adopt the dynamic "Stage Hunk" / "Stage Lines" button pattern. Resolve the hover-vs-focus ambiguity by using a single "active hunk" concept (either hovered or focused, not both). The hunk that most recently received interaction is the active one.

### VS Code
- **Stage Selected Ranges**: Users open a diff editor, select lines, then right-click and choose "Stage Selected Ranges" or use the gutter "Stage" button that appears next to the selection. The gutter also shows color-coded bars: green for additions, blue for modifications, red triangle for deletions.
- **Hunk-level staging**: Clicking the color margin in the editor triggers a "Peek Difference" inline widget with "Stage Change" and "Revert Change" buttons. Users can navigate between changes with `Alt+F5` / `Shift+Alt+F5`.
- **What works well**: The inline Peek Difference widget is contextual -- it appears right where the change is, minimizing context switching. The color-coded gutter bars are always visible, serving as both indicators and click targets. Keyboard shortcut `F7` opens an Accessible Diff Viewer for screen readers.
- **What frustrates**: "Stage Selected Ranges" sometimes stages the entire hunk even when only a subset of lines is selected (a known bug/behavior confusion). The Peek Difference widget is modal-like and blocks the view below it. There is no dedicated "Stage Hunk" button -- users must click the gutter, which is not obvious to newcomers.
- **Takeaway for FlowForge**: Adopt the always-visible color-coded gutter indicators. Provide explicit "Stage Hunk" buttons rather than relying on implicit gutter clicks. For line-level staging, use a text selection + action model (not per-line checkboxes, which are too noisy).

### GitKraken
- **Hunk View / Inline View / Split View**: GitKraken shows diff in three modes. In Hunk View, each hunk is a collapsible card with "Stage this Hunk" and "Discard this Hunk" buttons. Right-clicking allows staging individual lines.
- **Line-level staging**: Right-click on a line in the diff to stage/unstage it. There is no gutter control or visual affordance for this -- it is buried in the context menu.
- **What works well**: Hunk View mode is very clear about hunk boundaries. The card-based layout makes hunks visually distinct. "Revert Hunk" was added recently and is useful.
- **What frustrates**: Line-level staging is hidden behind right-click, making it nearly undiscoverable. No batch staging of selected line ranges. No keyboard shortcuts for hunk operations. Users have requested batch staging of the same hunk across multiple files.
- **Takeaway for FlowForge**: Make line-level staging a first-class citizen, not a right-click afterthought. The card-based hunk layout is interesting but does not fit Monaco's inline editor paradigm. Instead, use clear visual separators between hunks.

### Fork (macOS/Windows)
- **Checkbox-based staging**: Fork shows checkboxes next to each line in the diff gutter. Users click individual checkboxes to stage/unstage specific lines. Clicking the hunk header checkbox stages/unstages the entire hunk.
- **Tri-state checkbox in file list**: The file list shows a filled checkbox (all lines staged), empty checkbox (no lines staged), or a square/dash (partially staged). This is the clearest "partially staged" indicator in any GUI tested.
- **What works well**: The checkbox metaphor is immediately intuitive -- everyone understands checkboxes. The tri-state indicator in the file list gives at-a-glance understanding of partial staging state. Shift-click to select a range of checkboxes works as expected.
- **What frustrates**: On large diffs with thousands of lines, every line having a checkbox creates visual clutter. The checkboxes are small and hard to click precisely. Performance degrades with very large diffs because every checkbox is a DOM element.
- **Takeaway for FlowForge**: The tri-state file indicator is excellent -- adopt it. However, avoid per-line checkboxes due to visual noise and performance concerns. Instead, use a selection-based model for lines and explicit buttons for hunks.

### Tower (macOS/Windows)
- **Chunk & Line Staging**: Tower allows clicking line numbers to select lines, then a "Stage Lines" button appears (replacing the "Stage Chunk" button when lines are selected). The stage button is always visible in each hunk header area.
- **Tri-state indicator**: Tower uses a checkbox with three states -- checked (all staged), unchecked (none staged), and a filled square (partially staged). This appears in the file list sidebar.
- **What works well**: The line-number-click selection model is elegant -- it uses an existing UI element (line numbers) as click targets, avoiding extra UI chrome. The button label dynamically changes between "Stage Chunk" and "Stage Lines" based on whether a selection exists.
- **What frustrates**: The line number click target is small. There is no visual feedback during the selection process (no highlight until the click completes). Multi-line selection requires click-drag on line numbers, which can be imprecise.
- **Takeaway for FlowForge**: Tower's approach of using line numbers as selection targets and dynamically changing the action button is the most refined pattern. Combine this with visual selection feedback (highlight lines as they are selected) for better usability.

### JetBrains IDEs (IntelliJ, WebStorm, etc.)
- **Gutter change markers**: The editor gutter shows colored markers for changes. Clicking a marker opens an inline diff popup with "Rollback" and stage actions.
- **Changelist model**: JetBrains offers an alternative to git staging via "changelists" -- logical groupings of changes that can be committed independently. Hunk-level works with drag-and-drop between changelists.
- **What works well**: The gutter markers are always visible and serve as both indicators and affordances. The inline diff popup is compact and shows just the relevant change.
- **What frustrates**: The changelist model is confusing for users accustomed to git's staging area. Line-level staging is not easy -- JetBrains' own support acknowledges this limitation.
- **Takeaway for FlowForge**: The gutter marker + click-to-stage pattern is battle-tested across millions of JetBrains users. Adopt the always-visible gutter markers. Skip the changelist concept entirely -- FlowForge should use git-native staging.

### GitHub Desktop
- **Line-level checkboxes**: GitHub Desktop shows checkboxes in the gutter of the diff view. Each changed line has a checkbox. Clicking a checkbox stages/unstages that individual line.
- **Hunk header checkbox**: Each hunk header has a checkbox that toggles all lines in the hunk.
- **What works well**: Very straightforward and beginner-friendly. The checkbox is always visible, so discoverability is high.
- **What frustrates**: Per-line checkboxes create significant visual clutter, especially for large diffs. There is no selection-range staging (you cannot Shift-click to stage a range). Staging individual lines via checkbox is slow for large changes because each click requires a separate operation. The feature was initially "not obvious" according to user feedback.
- **Takeaway for FlowForge**: The hunk header checkbox pattern is useful but the per-line checkbox model is too noisy. FlowForge should prioritize a cleaner approach for line staging.

### Competitive Summary

| Feature | Sublime Merge | VS Code | GitKraken | Fork | Tower | JetBrains | GitHub Desktop | **FlowForge (target)** |
|---------|---------------|---------|-----------|------|-------|-----------|----------------|------------------------|
| Hunk staging | Hover button | Gutter click | Card button | Header checkbox | Header button | Gutter popup | Header checkbox | **Gutter button** |
| Line staging | Selection + button | Selection + context menu | Right-click only | Per-line checkbox | Line number click | Limited | Per-line checkbox | **Selection + gutter button** |
| Keyboard hunk nav | Tab/Shift+Tab | Alt+F5 | None | None | None | None | None | **Ctrl+Shift+Up/Down** |
| Partial stage indicator | None | File label | None | Tri-state checkbox | Tri-state checkbox | None | None | **Tri-state icon** |
| Always visible controls | On focus/hover | Gutter bars | Hunk cards | Checkboxes | Header buttons | Gutter markers | Checkboxes | **Gutter indicators** |

---

## 2. Interaction Design for Gutter Controls

### Recommended Approach: Hybrid Gutter with Hover Actions

FlowForge should use a **two-zone gutter** in the diff viewer:

#### Zone 1: Always-Visible Stage Indicator (Gutter Margin)
- A narrow (16px) column in the gutter margin, between the line numbers and the diff content.
- **For addition lines** (`+`): A vertical green bar (`bg-ctp-green/30`) fills this column.
- **For deletion lines** (`-`): A vertical red bar (`bg-ctp-red/30`) fills this column.
- **For staged lines**: The bar is solid (`bg-ctp-green` or `bg-ctp-red` at full opacity) to indicate "this line is staged."
- **For unstaged lines**: The bar is semi-transparent to indicate "this line is not yet staged."
- This indicator is always visible and provides at-a-glance state without interaction.

#### Zone 2: Hunk Header Action Bar
- Each hunk header line (the `@@ -X,Y +A,B @@` line) gets a floating action bar that appears on hover or keyboard focus.
- The bar contains:
  - **"Stage Hunk"** button (when viewing unstaged changes) or **"Unstage Hunk"** button (when viewing staged changes).
  - A **checkbox** that reflects the hunk's staging state (checked = fully staged, unchecked = fully unstaged, indeterminate = partially staged).
  - The hunk's line range summary (e.g., "Lines 42-67, 12 additions, 3 deletions").
- The action bar is anchored to the right side of the hunk header, above the diff content.
- On hover, the bar slides in from the right with a `150ms` ease transition.
- On keyboard focus (when the hunk is the active hunk), the bar is always visible.

#### Why Not Per-Line Checkboxes?
- Visual clutter: In a 500-line diff with 200 changed lines, 200 checkboxes create a wall of small targets.
- Performance: Each checkbox is a separate interactive DOM element that must track state.
- Precision: Small checkboxes are hard to click, especially on high-DPI displays where visual size does not match clickable area.
- Conflict with Monaco: Monaco Editor's gutter is designed for line numbers and decorations, not interactive form elements. Adding checkboxes would require custom glyph margin widgets that fight Monaco's rendering model.

#### Why Not Always-Visible Buttons?
- Dense diffs would have buttons overlapping on every hunk header, consuming vertical space.
- Always-visible buttons create decision paralysis when there are many hunks.
- The hover pattern keeps the UI clean when the user is reading the diff (most of the time) and reveals actions only when the user signals intent by hovering over a hunk.

### Hunk Boundary Visual Design
- Each hunk is separated by a collapsible "unchanged region" (already implemented via Monaco's `hideUnchangedRegions`).
- The hunk header line gets a distinct background: `bg-ctp-surface0` with `border-t border-ctp-surface1`.
- The hunk header text (e.g., `@@ -42,12 +42,15 @@ function processData()`) is displayed in `text-ctp-overlay1 font-mono text-xs`.

---

## 3. Line Selection UX

### Primary Model: Text Selection + Action

The recommended approach for line-level staging is a **text selection model**, not a checkbox model:

1. **User selects lines** by clicking and dragging in the diff content area, or by Shift-clicking line numbers to select a range.
2. **A floating action bar appears** near the selection (above or below, depending on available space) with:
   - "Stage Selected Lines" / "Unstage Selected Lines" button.
   - The count of selected lines (e.g., "3 lines selected").
   - A "Discard Selected Lines" button (destructive, styled in `text-ctp-red`).
3. **The action bar disappears** when the selection is cleared (click elsewhere, press Escape).

### Selection Methods

| Method | Behavior |
|--------|----------|
| Click + drag in content area | Selects a range of lines (standard text selection) |
| Click line number | Selects that single line |
| Shift + click line number | Extends selection from the last clicked line to this line |
| Ctrl/Cmd + click line number | Toggles individual line in/out of selection (multi-select) |
| Ctrl/Cmd + A (within hunk) | Selects all changed lines in the current hunk |

### Visual Feedback for Selection

- **Selected lines** get a highlight overlay: `bg-ctp-blue/20` (matching the existing editor selection color).
- **Selected line numbers** are highlighted in `text-ctp-blue font-bold` to reinforce the selection.
- **The gutter indicator bar** for selected lines transitions to `bg-ctp-blue` to show "these lines are targeted for action."
- **Non-selected lines within a hunk** remain in their default state (green/red bar at standard opacity).

### State Communication

Lines in the diff viewer can be in the following states:

| State | Gutter Bar Color | Background | Line Number Color |
|-------|-----------------|------------|-------------------|
| Unstaged addition | `bg-ctp-green/30` | `bg-ctp-green/6` (standard diff bg) | `text-ctp-overlay0` |
| Staged addition | `bg-ctp-green` (solid) | `bg-ctp-green/15` (brighter) | `text-ctp-green/70` |
| Unstaged deletion | `bg-ctp-red/30` | `bg-ctp-red/6` (standard diff bg) | `text-ctp-overlay0` |
| Staged deletion | `bg-ctp-red` (solid) | `bg-ctp-red/15` (brighter) | `text-ctp-red/70` |
| Selected (for action) | `bg-ctp-blue` | `bg-ctp-blue/20` | `text-ctp-blue` |
| Context (unchanged) | None | `bg-ctp-crust` | `text-ctp-overlay0` |

### Multi-Line Selection Constraints

- Selection should only include **changed lines** (additions or deletions). Context lines should be excluded from the selection or ignored when staging.
- If the user's text selection spans context lines, the staging action should apply only to the changed lines within the selection range.
- Selections cannot span across hunk boundaries. If the user tries to select across a hunk separator, the selection is clipped to the current hunk.

---

## 4. Keyboard Navigation

### Hunk Navigation

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+Shift+Down` / `]` | Jump to next hunk header | Diff viewer focused |
| `Ctrl+Shift+Up` / `[` | Jump to previous hunk header | Diff viewer focused |
| `Ctrl+Shift+Enter` | Stage/Unstage current hunk | Diff viewer focused, hunk active |
| `Ctrl+Shift+Backspace` | Discard current hunk | Diff viewer focused, hunk active |

### Line Navigation and Staging

| Shortcut | Action | Context |
|----------|--------|---------|
| `Up` / `Down` | Move cursor between lines | Standard Monaco behavior |
| `Shift+Up` / `Shift+Down` | Extend line selection | Standard Monaco behavior |
| `Ctrl+Shift+S` | Stage selected lines | Lines selected in diff |
| `Ctrl+Shift+U` | Unstage selected lines | Lines selected in diff |
| `Escape` | Clear selection / deactivate hunk | Diff viewer focused |

### File-Level Shortcuts (Existing, Preserved)

| Shortcut | Action | Context |
|----------|--------|---------|
| `Space` | Toggle stage/unstage entire file | File list focused |
| `j` / `Down` | Next file | File list focused |
| `k` / `Up` | Previous file | File list focused |
| `Enter` | Expand diff to full view | File list focused |
| `Ctrl+Shift+A` | Stage all files | Global |

### Focus Management

- `Tab` moves focus from the file list panel to the diff viewer.
- `Shift+Tab` moves focus from the diff viewer to the file list.
- When the diff viewer receives focus, the first hunk is automatically activated (its action bar becomes visible).
- `[` and `]` (bracket keys) navigate between hunks when the diff viewer is focused. This matches Sublime Merge's navigation model and is ergonomic for keyboard-heavy workflows.
- When a hunk is activated via keyboard, its header scrolls into view and the cursor moves to the first changed line in the hunk.

### Vim-Style Alternatives

For users who prefer vim keybindings (already partially supported with `j`/`k` in the file list):

| Shortcut | Action |
|----------|--------|
| `]c` | Next hunk (matches vim-gitgutter) |
| `[c` | Previous hunk (matches vim-gitgutter) |
| `s` | Stage hunk at cursor / stage selected lines |
| `u` | Unstage hunk at cursor / unstage selected lines |

These should be gated behind a "vim keybindings" preference to avoid conflicts.

---

## 5. Visual Feedback & State Communication

### File-Level Indicators (in the Staging Panel file list)

**Tri-state staging icon** next to each file name:

| State | Icon | Color | Description |
|-------|------|-------|-------------|
| Fully staged | Filled circle / filled checkbox | `text-ctp-green` | All changes in this file are staged |
| Fully unstaged | Empty circle / empty checkbox | `text-ctp-overlay0` | No changes in this file are staged |
| Partially staged | Half-filled circle / dash checkbox | `text-ctp-yellow` | Some hunks/lines are staged, some are not |

The tri-state icon replaces the current binary "staged vs unstaged" section model for files that are partially staged. A partially staged file appears in **both** the "Staged Changes" and "Changes" sections simultaneously, with the tri-state icon in each.

### Hunk-Level Indicators

Each hunk header displays a compact status badge:

| State | Badge | Color |
|-------|-------|-------|
| All lines in hunk staged | Filled dot | `bg-ctp-green` |
| No lines in hunk staged | Empty ring | `border-ctp-overlay0` |
| Some lines staged | Half-filled dot | `bg-ctp-yellow` |

### Real-Time Feedback

When the user stages a hunk or lines:

1. **Immediate gutter update**: The gutter bars transition from semi-transparent to solid (or vice versa) with a `150ms` ease transition.
2. **Staging panel refresh**: The staging panel's file list updates in real-time via query invalidation (`queryClient.invalidateQueries({ queryKey: ["stagingStatus"] })`). The existing 2-second polling interval is supplemented by an immediate invalidation after any staging action.
3. **Toast notification** (optional, disabled by default): A brief toast at the bottom of the diff viewer: "Staged 1 hunk (5 lines)" in `text-ctp-green text-xs`, auto-dismissing after 2 seconds. This is useful for keyboard users who cannot see the gutter change while focused on the action.
4. **Screen reader announcement**: An `aria-live="polite"` region announces "Staged hunk, lines 42 through 67" or "Unstaged 3 lines."

### Animation Design

- Gutter bar color transitions: `transition-colors duration-150 ease-in-out`.
- Hunk action bar entrance: `opacity-0 translate-x-2 -> opacity-100 translate-x-0` over `150ms`.
- Line selection floating bar: `opacity-0 translate-y-1 -> opacity-100 translate-y-0` over `100ms`.
- All animations respect `prefers-reduced-motion` via `motion-safe:` prefix.

---

## 6. Edge Cases & Accessibility

### Large Diffs (> 1000 changed lines)

- **Performance**: Monaco Editor handles large files well with virtualized rendering. The gutter indicators and hunk action bars are rendered as Monaco decorations (not DOM overlays), so they benefit from virtualization.
- **Cognitive load**: For diffs with more than 20 hunks, add a **hunk navigator** -- a compact sidebar or dropdown showing all hunk headers with their staging state. Users can click a hunk in the navigator to jump to it in the diff. This is similar to VS Code's outline view.
- **Warning**: For diffs with more than 500 changed lines, show a non-blocking info bar: "Large diff -- X hunks, Y changed lines. Use hunk staging for faster review." Style: `bg-ctp-surface0 text-ctp-subtext0 text-xs px-3 py-1 border-b border-ctp-surface1`.
- **Batch operations**: Provide "Stage All Hunks" and "Unstage All Hunks" buttons in the diff toolbar header for quick bulk actions.

### Conflicting Selections

- If the user selects lines that span both additions and deletions within the same hunk, the staging action applies to all selected changed lines.
- If the user selects context lines (unchanged), those lines are silently excluded from the staging action.
- If the user selects lines that span a hunk boundary (e.g., across the collapsed unchanged region), the action applies to each hunk independently (the selection is split at hunk boundaries).

### Empty Hunks After Staging

- If all lines in a hunk are staged from an unstaged view, the hunk visually "empties out" -- the hunk header remains but shows "All lines staged" in `text-ctp-overlay0 italic`. The hunk collapses to a single header line.
- If the user unstages all lines in a hunk from a staged view, the same empty-hunk treatment applies.
- This prevents jarring layout shifts where entire hunks disappear.

### New Files (All Additions)

- For newly created files, the entire file content appears as additions. Each "hunk" is the contiguous block of additions.
- The "Stage Hunk" button works the same way. "Stage All" stages the entire file (equivalent to `git add <file>`).

### Deleted Files (All Deletions)

- For deleted files, the entire old content appears as deletions. Staging the hunk stages the file deletion.
- Show a warning inline: "Staging this will record the file as deleted" in `text-ctp-yellow text-xs`.

### Binary Files

- Hunk and line staging are not available for binary files. The diff viewer shows the existing binary file placeholder.
- The hunk/line staging gutter and action bars are not rendered.

### Accessibility Requirements

**Screen Reader Support:**
- The diff viewer must use `role="document"` for the editor area and provide an accessible diff description.
- Each hunk should be announced when navigated to: "Hunk 3 of 7, lines 42 through 67, 5 additions, 2 deletions, not staged."
- The "Stage Hunk" and "Stage Lines" buttons must have descriptive `aria-label` attributes: "Stage hunk containing lines 42 through 67" / "Stage 3 selected lines starting at line 45."
- Use `aria-live="polite"` for staging status changes.
- The accessible diff viewer (VS Code's `F7` equivalent) should be available for line-by-line review without mouse.

**Keyboard-Only Users:**
- All staging operations must be achievable without a mouse.
- Focus must be visible at all times (use `focus-visible` ring in `ring-ctp-blue ring-2`).
- The hunk action bar must be reachable via keyboard (Tab order: hunk header -> action buttons -> next line).
- After staging a hunk, focus should move to the next unstaged hunk automatically.

**Color Accessibility:**
- Staged/unstaged states must not rely solely on color. The gutter bar uses both color AND opacity (solid vs semi-transparent) to communicate state.
- The tri-state icon uses both shape and color: filled circle (green), empty circle (gray), half-filled circle (yellow).
- All color combinations meet WCAG 2.1 AA contrast ratios against the `bg-ctp-crust` (#11111b) background.

**Reduced Motion:**
- All animations are wrapped in `motion-safe:` variants.
- The gutter bar color transitions use `transition-colors` only (no position/size animations).
- The hunk action bar simply appears/disappears without animation when reduced motion is preferred.

---

## 7. Catppuccin Theme Integration

### Color Assignments

The Catppuccin Mocha palette provides 26 colors. The existing diff viewer already uses Green (#a6e3a1) for additions and Red (#f38ba8) for deletions. The hunk/line staging feature introduces new states that need distinct but harmonious colors.

#### Staged State Colors

For indicating "staged" status (stronger versions of the existing diff colors):

| Element | Color | Hex | Opacity | Tailwind Class |
|---------|-------|-----|---------|----------------|
| Staged addition gutter bar | Green (solid) | #a6e3a1 | 100% | `bg-ctp-green` |
| Staged addition line bg | Green | #a6e3a1 | 15% | `bg-ctp-green/15` |
| Staged deletion gutter bar | Red (solid) | #f38ba8 | 100% | `bg-ctp-red` |
| Staged deletion line bg | Red | #f38ba8 | 15% | `bg-ctp-red/15` |
| Staged line number | Green / Red | - | 70% | `text-ctp-green/70` / `text-ctp-red/70` |

#### Unstaged State Colors (Current, Unchanged)

| Element | Color | Hex | Opacity | Tailwind Class |
|---------|-------|-----|---------|----------------|
| Unstaged addition gutter bar | Green | #a6e3a1 | 30% | `bg-ctp-green/30` |
| Unstaged addition line bg | Green | #a6e3a1 | 6% | Already in Monaco theme |
| Unstaged deletion gutter bar | Red | #f38ba8 | 30% | `bg-ctp-red/30` |
| Unstaged deletion line bg | Red | #f38ba8 | 6% | Already in Monaco theme |

#### Selection State Colors

| Element | Color | Hex | Opacity | Tailwind Class |
|---------|-------|-----|---------|----------------|
| Selected line highlight | Blue | #89b4fa | 20% | `bg-ctp-blue/20` |
| Selected line number | Blue | #89b4fa | 100% | `text-ctp-blue` |
| Selected gutter bar | Blue | #89b4fa | 100% | `bg-ctp-blue` |
| Selection floating bar bg | Surface 0 | #313244 | 100% | `bg-ctp-surface0` |
| Selection floating bar border | Surface 1 | #45475a | 100% | `border-ctp-surface1` |

#### Partially Staged Indicator

| Element | Color | Hex | Rationale |
|---------|-------|-----|-----------|
| Partially staged file icon | Yellow | #f9e2af | Yellow is the universal "in-progress" / "partial" color. It contrasts well against both green (staged) and gray (unstaged). |
| Partially staged hunk badge | Yellow | #f9e2af | Consistent with file-level indicator. |

#### Hunk Header & Action Bar

| Element | Color | Hex | Tailwind Class |
|---------|-------|-----|----------------|
| Hunk header background | Surface 0 | #313244 | `bg-ctp-surface0` |
| Hunk header text | Overlay 1 | #7f849c | `text-ctp-overlay1` |
| Hunk header border | Surface 1 | #45475a | `border-ctp-surface1` |
| Stage button (unstaged view) | Green | #a6e3a1 | `text-ctp-green hover:bg-ctp-green/20` |
| Unstage button (staged view) | Peach | #fab387 | `text-ctp-peach hover:bg-ctp-peach/20` |
| Discard button | Red | #f38ba8 | `text-ctp-red hover:bg-ctp-red/20` |
| Active hunk border | Blue | #89b4fa | `border-l-2 border-ctp-blue` |

#### Monaco Theme Extensions

The following colors need to be added to the `FLOWFORGE_THEME` in `monacoTheme.ts`:

```typescript
// Staged line backgrounds (brighter than unstaged)
"diffEditor.insertedLineBackground": "#a6e3a126", // 15% - staged additions
"diffEditor.removedLineBackground": "#f38ba826",  // 15% - staged deletions

// Hunk header styling
"diffEditor.unchangedRegionBackground": "#313244", // ctp-surface0 for hunk separators
```

Note: The staged vs unstaged distinction will primarily be handled via custom Monaco decorations (line-level CSS class overrides), not via the global theme colors, because Monaco's built-in diff theme does not have separate "staged" and "unstaged" color tokens. The theme provides the base diff colors; the staging overlay is applied via `editor.deltaDecorations()`.

#### Why These Colors?

- **Green for staged additions**: Reinforces the "added and ready" semantic. The solid green gutter bar (vs semi-transparent for unstaged) uses opacity as the differentiator, maintaining the existing green = addition mental model.
- **Red for staged deletions**: Same logic as green. Solid red = committed to this deletion. Semi-transparent red = deletion exists but is not yet staged.
- **Yellow for partial state**: Yellow is universally understood as "in-progress" or "warning." It does not conflict with green (addition) or red (deletion) because it represents a meta-state about staging progress, not a diff change type.
- **Blue for selection**: Matches the existing editor selection color (`editor.selectionBackground: #89b4fa40`). Blue is the interaction color throughout FlowForge (cursor, selection, active tab, focus ring).
- **Peach for unstage action**: Peach (#fab387) provides visual distinction from the green "Stage" button while not being as alarming as red (which is reserved for "Discard"). Peach is a warm color that suggests "reversing" or "undoing" -- appropriate for unstaging.

---

## 8. Monaco Editor Integration Strategy

### Decoration-Based Approach

Since FlowForge uses Monaco's `DiffEditor` component, hunk/line staging will be implemented using Monaco's decoration and widget APIs rather than custom DOM overlays:

1. **Line decorations** (`editor.deltaDecorations`) for staged/unstaged gutter indicators.
2. **View zones** (`editor.changeViewZones`) for hunk action bars (injected above each hunk header).
3. **Content widgets** (`editor.addContentWidget`) for the line selection floating action bar.
4. **Glyph margin decorations** for the staging state indicator in the gutter.

### Why Not Custom DOM Overlays?

- Monaco uses virtualized rendering. Custom DOM elements positioned absolutely will not scroll with the content unless they are managed by Monaco's layout engine.
- Monaco's decoration API handles lifecycle, performance, and scroll synchronization automatically.
- Decorations integrate with Monaco's accessibility layer (screen reader announcements).

### Implementation Considerations

- The current `InlineDiffViewer` uses `@monaco-editor/react`'s `DiffEditor` component with `readOnly: true`. For hunk/line staging, the editor remains read-only (no text editing) but gains interactive decorations.
- The `DiffOnMount` callback provides access to the `IStandaloneDiffEditor` instance, which exposes both the original and modified editors. Decorations should be applied to the **modified editor** (the right side in side-by-side, or the inline view).
- Hunk header positions are available from the `FileDiff.hunks` array returned by the backend (`get_file_diff` command). Each `DiffHunk` has `newStart` and `newLines` fields that map directly to Monaco line numbers.
- The backend's `DiffHunk` structure already provides the data needed to render hunk boundaries and action bars.

---

## Key UX Recommendations

Based on the competitive analysis, interaction design research, and FlowForge's existing architecture, here are the top design decisions for Phase 50:

### 1. Use Hover-Reveal Hunk Action Bars, Not Always-Visible Buttons
Place a floating action bar (Stage Hunk / Unstage Hunk / Discard Hunk) on each hunk header that appears on hover or keyboard focus. This keeps the diff clean during reading while providing immediate actions when the user signals intent. Resolve the Sublime Merge ambiguity problem by designating a single "active hunk" at any time -- the most recently hovered or keyboard-navigated hunk.

### 2. Use Selection-Based Line Staging, Not Per-Line Checkboxes
Adopt Tower's model: users select lines (via line number click, Shift-click for range, or text selection drag) and then click a "Stage Lines" button in a floating action bar. This avoids the visual clutter and performance cost of GitHub Desktop/Fork's per-line checkbox model. The action bar dynamically changes its label from "Stage Hunk" to "Stage N Lines" when a line selection exists.

### 3. Communicate Staging State via Gutter Bar Opacity
Use the existing green (addition) and red (deletion) gutter bars, but vary their opacity: solid (100%) for staged lines, semi-transparent (30%) for unstaged lines. This provides always-visible, zero-interaction-cost state communication that integrates naturally with the existing diff color scheme. No new UI elements are needed for state indication.

### 4. Add Tri-State Staging Indicator to the File List
Show a tri-state icon next to each file in the staging panel: fully staged (green filled circle), fully unstaged (gray empty circle), partially staged (yellow half-filled circle). This gives users at-a-glance understanding of partial staging state without opening the diff viewer. This is the single most requested feature from competitive analysis.

### 5. Provide Keyboard-First Hunk Navigation
Implement `[` / `]` (bracket keys) for navigating between hunks, `Ctrl+Shift+Enter` for staging the active hunk, and `Ctrl+Shift+S` for staging selected lines. These shortcuts are ergonomic, discoverable via tooltip/menu, and do not conflict with existing shortcuts. Add vim-style alternatives (`]c` / `[c`, `s`, `u`) behind a preference flag.

### 6. Use Monaco Decorations and View Zones, Not DOM Overlays
Implement all visual elements (gutter indicators, hunk action bars, selection bars) using Monaco's decoration and view zone APIs. This ensures correct scrolling behavior, virtualization compatibility, and accessibility integration. Custom DOM overlays would break in Monaco's virtualized rendering model.

### 7. Ensure Immediate Staging Panel Refresh
After any hunk or line staging action, immediately invalidate the staging status query (`queryClient.invalidateQueries({ queryKey: ["stagingStatus"] })`) to update the file list. Do not rely on the existing 2-second polling interval. Use optimistic updates where possible -- update the gutter indicators immediately and reconcile after the backend confirms.

---

*Created: 2026-02-12*
*Phase: 50 -- Hunk & Line Staging*
*Author: UX Research Agent*
*References: Sublime Merge, VS Code, GitKraken, Fork, Tower, JetBrains IDEs, GitHub Desktop*
