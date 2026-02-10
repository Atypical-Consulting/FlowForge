---
phase: 37-extension-platform-foundation
plan: 03
status: complete
---

# Plan 37-03 Summary: ExtensionAPI Expansion + onDispose

## What Was Built
Expanded the `ExtensionAPI` class with 6 new registration methods and the `onDispose` lifecycle pattern, bridging the gap between raw registries (Plan 37-01) and the extension developer experience. Extensions can now contribute context menu items, sidebar panels, status bar items, and register git hook handlers — all with automatic namespacing, priority clamping, tracking, and atomic cleanup.

## Key Files
### Modified
- `src/extensions/ExtensionAPI.ts` — Added 6 new methods (contributeContextMenu, contributeSidebarPanel, contributeStatusBar, onDidGit, onWillGit, onDispose), 4 new config interfaces, the Disposable type, and updated cleanup() to cover all 7 registry types + custom disposables

### Created
- `src/extensions/__tests__/ExtensionAPI.test.ts` — 10 comprehensive tests covering all new methods, priority clamping, namespacing, LIFO disposal, error isolation, and cleanup atomicity

## API Surface
New public methods added to `ExtensionAPI`:
- `contributeContextMenu(config: ExtensionContextMenuConfig): void`
- `contributeSidebarPanel(config: ExtensionSidebarPanelConfig): void`
- `contributeStatusBar(config: ExtensionStatusBarConfig): void`
- `onDidGit(operation: GitOperation, handler: DidHandler): void`
- `onWillGit(operation: GitOperation, handler: WillHandler): void`
- `onDispose(disposable: Disposable): void`

New exported types:
- `ExtensionContextMenuConfig`
- `ExtensionSidebarPanelConfig`
- `ExtensionStatusBarConfig`
- `ExtensionGitHookConfig`
- `Disposable`

## Architecture Notes
- **Namespacing**: All IDs follow `ext:{extensionId}:{config.id}` pattern, consistent with existing registerBlade/registerCommand
- **Priority clamping**: Sidebar panels clamped to 1-69 (reserves 70-100 for core), status bar items clamped to 1-89 (reserves 90-100 for core)
- **Cleanup order**: Existing registries (blades, commands, toolbar) -> new UI registries (context menu, sidebar, status bar) -> git hooks (removeBySource + individual unsubscribes) -> disposables (reverse registration order, LIFO)
- **Error resilience**: Each disposable and git hook unsubscribe wrapped in individual try/catch — one failure does not prevent others from executing
- **Zero breaking changes**: Existing methods (registerBlade, registerCommand, contributeToolbar) remain completely untouched

## Test Results
10 tests passing (0 failures):
1. contributeContextMenu registers with namespaced ID and source
2. contributeSidebarPanel registers with namespaced ID and clamped priority (69 max, 1 min, 50 default)
3. contributeStatusBar registers with namespaced ID and clamped priority (89 max, 1 min)
4. onDidGit registers handler that receives events
5. onWillGit registers handler that can cancel
6. onDispose collects callbacks and invokes them on cleanup
7. cleanup removes all contributions from all registries
8. onDispose callbacks execute in reverse order (LIFO)
9. cleanup continues after disposable error
10. cleanup resets tracking arrays so second cleanup only removes second batch

## Self-Check: PASSED
- [x] `npx tsc --noEmit` compiles without new errors
- [x] All 10 ExtensionAPI tests pass
- [x] Existing methods (registerBlade, registerCommand, contributeToolbar) remain unchanged
- [x] Priority clamping works: sidebar 1-69, status bar 1-89
- [x] cleanup() covers all 7 registry types + custom disposables
- [x] onDispose executes in reverse order with error isolation
- [x] Namespacing follows `ext:{extensionId}:{config.id}` pattern
- [x] No regressions in existing 176 tests (3 pre-existing Monaco mock failures unrelated)
