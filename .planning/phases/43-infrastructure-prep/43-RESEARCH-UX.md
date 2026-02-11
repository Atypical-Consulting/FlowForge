# Phase 43: Infrastructure Prep - UX Research

**Researched:** 2026-02-11
**Domain:** UX patterns for reactive registry migration and extension-aware infrastructure
**Confidence:** HIGH
**Perspective:** UX Specialist

## Summary

Phase 43 migrates the `commandRegistry` and `previewRegistry` from plain `Map`-based modules to reactive Zustand stores, then wires infrastructure hooks for extension-aware process navigation and WelcomeView rendering. From a UX perspective, this migration is **invisible when done right** and **catastrophic when done wrong**. The user should never notice the plumbing change; what they WILL notice is whether commands appear instantly when extensions toggle, whether "ghost" UI elements linger after disabling an extension, and whether the welcome experience degrades when rendered from a registry lookup instead of a hardcoded import.

The codebase already has a strong precedent: `bladeRegistry`, `toolbarRegistry`, `sidebarPanelRegistry`, `contextMenuRegistry`, and `statusBarRegistry` are ALL already Zustand stores with `source`-based cleanup, `unregisterBySource()`, and backward-compatible function exports. The `commandRegistry` and `previewRegistry` are the last two holdouts. The UX risk is NOT "how do we make this reactive" -- that pattern is proven. The risk is in the **transition seams**: what happens to the CommandPalette when its data source changes from a static snapshot to a live subscription, what the user sees when a topology tab disappears, and how WelcomeView gracefully handles a missing blade registration.

**Primary recommendation:** Follow the exact same Zustand store + backward-compatible function export pattern used by `bladeRegistry.ts`, subscribe CommandPalette to the store via a hook (not `useMemo` + `getEnabledCommands()`), and implement defensive fallback rendering in both ProcessNavigation and WelcomeView so the UI never shows broken states, even when registrations are temporarily absent.

## Architecture Patterns

### Current State Analysis

#### CommandPalette Reactivity Problem (Critical UX Gap)

The current `CommandPalette.tsx` (line 24) uses:
```typescript
const enabledCommands = useMemo(() => getEnabledCommands(), [isOpen]);
```

This means the command list is computed **once when the palette opens** and never updates while open. If an extension registers new commands (or is toggled) while the palette is open, the user sees stale data. If the palette is closed and reopened, the user sees updated data -- but only because `isOpen` changed, triggering a recalculation from the static `Map`.

**Current behavior:** Commands are "eventually consistent" -- you see the right commands, but only after closing and reopening the palette.

**Target behavior (INFRA-03):** Commands appear/disappear **in real time** while the palette is open, the moment an extension registers or unregisters them.

#### ProcessNavigation Tab Hardcoding (UX Inflexibility)

The current `ProcessNavigation.tsx` hardcodes:
```typescript
const PROCESSES = [
  { id: "staging" as ProcessType, label: "Staging", icon: Files },
  { id: "topology" as ProcessType, label: "Topology", icon: Network },
] as const;
```

There is no conditional logic. The Topology tab always shows, even if the topology-graph blade is not registered. When Phase 43 introduces extension-aware visibility (INFRA-04), the tab must **conditionally hide** without leaving a visual gap, an awkward single-tab state, or a jarring layout shift.

#### WelcomeView Hardcoded Import (Extensibility Limitation)

`WelcomeView.tsx` (line 11) directly imports:
```typescript
import { InitRepoBlade } from "../blades/init-repo";
```

This creates a hard dependency between the welcome experience and a specific blade implementation. Phase 43 (INFRA-05) replaces this with a `BladeRegistry` lookup, which means the `InitRepoBlade` must be registered before the WelcomeView renders, or the user sees a broken/empty initialization experience.

#### CC Store Ghost State (Re-enable Contamination)

The `useConventionalStore` (in `stores/conventional.ts`) is a `createBladeStore` with a `reset()` method, but nothing calls `reset()` when the Conventional Commits extension is disabled. If a user:
1. Opens the conventional commit form, fills in "feat" type and "auth" scope
2. Disables the CC extension
3. Re-enables the CC extension
4. Opens the form again

They will see the stale "feat" / "auth" values from step 1 -- a confusing "ghost" state.

### Pattern 1: Reactive Command Registry (Proven Pattern)

**What:** Migrate `commandRegistry` from plain `Map` to Zustand store, following the exact pattern of `bladeRegistry.ts`.

**When to use:** This is the ONLY approach. The bladeRegistry already proved it works.

**UX implications:**
- CommandPalette subscribes to the store via `useCommandRegistry(state => state.commands)` instead of `useMemo(() => getEnabledCommands(), [isOpen])`
- Commands appear/disappear in real time without needing to close/reopen the palette
- The `getEnabledCommands()` function export remains for non-React consumers (backward compatibility)
- Category ordering (`getOrderedCategories()`) must also be reactive -- a new extension category should appear the moment it's registered

**Established pattern from `bladeRegistry.ts`:**
```typescript
// Store with Map<string, T> state + mutators
export const useCommandRegistry = create<CommandRegistryState>()(
  devtools((set, get) => ({
    commands: new Map<string, Command>(),
    register: (cmd) => { /* immutable Map update */ },
    unregister: (id) => { /* immutable Map delete */ },
    unregisterBySource: (source) => { /* bulk cleanup */ },
  }))
);

// Backward-compatible function exports
export function registerCommand(cmd: Command): void {
  useCommandRegistry.getState().register(cmd);
}
```

**Critical UX detail:** When a command is unregistered while the palette is open:
- The command list must shrink smoothly (no layout jumps)
- The selected index must clamp to the new list length (prevent out-of-bounds selection)
- If the selected command was removed, selection should move to the nearest valid item
- The `aria-live="polite"` region must announce the updated count

### Pattern 2: Reactive Preview Registry

**What:** Migrate `previewRegistry` from plain array to Zustand store with `source`-based cleanup.

**UX implications:**
- Preview handlers are resolved when a diff is viewed, not on a live subscription
- The reactivity matters for **cleanup correctness**, not for real-time UI updates
- When content-viewers extension is disabled, its preview handlers must be removed so the diff view falls back to inline-diff mode (not a broken custom component)
- The priority-sorted array must be maintained via Zustand state, not a module-level `sort()` call

**Graceful degradation:** If a preview handler is removed while a file is being viewed with that handler's custom component, the diff view should gracefully fall back to inline-diff mode -- NOT crash. This requires the diff view component to handle a `undefined` return from `getPreviewForFile()`.

### Pattern 3: Extension Toggle UX Flow

**What:** The full user experience of disabling/enabling an extension.

**Current flow (from `ExtensionCard.tsx` and `ExtensionHost.ts`):**
1. User clicks toggle switch
2. `deactivateExtension(id)` called
3. Extension's `onDeactivate()` runs
4. `api.cleanup()` removes ALL registrations (blades, commands, toolbar, context menu, sidebar, status bar, git hooks, event subscriptions)
5. Extension status set to "disabled"
6. Toast notification: "Extension X disabled"

**UX requirements for Phase 43:**
- **Instant removal:** Commands, toolbar items, sidebar panels, and status bar items contributed by the disabled extension must vanish immediately from ALL visible UI surfaces. No stale references.
- **No dangling blade references:** If the user has an extension-contributed blade open (e.g., "Gitflow Cheatsheet") when the extension is disabled, the blade must be gracefully popped from the stack, not left as a broken component. (Note: This is NOT a Phase 43 requirement, but should be flagged as a follow-up concern.)
- **Re-enable purity:** When re-enabled, the extension must start fresh. No ghost state from the previous activation should leak through.
- **Accessible feedback:** The toggle switch already has `aria-label`, and toast notifications announce the change. The screen reader result count in the CommandPalette already uses `aria-live="polite"`. Ensure the reactive command count update announces correctly.

### Pattern 4: Process Tab Conditional Visibility

**What:** The Topology tab in ProcessNavigation hides when no topology blade is registered.

**UX considerations:**

1. **Single-tab state:** If Topology is the only extension-contributed process tab and it's hidden, only "Staging" remains. A single tab in a tab bar is awkward but acceptable -- it preserves spatial consistency and communicates "there could be more here." Do NOT hide the entire tab bar when only one tab remains.

2. **Active tab removal:** If the user is ON the Topology tab when the extension providing it is disabled:
   - The active process must switch to "staging" automatically
   - The blade stack must reset to the staging root blade
   - This should happen with a smooth transition, not an abrupt jump
   - A toast should inform the user: "Topology view no longer available"

3. **Re-appearance animation:** When an extension that provides the Topology tab is re-enabled:
   - The tab should appear with a subtle fade-in (framer-motion, respecting `useReducedMotion`)
   - It should NOT auto-switch to the new tab; the user stays on their current process
   - No layout shift in the process navigation bar -- the tab appears at its natural position

4. **Implementation approach:** The hook should read from `useBladeRegistry` (already a Zustand store):
   ```typescript
   function useProcessTabs() {
     const hasTopology = useBladeRegistry(
       state => state.blades.has("topology-graph")
     );
     return PROCESSES.filter(p => p.id !== "topology" || hasTopology);
   }
   ```

### Pattern 5: WelcomeView Registry Lookup

**What:** WelcomeView uses `BladeRegistry` lookup instead of direct `InitRepoBlade` import.

**UX guarantees the infrastructure must provide:**

1. **Registration ordering:** The `init-repo` blade MUST be registered before WelcomeView first renders. Currently this is guaranteed because `_discovery.ts` eagerly imports all `registration.ts` files via `import.meta.glob`. This guarantee must be preserved -- NOT broken by making registration lazy.

2. **Fallback rendering:** If by some race condition the `init-repo` blade is not yet registered when WelcomeView needs it:
   - Show a loading spinner with "Preparing repository setup..." text
   - Do NOT show an error or empty state -- this would be a first-run experience killer
   - Retry the lookup on the next render cycle (Zustand subscription will trigger re-render once registered)

3. **Visual parity:** The InitRepoBlade rendered via registry lookup must look IDENTICAL to the current hardcoded render. No layout shift, no style differences, no missing props. The `directoryPath`, `onCancel`, and `onComplete` callbacks must pass through correctly.

4. **Extension overridability (future-proofing):** The registry lookup enables a future where extensions can provide custom init experiences. The infrastructure should NOT assume the component signature is `InitRepoBlade` -- it should use the generic blade rendering path. However, for Phase 43, the behavior must be identical to current.

### Pattern 6: CC Store Reset on Extension Disable

**What:** The `useConventionalStore` must explicitly reset when the Conventional Commits extension is disabled.

**UX implications:**

1. **Clean re-enable:** When the user re-enables CC after a disable, the conventional commit form must be empty -- not pre-filled with stale data from the previous session.

2. **No data loss on disable:** If the user has typed a commit message in the CC form and then disables CC, the data loss is acceptable because:
   - The CC blade is removed from the stack (its UI is gone)
   - The user explicitly chose to disable the extension
   - Preserving stale data would be more confusing than clearing it

3. **Implementation:** In the CC extension's `onDeactivate()`:
   ```typescript
   export function onDeactivate(): void {
     useConventionalStore.getState().reset();
   }
   ```

   Alternatively, register via `api.onDispose()`:
   ```typescript
   api.onDispose(() => useConventionalStore.getState().reset());
   ```

### Anti-Patterns to Avoid

- **Polling for registry changes:** Never use `setInterval` or periodic checks. Zustand subscriptions provide synchronous notifications. The CommandPalette must use a Zustand selector, not a timer-based refresh.

- **Rendering stale component references:** When a preview handler or blade registration is removed, any component references it holds become stale. Never cache `ComponentType` references outside the registry -- always look them up at render time.

- **Optimistic UI for extension toggle:** Do NOT show the extension as "disabled" before deactivation completes. The current implementation correctly uses `isToggling` state to show a loading indicator. Maintain this pattern.

- **Hiding the tab bar entirely:** When only one process tab remains, keep the tab bar visible. Hiding it causes layout shift and removes spatial context for when the extension is re-enabled.

- **Silent failures on WelcomeView:** If the blade registry lookup fails, never show an empty white screen. Always have a meaningful fallback that directs the user to the expected action (Open Repository / Clone).

## Common Pitfalls

### Pitfall 1: CommandPalette Selected Index Out of Bounds
**What goes wrong:** When commands are removed reactively while the palette is open, the `selectedIndex` can exceed the new list length, causing the selection highlight to disappear or an undefined access.
**Why it happens:** The current `selectedIndex` is managed by `useUIStore` and is not clamped when the command list shrinks.
**How to avoid:** Add a `useEffect` that clamps `selectedIndex` to `Math.min(selectedIndex, results.length - 1)` whenever `results` changes. Alternatively, compute the effective index inline: `const effectiveIndex = Math.min(selectedIndex, results.length - 1)`.
**Warning signs:** Pressing Enter on the palette does nothing, or the highlighted command doesn't match what executes.

### Pitfall 2: Zustand Map Identity Causes Unnecessary Re-renders
**What goes wrong:** Every `register()` or `unregister()` call creates a `new Map()`, which changes the reference. If the CommandPalette subscribes to `state.commands` (the full Map), it re-renders on EVERY registration, even if the visible commands did not change (e.g., a disabled command was registered).
**Why it happens:** Zustand uses reference equality by default. `new Map()` always fails `===`.
**How to avoid:** Use a **selector** that derives only the data the component needs. For CommandPalette: `state => Array.from(state.commands.values()).filter(cmd => cmd.enabled?.() !== false)`. Use `shallow` equality from `zustand/shallow` to prevent re-renders when the array contents are identical.
**Warning signs:** Typing in the palette search field feels laggy because every keystroke triggers map recreation + re-render cascade.

### Pitfall 3: Extension Deactivation During Active Blade Viewing
**What goes wrong:** User is viewing a blade contributed by an extension (e.g., GitHubAuthBlade). Extension is disabled. The blade's component reference is now stale/removed from the registry. The BladeHost tries to render a component that no longer exists.
**Why it happens:** `api.cleanup()` removes blade registrations, but the navigation machine's blade stack still holds a reference to the blade type.
**How to avoid:** Phase 43 should document this as a known edge case. The recommended approach (for a follow-up phase) is: when an extension is deactivated, scan the blade stack for any blades with `source` matching the extension, and pop them. For Phase 43, rely on the fact that navigating away from a stale blade naturally resolves the issue.
**Warning signs:** White screen or React error boundary triggering after disabling an extension.

### Pitfall 4: WelcomeView Race Condition on First Load
**What goes wrong:** WelcomeView renders before `_discovery.ts` has executed all registration modules, causing the `init-repo` blade lookup to return `undefined`.
**Why it happens:** In development with Vite HMR, module execution order can vary. The `import.meta.glob` in `_discovery.ts` is eager but runs when the module is first imported. If WelcomeView's module tree is resolved first, the blade may not be registered yet.
**How to avoid:** The WelcomeView registry lookup must subscribe to the `useBladeRegistry` store. If the registration is missing on first render, the subscription will trigger a re-render when the registration arrives. Add a defensive `if (!registration) return <LoadingFallback />` guard.
**Warning signs:** Flash of loading state on app startup, or empty InitRepo area.

### Pitfall 5: Process Tab Switch During Topology Removal
**What goes wrong:** The user is on the Topology process tab. An extension providing topology-graph is disabled. The ProcessNavigation re-renders and no longer shows the Topology tab, but the navigation machine's `activeProcess` is still `"topology"`. The blade stack references `topology-graph`, which is no longer registered.
**Why it happens:** The ProcessNavigation UI and the navigation machine's state can become desynchronized if the tab removal doesn't trigger a process switch.
**How to avoid:** The `useProcessTabs` hook must include a `useEffect` that detects when the active process tab is no longer available and automatically dispatches `SWITCH_PROCESS` to "staging".
**Warning signs:** Empty blade area (topology root blade not found), or stale topology graph rendering with no way to navigate away.

### Pitfall 6: ARIA Announcement Storm on Extension Toggle
**What goes wrong:** When an extension is disabled, multiple registrations are removed in rapid succession (blades, commands, toolbar, sidebar, status bar). Each removal triggers a Zustand state change, which triggers a re-render in the CommandPalette, which updates the `aria-live` region. Screen readers hear a rapid series of "N commands available" announcements.
**Why it happens:** `api.cleanup()` calls each unregister function individually, each creating a new Map reference.
**How to avoid:** Batch the unregistration. The store should support an `unregisterBySource(source)` method (which the other registries already have) that performs a single state update for all removals. The commandRegistry migration must implement `unregisterBySource` as a single `set()` call, not multiple sequential `delete()` calls.
**Warning signs:** Screen reader users report "chatty" announcements when toggling extensions.

## UX Patterns from Industry Reference

### VS Code Command Palette Reactivity (HIGH confidence -- widely documented)
- VS Code's command palette re-queries the command registry on every keystroke
- Commands contributed by extensions appear/disappear the moment the extension activates/deactivates
- The palette does NOT need to be closed and reopened to see new commands
- VS Code uses a "when" clause system (context keys) to conditionally show commands; FlowForge uses the `enabled()` callback, which serves the same purpose
- Category headers in the palette update dynamically when categories are added/removed

### JetBrains Plugin Toggle UX (HIGH confidence -- observable behavior)
- Plugin disable takes effect after IDE restart (FlowForge's approach is BETTER -- instant toggle)
- Contributed actions, tool windows, and inspections are removed on restart
- No "ghost" state because the plugin is never partially active
- FlowForge's hot-toggle approach is more complex but provides better UX when implemented correctly

### Electron App Extension Patterns (MEDIUM confidence -- observed in Hyper, Warp)
- Hyper terminal's plugin system removes contributed UI elements immediately on disable
- Extension-contributed keyboard shortcuts are removed from the keybinding registry
- Status bar items contributed by extensions fade out with a 150ms animation
- Tab bar items from disabled extensions are removed, with the active tab switching to the default if needed

## Code Examples

### Reactive CommandPalette Hook (Recommended Pattern)

```typescript
// In CommandPalette.tsx -- replace useMemo with Zustand subscription
import { useShallow } from "zustand/shallow";
import { useCommandRegistry } from "../../lib/commandRegistry";

export function CommandPalette() {
  // ...existing state...

  // REACTIVE: auto-updates when commands are registered/unregistered
  const enabledCommands = useCommandRegistry(
    useShallow(state => {
      const cmds: Command[] = [];
      for (const cmd of state.commands.values()) {
        if (cmd.enabled ? cmd.enabled() : true) {
          cmds.push(cmd);
        }
      }
      return cmds;
    })
  );

  const results = useMemo(
    () => searchCommands(query, enabledCommands),
    [query, enabledCommands],
  );

  // Clamp selectedIndex when results shrink
  const effectiveIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));
  useEffect(() => {
    if (selectedIndex !== effectiveIndex) {
      setSelectedIndex(effectiveIndex);
    }
  }, [selectedIndex, effectiveIndex, setSelectedIndex]);

  // ...rest unchanged...
}
```

### Process Tab Visibility Hook (Recommended Pattern)

```typescript
// src/hooks/useProcessTabs.ts
import { useBladeRegistry } from "../lib/bladeRegistry";
import { useNavigationActorRef } from "../machines/navigation/context";
import { useSelector } from "@xstate/react";
import { selectActiveProcess } from "../machines/navigation/selectors";
import { useEffect } from "react";
import { Files, Network } from "lucide-react";
import type { ProcessType } from "../machines/navigation/types";

const ALL_PROCESSES = [
  { id: "staging" as ProcessType, label: "Staging", icon: Files },
  { id: "topology" as ProcessType, label: "Topology", icon: Network },
];

export function useProcessTabs() {
  const hasTopology = useBladeRegistry(
    state => state.blades.has("topology-graph")
  );
  const actorRef = useNavigationActorRef();
  const activeProcess = useSelector(actorRef, selectActiveProcess);

  // Auto-switch away from removed process tab
  useEffect(() => {
    if (activeProcess === "topology" && !hasTopology) {
      actorRef.send({ type: "SWITCH_PROCESS", process: "staging" });
    }
  }, [activeProcess, hasTopology, actorRef]);

  return ALL_PROCESSES.filter(p => p.id !== "topology" || hasTopology);
}
```

### WelcomeView Registry Lookup (Recommended Pattern)

```typescript
// In WelcomeView.tsx -- replace direct import with registry lookup
import { useBladeRegistry } from "../lib/bladeRegistry";

export function WelcomeView() {
  // ...existing state...

  const initRepoRegistration = useBladeRegistry(
    state => state.blades.get("init-repo")
  );

  // Show Init Repo blade in standalone mode
  if (showInitRepo && pendingInitPath) {
    if (!initRepoRegistration) {
      // Defensive fallback: blade not yet registered
      return (
        <div className="h-[calc(100vh-3.5rem)] bg-ctp-base flex items-center justify-center">
          <p className="text-ctp-subtext0">Preparing repository setup...</p>
        </div>
      );
    }

    const InitComponent = initRepoRegistration.component;
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-ctp-base">
        <InitComponent
          directoryPath={pendingInitPath}
          onCancel={() => setShowInitRepo(false)}
          onComplete={async (path: string) => {
            await openRepository(path);
            await addRecentRepo(path);
            setShowInitRepo(false);
            setPendingInitPath(null);
          }}
        />
      </div>
    );
  }

  // ...rest unchanged...
}
```

### CC Store Cleanup on Deactivation (Recommended Pattern)

```typescript
// In extensions/conventional-commits/index.ts
import { useConventionalStore } from "../../stores/conventional";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // ...existing registrations...

  // Register cleanup disposable for store reset
  api.onDispose(() => {
    useConventionalStore.getState().reset();
  });
}

export function onDeactivate(): void {
  // Store reset handled by onDispose registered in onActivate
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive registry | Custom event emitter + manual subscription management | Zustand store (already used for 5 other registries) | Zustand handles React integration, devtools, and subscription management automatically |
| Shallow comparison for selectors | Custom `shallowEqual` utility | `zustand/shallow` or `useShallow` | Battle-tested, handles all edge cases (Maps, Sets, Date objects) |
| Tab visibility animations | Custom CSS transitions + manual state tracking | framer-motion `AnimatePresence` + `motion.div` (already in project) | Handles mount/unmount animations, reduced motion, exit transitions |
| Command list batching | Custom debounce for registry changes | Zustand's built-in batching (React 18 automatic batching) | React 18 automatically batches state updates within the same event handler |

## Open Questions

1. **Blade stack cleanup on extension disable**
   - What we know: `api.cleanup()` removes registrations but does NOT pop blades from the navigation stack. If an extension-contributed blade is currently visible, it becomes a "zombie" in the stack.
   - What's unclear: Should Phase 43 handle this, or is it a follow-up? The navigation machine has no concept of "blade source" -- it tracks blade types, not which extension contributed them.
   - Recommendation: Flag as a known limitation for Phase 43. Add a `// TODO: Phase 44+` comment. The defensive approach is to make `BladeHost` check `getBladeRegistration(type)` before rendering and show a fallback if the registration is missing.

2. **Preview handler mid-render removal**
   - What we know: The diff view calls `getPreviewForFile()` once to determine rendering mode. If the handler is removed after that lookup but before the component unmounts, the stale component reference could cause issues.
   - What's unclear: Does React's reconciliation handle this gracefully, or do we need an explicit guard?
   - Recommendation: Wrap the custom preview component render in an error boundary. If the component throws (because its module was cleaned up), fall back to inline-diff mode.

3. **Process type extensibility beyond "staging" and "topology"**
   - What we know: Phase 43 only needs to conditionally hide the topology tab. The `ProcessType` is currently a literal union `"staging" | "topology"`.
   - What's unclear: Should Phase 43 make the process tab bar fully extensible (allowing extensions to register new process types), or only add conditional visibility?
   - Recommendation: Phase 43 should ONLY add conditional visibility. Full extensibility of process types is a larger architectural change that affects the navigation machine, root blade resolution, and keyboard shortcuts.

## Accessibility Impact Assessment

### Positive Changes
- **Reactive `aria-live` updates:** The CommandPalette's "N commands available" screen reader announcement will now update in real time when extension-contributed commands are added/removed. Currently, this count only updates on palette open.
- **Tab bar landmark consistency:** The ProcessNavigation tab bar maintains its `role="tablist"` semantics even when tabs are conditionally hidden.

### Risks to Mitigate
- **Announcement storms:** Batch unregistrations to prevent multiple rapid-fire `aria-live` updates (see Pitfall 6).
- **Focus management on tab removal:** If the active process tab is removed, focus must move to the new active tab (staging), not be lost.
- **Keyboard navigation in reduced tab bar:** Arrow key navigation in a single-tab bar should be a no-op, not cause errors.

## Sources

### Primary (HIGH confidence)
- FlowForge codebase analysis -- direct file reads of all affected components:
  - `src/components/command-palette/CommandPalette.tsx` -- current command rendering
  - `src/lib/commandRegistry.ts` -- current plain Map registry
  - `src/lib/previewRegistry.ts` -- current plain array registry
  - `src/lib/bladeRegistry.ts` -- reference Zustand store pattern (already migrated)
  - `src/lib/toolbarRegistry.ts` -- reference Zustand store pattern
  - `src/lib/sidebarPanelRegistry.ts` -- reference Zustand store pattern
  - `src/blades/_shared/ProcessNavigation.tsx` -- current hardcoded tab bar
  - `src/components/WelcomeView.tsx` -- current hardcoded InitRepoBlade import
  - `src/extensions/ExtensionHost.ts` -- extension lifecycle management
  - `src/extensions/ExtensionAPI.ts` -- extension registration and cleanup
  - `src/extensions/conventional-commits/index.ts` -- CC extension activate/deactivate
  - `src/stores/conventional.ts` -- CC store with reset() method
  - `src/machines/navigation/navigationMachine.ts` -- process switching logic
  - `src/machines/navigation/actions.ts` -- rootBladeForProcess mapping
- Zustand documentation via Context7 (`/pmndrs/zustand`) -- subscription patterns, `useShallow`, `subscribeWithSelector`

### Secondary (MEDIUM confidence)
- VS Code extension UX patterns -- observed behavior and publicly documented API
- JetBrains plugin toggle behavior -- observable in IDE

## Metadata

**Confidence breakdown:**
- Architecture patterns: HIGH -- all 5 other registries already use the target pattern
- UX implications: HIGH -- directly observable from codebase analysis
- Pitfalls: HIGH -- derived from concrete code paths and state management analysis
- Accessibility: MEDIUM -- based on WCAG standards and existing aria patterns in codebase

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (patterns are stable; Zustand API unlikely to change)

## RESEARCH COMPLETE
