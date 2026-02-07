# Phase 19 Research: Settings, Onboarding & File Icons (Synthesis)

**Researched by**: 3-agent team (UX, Architecture, Expert Developer)
**Date**: 2026-02-07
**Detailed files**: 19-RESEARCH-UX.md, 19-RESEARCH-ARCHITECTURE.md, 19-RESEARCH-EXPERT-DEV.md

---

## Key Findings Across All Perspectives

### 1. Settings Store Architecture

**Current state** (`src/stores/settings.ts`):
- Zustand store with `Settings { general, git }` — flat category-based
- `SettingsCategory = "general" | "git" | "appearance"` — "appearance" uses separate `useThemeStore`
- Persistence: Tauri plugin-store → `flowforge-settings.json` under single `"settings"` key
- Auto-save: immediate write-through on every `onChange` (no debounce)
- Type-safe `updateSetting<C extends keyof Settings>(category, key, value)`
- `initSettings()` loads and merges with defaults at boot (called in App.tsx)

**Extension needed**:
- Add `integrations` to `SettingsCategory` union
- Add `IntegrationsSettings { editor, terminal }` to `Settings` interface
- Update `defaultSettings` and `initSettings` merge logic
- Use generic merge helper instead of per-category spread

### 2. Git Config vs App Settings — Dual Persistence

**Critical finding**: Git identity fields (user.name, user.email, init.defaultBranch) must persist to **git global config** (`~/.gitconfig`), NOT the Tauri store. Integration settings (editor, terminal) are app-only and use Tauri store.

**Required new Rust commands**:
- `get_git_global_config(key: String) -> Result<Option<String>, GitError>` — uses `git2::Config::open_default()`
- `set_git_global_config(key: String, value: String) -> Result<(), GitError>` — writes to global config
- `git_init(path: String, default_branch: Option<String>) -> Result<InitResult, GitError>` — uses `git2::Repository::init_opts()`

**All follow existing command patterns**: `#[tauri::command] #[specta::specta]`, `tokio::task::spawn_blocking`, `Result<T, GitError>`, registered in `collect_commands![]`.

### 3. Settings Tab System

**Current** (`SettingsWindow.tsx`): Hardcoded array + switch statement. Adding a tab requires 5 touch-points (union type, array, switch, component, import).

**Recommendation**: Refactor to declarative tab array — eliminates switch, reduces to single-file change for new tabs:
```typescript
const settingsTabs = [
  { id: "general", label: "General", icon: Settings, component: GeneralSettings },
  { id: "git", label: "Git", icon: GitBranch, component: GitSettings },
  { id: "integrations", label: "Integrations", icon: Wrench, component: IntegrationsSettings },
  { id: "appearance", label: "Appearance", icon: Palette, component: AppearanceSettings },
];
```

### 4. Welcome/Open Flow & Git Init

**Current flow**: WelcomeView → openDialog() → Tauri `open_repository()` → Rust validates with `git2::Repository::open()` → fails with `GitError::NotARepository` → error displayed as red banner.

**Modification approach**:
- In WelcomeView, detect `NotARepository` error specifically
- Use local state (`pendingInitPath`, `bannerDismissed`) — don't pollute global store
- Show inline GitInitBanner with `fadeInUp` animation (existing pattern)
- Banner: info icon + message + "Set default branch to main" checkbox + Initialize/Cancel buttons
- After init success: call `openRepository(path)` → auto-open repo
- Drag-drop flow also needs same check via `isGitRepository(path)` before attempting open

**Key issues to handle**:
- Repository store `error` field is `string` — need typed error detection (string match on "Not a repository" or add `lastGitError: GitError | null`)
- Need `lastAttemptedPath` to know which folder to init (or keep in local state)

### 5. File Icon System

**Current** (`src/lib/file-icons.ts`): 37 SVG imports, `FILE_ICON_MAP` (55 extensions) + `FILENAME_ICON_MAP` (25 filenames). Resolution: filename match → extension match → default FileIcon.

**Gaps to fill** (per Phase Context):
- Image: png, jpg, jpeg, gif, webp, bmp, ico → new `image.svg`
- Font: ttf, otf, woff, woff2 → new `font.svg`
- Archive: zip, tar, gz, 7z → new `archive.svg`
- Environment: .env, .env.local etc → new `env.svg` (currently maps to generic FileIcon)
- Config: Makefile, .editorconfig, .prettierrc → reuse existing icons

**No architectural change needed** — the flat map pattern scales well. Just add SVGs and map entries.

### 6. Platform Detection

**Current**: Scattered `navigator.platform` checks in 5+ files with inconsistent patterns.

**Recommendation**: Extract to `src/lib/platform.ts`:
```typescript
export type Platform = "macos" | "windows" | "linux";
export function getPlatform(): Platform { ... }
export const isMac = getPlatform() === "macos";
```
Needed for platform-aware editor/terminal dropdown options.

### 7. Form Patterns & Auto-Save UX

**Current observations**:
- Raw `<input>` elements in settings (not using existing `Input` component from `src/components/ui/input.tsx`)
- No debounce on text inputs (every keystroke triggers IPC + disk write)
- No save feedback (no "Saved" indicator, no error handling, fails silently)
- Missing ARIA roles for tab navigation, missing keyboard nav between tabs

**Recommendations for Phase 19**:
- Add debounce (300ms) for text inputs, immediate for toggles/selects
- Git config fields: save on blur with debounce (not every keystroke)
- Reusable `SettingsField` wrapper component for consistent label/description/children pattern
- For editor/terminal: combobox pattern (similar to CommandPalette) with platform-aware options + custom path fallback
- Add ARIA tablist/tab/tabpanel roles to settings sidebar
- Add subtle auto-save feedback (inline "Saved" checkmark, 2s fade)

### 8. Technical Risks

| Risk | Mitigation |
|------|-----------|
| `git2::Config::open_default()` fails if no ~/.gitconfig | Handle gracefully — show "not configured" state |
| Text input auto-save overwhelms IPC | Debounce 300-500ms for text, save on blur for git config |
| `NotARepository` error detection (string-based) | Match error string pattern or add typed error field |
| Settings store migration (existing users) | `initSettings()` spread merge handles missing keys gracefully |
| bindings.ts TS2440 on command addition | Known pre-existing issue — ignore |
| SVG bundle size with 5+ new icons | Negligible (<5KB total), tree-shakes well |

---

## Dependency Graph for Implementation

```
Wave 1 (parallel):
  19-01: Rust backend (git_init + git config commands)
  19-02: Settings store schema + platform utility + tab refactor
  19-06: File icon expansion (SVGs + mappings)

Wave 2 (depends on 19-01 + 19-02):
  19-03: Git settings expansion (user.name, email, defaultBranch)
  19-04: Integrations settings tab (editor/terminal dropdowns)

Wave 3 (depends on 19-01):
  19-05: Git init flow in WelcomeView
```

---
*Synthesized from 3 parallel research agents, 2026-02-07*
