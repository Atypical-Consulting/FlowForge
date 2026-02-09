# Requirements: FlowForge

**Defined:** 2026-02-09
**Core Value:** The intelligence is in the agent; the authority is in the infrastructure.

## v1.5 Requirements

Requirements for milestone v1.5 GitHub Extension. Each maps to roadmap phases.

### Security Hardening

- [ ] **SEC-01**: App enforces strict Content-Security-Policy in tauri.conf.json before loading extensions or making GitHub API calls
- [ ] **SEC-02**: Asset protocol scope is narrowed from wildcard to specific allowed directories
- [ ] **SEC-03**: Tauri capabilities are audited and overly broad permissions removed from default.json

### Extension System

- [ ] **EXT-01**: Extension manifest format (flowforge.extension.json) defines id, version, name, contributes (blades, commands, toolbar), permissions, and apiVersion
- [ ] **EXT-02**: ExtensionHost singleton discovers manifests from .flowforge/extensions/*/flowforge.extension.json and manages lifecycle
- [ ] **EXT-03**: Extension lifecycle hooks (onActivate/onDeactivate) execute with cleanup tracking
- [ ] **EXT-04**: ExtensionAPI facade provides per-extension registerBlade(), registerCommand(), contributeToolbar(), createStore() with registration tracking
- [ ] **EXT-05**: Extension blade types use namespace format ext:{extensionId}:{bladeName} to prevent collisions with core registrations
- [ ] **EXT-06**: bladeRegistry supports unregisterBlade() and accepts dynamic ExtensionBladeType strings
- [ ] **EXT-07**: commandRegistry supports unregisterCommand() and accepts dynamic extension command categories
- [ ] **EXT-08**: Extension manifest declares apiVersion with compatibility check at load time rejecting incompatible extensions
- [ ] **EXT-09**: User can install an extension from a GitHub repository URL with manifest validation before activation
- [ ] **EXT-10**: Extension manager blade lists installed extensions with enable/disable toggles and uninstall buttons
- [ ] **EXT-11**: Extension manager shows which blades, commands, and toolbar actions each extension contributes
- [ ] **EXT-12**: Extension manifest declares required permissions (network, filesystem, git-operations) shown during install review
- [ ] **EXT-13**: User can enable/disable extensions with state persisted in preferences

### GitHub Integration

- [ ] **GH-01**: User can sign in with GitHub account via OAuth Device Flow (show code, authorize in browser)
- [ ] **GH-02**: OAuth tokens are stored securely in OS keychain via Rust keyring crate (never plaintext)
- [ ] **GH-03**: User can see and control which GitHub permission scopes are requested during sign-in
- [ ] **GH-04**: App detects GitHub remotes in current repo and links them to the authenticated account automatically
- [ ] **GH-05**: User can view pull requests list with title, author, status, and CI check indicators
- [ ] **GH-06**: User can open a PR detail blade showing description, comments, and status checks
- [ ] **GH-07**: User can view issues list with title, labels, assignee, and filter capabilities
- [ ] **GH-08**: User can open an issue detail blade showing description and comments
- [ ] **GH-09**: User can merge a PR with strategy selector (merge commit, squash, rebase) and confirmation dialog
- [ ] **GH-10**: User can create a PR from current branch with title pre-filled from branch name and body from commit messages
- [ ] **GH-11**: GitHub API rate limits are tracked and displayed to user with warning when approaching limit

### Toolbar UX

- [ ] **TB-01**: Top bar actions are reorganized into groups by intent (Navigation, Git Actions, Views, App) with visual dividers
- [ ] **TB-02**: Toolbar registry replaces hardcoded Header.tsx buttons with data-driven ToolbarAction entries (priority, group, when condition)
- [ ] **TB-03**: Secondary actions collapse into overflow menu via ResizeObserver when window is narrow, with count badge
- [ ] **TB-04**: All toolbar actions use consistent icon-only pattern with ShortcutTooltip (WCAG 2.1 AA compliant)
- [ ] **TB-05**: Repo-specific toolbar actions are hidden when no repository is open; extension actions appear only when relevant
- [ ] **TB-06**: User can show/hide toolbar actions via toggles in settings, persisted in preferences
- [ ] **TB-07**: Extensions contribute toolbar actions through the same registry as core actions

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Extension System v2

- **EXT-F01**: Extension marketplace/registry for browsing and one-click install
- **EXT-F02**: Extension sandboxing via iframe or Web Worker isolation for untrusted third-party code
- **EXT-F03**: Extension dependency resolution (extensionDependencies in manifest)
- **EXT-F04**: Extension auto-update with changelog review
- **EXT-F05**: Extension hot-reload in dev mode (watch extension dir, clear/re-register)

### GitHub Integration v2

- **GH-F01**: Full PR review with inline code comments and approve/request changes workflow
- **GH-F02**: GitHub Actions workflow status and log viewing
- **GH-F03**: Issue creation from within FlowForge
- **GH-F04**: GitHub release management (create releases, attach assets)
- **GH-F05**: GitHub Enterprise Server support (configurable host URL)

### Toolbar v2

- **TB-F01**: Drag-and-drop toolbar action reordering
- **TB-F02**: Toolbar profiles per workflow ("review" vs "develop" configurations)
- **TB-F03**: Extension-contributed toolbar separators and groups

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Extension sandboxing (iframe/Worker) | Only first-party GitHub extension in v1.5; sandboxing needed when third-party extensions arrive in v2 |
| Extension marketplace | URL-based install sufficient for v1.5; marketplace requires hosting infrastructure |
| Full PR review with inline comments | Complex position mapping; read + basic actions sufficient for v1.5 |
| GitHub Actions logs | Feature creep; CI status indicators on PRs sufficient |
| GitLab/Bitbucket integration | GitHub-first; other providers can be extensions later |
| Drag-and-drop toolbar reorder | Show/hide toggles cover 80% of need; full DnD is v2 polish |
| Extension auto-update | Security risk without review; manual update safer for v1.5 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 31 | Pending |
| SEC-02 | Phase 31 | Pending |
| SEC-03 | Phase 31 | Pending |
| EXT-01 | Phase 33 | Pending |
| EXT-02 | Phase 33 | Pending |
| EXT-03 | Phase 33 | Pending |
| EXT-04 | Phase 33 | Pending |
| EXT-05 | Phase 33 | Pending |
| EXT-06 | Phase 33 | Pending |
| EXT-07 | Phase 33 | Pending |
| EXT-08 | Phase 33 | Pending |
| EXT-09 | Phase 36 | Pending |
| EXT-10 | Phase 36 | Pending |
| EXT-11 | Phase 36 | Pending |
| EXT-12 | Phase 36 | Pending |
| EXT-13 | Phase 36 | Pending |
| GH-01 | Phase 34 | Pending |
| GH-02 | Phase 34 | Pending |
| GH-03 | Phase 34 | Pending |
| GH-04 | Phase 34 | Pending |
| GH-05 | Phase 35 | Pending |
| GH-06 | Phase 35 | Pending |
| GH-07 | Phase 35 | Pending |
| GH-08 | Phase 35 | Pending |
| GH-09 | Phase 36 | Pending |
| GH-10 | Phase 36 | Pending |
| GH-11 | Phase 34 | Pending |
| TB-01 | Phase 32 | Pending |
| TB-02 | Phase 32 | Pending |
| TB-03 | Phase 32 | Pending |
| TB-04 | Phase 32 | Pending |
| TB-05 | Phase 32 | Pending |
| TB-06 | Phase 32 | Pending |
| TB-07 | Phase 35 | Pending |

**Coverage:**
- v1.5 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-02-09*
*Last updated: 2026-02-09 after roadmap creation (all 34 requirements mapped)*
