---
plan: 30-05
title: Fix Cmd+K shortcut and singleton blade feedback
status: complete
started: 2026-02-09T21:55:00Z
completed: 2026-02-09T21:57:00Z
---

## What was built
- Added `mod+k` hotkey binding for command palette (alongside existing `mod+shift+p`)
- Updated command palette command registration to display `mod+k` as the shortcut
- Added `notifySingletonExists` action to XState navigation machine
- Singleton blade duplicate pushes now show a toast notification instead of being silently dropped

## Key files
### Created
- (none)

### Modified
- `src/hooks/useKeyboardShortcuts.ts` — added mod+k hotkey binding
- `src/commands/navigation.ts` — updated shortcut display to mod+k
- `src/machines/navigation/navigationMachine.ts` — added notifySingletonExists action and fallback transition
- `src/machines/navigation/navigationMachine.test.ts` — added singleton feedback test

## Self-Check
- [x] Cmd+K binding added
- [x] Command palette shows mod+k shortcut
- [x] Singleton push shows toast feedback
- [x] New test passes
- [x] All existing tests pass
- [x] TypeScript compiles cleanly (excluding pre-existing bindings.ts error)
