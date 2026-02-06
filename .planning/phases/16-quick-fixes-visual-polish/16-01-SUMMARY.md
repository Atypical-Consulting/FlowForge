---
phase: 16-quick-fixes-visual-polish
plan: 01
status: complete
started: 2026-02-06
completed: 2026-02-06
key-files:
  created: []
  modified:
    - src/components/ui/dialog.tsx
    - src/index.css
    - src/components/blades/BladeContainer.tsx
    - src/lib/animations.ts
commits:
  - hash: 77e55ed
    message: "fix(16-01): fix modal flicker with framer-motion AnimatePresence"
  - hash: bee43c6
    message: "fix(16-01): make blade slide animation subtler with 40px tween"
---

## Summary

Fixed two animation polish issues: modal flicker and aggressive blade slide-in.

## What Was Built

### Task 1: Modal flicker fix
- Replaced CSS keyframe animations in dialog.tsx with framer-motion `AnimatePresence` + `motion.div`
- Overlay fades in with opacity animation (150ms ease-out)
- Content scales from 0.96 to 1.0 with opacity (150ms ease-out)
- Removed `dialog-overlay-show` and `dialog-content-show` keyframes from index.css
- Dialog stays positioned via CSS (`fixed left-1/2 top-1/2 -translate-x/y-1/2`) — no position animation that could cause flicker
- Excluded conflicting HTML drag/animation event handlers from motion.div spread props

### Task 2: Subtler blade slide animation
- Changed blade slide-in from `x: "100%"` (full viewport width) to `x: 40` (40px offset)
- Switched from bouncy spring (`stiffness: 300, damping: 30`) to smooth tween (`easeOut`, 200ms)
- Exit animation uses `easeIn` at 150ms for snappy dismissal
- Updated both `BladeContainer.tsx` inline props and `animations.ts` shared variant

## Deviations

- Had to exclude `onDrag`, `onDragStart`, `onDragEnd`, `onDragOver`, and `onAnimationStart` HTML event handlers from the props spread onto `motion.div` to avoid TypeScript type conflicts between React's drag events and framer-motion's drag system. No functional impact since dialogs don't use drag.

## Self-Check: PASSED
- No TypeScript errors (excluding pre-existing bindings.ts TS2440)
- CSS keyframes for dialog removed from index.css
- framer-motion AnimatePresence confirmed in dialog.tsx
- Blade animation confirmed using x: 40 and tween transition
