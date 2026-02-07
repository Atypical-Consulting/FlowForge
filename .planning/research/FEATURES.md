# Feature Landscape: Blade Expansion & Branch Management

> **Research Dimension**: Features (Milestone-Specific)
> **Project**: FlowForge — Gitflow-enforcing Git client (Tauri + Rust + React)
> **Milestone Focus**: Blade navigation expansion, rich file preview, branch management UX
> **Competitors Analyzed**: GitKraken, Fork, Tower, Sourcetree, GitHub Desktop, SmartGit
> **Researched**: 2026-02-07

---

## Executive Summary

Research across 9 proposed features reveals a clear split: **3 are table stakes that competitors already do well** (file browser, branch cleanup, two-column staging), **4 are differentiators that no competitor does in a blade-based paradigm** (settings blade, markdown preview blade, GitFlow reference blade, branch favorites), and **2 are niche features that should be scoped carefully** (3D asset preview, code review prompts). The blade navigation system is FlowForge's signature UX -- every feature should be evaluated through the lens of "does this become a blade, and does that create value?"

---

## Feature Analysis by Topic

### 1. Settings as Navigation Blade (vs Modal)

**Current State**: FlowForge has a modal-based settings window (`SettingsWindow.tsx`) using `Dialog`/`DialogContent` with tabbed navigation (General, Git, Integrations, Appearance). This is a 500px tall, 672px wide overlay.

**How Competitors Handle This**:

| Client | Settings Pattern | Notes |
|--------|-----------------|-------|
| VS Code | Dedicated full-page view (sidebar Activity Bar item) | Non-modal, searchable, breadcrumb navigation |
| GitHub Desktop | Native OS preferences window (macOS) / File > Options (Windows) | Separate window, not a panel |
| GitKraken | Preferences via hamburger menu | Modal overlay, similar to FlowForge's current approach |
| Tower | Preferences window (native macOS/Windows) | Separate OS window |
| Fork | Native preferences window (Ctrl+,) | Separate OS window |
| Azure Portal | **Blade pattern** -- settings slide open as a new blade | The original blade UX inspiration |

**Key Insight**: The Azure Portal is the canonical reference for blade-based settings navigation. When you click "Settings" on a resource, it opens as a new blade to the right, allowing you to see the resource context on the left while editing settings on the right. This is exactly the mental model FlowForge's blade system already implements.

**Recommendation**: **Convert settings to a blade** rather than keeping it as a modal. This is a genuine differentiator -- no Git client treats settings as part of the navigation flow. The blade approach means users can:
- See the topology/staging context while adjusting settings
- Navigate back naturally with the blade stack (back button)
- Have settings "feel" like part of the app instead of an interruption

**Complexity**: Medium. The tab structure inside the modal maps directly to sections within a BladePanel. The store already supports `SettingsCategory`. Main work is replacing the Dialog wrapper with a blade registration and restructuring the layout for full-height rendering.

**Dependencies**: Blade store needs a new `BladeType` value (e.g., `"settings"`). Settings store can remain unchanged.

---

### 2. Markdown Preview in Git Clients

**Current State**: FlowForge has a `DiffBlade` (Monaco diff editor) and `ViewerImageBlade` and `ViewerNupkgBlade` for specialized file viewers. No markdown preview exists.

**How Competitors Handle This**:

| Client | Markdown Preview | Quality |
|--------|-----------------|---------|
| GitHub Desktop | **None** -- open feature request since 2023 (issue #17248) | N/A |
| GitKraken | **None** -- shows raw markdown in diff | N/A |
| Tower | **None** -- syntax highlighted raw text only | N/A |
| Fork | **None** -- syntax highlighted raw text only | N/A |
| Sourcetree | **None** -- feature request SRCTREE-2631 open since 2015 | N/A |
| GitHub (web) | **Yes** -- "rich diff" with source/rendered toggle for .md files | Excellent |

**Key Insight**: This is a significant gap across ALL desktop Git clients. GitHub's web interface is the only place where rendered markdown preview exists in the Git ecosystem. Every desktop client shows markdown as raw text in diffs. This is a clear differentiator opportunity.

**What GitHub Web Does Right** (HIGH confidence, verified via official docs):
- Toggle between "source" and "rendered" views for markdown files
- Rich diff highlights structural changes (bold added, link changed)
- Supports GFM (tables, task lists, strikethrough)

**Implementation Approach for FlowForge**:
- New `ViewerMarkdownBlade` that renders `.md` files using `react-markdown` (built on remark/rehype, actively maintained, v10 current)
- Support GFM via `remark-gfm` plugin
- Syntax highlighting for code blocks via `rehype-highlight` or `rehype-prism`
- Catppuccin-themed styling for rendered output
- Toggle between rendered preview and raw source (Monaco) within the blade

**Complexity**: Medium. `react-markdown` is well-established and straightforward to integrate. The blade infrastructure is already proven. Main risk is ensuring the Catppuccin theme applies consistently to rendered HTML elements (headings, tables, code blocks, blockquotes).

**Dependencies**: Blade store needs new `BladeType` `"viewer-markdown"`. Needs `react-markdown`, `remark-gfm` npm packages. File type detection logic (already exists for image/nupkg) needs `.md` extension handling.

---

### 3. 3D Asset Preview in Development Tools

**Current State**: FlowForge has image preview (`ViewerImageBlade`) for PNG/JPG/SVG and NuGet package preview (`ViewerNupkgBlade`). No 3D preview exists.

**How Competitors Handle This**:

| Client | 3D Preview | Notes |
|--------|-----------|-------|
| All mainstream Git clients | **None** | Show "Binary file" for 3D formats |
| Anchorpoint | **Yes** -- FBX, glTF, OBJ thumbnails and previews | Purpose-built for game dev asset management |
| Artstash | **Yes** -- 2D and 3D previews synced from Git repos | Specialized asset browsing layer |
| GitHub (web) | **STL only** -- basic 3D viewer for .stl files | Limited format support |

**Key Insight**: 3D preview is a niche feature that only matters for game development and creative workflows. Mainstream Git clients uniformly ignore this. Specialized tools like Anchorpoint exist specifically because general Git clients do not serve this audience. The effort-to-value ratio is poor for a general Git client.

**If Built Anyway**:
- `react-three-fiber` + `@react-three/drei` for React-native 3D rendering
- `@react-three/drei` provides `useGLTF` loader for glTF/GLB format
- Would support glTF/GLB (industry standard), potentially OBJ/STL
- Significant bundle size increase (~500KB+ for Three.js)

**Recommendation**: **Anti-feature for now.** Defer to v2+ or implement as optional/lazy-loaded. The target audience for FlowForge (Gitflow-following teams) is primarily backend/frontend developers, not 3D artists. If implemented, it should be a `ViewerModel3dBlade` that lazy-loads the Three.js dependency only when a 3D file is selected.

**Complexity**: High. Three.js is a large dependency, camera/lighting setup is non-trivial, format support varies, and performance with large models in a desktop app is risky.

**Dependencies**: Would need `three`, `@react-three/fiber`, `@react-three/drei`. Lazy loading critical.

---

### 4. Repository File Browser

**Current State**: FlowForge has `FileTreeBlade` and `FileTreeView` for staging changes only (modified/staged/untracked files). There is no way to browse the full repository file tree at a specific commit or HEAD.

**How Competitors Handle This**:

| Client | File Browser | Quality |
|--------|-------------|---------|
| Fork | Tree/flat toggle, commit file tree in details | Good -- sorted directories first, search in Quick Launch |
| GitKraken | File tree in commit details panel | Basic -- tied to commit selection |
| Tower | "View all files in a folder structure or only changed files as a flat list" | Good -- toggle between modes |
| GitHub Desktop | Changed files list only (no full repo browser) | Minimal |
| Sourcetree | Changed files list only | Minimal |

**Key Insight**: Full repository file browsing is a "nice to have" rather than table stakes in Git GUIs. Most users browse files in their IDE, not their Git client. However, the ability to browse files at a specific commit is genuinely useful for code archaeology. Fork and Tower do this well.

**Recommendation**: **Build as a commit-scoped file browser blade**, not a general-purpose file explorer. When viewing commit details, allow pushing a `FileTreeBlade` that shows all files at that commit (not just changed files). This leverages the blade stack naturally: Topology > Commit Details > File Tree > Diff/Viewer.

**Table Stakes Features**:
- Tree view with directory collapsing
- Sort: directories first, then alphabetical
- File type icons (already have `FileTypeIcon.tsx`)
- Click to open in appropriate viewer blade (diff, markdown, image, etc.)

**Differentiator Features**:
- Search/filter within the file tree
- Show file size and last-modified info per file
- Quick navigation with breadcrumb path

**Complexity**: Medium. The `FileTreeView` component infrastructure already exists for staging. Needs a backend command to enumerate files at a given commit OID via git2's tree walking API. The blade infrastructure is already proven.

**Dependencies**: New Rust backend command (e.g., `get_commit_file_tree`). Extends existing `FileTreeView` or creates a new variant. Needs `BladeType` `"file-browser"`.

---

### 5. Branch Cleanup UX

**Current State**: FlowForge's `BranchItem.tsx` shows a "merged" badge and per-branch delete button. There is no bulk operation, no stale detection, no automated cleanup.

**How Competitors Handle This**:

| Client | Branch Cleanup | Quality |
|--------|---------------|---------|
| Tower (v15) | **Best in class** -- "Fully Merged" and "Stale" badges, auto-archive, pinned branch protection, "Branches Review" view | Excellent |
| GitKraken | Manual right-click delete only, no batch operations, feature request pending | Poor |
| Fork | Manual delete, right-click context menu | Basic |
| GitHub Desktop | Manual delete only | Basic |
| Sourcetree | Manual delete, "Delete branch on server" option | Basic |

**Key Insight**: Tower v15 (released 2025) set a new standard for branch cleanup UX. Their approach includes:
1. **Visual indicators**: "Fully Merged" and "Stale" badges inline with branch names
2. **Automatic archiving**: Option to auto-archive stale and merged branches
3. **Protected branches**: "Skips Auto-Archiving" flag for important branches
4. **Branches Review view**: Filter by "Fully Merged" to find deletable branches
5. **One-click cleanup**: Hint views with delete buttons

**Recommendation**: **Build a branch cleanup blade** that surpasses Tower's approach by leveraging the blade navigation system and Gitflow awareness.

**Table Stakes Features**:
| Feature | Complexity | Notes |
|---------|------------|-------|
| "Merged" badge on branches | Low | Already implemented in `BranchItem.tsx` |
| "Stale" badge (no commits in N days, configurable) | Low | Compare `HEAD` timestamps via git2 |
| Bulk select and delete merged branches | Medium | Multi-select UI + batch `deleteBranch` calls |
| Prune remote-tracking branches (`git remote prune`) | Low | Single backend command |

**Differentiator Features**:
| Feature | Complexity | Notes |
|---------|------------|-------|
| Gitflow-aware cleanup (protect main/develop/release) | Medium | State machine knows which branches are sacred |
| Branch age visualization (days since last commit) | Low | Relative timestamp display |
| "Cleanup Wizard" blade with preview before bulk delete | Medium | Show exactly what will be deleted, confirm |
| Auto-prune on fetch (configurable in settings) | Low | Add setting, hook into fetch command |

**Complexity**: Medium overall. Individual features are Low-Medium, but the cleanup wizard blade is a new UX pattern that needs design attention.

**Dependencies**: Extends existing `BranchList` and `BranchItem`. Needs git2 commit timestamp queries. New settings for auto-prune and stale threshold. New `BladeType` if implementing cleanup wizard.

---

### 6. Code Review Prompts/Guidance

**Current State**: FlowForge has no code review features. The existing FEATURES.md explicitly listed "Code review features" as an anti-feature because "GitHub/GitLab do this well."

**How Competitors Handle This**:

| Client | Code Review | Quality |
|--------|------------|---------|
| GitKraken | Full PR review mode -- inline comments, code suggestions, approve/merge | Best in class (paid feature) |
| Tower | PR creation, review, comment, merge across GitHub/GitLab/Bitbucket/Azure | Good |
| GitHub Desktop | Create PR (opens browser), no inline review | Minimal |
| Fork | Create PR (opens browser) | Minimal |
| Sourcetree | Create PR for Bitbucket only | Minimal |

**Key Insight**: GitKraken invested heavily in code review features (Code Suggestions, inline editing, PR review mode). This is a major revenue driver for their paid tier. Tower followed with cross-platform PR support. However, both essentially duplicate what the web UIs of GitHub/GitLab already do.

**Recommendation**: **Do NOT build full code review.** This remains an anti-feature for FlowForge's scope. However, there is a lighter-weight option worth considering:

**Lightweight Alternative -- "Pre-Commit Review Checklist"**:
- When a user is about to commit on a release or hotfix branch, show a configurable checklist
- Items like: "Tests passing?", "Documentation updated?", "Breaking changes noted?"
- This is Gitflow-aware guidance, not full code review
- Stored per-repo in `.flowforge/review-checklist.json` or settings

**Complexity**: Low for checklist, Very High for full code review. Recommend the checklist approach only.

**Dependencies**: Settings store for checklist items. Could be a section within the commit flow, not a separate blade.

---

### 7. Two-Column Staging (Changes vs Staged Side-by-Side)

**Current State**: FlowForge's `StagingPanel.tsx` shows staged, unstaged, and untracked files in a **vertical stack** within a single scrollable column. Users can toggle between tree and flat view modes.

**How Competitors Handle This**:

| Client | Staging Layout | Notes |
|--------|---------------|-------|
| SmartGit | **Two separate lists** -- toggle between stacked and side-by-side via `files.split.vertical` setting | Most flexible |
| Sourcetree | **Split pane** -- staged on top, unstaged on bottom with fixed visual anchor | Standard approach |
| GitKraken | **Vertical stack** -- Unstaged Files, then Staged Files, then Commit Message (all in right panel) | Similar to FlowForge |
| Tower | **Single list with toggle** -- "Staged" and "Unstaged" buttons above diff | Different approach |
| GitHub Desktop | **Single list** -- changed files, no separate staged/unstaged sections | Simplified model |
| Fork | **Vertical stack** -- staged changes section above unstaged | Standard approach |

**Key Insight**: The dominant pattern is vertical stacking (staged on top, unstaged below). SmartGit is the only client offering true side-by-side columns, and it is positioned as a power-user option. The Zed editor has an open feature request for side-by-side staging, indicating community interest but no established standard.

**Recommendation**: **Implement as an optional layout mode**, not the default. The current vertical stack is the industry standard and works well for most screen sizes. Add a toggle (like SmartGit's approach) that splits the staging panel into two columns when the user has sufficient horizontal space.

**Table Stakes Features**:
| Feature | Complexity | Notes |
|---------|------------|-------|
| Current vertical stack (already built) | Done | Keep as default |
| Count badges on section headers | Done | Already implemented |
| Collapse/expand sections | Done | Already implemented |

**Differentiator Features**:
| Feature | Complexity | Notes |
|---------|------------|-------|
| Side-by-side toggle (two columns) | Medium | Need min-width guard, responsive layout |
| Drag-and-drop between columns | High | Complex DnD with file items |
| Visual "flow" animation when staging/unstaging | Low | Framer Motion slide animation |

**Complexity**: Medium for the toggle layout, High if adding drag-and-drop.

**Dependencies**: Modifies `StagingPanel.tsx`. May need `StagingChangesBlade` layout awareness. Settings store for default layout preference.

---

### 8. Last-Used Branches / Branch Favorites

**Current State**: FlowForge's `BranchList.tsx` shows all branches in a flat list with the current branch highlighted. The `BranchSwitcher.tsx` exists as a dropdown with search but no "recent" or "favorites" section.

**How Competitors Handle This**:

| Client | Recent/Favorites | Notes |
|--------|-----------------|-------|
| Tower (v15) | **Pinned Branches** -- stored in Git config, auto-expanded section, multi-select pin/unpin, Pin checkbox in Create Branch dialog | Best in class |
| GitHub Desktop | **Recent Branches** -- shows last 5 checked-out branches, users requesting more (issues #14311, #19664, #20972) | Basic but useful |
| GitKraken | No dedicated recent/favorites section | N/A |
| Fork | No dedicated recent/favorites section | N/A |
| Sourcetree | No dedicated recent/favorites section | N/A |

**Key Insight**: Tower's "Pinned Branches" is the best implementation. Key design decisions from Tower:
1. **Stored in Git config** -- persists across machines, survives app reinstall
2. **Separate sidebar section** -- always visible, auto-expanded
3. **Multi-select** -- pin/unpin multiple branches at once
4. **Create Branch dialog integration** -- "Pin this branch" checkbox when creating

GitHub Desktop's "Recent Branches" (last 5 checked out) is simpler but still highly valued by users -- multiple feature requests asking for more than 5.

**Recommendation**: **Implement both recent and pinned branches** as a combined "Quick Access" section at the top of the branch list.

**Table Stakes Features**:
| Feature | Complexity | Notes |
|---------|------------|-------|
| Recent branches (last N checked out, track via reflog or local store) | Low | Read `git reflog` or track in app state |
| Pinned/favorite branches (star icon toggle) | Low | Store in local settings or `.git/config` |
| Quick Access section at top of sidebar BranchList | Low | New UI section above existing list |

**Differentiator Features**:
| Feature | Complexity | Notes |
|---------|------------|-------|
| Store pins in Git config (Tower's approach -- portable) | Low | Write to `.git/config` via git2 |
| "Pin on create" checkbox in CreateBranchDialog | Low | UI addition |
| Gitflow-aware pinning (auto-pin develop and main) | Low | Auto-detect Gitflow branches |
| Branch age/last-commit indicator in favorites | Low | Timestamp from git log |

**Complexity**: Low overall. This is primarily a UI/UX feature with minimal backend work.

**Dependencies**: Extends `BranchList.tsx` and `BranchSwitcher.tsx`. Settings or Git config for persistence. Reflog access via git2 for recent tracking.

---

### 9. GitFlow Reference/Cheat Sheet Integration

**Current State**: FlowForge has a `GitflowPanel.tsx` that shows start/finish buttons for feature, release, and hotfix flows. Buttons are disabled with tooltip explanations when actions are unavailable. No reference documentation or educational content is integrated.

**How Competitors Handle This**:

| Client | Gitflow Education | Notes |
|--------|-------------------|-------|
| GitKraken | Links to external documentation | No in-app reference |
| Tower | Links to tower.com/learn Gitflow guide | External docs |
| Sourcetree | No Gitflow reference | N/A |
| Fork | No Gitflow support at all | N/A |
| GitHub Desktop | No Gitflow support | N/A |

**Key Insight**: No Git client integrates Gitflow education inline. The best resources are external:
- danielkummer.github.io/git-flow-cheatsheet (interactive, popular)
- Atlassian's Gitflow Workflow tutorial (comprehensive)
- Various Medium posts and cheat sheets

Since FlowForge uniquely **enforces** Gitflow, having inline reference material would be genuinely differentiated. Users who are new to Gitflow or who use it infrequently would benefit from contextual guidance.

**Recommendation**: **Build a GitFlow Reference Blade** that serves as both cheat sheet and contextual help.

**Table Stakes Features**:
| Feature | Complexity | Notes |
|---------|------------|-------|
| Static reference card showing branch types and their purposes | Low | Markdown or JSX content |
| Visual diagram of Gitflow branch model | Medium | SVG or static image |
| Link to external resources | Low | Outbound links |

**Differentiator Features**:
| Feature | Complexity | Notes |
|---------|------------|-------|
| **Contextual highlighting** -- highlight the current workflow step in the diagram | Medium | Connect to GitflowStore state |
| **"You are here" indicator** -- show which branch type you are on and what actions are available | Low | Read from gitflow status |
| **Suggested next action** -- "You are on a feature branch. When ready, Finish Feature to merge to develop." | Low | State-driven text |
| **Hotkey integration** -- accessible via `?` or help menu | Low | Register in command palette |

**Complexity**: Low-Medium. Content is static/semi-static. The contextual highlighting is the main engineering work.

**Dependencies**: New `BladeType` `"gitflow-reference"`. Reads from `useGitflowStore()` for context. Could also be a side panel rather than a full blade.

---

## Feature Categories Summary

### Table Stakes

Features users expect. Missing means the product feels incomplete in the context of the planned features.

| Feature | Expected Because | Complexity | Existing Dep. |
|---------|-----------------|------------|---------------|
| Branch "merged" badge | All competitors show this | Done | `BranchItem.tsx` |
| Vertical staging layout | Industry standard | Done | `StagingPanel.tsx` |
| File tree in commit details | Fork, Tower, GitKraken all have this | Medium | `FileTreeView` pattern exists |
| Remote branch pruning | Basic Git hygiene, Tower does auto | Low | New backend command |
| Recent branches list | GitHub Desktop has this, highly requested | Low | Track in store or reflog |
| Branch search/filter | All competitors have this | Done | `BranchSwitcher.tsx` |

### Differentiators

Features that leverage the blade navigation paradigm to create competitive advantage.

| Feature | Value Proposition | Complexity | Blade? |
|---------|-------------------|------------|--------|
| **Settings as a blade** | Only Azure Portal does this; no Git client | Medium | Yes -- `"settings"` |
| **Markdown preview blade** | Zero desktop Git clients have this | Medium | Yes -- `"viewer-markdown"` |
| **Branch cleanup wizard blade** | Tower has badges but no guided workflow | Medium | Yes -- `"branch-cleanup"` |
| **GitFlow reference blade with context** | No client integrates Gitflow education inline | Low-Med | Yes -- `"gitflow-reference"` |
| **Pinned branches (Git config stored)** | Only Tower has this; portable across machines | Low | No -- sidebar enhancement |
| **Two-column staging toggle** | Only SmartGit offers this | Medium | No -- layout mode |
| **Staging animation on stage/unstage** | No client does this; framer-motion is already in stack | Low | No -- animation enhancement |
| **Commit-scoped file browser blade** | Extends existing blade paradigm for code archaeology | Medium | Yes -- `"file-browser"` |

### Anti-Features

Things to deliberately NOT build in this milestone.

| Anti-Feature | Why Not | What to Do Instead |
|--------------|---------|-------------------|
| **Full code review / PR review mode** | Duplicates GitHub/GitLab web UIs; GitKraken spent years on this | Lightweight pre-commit checklist at most |
| **3D asset preview** | Niche audience, heavy dependency (Three.js ~500KB), poor effort/value | Show "Binary file" with file size; defer to v2+ |
| **General-purpose file explorer** | Users browse files in their IDE | Build commit-scoped file browser only |
| **Drag-and-drop staging** | Complex DnD implementation, low ROI vs click-to-stage | Keep existing click/button staging |
| **Built-in markdown editor** | Scope creep toward IDE territory | Preview only, not editing |
| **Branch comparison/diff blade** | Complex feature, better done on GitHub/GitLab | Link to web comparison instead |

---

## Feature Dependencies

```
Blade Store Extension (new BladeTypes)
       |
       +---> Settings Blade
       |         |
       |         +---> Two-column staging toggle (setting stored here)
       |         +---> Branch cleanup auto-prune (setting stored here)
       |         +---> Stale branch threshold (setting stored here)
       |
       +---> Markdown Preview Blade
       |         |
       |         +---> File type detection routing (extend existing)
       |
       +---> File Browser Blade
       |         |
       |         +---> New backend command (get_commit_file_tree)
       |         +---> File type detection routing (open in viewer blade)
       |
       +---> GitFlow Reference Blade
       |         |
       |         +---> GitflowStore (for contextual state)
       |
       +---> Branch Cleanup Blade
                 |
                 +---> Stale detection (git2 commit timestamps)
                 +---> Bulk delete (batch branch deletion)
                 +---> Gitflow protection (state machine knows sacred branches)

Branch Management Enhancements (sidebar, not blades)
       |
       +---> Pinned Branches section
       |         |
       |         +---> Git config persistence
       |         +---> CreateBranchDialog "Pin" checkbox
       |
       +---> Recent Branches section
                 |
                 +---> Reflog or local tracking
```

---

## MVP Recommendation (This Milestone)

**Must build (highest value, lowest risk):**

1. **Settings blade** -- Foundation for all other settings-dependent features. Converts existing modal to blade with minimal risk. Unblocks two-column staging toggle and cleanup settings.

2. **Markdown preview blade** -- Massive differentiation for zero competition. `react-markdown` is battle-tested. Reuses proven blade infrastructure.

3. **Pinned + recent branches** -- Low complexity, high daily-use value. Tower proved this pattern works.

4. **Branch cleanup with stale/merged badges** -- Tower set the bar; FlowForge can match and add Gitflow awareness.

**Should build (strong value, moderate effort):**

5. **GitFlow reference blade** -- Unique to FlowForge's Gitflow-enforcing identity. Low complexity for static content, medium for contextual highlighting.

6. **Commit-scoped file browser blade** -- Extends the blade stack naturally. Needs one backend command.

**Defer (lower priority or high effort):**

7. **Two-column staging toggle** -- Nice-to-have; current vertical layout works. Implement after core features.

8. **Branch cleanup wizard blade** -- The badges and bulk delete can ship without a wizard. Wizard is polish.

9. **3D asset preview** -- Defer entirely. Not aligned with target audience.

10. **Code review prompts** -- Lightweight checklist is optional polish.

---

## New BladeTypes Required

| BladeType | Purpose | Priority |
|-----------|---------|----------|
| `"settings"` | Settings as navigation blade | P0 |
| `"viewer-markdown"` | Rendered markdown preview | P0 |
| `"file-browser"` | Commit-scoped repository file tree | P1 |
| `"gitflow-reference"` | Gitflow cheat sheet with context | P1 |
| `"branch-cleanup"` | Branch cleanup wizard (if built) | P2 |

---

## New Dependencies Required

| Package | Purpose | Size Impact | Priority |
|---------|---------|-------------|----------|
| `react-markdown` | Markdown rendering | ~50KB | P0 |
| `remark-gfm` | GitHub Flavored Markdown (tables, task lists) | ~15KB | P0 |
| `rehype-highlight` or `rehype-prism` | Code syntax highlighting in markdown | ~30KB | P1 |

**NOT recommended for this milestone:**
| Package | Purpose | Why Not |
|---------|---------|---------|
| `three` / `@react-three/fiber` | 3D preview | ~500KB+, niche audience |
| Any PR/review library | Code review | Anti-feature |

---

## Quality Gate Verification

- [x] Categories are clear (table stakes vs differentiators vs anti-features)
- [x] Complexity noted for each feature
- [x] Dependencies on existing features identified
- [x] Blade vs non-blade classification for each feature
- [x] New BladeTypes enumerated
- [x] NPM dependencies identified with size impact

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Settings blade pattern | HIGH | Azure Portal blade UX is well-documented; VS Code settings-as-page pattern is verified |
| Markdown preview gap | HIGH | Verified via GitHub Desktop issue #17248, Sourcetree SRCTREE-2631, direct testing |
| Tower branch cleanup | HIGH | Verified via Tower v15 blog post (official source) |
| Branch favorites | HIGH | Verified via Tower release notes and GitHub Desktop issues |
| Two-column staging | MEDIUM | SmartGit docs confirm feature; other clients mostly use vertical stack |
| 3D preview ecosystem | MEDIUM | Anchorpoint/Artstash are niche; mainstream clients confirmed to lack this |
| Code review in Git clients | HIGH | GitKraken and Tower official feature pages verified |
| GitFlow reference gap | HIGH | Checked all 5 major competitors; none integrate education inline |
| react-markdown maturity | HIGH | Verified via npm (v10, active maintenance, Dec 2024 release) |

---

## Sources

### Official Documentation (HIGH confidence)
- [Tower v15 Release Blog](https://www.git-tower.com/blog/tower-mac-15) -- Branch cleanup, pinned branches, auto-archive
- [Tower All Features](https://www.git-tower.com/features/all-features) -- Feature overview
- [GitKraken Desktop Interface](https://help.gitkraken.com/gitkraken-desktop/interface/) -- Layout, staging, panels
- [GitKraken Code Review](https://www.gitkraken.com/solutions/code-review) -- PR review features
- [GitHub Desktop Issue #17248](https://github.com/desktop/desktop/issues/17248) -- Markdown rendering request
- [GitHub Working with Non-Code Files](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files) -- Rich diff for markdown
- [VS Code Sidebars UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/sidebars) -- Sidebar navigation patterns
- [Azure Portal Blade Architecture](https://github.com/Azure/portaldocs/blob/main/portal-sdk/generated/top-extensions-architecture.md) -- Blade UX pattern
- [react-markdown on GitHub](https://github.com/remarkjs/react-markdown) -- Current version, API

### Verified Web Sources (MEDIUM confidence)
- [SmartGit Split File List](https://smartgit.userecho.com/communities/1/topics/77-split-list-of-files-to-two-separate-list-as-in-sourcetree) -- Two-column staging
- [GitHub Desktop Recent Branches Issues](https://github.com/desktop/desktop/issues/19664) -- Users wanting more than 5 recent branches
- [Sourcetree Markdown Request SRCTREE-2631](https://jira.atlassian.com/browse/SRCTREE-2631) -- Open since 2015
- [Git-Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/) -- Reference content
- [Anchorpoint 3D Asset Management](https://www.anchorpoint.app/blog/a-comparison-of-3d-asset-management-software-for-game-art) -- Specialized 3D Git tools

### UX Pattern Sources (MEDIUM confidence)
- [Side Drawer UI Guide](https://www.designmonks.co/blog/side-drawer-ui) -- Sidebar vs modal patterns
- [UX Planet Sidebar Best Practices](https://uxplanet.org/best-ux-practices-for-designing-a-sidebar-9174ee0ecaa2) -- Settings navigation
- [Material Design Side Sheets](https://m3.material.io/components/side-sheets/guidelines) -- Panel patterns
