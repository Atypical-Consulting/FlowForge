# Requirements: FlowForge

**Defined:** 2026-02-11
**Core Value:** The intelligence is in the agent; the authority is in the infrastructure.

## v1.7 Requirements

Requirements for v1.7.0 Extensions Everywhere. Each maps to roadmap phases.

### Infrastructure (Registry Migration & Tech Debt)

- [ ] **INFRA-01**: commandRegistry migrated to Zustand store with backward-compatible function exports
- [ ] **INFRA-02**: previewRegistry migrated to Zustand store with source-based cleanup support
- [ ] **INFRA-03**: CommandPalette reactively updates when extensions register/unregister commands
- [ ] **INFRA-04**: Process tab visibility hook conditionally hides topology tab when extension disabled
- [ ] **INFRA-05**: WelcomeView uses BladeRegistry lookup instead of direct InitRepoBlade import
- [ ] **INFRA-06**: CC Zustand store explicitly reset when Conventional Commits extension disabled
- [ ] **INFRA-07**: 3 new ExtensionAPI methods (onDidNavigate, events, settings) added to sandbox-api-surface.ts

### Worktree Extraction

- [ ] **WKTR-01**: Worktree management registered as toggleable built-in extension via registerBuiltIn()
- [ ] **WKTR-02**: WorktreeSidebarPanel is self-contained (panel + create/delete dialogs) contributed via contributeSidebarPanel()
- [ ] **WKTR-03**: Worktree section in RepositoryView removed (no hardcoded JSX)
- [ ] **WKTR-04**: Worktree commands registered in command palette via extension
- [ ] **WKTR-05**: Worktree sidebar disappears cleanly when extension disabled
- [ ] **WKTR-06**: Worktree data slice stays in GitOpsStore (data layer stability)

### Init Repo Extraction

- [ ] **INIT-01**: Init Repo registered as toggleable built-in extension with early activation (before repo open)
- [ ] **INIT-02**: Init Repo blade registered with coreOverride: true preserving "init-repo" type
- [ ] **INIT-03**: WelcomeView renders Init Repo via BladeRegistry lookup (not direct import)
- [ ] **INIT-04**: Fallback "Run git init" button displayed when Init Repo extension disabled
- [ ] **INIT-05**: Init Repo command registered in command palette via extension
- [ ] **INIT-06**: Init Repo blade store moves to extension directory

### Topology Extraction

- [ ] **TOPO-01**: Topology graph registered as toggleable built-in extension via registerBuiltIn()
- [ ] **TOPO-02**: Topology blade registered with coreOverride: true preserving "topology-graph" type
- [ ] **TOPO-03**: Simple commit list fallback blade renders when Topology extension disabled
- [ ] **TOPO-04**: Process tab hides when Topology extension disabled
- [ ] **TOPO-05**: File watcher auto-refresh moved from App.tsx into Topology extension lifecycle
- [ ] **TOPO-06**: Keyboard shortcut for topology moved into extension-contributed command
- [ ] **TOPO-07**: Settings defaultTab falls back to "changes" when Topology disabled
- [ ] **TOPO-08**: Topology data slice stays in GitOpsStore (data layer stability)
- [ ] **TOPO-09**: Extension Manager shows 7 independently toggleable built-in extensions

### Cleanup & Verification

- [ ] **CLEAN-01**: Empty source directories removed after extraction (old blade/component locations)
- [ ] **CLEAN-02**: _discovery.ts EXPECTED_TYPES split into CORE and EXTENSION lists
- [ ] **CLEAN-03**: Extension enable/disable toggle tests for all 3 new extensions
- [ ] **CLEAN-04**: Extension developer documentation updated with new built-in extension examples

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Extension Platform Maturation

- **EXTPLAT-01**: Dynamic process registry allowing extensions to register arbitrary process types
- **EXTPLAT-02**: Topology/worktree data slices moved from GitOpsStore into extension-owned stores
- **EXTPLAT-03**: Extension marketplace with browsing, ratings, and one-click install
- **EXTPLAT-04**: Production-ready Worker sandbox with full permission enforcement

### Feature Additions

- **FEAT-01**: Topology SVG virtualization for large repositories
- **FEAT-02**: Init Repo template marketplace integration
- **FEAT-03**: Worktree status badge in sidebar panel
- **FEAT-04**: TypeScript path aliases (@core/*) for cleaner imports

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Moving data slices to extension stores | Requires store plugin system — massive scope increase; data-layer stability is the v1.7 principle |
| Dynamic ProcessType registry | Requires rewriting XState navigation machine — defer to v1.8+ |
| Third-party extension sandbox hardening | Infrastructure exists from v1.6; production isolation deferred to v2 |
| New feature additions (not extractions) | v1.7 is pure refactoring — no new user-facing capabilities |
| Extension auto-update | Security risk without review; manual update safer |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |
| INFRA-04 | — | Pending |
| INFRA-05 | — | Pending |
| INFRA-06 | — | Pending |
| INFRA-07 | — | Pending |
| WKTR-01 | — | Pending |
| WKTR-02 | — | Pending |
| WKTR-03 | — | Pending |
| WKTR-04 | — | Pending |
| WKTR-05 | — | Pending |
| WKTR-06 | — | Pending |
| INIT-01 | — | Pending |
| INIT-02 | — | Pending |
| INIT-03 | — | Pending |
| INIT-04 | — | Pending |
| INIT-05 | — | Pending |
| INIT-06 | — | Pending |
| TOPO-01 | — | Pending |
| TOPO-02 | — | Pending |
| TOPO-03 | — | Pending |
| TOPO-04 | — | Pending |
| TOPO-05 | — | Pending |
| TOPO-06 | — | Pending |
| TOPO-07 | — | Pending |
| TOPO-08 | — | Pending |
| TOPO-09 | — | Pending |
| CLEAN-01 | — | Pending |
| CLEAN-02 | — | Pending |
| CLEAN-03 | — | Pending |
| CLEAN-04 | — | Pending |

**Coverage:**
- v1.7 requirements: 28 total
- Mapped to phases: 0
- Unmapped: 28

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-11 after initial definition*
