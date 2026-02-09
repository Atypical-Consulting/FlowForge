# Phase 30: Store Consolidation & Tech Debt - UX Research

**Researched:** 2026-02-09
**Domain:** User Experience, Interaction Design, Accessibility
**Focus:** UX implications of store consolidation and tech debt resolution
**Confidence:** HIGH (codebase-verified patterns, established UX heuristics)

## Summary

Phase 30 introduces five UX-visible changes alongside a major architectural refactor (21 stores to ~5). The UX-visible changes are: (1) fixing stale blade content on repository close, (2) adding an empty state illustration for topology with zero commits, (3) surfacing store errors as toasts instead of console-only logging, (4) registering the gitflow cheatsheet in the command palette, and (5) wiring the defaultTab setting to blade initialization.

The store consolidation itself carries UX risk through potential re-render regressions, stale selector data during migration, and possible loss of undo state consistency. Each of these must be validated with specific user-observable tests.

**Primary recommendation:** Treat the five UX-visible changes as thin, independently testable increments. Build the topology empty state component, the toast-surfacing wrappers, and the command palette registration as isolated additions before attempting any store merging. This de-risks the store consolidation by establishing observable baselines first.

## 1. Empty State Design for Topology Graph

### Current State (Codebase Evidence)

The `TopologyPanel` at `/src/blades/topology-graph/components/TopologyPanel.tsx` (lines 92-98) currently renders a minimal empty state:

```tsx
if (nodes.length === 0) {
  return (
    <div className="flex items-center justify-center h-full bg-ctp-mantle text-ctp-overlay0">
      <p>No commits to display</p>
    </div>
  );
}
```

This is a **bare text placeholder** -- no illustration, no CTA, no guidance. The existing `BladeContentEmpty` component at `/src/blades/_shared/BladeContentEmpty.tsx` provides a slightly better pattern (icon + message + detail) but still lacks an illustration or actionable next steps.

### Recommended Design

**Confidence: HIGH** (based on GitLab Pajamas Design System patterns and Nielsen Norman Group guidelines)

The empty state for a repository with zero commits should answer: "Why is this empty, and what should I do?"

#### Structure (following GitLab Pajamas pattern)

1. **Illustration** -- A simple inline SVG of a bare branch/tree (no leaves), using Catppuccin palette colors (`ctp-overlay0` for outlines, `ctp-surface1` for fills). Keep it to ~120x120px. Do NOT use an external illustration library -- hand-craft a minimal SVG that fits the Catppuccin aesthetic.
2. **Title** -- "No commits yet" (short, under 5 words, no period)
3. **Description** -- "This repository has no commits. Create your first commit to see the topology graph." (one sentence explaining the state, one sentence suggesting action)
4. **CTA Button** -- "Go to Changes" button that navigates to the staging-changes process. Use the existing `SWITCH_PROCESS` event from the XState navigation machine.

#### Implementation Pattern

Build a dedicated `TopologyEmptyState` component within `/src/blades/topology-graph/components/`. Do NOT extend `BladeContentEmpty` -- the topology empty state needs an SVG illustration that `BladeContentEmpty` does not support.

```tsx
// Recommended component structure
function TopologyEmptyState({ onGoToChanges }: { onGoToChanges: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-ctp-mantle gap-4 px-6">
      {/* Inline SVG illustration: bare branch */}
      <EmptyBranchIllustration className="w-28 h-28 text-ctp-overlay0" />
      <div className="text-center space-y-1">
        <h3 className="text-sm font-medium text-ctp-subtext1">No commits yet</h3>
        <p className="text-xs text-ctp-overlay0 max-w-xs">
          This repository has no commits. Create your first commit to see the topology graph.
        </p>
      </div>
      <button
        onClick={onGoToChanges}
        className="px-4 py-2 text-sm font-medium bg-ctp-blue text-ctp-base rounded-md hover:bg-ctp-blue/90 transition-colors"
      >
        Go to Changes
      </button>
    </div>
  );
}
```

#### SVG Illustration Guidance

- Use `currentColor` so the illustration inherits the Catppuccin text color
- Depict a simple branching tree with no nodes (empty circles at branch tips)
- Keep stroke widths at 1.5-2px for visual consistency with Lucide icons
- Total SVG complexity: under 20 paths (keeps bundle small)
- Respect `motion-safe:` -- no animated SVG in the empty state (user might have reduced motion preference)

#### Accessibility

- The illustration must have `aria-hidden="true"` (decorative)
- The heading uses semantic `h3` (nested inside the blade which has its own heading hierarchy)
- The CTA button must be keyboard-focusable with visible focus ring (Tailwind's `focus-visible:ring-2 focus-visible:ring-ctp-blue`)

### Anti-Patterns to Avoid

- **No "humoristic" empty states.** This is a developer tool, not a consumer app. Keep it professional and actionable.
- **No external illustration libraries.** Adding a dependency for one SVG is not justified.
- **No loading state disguised as empty state.** The `isLoading && nodes.length === 0` branch already shows a spinner; the empty state should only appear when loading is complete AND the result is zero commits.

## 2. Toast Notification Architecture

### Current State (Codebase Evidence)

The app already has a fully functional toast system:

- **Store:** `/src/stores/toast.ts` -- Zustand store with `addToast`, `removeToast`, `clearAll`
- **Component:** `/src/components/ui/Toast.tsx` -- framer-motion animated toast with spring physics
- **Container:** `/src/components/ui/ToastContainer.tsx` -- positioned `fixed bottom-4 right-4`, shows max 3 toasts, auto-dismiss via timeout
- **Convenience API:** `toast.success()`, `toast.error()`, `toast.info()`, `toast.warning()` functions

The existing implementation is solid. The issue is that **store errors are logged to `console.error` instead of using `toast.error()`**.

### Errors to Surface (Codebase Evidence)

Grep of `console.error` in `/src/stores/` reveals **25+ error paths** that currently log to console only. Key ones to surface:

| Store | Error | Current Behavior | Recommended Toast |
|-------|-------|-----------------|-------------------|
| `settings.ts` | Failed to update setting | `console.error` | `toast.error("Failed to save setting")` |
| `settings.ts` | Failed to initialize settings | `console.error` | `toast.warning("Settings could not be loaded. Using defaults.")` |
| `reviewChecklist.ts` | Failed to persist checklist | `console.error` | `toast.error("Failed to save checklist changes")` |
| `repository.ts` | Failed to refresh status | `console.error` | `toast.warning("Could not refresh repository status")` |
| `repository.ts` | Failed to close repository | `console.error` | `toast.error("Failed to close repository")` |
| `undo.ts` | Failed to load undo info | `console.error` | Silent (non-critical) |
| `undo.ts` | Failed to undo | `console.error` | `toast.error("Undo operation failed")` |
| `branchMetadata.ts` | Multiple persistence errors | `console.error` | Silent (background persistence, non-critical) |
| `navigation.ts` | Multiple persistence errors | `console.error` | Silent (background persistence, non-critical) |
| `theme.ts` | Failed to set theme | `console.error` | `toast.warning("Theme change failed")` |
| `conventional.ts` | Multiple fetch errors | `console.error` | `toast.warning(...)` in UI layer, not store |

### Surfacing Strategy

**Confidence: HIGH** (the toast system already exists and works)

**Do NOT surface every `console.error` as a toast.** Apply this decision tree:

1. **User-initiated action failed?** -> `toast.error()` (e.g., "Failed to save setting" after user clicked Save)
2. **Background operation degraded?** -> `toast.warning()` (e.g., settings failed to load, using defaults)
3. **Background persistence/sync failed?** -> Keep as `console.error` only (e.g., pinned repos failed to persist -- user will not notice immediately)
4. **Initialization failed with fallback?** -> `toast.warning()` once, do not repeat

### Accessibility Requirements for Toasts

**Confidence: HIGH** (WCAG 2.1 AA requirements, verified against Sara Soueidan's ARIA live region guidance)

The current `ToastContainer` is missing a critical accessibility feature: **an `aria-live` region**.

#### Required Changes

1. **Add `role="status"` and `aria-live="polite"` to the ToastContainer wrapper.** The current `<div className="fixed bottom-4 right-4...">` needs these attributes so screen readers announce new toasts.

2. **Error toasts should use `role="alert"` instead of `role="status"`.** Errors are urgent and should interrupt the screen reader. Add this to the individual `Toast` component based on `toast.type`:
   ```tsx
   <motion.div
     role={toast.type === "error" ? "alert" : "status"}
     aria-live={toast.type === "error" ? "assertive" : "polite"}
     // ...existing props
   >
   ```

3. **Error and warning toasts must NOT auto-dismiss.** The current implementation already does this correctly (`DEFAULT_DURATIONS` has `error: undefined, warning: undefined`). Verify this is preserved during consolidation.

4. **Toast dismiss button needs better labeling.** Current: `aria-label="Dismiss notification"`. Improve to include the toast type: `aria-label={`Dismiss ${toast.type} notification`}`.

5. **Action buttons within toasts must be reachable by Tab key before the toast disappears.** Since error/warning toasts have no duration, this is already satisfied. For success/info toasts (5s duration), ensure the action button is focusable. The current implementation handles this correctly.

### Toast Stacking and Positioning

The current implementation limits visible toasts to 3 (`visibleToasts = toasts.slice(-3)`). This is good UX -- more than 3 stacked toasts become unreadable. Keep this limit.

**Position:** `fixed bottom-4 right-4` is correct for a desktop app with a left sidebar. It avoids overlapping the sidebar content and the commit form at the bottom-left.

### No New Libraries Needed

The existing toast implementation uses framer-motion `AnimatePresence` with spring physics and is well-integrated with Catppuccin colors. Do NOT introduce a third-party toast library (sonner, react-hot-toast, etc.) -- the custom implementation is already feature-complete and themed.

## 3. Repository Context Switch UX (Stale Blade Fix)

### Current Bug (Codebase Evidence)

When `closeRepository()` is called (via the "Close" button or the `close-repository` command), it does:

```typescript
// /src/stores/repository.ts, line 58-65
closeRepository: async () => {
  try {
    await commands.closeRepository();
  } catch (e) {
    console.error("Failed to close repository:", e);
  }
  set({ status: null, error: null });
},
```

It sets `status: null` but does **NOT** call `resetStack()` on the navigation FSM. The blade stack retains blades from the previous repository (commit details, diffs, etc.), showing stale content.

Compare with the repo-switch flow in `Header.tsx` (line 132), which correctly calls:
```typescript
getNavigationActor().send({ type: "RESET_STACK" });
```

### Recommended Fix UX

**Confidence: HIGH** (the fix is straightforward and matches existing patterns)

1. **When `closeRepository()` is called, send `RESET_STACK` to the navigation FSM.** This is the same pattern used for repo switching.

2. **Transition feel:** The existing `bladeTransitionConfig.reset` (0.25s ease-out with scale 0.95 fade) is appropriate for a context switch. It signals "everything is changing" without being jarring.

3. **No loading state needed between close and welcome.** When `status` becomes `null`, `App.tsx` (line 79) immediately renders `<WelcomeView />` instead of `<RepositoryView />`. The transition is already handled by React's conditional rendering.

4. **Order matters:** Reset the blade stack BEFORE setting `status: null`. If the blade stack is reset after the view switches to WelcomeView, the user might see a flash of stale content. The correct sequence is:
   - Send `RESET_STACK` to navigation FSM
   - Call `commands.closeRepository()` on the backend
   - Set `status: null` in the repository store

5. **Dirty blade guard:** The XState navigation machine already handles `RESET_STACK` with dirty blade detection. If the user has unsaved changes in a blade (e.g., conventional commit form), the `confirmingDiscard` state will activate, showing the `NavigationGuardDialog`. This is the correct UX -- do not bypass it.

### What Other Git GUIs Do

**Confidence: MEDIUM** (based on general knowledge of GitKraken, Sourcetree, VS Code)

- **VS Code:** Closing a folder/workspace immediately clears the editor area. No animation. Explorer shows "No Folder Opened" with a CTA.
- **GitKraken:** Switching repos shows a brief loading spinner over the graph area, then replaces content.
- **Sourcetree:** Immediate tab switch; each repo is a separate tab, so there is no "close" transition -- just tab removal.

The FlowForge approach (fade-scale transition via `bladeTransitionConfig.reset`) is more polished than any of these. Preserve it.

## 4. Command Palette: Gitflow Cheatsheet Registration

### Current State (Codebase Evidence)

The command palette (`/src/components/command-palette/CommandPalette.tsx`) is well-implemented with:
- Fuzzy search via `searchCommands()`
- Category grouping when no query is entered
- Keyboard navigation (Arrow keys, Enter, Escape)
- ARIA combobox pattern with `aria-activedescendant`
- Screen reader live region for result count

Current categories: `Navigation`, `Repository`, `Sync`, `Branches`, `Stash`, `Tags`, `Worktrees`, `Settings`

The gitflow cheatsheet blade exists (`/src/blades/gitflow-cheatsheet/`) and is already accessible via a header button (GitBranch icon). It is **NOT** registered as a command in any file under `/src/commands/`.

### Recommended Registration

**Confidence: HIGH** (follows exact pattern of existing commands)

Add to `/src/commands/navigation.ts` (or create a new `/src/commands/reference.ts`):

```typescript
import { GitBranch } from "lucide-react";
import { registerCommand } from "../lib/commandRegistry";
import { openBlade } from "../lib/bladeOpener";
import { useRepositoryStore } from "../stores/repository";

registerCommand({
  id: "open-gitflow-cheatsheet",
  title: "Gitflow Cheatsheet",
  description: "Open the Gitflow workflow guide",
  category: "Navigation",  // See category discussion below
  icon: GitBranch,
  keywords: ["gitflow", "workflow", "guide", "cheatsheet", "branching", "reference"],
  action: () => {
    openBlade("gitflow-cheatsheet", {} as Record<string, never>);
  },
  enabled: () => !!useRepositoryStore.getState().status,
});
```

### Category Decision: "Navigation" vs. New Category

**Recommendation: Use "Navigation" category.** Here is the reasoning:

- Adding a new "Reference" or "Help" category for a single command creates visual clutter in the palette's category grouping.
- VS Code places "Help: " prefixed commands in the "Help" category, but they have dozens of help commands. FlowForge currently has one reference item.
- If more reference content is added later (e.g., keyboard shortcuts reference, Git cheatsheet), a "Reference" category could be justified. For now, "Navigation" is the correct home since the command navigates to a blade.

### Discoverability Enhancement

Add `keywords` to the command registration (shown above). This allows users to find the cheatsheet by typing "workflow", "guide", "branching", or "reference" -- not just "gitflow" or "cheatsheet". The existing `searchCommands()` function already supports fuzzy matching against the `title`, `description`, and presumably `keywords` if present in the `Command` interface.

**Note:** The `Command` interface in `/src/lib/commandRegistry.ts` already includes `keywords?: string[]` (line 23). This field is available for use.

## 5. DefaultTab Preference UX

### Current State (Codebase Evidence)

- **Settings store** (`/src/stores/settings.ts`): Has `defaultTab: "changes" | "history" | "topology"` with default value `"changes"`
- **Settings UI** (`/src/blades/settings/components/GeneralSettings.tsx`): Three toggle buttons for Changes, History, Topology
- **Blade store** (`/src/stores/blades.ts`): `rootBladeForProcess()` function hardcodes `staging` as default process
- **Navigation machine** (`/src/machines/navigation/navigationMachine.ts`): Initial context hardcodes `activeProcess: "staging"`

The setting exists in the UI and persists to disk, but it is **NOT read during blade initialization**. The navigation machine always starts with `staging` regardless of the `defaultTab` preference.

### Recommended Wiring

**Confidence: HIGH** (straightforward state initialization)

The `defaultTab` values map to processes as follows:
- `"changes"` -> `activeProcess: "staging"` (current default)
- `"history"` -> This is a sub-view within the topology blade, NOT a separate process
- `"topology"` -> `activeProcess: "topology"`

#### Implementation approach

1. **On app startup** (in `App.tsx` `useEffect`), after `initSettings()` completes, read `settings.general.defaultTab` and send a `SWITCH_PROCESS` event to the navigation actor if the defaultTab is not "changes".

2. **On repository open**, if the blade stack is at its root, check defaultTab and apply. Do NOT re-apply defaultTab on every navigation -- only on initial load and repo open.

3. **The "history" option is special.** It maps to the topology process with the TopologyRootBlade's internal `view` state set to "history". Since `TopologyRootBlade` uses `useState<TopologyView>("graph")` for the sub-view, the defaultTab preference for "history" would need the TopologyRootBlade to read from settings. Alternatively, simplify the setting to just "changes" | "topology" (removing "history" as an option) since "history" is a sub-view within topology, not a top-level process.

**Recommendation:** Keep all three options but document that "history" opens the topology process with the history sub-tab selected. Pass a `defaultView` prop or use a settings read inside `TopologyRootBlade` to determine initial sub-view.

### Settings UI Behavior

The current GeneralSettings component (toggle buttons) is well-designed. No changes needed to the settings UI itself. The only gap is the initialization wiring.

#### First Open Behavior

When a user has never set a defaultTab preference:
- The default is `"changes"` (staging process)
- This matches the current behavior, so existing users see no change
- The setting is stored in `flowforge-settings.json` via Tauri's plugin-store

## 6. Store Consolidation UX Impact Analysis

### Current Store Inventory (Codebase Evidence)

21 Zustand stores in `/src/stores/`:
`blades`, `bladeTypes`, `branches`, `branchMetadata`, `clone`, `commandPalette`, `conventional`, `gitflow`, `navigation`, `repository`, `reviewChecklist`, `settings`, `stash`, `staging`, `tags`, `theme`, `toast`, `topology`, `undo`, `worktrees` + `/src/lib/store.ts` (Tauri persistent store) + `/src/blades/init-repo/store.ts` + `/src/blades/changelog/store.ts`

### Likely Domain Groupings (5 consolidated stores)

Based on the codebase patterns, the likely consolidation would be:

| Domain Store | Merging | UX Risk |
|-------------|---------|---------|
| `gitStore` | repository + branches + branchMetadata + stash + tags + worktrees | HIGH -- multiple sidebar sections subscribe to separate stores |
| `uiStore` | theme + toast + commandPalette + settings | MEDIUM -- theme/toast are hot paths |
| `workflowStore` | gitflow + conventional + reviewChecklist | LOW -- rarely active simultaneously |
| `navigationStore` | blades + navigation + topology | HIGH -- blade transitions are performance-critical |
| `undoStore` | undo (likely stays separate or merges into gitStore) | LOW |

### UX Risks and Mitigations

#### Risk 1: Unnecessary Re-renders from Broader Store Subscriptions

**What goes wrong:** When 6 stores merge into 1, a component that previously subscribed to only `useBranchStore((s) => s.branches)` now subscribes to a slice of the mega-store. If the selector is not carefully scoped, updating tags could re-render the branch list.

**How to detect:** Visual jank (layout shifts), slower interaction response, React DevTools Profiler showing unexpected renders.

**How to avoid:** Use **granular selectors** with Zustand's `useShallow` or custom equality functions. Every existing `useXStore((s) => s.field)` pattern must be preserved with equivalent scoping in the consolidated store.

**Specific test:** Open a repo with 100+ branches, rapidly create/delete tags, and verify the branch list does NOT re-render (use React DevTools highlight updates).

#### Risk 2: Stale Data During Async Hydration

**What goes wrong:** Several stores use async initialization (`initSettings`, `initTheme`, `initNavigation`, `initMetadata`, `initChecklist`). If these are merged into fewer stores, the initialization order and timing may change, causing brief flashes of default values.

**How to detect:** On app launch, observe whether the theme flashes (light -> dark or vice versa), whether the default tab momentarily shows "changes" before switching, or whether pinned repos appear briefly then disappear.

**How to avoid:** Maintain the same initialization order. Initialize each domain slice independently within the consolidated store. Do NOT make initialization dependent on other slices being ready.

#### Risk 3: Loss of DevTools Naming

**What goes wrong:** The current `blades` store uses `devtools({ name: "blade-store" })`. When merging, the DevTools name changes, making it harder for developers to debug state issues. This is a DX concern, not a direct UX concern, but it affects the team's ability to diagnose UX bugs.

**How to avoid:** Use Zustand's `devtools` middleware with descriptive names on each consolidated store.

#### Risk 4: Undo State Inconsistency

**What goes wrong:** The `undoStore` tracks the last undoable operation. If merged into `gitStore`, an undo operation that triggers a re-render of the entire git domain could cause flickering in the sidebar while the undo is being applied.

**How to avoid:** Keep undo state isolated (either as a separate store or as a clearly separated slice). Undo operations should optimistically update only the undo-related state and let react-query handle the data refresh.

#### Risk 5: Blade Transition Performance

**What goes wrong:** The blade navigation uses XState (not Zustand) for its FSM, but the blade stack data flows through `useSelector`. If the topology, navigation, and blade stores merge, selecting `bladeStack` could trigger on topology data changes, causing micro-stutter during blade transitions.

**How to avoid:** XState-driven navigation state should remain in the XState machine. Do NOT merge XState-managed state into a Zustand store. Only merge the Zustand-only stores.

### Recommended UX Validation Checklist

After store consolidation, verify these user-observable behaviors:

- [ ] Opening a repo shows the correct defaultTab without flash
- [ ] Switching repos resets the blade stack cleanly (no stale blades)
- [ ] Closing a repo shows WelcomeView with no intermediate flash
- [ ] Theme toggle takes effect instantly (no flash of opposite theme)
- [ ] Toast notifications appear and animate correctly
- [ ] Command palette opens and searches without delay
- [ ] Sidebar sections (branches, stashes, tags) update independently
- [ ] Topology graph loads without spinner staying visible too long
- [ ] Undo button appears/disappears correctly based on undo state
- [ ] Blade transitions (push, pop, replace, reset) animate smoothly
- [ ] Settings changes persist across app restart
- [ ] No duplicate toasts when errors occur in rapid succession

## Common Pitfalls

### Pitfall 1: Toasting Initialization Errors Before ToastContainer Mounts
**What goes wrong:** If a store's `init*()` method calls `toast.error()` before `<ToastContainer />` is mounted in the React tree, the toast is added to the store but never rendered. When the container mounts, it sees an existing toast but the timer has already started from the store's `createdAt`.
**How to avoid:** Initialization errors should use `toast.warning()` (which has no auto-dismiss) or queue them for display after mount. The simplest approach: init methods run in `useEffect` (after mount), so the ToastContainer is already mounted. Verify this timing.

### Pitfall 2: Resetting Blade Stack After Dirty Check
**What goes wrong:** If `closeRepository()` sends `RESET_STACK` and the XState machine enters `confirmingDiscard` (because a blade has dirty state), but then `status` is set to `null`, the app switches to WelcomeView while the discard dialog is still pending.
**How to avoid:** Make `closeRepository()` await the `RESET_STACK` completion before setting `status: null`. The XState machine's `confirmingDiscard` state must be resolved first.

### Pitfall 3: Empty State Shown During Graph Load
**What goes wrong:** When topology loads, there is a brief moment where `isLoading: false` and `nodes.length === 0` (before the API call starts). This could flash the empty state illustration.
**How to avoid:** The empty state should only show when `!isLoading && nodes.length === 0 && lastRefreshTimestamp > 0`. The `lastRefreshTimestamp` being 0 means the graph has never been loaded -- show the loading spinner instead.

### Pitfall 4: Command Palette Shows Gitflow Cheatsheet When No Repo Is Open
**What goes wrong:** The gitflow cheatsheet requires a repository context. If registered without an `enabled` guard, it shows in the palette even when no repo is open.
**How to avoid:** Include `enabled: () => !!useRepositoryStore.getState().status` in the command registration (as shown in the recommended code above).

## Architecture Patterns

### Pattern 1: Store Error Surfacing Wrapper
**What:** A utility function that wraps async store operations to surface errors as toasts while preserving the console.error for debugging.
**When to use:** For any store action that performs I/O (Tauri commands, persistent storage).

```typescript
// /src/lib/storeErrors.ts
import { toast } from "../stores/toast";

export async function withToast<T>(
  operation: () => Promise<T>,
  options: {
    errorMessage: string;
    successMessage?: string;
    silent?: boolean; // keep as console.error only
  }
): Promise<T | undefined> {
  try {
    const result = await operation();
    if (options.successMessage) {
      toast.success(options.successMessage);
    }
    return result;
  } catch (e) {
    console.error(options.errorMessage, e);
    if (!options.silent) {
      toast.error(options.errorMessage);
    }
    return undefined;
  }
}
```

### Pattern 2: Conditional Empty State Guard
**What:** A guard condition that distinguishes "never loaded" from "loaded but empty".
**When to use:** Any data-fetching component that needs an empty state.

```typescript
// Pattern: use lastRefreshTimestamp or a hasLoaded flag
const showEmptyState = !isLoading && nodes.length === 0 && lastRefreshTimestamp > 0;
const showInitialLoader = isLoading && nodes.length === 0;
```

### Pattern 3: DefaultTab Initialization Via Navigation Actor
**What:** Read the defaultTab setting during app initialization and configure the navigation FSM accordingly.
**When to use:** On app startup, after settings have been loaded from persistent storage.

```typescript
// In App.tsx, after initSettings():
const settings = useSettingsStore.getState().settings;
const actor = getNavigationActor();
if (settings.general.defaultTab === "topology") {
  actor.send({ type: "SWITCH_PROCESS", process: "topology" });
}
// "history" case: switch to topology and let TopologyRootBlade read the setting
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | New toast library | Existing `/src/stores/toast.ts` + `/src/components/ui/Toast.tsx` | Already feature-complete, themed, animated |
| Empty state illustrations | Complex SVG illustration library | Hand-crafted inline SVG with Catppuccin colors | One illustration; no library justified |
| ARIA live regions | Custom announcement system | Native `role="status"` / `role="alert"` attributes | Browser + screen reader support is mature |
| Command palette search | New search/fuzzy library | Existing `searchCommands()` in `/src/lib/fuzzySearch` | Already handles ranking and highlights |

## Code Examples

### Empty State Component (Topology)

```tsx
// /src/blades/topology-graph/components/TopologyEmptyState.tsx
import { GitCommitHorizontal } from "lucide-react";
import { getNavigationActor } from "../../../machines/navigation/context";

export function TopologyEmptyState() {
  const handleGoToChanges = () => {
    getNavigationActor().send({ type: "SWITCH_PROCESS", process: "staging" });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-ctp-mantle gap-5 px-6">
      {/* Inline SVG: empty branch tree */}
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        className="text-ctp-overlay0"
        aria-hidden="true"
      >
        {/* Trunk */}
        <line x1="60" y1="100" x2="60" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Left branch */}
        <line x1="60" y1="60" x2="35" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Right branch */}
        <line x1="60" y1="50" x2="85" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Empty circles at tips */}
        <circle cx="60" cy="35" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="35" cy="30" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="85" cy="25" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
      <div className="text-center space-y-1.5">
        <h3 className="text-sm font-medium text-ctp-subtext1">No commits yet</h3>
        <p className="text-xs text-ctp-overlay0 max-w-xs">
          This repository has no commits. Create your first commit to see the topology graph.
        </p>
      </div>
      <button
        type="button"
        onClick={handleGoToChanges}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-ctp-blue text-ctp-base rounded-md hover:bg-ctp-blue/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-offset-2 focus-visible:ring-offset-ctp-mantle"
      >
        <GitCommitHorizontal className="w-4 h-4" />
        Go to Changes
      </button>
    </div>
  );
}
```

### Toast ARIA Enhancement

```tsx
// Enhancement to /src/components/ui/ToastContainer.tsx
<div
  className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2"
  role="region"
  aria-label="Notifications"
>
  <AnimatePresence mode="popLayout">
    {visibleToasts.map((toast) => (
      <Toast
        key={toast.id}
        toast={toast}
        onDismiss={() => handleDismiss(toast.id)}
      />
    ))}
  </AnimatePresence>
</div>

// Enhancement to /src/components/ui/Toast.tsx
<motion.div
  layout
  role={toast.type === "error" ? "alert" : "status"}
  aria-live={toast.type === "error" ? "assertive" : "polite"}
  // ...rest of props
>
```

### Close Repository With Stack Reset

```typescript
// Enhanced closeRepository in /src/stores/repository.ts
closeRepository: async () => {
  // 1. Reset blade stack first (respects dirty blade guard)
  const actor = getNavigationActor();
  actor.send({ type: "RESET_STACK" });

  // 2. Close the backend repository
  try {
    await commands.closeRepository();
  } catch (e) {
    console.error("Failed to close repository:", e);
  }

  // 3. Clear repository state (switches to WelcomeView)
  set({ status: null, error: null });
},
```

### Command Registration for Gitflow Cheatsheet

```typescript
// Add to /src/commands/navigation.ts or new /src/commands/reference.ts
import { GitBranch } from "lucide-react";
import { registerCommand } from "../lib/commandRegistry";
import { openBlade } from "../lib/bladeOpener";
import { useRepositoryStore } from "../stores/repository";

registerCommand({
  id: "open-gitflow-cheatsheet",
  title: "Gitflow Cheatsheet",
  description: "Open the Gitflow workflow guide and branching reference",
  category: "Navigation",
  icon: GitBranch,
  keywords: ["gitflow", "workflow", "guide", "branching", "reference", "model"],
  action: () => {
    openBlade("gitflow-cheatsheet", {} as Record<string, never>);
  },
  enabled: () => !!useRepositoryStore.getState().status,
});
```

## Open Questions

1. **Should "history" remain as a defaultTab option?**
   - What we know: "history" is a sub-view within the topology blade, not a separate process
   - What's unclear: Whether the settings model should expose sub-view defaults
   - Recommendation: Keep it for now, but implement by switching to topology process and passing a hint to TopologyRootBlade via a Zustand slice or URL-like state

2. **How many console.error paths should become toasts?**
   - What we know: There are 25+ error paths; not all are user-actionable
   - What's unclear: The exact threshold between "notify user" and "log silently"
   - Recommendation: Start with the table in Section 2 (approximately 7 toasts), gather user feedback, add more later

3. **Should the empty state illustration be a reusable component?**
   - What we know: Currently only topology needs an empty state illustration
   - What's unclear: Whether other blades will need custom empty states in the future
   - Recommendation: Build it as a standalone component in the topology blade directory. If a second use case appears, extract to `_shared`

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `/src/stores/toast.ts`, `/src/components/ui/Toast.tsx`, `/src/components/ui/ToastContainer.tsx` -- existing toast architecture
- Codebase analysis: `/src/stores/blades.ts`, `/src/machines/navigation/navigationMachine.ts` -- blade stack and reset mechanics
- Codebase analysis: `/src/stores/repository.ts` -- closeRepository missing resetStack call
- Codebase analysis: `/src/lib/commandRegistry.ts`, `/src/commands/*.ts` -- command registration patterns
- Codebase analysis: `/src/stores/settings.ts`, `/src/blades/settings/components/GeneralSettings.tsx` -- defaultTab setting

### Secondary (MEDIUM confidence)
- [GitLab Pajamas Design System - Empty States](https://design.gitlab.com/patterns/empty-states/) -- empty state structure, copy guidelines, CTA patterns
- [Sara Soueidan - Accessible notifications with ARIA Live Regions](https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/) -- ARIA live region best practices
- [Destiner - Designing a Command Palette](https://destiner.io/blog/post/designing-a-command-palette/) -- command palette categorization and discoverability
- [Adrian Roselli - Defining Toast Messages](https://adrianroselli.com/2020/01/defining-toast-messages.html) -- toast accessibility requirements
- [Sheri Byrne-Haber - Designing Toast Messages for Accessibility](https://sheribyrnehaber.medium.com/designing-toast-messages-for-accessibility-fb610ac364be) -- WCAG compliance for toasts

### Tertiary (LOW confidence)
- [Zustand GitHub Discussion #1394 - Avoiding stale state](https://github.com/pmndrs/zustand/discussions/1394) -- selector optimization for consolidated stores

## Metadata

**Confidence breakdown:**
- Empty state design: HIGH -- codebase patterns clear, design system guidance available
- Toast architecture: HIGH -- existing implementation well-understood, WCAG requirements established
- Context switch UX: HIGH -- bug is straightforward, fix matches existing patterns
- Command palette: HIGH -- exact registration pattern exists in multiple commands
- DefaultTab wiring: HIGH -- gap is clear, implementation straightforward
- Store consolidation UX risk: MEDIUM -- risks are theoretical until consolidation is attempted

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable domain, 30-day validity)
