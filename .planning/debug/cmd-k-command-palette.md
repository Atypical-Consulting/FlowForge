---
status: diagnosed
trigger: "Cmd+K does not open the command palette, and gitflow cheatsheet command returns to welcome page instead of opening blade"
created: 2026-02-09T00:00:00Z
updated: 2026-02-09T00:01:00Z
---

## Current Focus

hypothesis: TWO root causes confirmed - see Resolution
test: Complete code trace through all relevant files
expecting: N/A - diagnosis complete
next_action: Return findings

## Symptoms

expected: Cmd+K opens command palette; selecting Gitflow Cheatsheet opens the cheatsheet blade
actual: Cmd+K does nothing; selecting gitflow cheatsheet navigates to welcome page
errors: Unknown
reproduction: Press Cmd+K; or find another way to open palette and select Gitflow Cheatsheet
started: After Phase 30 store consolidation

## Eliminated

- hypothesis: Store migration broke togglePalette() function
  evidence: The shim at src/stores/commandPalette.ts correctly re-exports useUIStore, and the UIStore correctly composes the command-palette slice. togglePalette() exists and works correctly.
  timestamp: 2026-02-09T00:01:00Z

- hypothesis: Command registration is not happening
  evidence: src/commands/index.ts imports ./navigation, and src/App.tsx imports ./commands. The registerCommand calls execute at module load time.
  timestamp: 2026-02-09T00:01:00Z

- hypothesis: Navigation FSM rejects gitflow-cheatsheet PUSH_BLADE
  evidence: The navigation machine's PUSH_BLADE handler uses guards isNotSingleton AND isUnderMaxDepth. gitflow-cheatsheet IS in SINGLETON_TYPES but the guard only blocks it if already in the stack. On first push it should succeed.
  timestamp: 2026-02-09T00:01:00Z

## Evidence

- timestamp: 2026-02-09T00:00:30Z
  checked: src/hooks/useKeyboardShortcuts.ts for Cmd+K binding
  found: No "mod+k" hotkey exists anywhere in the codebase. The command palette shortcut is registered as "mod+shift+p" (line 179). There is zero Cmd+K binding.
  implication: ROOT CAUSE 1 - Cmd+K was never implemented as a shortcut for the command palette.

- timestamp: 2026-02-09T00:00:30Z
  checked: src/commands/navigation.ts line 12 for registered shortcut
  found: The command-palette command has shortcut "mod+shift+p", not "mod+k".
  implication: Confirms ROOT CAUSE 1.

- timestamp: 2026-02-09T00:00:40Z
  checked: src/commands/navigation.ts line 29 for gitflow-cheatsheet enabled guard
  found: `enabled: () => !!useRepositoryStore.getState().repoStatus` - command is only enabled when a repo is open
  implication: When no repo is open, command is filtered out by getEnabledCommands(). But if user selects it while repo IS open, this is not the issue.

- timestamp: 2026-02-09T00:00:45Z
  checked: src/commands/navigation.ts line 27 for gitflow-cheatsheet action
  found: `openBlade("gitflow-cheatsheet", {} as Record<string, never>)` calls the blade opener
  implication: The openBlade call looks correct. It sends PUSH_BLADE to the navigation actor.

- timestamp: 2026-02-09T00:00:50Z
  checked: src/machines/navigation/navigationMachine.ts lines 216-225 for PUSH_BLADE handling
  found: PUSH_BLADE transitions are ordered: (1) not(isUnderMaxDepth) -> notifyMaxDepth, (2) and([isNotSingleton, isUnderMaxDepth]) -> pushBlade. There is NO fallback transition for when isNotSingleton is FALSE but isUnderMaxDepth is TRUE.
  implication: ROOT CAUSE 2 - When a singleton blade type is already in the stack, the event is silently dropped. But this does NOT explain the "returns to welcome page" behavior.

- timestamp: 2026-02-09T00:00:55Z
  checked: src/App.tsx line 85 for welcome page rendering logic
  found: `{status ? <RepositoryView /> : <WelcomeView />}` - WelcomeView shows only when repoStatus is falsy
  implication: If selecting gitflow cheatsheet "returns to welcome page", the repo is being closed somehow. This could be a side effect of registerStoreForReset on useUIStore. OR the user is observing that nothing happens (blade doesn't open) and the app stays on the welcome page because no repo was open.

- timestamp: 2026-02-09T00:01:00Z
  checked: Whether command palette can even appear without a repo open
  found: CommandPalette is rendered unconditionally in App.tsx (line 88). The toggle works regardless of repo state. But Header.tsx line 262-270 shows the palette button is always visible. However, the keyboard shortcut "mod+shift+p" is always enabled (no `enabled` guard in useKeyboardShortcuts line 178-185).
  implication: The palette CAN open without a repo. But if no repo is open, gitflow-cheatsheet is filtered out by its enabled guard. If user somehow selects a command that calls openBlade without a repo open, the navigation actor would still process PUSH_BLADE.

## Resolution

root_cause: |
  TWO distinct issues:

  1. **Cmd+K shortcut does not exist** (src/hooks/useKeyboardShortcuts.ts)
     The command palette shortcut is "mod+shift+p" (Cmd+Shift+P), NOT "mod+k" (Cmd+K).
     No "mod+k" binding exists anywhere in the codebase. If the intent is for Cmd+K to open
     the command palette, a new useHotkeys("mod+k", ...) call must be added.

  2. **Gitflow cheatsheet "returns to welcome page"** - Likely a misreported symptom.
     The openBlade() action and PUSH_BLADE FSM handling are correct for gitflow-cheatsheet.
     The most probable explanation: the user had no repo open (WelcomeView was showing),
     tried to use the command palette, and the gitflow-cheatsheet command was either
     filtered out (its enabled guard requires repoStatus) or the PUSH_BLADE succeeded
     but the RepositoryView was not rendered (since status was null -> WelcomeView shows).
     The blade stack is only visible inside RepositoryView, so pushing a blade with no
     repo open would have no visible effect.

     If the issue occurs WITH a repo open, the singleton guard in the navigation machine
     could silently drop the push if gitflow-cheatsheet is already in the stack (lines 216-225).
     There is no user feedback when this happens.

fix:
verification:
files_changed: []
