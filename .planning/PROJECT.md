# FlowForge

## What This Is

A cross-platform desktop Git client built on Tauri (Rust backend + React frontend) that makes Gitflow, conventional commits, and worktrees the structural foundation of the interface — not afterthoughts buried in menus. The client enforces workflow conventions through its architecture, preventing invalid operations rather than just warning about them. Features a blade-based navigation system with 22 blade types managed by an XState finite state machine, co-located feature modules, 3 consolidated domain stores, an extension platform with the GitHub integration as the first shipped extension, and a data-driven toolbar with overflow handling.

## Core Value

**The intelligence is in the agent; the authority is in the infrastructure.** The Rust backend is the policy engine that enforces workflow rules — no operation violates Gitflow, no commit message breaks conventional format, no agent or human bypasses the guardrails. Trust comes from constraints that cannot be circumvented.

## Architecture Philosophy

The product is designed in concentric circles, each standing alone:

1. **Inner circle (v1):** Best-in-class Git client with visual Gitflow, smart conventional commits, first-class worktrees, and an extension platform with GitHub integration. No AI required — just excellent UX for powerful Git features.

2. **Middle circle (v2+):** Local intelligence layer — rule-based heuristics in v1, embedded lightweight model in v2+. Smart commit suggestions, semantic diff analysis, conflict annotation. Works offline, no external dependencies.

3. **Outer circle (v2+):** MCP server exposing repository state and workflow operations as structured tools. Enables AI agents to orchestrate Git workflows with policy-enforced guardrails. The tiered autonomy model (full autonomy / inform and proceed / hard stop) governs what agents can do without human approval.

Each layer adds value; each inner layer stands without the outer ones.

## Requirements

### Validated

- ✓ Tauri application scaffolding with Rust backend and React frontend — v1.0
- ✓ Core Git operations via git2-rs (stage, commit, push, pull, merge, branch, log) — v1.0
- ✓ Gitflow state machine in Rust enforcing valid operations — v1.0
- ✓ Topology panel with color-coded Gitflow lanes (main, develop, feature/*, release/*, hotfix/*) — v1.0
- ✓ Contextual branch creation dialogs (options adapt to current branch context) — v1.0
- ✓ Guided merge flows with no-fast-forward enforcement for Gitflow — v1.0
- ✓ Automatic branch cleanup after successful merge — v1.0
- ✓ Conventional commit composer with rule-based suggestions — v1.0
- ✓ Scope inference from file paths and directory structure — v1.0
- ✓ Type inference from change patterns (new files → feat, tests → test, etc.) — v1.0
- ✓ Real-time commit message validation against conventional commit spec — v1.0
- ✓ Scope autocomplete from project commit history — v1.0
- ✓ Changelog generation from conventional commit history — v1.0
- ✓ Worktree management panel showing all active worktrees — v1.0
- ✓ Worktree creation from any branch (two-click flow) — v1.0
- ✓ Worktree deletion with cleanup confirmation — v1.0
- ✓ Worktree status display (clean, dirty, conflicts) — v1.0
- ✓ Cross-platform support (macOS, Windows, Linux via Tauri) — v1.0
- ✓ Performance on large repositories (<100ms for common operations) — v1.0
- ✓ Dark/light theme toggle with Catppuccin Mocha/Latte — v1.0
- ✓ Keyboard shortcuts for common operations — v1.0
- ✓ Commit search by message text — v1.0
- ✓ Undo Git operations via reflog — v1.0
- ✓ File watcher for external change detection — v1.0

- ✓ Left panel readability (text size, action icons not overlapping) — v1.1
- ✓ Conventional Commits checkbox unchecked by default — v1.1
- ✓ Conventional Commits panel not covering changes list — v1.1
- ✓ Repository/branch switcher in top bar (GitHub Desktop style) — v1.1
- ✓ Settings grouped into dedicated settings window — v1.1
- ✓ Clone repository from within app — v1.1
- ✓ Ungit-style topology graph with SVG+DOM hybrid, lane guides, step-path edges — v1.1
- ✓ Topology center panel shows commit details on selection — v1.1
- ✓ Amend commit reloads previous commit message — v1.1
- ✓ Initialize Gitflow from app for non-Gitflow repos — v1.1
- ✓ Inspect diffs of previous commits in History view — v1.1
- ✓ Toast notification system with queue, stacking, auto-dismiss — v1.1
- ✓ Empty state illustrations for staging, stash, tags, commit history — v1.1
- ✓ Keyboard shortcut tooltips on 6 buttons — v1.1
- ✓ Button loading spinners with per-action states — v1.1
- ✓ Panel header frosted glass effect on 5 sidebar sections — v1.1
- ✓ Dirty state pulse animation on branch switcher — v1.1
- ✓ Blade navigation system with commit details, file tree, diff viewer — v1.1
- ✓ Topology auto-refresh after commits (fixed v1.0 tech debt) — v1.1
- ✓ Skeleton loaders replacing spinners during data fetch — v1.1

- ✓ VS Code-style command palette with registry pattern and fuzzy search — v1.2
- ✓ Git identity and integrations settings tabs — v1.2
- ✓ Git init onboarding prompt for non-repo folders — v1.2
- ✓ Folder-level stage/unstage in hierarchical view — v1.2
- ✓ Color-coded conventional commit type icons across all views — v1.2
- ✓ Changelog generation with commit type emoji — v1.2
- ✓ Expanded Catppuccin file-type icon set (image, font, archive, env) — v1.2
- ✓ Visual polish: modal flicker fix, subtler blade animation, tag sorting, stash labels — v1.2
- ✓ Shortcut tooltips on toolbar buttons — v1.2
- ✓ Topology branch ordering (main/develop first) — v1.2
- ✓ Diff header formatting (path gray + filename bold) — v1.2
- ✓ Blade refresh on repository switch — v1.2

- ✓ Settings migrated from modal to blade with back navigation — v1.3
- ✓ Conventional commit composer inline in commit form (blade-integrated) — v1.3
- ✓ Changelog preview as blade instead of modal dialog — v1.3
- ✓ All modal mounts removed from App.tsx — v1.3
- ✓ Extensible blade registry (1-2 files to add new blade type) — v1.3
- ✓ Type-safe blade props with compile-time validation — v1.3
- ✓ Error boundaries and Suspense fallbacks on all blades — v1.3
- ✓ Two-column Changes/Staged layout with inline diff preview — v1.3
- ✓ Inline diff expand to full-screen diff blade — v1.3
- ✓ Markdown preview blade with GFM support — v1.3
- ✓ Code viewer blade with Monaco read-only editor — v1.3
- ✓ 3D model viewer blade with orbit controls (Three.js + GLTFLoader) — v1.3
- ✓ Repository file browser blade at HEAD with breadcrumbs — v1.3
- ✓ Gitflow cheat sheet blade with SVG diagram and "You are here" indicator — v1.3
- ✓ DiffBlade markdown preview toggle for .md files — v1.3
- ✓ Branch pin/favorites with persistent Quick Access section — v1.3
- ✓ Branch scope selector (Local/Remote/Last Used) — v1.3
- ✓ Bulk delete merged branches with Gitflow protection — v1.3
- ✓ Feature branch tags in purple across topology and branch lists — v1.3
- ✓ Contextual clone/reveal button in branch management — v1.3
- ✓ Pre-merge review checklist for Gitflow finish operations — v1.3
- ✓ Documentation website on GitHub Pages — v1.3
- ✓ Rust commands for repo file browsing (list_repo_files, read_repo_file) — v1.3
- ✓ Lazy-loaded viewer dependencies (react-markdown, three.js, Monaco) — v1.3
- ✓ Unified branch classification and color system — v1.3

- ✓ XState navigation FSM with push/pop/replace/reset events and guards — v1.4
- ✓ Type-safe blade stack with TypedBlade entries in XState context — v1.4
- ✓ Navigation guards preventing data loss from unsaved forms — v1.4
- ✓ Atomic process switching (staging/topology) via FSM events — v1.4
- ✓ Singleton blade enforcement via FSM guards — v1.4
- ✓ Max blade depth limit with toast notification — v1.4
- ✓ Navigation accessible from hooks, palette, and non-React contexts — v1.4
- ✓ XState visual inspector in dev mode — v1.4
- ✓ Direction-aware blade transition animations — v1.4
- ✓ Dirty-form indicator on blade strips — v1.4
- ✓ Init Repo blade with .gitignore template search (163 templates) — v1.4
- ✓ .gitignore template preview, multi-template composition — v1.4
- ✓ Offline .gitignore bundled fallback (top 15-20 templates) — v1.4
- ✓ Smart .gitignore recommendations via project type detection — v1.4
- ✓ .gitignore templates grouped by category (Languages, Frameworks, Editors, OS) — v1.4
- ✓ Default branch name selection during init — v1.4
- ✓ Optional README and initial commit during init — v1.4
- ✓ Full-width Conventional Commit blade workspace — v1.4
- ✓ Commit-and-push workflow with auto-navigate back — v1.4
- ✓ Amend commit with pre-filled type/scope/description — v1.4
- ✓ Commit templates (7 built-in patterns) — v1.4
- ✓ Scope frequency chart from commit history — v1.4
- ✓ Inline sidebar CC form coexists with blade mode — v1.4
- ✓ Co-located blade feature modules (src/blades/{name}/) — v1.4
- ✓ Single-glob blade auto-discovery — v1.4
- ✓ Import boundary enforcement (CI script) — v1.4
- ✓ Vitest + jsdom test infrastructure with 140 tests — v1.4
- ✓ Zustand auto-reset mock for test isolation — v1.4
- ✓ Typed Tauri mock factories (18+ commands) — v1.4
- ✓ Domain-grouped stores (GitOps, UIState, Preferences) — v1.4
- ✓ Store registry with resetAllStores for atomic repo close — v1.4
- ✓ Blade store factory with auto-reset registration — v1.4
- ✓ closeRepository resets blade stack (stale content fix) — v1.4
- ✓ Topology empty state for zero-commit repos — v1.4
- ✓ Orphaned v1.0 code removed, debug page excluded — v1.4
- ✓ Gitflow cheatsheet registered in command palette — v1.4
- ✓ Review store errors surface as user-facing toasts — v1.4
- ✓ defaultTab setting wired in blade initialization — v1.4
- ✓ Cmd+K keyboard shortcut for command palette — v1.4

- ✓ Strict Content-Security-Policy enforced before extension loading — v1.5
- ✓ Asset protocol disabled, Tauri capabilities narrowed to minimum scopes — v1.5
- ✓ Data-driven toolbar with ToolbarRegistry replacing hardcoded buttons — v1.5
- ✓ Toolbar groups by intent with visual dividers and overflow menu — v1.5
- ✓ Context-based toolbar visibility (repo open/closed, auth state) — v1.5
- ✓ Per-action show/hide settings persisted in preferences — v1.5
- ✓ Extension manifest format with lifecycle, permissions, and API versioning — v1.5
- ✓ ExtensionHost with filesystem discovery and activate/deactivate lifecycle — v1.5
- ✓ ExtensionAPI facade with namespaced blade/command/toolbar registration — v1.5
- ✓ Registry unregister support for blades and commands — v1.5
- ✓ apiVersion compatibility checking with user-visible error on mismatch — v1.5
- ✓ GitHub OAuth Device Flow with scope selection — v1.5
- ✓ OAuth tokens stored in OS keychain (never plaintext) — v1.5
- ✓ Automatic GitHub remote detection and account linking — v1.5
- ✓ GitHub API rate limit tracking with toolbar badge and warning toast — v1.5
- ✓ PR list/detail blades with status, CI checks, comments — v1.5
- ✓ Issue list/detail blades with labels, assignee, comments — v1.5
- ✓ Extension-contributed toolbar actions through shared registry — v1.5
- ✓ PR merge with strategy selector (merge/squash/rebase) and confirmation — v1.5
- ✓ PR creation from current branch with auto-filled title and body — v1.5
- ✓ Extension install from GitHub URL with manifest validation — v1.5
- ✓ Extension Manager blade with enable/disable toggles and uninstall — v1.5
- ✓ Extension contribution display (blades, commands, toolbar actions) — v1.5
- ✓ Extension permission display during install review — v1.5
- ✓ Extension enable/disable state persisted across sessions — v1.5

### Active

(No active requirements — next milestone not yet defined)

### Deferred to v2+

- [ ] MCP server exposing repository state as structured resources
- [ ] MCP Git operations as tools with policy enforcement
- [ ] Tiered autonomy model for agent operations

### Out of Scope

- Embedded LLM for semantic analysis — rule-based heuristics are sufficient for v1
- Choreography view and tiered autonomy UI — depends on MCP, therefore v2
- Policy configuration file (.gitclient-policy.yml) — v2 alongside MCP; guardrails exist in v1 but aren't user-configurable
- Interactive rebase drag-and-drop — valuable polish, not core differentiator, v3
- Smart staging with automatic changeset grouping — underserved not unserved, v3
- Branch health monitoring (staleness, drift indicators) — ambient UX enhancement, v3
- Built-in code editor — scope creep, IDE competition
- Mercurial/SVN support — Git-only focus
- CI/CD integration — feature creep (CI status indicators on PRs sufficient)
- Built-in terminal — users have terminals
- Full PR review with inline code comments — GitHub/GitLab do this well (lightweight checklist in v1.3, read + basic actions in v1.5)
- Real-time collaboration — high complexity
- Mobile apps — desktop-first
- Extension sandboxing (iframe/Worker) — only first-party GitHub extension in v1.5; sandboxing needed when third-party extensions arrive
- Extension marketplace — URL-based install sufficient; marketplace requires hosting infrastructure
- GitHub Actions log viewing — CI status indicators on PRs sufficient
- GitLab/Bitbucket integration — GitHub-first; other providers can be extensions later
- Extension auto-update — security risk without review; manual update safer

## Context

**Current state:** Shipped v1.5.0 with ~45,227 LOC (34,152 TypeScript + 11,075 Rust).
Tech stack: Tauri 2.x, React 19, XState v5, Zustand (3 domain stores), React Query, Monaco Editor, Three.js, framer-motion, reqwest, keyring.
All 209 requirements implemented across 36 phases (~201 plans) in six milestones.
22 blade types in co-located feature modules with XState FSM navigation.
Extension platform with GitHub integration as first shipped extension (7 blades, 5 commands, 4 toolbar actions).
Data-driven toolbar with 15+ core actions and extension contributions.
137 tests (Vitest + jsdom) covering stores, components, and machine logic.
Documentation website live on GitHub Pages.

**Known tech debt:**
- 16 backward-compatibility re-export shims (@deprecated) for gradual consumer migration
- CC blade accessibility polish (aria-live debounce, amend mode styling, aria-labels)
- Init Repo blade UX refinements (focus behavior, listbox pattern, aria-describedby)
- 3D viewer reliability on some hardware (diagnostic logging only)
- Pre-existing TS2440 in auto-generated bindings.ts
- Phase 34 human runtime testing pending (6 OAuth flow items)
- Missing formal VERIFICATION.md for phases 35-36 (mitigated by UAT/integration evidence)

**v2 vision:** MCP server exposing repository state (branches, worktrees, commit history, diffs, Gitflow context) as structured resources and tools. Tiered autonomy model:
- **Tier 1 (full autonomy):** Reversible, local, convention-clear operations
- **Tier 2 (inform and proceed):** Low-risk expected outcomes
- **Tier 3 (hard stop):** Irreversible, cross-boundary, or ambiguous

## Constraints

- **Tech stack**: Tauri + Rust + React — non-negotiable for performance and cross-platform goals
- **Git integration**: git2-rs (libgit2) for performance; CLI fallback where needed
- **Binary size**: Target <50MB installed (achieved in v1.0)
- **Memory**: Target <200MB baseline (achieved in v1.0)
- **Offline-first**: Core functionality works without network; MCP and sync are additive
- **Extension security**: First-party extensions only in v1.x; sandboxing required before third-party

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Defer MCP to v2 | API surface needs real usage patterns; shipping prematurely creates bad contracts | ✓ Good — shipped v1 faster |
| Rule-based commit suggestions in v1 | 80% accuracy with zero dependencies; embedded model is v2 enhancement | ✓ Good — works well |
| Gitflow as structural, not optional | Core differentiator; enforcing workflow prevents errors rather than warning | ✓ Good — state machine works |
| Tauri over Electron | Performance, memory, binary size all dramatically better | ✓ Good — <50MB binary |
| git2-rs over shell-out | Performance and type safety; CLI fallback only where needed | ✓ Good — fast operations |
| tauri-specta for IPC | Type-safe bindings eliminate manual sync between Rust and TypeScript | ✓ Good — zero type drift |
| React Flow + dagre for topology | Standard graph visualization with good layout algorithm | ✓ Good — clear visualization |
| Catppuccin for theming | Modern, cohesive palette with dark/light variants | ✓ Good — polished appearance |
| Zustand + React Query | Simple state management, powerful async handling | ✓ Good — clean architecture |
| SVG+DOM hybrid for topology (v1.1) | React Flow too rigid for Ungit-style; custom SVG gives full layout control | ✓ Good — lane guides + step-path edges |
| Blade navigation pattern (v1.1) | Stack-based navigation for commit details/diff viewing; breadcrumb-like UX | ✓ Good — clean push/pop semantics |
| Monaco DiffEditor for diffs (v1.1) | Professional diff rendering with syntax highlighting, inline/side-by-side toggle | ✓ Good — high-quality diff UX |
| framer-motion for animations (v1.1) | MotionConfig with reducedMotion="user" for accessibility | ✓ Good — respects OS preferences |
| Event-driven auto-refresh (v1.1) | "repository-changed" event triggers topology reload instead of polling | ✓ Good — efficient, reliable |
| Command registry pattern (v1.2) | Centralized command definitions enable palette, shortcuts, and tooltips from single source | ✓ Good — 14 commands, single registration |
| Shared commit type theme (v1.2) | Single COMMIT_TYPE_THEME module used by 4 consumers instead of per-component definitions | ✓ Good — no duplication |
| git-cliff for changelogs (v1.2) | Automated changelog generation from conventional commits in CI/CD | ✓ Good — release notes auto-generated |
| Blade registry over switch statement (v1.3) | Registry pattern reduces per-blade change footprint from 4-7 files to 1-2 | ✓ Good — extensible, type-safe |
| Three.js over model-viewer (v1.3) | model-viewer Web Component conflicts with React lifecycle; Three.js gives full control | ✓ Good — reliable rendering |
| Lazy-loaded content blades (v1.3) | Heavy dependencies (Three.js, Monaco, react-markdown) loaded on demand, zero startup impact | ✓ Good — no performance regression |
| Lightweight review checklist over full PR review (v1.3) | Avoids duplicating GitHub/GitLab; encourages review habits without blocking merges | ✓ Good — non-intrusive guidance |
| VitePress for documentation (v1.3) | Vue-based SSG with excellent DX, Catppuccin theme integration, GitHub Pages deployment | ✓ Good — fast, polished docs site |
| XState v5 for navigation FSM (v1.4) | Explicit state machine replaces imperative Zustand store; provides guards, observers, inspector | ✓ Good — type-safe, debuggable |
| Zustand slices pattern for domain stores (v1.4) | Compose 9+ slices into single store; prefixed keys prevent collision | ✓ Good — clean composition |
| Store registry for atomic reset (v1.4) | resetAllStores() ensures clean state on repo close without manual per-store calls | ✓ Good — no stale state |
| createBladeStore factory (v1.4) | Auto-registers for reset + devtools; extensibility pattern for new blades | ✓ Good — consistent behavior |
| Blade-centric file structure (v1.4) | Co-located modules reduce context switching; single-glob discovery eliminates manual registration | ✓ Good — 15 blade modules |
| Backward-compat re-export shims (v1.4) | Zero-breaking-change migration; @deprecated annotations guide gradual adoption | ✓ Good — no consumer changes needed |
| reqwest with rustls-tls for GitHub API (v1.4) | Cross-platform TLS without system dependency; gitignore template fetching | ✓ Good — works on all OS |
| Bundled templates via include_str! (v1.4) | Compile-time embedding for offline fallback; no runtime resource loading | ✓ Good — reliable offline |
| Vitest + jsdom for testing (v1.4) | Fast, modern test runner with excellent Vite integration; jsdom for component tests | ✓ Good — 140 tests, <5s |
| Direction-aware blade animations (v1.4) | Push slides right, pop slides left, replace crossfades; respects prefers-reduced-motion | ✓ Good — polished UX |
| Strict CSP before extensions (v1.5) | Prevent XSS/data exfiltration before any extension code loads or external APIs are called | ✓ Good — defense in depth |
| Data-driven toolbar over hardcoded buttons (v1.5) | Registry pattern enables extension contributions, overflow handling, user customization | ✓ Good — extensible, 15+ actions |
| Union type for ToolbarGroup (v1.5) | Extensions can add custom group strings without modifying core enum | ✓ Good — open for extension |
| Manifest-driven extension system (v1.5) | Declarative capabilities, API versioning, filesystem discovery — simple and predictable | ✓ Good — clean lifecycle |
| Namespaced extension registrations (v1.5) | ext:{id}:{name} format prevents collisions between core and extension blade/command types | ✓ Good — zero collisions |
| registerBuiltIn for bundled extensions (v1.5) | Same lifecycle as third-party but discoverable at startup without filesystem scan | ✓ Good — uniform API |
| OAuth Device Flow over PKCE (v1.5) | No localhost redirect needed; works in all environments without port conflicts | ✓ Good — reliable auth |
| keyring crate for token storage (v1.5) | OS-native keychain on all platforms; tokens never touch plaintext files | ✓ Good — secure by default |
| Virtuoso for PR/issue lists (v1.5) | Efficient virtual scrolling for potentially long lists; familiar API | ✓ Good — smooth performance |
| Extension Manager as core blade (v1.5) | Manages all extensions; shouldn't be an extension itself | ✓ Good — always available |
| Disabled vs deactivated extension states (v1.5) | disabled = user-intentional (persisted), deactivated = runtime cleanup — clear semantics | ✓ Good — predictable behavior |

---
*Last updated: 2026-02-10 after v1.5.0 milestone*
