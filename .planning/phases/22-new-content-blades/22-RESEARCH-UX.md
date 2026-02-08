# Phase 22: UX Research — Content Blades

**Researcher**: UX Specialist (Desktop Developer Tools)
**Date**: 2026-02-07
**Scope**: Interaction design, accessibility, and shared patterns for Phase 22 content blades

---

## 1. Content Blade UX Patterns

### How content types should present in a blade context

All Phase 22 blades share the same hosting context: they appear as the active blade in `BladeContainer`, with `BladePanel` providing the header bar (back arrow, title, trailing actions). The content area below the header is `flex-1 min-h-0 overflow-hidden`. Each blade type must operate within this constraint.

**Pattern mapping by content type:**

| Content Type | Scroll Model | Internal Chrome | Key Affordance |
|---|---|---|---|
| Markdown viewer | Vertical scroll (document-like) | None; the panel IS the chrome | Readable content with inline links |
| Repo browser | Vertical scroll (file list) | Breadcrumbs bar below blade header | Clickable rows that dispatch to other blades |
| Gitflow cheatsheet | Vertical scroll (mixed SVG + cards) | None | "You are here" visual anchor |
| 3D model viewer | No scroll (viewport fills space) | Collapsible metadata drawer | Orbit/zoom gesture area |
| Diff-to-markdown toggle | Toggle changes inner content | Sub-header toolbar (already exists in DiffBlade) | Segmented toggle control |

**Key recommendation:** Content blades should NOT add their own header bars. The existing `BladePanel` header provides the back button, title, and trailing action slot. Additional sub-chrome (like DiffBlade's inline/side-by-side toggle bar) should be placed as a secondary toolbar BELOW the BladePanel header, using the established `border-b border-ctp-surface0 bg-ctp-crust` pattern from `DiffBlade.tsx:182`.

### Loading states

The existing `BladeLoadingFallback` (centered `Loader2` spinner) is correct for lazy-loaded blade chunks. For data-fetching within blades, the pattern established by `CommitDetailsBlade` and `DiffBlade` should be followed:

- **Skeleton/spinner**: Centered `Loader2` spinner on `bg-ctp-mantle` background, matching `DiffBlade.tsx:152-157`.
- **Minimum display time**: None needed. Tauri IPC calls are sub-100ms for local file reads. Avoid artificial delays.
- **Progressive loading for markdown**: Show the rendered markdown as it comes in. Since `read_repo_file` returns the full content at once (not streamed), this is a single fetch-then-render. The `Suspense` boundary from `BladeRenderer` handles the lazy chunk load; the blade itself should use `useQuery` for data and show the spinner state inline.

### Empty states

Each blade type needs a specific empty state:

| Blade | Empty Condition | Message | Icon |
|---|---|---|---|
| Markdown viewer | File not found at HEAD | "File not found at HEAD" | `FileText` (dimmed) |
| Repo browser | Empty directory | "This directory is empty" | `FolderOpen` (dimmed) |
| Repo browser | Root path invalid | "Could not load repository contents" | `AlertTriangle` |
| 3D model viewer | File not found | "3D model not found at HEAD" | `Box` (dimmed) |
| Gitflow cheatsheet | Not on any recognized branch | Still show full diagram; "You are here" section says "Current branch does not match a gitflow pattern" | `GitMerge` |

**Pattern**: Match the existing placeholder blade layout (centered icon + text stack, `text-ctp-subtext0` for message, `text-ctp-overlay0` for secondary text). See current `ViewerMarkdownBlade.tsx:9-17` for the exact structure.

### Error states

The `BladeErrorBoundary` already handles uncaught exceptions with a retry + go-back affordance. For data-fetch errors, follow the `DiffBlade` pattern:

```
<div className="flex-1 flex items-center justify-center bg-ctp-mantle">
  <p className="text-ctp-red text-sm">Failed to load [content type]</p>
</div>
```

**Recommendation for markdown specifically**: If the markdown file contains valid content but has rendering errors (e.g., malformed HTML that rehype-sanitize strips), show the content with best-effort rendering rather than an error state. Only show an error state for fetch failures.

### Blade transitions

`BladeContainer` already animates blade entry/exit with framer-motion (`x: 40, opacity: 0` to `x: 0, opacity: 1`, 200ms easeOut). This animation should apply uniformly to all new blades. No special per-content-type transition is needed.

**Repo browser to viewer transition**: When clicking a file in the repo browser, a new blade is **pushed** onto the stack (not replaced). The repo browser blade collapses into a `BladeStrip` on the left, and the viewer slides in from the right. This is the existing blade stack behavior and should be preserved.

**Markdown relative link transition**: When clicking a relative `.md` link in the markdown viewer, the current blade is **replaced** (using `store.replaceBlade`). This avoids accumulating a deep stack of markdown blades for sequential navigation. The framer-motion `AnimatePresence mode="popLayout"` will handle the key change.

---

## 2. Markdown Viewer Interactions

### Table of contents / document outline

**Recommendation: Defer to a future phase.** Rationale:
- The blade width is constrained (blades share horizontal space with collapsed BladeStrips).
- A sidebar TOC would consume significant horizontal space on narrower blade widths.
- A dropdown/popover TOC adds complexity without clear user demand for v1.
- Users can use browser-style scrolling + heading visual hierarchy.

**If added later**, the pattern should be a collapsible outline panel triggered by a blade trailing action button, similar to how the 3D viewer's metadata panel is toggled.

### Scroll position on relative link navigation

When navigating between `.md` files via relative links (which triggers `replaceBlade`):
- Scroll position should reset to top for the new document. Since `replaceBlade` creates a new blade with a new `id`, React will unmount and remount the component, naturally resetting scroll position.
- No explicit scroll management is needed.

### Copy code block button

**Recommendation: Implement for v1.** This is a high-value, low-complexity feature for developer-facing markdown.

**Interaction design:**
- Position a copy button in the top-right corner of each code block (`<pre>` element).
- The button should be **always visible** (not hover-only) since this is a desktop app and the code block backgrounds provide sufficient contrast. Use `text-ctp-overlay1` for the icon, with `hover:text-ctp-text hover:bg-ctp-surface0` for the hover state.
- Icon: `Copy` from lucide-react (14x14). On click, switch to `Check` with `text-ctp-green` for 2 seconds, then revert.
- Use `navigator.clipboard.writeText()` for the copy operation.
- Button label: `aria-label="Copy code"`, changing to `aria-label="Copied"` during confirmation.

**Implementation via rehype plugin**: Use a custom rehype plugin or a wrapper component around `<pre>` blocks. The `react-markdown` `components` prop can override the `pre` element to wrap it with a copy button.

### Large markdown files

Files over ~5000 lines may cause rendering delays with react-markdown + rehype plugins.

**Recommendations:**
- **No virtualization for v1.** Markdown rendering is a one-shot operation and virtualized scrolling would break anchor links, search (Cmd+F), and natural scroll behavior.
- **Measure performance** with a 10,000-line markdown file during development. If rendering takes over 500ms, add a loading skeleton that displays for the duration of the initial render.
- **Code block highlighting** is the primary bottleneck. highlight.js processes each block synchronously. If this becomes an issue, consider `rehype-highlight`'s built-in lazy highlighting or limit highlighted blocks to the first N visible.

---

## 3. Repo Browser Navigation

### Breadcrumb interaction patterns

**Layout:**
```
[Home icon] / src / components / blades
```

- Each segment is a clickable `<button>` element (not `<a>`, since these are in-app navigations).
- The root segment shows a home icon (`Home` from lucide-react, 14x14) with `aria-label="Repository root"`.
- Separators are visual-only `<span aria-hidden="true">/</span>`.
- Active (current) segment is non-interactive, rendered as `<span>` with `font-medium text-ctp-text`.
- Ancestor segments use `text-ctp-overlay1 hover:text-ctp-text hover:underline cursor-pointer`.

**Overflow handling for deep paths:**
- Use `overflow-x-auto` on the breadcrumb container with `scrollbar-width: none` (hide scrollbar).
- Auto-scroll to the rightmost (current) segment on navigation.
- On very deep paths (over 5 segments), consider truncating middle segments with an ellipsis menu (`...`). However, for v1, horizontal scroll is sufficient.

**Keyboard navigation:**
- Tab moves focus between breadcrumb segments (each is a focusable button).
- Enter/Space activates the navigation.
- The breadcrumb container should have `role="navigation"` and `aria-label="Repository path"`.

### File list design

**Sorting:** Folders first, then files. Within each group, sort alphabetically (case-insensitive). This matches OS file manager convention.

**Row layout:**
```
[FileTypeIcon 16x16] [filename] [optional: file size in dimmed text]
```

- Use the existing `FileTypeIcon` component (`src/components/icons/FileTypeIcon.tsx`) which already handles file extension to icon mapping.
- For directories: `FileTypeIcon` with `isDirectory={true}`.
- Row height: Match the existing `FileItem` pattern (py-1.5 px-3, ~32px).
- Hover state: `hover:bg-ctp-surface0/50` (consistent with existing file list patterns).
- Selected state: Not needed for repo browser since clicking immediately navigates or opens a blade.

**File size metadata:**
- Display in `text-xs text-ctp-overlay0` on the right side of the row.
- Format: `1.2 KB`, `3.5 MB`, etc.
- This requires the Rust `list_repo_files` command to return file sizes. Check if it already does; if not, flag as a backend requirement.

**Binary file indication:**
- Binary files (non-text, non-image, non-3D) should show a subtle badge or different icon treatment.
- When clicked, show an inline info card within the repo browser (not a new blade): filename, size, type, and a note "Binary file - preview not available".
- Alternatively, use a `title` tooltip on hover: "Binary file (3.2 MB)".
- **Recommendation for v1:** Use `title` tooltip approach. It is simpler and avoids modal/popover complexity.

### Empty directory state

```
<div className="flex flex-col items-center justify-center py-12 text-ctp-overlay0">
  <FolderOpen className="w-8 h-8 mb-2" />
  <p className="text-sm">This directory is empty</p>
</div>
```

---

## 4. Diff-to-Markdown Toggle

### Toggle control placement

The DiffBlade already has a sub-header toolbar bar at `DiffBlade.tsx:182-203`:
```
<div className="flex items-center gap-2 px-3 py-1 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
  [Inline/Side-by-side toggle]  [spacer]  [Staging navigation]
</div>
```

**Placement**: Add the diff/preview toggle to the LEFT side of this toolbar, AFTER the existing inline/side-by-side toggle, separated by a visual divider (`<div className="w-px h-4 bg-ctp-surface1" />`).

**Control type: Segmented control** (two-button toggle group, matching the existing flat/tree view toggle in `FileTreeBlade.tsx:224-249`).

```
[Diff icon] [Markdown preview icon]
```

- Diff mode (default): `Code` icon from lucide-react.
- Preview mode: `Eye` icon from lucide-react.
- Active segment: `bg-ctp-surface1 text-ctp-text`.
- Inactive segment: `text-ctp-overlay0 hover:text-ctp-subtext1`.
- Container: `bg-ctp-surface0 rounded p-0.5` (matches FileTreeBlade pattern).

**Visibility condition**: Only render this toggle when the file path ends in `.md` or `.mdx`. Use a simple extension check.

### Transition between views

- **No animation needed.** The switch between Monaco diff editor and rendered markdown is a content replacement within the same blade. A crossfade would add complexity for minimal UX benefit.
- Simply conditionally render either the `DiffEditor` component or the markdown renderer based on toggle state.
- The inline/side-by-side toggle should be hidden (or disabled) when in preview mode, since it only applies to the diff view.

### State persistence

**Recommendation: Do NOT persist toggle state.** Rationale:
- The diff view is the primary purpose of DiffBlade. Defaulting to diff view ensures users always see what they expect.
- If the user navigates away (blade is unmounted) and back (new blade instance), starting in diff mode is the safe default.
- This matches VS Code's behavior: preview toggles are transient.

---

## 5. Gitflow Cheatsheet Interactions

### SVG diagram responsive sizing

**Approach:** The SVG should be rendered as an inline React component (not an `<img>` tag) to enable dynamic styling and the "You are here" highlighting.

- Set `width="100%"` and a fixed `viewBox` on the SVG element.
- The SVG should scale proportionally to the blade width.
- Minimum readable width: The diagram should remain legible at blade widths as narrow as 400px. Design the SVG viewBox to accommodate this.
- **Do not** allow horizontal scrolling of the diagram. If the blade is too narrow, the SVG scales down.

### "You are here" indicator

**Visual treatment:**
- The active branch lane in the SVG receives a highlighted stroke/fill using the corresponding Catppuccin accent color (e.g., `--ctp-green` for feature, `--ctp-red` for hotfix, `--ctp-blue` for release, `--ctp-mauve` for main, `--ctp-yellow` for develop).
- Inactive lanes use `--ctp-surface1` stroke with `--ctp-overlay0` labels.
- The active lane uses full-opacity accent color with a subtle glow effect: `filter: drop-shadow(0 0 4px var(--ctp-[color]/0.3))`.

**Animation:**
- Use `motion-safe:animate-[pulse_2s_ease-in-out_infinite]` on the "You are here" badge (a small pill label positioned near the active lane).
- Badge text: "You are here" in `text-xs font-medium`, with the accent color as background and `--ctp-base` as text.
- For `prefers-reduced-motion`, the badge is static (no pulse).

**Text callout below the SVG:**
- "You are on `feature/add-login`" — using a code-styled branch name.
- If commits ahead of merge base is available: "3 commits ahead of develop".

### Action cards layout

**Layout:** Vertical stack of 1-3 cards below the SVG diagram and branch status text.

**Card design:**
```
[Icon 20x20]  [Title text - font-medium]
               [Description text - text-ctp-subtext0 text-sm]
```

- Background: `bg-ctp-surface0/50 hover:bg-ctp-surface0` with `border border-ctp-surface1 rounded-lg p-4`.
- Cards are informational only (no action buttons). The hover state provides a subtle visual response but does not trigger any action.
- If a card contains a git command suggestion (e.g., "Run `git flow feature finish`"), render the command in a `<code>` element with the copy-code button pattern from the markdown viewer.

### Scrolling behavior

- The entire cheatsheet blade should use `overflow-y-auto` on its content container (below the BladePanel header).
- Content order: SVG diagram, "You are here" section, action cards, then the full branch type reference cards.
- The SVG diagram should be `shrink-0` so it does not compress when the page has overflow.

---

## 6. 3D Model Viewer UX

### First-time user guidance

**Recommendation: Overlay hint on first interaction.**

- On initial load, after the model appears, show a semi-transparent overlay in the bottom-center of the viewport:
  ```
  [Mouse icon] Drag to orbit  ·  [Scroll icon] Scroll to zoom  ·  [Shift+Drag icon] Shift+drag to pan
  ```
- This overlay fades out after 4 seconds OR on the first user interaction (whichever comes first).
- Use `motion-safe:animate-[fadeOut_0.3s_ease-out_4s_forwards]`.
- Store a `has-seen-3d-hint` flag in `localStorage` so the hint only shows once per user.
- Text style: `text-xs text-ctp-text/80 bg-ctp-base/60 backdrop-blur-sm rounded-lg px-4 py-2`.

### WebGL fallback (context loss)

**Retry button design:**
```
<div className="flex flex-col items-center justify-center h-full gap-4 bg-ctp-mantle">
  <Box className="w-12 h-12 text-ctp-overlay0" />
  <p className="text-sm text-ctp-subtext0">3D rendering failed</p>
  <p className="text-xs text-ctp-overlay0">WebGL context was lost</p>
  <Button variant="outline" size="sm" onClick={handleRetry}>
    <RotateCcw className="w-4 h-4 mr-2" />
    Reload 3D View
  </Button>
</div>
```

- The retry handler should: revoke the old blob URL, re-fetch the file, create a new blob URL, and remount the `<model-viewer>` element.
- If retry fails again, show the same UI but with additional text: "If this keeps happening, your GPU may not support WebGL".

### Loading progress indication

`<model-viewer>` emits a `progress` event with a value from 0 to 1.

**Recommendation:** Use a simple progress bar rather than a spinner, since progress events provide a meaningful percentage.

```
<div className="flex flex-col items-center justify-center h-full gap-3 bg-ctp-mantle">
  <Box className="w-8 h-8 text-ctp-overlay0" />
  <div className="w-48 h-1.5 bg-ctp-surface0 rounded-full overflow-hidden">
    <div
      className="h-full bg-ctp-blue rounded-full transition-[width] duration-150"
      style={{ width: `${progress * 100}%` }}
    />
  </div>
  <p className="text-xs text-ctp-overlay0">Loading model...</p>
</div>
```

- Once loaded, fade out the loading UI and fade in the model with a `opacity` transition (200ms).

### Metadata panel toggle

**Toggle button**: Place in the blade header's trailing action slot (via `renderTrailing` in the blade registration). Use the `Info` icon from lucide-react.

**Panel design:**
- A collapsible panel that slides down from below the blade header (not a sidebar, to preserve 3D viewport width).
- Height: auto, with a max-height of 120px and `overflow-y-auto`.
- Background: `bg-ctp-crust/90 backdrop-blur-sm` with `border-b border-ctp-surface0`.
- Content: key-value pairs in a compact grid.

```
Format: GLTF Binary (.glb)    Vertices: 12,450
Size:   2.3 MB                Triangles: 8,200
```

- Use `text-xs` throughout. Labels in `text-ctp-overlay0`, values in `text-ctp-subtext1`.

---

## 7. Accessibility (WCAG 2.1 AA)

### Keyboard navigation for all blade types

**Global blade navigation (already working):**
- BladePanel back button is keyboard-focusable.
- BladeStrip expand buttons have `aria-label`.

**Per-blade keyboard requirements:**

| Blade | Key Bindings |
|---|---|
| Markdown viewer | Tab through links/buttons, Enter to follow links, code block copy button focusable |
| Repo browser | Arrow Up/Down to move through file list, Enter to open file/folder, Backspace for parent directory, Tab to breadcrumbs |
| Gitflow cheatsheet | Standard scroll (Page Up/Down, Space), Tab to action card copy buttons |
| 3D model viewer | model-viewer has built-in keyboard orbit (arrow keys), Tab to metadata toggle and retry button |
| Diff toggle | Tab to toggle control, Enter/Space to switch, Arrow Left/Right for segmented control |

### Screen reader announcements for blade transitions

**Current state:** `BladeContainer` uses framer-motion `AnimatePresence` but has no ARIA announcements for blade changes.

**Recommendation:** Add an ARIA live region to announce blade transitions.

```tsx
// In BladeContainer, add:
<div aria-live="polite" className="sr-only">
  {activeBlade.title}
</div>
```

This `sr-only` element announces the active blade title whenever it changes, giving screen reader users context about what panel they are viewing.

### 3D viewer accessibility

- The `<model-viewer>` element must have an `alt` attribute: `alt={filename}` describing the model.
- model-viewer supports `aria-label` for the interactive region.
- Keyboard orbit: model-viewer's `camera-controls` attribute enables arrow key orbit by default.
- The loading state should use `aria-busy="true"` on the container.
- The WebGL fallback state should use `role="alert"` to announce the failure.

### Markdown content accessibility

- **Heading hierarchy**: rehype-sanitize with GitHub schema preserves headings. Ensure the markdown content starts from `<h1>` or `<h2>` (not `<h1>` if the blade title already serves as the page heading). The BladePanel title is not a semantic heading (it is a `<span>`), so markdown headings can start at `<h1>`.
- **Link focus management**: After navigating a relative `.md` link (which triggers `replaceBlade`), focus should move to the top of the new content. Since React remounts the component, browser default focus behavior (top of page) applies. Add a `tabIndex={-1}` and `ref` to the markdown container and call `.focus()` in a `useEffect` to ensure keyboard users land at the content start.
- **Images**: All images should have `alt` text. For images from the markdown source, the alt text from the `![alt](url)` syntax is preserved. For images where alt is empty, set `alt=""` (decorative) rather than omitting the attribute.
- **Code blocks**: Wrap in `<pre><code>` with a `tabIndex={0}` on the `<pre>` to allow keyboard users to scroll long code blocks. Add `aria-label="Code block"` or use the language label: `aria-label="JavaScript code block"`.

### Repo browser tree navigation

The repo browser uses a flat list (not a tree), so standard list keyboard patterns apply:

- Container: `role="listbox"` with `aria-label="Files in [current directory]"`.
- Each row: `role="option"` with `aria-selected="false"` (no persistent selection).
- Arrow Up/Down: Move focus between rows.
- Enter: Activate (navigate into folder or open file viewer).
- Home/End: Jump to first/last item.
- Type-ahead: First letter navigation to jump to files starting with that letter.

**Breadcrumbs**: Use `<nav aria-label="Repository path">` with an `<ol>` for the segment list. Each segment is an `<li>` containing a `<button>`. The current segment uses `aria-current="page"`.

### Color contrast

All text pairings must meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text):

- `text-ctp-text` on `bg-ctp-base`: Passes (13.6:1 in Mocha).
- `text-ctp-subtext0` on `bg-ctp-base`: Passes (7.2:1 in Mocha).
- `text-ctp-overlay0` on `bg-ctp-base`: Check carefully. In Catppuccin Mocha, overlay0 (#6c7086) on base (#1e1e2e) has approximately 4.5:1 contrast. This is borderline AA for small text. **Recommendation:** Use `text-ctp-overlay1` (#7f849c, ~5.5:1) as the minimum for any text that conveys meaningful information. Reserve `text-ctp-overlay0` for decorative or supplementary text only.

---

## 8. Shared Patterns (Extensibility Focus)

### Common patterns across all content blades

After analyzing the existing codebase, the following patterns should be standardized:

#### 8.1 Blade header trailing actions

The `BladeRegistration.renderTrailing` function is the extension point for per-blade header actions. Current usage:
- DiffBlade: Does NOT use `renderTrailing` (its toolbar is internal).
- Other blades: Most do not use it.

**Recommendation for Phase 22:**
- 3D viewer: Use `renderTrailing` for the metadata toggle button (`Info` icon).
- Markdown viewer: Use `renderTrailing` for a "Open in system editor" button (optional, defer to future).
- Repo browser: Use `renderTrailing` for view mode toggle (flat/tree) if added later.
- Gitflow cheatsheet: No trailing actions needed.

#### 8.2 Standardized loading state

Create a shared `BladeContentLoading` component (or reuse `BladeLoadingFallback`) that matches the inline loading pattern:

```tsx
// Shared pattern for data-loading states within blades
<div className="flex-1 flex items-center justify-center bg-ctp-mantle">
  <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
</div>
```

This is already the pattern in `DiffBlade` and `CommitDetailsBlade`. Standardize it as an exported component.

#### 8.3 Standardized error state

Create a shared `BladeContentError` component:

```tsx
interface BladeContentErrorProps {
  message: string;  // e.g., "Failed to load markdown"
  detail?: string;  // e.g., the file path or error message
  onRetry?: () => void;
}
```

This encapsulates the centered error message pattern with an optional retry button. Used by all Phase 22 blades for fetch failures.

#### 8.4 Standardized empty state

Create a shared `BladeContentEmpty` component:

```tsx
interface BladeContentEmptyProps {
  icon: LucideIcon;
  message: string;
  detail?: string;
}
```

This encapsulates the centered icon + message pattern used by current placeholder blades.

#### 8.5 Sub-toolbar pattern

Blades that need controls below the BladePanel header (DiffBlade, repo browser breadcrumbs) should use a consistent sub-toolbar component:

```tsx
<div className="flex items-center gap-2 px-3 py-1 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
  {children}
</div>
```

This matches the existing DiffBlade toolbar and `ViewerImageBlade` toolbar. Extract as `BladeToolbar`.

### Error boundary and Suspense integration

The existing `BladeRenderer` already wraps every blade in:
1. `BladeErrorBoundary` (catches render errors, shows retry + go back).
2. `Suspense` with `BladeLoadingFallback` (for lazy-loaded blade chunks).

Phase 22 blades should NOT add their own error boundaries or Suspense wrappers. The `BladeRenderer` handles this. Blades should only handle their own data-fetch loading/error states using `useQuery` patterns.

### Consistent blade header patterns

The `BladePanel` component provides:
- `title`: Plain text title.
- `titleContent`: Optional React node overriding the title (used by DiffBlade for path/filename split rendering).
- `trailing`: Optional React node for right-aligned actions.
- `showBack` / `onBack`: Back navigation.

**Recommendations for Phase 22 blade registrations:**

| Blade | `defaultTitle` | `renderTitleContent` | `renderTrailing` |
|---|---|---|---|
| viewer-markdown | `(props) => filename` | Path/filename split (same pattern as diff registration) | None for v1 |
| viewer-3d | `(props) => filename` | Path/filename split | Metadata toggle button |
| repo-browser | `"Repository Browser"` | None (or dynamic: current directory name) | None for v1 |
| gitflow-cheatsheet | `"Gitflow Guide"` | None | None |
| viewer-code (new) | `(props) => filename` | Path/filename split | None for v1 |

The path/filename split pattern from `registrations/diff.tsx:14-35` should be extracted into a shared utility:

```tsx
export function renderPathTitle(filePath: string): ReactNode {
  const lastSlash = filePath.lastIndexOf("/");
  if (lastSlash === -1) {
    return <span className="text-sm font-semibold text-ctp-text truncate">{filePath}</span>;
  }
  return (
    <span className="text-sm truncate">
      <span className="text-ctp-overlay1">{filePath.slice(0, lastSlash + 1)}</span>
      <span className="font-semibold text-ctp-text">{filePath.slice(lastSlash + 1)}</span>
    </span>
  );
}
```

---

## Summary of Recommendations

### Must-have for Phase 22

1. **Copy code button** on all markdown code blocks.
2. **ARIA live region** in `BladeContainer` for blade transition announcements.
3. **Focus management** for markdown relative link navigation (focus to content start).
4. **Keyboard navigation** for repo browser file list (Arrow keys, Enter, Home/End).
5. **Breadcrumb `<nav>` with `aria-current`** for repo browser.
6. **`alt` attribute** on model-viewer element.
7. **Shared utility components**: `BladeContentLoading`, `BladeContentError`, `BladeContentEmpty`, `BladeToolbar`, `renderPathTitle`.
8. **Scroll reset** on markdown relative link navigation (handled automatically by `replaceBlade`).
9. **Segmented toggle control** in DiffBlade toolbar for diff/preview switching.
10. **"You are here" badge** with `motion-safe:` animation on gitflow cheatsheet.

### Nice-to-have (implement if time allows)

1. **3D viewer interaction hint** overlay (fade after 4s or first interaction).
2. **Progress bar** for 3D model loading (instead of just a spinner).
3. **Type-ahead search** in repo browser file list.
4. **File size display** in repo browser rows.
5. **Extracted `BladeToolbar` component** for sub-header toolbars.

### Explicitly deferred

1. Table of contents for markdown viewer (future phase).
2. Markdown virtualization for very large files (optimize if needed).
3. Persistent diff/preview toggle state (always reset to diff).
4. Breadcrumb ellipsis truncation for deep paths (horizontal scroll is sufficient).

---

## RESEARCH COMPLETE
