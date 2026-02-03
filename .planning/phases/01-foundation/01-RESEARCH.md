# Phase 1: Foundation - Research

**Researched:** 2026-02-03
**Domain:** Tauri 2.x + git2-rs + React Foundation
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational architecture for FlowForge: a Tauri 2.x desktop application with type-safe IPC between a Rust backend (using git2-rs for Git operations) and a React 19 frontend. The phase delivers repository opening via file picker and drag-drop, recent repositories persistence, and basic status display (branch name + dirty/clean indicator).

The standard approach uses Tauri 2.x with official plugins (dialog, store, window-state), tauri-specta for type-safe TypeScript bindings, and git2-rs wrapped in `spawn_blocking` for non-blocking Git operations. The frontend uses Vite, React 19, Zustand for state management, and shadcn/ui + Tailwind CSS for styling.

**Primary recommendation:** Use the official Tauri plugin ecosystem extensively (dialog, store, window-state) rather than building custom solutions. Wrap ALL git2-rs calls in `tokio::task::spawn_blocking` from day one to avoid blocking the async runtime.

## Standard Stack

The established libraries/tools for this domain:

### Core - Rust Backend

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri` | 2.10.x | Application framework | Official, stable Tauri 2 release |
| `git2` | 0.20.x | Git operations (libgit2 bindings) | Battle-tested, 12+ years production use |
| `tokio` | 1.49.x | Async runtime | Tauri's default runtime |
| `tauri-specta` | 2.0.0-rc.21 | Type-safe IPC | Eliminates manual TS type sync |
| `specta` | 2.x | Type export foundation | Required for tauri-specta |
| `serde` | 1.0.x | Serialization | Standard for Rust serialization |
| `thiserror` | 2.0.x | Error derivation | Clean error handling across IPC |

### Core - Tauri Plugins

| Plugin | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| `tauri-plugin-dialog` | 2.x | File/folder picker dialogs | Official, handles OS differences |
| `tauri-plugin-store` | 2.x | Persistent key-value storage | Official, handles app data paths |
| `tauri-plugin-window-state` | 2.x | Window position/size persistence | Official, automatic save/restore |

### Core - React Frontend

| Package | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite` | 6.x | Build tool | Fast, Tauri-recommended |
| `react` | 19.x | UI framework | Current stable |
| `typescript` | 5.x | Type safety | Pairs with tauri-specta |
| `zustand` | 5.0.x | Global state | 3KB, no providers, persist middleware |
| `tailwindcss` | 4.x | Styling | Utility-first, small bundle |
| `shadcn/ui` | latest | Component primitives | Copy-paste, Radix-based, accessible |
| `lucide-react` | latest | Icons | Consistent, tree-shakeable |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tauri-specta | Manual types | More work, error-prone sync |
| tauri-plugin-store | Custom JSON file | Re-inventing persistence |
| Zustand | Redux | 10x larger, more boilerplate |
| shadcn/ui | MUI/Chakra | Heavy bundles, harder to customize |

**Installation (Rust):**
```toml
[dependencies]
tauri = { version = "2.10", features = ["specta"] }
tauri-specta = { version = "=2.0.0-rc.21", features = ["typescript"] }
specta = "=2.0.0-rc.20"
git2 = "0.20"
tokio = { version = "1.49", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1"
thiserror = "2.0"

tauri-plugin-dialog = "2"
tauri-plugin-store = "2"
tauri-plugin-window-state = "2"

[build-dependencies]
tauri-build = "2.10"
```

**Installation (Frontend):**
```bash
npm create tauri-app@latest flowforge -- --template react-ts
cd flowforge
npm install zustand @tanstack/react-query lucide-react
npm install @tauri-apps/plugin-dialog @tauri-apps/plugin-store @tauri-apps/plugin-window-state
npm install -D tailwindcss @tailwindcss/vite @types/node
npx shadcn@latest init
```

## Architecture Patterns

### Recommended Project Structure

```
flowforge/
├── src/                          # React frontend
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── layout/               # Header, Sidebar, etc.
│   │   └── repository/           # Repo-specific components
│   ├── stores/                   # Zustand stores
│   │   ├── app-store.ts          # UI state
│   │   └── repository-store.ts   # Repo state (synced from backend)
│   ├── lib/
│   │   └── commands.ts           # Re-export tauri-specta bindings
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Plugin registration
│   │   ├── commands/             # Tauri commands
│   │   │   ├── mod.rs
│   │   │   └── repository.rs     # Repo-related commands
│   │   ├── git/                  # Git service layer
│   │   │   ├── mod.rs
│   │   │   └── repository.rs     # git2 wrapper
│   │   ├── state.rs              # AppState definition
│   │   └── error.rs              # Custom error types
│   ├── capabilities/
│   │   └── default.json          # Permissions
│   └── tauri.conf.json
└── package.json
```

### Pattern 1: Type-Safe IPC with tauri-specta

**What:** Generate TypeScript types from Rust commands automatically
**When to use:** All Tauri commands (always)

```rust
// src-tauri/src/commands/repository.rs
use specta::Type;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::state::AppState;
use crate::error::AppError;

#[derive(Serialize, Type)]
pub struct RepositoryInfo {
    pub path: String,
    pub branch: Option<String>,
    pub is_dirty: bool,
}

#[tauri::command]
#[specta::specta]
pub async fn open_repository(
    path: String,
    state: State<'_, AppState>,
) -> Result<RepositoryInfo, AppError> {
    // Implementation
}
```

```rust
// src-tauri/src/main.rs
fn main() {
    let builder = tauri_specta::ts::builder()
        .commands(tauri_specta::collect_commands![
            commands::repository::open_repository,
            commands::repository::get_recent_repositories,
            commands::repository::get_repository_status,
        ]);

    #[cfg(debug_assertions)]
    let builder = builder.path("../src/bindings.ts");

    let invoke_handler = builder.build().unwrap();

    tauri::Builder::default()
        .invoke_handler(invoke_handler)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```typescript
// Frontend usage
import { commands } from './bindings';

const repoInfo = await commands.openRepository({ path: '/path/to/repo' });
// repoInfo is fully typed: { path: string, branch: string | null, is_dirty: boolean }
```

### Pattern 2: spawn_blocking for git2 Operations

**What:** Wrap synchronous git2 calls to avoid blocking async runtime
**When to use:** Every git2 operation (mandatory)

```rust
// src-tauri/src/git/repository.rs
use git2::Repository;
use std::path::Path;
use tokio::task::spawn_blocking;

pub async fn open_repository(path: &str) -> Result<RepositoryInfo, AppError> {
    let path = path.to_string();
    
    spawn_blocking(move || {
        let repo = Repository::open(&path)?;
        
        let branch = repo.head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()));
        
        let is_dirty = {
            let statuses = repo.statuses(None)?;
            statuses.iter().any(|e| e.status() != git2::Status::CURRENT)
        };
        
        Ok(RepositoryInfo {
            path,
            branch,
            is_dirty,
        })
    }).await?
}
```

### Pattern 3: State Management with Mutex

**What:** Share repository state safely across commands
**When to use:** When multiple commands need access to current repo

```rust
// src-tauri/src/state.rs
use std::sync::Mutex;
use git2::Repository;

pub struct AppState {
    pub current_repo: Mutex<Option<CurrentRepository>>,
}

pub struct CurrentRepository {
    pub path: String,
    // Don't store Repository directly - open fresh for each operation
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_repo: Mutex::new(None),
        }
    }
}
```

```rust
// In commands
#[tauri::command]
#[specta::specta]
pub async fn get_repository_status(
    state: State<'_, AppState>,
) -> Result<RepositoryInfo, AppError> {
    let repo_path = {
        let current = state.current_repo.lock().unwrap();
        current.as_ref().map(|r| r.path.clone())
    };
    
    match repo_path {
        Some(path) => git::repository::open_repository(&path).await,
        None => Err(AppError::NoRepositoryOpen),
    }
}
```

### Pattern 4: Error Handling Across IPC

**What:** Custom error type that serializes for frontend
**When to use:** All commands returning Result

```rust
// src-tauri/src/error.rs
use specta::Type;
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Not a Git repository: {0}")]
    NotARepository(String),
    
    #[error("No repository currently open")]
    NoRepositoryOpen,
    
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Task join error")]
    TaskJoin(#[from] tokio::task::JoinError),
}

// Required for IPC serialization
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

// Required for tauri-specta
impl Type for AppError {
    fn inline(type_map: &mut specta::TypeMap, generics: specta::Generics) -> specta::datatype::DataType {
        String::inline(type_map, generics)
    }
}
```

### Anti-Patterns to Avoid

- **Storing git2::Repository in State:** Repository objects can't be safely shared. Open fresh for each operation.
- **Calling git2 directly in async commands:** Always use `spawn_blocking`.
- **Manual TypeScript type definitions:** Use tauri-specta; manual types drift.
- **Using State<Mutex<Repository>>:** git2 Repository is not thread-safe. Store path only.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File picker dialog | Custom file browser | `tauri-plugin-dialog` | OS-native, handles permissions |
| Persist recent repos | Custom JSON read/write | `tauri-plugin-store` | Handles app data paths, auto-save |
| Window size memory | localStorage + IPC | `tauri-plugin-window-state` | Automatic, handles edge cases |
| TypeScript bindings | Manual interface defs | `tauri-specta` | Compile-time safety, auto-sync |
| Cross-platform paths | String manipulation | `std::path::PathBuf` | Handles separators, encoding |

**Key insight:** Tauri's plugin ecosystem handles cross-platform differences you'd spend weeks discovering. The "simple" solution of writing JSON to a file breaks on different OSes due to path conventions, permissions, and app data locations.

## Common Pitfalls

### Pitfall 1: Blocking the Async Runtime

**What goes wrong:** UI freezes during Git operations; file watcher events delayed; commands queue up
**Why it happens:** git2-rs is synchronous; calling it directly on Tokio's runtime blocks all tasks
**How to avoid:** Wrap ALL git2 calls in `tokio::task::spawn_blocking`
**Warning signs:** UI becomes unresponsive during `git status` on large repos

```rust
// WRONG - blocks runtime
#[tauri::command]
async fn get_status(path: String) -> Result<Status, Error> {
    let repo = Repository::open(&path)?; // Blocks!
    repo.statuses(None)?
}

// CORRECT - spawn blocking task
#[tauri::command]
async fn get_status(path: String) -> Result<Status, Error> {
    spawn_blocking(move || {
        let repo = Repository::open(&path)?;
        repo.statuses(None)
    }).await?
}
```

### Pitfall 2: git2 Thread Safety Violations

**What goes wrong:** Random panics, data corruption, segfaults
**Why it happens:** git2 Repository objects cannot be shared across threads
**How to avoid:** Never store Repository in shared state; open fresh per operation; use path strings
**Warning signs:** Intermittent crashes during concurrent operations

### Pitfall 3: IPC Serialization Overhead

**What goes wrong:** Status refresh takes >100ms; UI feels sluggish
**Why it happens:** Large status objects serialized as JSON across IPC boundary
**How to avoid:** Send summaries, not full data; paginate lists; keep bulk data in Rust
**Warning signs:** IPC calls with many files take disproportionately long

### Pitfall 4: Cross-Platform WebView Differences

**What goes wrong:** Works on macOS, broken on Windows; CSS renders differently
**Why it happens:** Different WebView implementations (WebView2 vs WKWebView vs WebKitGTK)
**How to avoid:** Test on all platforms from day one; use CI builds for all three
**Warning signs:** Visual bugs reported only on specific platforms

### Pitfall 5: Window State Flash on Startup

**What goes wrong:** Window appears at default size/position, then jumps to restored state
**Why it happens:** Window-state plugin restores after window creation
**How to avoid:** Set `visible: false` in tauri.conf.json; plugin shows window after restore
**Warning signs:** Brief flash of wrong-sized window on app launch

## Code Examples

Verified patterns from official sources:

### Opening a Repository and Getting Status

```rust
// Source: git2-rs examples/status.rs + Tauri patterns
use git2::{Repository, StatusOptions, ErrorCode};
use tokio::task::spawn_blocking;

pub async fn open_and_get_status(path: String) -> Result<RepositoryInfo, AppError> {
    spawn_blocking(move || {
        // Validate it's a git repo
        let repo = Repository::open(&path)
            .map_err(|e| {
                if e.code() == ErrorCode::NotFound {
                    AppError::NotARepository(path.clone())
                } else {
                    AppError::Git(e)
                }
            })?;
        
        // Get branch name (handles unborn branch)
        let branch = match repo.head() {
            Ok(head) => head.shorthand().map(|s| s.to_string()),
            Err(e) if e.code() == ErrorCode::UnbornBranch => Some("main".to_string()),
            Err(e) if e.code() == ErrorCode::NotFound => None,
            Err(e) => return Err(AppError::Git(e)),
        };
        
        // Check if dirty (any non-CURRENT status)
        let is_dirty = {
            let statuses = repo.statuses(Some(
                StatusOptions::new()
                    .include_untracked(true)
            ))?;
            statuses.iter().any(|e| e.status() != git2::Status::CURRENT)
        };
        
        Ok(RepositoryInfo {
            path,
            branch,
            is_dirty,
        })
    }).await?
}
```

### Directory Picker with Validation

```typescript
// Source: Tauri v2 dialog plugin docs
import { open } from '@tauri-apps/plugin-dialog';
import { commands } from './bindings';

export async function openRepositoryDialog(): Promise<RepositoryInfo | null> {
    const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Git Repository',
    });
    
    if (!selected) return null;
    
    try {
        return await commands.openRepository({ path: selected });
    } catch (error) {
        // Error is already a string from our Serialize impl
        throw new Error(`Failed to open repository: ${error}`);
    }
}
```

### Recent Repositories with Store Plugin

```typescript
// Source: Tauri v2 store plugin docs
import { load } from '@tauri-apps/plugin-store';

interface RecentRepo {
    path: string;
    name: string;
    lastOpened: number;
}

const STORE_PATH = 'recent-repos.json';
const MAX_RECENT = 10;

export async function getRecentRepositories(): Promise<RecentRepo[]> {
    const store = await load(STORE_PATH);
    const repos = await store.get<RecentRepo[]>('recent') ?? [];
    return repos.sort((a, b) => b.lastOpened - a.lastOpened);
}

export async function addRecentRepository(path: string, name: string): Promise<void> {
    const store = await load(STORE_PATH);
    const repos = await store.get<RecentRepo[]>('recent') ?? [];
    
    // Remove if exists, add to front
    const filtered = repos.filter(r => r.path !== path);
    const updated = [
        { path, name, lastOpened: Date.now() },
        ...filtered,
    ].slice(0, MAX_RECENT);
    
    await store.set('recent', updated);
    await store.save();
}

export async function removeRecentRepository(path: string): Promise<void> {
    const store = await load(STORE_PATH);
    const repos = await store.get<RecentRepo[]>('recent') ?? [];
    await store.set('recent', repos.filter(r => r.path !== path));
    await store.save();
}
```

### Zustand Store with Persistence

```typescript
// Source: Zustand docs + Tauri patterns
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AppState {
    // UI state
    currentPath: string | null;
    
    // Repository state (synced from backend)
    branch: string | null;
    isDirty: boolean;
    
    // Actions
    setRepository: (path: string, branch: string | null, isDirty: boolean) => void;
    clearRepository: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            currentPath: null,
            branch: null,
            isDirty: false,
            
            setRepository: (path, branch, isDirty) => set({
                currentPath: path,
                branch,
                isDirty,
            }),
            
            clearRepository: () => set({
                currentPath: null,
                branch: null,
                isDirty: false,
            }),
        }),
        {
            name: 'flowforge-app-state',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ currentPath: state.currentPath }),
        }
    )
);
```

### Window Configuration

```json
// Source: Tauri v2 configuration docs
// tauri.conf.json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "FlowForge",
  "identifier": "com.flowforge.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "FlowForge",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "center": true,
        "visible": false,
        "decorations": true
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
```

### Capabilities Configuration

```json
// Source: Tauri v2 capabilities docs
// src-tauri/capabilities/default.json
{
  "$schema": "https://schemas.tauri.app/config/2/capabilities",
  "identifier": "default",
  "description": "Default capabilities for FlowForge",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "store:default",
    "window-state:default"
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 APIs | Tauri v2 plugins | Oct 2024 | All APIs now plugins |
| `tauri::api::dialog` | `tauri-plugin-dialog` | Tauri 2.0 | Must add as dependency |
| Manual invoke types | tauri-specta | 2024 | Compile-time IPC safety |
| git2 direct calls | spawn_blocking wrapper | Always | Required for async |

**Deprecated/outdated:**
- `tauri::api::*` modules: Moved to separate plugins in Tauri 2.0
- Tauri 1.x configuration format: Different JSON structure in 2.x
- `tauri-specta` 1.x: Use 2.0.0-rc.21 for Tauri 2 compatibility

## Open Questions

Things that couldn't be fully resolved:

1. **tauri-specta stable release timing**
   - What we know: v2.0.0-rc.21 is latest (Jan 2025), works with Tauri 2.0 stable
   - What's unclear: When will stable 2.0.0 release?
   - Recommendation: Use RC with exact version pinning (`=2.0.0-rc.21`)

2. **Drag-drop folder handling**
   - What we know: Tauri 2 has `tauri://drag-drop` event; browser native doesn't expose paths
   - What's unclear: Best practice for element-specific drop zones
   - Recommendation: Use Tauri drag events with mouse position tracking workaround

3. **Window-state macOS restore bug**
   - What we know: Reported issues with fullscreen exit not restoring original size
   - What's unclear: If fixed in latest plugin version
   - Recommendation: Test thoroughly; consider manual workaround if needed

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Documentation](https://v2.tauri.app/) - Official docs for Tauri 2.0
- [Tauri Dialog Plugin](https://v2.tauri.app/plugin/dialog/) - File picker setup
- [Tauri Store Plugin](https://v2.tauri.app/plugin/store/) - Data persistence
- [Tauri Window State Plugin](https://v2.tauri.app/plugin/window-state/) - Window persistence
- [Tauri State Management](https://v2.tauri.app/develop/state-management/) - Mutex patterns
- [git2-rs Repository](https://docs.rs/git2/latest/git2/struct.Repository.html) - API reference
- [git2-rs status.rs example](https://github.com/rust-lang/git2-rs/blob/master/examples/status.rs) - Status patterns
- [tauri-specta Documentation](https://specta.dev/docs/tauri-specta/v2) - Type-safe IPC setup
- [tauri-specta GitHub](https://github.com/specta-rs/tauri-specta) - Version info
- [shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite) - Frontend setup

### Secondary (MEDIUM confidence)
- [Tauri Error Handling Tutorial](https://tauritutorials.com/blog/handling-errors-in-tauri) - Error patterns
- [Zustand Documentation](https://zustand.docs.pmnd.rs/) - State persistence patterns

### Tertiary (LOW confidence)
- Community discussions on drag-drop handling - Implementation details vary

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified against official Tauri 2.0 docs and crates.io
- Architecture: HIGH - Based on official Tauri patterns and documented pitfalls
- Pitfalls: HIGH - Documented in project's existing PITFALLS.md research

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - Tauri ecosystem is stable post-2.0)
