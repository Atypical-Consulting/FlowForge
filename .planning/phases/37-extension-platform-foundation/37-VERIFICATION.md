---
phase: 37-extension-platform-foundation
verified: 2026-02-10T20:22:41Z
status: passed
score: 5/5 must-haves verified
---

# Phase 37: Extension Platform Foundation Verification Report

**Phase Goal:** Extensions can contribute context menus, sidebar panels, status bar widgets, and git operation hooks through the expanded ExtensionAPI
**Verified:** 2026-02-10T20:22:41Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Right-clicking on a branch shows extension-contributed context menu items | VERIFIED | `BranchItem.tsx:51-58` has `onContextMenu` handler calling `showMenu("branch-list", ...)`. `ContextMenuPortal` renders grouped items via portal. `ContextMenuRegistry` filters by location and `when()` condition. All wired in `App.tsx:126`. |
| 2 | An extension can register a sidebar panel section that renders in the repository view alongside core sections | VERIFIED | `ExtensionAPI.contributeSidebarPanel()` at `:198-208` registers with namespaced ID and clamped priority. `DynamicSidebarPanels` in `RepositoryView.tsx:53-84` subscribes to `useSidebarPanelRegistry`, renders visible panels with `<details>/<summary>` pattern matching core sections. Error boundary wraps each panel. |
| 3 | An extension can contribute a status bar widget that displays live state at the bottom of the window | VERIFIED | `ExtensionAPI.contributeStatusBar()` at `:215-225` registers with namespaced ID and clamped priority. `StatusBar` component in `StatusBar.tsx:31-64` reads from `useStatusBarRegistry`, renders left/right zones with clickable and static widget modes. Mounted in `App.tsx:123` conditionally when repo is open. |
| 4 | An extension receives git operation events (onDidCommit, onDidPush) when the user performs git actions | VERIFIED | `ExtensionAPI.onDidGit()` at `:231-238` delegates to `gitHookBus.onDid()`. Emissions wired: `useCommitExecution.ts:29,48` (push, commit), `toolbar-actions.ts:192,217,242` (fetch, pull, push), `branches.slice.ts:67,79,102,119` (branch-create, checkout, branch-delete, merge). 8 git operations covered across 3 files. |
| 5 | An extension's onDispose callbacks fire during deactivation, cleaning up subscriptions and timers | VERIFIED | `ExtensionAPI.onDispose()` at `:258-260` collects disposables. `cleanup()` at `:269-331` executes in order: existing registries -> new UI registries -> git hooks -> disposables (LIFO). Each disposable in individual try/catch. Test confirms reverse order, error isolation, and array reset. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/contextMenuRegistry.ts` | Zustand store for context menu registration | VERIFIED | 133 lines, Map-based store with register/unregister/unregisterBySource, getItemsForLocation with when() filtering and group/priority sorting, showMenu/hideMenu, devtools middleware |
| `src/lib/sidebarPanelRegistry.ts` | Zustand store for sidebar panel registration | VERIFIED | 93 lines, Map-based store with register/unregister/unregisterBySource, getVisiblePanels with priority sorting and when() filtering, visibilityTick, devtools middleware |
| `src/lib/statusBarRegistry.ts` | Zustand store for status bar item registration | VERIFIED | 104 lines, Map-based store with register/unregister/unregisterBySource, getLeftItems/getRightItems with alignment filtering and priority sorting, visibilityTick, devtools middleware |
| `src/lib/gitHookBus.ts` | Singleton event bus for git operation events | VERIFIED | 162 lines, GitHookBus class with onDid/onWill handlers, emitDid (parallel via Promise.allSettled, error-isolated), emitWill (sequential, fail-open, can cancel), re-entrancy guard, removeBySource, exported singleton |
| `src/components/ui/ContextMenu.tsx` | Portal-based context menu component | VERIFIED | 96 lines, createPortal to document.body, grouped items with separators, Escape key + click-outside dismissal, viewport clamping, role="menu"/role="menuitem", auto-focus |
| `src/components/ui/StatusBar.tsx` | Status bar with left/right zones | VERIFIED | 65 lines, reads from useStatusBarRegistry, left/right zones with useMemo, clickable (button) and static (span) widget modes, returns null when empty, role="status" |
| `src/components/RepositoryView.tsx` | DynamicSidebarPanels zone | VERIFIED | DynamicSidebarPanels component at lines 53-84, subscribes to useSidebarPanelRegistry, renders panels with details/summary pattern, ExtensionPanelErrorBoundary wraps each panel, inserted after Worktrees section at line 215 |
| `src/components/branches/BranchItem.tsx` | onContextMenu handler | VERIFIED | Lines 51-58, calls showMenu with "branch-list" location and branch context (branchName) |
| `src/extensions/ExtensionAPI.ts` | Extended per-extension API facade | VERIFIED | 333 lines, 6 new methods (contributeContextMenu, contributeSidebarPanel, contributeStatusBar, onDidGit, onWillGit, onDispose), 4 config interfaces, Disposable type, updated cleanup() covering all 7 registries + disposables |
| `src/extensions/__tests__/ExtensionAPI.test.ts` | Tests for new ExtensionAPI methods | VERIFIED | 263 lines, 10 tests covering namespacing, priority clamping, git hook integration, onDispose LIFO, error isolation, cleanup atomicity |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ContextMenu.tsx` | `contextMenuRegistry.ts` | `useContextMenuRegistry()` subscription | WIRED | Line 3: import, Lines 6-7: subscribes to activeMenu and hideMenu |
| `StatusBar.tsx` | `statusBarRegistry.ts` | `useStatusBarRegistry()` subscription | WIRED | Lines 2-3: import, Lines 32-33: subscribes to items and visibilityTick |
| `RepositoryView.tsx` | `sidebarPanelRegistry.ts` | `useSidebarPanelRegistry()` in DynamicSidebarPanels | WIRED | Line 11: import, Lines 54-58: subscribes to panels and visibilityTick |
| `BranchItem.tsx` | `contextMenuRegistry.ts` | onContextMenu calls showMenu | WIRED | Line 4: import, Lines 51-58: calls showMenu with location and context |
| `useCommitExecution.ts` | `gitHookBus.ts` | gitHookBus.emitDid in onSuccess | WIRED | Lines 29, 48: emitDid for push and commit |
| `toolbar-actions.ts` | `gitHookBus.ts` | gitHookBus.emitDid after operations | WIRED | Lines 192, 217, 242: emitDid for fetch, pull, push |
| `branches.slice.ts` | `gitHookBus.ts` | gitHookBus.emitDid after branch ops | WIRED | Lines 67, 79, 102, 119: emitDid for branch-create, checkout, branch-delete, merge |
| `App.tsx` | `StatusBar.tsx` | JSX child | WIRED | Line 12: import, Line 123: `{status && <StatusBar />}` |
| `App.tsx` | `ContextMenu.tsx` | JSX child | WIRED | Line 11: import, Line 126: `<ContextMenuPortal />` |
| `ExtensionAPI.ts` | `contextMenuRegistry.ts` | `useContextMenuRegistry.getState().register()` | WIRED | Lines 15-18: import, Line 185: register call in contributeContextMenu, Line 283: unregisterBySource in cleanup |
| `ExtensionAPI.ts` | `sidebarPanelRegistry.ts` | `useSidebarPanelRegistry.getState().register()` | WIRED | Line 19: import, Line 201: register call in contributeSidebarPanel, Line 286: unregisterBySource in cleanup |
| `ExtensionAPI.ts` | `statusBarRegistry.ts` | `useStatusBarRegistry.getState().register()` | WIRED | Lines 20-23: import, Line 218: register call in contributeStatusBar, Line 289: unregisterBySource in cleanup |
| `ExtensionAPI.ts` | `gitHookBus.ts` | `gitHookBus.onDid/onWill` | WIRED | Lines 24-30: import, Lines 232, 245: onDid/onWill calls, Line 293: removeBySource in cleanup |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| PLAT-01: Context menu items contributed by extensions on right-click | SATISFIED | None — ContextMenuRegistry + ContextMenuPortal + BranchItem wiring all verified |
| PLAT-02: Extensions register sidebar panel sections in repository view | SATISFIED | None — SidebarPanelRegistry + DynamicSidebarPanels + ExtensionAPI.contributeSidebarPanel all verified |
| PLAT-03: Extensions contribute status bar widgets showing state | SATISFIED | None — StatusBarRegistry + StatusBar component + ExtensionAPI.contributeStatusBar all verified |
| PLAT-04: Extensions listen to git operation events via GitHookBus | SATISFIED | None — GitHookBus with onDid/onWill + ExtensionAPI.onDidGit/onWillGit + 8 emission points across 3 files all verified |
| PLAT-05: Extensions use api.onDispose() for cleanup callbacks | SATISFIED | None — onDispose method + LIFO execution + error isolation in cleanup() all verified with tests |
| PLAT-06: ExtensionAPI expanded with context menu, sidebar, status bar, git hook methods | SATISFIED | None — 6 new methods + 4 config interfaces + Disposable type + updated cleanup() all verified |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns found in any Phase 37 artifact |

### Human Verification Required

### 1. Context Menu Visual Rendering
**Test:** Right-click a branch item in the sidebar, verify a styled context menu appears at the mouse position
**Expected:** A dark-themed menu with Catppuccin Mocha colors renders at click coordinates, clamped within viewport, dismisses on Escape or click-outside
**Why human:** Visual rendering, mouse position accuracy, and viewport clamping cannot be verified programmatically

### 2. StatusBar Layout Impact
**Test:** Open a repository, verify no status bar appears (no items registered). Then install a test extension that registers a status bar item, verify it renders at the bottom.
**Expected:** Zero layout impact when empty (returns null), footer bar appears with h-6 height when items registered
**Why human:** Layout impact and visual appearance need manual inspection

### 3. DynamicSidebarPanels Integration
**Test:** Install a test extension that registers a sidebar panel, verify it appears after Worktrees section with matching details/summary styling
**Expected:** Extension panel matches core section styling, error boundary catches failures gracefully
**Why human:** Visual consistency with core sections and error boundary behavior need manual testing

### Gaps Summary

No gaps found. All 5 observable truths are verified with evidence at all three levels (exists, substantive, wired). All 39 tests pass across 5 test files. Zero anti-patterns detected. All 6 requirements (PLAT-01 through PLAT-06) are satisfied.

The phase goal — "Extensions can contribute context menus, sidebar panels, status bar widgets, and git operation hooks through the expanded ExtensionAPI" — is fully achieved at the code level. Three items flagged for human verification are visual/UX concerns that cannot be assessed programmatically.

---

_Verified: 2026-02-10T20:22:41Z_
_Verifier: Claude (gsd-verifier)_
