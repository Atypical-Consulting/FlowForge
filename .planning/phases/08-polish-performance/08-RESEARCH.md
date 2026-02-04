# Phase 8: Polish & Performance - Research

**Researched:** 2026-02-04
**Domain:** UX Polish (Theming, Keyboard Shortcuts, Persistence) and Performance Optimization
**Confidence:** HIGH

## Summary

Phase 8 focuses on two major areas: UX fundamentals (theming, keyboard shortcuts, state persistence, error handling) and performance optimization (operation speed, memory usage, binary size, virtual scrolling, file watching). The project already has foundational elements in place: Catppuccin Mocha theme, `@tauri-apps/plugin-store` for persistence, `@tauri-apps/plugin-window-state` for window state, and `react-virtuoso` for virtual scrolling.

The primary work involves: (1) adding Catppuccin Latte as a light theme with toggle functionality, (2) implementing keyboard shortcuts with `react-hotkeys-hook`, (3) adding commit search functionality, (4) implementing undo for Git operations via reflog, (5) adding the `notify` crate for file watching, and (6) configuring Cargo release profile for binary size optimization.

**Primary recommendation:** Leverage existing infrastructure (Catppuccin, Tauri plugins, react-virtuoso) and add minimal new dependencies (react-hotkeys-hook, notify-rs) to meet all requirements with consistent architecture.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @catppuccin/tailwindcss | ^1.0.0 | Theme colors (Mocha dark) | Already in use, add Latte for light |
| @tauri-apps/plugin-store | ^2 | Key-value persistence | Theme preference storage |
| @tauri-apps/plugin-window-state | ^2 | Window size/position | Automatic save/restore on close |
| react-virtuoso | ^4.18.1 | Virtual scrolling | Already in use for lists |
| zustand | ^5 | State management | Already in use for stores |

### New Dependencies

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hotkeys-hook | ^4.x | Keyboard shortcuts | Modern React hook API, scoped hotkeys, active maintenance |
| notify (Rust) | ^8.x | File system watching | Cross-platform, debouncing support, standard for Rust |
| notify-debouncer-mini (Rust) | ^0.5 | Event debouncing | Companion to notify, simple 500ms debounce |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-hotkeys-hook | mousetrap | Mousetrap is global-only, requires manual cleanup |
| notify-rs | tauri-plugin-fs watch | Tauri fs watch has 500ms default debounce but less control |
| @tanstack/react-virtual | react-virtuoso | Already using react-virtuoso, no need to switch |

**Installation:**
```bash
# Frontend
npm install react-hotkeys-hook@^4

# Backend (src-tauri/Cargo.toml)
# Add:
# notify = "8"
# notify-debouncer-mini = "0.5"
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── hooks/
│   ├── useTheme.ts           # Theme toggle with localStorage + system preference
│   ├── useHotkeys.ts         # Global keyboard shortcuts registry
│   └── useCommitSearch.ts    # Commit message search
├── stores/
│   └── settings.ts           # Theme, shortcuts preferences (zustand + tauri-store)
├── components/
│   ├── settings/
│   │   ├── ThemeToggle.tsx   # Light/Dark/System toggle
│   │   └── ShortcutsHelp.tsx # Keyboard shortcuts reference
│   └── commit/
│       └── CommitSearch.tsx  # Search input with results

src-tauri/src/
├── git/
│   ├── search.rs             # Commit message search (git log --grep)
│   ├── undo.rs               # Undo operations via reflog
│   └── watcher.rs            # File system watcher with notify-rs
```

### Pattern 1: Theme Toggle with Catppuccin

**What:** Three-way theme toggle (Light/Dark/System) using Catppuccin Latte and Mocha
**When to use:** UX-01, UX-02, UX-03 requirements
**Example:**
```typescript
// src/hooks/useTheme.ts
// Source: https://tailwindcss.com/docs/dark-mode

import { LazyStore } from "@tauri-apps/plugin-store";

type Theme = "light" | "dark" | "system";

const store = new LazyStore("settings.json");

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  
  useEffect(() => {
    // Load saved preference
    store.get<Theme>("theme").then((saved) => {
      if (saved) setThemeState(saved);
    });
  }, []);
  
  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    await store.set("theme", newTheme);
    await store.save();
    
    // Apply to DOM
    const root = document.documentElement;
    root.classList.remove("latte", "mocha");
    
    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(prefersDark ? "mocha" : "latte");
    } else {
      root.classList.add(newTheme === "dark" ? "mocha" : "latte");
    }
  };
  
  return { theme, setTheme };
}
```

```css
/* src/index.css */
/* Source: https://github.com/catppuccin/tailwindcss */

@import "tailwindcss";
@import "@catppuccin/tailwindcss/latte.css";
@import "@catppuccin/tailwindcss/mocha.css";

/* Apply theme based on class on html element */
@custom-variant latte (&:where(.latte, .latte *));
@custom-variant mocha (&:where(.mocha, .mocha *));
```

### Pattern 2: Global Keyboard Shortcuts

**What:** Application-wide keyboard shortcuts for common operations
**When to use:** UX-04 requirement
**Example:**
```typescript
// src/hooks/useGlobalHotkeys.ts
// Source: https://react-hotkeys-hook.vercel.app/docs/api/use-hotkeys

import { useHotkeys } from "react-hotkeys-hook";
import { useStagingStore } from "../stores/staging";
import { useRepositoryStore } from "../stores/repository";

export function useGlobalHotkeys() {
  const { stageAll } = useStagingStore();
  const { refresh } = useRepositoryStore();
  
  // Stage all changes: Ctrl/Cmd + Shift + S
  useHotkeys("mod+shift+s", () => stageAll(), {
    preventDefault: true,
    description: "Stage all changes",
  });
  
  // Commit: Ctrl/Cmd + Enter (enabled only when form is focused)
  useHotkeys("mod+enter", () => {
    document.querySelector<HTMLButtonElement>('[data-action="commit"]')?.click();
  }, {
    preventDefault: true,
    enableOnFormTags: true,
    description: "Create commit",
  });
  
  // Push: Ctrl/Cmd + Shift + P
  useHotkeys("mod+shift+p", () => {
    document.querySelector<HTMLButtonElement>('[data-action="push"]')?.click();
  }, {
    preventDefault: true,
    description: "Push to remote",
  });
  
  // Refresh: Ctrl/Cmd + R
  useHotkeys("mod+r", () => refresh(), {
    preventDefault: true,
    description: "Refresh repository",
  });
}
```

### Pattern 3: Commit Message Search

**What:** Search commits by message text with debounced input
**When to use:** UX-05 requirement
**Example:**
```rust
// src-tauri/src/git/search.rs

use git2::Repository;

#[tauri::command]
#[specta::specta]
pub fn search_commits(
    repo_path: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<CommitInfo>, GitError> {
    let repo = Repository::open(repo_path)?;
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    
    for oid in revwalk {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        
        if let Some(message) = commit.message() {
            if message.to_lowercase().contains(&query_lower) {
                results.push(CommitInfo::from_commit(&commit));
                if results.len() >= limit {
                    break;
                }
            }
        }
    }
    
    Ok(results)
}
```

### Pattern 4: File System Watcher

**What:** Watch repository for external changes with debouncing
**When to use:** PERF-05 requirement (500ms detection)
**Example:**
```rust
// src-tauri/src/git/watcher.rs
// Source: https://docs.rs/notify/latest/notify/

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use notify_debouncer_mini::{new_debouncer, DebouncedEvent};
use std::path::Path;
use std::sync::mpsc;
use std::time::Duration;

pub fn watch_repository(
    repo_path: &Path,
    app_handle: tauri::AppHandle,
) -> Result<(), notify::Error> {
    let (tx, rx) = mpsc::channel();
    
    // 500ms debounce per PERF-05
    let mut debouncer = new_debouncer(Duration::from_millis(500), tx)?;
    
    // Watch key files/dirs
    debouncer.watcher().watch(
        &repo_path.join(".git/HEAD"),
        RecursiveMode::NonRecursive,
    )?;
    debouncer.watcher().watch(
        &repo_path.join(".git/refs"),
        RecursiveMode::Recursive,
    )?;
    debouncer.watcher().watch(
        &repo_path.join(".git/index"),
        RecursiveMode::NonRecursive,
    )?;
    
    // Emit events to frontend
    std::thread::spawn(move || {
        for events in rx {
            if let Ok(events) = events {
                app_handle.emit("repo-changed", ()).ok();
            }
        }
    });
    
    Ok(())
}
```

### Pattern 5: Undo Git Operations

**What:** Undo last operation using reflog
**When to use:** UX-06 requirement
**Example:**
```rust
// src-tauri/src/git/undo.rs

use git2::{Repository, ResetType};

#[tauri::command]
#[specta::specta]
pub fn undo_last_operation(repo_path: &str) -> Result<UndoResult, GitError> {
    let repo = Repository::open(repo_path)?;
    
    // Get reflog to find previous state
    let reflog = repo.reflog("HEAD")?;
    
    if reflog.len() < 2 {
        return Err(GitError::NothingToUndo);
    }
    
    // Entry 0 is current, entry 1 is previous
    let previous = reflog.get(1).ok_or(GitError::NothingToUndo)?;
    let target_oid = previous.id_new();
    let target_commit = repo.find_commit(target_oid)?;
    
    // Mixed reset to previous state (preserves working directory)
    repo.reset(target_commit.as_object(), ResetType::Mixed, None)?;
    
    Ok(UndoResult {
        message: format!("Undone to: {}", previous.message().unwrap_or("Unknown")),
        previous_head: target_oid.to_string(),
    })
}
```

### Anti-Patterns to Avoid

- **Theme flash on load:** Always add theme initialization in `<head>` before React renders
- **Global hotkeys in forms:** Use `enableOnFormTags: false` (default) or scope to specific elements
- **Polling for file changes:** Use notify-rs event-driven watching, not setInterval
- **Searching full history:** Always limit commit search results (e.g., 100 max)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard shortcuts | addEventListener + cleanup | react-hotkeys-hook | Handles focus scoping, cleanup, modifier keys |
| File watching | setInterval polling | notify-rs + debouncer | Event-driven, cross-platform, efficient |
| Window state persistence | localStorage + resize listeners | @tauri-apps/plugin-window-state | Automatic, handles edge cases |
| Theme persistence | localStorage directly | @tauri-apps/plugin-store | Tauri-native, cross-platform file location |
| Virtual scrolling | Manual DOM manipulation | react-virtuoso (already installed) | Handles dynamic heights, smooth scrolling |

**Key insight:** Tauri plugins already handle persistence correctly. Use them instead of web-only solutions like localStorage for cross-platform consistency.

## Common Pitfalls

### Pitfall 1: Theme Flash on Load (FOUC)

**What goes wrong:** Page renders with wrong theme before JavaScript runs
**Why it happens:** Theme state loaded after React hydration
**How to avoid:** Add inline script in `<head>` before any content
**Warning signs:** Brief flash of light/dark theme on app start

```html
<!-- index.html - add before any scripts -->
<script>
  (function() {
    const theme = localStorage.getItem('theme') || 'system';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.classList.add(isDark ? 'mocha' : 'latte');
  })();
</script>
```

### Pitfall 2: Hotkey Conflicts with Browser

**What goes wrong:** Shortcuts like Ctrl+S trigger browser save dialog
**Why it happens:** Not calling `preventDefault()` on keyboard events
**How to avoid:** Always use `preventDefault: true` in useHotkeys options
**Warning signs:** Browser dialogs appearing when using shortcuts

### Pitfall 3: Memory Leaks from File Watcher

**What goes wrong:** File watcher keeps running after repository closes
**Why it happens:** Watcher not cleaned up on component unmount/repo change
**How to avoid:** Store watcher handle and call `unwatch()` on cleanup
**Warning signs:** Memory usage growing over time, multiple change events

### Pitfall 4: Binary Size Bloat

**What goes wrong:** Release binary exceeds 50MB target
**Why it happens:** Debug symbols, unoptimized codegen, unused features
**How to avoid:** Apply all Cargo release profile optimizations
**Warning signs:** Binary size > 50MB, slow startup

### Pitfall 5: Slow Commit Search

**What goes wrong:** Search takes seconds on large repositories
**Why it happens:** Walking full history without limits
**How to avoid:** Always limit results, use git2's native string matching
**Warning signs:** UI freeze during search, >100ms response time

## Code Examples

### Complete Theme Toggle Component

```typescript
// src/components/settings/ThemeToggle.tsx
// Source: https://tailwindcss.com/docs/dark-mode

import { useTheme } from "../../hooks/useTheme";
import { Moon, Sun, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <div className="flex gap-1 rounded-lg bg-ctp-surface0 p-1">
      <button
        onClick={() => setTheme("light")}
        className={`p-2 rounded ${theme === "light" ? "bg-ctp-surface1" : ""}`}
        aria-label="Light theme"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-2 rounded ${theme === "dark" ? "bg-ctp-surface1" : ""}`}
        aria-label="Dark theme"
      >
        <Moon className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`p-2 rounded ${theme === "system" ? "bg-ctp-surface1" : ""}`}
        aria-label="System theme"
      >
        <Monitor className="w-4 h-4" />
      </button>
    </div>
  );
}
```

### Keyboard Shortcuts Help Dialog

```typescript
// src/components/settings/ShortcutsHelp.tsx

const SHORTCUTS = [
  { key: "Mod+Shift+S", action: "Stage all changes" },
  { key: "Mod+Enter", action: "Create commit" },
  { key: "Mod+Shift+P", action: "Push to remote" },
  { key: "Mod+R", action: "Refresh repository" },
  { key: "Mod+F", action: "Search commits" },
  { key: "Mod+Z", action: "Undo last operation" },
];

export function ShortcutsHelp() {
  const isMac = navigator.platform.includes("Mac");
  const modKey = isMac ? "Cmd" : "Ctrl";
  
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
      <dl className="space-y-2">
        {SHORTCUTS.map(({ key, action }) => (
          <div key={key} className="flex justify-between">
            <dt className="text-ctp-subtext0">{action}</dt>
            <dd className="font-mono text-sm bg-ctp-surface0 px-2 py-1 rounded">
              {key.replace("Mod", modKey)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

### Commit Search with Debounce

```typescript
// src/components/commit/CommitSearch.tsx

import { useState, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { invoke } from "@tauri-apps/api/core";
import { Search } from "lucide-react";

export function CommitSearch({ repoPath }: { repoPath: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommitInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus search with Mod+F
  useHotkeys("mod+f", () => inputRef.current?.focus(), {
    preventDefault: true,
  });
  
  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const commits = await invoke<CommitInfo[]>("search_commits", {
          repoPath,
          query: query.trim(),
          limit: 50,
        });
        setResults(commits);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query, repoPath]);
  
  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-ctp-surface0 rounded px-3 py-2">
        <Search className="w-4 h-4 text-ctp-subtext0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search commits... (Ctrl+F)"
          className="bg-transparent flex-1 outline-none"
        />
        {isSearching && <span className="animate-spin">...</span>}
      </div>
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-ctp-mantle rounded shadow-lg max-h-64 overflow-auto">
          {results.map((commit) => (
            <div key={commit.oid} className="px-3 py-2 hover:bg-ctp-surface0">
              <p className="text-sm truncate">{commit.message}</p>
              <p className="text-xs text-ctp-subtext0">{commit.oid.slice(0, 7)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Cargo Release Profile for Size Optimization

```toml
# src-tauri/Cargo.toml
# Source: https://v2.tauri.app/concept/size/

[profile.release]
codegen-units = 1      # Better optimization, slower compile
lto = true             # Link-time optimization
opt-level = "s"        # Optimize for size
panic = "abort"        # Smaller panic handling
strip = true           # Remove debug symbols
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS media query dark mode | Class-based with JS toggle | Tailwind v3+ | User can override system preference |
| document.addEventListener for keys | react-hotkeys-hook | 2022+ | Safer cleanup, scoped hotkeys |
| setInterval file polling | notify-rs event-driven | Always preferred | Lower CPU, faster detection |
| Full history search | Limited + indexed search | Performance requirement | <100ms responses |

**Deprecated/outdated:**
- `window.matchMedia` alone for theming: Use class toggle with localStorage for user preference
- Manual keyboard event listeners: Use react-hotkeys-hook for React lifecycle integration
- Tauri v1 fs-watch plugin: Use notify-rs directly in Rust for more control

## Open Questions

1. **Undo scope for UX-06**
   - What we know: Git reflog allows undoing most operations
   - What's unclear: Should we undo only commits, or also branch switches, merges?
   - Recommendation: Start with commit undo only, expand based on user feedback

2. **Monaco editor theme sync**
   - What we know: Monaco has its own theme system (currently `flowforge-dark`)
   - What's unclear: Should Monaco theme follow app theme toggle?
   - Recommendation: Create `flowforge-light` Monaco theme and sync with app theme

3. **Performance measurement methodology**
   - What we know: PERF-01 requires <100ms for common operations
   - What's unclear: How to measure consistently (cold vs warm, first vs subsequent)
   - Recommendation: Use Tauri's dev tools timing, measure 95th percentile across 10 runs

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Store Plugin](https://v2.tauri.app/plugin/store/) - Official documentation
- [Tauri v2 Window State Plugin](https://v2.tauri.app/plugin/window-state/) - Official documentation
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode) - Official documentation
- [react-hotkeys-hook API](https://react-hotkeys-hook.vercel.app/docs/api/use-hotkeys) - Official documentation
- [notify-rs crate](https://docs.rs/notify/latest/notify/) - Official documentation
- [Tauri Binary Size](https://v2.tauri.app/concept/size/) - Official documentation

### Secondary (MEDIUM confidence)
- [Catppuccin Tailwind CSS](https://github.com/catppuccin/tailwindcss) - Official GitHub repo
- [React Virtuoso](https://virtuoso.dev/) - Official documentation
- [GitHub Blog: Undo with Git](https://github.blog/open-source/git/how-to-undo-almost-anything-with-git/) - Authoritative guide

### Tertiary (LOW confidence)
- [Catppuccin light/dark mode blog](https://www.markpitblado.me/blog/easy-light-and-dark-mode-with-catppuccin-and-tailwindcss/) - Community implementation example

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using official Tauri plugins already installed, well-documented libraries
- Architecture: HIGH - Patterns follow official documentation and existing codebase conventions
- Pitfalls: HIGH - Common issues well-documented in official sources
- Performance targets: MEDIUM - Specific numbers (100ms, 200MB, 50MB) need validation during implementation

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - stable libraries)
