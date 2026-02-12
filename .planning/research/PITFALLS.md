# Domain Pitfalls: UI/UX Enhancement Features for FlowForge v1.8.0

**Domain:** Git client UI/UX enhancements (enhanced diff viewer, inline conflict resolution, git insights dashboard, customizable workspace layouts, welcome screen, branch/commit visualization)
**Project:** FlowForge v1.8.0 (subsequent milestone after v1.7.0 Extensions Everywhere)
**Researched:** 2026-02-12
**Overall confidence:** HIGH (based on deep codebase analysis, Monaco/git2-rs issue trackers, and Tauri IPC documentation)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or major architectural problems.

---

### Pitfall 1: Monaco Editor Has No Native Three-Way Merge Support

**What goes wrong:** Developers assume Monaco's `DiffEditor` can be extended to show three-way merge (base, ours, theirs) with a result pane, similar to VS Code's merge editor. Monaco Editor does NOT expose the three-way merge editor that VS Code uses internally. The `DiffEditor` is strictly a two-way comparison widget. Attempting to build three-way merge by placing three Monaco editors side-by-side leads to synchronization nightmares, duplicated language worker instances, and memory bloat.

**Why it happens:** VS Code is built on Monaco, so people assume all VS Code features are available in the Monaco Editor npm package. They are not. The merge editor is part of VS Code's workbench layer, not the standalone Monaco editor.

**Consequences:**
- Building a custom three-panel sync system takes 2-4x longer than expected
- Each additional Monaco instance adds ~30-50MB memory and worker thread overhead
- Scroll synchronization across three editors is fragile (scroll events fire asynchronously, causing jitter)
- Completion providers, decorations, and language workers are shared globally -- duplicated suggestions appear across instances
- FlowForge already has DiffEditor in `DiffBlade.tsx` and `InlineDiffViewer.tsx` -- adding a third editor per conflict file triples memory pressure

**Prevention:**
- Use a TWO-pane approach instead: show the merged result with inline conflict markers, let users toggle between "ours" and "theirs" overlays using Monaco decorations and ViewZones
- Use Monaco's `hideUnchangedRegions` option (already available in the DiffEditor API) to collapse non-conflicting sections
- Extract all three versions (ancestor, ours, theirs) from git2-rs via `index.conflicts()` iterator on the Rust side, but render them as decoration overlays on a single editor instance, not as three separate editors
- If full three-pane is absolutely required, consider a lightweight read-only renderer (syntax-highlighted `<pre>` blocks) for the base and incoming panes, with only the result pane using Monaco
- Reference VS Code's merge editor UX pattern: branches on top (read-only), result below (editable) -- but implement the read-only panes as simple HTML, not full Monaco instances

**Detection:** Warning signs include: more than 2 Monaco editor instances per view, scroll synchronization code exceeding 50 lines, or user reports of typing lag after opening conflict resolution.

**Confidence:** HIGH -- based on Monaco Editor GitHub issues [#1295](https://github.com/microsoft/monaco-editor/issues/1295), [#3268](https://github.com/microsoft/monaco-editor/issues/3268), and [#1529](https://github.com/microsoft/monaco-editor/issues/1529), confirmed no native three-way support exists.

---

### Pitfall 2: git2-rs / libgit2 Does Not Support Hunk-Level Staging Natively

**What goes wrong:** Implementing "stage this hunk" or "stage these lines" features by looking for a built-in git2-rs API, finding nothing, then either abandoning the feature or building an incorrect manual implementation that corrupts the index.

**Why it happens:** libgit2 (and by extension git2-rs 0.20) provides diff/patch APIs for *reading* hunks but has no `stage_hunk()` or `stage_lines()` function. Git CLI's `git add -p` works by constructing synthetic patches and applying them to the index -- this logic lives in Git's Perl/C scripts, not in libgit2.

**Consequences:**
- Incorrect patch construction can silently corrupt the index (wrong line offsets after applying partial hunks)
- Off-by-one errors in hunk headers (`@@ -start,count +start,count @@`) cause Git to reject the patch or apply it to the wrong location
- Binary files or files with CRLF line endings break manual patch construction
- Concurrent hunk staging while the user is also staging full files via the existing `stage_file` command creates race conditions on the index lock

**Prevention:**
- Implement hunk staging by: (1) reading the full diff with `DiffOptions`, (2) constructing a filtered diff containing only the selected hunks, (3) applying it to the index using `git2::Repository::apply()` with `ApplyLocation::Index`
- The `git2::Repository::apply()` method accepts a `Diff` object -- construct a filtered diff containing only the desired hunks
- Always serialize index-modifying operations: the existing `RepositoryState` should be extended with a `Mutex<()>` for index operations to prevent concurrent `index.write()` calls from `stage_file`, `unstage_file`, and new `stage_hunk` commands
- Test extensively with: CRLF files, files with no trailing newline, renamed files, binary files adjacent to text changes, and files with overlapping hunks
- FlowForge's current `staging.rs` uses `index.add_path()` for whole files -- hunk staging must use a completely different code path through `repo.apply()`
- Reference how gitui (Rust-based Git TUI, also uses git2-rs) implements hunk staging for a proven pattern

**Detection:** Warning signs include: manually constructing patch strings with `format!`, not using `repo.apply()`, or any code that modifies `DiffHunk` header line numbers manually.

**Confidence:** HIGH -- confirmed via libgit2 issues [#5577](https://github.com/libgit2/libgit2/issues/5577) and [#195](https://github.com/libgit2/libgit2sharp/issues/195), plus git2-rs docs showing `apply()` exists but no `stage_hunk()`.

---

### Pitfall 3: Monaco DiffEditor Memory Leaks on Repeated Mount/Unmount

**What goes wrong:** Navigating between files in the diff view (which FlowForge already does via `StagingDiffNavigation`) creates and destroys DiffEditor instances. Each mount creates new editor models, workers, and event listeners. Without explicit disposal, memory grows unbounded -- 1GB+ after extended use is documented.

**Why it happens:** `@monaco-editor/react`'s `DiffEditor` component creates new `ITextModel` instances for `original` and `modified` on each prop change. Old models are not automatically disposed. Language workers accumulate across mounts. The `InlineDiffViewer.tsx` already has `editorRef` cleanup in `useEffect`, but `DiffBlade.tsx` does NOT call `editor.dispose()` or clean up models.

**Consequences:**
- Memory usage grows linearly with each file viewed (200-500KB per diff pair for typical source files)
- After viewing 50-100 diffs, Tauri's WebView process can consume 1GB+, causing OS memory pressure and potential OOM kills
- Duplicate `onDidScrollChange` listeners fire on stale editor references
- TypeScript/JavaScript language workers pile up, causing CPU spikes during diff computation

**Prevention:**
- Always call `editor.dispose()` in the component's cleanup -- fix `DiffBlade.tsx` which currently lacks this
- Reuse a single DiffEditor instance and update models via `editor.getModel().original.setValue()` / `editor.getModel().modified.setValue()` instead of remounting the component
- Track and dispose `ITextModel` instances explicitly using `monaco.editor.getModels()` to find orphans
- Set `keepCurrentOriginalModel` and `keepCurrentModifiedModel` to `false` (default) to let the DiffEditor dispose models automatically
- Implement a model cache with an LRU eviction policy (max 10-20 cached diffs) rather than unlimited creation
- The 150ms debounce in `InlineDiffViewer.tsx` helps reduce rapid queries but does not prevent the underlying model leak

**Detection:** Warning signs include: `performance.memory.usedJSHeapSize` growing monotonically during file navigation, or `monaco.editor.getModels().length` exceeding 20-30 in the browser console.

**Confidence:** HIGH -- documented in Monaco issues [#110](https://github.com/react-monaco-editor/react-monaco-editor/issues/110), [#132](https://github.com/react-monaco-editor/react-monaco-editor/issues/132), [#1693](https://github.com/microsoft/monaco-editor/issues/1693), and [#398](https://github.com/suren-atoyan/monaco-react/issues/398).

---

### Pitfall 4: Tauri IPC Serialization Bottleneck for Large Commit History Data

**What goes wrong:** Fetching thousands of commits for activity charts, heat maps, or extended graph views sends large JSON payloads across the Tauri IPC boundary. The serialization/deserialization overhead can freeze the UI for seconds.

**Why it happens:** Tauri serializes all IPC data as JSON strings. FlowForge's current `get_commit_graph` caps at 500 nodes (see `graph.rs` line 126: `limit.unwrap_or(100).min(500)`), but insights dashboards need aggregate data across thousands of commits. A repo with 10,000 commits generates ~2-5MB of JSON when including timestamps, authors, and file stats. Tauri discussion #7146 documents 3-4 seconds for 400K datapoints.

**Consequences:**
- UI freezes during data transfer (`JSON.parse` on 5MB blocks main thread for 50-200ms)
- Users on repos with 50K+ commits (Linux kernel, Chromium) experience multi-second hangs
- Multiple concurrent IPC calls (graph + insights + history) can saturate the channel
- Memory spikes from holding both serialized and deserialized copies simultaneously

**Prevention:**
- **Compute aggregates on the Rust side:** instead of sending raw commit data, send pre-aggregated insights (e.g., `HashMap<date_string, u32>` for daily commit counts, `HashMap<author, u32>` for contributor stats). This reduces payloads from 2-5MB to 1-5KB.
- Create dedicated Rust commands: `get_commit_activity_stats`, `get_contributor_stats`, `get_file_change_heatmap` that walk the revwalk once and return only aggregated numbers
- Use pagination aggressively: never send more than 200 raw commits in a single IPC call
- Use `staleTime` in React Query (FlowForge already does this for commit diffs with `staleTime: 60000`) with a generous value (5-10 minutes) for insights data
- For real-time updates, use Tauri events to stream incremental results rather than synchronous command responses
- Consider Tauri v2's raw byte transfer for truly large payloads where JSON overhead matters

**Detection:** Warning signs include: IPC commands returning arrays with 1000+ items, `JSON.parse` appearing in DevTools performance profiles, or visible UI jank when switching to the insights tab.

**Confidence:** HIGH -- confirmed via Tauri discussions [#7146](https://github.com/tauri-apps/tauri/discussions/7146) and [#7127](https://github.com/tauri-apps/tauri/issues/7127).

---

### Pitfall 5: Conflict Data Extraction Missing Three Stages for Some Conflict Types

**What goes wrong:** Using `index.conflicts()` to extract ancestor/ours/theirs content, but encountering `None` values for one or more stages. The code panics or silently skips conflicts that don't have all three entries.

**Why it happens:** Not all conflicts have all three stages. Add/add conflicts have no ancestor. Delete/modify conflicts may have `ours = None` or `theirs = None`. The current `merge.rs` (lines 139-151) already handles this partially by checking each stage independently, but it only extracts file paths -- not blob content for display in the conflict resolver.

**Consequences:**
- Panic on `.unwrap()` when accessing a `None` stage entry's OID for blob lookup
- UI shows empty panes for legitimate conflicts, confusing users
- "Accept ours" / "Accept theirs" buttons don't work correctly when one side is a deletion
- Renamed file conflicts produce unexpected paths (ours and theirs may reference different filenames)

**Prevention:**
- Enumerate all conflict types explicitly: modify/modify, add/add, delete/modify, modify/delete, rename/rename, rename/delete
- For each conflict entry, check all three `Option<IndexEntry>` values before attempting `repo.find_blob()` lookup
- For delete-side conflicts, show a clear UI indicator ("file deleted in this branch") instead of an empty editor pane
- For rename conflicts, show both old and new paths in the UI
- Extend `MergeResult.conflicted_files` from `Vec<String>` to `Vec<ConflictInfo>` with conflict type metadata:
  ```rust
  struct ConflictInfo {
      path: String,
      conflict_type: ConflictType, // ModifyModify, AddAdd, DeleteModify, etc.
      ancestor_oid: Option<String>,
      ours_oid: Option<String>,
      theirs_oid: Option<String>,
  }
  ```
- Test with deliberately crafted merge scenarios covering all 6+ conflict types
- Use libgit2's `git_index_conflict_get` pattern: check for ancestor, our, their independently

**Detection:** Warning signs include: `.unwrap()` calls on conflict stage entries, or conflict resolution UI that only handles the "both sides modified" case.

**Confidence:** HIGH -- based on libgit2 [merge.h header](https://github.com/libgit2/libgit2/blob/main/include/git2/merge.h) documentation and the existing FlowForge merge.rs code structure.

---

## Moderate Pitfalls

Issues that cause significant rework or degraded experience but are recoverable.

---

### Pitfall 6: SVG Rendering Performance Collapse for Large Commit Graphs and Charts

**What goes wrong:** The current topology view renders ALL commit nodes and edges as individual SVG elements (see `TopologyPanel.tsx` lines 112-170 -- `laneLines.map`, `edges.map`, `nodes.map`). This works for the current 100-500 node limit but collapses at 1000+ nodes needed for insights dashboards and extended graph views.

**Why it happens:** SVG uses a retained-mode rendering model -- every element is a DOM node tracked by the browser. At 1000 nodes with edges and badges, this means 3000-5000 DOM nodes in the SVG tree alone, plus the DOM overlay commit badges. Browser layout/paint cycles scale linearly with DOM node count. Per Apache ECharts benchmarks, SVG performance degrades above ~1000 elements.

**Consequences:**
- Frame drops below 30fps when scrolling the topology view with 500+ visible nodes
- Activity charts with daily data points for a year (365 bars) plus heat maps (365 cells) add 700+ SVG elements per chart
- DOM node count in the thousands causes the entire app to feel sluggish (affects panel resizing, blade transitions, etc.)

**Prevention:**
- **For the topology graph:** implement virtual scrolling -- only render nodes within the viewport + 200px buffer. The current implementation renders ALL nodes (`nodes.map(...)` with no visibility filtering). Use `IntersectionObserver` or a scroll-position-based calculation to determine visible range.
- **For activity charts and heat maps:** use Canvas 2D instead of SVG -- Canvas handles 10K+ data points at 60fps because it is immediate-mode (no DOM nodes). Use a lightweight charting library that supports Canvas: Recharts (SVG-based, fine for <500 points), or ECharts/Chart.js (Canvas-based, better for large datasets).
- **Hybrid approach for topology:** Canvas for the graph rail/edges (potentially thousands), DOM overlays for interactive commit badges (only visible ones). This matches the current architecture's intent (SVG layer + DOM overlay layer) but replaces SVG with Canvas.
- Profile before optimizing: the current implementation may be fine for FlowForge's target repos (most have <10K commits)
- **Never render all graph nodes at once** -- the existing "Load More" button pagination is good but the rendered batch should also be windowed

**Detection:** Warning signs include: frame drops below 30fps when scrolling the topology view, `document.querySelectorAll('svg *').length` exceeding 1000, or DevTools "Rendering" tab showing high paint times.

**Confidence:** MEDIUM -- based on general SVG vs Canvas performance characteristics ([Apache ECharts comparison](https://apache.github.io/echarts-handbook/en/best-practices/canvas-vs-svg/)) and the existing FlowForge SVG implementation pattern.

---

### Pitfall 7: Avatar Fetching Exposes User Privacy and Causes Request Storms

**What goes wrong:** Fetching Gravatar/GitHub avatars for every commit author in the graph view fires hundreds of HTTP requests on first load, hits rate limits, and leaks user email hashes to third-party services without consent.

**Why it happens:** Git commits contain author email addresses. The naive approach is to hash each email and fetch `gravatar.com/avatar/{hash}`. For a page of 100 commits with 20 unique authors, this fires 20 requests immediately. For repos with 100+ contributors, it becomes 100+ requests. Gravatar's avatar endpoint technically has no strict rate limit, but fetching from the WebView means requests are visible to network monitors and leak email hash information.

**Consequences:**
- Request storms on large repos (20+ authors per page, multiple pages loaded)
- Gravatar avatars reveal email address existence (hashes are reversible for known email lists via rainbow tables)
- GDPR/privacy concerns: fetching external resources without user consent may violate privacy regulations in EU jurisdictions
- Avatar requests fail silently in air-gapped/offline environments, leaving broken image placeholders
- FlowForge's current `UserAvatar.tsx` has `onError` fallback but no caching, no batching, and no consent mechanism

**Prevention:**
- **Make avatar fetching OPT-IN** with a user preference in settings (disabled by default for privacy). Add to `Settings.general`: `showAvatars: boolean`
- Route all avatar fetches through the Rust backend via a dedicated Tauri command (`fetch_avatar`) that implements:
  - **Disk-based cache** with 7-day expiry (store in Tauri's app data directory using `tauri::path::app_data_dir`)
  - **Request deduplication** (one in-flight request per email hash using a `HashMap<String, JoinHandle>`)
  - **Batch debouncing** (collect unique emails over 200ms, then fetch in parallel with a concurrency limit of 5)
  - **Graceful degradation** to initials fallback (already implemented in `UserAvatar.tsx`)
- For GitHub-authenticated users, use the GitHub API to fetch avatars by username (FlowForge already stores `avatarUrl` in `githubStore.ts`) -- extend this to resolve commit author emails to GitHub usernames
- **Never send Gravatar requests from the frontend WebView directly** -- always proxy through Rust backend
- Store a mapping of `email_hash -> avatar_bytes` in a SQLite or flat-file cache per app installation

**Detection:** Warning signs include: `<img>` tags with `gravatar.com` URLs rendered in the WebView, network tab showing 50+ simultaneous avatar requests, or avatar fetch code that runs without checking user consent.

**Confidence:** HIGH -- confirmed via Gravatar privacy documentation, [Bleeping Computer report on email enumeration](https://www.bleepingcomputer.com/news/security/online-avatar-service-gravatar-allows-mass-collection-of-user-info/), and [Privytar privacy proxy project](https://sr.ht/~jamesponddotco/privytar/).

---

### Pitfall 8: Layout Persistence Breaks Across Screen Sizes and Panel Configuration Changes

**What goes wrong:** Persisting panel sizes (via react-resizable-panels v4 localStorage) causes layouts to restore incorrectly when the user moves to a different monitor, changes screen resolution, or when the app adds/removes panels in an update.

**Why it happens:** FlowForge uses `react-resizable-panels` v4 with `autoSaveId` on `ResizablePanelLayout.tsx` (line 17: `<Group id={autoSaveId}>`). The library stores panel sizes and restores them on mount. But if a new feature adds a panel (e.g., an insights sidebar), or makes panels conditionally visible, the persisted layout no longer matches the panel structure, causing panels to collapse to minimum size or overflow.

**Consequences:**
- Users upgrading to a new version see broken layouts (panels at 0% or 100% width)
- Moving from a 4K monitor to a laptop makes some panels too small to use (percentage-based sizes that were fine at 2560px are too narrow at 1280px)
- Adding/removing optional panels (insights, conflict resolver) invalidates persisted layouts
- Layout shift on initial render: localStorage read completes after React renders default sizes, causing a visible jump
- The existing `ResizablePanel` component (line 41-44) converts to percentage strings, which means pixel-based sizes are never restored correctly if the conversion logic changes

**Prevention:**
- **Use versioned layout keys:** include a layout schema version in the `autoSaveId` (e.g., `flowforge-main-layout-v2`), increment when adding/removing panels. When the version changes, discard old persisted layout and use defaults.
- **Define minimum viable sizes with care:** the current `minSize={10}` (10%) is fine for wide screens but means the minimum panel width on a 1280px screen is only 128px -- too narrow for most content. Consider absolute minimums via CSS `min-width` in addition to percentage constraints.
- **Implement layout validation on restore:** if the persisted panel count doesn't match the current panel count, discard and use defaults gracefully.
- **Separate "layout structure" (which panels are visible) from "layout sizes" (percentage splits):** persist both independently. Use Zustand for panel visibility, react-resizable-panels for sizes.
- For optional panels (insights sidebar, conflict viewer), store their visibility separately in the Zustand preferences store, and only include them in the resize group when visible.
- Add a **"Reset Layout" button** accessible from settings or a keyboard shortcut (Ctrl+Shift+R or similar).
- Replicate the existing `settings.slice.ts` pattern (with `mergeSettings` for safe defaults with migration) for layout persistence.

**Detection:** Warning signs include: layout persistence using a single flat key for all panels, no version migration logic, or users reporting "all my panels disappeared after update."

**Confidence:** MEDIUM -- based on react-resizable-panels [issue #41](https://github.com/bvaughn/react-resizable-panels/issues/41) and documented pixel-vs-percentage storage bugs in the library's changelog.

---

### Pitfall 9: Accessibility Failures in Data Visualization Components

**What goes wrong:** Activity charts, heat maps, and commit frequency graphs are built as pure visual elements (SVG/Canvas) with no text alternatives, keyboard navigation, or screen reader support. This violates WCAG 2.1 Level AA requirements specified in FlowForge's global coding guidelines.

**Why it happens:** Developers focus on visual aesthetics for charts and forget that screen readers cannot interpret SVG paths or Canvas pixels. The existing topology graph (`TopologyPanel.tsx`) uses SVG circles with `onClick` but no `role`, `aria-label`, `tabIndex`, or keyboard focus handling.

**Consequences:**
- Screen reader users cannot access any insights data
- Keyboard-only users cannot navigate chart elements (no `tabIndex`, no key handlers)
- Color-only encoding in heat maps excludes colorblind users (8% of males have some form of color vision deficiency)
- Fails WCAG 2.1 SC 1.1.1 (Non-text Content), SC 1.4.1 (Use of Color), SC 1.4.11 (Non-text Contrast), and SC 2.1.1 (Keyboard)
- FlowForge's CLAUDE.md explicitly requires WCAG 2.1 Level AA compliance

**Prevention:**
- **Provide a text summary for every chart:** "32 commits this week, 15% increase from last week, top contributor: Alice (12 commits)" -- render this as a visible summary above/below the chart and as `aria-label` on the chart container
- **Add an accessible data table alternative** that screen readers can navigate. Render as a `<table>` with proper `<th>` headers, hidden visually with `sr-only` class but available to assistive tech
- Use `role="img"` and `aria-label` on SVG/Canvas container elements with descriptive text
- For heat maps: use **discrete color bins** (not continuous gradients) with a **3:1 contrast ratio** between adjacent bins per WCAG SC 1.4.11, and supplement color with text labels or patterns (numbers in cells, not just color intensity)
- **Implement keyboard navigation** for interactive charts: Tab to enter chart, arrow keys to move between data points, Enter/Space to drill down, Escape to exit
- Use `aria-live="polite"` regions to announce data point details on keyboard focus
- For the existing topology SVG: add `role="button"`, `tabIndex={0}`, and `onKeyDown` handlers to commit circle `<circle>` elements; add `aria-label` with commit message, author, and date
- Test with VoiceOver (macOS) since FlowForge targets macOS as primary platform

**Detection:** Warning signs include: SVG or Canvas elements without any ARIA attributes, charts that only communicate information via color, or no `onKeyDown` event handlers on interactive chart elements.

**Confidence:** HIGH -- based on WCAG 2.1 requirements, [Highcharts accessibility guidelines](https://www.highcharts.com/blog/tutorials/10-guidelines-for-dataviz-accessibility/), and [Smashing Magazine's accessibility-first chart design](https://www.smashingmagazine.com/2022/07/accessibility-first-approach-chart-visual-design/).

---

### Pitfall 10: Conflict Resolution State Machine Complexity and Data Loss

**What goes wrong:** Building inline conflict resolution as a simple "click to accept" UI without properly modeling the multi-step state machine. Users can partially resolve conflicts, switch to another file, come back, and expect their partial resolutions to be preserved. Without proper state management, changes are lost.

**Why it happens:** Conflict resolution is inherently stateful: each conflict region independently transitions through unresolved -> choosing -> resolved states. The file-level state is "all conflicts resolved" only when every region is resolved. The current `merge.rs` tracks `conflicted_files: Vec<String>` but has no per-region resolution tracking.

**Consequences:**
- Users lose partial conflict resolutions when navigating between files (state was in component `useState`)
- "Mark as resolved" button enabled when not all conflicts are actually resolved, leading to broken merge commits that include conflict markers
- No undo/redo for conflict resolution choices -- accepting the wrong side requires starting over
- Conflicting state between the Monaco editor content (which the user may edit manually) and the backend's index state
- Race condition: user resolves conflicts in the UI, but the backend's index still contains the unresolved entries

**Prevention:**
- Model conflict resolution as a state machine per file:
  ```typescript
  interface ConflictResolutionState {
    regions: Map<regionId, {
      status: 'unresolved' | 'ours' | 'theirs' | 'custom';
      content: string;
      originalOurs: string;
      originalTheirs: string;
    }>;
    isDirty: boolean;
  }
  ```
- **Store resolution state in a dedicated Zustand store** (not ephemeral component state) so it survives navigation between files
- **Validate that ALL regions are resolved** before enabling the "stage resolved file" / "commit merge" action
- Implement an **undo stack** per conflict file (record each resolution choice, allow Ctrl+Z to revert)
- **Sync resolution state TO the editor content** (apply accepted changes to the merged output) rather than parsing editor content back to resolution state -- the state machine is the source of truth, the editor is the view
- Consider using **XState** (already in the project for the gitflow machine in `gitflowMachine.ts`) for the per-file conflict resolution state machine -- states and transitions are well-defined
- The existing `staging.slice.ts` pattern of tracking `selectedFile` can be extended for conflict resolution file tracking
- Write resolved content to the workdir, then stage the file using the existing `stage_file` command -- do NOT write directly to the index

**Detection:** Warning signs include: resolution state stored only in `useState` hooks, no validation before merge commit, or inability to undo a conflict resolution choice.

**Confidence:** MEDIUM -- based on VS Code merge editor UX research [issue #146091](https://github.com/microsoft/vscode/issues/146091) and patterns from GitKraken/SmartGit conflict resolvers.

---

### Pitfall 11: Collapsible Diff Regions via Custom Folding Desyncs from Monaco's Internal Diff

**What goes wrong:** Implementing collapsible/expandable unchanged regions in the diff viewer by building custom folding ranges based on git2-rs hunk data, but the collapsed regions don't align with what Monaco's DiffEditor shows. Users expand a region expecting to see context lines, but get the wrong lines or misaligned content.

**Why it happens:** Monaco's DiffEditor computes its own diff internally using the `original` and `modified` text. It may identify different "unchanged regions" than what git2-rs reports as diff hunks because they use different diff algorithms and context line counts. FlowForge currently passes `context_lines: 3` to git2-rs, but Monaco does its own diff independently, ignoring those hunk boundaries.

**Prevention:**
- **Use Monaco's built-in `hideUnchangedRegions` option** rather than building custom folding. It already works with the DiffEditor and handles synchronization correctly. Configure it via:
  ```typescript
  hideUnchangedRegions: {
    enabled: true,
    minimumLineCount: 3,
    contextLineCount: 3,
    revealLineCount: 20,
  }
  ```
- This option is available in the `IDiffEditorBaseOptions` interface and has been part of Monaco since at least v0.40
- Do NOT try to manually create folding ranges based on git2-rs hunk data and inject them into Monaco -- let Monaco handle this natively
- If custom collapsible regions are needed beyond what `hideUnchangedRegions` provides, use Monaco's `FoldingRangeProvider` API, but be aware it **cannot update ranges for already-collapsed regions** (documented limitation in Monaco issue [#1907](https://github.com/microsoft/monaco-editor/issues/1907))
- FlowForge currently passes full `oldContent`/`newContent` to Monaco (see `DiffBlade.tsx` lines 268-279) which is correct -- Monaco needs the full files to compute its own diff

**Detection:** Warning signs include: custom diff computation in TypeScript to determine collapse regions, manually calling `editor.trigger('fold')` with hunk-derived line numbers, or users reporting misaligned regions after expanding collapsed sections.

**Confidence:** HIGH -- based on Monaco API docs for [`hideUnchangedRegions`](https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IDiffEditorBaseOptions.html) and issue [#4196](https://github.com/microsoft/monaco-editor/issues/4196).

---

## Minor Pitfalls

Issues that cause friction or minor bugs but are easily fixed.

---

### Pitfall 12: Insights Dashboard Recomputes on Every Tab Switch

**What goes wrong:** Switching to the insights/dashboard tab triggers a full data fetch and recomputation, causing a loading spinner every time the user navigates away and back.

**Prevention:**
- Use React Query's `staleTime` with a generous value for insights data. Set `staleTime: 300000` (5 minutes) and `refetchOnWindowFocus: false` -- insights data changes slowly.
- Pre-fetch insights data in the background when the repository is first opened (using `queryClient.prefetchQuery()`), not on-demand when the user clicks the tab.
- Cache computed chart data in a Zustand store to survive component unmount/remount. The store should be registered with the reset registry so it clears on repo switch.
- Follow the existing pattern from `get_commit_graph` which uses `staleTime: 60000` on commit history queries.

**Confidence:** HIGH -- standard React Query pattern, directly applicable to existing FlowForge architecture.

---

### Pitfall 13: Welcome Screen Enhancements Blocking First-Time User Flow

**What goes wrong:** Adding too many features to the welcome screen (tips carousel, recent repos grid, getting started wizard, daily tips, keyboard shortcuts reference) that obscure the primary action: opening or cloning a repository. New users get lost in an information-dense welcome page.

**Prevention:**
- Maintain a clear visual hierarchy: primary CTA (Open/Clone) at top, secondary information below
- Use progressive disclosure: show tips and advanced features only after the user has opened their first repository at least once (persist "hasCompletedOnboarding" in Tauri store)
- Keep the welcome screen to a single viewport height (no scrolling required for primary actions)
- Test with first-time users: 5-second test -- can they find the "Open Repository" action?
- The existing welcome screen extension (`welcome-screen/index.ts`) is already extension-based, so enhancements should follow the same pattern

**Confidence:** MEDIUM -- UX best practice, not specific to FlowForge's tech stack.

---

### Pitfall 14: Extension Boundary Confusion for New Features

**What goes wrong:** Putting features like conflict resolution or hunk staging into the extension system when they should be core, or vice versa. This leads to broken dependency chains when extensions need to access core internals (index state, merge state, Monaco editor instances).

**Why it happens:** FlowForge has a well-defined extension system (`ExtensionAPI.ts`, `ExtensionHost.ts`, `SandboxBridge.ts`) with trust levels and sandboxing. The temptation is to build everything as extensions for modularity. But features that need deep access to Monaco editor instances, Git index write operations, or merge state don't work well through the extension API boundary.

**Prevention:**
- **Core features** (should NOT be extensions): conflict resolution (needs index write access + Monaco editor control), hunk staging (needs index write access), enhanced diff viewer (modifies existing DiffBlade behavior)
- **Extension candidates** (CAN be extensions): insights dashboard (read-only data visualization), welcome screen enhancements (self-contained UI), avatar display (additive UI), branch visualization enhancements (read-only SVG/Canvas rendering)
- The decision criterion: **if the feature needs to modify existing core component behavior or requires write access to Git state, it is core. If it is additive read-only UI, it can be an extension.**
- Workspace layout customization straddles both: the layout engine is core, but specific layout presets can be extension-contributed via the extension API

**Detection:** Warning signs include: extensions importing from core internals beyond the `ExtensionAPI` surface, or the extension API needing new write methods that break the sandboxed extension security model.

**Confidence:** HIGH -- based on FlowForge's existing extension architecture in `extensionTypes.ts` and `ExtensionAPI.ts`.

---

### Pitfall 15: CRLF and Encoding Issues in Conflict Content Display

**What goes wrong:** Three-way merge content extracted from git2-rs uses `String::from_utf8_lossy` (as seen in `diff.rs` line 186 and `get_blob_content` at line 450), which replaces invalid UTF-8 with the Unicode replacement character. Files with mixed encodings or CRLF line endings display incorrectly in the conflict resolver, and resolved content written back has different line endings than the original.

**Prevention:**
- Detect and preserve original line ending style per file before display (check for `\r\n` in the raw blob content)
- Handle the BOM (byte order mark) at the start of UTF-8/UTF-16 files -- don't strip it during extraction
- For non-UTF-8 files (legacy codebases with Latin-1, Shift-JIS, etc.), detect encoding and display a warning banner ("This file may not display correctly -- encoding: [detected]") rather than silently corrupting content
- When writing resolved conflict content back to the workdir, match the line ending style of the original file (check `.gitattributes` for `eol` and `text` settings via `git2::Repository::blob_content`)
- Test with: CRLF-only files, mixed CRLF/LF files, files without trailing newline, UTF-8 BOM files, and repos with `.gitattributes` specifying `* text=auto`

**Confidence:** MEDIUM -- based on git2-rs `from_utf8_lossy` usage throughout FlowForge's diff.rs and common Git client bug reports about line ending corruption.

---

### Pitfall 16: React Query Key Collisions for New Insights Queries

**What goes wrong:** New query keys for insights data (e.g., `["commitActivity"]`, `["heatMap"]`, `["contributorStats"]`) don't include the repository path, causing stale data from the previous repo to display when switching repos.

**Prevention:**
- Prefix ALL new query keys with the repository path, following the existing pattern. Verify how the current `DiffBlade.tsx` and `TopologyPanel.tsx` handle this.
- Use `queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === 'insights' })` on repo switch
- Consider a namespace pattern: `["insights", repoPath, "commitActivity"]` instead of flat keys
- Register any new insights-related Zustand stores with the existing reset registry (`registry.ts`) so they clear on repo switch

**Confidence:** HIGH -- based on existing FlowForge React Query patterns and the documented store reset mechanism.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Enhanced Diff Viewer (collapsible regions) | #11: Desync between custom folding and Monaco's internal diff | Moderate | Use `hideUnchangedRegions` built-in option exclusively |
| Enhanced Diff Viewer (Monaco memory) | #3: Memory leaks on mount/unmount | Critical | Add `editor.dispose()` to DiffBlade, implement model reuse |
| Three-Way Merge / Conflict Resolution | #1: No native three-way in Monaco | Critical | Two-pane approach with decoration overlays |
| Three-Way Merge / Conflict Resolution | #5: Missing conflict stages for some types | Critical | Handle all 6+ conflict type combinations |
| Three-Way Merge / Conflict Resolution | #10: State machine complexity | Moderate | Zustand store + XState for per-file resolution state |
| Three-Way Merge / Conflict Resolution | #15: CRLF/encoding corruption | Minor | Preserve original encoding and line endings |
| Hunk-Level Staging | #2: No native hunk staging in libgit2 | Critical | Use `repo.apply()` with filtered diff patches |
| Hunk-Level Staging | I-3: Concurrent index access | Critical | Mutex on Rust side for index operations |
| Git Insights Dashboard | #4: IPC serialization bottleneck | Critical | Aggregate data on Rust side, send summaries not raw commits |
| Git Insights Dashboard | #12: Recomputes on tab switch | Minor | Generous `staleTime` + Zustand cache |
| Git Insights Dashboard | #16: Query key collisions | Minor | Prefix with repo path |
| Commit Charts / Heat Maps | #6: SVG performance collapse | Moderate | Canvas for charts, virtual scrolling for graph |
| Commit Charts / Heat Maps | #9: Accessibility failures | Moderate | Text alternatives, keyboard nav, ARIA, contrast ratios |
| Avatar Integration | #7: Privacy exposure and request storms | Moderate | Opt-in, Rust-side proxy with disk cache |
| Workspace Layout Customization | #8: Persistence breaks across screens | Moderate | Versioned layout keys, validation, reset button |
| Welcome Screen Enhancements | #13: Blocking first-time user flow | Minor | Clear CTA hierarchy, progressive disclosure |
| Core vs Extension Decisions | #14: Boundary confusion | Minor | Core = write access needs; Extension = additive read-only |

---

## Integration Pitfalls (Cross-Cutting)

### I-1: Zustand Store Proliferation Without Reset Registration

**What goes wrong:** Adding new stores for insights, conflict resolution, layout state, and avatar cache without connecting them to the existing store reset mechanism in `registry.ts`. When users switch repositories, stale data from the previous repo contaminates the new one.

**Prevention:** Register ALL new domain stores with the existing `registry.ts` reset mechanism. The current stores in `domain/git-ops/` and `domain/ui-state/` are properly registered -- follow the same pattern. Test that switching repos clears all insights/conflict/layout state. Use a checklist: every new `create()` call should have a corresponding `registerStoreForReset()`.

---

### I-2: Concurrent Index Access from Multiple Features

**What goes wrong:** Hunk staging, full-file staging, and conflict resolution all write to the Git index. If a user stages a hunk while the conflict resolver is also modifying the index, one operation silently overwrites the other because `git2::Index` does not provide internal locking.

**Prevention:** Implement a mutex/queue for index-modifying operations on the Rust side. All commands that call `repo.index()` followed by `index.write()` should go through a single serialized channel. Extend the existing `RepositoryState` with an `Arc<Mutex<()>>` for index operations:
```rust
pub struct RepositoryState {
    path: Arc<RwLock<Option<PathBuf>>>,
    index_lock: Arc<Mutex<()>>,  // NEW: serialize index writes
}
```
Acquire `index_lock` before any index-modifying operation (`stage_file`, `unstage_file`, `stage_hunk`, `resolve_conflict`).

---

### I-3: Multiple Monaco Features Competing for Editor Decorations

**What goes wrong:** Hunk staging gutter buttons, conflict resolution markers, and the existing diff decorations all want to add decorations to Monaco editors. Without a decoration management system, they overwrite each other's decorations on each update.

**Prevention:** Use Monaco's `deltaDecorations` pattern correctly: each feature should maintain its own decoration ID collection (returned by `editor.deltaDecorations(oldIds, newDecorations)`) and only update its own decorations. Never pass an empty array as `oldIds` unless intentionally clearing all decorations -- this is a common source of decoration loss. Consider a decoration manager utility that namespaces decorations by feature.

---

## Sources

### Monaco Editor
- [Three-way merge request - Issue #1295](https://github.com/microsoft/monaco-editor/issues/1295) -- Confirmed no native three-way support
- [Three-way merge editor request - Issue #3268](https://github.com/microsoft/monaco-editor/issues/3268) -- Feature still requested, not implemented
- [Merge conflict highlighting - Issue #1529](https://github.com/microsoft/monaco-editor/issues/1529) -- VS Code merge highlighting not in standalone Monaco
- [hideUnchangedRegions bug - Issue #4196](https://github.com/microsoft/monaco-editor/issues/4196) -- Feature exists but had initial bugs
- [Custom folding ranges - Issue #1907](https://github.com/microsoft/monaco-editor/issues/1907) -- Cannot update ranges for collapsed regions
- [Memory leaks with DiffEditor - Issue #110](https://github.com/react-monaco-editor/react-monaco-editor/issues/110)
- [Memory usage - Issue #132](https://github.com/react-monaco-editor/react-monaco-editor/issues/132) -- 1GB+ documented
- [Memory leakage on disposal - Issue #1693](https://github.com/microsoft/monaco-editor/issues/1693)
- [Editor slowdown over time - Issue #398](https://github.com/suren-atoyan/monaco-react/issues/398) -- Workers accumulate
- [Multiple instances performance - Issue #1319](https://github.com/microsoft/monaco-editor/issues/1319) -- 20ms per keypress per instance
- [IDiffEditorBaseOptions API](https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IDiffEditorBaseOptions.html) -- hideUnchangedRegions documentation
- [Custom gutter decorations - Issue #322](https://github.com/microsoft/monaco-editor/issues/322) -- CSS class only, no content control

### git2-rs / libgit2
- [Stage/apply lines - Issue #5577](https://github.com/libgit2/libgit2/issues/5577) -- No native hunk staging
- [Partial staging support - Issue #195](https://github.com/libgit2/libgit2sharp/issues/195) -- Confirmed not in libgit2
- [libgit2 merge.h header](https://github.com/libgit2/libgit2/blob/main/include/git2/merge.h) -- Conflict entry structure
- [git2-rs documentation](https://docs.rs/git2/latest/git2/) -- `Repository::apply()` API

### Tauri IPC
- [IPC high-rate data transfer - Discussion #7146](https://github.com/tauri-apps/tauri/discussions/7146) -- 3-4s for 400K datapoints
- [Raw binary IPC - Issue #7127](https://github.com/tauri-apps/tauri/issues/7127) -- JSON serialization overhead
- [IPC improvements - Discussion #5690](https://github.com/tauri-apps/tauri/discussions/5690) -- Serialization-free IPC in v2

### Avatars and Privacy
- [Gravatar mass enumeration risk - Bleeping Computer](https://www.bleepingcomputer.com/news/security/online-avatar-service-gravatar-allows-mass-collection-of-user-info/)
- [Gravatar API specifications](https://docs.gravatar.com/rest/api-data-specifications/)
- [Gravatar privacy FAQ](https://support.gravatar.com/privacy-and-security/data-privacy/)
- [Privytar - privacy proxy for Gravatar](https://sr.ht/~jamesponddotco/privytar/)

### Accessibility
- [Highcharts 10 Guidelines for DataViz Accessibility](https://www.highcharts.com/blog/tutorials/10-guidelines-for-dataviz-accessibility/)
- [Smashing Magazine - Accessibility-First Chart Design](https://www.smashingmagazine.com/2022/07/accessibility-first-approach-chart-visual-design/)
- [WCAG 2.1 Data Visualization Guidance - MN.gov](https://mn.gov/mnit/media/blog/?id=38-607342)

### Layout Persistence
- [react-resizable-panels external persistence - Issue #41](https://github.com/bvaughn/react-resizable-panels/issues/41)
- [react-resizable-panels documentation](https://github.com/bvaughn/react-resizable-panels)

### Conflict Resolution UX
- [VS Code merge editor UX exploration - Issue #146091](https://github.com/microsoft/vscode/issues/146091)
- [GitHub Desktop conflict resolution UX - Issue #1627](https://github.com/desktop/desktop/issues/1627)
- [GitKraken merge conflict resolution](https://www.gitkraken.com/features/merge-conflict-resolution-tool)
- [SmartGit conflict resolver](https://www.smartgit.dev/features/conflict-resolution/)

### Rendering Performance
- [SVG vs Canvas best practices - Apache ECharts](https://apache.github.io/echarts-handbook/en/best-practices/canvas-vs-svg/)
- [SVG vs Canvas vs WebGL comparison](https://dev3lop.com/svg-vs-canvas-vs-webgl-rendering-choice-for-data-visualization/)
