# Phase 22: New Content Blades — Context

## Overview

Phase 22 implements the four placeholder blade types registered in Phase 20 (viewer-markdown, viewer-3d, repo-browser, gitflow-cheatsheet), adds a diff-to-markdown toggle, and introduces a new viewer-code blade for generic file preview.

**Requirements**: CONTENT-01 through CONTENT-06

---

## Decisions

### 1. Markdown Rendering UX (CONTENT-01, CONTENT-02)

**Link handling:**
- External URLs (`https://...`) → open in system browser via Tauri shell API
- Relative `.md` links → replace current blade with a new markdown viewer blade (not push)
- Other relative file links → open in repo browser blade at that path

**Image handling:**
- Inline render from git HEAD — fetch via `read_repo_file`, convert to base64 data URL
- No size limit or lazy loading for v1 (optimize later if needed)

**XSS protection (P3 research flag — RESOLVED):**
- Use `rehype-sanitize` plugin with GitHub's sanitization schema
- Strips dangerous HTML while preserving safe GFM elements (tables, task lists, etc.)

**Syntax highlighting for code blocks:**
- Use highlight.js with a Catppuccin Mocha-matching theme
- Must be consistent with the app's `--ctp-*` color tokens

**Diff toggle (CONTENT-02):**
- Toggle button in the DiffBlade header bar (segmented control or icon toggle)
- Switches between Monaco diff view and rendered markdown preview
- Rendered preview shows the **new version only** (working tree or staged), not side-by-side rendered comparison
- Only appears for `.md` files

### 2. Repo Browser Interaction (CONTENT-04)

**Entry points:**
- Header toolbar button (always visible when a repo is open)
- Cross-blade links: commit details file list, markdown relative links

**Navigation model: File explorer style**
- Flat list showing files and folders in current directory
- Clicking a folder **replaces** the current blade (not push) — navigates into that directory
- Clicking a file opens the appropriate viewer blade (pushed onto stack)
- Back button returns to parent directory

**Breadcrumbs:**
- Clickable path segments: `repo / src / components / blades`
- Each segment navigable — jump to any ancestor directory

**File click dispatch (smart dispatch):**
- `.md`, `.mdx` → viewer-markdown blade
- `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`, `.ico` → viewer-image blade
- `.glb`, `.gltf` → viewer-3d blade
- `.nupkg` → viewer-nupkg blade
- Everything else (text files) → **new `viewer-code` blade** (Monaco read-only with language auto-detection)
- Binary files (non-text, non-image, non-3D) → file info card with name, size, type

**New blade type required: `viewer-code`**
- Monaco editor in read-only mode
- Language auto-detection from file extension
- Uses same Monaco instance/config as existing diff viewer
- Registered in BladePropsMap with `{ filePath: string }` props

### 3. Gitflow Cheatsheet Content (CONTENT-05, CONTENT-06)

**Diagram:**
- Static SVG as an inline React component
- Catppuccin-themed colors for branch lanes
- Props control which lane is highlighted (feature, release, hotfix, main, develop)
- Branch type determined from current branch name prefix convention

**"You are here" indicator (position + state):**
- Highlights the current branch type lane in the SVG diagram
- Shows exact branch name: "You are on `feature/add-login`"
- Shows commits ahead of merge-base (best effort using existing git commands)
- Branch type classification: `feature/*`, `release/*`, `hotfix/*`, `main`, `develop`, `other`

**Next action suggestions (CONTENT-06):**
- 1-3 contextual action cards based on current branch type
- Examples:
  - On `feature/*`: "Finish feature → merge to develop", "Push to remote"
  - On `develop`: "Start feature branch", "Start release branch"
  - On `release/*`: "Finish release → merge to main and develop"
  - On `hotfix/*`: "Finish hotfix → merge to main and develop"
  - On `main`: "Start hotfix if needed", "Review tags"
- Cards are informational only (no action buttons that execute git commands)

**Content scope: Full reference with emphasis**
- Always show all 5 branch types (main, develop, feature, release, hotfix)
- Each type has: description, naming convention, branches from/merges to, typical workflow
- Current branch type is visually emphasized (larger card, highlight color, "You are here" badge)

### 4. 3D Model Viewer (CONTENT-03)

**WebGL fallback (P2 research flag — RESOLVED):**
- On context loss: show static placeholder image with "Reload 3D View" retry button
- User can retry without navigating away from the blade

**Background:**
- Subtle gradient from `--ctp-base` to `--ctp-mantle`
- Gives slight depth perception while remaining consistent with app theme

**Metadata:**
- Collapsible info panel showing file size, format, and basic stats
- Hidden by default to maximize 3D viewport
- Toggle button in blade header

**Loading UX:**
- Centered spinner while fetching and loading model
- Fade-in reveal when model is ready

**Model loading pipeline:**
1. Fetch file content via `read_repo_file` (returns base64 for binary)
2. Decode base64 to ArrayBuffer
3. Create blob URL from ArrayBuffer
4. Pass blob URL to `<model-viewer src="...">` element
5. Clean up blob URL on unmount

**Orbit controls:**
- Use model-viewer's built-in camera-controls attribute
- Auto-rotate on initial load (can be stopped by user interaction)
- Auto-lighting via model-viewer's default environment

---

## Research Flags Resolved

| Flag | Resolution |
|------|------------|
| P2: WebGL context loss | Static placeholder + retry button |
| P3: XSS via markdown | rehype-sanitize with GitHub schema |
| P4: File browser performance | Flat list per directory (no full tree), virtualization deferred |

---

## Deferred Ideas

| Idea | Source | Reason |
|------|--------|--------|
| FSM library for blade stack handling | User suggestion during markdown discussion | Architectural change beyond Phase 22 scope — evaluate for v1.4 |
| Side-by-side rendered markdown diff | Markdown toggle discussion | Complex, new version preview is sufficient for now |
| Image lazy loading in markdown | Image handling discussion | Optimize later if large-image repos cause issues |
| Drag-and-drop file upload to repo | Repo browser discussion | Out of scope — repo browser is read-only at HEAD |

---

## Existing Infrastructure

Phase 20 already delivered:
- Blade type registrations for viewer-markdown, viewer-3d, repo-browser, gitflow-cheatsheet (placeholder implementations)
- BladePropsMap entries with type-safe props
- Rust commands: `list_repo_files` and `read_repo_file` (registered and working)
- Lazy loading setup for all viewer blades

Phase 22 needs to:
- Replace placeholder implementations with real ones
- Add `viewer-code` blade type (new registration + BladePropsMap entry)
- Add DiffBlade header toggle for markdown files
- Add header toolbar entry point for repo browser
- Install new dependencies: react-markdown, remark-gfm, rehype-highlight, rehype-sanitize, @google/model-viewer, highlight.js (Catppuccin theme)

---
*Created: 2026-02-07*
*Phase: 22 — New Content Blades*
