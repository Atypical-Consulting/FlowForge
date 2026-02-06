# Project Milestones: FlowForge

## v1.1.0 Usability (Shipped: 2026-02-06)

**Delivered:** UX overhaul with toast notifications, clone workflow, repo/branch switcher, UI polish suite, and Ungit-style topology with blade navigation and diff viewing.

**Phases completed:** 11-15 (27 plans total)

**Key accomplishments:**

- Toast notification system with queue management, stacking, auto-dismiss, and action buttons wired to 27+ operation sites
- Clone repository with progress tracking, auto-open, and default destination folders
- Repository/branch switcher in top bar with keyboard navigation, search, remote toggle, and stash-and-switch for dirty trees
- UI polish suite: EmptyState illustrations, Skeleton loaders, ShortcutTooltip, frosted glass headers, button loading spinners, dirty-pulse animation
- Ungit-style topology rewrite as SVG+DOM hybrid with lane guide lines, step-path edges, color-coded Gitflow branches
- Blade navigation system with commit details, file tree, Monaco diff viewer, image viewer, and keyboard shortcuts

**Stats:**

- 170 files changed (+18,111/-2,894 lines)
- ~21,559 lines of code (13,937 TypeScript + 7,622 Rust)
- 5 phases, 27 plans, 34 requirements
- 2 days (2026-02-05 → 2026-02-06)
- 112 commits since v1.0

**Git range:** `v1.0` → `v1.1.0`

**Tech debt accepted:**
- defaultTab setting not wired in blade store initialization
- Topology EmptyState and Skeleton consistency
- Orphaned v1.0 code still present
- Phase 15 missing formal SUMMARY/VERIFICATION files

**What's next:** v2.0 — MCP server integration, tiered autonomy model

---

## v1.0 MVP (Shipped: 2026-02-04)

**Delivered:** A cross-platform desktop Git client with enforced Gitflow workflows, conventional commits, topology visualization, and worktree management.

**Phases completed:** 1-8 + 6.1, 6.2 (53 plans total)

**Key accomplishments:**

- Built complete Tauri application with type-safe Rust-React IPC via tauri-specta
- Implemented full Git operations: staging, commits, push/pull/fetch, branches, stash, tags, merge
- Created Gitflow state machine that enforces valid operations (prevents invalid workflows)
- Visualized commit topology with color-coded Gitflow lanes using React Flow + dagre
- Built conventional commit composer with type inference, scope autocomplete, and changelog generation
- Added first-class worktree management with create/delete/switch/status
- Polished UX with Catppuccin Mocha/Latte themes, keyboard shortcuts, file icons, animations
- Achieved performance targets: <100ms operations, <200MB memory, <50MB binary

**Stats:**

- 196 files created/modified
- ~16,355 lines of code (6,518 Rust + 9,837 TypeScript)
- 10 phases, 53 plans, 58 requirements
- 2 days from initialization to ship (2026-02-03 → 2026-02-04)
- 21 quick polish tasks after core phases

**Git range:** `docs: initialize project` → `ci(quick-021): add GitHub Actions release workflow`

**Tech debt accepted:**
- Topology auto-refresh (manual tab switch needed after commits)
- Orphaned code: greet, getMergeStatus, CollapsibleSidebar, AnimatedList, FadeIn

**What's next:** v1.1 — MCP server integration, topology refresh fix, code cleanup

---
