# Research Summary: v1.3.0 "Blades Blades Blades"

**Project:** FlowForge
**Milestone:** v1.3.0
**Researched:** 2026-02-07
**Overall Confidence:** HIGH

---

## Executive Summary

FlowForge v1.3.0 expands the blade navigation system with 7 new blade types, migrates 3 modal dialogs to blades, adds rich file preview capabilities (markdown, 3D models), and enhances branch management UX. The existing stack (Tauri 2 / React 19 / Zustand / Monaco / framer-motion) remains frozen — this milestone adds **only 4 production packages** to the frontend bundle, all lazy-loaded for zero startup impact.

The blade navigation paradigm is FlowForge's signature UX advantage. Research shows zero desktop Git clients (GitKraken, Tower, Fork, GitHub Desktop, Sourcetree) offer blade-based settings, markdown preview, or integrated Gitflow reference. By leveraging this existing architecture, v1.3.0 delivers 4 genuine differentiators while addressing 3 table-stakes gaps (file browser, branch cleanup, two-column staging).

The most critical risks are architectural: blade stack state corruption during dialog-to-blade migration (P1), WebGL context loss in Tauri for 3D viewer (P2), and XSS via unsanitized markdown (P3). Each requires phase-specific mitigation before dependent features ship. The frozen stack and lazy-loading discipline keep binary size under budget (<50MB) and memory under 200MB.

---

## Key Stack Additions

| Package | Version | Purpose | Bundle Impact | Priority |
|---------|---------|---------|---------------|----------|
| `@google/model-viewer` | 4.1.0 | GLB/GLTF 3D preview web component | ~350KB gzipped, lazy | P1 |
| `react-markdown` | 10.1.0 | Render markdown to React elements (XSS-safe by default) | ~35KB gzipped, lazy | P0 |
| `remark-gfm` | 4.0.1 | GitHub Flavored Markdown (tables, task lists, strikethrough) | ~15KB gzipped, lazy | P0 |
| `rehype-highlight` | 7.0.2 | Syntax highlighting for markdown code blocks | ~45KB gzipped, lazy | P1 |

**Rejected alternatives:**
- `@babylonjs/viewer` (pulls `lit` as transitive dep, 470KB, React integration issues)
- `@react-three/fiber` + `@react-three/drei` (requires custom scene setup, 3 packages)
- `rehype-raw` (security risk: enables raw HTML passthrough in markdown)

**Total new production dependencies:** 4 packages, ~445KB gzipped total, all lazy-loaded.

**Rust backend:** Zero new crates. All new commands use existing `git2` v0.20 APIs.

---

## Feature Categories

### Table Stakes

Features users expect. Missing means the product feels incomplete.

| Feature | Why Expected | Implementation | Status |
|---------|--------------|----------------|--------|
| Repository file browser | Fork, Tower, GitKraken all have this | New `repo-browser` blade + Rust `list_tree` command | Build |
| Branch "merged" badge | All competitors show this | Already implemented in `BranchItem.tsx` | Done |
| Vertical staging layout | Industry standard | Already implemented in `StagingPanel.tsx` | Done |
| Remote branch pruning | Basic Git hygiene, Tower does auto | Extend existing `git2` commands | Build |
| Recent branches list | GitHub Desktop has this (last 5), highly requested | Track in store or read reflog | Build |
| Branch search/filter | All competitors have this | Already in `BranchSwitcher.tsx` | Done |

### Differentiators

Features that leverage blade navigation to create competitive advantage.

| Feature | Value Proposition | Blade Type | Priority |
|---------|-------------------|------------|----------|
| **Settings as a blade** | Only Azure Portal does this; zero Git clients | `"settings"` | P0 |
| **Markdown preview blade** | Zero desktop Git clients have rendered markdown | `"viewer-markdown"` | P0 |
| **Branch cleanup wizard** | Tower has badges but no guided workflow | `"branch-cleanup"` | P1 |
| **Gitflow reference blade** | No client integrates Gitflow education inline | `"gitflow-reference"` | P1 |
| **Pinned branches** | Only Tower has this; portable via Git config | Sidebar enhancement | P0 |
| **Two-column staging** | Only SmartGit offers this as toggle | Layout mode | P1 |
| **Commit-scoped file browser** | Extends blade paradigm for code archaeology | `"file-browser"` | P1 |

### Anti-Features

Things to deliberately NOT build in this milestone.

| Anti-Feature | Why Not | Alternative |
|--------------|---------|-------------|
| **Full code review / PR review** | Duplicates GitHub/GitLab web UIs | Lightweight pre-commit checklist at most |
| **3D asset preview (v1.3 scope)** | Niche audience, heavy dependency (3D engines ~500KB+) | Defer to v2+ or implement as optional/lazy |
| **General-purpose file explorer** | Users browse files in their IDE | Commit-scoped browser only |
| **Drag-and-drop staging** | Complex DnD, low ROI vs click-to-stage | Keep existing button-based staging |
| **Built-in markdown editor** | Scope creep toward IDE territory | Preview only, not editing |

---

## Architecture Decisions

### 1. Settings as Blade, NOT a Third Root Process

**Decision:** Push settings as a blade (`pushBlade({ type: "settings" })`) rather than adding a third process.

**Rationale:**
- Settings is a utility surface, not a workflow. Adding `"settings"` to `ProcessType` would make it structurally parallel to staging/topology, which it is not.
- Process model means `setProcess("settings")` resets the blade stack, losing user context.
- Blade approach preserves drill-down flow: user checks a setting, pops back to their diff.

**Store change:** Remove `isOpen` from `useSettingsStore`. Opening settings becomes `pushBlade()`.

### 2. Modal-to-Blade Conversion Strategy

| Modal | Approach | Complexity |
|-------|----------|------------|
| **Settings** | Direct blade conversion with tabbed navigation | Medium |
| **Changelog** | Direct blade conversion | Low |
| **Conventional Commit** | Inline expansion in sidebar (NOT separate blade) | Medium |

**Critical concern:** Blade stack state corruption (Pitfall P1). When blades pop, components unmount. Ephemeral state (form values, scroll position) is lost unless stored in separate Zustand stores. **Prevention:** Never store form state solely in blade `props`. Use `useRef` or dedicated stores.

### 3. Two-Column Staging Layout

**Decision:** Split `StagingChangesBlade` into horizontal `ResizablePanelLayout` with file list (left) + inline diff (right).

**Current flow:** StagingChangesBlade shows file list only. Clicking a file pushes a new diff blade. User loses sight of file list.

**New flow:** Inline diff viewer on the right. Selected file state managed by `useStagingStore.selectedFile`. Keeps existing push-blade behavior via "expand" button for full-screen diff.

### 4. Repository File Browser

**New Rust commands:**

```rust
// List directory entries at ref + path
pub async fn list_tree(ref_name: String, path: Option<String>)
    -> Result<Vec<TreeEntry>, GitError>

// Read file content at ref + path
pub async fn get_file_text(ref_name: String, path: String)
    -> Result<FileContent, GitError>
```

Uses standard `git2::Tree::walk` API. Returns `TreeEntry { name, entry_type, size, oid }`.

**Frontend:** Reuse existing `FileTreeView` pattern, add breadcrumb navigation, route to appropriate viewer blade based on file extension.

### 5. Markdown Preview Implementation

**Library choice:** `react-markdown` with `remark-gfm` and `rehype-highlight`.

**Why react-markdown:**
- Converts markdown to React elements without HTML intermediary — XSS-safe by default
- No `dangerouslySetInnerHTML` required
- Plugin architecture for GFM (tables, task lists) and syntax highlighting

**Why NOT `marked` + DOMPurify:**
- Two-step process (parse to HTML, sanitize, inject) is error-prone
- CVE-2025-24981 demonstrated XSS bypass in markdown library via HTML entities
- `marked` does NOT sanitize by default

**Catppuccin theming:**
- Import `highlight.js/styles/catppuccin-mocha.css` (highlight.js ships Catppuccin natively since v11.8)
- Override `components` prop: `{ a: CustomLink, code: CustomCode }` for theme alignment

### 6. 3D Viewer Blade

**Library choice:** `@google/model-viewer` v4.1.0 (web component).

**Why model-viewer:**
- Self-contained: `<model-viewer src="model.glb" camera-controls>` gives orbit controls, lighting with zero config
- Purpose-built for previewing 3D models, not building 3D apps
- Framework-agnostic web component
- ~350KB gzipped vs BabylonJS ~1.9MB minimum

**Integration:**
- New blade type `"viewer-3d"`
- Fetch via existing `getFileBase64()` / `getCommitFileBase64()`
- Decode base64 -> Blob -> createObjectURL -> pass to `<model-viewer src>`
- Lazy-loaded via `React.lazy()` for zero startup impact

**Critical pitfall (P2):** WebGL context loss in Tauri WebViews (Linux WebKitGTK 2.40+ bug still open). **Mitigation:** Listen for `webglcontextlost` event, implement context restore.

### 7. Branch Management Enhancements

**Sidebar enhancements (NOT blades):**
- Pinned branches stored in `.git/config` (portable across machines, Tower's approach)
- Recent branches from reflog or local tracking
- "Quick Access" section at top of branch list
- Last commit timestamp via `branch.get().peel_to_commit()?.time()`

**New Rust command:** `delete_branches(names: Vec<String>, force: bool)` for batch deletion.

**Branch cleanup UX:** Multi-select, sort by last-used, filter merged, bulk delete. **Protection:** Gitflow-aware (never delete main/develop/release branches), worktree check before deletion.

---

## Critical Pitfalls

### P1: Blade Stack State Corruption During Dialog-to-Blade Migration (CRITICAL)

**Problem:** Current blade stack stores `props: Record<string, unknown>`. When blade is popped and re-pushed, it gets new UUID, component remounts, loses scroll position, form state, ephemeral UI state.

**Warning signs:** Settings form resets on navigation, diff blade loses scroll when user drills deeper and pops back.

**Prevention:**
1. Never store ephemeral UI state in blade `props`. Use separate Zustand stores or `useRef`.
2. Implement blade memoization: keep blade React subtrees mounted but hidden rather than unmounting.
3. Add `bladeWillPop` guard for unsaved changes confirmation.

**Phase:** Must address BEFORE any dialog-to-blade migration.

### P2: WebGL Context Loss in Tauri WebViews (CRITICAL for 3D Viewer)

**Problem:** BabylonJS/WebGL loses rendering context in Tauri's platform WebViews. Linux WebKitGTK 2.40+ has known bug (Tauri #6559, status: upstream). Canvas goes black, no recovery without full re-init.

**Warning signs:** Black canvas after window minimize/restore, `CONTEXT_LOST_WEBGL` console warning.

**Prevention:**
1. Add WebGL context loss recovery via `webglcontextlost` / `webglcontextrestored` events.
2. Strict disposal protocol: meshes, materials, textures, scene, engine in order.
3. Lazy-load 3D library so it's never in main bundle.
4. Test on all platforms' **built apps**, not just dev mode.

**Phase:** Address during 3D viewer implementation. Consider feature flag until verified.

### P3: XSS via Repository Markdown Content (CRITICAL)

**Problem:** Repository markdown from untrusted sources (README.md, CHANGELOG.md) can contain JavaScript. In Tauri with `"csp": null` and `assetProtocol: ["**"]`, XSS means full IPC access, local filesystem, arbitrary code execution.

**Attack vectors:** `<img onerror="...">`, `[link](javascript:...)`, HTML entities bypassing denylists (CVE-2025-24981).

**Prevention:**
1. **Use `react-markdown`**, NOT `marked` + `dangerouslySetInnerHTML`. React-markdown converts to React elements without HTML intermediary.
2. Enable CSP in `tauri.conf.json`: `"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"`
3. Strip `javascript:` from all `href` attributes regardless of sanitizer.
4. Never use `dangerouslySetInnerHTML` with markdown-derived content.

**Phase:** Must address BEFORE any markdown rendering ships. Enable CSP now as baseline hardening.

### P4: File Browser Performance on Large Repositories (HIGH)

**Problem:** Existing `FileTreeView` builds full in-memory tree, renders all nodes eagerly (default expanded). Linux kernel (~74K files) creates tens of thousands of DOM nodes, >1s render, scroll jank.

**Prevention:**
1. Virtualize file tree via `react-virtuoso` (already installed).
2. Collapse directories by default for repos >200 files.
3. Debounce filter input (150ms).
4. Paginate at Rust level via `TreeWalk` with limit.

**Phase:** Address when building file browser blade.

### P5: Keyboard Focus Management Across Blade Transitions (HIGH)

**Problem:** When blade pushed, focus stays on triggering element in parent. New blade content not focused. Keyboard-only users cannot interact without Tab-cycling through `BladeStrip` buttons first.

**Prevention:**
1. Auto-focus new blade's first focusable element on mount.
2. Restore focus on pop via parallel focus stack.
3. Announce blade transitions to screen readers via `aria-live="polite"`.
4. Focus-trap the active blade.

**Phase:** Address during blade system enhancement, before migrating dialogs.

---

## Suggested Build Order

### Phase A: Blade Infrastructure (Foundation)

**Do first.** All subsequent work depends on this.

1. Extend `BladeType` union with all new types (`"settings"`, `"viewer-markdown"`, `"viewer-3d"`, `"repo-browser"`, `"gitflow-reference"`, `"changelog"`)
2. Add empty case stubs in `renderBlade` switch
3. Extend `useBladeNavigation` with new helpers (`openSettings`, `openChangelog`, `openRepoBrowser`, etc.)
4. Update `bladeTypeForFile` for 3D model extensions
5. **Enable CSP in `tauri.conf.json`** (defense-in-depth for P3)
6. **Implement blade state preservation** (address P1)
7. **Fix keyboard focus management** (address P5)

**Risk:** LOW. Additive changes only.

### Phase B: Modal-to-Blade Conversions (Quick Wins)

**Do second.** Removes modal infrastructure, proves blade expansion pattern.

1. SettingsBlade (most self-contained)
2. ChangelogBlade (small, stateful store exists)
3. Remove SettingsWindow and ChangelogDialog from App.tsx
4. Update Header.tsx to use blade push instead of store open
5. Update settings store (remove `isOpen`/`openSettings`/`closeSettings`)
6. Update changelog store (remove `isDialogOpen`/`openDialog`/`closeDialog`)
7. Inline ConventionalCommitForm expansion in CommitForm (remove modal)

**Risk:** LOW-MEDIUM. Settings keyboard shortcut `mod+,` needs rewiring.

### Phase C: Two-Column Staging (High-Value UX)

**Do third.** Major UX improvement, self-contained.

1. Redesign StagingChangesBlade with `ResizablePanelLayout`
2. Create InlineDiffPanel wrapper component
3. Wire to `useStagingStore.selectedFile`
4. Add "expand to full blade" button
5. Keep backward compatibility (push-blade still works)

**Risk:** MEDIUM. Core interaction pattern change.

### Phase D: New Content Blades (Feature Expansion)

**Do fourth.** Independent features, can parallelize.

1. **GitflowCheatsheetBlade** (pure frontend, zero dependencies, trivial)
2. **MarkdownPreview component + DiffBlade toggle** (small scope, **requires P3 mitigation**)
   - Install `react-markdown`, `remark-gfm`, `rehype-highlight`
   - Add toggle in DiffBlade for `.md` files
   - Create standalone MarkdownPreviewBlade for repo browser
3. **RepoBrowserBlade + Rust backend** (new IPC, medium risk)
   - Create `src-tauri/src/git/browser.rs` with `list_tree` and `get_file_text`
   - Register commands in `lib.rs`
   - Build frontend with directory tree (reuse `FileTreeView` pattern)
   - **Address P4** (virtualization) from day one
4. **Viewer3DBlade** (new dependency, lazy-loaded, **requires P2 mitigation**)
   - Install `@google/model-viewer`
   - Create TypeScript declaration (`model-viewer.d.ts`)
   - Lazy-load via `React.lazy()`
   - Extend `bladeTypeForFile` for `.glb`, `.gltf`, `.obj`, `.stl`
   - Test WebGL context loss recovery on all platforms

**Risk:** Varies. Cheatsheet is trivial. Markdown needs XSS mitigation. 3D viewer needs WebGL context handling.

### Phase E: Branch Management Enhancement (Sidebar Polish)

**Do last.** Incremental improvement, lowest priority.

1. Pinned branches (Git config storage)
2. Recent branches (reflog or local tracking)
3. "Quick Access" section in BranchList
4. Branch cleanup UI (multi-select, bulk delete, worktree protection per P6)
5. Feature branch purple tags (CSS/style)

**Risk:** LOW. Additive to existing sidebar.

---

## New BladeTypes Summary

| BladeType | Purpose | Priority | Rust Backend | Bundle Impact |
|-----------|---------|----------|--------------|---------------|
| `"settings"` | Settings as navigation blade (replaces modal) | P0 | None | 0KB (refactor) |
| `"changelog"` | Changelog generation (replaces modal) | P0 | None | 0KB (refactor) |
| `"viewer-markdown"` | Rendered markdown preview | P0 | Optional `get_file_text` | ~95KB lazy |
| `"repo-browser"` | Commit-scoped file tree | P1 | New `list_tree`, `get_file_text` | 0KB (reuse UI) |
| `"gitflow-reference"` | Gitflow cheat sheet with context | P1 | None | 0KB (static) |
| `"viewer-3d"` | GLB/GLTF 3D model viewer | P1 | None | ~350KB lazy |

---

## Research Flags

### Needs Deeper Research During Planning

- **Phase D (3D Viewer):** WebGL context loss recovery testing on Linux WebKitGTK 2.40+
- **Phase D (Markdown Preview):** Relative path resolution for images/links in repository markdown

### Standard Patterns (Skip Research)

- **Phase B (Modal Migration):** Dialog-to-blade conversion is straightforward refactoring
- **Phase C (Two-Column Staging):** `react-resizable-panels` already proven in codebase
- **Phase E (Branch Management):** Git config storage is well-documented

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack Additions | HIGH | All versions verified via npm registry 2026-02-07 |
| Features (differentiators) | HIGH | Verified Azure Portal blade UX, GitHub Desktop issue #17248, Tower v15 release |
| Architecture (blade system) | HIGH | Direct codebase analysis of `blades.ts`, `BladeContainer.tsx`, `RepositoryView.tsx` |
| Pitfalls (P1, P5, P13, P14) | HIGH | Derived from source code analysis |
| Pitfalls (P2 WebGL) | HIGH (problem), MEDIUM (mitigation) | Tauri GitHub issue #6559 verified, mitigation based on forum posts |
| Pitfalls (P3 XSS) | HIGH | CSP null verified in `tauri.conf.json`, CVE-2025-24981 documented |
| Build Order Dependencies | HIGH | Mapped from architectural analysis |
| Bundle Size Impact | HIGH | Calculated from npm registry package sizes, lazy-loading verified |

---

## Gaps to Address

1. **WebGL context loss testing on Linux:** Requires actual testing on WebKitGTK 2.40+ systems. Cannot fully validate 3D viewer reliability until built and tested on all platforms.

2. **Relative path resolution in markdown:** Needs implementation strategy for images/links in repo markdown. Tauri asset protocol or base64 data URIs.

3. **Blade stack depth limits:** No current mechanism to prevent unbounded blade stack growth. Need max depth policy or auto-collapse strategy.

4. **CSP compatibility with Monaco Editor:** May require `worker-src 'self' blob:` for Monaco web workers. Needs testing.

---

## Sources

### Official Documentation (HIGH confidence)
- [Tower v15 Release Blog](https://www.git-tower.com/blog/tower-mac-15) — Branch cleanup, pinned branches
- [GitHub Desktop Issue #17248](https://github.com/desktop/desktop/issues/17248) — Markdown rendering request
- [Azure Portal Blade Architecture](https://github.com/Azure/portaldocs/blob/main/portal-sdk/generated/top-extensions-architecture.md) — Blade UX pattern
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) — v10.1.0, unified pipeline
- [Tauri WebGL Context Lost #6559](https://github.com/tauri-apps/tauri/issues/6559) — Linux WebKitGTK 2.40+ bug
- [@google/model-viewer GitHub](https://github.com/google/model-viewer) — v4.1.0 web component

### Codebase Analysis (HIGH confidence)
- FlowForge `src/stores/blades.ts` (79 lines) — Blade store architecture
- FlowForge `src/components/RepositoryView.tsx` (294 lines) — renderBlade integration
- FlowForge `src/components/blades/BladeContainer.tsx` (46 lines) — Animation pipeline
- FlowForge `src-tauri/tauri.conf.json` — CSP null, asset protocol scope
- FlowForge `src/components/settings/SettingsWindow.tsx` (123 lines) — Settings modal to convert
- FlowForge `src/stores/settings.ts` (107 lines) — Settings store with isOpen

### Security Research (MEDIUM-HIGH confidence)
- [CVE-2025-24981](https://thesecmaster.com/blog/how-to-fix-cve-2025-24981-mitigating-xss-vulnerability-in-markdown-library-for-we) — Markdown XSS via HTML entities
- [Secure Markdown Rendering in React](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety) — react-markdown safe by default
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify) — Sanitization library

---

## Ready for Requirements

This research synthesis provides:

1. **Clear technology choices** with rationale (4 new packages, all lazy-loaded)
2. **Feature categorization** (table stakes vs differentiators vs anti-features)
3. **Architecture decisions** for blade expansion, modal migration, file browser, markdown preview, 3D viewer
4. **Critical pitfall mitigation** (P1-P5 with phase-specific prevention)
5. **Suggested build order** in 5 phases (A: Infrastructure, B: Conversions, C: Staging, D: Content, E: Polish)
6. **Confidence assessment** with identified gaps for validation during planning

The roadmapper agent can proceed to structure phases based on:
- Build order dependencies (Phase A must precede all others)
- Pitfall mitigation requirements (P1, P5 before Phase B; P3 before markdown; P2 during 3D viewer)
- Feature priority (P0: settings, markdown, pinned branches; P1: file browser, 3D viewer, Gitflow reference)

**Next step:** Use SUMMARY.md implications to create roadmap phases that align with build order, integrate pitfall prevention, and deliver differentiators incrementally.
