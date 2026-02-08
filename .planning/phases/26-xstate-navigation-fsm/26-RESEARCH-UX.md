# Phase 26: XState Navigation FSM - UX Research

**Researched:** 2026-02-08
**Perspective:** UX Designer
**Domain:** Blade-based navigation interactions, animations, dirty-state indicators, accessibility
**Confidence:** HIGH (patterns drawn from established desktop apps and verified framer-motion docs)

## Summary

FlowForge uses an Azure Portal-inspired blade navigation model where content panels push onto a horizontal stack from left to right. The existing implementation (`BladeContainer.tsx`) already uses `AnimatePresence` with `mode="popLayout"` and a single slide-from-right animation for all transitions. Phase 26 replaces the Zustand blade store with an XState FSM, creating an opportunity to introduce **direction-aware animations** that visually communicate the semantic difference between push, pop, replace, and reset operations.

The UX focus areas are: (1) directional blade transition animations, (2) dirty-form indicators on blade strips, (3) navigation guard confirmation dialogs, (4) singleton blade duplicate handling, (5) process switching UX, (6) stack depth visualization, (7) keyboard navigation, and (8) accessibility for state transitions.

**Primary recommendation:** Use the XState FSM's `lastAction` context field to drive direction-aware framer-motion variants, add a yellow dot dirty indicator to blade strips (matching the existing BranchSwitcher pattern), and use a focused confirmation dialog for navigation guards -- all with `aria-live="polite"` announcements for screen reader users.

---

## 1. Blade Transition Animations

### Current State

`BladeContainer.tsx` uses a single animation for all transitions:
```typescript
// Current: same animation for push, pop, replace, and reset
initial={{ x: 40, opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
exit={{ x: 40, opacity: 0 }}
transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
```

This is defined in `src/lib/animations.ts` as `bladeSlideIn`. All operations look identical, which breaks the UX principle that **animation should communicate meaning**.

### Recommended Pattern: Direction-Aware Variants

**Confidence: HIGH** (verified against Motion docs and production examples)

Each navigation operation should have a distinct visual signature:

| Operation | Enter Direction | Exit Direction | Semantic Meaning |
|-----------|----------------|----------------|------------------|
| **push** | Slide in from right (+x) | Previous blade collapses to strip | "Going deeper" |
| **pop** | Slide in from left (-x) | Current blade slides out right (+x) | "Going back" |
| **replace** | Crossfade with subtle scale | Crossfade out | "Swapping in place" |
| **reset** | Fade in from center (scale 0.95 -> 1.0) | All blades fade out simultaneously | "Starting fresh" |

### Implementation with framer-motion

Use the `custom` prop on `AnimatePresence` to pass the direction dynamically. This is critical because **exiting components do not receive new props** -- the `custom` prop on `AnimatePresence` is the only way to update exit animations for components that are already unmounting.

**Source:** [Direction-aware animations in Framer Motion](https://sinja.io/blog/direction-aware-animations-in-framer-motion)

```typescript
// Blade transition variants driven by FSM's lastAction
type BladeTransitionDirection = 'push' | 'pop' | 'replace' | 'reset';

const bladeVariants: Variants = {
  initial: (direction: BladeTransitionDirection) => {
    switch (direction) {
      case 'push':
        return { x: '100%', opacity: 0 };
      case 'pop':
        return { x: '-30%', opacity: 0 };
      case 'replace':
        return { opacity: 0, scale: 0.98 };
      case 'reset':
        return { opacity: 0, scale: 0.95 };
    }
  },
  animate: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: BladeTransitionDirection) => {
    switch (direction) {
      case 'push':
        return { x: '-30%', opacity: 0 };
      case 'pop':
        return { x: '100%', opacity: 0 };
      case 'replace':
        return { opacity: 0, scale: 0.98 };
      case 'reset':
        return { opacity: 0, scale: 0.95 };
    }
  },
};
```

Usage in BladeContainer:
```tsx
<AnimatePresence mode="popLayout" custom={lastAction}>
  <motion.div
    key={activeBlade.id}
    custom={lastAction}
    variants={bladeVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
    className="flex-1 min-w-0"
  >
    <BladeRenderer blade={activeBlade} goBack={popBlade} />
  </motion.div>
</AnimatePresence>
```

### Timing Recommendations

| Operation | Duration | Easing | Rationale |
|-----------|----------|--------|-----------|
| push | 200ms | easeOut | Quick entry, matches user expectation of "opening" |
| pop | 180ms | easeOut | Slightly faster -- going back should feel snappier |
| replace | 150ms | easeInOut | Fast crossfade, minimal disruption |
| reset | 250ms | easeOut | Slightly longer to signal a significant context change |

### Anti-Patterns

- **Do NOT use spring physics for blade transitions.** Spring animations can overshoot, causing blades to "bounce" past their target position. This looks playful but feels uncontrolled for a professional tool. Use `type: "tween"` with `easeOut`.
- **Do NOT animate blade strips.** Strips should appear/disappear instantly when blades push/pop. Animating them creates visual noise that competes with the main blade animation.
- **Do NOT use `mode="wait"` on AnimatePresence.** This blocks the entering blade until the exiting blade finishes, creating a perceptible delay. Use `mode="popLayout"` so the exit animation runs while the entering blade takes its position.

### Reduced Motion Support

The codebase already uses `motion-safe:` prefix in Tailwind classes (e.g., `motion-safe:animate-dirty-pulse` in `BranchSwitcher.tsx`). For framer-motion animations, use the `useReducedMotion` hook:

```typescript
import { useReducedMotion } from "framer-motion";

const shouldReduceMotion = useReducedMotion();
const transition = shouldReduceMotion
  ? { duration: 0 }
  : { type: "tween", ease: "easeOut", duration: 0.2 };
```

---

## 2. Dirty-Form Indicators on Blade Strips

### Best Practices from Desktop Apps

**VS Code Pattern (industry standard):**
- A filled dot (circle) appears on the tab next to the filename when the file has unsaved changes
- The dot replaces the close icon position in some configurations
- Color: uses the tab's foreground color (not a special warning color)
- Additional: Explorer sidebar shows a badge count of dirty files

**Source:** [VS Code Unsaved File Affordance](https://www.waveguide.io/examples/entry/unsaved-file-affordance/)

### Recommended Pattern for FlowForge

**Confidence: HIGH** (aligns with existing codebase patterns)

The codebase already has a dirty indicator pattern in `BranchSwitcher.tsx`:
```tsx
<Circle className="w-2 h-2 fill-ctp-yellow text-ctp-yellow shrink-0 motion-safe:animate-dirty-pulse" />
```

And a corresponding CSS animation in `index.css`:
```css
@keyframes dirty-pulse {
  0%, 100% { filter: drop-shadow(0 0 0px var(--catppuccin-color-yellow)); opacity: 1; }
  50% { filter: drop-shadow(0 0 4px var(--catppuccin-color-yellow)); opacity: 0.7; }
}
```

**Reuse this exact pattern on blade strips.** Consistency is more important than novelty.

### BladeStrip Dirty Indicator Design

```
+--------+
| <      |  <-- ChevronLeft icon (existing)
|        |
|  [*]   |  <-- Yellow dot, only shown when blade has dirty form state
|        |
|  T     |
|  i     |  <-- Vertical title text (existing)
|  t     |
|  l     |
|  e     |
|        |
+--------+
```

### Catppuccin Mocha Colors for Dirty State

| Element | Color | Hex | CSS Variable |
|---------|-------|-----|--------------|
| Dirty dot fill | Yellow | #f9e2af | `--catppuccin-color-yellow` / `ctp-yellow` |
| Dirty dot glow | Yellow at 40% opacity | #f9e2af66 | via `drop-shadow` |
| Strip title (dirty) | Yellow | #f9e2af | `text-ctp-yellow` |
| Strip title (clean) | Subtext0 | #a6adc8 | `text-ctp-subtext0` (existing) |
| Strip background (dirty) | Base with yellow tint | -- | `bg-ctp-base` + yellow left border |

**Recommended:** Add a 2px left border in `ctp-yellow` to dirty strips for extra visual weight:
```tsx
<button
  className={cn(
    "w-10 shrink-0 border-r border-ctp-surface0 bg-ctp-base ...",
    isDirty && "border-l-2 border-l-ctp-yellow"
  )}
>
```

### What NOT to Do

- **Do NOT use red for dirty indicators.** Red means error/danger in this app's design language (see `Toast.tsx` error styles). Dirty state is a warning, not an error.
- **Do NOT use animated borders or pulsing backgrounds.** The subtle dot pulse is enough. More animation creates anxiety rather than awareness.
- **Do NOT show dirty state only on hover.** Dirty state must be persistently visible -- it is safety-critical information.

---

## 3. Navigation Guard Confirmation Dialog

### When to Show

**Confidence: HIGH** (verified against AWS Cloudscape pattern)

Show a confirmation dialog when:
- User triggers `POP_BLADE` and the current blade has dirty form state
- User triggers `REPLACE_BLADE` and the current blade has dirty form state
- User triggers `RESET_STACK` (process switch) and ANY blade has dirty form state
- User clicks a blade strip to `POP_TO_INDEX` and any blade being removed has dirty state

Do NOT show when:
- The blade has no dirty state (guard should pass silently)
- The user has not modified any form fields
- The action opens content in a new blade (push) -- this does not discard the current blade

**Source:** [AWS Cloudscape Unsaved Changes Pattern](https://cloudscape.design/patterns/general/unsaved-changes/)

### Dialog Design

Use the existing `Dialog` component (`src/components/ui/dialog.tsx`) with these specifics:

```
+--------------------------------------------------+
|  Unsaved Changes                            [X]  |
|                                                  |
|  /!\ You have unsaved changes in "{blade title}" |
|      that will be lost if you navigate away.     |
|                                                  |
|                        [Stay]  [Discard Changes] |
+--------------------------------------------------+
```

### Button Labels and Colors

| Button | Role | Color | Keyboard |
|--------|------|-------|----------|
| **Stay** | Secondary (safe action) | `bg-ctp-surface0 text-ctp-text` | Escape |
| **Discard Changes** | Primary (destructive) | `bg-ctp-red text-ctp-base` | Enter |

**Key UX decisions:**
1. **"Stay" is the default focus** -- the safe action should be easiest to trigger accidentally. Auto-focus lands on "Stay" per the existing dialog's `focusable?.focus()` logic.
2. **"Discard Changes" NOT "Leave"** -- be explicit about what happens. "Leave" is ambiguous; "Discard Changes" communicates data loss.
3. **No "Save and Leave" option** -- blades in FlowForge are viewers/editors for git operations, not document editors. There is no generic "save" action for blade state. If a blade has a commit form, the user should commit first, then navigate.

### Warning Icon and Color

Use `AlertTriangle` from Lucide (already imported in `Toast.tsx`) with `text-ctp-yellow` -- consistent with the warning toast style (`bg-ctp-yellow/10 border-ctp-yellow/30 text-ctp-yellow`).

### Anti-Patterns

- **Do NOT use "Are you sure?" as the dialog title.** This is a UX anti-pattern per [Nielsen Norman Group](https://www.nngroup.com/articles/confirmation-dialog/). State what will happen: "Unsaved Changes".
- **Do NOT make the destructive action the default focused button.** Users pressing Enter quickly should not accidentally lose data.
- **Do NOT show the dialog on every navigation.** Only show when `dirtyBlades.size > 0` in the FSM context. If no form state has been modified, the FSM guard should pass silently.

---

## 4. Singleton Blade Behavior

### Current State

`bladeOpener.ts` already implements singleton guard logic:
```typescript
const SINGLETON_TYPES: BladeType[] = ["settings", "changelog", "gitflow-cheatsheet"];
// If already in stack, silently returns without pushing
if (SINGLETON_TYPES.includes(type)) {
  if (store.bladeStack.some((b) => b.type === type)) return;
}
```

### Recommended Pattern: Toast + Focus

**Confidence: MEDIUM** (no strong industry consensus -- both silent focus and toast are valid)

When a user attempts to open a singleton blade that is already in the stack:

1. **Focus the existing blade** -- call `popToIndex` to navigate to the existing instance
2. **Show an info toast** -- "Settings is already open" with `toast.info()`

**Rationale:** Silent focus alone is confusing -- the user clicked something and nothing visibly happened (or the stack collapsed, which may not be obviously related to their action). A brief toast provides feedback that their action was received and handled.

```typescript
// In FSM guard for singleton check
if (isSingleton(bladeType) && isAlreadyOpen(bladeType)) {
  const existingIndex = context.bladeStack.findIndex(b => b.type === bladeType);
  // Raise "FOCUS_BLADE" event instead of "PUSH_BLADE"
  // Toast shown as side effect
  toast.info(`${bladeTitle} is already open`);
  return false; // guard blocks the push
}
```

### Anti-Patterns

- **Do NOT show an error toast.** This is not an error -- it is expected behavior handled gracefully.
- **Do NOT silently ignore with no feedback.** Users will think the app is broken.
- **Do NOT open a second instance.** This would violate the singleton constraint and could cause state conflicts.

---

## 5. Process Switching UX (Staging <-> Topology)

### Current State

`ProcessNavigation.tsx` uses simple buttons that call `setProcess()`, which atomically resets the blade stack:
```typescript
setProcess: (process) => set({
  activeProcess: process,
  bladeStack: [rootBladeForProcess(process)],
}),
```

### Recommended Pattern

Process switching is a **major context change** -- the entire blade stack is replaced. This should feel visually distinct from a simple push/pop.

**Animation:** Use the `reset` variant (fade + scale from 0.95) rather than a directional slide. This communicates "new context" rather than "navigation within the same context".

**Dirty State Handling:** If any blade in the current stack has dirty form state, show the navigation guard dialog BEFORE switching processes. The dialog message should say:

```
"You have unsaved changes that will be lost if you switch to {process name}."
```

### Visual Feedback During Switch

1. The process navigation buttons already show active state via `bg-ctp-surface0 text-ctp-text`
2. Consider adding a brief (100ms) scale pulse on the newly active button to confirm the switch
3. The blade area should crossfade to the new root blade

### Anti-Pattern

- **Do NOT animate the process buttons sliding.** They are persistent navigation -- they should not move. Only their visual state (active/inactive) should change.

---

## 6. Stack Depth Visualization

### Recommendation: Implicit via Blade Strips (No Explicit Counter)

**Confidence: HIGH**

The blade strips themselves ARE the stack depth visualization. Each collapsed blade in the stack renders as a 40px-wide vertical strip with its title. Users can count strips to understand depth.

**Do NOT add:**
- A breadcrumb trail (redundant with strips)
- A depth counter badge (adds visual noise for minimal value)
- A minimap of the blade stack (over-engineering)

**Do add:**
- A maximum stack depth (NAV-06 requirement). Recommend **max 8 blades** -- at 40px per strip, 7 strips = 280px, leaving ~720px minimum for the active blade on a 1024px-wide window.
- When max depth is reached, the FSM guard should block further pushes and show a toast: "Maximum blade depth reached. Close some blades first."

### Stack Overflow Handling

| Stack Size | Behavior |
|------------|----------|
| 1 | Root blade only, no strips visible |
| 2-6 | Normal operation, strips accumulate on the left |
| 7 | Warning: strips may start feeling cramped |
| 8 | Max depth -- FSM guard blocks further pushes |

---

## 7. Keyboard Navigation Patterns

### Current State

`useKeyboardShortcuts.ts` already defines:
- `Escape` -- pop blade (if stack > 1, if command palette is closed)
- `Backspace` -- pop blade (same guards)
- `Mod+,` -- open Settings
- `Enter` -- open commit details (topology-specific)

### Recommended Keyboard Shortcuts

| Shortcut | Action | Platform Convention | Notes |
|----------|--------|---------------------|-------|
| `Escape` | Pop blade | Universal | Already implemented. Keep as-is. |
| `Backspace` | Pop blade | VS Code convention | Already implemented. Keep as-is. |
| `Mod+[` | Pop blade (navigate back) | VS Code, macOS Safari | New. Alternative for users who find Backspace unexpected. |
| `Mod+]` | Re-push last popped blade (navigate forward) | VS Code, macOS Safari | New. Requires FSM to track `lastPopped` in context. LOW priority. |
| `Mod+W` | Close active blade (pop) | VS Code, browser tabs | New. Familiar "close tab" shortcut. |
| `Mod+1..9` | Focus blade at strip index | VS Code tab switching | LOW priority. Only useful with many blades. |

### Guard Integration

When a keyboard shortcut triggers `POP_BLADE` and the active blade has dirty state, the FSM should:
1. Block the pop transition
2. Show the confirmation dialog
3. If user confirms, re-send the pop event

This means keyboard shortcuts should send FSM events, NOT directly call `popBlade()`.

### Anti-Patterns

- **Do NOT use `Alt+Left/Right` for blade navigation.** These are reserved for browser-level or OS-level back/forward in Tauri webview context.
- **Do NOT use `Ctrl+Tab` / `Ctrl+Shift+Tab`.** These are typically reserved for tab cycling, not stack navigation. The blade stack is a stack, not a tab bar.

---

## 8. Accessibility

### Screen Reader Announcements

**Confidence: HIGH** (based on MDN ARIA live region documentation)

The existing `BladeContainer.tsx` already has an `aria-live="polite"` region:
```tsx
<div aria-live="polite" className="sr-only">
  {activeBlade.title}
</div>
```

This should be enhanced to communicate the **type of navigation action**:

```tsx
<div aria-live="polite" className="sr-only">
  {lastAction === 'push' && `Opened ${activeBlade.title}`}
  {lastAction === 'pop' && `Returned to ${activeBlade.title}`}
  {lastAction === 'replace' && `Switched to ${activeBlade.title}`}
  {lastAction === 'reset' && `Navigated to ${activeBlade.title}`}
</div>
```

**Source:** [MDN ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)

### Focus Management

When a blade transition completes:
1. **Push:** Focus should move to the new blade's first focusable element (or the back button)
2. **Pop:** Focus should move to the now-active blade's last-focused element (if tracked) or its back button
3. **Replace:** Focus should move to the new blade's first focusable element
4. **Reset:** Focus should move to the root blade's primary content area

### Blade Strip Accessibility

Current `BladeStrip.tsx` already has `aria-label={`Expand ${title} panel`}`. Enhance for dirty state:

```tsx
aria-label={`${isDirty ? 'Unsaved changes in ' : ''}${title} panel. Click to expand.`}
```

### Confirmation Dialog Accessibility

The existing `Dialog` component already handles:
- `role="dialog"` and `aria-modal="true"`
- Escape key to close
- Auto-focus on first focusable element

For the navigation guard dialog, add:
- `aria-labelledby` pointing to the dialog title
- `aria-describedby` pointing to the warning message

### Reduced Motion

All framer-motion animations should respect `prefers-reduced-motion`:
- Use `useReducedMotion()` hook from framer-motion
- When reduced motion is preferred, replace slide/scale animations with instant opacity transitions (duration: 0)
- Blade strips should never animate regardless of motion preference (they appear/disappear instantly)
- The `dirty-pulse` animation is already gated behind `motion-safe:` prefix -- this is correct

---

## Catppuccin Mocha Color Reference for Navigation States

| State | Color | Token | Hex | Usage |
|-------|-------|-------|-----|-------|
| Active blade | Text | `ctp-text` | #cdd6f4 | Panel title text |
| Collapsed strip | Subtext0 | `ctp-subtext0` | #a6adc8 | Strip title text |
| Collapsed strip hover | Surface0 bg | `ctp-surface0` | #313244 | Strip hover background |
| Dirty indicator | Yellow | `ctp-yellow` | #f9e2af | Dot fill, strip border |
| Dirty strip title | Yellow | `ctp-yellow` | #f9e2af | Title text when dirty |
| Navigation guard warning | Yellow/10 bg | `ctp-yellow/10` | -- | Alert background |
| Discard button | Red | `ctp-red` | #f38ba8 | Destructive action |
| Stay button | Surface0 | `ctp-surface0` | #313244 | Safe action |
| Process active | Text on Surface0 | `ctp-text` on `ctp-surface0` | -- | Active process button |
| Process inactive | Subtext0 | `ctp-subtext0` | #a6adc8 | Inactive process button |
| Singleton toast | Blue/10 bg | `ctp-blue/10` | -- | Info toast for duplicate attempt |
| Max depth toast | Peach/10 bg | `ctp-peach/10` | -- | Warning for stack limit |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Direction-aware exit animations | Manual ref tracking of direction | `AnimatePresence custom` prop | framer-motion handles exiting component prop updates via custom |
| Dirty form tracking per blade | Custom form diff logic | Store a `Set<string>` of dirty blade IDs in FSM context | XState context is the single source of truth |
| Focus trap in confirmation dialog | Custom focus management | Existing `Dialog` component already handles focus trap | Tested, accessible |
| Animation timing per operation | Separate animation configs | Centralized `bladeVariants` with direction switch | Single source of truth, easier to tune |

---

## Common Pitfalls

### Pitfall 1: Exit Animation Uses Stale Direction
**What goes wrong:** The pop animation plays as a push because the exiting component captured the old direction value.
**Why it happens:** React does not re-render unmounting components. The `custom` prop on `<motion.div>` is frozen at the time of unmount.
**How to avoid:** Pass direction through `AnimatePresence custom={direction}` NOT through component props. AnimatePresence forwards its `custom` prop to exiting children.
**Warning signs:** All exit animations slide in the same direction regardless of operation.

### Pitfall 2: Confirmation Dialog Blocks FSM Indefinitely
**What goes wrong:** The FSM enters a "confirming" state and never transitions out because the dialog result is not properly fed back.
**Why it happens:** Guards are synchronous in XState. If you need async confirmation (showing a dialog), you cannot pause a guard -- you need a separate FSM state.
**How to avoid:** Model confirmation as a state, not a guard. When dirty state is detected, transition to a `confirming` state that shows the dialog. Dialog buttons send `CONFIRM_DISCARD` or `CANCEL_DISCARD` events.
**Warning signs:** Navigation feels stuck or requires double-clicking.

### Pitfall 3: Dirty State Leaks Between Blades
**What goes wrong:** A blade reports dirty state after the user has already navigated away and back, even though the form was reset.
**Why it happens:** The dirty blade Set is updated on `MARK_DIRTY` but never cleaned up when a blade is unmounted.
**How to avoid:** On `POP_BLADE` and `RESET_STACK`, remove popped blade IDs from the dirty set as part of the FSM action.
**Warning signs:** Ghost dirty indicators on blade strips for blades that were already closed.

### Pitfall 4: Process Switch Without Dirty Check
**What goes wrong:** User switches from Staging to Topology, losing unsaved commit message.
**Why it happens:** Process switch is modeled as a simple event without a guard.
**How to avoid:** The `SWITCH_PROCESS` event must check `dirtyBlades.size > 0` and route to the `confirming` state if dirty.
**Warning signs:** No confirmation dialog when switching processes with a half-written commit message.

### Pitfall 5: Keyboard Shortcuts Bypass FSM
**What goes wrong:** Pressing Escape pops a blade with dirty state without confirmation.
**Why it happens:** Current `useKeyboardShortcuts.ts` calls `bladeStore.popBlade()` directly, bypassing the FSM.
**How to avoid:** All keyboard shortcuts must send FSM events (e.g., `send({ type: 'POP_BLADE' })`), never call store actions directly. The FSM guards handle dirty checks.
**Warning signs:** Keyboard back navigation skips the confirmation dialog.

---

## Architecture Patterns

### Pattern 1: FSM Context Tracks Last Action for Animation Direction

The XState machine context should include a `lastAction` field that the animation layer reads:

```typescript
context: {
  bladeStack: TypedBlade[],
  activeProcess: ProcessType,
  dirtyBlades: Set<string>,   // blade IDs with unsaved state
  lastAction: 'push' | 'pop' | 'replace' | 'reset' | 'init',
}
```

Every transition action sets `lastAction` alongside modifying the stack:
```typescript
PUSH_BLADE: {
  actions: assign({
    bladeStack: ({ context, event }) => [...context.bladeStack, event.blade],
    lastAction: () => 'push',
  }),
}
```

### Pattern 2: Confirmation as an FSM State (Not a Guard)

```
                    [dirty?]
PUSH_BLADE -----> navigating (push to stack)
POP_BLADE  -----> if dirty --> confirming --> CONFIRM_DISCARD --> navigating (pop)
                                          --> CANCEL_DISCARD  --> idle (no change)
           -----> if clean --> navigating (pop directly)
```

This avoids the async guard problem and keeps the dialog lifecycle under FSM control.

### Pattern 3: Blade Registers/Unregisters Dirty State via Events

Blades should notify the FSM of their dirty state via events, not by writing to shared mutable state:

```typescript
// Inside a blade component
useEffect(() => {
  if (formIsDirty) {
    send({ type: 'MARK_DIRTY', bladeId: blade.id });
  } else {
    send({ type: 'MARK_CLEAN', bladeId: blade.id });
  }
}, [formIsDirty]);
```

### Anti-Patterns to Avoid

- **Storing UI state (animation direction) outside the FSM.** The FSM is the single source of truth. Do not maintain a separate `useRef` or Zustand store for animation direction.
- **Using `onExitComplete` callback to trigger navigation.** The FSM should drive navigation; animations are a presentation concern that follows the FSM state.
- **Mixing imperative store calls with FSM events.** The entire point of Phase 26 is to replace `useBladeStore` actions with FSM events. No code should call `pushBlade()` directly after migration.

---

## Open Questions

1. **Forward navigation (redo)?**
   - What we know: `Mod+]` could re-push the last popped blade, like browser forward.
   - What's unclear: Is this worth the complexity? It requires tracking popped blades in FSM context.
   - Recommendation: Defer to a future phase. The FSM can be extended later without breaking changes.

2. **Blade-specific save actions in confirmation dialog?**
   - What we know: Some blades (e.g., commit form) could theoretically offer "Save and Navigate".
   - What's unclear: What does "save" mean for each blade type? There is no universal save action.
   - Recommendation: Keep the dialog simple with "Stay" / "Discard Changes". Blade-specific save logic is out of scope for Phase 26.

3. **Multi-blade dirty state in process switch?**
   - What we know: Multiple blades could be dirty when switching processes.
   - What's unclear: Should the dialog list all dirty blades, or just say "you have unsaved changes"?
   - Recommendation: List dirty blade titles in the dialog body for clarity: "You have unsaved changes in: {blade1}, {blade2}".

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/stores/blades.ts`, `src/components/blades/BladeContainer.tsx`, `src/components/blades/BladeStrip.tsx`, `src/lib/animations.ts`, `src/components/ui/dialog.tsx`, `src/hooks/useKeyboardShortcuts.ts`
- [Motion docs - AnimatePresence](https://motion.dev/docs/react-animate-presence) -- `custom` prop, `mode="popLayout"`, exit animations
- [MDN - ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions) -- screen reader announcements
- [Catppuccin Mocha palette](https://catppuccin.com/palette/) -- color hex values
- XState v5 + @xstate/react v6 already installed in `package.json`

### Secondary (MEDIUM confidence)
- [Direction-aware animations in Framer Motion](https://sinja.io/blog/direction-aware-animations-in-framer-motion) -- verified pattern for directional exit animations
- [AWS Cloudscape - Unsaved Changes Pattern](https://cloudscape.design/patterns/general/unsaved-changes/) -- dialog design, when to show confirmation
- [VS Code Unsaved File Affordance](https://www.waveguide.io/examples/entry/unsaved-file-affordance/) -- dirty dot indicator pattern
- [Nielsen Norman Group - Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/) -- "are you sure" anti-pattern
- [Azure Portal Blade Navigation](https://github.com/Azure/portaldocs/blob/main/portal-sdk/generated/top-extensions-architecture.md) -- blade stack UX model

### Tertiary (LOW confidence)
- [Stately Inspector](https://stately.ai/docs/developer-tools) -- XState v5 devtools (need to verify current API for NAV-08)

---

## Metadata

**Confidence breakdown:**
- Blade transition animations: HIGH -- verified framer-motion docs, existing codebase patterns
- Dirty-form indicators: HIGH -- reuses existing codebase pattern from BranchSwitcher
- Navigation guard dialog: HIGH -- well-established UX pattern, existing Dialog component
- Singleton behavior: MEDIUM -- no strong industry consensus, toast+focus is reasonable
- Keyboard shortcuts: HIGH -- follows VS Code conventions already in use
- Accessibility: HIGH -- based on MDN docs, existing aria-live region in codebase
- Process switching: MEDIUM -- clean pattern but needs validation with actual dirty state scenarios

**Research date:** 2026-02-08
**Valid until:** 2026-03-10 (30 days -- stable domain, established libraries)
