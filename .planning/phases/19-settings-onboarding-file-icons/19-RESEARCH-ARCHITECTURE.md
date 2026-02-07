# Phase 19 Research: Technical Architecture

## Settings Store Architecture

### Current Structure

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/stores/settings.ts`

The settings store uses Zustand with a flat category-based schema:

```typescript
export type SettingsCategory = "general" | "git" | "appearance";

export interface GeneralSettings {
  defaultTab: "changes" | "history" | "topology";
}

export interface GitSettings {
  defaultRemote: string;
  autoFetchInterval: number | null;
}

export interface Settings {
  general: GeneralSettings;
  git: GitSettings;
}
```

Key observations:

1. **`appearance` is declared as a `SettingsCategory` but has NO corresponding interface in `Settings`**. The `AppearanceSettings` component uses a separate `useThemeStore` (at `/Users/phmatray/Repositories/github-phm/FlowForge/src/stores/theme.ts`) instead. This is an inconsistency -- `SettingsCategory` includes `"appearance"` for tab navigation, but `Settings` only has `general` and `git` keys.

2. **Persistence layer**: Settings persist to Tauri plugin-store via `getStore()` (at `/Users/phmatray/Repositories/github-phm/FlowForge/src/lib/store.ts`), which lazily initializes a `Store` backed by `flowforge-settings.json`. All settings are stored under a single `"settings"` key as a flat JSON blob.

3. **Auto-save pattern**: `updateSetting()` (lines 55-75) immediately writes to the Tauri store on every field change. The pattern is:
   - Read current state from Zustand
   - Deep-merge the changed field
   - Write entire `Settings` object to Tauri store
   - Call `store.save()` to flush to disk
   - Update Zustand state

4. **Initialization**: `initSettings()` (lines 77-92) loads from Tauri store at app boot, merging saved values over defaults. Called in `App.tsx` line 34 inside a `useEffect`.

5. **Type-safe update**: `updateSetting<C extends keyof Settings>(category, key, value)` uses generics to constrain updates to valid category/key pairs.

### Data Flow

```
User changes field
  -> onChange handler calls updateSetting(category, key, value)
    -> getStore() returns Tauri Store singleton
    -> store.set("settings", mergedSettings)
    -> store.save() flushes to disk (flowforge-settings.json)
    -> Zustand set() updates in-memory state
    -> React re-renders consuming components
```

### What Phase 19 Needs to Add

For Phase 19, the `Settings` interface must expand to include:

- `git.userName: string` -- maps to `git config --global user.name`
- `git.userEmail: string` -- maps to `git config --global user.email`
- `git.defaultBranch: string` -- maps to `git config --global init.defaultBranch`
- `integrations.preferredEditor: string`
- `integrations.preferredTerminal: string`

The `SettingsCategory` type must add `"integrations"`.

### Critical Architectural Note: Git Config vs App Settings

The git identity fields (`user.name`, `user.email`, `init.defaultBranch`) have a **dual persistence** requirement:

1. They must read/write to **global git config** (`~/.gitconfig` or `$XDG_CONFIG_HOME/git/config`)
2. The current settings store only persists to **Tauri plugin-store** (`flowforge-settings.json`)

This means new Tauri commands are needed to read/write global git config. The store should act as a cache/mirror, with the git config being the source of truth. Pattern:

```
initSettings() -> read git config via Tauri command -> populate store
updateSetting("git", "userName", value) -> write to git config via Tauri command -> update store
```

The integrations settings, however, are app-only and can use the existing Tauri plugin-store persistence.

---

## Tauri Command Patterns

### Command Organization

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src-tauri/src/lib.rs`

Commands are organized by domain into Rust modules under `src-tauri/src/git/`:

| Module | File | Commands |
|--------|------|----------|
| `commands` | `commands.rs` | `open_repository`, `close_repository`, `get_repository_status`, `is_git_repository` |
| `branch` | `branch.rs` | `list_branches`, `create_branch`, `checkout_branch`, `delete_branch`, etc. |
| `commit` | `commit.rs` | `create_commit`, `get_last_commit_message` |
| `clone` | `clone.rs` | `clone_repository` |
| `staging` | `staging.rs` | `stage_file`, `unstage_file`, `stage_all`, etc. |
| ... | ... | ... |

### Standard Command Pattern

Every command follows this exact pattern (from `commands.rs` lines 14-38):

```rust
#[tauri::command]
#[specta::specta]
pub async fn command_name(
    param: ParamType,
    state: State<'_, RepositoryState>,            // if repo needed
    watcher_state: State<'_, Mutex<WatcherState>>, // if watcher interaction needed
    app_handle: tauri::AppHandle,                  // if events needed
) -> Result<ReturnType, GitError> {
    // 1. Get repo path from state
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    // 2. Run blocking git2 operations in spawn_blocking
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        // ... git operations ...
        Ok(result)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

### Registration in lib.rs

Commands are registered in `lib.rs` lines 50-130 via `collect_commands![]` macro:

```rust
let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
    // Repository commands
    open_repository,
    // ... all commands listed here
]);
```

### TypeScript Bindings (Auto-generated)

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/bindings.ts`

Generated by `tauri-specta` at build time (debug mode, lib.rs lines 132-145). Rust types with `#[specta::specta]` automatically get TypeScript equivalents. The `Result<T, E>` pattern becomes `Promise<Result<T, GitError>>` on the TS side.

### What `git_init` Should Look Like

Based on established patterns, the new `git_init` command should:

1. Live in `src-tauri/src/git/commands.rs` (alongside `is_git_repository`)
2. NOT require `State<'_, RepositoryState>` since it operates on an un-opened path
3. Accept `path: String` and `default_branch: Option<String>`
4. Use `git2::Repository::init()`
5. Return `Result<String, GitError>` (the path, for frontend to then open)

```rust
#[tauri::command]
#[specta::specta]
pub async fn git_init(
    path: String,
    default_branch: Option<String>,
) -> Result<String, GitError> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(GitError::PathNotFound(path_buf.display().to_string()));
    }

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::init(&path_buf)?;

        if let Some(branch_name) = default_branch {
            // Set init.defaultBranch in local config
            let mut config = repo.config()?;
            config.set_str("init.defaultBranch", &branch_name)?;
            // For unborn HEAD, set the branch ref
            repo.set_head(&format!("refs/heads/{}", branch_name))?;
        }

        Ok(path_buf.display().to_string())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

Additionally, new commands for git config read/write:

```rust
#[tauri::command]
#[specta::specta]
pub async fn get_git_global_config(key: String) -> Result<Option<String>, GitError> {
    tokio::task::spawn_blocking(move || {
        let config = git2::Config::open_default()?;
        match config.get_string(&key) {
            Ok(value) => Ok(Some(value)),
            Err(e) if e.code() == git2::ErrorCode::NotFound => Ok(None),
            Err(e) => Err(GitError::from(e)),
        }
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

#[tauri::command]
#[specta::specta]
pub async fn set_git_global_config(key: String, value: String) -> Result<(), GitError> {
    tokio::task::spawn_blocking(move || {
        let mut config = git2::Config::open_default()?;
        config.set_str(&key, &value)?;
        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

---

## Settings Tab System

### Current Architecture

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/settings/SettingsWindow.tsx`

The tab system is **hardcoded** with two coupled mechanisms:

1. **Tab definitions** (lines 8-24): A static array of category objects:
   ```typescript
   const categories: {
     id: SettingsCategory;
     label: string;
     icon: React.ReactNode;
   }[] = [
     { id: "general", label: "General", icon: <Settings .../> },
     { id: "git", label: "Git", icon: <GitBranch .../> },
     { id: "appearance", label: "Appearance", icon: <Palette .../> },
   ];
   ```

2. **Content routing** (lines 30-39): A switch statement mapping category to component:
   ```typescript
   const renderContent = () => {
     switch (activeCategory) {
       case "general": return <GeneralSettings />;
       case "git": return <GitSettings />;
       case "appearance": return <AppearanceSettings />;
     }
   };
   ```

### Adding a New Tab Requires

1. Add to `SettingsCategory` union type in `stores/settings.ts`
2. Add entry to `categories` array in `SettingsWindow.tsx`
3. Add case to `switch` in `renderContent`
4. Create the new component file
5. Import it in `SettingsWindow.tsx`

This is five touch-points for a single tab addition, which is fragile.

### Existing Settings Components

| Component | File | Store Used |
|-----------|------|------------|
| `GeneralSettings` | `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/settings/GeneralSettings.tsx` | `useSettingsStore` |
| `GitSettings` | `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/settings/GitSettings.tsx` | `useSettingsStore` |
| `AppearanceSettings` | `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/settings/AppearanceSettings.tsx` | `useThemeStore` (NOT settings store) |

### Extensibility Analysis

The current system is simple and works for 3-4 tabs. For Phase 19, we add one more tab ("Integrations"), bringing it to 4. This is still manageable without a registry refactor. However, a declarative approach would reduce touch-points.

**Recommendation**: For Phase 19, use a lightweight declarative pattern without over-engineering:

```typescript
// settings-tabs.ts
import { type LucideIcon, Settings, GitBranch, Palette, Wrench } from "lucide-react";
import { lazy } from "react";

export interface SettingsTab {
  id: SettingsCategory;
  label: string;
  icon: LucideIcon;
  component: React.LazyExoticComponent<React.ComponentType>;
}

export const settingsTabs: SettingsTab[] = [
  { id: "general", label: "General", icon: Settings, component: lazy(() => import("./GeneralSettings")) },
  { id: "git", label: "Git", icon: GitBranch, component: lazy(() => import("./GitSettings")) },
  { id: "integrations", label: "Integrations", icon: Wrench, component: lazy(() => import("./IntegrationsSettings")) },
  { id: "appearance", label: "Appearance", icon: Palette, component: lazy(() => import("./AppearanceSettings")) },
];
```

This eliminates the switch statement entirely and makes adding a tab a single-file change.

---

## Welcome/Open Flow

### Current Flow Architecture

```
App.tsx
  -> {status ? <RepositoryView /> : <WelcomeView />}
```

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/App.tsx` (line 72)

The routing is binary: if `useRepositoryStore().status` is non-null, show `RepositoryView`; otherwise, show `WelcomeView`.

### State Management for the Open Flow

```
useRepositoryStore (Zustand)
  status: RepoStatus | null    // null = no repo open
  isLoading: boolean
  error: string | null
  openRepository(path) -> commands.openRepository(path) -> Rust backend
```

### What Happens When User Opens a Folder

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/WelcomeView.tsx`

1. User clicks "Open Repository" -> `openDialog()` (line 21)
2. Tauri native file dialog opens (`@tauri-apps/plugin-dialog`)
3. Path selected -> `openRepository(selected)` (line 31)
4. `openRepository` in repository store (line 24-42):
   - Sets `isLoading: true, error: null`
   - Calls `commands.openRepository(path)` (Tauri IPC)
   - On success: sets `status: result.data`
   - On error: sets `error: errorMsg, status: null`
5. Rust backend (`commands.rs:open_repository`, lines 16-38):
   - Validates path exists
   - Opens via `git2::Repository::open()` -- **THIS FAILS if not a git repo**
   - Returns `Err(GitError::NotARepository(...))` for non-git folders

### Where `git init` Prompt Fits

Currently, when a user opens a non-git folder, the flow results in an error displayed in the `WelcomeView` error banner (lines 191-206). The error comes from `RepositoryState::open()` in Rust which calls `git2::Repository::open()` and returns `GitError::NotARepository`.

For Phase 19, the flow should be:

```
User opens folder
  -> openRepository(path) fails with NotARepository
    -> INSTEAD of generic error, show inline banner:
       "This folder is not a Git repository. Initialize it?"
       [Initialize] [Cancel]
    -> User clicks Initialize
      -> commands.gitInit(path, defaultBranch)
        -> Success: commands.openRepository(path)
          -> Status set, RepositoryView shown
```

**Key architectural decision**: The init prompt should be rendered **within WelcomeView**, not as a separate dialog. The `error` state from `useRepositoryStore` already provides the `NotARepository` error type. The frontend can detect this specific error type and render the init banner conditionally.

However, there is a nuance: the current `error` field is a `string`, not a typed error. The `getErrorMessage()` function (at `/Users/phmatray/Repositories/github-phm/FlowForge/src/lib/errors.ts`) converts `GitError` to a string, losing type information. We have two options:

1. **String matching**: Check if `error` contains "Not a Git repository" -- fragile
2. **Typed error state**: Store the raw `GitError` object alongside or instead of the string -- better

**Recommendation**: Add a `lastError: GitError | null` field to the repository store, preserving the typed error for conditional rendering. The `error: string` field can remain for display.

### The `selectedPath` Problem

When `openRepository` fails, we need to remember **which path** the user tried to open, so the init prompt can use it. Currently, the path is lost after the error. Options:

1. Store `lastAttemptedPath: string | null` in the repository store
2. Handle the init flow entirely within `WelcomeView` using local state

Option 2 is simpler and doesn't pollute the global store.

---

## File Icon Resolution System

### Architecture

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/lib/file-icons.ts`

The system has three layers:

1. **SVG icon imports** (lines 1-40): 37 SVG files imported as React components via `?react` SVGR suffix
2. **Extension map** (`FILE_ICON_MAP`, lines 45-144): `Record<string, IconComponent>` mapping ~55 file extensions to icon components
3. **Filename map** (`FILENAME_ICON_MAP`, lines 147-178): `Record<string, IconComponent>` mapping ~25 exact filenames (case-insensitive) to icons

### Resolution Algorithm (`getFileIcon`, lines 180-201)

```
1. Extract filename from path
2. Check FILENAME_ICON_MAP (exact match, case-insensitive) -> return if found
3. Extract extension from filename
4. Check FILE_ICON_MAP by extension -> return if found
5. Return default FileIcon
```

### FileTypeIcon Component

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/icons/FileTypeIcon.tsx`

A thin wrapper that delegates to `getFileIcon()` or `getFolderIcon()`:

```typescript
export function FileTypeIcon({ path, isDirectory, isOpen, className }: FileTypeIconProps) {
  const Icon = isDirectory ? getFolderIcon(isOpen) : getFileIcon(path);
  return <Icon className={cn("w-4 h-4 shrink-0", className)} aria-hidden="true" />;
}
```

### Current Coverage

37 SVG icon files exist at `/Users/phmatray/Repositories/github-phm/FlowForge/src/assets/icons/file-types/`.

**Extensions covered**: ts, tsx, js, jsx, mjs, cjs, mts, cts, rs, py, pyw, pyi, go, java, jar, cs, csx, cpp, cxx, cc, c, h, hpp, rb, rake, php, swift, kt, kts, lua, sh, bash, zsh, fish, ps1, html, htm, css, scss, sass, less, vue, svelte, astro, json, jsonc, json5, yaml, yml, toml, xml, svg, md, mdx, txt, text, csv, tsv, sql, lock, env

**Notable gaps** (for Phase 19 expansion):
- Image files: png, jpg, jpeg, gif, webp, ico, bmp, tiff, svg (already mapped but as XML, not image)
- Font files: ttf, otf, woff, woff2, eot
- Archive files: zip, tar, gz, 7z, rar, bz2
- Environment/config: .env already maps to generic `FileIcon` (should get a dedicated icon)
- Config files: `.editorconfig`, `.prettierrc.js`, `.browserslistrc`
- Binary: wasm, exe, dll, so, dylib

### Extensibility Analysis

The current pattern is highly extensible for **adding new types**:

1. Add SVG file to `src/assets/icons/file-types/`
2. Import it in `file-icons.ts`
3. Add entries to `FILE_ICON_MAP` or `FILENAME_ICON_MAP`

No other files need modification. The architecture is clean and flat.

For **user-defined overrides** (future consideration), the system would need:
- A user settings section for custom extension-to-icon mappings
- A merge layer that sits between the default maps and the resolution function
- This is not needed for Phase 19 but the flat map structure makes it straightforward to add later

### Catppuccin Color Consistency

The SVG icons use inline colors. Any new icons must follow the Catppuccin palette. The existing icons use color tokens that map to the Catppuccin theme. Verify that new icons use the same `currentColor` or Catppuccin hex values used by existing ones.

---

## Cross-cutting Concerns

### Error Handling Patterns

**Rust side** (`/Users/phmatray/Repositories/github-phm/FlowForge/src-tauri/src/git/error.rs`):
- `GitError` enum with `#[serde(tag = "type", content = "message")]` tagged union serialization
- 27 error variants covering all git operations
- Implements `From<git2::Error>` for automatic conversion
- All Tauri commands return `Result<T, GitError>`

**TypeScript side** (`/Users/phmatray/Repositories/github-phm/FlowForge/src/lib/errors.ts`):
- `getErrorMessage(error: GitError | GitflowError): string` extracts human-readable messages
- Components display errors via conditional rendering (no global error boundary for git errors)

**Store-level pattern**: Each store catches errors and either:
1. Sets an `error: string` field (repository store)
2. Logs to `console.error` (settings, theme, navigation stores)
3. Shows a toast notification (keyboard shortcuts, header actions)

### Loading State Patterns

Three patterns are used across the codebase:

1. **Zustand `isLoading` flag**: Repository store, branch store, stash store, tag store
2. **React Query `isPending`**: Used in `useKeyboardShortcuts` for mutation loading states
3. **Local `useState`**: Used in `Header.tsx` for `isRefreshing`

### Platform Detection

**File**: `/Users/phmatray/Repositories/github-phm/FlowForge/src/hooks/useKeyboardShortcuts.ts` (line 235)

```typescript
export function formatShortcut(shortcut: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  // ...
}
```

Also used inline in `WelcomeView.tsx` (line 182):
```typescript
{navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}
```

There is **no centralized platform detection utility**. For Phase 19, which needs platform-aware dropdown options for editors/terminals, a shared utility should be created:

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
```

### Auto-save Mechanism

The auto-save pattern is consistent across all stores that persist:

```typescript
// In settings store
updateSetting: async (category, key, value) => {
  const store = await getStore();
  const newSettings = { ...current, [category]: { ...current[category], [key]: value } };
  await store.set("settings", newSettings);
  await store.save();
  set({ settings: newSettings });
}

// In theme store
setTheme: async (theme) => {
  const store = await getStore();
  await store.set("theme", theme);
  await store.save();
  set({ theme, resolvedTheme: resolved });
}

// In navigation store
pinRepo: async (path) => {
  const store = await getStore();
  await store.set("nav-pinned-repos", updated);
  await store.save();
  set({ pinnedRepoPaths: updated });
}
```

The pattern is: **write-through cache** -- update Tauri store first, then update Zustand state. No debouncing, no batching. Every change triggers a disk write immediately.

For git config settings (user.name, user.email), the auto-save should invoke the Tauri command to write git config rather than writing to the Tauri plugin-store.

---

## Extensibility Refactoring Recommendations

### 1. Settings Registry Pattern (Low Priority for Phase 19)

**Current**: Hardcoded `SettingsCategory` union + switch statement
**Proposed**: Declarative tab array

```typescript
// src/components/settings/settingsTabs.ts
export interface SettingsTabDef {
  id: string;
  label: string;
  icon: LucideIcon;
  component: React.ComponentType;
  order: number;
}

export const settingsTabs: SettingsTabDef[] = [
  { id: "general", label: "General", icon: Settings, component: GeneralSettings, order: 0 },
  { id: "git", label: "Git", icon: GitBranch, component: GitSettings, order: 1 },
  { id: "integrations", label: "Integrations", icon: Wrench, component: IntegrationsSettings, order: 2 },
  { id: "appearance", label: "Appearance", icon: Palette, component: AppearanceSettings, order: 3 },
];
```

Then `SettingsWindow.tsx` becomes:

```typescript
const ActiveComponent = settingsTabs.find(t => t.id === activeCategory)?.component;
// ...
{ActiveComponent && <ActiveComponent />}
```

**Verdict**: Do this for Phase 19. It is a small, clean refactor that pays for itself immediately.

### 2. Settings Schema with Validation

**Current**: TypeScript interfaces only; no runtime validation
**Proposed**: Add Zod schemas for settings validation

```typescript
const settingsSchema = z.object({
  general: z.object({
    defaultTab: z.enum(["changes", "history", "topology"]),
  }),
  git: z.object({
    defaultRemote: z.string(),
    autoFetchInterval: z.number().nullable(),
    userName: z.string().optional(),
    userEmail: z.string().email().optional(),
    defaultBranch: z.string().optional(),
  }),
  integrations: z.object({
    preferredEditor: z.string().optional(),
    preferredTerminal: z.string().optional(),
  }),
});
```

**Verdict**: Nice-to-have, not needed for Phase 19. The TypeScript types provide sufficient safety.

### 3. Git Config Abstraction Layer

**Current**: No git config read/write commands exist on the Rust side
**Proposed**: Generic git config commands that work for both global and per-repo config

```rust
#[tauri::command]
#[specta::specta]
pub async fn get_git_config(
    key: String,
    scope: GitConfigScope,  // Global, Local, or System
    state: State<'_, RepositoryState>,
) -> Result<Option<String>, GitError> { ... }

#[tauri::command]
#[specta::specta]
pub async fn set_git_config(
    key: String,
    value: String,
    scope: GitConfigScope,
    state: State<'_, RepositoryState>,
) -> Result<(), GitError> { ... }
```

Where `GitConfigScope` is:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum GitConfigScope {
    Global,  // --global (~/.gitconfig)
    Local,   // --local (repo/.git/config) -- requires open repo
    System,  // --system (/etc/gitconfig)
}
```

**Verdict**: Do this for Phase 19. The `Global` scope is needed now, and `Local` scope prepares for future per-repo settings.

### 4. File Icon System User Overrides

**Current**: Static maps compiled into the app
**Proposed for future**: Settings-based override layer

```typescript
// Future: merge user overrides with defaults
export function getFileIcon(filePath: string, userOverrides?: Record<string, string>): IconComponent {
  // Check user overrides first
  // Then check FILENAME_ICON_MAP
  // Then check FILE_ICON_MAP
  // Then default
}
```

**Verdict**: NOT needed for Phase 19. The current flat map pattern is the right abstraction. Adding new types is trivial without a plugin system.

### 5. Platform Detection Utility

**Current**: Inline `navigator.platform` checks scattered across 5 files
**Proposed**: Centralized platform utility

```typescript
// src/lib/platform.ts
export type Platform = "macos" | "windows" | "linux";

let cachedPlatform: Platform | null = null;

export function getPlatform(): Platform {
  if (cachedPlatform) return cachedPlatform;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) cachedPlatform = "macos";
  else if (ua.includes("win")) cachedPlatform = "windows";
  else cachedPlatform = "linux";
  return cachedPlatform;
}

export const isMac = getPlatform() === "macos";
export const isWindows = getPlatform() === "windows";
export const isLinux = getPlatform() === "linux";
```

**Verdict**: Do this for Phase 19. Required for the platform-aware editor/terminal dropdown, and consolidates existing scattered checks.

### 6. Settings Persistence Split

The current store uses a single `"settings"` key for all app settings. Git config settings should NOT be stored in this key -- they belong in git's own config. The recommended split:

| Setting | Storage | Key |
|---------|---------|-----|
| `general.defaultTab` | Tauri plugin-store | `settings.general` |
| `git.defaultRemote` | Tauri plugin-store | `settings.git` |
| `git.autoFetchInterval` | Tauri plugin-store | `settings.git` |
| `git.userName` | Git global config | `user.name` |
| `git.userEmail` | Git global config | `user.email` |
| `git.defaultBranch` | Git global config | `init.defaultBranch` |
| `integrations.preferredEditor` | Tauri plugin-store | `settings.integrations` |
| `integrations.preferredTerminal` | Tauri plugin-store | `settings.integrations` |

**Verdict**: Essential for Phase 19. Git identity must persist to git config, not just the app store.

---

## Technical Risks & Mitigations

### Risk 1: Git Config Write Permissions

**Risk**: Writing to `~/.gitconfig` may fail if the user has restrictive file permissions or if the git config location is non-standard (XDG, WSL, etc.).

**Mitigation**:
- Use `git2::Config::open_default()` which respects git's own config resolution (XDG, system, global)
- Wrap in try/catch with user-friendly error messages
- Show a manual instructions fallback: "Run `git config --global user.name 'Your Name'` in terminal"

### Risk 2: Settings Migration

**Risk**: Existing settings stored under `"settings"` key won't have the new `integrations` category. On load, `initSettings()` merges with defaults, but the current merge logic (lines 82-87) is hardcoded:

```typescript
const merged: Settings = {
  general: { ...defaultSettings.general, ...saved.general },
  git: { ...defaultSettings.git, ...saved.git },
};
```

Adding `integrations` requires updating this merge logic.

**Mitigation**: Use a generic deep merge instead of per-category merge:

```typescript
const merged = Object.keys(defaultSettings).reduce((acc, key) => {
  const k = key as keyof Settings;
  acc[k] = { ...defaultSettings[k], ...(saved[k] || {}) } as any;
  return acc;
}, {} as Settings);
```

### Risk 3: Auto-save Debouncing for Text Fields

**Risk**: Git user.name and email are text inputs. The current auto-save pattern writes on every `onChange`, which means every keystroke triggers a Tauri IPC call and a git config write. For text fields, this is excessive.

**Mitigation**: Add debouncing for text input fields (300-500ms). Two approaches:
1. Component-level debounce using `useDeferredValue` or a custom `useDebounce` hook
2. Store-level debounce on `updateSetting` for string values

Recommend component-level debounce for simplicity.

### Risk 4: `git init` + Auto-Open Race Condition

**Risk**: After `git_init` succeeds, immediately calling `openRepository` could fail if the filesystem hasn't fully synced, or if the watcher starts before the repo is ready.

**Mitigation**: The `git_init` command should return only after `git2::Repository::init()` completes synchronously (it does, since it's in `spawn_blocking`). The `openRepository` call can proceed immediately. No race condition exists if sequenced properly.

### Risk 5: `NotARepository` Error Detection on Frontend

**Risk**: The repository store converts errors to strings, losing type information needed to detect `NotARepository` and show the init prompt.

**Mitigation**: Preserve the typed error in the store:

```typescript
interface RepositoryState {
  error: string | null;
  lastGitError: GitError | null;  // NEW: preserves typed error
  lastAttemptedPath: string | null; // NEW: path user tried to open
}
```

Then in `WelcomeView`:

```typescript
const { lastGitError, lastAttemptedPath } = useRepositoryStore();
const showInitPrompt = lastGitError?.type === "NotARepository" && lastAttemptedPath;
```

### Risk 6: bindings.ts Pre-existing Error (TS2440)

**Risk**: The auto-generated `bindings.ts` has a known pre-existing TypeScript error (TS2440 at line 1493). Adding new commands will regenerate this file and the error will persist.

**Mitigation**: Per project memory, this is a known issue. Ignore it. The lib.rs already contains a fixup for one specific tauri-specta bug (lines 139-144). The TS2440 error does not affect runtime behavior.

### Risk 7: SVG Icon Bundle Size

**Risk**: Adding more SVG icons (image, font, archive, env, config) increases the bundle. Currently 37 SVGs.

**Mitigation**: The `?react` SVGR import inlines SVGs as React components, which tree-shakes well. Adding 5-10 more icons is negligible (<5KB total). No concern for Phase 19 scope.
