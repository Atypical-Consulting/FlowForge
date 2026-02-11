# Phase 46: Topology Extraction - Synthesized Research

**Researched:** 2026-02-11
**Sources:** UX (46-UX-RESEARCH.md), Architecture (46-ARCH-RESEARCH.md), Expert Dev (46-DEV-RESEARCH.md)
**Confidence:** HIGH across all three perspectives

## Key Cross-Cutting Decisions

### 1. Extension Pattern: coreOverride blade + command contribution
All three researchers agree: register `topology-graph` blade via `api.registerBlade({ coreOverride: true })` following the Phase 45 init-repo pattern. Contribute `show-history` command via `api.registerCommand()`.

### 2. Topology Data: Keep in GitOpsStore (TOPO-08)
Architecture and Dev agree: `topology.slice.ts` stays in GitOpsStore for data-layer stability. The extension interacts with the store via direct import (same as worktrees extension).

**DEV DIVERGENCE NOTE:** The Expert Dev researcher proposes moving the topology slice to a standalone extension-owned store. However, the Architecture researcher and TOPO-08 requirement explicitly mandate keeping it in GitOpsStore. **Decision: Follow TOPO-08 — topology data stays in GitOpsStore.**

### 3. ProcessNavigation: Already handles tab hiding (Phase 43)
All agree: No changes needed in ProcessNavigation.tsx — it already checks `blades.has("topology-graph")` and auto-switches to staging when topology is deactivated.

### 4. File Watcher: Move from App.tsx to extension lifecycle
All agree: Remove topology-specific refresh from App.tsx file watcher. Extension registers its own Tauri event listener via `api.onDispose()` pattern.

### 5. Keyboard Shortcuts: Registry-aware core commands
Architecture and UX agree: Keep `mod+2` in `useKeyboardShortcuts.ts` but make it conditional on `blades.has("topology-graph")`. Move the `show-history` command from `navigation.ts` to the extension. The Enter key shortcut is safe as-is (dead code path when topology disabled).

### 6. Settings Degradation: Silent fallback + preserve preference
All agree: Guard `defaultTab` check with blade registry. Hide topology/history options in GeneralSettings when extension disabled. Do NOT reset stored preference.

### 7. Fallback Blade: CommitHistory wrapper for crash safety
UX and Architecture agree: Create a `commit-list-fallback` blade in core that wraps `CommitHistory`. Update `rootBladeForProcess("topology")` to check blade registry and return fallback when topology-graph is unregistered.

### 8. Critical Pre-requisite: parseConventionalType extraction
Architecture and Dev identified: `CommitTypeIcon` (core) imports `parseConventionalType` from `topology-graph/components/layoutUtils`. This must be extracted to a shared core location BEFORE moving topology files.

## Files to Move (from core to extension)

| File | Current Location | New Location |
|------|-----------------|--------------|
| TopologyRootBlade.tsx | core/blades/topology-graph/ | extensions/topology/blades/ |
| TopologyPanel.tsx | core/blades/topology-graph/components/ | extensions/topology/components/ |
| TopologyEmptyState.tsx | core/blades/topology-graph/components/ | extensions/topology/components/ |
| CommitBadge.tsx | core/blades/topology-graph/components/ | extensions/topology/components/ |
| LaneHeader.tsx | core/blades/topology-graph/components/ | extensions/topology/components/ |
| LaneBackground.tsx | core/blades/topology-graph/components/ | extensions/topology/components/ |
| layoutUtils.ts | core/blades/topology-graph/components/ | extensions/topology/lib/ |
| registration.ts | core/blades/topology-graph/ | DELETED (replaced by extension) |
| TopologyRootBlade.test.tsx | core/blades/topology-graph/ | extensions/topology/__tests__/ |

## Files Staying in Core

| File | Why |
|------|-----|
| topology.slice.ts (GitOpsStore) | TOPO-08: data layer stability |
| useCommitGraph.ts | Hook wrapping core store slice |
| CommitHistory.tsx | Shared component used by fallback |
| ProcessNavigation.tsx | Already handles dynamic visibility |
| bladeTypes.ts | "topology-graph" stays in BladePropsMap (type-level) |

## Files Modified in Core

| File | Change |
|------|--------|
| App.tsx | Add registerBuiltIn("topology"), remove topology file watcher lines |
| _discovery.ts | Remove "topology-graph" from EXPECTED_TYPES |
| useKeyboardShortcuts.ts | Conditionalize mod+2 on blade registry |
| navigation.ts | Remove "show-history" command (moved to extension) |
| GeneralSettings.tsx | Filter topology option when disabled |
| CommitTypeIcon.tsx | Fix parseConventionalType import path |
| actions.ts | Make rootBladeForProcess registry-aware |

## New Files

| File | Purpose |
|------|---------|
| extensions/topology/index.ts | onActivate/onDeactivate |
| extensions/topology/manifest.json | Extension metadata |
| extensions/topology/README.md | Documentation |
| core/blades/commit-list-fallback/ | Fallback blade for disabled topology |
| core/lib/commitClassifier.ts | Extracted parseConventionalType |

## Risk Assessment (consolidated)

| Risk | Level | Mitigation |
|------|-------|------------|
| rootBladeForProcess returns unregistered blade | HIGH | Registry check + fallback blade |
| parseConventionalType cross-dependency | HIGH | Extract to core/lib before moving |
| Extension activation timing vs defaultTab | HIGH | Move defaultTab topology logic into extension onActivate |
| Keyboard shortcut gap (no extension keybinding API) | MEDIUM | Conditionalize in core, contribute command for palette |
| Double file watcher registration | MEDIUM | Remove App.tsx topology lines when adding extension listener |
| Test import paths after move | LOW | Update after move |

## Execution Order Recommendation

1. Extract parseConventionalType to core/lib/commitClassifier.ts
2. Create fallback blade (commit-list-fallback)
3. Make rootBladeForProcess registry-aware
4. Create topology extension skeleton (manifest, index.ts)
5. Move topology components to extension directory
6. Wire extension: blade registration, command, file watcher
7. Update core: remove old registration, shortcuts, commands, file watcher
8. Update settings: guard defaultTab, filter GeneralSettings options
9. Register in App.tsx as 13th built-in extension
10. Clean up old topology-graph directory

---
*Synthesized from 3 parallel research streams: UX, Architecture, Expert Development*
*Research date: 2026-02-11*
