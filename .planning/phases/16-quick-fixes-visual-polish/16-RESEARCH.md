# Phase 16: Quick Fixes & Visual Polish - Research

**Researched:** 2026-02-06
**Domain:** React UI polish, framer-motion animations, Zustand state management, Rust backend data formatting
**Confidence:** HIGH

## Summary

This phase addresses seven specific UI bugs and cosmetic issues across the FlowForge Git client. Each issue has been traced to exact source files and root causes through codebase investigation.

The fixes span three layers: (1) frontend-only CSS/animation tweaks (modals, blades, diff header), (2) frontend display logic changes (stash labels, tag sorting, lane ordering), and (3) state management fixes (blade reset on repo switch). One fix (tag sorting by date) requires a small Rust backend change to expose a timestamp field.

**Primary recommendation:** Address each issue as an isolated, testable fix. Group the pure-frontend fixes together and handle the backend change (tags timestamp) as its own task since it requires Rust compilation and bindings regeneration.

## Detailed Findings Per Requirement

### UIPX-01: Modal Flicker Fix

**Root cause files:**
- `src/components/ui/dialog.tsx` (lines 38-39, 88-119)
- `src/index.css` (lines 71-89)

**What happens:** The dialog uses a CSS keyframe `dialog-content-show` that animates from `translate(-50%, -48%) scale(0.96)` to `translate(-50%, -50%) scale(1)`. On the first frame of render, before the CSS animation applies, the dialog appears at its Tailwind-positioned location, then the animation overrides the transform, causing a brief visual jump.

**Fix:** Replace CSS keyframe animation with framer-motion `AnimatePresence` + `motion.div`. Use `initial={{ opacity: 0, scale: 0.96 }}` and `animate={{ opacity: 1, scale: 1 }}`. This also respects the global `MotionConfig reducedMotion="user"`.

**Changes needed:**
1. `src/components/ui/dialog.tsx`: Wrap overlay and content in `AnimatePresence`, use `motion.div`
2. `src/index.css`: Remove `@keyframes dialog-content-show` and `dialog-overlay-show`

### UIPX-02: Subtler Blade Animation

**Root cause files:**
- `src/components/blades/BladeContainer.tsx` (lines 33-36)
- `src/lib/animations.ts` (lines 92-104)

**Current:** `initial={{ x: "100%", opacity: 0 }}` with spring `stiffness: 300, damping: 30` — produces noticeable overshoot and bounce.

**Fix:** Switch to tween with shorter distance:
```tsx
initial={{ x: 40, opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
exit={{ x: 40, opacity: 0 }}
transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
```
Also update `bladeSlideIn` variant in `lib/animations.ts` to match.

### STSH-01: Human-Friendly Stash Labels

**Root cause files:**
- `src/components/stash/StashItem.tsx` (lines 41-46)
- `src-tauri/src/git/stash.rs` (lines 35-41)

**Current:** Shows `stash@{N}` as primary label with raw message below.

**Fix:** Parse the stash message to extract branch name and description. Git messages follow format `"On <branch>: <rest>"`. Make parsed description primary, demote `stash@{N}` to secondary.

### TAGS-01: Tags Sorted by Most Recent First

**Root cause files:**
- `src-tauri/src/git/tag.rs` (line 80: `tags.sort_by(|a, b| a.name.cmp(&b.name))`)

**Current:** Alphabetical sort. `TagInfo` has no timestamp field.

**Fix:** Add `created_at_ms: f64` to `TagInfo` in Rust. For annotated tags use tagger timestamp, for lightweight tags use target commit timestamp. Sort descending by timestamp. Requires bindings regeneration.

### TOPO-01: Main/Develop Labels Before Feature Branches

**Root cause files:**
- `src/components/topology/LaneHeader.tsx` (lines 15-32)
- `src/components/topology/TopologyPanel.tsx` (lines 39-61)

**Current:** `LaneHeader.tsx` already has `BRANCH_TYPE_ORDER` map (main=0, develop=1, feature=4). Labels ARE sorted correctly.

**Potential issue:** Graph columns may not match header order — HEAD ancestry gets column 0 regardless of branch type. If HEAD is on a feature branch, main gets a later column.

**Fix:** Verify header sorting works. If column ordering is also needed, modify `assign_lanes()` in Rust to prioritize main/develop columns.

### UIPX-05: Diff Blade Header with Path + Bold Filename

**Root cause files:**
- `src/components/blades/DiffBlade.tsx` (lines 78-81)

**Current:** Single gray span showing full path.

**Fix:** Split into directory path (gray `text-ctp-overlay1`) + filename (bold `text-ctp-text font-semibold`).

### NAVG-01: Blade View Reset on Repository Switch

**Root cause files:**
- `src/components/Header.tsx` (lines 116-155, `handleRepoSwitch`)
- `src/stores/blades.ts` (line 74-77, `resetStack`)

**Current:** `handleRepoSwitch` calls `openRepository(path)` but never calls `resetStack()`. Blade persists with stale content.

**Fix:** Add `useBladeStore.getState().resetStack()` in `handleRepoSwitch` after `openRepository()` succeeds.

## Common Pitfalls

1. **Forgetting bindings regeneration** after Rust type changes — specta auto-generates `src/bindings.ts`
2. **AnimatePresence requires `key`** on direct motion children and `exit` variants
3. **Blade reset race condition** — reset AFTER `openRepository()` resolves, BEFORE new data loads
4. **CSS keyframes bypass MotionConfig** — use framer-motion for all animations to respect `reducedMotion`

## Fix Independence

All seven fixes are independent. No fix depends on another. The only cross-cutting concern: tags backend change (TAGS-01) must complete before frontend work that depends on the new timestamp field.

---
*Research date: 2026-02-06*
