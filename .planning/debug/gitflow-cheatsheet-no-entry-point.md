---
status: resolved
trigger: "Investigate why the Gitflow cheatsheet blade is not accessible from anywhere in the UI"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:00:00Z
---

## Current Focus

hypothesis: The gitflow-cheatsheet blade is fully registered but has zero entry points — no header button, no command palette command, no keyboard shortcut, and no link from the GitflowPanel sidebar section.
test: Search entire codebase for any call to openBlade("gitflow-cheatsheet")
expecting: Zero results
next_action: Report root cause

## Symptoms

expected: User can open the Gitflow Cheatsheet blade from the UI (header button, command palette, sidebar link, or keyboard shortcut)
actual: The blade exists and is registered but there is no way to open it from any UI surface
errors: N/A (no runtime errors — the feature is simply unreachable)
reproduction: Look for any button/link/command that opens the gitflow-cheatsheet blade — none exist
started: Since the blade was created (feat 22-09)

## Eliminated

(none needed — root cause identified on first pass)

## Evidence

- timestamp: 2026-02-07
  checked: grep for openBlade("gitflow-cheatsheet") across entire src/
  found: Zero results. No code anywhere calls openBlade with "gitflow-cheatsheet".
  implication: The blade cannot be opened from any UI path.

- timestamp: 2026-02-07
  checked: src/components/Header.tsx — all openBlade calls
  found: Header has buttons for settings, repo-browser, changelog — but NO gitflow-cheatsheet button.
  implication: Entry point was never added to the header.

- timestamp: 2026-02-07
  checked: src/commands/repository.ts — command palette commands
  found: Commands exist for open-repo, close-repo, clone-repo, generate-changelog, refresh-all — but NO gitflow-cheatsheet command.
  implication: Entry point was never added to the command palette.

- timestamp: 2026-02-07
  checked: src/hooks/useKeyboardShortcuts.ts — all keyboard shortcuts
  found: Shortcuts for settings, stage-all, push, pull, fetch, amend, palette, escape, enter — but NO gitflow-cheatsheet shortcut.
  implication: Entry point was never added as a keyboard shortcut.

- timestamp: 2026-02-07
  checked: src/components/gitflow/GitflowPanel.tsx — sidebar Gitflow section
  found: Panel has Start/Finish flow buttons but NO link to the cheatsheet blade.
  implication: The most natural entry point (the Gitflow sidebar section) also lacks a link.

- timestamp: 2026-02-07
  checked: Blade registration infrastructure
  found: gitflow-cheatsheet is properly registered in bladeTypes.ts, bladeOpener.ts (SINGLETON_TYPES), useBladeNavigation.ts, registrations/gitflow-cheatsheet.ts, and registrations/index.ts. The blade component GitflowCheatsheetBlade.tsx exists and imports sub-components.
  implication: The blade itself is fully functional — only the entry point is missing.

## Resolution

root_cause: The gitflow-cheatsheet blade was built and registered (feat 22-09) but no entry point was ever wired up to open it. There is no header button, no command palette command, no keyboard shortcut, and no link from the GitflowPanel sidebar section. The blade is a dead-end — fully implemented but unreachable.

fix: (not applied — diagnosis only)
verification: (not applicable)
files_changed: []
