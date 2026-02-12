# Project Research Summary

**Project:** FlowForge v1.8.0 -- Enhanced UX (Diff Viewer, Conflict Resolution, Git Insights, Workspace Layouts, Author Avatars, Commit Heatmaps)
**Domain:** Desktop Git Client UI/UX Enhancement
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

FlowForge v1.8.0 targets critical UI/UX improvements that bring the diff viewer, merge conflict handling, and repository insights to professional-grade standards. Research reveals that the existing stack (Monaco Editor 0.55.1, git2-rs, Tauri 2.x, React 19) already supports most features through built-in APIs. The milestone requires only **7 visx charting packages** as new dependencies -- everything else leverages existing infrastructure or standard browser APIs.

The recommended approach prioritizes **foundation before polish**: build conflict resolution and hunk staging infrastructure first (these have complex Rust backend requirements and critical integration pitfalls), then add insights dashboard (self-contained, read-only extension), and finish with workspace layouts and welcome screen enhancements (pure frontend, low risk). This order front-loads technical complexity while research is fresh and minimizes rework by establishing patterns that later features follow.

**Key risks center on three areas:** Monaco Editor memory leaks (critical -- addressed through explicit disposal and model reuse patterns), git2-rs hunk staging complexity (no native API, requires manual patch construction with index serialization), and IPC serialization overhead for large commit datasets (mitigated by aggregating insights on the Rust side). All three have documented prevention strategies based on verified sources and existing FlowForge patterns.

## Key Findings

### Recommended Stack

**No major stack additions needed.** The existing Monaco Editor 0.55.1 exposes `hideUnchangedRegions` for collapsible diff regions and `diffAlgorithm: 'advanced'` for word-level highlighting -- both requested features are configuration changes, not new dependencies. For conflict resolution, compose multiple Monaco instances (DiffEditor for comparison + Editor for result) within the existing `react-resizable-panels` layout system.

**Only new dependencies:**
- **@visx/\*** (7 packages): Tree-shakable charting primitives for insights dashboard (~18KB gzipped total). Chosen over Recharts/Nivo for minimal bundle impact and SVG-based rendering that matches existing topology panel approach.

**Rust backend additions:**
- Extend `merge.rs` with conflict file extraction commands (`get_conflict_file`, `resolve_conflict`) using git2's `Index::conflicts()` iterator
- Extend `staging.rs` with hunk-level staging (`stage_hunks`) via `Repository::apply()` with filtered diffs
- New `insights.rs` module for aggregated commit statistics (frequency, author stats, file heat map)

**What NOT to add:** diff-match-patch (Monaco handles word diffs natively), md5 package (browser Web Crypto API for Gravatar hashing), Recharts/Nivo/Chart.js (visx is lighter and more composable), CodeMirror (would duplicate Monaco), react-calendar-heatmap (@visx/heatmap covers this).

### Expected Features

**Must have (table stakes):**
- **Collapsible unchanged diff regions** -- VS Code, Sublime Merge, Fork all collapse by default since 2023; users expect to focus on changes without scrolling through 500 unchanged lines. **Complexity: Low** (one Monaco option change).
- **Word-level diff highlighting** -- Sublime Merge, GitKraken, Fork all show character-level inline highlights within changed lines. **Complexity: Low** (verify/tune existing Monaco behavior).
- **Author avatars in commit history** -- GitKraken, Tower, GitExtensions all show Gravatar/GitHub avatars next to commits. **Complexity: Medium** (Gravatar SHA-256 URL generation with cache).

**Should have (competitive differentiators):**
- **Hunk-level staging** -- Stage individual hunks from the diff view. GitKraken and Fork support this; VS Code has partial support. **Complexity: High** (new Rust backend, Monaco gutter UI, careful hunk boundary handling).
- **Three-way merge conflict resolution** -- Inline resolution with base/ours/theirs panels. VS Code's merge editor (since v1.69) shows this pattern. **Complexity: Very High** (new Rust commands, new blade type, three Monaco editors).
- **Git insights dashboard with charts** -- Analytics showing commit frequency, contributor breakdown, code churn. **No desktop Git client ships this built-in as a first-class local feature** (GitKraken Insights is cloud-based premium). **Unique differentiator.**
- **Workspace layout presets** -- Save/restore panel configurations ("Review Mode" with wide diff, "Commit Mode" with wide staging panel). **No competitor offers named Git workspace presets.** **Genuine differentiator.**

**Defer (v2+):**
- **Line-level staging** -- Stage individual lines within a hunk. Very complex patch construction, depends on hunk staging foundation.
- **AI-powered conflict resolution** -- Requires cloud API calls, conflicts with local-first architecture. Build excellent manual UX first.
- **Real-time collaboration** -- No professional desktop Git client offers this; Git itself is not designed for real-time sync.

### Architecture Approach

FlowForge's existing architecture supports these features with minimal structural changes. The blade system accommodates new conflict resolution blades (core) and insights dashboard blade (extension). The Zustand preferences store extends with a new `WorkspaceSlice` for layout presets. The React Query pattern handles all data fetching for insights and conflict data without new store slices.

**Major components:**
1. **Merge conflict resolution blades** (core) -- `merge-conflict` (list view) + `conflict-detail` (three-pane editor) registered via core blade registry, navigated via XState push blade actions
2. **Insights dashboard extension** (built-in) -- Self-contained extension with dedicated blade, registers via `ExtensionAPI.registerBlade()` following the topology extension pattern
3. **Enhanced diff viewers** (modify existing) -- `DiffBlade.tsx` and `InlineDiffViewer.tsx` gain hunk-level staging controls via Monaco glyph margin decorations
4. **Workspace preferences slice** (new) -- Added to existing PreferencesStore composition, persisted via tauri-plugin-store

**Data flow patterns:**
- Conflict resolution: `merge_branch()` returns conflicts → push `merge-conflict` blade → user selects file → push `conflict-detail` blade → `get_conflict_file()` → DiffEditor (ours vs theirs) + Editor (result) → `resolve_conflict()` → invalidate queries
- Insights: New `insights.rs` commands return **pre-aggregated data** (not raw commits) → React Query with generous `staleTime` → visx chart components render SVG
- Hunk staging: Monaco decorations trigger `stage_hunks(path, hunk_indices)` → `Repository::apply()` with filtered diff → invalidate staging status

**Critical integration points:**
- **Monaco memory management:** DiffBlade and InlineDiffViewer must call `editor.dispose()` on unmount and implement model reuse for navigation between files (prevents 1GB+ memory growth)
- **Index operation serialization:** All commands that write to the Git index must acquire a mutex to prevent concurrent corruption (extend `RepositoryState` with `Arc<Mutex<()>>`)
- **Store reset registry:** Any new Zustand stores (workspace layout presets) must register with the existing reset mechanism in `registry.ts` to clear on repo switch

### Critical Pitfalls

1. **Monaco Editor has no native three-way merge support** -- VS Code's merge editor is not available in the standalone Monaco package. Building three-pane sync systems with multiple Monaco instances causes 30-50MB memory overhead per instance, scroll jitter, and duplicated language workers. **Prevention:** Use a TWO-pane approach (DiffEditor for ours vs theirs + editable Editor for result) or render read-only panes as simple HTML, not full Monaco instances.

2. **git2-rs has no native hunk-level staging API** -- libgit2 provides diff reading but no `stage_hunk()` function. Manual patch construction with wrong line offsets silently corrupts the index. **Prevention:** Use `Repository::apply()` with a filtered diff containing only selected hunks, applied to `ApplyLocation::Index`. Serialize all index operations with a mutex. Test extensively with CRLF files, binary files, and overlapping hunks.

3. **Monaco DiffEditor memory leaks on repeated mount/unmount** -- Navigating between files creates and destroys DiffEditor instances. Old models are not automatically disposed. Memory grows 200-500KB per diff pair, reaching 1GB+ after 50-100 diffs. **Prevention:** Always call `editor.dispose()` in cleanup (fix `DiffBlade.tsx` which lacks this). Reuse a single DiffEditor instance and update models via `setValue()` instead of remounting. Implement LRU model cache (max 10-20 diffs).

4. **Tauri IPC serialization bottleneck for large commit history data** -- Fetching thousands of commits for insights sends 2-5MB JSON payloads, freezing the UI for seconds during serialization/deserialization. **Prevention:** Compute aggregates on the Rust side. Send pre-aggregated insights (`HashMap<date_string, u32>` for daily commit counts) instead of raw commit data. This reduces payloads from 2-5MB to 1-5KB. Use pagination aggressively (never >200 raw commits per IPC call).

5. **Conflict data extraction missing three stages for some conflict types** -- Not all conflicts have ancestor/ours/theirs. Add/add conflicts have no ancestor. Delete/modify conflicts may have `ours = None` or `theirs = None`. Code panics or silently skips conflicts without all three entries. **Prevention:** Enumerate all conflict types (modify/modify, add/add, delete/modify, modify/delete, rename/rename, rename/delete). Check all three `Option<IndexEntry>` values before blob lookup. Show clear UI indicators for delete-side conflicts ("file deleted in this branch") instead of empty editor panes.

## Implications for Roadmap

Based on research findings, the recommended phase structure prioritizes foundation-first (complex backend work with critical pitfalls) over polish (pure frontend with low risk). This order front-loads technical complexity while research is fresh and establishes integration patterns that later features follow.

### Phase 1: Foundation -- Conflict Resolution Backend + Merge View
**Rationale:** Three-way merge view requires new Rust commands that other features do not depend on. It is the most complex feature architecturally (new blade type, Monaco composition patterns, conflict state machine) and should be tackled first to establish patterns and address critical pitfalls (#1 Monaco three-way, #3 memory leaks, #5 conflict stage handling) before they compound.

**Delivers:** Full conflict resolution workflow: list conflicted files, three-pane merge editor (DiffEditor + editable result), accept ours/theirs/manual actions, resolve and stage, complete merge. Users can resolve merge conflicts entirely within FlowForge instead of using external merge tools or manually editing conflict markers.

**Addresses features:**
- Three-way merge conflict resolution (differentiator, very high complexity)
- Conflict detail blade (new core blade type)
- Merge conflict list blade (entry point from staging process)

**Avoids pitfalls:**
- #1: Use two-pane approach (DiffEditor + result Editor), not three separate Monaco instances
- #3: Implement explicit editor disposal and model reuse patterns upfront
- #5: Enumerate all conflict types with proper `Option<IndexEntry>` handling
- #10: Model conflict resolution as state machine (Zustand store or XState) to prevent data loss on navigation

**Stack/architecture elements:**
- Extend `merge.rs` with `ConflictFile`, `ConflictResolution` types + commands
- Register new blades: `merge-conflict`, `conflict-detail`
- Wire `StagingChangesBlade` to detect merge state and show entry point
- Monaco DiffEditor + Editor composition within `react-resizable-panels`

### Phase 2: Enhanced Diff Viewer + Hunk-Level Staging
**Rationale:** Builds on existing diff infrastructure and Monaco patterns established in Phase 1. Hunk staging is the highest-value UX improvement (table stakes for professional Git clients) and uses the same Monaco DiffEditor and gutter decoration patterns as the merge view. Addresses critical pitfall #2 (git2-rs hunk staging) while the team has fresh experience with git2 index operations from Phase 1.

**Delivers:** Collapsible unchanged diff regions, word-level diff highlighting, hunk-level staging with per-hunk checkboxes in diff gutters. Users can craft precise commits by staging individual hunks without command-line `git add -p`.

**Addresses features:**
- Collapsible unchanged diff regions (table stakes, low complexity)
- Word-level diff highlighting (table stakes, low complexity)
- Hunk-level staging (differentiator, high complexity)

**Avoids pitfalls:**
- #2: Use `Repository::apply()` with filtered diff, serialize index operations
- #11: Use Monaco's built-in `hideUnchangedRegions` option, not custom folding
- #3: Maintain editor disposal patterns from Phase 1
- I-2: Implement index operation mutex on Rust side

**Stack/architecture elements:**
- Extend `staging.rs` with `stage_hunks` command
- Enhance `InlineDiffViewer` and `DiffBlade` with hunk action buttons
- Configure Monaco options: `hideUnchangedRegions`, `diffAlgorithm: 'advanced'`
- Wire up query invalidation for hunk staging

### Phase 3: Git Insights Dashboard Extension
**Rationale:** Independent of other features. New Rust module + new extension with no dependencies on Phase 1 or 2. Self-contained read-only data visualization that can be built in parallel or immediately after Phase 2. Unique differentiator (no desktop Git client ships built-in local analytics).

**Delivers:** Insights blade with commit frequency charts, author contribution breakdown, file change heat map, commit activity calendar. Pre-aggregated data computed on Rust side for performance. All rendered locally (no cloud APIs).

**Addresses features:**
- Git insights dashboard with charts (differentiator, high complexity)
- Commit heat map (sub-feature of dashboard, medium complexity)
- Author avatars (used in insights and later in commit history, medium complexity)

**Avoids pitfalls:**
- #4: Compute aggregates on Rust side (send summaries, not raw commits)
- #6: Use visx SVG charts for <500 points (sufficient for aggregated data)
- #9: Implement accessibility (text summaries, ARIA labels, keyboard nav)
- #12: Use generous `staleTime` (5+ minutes) + Zustand cache
- #7: Make avatar fetching opt-in, proxy through Rust backend with disk cache

**Stack/architecture elements:**
- New `insights.rs` module with three commands (frequency, author stats, file heat map)
- `src/extensions/insights/` extension skeleton following topology pattern
- `InsightsDashboardBlade` with visx chart sub-components
- `AuthorAvatar` shared component (Gravatar SHA-256 URL generation with Web Crypto API)

### Phase 4: Workspace Layout Presets
**Rationale:** Pure frontend, no Rust changes. Builds on existing react-resizable-panels infrastructure and Preferences store pattern. Low risk polish feature that enhances power user workflows. Genuine differentiator (no competitor offers named Git workspace presets).

**Delivers:** Named workspace presets (Default, Review, Staging, Focused), preset selector UI, custom preset save/delete, focus mode toggle. Panel layouts restore correctly across sessions.

**Addresses features:**
- Workspace layout presets (differentiator, medium complexity)

**Avoids pitfalls:**
- #8: Use versioned layout keys, validation on restore, reset button
- Store presets in Preferences store (not localStorage directly)

**Stack/architecture elements:**
- New `workspace.slice.ts` added to PreferencesStore composition
- `useWorkspaceLayout` hook with imperative `setLayout()` calls
- Integrate with `SplitPaneLayout` and `ResizablePanelLayout`
- Preset selector UI (toolbar action or settings section)

### Phase 5: Welcome Screen + Polish
**Rationale:** Final polish features that enhance existing views without structural changes. Depends on Phase 3 (AuthorAvatar component) for avatar integration in commit list and topology nodes.

**Delivers:** Pinned repos section on welcome screen, repo health indicators (green/yellow/red dots), avatars in commit history and topology graph.

**Addresses features:**
- Welcome screen with pinned repos and health indicators (medium complexity)
- Author avatars in commit history (table stakes, medium complexity, reuses Phase 3 component)

**Avoids pitfalls:**
- #13: Maintain clear visual hierarchy, progressive disclosure for new users
- #7: Avatar fetching already implemented in Phase 3 with privacy protections

**Stack/architecture elements:**
- Modify `welcome-screen` extension blade
- Add lightweight Rust command for repo health check (no full open)
- Integrate `AuthorAvatar` in `CommitHistory.tsx` and `TopologyPanel.tsx`

### Phase Ordering Rationale

**Dependency-driven ordering:**
- Phase 1 establishes Monaco composition patterns (DiffEditor + Editor layout) that Phase 2 builds upon
- Phase 1 establishes git2 index operation patterns (serialization, error handling) that Phase 2's hunk staging requires
- Phase 3 creates `AuthorAvatar` component that Phase 5 reuses for commit history integration
- Phase 4 is independent (can be done earlier if desired) but makes sense as polish after core features

**Risk-driven ordering:**
- Front-load critical pitfalls (#1, #2, #3, #5) in Phase 1-2 when team attention is highest
- Defer low-risk frontend-only work (Phase 4-5) to later when the complex backend/integration work is proven

**Value-driven ordering:**
- Phase 1-2 deliver the highest-impact user-facing improvements (conflict resolution, hunk staging)
- Phase 3 is the unique differentiator (no competitor has built-in local insights)
- Phase 4-5 are quality-of-life enhancements that round out the milestone

**The five phases are independently shippable.** Each phase delivers complete, user-facing functionality. Phase 1 can ship as "FlowForge now has visual conflict resolution." Phase 2 adds "FlowForge now supports hunk-level staging." This allows for incremental releases and user feedback between phases.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 1:** Complex integration (Monaco DiffEditor composition with state machine, conflict stage enumeration). Well-documented patterns exist but FlowForge-specific implementation needs careful planning. Recommend `/gsd:research-phase` for conflict resolution state machine design.
- **Phase 2:** Niche domain (git2-rs patch application API is not well-documented for hunk staging use case). Existing reference implementation in gitui (Rust TUI Git client) should be studied. Recommend `/gsd:research-phase` for hunk staging Rust implementation approach.

**Phases with standard patterns (skip research-phase):**
- **Phase 3:** Well-documented visx charting APIs, React Query patterns already established in FlowForge. Insights aggregation is standard Rust iteration over revwalk. No deep research needed.
- **Phase 4:** react-resizable-panels imperative API is documented and straightforward. Preferences store pattern already established in FlowForge. No deep research needed.
- **Phase 5:** Welcome screen and avatar integration are standard React component work. No deep research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Monaco 0.55.1 type definitions verified directly from `node_modules`, all diff features confirmed available. visx packages verified on npm. Web Crypto API for Gravatar SHA-256 is standard browser API. |
| Features | **HIGH** | All table stakes and differentiators verified against VS Code, GitKraken, Fork, Sublime Merge documentation and community discussions. Complexity estimates based on FlowForge codebase analysis (41K+ LOC TypeScript, 11K+ Rust). |
| Architecture | **HIGH** | Direct codebase analysis of FlowForge v1.7.0. All integration points (blade registry, preferences store, React Query patterns, Rust command registration) verified against existing code. Monaco Editor issue tracker confirms limitations (no three-way merge API). |
| Pitfalls | **HIGH** | All critical pitfalls sourced from verified GitHub issues (Monaco #1295, #3268, #1529, libgit2 #5577, Tauri #7146), official documentation, and direct codebase analysis showing existing patterns (or lack thereof) that trigger each pitfall. |

**Overall confidence:** **HIGH**

Research is based on a combination of:
- Direct verification from installed dependencies (`monaco-editor@0.55.1`, `react-resizable-panels@4.6.2` type definitions)
- Official API documentation (Monaco Editor typedoc, git2-rs docs.rs, Tauri docs)
- Verified GitHub issue discussions with maintainer confirmation (Monaco, libgit2, Tauri)
- Professional Git client documentation (VS Code, GitKraken, Tower, Fork, Sublime Merge)
- Deep codebase analysis of FlowForge v1.7.0 (41K+ LOC TypeScript, 11K+ LOC Rust)

### Gaps to Address

**Gap 1: Hunk staging implementation specifics in git2-rs**
- Research confirms `Repository::apply()` is the correct approach but exact usage for filtered diffs needs implementation verification
- **Mitigation:** Reference gitui (Rust TUI Git client) source code for proven pattern during Phase 2 planning. Consider `/gsd:research-phase` for Rust implementation details.

**Gap 2: Monaco DiffEditor model reuse pattern**
- Research confirms memory leaks exist and disposal is necessary, but optimal model reuse pattern (single instance with model updates vs. lazy remount with disposal) needs performance testing
- **Mitigation:** Prototype both approaches in Phase 2, benchmark with 100+ diffs, document chosen pattern for consistency across DiffBlade and InlineDiffViewer.

**Gap 3: Conflict resolution state machine complexity**
- Research confirms complexity risk (#10 pitfall) but exact state structure (Zustand vs XState, per-file vs global) needs design validation
- **Mitigation:** Recommend `/gsd:research-phase` during Phase 1 planning to design state machine before implementation. Study VS Code merge editor UX patterns.

**Gap 4: Accessibility testing methodology**
- Research confirms WCAG 2.1 Level AA requirements but FlowForge does not have documented accessibility testing procedures
- **Mitigation:** Phase 3 planning should include VoiceOver testing protocol (macOS primary platform) and keyboard navigation test cases for chart interactions before implementation.

All gaps are addressable during phase planning and do not block roadmap creation. The research provides sufficient confidence to structure phases and identify which phases need deeper research (`/gsd:research-phase`) during planning.

## Sources

### Primary (HIGH confidence)

**Verified from installed dependencies:**
- Monaco Editor 0.55.1 type definitions: `node_modules/monaco-editor/monaco.d.ts` -- `hideUnchangedRegions`, `diffAlgorithm`, all DiffEditor options
- react-resizable-panels 4.6.2 type definitions: `node_modules/react-resizable-panels/dist/react-resizable-panels.d.ts` -- imperative panel group API

**Official documentation:**
- [Monaco Editor IDiffEditorBaseOptions API](https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IDiffEditorBaseOptions.html)
- [git2-rs documentation](https://docs.rs/git2/latest/git2/) -- `Repository::apply()`, `Index::conflicts()`, merge APIs
- [Tauri IPC documentation](https://tauri.app/v2/develop/calling-rust/)
- [Web Crypto API for SHA-256](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)
- [Gravatar SHA-256 hashing documentation](https://docs.gravatar.com/rest/hash/)
- [visx GitHub repository](https://github.com/airbnb/visx) and [@visx/heatmap on npm](https://www.npmjs.com/package/@visx/heatmap)

**GitHub issues with maintainer confirmation:**
- [Monaco Editor three-way merge request #3268](https://github.com/microsoft/monaco-editor/issues/3268) -- confirms no native support
- [Monaco Editor hideUnchangedRegions issue #4196](https://github.com/microsoft/monaco-editor/issues/4196) -- confirms feature exists
- [libgit2 hunk staging issue #5577](https://github.com/libgit2/libgit2/issues/5577) -- confirms no native API
- [Tauri IPC serialization discussion #7146](https://github.com/tauri-apps/tauri/discussions/7146) -- documents 3-4s for 400K datapoints

**FlowForge v1.7.0 codebase:**
- Direct analysis of 41K+ LOC TypeScript, 11K+ LOC Rust
- All integration points verified (blade registry, stores, React Query, Rust commands)

### Secondary (MEDIUM confidence)

**Professional Git client documentation:**
- [VS Code v1.81 release notes (collapse unchanged regions)](https://code.visualstudio.com/updates/v1_81)
- [VS Code Merge Editor docs](https://code.visualstudio.com/docs/sourcecontrol/merge-conflicts)
- [GitKraken staging documentation](https://help.gitkraken.com/gitkraken-desktop/staging/)
- [GitKraken Insights](https://help.gitkraken.com/gk-dev/gk-dev-insights/)
- [Tower Gravatar integration](https://www.git-tower.com/help/guides/faq-and-tips/faq/gravatars/windows)
- [Sublime Merge diff context](https://www.sublimemerge.com/docs/diff_context)
- [react-resizable-panels imperative API examples](https://react-resizable-panels.vercel.app/examples/imperative-panel-group-api)

**Community discussions:**
- [VS Code three-way merge UX exploration #146091](https://github.com/microsoft/vscode/issues/146091)
- [Gravatar privacy concerns - Bleeping Computer](https://www.bleepingcomputer.com/news/security/online-avatar-service-gravatar-allows-mass-collection-of-user-info/)

**Performance benchmarks:**
- [Apache ECharts SVG vs Canvas comparison](https://apache.github.io/echarts-handbook/en/best-practices/canvas-vs-svg/)

### Tertiary (LOW confidence)

**Accessibility guidelines (general best practices, not FlowForge-specific testing):**
- [Highcharts 10 Guidelines for DataViz Accessibility](https://www.highcharts.com/blog/tutorials/10-guidelines-for-dataviz-accessibility/)
- [Smashing Magazine - Accessibility-First Chart Design](https://www.smashingmagazine.com/2022/07/accessibility-first-approach-chart-visual-design/)

---
*Research completed: 2026-02-12*
*Ready for roadmap: yes*
