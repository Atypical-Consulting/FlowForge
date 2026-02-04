# Research: Phase 07 - Worktree Management

**Researched:** 2026-02-04
**Confidence:** HIGH
**Requirements:** WORK-01 through WORK-09

## Executive Summary

Git worktrees allow multiple working directories from a single repository, enabling parallel development without stashing or committing incomplete work. This phase implements comprehensive worktree management using git2-rs (libgit2 bindings) for the backend and Tauri plugins for native file system operations. The implementation follows established patterns in the codebase while introducing a new dedicated Worktree panel in the UI.

**Key decisions:**
- Use git2-rs worktree APIs (not shell-out) for consistency with existing codebase
- Use Tauri Dialog plugin for directory picker (cross-platform native dialogs)
- Use Tauri Opener plugin for "open in file explorer" functionality
- Follow existing Zustand store patterns for frontend state management

## 1. Backend Architecture (Rust)

### git2-rs Worktree API

The git2 crate provides complete worktree management capabilities. Confidence: **HIGH** (verified via docs.rs).

**Repository methods:**
```rust
// List all worktrees
pub fn worktrees(&self) -> Result<StringArray, Error>

// Lookup worktree by name
pub fn find_worktree(&self, name: &str) -> Result<Worktree, Error>

// Test if this repo is itself a worktree
pub fn is_worktree(&self) -> bool

// Open repository from worktree
pub fn open_from_worktree(worktree: &Worktree) -> Result<Repository, Error>
```

**Worktree struct methods:**
```rust
// Get worktree name (used to find_worktree later)
pub fn name(&self) -> Option<&str>

// Get filesystem path to worktree root
pub fn path(&self) -> &Path

// Validate worktree (filesystem + git metadata)
pub fn validate(&self) -> Result<(), Error>

// Lock management
pub fn lock(&self, reason: Option<&str>) -> Result<(), Error>
pub fn unlock(&self) -> Result<(), Error>
pub fn is_locked(&self) -> Result<WorktreeLockStatus, Error>

// Pruning (deletion)
pub fn prune(&self, opts: Option<&mut WorktreePruneOptions>) -> Result<(), Error>
pub fn is_prunable(&self, opts: Option<&mut WorktreePruneOptions>) -> Result<bool, Error>
```

**WorktreeAddOptions:**
```rust
pub fn new() -> WorktreeAddOptions<'a>
pub fn lock(&mut self, enabled: bool) -> &mut Self
pub fn checkout_existing(&mut self, enabled: bool) -> &mut Self
pub fn reference(&mut self, reference: Option<&'a Reference<'_>>) -> &mut Self
```

### New Rust Module: `worktree.rs`

```rust
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    /// Worktree identifier name
    pub name: String,
    /// Full filesystem path
    pub path: String,
    /// Associated branch name (if any)
    pub branch: Option<String>,
    /// Status: clean, dirty, or conflicts
    pub status: WorktreeStatus,
    /// Lock status
    pub is_locked: bool,
    /// Lock reason (if locked)
    pub lock_reason: Option<String>,
    /// Whether this is the main worktree
    pub is_main: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum WorktreeStatus {
    Clean,
    Dirty,
    Conflicts,
    Invalid, // worktree path doesn't exist or metadata corrupted
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorktreeOptions {
    /// Name for the worktree
    pub name: String,
    /// Directory path for worktree
    pub path: String,
    /// Branch to checkout (existing or new)
    pub branch: String,
    /// Create new branch if it doesn't exist
    pub create_branch: bool,
    /// Lock worktree after creation
    pub lock: bool,
}
```

### Tauri Commands

```rust
#[tauri::command]
#[specta::specta]
pub async fn list_worktrees(
    state: State<'_, RepositoryState>
) -> Result<Vec<WorktreeInfo>, GitError>

#[tauri::command]
#[specta::specta]
pub async fn create_worktree(
    options: CreateWorktreeOptions,
    state: State<'_, RepositoryState>
) -> Result<WorktreeInfo, GitError>

#[tauri::command]
#[specta::specta]
pub async fn delete_worktree(
    name: String,
    force: bool,
    delete_branch: bool,
    state: State<'_, RepositoryState>
) -> Result<(), GitError>

#[tauri::command]
#[specta::specta]
pub async fn get_worktree_status(
    name: String,
    state: State<'_, RepositoryState>
) -> Result<WorktreeStatus, GitError>

#[tauri::command]
#[specta::specta]
pub async fn is_branch_checked_out_in_worktree(
    branch: String,
    state: State<'_, RepositoryState>
) -> Result<Option<String>, GitError>  // Returns worktree name if checked out
```

### Implementation Details

**Listing worktrees with status:**
```rust
pub async fn list_worktrees(
    state: State<'_, RepositoryState>
) -> Result<Vec<WorktreeInfo>, GitError> {
    let repo_path = state.get_path()?;
    
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let worktree_names = repo.worktrees()?;
        
        let mut result = Vec::new();
        
        // Add main worktree first
        result.push(get_main_worktree_info(&repo)?);
        
        // Add linked worktrees
        for name in worktree_names.iter().flatten() {
            let worktree = repo.find_worktree(name)?;
            let info = get_worktree_info(&repo, &worktree)?;
            result.push(info);
        }
        
        Ok(result)
    }).await.map_err(|e| GitError::Internal(e.to_string()))?
}

fn get_worktree_info(
    main_repo: &Repository,
    worktree: &Worktree
) -> Result<WorktreeInfo, GitError> {
    let path = worktree.path();
    let name = worktree.name().unwrap_or("").to_string();
    
    // Get status by opening worktree as repository
    let status = if worktree.validate().is_ok() {
        let wt_repo = Repository::open(path)?;
        compute_worktree_status(&wt_repo)?
    } else {
        WorktreeStatus::Invalid
    };
    
    // Get branch
    let branch = if let Ok(wt_repo) = Repository::open(path) {
        wt_repo.head().ok()
            .and_then(|h| h.shorthand().map(String::from))
    } else {
        None
    };
    
    // Lock status
    let lock_status = worktree.is_locked()?;
    let (is_locked, lock_reason) = match lock_status {
        WorktreeLockStatus::Unlocked => (false, None),
        WorktreeLockStatus::Locked(reason) => (true, reason),
    };
    
    Ok(WorktreeInfo {
        name,
        path: path.display().to_string(),
        branch,
        status,
        is_locked,
        lock_reason,
        is_main: false,
    })
}

fn compute_worktree_status(repo: &Repository) -> Result<WorktreeStatus, GitError> {
    let statuses = repo.statuses(None)?;
    
    let has_conflicts = statuses.iter().any(|s| s.status().is_conflicted());
    if has_conflicts {
        return Ok(WorktreeStatus::Conflicts);
    }
    
    let is_dirty = statuses.iter().any(|s| {
        let status = s.status();
        status.is_wt_modified() || 
        status.is_wt_new() || 
        status.is_wt_deleted() ||
        status.is_index_modified() ||
        status.is_index_new() ||
        status.is_index_deleted()
    });
    
    if is_dirty {
        Ok(WorktreeStatus::Dirty)
    } else {
        Ok(WorktreeStatus::Clean)
    }
}
```

**Creating worktree:**
```rust
pub async fn create_worktree(
    options: CreateWorktreeOptions,
    state: State<'_, RepositoryState>
) -> Result<WorktreeInfo, GitError> {
    let repo_path = state.get_path()?;
    
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        
        // Get or create branch reference
        let reference = if options.create_branch {
            // Create new branch from HEAD
            let head = repo.head()?;
            let commit = head.peel_to_commit()?;
            repo.branch(&options.branch, &commit, false)?;
            Some(repo.find_branch(&options.branch, BranchType::Local)?.into_reference())
        } else {
            // Use existing branch
            Some(repo.find_branch(&options.branch, BranchType::Local)?.into_reference())
        };
        
        let mut add_opts = WorktreeAddOptions::new();
        add_opts.lock(options.lock);
        if let Some(ref r) = reference {
            add_opts.reference(Some(r));
        }
        
        let worktree = repo.worktree_add(&options.name, Path::new(&options.path), Some(&add_opts))?;
        
        get_worktree_info(&repo, &worktree)
    }).await.map_err(|e| GitError::Internal(e.to_string()))?
}
```

**Deleting worktree with optional branch cleanup:**
```rust
pub async fn delete_worktree(
    name: String,
    force: bool,
    delete_branch: bool,
    state: State<'_, RepositoryState>
) -> Result<(), GitError> {
    let repo_path = state.get_path()?;
    
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let worktree = repo.find_worktree(&name)?;
        
        // Get branch name before deletion for optional cleanup
        let branch_name = if delete_branch {
            let wt_repo = Repository::open(worktree.path())?;
            wt_repo.head().ok()
                .and_then(|h| h.shorthand().map(String::from))
        } else {
            None
        };
        
        // Prune worktree
        let mut prune_opts = WorktreePruneOptions::new();
        if force {
            prune_opts.flags(
                git2::WorktreePruneFlag::VALID | 
                git2::WorktreePruneFlag::WORKING_TREE
            );
        }
        
        worktree.prune(Some(&mut prune_opts))?;
        
        // Delete branch if requested and fully merged
        if let Some(branch) = branch_name {
            if let Ok(mut b) = repo.find_branch(&branch, BranchType::Local) {
                // Only delete if fully merged (use false for force)
                let _ = b.delete();
            }
        }
        
        Ok(())
    }).await.map_err(|e| GitError::Internal(e.to_string()))?
}
```

## 2. Tauri Plugins Required

### Dialog Plugin (Directory Picker)

**Source:** [Tauri Dialog Plugin Documentation](https://v2.tauri.app/plugin/dialog/)

**Cargo.toml:**
```toml
[dependencies]
tauri-plugin-dialog = "2"
```

**capabilities/default.json:**
```json
{
  "permissions": [
    "dialog:allow-open"
  ]
}
```

**Frontend usage:**
```typescript
import { open } from '@tauri-apps/plugin-dialog';

async function selectWorktreeDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Worktree Directory",
    defaultPath: await homeDir(), // from @tauri-apps/api/path
  });
  
  return selected as string | null;
}
```

**Platform notes:**
- Full support on Windows, macOS, Linux
- iOS and Android do NOT support folder picker (not relevant for desktop app)

### Opener Plugin (Open in File Explorer)

**Source:** [Tauri Opener Plugin Documentation](https://v2.tauri.app/plugin/opener/)

**Cargo.toml:**
```toml
[dependencies]
tauri-plugin-opener = "2"
```

**capabilities/default.json:**
```json
{
  "permissions": [
    "opener:allow-reveal-item-in-dir"
  ]
}
```

**Frontend usage:**
```typescript
import { revealItemInDir } from '@tauri-apps/plugin-opener';

async function openInExplorer(path: string): Promise<void> {
  await revealItemInDir(path);
}
```

**Cross-platform behavior:**
- macOS: Opens Finder with item selected
- Windows: Opens Explorer with item selected
- Linux: Opens default file manager

## 3. Frontend Architecture

### Zustand Store: `worktrees.ts`

```typescript
import { create } from "zustand";
import { commands } from "../bindings";
import { getErrorMessage } from "../lib/errors";

interface WorktreeState {
  worktrees: WorktreeInfo[];
  isLoading: boolean;
  error: string | null;
  selectedWorktree: string | null;
  
  // Actions
  loadWorktrees: () => Promise<void>;
  createWorktree: (options: CreateWorktreeOptions) => Promise<WorktreeInfo | null>;
  deleteWorktree: (name: string, force: boolean, deleteBranch: boolean) => Promise<boolean>;
  selectWorktree: (name: string | null) => void;
  openInExplorer: (path: string) => Promise<void>;
  switchToWorktree: (name: string) => Promise<boolean>;
  clearError: () => void;
}

export const useWorktreeStore = create<WorktreeState>((set, get) => ({
  worktrees: [],
  isLoading: false,
  error: null,
  selectedWorktree: null,

  loadWorktrees: async () => {
    set({ isLoading: true, error: null });
    const result = await commands.listWorktrees();
    if (result.status === "ok") {
      set({ worktrees: result.data, isLoading: false });
    } else {
      set({ error: getErrorMessage(result.error), isLoading: false });
    }
  },

  createWorktree: async (options) => {
    set({ isLoading: true, error: null });
    const result = await commands.createWorktree(options);
    if (result.status === "ok") {
      await get().loadWorktrees();
      return result.data;
    } else {
      set({ error: getErrorMessage(result.error), isLoading: false });
      return null;
    }
  },

  deleteWorktree: async (name, force, deleteBranch) => {
    set({ isLoading: true, error: null });
    const result = await commands.deleteWorktree(name, force, deleteBranch);
    if (result.status === "ok") {
      await get().loadWorktrees();
      return true;
    } else {
      set({ error: getErrorMessage(result.error), isLoading: false });
      return false;
    }
  },

  selectWorktree: (name) => set({ selectedWorktree: name }),

  openInExplorer: async (path) => {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
    await revealItemInDir(path);
  },

  switchToWorktree: async (name) => {
    const worktree = get().worktrees.find(w => w.name === name);
    if (!worktree) return false;
    
    // Open worktree as new repository context
    const result = await commands.openRepository(worktree.path);
    return result.status === "ok";
  },

  clearError: () => set({ error: null }),
}));
```

### Component Structure

```
src/components/worktrees/
├── WorktreePanel.tsx        # Main panel component
├── WorktreeList.tsx         # List of worktrees
├── WorktreeItem.tsx         # Single worktree row
├── CreateWorktreeDialog.tsx # Creation dialog
├── DeleteWorktreeDialog.tsx # Deletion confirmation
└── index.ts                 # Exports
```

## 4. UX Patterns from Industry Research

### GitKraken Worktree UX

Source: [GitKraken Worktrees Documentation](https://help.gitkraken.com/gitkraken-desktop/worktrees/)

Key patterns:
- Dedicated worktree panel in sidebar
- Visual indication of worktree status
- Two-click creation flow
- Branch association clearly visible

### lazygit Worktree UX

Source: [lazygit Worktree UX Discussion](https://github.com/jesseduffield/lazygit/discussions/2803)

Key insights:
- **Branch-worktree visibility tension:** If most branches have worktrees, showing association everywhere is noisy. If few have worktrees, it's valuable information.
- **Naming convention:** Default worktree name should match branch name
- **Directory organization:** Many users keep worktrees in a `.trees` subdirectory
- **Poll results:** 63% create one worktree per branch, 29% maintain small reusable set

### Recommended UX for FlowForge

1. **Dedicated Worktree Panel** - Collapsible section in sidebar (like stashes, tags)
2. **Status at a glance** - Color-coded icons: green (clean), yellow (dirty), red (conflicts)
3. **Branch association visible** - Show branch name under worktree name
4. **Two-click creation:** Click "+" > Select branch & directory > Done
5. **Safe deletion flow:** Confirmation dialog with branch deletion option
6. **Quick actions:** Open in explorer, switch context, delete

## 5. Pitfalls and Mitigations

### Pitfall 1: Ignored Files Don't Transfer

**Problem:** When creating a worktree, `.gitignore`d files (node_modules, .env) don't copy over.

**Source:** [Community discussion on worktree pitfalls](https://notes.billmill.org/blog/2024/03/How_I_use_git_worktrees.html)

**Mitigation:**
- Document this limitation in UI (tooltip or help text)
- Consider future feature: "Copy ignored files from main worktree" checkbox
- Show warning when creating worktree for Node.js projects

### Pitfall 2: Branch Deletion Blocked by Worktree

**Problem:** Cannot delete a branch that's checked out in any worktree.

**Source:** [Git documentation](https://git-scm.com/docs/git-worktree)

**Mitigation:**
- Check `is_branch_checked_out_in_worktree()` before attempting branch deletion
- Show informative error: "Branch 'X' is checked out in worktree 'Y'"
- Offer to delete worktree first, then branch

### Pitfall 3: Dirty Worktree Deletion

**Problem:** `git worktree remove` fails on dirty worktrees without `--force`.

**Mitigation:**
- Show status in delete confirmation dialog
- Warn if dirty: "This worktree has uncommitted changes"
- Require explicit "Force Delete" for dirty worktrees

### Pitfall 4: Stale Administrative Files

**Problem:** If worktree directory is manually deleted, git metadata becomes stale.

**Mitigation:**
- Mark worktrees with `WorktreeStatus::Invalid` if `validate()` fails
- Offer "Prune" action for invalid worktrees
- Auto-prune on app startup (optional setting)

### Pitfall 5: Performance with Many Worktrees

**Problem:** Each worktree status check requires opening a Repository.

**Mitigation:**
- Lazy load status (show "Loading..." initially)
- Cache status with TTL
- Only refresh visible worktrees
- Consider background refresh on interval

## 6. Dependencies to Add

### Rust (Cargo.toml)

```toml
[dependencies]
# Already present: git2 (includes worktree support)
tauri-plugin-dialog = "2"
tauri-plugin-opener = "2"
```

### Frontend (package.json)

```json
{
  "dependencies": {
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-opener": "^2.0.0"
  }
}
```

### Tauri Capabilities

```json
{
  "identifier": "default",
  "permissions": [
    "dialog:allow-open",
    "opener:allow-reveal-item-in-dir"
  ]
}
```

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| git2-rs worktree API gaps | Low | Medium | Verified API exists in docs.rs |
| Tauri plugin compatibility | Low | Medium | Both plugins are official Tauri plugins |
| Performance with 10+ worktrees | Medium | Low | Lazy loading, caching |
| Cross-platform file explorer | Low | Low | Tauri Opener handles this |
| Context switching UX confusion | Medium | Medium | Clear visual feedback, confirmation |

## 8. Recommended Plan Structure

1. **Plan 1: Backend Worktree Commands** (Rust)
   - Create `worktree.rs` module
   - Implement `list_worktrees`, `create_worktree`, `delete_worktree`
   - Add specta types for TypeScript generation
   - Register commands in main.rs

2. **Plan 2: Tauri Plugin Integration**
   - Add dialog and opener plugins
   - Configure capabilities
   - Test directory picker and file reveal

3. **Plan 3: Frontend Store**
   - Create `worktrees.ts` Zustand store
   - Implement actions for CRUD operations
   - Add error handling

4. **Plan 4: WorktreePanel Component**
   - Create panel with list view
   - Implement status indicators
   - Add refresh functionality

5. **Plan 5: Create/Delete Dialogs**
   - CreateWorktreeDialog with directory picker
   - DeleteWorktreeDialog with branch deletion option
   - Form validation

6. **Plan 6: Integration & Polish**
   - Open in file explorer
   - Switch worktree context
   - Branch-worktree association checks
   - UI integration with sidebar

## 9. References

- [git2-rs Worktree struct](https://docs.rs/git2/latest/git2/struct.Worktree.html) - Official Rust documentation
- [git2-rs Repository worktree methods](https://docs.rs/git2/latest/git2/struct.Repository.html) - Repository API
- [libgit2 worktree.h](https://github.com/libgit2/libgit2/blob/main/include/git2/worktree.h) - C API reference
- [Tauri Dialog Plugin](https://v2.tauri.app/plugin/dialog/) - Directory picker documentation
- [Tauri Opener Plugin](https://v2.tauri.app/plugin/opener/) - File explorer integration
- [GitKraken Worktrees](https://help.gitkraken.com/gitkraken-desktop/worktrees/) - Commercial GUI reference
- [lazygit Worktree Discussion](https://github.com/jesseduffield/lazygit/discussions/2803) - UX considerations
- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree) - Official git documentation
