---
status: investigating
trigger: "Backspace key doesn't navigate to parent directory in repo browser"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:00:00Z
---

## Current Focus

hypothesis: The onKeyDown handler is on the listbox div, but focus is on the child FileRow buttons. Key events bubble up and should reach the div. However, the real issue is that the listbox div itself never receives focus — focus goes to individual FileRow buttons (which are `<button>` elements). The Backspace key on a focused button may trigger browser default behavior (navigating back) OR the event may not bubble properly due to the button element consuming it.
test: Trace the event flow from FileRow button -> parent div onKeyDown
expecting: The keydown event should bubble from focused button to the parent div
next_action: Analyze whether the focus model prevents the handler from firing

## Symptoms

expected: Pressing Backspace while browsing a directory navigates to the parent directory
actual: Backspace key does nothing (or triggers browser back navigation)
errors: None reported
reproduction: Open repo browser, navigate into a subdirectory, press Backspace
started: Unknown — may have always been broken

## Eliminated

## Evidence

- timestamp: 2026-02-07T00:01:00Z
  checked: RepoBrowserBlade.tsx keyboard handler (lines 87-127)
  found: handleKeyDown includes Backspace case (line 115-123) with e.preventDefault() and navigation logic
  implication: The handler code itself is correctly implemented

- timestamp: 2026-02-07T00:02:00Z
  checked: Where onKeyDown is attached (line 159)
  found: onKeyDown={handleKeyDown} is on the listbox div (line 155-160), NOT on individual FileRow buttons
  implication: Key events must bubble from focused FileRow button up to the parent div

- timestamp: 2026-02-07T00:03:00Z
  checked: FileRow component (lines 255-291)
  found: FileRow is a <button> element with tabIndex={isFocused ? 0 : -1}. Focus goes to the button.
  implication: Keyboard events fire on the button first, then bubble to the parent div

- timestamp: 2026-02-07T00:04:00Z
  checked: Event bubbling for keyboard events on buttons
  found: Keyboard events DO bubble from button to parent div. onKeyDown on parent div WILL receive events from child buttons.
  implication: The handler should be reachable. The issue is likely elsewhere.

- timestamp: 2026-02-07T00:05:00Z
  checked: The `path` guard on line 117
  found: Backspace handler has `if (path)` guard. When path is "" (root), this is falsy, so Backspace does nothing at root.
  implication: At root, Backspace correctly does nothing. But in subdirectories, path should be truthy.

- timestamp: 2026-02-07T00:06:00Z
  checked: Focus management after replaceBlade navigation
  found: replaceBlade creates a NEW blade with new id (crypto.randomUUID). AnimatePresence in BladeContainer unmounts old blade, mounts new one. The new RepoBrowserBlade starts with focusedIndex=0. useEffect on line 46-48 calls itemRefs.current[0]?.focus() — BUT this runs before the query has loaded data, so itemRefs.current[0] is null.
  implication: After navigating INTO a directory, no FileRow has focus. The listbox div has no tabIndex so it can't receive focus either. Without focus on any element inside the listbox div, keyboard events never fire on it.

- timestamp: 2026-02-07T00:07:00Z
  checked: The listbox div (lines 155-160)
  found: No tabIndex attribute on the div. It cannot receive focus directly.
  implication: If no child button has focus (because data hasn't loaded yet or user clicked outside), the keyboard handler is unreachable.

- timestamp: 2026-02-07T00:08:00Z
  checked: Timing of useEffect for focus vs useQuery data loading
  found: useEffect([focusedIndex]) fires on mount with focusedIndex=0, but entries is undefined (still loading). itemRefs.current[0] is null because no FileRow elements have rendered yet. When data arrives and entries populate, focusedIndex is still 0, but the useEffect doesn't re-run because focusedIndex didn't change (it was already 0).
  implication: ROOT CAUSE — After navigating into a directory via replaceBlade, the new RepoBrowserBlade mounts. The focus effect runs before data loads. When data loads and FileRows render, the focus effect does NOT re-run because focusedIndex is still 0 (unchanged). No FileRow gets focus. User must manually click/tab to a FileRow before keyboard navigation (including Backspace) works.

## Resolution

root_cause: After navigating into a directory (via replaceBlade), the new RepoBrowserBlade component mounts with focusedIndex=0. The useEffect that focuses itemRefs.current[focusedIndex] runs immediately on mount, BEFORE the useQuery has loaded data and BEFORE any FileRow elements have rendered. When data finally arrives and FileRows render, focusedIndex is still 0 — unchanged — so the useEffect does NOT re-fire. No FileRow receives programmatic focus. Without focus on any element inside the listbox container, the onKeyDown handler on the listbox div is unreachable. The Backspace key (and all other keyboard navigation) is completely inert until the user manually clicks or tabs to a FileRow.
fix:
verification:
files_changed: []
