---
phase: 14-ui-polish
plan: 03
status: complete
started: 2026-02-06
completed: 2026-02-06
key-files:
  created: []
  modified:
    - src/components/ui/button.tsx
    - src/components/stash/StashItem.tsx
    - src/components/tags/TagItem.tsx
    - src/components/branches/BranchItem.tsx
    - src/components/sync/SyncButtons.tsx
    - src/components/Header.tsx
    - src/components/commit/CommitForm.tsx
    - src/components/navigation/BranchSwitcher.tsx
commits:
  - hash: 29a524f
    message: "feat(14-03): extend Button with loading props and add sidebar item loading states"
  - hash: 20f6b1b
    message: "feat(14-03): add ShortcutTooltip to buttons and dirty pulse to BranchSwitcher"
---

# Plan 14-03 Summary: Button Loading + Tooltips + Dirty Pulse

## What Was Built

### Button Loading States

Enhanced `Button` component with `loading` and `loadingText` props. When `loading=true`, shows Loader2 spinner and auto-disables. Backward-compatible — existing usage unaffected.

Per-action loading spinners added to sidebar items:
- **StashItem**: Apply/Pop/Drop show individual spinners, all disabled during any action
- **TagItem**: Delete shows spinner during operation
- **BranchItem**: Checkout/Merge/Delete show individual spinners, all disabled during any action

### Keyboard Shortcut Tooltips

6 buttons wrapped with ShortcutTooltip showing OS-aware styled key badges after 500ms hover:
- Settings (`mod+,`)
- Open Repository (`mod+o`)
- Fetch (`mod+shift+F`)
- Pull (`mod+shift+L`)
- Push (`mod+shift+P`)
- Amend toggle (`mod+shift+M`, side=top)

### Dirty Pulse Animation

BranchSwitcher's dirty indicator dot now uses `motion-safe:animate-dirty-pulse` — a gentle yellow glow pulse that respects OS prefers-reduced-motion setting.

## Deviations

- Changed callback prop types from `() => Promise<void>` to `() => Promise<unknown>` in StashItem, TagItem, BranchItem to match store functions that return `Promise<boolean>`.

## Self-Check: PASSED

- [x] Button component accepts loading and loadingText props
- [x] Loading buttons show spinner icon, become disabled, and optionally change text
- [x] StashItem Apply/Pop/Drop buttons show individual loading spinners during operations
- [x] TagItem Delete button shows loading spinner during operation
- [x] BranchItem Checkout/Merge/Delete buttons show individual loading spinners
- [x] Settings, Open, Fetch, Pull, Push, Amend buttons show keyboard shortcut tooltips
- [x] Shortcut tooltips display OS-appropriate styled key badges after 500ms hover delay
- [x] Dirty state indicator dot on BranchSwitcher has gentle glow pulse animation
