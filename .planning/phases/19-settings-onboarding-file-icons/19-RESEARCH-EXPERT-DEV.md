# Phase 19 Research: Expert Developer Perspective

## Rust Backend Analysis

### Existing Command Patterns

All Tauri commands follow a consistent pattern across 15+ modules:

**Signature pattern** (`src-tauri/src/git/branch.rs:31`, `commit.rs:122`, `commands.rs:16`):
```rust
#[tauri::command]
#[specta::specta]
pub async fn command_name(
    // 1. Input parameters (simple types: String, bool, structs)
    param: String,
    // 2. Tauri managed state (always last positional args)
    state: State<'_, RepositoryState>,
) -> Result<ReturnType, GitError> {
```

**Execution pattern** -- Every command that touches git2:
1. Extract repo path from `RepositoryState::get_path().await`
2. Wrap all git2 operations in `tokio::task::spawn_blocking(move || { ... })`
3. Open a fresh `git2::Repository::open(&repo_path)` inside the blocking closure (because git2::Repository is not Send/Sync -- see `repository.rs:28-31` comment)
4. Return `Result<T, GitError>` or `Result<T, GitflowError>`

**Error handling** (`src-tauri/src/git/error.rs:9-112`):
- Tagged enum with `#[serde(tag = "type", content = "message")]`
- Derives: `Debug, Error, Serialize, Deserialize, Type, Clone`
- Implements `From<git2::Error>` for automatic conversion
- 24 distinct error variants covering all domains

**Return types** -- All use serde-serializable structs:
```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SomeResult { ... }
```

**Registration** (`src-tauri/src/lib.rs:50-130`):
- All commands listed in `collect_commands![]` macro
- Organized by comment-delimited categories
- Auto-generates TypeScript bindings via `tauri-specta`

### git_init Implementation Approach

**Required API: `git2::Repository::init_opts`**

The git2 crate (v0.20, pinned in `Cargo.toml:27`) provides:
- `Repository::init(path)` -- basic init
- `Repository::init_opts(path, opts)` -- init with options including initial branch name

**Concrete implementation plan:**

```rust
// New file: src-tauri/src/git/init.rs

use std::path::PathBuf;
use crate::git::error::GitError;

/// Result of initializing a new Git repository.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct InitResult {
    /// Path to the newly initialized repository
    pub repo_path: String,
    /// The initial branch name
    pub initial_branch: String,
}

/// Initialize a new Git repository at the given path.
///
/// Creates a new empty Git repository with an optional custom
/// default branch name. If no branch name is provided, uses "main".
#[tauri::command]
#[specta::specta]
pub async fn git_init(
    path: String,
    default_branch: Option<String>,
) -> Result<InitResult, GitError> {
    let path_buf = PathBuf::from(&path);

    // Validate path exists and is a directory
    if !path_buf.exists() {
        return Err(GitError::PathNotFound(path));
    }
    if !path_buf.is_dir() {
        return Err(GitError::InvalidPath(
            "Path is not a directory".to_string()
        ));
    }

    // Check not already a git repo
    if git2::Repository::open(&path_buf).is_ok() {
        return Err(GitError::OperationFailed(
            "Directory is already a Git repository".to_string()
        ));
    }

    let branch = default_branch.unwrap_or_else(|| "main".to_string());
    let branch_clone = branch.clone();

    tokio::task::spawn_blocking(move || {
        let mut opts = git2::RepositoryInitOptions::new();
        opts.initial_head(&branch_clone);

        git2::Repository::init_opts(&path_buf, &opts)
            .map_err(|e| GitError::OperationFailed(
                format!("Failed to initialize repository: {}", e.message())
            ))?;

        Ok(InitResult {
            repo_path: path,
            initial_branch: branch_clone,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

**Key git2 APIs used:**
- `RepositoryInitOptions::new()` + `.initial_head(branch_name)` sets the default branch
- `Repository::init_opts(path, &opts)` creates the repo
- No need for `RepositoryState` since this is a standalone operation (no open repo required)

### Git Config Read/Write

**For global git config (user.name, user.email, init.defaultBranch):**

The git2 crate provides `Config::open_default()` which opens the cascaded config (system + global + local). For writing global config specifically, use `Config::open_level()` or the more targeted approach:

```rust
// Reading global config
fn read_global_config() -> Result<GitGlobalConfig, GitError> {
    let config = git2::Config::open_default()
        .map_err(|e| GitError::OperationFailed(e.message().to_string()))?;

    Ok(GitGlobalConfig {
        user_name: config.get_string("user.name").ok(),
        user_email: config.get_string("user.email").ok(),
        default_branch: config.get_string("init.defaultBranch").ok(),
    })
}

// Writing global config
fn write_global_config(key: &str, value: &str) -> Result<(), GitError> {
    let config = git2::Config::open_default()
        .map_err(|e| GitError::OperationFailed(e.message().to_string()))?;

    // Find and open the global-level config file specifically
    let mut global = config
        .open_level(git2::ConfigLevel::Global)
        .map_err(|e| GitError::OperationFailed(
            format!("No global git config found: {}", e.message())
        ))?;

    global.set_str(key, value)
        .map_err(|e| GitError::OperationFailed(e.message().to_string()))?;

    Ok(())
}
```

**Commands needed:**
1. `get_git_global_config()` -- reads user.name, user.email, init.defaultBranch
2. `set_git_global_config(key, value)` -- writes a single config value to global config

**Note:** The existing `commit.rs:136` already reads config via `repo.signature()`, which uses the cascaded config. The gitflow `init.rs:120` uses `repo.config()` for local config writes. Our new commands need `Config::open_default()` for **global** config -- no open repo required.

### Tauri Command Registration

From `src-tauri/src/lib.rs:50-130`:

```rust
let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
    greet,
    // Repository commands
    open_repository,
    // ... 40+ commands organized by category comments
]);
```

**To add new commands:**
1. Create new module (e.g., `src-tauri/src/git/init.rs` and `src-tauri/src/git/config.rs`)
2. Add `pub mod init;` and `pub mod config;` to `src-tauri/src/git/mod.rs`
3. Import in `lib.rs` and add to `collect_commands![]`
4. TypeScript bindings auto-generated on `cargo build` (debug mode)

## TypeScript Bindings

### Pattern Analysis

From `src/bindings.ts` (auto-generated by tauri-specta):

**Command wrapper pattern** (lines 7-64):
```typescript
export const commands = {
  async openRepository(path: string): Promise<Result<RepoStatus, GitError>> {
    try {
      return { status: "ok", data: await TAURI_INVOKE("open_repository", { path }) };
    } catch (e) {
      if (e instanceof Error) throw e;
      else return { status: "error", error: e as any };
    }
  },
  // ... every Rust command becomes a method here
}
```

**Key observations:**
- Every Rust `Result<T, E>` becomes `Promise<Result<T, E>>` on TS side
- The `Result<T, E>` type is `{ status: "ok"; data: T } | { status: "error"; error: E }`
- Rust `snake_case` commands become `camelCase` in TS
- Rust struct fields with `#[serde(rename_all = "camelCase")]` are already camelCase in TS
- All types are exported at the module level
- The file imports from `@tauri-apps/api/core` (invoke, Channel)

**Consumption pattern** (seen in `src/stores/repository.ts:27-33`):
```typescript
const result = await commands.openRepository(path);
if (result.status === "ok") {
  set({ status: result.data });
} else {
  const errorMsg = getErrorMessage(result.error);
}
```

**What will be auto-generated for our new commands:**
- `commands.gitInit(path, defaultBranch)` -> `Promise<Result<InitResult, GitError>>`
- `commands.getGitGlobalConfig()` -> `Promise<Result<GitGlobalConfig, GitError>>`
- `commands.setGitGlobalConfig(key, value)` -> `Promise<Result<null, GitError>>`

## Settings Components Deep Dive

### SettingsWindow.tsx

**File:** `src/components/settings/SettingsWindow.tsx` (69 lines)

**Structure:**
- Hardcoded `categories` array with `{id, label, icon}` objects (lines 8-24)
- Uses `Dialog`/`DialogContent` from local UI primitives
- Sidebar nav (180px fixed) + content area pattern
- `renderContent()` switch statement maps category -> component (lines 30-39)

**Extensibility issues:**
1. **Hardcoded categories array** -- adding "Integrations" requires modifying SettingsWindow.tsx directly
2. **Hardcoded switch statement** -- maps category id to component, must be updated in lockstep
3. **Type coupling** -- `SettingsCategory` union type in store must match categories array

**Extension points for Phase 19:**
- Add `"integrations"` to `SettingsCategory` union type
- Add entry to `categories` array
- Add `case "integrations":` to switch statement
- Import and render `IntegrationsSettings` component

### GitSettings.tsx

**File:** `src/components/settings/GitSettings.tsx` (76 lines)

**Current fields:**
1. `defaultRemote` -- text input (line 17-25)
2. `autoFetchInterval` -- checkbox toggle + number input (lines 29-69)

**Pattern observations:**
- Reads from `useSettingsStore()` -> `settings.git.*`
- Writes via `updateSetting("git", "key", value)` with string literal category
- All inputs use raw `<input>` elements with long Tailwind class strings (not the `Input` component from ui/)
- No form validation, no debouncing -- immediate onChange -> store update -> persist

**What needs to be added:**
- `user.name` field (text input, writes to git global config, NOT the Tauri store)
- `user.email` field (text input, writes to git global config)
- `init.defaultBranch` field (text input, writes to git global config)
- These are fundamentally different from the existing fields: they write to **git config**, not the Tauri persistent store

**Design decision:** Git identity fields should use the new Rust commands (`get_git_global_config` / `set_git_global_config`), not the Zustand settings store. They should be loaded on component mount and saved on blur/debounce.

### AppearanceSettings.tsx

**File:** `src/components/settings/AppearanceSettings.tsx` (46 lines)

- Uses its own store (`useThemeStore`) -- not the settings store
- Button group pattern for theme selection (light/dark/system)
- Clean, declarative `themeOptions` array pattern

### GeneralSettings.tsx

**File:** `src/components/settings/GeneralSettings.tsx` (46 lines)

- Uses `useSettingsStore` for `defaultTab` setting
- Button group pattern similar to AppearanceSettings

### Settings Store

**File:** `src/stores/settings.ts` (93 lines)

**Schema:**
```typescript
interface Settings {
  general: { defaultTab: "changes" | "history" | "topology" }
  git: { defaultRemote: string; autoFetchInterval: number | null }
}
```

**State shape:**
```typescript
interface SettingsState {
  isOpen: boolean;
  activeCategory: SettingsCategory;
  settings: Settings;
  // Actions
  openSettings, closeSettings, setCategory, updateSetting, initSettings
}
```

**Persistence mechanism:**
- Uses `@tauri-apps/plugin-store` via `src/lib/store.ts`
- Stores as JSON in `flowforge-settings.json` (Tauri app data directory)
- `initSettings()` loads and merges with defaults on app start
- `updateSetting()` immediately writes to store on every change

**Type-safe update pattern** (`settings.ts:28-32`):
```typescript
updateSetting: <C extends keyof Settings>(
  category: C,
  key: keyof Settings[C],
  value: Settings[C][keyof Settings[C]]
) => Promise<void>;
```
This is well-typed: category constrains key, which constrains value.

**Extension for Phase 19:**
- Add `integrations` category to `Settings` interface
- Add `"integrations"` to `SettingsCategory` union
- Update `defaultSettings` with integrations defaults
- Update `initSettings` merge logic to include integrations

## Platform Detection

### Current Approach

The app uses `navigator.platform` for platform detection -- a simple but deprecated browser API:

**Locations found:**
1. `src/components/WelcomeView.tsx:183` -- keyboard shortcut label:
   ```typescript
   {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+O
   ```
2. `src/components/clone/CloneForm.tsx:32` -- Windows path detection:
   ```typescript
   function isWindows(): boolean {
     return navigator.platform.toLowerCase().includes("win");
   }
   ```
3. `src/hooks/useKeyboardShortcuts.ts:235`:
   ```typescript
   const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
   ```
4. `src/components/ui/ShortcutTooltip.tsx:14` -- same isMac pattern
5. `src/components/command-palette/CommandPaletteItem.tsx:14` -- same isMac pattern

### Recommendations

1. **Extract platform detection to a shared utility:**
```typescript
// src/lib/platform.ts
export type Platform = "macos" | "windows" | "linux";

export function getPlatform(): Platform {
  const p = navigator.platform.toLowerCase();
  if (p.includes("mac")) return "macos";
  if (p.includes("win")) return "windows";
  return "linux";
}

export const isMac = getPlatform() === "macos";
export const isWindows = getPlatform() === "windows";
export const isLinux = getPlatform() === "linux";
```

2. **For Integrations settings (editor/terminal dropdown):**
The platform utility determines which editor/terminal options to show:
- macOS: VS Code, Sublime, TextMate, BBEdit, Terminal, iTerm2, Warp, Alacritty
- Windows: VS Code, Notepad++, Sublime, cmd, PowerShell, Windows Terminal
- Linux: VS Code, Sublime, Vim, Neovim, GNOME Terminal, Konsole, Alacritty

3. **Tauri also offers `@tauri-apps/api/os`** (or now `@tauri-apps/plugin-os`) but the current codebase does not use it. The `navigator.platform` approach is simpler and sufficient since Tauri runs in a real webview.

## File Icon System

### Current Implementation

**File:** `src/lib/file-icons.ts` (208 lines)

**Architecture:**
1. **37 SVG icons** imported as React components via `?react` suffix (Vite SVGR plugin)
2. **Two lookup maps:**
   - `FILE_ICON_MAP: Record<string, IconComponent>` -- extension-based (44 entries, lines 45-144)
   - `FILENAME_ICON_MAP: Record<string, IconComponent>` -- exact filename match (30 entries, lines 147-178)
3. **Lookup function** `getFileIcon(filePath: string): IconComponent`:
   - Extracts filename from path
   - Checks `FILENAME_ICON_MAP` first (case-insensitive loop)
   - Falls back to extension lookup in `FILE_ICON_MAP`
   - Default: `FileIcon` (generic file)
4. **Folder function** `getFolderIcon(isOpen: boolean): IconComponent`

**Type:** `type IconComponent = ComponentType<SVGProps<SVGSVGElement>>`

**Consumer:** `src/components/icons/FileTypeIcon.tsx` (27 lines)
- Props: `{ path, isDirectory?, isOpen?, className? }`
- Calls `getFileIcon(path)` or `getFolderIcon(isOpen)`
- Renders `<Icon className={cn("w-4 h-4 shrink-0", className)} aria-hidden="true" />`

### Gaps Identified

The following file types are missing and should be added for Phase 19:

**Image files** (need new image.svg icon):
- `png`, `jpg`, `jpeg`, `gif`, `webp`, `bmp`, `ico`, `tiff`, `avif`

**Font files** (need new font.svg icon):
- `ttf`, `otf`, `woff`, `woff2`, `eot`

**Archive files** (need new archive.svg icon):
- `zip`, `tar`, `gz`, `bz2`, `7z`, `rar`, `xz`

**Environment/Config files** (need new env.svg icon or reuse existing):
- `.env` currently maps to `FileIcon` (generic) -- should have dedicated icon
- `.env.local`, `.env.production`, `.env.development` (filename matches)

**Additional config files** for FILENAME_ICON_MAP:
- `.prettierrc.json`, `.prettierrc.yaml`, `.prettierrc.toml`
- `tailwind.config.js`, `tailwind.config.ts`
- `next.config.js`, `next.config.mjs`
- `webpack.config.js`
- `.editorconfig`
- `Makefile`, `CMakeLists.txt`
- `Gemfile`, `Rakefile`
- `requirements.txt`, `setup.py`, `pyproject.toml`
- `.dockerignore`

### Extension Plan

**New SVG icons needed (4 files):**
1. `image.svg` -- for image file types
2. `font.svg` -- for font file types
3. `archive.svg` -- for archive file types
4. `env.svg` -- for environment/dotenv files

**Code additions to `file-icons.ts`:**

```typescript
// New imports
import ArchiveIcon from "../assets/icons/file-types/archive.svg?react";
import EnvIcon from "../assets/icons/file-types/env.svg?react";
import FontIcon from "../assets/icons/file-types/font.svg?react";
import ImageIcon from "../assets/icons/file-types/image.svg?react";

// Add to FILE_ICON_MAP:
// Images
png: ImageIcon,
jpg: ImageIcon,
jpeg: ImageIcon,
gif: ImageIcon,
webp: ImageIcon,
bmp: ImageIcon,
ico: ImageIcon,
tiff: ImageIcon,
avif: ImageIcon,

// Fonts
ttf: FontIcon,
otf: FontIcon,
woff: FontIcon,
woff2: FontIcon,
eot: FontIcon,

// Archives
zip: ArchiveIcon,
tar: ArchiveIcon,
gz: ArchiveIcon,
"7z": ArchiveIcon, // Note: needs special handling as "7z" is not a valid identifier

// Environment
env: EnvIcon, // Override current FileIcon mapping

// Add to FILENAME_ICON_MAP:
".env": EnvIcon,
".env.local": EnvIcon,
".env.development": EnvIcon,
".env.production": EnvIcon,
".env.test": EnvIcon,
".dockerignore": DockerIcon,
".editorconfig": JsonIcon, // reuse
"tailwind.config.js": JavaScriptIcon,
"tailwind.config.ts": TypeScriptIcon,
"next.config.js": JavaScriptIcon,
"next.config.mjs": JavaScriptIcon,
"webpack.config.js": JavaScriptIcon,
"Makefile": BashIcon,
"Gemfile": RubyIcon,
"Rakefile": RubyIcon,
"requirements.txt": PythonIcon,
"setup.py": PythonIcon,
"pyproject.toml": PythonIcon,
```

**Catppuccin color verification:**
- SVG icons in `src/assets/icons/file-types/` should use `currentColor` for fill/stroke to inherit text color from Tailwind
- The `FileTypeIcon` component sets `className` which can include Catppuccin color tokens
- Current icons appear to use inline colors specific to each language brand -- this is intentional for recognition

## WelcomeView & Git Init Flow

### Current Flow

**File:** `src/components/WelcomeView.tsx` (215 lines)

**Current user journey:**
1. App shows WelcomeView when `status === null` (no repo open) -- `App.tsx:72`
2. User can:
   a. Click "Open Repository" -> native folder picker -> `openRepository(path)` -> success opens repo
   b. Click "Clone Repository" -> inline CloneForm
   c. Drag-drop a folder -> validates with `commands.isGitRepository(path)` -> opens if valid
   d. Click a recent repo from `<RecentRepos />`
3. Error handling: shows red banner if open fails (lines 191-206)

**Git repo validation happens at:**
- `openRepository` in Zustand store -> calls `commands.openRepository(path)` which validates in Rust (`repository.rs:50`)
- Drag-drop: explicit `commands.isGitRepository(path)` check before opening

**What currently happens if you open a non-git folder:**
- The Rust `open_repository` command returns `GitError::NotARepository`
- The error is displayed in the red banner via `getErrorMessage()`

### Modification Points for Git Init

**Goal:** When the user selects a folder that is NOT a git repo, show an inline banner offering to initialize it.

**Implementation approach:**

1. **After folder selection fails with "not a repo" error**, instead of showing just the error, detect the error type and show a specific "Initialize Repository" banner.

2. **New state in WelcomeView:**
```typescript
const [pendingInitPath, setPendingInitPath] = useState<string | null>(null);
```

3. **Modified openDialog flow:**
```typescript
const openDialog = useCallback(async () => {
  const selected = await open({ directory: true, ... });
  if (!selected) return;

  // Check if it's a git repo first
  const isRepo = await commands.isGitRepository(selected);
  if (isRepo.status === "ok" && isRepo.data) {
    await openRepository(selected);
    await addRecentRepo(selected);
  } else {
    // Not a repo -- offer to initialize
    setPendingInitPath(selected);
  }
}, [...]);
```

4. **New GitInitBanner component** (inline in WelcomeView or extracted):
```tsx
function GitInitBanner({ path, onInit, onCancel }) {
  const [useMainBranch, setUseMainBranch] = useState(true);

  const handleInit = async () => {
    const result = await commands.gitInit(
      path,
      useMainBranch ? "main" : null
    );
    if (result.status === "ok") {
      await openRepository(path);
      await addRecentRepo(path);
      onInit();
    }
  };

  return (
    <motion.div className="...warning banner styles...">
      <Info icon />
      <div>
        <p>"{folderName}" is not a Git repository.</p>
        <label>
          <input type="checkbox" checked={useMainBranch} onChange... />
          Set default branch to "main"
        </label>
      </div>
      <Button onClick={handleInit}>Initialize Repository</Button>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
    </motion.div>
  );
}
```

5. **Drag-drop modification** -- same pattern: if `isGitRepository` returns false, set `pendingInitPath` instead of showing error.

## Concrete Refactoring Proposals

### 1. Settings Tab Registry

**Current:** Hardcoded array + switch statement in `SettingsWindow.tsx`

**Proposed: Declarative tab registry pattern**

```typescript
// src/components/settings/registry.ts
import type { LucideIcon } from "lucide-react";

export interface SettingsTab {
  id: string;
  label: string;
  icon: LucideIcon;        // Pass component ref, not JSX
  component: React.LazyExoticComponent<React.ComponentType> | React.ComponentType;
  order: number;            // Controls display order
}

const tabRegistry: SettingsTab[] = [];

export function registerSettingsTab(tab: SettingsTab) {
  tabRegistry.push(tab);
  tabRegistry.sort((a, b) => a.order - b.order);
}

export function getSettingsTabs(): SettingsTab[] {
  return tabRegistry;
}
```

**Registration in each settings module:**
```typescript
// src/components/settings/GitSettings.tsx
import { registerSettingsTab } from "./registry";
registerSettingsTab({
  id: "git",
  label: "Git",
  icon: GitBranch,
  component: GitSettings,
  order: 20,
});
```

**Updated SettingsWindow.tsx:**
```tsx
const tabs = getSettingsTabs();

// No switch statement needed:
const ActiveComponent = tabs.find(t => t.id === activeCategory)?.component;
return ActiveComponent ? <ActiveComponent /> : null;
```

**Trade-off analysis:**
- For 4-5 tabs, this is over-engineering. The simpler approach is to just add the new tab inline.
- **Recommendation:** Keep it simple for Phase 19. Add "Integrations" directly. Refactor to registry only if tab count exceeds 6+.

### 2. Settings Store Schema

**Current:** Flat two-category schema.

**Proposed extension (minimal, additive):**

```typescript
export type SettingsCategory = "general" | "git" | "appearance" | "integrations";

export interface IntegrationsSettings {
  editor: string | null;        // e.g., "code", "sublime", or custom path
  terminal: string | null;      // e.g., "iterm2", "warp", or custom path
  diffTool: string | null;      // Future: external diff tool
}

export interface Settings {
  general: GeneralSettings;
  git: GitSettings;
  integrations: IntegrationsSettings;
}

const defaultSettings: Settings = {
  general: { defaultTab: "changes" },
  git: { defaultRemote: "origin", autoFetchInterval: null },
  integrations: { editor: null, terminal: null, diffTool: null },
};
```

**Critical: `initSettings` merge must include new category:**
```typescript
initSettings: async () => {
  const store = await getStore();
  const saved = await store.get<Settings>("settings");
  if (saved) {
    const merged: Settings = {
      general: { ...defaultSettings.general, ...saved.general },
      git: { ...defaultSettings.git, ...saved.git },
      integrations: { ...defaultSettings.integrations, ...saved.integrations },
    };
    set({ settings: merged });
  }
}
```

**Improvement: Generic merge helper** to avoid repeating for each new category:
```typescript
function mergeSettings(defaults: Settings, saved: Partial<Settings>): Settings {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof Settings)[]) {
    if (saved[key]) {
      result[key] = { ...defaults[key], ...saved[key] } as any;
    }
  }
  return result;
}
```

### 3. File Icon Configuration

**Current:** Procedural `getFileIcon()` function with two static Record objects.

**Proposed: No structural change needed.**

The current system is already effectively a "configurable map" pattern. The maps are plain objects that are easy to extend. The `getFileIcon()` function is a clean two-tier lookup (filename first, then extension).

**What to improve:**
1. Add missing file type entries (as detailed in File Icon System section above)
2. Create 4 new SVG icon files
3. No architectural change needed -- the system scales well

**Optional future enhancement** (NOT for Phase 19):
```typescript
// Allow runtime icon registration for plugins
export function registerFileIcon(extension: string, icon: IconComponent) {
  FILE_ICON_MAP[extension] = icon;
}
```

### 4. Reusable Form Components

**Current problem:** Settings components use raw `<input>` elements with long repeated Tailwind class strings, while `src/components/ui/input.tsx` already provides a styled `Input` component.

**Proposed: Extract reusable settings form primitives**

```tsx
// src/components/settings/SettingsField.tsx
interface SettingsFieldProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsField({ label, description, children }: SettingsFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
        {label}
      </label>
      {description && (
        <p className="text-xs text-ctp-overlay0 mb-2">{description}</p>
      )}
      {children}
    </div>
  );
}
```

```tsx
// src/components/settings/SettingsSelect.tsx
interface SettingsSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allowCustom?: boolean;       // For editor/terminal free-text fallback
  placeholder?: string;
}

export function SettingsSelect({
  label, value, onChange, options, allowCustom, placeholder
}: SettingsSelectProps) {
  const [isCustom, setIsCustom] = useState(
    value !== "" && !options.some(o => o.value === value)
  );

  return (
    <SettingsField label={label}>
      {isCustom ? (
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="max-w-xs"
          />
          <Button variant="ghost" size="sm" onClick={() => setIsCustom(false)}>
            Use preset
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={value}
            onChange={e => {
              if (e.target.value === "__custom__") {
                setIsCustom(true);
                onChange("");
              } else {
                onChange(e.target.value);
              }
            }}
            className="max-w-xs px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-md text-sm text-ctp-text"
          >
            <option value="">None</option>
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
            {allowCustom && (
              <option value="__custom__">Custom path...</option>
            )}
          </select>
        </div>
      )}
    </SettingsField>
  );
}
```

**Existing `Input` component** (`src/components/ui/input.tsx`) already has CVA variants -- should be reused in settings forms instead of raw `<input>` elements.

### 5. Git Config vs App Settings Separation

**Architectural decision:** Git global config (user.name, user.email, init.defaultBranch) and app settings (defaultRemote, autoFetchInterval, editor, terminal) are fundamentally different:

| Aspect | Git Config | App Settings |
|--------|-----------|--------------|
| Storage | `~/.gitconfig` | Tauri store JSON |
| Scope | Affects all git tools | FlowForge-only |
| Read/Write | Rust commands via git2 | Direct Tauri store |
| Persistence | OS file system | App data dir |

**Recommendation:** Keep them in the same GitSettings UI tab but use different save mechanisms:
- Git config fields: call Rust commands on blur/debounce
- App settings fields: use existing `updateSetting()` for immediate persist

## Tailwind v4 & Styling

### Current Theme Setup

**File:** `src/index.css` (90 lines)

```css
@import "tailwindcss";
@import "@catppuccin/tailwindcss/mocha.css";

@theme {
    --font-sans: "Geist Variable", system-ui, ...;
    --font-mono: "JetBrains Mono Variable", ...;
    --animate-dirty-pulse: dirty-pulse 2s ease-in-out infinite;
}
```

**Available Catppuccin tokens** (from `@catppuccin/tailwindcss`):
- Base colors: `ctp-base`, `ctp-mantle`, `ctp-crust`
- Surface colors: `ctp-surface0`, `ctp-surface1`, `ctp-surface2`
- Text colors: `ctp-text`, `ctp-subtext0`, `ctp-subtext1`
- Overlay colors: `ctp-overlay0`, `ctp-overlay1`, `ctp-overlay2`
- Accent colors: `ctp-blue`, `ctp-green`, `ctp-red`, `ctp-yellow`, `ctp-peach`, `ctp-mauve`, etc.

### New Tokens Needed

**No new `@theme` tokens are needed for Phase 19.** The existing Catppuccin palette covers all needed UI states:

| UI Element | Token |
|-----------|-------|
| Init banner background | `bg-ctp-yellow/10` (warning tone) |
| Init banner border | `border-ctp-yellow/30` |
| Init banner icon | `text-ctp-yellow` |
| Success after init | `bg-ctp-green/10`, `text-ctp-green` |
| Form labels | `text-ctp-subtext1` (already used) |
| Form inputs | `bg-ctp-surface0 border-ctp-surface1` (already used) |
| Select dropdowns | Same as inputs |
| Settings sidebar active | `bg-ctp-blue text-ctp-base` (already used) |

### Form Styling Consistency

The settings forms should use the existing `Input` component from `src/components/ui/input.tsx` which already has correct Catppuccin styling:
```css
bg-ctp-surface0 border-ctp-surface1 text-ctp-text placeholder:text-ctp-overlay0
focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue
```

For the new `<select>` elements (editor/terminal dropdowns), match this same styling pattern. No custom select component exists yet -- create one or use a styled native `<select>`.

## Implementation Order Recommendation

### Phase 19 Task Sequence

**Task 19-01: Rust Backend -- Git Init & Config Commands** (Backend-first, enables everything else)
1. Create `src-tauri/src/git/init.rs` with `git_init(path, default_branch)` command
2. Create `src-tauri/src/git/config.rs` with `get_git_global_config()` and `set_git_global_config(key, value)` commands
3. Register in `src-tauri/src/git/mod.rs` and `src-tauri/src/lib.rs`
4. Build to auto-generate TypeScript bindings
5. Test with Tauri dev server

**Task 19-02: Settings Store & Integrations Schema** (Foundation for UI)
1. Extend `SettingsCategory` union with `"integrations"`
2. Add `IntegrationsSettings` interface to settings store
3. Update `defaultSettings` and `initSettings` merge logic
4. Extract `src/lib/platform.ts` utility

**Task 19-03: Git Settings Expansion** (User-facing, high value)
1. Add `user.name`, `user.email`, `init.defaultBranch` fields to `GitSettings.tsx`
2. Load values from `commands.getGitGlobalConfig()` on mount
3. Save via `commands.setGitGlobalConfig()` on blur with debounce
4. Show loading/error states for git config operations

**Task 19-04: Integrations Settings Tab** (New tab)
1. Create `src/components/settings/IntegrationsSettings.tsx`
2. Add editor dropdown with platform-aware options + custom path fallback
3. Add terminal dropdown with platform-aware options + custom path fallback
4. Register tab in `SettingsWindow.tsx`
5. Wire to settings store persistence

**Task 19-05: Git Init Flow in WelcomeView** (Onboarding feature)
1. Modify `openDialog` to detect non-repo folders
2. Create `GitInitBanner` inline component
3. Wire to `commands.gitInit()` -> auto-open repo after init
4. Handle drag-drop case similarly
5. Add "Set default branch to main" checkbox (checked by default)

**Task 19-06: File Icon Expansion** (Visual polish)
1. Create 4 new SVG icons: `image.svg`, `font.svg`, `archive.svg`, `env.svg`
2. Add imports and entries to `FILE_ICON_MAP` and `FILENAME_ICON_MAP`
3. Verify Catppuccin color rendering across light/dark themes
4. No changes needed to `FileTypeIcon.tsx` consumer

### Dependency Graph

```
19-01 (Rust backend)
  |
  +---> 19-03 (Git settings UI -- needs config commands)
  |
  +---> 19-05 (Git init flow -- needs init command)

19-02 (Store schema)
  |
  +---> 19-04 (Integrations tab -- needs store schema)

19-06 (File icons -- independent, can run in parallel)
```

**Parallelizable:** Tasks 19-01 and 19-02 and 19-06 can proceed simultaneously. Tasks 19-03/19-04/19-05 depend on their respective prerequisites.

### Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `git2::Config::open_level(Global)` fails if no ~/.gitconfig exists | Create the file first or handle gracefully with "not configured" state |
| `navigator.platform` deprecated | Works fine in Tauri webview; can migrate to Tauri OS plugin later |
| SVG icons missing currentColor | Test both light/dark themes; use inline colors for brand recognition |
| Settings store migration (existing users) | The spread merge in `initSettings` already handles missing keys gracefully |
| Git init on Windows long paths | Path validation in Rust; use `PathBuf` consistently |
