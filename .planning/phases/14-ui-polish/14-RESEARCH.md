# Phase 14: UI Polish - Research

**Researched:** 2026-02-06
**Domain:** UI polish, empty states, loading feedback, tooltips, visual effects, animations
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Empty states design:** Line art illustrations style (custom line-art drawings like GitHub/Linear). Friendly casual tone for guidance text. Panels needing empty states: changes, stashes, tags, and commit history (new repo).
- **Loading & spinners:** Spinners appear inside buttons, replacing button text/icon during operation. Buttons become disabled + show spinner + change label text. All async operations get loading states. Panels use skeleton loaders (shimmer/placeholder shapes matching content layout) during initial data fetch.
- **Tooltip & shortcut hints:** Keyboard shortcuts displayed as styled key badges (rounded key cap styling, like VS Code tooltips). Tooltips only appear on buttons that have a keyboard shortcut -- not all buttons. Medium hover delay (500ms) before showing tooltips. Auto-detect OS and show platform-correct shortcuts.
- **Visual effects & animation:** Frosted glass on panel headers: medium intensity (16-20px blur). Dirty state pulse: gentle glow pulse on the indicator dot. Tasteful transitions throughout. Respect OS prefers-reduced-motion setting.

### Claude's Discretion
- Which empty state panels get CTA buttons vs text-only
- Exact line art illustration designs
- Specific skeleton loader shapes per panel
- Animation timing curves and durations
- Exact frosted glass color/opacity values

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase enhances an already-functional Tauri + React + TypeScript application (using Tailwind CSS v4 and Catppuccin Mocha theme) with visual polish across five areas: empty states, loading feedback, keyboard shortcut tooltips, frosted glass headers, and animation refinements. The codebase is well-structured with existing patterns for animations (framer-motion v12.31.0, `src/lib/animations.ts`), icons (Lucide React), and state management (Zustand + React Query).

The critical insight is that nearly all required tools are already in the project -- no new dependencies are needed. Framer-motion provides `useReducedMotion` for accessibility, Tailwind CSS v4 provides `motion-safe:`/`motion-reduce:` variants for CSS animations, and the existing `formatShortcut()` utility already handles OS detection for keyboard shortcuts. The work is primarily creating new components (empty state illustrations, tooltip component, skeleton loaders) and systematically upgrading existing components (adding loading states to buttons, frosted glass to panel headers, pulse animation to dirty indicator).

**Primary recommendation:** Build reusable components (EmptyState, ShortcutTooltip, Skeleton, LoadingButton) first, then systematically apply them across the application. Add `MotionConfig reducedMotion="user"` at the app root for automatic accessibility compliance.

## Standard Stack

The established libraries/tools for this domain -- all already installed:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| framer-motion | ^12.31.0 | React animation library | Already used throughout app (Toast, FadeIn, AnimatedList, CollapsibleSidebar) |
| tailwindcss | ^4 | Utility-first CSS | Already used for all styling, has built-in animation utilities |
| lucide-react | ^0.563 | Icon library | Already used for all icons, has line-art style icons for empty states |
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcut handling | Already used in useKeyboardShortcuts hook |
| class-variance-authority | ^0.7.1 | Component variant styling | Already used in Button component |
| @catppuccin/tailwindcss | ^1.0.0 | Theme color palette | Provides all `ctp-*` color tokens used throughout |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx + tailwind-merge | ^2.1.1 / ^3.4.0 | Class name merging | Via `cn()` utility in `src/lib/utils.ts` |
| vite-plugin-svgr | ^4.5.0 | SVG as React components | Import SVG illustrations as components |
| zustand | ^5 | State management | If loading states need global coordination |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom skeleton components | react-loading-skeleton | Adds dependency; Tailwind's `animate-pulse` + custom shapes is sufficient |
| Custom tooltip | @radix-ui/react-tooltip or react-tooltip | Adds dependency; a simple custom tooltip with Tailwind is adequate for this scope |
| CSS @keyframes for pulse | framer-motion pulse | CSS keyframes are simpler, more performant, and don't need JS |

**No new packages needed. Use existing stack only.**

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── ui/
│   │   ├── button.tsx              # Extend with loading prop
│   │   ├── ShortcutTooltip.tsx     # NEW: tooltip with key badges
│   │   ├── Skeleton.tsx            # NEW: skeleton loader primitives
│   │   └── Toast.tsx               # Already polished
│   ├── empty-states/
│   │   ├── EmptyState.tsx          # NEW: reusable empty state wrapper
│   │   ├── EmptyChanges.tsx        # NEW: SVG + text for changes panel
│   │   ├── EmptyStashes.tsx        # NEW: SVG + text for stashes panel
│   │   ├── EmptyTags.tsx           # NEW: SVG + text for tags panel
│   │   └── EmptyHistory.tsx        # NEW: SVG + text for commit history
│   ├── animations/
│   │   ├── FadeIn.tsx              # Existing
│   │   └── AnimatedList.tsx        # Existing
│   └── [existing components...]    # Upgraded with loading states, tooltips
├── lib/
│   ├── animations.ts              # Existing animation variants
│   └── utils.ts                   # Existing cn() utility
├── hooks/
│   ├── useKeyboardShortcuts.ts    # Existing, has formatShortcut()
│   └── useReducedMotion.ts        # NEW: wrapper around framer-motion hook
└── index.css                      # Add custom @keyframes here
```

### Pattern 1: Reusable Empty State Component
**What:** A composable component that renders an SVG illustration, heading, description, and optional CTA button
**When to use:** Any panel that can have zero items

```tsx
interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 text-ctp-overlay0 mb-4">{icon}</div>
      <h3 className="text-sm font-medium text-ctp-subtext1 mb-1">{title}</h3>
      <p className="text-xs text-ctp-overlay0 max-w-48 mb-4">{description}</p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

### Pattern 2: Loading Button (Extend Existing Button)
**What:** Enhance the existing Button component with `loading` and `loadingText` props
**When to use:** Any button that triggers an async operation

```tsx
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: string;
}

// Inside the component:
{loading ? (
  <>
    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
    {loadingText || children}
  </>
) : (
  children
)}
```

### Pattern 3: Shortcut Tooltip Component
**What:** A tooltip that renders keyboard shortcut key badges with proper OS detection
**When to use:** On buttons that have registered keyboard shortcuts

```tsx
interface ShortcutTooltipProps {
  shortcut: string;
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}
```

Key styling: rounded key cap badges with subtle shadow, like VS Code tooltips.

### Pattern 4: Skeleton Loader Primitives
**What:** Simple reusable skeleton shapes that match content layout
**When to use:** Panel initial data loading

```tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("motion-safe:animate-pulse rounded bg-ctp-surface0", className)} />
  );
}
```

### Pattern 5: Frosted Glass Panel Headers
**What:** Upgrade sidebar `<summary>` elements with backdrop-blur and semi-transparent background

Key classes:
- `bg-ctp-base/70` -- semi-transparent background (70% opacity)
- `backdrop-blur-lg` -- 16px blur (within the 16-20px spec)
- `border-b border-ctp-surface0/50` -- subtle bottom border for definition

### Pattern 6: Dirty State Pulse Animation
**What:** CSS keyframe animation on the dirty state indicator dot

```css
@theme {
  --animate-dirty-pulse: dirty-pulse 2s ease-in-out infinite;

  @keyframes dirty-pulse {
    0%, 100% {
      filter: drop-shadow(0 0 0px var(--ctp-yellow));
      opacity: 1;
    }
    50% {
      filter: drop-shadow(0 0 4px var(--ctp-yellow));
      opacity: 0.7;
    }
  }
}
```

### Anti-Patterns to Avoid
- **Overusing framer-motion for simple CSS animations:** Use CSS `@keyframes` for pulse/shimmer. Reserve framer-motion for mount/unmount.
- **Adding tooltips to every button:** Only buttons that have keyboard shortcuts.
- **Blocking UI during loading:** Loading states are per-button/per-panel, never full-screen.
- **Ignoring reduced motion:** Every new animation MUST use `motion-safe:` prefix or check `useReducedMotion`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS detection for shortcuts | Custom navigator sniffing | Existing `formatShortcut()` in `useKeyboardShortcuts.ts` | Already handles Mac/Windows/Linux |
| Animation variants | Custom animation objects | Existing variants in `src/lib/animations.ts` | Already tested, consistent timing |
| Class name merging | String concatenation | Existing `cn()` in `src/lib/utils.ts` | Handles Tailwind class conflicts |
| Reduced motion detection | Custom media query listener | framer-motion `useReducedMotion` + Tailwind `motion-safe:` | Battle-tested, reactive |
| Spinner icon | Custom SVG spinner | Lucide's `Loader2` with `animate-spin` | Already used throughout codebase |
| Button variant styling | Inline conditional classes | CVA `buttonVariants` in `button.tsx` | Consistent, type-safe |

## Common Pitfalls

### Pitfall 1: Backdrop Blur Performance on Large Surfaces
**What goes wrong:** `backdrop-blur` can cause performance issues on large elements
**How to avoid:** Only apply blur to sticky headers (small surface area)

### Pitfall 2: Tooltip Positioning Edge Cases
**What goes wrong:** Tooltips overflow the viewport when buttons are near screen edges
**How to avoid:** Position tooltips below header buttons by default

### Pitfall 3: Loading State Race Conditions
**What goes wrong:** Button shows loading spinner but operation already completed
**How to avoid:** Use React Query's `isPending` directly, not manual useState

### Pitfall 4: Skeleton Loader Layout Shift
**What goes wrong:** Skeleton shapes don't match actual content dimensions
**How to avoid:** Size skeleton shapes to match real content

### Pitfall 5: SVG Illustrations Not Respecting Theme
**What goes wrong:** Line-art SVGs look wrong in dark/light themes
**How to avoid:** Use `currentColor` in SVGs and control via Tailwind classes

## Inventory of Changes Needed

### Buttons That Need Loading States
| Component | Button | Current State |
|-----------|--------|---------------|
| SyncButtons | Fetch/Pull/Push | HAS spinner (icon swap only, no text) |
| CommitForm | Commit | HAS full loading state |
| BranchList | Checkout | Missing |
| BranchItem | Merge/Delete | Missing |
| StashItem | Apply/Pop/Drop | Missing |
| TagItem | Delete | Missing |
| GitflowPanel | Start/Finish | Shows text in dialog |

### Panels That Need Empty States
| Panel | Component | Current | Needs |
|-------|-----------|---------|-------|
| Changes | StagingPanel | "No changes to commit" | Line art + friendly text |
| Stashes | StashList | "No stashes" | Line art + friendly text + optional CTA |
| Tags | TagList | "No tags" | Line art + friendly text + "Create tag" CTA |
| Commit History | CommitHistory | "No commits yet" | Line art + friendly text |

### Buttons That Need Shortcut Tooltips
| Button | Location | Shortcut |
|--------|----------|----------|
| Settings | Header | mod+, |
| Open | Header | mod+o |
| Stage All | StagingPanel | mod+shift+A |
| Fetch | SyncButtons | mod+shift+F |
| Pull | SyncButtons | mod+shift+L |
| Push | SyncButtons | mod+shift+P |
| Amend toggle | CommitForm | mod+shift+M |

### Panel Headers That Need Frosted Glass
All 5 `<summary>` elements in RepositoryView.tsx:
1. Branches, 2. Stashes, 3. Tags, 4. Gitflow, 5. Worktrees

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All component files in `src/components/`, `src/hooks/`, `src/lib/`, `src/stores/`
- `package.json` -- verified all library versions
- Tailwind CSS v4 animation docs
- framer-motion accessibility docs

### Secondary (MEDIUM confidence)
- framer-motion MotionConfig docs
- Epic Web Dev glassmorphism guide

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project
- Architecture: HIGH -- patterns derived from existing codebase analysis
- Empty states: HIGH -- all target components identified
- Loading states: HIGH -- all async operations inventoried
- Tooltips: HIGH -- existing formatShortcut() utility mapped
- Frosted glass: HIGH -- existing Header pattern provides template
- Dirty pulse: HIGH -- CSS animation approach verified via Tailwind v4 docs
- Reduced motion: HIGH -- both framer-motion and Tailwind v4 support verified

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable domain, no rapidly changing dependencies)
