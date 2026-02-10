# Requirements: FlowForge

**Defined:** 2026-02-10
**Core Value:** The intelligence is in the agent; the authority is in the infrastructure.

## v1.6 Requirements

Requirements for v1.6.0 Refactor to Extensions. Each maps to roadmap phases.

### Extension Platform

- [ ] **PLAT-01**: User can see context menu items contributed by extensions when right-clicking on files, branches, and commits
- [ ] **PLAT-02**: Extensions can register sidebar panel sections that appear in the repository view
- [ ] **PLAT-03**: Extensions can contribute status bar widgets showing extension-specific state
- [ ] **PLAT-04**: Extensions can listen to git operation events (onWillCommit, onDidCommit, onWillPush, onDidPush) via GitHookBus
- [ ] **PLAT-05**: Extensions can use api.onDispose() to register cleanup callbacks during deactivation
- [ ] **PLAT-06**: ExtensionAPI surface expanded with context menu, sidebar panel, status bar, and git hook registration methods

### Content Viewer Extraction

- [ ] **VIEW-01**: Markdown preview blade runs as a content-viewers extension using registerBuiltIn()
- [ ] **VIEW-02**: Code viewer blade (Monaco) runs as a content-viewers extension
- [ ] **VIEW-03**: 3D model viewer blade (Three.js) runs as a content-viewers extension
- [ ] **VIEW-04**: User can disable content viewers extension and file previews gracefully degrade to text

### Conventional Commits Extraction

- [ ] **CCEX-01**: Conventional commit composer runs as a built-in CC extension
- [ ] **CCEX-02**: CC extension validates commit messages via onWillCommit hook
- [ ] **CCEX-03**: Type inference, scope autocomplete, and commit templates provided by CC extension
- [ ] **CCEX-04**: Changelog generation provided by CC extension
- [ ] **CCEX-05**: User can disable CC extension and commit form works as plain text input

### Gitflow Extraction

- [ ] **GFEX-01**: Gitflow sidebar panel (branch creation, merge flows) runs as a built-in Gitflow extension
- [ ] **GFEX-02**: Gitflow cheatsheet blade provided by Gitflow extension
- [ ] **GFEX-03**: Branch classification and coloring for Gitflow branches provided by Gitflow extension
- [ ] **GFEX-04**: Pre-merge review checklist provided by Gitflow extension
- [ ] **GFEX-05**: User can disable Gitflow extension and use FlowForge as a plain Git client
- [ ] **GFEX-06**: Gitflow extension state always defers to Rust backend (no frontend state caching)

### Sandbox Infrastructure

- [ ] **SAND-01**: Extension manifest supports trust level flag (built-in vs external)
- [ ] **SAND-02**: Worker-based sandbox bridge prototype with postMessage communication
- [ ] **SAND-03**: Extension API methods classified as sandbox-safe vs requires-trust

### Graceful Degradation

- [ ] **DEGR-01**: Extension Manager blade shows Gitflow, CC, Content Viewers alongside GitHub — all toggleable
- [ ] **DEGR-02**: Disabling Gitflow removes Gitflow sidebar sections, branch dialogs, and merge flows — core Git operations remain
- [ ] **DEGR-03**: Disabling CC removes commit validation and CC form — plain commit textarea remains
- [ ] **DEGR-04**: Disabling content viewers falls back to text display for file previews

### Polish & Maintenance

- [ ] **MAINT-01**: Remove 16 backward-compatibility re-export shims (@deprecated from v1.4)
- [ ] **MAINT-02**: Test coverage for extension lifecycle (activate, deactivate, registry cleanup)
- [ ] **MAINT-03**: Documentation website updated for v1.6.0 extension architecture
- [ ] **MAINT-04**: Version bumped to v1.6.0 in Cargo.toml and package.json

## Future Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Sandbox

- **SAND-F01**: Full Worker sandbox with production isolation for external extensions
- **SAND-F02**: Extension marketplace with discovery and search
- **SAND-F03**: Extension auto-update with review workflow

### Additional Integrations

- **INTG-F01**: GitLab integration extension
- **INTG-F02**: Bitbucket integration extension

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full third-party extension support | Sandbox is prep-only in v1.6; production isolation needs more work |
| Extension marketplace | URL-based install sufficient; marketplace requires hosting infrastructure |
| Extension auto-update | Security risk without review; manual update safer |
| Iframe-based sandboxing | Tauri has documented iframe limitations (Windows ES Module, Linux request confusion) |
| ShadowRealm isolation | TC39 Stage 2.7; not in any browser yet |
| Intercepting git hooks (blocking) | Tap-only (read-only) hooks in v1.6; intercepting hooks add ordering/reentrancy complexity |
| MCP server | Deferred to v2; API surface needs real usage patterns first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 37 | Pending |
| PLAT-02 | Phase 37 | Pending |
| PLAT-03 | Phase 37 | Pending |
| PLAT-04 | Phase 37 | Pending |
| PLAT-05 | Phase 37 | Pending |
| PLAT-06 | Phase 37 | Pending |
| VIEW-01 | Phase 38 | Pending |
| VIEW-02 | Phase 38 | Pending |
| VIEW-03 | Phase 38 | Pending |
| VIEW-04 | Phase 38 | Pending |
| CCEX-01 | Phase 39 | Pending |
| CCEX-02 | Phase 39 | Pending |
| CCEX-03 | Phase 39 | Pending |
| CCEX-04 | Phase 39 | Pending |
| CCEX-05 | Phase 39 | Pending |
| GFEX-01 | Phase 40 | Pending |
| GFEX-02 | Phase 40 | Pending |
| GFEX-03 | Phase 40 | Pending |
| GFEX-04 | Phase 40 | Pending |
| GFEX-05 | Phase 40 | Pending |
| GFEX-06 | Phase 40 | Pending |
| SAND-01 | Phase 41 | Pending |
| SAND-02 | Phase 41 | Pending |
| SAND-03 | Phase 41 | Pending |
| DEGR-01 | Phase 40 | Pending |
| DEGR-02 | Phase 40 | Pending |
| DEGR-03 | Phase 39 | Pending |
| DEGR-04 | Phase 38 | Pending |
| MAINT-01 | Phase 41 | Pending |
| MAINT-02 | Phase 41 | Pending |
| MAINT-03 | Phase 41 | Pending |
| MAINT-04 | Phase 41 | Pending |

**Coverage:**
- v1.6 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after roadmap creation (traceability complete)*
