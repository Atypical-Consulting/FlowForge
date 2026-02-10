# Phase 40: Gitflow Extraction - Research Synthesis

**Synthesized:** 2026-02-10
**Sources:** 40-RESEARCH-UX.md, 40-RESEARCH-ARCHITECTURE.md, 40-RESEARCH-IMPLEMENTATION.md
**Confidence:** HIGH (3 independent researchers, consistent findings)

---

## Consensus Decisions

### 1. Follow Phase 38-39 Pattern Exactly
All three researchers agree: use `registerBuiltIn()` + `coreOverride: true` + `React.lazy()` + `api.cleanup()`. Components stay in their current locations, only registrations move to the extension entry point.

### 2. Keep gitflow.slice.ts in GitOpsStore (ADR-1)
All three agree: the slice has cross-slice dependencies on `loadBranches()` and `refreshRepoStatus()` that would require a bus-based event bridge if extracted. Keeping it in place eliminates split-brain risk and follows GFEX-06 ("always defers to Rust backend"). Phase 39 proved this pattern with conventional-utils.ts staying in core.

### 3. branchClassifier.ts MUST Stay in Core (ADR-2)
All three agree: 10+ core consumer files (topology graph, branch list, branch badges, useBranches hook) import from it. Only 4 gitflow-specific files use it. Branch classification is a core Git visualization feature. The Rust backend also provides a matching `BranchType` enum.

### 4. Sidebar Panel via Registry, Not Hardcoded
The hardcoded Gitflow `<details>` block in RepositoryView.tsx (lines 181-188) must be REMOVED. The extension uses `api.contributeSidebarPanel()` which renders through the existing `DynamicSidebarPanels` component with error boundaries and priority sorting.

### 5. Four Registrations to Migrate
| From (Core) | To (Extension) |
|-------------|---------------|
| `registration.ts` blade registration | `api.registerBlade({ coreOverride: true })` |
| Hardcoded `<GitflowPanel />` in RepositoryView | `api.contributeSidebarPanel()` |
| `tb:gitflow-guide` in toolbar-actions.ts | `api.contributeToolbar()` |
| `open-gitflow-cheatsheet` in navigation.ts | `api.registerCommand()` |

### 6. Import GitflowPanel Eagerly, Blade Lazily
UX and Implementation researchers agree: `GitflowPanel` should be eagerly imported (it's small, always visible when extension is active). `GitflowCheatsheetBlade` should use `React.lazy()` (only loaded when blade opens).

### 7. Sidebar Panel Priority 65, defaultOpen: false
Matches current behavior (panel renders collapsed). Priority 65 ensures first-among-extension-panels (clamped to 1-69 range). Panel appears below hardcoded Worktrees section -- minor acceptable cosmetic change.

### 8. Rust Backend Stays Unchanged
All 9 gitflow Rust IPC commands remain in the backend. The extraction is purely frontend.

### 9. No New Registries or API Surface Needed
Architecture research confirmed: no `BranchColorRegistry`, no `GitflowStateProvider`. The existing `SidebarPanelRegistry`, `ExtensionAPI`, and `useGitflowStore` are sufficient.

### 10. Defer Status Bar Widget and Context Menu (Stretch)
All researchers recommend deferring these to focus on the 5 success criteria first. Status bar and context menu contributions are optional enhancements.

---

## File Inventory Summary

### Create (2 files)
| File | Purpose |
|------|---------|
| `src/extensions/gitflow/index.ts` | Extension entry point (~60 lines) |
| `src/extensions/__tests__/gitflow.test.ts` | Extension lifecycle tests |

### Delete (1-2 files)
| File | Reason |
|------|--------|
| `src/blades/gitflow-cheatsheet/registration.ts` | Registration moves to extension |
| `src/blades/gitflow-cheatsheet/index.ts` | Empty barrel (if exists) |

### Modify (5 files)
| File | Change |
|------|--------|
| `src/App.tsx` | Add `registerBuiltIn` for gitflow extension |
| `src/components/RepositoryView.tsx` | Remove hardcoded Gitflow section (lines 181-188), remove GitflowPanel and GitMerge imports |
| `src/blades/_discovery.ts` | Remove "gitflow-cheatsheet" from EXPECTED_TYPES |
| `src/commands/toolbar-actions.ts` | Remove `tb:gitflow-guide` toolbar action |
| `src/commands/navigation.ts` | Remove `open-gitflow-cheatsheet` command |

### Keep Unchanged
All 10+ gitflow component files, stores, blades, Rust backend, branchClassifier.ts, topology graph components.

---

## Risk Matrix

| Risk | Severity | Mitigation |
|------|----------|------------|
| branchClassifier moved to extension | HIGH | Keep in core -- 10+ core consumers |
| Duplicate Gitflow panels (forgot to remove hardcoded) | MEDIUM | Remove RepositoryView lines 181-188 in same task as extension creation |
| Blade type namespaced as `ext:gitflow:gitflow-cheatsheet` | MEDIUM | Use `coreOverride: true` to preserve type name |
| Sidebar panel position shift (below Worktrees) | LOW | Accept -- minor cosmetic, priority 65 first-among-extensions |
| Command/toolbar ID namespace change | LOW | No user-facing impact -- palette/toolbar iterate all entries |
| Missing Suspense for sidebar panel | LOW | Import GitflowPanel eagerly, not via React.lazy() |

---

## Metadata

**Confidence breakdown:**
- Store architecture: HIGH -- 3/3 agree on Option A (keep slice in GitOpsStore)
- branchClassifier boundary: HIGH -- 3/3 agree (stays in core)
- Extension entry point: HIGH -- follows Phase 38/39 proven pattern
- Registration migration: HIGH -- each has verified ExtensionAPI equivalent
- Graceful degradation: HIGH -- null handling verified in code
- Testing: HIGH -- adapted from existing extension lifecycle tests

**Research date:** 2026-02-10
**Valid until:** 2026-03-12 (stable patterns, no external dependency changes)
