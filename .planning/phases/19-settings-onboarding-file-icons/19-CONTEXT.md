# Phase 19 Context: Settings, Onboarding & File Icons

## Phase Goal
Users can configure Git identity and external tools, get prompted to initialize repos, and see rich file-type icons.

## Decisions

### 1. Settings UI Layout

**Decision:** Add "Integrations" tab to existing sidebar nav in SettingsWindow.

- Settings already uses left-sidebar navigation (General, Git, Appearance) with auto-save on change — keep this pattern
- Add **Integrations** tab with Wrench icon between Appearance and any future tabs
- Expand **GitSettings** tab to include user.name, user.email, and init.defaultBranch fields (currently only has default remote and auto-fetch interval)
- Save behavior: auto-save on change (existing pattern, no save button)
- Scope: global git config (`--global`), not per-repo

**Existing structure to extend:**
- `src/components/settings/SettingsWindow.tsx` — add tab
- `src/components/settings/GitSettings.tsx` — add identity fields
- `src/stores/settings.ts` — add integrations category
- New: `src/components/settings/IntegrationsSettings.tsx`

### 2. Editor/Terminal Configuration

**Decision:** Dropdown of known apps with free-text fallback.

- **External editor:** Dropdown with common editors: VS Code, Cursor, Zed, Sublime Text, Vim, Neovim, Emacs, Custom (free-text path)
- **Terminal shell:** Dropdown with common terminals: Default (system), Terminal.app, iTerm2, Alacritty, Wezterm, Kitty, Custom (free-text path)
- Platform-aware: show macOS-relevant options on macOS, Linux-relevant on Linux, Windows-relevant on Windows
- **Usage:** Not wired to actions in this phase — just save the preference. Future phases can add "Open in Editor" context menu items on files
- Store values as string path/identifier in Tauri persistent store under `settings.integrations`

### 3. Git Init Prompt UX

**Decision:** Inline banner in WelcomeView when a non-git folder is dropped/opened.

- Current flow: user opens a folder → `isGitRepository()` check → if false, currently does nothing useful
- New flow: if folder is not a git repo, show an **inline card/banner** in the WelcomeView area (not a modal, not a toast) with:
  - Message: "This folder is not a Git repository"
  - Primary action: "Initialize Repository" button → runs `git init` → opens the repo
  - Secondary action: "Cancel" → returns to welcome
  - Optional: checkbox "Set default branch to `main`" (checked by default)
- After successful init: auto-open the newly initialized repo (same as clone completion flow)
- No init support from within an already-open repo context — only from the welcome/open flow

**Backend needed:** New Tauri command `git_init(path, default_branch)` in Rust

### 4. File Icon Coverage & Style

**Decision:** File icons are already extensive (40+ types). Phase 19 expands coverage, not rewrites.

The existing system (`src/lib/file-icons.ts` + `src/components/icons/FileTypeIcon.tsx`) already covers 40+ file types with SVG icons and Catppuccin-compatible colors. The requirement says "distinct Catppuccin-themed icons for common file types (.ts, .rs, .json, .md, .toml, images, etc.)" — this is **already satisfied** for most types.

**Expand with:**
- Image files: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico` → Image icon with Catppuccin pink
- Font files: `.woff`, `.woff2`, `.ttf`, `.otf` → Font icon
- Archive files: `.zip`, `.tar`, `.gz`, `.7z` → Archive icon
- Environment: `.env`, `.env.local` → Lock/Shield icon (highlight as sensitive)
- Config: `Makefile`, `CMakeLists.txt`, `.editorconfig`, `.prettierrc`, `.eslintrc` → Gear icon variants
- Verify existing icons use Catppuccin color tokens (`--ctp-*`) consistently

**Where icons appear:** Staging tree (already), diff blade header (already via FileTypeIcon), no changes to placement needed.

## Deferred Ideas

None captured — all requirements map cleanly to the phase scope.

## Scope Boundaries

- Editor/terminal preferences are saved but NOT wired to "Open in Editor" actions (future phase)
- Git config is global only, not per-repo overrides
- No auto-detection of installed editors (just dropdown + custom)
- File icon work is additive expansion, not a rewrite of the icon system
- No git init from within an open repo (only from welcome flow)

---
*Context created: 2026-02-07*
*Phase: 19 — Settings, Onboarding & File Icons*
