# Phase 22 — UX Exploration: Blade System & Content Blade Patterns

> **Author**: UX Review Agent
> **Date**: 2026-02-07
> **Scope**: Complete analysis of the current blade UX system to inform Phase 22 new content blade design

---

## 1. Blade Container & Navigation UX

### Layout Architecture
The blade system uses an Azure-Portal-inspired stacked navigation:

- **`BladeContainer`** (`src/components/blades/BladeContainer.tsx`): Top-level flex container (`flex h-full overflow-hidden`). Renders collapsed strips for all non-active blades, plus one animated active blade taking `flex-1 min-w-0`.
- **`BladeStrip`** (`src/components/blades/BladeStrip.tsx`): Collapsed blade representation — 40px-wide vertical button with rotated title text (`writing-mode: vertical-lr; rotate: 180°`). Shows a `ChevronLeft` icon and the blade title. Clicking expands (pops back to that blade).
- **`BladePanel`** (`src/components/blades/BladePanel.tsx`): The standard chrome wrapper. 40px header bar (`h-10`) with back button, title (text or custom ReactNode via `titleContent`), and optional trailing element. Body gets `flex-1 min-h-0 overflow-hidden`.
- **`BladeRenderer`** (`src/components/blades/BladeRenderer.tsx`): Orchestrator that looks up registration, resolves title, wraps in error boundary + Suspense + BladePanel (unless `wrapInPanel: false`).

### Navigation Model
- **Stack-based**: `pushBlade`, `popBlade`, `popToIndex`, `replaceBlade`, `resetStack`
- **Two root processes**: `staging` and `topology`, each with a root blade
- **Singleton guard** in `useBladeNavigation`: `settings`, `changelog`, `gitflow-cheatsheet` prevent duplicate pushes
- **`replaceBlade`**: Used by DiffBlade for next/prev file navigation (swaps in-place without growing stack)

### Animation Patterns
- **AnimatePresence** with `mode="popLayout"` wraps the active blade
- **Motion config**: `initial={{ x: 40, opacity: 0 }}`, `animate={{ x: 0, opacity: 1 }}`, `exit={{ x: 40, opacity: 0 }}`
- **Transition**: `type: "tween"`, `ease: "easeOut"`, `duration: 0.2` — fast, subtle slide-in from the right
- **No other framer-motion usage** within blade internals (no stagger, no layout animations, no spring physics)
- Only the active blade animates; strips appear instantly

### Observations & Gaps
- **Good**: Clean slide-in animation, consistent 200ms duration
- **Gap**: No exit animation differentiation for "going back" vs "going deeper" — both use the same rightward motion
- **Gap**: No transition animation on the BladeStrip when it appears/disappears
- **Gap**: No `motion-safe:` prefix on the blade transition (not respecting `prefers-reduced-motion`)

---

## 2. Existing Blade Implementations — Pattern Catalog

### Blade Category Taxonomy

| Blade | Type | Registration | `wrapInPanel` | `lazy` | Has Custom `titleContent` | Has `trailing` | Internal Toolbar |
|---|---|---|---|---|---|---|---|
| StagingChangesBlade | Root | `staging-changes` | **false** | no | — | — | No (uses SplitPaneLayout) |
| TopologyRootBlade | Root | `topology-graph` | **false** | no | — | — | Yes (graph/history tabs) |
| CommitDetailsBlade | Detail | `commit-details` | true (default) | no | no | no | No |
| DiffBlade | Detail | `diff` | true (default) | **yes** | **yes** (path segments) | no | **Yes** (inline/side-by-side + nav) |
| ViewerImageBlade | Viewer | `viewer-image` | true (default) | no | no | no | **Yes** (filepath display) |
| ViewerNupkgBlade | Viewer | `viewer-nupkg` | true (default) | no | no | no | No (delegates to NugetPackageViewer) |
| ViewerMarkdownBlade | Placeholder | `viewer-markdown` | true (default) | no | no | no | No |
| Viewer3dBlade | Placeholder | `viewer-3d` | true (default) | no | no | no | No |
| RepoBrowserBlade | Placeholder | `repo-browser` | true (default) | no | no | no | No |
| GitflowCheatsheetBlade | Placeholder | `gitflow-cheatsheet` | true (default) | no | no | no | No |
| SettingsBlade | Utility | `settings` | true (default) | no | no | no | No (has internal sidebar tabs) |
| ChangelogBlade | Utility | `changelog` | true (default) | no | no | no | No |

### Internal Layout Patterns

1. **Split-pane layout** (`StagingChangesBlade`): Uses `SplitPaneLayout` with resizable panels, 40/60 default split
2. **Sub-navigation tabs** (`TopologyRootBlade`): Tab bar in `bg-ctp-crust` with toggle between graph/history views
3. **Scrollable content** (`CommitDetailsBlade`, `ChangelogBlade`): `overflow-y-auto p-4` for simple document-style content
4. **Full-bleed editor** (`DiffBlade`): Monaco editor fills remaining space with `flex-1 min-h-0`
5. **Centered media** (`ViewerImageBlade`): Toolbar + centered content with `items-center justify-center`
6. **Sidebar tabs** (`SettingsBlade`): Internal 180px sidebar with vertical tab navigation
7. **Placeholder/Coming Soon**: Centered icon + text pattern used by 4 blades

### Toolbar Sub-header Pattern
Used by 3 blades, each rolling their own:
- **DiffBlade** (line 182-203): `flex items-center gap-2 px-3 py-1 border-b border-ctp-surface0 bg-ctp-crust shrink-0`
- **TopologyRootBlade** (line 18-43): `flex items-center gap-1 px-3 py-1.5 border-b border-ctp-surface0 bg-ctp-crust shrink-0`
- **ViewerImageBlade** (line 67-72): `flex items-center gap-2 px-3 py-2 border-b border-ctp-surface0 bg-ctp-crust shrink-0`

> **Pattern**: All three use `bg-ctp-crust`, `border-b border-ctp-surface0`, `shrink-0`, and horizontal flex. But padding varies (`py-1` vs `py-1.5` vs `py-2`).

---

## 3. Loading, Error, and Empty State Consistency

### Loading States

| Blade | Loading Pattern | Consistent? |
|---|---|---|
| DiffBlade | `Loader2` spinner, centered, `bg-ctp-mantle` | Yes |
| CommitDetailsBlade | `Loader2` spinner, centered, no explicit bg | **Slight diff** |
| ViewerImageBlade | `Loader2` spinner, centered, `bg-ctp-mantle` | Yes |
| BladeLoadingFallback (Suspense) | `Loader2` spinner, centered, no explicit bg | **Slight diff** |

**Inconsistency**: Some blades use `bg-ctp-mantle` for the loading container background, others inherit. Spinner size varies slightly (`w-5 h-5` vs `w-6 h-6` for ViewerImageBlade loading).

### Error States

| Blade | Error Pattern | Recovery |
|---|---|---|
| DiffBlade | Centered `text-ctp-red text-sm` message | None |
| CommitDetailsBlade | Centered `text-ctp-red text-sm` message | None |
| ViewerImageBlade | Icon + message + filepath | None |
| BladeErrorBoundary | `AlertTriangle` icon + message + Go back + Retry buttons | **Yes** |
| BladeRenderer (unknown type) | `text-ctp-red` inline message | None |

**Inconsistency**: Only `BladeErrorBoundary` offers recovery actions. Individual blade data-loading errors show a dead-end red message with no retry button and no way to go back. Users must use the back button in the header bar.

### Empty States

**Major gap**: No blades implement a dedicated "no data" empty state:
- `CommitDetailsBlade`: If `filesChanged.length === 0`, section is simply not rendered (no empty state message)
- `ChangelogBlade`: Form always shows; no "no commits in range" empty state after generation
- `FileTreeBlade`: If files array is empty, renders an empty container with no message
- `StagingChangesBlade`: Delegates to `StagingPanel` which may have its own empty state but the blade doesn't handle it

**Recommendation**: Define a shared `BladeEmptyState` component with consistent icon + message + optional action.

---

## 4. Accessibility Patterns

### What's Done Well
- **BladeStrip**: Has `aria-label={`Expand ${title} panel`}` — good
- **BladePanel back button**: Has `aria-label="Go back"` — good
- **SettingsBlade**: Exemplary tab pattern with `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `aria-orientation="vertical"`, proper `tabIndex` roving management, keyboard navigation (Arrow keys, Home, End) — **gold standard**
- **StagingChangesBlade**: Uses `role="region"` with `aria-label` for both panes
- **DiffBlade navigation**: `aria-label` on prev/next buttons
- **Button component**: Uses `focus-visible:ring-1 focus-visible:ring-ctp-overlay0` — proper focus ring

### Accessibility Gaps
1. **No skip navigation**: No way to jump between blade header and blade content via keyboard
2. **No ARIA landmarks on blades**: `BladePanel` doesn't use `role="region"` or `aria-label` on the panel itself — only `StagingChangesBlade` does this manually
3. **Missing focus management on blade push/pop**: When a new blade slides in, focus is not programmatically moved to the new blade content or header. Screen reader users may be lost.
4. **BladeStrip keyboard**: Strips are `<button>` so they're focusable, but there's no roving tabindex pattern — with many collapsed blades, Tab would hit each one
5. **DiffBlade**: Monaco editor has its own accessibility, but the toolbar toggle buttons lack descriptive `aria-label` (rely on `title` only)
6. **FileTreeBlade**: `<details>/<summary>` elements used for tree — accessible by default but no ARIA tree pattern (`role="tree"`, `role="treeitem"`) for advanced AT
7. **ChangelogBlade**: Input fields have `<label>` elements but they're not linked via `htmlFor`/`id` — labels are visual only, not programmatic
8. **No announcement of blade navigation**: Screen readers won't know a new blade opened. Need `aria-live` region or focus management.

### Keyboard Navigation Coverage
- **SettingsBlade**: Full arrow key navigation — exemplary
- **StagingChangesBlade**: Uses `useStagingKeyboard` hook for file list navigation
- **DiffBlade**: `useHotkeys` for Alt+Up/Alt+Down file navigation
- **Other blades**: No custom keyboard patterns (expected for simple content blades)

---

## 5. Animation Patterns

### framer-motion Usage

Only `BladeContainer.tsx` uses framer-motion directly:
```tsx
<AnimatePresence mode="popLayout">
  <motion.div
    key={activeBlade.id}
    initial={{ x: 40, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: 40, opacity: 0 }}
    transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
  />
</AnimatePresence>
```

### CSS Animations
- `animate-spin` (Tailwind built-in): Used on `Loader2` spinners across multiple blades
- `animate-dirty-pulse`: Custom animation in `index.css` — 2s infinite pulse with `drop-shadow` and opacity, used for dirty-state indicators (not in blade components)

### Recommendations for New Blades
- New content blades should **not** add their own entrance animations — the container handles it
- Internal content transitions (e.g., tab switching within a blade) could use subtle opacity fades
- Consider `motion-safe:` prefix for blade container animation to respect `prefers-reduced-motion`
- Loading spinner animations already use CSS `animate-spin` which is fine for reduced-motion contexts

---

## 6. Toolbar Patterns — Deep Dive

### Current Toolbar Implementations

Three distinct toolbar implementations exist with inconsistent spacing:

```
DiffBlade:         px-3 py-1   gap-2  border-b border-ctp-surface0 bg-ctp-crust shrink-0
TopologyRootBlade: px-3 py-1.5 gap-1  border-b border-ctp-surface0 bg-ctp-crust shrink-0
ViewerImageBlade:  px-3 py-2   gap-2  border-b border-ctp-surface0 bg-ctp-crust shrink-0
```

All share: `flex items-center`, `border-b border-ctp-surface0`, `bg-ctp-crust`, `shrink-0`.

### Recommendation: Extract a `BladeToolbar` Component

```tsx
interface BladeToolbarProps {
  children: ReactNode;
  className?: string;
}

function BladeToolbar({ children, className }: BladeToolbarProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 border-b border-ctp-surface0 bg-ctp-crust shrink-0",
      className
    )}>
      {children}
    </div>
  );
}
```

This would standardize the toolbar pattern for all existing and new blades. The `py-1.5` provides a balanced middle ground.

---

## 7. Color Tokens & Theme

### Theme System
- **CSS Import**: `@catppuccin/tailwindcss/mocha.css` provides `--ctp-*` custom properties
- **Modes**: `.mocha` (dark default) and `.latte` (light) classes on `<html>`
- **Font stack**: Geist Variable (sans), JetBrains Mono Variable (mono)
- **Custom animation**: `--animate-dirty-pulse` registered in `@theme {}` block

### Color Token Usage in Blade Components

| Token | Semantic Use | Where Used |
|---|---|---|
| `bg-ctp-crust` | Header bars, toolbars (darkest bg) | BladePanel header, all toolbars |
| `bg-ctp-base` | Standard panel backgrounds | BladeStrip, SettingsBlade sidebar |
| `bg-ctp-mantle` | Content area backgrounds | DiffBlade loading/error, ViewerImageBlade |
| `bg-ctp-surface0` | Elevated surfaces, hover states, cards | CommitDetailsBlade card, SettingsBlade active tab |
| `bg-ctp-surface0/30` | Subtle card backgrounds | CommitDetailsBlade metadata card |
| `bg-ctp-surface0/50` | Hover & input backgrounds | FileTreeBlade input, file hover |
| `bg-ctp-surface1` | Active toggles, input borders | FileTreeBlade toggle, button borders |
| `border-ctp-surface0` | Dividers, borders | Universal across all blades |
| `border-ctp-surface1` | Input borders | ChangelogBlade, FileTreeBlade inputs |
| `text-ctp-text` | Primary text | Headings, active labels |
| `text-ctp-subtext0` | Secondary text | Descriptions, blade strip title |
| `text-ctp-subtext1` | Tertiary text / labels | BladePanel title, metadata labels |
| `text-ctp-overlay0` | Muted/tertiary text | "Coming in Phase 22", counters |
| `text-ctp-overlay1` | Icons, muted interactive text | ChevronLeft in strip, Loader2 |
| `text-ctp-red` | Errors, deletions | Error messages, deletion indicators |
| `text-ctp-green` | Additions, success | Copy success, addition indicators |
| `text-ctp-yellow` | Modified | File status indicator |
| `text-ctp-blue` | Primary actions, selections | Active SettingsBlade tab, focus rings |
| `text-ctp-peach` | Warnings | BladeErrorBoundary AlertTriangle |
| `text-ctp-teal` | Copied files | FileTreeBlade status |
| `ring-ctp-blue/30` | Selection rings | FileRow selected state |
| `ring-ctp-blue/50` | Focus rings | Input focus states |

### Color Hierarchy for New Blades
Background depth (darkest to lightest): `crust` → `mantle` → `base` → `surface0` → `surface1`
Text hierarchy (brightest to most muted): `text` → `subtext1` → `subtext0` → `overlay1` → `overlay0`

---

## 8. Registration System Patterns

### Registration Architecture
- **Registry**: `Map<string, BladeRegistration>` in `src/lib/bladeRegistry.ts`
- **Side-effect imports**: Each registration file calls `registerBlade()` at module load time
- **Barrel**: `src/components/blades/registrations/index.ts` imports all registration files
- **App entry**: `src/App.tsx` imports the barrel

### Registration Options Used

| Option | Used By | Purpose |
|---|---|---|
| `wrapInPanel: false` | staging-changes, topology-graph | Root blades that render their own chrome |
| `showBack: false` | staging-changes, topology-graph | Root blades (no back navigation) |
| `lazy: true` | diff | Code-split heavy component (Monaco editor) |
| `renderTitleContent` | diff | Custom title with path segment styling |
| `defaultTitle` as function | viewer-image | Dynamic title from props |
| `renderTrailing` | **none currently** | Available but unused |

### Recommendations for New Blades
- Content blades (repo-browser, markdown viewer, etc.) should use `wrapInPanel: true` (default) with `showBack: true` (default)
- Heavy viewer blades (3D viewer, markdown with syntax highlighting) should use `lazy: true`
- Consider using `renderTrailing` for blade-specific action buttons (e.g., "Copy markdown", "Download file")
- The `renderTitleContent` pattern from `diff` registration is elegant for showing file path context

---

## 9. Summary of UX Gaps & Recommendations for Phase 22

### Critical Gaps (Must Fix)

1. **No shared toolbar component**: Three blades have inconsistent toolbar implementations. Extract `BladeToolbar`.
2. **No empty state component**: No blade handles empty data gracefully. Create `BladeEmptyState` with icon/message/action slots.
3. **Inconsistent error recovery**: Only `BladeErrorBoundary` offers retry. Data-fetch errors within blades are dead-ends.
4. **Missing focus management on navigation**: Focus doesn't move when blades push/pop — accessibility issue.

### Important Gaps (Should Fix)

5. **No `motion-safe:` prefix on blade animation**: Container animation should respect `prefers-reduced-motion`.
6. **Loading state inconsistency**: Background color and spinner size vary across blades. Standardize.
7. **ChangelogBlade labels not linked to inputs**: `<label>` elements lack `htmlFor` attributes.
8. **No ARIA landmarks on blade panels**: `BladePanel` should add `role="region"` and `aria-label`.

### Nice-to-Have Improvements

9. **Differentiated back/forward animation**: Different slide direction when going back vs pushing deeper.
10. **BladeStrip roving tabindex**: Reduce tab stops when many blades are collapsed.
11. **Announce blade changes to screen readers**: Use `aria-live` or focus management.
12. **`renderTrailing` adoption**: Use for per-blade actions in the header bar.

### New Content Blade Design Checklist

Every new Phase 22 content blade should:

- [ ] Use `wrapInPanel: true` (default) unless managing its own chrome
- [ ] Use `lazy: true` for heavy dependencies (Monaco, 3D renderer, markdown parser)
- [ ] Implement loading state: centered `Loader2` spinner on `bg-ctp-mantle`
- [ ] Implement error state: icon + message + retry action
- [ ] Implement empty state: icon + descriptive message + optional action
- [ ] Use `BladeToolbar` (to be created) for any sub-header controls
- [ ] Follow color hierarchy: `crust` for headers/toolbars, `mantle` for content bg, `surface0` for cards
- [ ] Add `aria-label` on interactive elements
- [ ] Support keyboard navigation for interactive content
- [ ] Use `renderTitleContent` for contextual title rendering (file paths, etc.)
- [ ] Consider `renderTrailing` for blade-specific header actions
- [ ] Register in `registrations/` directory with proper typing in `BladePropsMap`

---

## 10. Existing Blade Extensibility Rating

| Aspect | Rating | Notes |
|---|---|---|
| Type system | **A** | `BladePropsMap` discriminated union is excellent — adding a blade = one line |
| Registration | **A** | Side-effect import pattern is clean and decoupled |
| Panel chrome | **B+** | BladePanel is flexible (title/titleContent/trailing/back) but lacks toolbar slot |
| Loading/Error | **C+** | Error boundary exists but per-blade loading/error is ad-hoc |
| Empty states | **D** | No pattern exists at all |
| Accessibility | **B-** | SettingsBlade is exemplary but most blades are minimal |
| Animation | **B** | Container animation is good; no internal blade animation framework |
| Toolbar pattern | **C** | Exists informally but is inconsistent; needs extraction |

**Overall Extensibility Score: B** — The type system and registration architecture are strong foundations. The main work for Phase 22 is extracting shared UX primitives (toolbar, empty state, loading/error patterns) so new blades are consistent by default rather than by discipline.
