# Phase 32: Toolbar Overhaul - Research

**Researched:** 2026-02-10
**Domain:** React data-driven toolbar architecture, extensible registry pattern, responsive overflow, WCAG accessibility
**Confidence:** HIGH

## Summary

Phase 32 transforms a monolithic, hardcoded `Header.tsx` (417 lines, 13+ inline buttons with imperative logic) into a data-driven toolbar powered by a `ToolbarRegistry` that mirrors the existing `commandRegistry` and `bladeRegistry` patterns already established in FlowForge. The current Header mixes action definitions, business logic (repo switching, branch switching, stash-and-switch confirmation), and rendering into a single component. The refactoring must separate these concerns cleanly while designing for Phase 33/35 extensibility from day one.

The three research angles (UX, architecture, expert development) converge on a single recommendation: build a `ToolbarRegistry` as a Zustand store with a `Map<string, ToolbarAction>` backing structure, render actions through a single `<Toolbar>` component that uses `ResizeObserver` (or `IntersectionObserver`) for overflow detection, and persist user visibility toggles in the existing `PreferencesStore` settings slice. No new libraries are required -- every needed capability exists in the current stack.

**Primary recommendation:** Build a `ToolbarRegistry` Zustand store modeled after the existing `commandRegistry` pattern but with `group`, `priority`, and `when` condition fields. Render through a `<Toolbar>` component with `ResizeObserver`-based overflow collapse. Keep the `Header.tsx` as a thin shell that composes `<Toolbar>`, `<RepoSwitcher>`, `<BranchSwitcher>`, and `<ProcessNavigation>`.

## Standard Stack

### Core (already in project -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5 | ToolbarRegistry store with reactive subscriptions | Already used for all stores; `subscribeWithSelector` enables efficient filtering |
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcut binding per toolbar action | Already in use; shortcuts already defined in `commandRegistry` |
| lucide-react | ^0.563 | Icon-only toolbar button rendering | Already used for all icons |
| class-variance-authority | ^0.7.1 | ToolbarButton variant styling | Already used for Button component |
| framer-motion | ^12.34.0 | Overflow menu animation | Already used for ShortcutTooltip |
| @tauri-apps/plugin-store | ^2 | Persistence of toolbar visibility preferences | Already used via `getStore()` for settings |

### Supporting (no new installs)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwind-merge | ^3.4.0 | Merging toolbar-specific Tailwind classes | Already used via `cn()` utility |
| @catppuccin/tailwindcss | ^1.0.0 | Theme-consistent toolbar colors | Already in global CSS |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ResizeObserver for overflow | IntersectionObserver | IntersectionObserver is simpler for visibility detection but ResizeObserver gives explicit width measurements needed for count badge accuracy. ResizeObserver is the better choice for toolbars. |
| Zustand store for registry | Plain module-level Map (like current commandRegistry) | Module-level Map works but lacks reactive re-rendering when actions are registered/unregistered dynamically (critical for Phase 33 extensions). Use Zustand. |
| Custom overflow hook | @react-hook/resize-observer | Adds a dependency for a 20-line hook. Not worth it. Hand-roll the hook. |

**Installation:**
```bash
# No new packages needed -- entire implementation uses existing dependencies
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── toolbarRegistry.ts           # ToolbarAction type + Zustand store (register/unregister/getActions)
├── components/
│   └── toolbar/
│       ├── Toolbar.tsx               # Main toolbar component (renders groups, handles overflow)
│       ├── ToolbarGroup.tsx          # Visual group with divider
│       ├── ToolbarButton.tsx         # Single action button (icon + ShortcutTooltip)
│       ├── ToolbarOverflowMenu.tsx   # Overflow dropdown with count badge
│       └── useToolbarOverflow.ts     # ResizeObserver hook for overflow detection
├── commands/
│   └── toolbar-actions.ts            # Core toolbar action registrations (barrel import)
├── stores/
│   └── domain/preferences/
│       └── settings.slice.ts         # Extended with toolbar visibility preferences
└── blades/
    └── settings/
        └── components/
            └── ToolbarSettings.tsx    # Toggle UI for toolbar action visibility
```

### Pattern 1: ToolbarAction Type Definition (Registry Contract)

**What:** A single interface that defines everything a toolbar action needs, designed for both core and extension registration.

**When to use:** Every toolbar action (core or extension) must conform to this shape.

**Example:**
```typescript
// src/lib/toolbarRegistry.ts
import type { LucideIcon } from "lucide-react";

export type ToolbarGroup = "navigation" | "git-actions" | "views" | "app";

export interface ToolbarAction {
  /** Unique identifier. Extensions use "ext:{extensionId}:{actionId}" */
  id: string;
  /** Display label for tooltip and overflow menu text */
  label: string;
  /** Icon component for icon-only rendering */
  icon: LucideIcon;
  /** Which group this action belongs to (controls visual grouping) */
  group: ToolbarGroup;
  /** Priority within group. Higher = more important = collapses last. */
  priority: number;
  /** Keyboard shortcut string (matches react-hotkeys-hook format) */
  shortcut?: string;
  /** Condition function: return true when action should be visible.
   *  Called reactively -- UI re-evaluates when dependencies change. */
  when?: () => boolean;
  /** Execute the action */
  execute: () => void | Promise<void>;
  /** Whether action is currently in a loading/pending state */
  isLoading?: () => boolean;
  /** Source: "core" for built-in, "ext:{id}" for extensions */
  source?: string;
}
```

### Pattern 2: Zustand-Based ToolbarRegistry Store

**What:** A Zustand store wrapping a Map, providing reactive registration/unregistration with subscriber notifications.

**When to use:** The single source of truth for all toolbar actions. Core registers at module load; extensions register/unregister at activation/deactivation.

**Example:**
```typescript
// src/lib/toolbarRegistry.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface ToolbarRegistryState {
  actions: Map<string, ToolbarAction>;
  register: (action: ToolbarAction) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;
  getGrouped: () => Record<ToolbarGroup, ToolbarAction[]>;
}

export const useToolbarRegistry = create<ToolbarRegistryState>()(
  devtools(
    (set, get) => ({
      actions: new Map(),

      register: (action) =>
        set((state) => {
          const next = new Map(state.actions);
          next.set(action.id, action);
          return { actions: next };
        }, false, "toolbar/register"),

      unregister: (id) =>
        set((state) => {
          const next = new Map(state.actions);
          next.delete(id);
          return { actions: next };
        }, false, "toolbar/unregister"),

      unregisterBySource: (source) =>
        set((state) => {
          const next = new Map(state.actions);
          for (const [id, action] of next) {
            if (action.source === source) next.delete(id);
          }
          return { actions: next };
        }, false, "toolbar/unregisterBySource"),

      getGrouped: () => {
        const groups: Record<ToolbarGroup, ToolbarAction[]> = {
          navigation: [],
          "git-actions": [],
          views: [],
          app: [],
        };
        for (const action of get().actions.values()) {
          if (action.when && !action.when()) continue;
          groups[action.group].push(action);
        }
        // Sort each group by priority descending
        for (const group of Object.values(groups)) {
          group.sort((a, b) => b.priority - a.priority);
        }
        return groups;
      },
    }),
    { name: "toolbar-registry", enabled: import.meta.env.DEV },
  ),
);
```

### Pattern 3: ResizeObserver Overflow Hook

**What:** A custom React hook that tracks container width and determines which items overflow.

**When to use:** The `<Toolbar>` component uses this to decide which actions render inline vs. in the overflow menu.

**Example:**
```typescript
// src/components/toolbar/useToolbarOverflow.ts
import { useCallback, useEffect, useRef, useState } from "react";

export function useToolbarOverflow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(Infinity);

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = Array.from(
      container.querySelectorAll<HTMLElement>("[data-toolbar-item]")
    );
    const containerWidth = container.clientWidth;

    // Reserve space for overflow button (40px)
    const overflowButtonWidth = 40;
    let usedWidth = 0;
    let count = 0;

    for (const item of items) {
      const itemWidth = item.offsetWidth;
      const nextUsed = usedWidth + itemWidth;
      // If this item would exceed available space, stop
      if (nextUsed > containerWidth - overflowButtonWidth && count < items.length) {
        break;
      }
      usedWidth = nextUsed;
      count++;
    }

    setVisibleCount(count >= items.length ? Infinity : count);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(recalculate);
    observer.observe(container);

    // Initial calculation
    recalculate();

    return () => observer.disconnect();
  }, [recalculate]);

  return { containerRef, visibleCount };
}
```

### Pattern 4: VS Code-Style Contribution Point Pattern (for Phase 33 extensibility)

**What:** Extensions contribute toolbar actions through `contributeToolbar()` which internally calls `useToolbarRegistry.getState().register()` with namespaced IDs and source tracking.

**When to use:** Phase 33+ when extensions need to add toolbar actions.

**Example:**
```typescript
// Phase 33: ExtensionAPI facade (for context -- not built in Phase 32)
class ExtensionAPI {
  private registrations: Array<() => void> = [];

  contributeToolbar(action: Omit<ToolbarAction, "id" | "source"> & { actionId: string }) {
    const fullId = `ext:${this.extensionId}:${action.actionId}`;
    const fullAction: ToolbarAction = {
      ...action,
      id: fullId,
      source: `ext:${this.extensionId}`,
    };
    useToolbarRegistry.getState().register(fullAction);
    this.registrations.push(() =>
      useToolbarRegistry.getState().unregister(fullId)
    );
  }

  // On deactivation, cleanup is automatic:
  deactivate() {
    for (const cleanup of this.registrations) cleanup();
    this.registrations = [];
  }
}
```

### Pattern 5: Toolbar Visibility Preferences

**What:** Extend the existing `settings.slice.ts` with a `toolbar` section to persist which actions the user has toggled off.

**When to use:** TB-06 requires persisted user preferences for showing/hiding toolbar actions.

**Example:**
```typescript
// Extended settings.slice.ts
export interface ToolbarSettings {
  /** Set of action IDs the user has explicitly hidden */
  hiddenActions: string[];
}

export interface Settings {
  general: GeneralSettings;
  git: GitSettings;
  integrations: IntegrationsSettings;
  toolbar: ToolbarSettings;  // NEW
}

const defaultSettings: Settings = {
  // ...existing defaults...
  toolbar: {
    hiddenActions: [],
  },
};
```

### Anti-Patterns to Avoid

- **Inline business logic in toolbar component:** The current Header.tsx mixes repo switching, stash-and-switch confirmation dialogs, and branch switching logic with toolbar rendering. The refactored toolbar MUST NOT contain any business logic -- it renders actions from the registry and calls `execute()`. Business logic stays in stores/commands.

- **Hardcoded action lists in JSX:** Every toolbar button must come from the registry. Zero hardcoded buttons. If a button exists only in JSX, it cannot be discovered by extensions, cannot be toggled in settings, and breaks the overflow system.

- **Separate state for "when" conditions:** Do not create a separate store to track action visibility. Instead, `when` functions should read directly from existing stores (`useRepositoryStore.getState().repoStatus`, etc.). The toolbar re-renders based on store subscriptions.

- **Prop-drilling action definitions:** Do not pass toolbar actions as props from parent to child. The registry is the single source of truth, accessed directly by the Toolbar component.

- **CSS-only responsive hiding:** Tailwind responsive breakpoints (`sm:`, `md:`) cannot replace ResizeObserver for this use case because the toolbar needs to adapt to the actual available width (which depends on left-panel content like repo/branch switchers), not viewport width.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard shortcuts | Custom keydown listeners | `react-hotkeys-hook` (already in use) | Cross-browser, handles focus scoping, modifier normalization |
| Tooltip with shortcut display | Custom tooltip | Existing `ShortcutTooltip` component | Already built with animation, edge detection, reduced motion support |
| Persistent preferences | Custom localStorage wrapper | `@tauri-apps/plugin-store` via existing `getStore()` | Already handles Tauri filesystem persistence, used by 5+ stores |
| Focus management in toolbar | Manual tabindex manipulation | Native `role="toolbar"` + roving tabindex utility | WAI-ARIA toolbar pattern is well-defined; implement the standard |
| Icon rendering | Custom SVG pipeline | `lucide-react` icons | Already used for all 100+ icons in the app |
| Class merging | String concatenation | `cn()` utility (tailwind-merge + clsx) | Already handles Tailwind class conflicts |

**Key insight:** FlowForge already has robust infrastructure for commands, registration, and persistence. The toolbar registry is a specialized view of the command registry, not a replacement. Many commands already have the icon, shortcut, enabled-state, and action -- the toolbar registry adds `group`, `priority`, and `when` on top of that foundation.

## Common Pitfalls

### Pitfall 1: Stale `when()` Evaluations

**What goes wrong:** Toolbar actions don't appear/disappear when repo opens/closes because `when()` closures capture stale store state.
**Why it happens:** If `when` functions use closures over component state rather than reading stores directly, they become stale.
**How to avoid:** `when()` functions MUST call store `.getState()` at evaluation time, not close over values. The `Toolbar` component must subscribe to the relevant stores (repository, etc.) so it re-renders when conditions change.
**Warning signs:** Buttons visible when no repo is open, or missing when repo is open. Fix by verifying `when()` reads fresh state.

### Pitfall 2: ResizeObserver Infinite Loop

**What goes wrong:** ResizeObserver callback triggers a state change that changes the DOM, which triggers another resize observation, creating an infinite loop.
**Why it happens:** Setting `visibleCount` causes items to hide/show, changing container height, re-triggering the observer.
**How to avoid:** Only observe width changes, debounce with `requestAnimationFrame`, and use a stable measurement approach (measure hidden items in a "measurement layer" with `visibility: hidden` rather than removing them from the DOM).
**Warning signs:** Browser console warning: "ResizeObserver loop completed with undelivered notifications."

### Pitfall 3: Loss of Compound Components During Refactoring

**What goes wrong:** The current `SyncButtons` component is a compound component with its own query/mutation state (push/pull/fetch with progress tracking). Naively extracting buttons into the registry loses this shared state.
**Why it happens:** `SyncButtons` uses `useMutation` and `useState` for progress display, which is component-instance state that cannot live in a registry action definition.
**How to avoid:** The `isLoading` function on `ToolbarAction` should read from the relevant mutation state. For sync actions, the existing command definitions in `commands/sync.ts` already have the action logic. The `SyncProgressDisplay` can be rendered separately in the toolbar (outside the overflow system).
**Warning signs:** Push/pull/fetch buttons lose loading spinners or progress indicators.

### Pitfall 4: Overflow Count Badge Accuracy

**What goes wrong:** The overflow menu badge shows wrong count because it counts items that are hidden by `when()` conditions as overflowed.
**Why it happens:** Conflating "filtered out by condition" with "collapsed due to width."
**How to avoid:** First filter by `when()` and user visibility preferences, THEN apply overflow. The badge count = total visible actions minus actually rendered inline actions.
**Warning signs:** Badge says "3" but overflow menu only has 1 item (the other 2 were hidden by `when()`).

### Pitfall 5: Breaking RepoSwitcher and BranchSwitcher

**What goes wrong:** The header refactoring accidentally removes or repositions the repo/branch switchers, which are NOT toolbar actions but persistent navigation elements.
**Why it happens:** Over-zealous refactoring moves everything to the registry.
**How to avoid:** `RepoSwitcher`, `BranchSwitcher`, and `ProcessNavigation` remain as direct children of `Header`, NOT in the toolbar registry. They are structural navigation components, not actions. The `Header.tsx` composes: `[logo] [RepoSwitcher] [BranchSwitcher] [ProcessNav] | [Toolbar]`.
**Warning signs:** Repo/branch switchers collapse into overflow menu (they should never).

### Pitfall 6: Stash-And-Switch Dialog Orphaning

**What goes wrong:** The stash confirmation dialog currently lives in `Header.tsx`. After refactoring, it has no home.
**Why it happens:** The dialog is tightly coupled to branch switching logic in the header.
**How to avoid:** Move the stash-and-switch confirmation to `BranchSwitcher` or a separate dialog component that lives alongside it. This dialog is branch-switching UX, not toolbar UX.
**Warning signs:** No stash prompt when switching branches with dirty state.

## Code Examples

### Toolbar Action Registration (Core Actions)

```typescript
// src/commands/toolbar-actions.ts
import {
  CloudDownload, ArrowDown, ArrowUp, FileText, FolderOpen, FolderTree,
  GitBranch, GitFork, RefreshCw, Search, Settings, Undo2,
} from "lucide-react";
import { useToolbarRegistry } from "../lib/toolbarRegistry";
import { openBlade } from "../lib/bladeOpener";
import { useCommandPaletteStore } from "../stores/commandPalette";
import { useRepositoryStore } from "../stores/repository";

const register = useToolbarRegistry.getState().register;

// === App Group (always visible) ===

register({
  id: "tb:open-repo",
  label: "Open Repository",
  icon: FolderOpen,
  group: "app",
  priority: 100,
  shortcut: "mod+o",
  execute: () => document.dispatchEvent(new CustomEvent("open-repository-dialog")),
});

register({
  id: "tb:settings",
  label: "Settings",
  icon: Settings,
  group: "app",
  priority: 90,
  shortcut: "mod+,",
  execute: () => openBlade("settings", {} as Record<string, never>),
});

register({
  id: "tb:command-palette",
  label: "Command Palette",
  icon: Search,
  group: "app",
  priority: 80,
  shortcut: "mod+shift+P",
  execute: () => useCommandPaletteStore.getState().togglePalette(),
});

// === Git Actions Group (repo-specific) ===

register({
  id: "tb:fetch",
  label: "Fetch",
  icon: CloudDownload,
  group: "git-actions",
  priority: 70,
  shortcut: "mod+shift+F",
  when: () => !!useRepositoryStore.getState().repoStatus,
  execute: () => { /* delegate to command registry or inline */ },
});

register({
  id: "tb:pull",
  label: "Pull",
  icon: ArrowDown,
  group: "git-actions",
  priority: 60,
  shortcut: "mod+shift+L",
  when: () => !!useRepositoryStore.getState().repoStatus,
  execute: () => { /* delegate to command registry */ },
});

register({
  id: "tb:push",
  label: "Push",
  icon: ArrowUp,
  group: "git-actions",
  priority: 50,
  shortcut: "mod+shift+U",
  when: () => !!useRepositoryStore.getState().repoStatus,
  execute: () => { /* delegate to command registry */ },
});

// === Views Group (repo-specific) ===

register({
  id: "tb:repo-browser",
  label: "Browse Repository",
  icon: FolderTree,
  group: "views",
  priority: 40,
  when: () => !!useRepositoryStore.getState().repoStatus,
  execute: () => openBlade("repo-browser", {}),
});

register({
  id: "tb:changelog",
  label: "Changelog",
  icon: FileText,
  group: "views",
  priority: 30,
  when: () => !!useRepositoryStore.getState().repoStatus,
  execute: () => openBlade("changelog", {} as Record<string, never>),
});

register({
  id: "tb:gitflow-guide",
  label: "Gitflow Guide",
  icon: GitBranch,
  group: "views",
  priority: 20,
  when: () => !!useRepositoryStore.getState().repoStatus,
  execute: () => openBlade("gitflow-cheatsheet", {} as Record<string, never>),
});
```

### Toolbar Component with Overflow

```typescript
// src/components/toolbar/Toolbar.tsx
import { useToolbarRegistry, type ToolbarGroup } from "../../lib/toolbarRegistry";
import { useRepositoryStore } from "../../stores/repository";
import { usePreferencesStore } from "../../stores/domain/preferences";
import { ToolbarButton } from "./ToolbarButton";
import { ToolbarOverflowMenu } from "./ToolbarOverflowMenu";
import { useToolbarOverflow } from "./useToolbarOverflow";

const GROUP_ORDER: ToolbarGroup[] = ["navigation", "git-actions", "views", "app"];

export function Toolbar() {
  const actions = useToolbarRegistry((s) => s.actions);
  const hiddenActions = usePreferencesStore((s) => s.settingsData.toolbar?.hiddenActions ?? []);
  // Subscribe to repo status so when() conditions re-evaluate
  const repoStatus = useRepositoryStore((s) => s.repoStatus);

  const { containerRef, visibleCount } = useToolbarOverflow();

  // Filter: when() condition AND user visibility preference
  const grouped = useToolbarRegistry.getState().getGrouped();
  const flatVisible = GROUP_ORDER.flatMap((group) =>
    (grouped[group] ?? []).filter((a) => !hiddenActions.includes(a.id))
  );

  const inline = flatVisible.slice(0, visibleCount);
  const overflowed = flatVisible.slice(visibleCount);

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Main toolbar"
      aria-orientation="horizontal"
      className="flex items-center gap-1"
    >
      {inline.map((action) => (
        <ToolbarButton key={action.id} action={action} />
      ))}
      {overflowed.length > 0 && (
        <ToolbarOverflowMenu actions={overflowed} count={overflowed.length} />
      )}
    </div>
  );
}
```

### ToolbarButton with Accessibility

```typescript
// src/components/toolbar/ToolbarButton.tsx
import type { ToolbarAction } from "../../lib/toolbarRegistry";
import { ShortcutTooltip } from "../ui/ShortcutTooltip";
import { Button } from "../ui/button";

interface ToolbarButtonProps {
  action: ToolbarAction;
}

export function ToolbarButton({ action }: ToolbarButtonProps) {
  const Icon = action.icon;
  const loading = action.isLoading?.() ?? false;

  const button = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => action.execute()}
      disabled={loading}
      aria-label={action.label}
      data-toolbar-item
    >
      <Icon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
    </Button>
  );

  return action.shortcut ? (
    <ShortcutTooltip shortcut={action.shortcut} label={action.label}>
      {button}
    </ShortcutTooltip>
  ) : (
    <ShortcutTooltip shortcut="" label={action.label}>
      {button}
    </ShortcutTooltip>
  );
}
```

### Settings Panel for Toolbar Toggles

```typescript
// src/blades/settings/components/ToolbarSettings.tsx
import { useToolbarRegistry } from "../../../lib/toolbarRegistry";
import { usePreferencesStore } from "../../../stores/domain/preferences";

export function ToolbarSettings() {
  const actions = useToolbarRegistry((s) => s.actions);
  const hiddenActions = usePreferencesStore(
    (s) => s.settingsData.toolbar?.hiddenActions ?? []
  );
  const updateSetting = usePreferencesStore((s) => s.updateSetting);

  const toggleAction = async (actionId: string) => {
    const current = hiddenActions;
    const next = current.includes(actionId)
      ? current.filter((id) => id !== actionId)
      : [...current, actionId];
    await updateSetting("toolbar", "hiddenActions", next);
  };

  return (
    <div>
      <h3>Toolbar Actions</h3>
      {Array.from(actions.values()).map((action) => (
        <label key={action.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!hiddenActions.includes(action.id)}
            onChange={() => toggleAction(action.id)}
          />
          <action.icon className="w-4 h-4" />
          {action.label}
        </label>
      ))}
    </div>
  );
}
```

## Existing Codebase Analysis (Critical for Refactoring)

### Current Header.tsx Inventory

Every button currently in `Header.tsx` must map to a registry action or remain as a structural component:

| Current Element | Destination | Group | TB Req |
|----------------|-------------|-------|--------|
| `<RepoSwitcher>` | Stays in Header (structural) | N/A | N/A |
| `<BranchSwitcher>` | Stays in Header (structural) | N/A | N/A |
| `<ProcessNavigation>` | Stays in Header (structural) | N/A | N/A |
| Settings button | Registry: `tb:settings` | app | TB-01 |
| `<ThemeToggle>` | Registry: `tb:theme-toggle` (special) | app | TB-01 |
| Command Palette button | Registry: `tb:command-palette` | app | TB-01 |
| Undo button | Registry: `tb:undo` | git-actions | TB-05 |
| Refresh button | Registry: `tb:refresh-all` | git-actions | TB-05 |
| `<SyncButtons>` (fetch/pull/push) | Registry: `tb:fetch`, `tb:pull`, `tb:push` | git-actions | TB-05 |
| Gitflow Guide button | Registry: `tb:gitflow-guide` | views | TB-05 |
| Repo Browser button | Registry: `tb:repo-browser` | views | TB-05 |
| Changelog button | Registry: `tb:changelog` | views | TB-05 |
| Close button | Registry: `tb:close-repo` | navigation | TB-05 |
| Reveal button | Registry: `tb:reveal-in-finder` | navigation | TB-05 |
| Clone button | Registry: `tb:clone-repo` | navigation | TB-05 |
| Open button | Registry: `tb:open-repo` | app | TB-01 |

### Relationship to Existing CommandRegistry

The `commandRegistry.ts` already defines actions with `id`, `title`, `icon`, `shortcut`, `action()`, and `enabled()`. The toolbar registry is NOT a replacement -- it is a parallel registry that adds toolbar-specific metadata (`group`, `priority`, `when`). Some actions appear in both registries (command palette entry + toolbar button). The `execute` function can delegate to `executeCommand(id)` from the command registry to avoid duplication.

### Relationship to Existing BladeRegistry

The `bladeRegistry.ts` shows the established pattern: module-level Map, `register()` / `get()` functions, HMR `clear()` support. The toolbar registry follows this exact pattern but uses Zustand for reactivity (unlike bladeRegistry which doesn't need reactivity since blades don't dynamically appear/disappear).

### Stores That Toolbar `when()` Conditions Need

| Store | State | Used By |
|-------|-------|---------|
| `useRepositoryStore` | `repoStatus` (null when no repo) | All repo-specific actions |
| `useUndoStore` | `undoInfo?.canUndo` | Undo button visibility |
| `useBranchStore` | remotes presence | Sync buttons visibility |

## WCAG 2.1 AA Compliance Requirements

### ARIA Toolbar Pattern (MDN + WAI-ARIA 1.2)

The toolbar MUST implement:

1. **`role="toolbar"`** on the containing `<div>`
2. **`aria-label="Main toolbar"`** for screen reader identification
3. **`aria-orientation="horizontal"`** (implicit default, but explicit is clearer)
4. **Roving tabindex:** Only one button has `tabindex="0"` at a time; others get `tabindex="-1"`. Arrow keys move focus.
5. **`aria-label`** on every icon-only button (already done via the `aria-label` prop on `<Button>`)
6. **Focus visible indicators:** Already handled by button variant's `focus-visible:ring-1 focus-visible:ring-ctp-overlay0`
7. **Keyboard navigation:** Left/Right arrows move between toolbar items, Home/End jump to first/last, Tab/Shift+Tab exits toolbar

### ShortcutTooltip Compliance

The existing `ShortcutTooltip` component provides accessible labels. For WCAG compliance:
- The tooltip delay (500ms) meets WCAG 2.1 SC 1.4.13 (Content on Hover or Focus)
- The tooltip does not obscure trigger content
- The tooltip disappears on mouse leave (dismiss requirement)
- Missing: tooltip should also appear on keyboard focus (not just hover) -- this needs to be fixed

## State of the Art

| Old Approach (current) | Current Approach (target) | When Changed | Impact |
|------------------------|---------------------------|--------------|--------|
| Hardcoded JSX buttons in Header | Data-driven registry-rendered toolbar | Phase 32 | Extensible, testable, configurable |
| Component-local business logic | Store-based action logic | Phase 32 | Separation of concerns, testable |
| No overflow handling | ResizeObserver + overflow menu | Phase 32 | Responsive for narrow windows |
| Inconsistent button patterns | Uniform ToolbarButton component | Phase 32 | Visual consistency, WCAG compliance |
| No user toolbar customization | Settings-persisted visibility toggles | Phase 32 | User control |

**Deprecated/outdated:**
- `SyncButtons` component as standalone: Will be decomposed into individual registry actions
- Inline `stashConfirmTarget` state in Header: Moves to BranchSwitcher component

## Open Questions

1. **ThemeToggle is a multi-button component, not a single action**
   - What we know: ThemeToggle renders as a 3-button segmented control (light/dark/system), not a single icon button
   - What's unclear: Should it become 3 separate toolbar actions, stay as a special component, or become a single icon button with a dropdown?
   - Recommendation: Keep ThemeToggle as a special "widget" in the toolbar (not a standard ToolbarAction). Document this as a precedent for future compound toolbar widgets.

2. **Undo button has conditional visibility beyond repo status**
   - What we know: Undo appears only when `undoInfo?.canUndo` is true -- a different condition than simple repo presence
   - What's unclear: Should the `when()` condition handle this, or should the button be always visible (just disabled)?
   - Recommendation: Use `when()` to handle this. The undo button appearing/disappearing is correct UX -- it communicates "there is something to undo."

3. **SyncProgressDisplay positioning after decomposition**
   - What we know: Currently renders inside SyncButtons as a progress indicator
   - What's unclear: Where does the progress display go when sync buttons become individual toolbar actions?
   - Recommendation: Render SyncProgressDisplay as a separate element in the Header, outside the toolbar, similar to how a status bar works. It is not an "action" so it does not belong in the registry.

4. **Extension toolbar action ordering relative to core actions**
   - What we know: Phase 35 will add extension-contributed actions
   - What's unclear: Should extension actions always appear at lower priority than core? Should they get their own group?
   - Recommendation: Extension actions default to lowest priority within their declared group. The `ToolbarGroup` type should be extensible (union type with string fallback) so extensions can declare custom groups in the future.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis**: `src/components/Header.tsx`, `src/lib/commandRegistry.ts`, `src/lib/bladeRegistry.ts`, `src/stores/domain/preferences/`, `src/components/ui/ShortcutTooltip.tsx`, `src/hooks/useKeyboardShortcuts.ts` -- Direct file reads of 15+ source files
- **Context7 /pmndrs/zustand** -- Dynamic scoped stores, Map-based collections, subscribeWithSelector middleware
- **Context7 /websites/tailwindcss** -- Tailwind CSS v4 gap, flex, overflow utilities

### Secondary (MEDIUM confidence)
- [MDN ARIA toolbar role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/toolbar_role) -- Complete ARIA toolbar pattern with roving tabindex, keyboard navigation, labeling requirements
- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points) -- Menu contribution pattern with when clauses, group ordering, and priority system
- [Collapsible Overflow Menu in React](https://dev.to/shubhamreacts/how-to-implement-a-collapsible-overflow-menu-in-react-5cn8) -- IntersectionObserver pattern for overflow detection
- [WCAG 2.1 AA toolbar keyboard requirements](https://www.w3.org/WAI/WCAG21/Techniques/) -- Keyboard accessibility standards

### Tertiary (LOW confidence)
- Web search results for "React toolbar registry pattern" -- General pattern validation, no single authoritative source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; uses only libraries already in the project with verified APIs
- Architecture: HIGH -- Registry pattern directly mirrors existing `bladeRegistry` and `commandRegistry` patterns in the codebase; Zustand store pattern verified with Context7
- Overflow implementation: HIGH -- ResizeObserver API is mature (baseline 2020), well-documented, already polyfilled in test setup
- WCAG compliance: HIGH -- ARIA toolbar role requirements verified with MDN primary source
- Extension compatibility: MEDIUM -- Phase 33 design is forward-looking; the `unregisterBySource()` and namespaced ID patterns follow VS Code's proven contribution point model but haven't been validated against the actual Phase 33 implementation yet
- Pitfalls: HIGH -- Identified from direct analysis of current codebase structure and component coupling

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, no fast-moving dependencies)
