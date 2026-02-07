---
status: resolved
trigger: "Breadcrumb from diff blade duplicates repo browser; Backspace doesn't work from diff blades"
created: 2026-02-08T00:00:00Z
updated: 2026-02-08T00:00:00Z
---

## Current Focus

hypothesis: Both issues stem from diff blade lacking blade-stack-aware navigation
test: Code review of BladeBreadcrumb, replaceBlade, and Backspace binding
expecting: Confirm root causes via code path analysis
next_action: Report findings

## Symptoms

expected: (1) Clicking breadcrumb parent from diff blade navigates to repo-browser without duplication. (2) Backspace from diff blade navigates to parent directory.
actual: (1) repo-browser blade stacked twice. (2) Backspace does nothing from diff blade.
errors: none
reproduction: (1) Open diff blade -> click breadcrumb parent -> click folder -> duplicate blade. (2) Open diff blade -> press Backspace -> nothing happens.
started: Since breadcrumb was added to diff blade

## Eliminated

(none needed - root causes found on first pass)

## Evidence

- timestamp: 2026-02-08
  checked: BladeBreadcrumb.tsx navigateTo/navigateToRoot
  found: Calls store.replaceBlade which replaces the LAST blade on the stack
  implication: When called from a diff blade header, it replaces the diff blade with a repo-browser. But the repo-browser that was ALREADY beneath the diff on the stack remains. Result: two repo-browser blades stacked.

- timestamp: 2026-02-08
  checked: stores/blades.ts replaceBlade implementation (line 82-88)
  found: replaceBlade slices off the last blade and appends the new one — purely positional, no type deduplication
  implication: No guard against creating a duplicate type on the stack

- timestamp: 2026-02-08
  checked: Backspace handler location
  found: Backspace is ONLY handled inside RepoBrowserBlade.tsx handleKeyDown (line 114-122), attached to the listbox div's onKeyDown
  implication: Backspace is blade-type-specific, not global. DiffBlade has no Backspace handler. useKeyboardShortcuts has Escape but no Backspace.

- timestamp: 2026-02-08
  checked: BladeContainer.tsx rendering
  found: Only the LAST blade is rendered as full content; all previous blades become collapsed BladeStrip items
  implication: Confirms that after breadcrumb replaces diff with repo-browser, the original repo-browser is still in the stack as a BladeStrip

## Resolution

root_cause: |
  **Issue 1 (Duplicate repo-browser):** BladeBreadcrumb calls `store.replaceBlade()` which replaces the LAST blade on the stack. Typical blade stack when viewing a diff from repo-browser:
    [root] -> [repo-browser path="src"] -> [diff filePath="src/foo.ts"]
  When user clicks breadcrumb segment "src" from the diff blade header, replaceBlade swaps the diff blade for a NEW repo-browser:
    [root] -> [repo-browser path="src"] -> [repo-browser path="src"]  (DUPLICATE)
  The correct behavior should be to pop back to the existing repo-browser and update its path, or pop all the way back and push a single repo-browser. The issue is that replaceBlade is position-blind — it does not check whether the blade beneath is already the same type with compatible props.

  **Issue 2 (Backspace in diff blade):** The Backspace key handler is defined exclusively inside RepoBrowserBlade.tsx as a React onKeyDown handler on the listbox div (lines 114-122). It is NOT registered as a global hotkey in useKeyboardShortcuts.ts, nor does DiffBlade register any Backspace handler. Therefore, Backspace only works when focus is inside a RepoBrowserBlade's listbox.

fix: (not applied - diagnosis only)
verification: (not applied - diagnosis only)
files_changed: []
