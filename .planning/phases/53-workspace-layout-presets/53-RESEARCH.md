# Phase 53: Workspace Layout Presets - Research

**Researched:** 2026-02-14
**Domain:** Panel layout management, persistence, UI presets (react-resizable-panels v4 + Zustand + Tauri Store)
**Confidence:** HIGH

## Summary

Phase 53 adds workspace layout presets, panel focus mode, panel visibility toggles, and layout persistence to FlowForge. The existing codebase already uses `react-resizable-panels` v4.6.2 for the main two-panel layout (`RepositoryView` = sidebar + blade container) but does **not** currently use the library's persistence or imperative APIs. The current `autoSaveId` prop in the wrapper component only sets the Group `id` -- it does NOT enable any persistence (the v4 API removed the old `autoSaveId` prop in favor of the `useDefaultLayout` hook).

The primary work involves: (1) defining preset layout configurations as data, (2) building a Zustand store for layout state with Tauri Store persistence, (3) wiring the `react-resizable-panels` imperative API (`GroupImperativeHandle.setLayout`, `PanelImperativeHandle.collapse/expand`) for programmatic layout switching, (4) adding a "Layout" toolbar menu and a "Panels" menu to the View menu, (5) implementing focus mode (fullscreen panel) with Esc exit via `react-hotkeys-hook`, and (6) using `framer-motion` for smooth transitions (already the project's standard).

**Primary recommendation:** Build a `useLayoutStore` Zustand slice in the preferences store (persisted via `@tauri-apps/plugin-store`) that manages active preset, panel visibility, and saved panel sizes. Use the `react-resizable-panels` v4 imperative Group/Panel APIs to apply layouts programmatically. Reuse existing menu-bar and toolbar-registry patterns for UI surfaces.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-resizable-panels | 4.6.2 | Panel layout with resize, collapse, imperative API | Already in project; provides `GroupImperativeHandle.setLayout()`, `PanelImperativeHandle.collapse()/expand()`, `collapsible` prop |
| zustand | 5.x | Layout state management (active preset, panel visibility, saved sizes) | Already the project's state management pattern; sliced stores in preferences domain |
| @tauri-apps/plugin-store | 2.x | Persist layout preferences to disk | Already used by preferences store (`flowforge-settings.json`) via `getStore()` helper |
| framer-motion | 12.34.0 | Smooth animated transitions between layouts | Already in project; used by BladeContainer, MenuDropdown, all blade transitions |
| react-hotkeys-hook | 5.2.4 | Keyboard shortcuts (Esc for focus mode exit, preset hotkeys) | Already in project; used by `useKeyboardShortcuts` |
| lucide-react | (installed) | Icons for layout presets and panel toggles | Already the project's icon library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | (installed) | Variant-based button styling for active preset indicator | For preset selector buttons with active/inactive variants |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand slice for layout | Separate Zustand store | Separate store would not auto-persist with preferences; slice is consistent with project pattern |
| Custom persistence | react-resizable-panels `useDefaultLayout` + localStorage | `useDefaultLayout` uses localStorage by default; Tauri Store is the project standard for persistence and works better for desktop apps (no localStorage size limits, saved to disk) |
| framer-motion LayoutGroup | CSS transitions on panel sizes | framer-motion is already used everywhere; CSS transitions won't work well with flex-grow changes from react-resizable-panels |

**Installation:**
```bash
# No new dependencies needed - all libraries are already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── core/
│   ├── stores/domain/preferences/
│   │   └── layout.slice.ts           # NEW: Layout preset state + persistence
│   ├── components/
│   │   ├── layout/
│   │   │   ├── ResizablePanelLayout.tsx  # MODIFY: Add imperative refs, collapsible support
│   │   │   ├── SplitPaneLayout.tsx       # Unchanged
│   │   │   └── index.ts                 # MODIFY: Re-export new types
│   │   ├── RepositoryView.tsx            # MODIFY: Wire layout store to panel sizes, add focus mode
│   │   ├── menu-bar/
│   │   │   └── menu-definitions.ts       # MODIFY: Add "Layout" submenu + "Panels" entries to View menu
│   │   └── toolbar/                      # Optionally add layout preset toolbar button
│   ├── hooks/
│   │   ├── useKeyboardShortcuts.ts       # MODIFY: Add Esc for focus mode, preset hotkeys
│   │   └── useLayoutPresets.ts           # NEW: Hook wiring layout store to panel imperative API
│   └── lib/
│       └── layoutPresets.ts              # NEW: Preset definitions as data (Review, Commit, Explore, Focus)
```

### Pattern 1: Layout Preset Definitions as Data
**What:** Define presets as plain objects mapping panel IDs to percentage sizes, rather than hardcoding JSX variations.
**When to use:** Whenever multiple layout configurations need to be applied to the same panel structure.
**Example:**
```typescript
// Source: Project pattern (data-driven configuration like menu-definitions.ts)
import type { LucideIcon } from "lucide-react";
import { LayoutGrid, GitCommitHorizontal, FolderSearch, Maximize2 } from "lucide-react";

export interface LayoutPreset {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Panel id -> percentage size (0..100). Panels not listed are hidden (collapsed to 0). */
  layout: Record<string, number>;
  /** Which panels are visible in this preset */
  visiblePanels: string[];
}

// Panel IDs match the existing id props in RepositoryView.tsx
export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "review",
    label: "Review",
    icon: LayoutGrid,
    description: "Balanced view for code review",
    layout: { sidebar: 20, blades: 80 },
    visiblePanels: ["sidebar", "blades"],
  },
  {
    id: "commit",
    label: "Commit",
    icon: GitCommitHorizontal,
    description: "Emphasize staging area for committing",
    layout: { sidebar: 30, blades: 70 },
    visiblePanels: ["sidebar", "blades"],
  },
  {
    id: "explore",
    label: "Explore",
    icon: FolderSearch,
    description: "Maximize blade area for browsing",
    layout: { sidebar: 15, blades: 85 },
    visiblePanels: ["sidebar", "blades"],
  },
  {
    id: "focus",
    label: "Focus",
    icon: Maximize2,
    description: "Full-screen blade area, sidebar hidden",
    layout: { sidebar: 0, blades: 100 },
    visiblePanels: ["blades"],
  },
];
```

### Pattern 2: Zustand Layout Slice with Tauri Store Persistence
**What:** A new slice in the preferences store that manages layout state and persists it via `@tauri-apps/plugin-store`.
**When to use:** For any UI state that should survive app restarts.
**Example:**
```typescript
// Source: Existing pattern from settings.slice.ts, navigation.slice.ts
import type { StateCreator } from "zustand";
import { getStore } from "../../../lib/store";
import type { PreferencesStore } from "./index";
import type { PreferencesMiddleware } from "./types";

export interface LayoutState {
  activePreset: string;       // "review" | "commit" | "explore" | "focus" | "custom"
  panelSizes: Record<string, number>;  // { sidebar: 20, blades: 80 }
  hiddenPanels: string[];     // panels the user has toggled off
  focusedPanel: string | null; // non-null when a panel is maximized
}

const defaultLayoutState: LayoutState = {
  activePreset: "review",
  panelSizes: { sidebar: 20, blades: 80 },
  hiddenPanels: [],
  focusedPanel: null,
};

export interface LayoutSlice {
  layoutState: LayoutState;
  setActivePreset: (presetId: string) => Promise<void>;
  setPanelSizes: (sizes: Record<string, number>) => Promise<void>;
  togglePanel: (panelId: string) => Promise<void>;
  enterFocusMode: (panelId: string) => void;
  exitFocusMode: () => void;
  resetLayout: () => Promise<void>;
  initLayout: () => Promise<void>;
}

export const createLayoutSlice: StateCreator<
  PreferencesStore,
  PreferencesMiddleware,
  [],
  LayoutSlice
> = (set, get) => ({
  layoutState: defaultLayoutState,

  setActivePreset: async (presetId) => {
    // Look up preset, update layout, persist
    const store = await getStore();
    const newState = { ...get().layoutState, activePreset: presetId };
    await store.set("layout", newState);
    await store.save();
    set({ layoutState: newState }, false, "preferences:layout/setPreset");
  },

  // ... other methods follow the same pattern as settings.slice.ts
  initLayout: async () => {
    const store = await getStore();
    const saved = await store.get<Partial<LayoutState>>("layout");
    if (saved) {
      set(
        { layoutState: { ...defaultLayoutState, ...saved } },
        false,
        "preferences:layout/init",
      );
    }
  },
});
```

### Pattern 3: Imperative Panel API for Programmatic Layout Changes
**What:** Use `react-resizable-panels` v4 imperative handles (`groupRef`, `panelRef`) to apply layouts programmatically when presets change.
**When to use:** Any time layout needs to change without user drag interaction.
**Example:**
```typescript
// Source: react-resizable-panels v4 type definitions (verified from installed package)
import { useRef, useEffect } from "react";
import { useGroupRef, usePanelRef } from "react-resizable-panels";
import type { GroupImperativeHandle, PanelImperativeHandle } from "react-resizable-panels";

function RepositoryView() {
  const groupRef = useGroupRef();
  const sidebarRef = usePanelRef();

  // Apply layout when preset changes
  const applyPreset = (preset: LayoutPreset) => {
    if (groupRef.current) {
      groupRef.current.setLayout(preset.layout);
    }
    // For focus preset, collapse sidebar
    if (!preset.visiblePanels.includes("sidebar") && sidebarRef.current) {
      sidebarRef.current.collapse();
    } else if (sidebarRef.current?.isCollapsed()) {
      sidebarRef.current.expand();
    }
  };

  return (
    <Group
      id="repo-layout"
      orientation="horizontal"
      groupRef={groupRef}
      onLayoutChanged={(layout) => {
        // Persist sizes when user manually resizes
        layoutStore.getState().setPanelSizes(layout);
      }}
    >
      <Panel
        id="sidebar"
        collapsible
        collapsedSize="0%"
        minSize="15%"
        maxSize="30%"
        defaultSize="20%"
        panelRef={sidebarRef}
      >
        {/* sidebar content */}
      </Panel>
      <Separator />
      <Panel id="blades" defaultSize="80%">
        {/* blade container */}
      </Panel>
    </Group>
  );
}
```

### Pattern 4: Focus Mode (Fullscreen Panel)
**What:** Double-click on `BladePanel` header maximizes that panel to 100%. Esc exits.
**When to use:** When user wants to focus on a single content area.
**Example:**
```typescript
// Source: Existing BladePanel pattern + react-hotkeys-hook pattern
// In BladePanel.tsx header:
<div
  className="h-10 px-3 flex items-center gap-2 border-b border-ctp-surface0 bg-ctp-crust shrink-0"
  onDoubleClick={() => layoutStore.getState().enterFocusMode("blades")}
>
  {/* existing header content */}
</div>

// In useKeyboardShortcuts.ts:
useHotkeys("escape", () => {
  const { layoutState, exitFocusMode } = usePreferencesStore.getState();
  if (layoutState.focusedPanel) {
    exitFocusMode();
    return; // Don't propagate to blade pop
  }
  // existing blade pop logic...
});
```

### Pattern 5: Adding Layout Presets to View Menu
**What:** Extend `menu-definitions.ts` with layout preset entries in the View menu.
**When to use:** For discoverability of layout presets through the menu bar.
**Example:**
```typescript
// Source: Existing menu-definitions.ts pattern
// Add to the View menu items array:
{ type: "divider", id: "view-div-layout" },
{
  type: "action",
  id: "view-layout-review",
  label: "Layout: Review",
  icon: LayoutGrid,
  commandId: "layout-preset-review",
},
// ... similar for commit, explore, focus
{ type: "divider", id: "view-div-panels" },
{
  type: "action",
  id: "view-toggle-sidebar",
  label: "Toggle Sidebar",
  icon: PanelLeft,
  shortcut: "mod+\\",
  commandId: "toggle-sidebar",
},
{
  type: "action",
  id: "view-reset-layout",
  label: "Reset Layout",
  icon: RotateCcw,
  commandId: "reset-layout",
},
```

### Anti-Patterns to Avoid
- **Conditional rendering for panel visibility:** Do NOT unmount panels to hide them. Use the `collapsible` + `collapse()` API from react-resizable-panels. Unmounting destroys component state (scroll position, form inputs, etc.) and causes layout recalculation flicker.
- **Manually calculating flex-grow values:** Do NOT set CSS flex-grow directly. Use `GroupImperativeHandle.setLayout()` which handles validation, constraints, and animation internally.
- **Storing layout in localStorage:** Do NOT use `localStorage` or `useDefaultLayout` for persistence. The project standard is `@tauri-apps/plugin-store` (`getStore()` helper) which writes to `flowforge-settings.json` on disk.
- **Creating separate stores for layout:** Do NOT create a new standalone Zustand store. Follow the existing pattern: add a slice to `usePreferencesStore` so layout preferences are co-located with other preferences and initialized together.
- **Hardcoding panel IDs:** The current `RepositoryView` uses `id="sidebar"` and `id="blades"`. Keep these stable IDs as the canonical identifiers for presets. If future phases add more panels, presets should be forward-compatible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Panel resize persistence | Custom resize event listener + manual localStorage | `onLayoutChanged` callback + Tauri Store persistence via layout slice | Panel library handles debouncing; Tauri Store is the project's persistence standard |
| Panel collapse/expand | Toggle CSS display/visibility | `Panel.collapsible` prop + `PanelImperativeHandle.collapse()/expand()` | Library handles flex recalculation, remembers previous size on expand |
| Programmatic layout changes | DOM manipulation / CSS class swapping | `GroupImperativeHandle.setLayout({ sidebar: 20, blades: 80 })` | Library validates constraints (min/max), distributes space correctly |
| Keyboard shortcut management | Raw addEventListener("keydown") | `useHotkeys` from `react-hotkeys-hook` | Project standard; handles mod key normalization, form tag exclusion, enable conditions |
| Dropdown menu UI | Custom popover from scratch | Extend existing `menu-definitions.ts` + `MenuBar` / register commands in `commandRegistry` | Project already has accessible menu bar with keyboard nav, highlighted index, framer-motion animations |

**Key insight:** The `react-resizable-panels` v4 imperative API is the critical building block. It provides `setLayout()` for presets, `collapse()/expand()` for panel toggling, and `onLayoutChanged` for persistence. Do not bypass it.

## Common Pitfalls

### Pitfall 1: v4 API Breaking Changes from v2/v3
**What goes wrong:** Using v2/v3 patterns like `autoSaveId` for persistence, or passing `onLayout` instead of `onLayoutChanged`.
**Why it happens:** Many blog posts and tutorials reference older versions. The project's current `autoSaveId` prop is actually just setting the `id` prop on `<Group>` and provides zero persistence.
**How to avoid:** Use only v4 API: `useDefaultLayout` hook (or manual `onLayoutChanged`) for persistence, `groupRef`/`panelRef` for imperative control, `Layout` type is `Record<string, number>` not `number[]`.
**Warning signs:** Type errors about `autoSaveId` not being a valid prop; layouts not persisting.

### Pitfall 2: Layout Object Format in v4
**What goes wrong:** Passing an array `[20, 80]` to `setLayout()` instead of the v4 object format `{ sidebar: 20, blades: 80 }`.
**Why it happens:** v2/v3 used array-based layouts. v4 changed to `Record<string, number>` keyed by panel `id`.
**How to avoid:** Always use the `Layout` type from react-resizable-panels: `{ [panelId: string]: number }`. Match keys to the `id` props on `<Panel>` components.
**Warning signs:** Runtime errors about invalid layout; panels not resizing.

### Pitfall 3: Size Format Strings in v4
**What goes wrong:** Passing raw numbers to `defaultSize`, `minSize`, `maxSize` and getting pixel-based sizes instead of percentages.
**Why it happens:** v4 interprets bare numbers as pixels, not percentages. Strings without units are treated as percentages.
**How to avoid:** The current `ResizablePanel` wrapper already converts numbers to `"${n}%"` strings. Maintain this conversion. For the imperative API, `setLayout()` takes numbers as percentages (0..100) -- this is an exception where numbers ARE percentages.
**Warning signs:** Panels rendering at unexpected sizes (e.g., 20px instead of 20%).

### Pitfall 4: Escape Key Conflict with Focus Mode
**What goes wrong:** Pressing Esc in focus mode pops the blade stack instead of exiting focus mode.
**Why it happens:** `useKeyboardShortcuts` already maps Escape to `POP_BLADE`. Adding focus mode exit creates ambiguity.
**How to avoid:** In the Escape handler, check `layoutState.focusedPanel` first. If in focus mode, exit focus mode and return early. Only fall through to blade pop if not in focus mode and not in command palette.
**Warning signs:** Double-action on Escape (exits focus AND pops blade); user cannot exit focus mode.

### Pitfall 5: Race Condition Between Store Init and Panel Render
**What goes wrong:** Panel renders with default sizes before the Tauri Store has loaded saved layout preferences.
**Why it happens:** `getStore()` is async; `initLayout()` is called in a `useEffect` which runs after first render.
**How to avoid:** Use `defaultLayout` prop from the `useDefaultLayout`-like pattern: compute the default from the store's sync state, and only after `initLayout` resolves will the layout update via `setLayout()`. Alternatively, render panels with a loading state until preferences are initialized.
**Warning signs:** Flash of default layout before saved layout restores.

### Pitfall 6: Panel Visibility Toggle Desynchronizing with Layout Store
**What goes wrong:** User collapses sidebar via drag (hits min size and snaps to collapsed), but layout store still shows sidebar as visible.
**Why it happens:** Drag-to-collapse and programmatic collapse are separate code paths.
**How to avoid:** Listen to `Panel.onResize` for size=0 events and sync to layout store's `hiddenPanels`. OR, set `collapsedSize="0%"` and use `onCollapse`/`onExpand` callbacks (not available in v4 -- use `onResize` and check if size.asPercentage === 0).
**Warning signs:** "Toggle Sidebar" button shows wrong state; preset selection doesn't match actual layout.

## Code Examples

Verified patterns from official sources:

### Using `useGroupRef` and `usePanelRef` for Imperative Control
```typescript
// Source: react-resizable-panels v4.6.2 installed type definitions
import { Group, Panel, Separator, useGroupRef, usePanelRef } from "react-resizable-panels";

function MyLayout() {
  const groupRef = useGroupRef();
  const sidebarRef = usePanelRef();

  const resetLayout = () => {
    groupRef.current?.setLayout({ sidebar: 20, blades: 80 });
  };

  const toggleSidebar = () => {
    if (sidebarRef.current?.isCollapsed()) {
      sidebarRef.current.expand();
    } else {
      sidebarRef.current?.collapse();
    }
  };

  return (
    <Group id="repo-layout" orientation="horizontal" groupRef={groupRef}>
      <Panel
        id="sidebar"
        collapsible
        collapsedSize="0%"
        defaultSize="20%"
        minSize="15%"
        maxSize="30%"
        panelRef={sidebarRef}
      >
        {/* sidebar */}
      </Panel>
      <Separator />
      <Panel id="blades" defaultSize="80%">
        {/* main content */}
      </Panel>
    </Group>
  );
}
```

### Persisting Layout with `onLayoutChanged` + Tauri Store
```typescript
// Source: react-resizable-panels v4 onLayoutChanged + existing getStore() pattern
import { getStore } from "../../../lib/store";

// In the Group component:
<Group
  id="repo-layout"
  orientation="horizontal"
  groupRef={groupRef}
  onLayoutChanged={async (layout) => {
    // layout = { sidebar: 22, blades: 78 } after user stops dragging
    const store = await getStore();
    await store.set("layout-sizes", layout);
    await store.save();
    // Also update Zustand store for immediate access
    usePreferencesStore.getState().setPanelSizes(layout);
  }}
>
```

### Registering Layout Commands in Command Registry
```typescript
// Source: Existing pattern from src/core/commands/index.ts
import { registerCommand } from "../lib/commandRegistry";
import { LAYOUT_PRESETS } from "../lib/layoutPresets";

for (const preset of LAYOUT_PRESETS) {
  registerCommand({
    id: `layout-preset-${preset.id}`,
    title: `Layout: ${preset.label}`,
    description: preset.description,
    category: "Navigation",
    icon: preset.icon,
    action: () => {
      usePreferencesStore.getState().setActivePreset(preset.id);
    },
  });
}

registerCommand({
  id: "toggle-sidebar",
  title: "Toggle Sidebar",
  category: "Navigation",
  icon: PanelLeft,
  shortcut: "mod+\\",
  action: () => {
    usePreferencesStore.getState().togglePanel("sidebar");
  },
});

registerCommand({
  id: "reset-layout",
  title: "Reset Layout to Default",
  category: "Navigation",
  icon: RotateCcw,
  action: () => {
    usePreferencesStore.getState().resetLayout();
  },
});
```

### Focus Mode with Esc Exit
```typescript
// Source: Existing useHotkeys pattern from useKeyboardShortcuts.ts
useHotkeys("escape", () => {
  // Priority 1: Close command palette (palette handles its own Escape)
  if (useCommandPaletteStore.getState().paletteIsOpen) return;

  // Priority 2: Exit focus mode
  const { layoutState, exitFocusMode } = usePreferencesStore.getState();
  if (layoutState.focusedPanel) {
    exitFocusMode();
    return;
  }

  // Priority 3: Pop blade stack
  getNavigationActor().send({ type: "POP_BLADE" });
}, { enableOnFormTags: false });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `autoSaveId` prop on PanelGroup (v2) | `useDefaultLayout` hook + `onLayoutChanged` callback (v4) | react-resizable-panels v3->v4 | Must use new persistence API; old prop does nothing |
| Array-based layouts `[20, 80]` (v2/v3) | Object-based layouts `{ sidebar: 20, blades: 80 }` (v4) | react-resizable-panels v4 | Layout keys are panel IDs; type-safe lookup |
| `PanelGroup`/`Panel`/`PanelResizeHandle` exports (v2) | `Group`/`Panel`/`Separator` exports (v4) | react-resizable-panels v4 | Renamed components; project wrapper already uses v4 names |
| `useRef<ImperativePanelHandle>` (v2) | `usePanelRef()` / `useGroupRef()` convenience hooks (v4) | react-resizable-panels v4 | Cleaner ref creation; properly typed |
| Numbers = percentages (v2) | Numbers = pixels, strings = various units (v4) | react-resizable-panels v4 | Project wrapper already handles this conversion |

**Deprecated/outdated:**
- `autoSaveId` prop: Removed in v4. The current project code naming this prop is misleading -- it only sets the group `id`.
- `onLayout` callback: Deprecated in favor of `onLayoutChanged` (fires after pointer release, not on every move).
- `PanelGroup`, `PanelResizeHandle`: Renamed to `Group`, `Separator` in v4. Project already uses v4 names.

## Open Questions

1. **Should presets accommodate the topology view as a third panel?**
   - What we know: The current layout is 2-panel (sidebar + blades). The topology view is a separate "process" (navigation machine state), not a panel in the ResizablePanelLayout.
   - What's unclear: Future phases might add more panels (e.g., a terminal panel, preview panel).
   - Recommendation: Design preset data as `Record<string, number>` (open-ended) rather than hardcoding "sidebar" and "blades". This makes presets forward-compatible.

2. **Transition animation between presets**
   - What we know: `react-resizable-panels` v4's `setLayout()` applies immediately with no built-in animation. The project uses `framer-motion` extensively.
   - What's unclear: Whether `framer-motion`'s `layout` prop can animate flex-grow changes applied by the panel library.
   - Recommendation: For v1, accept the instant snap from `setLayout()`. If smooth transitions are strictly required, wrap the layout change in a `requestAnimationFrame` loop that interpolates sizes over ~200ms using `setLayout()` at each frame. This can be a follow-up polish.

3. **How to handle the "custom" preset state**
   - What we know: When a user manually resizes after selecting a preset, the layout no longer matches any preset.
   - What's unclear: Should the UI show "Custom" or just deselect the current preset?
   - Recommendation: Track `activePreset` as "custom" when manual resize occurs. Show no active preset indicator. Keep the last-manually-set sizes as the "custom" state that persists.

## Sources

### Primary (HIGH confidence)
- `react-resizable-panels` v4.6.2 installed type definitions at `node_modules/react-resizable-panels/dist/react-resizable-panels.d.ts` -- Full API surface: `GroupImperativeHandle`, `PanelImperativeHandle`, `useGroupRef`, `usePanelRef`, `useDefaultLayout`, `Layout` type, `onLayoutChanged`, `collapsible`, `collapsedSize`
- Existing codebase: `src/core/components/layout/ResizablePanelLayout.tsx`, `src/core/components/RepositoryView.tsx`, `src/core/stores/domain/preferences/settings.slice.ts` -- Current layout structure, persistence patterns, store slice patterns

### Secondary (MEDIUM confidence)
- [react-resizable-panels GitHub repository](https://github.com/bvaughn/react-resizable-panels) -- API documentation, examples, changelog
- [react-resizable-panels npm page](https://www.npmjs.com/package/react-resizable-panels) -- Version info, README
- [react-resizable-panels imperative API examples](https://react-resizable-panels.vercel.app/examples/imperative-panel-api) -- Live demos of collapse/expand/resize
- [react-resizable-panels imperative group API examples](https://react-resizable-panels.vercel.app/examples/imperative-panel-group-api) -- Live demos of getLayout/setLayout

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used in the project; no new dependencies needed
- Architecture: HIGH - Patterns directly derived from existing codebase (preferences slices, command registry, menu definitions, toolbar registry)
- Pitfalls: HIGH - v4 API verified from installed type definitions; breaking changes documented from actual package
- Imperative API: HIGH - Type definitions read directly from `node_modules`; `GroupImperativeHandle.setLayout()` takes `Record<string, number>`, `PanelImperativeHandle` has `collapse()/expand()/resize()/isCollapsed()/getSize()`
- Animation approach: MEDIUM - `setLayout()` does not animate natively; interpolation approach is theoretical but sound

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable libraries, no expected breaking changes)
