# Phase 21 Context: Two-Column Staging & Inline Diff

## Phase Goal

Users can see their changed files and a diff preview side-by-side without losing context by navigating away from the staging view.

## Current State

- Staging blade (`StagingChangesBlade`) shows a full-width file list (tree or flat view) with 3 sections: Staged Changes, Changes, Untracked Files
- Clicking a file **pushes a new blade** (navigates away from the file list)
- Diff viewing uses `DiffBlade` with Monaco DiffEditor (supports inline/side-by-side toggle)
- File routing: `openStagingDiff()` maps extensions to specialized viewers (images, markdown, 3D, nupkg) — text files go to `DiffBlade`
- Left sidebar contains branches, stashes, tags, gitflow, worktrees, and the commit form
- The blade container is the remaining ~80% of the window

## Decisions

### 1. File Selection Behavior

| Decision | Choice |
|----------|--------|
| Auto-select on load | **Yes** — first file auto-selected, diff shown immediately (no empty state) |
| Stage/unstage while viewing | **Keep showing same file** — diff stays visible, file moves between sections in the list |
| Last file staged/unstaged | Same file stays visible in its new section |
| Keyboard navigation | **Yes** — arrow keys move selection through the file list, diff updates immediately |

### 2. Layout Split & Responsiveness

| Decision | Choice |
|----------|--------|
| Default column ratio | **40% file list / 60% diff preview** |
| Resizable | **Yes** — drag handle between columns (consistent with existing left sidebar pattern) |
| Narrow behavior | **Proportional shrink** — both columns shrink, no layout collapse |
| Min widths | Apply reasonable minimums to keep both panels usable |

### 3. Inline Diff ↔ Full Blade Transition

| Decision | Choice |
|----------|--------|
| Expand action | **Push new blade** on top of staging — back returns to two-column view with same file selected |
| Expand button position | **Small icon in top-right corner** of the diff panel (maximize-style icon) |
| State preservation on back | Yes — same file selected, same scroll position ideally |
| File navigation in full-screen | **Yes** — next/prev arrows in the full-screen diff blade to navigate files without going back |

### 4. Diff Preview Scope

| Decision | Choice |
|----------|--------|
| Inline viewer scope | **Text diffs only** — non-text files show a "click to expand" prompt in the inline panel |
| Diff engine | **Monaco DiffEditor** — same editor as full-screen blade for consistent experience |
| Binary files | Show placeholder with file type icon and "Binary file — click to expand" |
| Image files | Show placeholder, not inline preview — expand to see specialized viewer |

## Deferred Ideas

None captured during discussion.

## Constraints

- Must work within existing blade stack navigation (push/pop model)
- Resizable panel component already exists in codebase (`ResizablePanel` pattern from left sidebar)
- Monaco DiffEditor already integrated and working in `DiffBlade`
- File extension routing logic exists in `useBladeNavigation.openStagingDiff()`

---
*Created: 2026-02-07*
*Phase: 21 — Two-Column Staging & Inline Diff*
