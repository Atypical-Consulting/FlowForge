# Roadmap: FlowForge

## Milestones

- **v1.0 MVP** - Phases 1-10 (shipped 2026-02-04) -> [archive](milestones/v1.0.0-ROADMAP.md)
- **v1.1.0 Usability** - Phases 11-15 (shipped 2026-02-06) -> [archive](milestones/v1.1.0-ROADMAP.md)
- **v1.2.0 Bugfixing & Polish** - Phases 16-19 (shipped 2026-02-07) -> [archive](milestones/v1.2.0-ROADMAP.md)
- **v1.3.0 Blades Blades Blades** - Phases 20-24 (shipped 2026-02-08) -> [archive](milestones/v1.3.0-ROADMAP.md)
- **v1.4.0 Architecture & Navigation Overhaul** - Phases 25-30 (shipped 2026-02-09) -> [archive](milestones/v1.4.0-ROADMAP.md)
- **v1.5.0 GitHub Extension** - Phases 31-36 (in progress)

## Progress

<details>
<summary>v1.0.0 MVP (Phases 1-10) -- SHIPPED 2026-02-04</summary>

- [x] Phase 1: Foundation (3/3 plans)
- [x] Phase 3: Core Git & Branches (6/6 plans)
- [x] Phase 4: Gitflow State Machine (5/5 plans)
- [x] Phase 5: Topology Visualization (5/5 plans)
- [x] Phase 6: Conventional Commits (4/4 plans)
- [x] Phase 6.1: Catppuccin Mocha File Icons (2/2 plans)
- [x] Phase 6.2: UX/UI Enhancements (9/9 plans)
- [x] Phase 7: Worktree Management (4/4 plans)
- [x] Phase 8: Polish & Performance (6/6 plans)

</details>

<details>
<summary>v1.1.0 Usability (Phases 11-15) -- SHIPPED 2026-02-06</summary>

- [x] Phase 11: Foundation (5/5 plans)
- [x] Phase 12: Workflows (6/6 plans)
- [x] Phase 13: Navigation (5/5 plans)
- [x] Phase 14: UI Polish (4/4 plans)

</details>

<details>
<summary>v1.2.0 Bugfixing & Polish (Phases 16-19) -- SHIPPED 2026-02-07</summary>

- [x] Phase 16: Quick Fixes & Visual Polish (3/3 plans)
- [x] Phase 17: Hierarchical View & Commit Enhancements (4/4 plans)
- [x] Phase 18: Command Palette & Discoverability (4/4 plans)
- [x] Phase 19: Settings, Onboarding & File Icons (6/6 plans)

</details>

<details>
<summary>v1.3.0 Blades Blades Blades (Phases 20-24) -- SHIPPED 2026-02-08</summary>

- [x] Phase 20: Blade Infrastructure & Modal Migration (8/8 plans)
- [x] Phase 20.1: Blade Extensibility Refactoring (6/6 plans)
- [x] Phase 21: Two-Column Staging & Inline Diff (5/5 plans)
- [x] Phase 22: New Content Blades (26/26 plans)
- [x] Phase 23: Branch Management (7/7 plans)
- [x] Phase 24: Code Review Guidance & Documentation (4/4 plans)

</details>

<details>
<summary>v1.4.0 Architecture & Navigation Overhaul (Phases 25-30) -- SHIPPED 2026-02-09</summary>

- [x] Phase 25: Test Infrastructure Foundation (3/3 plans)
- [x] Phase 26: XState Navigation FSM (4/4 plans)
- [x] Phase 27: Init Repo Blade (4/4 plans)
- [x] Phase 28: Conventional Commit Blade (5/5 plans)
- [x] Phase 29: Blade-Centric File Structure (6/6 plans)
- [x] Phase 30: Store Consolidation & Tech Debt (7/7 plans)

</details>

### v1.5.0 GitHub Extension (In Progress)

**Milestone Goal:** Add an extension system to FlowForge and ship GitHub integration (PRs, issues, OAuth) as the first extension, alongside a top bar UX overhaul.

## Phases

- [ ] **Phase 31: Security Hardening** - Lock down CSP, asset protocol scope, and Tauri capabilities before introducing external network access and extension code
- [ ] **Phase 32: Toolbar Overhaul** - Transform hardcoded Header.tsx buttons into a data-driven toolbar registry with overflow handling and contextual visibility
- [ ] **Phase 33: Extension System Foundation** - Build the manifest-driven extension platform with lifecycle management, namespaced registrations, and API versioning
- [ ] **Phase 34: GitHub Authentication** - Implement OAuth Device Flow with secure OS keychain token storage and automatic GitHub remote detection
- [ ] **Phase 35: GitHub Read Operations** - View pull requests and issues in dedicated blades with extension-contributed toolbar actions
- [ ] **Phase 36: GitHub Write Operations & Extension Manager** - Add PR merge/create actions and build the extension manager UI for install, enable/disable, and uninstall

## Phase Details

### Phase 31: Security Hardening
**Goal**: The application enforces security boundaries before any extension code loads or external API calls are made
**Depends on**: Nothing (prerequisite for all v1.5 work)
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. The app enforces a strict Content-Security-Policy that allows only self-origin scripts and whitelisted GitHub API/CDN domains for connect-src and img-src
  2. The asset protocol scope is narrowed to specific allowed directories instead of wildcard access
  3. Tauri capability permissions in default.json contain only the minimum scopes needed for current features with no overly broad grants
**Plans**: 2 plans
- [ ] 31-01-PLAN.md -- Bundle Monaco locally and proxy NuGet API through Rust backend
- [ ] 31-02-PLAN.md -- Apply strict CSP, disable asset protocol, audit capabilities

### Phase 32: Toolbar Overhaul
**Goal**: Users interact with a responsive, grouped toolbar that adapts to window width and hides irrelevant actions based on context
**Depends on**: Phase 31
**Requirements**: TB-01, TB-02, TB-03, TB-04, TB-05, TB-06
**Success Criteria** (what must be TRUE):
  1. Toolbar actions are visually grouped by intent (Navigation, Git Actions, Views, App) with dividers separating each group
  2. When the window is narrowed, lower-priority actions collapse into an overflow menu with a count badge showing how many actions are hidden
  3. All toolbar buttons use consistent icon-only rendering with accessible ShortcutTooltip labels (WCAG 2.1 AA)
  4. Repository-specific toolbar actions disappear when no repository is open and reappear when one is opened
  5. User can toggle individual toolbar actions on/off in settings with the preference persisted across sessions
**Plans**: TBD

### Phase 33: Extension System Foundation
**Goal**: FlowForge has a working extension platform where extensions declare capabilities in a manifest, register blades and commands through a tracked API, and are activated/deactivated with full cleanup
**Depends on**: Phase 31
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-06, EXT-07, EXT-08
**Success Criteria** (what must be TRUE):
  1. An extension with a valid flowforge.extension.json manifest placed in .flowforge/extensions/{id}/ is discovered and activated on app startup
  2. Extension-registered blades appear with namespaced types (ext:{extensionId}:{bladeName}) and do not collide with core blade registrations
  3. Extension-registered commands appear in the command palette under the extension's category and are searchable
  4. When an extension is deactivated, all its registered blades, commands, and toolbar contributions are completely removed with no orphaned registrations
  5. An extension declaring an incompatible apiVersion is rejected at load time with a user-visible error message
**Plans**: TBD

### Phase 34: GitHub Authentication
**Goal**: Users can securely sign in with their GitHub account and the app automatically links authenticated accounts to repositories with GitHub remotes
**Depends on**: Phase 33
**Requirements**: GH-01, GH-02, GH-03, GH-04, GH-11
**Success Criteria** (what must be TRUE):
  1. User can initiate GitHub sign-in, see a device code displayed in-app, authorize in their browser, and return to FlowForge signed in
  2. OAuth tokens are stored in the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) and never written to any plaintext file
  3. User can see which GitHub permission scopes are requested and control the scope selection before authorizing
  4. When opening a repository with a github.com remote, the app automatically associates it with the signed-in GitHub account
  5. GitHub API rate limit remaining count is visible in the UI, with a warning toast when approaching the limit
**Plans**: TBD

### Phase 35: GitHub Read Operations
**Goal**: Users can browse pull requests and issues for the linked GitHub repository directly within FlowForge blades, and the GitHub extension contributes toolbar actions through the extension registry
**Depends on**: Phase 32, Phase 34
**Requirements**: GH-05, GH-06, GH-07, GH-08, TB-07
**Success Criteria** (what must be TRUE):
  1. User can view a list of pull requests showing title, author, status, and CI check indicators, and open any PR into a detail blade with description, comments, and status checks
  2. User can view a list of issues showing title, labels, and assignee, with filter capabilities, and open any issue into a detail blade with description and comments
  3. The GitHub extension contributes toolbar actions (e.g., "Open PRs" button) through the same toolbar registry used by core actions, appearing only when authenticated and a GitHub remote is detected
**Plans**: TBD

### Phase 36: GitHub Write Operations & Extension Manager
**Goal**: Users can take action on PRs and issues (merge, create) and manage installed extensions through a dedicated UI
**Depends on**: Phase 35
**Requirements**: GH-09, GH-10, EXT-09, EXT-10, EXT-11, EXT-12, EXT-13
**Success Criteria** (what must be TRUE):
  1. User can merge a pull request with a strategy selector (merge commit, squash, rebase) and a confirmation dialog before the merge executes
  2. User can create a new pull request from the current branch with the title pre-filled from the branch name and the body populated from commit messages
  3. User can install an extension from a GitHub repository URL with manifest validation shown before activation proceeds
  4. Extension manager blade lists all installed extensions with enable/disable toggles and uninstall buttons, showing which blades, commands, and toolbar actions each extension contributes
  5. Extension permissions declared in the manifest (network, filesystem, git-operations) are displayed during the install review step
**Plans**: TBD

## Coverage

All 34 v1.5 requirements mapped:

| Requirement | Phase | Category |
|-------------|-------|----------|
| SEC-01 | 31 | Security Hardening |
| SEC-02 | 31 | Security Hardening |
| SEC-03 | 31 | Security Hardening |
| TB-01 | 32 | Toolbar UX |
| TB-02 | 32 | Toolbar UX |
| TB-03 | 32 | Toolbar UX |
| TB-04 | 32 | Toolbar UX |
| TB-05 | 32 | Toolbar UX |
| TB-06 | 32 | Toolbar UX |
| EXT-01 | 33 | Extension System |
| EXT-02 | 33 | Extension System |
| EXT-03 | 33 | Extension System |
| EXT-04 | 33 | Extension System |
| EXT-05 | 33 | Extension System |
| EXT-06 | 33 | Extension System |
| EXT-07 | 33 | Extension System |
| EXT-08 | 33 | Extension System |
| GH-01 | 34 | GitHub Integration |
| GH-02 | 34 | GitHub Integration |
| GH-03 | 34 | GitHub Integration |
| GH-04 | 34 | GitHub Integration |
| GH-11 | 34 | GitHub Integration |
| GH-05 | 35 | GitHub Integration |
| GH-06 | 35 | GitHub Integration |
| GH-07 | 35 | GitHub Integration |
| GH-08 | 35 | GitHub Integration |
| TB-07 | 35 | Toolbar UX |
| GH-09 | 36 | GitHub Integration |
| GH-10 | 36 | GitHub Integration |
| EXT-09 | 36 | Extension System |
| EXT-10 | 36 | Extension System |
| EXT-11 | 36 | Extension System |
| EXT-12 | 36 | Extension System |
| EXT-13 | 36 | Extension System |

---
*Last updated: 2026-02-09 after v1.5.0 roadmap created*
