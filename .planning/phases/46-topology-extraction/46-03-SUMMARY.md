---
status: complete
started: 2026-02-11
completed: 2026-02-11
---

# Plan 46-03 Summary: Wire Extension + Remove Old Core References

## What was built

Completed the topology extraction by wiring the extension into App.tsx, removing all hardcoded core references, and ensuring graceful degradation across settings, shortcuts, and Extension Manager.

## Key changes

### App.tsx
- Registered topology as 13th built-in extension (after init-repo, before github)
- Guarded defaultTab setting with `useBladeRegistry.getState().blades.has("topology-graph")`
- Removed topology-specific file watcher code (now in extension lifecycle)
- Removed unused `useTopologyStore` import alias

### navigation.ts
- show-history command now checks blade registry before switching process
- Silently no-ops when topology extension is disabled

### useKeyboardShortcuts.ts
- mod+2 shortcut conditionalized on blade registry
- Enter key handler for topology commit details guarded by blade registry

### _discovery.ts
- Removed "topology-graph" from EXPECTED_TYPES (registered by extension now)

### GeneralSettings.tsx
- History and Topology tab options show as disabled with tooltip when extension is off
- Reactive subscription to blade registry for live updates

### extensionCategories.ts
- Topology categorized as "source-control"

### Deleted
- Entire `src/core/blades/topology-graph/` directory (10 files)

## TOPO Requirements Coverage
| Req | Status | Where |
|-----|--------|-------|
| TOPO-01 | ✓ | registerBuiltIn in App.tsx |
| TOPO-02 | ✓ | coreOverride: true in extension index.ts |
| TOPO-03 | ✓ | commit-list-fallback via rootBladeForProcess |
| TOPO-04 | ✓ | ProcessNavigation auto-hides tab (Phase 43) |
| TOPO-05 | ✓ | File watcher in extension with onDispose |
| TOPO-06 | ✓ | show-history + mod+2 registry-aware |
| TOPO-07 | ✓ | defaultTab guarded + settings UI disabled options |
| TOPO-08 | ✓ | Data stays in GitOpsStore (untouched) |
| TOPO-09 | ✓ | topology in source-control category |

## Deviations
None.

## Self-Check: PASSED
- TypeScript compilation clean
- 270 tests pass (3 pre-existing Monaco failures unchanged)
- Zero stale imports to old directory
- All 9 TOPO requirements addressed
