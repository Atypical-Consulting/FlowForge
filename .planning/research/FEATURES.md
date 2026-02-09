# Feature Landscape: FlowForge Extension System, GitHub Integration, Toolbar UX

**Domain:** Desktop Git client -- extension architecture, GitHub platform integration, toolbar user experience
**Researched:** 2026-02-09

---

## Table Stakes

Features users expect. Missing = milestone feels incomplete.

### Extension System

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Extension manifest format | Without a declared format, "install from GitHub" is just downloading random code. VS Code proved that a manifest-driven approach is the standard. FlowForge needs a `flowforge.extension.json` declaring blade types, commands, stores, and metadata. | Medium | Must declare: id, version, name, description, author, contributes (blades, commands, stores), engine compatibility, permissions. JSON Schema for validation. |
| Install extension from GitHub URL | The stated product goal. User pastes a GitHub repo URL, FlowForge clones/downloads the repo, validates manifest, installs artifacts. | High | Needs: URL parsing, GitHub API or git clone for download, manifest validation, file placement into extensions directory, restart-free activation via lifecycle hooks. |
| Extension lifecycle hooks (activate/deactivate) | Extensions need setup/teardown. VS Code uses `activate()` returning a disposable. FlowForge needs `onActivate(context)` and `onDeactivate()` so extensions can register blades/commands/stores and clean up. | Medium | Context object wraps existing registries: `context.registerBlade()`, `context.registerCommand()`, `context.registerStore()`. On deactivate, auto-unregister all contributions. |
| Extension manager UI blade | Users need to see installed extensions, enable/disable them, uninstall them. Without this, extension management requires manual file manipulation. | Medium | New blade type: `extension-manager`. Lists installed extensions with toggle/uninstall actions. Entry point from Settings blade or command palette. |
| Extension categories | Extensions need classification for discoverability. At minimum: `blade`, `integration`, `theme`, `workflow`. | Low | Declared in manifest, displayed in manager UI, filterable. Follows VS Code pattern of marketplace categories but simplified for FlowForge's scope. |
| Uninstall extension cleanly | If you can install, you must be able to uninstall. Extensions must deactivate, unregister contributions, and have their files removed. | Medium | Reverse of install: call `onDeactivate()`, remove from blade/command/store registries, delete extension directory from `$APPDATA/extensions/`. |
| Extension enable/disable toggle | Users must be able to disable without uninstalling. Preserves configuration for later re-enable. | Low | Disabled extensions skip `onActivate()` on startup. Persist enabled state in preferences store. |

### GitHub Integration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| GitHub OAuth sign-in | Cannot access GitHub API without authentication. GitHub Desktop, GitKraken, and every GitHub-integrated tool has this. | High | Use PKCE with authorization code flow (GitHub added PKCE support July 2025). Tauri needs localhost redirect server via `tauri-plugin-oauth` or Tauri deep linking. Device flow as fallback. Store tokens in OS keychain via `tauri-plugin-keychain` or `keytar`. |
| View pull requests for current repo | The minimum useful GitHub integration. List open PRs with title, author, status, CI checks. GitKraken shows this in a left panel; GitHub Desktop shows PR badge on branches. | Medium | Requires `repo` OAuth scope. Use Octokit REST API `pulls.list()`. New `github-pr-list` blade type registered via extension manifest. |
| View issues for current repo | PRs and issues are the two core GitHub collaboration primitives. Listing issues is low-cost once auth is established. | Medium | Octokit `issues.listForRepo()`. Note: GitHub API returns PRs mixed with issues -- must filter with `pull_request` field check. New `github-issue-list` blade. |
| Merge pull request from app | The action that closes the loop. Without merge, users still must context-switch to browser. GitKraken supports this. GitHub Desktop still does not (open feature request since 2022, issues #13262 and #20614). | Medium | Octokit `pulls.merge()`. Needs merge strategy selector (merge commit, squash, rebase). Confirmation dialog with branch cleanup option. |
| Close/reopen issues | Basic issue lifecycle management. If you can view issues, users expect to act on them. | Low | Octokit `issues.update({ state })`. Simple toggle action on issue list items. |
| Account-repo linking | Users need to connect their GitHub account to specific repos. Not all repos are on GitHub; the app must detect remote URLs and offer linking. | Medium | Parse `.git/config` remote URLs for `github.com` patterns. Extract owner/repo. Store associations in preferences store. Auto-detect on repo open. |
| Permission/scope display | Users must see what access they have granted. Transparency builds trust. | Low | Display OAuth scopes granted, connected account username/avatar, list of linked repos. Settings sub-section or dedicated blade. |
| Secure token storage | Storing OAuth tokens in plaintext is unacceptable. OS keychain integration is expected. | Medium | Use Tauri's secure storage or `tauri-plugin-store` with encryption. Tokens must survive app restarts but be deletable on sign-out. |

### Toolbar UX

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Action grouping by intent | Current `Header.tsx` has 12+ buttons in a flat row with no visual grouping. Industry standard (PatternFly, LibreOffice guidelines) mandates grouping related actions with dividers. | Medium | Group into: Navigation (repo/branch switchers), Git Actions (sync, refresh, undo), Views (repo browser, changelog, gitflow), App (settings, theme, command palette, open/close). Separate groups with `div.w-px.h-6.bg-ctp-surface1` dividers (pattern already used once). |
| Overflow menu for secondary actions | At narrow widths the toolbar overflows off-screen. PatternFly: expose max 2 primary actions, collapse rest into overflow. Current header has zero overflow strategy. | Medium | Kebab menu with `EllipsisVertical` icon from Lucide. Actions that overflow collapse into dropdown. Use `ResizeObserver` to detect available width. Priority-based: least-used actions overflow first. |
| Consistent iconography | Current header mixes icon-only buttons (Settings, Theme, Search) with icon+text ("Reveal", "Open", "Close"). NN Group research: pick one pattern and be consistent. | Low | Standardize: icon-only with `ShortcutTooltip` for all frequent actions. Reserve icon+text for primary CTAs only (Open Repo, Clone). Already have `ShortcutTooltip` component for this pattern. |
| Contextual repo-aware actions | When no repo is open, only Open/Clone should show. Currently implemented with conditional rendering but inconsistently -- some buttons hide, "Close" only shows with repo, but grouping is ad-hoc. | Low | Already partially implemented. Formalize: define action visibility matrix (no-repo, repo-clean, repo-dirty, repo-detached-HEAD). Extract to configuration object rather than inline conditionals. |
| Keyboard shortcuts for all toolbar actions | Current header has shortcuts for Settings (Cmd+,), Command Palette (Cmd+Shift+P), Open (Cmd+O). Missing: refresh (Cmd+R?), sync, undo (Cmd+Z), repo browser, changelog. | Low | Already using `react-hotkeys-hook`. Register missing shortcuts. Display consistently via `ShortcutTooltip` on all buttons. |
| Tooltips on every action | 4 buttons currently have no tooltip or title attribute. Every interactive element needs one for accessibility (WCAG 2.1 AA) and discoverability. | Low | Audit all buttons. Wrap with `ShortcutTooltip` where shortcuts exist, use `title` attribute for non-shortcut actions. |

---

## Differentiators

Features that set FlowForge apart. Not expected, but valued.

### Extension System

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Hot-reload extensions in dev mode | VS Code requires "Reload Window" after extension changes. FlowForge could watch extension directories and hot-swap registrations using existing `clearRegistry()` and HMR patterns. | High | Leverages existing blade registry `clearRegistry()`. Watch extension dir with `@tauri-apps/plugin-fs` watcher. Dev-mode only feature. |
| Extension permissions model | VS Code extensions have NO sandboxing (confirmed: extensions run with full IDE permissions, no fix planned per microsoft/vscode#52116). FlowForge can differentiate by declaring permissions in manifest and enforcing them: `network`, `filesystem`, `git-operations`, `ui-write`. | High | Manifest declares required permissions. Install flow shows permission review (like Android app install). Runtime enforcement requires wrapping Tauri IPC commands with permission checks. Significant engineering investment. |
| Extension dependency resolution | Extensions declaring dependencies on other extensions. VS Code supports `extensionDependencies` to auto-install prerequisites. | Medium | Manifest `dependencies` field with `extensionId@semverRange`. Install process resolves and installs deps first. Circular dependency detection required. |
| Extension template/scaffolding tool | Lower the barrier to creating extensions. Generate manifest, entry point, TypeScript types. | Medium | Separate npm package or built-in command. Generates: `flowforge.extension.json`, `src/index.ts`, `tsconfig.json`, type declarations for extension API. |
| Versioned public API with stability guarantees | Extensions need a stable API surface. SemVer the extension API separately from the app version. Breaking changes require major version bump. | Low | `engine: { flowforge: "^2.0.0" }` in manifest. API types exported from `@flowforge/extension-api` package. Enables extensions to declare compatibility range. |
| Extension marketplace/registry | Browse and install extensions from a curated list without needing GitHub URLs. | High | Start with a static JSON registry hosted on GitHub (like Homebrew taps). Evolve to a web-based registry later. Definitely a Phase 3+ feature. |

### GitHub Integration

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| PR diff viewer integrated with existing diff blade | View PR file diffs using FlowForge's own diff infrastructure. The app already has a `diff` blade type with `DiffSource`. No other desktop Git client reuses its own diff viewer for remote PR review. | Medium | Extend `DiffSource` union to include a `github-pr` variant. Fetch diff content via Octokit `pulls.get({ mediaType: { format: 'diff' } })`. Reuses existing diff rendering. |
| Inline PR review comments | Comment on specific lines in PR diff view. GitHub Desktop lacks this entirely. GitKraken has it (paid tier). | High | Requires mapping GitHub diff positions to FlowForge diff viewer line numbers. Uses Octokit `pulls.createReviewComment()`. Complex position mapping logic. |
| PR status checks display | Show CI/CD check status inline on PR list items. GitHub Desktop 3.0 added this as a headline feature. | Low | Octokit `checks.listForRef()`. Display as colored status dots (green/yellow/red) on PR list items. Low effort, high visibility. |
| Create PR from current branch | Push current branch and open PR creation form without leaving the app. | Medium | New blade or dialog. Octokit `pulls.create()`. Pre-fill: base branch from default, title from branch name, body from commit messages since divergence. |
| GitHub notifications panel | Show review requests, mentions, CI failures as a notification feed. | High | Octokit `activity.listNotificationsForAuthenticatedUser()`. Separate blade type. Polling-based with configurable interval. Integrates with existing toast system for urgency. |
| Issue creation from app | Create new issues without context-switching to browser. | Low | Simple form dialog or blade. Octokit `issues.create()`. Fields: title, body (markdown), labels, assignees. |
| Branch-PR association in branch list | Show which branches have open PRs, with PR status badge. GitHub Desktop 3.0's headline feature. | Medium | Cross-reference branch list with `pulls.list()` results. Add badge to `BranchItem` component. Requires caching PR data. |

### Toolbar UX

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Customizable toolbar | Users rearrange, show/hide toolbar buttons. VS Code's activity bar and GitKraken's toolbar both support this. No desktop Git client offers full toolbar customization. | High | Persist toolbar config in preferences store. Drag-and-drop reordering. Settings panel for show/hide toggles per action. |
| Toolbar profiles per workflow | Switch between "review" (PR actions prominent) and "develop" (commit/branch prominent) configurations. | Medium | Named toolbar configurations stored in preferences. Quick-switch via command palette or dropdown. |
| Breadcrumb navigation trail | Show current path in toolbar area (e.g., "main > staging > Header.tsx diff"). Replaces the simple back-button pattern with contextual awareness. | Medium | Derive from XState blade stack context. Clickable segments to jump back to any point in navigation history via `POP_TO_INDEX`. |
| Context-sensitive action suggestions | When on a feature branch with unpushed commits, surface "Push" prominently. When viewing staged changes, surface "Commit". Reduces cognitive load. | Medium | Reactive to repository state via Zustand selectors. Display as highlighted/pulsing toolbar segment. Subtle but effective UX signal. |
| Split-button actions | "Commit" button with dropdown for "Commit & Push", "Amend", "Commit & Create PR". Consolidates related actions. | Low | Single primary button with chevron dropdown. Already have `CommitActionBar` pattern to draw from for the split-button interaction model. |
| Responsive toolbar with breakpoint-based collapse | At different window widths, progressively collapse: labels first, then secondary groups into overflow, then tertiary groups. Smooth transitions. | Medium | Use `ResizeObserver` + priority ranking per toolbar group. Animate with `framer-motion` layout animations. Define 3 breakpoints: full, compact, minimal. |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full extension sandboxing/VM isolation | VS Code tried and abandoned this (microsoft/vscode#59756). The complexity of sandboxing JavaScript in a desktop app with Tauri IPC access is enormous. Community extensions for a niche Git client do not justify this engineering investment. | Declare permissions in manifest. Review at install time. Trust but verify (manifest auditing). Warn on dangerous permissions. |
| Extension auto-update from GitHub | Auto-updating code from arbitrary GitHub repos is a security risk. Silent updates could introduce malicious code with no review step. | Manual update with version check notification. Show "update available" badge in extension manager. User must explicitly approve update and can review changelog. |
| GitHub GraphQL API instead of REST | GraphQL reduces over-fetching but adds query construction complexity, pagination cursor management, and schema versioning. Octokit REST is simpler, better documented, and sufficient for PR/issue CRUD operations. | Use Octokit REST API exclusively. Only consider GraphQL if a specific data need is REST-unavailable. |
| Full GitHub code review (approve/request changes) | Full review workflow (multi-file review, batch comments, approval status) is extremely complex UI and competes directly with the GitHub web UI. Even GitKraken's implementation is limited. GitHub Desktop has not shipped this after 3+ years of community requests. | Support viewing PR details and single-line comments. For full reviews, provide prominent "Open in Browser" quick-action to hand off to GitHub web. |
| Two-level toolbar stacking | LibreOffice/Word-style double toolbar rows is a dated pattern for modern desktop apps. Adds visual noise and wastes vertical space. | Single toolbar with overflow menu. Use command palette for long-tail actions. |
| Extension store with payments/licensing | Monetization infrastructure for a niche desktop Git client is premature and adds massive complexity (payment processing, license validation, refunds). | All extensions are free and open source. Reconsider only if extension ecosystem reaches 50+ extensions and clear demand exists. |
| WebSocket-based real-time GitHub updates | Maintaining WebSocket connections for live PR/issue updates adds complexity, battery drain, and firewall issues. GitHub's webhook system is server-to-server, not friendly for desktop clients. | Poll GitHub API on configurable intervals (default: 5 minutes). Refresh on manual trigger. Use conditional requests (ETags/If-Modified-Since) to minimize API quota usage. |
| Toolbar state synced across windows | FlowForge is single-window. Multi-window toolbar sync is unnecessary complexity for a problem that does not exist. | N/A -- maintain single window model. |
| Extension marketplace web UI | Building a web frontend for browsing/publishing extensions is a separate product. Premature when the extension count is zero. | GitHub README as the extension directory. JSON registry file for machine-readable listing. Web UI only when ecosystem matures. |

---

## Feature Dependencies

```
Extension manifest format
  --> Extension lifecycle hooks (manifest defines entry points for activate/deactivate)
  --> Extension categories (manifest declares category field)

Extension lifecycle hooks
  --> Install from GitHub URL (install triggers activate)
  --> Extension manager UI (enable/disable triggers hooks)
  --> Uninstall extension (deactivate called before removal)

Extension manager UI
  --> Uninstall extension (manager is the primary uninstall surface)
  --> Extension enable/disable toggle (manager provides the toggle UI)

Extension categories
  --> Extension manager UI (categories enable filtering in list)

GitHub OAuth sign-in
  --> View PRs (auth required for API access)
  --> View issues (auth required for API access)
  --> Account-repo linking (need authenticated account to link)
  --> Merge PR (write operations require auth)
  --> Close/reopen issues (write operations require auth)

Account-repo linking
  --> View PRs (must know which GitHub owner/repo to query)
  --> View issues (same -- need owner/repo from linked remote)

View PRs --> Merge PR (must view before acting)
View issues --> Close/reopen issues (must view before acting)

Action grouping by intent
  --> Overflow menu (must define groups before deciding overflow priority)

Overflow menu
  --> Responsive toolbar collapse (overflow is the collapse mechanism)

Contextual repo-aware actions
  --> Context-sensitive suggestions (context awareness is the prerequisite)

Existing infrastructure dependencies:
  - Extension system depends on: bladeRegistry.ts, commandRegistry.ts, stores/registry.ts
  - GitHub blades depend on: BladePropsMap extension, blade registration pattern
  - Toolbar overhaul depends on: Header.tsx refactor, ShortcutTooltip, Button component
  - GitHub OAuth depends on: Tauri plugin (tauri-plugin-oauth or deep-link), preferences store
```

---

## MVP Recommendation

### Phase 1: Extension Infrastructure + Toolbar Overhaul

**Rationale:** Build the extension system foundation before GitHub integration, because GitHub integration ships AS an extension. Toolbar overhaul in parallel because it prepares the header for new GitHub action buttons.

Prioritize:
1. **Extension manifest format** -- Define `flowforge.extension.json` JSON Schema. Foundation for everything. Without this schema, no extension can declare what it contributes.
2. **Extension lifecycle hooks** -- Wire `onActivate(context)` / `onDeactivate()` to existing blade/command/store registries. Context object wraps `registerBlade()`, `registerCommand()`. Small delta from current architecture since registries already exist.
3. **Extension enable/disable** -- Persist enabled state in preferences. Skip `onActivate()` for disabled extensions.
4. **Action grouping by intent** -- Immediate UX improvement. Current header has 12+ ungrouped buttons. Group with visual dividers into 4 clusters.
5. **Overflow menu** -- Prevent toolbar from breaking at narrow widths. Required BEFORE adding more toolbar actions (GitHub buttons coming in Phase 2).
6. **Contextual repo-aware actions** -- Formalize the existing ad-hoc conditional rendering. Extract to configuration.
7. **Consistent iconography and tooltips** -- Quick polish pass on all toolbar buttons.

Defer from Phase 1:
- Extension manager UI blade: Can install/manage via command palette initially.
- Install from GitHub URL: Needs manifest + lifecycle first. Phase 2.
- Customizable toolbar: Nice-to-have. Phase 3+.
- Extension permissions model: Enforcement mechanism is too large for Phase 1.

### Phase 2: GitHub Integration as First Extension

**Rationale:** GitHub integration is the killer demo of the extension system. Ships as an installable extension, proving the architecture works. Also adds the most-requested features for any Git client.

Prioritize:
1. **GitHub OAuth sign-in** -- Gate for all GitHub features. PKCE flow with `tauri-plugin-oauth` for localhost redirect.
2. **Secure token storage** -- OS keychain or encrypted Tauri store. Must be in place before storing any tokens.
3. **Account-repo linking** -- Parse git remote URLs, auto-detect GitHub repos, associate with authenticated account.
4. **View PRs** -- First visible payoff. New `github-pr-list` blade registered via extension manifest. Proves extension-contributed blades work.
5. **View issues** -- Low incremental cost after PRs. New `github-issue-list` blade.
6. **Install from GitHub URL** -- Extension system becomes community-usable. Download, validate manifest, install, activate.
7. **Extension manager UI blade** -- Full management interface now that extensions exist to manage.

Defer from Phase 2:
- Merge PR: Write actions need careful UX (confirmation, strategy). Phase 3.
- PR diff viewer: Requires extending DiffSource. Phase 3.
- Inline PR comments: Complex position mapping. Phase 4.
- Extension permissions model: Phase 4.

### Phase 3: GitHub Write Actions + Extension Polish + Toolbar Refinement

Prioritize:
1. **Merge PR** with strategy selection (merge commit, squash, rebase)
2. **Close/reopen issues** with confirmation
3. **Create PR from current branch** with pre-filled fields
4. **PR status checks display** (CI badges on PR list items)
5. **Extension dependency resolution** (extensionDependencies in manifest)
6. **Responsive toolbar collapse** with breakpoint-based progressive collapsing
7. **Branch-PR association** in branch list sidebar

---

## Competitor Analysis

### VS Code Extensions

**What they do well:**
- Manifest-driven contribution system (`package.json` with `contributes` section) is the industry gold standard. Over 30 contribution points: commands, views, viewsContainers, menus, configuration, keybindings, themes, etc.
- Activation events (`onLanguage:`, `onCommand:`, `onView:`) enable lazy loading -- extensions activate only when needed, keeping startup fast.
- `extensionDependencies` enables dependency chains between extensions.
- VSIX packaging format enables offline installation and distribution outside the marketplace.
- 17 categories for marketplace filtering: Programming Languages, Snippets, Linters, Themes, Debuggers, Formatters, Keymaps, SCM Providers, Other, Extension Packs, Language Packs, Data Science, Machine Learning, Visualization, Notebooks, Education, Testing.

**What they do poorly:**
- NO extension sandboxing. Extensions run with full process permissions. Microsoft acknowledged this as a fundamental design limitation with no planned fix (microsoft/vscode#52116, #59756).
- Marketplace malware has been a recurring problem. Automated scans catch some but not all malicious extensions.
- Extension host crash takes down ALL extensions (shared process model).

**What FlowForge should adopt:**
- Manifest-driven contributions with typed JSON Schema for validation.
- Activation events (simplified: `onStartup`, `onCommand:id`, `onBlade:type`).
- Category system (5 categories: `blade`, `integration`, `theme`, `workflow`, `tool`).
- SemVer engine compatibility (`engine.flowforge: "^2.0.0"`).

**What FlowForge should skip:**
- Complex marketplace with publishing pipeline. Start with GitHub URL install.
- Extension host process isolation. Overkill for the ecosystem scale.
- 30+ contribution point types. Start with 3: blades, commands, stores.

### GitHub Desktop

**What they do well:**
- Clean, focused UX for commit/push/pull workflows. Does not try to do everything.
- Branch-PR association: shows PR status badge on branches (since v3.0).
- PR notification badges with CI check status (since v3.0).
- Deep OS integration (native notifications, file associations).

**What they do poorly:**
- NO PR review capability (open request since 2022, issues #13262 and #20614 with significant community demand). Cannot view, comment on, or approve PRs in the app.
- NO issue management at all.
- NO extension/plugin system. Zero community extensibility.
- Limited to GitHub only (no GitLab, Bitbucket, Azure DevOps).

**Opportunity for FlowForge:**
- PR viewing and basic commenting would immediately exceed GitHub Desktop's capabilities.
- Extension system enables community to add GitLab/Bitbucket support without core team work.
- GitHub Desktop's limitations are FlowForge's features.

### GitKraken Desktop

**What they do well:**
- Full GitHub integration: create, view, merge PRs; view issues; PR review with code suggestions.
- Multi-platform: GitHub, GitLab, Azure DevOps, Bitbucket.
- Launchpad feature: aggregates PRs/issues across repos and platforms into a single view.
- Drag-and-drop branch interactions (drag branch onto another to create PR).
- DORA Insights for team metrics and development velocity tracking.

**What they do poorly:**
- Freemium model restricts core features (PR review, multi-repo, DORA) to paid tier.
- Heavy application (Electron-based, 200MB+ memory baseline).
- No extension/plugin system for community contributions.
- Complex UI with steep learning curve for new users.
- Expensive for teams ($8.95/user/month for Pro).

**Opportunity for FlowForge:**
- Extension system is a clear differentiator -- no desktop Git client has community extensibility.
- Lighter resource footprint (Tauri ~30MB vs Electron ~200MB).
- GitHub integration shipped AS an extension proves the architecture and enables community alternatives.
- Free and open-source with no feature gating.

### Competitive Positioning Summary

| Capability | GitHub Desktop | GitKraken | FlowForge (Target) |
|-----------|---------------|-----------|-------------------|
| Extension/plugin system | None | None | **Yes -- differentiator** |
| View PRs | Badge only | Full list + details | Full (via extension) |
| PR review/comments | None | Yes (paid tier) | Basic inline comments |
| Merge PRs | None | Yes | Yes (via extension) |
| View/manage issues | None | Yes | Yes (via extension) |
| Toolbar customization | None | Limited | Full (overflow + customize) |
| Multi-platform (GitLab etc.) | None | Yes (paid) | Via community extensions |
| Resource usage | ~150MB (Electron) | ~200MB (Electron) | ~30MB (Tauri) |
| Cost | Free | $8.95/user/mo (Pro) | Free + open source |

---

## New BladeTypes Required

| BladeType | Props | Source | Priority |
|-----------|-------|--------|----------|
| `"extension-manager"` | `Record<string, never>` | Core (not extension) | Phase 1 |
| `"github-pr-list"` | `Record<string, never>` | GitHub extension | Phase 2 |
| `"github-issue-list"` | `Record<string, never>` | GitHub extension | Phase 2 |
| `"github-pr-detail"` | `{ prNumber: number }` | GitHub extension | Phase 2 |
| `"github-issue-detail"` | `{ issueNumber: number }` | GitHub extension | Phase 2 |
| `"github-pr-diff"` | `{ prNumber: number; filePath?: string }` | GitHub extension | Phase 3 |
| `"github-create-pr"` | `{ baseBranch?: string }` | GitHub extension | Phase 3 |

**Note:** Extension-contributed blade types are dynamically registered and NOT added to the static `BladePropsMap` in `bladeTypes.ts`. The extension system needs a parallel dynamic registry that coexists with the compile-time type-safe registry. This is a key architectural decision.

---

## New Command Categories Required

| Category | Commands | Source |
|----------|----------|--------|
| `"Extensions"` | Install extension, Manage extensions, Enable/Disable | Core |
| `"GitHub"` | Sign in, View PRs, View Issues, Create PR, Open in Browser | GitHub extension |

**Note:** `CommandCategory` type in `commandRegistry.ts` currently has 8 categories. Extension-contributed categories need the same dynamic registration approach as blade types.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Extension manifest design | HIGH | VS Code manifest is thoroughly documented; FlowForge's existing registries map cleanly to contribution points |
| Extension lifecycle | MEDIUM | Pattern is well-established in VS Code, but FlowForge's specific integration with Zustand stores and XState needs validation during implementation |
| GitHub OAuth (PKCE) | HIGH | GitHub officially documented PKCE support July 2025; `tauri-plugin-oauth` has working implementations |
| GitHub REST API for PRs/issues | HIGH | Octokit REST v22 is mature, well-typed, extensively documented |
| Toolbar overflow patterns | HIGH | PatternFly, LibreOffice, NN Group all document this pattern consistently |
| Extension permissions enforcement | LOW | Novel feature; no desktop app Git client has this. Runtime enforcement design needs validation |
| Dynamic blade type registration | MEDIUM | Current registry is Map-based and supports runtime additions, but TypeScript type safety for extension-contributed blades needs careful design |
| Secure token storage in Tauri | MEDIUM | Multiple approaches exist (tauri-plugin-store, OS keychain) but best practice for Tauri v2 specifically needs validation |

---

## Sources

### Official Documentation (HIGH confidence)
- [VS Code Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
- [VS Code Activation Events](https://code.visualstudio.com/api/references/activation-events)
- [VS Code Extension Runtime Security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security)
- [GitHub OAuth Authorizing Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub PKCE Support (July 2025)](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/)
- [GitHub OAuth Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [GitHub Fine-Grained PAT Permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [GitHub REST API: Pull Requests](https://docs.github.com/en/rest/pulls/pulls)
- [Octokit REST API v22](https://octokit.github.io/rest.js/v22/)
- [Tauri Deep Linking Plugin](https://v2.tauri.app/plugin/deep-linking/)
- [Tauri Plugin Development](https://v2.tauri.app/develop/plugins/)
- [Semantic Versioning 2.0.0](https://semver.org/)

### UX Guidelines (HIGH confidence)
- [PatternFly Overflow Menu](https://www.patternfly.org/components/overflow-menu/design-guidelines/)
- [PatternFly Toolbar](https://www.patternfly.org/components/toolbar/design-guidelines/)
- [NN Group Contextual Menus](https://www.nngroup.com/articles/contextual-menus/)
- [LibreOffice Toolbar Guidelines](https://wiki.documentfoundation.org/Design/Guidelines/ToolBar)
- [Mobbin Toolbar UI Design](https://mobbin.com/glossary/toolbar)

### Competitor Analysis (HIGH confidence)
- [VS Code Extension Sandbox Issue #59756](https://github.com/microsoft/vscode/issues/59756)
- [VS Code Extension Permissions Issue #52116](https://github.com/microsoft/vscode/issues/52116)
- [GitHub Desktop PR Review Request #13262](https://github.com/desktop/desktop/issues/13262)
- [GitHub Desktop PR Review Request #20614](https://github.com/desktop/desktop/issues/20614)
- [GitKraken GitHub Integration](https://help.gitkraken.com/gitkraken-desktop/github-gitkraken-desktop/)
- [GitKraken GitHub Issues](https://help.gitkraken.com/gitkraken-desktop/github-issues/)

### Community/Ecosystem (MEDIUM confidence)
- [tauri-plugin-oauth](https://github.com/FabianLars/tauri-plugin-oauth)
- [Tauri OAuth Discussion #8554](https://github.com/tauri-apps/tauri/discussions/8554)
- [octokit/auth-oauth-device.js](https://github.com/octokit/auth-oauth-device.js)
